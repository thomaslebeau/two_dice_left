/**
 * Dice modifier definitions (GDD v5).
 * Found via Dice Forge events. Max 2 equipped per run (1 per die).
 * Each modifier is a sidegrade — tradeoffs, not pure upgrades.
 */
import type { DiceModifier } from '@/types/diceModifier.types';

export const DICE_MODIFIERS: Record<string, DiceModifier> = {
  rusty: {
    id: 'rusty',
    name: 'Rusty Die',
    faces: [1, 2, 3, 4, 5, 5],
    description: 'Min 2 damage when used as ATK',
    effect: { trigger: 'onAttack', effectType: 'minDamage', effectValue: 2 },
  },
  ivy: {
    id: 'ivy',
    name: 'Ivy Die',
    faces: [1, 2, 3, 4, 5, 6],
    description: 'On 6: poison (1 dmg/turn ×2)',
    effect: { trigger: 'onValue', triggerValue: 6, effectType: 'poison', effectValue: 1 },
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy Die',
    faces: [3, 3, 4, 4, 5, 5],
    description: "Can't exceed 5, but consistent",
  },
  broken: {
    id: 'broken',
    name: 'Broken Die',
    faces: [1, 1, 1, 6, 6, 6],
    description: 'Extreme variance — all or nothing',
  },
  needle: {
    id: 'needle',
    name: 'Needle Die',
    faces: [1, 2, 3, 4, 5, 6],
    description: 'Pierces 2 enemy DEF',
    effect: { trigger: 'onAttack', effectType: 'pierce', effectValue: 2 },
  },
  root: {
    id: 'root',
    name: 'Root Die',
    faces: [1, 2, 3, 3, 4, 5],
    description: 'If used as DEF: +1 HP',
    effect: { trigger: 'onDefend', effectType: 'heal', effectValue: 1 },
  },
};

export const MAX_DICE_MODIFIERS = 2;
