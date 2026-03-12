/**
 * Diegetic heal plank — a bandaged wooden plank for the heal option.
 * Same wood base as LootPlank, with cloth bandage strips and heal text.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { FONTS } from '../../theme';
import { STRINGS } from '../../data/strings';

// ---------------------------------------------------------------------------
// Dimensions (same as LootPlank)
// ---------------------------------------------------------------------------

export const HEAL_PLANK_W = 350;
export const HEAL_PLANK_H = 130;

// ---------------------------------------------------------------------------
// Diegetic palette
// ---------------------------------------------------------------------------

const WOOD_FILL = 0x3D2B1F;
const WOOD_GRAIN = 0x5C3D2E;
const WOOD_BORDER = 0x2A1A0F;

const BANDAGE_FILL = 0xD4C9A8;
const BANDAGE_STROKE = 0xB0A080;

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;

// ---------------------------------------------------------------------------
// HealPlank
// ---------------------------------------------------------------------------

export class HealPlank extends Container {
  private _bg = new Graphics();
  private _mainText: Text;
  private _mainShadow: Text;
  private _hpText: Text;
  private _hpShadow: Text;
  private _selected = false;

  /** Fired when the user taps this plank. */
  onSelect: (() => void) | null = null;

  constructor(currentHp: number, maxHp: number) {
    super();

    this.addChild(this._bg);
    this._drawWoodBase();

    // Bandages (3-4 strips across the plank)
    this._addBandages();

    // Shadow + main text: "REPARER +2 PV"
    this._mainShadow = new Text({
      text: `${STRINGS.REPAIR} +2 HP`,
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0x000000,
      },
    });
    this._mainShadow.anchor.set(0.5);
    this._mainShadow.alpha = 0.5;
    this._mainShadow.position.set(HEAL_PLANK_W / 2 + 1, HEAL_PLANK_H / 2 - 8 + 1);
    this.addChild(this._mainShadow);

    this._mainText = new Text({
      text: `${STRINGS.REPAIR} +2 HP`,
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 20,
        fontWeight: 'bold',
        fill: BONE,
      },
    });
    this._mainText.anchor.set(0.5);
    this._mainText.position.set(HEAL_PLANK_W / 2, HEAL_PLANK_H / 2 - 8);
    this.addChild(this._mainText);

    // HP context line
    this._hpShadow = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 16,
        fill: 0x000000,
      },
    });
    this._hpShadow.anchor.set(0.5);
    this._hpShadow.alpha = 0.5;
    this._hpShadow.position.set(HEAL_PLANK_W / 2 + 1, HEAL_PLANK_H / 2 + 18 + 1);
    this.addChild(this._hpShadow);

    this._hpText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 16,
        fill: BONE,
      },
    });
    this._hpText.anchor.set(0.5);
    this._hpText.position.set(HEAL_PLANK_W / 2, HEAL_PLANK_H / 2 + 18);
    this.addChild(this._hpText);

    this.updateHp(currentHp, maxHp);

    // Interaction
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.onSelect?.());
    this.on('pointerover', () => { if (!this._selected) this.alpha = 0.9; });
    this.on('pointerout', () => { this.alpha = 1; });
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._drawWoodBase();
  }

  setDimmed(dimmed: boolean): void {
    this.alpha = dimmed ? 0.6 : 1;
  }

  updateHp(hp: number, maxHp: number): void {
    const label = `(${hp}/${maxHp})`;
    this._hpText.text = label;
    this._hpShadow.text = label;
  }

  // -----------------------------------------------------------------------
  // Wood base (same as LootPlank)
  // -----------------------------------------------------------------------

  private _drawWoodBase(): void {
    const g = this._bg;
    g.clear();

    g.rect(0, 0, HEAL_PLANK_W, HEAL_PLANK_H);
    g.fill(WOOD_FILL);

    // Grain lines
    const grainYs = [18, 38, 55, 74, 92];
    for (const ly of grainYs) {
      g.moveTo(4, ly);
      g.lineTo(HEAL_PLANK_W - 4, ly);
      g.stroke({ color: WOOD_GRAIN, width: 1, alpha: 0.3 });
    }

    const borderColor = this._selected ? RUST : WOOD_BORDER;
    const borderWidth = this._selected ? 3 : 2;
    g.rect(0, 0, HEAL_PLANK_W, HEAL_PLANK_H);
    g.stroke({ color: borderColor, width: borderWidth });
  }

  // -----------------------------------------------------------------------
  // Bandages
  // -----------------------------------------------------------------------

  private _addBandages(): void {
    const strips = [
      { x: 60, y: 55, rotation: 35, len: 80 },
      { x: 180, y: 50, rotation: -40, len: 70 },
      { x: 280, y: 55, rotation: 30, len: 75 },
    ];

    for (const s of strips) {
      const bandage = new Graphics();
      bandage.rect(-6, -s.len / 2, 12, s.len);
      bandage.fill({ color: BANDAGE_FILL, alpha: 0.7 });
      bandage.rect(-6, -s.len / 2, 12, s.len);
      bandage.stroke({ color: BANDAGE_STROKE, width: 1 });

      const wrapper = new Container();
      wrapper.addChild(bandage);
      wrapper.position.set(s.x, s.y);
      wrapper.rotation = (s.rotation * Math.PI) / 180;
      this.addChild(wrapper);
    }
  }
}
