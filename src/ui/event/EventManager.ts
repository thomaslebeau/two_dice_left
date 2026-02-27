/**
 * Event logic for v6 loot/heal events between combats.
 * Pure functions — no Pixi imports, no side effects.
 *
 * Generates 2-3 loot options from ALL_LOOT excluding already-owned,
 * applies equipment choice or +2 HP heal.
 */

import type { Equipment, Survivor } from '../../engine/types';
import { ALL_LOOT } from '../../data/equipment';

// ---------------------------------------------------------------------------
// Narrative pool (French, thematic)
// ---------------------------------------------------------------------------

const NARRATIVES: readonly string[] = [
  'Tu fouilles les décombres d\u2019un atelier. Quelque chose brille sous la mousse.',
  'Un coffre rouillé, coincé sous une racine. Il cède au troisième coup.',
  'Les restes d\u2019un campement. Quelqu\u2019un est parti en vitesse.',
  'Une ancienne armurerie, presque entièrement digérée par le lierre.',
  'Un bruit métallique sous les feuilles mortes. Tu creuses.',
  'Derrière un mur effondré, une caisse encore intacte.',
];

const HEAL_AMOUNT = 2;

// ---------------------------------------------------------------------------
// Loot generation
// ---------------------------------------------------------------------------

/**
 * Pick 2-3 loot options not already in the player's loadout.
 * Combat 1-2: 2 options. Combat 3+: 3 options.
 * Shuffled randomly from the available pool.
 */
export function generateLootOptions(
  currentEquipment: readonly Equipment[],
  combatNumber: number,
): Equipment[] {
  const ownedIds = new Set(currentEquipment.map(e => e.id));
  const available = ALL_LOOT.filter(e => !ownedIds.has(e.id));

  if (available.length === 0) return [];

  // Shuffle (Fisher-Yates)
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = combatNumber <= 2 ? 2 : 3;
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Pick a random narrative text for the event screen.
 */
export function pickNarrative(): string {
  return NARRATIVES[Math.floor(Math.random() * NARRATIVES.length)];
}

// ---------------------------------------------------------------------------
// Choice application
// ---------------------------------------------------------------------------

/**
 * Apply a loot choice: add new equipment to the survivor's loadout.
 * Equipment choice is permanent — no swap/sell.
 * Returns a new Survivor with the updated equipment array.
 */
export function applyLootChoice(
  survivor: Survivor,
  choice: Equipment,
): Survivor {
  return {
    ...survivor,
    equipment: [...survivor.equipment, choice],
  };
}

/**
 * Apply heal choice: +2 HP capped at maxHp.
 * Returns the new HP value.
 */
export function applyHealChoice(
  currentHp: number,
  maxHp: number,
): number {
  return Math.min(maxHp, currentHp + HEAL_AMOUNT);
}

/** The fixed heal amount for display. */
export { HEAL_AMOUNT };
