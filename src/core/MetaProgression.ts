/**
 * Meta-progression system — persists stats and unlocks across runs via localStorage.
 * Pure logic, no Pixi imports.
 */
import { CARD_DATABASE } from '@shared/constants/cards';

// --- Interfaces ---

export interface MetaState {
  totalRuns: number;
  totalWins: number;
  perSurvivorWins: Record<number, number>;
  unlockedSurvivorIds: number[];
  unlockedDiceModifierIds: string[];
  maxDifficultyReached: number;
}

export interface UnlockResult {
  type: 'survivor' | 'diceModifier';
  id: number | string;
  name: string;
  description: string;
}

// --- Constants ---

const STORAGE_KEY = 'dice_and_cards_meta';

const DEFAULT_SURVIVOR_IDS = [1];
const DEFAULT_MODIFIER_IDS = ['rusty', 'heavy', 'broken'];

function defaultState(): MetaState {
  return {
    totalRuns: 0,
    totalWins: 0,
    perSurvivorWins: {},
    unlockedSurvivorIds: [...DEFAULT_SURVIVOR_IDS],
    unlockedDiceModifierIds: [...DEFAULT_MODIFIER_IDS],
    maxDifficultyReached: 0,
  };
}

// --- Unlock condition helpers ---

interface UnlockCondition {
  type: 'survivor' | 'diceModifier';
  id: number | string;
  check: (state: MetaState, won: boolean, finalHP: number) => boolean;
}

const UNLOCK_CONDITIONS: UnlockCondition[] = [
  // Progressive starter unlocks (IDs 2-5) — one per win
  { type: 'survivor', id: 2, check: (s) => s.totalWins >= 1 },
  { type: 'survivor', id: 3, check: (s) => s.totalWins >= 2 },
  { type: 'survivor', id: 4, check: (s) => s.totalWins >= 3 },
  { type: 'survivor', id: 5, check: (s) => s.totalWins >= 4 },
  // Advanced survivor unlocks
  { type: 'survivor', id: 6, check: (s) => s.totalWins >= 5 },
  { type: 'survivor', id: 7, check: (_s, won, finalHP) => won && finalHP < 3 },
  { type: 'survivor', id: 8, check: (s) => Object.keys(s.perSurvivorWins).length >= 7 },
  // Dice modifier unlocks
  { type: 'diceModifier', id: 'ivy', check: (s) => s.totalRuns >= 5 },
  { type: 'diceModifier', id: 'needle', check: (s) => s.totalRuns >= 5 },
  { type: 'diceModifier', id: 'root', check: (s) => s.totalRuns >= 10 },
];

// Modifier display info (for unlock notifications)
const MODIFIER_INFO: Record<string, { name: string; description: string }> = {
  rusty: { name: 'Dé Rouillé', description: 'Min 2 dégâts en ATQ' },
  heavy: { name: 'Dé Lourd', description: 'Ne dépasse pas 5, mais régulier' },
  broken: { name: 'Dé Brisé', description: 'Variance extrême — tout ou rien' },
  ivy: { name: 'Dé Lierre', description: 'Sur 6 : poison (1 dégât/tour x2)' },
  needle: { name: 'Dé Aiguille', description: 'Perce 2 DÉF ennemie' },
  root: { name: 'Dé Racine', description: 'Si utilisé en DÉF : +1 PV' },
};

// --- Class ---

export class MetaProgression {
  private state: MetaState;

  constructor() {
    this.state = this.load();
  }

  // --- Public API ---

  /**
   * Record a completed run. Increments stats, checks for new unlocks, saves.
   * Returns any newly unlocked items.
   */
  recordRun(survivorId: number, won: boolean, finalHP: number): UnlockResult[] {
    this.state.totalRuns++;
    if (won) {
      this.state.totalWins++;
      this.state.perSurvivorWins[survivorId] = (this.state.perSurvivorWins[survivorId] ?? 0) + 1;
    }

    const newUnlocks = this.checkUnlocks(won, finalHP);
    this.save();
    return newUnlocks;
  }

  getUnlockedSurvivorIds(): number[] {
    return [...this.state.unlockedSurvivorIds];
  }

  getUnlockedDiceModifierIds(): string[] {
    return [...this.state.unlockedDiceModifierIds];
  }

  getStats(): Readonly<MetaState> {
    return { ...this.state, perSurvivorWins: { ...this.state.perSurvivorWins } };
  }

  /**
   * Dynamic unlock condition text for locked survivor cards.
   */
  getUnlockConditionText(cardId: number): string {
    const winsNeeded: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
    if (cardId in winsNeeded) {
      const remaining = Math.max(0, winsNeeded[cardId] - this.state.totalWins);
      return remaining > 0 ? `Gagnez encore ${remaining} partie(s)` : 'Débloqué !';
    }
    switch (cardId) {
      case 7:
        return 'Gagnez une partie avec < 3 PV';
      case 8: {
        const uniqueWinners = Object.keys(this.state.perSurvivorWins).length;
        const remaining = Math.max(0, 7 - uniqueWinners);
        return remaining > 0 ? `Gagnez avec ${remaining} survivant(s) de plus` : 'Débloqué !';
      }
      default:
        return 'Condition inconnue';
    }
  }

  /** Reset all meta-progression to defaults. */
  reset(): void {
    this.state = defaultState();
    this.save();
  }

  // --- Private ---

  private checkUnlocks(won: boolean, finalHP: number): UnlockResult[] {
    const results: UnlockResult[] = [];

    for (const cond of UNLOCK_CONDITIONS) {
      if (!cond.check(this.state, won, finalHP)) continue;

      if (cond.type === 'survivor') {
        const id = cond.id as number;
        if (this.state.unlockedSurvivorIds.includes(id)) continue;
        this.state.unlockedSurvivorIds.push(id);
        const card = CARD_DATABASE.find(c => c.id === id);
        results.push({
          type: 'survivor',
          id,
          name: card?.name ?? `Survivor #${id}`,
          description: card?.description ?? '',
        });
      } else {
        const id = cond.id as string;
        if (this.state.unlockedDiceModifierIds.includes(id)) continue;
        this.state.unlockedDiceModifierIds.push(id);
        const info = MODIFIER_INFO[id];
        results.push({
          type: 'diceModifier',
          id,
          name: info?.name ?? id,
          description: info?.description ?? '',
        });
      }
    }

    return results;
  }

  private load(): MetaState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw) as Partial<MetaState>;
      // Merge with defaults for schema safety
      const defaults = defaultState();
      return {
        totalRuns: parsed.totalRuns ?? defaults.totalRuns,
        totalWins: parsed.totalWins ?? defaults.totalWins,
        perSurvivorWins: parsed.perSurvivorWins ?? defaults.perSurvivorWins,
        unlockedSurvivorIds: parsed.unlockedSurvivorIds ?? defaults.unlockedSurvivorIds,
        unlockedDiceModifierIds: parsed.unlockedDiceModifierIds ?? defaults.unlockedDiceModifierIds,
        maxDifficultyReached: parsed.maxDifficultyReached ?? defaults.maxDifficultyReached,
      };
    } catch {
      return defaultState();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }
}
