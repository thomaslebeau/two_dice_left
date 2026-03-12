/**
 * Resolution animation — damage calculations, HP animations,
 * combat end overlay. Supports circular badge (player) + rect bar (enemy).
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Allocation, Equipment } from '../../engine/types';
import { sumAllocEffects } from '../../engine/combat';
import type { CircularHpBadge } from './CircularHpBadge';
import { tickerWait, tickerTween } from './tickerUtils';
import { FONTS } from '../../theme';

const BONE = 0xD9CFBA;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;
const CHARCOAL = 0x1A1A1A;
const POISON = 0x7B2D8B;
const REVEAL_MS = 500;
const CALC_MS = 500;
const HP_MS = 300;
const END_MS = 800;

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

function mkText(size: number, color: number, bold = false): Text {
  const t = new Text({
    text: '',
    style: {
      fontFamily: FONTS.BODY, fontSize: size,
      fontWeight: bold ? 'bold' : 'normal', fill: color,
    },
  });
  t.anchor.set(0.5, 0);
  return t;
}

export class ResolutionAnimation extends Container {
  private _overlay = new Graphics();
  private _calc1 = mkText(18, BONE);
  private _calc2 = mkText(18, BONE);
  private _result = mkText(24, BONE, true);
  private _speed = mkText(18, MOSS, true);
  private _end: Text;
  private _playerBadge: CircularHpBadge | null = null;
  private _enemyBar: Graphics | null = null;
  private _enemyBarW = 0;

  constructor() {
    super();
    this._overlay.visible = false;
    this.addChild(this._overlay);
    this._end = new Text({
      text: '', style: {
        fontFamily: FONTS.HEADING, fontSize: 36,
        fontWeight: 'bold', fill: BONE, letterSpacing: 6,
      },
    });
    this._end.anchor.set(0.5);
    this.addChild(this._calc1, this._calc2, this._result, this._speed, this._end);
  }

  setHpBars(badge: CircularHpBadge, _pw: number, bar: Graphics, ew: number): void {
    this._playerBadge = badge;
    this._enemyBar = bar;
    this._enemyBarW = ew;
  }

  layoutAt(cx: number, top: number, w: number): void {
    const g = 28;
    this._calc1.position.set(cx, top);
    this._calc2.position.set(cx, top + g);
    this._result.position.set(cx, top + g * 2 + 10);
    this._speed.position.set(cx, top + g * 3 + 10);
    this._end.position.set(cx, top + g * 4 + 10);
    this._overlay.clear();
    this._overlay.rect(cx - w / 2, top - 10, w, g * 5 + 40);
    this._overlay.fill({ color: CHARCOAL, alpha: 0.85 });
  }

  async play(d: ResolutionData): Promise<void> {
    this.visible = true;
    this._overlay.visible = true;
    this._clearTexts();
    await tickerWait(REVEAL_MS);

    const pAtk = sumAllocEffects(d.playerAllocations, d.playerEquipment, 'damage');
    const eShd = sumAllocEffects(d.enemyAllocations, d.enemyEquipment, 'shield');
    const eAtk = sumAllocEffects(d.enemyAllocations, d.enemyEquipment, 'damage');
    const pShd = sumAllocEffects(d.playerAllocations, d.playerEquipment, 'shield');

    this._calc1.text = `Vous : ${pAtk} dégâts - ${eShd} blocage = ${d.playerDamageToEnemy} dégâts`;
    this._calc1.style.fill = d.playerDamageToEnemy > 0 ? MOSS : BONE;
    this._calc2.text = `Ennemi : ${eAtk} dégâts - ${pShd} blocage = ${d.enemyDamageToPlayer} dégâts`;
    this._calc2.style.fill = d.enemyDamageToPlayer > 0 ? BLOOD : BONE;
    await tickerWait(CALC_MS);

    this._animateEnemyBar(d.enemyHpBefore, d.enemyHpAfter, d.enemyMaxHp);
    this._animatePlayerBadge(d.playerHpBefore, d.playerHpAfter, d.playerMaxHp);

    const parts: string[] = [];
    if (d.playerDamageToEnemy > 0) parts.push(`Ennemi -${d.playerDamageToEnemy} PV`);
    if (d.enemyDamageToPlayer > 0) parts.push(`Vous -${d.enemyDamageToPlayer} PV`);
    if (d.enemyPoisonTick > 0) parts.push(`\u2620 -1 poison`);
    if (d.playerPoisonTick > 0) parts.push(`\u2620 Vous -1 poison`);
    if (d.enemyNewPoison > 0) parts.push(`\u2620 +${d.enemyNewPoison} poison`);
    if (d.playerHealTotal > 0) parts.push(`Vous +${d.playerHealTotal} soin`);
    this._result.text = parts.join('  |  ') || 'Aucun dégât';
    if (d.enemyPoisonTick > 0 || d.enemyNewPoison > 0 || d.playerPoisonTick > 0) {
      this._result.style.fill = POISON;
    }
    await tickerWait(HP_MS);

    if (d.speedKillRecovery > 0) this._speed.text = `Victoire rapide! +${d.speedKillRecovery} PV`;
    if (d.combatEnded) {
      this._end.text = d.playerWon ? 'VICTOIRE' : 'DÉFAITE';
      this._end.style.fill = d.playerWon ? MOSS : BLOOD;
      await tickerWait(END_MS);
    }
  }

  reset(): void {
    this.visible = false;
    this._overlay.visible = false;
    this._clearTexts();
  }

  private _animateEnemyBar(before: number, after: number, max: number): void {
    const bar = this._enemyBar;
    if (!bar) return;
    const mw = this._enemyBarW;
    const sw = Math.max(0, before / max) * mw;
    const ew = Math.max(0, after / max) * mw;
    const ep = Math.max(0, after / max);
    void tickerTween(HP_MS, (t) => {
      const w = sw + (ew - sw) * t;
      bar.clear();
      if (w > 0) { bar.rect(0, 0, w, 10); bar.fill({ color: ep > 0.3 ? MOSS : BLOOD }); }
    });
  }

  private _animatePlayerBadge(before: number, after: number, max: number): void {
    if (!this._playerBadge) return;
    const b = this._playerBadge;
    void tickerTween(HP_MS, (t) => b.updateHp(Math.round(before + (after - before) * t), max));
  }

  private _clearTexts(): void {
    this._calc1.text = '';
    this._calc2.text = '';
    this._result.text = '';
    this._speed.text = '';
    this._end.text = '';
  }
}
