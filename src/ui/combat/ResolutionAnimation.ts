/**
 * Resolution overlay — full-screen dimmed overlay with sequential
 * line reveals for damage calculations, HP changes, and combat end.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Allocation, Equipment } from '../../engine/types';
import { sumAllocEffects } from '../../engine/combat';
import type { CircularHpBadge } from './CircularHpBadge';
import { tickerWait, tickerTween, tickerLoop, type TickerHandle } from './tickerUtils';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS } from '../../data/strings';

const CHARCOAL = 0x1A1A1A;
const LINE_GAP = 16;
const FADE_MS = 200;
const LINE_DELAY_MS = 300;
const HP_MS = 300;

export interface ResolutionData {
  playerAllocations: readonly Allocation[];
  playerEquipment: readonly Equipment[];
  playerDamageToEnemy: number;
  playerShieldTotal: number;
  playerHealTotal: number;
  enemyAllocations: readonly Allocation[];
  enemyEquipment: readonly Equipment[];
  enemyDamageToPlayer: number;
  enemyShieldTotal: number;
  playerHpBefore: number;
  playerHpAfter: number;
  playerMaxHp: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  enemyMaxHp: number;
  enemyPoisonTick: number;
  enemyNewPoison: number;
  playerPoisonTick: number;
  combatEnded: boolean;
  playerWon: boolean;
  speedKillRecovery: number;
}

function mkLine(
  family: string, size: number, color: number, bold = false,
): Text {
  const t = new Text({
    text: '',
    style: {
      fontFamily: family, fontSize: size,
      fontWeight: bold ? 'bold' : 'normal', fill: color,
    },
  });
  t.anchor.set(0.5, 0);
  t.alpha = 0;
  t.visible = false;
  return t;
}

/** Fade a text element from alpha 0 to 1 over FADE_MS. */
async function fadeIn(t: Text): Promise<void> {
  t.visible = true;
  await tickerTween(FADE_MS, (p) => { t.alpha = p; });
}

export class ResolutionAnimation extends Container {
  private _overlay = new Graphics();
  private _lines: Text[] = [];
  private _playerBadge: CircularHpBadge | null = null;
  private _enemyBar: Graphics | null = null;
  private _enemyBarW = 0;
  private _tapPulse: TickerHandle | null = null;
  private _tapText: Text | null = null;
  private _screenW = 360;
  private _screenH = 640;

  constructor() {
    super();
    this._overlay.visible = false;
    this._overlay.eventMode = 'static';
    this.addChild(this._overlay);
  }

  setScreenSize(w: number, h: number): void {
    this._screenW = w;
    this._screenH = h;
  }

  setHpBars(
    badge: CircularHpBadge, _pw: number, bar: Graphics, ew: number,
  ): void {
    this._playerBadge = badge;
    this._enemyBar = bar;
    this._enemyBarW = ew;
  }

  async play(d: ResolutionData): Promise<void> {
    this.visible = true;
    this._clearLines();
    this._drawOverlay();

    // Build lines
    const pAtk = sumAllocEffects(
      d.playerAllocations, d.playerEquipment, 'damage',
    );
    const eShd = sumAllocEffects(
      d.enemyAllocations, d.enemyEquipment, 'shield',
    );
    const eAtk = sumAllocEffects(
      d.enemyAllocations, d.enemyEquipment, 'damage',
    );
    const pShd = sumAllocEffects(
      d.playerAllocations, d.playerEquipment, 'shield',
    );

    // Line 1: player damage calc
    const calc1 = mkLine(FONTS.BODY, 16, TEXT_COLORS.PLAYER_ACTION);
    calc1.text = STRINGS.RES_YOU(pAtk, eShd, d.playerDamageToEnemy);

    // Line 2: enemy damage calc
    const calc2 = mkLine(FONTS.BODY, 16, TEXT_COLORS.ENEMY_ACTION);
    calc2.text = STRINGS.RES_ENEMY(eAtk, pShd, d.enemyDamageToPlayer);

    // Line 3: HP result summary
    const result = mkLine(FONTS.HEADING, 22, TEXT_COLORS.NEUTRAL, true);
    const parts: string[] = [];
    if (d.playerDamageToEnemy > 0) {
      parts.push(STRINGS.RES_ENEMY_HP(d.playerDamageToEnemy));
    }
    if (d.enemyDamageToPlayer > 0) {
      parts.push(STRINGS.RES_PLAYER_HP(d.enemyDamageToPlayer));
    }
    if (d.enemyPoisonTick > 0) parts.push(STRINGS.RES_POISON_TICK);
    if (d.playerPoisonTick > 0) parts.push(STRINGS.RES_PLAYER_POISON_TICK);
    if (d.enemyNewPoison > 0) {
      parts.push(STRINGS.RES_NEW_POISON(d.enemyNewPoison));
    }
    if (d.playerHealTotal > 0) {
      parts.push(STRINGS.RES_HEAL(d.playerHealTotal));
    }
    result.text = parts.join('  |  ') || STRINGS.NO_DAMAGE;
    // Color the result line based on content
    if (d.enemyPoisonTick > 0 || d.enemyNewPoison > 0 || d.playerPoisonTick > 0) {
      result.style.fill = TEXT_COLORS.POISON;
    }

    const lines: Text[] = [calc1, calc2, result];

    // Line 4: speed kill (optional)
    if (d.speedKillRecovery > 0) {
      const speed = mkLine(FONTS.BODY, 16, TEXT_COLORS.SPEED_KILL, true);
      speed.text = STRINGS.SPEED_KILL(d.speedKillRecovery);
      lines.push(speed);
    }

    // Line 5: victory/defeat (optional)
    if (d.combatEnded) {
      const end = mkLine(FONTS.HEADING, 36, TEXT_COLORS.NEUTRAL, true);
      end.text = d.playerWon ? STRINGS.VICTORY : STRINGS.DEFEAT;
      end.style.fill = d.playerWon
        ? TEXT_COLORS.VICTORY : TEXT_COLORS.DEFEAT;
      lines.push(end);
    }

    // Line 6: tap to continue
    const tap = mkLine(FONTS.HEADING, 14, TEXT_COLORS.NEUTRAL);
    tap.text = STRINGS.TAP_TO_START;
    lines.push(tap);

    // Position lines centered vertically
    this._lines = lines;
    this._layoutLines();
    for (const l of lines) this.addChild(l);

    // Sequential reveal
    await fadeIn(calc1);
    await tickerWait(LINE_DELAY_MS);
    await fadeIn(calc2);
    await tickerWait(LINE_DELAY_MS);

    // Animate HP bars alongside line 3
    this._animateEnemyBar(d.enemyHpBefore, d.enemyHpAfter, d.enemyMaxHp);
    this._animatePlayerBadge(
      d.playerHpBefore, d.playerHpAfter, d.playerMaxHp,
    );
    await fadeIn(result);
    await tickerWait(LINE_DELAY_MS);

    // Optional lines (speed kill, end)
    for (let i = 3; i < lines.length - 1; i++) {
      await fadeIn(lines[i]);
      await tickerWait(LINE_DELAY_MS);
    }

    // Tap prompt — shown but not awaited yet.
    // Call waitForDismiss() to pulse and wait for tap.
    this._tapText = tap;
  }

  /** Show pulsing TAP TO CONTINUE and wait for tap to dismiss. */
  async waitForDismiss(): Promise<void> {
    if (!this._tapText) return;
    await fadeIn(this._tapText);
    const tap = this._tapText;
    this._tapPulse = tickerLoop((t) => {
      tap.alpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 500));
    });
    await this._waitForTap();
  }

  reset(): void {
    this.visible = false;
    this._overlay.visible = false;
    this._tapPulse?.stop();
    this._tapPulse = null;
    this._tapText = null;
    this._clearLines();
  }

  private _drawOverlay(): void {
    this._overlay.clear();
    this._overlay.rect(0, 0, this._screenW, this._screenH);
    this._overlay.fill({ color: CHARCOAL, alpha: 0.85 });
    this._overlay.visible = true;
    // Position overlay at scene origin regardless of this container's pos
    this._overlay.position.set(-this.x, -this.y);
  }

  private _layoutLines(): void {
    const cx = this._screenW / 2 - this.x;
    // Measure total height
    let totalH = 0;
    for (let i = 0; i < this._lines.length; i++) {
      totalH += this._lines[i].height;
      if (i < this._lines.length - 1) totalH += LINE_GAP;
    }
    let y = (this._screenH - this.y) / 2 - totalH / 2;
    // Clamp so lines don't go above padding
    if (y + this.y < 20) y = 20 - this.y;
    for (const l of this._lines) {
      l.position.set(cx, y);
      y += l.height + LINE_GAP;
    }
  }

  private _waitForTap(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (): void => {
        this._overlay.off('pointerdown', handler);
        resolve();
      };
      this._overlay.on('pointerdown', handler);
    });
  }

  private _animateEnemyBar(
    before: number, after: number, max: number,
  ): void {
    const bar = this._enemyBar;
    if (!bar) return;
    const mw = this._enemyBarW;
    const sw = Math.max(0, before / max) * mw;
    const ew = Math.max(0, after / max) * mw;
    const ep = Math.max(0, after / max);
    const MOSS = 0x2D4A2E, BLOOD = 0x6B1C1C;
    void tickerTween(HP_MS, (t) => {
      const w = sw + (ew - sw) * t;
      bar.clear();
      if (w > 0) {
        bar.rect(0, 0, w, 10);
        bar.fill({ color: ep > 0.3 ? MOSS : BLOOD });
      }
    });
  }

  private _animatePlayerBadge(
    before: number, after: number, max: number,
  ): void {
    if (!this._playerBadge) return;
    const b = this._playerBadge;
    void tickerTween(HP_MS, (t) => {
      b.updateHp(Math.round(before + (after - before) * t), max);
    });
  }

  private _clearLines(): void {
    for (const l of this._lines) {
      this.removeChild(l);
      l.destroy();
    }
    this._lines = [];
  }
}
