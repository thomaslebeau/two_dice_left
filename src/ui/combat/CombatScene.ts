/**
 * V6 combat scene — dice rolling, drag-drop allocation, resolution.
 *
 * Layout (360×640): enemy HUD → enemy grid → enemy dice →
 * creature placeholder → player dice → player zone → commit button.
 */

import { Container, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type { AllocationPattern, Equipment, Survivor, Enemy } from '../../engine/types';
import { rollDice } from '../../engine/dice';
import { allocateEnemy } from '../../engine/allocation';
import { DIE_SIZE } from './DiceSprite';
import { CommitButton } from './CommitButton';
import { ResolutionAnimation } from './ResolutionAnimation';
import { DiceAllocator } from './DiceAllocator';
import { EquipmentGrid } from './EquipmentGrid';
import { CombatantHud } from './CombatantHud';
import { PlayerZone } from './PlayerZone';
import { CreaturePlaceholder } from './CreaturePlaceholder';
import { EnemyDiceRow } from './EnemyDiceRow';
import { CombatState, type PoisonSnapshot } from './CombatState';
import { tickerWait, tickerLoop, type TickerHandle } from './tickerUtils';

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const PADDING = 8;
const GAP = 6;

type CombatPhase = 'rolling' | 'allocating' | 'resolving' | 'results' | 'finished';

export interface CombatSceneData {
  survivor: Survivor;
  enemy: Enemy;
  playerHp: number;
  playerMaxHp: number;
  playerEquipment: readonly Equipment[];
  onCombatEnd: (won: boolean, playerHpAfter: number) => void;
}

function patternLabel(p: AllocationPattern): string {
  return p === 'aggressive' ? 'ATK Agressif' : p === 'defensive' ? 'DEF Defensif' : 'Neutre';
}

function patternColor(p: AllocationPattern): number {
  return p === 'aggressive' ? RUST : p === 'defensive' ? MOSS : BONE;
}

export class CombatScene extends Container implements Scene {
  private _allocator = new DiceAllocator();
  private _playerZone = new PlayerZone();
  private _enemyGrid = new EquipmentGrid();
  private _enemyHud = new CombatantHud(14, false);
  private _creature = new CreaturePlaceholder();
  private _enemyDiceRow = new EnemyDiceRow();
  private _commitBtn = new CommitButton();
  private _resolution = new ResolutionAnimation();
  private _playerDiceZone = new Container();

  private _phase: CombatPhase = 'rolling';
  private _data: CombatSceneData | null = null;
  private _state: CombatState | null = null;
  private _tapPrompt: Text;
  private _tapPulseHandle: TickerHandle | null = null;
  private _sw = 360;
  private _sh = 640;

  constructor() {
    super();
    this.addChild(this._enemyHud, this._enemyGrid, this._enemyDiceRow);
    this.addChild(this._creature, this._resolution, this._playerDiceZone);
    this.addChild(this._playerZone, this._commitBtn);

    this._tapPrompt = new Text({
      text: 'TAP TO CONTINUE',
      style: {
        fontFamily: '"Courier New", monospace', fontSize: 14,
        fontWeight: 'bold', fill: BONE, letterSpacing: 2,
      },
    });
    this._tapPrompt.anchor.set(0.5);
    this._tapPrompt.visible = false;
    this.addChild(this._tapPrompt);

    this._commitBtn.onCommit = () => this._handleCommit();
    this._playerZone.grid.onSlotTap = (i) => this._allocator.handleSlotTap(i);
    this._allocator.onChange = () => this._commitBtn.setEnabled(this._allocator.isComplete());
    this._allocator.onBringToFront = (d) => this.setChildIndex(d, this.children.length - 1);

    this.eventMode = 'static';
    this.on('pointermove', (e: { global: { x: number; y: number } }) =>
      this._allocator.handlePointerMove(e.global));
    this.on('pointerup', () => this._allocator.handlePointerUp());
    this.on('pointerupoutside', () => this._allocator.handlePointerUp());
  }

  onEnter(data?: unknown): void {
    const d = data as CombatSceneData;
    this._data = d;
    this._state = new CombatState(d.playerHp, d.playerMaxHp, d.enemy.hp, d.enemy.maxHp);
    this._enemyHud.setName(d.enemy.name);
    this._creature.setEnemy(d.enemy.name, patternLabel(d.enemy.pattern), patternColor(d.enemy.pattern));
    this._buildGrids(d);
    this._updateHpDisplays();
    this._playerZone.badge.setPoisonTurns(0);
    this._enemyHud.setPoisonTurns(0);
    this._layout();
    this._startRound();
  }

  onExit(): void {
    this._allocator.reset();
    this._playerZone.clear();
    this._enemyGrid.clear();
    this._enemyDiceRow.clearDice();
    this._resolution.reset();
    this._stopTapPulse();
    this._tapPrompt.visible = false;
    this._data = null;
    this._state = null;
  }

  onResize(w: number, h: number): void { this._sw = w; this._sh = h; this._layout(); }

  private _layout(): void {
    const w = this._sw;
    const cx = w / 2;
    const avail = w - PADDING * 2;
    let y = PADDING;

    this._enemyHud.position.set(PADDING, y);
    this._enemyHud.layout();
    if (this._state) this._enemyHud.updateHp(this._state.enemyHp, this._state.enemyMaxHp, avail);
    y += this._enemyHud.hudHeight + 2;

    this._enemyGrid.position.set(PADDING, y);
    this._enemyGrid.layout(avail);
    y += this._enemyGrid.gridHeight + 4;

    this._enemyDiceRow.position.set(PADDING, y);
    this._enemyDiceRow.layout(avail);
    y += this._enemyDiceRow.rowHeight + GAP;

    const bottomH = GAP + DIE_SIZE + GAP + this._playerZone.zoneHeight + GAP + this._commitBtn.buttonHeight + GAP;
    const creatureH = Math.max(40, this._sh - y - bottomH - PADDING);
    this._creature.position.set(PADDING, y);
    this._creature.layout(avail, creatureH);
    this._resolution.layoutAt(cx, y + 10, avail);
    y += creatureH + GAP;

    this._playerDiceZone.position.set(0, y);
    this._allocator.updateLayout(this._sw, y);
    this._allocator.layoutDice();
    y += DIE_SIZE + GAP;

    this._playerZone.position.set(PADDING, y);
    this._playerZone.layout(avail);
    y += this._playerZone.zoneHeight + GAP;

    this._commitBtn.position.set(cx - this._commitBtn.buttonWidth / 2, y);
    this._tapPrompt.position.set(cx, this._creature.y + creatureH / 2);
  }

  private _updateHpDisplays(): void {
    if (!this._state) return;
    const bw = this._sw - PADDING * 2;
    this._enemyHud.updateHp(this._state.enemyHp, this._state.enemyMaxHp, bw);
    this._playerZone.updateHp(this._state.playerHp, this._state.playerMaxHp);
    this._resolution.setHpBars(this._playerZone.badge, bw, this._enemyHud.hpFillGraphics, bw);
  }

  private _buildGrids(d: CombatSceneData): void {
    this._playerZone.clear();
    this._enemyGrid.clear();
    this._playerZone.build(d.playerEquipment);
    this._enemyGrid.build(d.enemy.equipment, true);
  }

  private _startRound(): void {
    if (!this._data || !this._state) return;
    this._state.nextRound();
    this._phase = 'rolling';
    this._resolution.reset();
    this._playerZone.grid.resetAll();
    this._enemyGrid.resetAll();
    this._allocator.reset();
    this._enemyDiceRow.clearDice();

    const pv = rollDice(2);
    const ev = rollDice(2);
    const dice = this._allocator.setup(pv, [...this._playerZone.grid.slots], this._sw, this._playerDiceZone.y);
    for (const die of dice) this.addChild(die);
    this._enemyDiceRow.buildDice(ev);
    this._enemyDiceRow.visible = true;
    this._commitBtn.setEnabled(false);
    this._allocator.layoutDice();
    this._layout();

    void tickerWait(2000).then(() => { this._phase = 'allocating'; this._allocator.setEnabled(true); });
  }

  private async _handleCommit(): Promise<void> {
    if (this._phase !== 'allocating' || !this._data || !this._state) return;
    this._phase = 'resolving';
    this._commitBtn.setEnabled(false);
    this._allocator.setEnabled(false);
    this._playerZone.grid.lockAll();

    const pa = this._allocator.getAllocations();
    const ea = allocateEnemy([...this._enemyDiceRow.diceValues], this._data.enemy.equipment, this._data.enemy.pattern);
    for (const a of ea) this._enemyGrid.placeDie(a.equipmentIndex, a.dieValue);
    this._enemyDiceRow.visible = false;
    await tickerWait(500);

    const r = this._state.applyRound(pa, [...this._data.playerEquipment], ea, [...this._data.enemy.equipment]);
    this._playerZone.applyPoison(r.playerPoison);
    this._applyEnemyPoison(r.enemyPoison);
    await this._resolution.play(r.resolutionData);
    this._updateHpDisplays();
    this._phase = 'results';
    await this._waitForTap();

    if (r.resolutionData.combatEnded) {
      this._phase = 'finished';
      this._data.onCombatEnd(r.resolutionData.playerWon, this._state.playerHp);
    } else {
      this._startRound();
    }
  }

  private _applyEnemyPoison(s: PoisonSnapshot): void {
    if (s.newPoison > 0 && s.poisonAfterTick > 0) this._enemyHud.showPoisonStack(s.poisonAfterTick, s.totalAfter);
    else this._enemyHud.setPoisonTurns(s.totalAfter);
    if (s.ticked) this._enemyHud.pulsePoisonBadge();
  }

  private _waitForTap(): Promise<void> {
    return new Promise((resolve) => {
      this._tapPrompt.visible = true;
      this._tapPrompt.alpha = 1;
      this._startTapPulse();
      const handler = () => {
        if (this._phase !== 'results') return;
        this.off('pointerdown', handler);
        this._stopTapPulse();
        this._tapPrompt.visible = false;
        resolve();
      };
      this.on('pointerdown', handler);
    });
  }

  private _startTapPulse(): void {
    this._stopTapPulse();
    this._tapPulseHandle = tickerLoop((t) => { this._tapPrompt.visible = Math.floor(t / 500) % 2 === 0; });
  }

  private _stopTapPulse(): void { this._tapPulseHandle?.stop(); this._tapPulseHandle = null; }
}
