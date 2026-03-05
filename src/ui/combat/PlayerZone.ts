/**
 * Player zone — diegetic layout: SurvivorPortrait (left) + ToolBox (right).
 * Replaces flat CircularHpBadge + EquipmentGrid layout.
 */

import { Container } from 'pixi.js';
import { SurvivorPortrait } from './SurvivorPortrait';
import { ToolBox } from './ToolBox';
import type { CircularHpBadge } from './CircularHpBadge';
import type { Equipment } from '../../engine/types';
import type { PoisonSnapshot } from './CombatState';

const PORTRAIT_RATIO = 0.25;

export class PlayerZone extends Container {
  private _portrait = new SurvivorPortrait();
  private _toolBox = new ToolBox();

  constructor() {
    super();
    this.addChild(this._portrait);
    this.addChild(this._toolBox);
  }

  get badge(): CircularHpBadge { return this._portrait.badge; }
  get toolBox(): ToolBox { return this._toolBox; }

  /** Build equipment compartments + set survivor name. */
  build(equipment: readonly Equipment[], survivorName?: string): void {
    this._toolBox.build(equipment);
    if (survivorName) this._portrait.setName(survivorName);
  }

  /** Position portrait and toolbox side by side. */
  layout(availWidth: number, availHeight?: number): void {
    const h = availHeight ?? 220;
    const portraitW = Math.floor(availWidth * PORTRAIT_RATIO);
    const boxW = availWidth - portraitW;

    this._portrait.position.set(0, 0);
    this._portrait.layout(h);

    this._toolBox.position.set(portraitW, 0);
    this._toolBox.layout(boxW, h);
  }

  updateHp(current: number, max: number): void {
    this._portrait.badge.updateHp(current, max);
  }

  applyPoison(snap: PoisonSnapshot): void {
    if (snap.newPoison > 0 && snap.poisonAfterTick > 0) {
      this._portrait.badge.showPoisonStack(
        snap.poisonAfterTick, snap.totalAfter,
      );
    } else {
      this._portrait.badge.setPoisonTurns(snap.totalAfter);
    }
    if (snap.ticked) this._portrait.badge.pulsePoisonBadge();
  }

  clear(): void {
    this._toolBox.clear();
  }
}
