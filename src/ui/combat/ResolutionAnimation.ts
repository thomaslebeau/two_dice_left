/**
 * Resolution overlay — adds a full-screen dimmed container directly
 * to the stage so it covers everything (enemy zone, toolbox, buttons).
 * Sequential line reveals for damage calcs, HP changes, combat end.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Allocation, Equipment } from '../../engine/types';
import type { CircularHpBadge } from './CircularHpBadge';
import { tickerTween, tickerWait, tickerLoop, type TickerHandle } from './tickerUtils';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS } from '../../data/strings';

const CHARCOAL = 0x1A1A1A;
const LINE_GAP = 20;
const FADE_MS = 200;
const LINE_DELAY_MS = 300;
const FADE_OUT_MS = 300;
const HP_MS = 300;

export interface ResolutionData {
  playerAllocations: readonly Allocation[];
  playerEquipment: readonly Equipment[];
  playerAttackTotal: number;
  playerDamageToEnemy: number;
  playerShieldTotal: number;
  playerHealTotal: number;
  enemyAllocations: readonly Allocation[];
  enemyEquipment: readonly Equipment[];
  enemyAttackTotal: number;
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

async function fadeIn(t: Text): Promise<void> {
  t.visible = true;
  await tickerTween(FADE_MS, (p) => { t.alpha = p; });
}

/**
 * Resolution animation. Not added to the scene tree itself —
 * instead it creates a standalone Container added directly to the
 * stage so it sits above every scene element.
 */
export class ResolutionAnimation {
  private _stage: Container | null = null;
  private _root: Container | null = null;
  private _playerBadge: CircularHpBadge | null = null;
  private _enemyBar: Graphics | null = null;
  private _enemyBarW = 0;
  private _tapPulse: TickerHandle | null = null;
  private _screenW = 360;
  private _screenH = 640;

  /** Must be called once with the Pixi stage reference. */
  setStage(stage: Container): void {
    this._stage = stage;
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
    if (!this._stage) return;
    this._cleanup();

    // Root container added directly to stage — last child = on top
    const root = new Container();
    root.eventMode = 'static';
    this._stage.addChild(root);
    this._root = root;

    // Full-screen dim overlay
    const bg = new Graphics();
    bg.rect(0, 0, this._screenW, this._screenH);
    bg.fill({ color: CHARCOAL, alpha: 0.9 });
    bg.eventMode = 'static';
    root.addChild(bg);

    // Build text lines
    const lines = this._buildLines(d);

    // Center lines vertically
    let totalH = 0;
    for (let i = 0; i < lines.length; i++) {
      totalH += lines[i].height;
      if (i < lines.length - 1) totalH += LINE_GAP;
    }
    const cx = this._screenW / 2;
    let y = Math.max(20, this._screenH / 2 - totalH / 2);
    for (const l of lines) {
      l.position.set(cx, y);
      y += l.height + LINE_GAP;
      root.addChild(l);
    }

    // Sequential reveal
    await fadeIn(lines[0]);
    await tickerWait(LINE_DELAY_MS);
    await fadeIn(lines[1]);
    await tickerWait(LINE_DELAY_MS);

    // Animate HP bars alongside line 3
    this._animateEnemyBar(d.enemyHpBefore, d.enemyHpAfter, d.enemyMaxHp);
    this._animatePlayerBadge(
      d.playerHpBefore, d.playerHpAfter, d.playerMaxHp,
    );
    await fadeIn(lines[2]);
    await tickerWait(LINE_DELAY_MS);

    // Optional lines (speed kill, victory/defeat) — everything except last
    for (let i = 3; i < lines.length - 1; i++) {
      await fadeIn(lines[i]);
      await tickerWait(LINE_DELAY_MS);
    }

    // TAP TO CONTINUE — last line, with pulse
    const tap = lines[lines.length - 1];
    await fadeIn(tap);
    this._tapPulse = tickerLoop((t) => {
      tap.alpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 500));
    });
  }

  /** Show pulsing TAP TO CONTINUE and wait for tap to dismiss. */
  async waitForDismiss(): Promise<void> {
    if (!this._root) return;
    await this._waitForTap();
    await this._fadeOutAndDestroy();
  }

  reset(): void {
    this._cleanup();
  }

  private _buildLines(d: ResolutionData): Text[] {
    const pAtk = d.playerAttackTotal;
    const eShd = d.enemyShieldTotal;
    const eAtk = d.enemyAttackTotal;
    const pShd = d.playerShieldTotal;

    // Line 1: player damage calc
    const calc1 = mkLine(FONTS.BODY, 18, TEXT_COLORS.PLAYER_ACTION);
    calc1.text = STRINGS.RES_YOU(pAtk, eShd, d.playerDamageToEnemy);

    // Line 2: enemy damage calc
    const calc2 = mkLine(FONTS.BODY, 18, TEXT_COLORS.ENEMY_ACTION);
    calc2.text = STRINGS.RES_ENEMY(eAtk, pShd, d.enemyDamageToPlayer);

    // Line 3: HP result summary
    const result = mkLine(FONTS.HEADING, 28, TEXT_COLORS.NEUTRAL, true);
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
    if (d.enemyPoisonTick > 0 || d.enemyNewPoison > 0
      || d.playerPoisonTick > 0) {
      result.style.fill = TEXT_COLORS.POISON;
    }

    const lines: Text[] = [calc1, calc2, result];

    // Line 4: speed kill (optional)
    if (d.speedKillRecovery > 0) {
      const speed = mkLine(FONTS.BODY, 18, TEXT_COLORS.SPEED_KILL, true);
      speed.text = STRINGS.SPEED_KILL(d.speedKillRecovery);
      lines.push(speed);
    }

    // Line 5: victory/defeat (optional)
    if (d.combatEnded) {
      const end = mkLine(FONTS.HEADING, 40, TEXT_COLORS.NEUTRAL, true);
      end.text = d.playerWon ? STRINGS.VICTORY : STRINGS.DEFEAT;
      end.style.fill = d.playerWon
        ? TEXT_COLORS.VICTORY : TEXT_COLORS.DEFEAT;
      lines.push(end);
    }

    // Last line: tap to continue
    const tap = mkLine(FONTS.HEADING, 16, TEXT_COLORS.NEUTRAL);
    tap.text = STRINGS.TAP_TO_START;
    lines.push(tap);

    return lines;
  }

  private _waitForTap(): Promise<void> {
    return new Promise((resolve) => {
      const root = this._root;
      if (!root) { resolve(); return; }
      const handler = (): void => {
        root.off('pointerdown', handler);
        resolve();
      };
      root.on('pointerdown', handler);
    });
  }

  private async _fadeOutAndDestroy(): Promise<void> {
    const root = this._root;
    if (!root) return;
    this._tapPulse?.stop();
    this._tapPulse = null;
    await tickerTween(FADE_OUT_MS, (t) => { root.alpha = 1 - t; });
    this._destroyRoot();
  }

  private _cleanup(): void {
    this._tapPulse?.stop();
    this._tapPulse = null;
    this._destroyRoot();
  }

  private _destroyRoot(): void {
    if (!this._root) return;
    this._stage?.removeChild(this._root);
    this._root.destroy({ children: true });
    this._root = null;
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
}
