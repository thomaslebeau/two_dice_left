/**
 * Player zone — horizontal layout: CircularHpBadge (left) + EquipmentGrid (right).
 * Encapsulates player-side display in the combat screen.
 */

import { Container } from 'pixi.js';
import { CircularHpBadge, BADGE_DIAMETER } from './CircularHpBadge';
import { EquipmentGrid } from './EquipmentGrid';
import type { Equipment } from '../../engine/types';
import type { PoisonSnapshot } from './CombatState';

const BADGE_GRID_GAP = 8;

export class PlayerZone extends Container {
  private _badge = new CircularHpBadge();
  private _grid = new EquipmentGrid();
  private _zoneHeight = BADGE_DIAMETER;

  constructor() {
    super();
    this.addChild(this._badge);
    this.addChild(this._grid);
  }

  get badge(): CircularHpBadge { return this._badge; }
  get grid(): EquipmentGrid { return this._grid; }
  get zoneHeight(): number { return this._zoneHeight; }

  /** Build equipment slots. */
  build(equipment: readonly Equipment[]): void {
    this._grid.build(equipment);
  }

  /** Position badge and grid side by side. */
  layout(availWidth: number): void {
    this._badge.position.set(0, 0);
    const gridX = BADGE_DIAMETER + BADGE_GRID_GAP;
    this._grid.position.set(gridX, 0);
    this._grid.layout(availWidth - gridX);
    this._zoneHeight = Math.max(BADGE_DIAMETER, this._grid.gridHeight);
  }

  updateHp(current: number, max: number): void {
    this._badge.updateHp(current, max);
  }

  applyPoison(snap: PoisonSnapshot): void {
    if (snap.newPoison > 0 && snap.poisonAfterTick > 0) {
      this._badge.showPoisonStack(snap.poisonAfterTick, snap.totalAfter);
    } else {
      this._badge.setPoisonTurns(snap.totalAfter);
    }
    if (snap.ticked) this._badge.pulsePoisonBadge();
  }

  clear(): void {
    this._grid.clear();
  }
}
