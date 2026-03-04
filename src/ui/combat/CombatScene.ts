/**
 * V6 combat scene — dice rolling, drag-drop allocation, resolution.
 * Layout (360x640, bottom-up): enemy zone → creature → dice → player zone → buttons.
 */

import { Container, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type { AllocationPattern, Equipment, Survivor, Enemy, PassiveId, PassiveState } from '../../engine/types';
import { rollDice } from '../../engine/dice';
import { allocateEnemy } from '../../engine/allocation';
import { DIE_SIZE } from './DiceSprite';
import { CommitButton } from './CommitButton';
import { ResetButton } from './ResetButton';
import { ResolutionAnimation } from './ResolutionAnimation';
import { DiceAllocator } from './DiceAllocator';
import { PlayerZone } from './PlayerZone';
import { CreaturePlaceholder } from './CreaturePlaceholder';
import { EnemyZone } from './EnemyZone';
import { CombatState, type PoisonSnapshot } from './CombatState';
import { PassiveFeedback } from './PassiveFeedback';
import { tickerWait, tickerLoop, type TickerHandle } from './tickerUtils';

const BONE = 0xD9CFBA, RUST = 0x8B3A1A, MOSS = 0x2D4A2E;
const PADDING = 8, GAP = 4, MAX_CREATURE_H = 200;
type CombatPhase = 'rolling' | 'allocating' | 'resolving' | 'results' | 'finished';

export interface CombatSceneData {
  survivor: Survivor; enemy: Enemy; playerHp: number; playerMaxHp: number;
  playerEquipment: readonly Equipment[];
  onCombatEnd: (won: boolean, playerHpAfter: number, speedKill: boolean) => void;
  passiveId?: PassiveId;
  passiveState?: PassiveState;
}

const PAT_LABEL: Record<AllocationPattern, string> = { aggressive: 'ATK Agressif', defensive: 'DEF Defensif', neutral: 'Neutre' };
const PAT_COLOR: Record<AllocationPattern, number> = { aggressive: RUST, defensive: MOSS, neutral: BONE };

export class CombatScene extends Container implements Scene {
  private _allocator = new DiceAllocator();
  private _playerZone = new PlayerZone();
  private _enemyZone = new EnemyZone();
  private _creature = new CreaturePlaceholder();
  private _commitBtn = new CommitButton();
  private _resetBtn = new ResetButton();
  private _resolution = new ResolutionAnimation();
  private _passiveFeedback = new PassiveFeedback();
  private _playerDiceZone = new Container();
  private _phase: CombatPhase = 'rolling';
  private _data: CombatSceneData | null = null;
  private _state: CombatState | null = null;
  private _passiveId?: PassiveId;
  private _recycleurCancel: { cancel: () => void } | null = null;
  private _tapPrompt: Text;
  private _tapPulseHandle: TickerHandle | null = null;
  private _sw = 360;
  private _sh = 640;

  constructor() {
    super();
    this.addChild(this._enemyZone);
    this.addChild(this._creature, this._resolution, this._playerDiceZone);
    this.addChild(this._playerZone, this._resetBtn, this._commitBtn, this._passiveFeedback);
    this._tapPrompt = new Text({
      text: 'TAP TO CONTINUE', style: {
        fontFamily: '"Courier New", monospace', fontSize: 14,
        fontWeight: 'bold', fill: BONE, letterSpacing: 2,
      },
    });
    this._tapPrompt.anchor.set(0.5);
    this._tapPrompt.visible = false;
    this.addChild(this._tapPrompt);
    this._commitBtn.onCommit = () => this._handleCommit();
    this._resetBtn.onReset = () => { this._allocator.resetAllAllocations(); };
    this._playerZone.grid.onSlotTap = (i) => this._allocator.handleSlotTap(i);
    this._allocator.onChange = () => {
      this._commitBtn.setEnabled(this._allocator.isComplete());
      this._resetBtn.setVisible(this._allocator.hasAllocations());
      if (this._passiveId === 'ingenieux') {
        this._passiveFeedback.checkIngenieuxPreview(
          this._allocator.getAllocations(), this._data!.playerEquipment, // safe: onChange only fires during allocation
          this._passiveId, this._playerZone.grid.slots,
        );
      }
      this._handleRecycleurOnChange();
    };
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
    this._passiveId = d.passiveId;
    this._state = new CombatState(
      d.playerHp, d.playerMaxHp, d.enemy.hp, d.enemy.maxHp,
      d.passiveId, d.passiveState,
    );
    this._passiveFeedback.init(d.passiveId, d.passiveState);
    this._enemyZone.setName(d.enemy.name);
    this._creature.setEnemy(d.enemy.name, PAT_LABEL[d.enemy.pattern], PAT_COLOR[d.enemy.pattern]);
    this._buildGrids(d);
    this._updateHpDisplays();
    this._playerZone.badge.setPoisonTurns(0);
    this._enemyZone.setPoisonTurns(0);
    this._layout();
    // Fire Elan banner (fire-and-forget — finishes before 2s roll wait)
    if (d.passiveId === 'elan' && d.passiveState?.elanActive) {
      void this._passiveFeedback.playElanBanner(this._sw);
    }
    this._startRound();
  }

  onExit(): void {
    this._allocator.reset(); this._playerZone.clear(); this._enemyZone.clear();
    this._resolution.reset(); this._tapPulseHandle?.stop(); this._tapPulseHandle = null;
    this._tapPrompt.visible = false; this._passiveFeedback.cleanup();
    this._playerZone.badge.setDangerPulse(false);
    this._recycleurCancel = null; this._data = null; this._state = null;
  }

  onResize(w: number, h: number): void { this._sw = w; this._sh = h; this._layout(); }

  private _layout(): void {
    const w = this._sw, h = this._sh, cx = w / 2, avail = w - PADDING * 2;
    // Top: enemy zone
    this._enemyZone.position.set(PADDING, PADDING);
    this._enemyZone.layout(avail);
    if (this._state) this._enemyZone.updateHp(this._state.enemyHp, this._state.enemyMaxHp, avail * 0.6);
    const enemyBottom = PADDING + this._enemyZone.zoneHeight + GAP;
    // Bottom-up: buttons → player zone → dice tray
    const btnY = h - PADDING - this._commitBtn.buttonHeight;
    const btnGap = 8;
    const totalBtnW = this._resetBtn.buttonWidth + btnGap + this._commitBtn.buttonWidth;
    this._resetBtn.position.set(cx - totalBtnW / 2, btnY);
    this._commitBtn.position.set(cx - totalBtnW / 2 + this._resetBtn.buttonWidth + btnGap, btnY);
    this._playerZone.layout(avail);
    const pzY = btnY - GAP - this._playerZone.zoneHeight;
    this._playerZone.position.set(PADDING, pzY);
    const diceY = pzY - GAP - DIE_SIZE;
    this._playerDiceZone.position.set(0, diceY);
    this._allocator.updateLayout(this._sw, diceY);
    this._allocator.layoutDice();
    // Middle: creature fills remaining space (capped)
    const creatureH = Math.min(MAX_CREATURE_H, Math.max(20, diceY - GAP - enemyBottom));
    this._creature.position.set(PADDING, enemyBottom);
    this._creature.layout(avail, creatureH);
    this._resolution.layoutAt(cx, enemyBottom + 10, avail);
    this._tapPrompt.position.set(cx, enemyBottom + creatureH / 2);
  }

  private _updateHpDisplays(): void {
    if (!this._state) return;
    const bw = (this._sw - PADDING * 2) * 0.6;
    this._enemyZone.updateHp(this._state.enemyHp, this._state.enemyMaxHp, bw);
    this._playerZone.updateHp(this._state.playerHp, this._state.playerMaxHp);
    this._resolution.setHpBars(this._playerZone.badge, bw, this._enemyZone.hpFillGraphics, bw);
  }

  private _buildGrids(d: CombatSceneData): void {
    this._playerZone.clear(); this._enemyZone.clear();
    this._playerZone.build(d.playerEquipment);
    this._enemyZone.buildSlots(d.enemy.equipment);
  }

  private _startRound(): void {
    if (!this._data || !this._state) return;
    this._state.nextRound(); this._phase = 'rolling';
    this._resolution.reset(); this._playerZone.grid.resetAll();
    this._enemyZone.resetSlots(); this._allocator.reset(); this._enemyZone.clearDice();
    this._recycleurCancel = null;
    const pv = rollDice(2); // Raw dice — Recycleur is now interactive
    const ev = rollDice(2);
    for (const die of this._allocator.setup(pv, [...this._playerZone.grid.slots], this._sw, this._playerDiceZone.y))
      this.addChild(die);
    this._enemyZone.buildDice(ev);
    this._commitBtn.setEnabled(false); this._resetBtn.setVisible(false);
    this._allocator.layoutDice(); this._layout();
    void tickerWait(2000).then(() => {
      this._phase = 'allocating';
      this._allocator.setEnabled(true);
      // Survivant: toggle danger pulse based on HP
      if (this._passiveId === 'survivant' && this._state) {
        this._passiveFeedback.updateSurvivantDanger(
          this._playerZone.badge, this._state.playerHp / this._state.playerMaxHp,
        );
      }
      // Elan: glow weapon slots on round 1
      if (this._passiveId === 'elan' && this._data?.passiveState?.elanActive && this._state?.round === 1) {
        this._passiveFeedback.setElanGlow([...this._playerZone.grid.slots], true);
      }
      // Recycleur: interactive die=1 adjust
      this._trySetupRecycleur();
    });
  }

  private async _handleCommit(): Promise<void> {
    if (this._phase !== 'allocating' || !this._data || !this._state) return;
    this._phase = 'resolving';
    this._recycleurCancel?.cancel(); this._recycleurCancel = null;
    this._commitBtn.setEnabled(false); this._resetBtn.setVisible(false);
    this._allocator.setEnabled(false); this._playerZone.grid.lockAll();
    const pa = this._allocator.getAllocations();
    const ea = allocateEnemy([...this._enemyZone.diceValues], this._data.enemy.equipment, this._data.enemy.pattern);
    for (const a of ea) this._enemyZone.placeDie(a.equipmentIndex, a.dieValue);
    this._enemyZone.clearDice(); await tickerWait(500);
    const r = this._state.applyRound(pa, [...this._data.playerEquipment], ea, [...this._data.enemy.equipment]);
    this._playerZone.applyPoison(r.playerPoison); this._applyEnemyPoison(r.enemyPoison);
    await this._resolution.play(r.resolutionData);
    // Post-resolution passive feedback
    await this._passiveFeedback.handleRoundResult(r.passiveEvents, [...this._playerZone.grid.slots]);
    // Elan: clear weapon glow after round 1
    if (this._passiveId === 'elan' && this._state.round === 1) {
      this._passiveFeedback.setElanGlow([...this._playerZone.grid.slots], false);
    }
    // Survivant: update danger state after damage
    if (this._passiveId === 'survivant') {
      this._passiveFeedback.updateSurvivantDanger(
        this._playerZone.badge, this._state.playerHp / this._state.playerMaxHp,
      );
    }
    this._updateHpDisplays();
    this._phase = 'results'; await this._waitForTap();
    if (r.resolutionData.combatEnded) {
      this._phase = 'finished';
      const speedKill = r.resolutionData.playerWon && this._state.round <= 3;
      this._data.onCombatEnd(r.resolutionData.playerWon, this._state.playerHp, speedKill);
    } else { this._startRound(); }
  }

  private _applyEnemyPoison(s: PoisonSnapshot): void {
    if (s.newPoison > 0 && s.poisonAfterTick > 0) this._enemyZone.showPoisonStack(s.poisonAfterTick, s.totalAfter);
    else this._enemyZone.setPoisonTurns(s.totalAfter);
    if (s.ticked) this._enemyZone.pulsePoisonBadge();
  }

  /** Setup Recycleur interactive button if conditions are met. */
  private _trySetupRecycleur(): void {
    if (!this._data?.passiveState || this._passiveId !== 'recycleur') return;
    if (this._data.passiveState.recycleurUsed) return;
    const targetDie = this._allocator.dice.find(d => d.value === 1);
    if (!targetDie) return;
    this._recycleurCancel = this._passiveFeedback.setupRecycleur(
      targetDie, this._data.passiveState, () => {
        this._recycleurCancel = null;
        this._allocator.onChange?.(); // Refresh commit button state
      },
    );
  }

  /** On allocation change: hide/re-show Recycleur button as die is placed/undone. */
  private _handleRecycleurOnChange(): void {
    if (this._passiveId !== 'recycleur' || !this._data?.passiveState) return;
    if (this._data.passiveState.recycleurUsed) return;
    const targetDie = this._allocator.dice.find(d => d.value === 1);
    // If die=1 is placed (not visible), hide button
    if (!targetDie || !targetDie.visible) {
      this._passiveFeedback.hideRecycleur();
      this._recycleurCancel = null;
    } else if (!this._recycleurCancel) {
      // Die=1 was un-placed, re-show button
      this._trySetupRecycleur();
    }
  }

  private _waitForTap(): Promise<void> {
    return new Promise((resolve) => {
      this._tapPrompt.visible = true; this._tapPrompt.alpha = 1;
      this._tapPulseHandle?.stop();
      this._tapPulseHandle = tickerLoop((t) => { this._tapPrompt.visible = Math.floor(t / 500) % 2 === 0; });
      const handler = () => {
        if (this._phase !== 'results') return;
        this.off('pointerdown', handler);
        this._tapPulseHandle?.stop(); this._tapPulseHandle = null;
        this._tapPrompt.visible = false;
        resolve();
      };
      this.on('pointerdown', handler);
    });
  }
}
