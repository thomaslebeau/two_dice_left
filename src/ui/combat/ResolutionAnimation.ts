/**
 * Resolution overlay — two labelled blocs ("YOU DEAL" / "ENEMY DEALS")
 * with raw damage, block, and net result. HP summary + end state below.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Allocation, Equipment } from '../../engine/types';
import type { CircularHpBadge } from './CircularHpBadge';
import { tickerTween, tickerWait, tickerLoop, type TickerHandle } from './tickerUtils';
import { FONTS, TEXT_COLORS } from '../../theme';
import { STRINGS } from '../../data/strings';

const CHARCOAL = 0x1A1A1A;
const SEP_COLOR = 0x333333;
const FADE_MS = 200;
const BLOC_DELAY_MS = 500;
const FADE_OUT_MS = 300;
const HP_MS = 300;
const BLOC_GAP = 12;

export interface ResolutionData {
  playerAllocations: readonly Allocation[];
  playerEquipment: readonly Equipment[];
  playerNormalDmg: number;
  enemyBlockTotal: number;
  normalDmgToEnemy: number;
  playerBypassDmg: number;
  playerPassiveBonus: number;
  minRuleApplied: boolean;
  playerDamageToEnemy: number;
  playerShieldFromEquip: number;
  playerPassiveShield: number;
  playerHealTotal: number;
  enemyAllocations: readonly Allocation[];
  enemyEquipment: readonly Equipment[];
  enemyAttackTotal: number;
  enemyDamageToPlayer: number;
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

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function mkText(
  family: string, size: number, color: number, bold = false,
): Text {
  return new Text({
    text: '',
    style: {
      fontFamily: family, fontSize: size,
      fontWeight: bold ? 'bold' : 'normal', fill: color,
    },
  });
}

function mkCentered(
  family: string, size: number, color: number, bold = false,
): Text {
  const t = mkText(family, size, color, bold);
  t.anchor.set(0.5, 0);
  return t;
}

function mkSep(w: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, w * 0.6, 1);
  g.fill({ color: SEP_COLOR });
  return g;
}

async function fadeInContainer(c: Container): Promise<void> {
  c.visible = true;
  await tickerTween(FADE_MS, (p) => { c.alpha = p; });
}

// ---------------------------------------------------------------------------
// Bloc builders — each returns a Container with stacked lines
// ---------------------------------------------------------------------------

function buildYouDealBloc(d: ResolutionData, cx: number): Container {
  const bloc = new Container();
  bloc.alpha = 0;
  bloc.visible = false;
  let y = 0;

  // Label
  const label = mkCentered(FONTS.HEADING, 16, TEXT_COLORS.MUTED);
  label.text = 'YOU DEAL';
  label.position.set(cx, y);
  bloc.addChild(label);
  y += 22;

  // Raw damage
  const raw = mkCentered(FONTS.BODY, 20, TEXT_COLORS.PLAYER_ACTION);
  raw.text = `\u{1F5E1} ${d.playerNormalDmg}`;
  raw.position.set(cx, y);
  bloc.addChild(raw);
  y += 26;

  // Enemy block (if any)
  if (d.enemyBlockTotal > 0) {
    const block = mkCentered(FONTS.BODY, 16, TEXT_COLORS.BLOCK);
    block.text = `\u{1F6E1} -${d.enemyBlockTotal}`;
    block.position.set(cx, y);
    bloc.addChild(block);
    y += 22;
  }

  // Net result (big)
  const net = mkCentered(FONTS.HEADING, 28, TEXT_COLORS.PLAYER_ACTION, true);
  let netText = `= \u{1F5E1} ${d.playerDamageToEnemy}`;
  if (d.minRuleApplied) netText += ` ${STRINGS.RES_MIN}`;
  net.text = netText;
  net.position.set(cx, y);
  bloc.addChild(net);
  y += 34;

  // Bypass
  if (d.playerBypassDmg > 0) {
    const bypass = mkCentered(FONTS.BODY, 16, TEXT_COLORS.SPEED_KILL);
    bypass.text = `+ \u{1F5E1} ${d.playerBypassDmg} bypass`;
    bypass.position.set(cx, y);
    bloc.addChild(bypass);
    y += 22;
  }

  // Poison
  if (d.enemyPoisonTick > 0) {
    const pt = mkCentered(FONTS.BODY, 16, TEXT_COLORS.POISON);
    pt.text = `+ \u2620 1`;
    pt.position.set(cx, y);
    bloc.addChild(pt);
    y += 22;
  }
  if (d.enemyNewPoison > 0) {
    const np = mkCentered(FONTS.BODY, 16, TEXT_COLORS.POISON);
    np.text = STRINGS.RES_NEW_POISON(d.enemyNewPoison);
    np.position.set(cx, y);
    bloc.addChild(np);
    y += 22;
  }

  return bloc;
}

function buildEnemyDealsBloc(d: ResolutionData, cx: number): Container {
  const bloc = new Container();
  bloc.alpha = 0;
  bloc.visible = false;
  let y = 0;

  // Label
  const label = mkCentered(FONTS.HEADING, 16, TEXT_COLORS.MUTED);
  label.text = 'ENEMY DEALS';
  label.position.set(cx, y);
  bloc.addChild(label);
  y += 22;

  // Raw enemy damage
  const raw = mkCentered(FONTS.BODY, 20, TEXT_COLORS.ENEMY_ACTION);
  raw.text = `\u{1F5E1} ${d.enemyAttackTotal}`;
  raw.position.set(cx, y);
  bloc.addChild(raw);
  y += 26;

  // Player block
  const totalBlock = d.playerShieldFromEquip + d.playerPassiveShield;
  if (totalBlock > 0) {
    const block = mkCentered(FONTS.BODY, 16, TEXT_COLORS.BLOCK);
    block.text = `\u{1F6E1} -${totalBlock}`;
    block.position.set(cx, y);
    bloc.addChild(block);
    y += 22;
  }

  // Net result (big)
  const net = mkCentered(
    FONTS.HEADING, 28, TEXT_COLORS.ENEMY_ACTION, true,
  );
  if (d.enemyDamageToPlayer === 0) {
    net.text = `= \u{1F5E1} 0 blocked!`;
    net.style.fill = TEXT_COLORS.BLOCK;
  } else {
    net.text = `= \u{1F5E1} ${d.enemyDamageToPlayer}`;
  }
  net.position.set(cx, y);
  bloc.addChild(net);
  y += 34;

  // Player poison
  if (d.playerPoisonTick > 0) {
    const pp = mkCentered(FONTS.BODY, 16, TEXT_COLORS.POISON);
    pp.text = `+ \u2620 1`;
    pp.position.set(cx, y);
    bloc.addChild(pp);
    y += 22;
  }

  // Heal
  if (d.playerHealTotal > 0) {
    const heal = mkCentered(FONTS.BODY, 16, TEXT_COLORS.PLAYER_ACTION);
    heal.text = STRINGS.RES_HEAL(d.playerHealTotal);
    heal.position.set(cx, y);
    bloc.addChild(heal);
  }

  return bloc;
}

function buildSummaryBloc(
  d: ResolutionData, cx: number, _sw: number,
): Container {
  const bloc = new Container();
  bloc.alpha = 0;
  bloc.visible = false;
  let y = 0;

  // HP summary
  const hp = mkCentered(FONTS.BODY, 16, TEXT_COLORS.NEUTRAL);
  hp.text = `${STRINGS.RES_HP('Enemy', Math.max(0, d.enemyHpAfter), d.enemyMaxHp)}    ${STRINGS.RES_HP('You', Math.max(0, d.playerHpAfter), d.playerMaxHp)}`;
  hp.position.set(cx, y);
  bloc.addChild(hp);
  y += 24;

  // Speed kill
  if (d.speedKillRecovery > 0) {
    const speed = mkCentered(FONTS.BODY, 18, TEXT_COLORS.SPEED_KILL, true);
    speed.text = STRINGS.SPEED_KILL(d.speedKillRecovery);
    speed.position.set(cx, y);
    bloc.addChild(speed);
    y += 26;
  }

  // Victory / Defeat
  if (d.combatEnded) {
    const end = mkCentered(FONTS.HEADING, 40, TEXT_COLORS.NEUTRAL, true);
    end.text = d.playerWon ? STRINGS.VICTORY : STRINGS.DEFEAT;
    end.style.fill = d.playerWon
      ? TEXT_COLORS.VICTORY : TEXT_COLORS.DEFEAT;
    end.position.set(cx, y);
    bloc.addChild(end);
    y += 48;
  }

  // TAP TO CONTINUE
  const tap = mkCentered(FONTS.HEADING, 16, TEXT_COLORS.NEUTRAL);
  tap.text = STRINGS.TAP_TO_START;
  tap.name = 'tap';
  tap.position.set(cx, y);
  bloc.addChild(tap);

  return bloc;
}

// ---------------------------------------------------------------------------
// ResolutionAnimation
// ---------------------------------------------------------------------------

export class ResolutionAnimation {
  private _stage: Container | null = null;
  private _root: Container | null = null;
  private _playerBadge: CircularHpBadge | null = null;
  private _enemyBar: Graphics | null = null;
  private _enemyBarW = 0;
  private _tapPulse: TickerHandle | null = null;
  private _screenW = 360;
  private _screenH = 640;

  setStage(stage: Container): void { this._stage = stage; }
  setScreenSize(w: number, h: number): void {
    this._screenW = w; this._screenH = h;
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

    const root = new Container();
    root.eventMode = 'static';
    this._stage.addChild(root);
    this._root = root;

    const sw = this._screenW;
    const sh = this._screenH;
    const cx = sw / 2;

    // Dim overlay
    const bg = new Graphics();
    bg.rect(0, 0, sw, sh);
    bg.fill({ color: CHARCOAL, alpha: 0.9 });
    bg.eventMode = 'static';
    root.addChild(bg);

    // Build blocs
    const youDeal = buildYouDealBloc(d, cx);
    const sep1 = mkSep(sw);
    const enemyDeals = buildEnemyDealsBloc(d, cx);
    const sep2 = mkSep(sw);
    const summary = buildSummaryBloc(d, cx, sw);

    // Hide separators initially
    sep1.alpha = 0; sep1.visible = false;
    sep2.alpha = 0; sep2.visible = false;

    // Measure heights for vertical centering
    const youH = youDeal.height;
    const enemyH = enemyDeals.height;
    const sumH = summary.height;
    const sepH = 1;
    const totalH = youH + BLOC_GAP + sepH + BLOC_GAP
      + enemyH + BLOC_GAP + sepH + BLOC_GAP + sumH;

    let y = Math.max(16, sh / 2 - totalH / 2);

    youDeal.position.set(0, y);
    root.addChild(youDeal);
    y += youH + BLOC_GAP;

    sep1.position.set(sw * 0.2, y);
    root.addChild(sep1);
    y += sepH + BLOC_GAP;

    enemyDeals.position.set(0, y);
    root.addChild(enemyDeals);
    y += enemyH + BLOC_GAP;

    sep2.position.set(sw * 0.2, y);
    root.addChild(sep2);
    y += sepH + BLOC_GAP;

    summary.position.set(0, y);
    root.addChild(summary);

    // Sequential bloc reveal
    await fadeInContainer(youDeal);
    await tickerWait(BLOC_DELAY_MS);

    sep1.visible = true;
    sep1.alpha = 1;
    await fadeInContainer(enemyDeals);
    await tickerWait(BLOC_DELAY_MS);

    sep2.visible = true;
    sep2.alpha = 1;

    // HP bar animations
    this._animateEnemyBar(
      d.enemyHpBefore, d.enemyHpAfter, d.enemyMaxHp,
    );
    this._animatePlayerBadge(
      d.playerHpBefore, d.playerHpAfter, d.playerMaxHp,
    );

    await fadeInContainer(summary);
    await tickerWait(BLOC_DELAY_MS);

    // Start TAP pulse
    const tapText = summary.getChildByName('tap') as Text | null;
    if (tapText) {
      this._tapPulse = tickerLoop((t) => {
        tapText.alpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 500));
      });
    }
  }

  async waitForDismiss(): Promise<void> {
    if (!this._root) return;
    await this._waitForTap();
    await this._fadeOut();
  }

  reset(): void { this._cleanup(); }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

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

  private async _fadeOut(): Promise<void> {
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
