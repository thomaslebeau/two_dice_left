/**
 * Player zone — vertical stack: portrait (centered) → name → toolbox (full width).
 */

import { Container, Text } from 'pixi.js';
import { SurvivorPortrait } from './SurvivorPortrait';
import { ToolBox } from './ToolBox';
import { CircularHpBadge } from './CircularHpBadge';
import type { Equipment } from '../../engine/types';
import type { PoisonSnapshot } from './CombatState';
import { FONTS } from '../../theme';

const BONE = 0xD9CFBA;
const NAME_GAP = 2;
const BOX_GAP = 4;

export class PlayerZone extends Container {
  private _portrait = new SurvivorPortrait();
  private _nameText: Text;
  private _toolBox = new ToolBox();
  private _badge = new CircularHpBadge();

  constructor() {
    super();
    this.sortableChildren = true;

    this.addChild(this._portrait);

    this._nameText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.HEADING, fontSize: 16,
        fontWeight: 'bold', fill: BONE, letterSpacing: 1,
      },
    });
    this._nameText.anchor.set(0.5, 0);
    this.addChild(this._nameText);

    this.addChild(this._toolBox);

    this._badge.zIndex = 10;
    this._badge.scale.set(0.65);
    this.addChild(this._badge);
  }

  get badge(): CircularHpBadge { return this._badge; }
  get toolBox(): ToolBox { return this._toolBox; }

  build(equipment: readonly Equipment[], survivorName?: string): void {
    this._toolBox.build(equipment);
    if (survivorName) {
      this._portrait.setName(survivorName);
      this._nameText.text = survivorName;
    }
  }

  layout(availWidth: number, availHeight?: number): void {
    const h = availHeight ?? 220;
    const cx = availWidth / 2;
    const d = this._portrait.diameter;

    // Portrait centered
    this._portrait.position.set(cx, d / 2);
    this._portrait.layout();

    // Badge overlapping portrait top-right
    this._badge.position.set(cx + d / 2 - 8, 0);

    // Name below portrait
    const nameY = d + NAME_GAP;
    this._nameText.position.set(cx, nameY);
    const nameH = 18;

    // Toolbox full width, below name
    const boxY = nameY + nameH + BOX_GAP;
    const boxH = Math.max(60, h - boxY);
    this._toolBox.position.set(0, boxY);
    this._toolBox.layout(availWidth, boxH);
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

  clear(): void { this._toolBox.clear(); }
}
