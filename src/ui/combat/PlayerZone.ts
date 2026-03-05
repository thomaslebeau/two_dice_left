/**
 * Player zone — diegetic layout: SurvivorPortrait (left) + ToolBox (right).
 * Replaces flat CircularHpBadge + EquipmentGrid layout.
 */

import { Container } from 'pixi.js';
import { SurvivorPortrait } from './SurvivorPortrait';
import { ToolBox } from './ToolBox';
import { CircularHpBadge } from './CircularHpBadge';
import type { Equipment } from '../../engine/types';
import type { PoisonSnapshot } from './CombatState';

const PORTRAIT_RATIO = 0.25;

export class PlayerZone extends Container {
  private _portrait = new SurvivorPortrait();
  private _toolBox = new ToolBox();
  private _badge = new CircularHpBadge();

  constructor() {
    super();
    this.sortableChildren = true;
    this.addChild(this._toolBox);
    this.addChild(this._portrait);
    this._badge.zIndex = 10;
    this.addChild(this._badge);
  }

  get badge(): CircularHpBadge { return this._badge; }
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

    // Badge overlapping top-right of portrait frame
    const badgeScale = 0.7;
    this._badge.scale.set(badgeScale);
    this._badge.position.set(50, 0);
  }

  updateHp(current: number, max: number): void {
    this._badge.updateHp(current, max);
  }

  applyPoison(snap: PoisonSnapshot): void {
    if (snap.newPoison > 0 && snap.poisonAfterTick > 0) {
      this._badge.showPoisonStack(
        snap.poisonAfterTick, snap.totalAfter,
      );
    } else {
      this._badge.setPoisonTurns(snap.totalAfter);
    }
    if (snap.ticked) this._badge.pulsePoisonBadge();
  }

  clear(): void {
    this._toolBox.clear();
  }
}
