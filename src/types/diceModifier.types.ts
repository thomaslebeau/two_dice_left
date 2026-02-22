/**
 * Dice modifier types for event-granted dice effects (GDD v5).
 */

export interface DiceModifierEffect {
  trigger: 'onAttack' | 'onDefend' | 'onValue';
  triggerValue?: number;
  effectType: 'minDamage' | 'pierce' | 'heal' | 'poison';
  effectValue: number;
}

export interface DiceModifier {
  id: string;
  name: string;
  faces: number[];
  description: string;
  effect?: DiceModifierEffect;
}
