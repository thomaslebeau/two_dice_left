/**
 * Pure-logic event system (GDD v5).
 * Picks events from the pool (no repeats per run), applies choice effects
 * to run state. No Pixi imports — framework-agnostic.
 */
import type { GameEvent, EventEffect } from '@/types/event.types';
import type { DiceModifier } from '@/types/diceModifier.types';
import { EVENT_POOL } from '@shared/constants/events';
import { DICE_MODIFIERS, MAX_DICE_MODIFIERS } from '@shared/constants/diceModifiers';

// --- Public types ---

export interface RunState {
  hp: number;
  maxHp: number;
  atkBonus: number;
  defBonus: number;
  diceModifiers: DiceModifier[];
}

export interface ChoiceResult {
  effects: EventEffect[];
  riskSucceeded?: boolean; // undefined if no risk involved
}

export interface EventSystemSnapshot {
  currentEvent: GameEvent | null;
  usedEventIds: string[];
}

type EventSystemListener = (snapshot: EventSystemSnapshot) => void;

// --- Class ---

export class EventSystem {
  private _currentEvent: GameEvent | null = null;
  private _usedEventIds: string[] = [];
  private _unlockedModifierIds: Set<string> | null = null;
  private listeners = new Set<EventSystemListener>();

  // --- Subscription (same pattern as other engine classes) ---

  onChange(listener: EventSystemListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  snapshot(): EventSystemSnapshot {
    return {
      currentEvent: this._currentEvent,
      usedEventIds: [...this._usedEventIds],
    };
  }

  get currentEvent(): GameEvent | null {
    return this._currentEvent;
  }

  // --- Modifier filtering ---

  /**
   * Set which dice modifiers are unlocked. Forge events referencing
   * locked modifiers will be filtered out entirely.
   */
  setUnlockedModifiers(ids: string[]): void {
    this._unlockedModifierIds = new Set(ids);
  }

  // --- Event selection ---

  /**
   * Pick a random event that hasn't been used this run.
   * Stores it as currentEvent and returns it.
   */
  getNextEvent(): GameEvent {
    let available = EVENT_POOL.filter(e => !this._usedEventIds.includes(e.id));

    // Filter out forge events that reference locked modifiers
    if (this._unlockedModifierIds) {
      const unlocked = this._unlockedModifierIds;
      available = available.filter(e => {
        if (e.category !== 'diceForge') return true;
        // Exclude if ANY choice references a locked modifier
        return !e.choices.some(choice =>
          choice.effects.some(eff =>
            eff.type === 'diceModifier' && eff.modifierId && !unlocked.has(eff.modifierId)
          )
        );
      });
    }

    if (available.length === 0) {
      // Safety fallback — 10 events, 4 uses per run, should never happen
      this._usedEventIds = [];
      return this.getNextEvent();
    }

    const event = available[Math.floor(Math.random() * available.length)];
    this._usedEventIds.push(event.id);
    this._currentEvent = event;
    this.emit();
    return event;
  }

  // --- Choice application ---

  /**
   * Apply the player's choice. Mutates runState in place.
   * Returns the effects that were applied and whether a risk succeeded.
   */
  applyChoice(choiceIndex: number, runState: RunState): ChoiceResult {
    if (!this._currentEvent) {
      throw new Error('No current event to apply choice to');
    }

    const choice = this._currentEvent.choices[choiceIndex];
    if (!choice) {
      throw new Error(`Invalid choice index: ${choiceIndex}`);
    }

    if (choice.risk) {
      const succeeded = Math.random() < choice.risk.chance;
      const effects = succeeded ? choice.effects : choice.risk.failEffects;
      this.applyEffects(effects, runState);
      return { effects, riskSucceeded: succeeded };
    }

    this.applyEffects(choice.effects, runState);
    return { effects: choice.effects };
  }

  private applyEffects(effects: EventEffect[], runState: RunState): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'hp':
          // Clamp between 1 and maxHp (can't die from events, can't exceed max)
          runState.hp = Math.max(1, Math.min(runState.hp + effect.value, runState.maxHp));
          break;
        case 'atk':
          runState.atkBonus += effect.value;
          break;
        case 'def':
          runState.defBonus += effect.value;
          break;
        case 'diceModifier':
          if (effect.modifierId && runState.diceModifiers.length < MAX_DICE_MODIFIERS) {
            const mod = DICE_MODIFIERS[effect.modifierId];
            if (mod) {
              runState.diceModifiers.push(mod);
            }
          }
          break;
      }
    }
  }

  // --- Lifecycle ---

  /** Reset for a new run. */
  reset(): void {
    this._currentEvent = null;
    this._usedEventIds = [];
  }

  /** Clean up listeners. */
  destroy(): void {
    this.listeners.clear();
    this._currentEvent = null;
  }
}
