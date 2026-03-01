/**
 * HUD for a single combatant — name, optional pattern label,
 * HP bar, HP text, and poison badge.
 *
 * Used for both player and enemy. Eliminates duplicated
 * HP drawing and poison badge logic in CombatScene.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { tickerWait, tickerSteps } from './tickerUtils';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;
const VENOM = 0x7B2D8B;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HP_BAR_HEIGHT = 8;

// ---------------------------------------------------------------------------
// CombatantHud
// ---------------------------------------------------------------------------

export class CombatantHud extends Container {
  private _nameText: Text;
  private _patternText: Text | null = null;
  private _hpBg = new Graphics();
  private _hpFill = new Graphics();
  private _hpText: Text;
  private _poisonBadge = new Container();
  private _poisonBg = new Graphics();
  private _poisonLabel: Text;
  private _hudHeight = 0;

  /**
   * @param nameFontSize Font size for the name label.
   * @param showPattern If true, adds a pattern label below the name.
   */
  constructor(nameFontSize: number, showPattern = false) {
    super();

    this._nameText = this._makeText('', nameFontSize, BONE, true);
    this.addChild(this._nameText);

    if (showPattern) {
      this._patternText = this._makeText('', 11, BONE);
      this.addChild(this._patternText);
    }

    this.addChild(this._hpBg);
    this.addChild(this._hpFill);

    this._hpText = this._makeText('', 10, BONE);
    this.addChild(this._hpText);

    // Poison badge
    this._poisonBadge.visible = false;
    this._poisonBadge.addChild(this._poisonBg);
    this._poisonLabel = this._makeText('', 11, BONE, true);
    this._poisonLabel.position.set(6, 3);
    this._poisonBadge.addChild(this._poisonLabel);
    this.addChild(this._poisonBadge);
  }

  /** The Graphics object for HP fill — needed by ResolutionAnimation. */
  get hpFillGraphics(): Graphics { return this._hpFill; }

  /** Total height after layout. */
  get hudHeight(): number { return this._hudHeight; }

  // -----------------------------------------------------------------------
  // Data setters
  // -----------------------------------------------------------------------

  setName(name: string): void {
    this._nameText.text = name;
  }

  setPattern(label: string, color: number): void {
    if (!this._patternText) return;
    this._patternText.text = label;
    this._patternText.style.fill = color;
  }

  // -----------------------------------------------------------------------
  // HP
  // -----------------------------------------------------------------------

  updateHp(current: number, max: number, barWidth: number): void {
    // Background
    this._hpBg.clear();
    const barY = this._barY();
    this._hpBg.roundRect(0, barY, barWidth, HP_BAR_HEIGHT, 3);
    this._hpBg.fill({ color: 0x333333 });

    // Fill
    this._hpFill.clear();
    this._hpFill.position.set(0, barY);
    const pct = Math.max(0, current / max);
    const fillW = pct * barWidth;
    if (fillW > 0) {
      this._hpFill.roundRect(0, 0, fillW, HP_BAR_HEIGHT, 3);
      this._hpFill.fill({ color: pct > 0.3 ? MOSS : BLOOD });
    }

    // Text
    this._hpText.text = `${current}/${max}`;
    this._hpText.position.set(0, barY + HP_BAR_HEIGHT + 2);

    // Reposition poison badge next to HP text
    this._poisonBadge.position.set(
      this._hpText.width + 8, barY + HP_BAR_HEIGHT + 2,
    );
  }

  // -----------------------------------------------------------------------
  // Poison
  // -----------------------------------------------------------------------

  setPoisonTurns(turns: number): void {
    if (turns <= 0) {
      this._poisonBadge.visible = false;
      return;
    }
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620 ${turns}t`;
    this._redrawPoisonBg();
  }

  /** Show "N -> M" stacking transition, then settle. */
  showPoisonStack(before: number, after: number): void {
    if (after <= 0) return;
    this._poisonBadge.visible = true;
    this._poisonLabel.text = `\u2620 ${before} \u2192 ${after}t`;
    this._redrawPoisonBg();
    void tickerWait(800).then(() => {
      if (after <= 0) { this._poisonBadge.visible = false; return; }
      this._poisonLabel.text = `\u2620 ${after}t`;
      this._redrawPoisonBg();
    });
  }

  /** Brief blink when poison ticks. */
  pulsePoisonBadge(): void {
    if (!this._poisonBadge.visible) return;
    this._poisonBadge.alpha = 1;
    void tickerSteps(6, 80, (step) => {
      this._poisonBadge.alpha = step % 2 === 0 ? 1 : 0.3;
    }).then(() => { this._poisonBadge.alpha = 1; });
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  /** Lay out children vertically. Call after setting data. */
  layout(): void {
    let y = 0;
    this._nameText.position.set(0, y);
    y += this._nameText.height + 2;

    if (this._patternText) {
      this._patternText.position.set(0, y);
      y += this._patternText.height + 2;
    }

    // HP bar starts at y (set via updateHp which uses _barY)
    // hpText is below bar
    y = this._barY() + HP_BAR_HEIGHT + 2;
    y += 12; // hpText height

    this._hudHeight = y;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /** Y position for the HP bar, below name (+ optional pattern). */
  private _barY(): number {
    let y = this._nameText.height + 2;
    if (this._patternText) y += this._patternText.height + 2;
    return y;
  }

  private _redrawPoisonBg(): void {
    this._poisonBg.clear();
    const w = this._poisonLabel.width + 12;
    this._poisonBg.roundRect(0, 0, w, 18, 4);
    this._poisonBg.fill({ color: VENOM, alpha: 0.85 });
  }

  private _makeText(
    content: string, size: number, color: number, bold = false,
  ): Text {
    return new Text({
      text: content,
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: size,
        fontWeight: bold ? 'bold' : 'normal',
        fill: color,
      },
    });
  }
}
