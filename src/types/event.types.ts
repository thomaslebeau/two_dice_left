/**
 * Event system types for between-combat events (GDD v5).
 *
 * Categories: workshop, diceForge, encounter, salvage.
 * Each event presents 2–3 choices with stat/dice/risk effects.
 */

export type EventCategory = 'workshop' | 'diceForge' | 'encounter' | 'salvage';

export interface EventEffect {
  type: 'hp' | 'atk' | 'def' | 'diceModifier';
  value: number;
  modifierId?: string; // required when type === 'diceModifier'
}

export interface EventChoice {
  label: string;
  description: string;
  effects: EventEffect[];
  risk?: {
    chance: number;           // 0–1, probability of success
    failEffects: EventEffect[]; // applied instead of effects on failure
  };
}

export interface GameEvent {
  id: string;
  category: EventCategory;
  flavorText: string;
  choices: EventChoice[];
}
