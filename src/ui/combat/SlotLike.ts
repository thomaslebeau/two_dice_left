/**
 * Shared interface for equipment slot visuals.
 * Implemented by EquipmentSlotIcon (enemy) and ToolBoxCompartment (player).
 * Used by DiceAllocator and PassiveFeedback.
 */

import type { Equipment } from '../../engine/types';

export type SlotState = 'empty' | 'valid-target' | 'dimmed' | 'filled' | 'locked';

export interface SlotLike {
  readonly equipment: Equipment;
  readonly equipmentIndex: number;
  readonly slotState: SlotState;
  readonly placedDieValue: number | null;
  isCompatible(dieValue: number): boolean;
  setState(state: SlotState): void;
  placeDie(dieValue: number): void;
  removeDie(): void;
  lock(): void;
  showPreview(dieValue: number): void;
  clearPreview(): void;
  showPassiveBonus(value: number, color: number): void;
  clearPassiveBonus(): void;
  showBorderGlow(color: number): void;
  clearBorderGlow(): void;
  getBounds(): { x: number; y: number; width: number; height: number };
}
