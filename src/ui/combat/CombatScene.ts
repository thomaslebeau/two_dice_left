/**
 * V6 combat scene — orchestrates dice rolling, drag-drop allocation,
 * resolution animation, and combat flow.
 *
 * Mobile-first vertical layout (390×844 reference):
 *   Enemy zone (name + HP bar + equipment slots)
 *   Resolution zone (damage text + animations)
 *   Player dice (2 draggable dice)
 *   Player equipment slots (drop targets)
 *   Commit button
 *   Player zone (name + HP bar)
 *
 * UI never computes damage — reads engine results only.
 */

import { Container, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type {
  AllocationPattern,
  Enemy,
  Equipment,
  Survivor,
} from '../../engine/types';
import { rollDice } from '../../engine/dice';
import { allocateEnemy } from '../../engine/allocation';
import { DIE_SIZE } from './DiceSprite';
import { CommitButton } from './CommitButton';
import { ResolutionAnimation } from './ResolutionAnimation';
import { DiceAllocator } from './DiceAllocator';
import { EquipmentGrid } from './EquipmentGrid';
import { CombatantHud } from './CombatantHud';
import { EnemyInfoPanel } from './EnemyInfoPanel';
import { CombatState, type PoisonSnapshot } from './CombatState';
import { tickerWait, tickerLoop, type TickerHandle } from './tickerUtils';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;

// ---------------------------------------------------------------------------
// Combat phase
// ---------------------------------------------------------------------------

type CombatPhase =
  | 'rolling'
  | 'allocating'
  | 'resolving'
  | 'results'
  | 'finished';

// ---------------------------------------------------------------------------
// Config passed to onEnter
// ---------------------------------------------------------------------------

export interface CombatSceneData {
  survivor: Survivor;
  enemy: Enemy;
  playerHp: number;
  playerMaxHp: number;
  playerEquipment: readonly Equipment[];
  /** Called when combat ends. Scene passes outcome. */
  onCombatEnd: (won: boolean, playerHpAfter: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PADDING = 8;
const SECTION_GAP = 6;

function patternLabel(p: AllocationPattern): string {
  switch (p) {
    case 'aggressive': return 'ATK Agressif';
    case 'defensive': return 'DEF Defensif';
    case 'neutral': return 'Neutre';
  }
}

function patternColor(p: AllocationPattern): number {
  switch (p) {
    case 'aggressive': return RUST;
    case 'defensive': return MOSS;
    case 'neutral': return BONE;
  }
}

// ---------------------------------------------------------------------------
// CombatScene
// ---------------------------------------------------------------------------

export class CombatScene extends Container implements Scene {
  // --- Sub-containers ---
  private _enemyZone = new Container();
  private _resolutionZone = new Container();
  private _playerDiceZone = new Container();

  // --- Components ---
  private _allocator = new DiceAllocator();
  private _playerGrid = new EquipmentGrid();
  private _enemyGrid = new EquipmentGrid();
  private _playerHud = new CombatantHud(12);
  private _enemyHud = new CombatantHud(14, true);
  private _enemyInfo = new EnemyInfoPanel();
  private _commitBtn = new CommitButton();
  private _resolution = new ResolutionAnimation();

  // --- State ---
  private _phase: CombatPhase = 'rolling';
  private _data: CombatSceneData | null = null;
  private _state: CombatState | null = null;

  // Tap-to-continue prompt
  private _tapPrompt: Text;
  private _tapPulseHandle: TickerHandle | null = null;

  // Screen dims
  private _sw = 390;
  private _sh = 844;

  constructor() {
    super();

    // Enemy zone: HUD + info panel + grid
    this._enemyZone.addChild(this._enemyHud, this._enemyInfo);

    this.addChild(this._enemyZone);
    this.addChild(this._resolutionZone);
    this.addChild(this._playerDiceZone);
    this.addChild(this._playerGrid);
    this.addChild(this._commitBtn);
    this.addChild(this._playerHud);
    this.addChild(this._resolution);

    // Tap-to-continue prompt (hidden by default)
    this._tapPrompt = new Text({
      text: 'TAP TO CONTINUE',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 2,
      },
    });
    this._tapPrompt.anchor.set(0.5);
    this._tapPrompt.visible = false;
    this.addChild(this._tapPrompt);

    this._commitBtn.onCommit = () => this._handleCommit();

    // Wire player grid slot taps to allocator
    this._playerGrid.onSlotTap = (idx) => this._allocator.handleSlotTap(idx);

    // Wire allocator callbacks
    this._allocator.onChange = () => {
      this._commitBtn.setEnabled(this._allocator.isComplete());
    };
    this._allocator.onBringToFront = (die) => {
      this.setChildIndex(die, this.children.length - 1);
    };

    // Global pointer move/up for drag (forwarded to allocator)
    this.eventMode = 'static';
    this.on('pointermove', (e: { global: { x: number; y: number } }) => {
      this._allocator.handlePointerMove(e.global);
    });
    this.on('pointerup', () => this._allocator.handlePointerUp());
    this.on('pointerupoutside', () => this._allocator.handlePointerUp());
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as CombatSceneData;
    this._data = d;
    this._state = new CombatState(
      d.playerHp, d.playerMaxHp, d.enemy.hp, d.enemy.maxHp,
    );

    this._enemyHud.setName(d.enemy.name);
    this._enemyHud.setPattern(
      patternLabel(d.enemy.pattern), patternColor(d.enemy.pattern),
    );
    this._playerHud.setName(d.survivor.name);

    this._enemyInfo.buildEquipInfo(d.enemy.equipment);
    this._buildGrids(d);
    this._updateHpDisplays();
    this._playerHud.setPoisonTurns(0);
    this._enemyHud.setPoisonTurns(0);
    this._layout();
    this._startRound();
  }

  onExit(): void {
    this._allocator.reset();
    this._enemyInfo.clear();
    this._playerGrid.clear();
    this._enemyGrid.clear();
    this._resolution.reset();
    this._stopTapPulse();
    this._tapPrompt.visible = false;
    this._data = null;
    this._state = null;
  }

  onResize(width: number, height: number): void {
    this._sw = width;
    this._sh = height;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._sw;
    const cx = w / 2;
    let y = PADDING;

    // Enemy zone — HUD, equipment info, grid, dice
    this._enemyZone.position.set(PADDING, y);
    const availW = w - PADDING * 2;
    let ey = 0;

    // Enemy HUD (name + pattern + HP bar + poison)
    this._enemyHud.position.set(0, ey);
    this._enemyHud.layout();
    ey += this._enemyHud.hudHeight + 2;

    // Enemy info panel (equip descriptions + dice)
    this._enemyInfo.position.set(0, ey);
    this._enemyInfo.layout(availW);
    ey += this._enemyInfo.panelHeight + 4;

    // Enemy equipment grid (by category)
    this._enemyGrid.position.set(0, ey);
    this._enemyGrid.layout(availW);
    ey += this._enemyGrid.gridHeight + 8;

    y += ey + SECTION_GAP;

    // Resolution zone
    this._resolutionZone.position.set(0, y);
    const resH = 90;
    this._resolution.layoutAt(cx, y, w - PADDING * 2);
    y += resH + SECTION_GAP;

    // Player dice
    this._playerDiceZone.position.set(0, y);
    this._allocator.updateLayout(this._sw, y);
    this._allocator.layoutDice();
    y += DIE_SIZE + SECTION_GAP;

    // Player equipment grid (by category)
    this._playerGrid.position.set(PADDING, y);
    this._playerGrid.layout(availW);
    y += this._playerGrid.gridHeight + SECTION_GAP;

    // Commit button
    this._commitBtn.position.set(
      cx - this._commitBtn.buttonWidth / 2,
      y,
    );
    y += this._commitBtn.buttonHeight + SECTION_GAP;

    // Player HUD (name + HP bar + poison)
    this._playerHud.position.set(PADDING, y);
    this._playerHud.layout();
    y += this._playerHud.hudHeight + SECTION_GAP;

    // Tap prompt — centered in the screen
    this._tapPrompt.position.set(cx, this._sh / 2);
  }


  // -----------------------------------------------------------------------
  // HP display
  // -----------------------------------------------------------------------

  private _updateHpDisplays(): void {
    if (!this._state) return;
    const barW = this._sw - PADDING * 2;

    this._playerHud.updateHp(
      this._state.playerHp, this._state.playerMaxHp, barW,
    );
    this._enemyHud.updateHp(
      this._state.enemyHp, this._state.enemyMaxHp, barW,
    );

    // Feed HP bars to resolution animation
    this._resolution.setHpBars(
      this._playerHud.hpFillGraphics, barW,
      this._enemyHud.hpFillGraphics, barW,
    );
  }


  // -----------------------------------------------------------------------
  // Slot & dice creation
  // -----------------------------------------------------------------------


  private _buildGrids(d: CombatSceneData): void {
    this._playerGrid.clear();
    this._enemyGrid.clear();

    this._playerGrid.build(d.playerEquipment);
    this._enemyGrid.build(d.enemy.equipment, true);

    // Add enemy grid to enemy zone
    this._enemyZone.addChild(this._enemyGrid);
  }


  // -----------------------------------------------------------------------
  // Round flow
  // -----------------------------------------------------------------------

  private _startRound(): void {
    if (!this._data || !this._state) return;
    this._state.nextRound();
    this._phase = 'rolling';
    this._resolution.reset();

    // Reset slot states
    this._playerGrid.resetAll();
    this._enemyGrid.resetAll();

    // Roll BOTH sides simultaneously
    this._allocator.reset();
    this._enemyInfo.clearDice();
    const playerValues = rollDice(2);
    const enemyValues = rollDice(2);

    // Player dice — via allocator
    const homeY = this._playerDiceZone.y;
    const dice = this._allocator.setup(
      playerValues, [...this._playerGrid.slots], this._sw, homeY,
    );
    for (const die of dice) this.addChild(die);

    // Enemy dice — muted, non-interactive display
    this._enemyInfo.buildDice(enemyValues);
    this._enemyInfo.setDiceVisible(true);

    this._commitBtn.setEnabled(false);
    this._allocator.layoutDice();
    this._layout();

    // Transition to allocating after roll animation
    void tickerWait(2000).then(() => {
      this._phase = 'allocating';
      this._allocator.setEnabled(true);
    });
  }


  // -----------------------------------------------------------------------
  // Commit & resolution
  // -----------------------------------------------------------------------

  private async _handleCommit(): Promise<void> {
    if (this._phase !== 'allocating' || !this._data || !this._state) return;
    this._phase = 'resolving';
    this._commitBtn.setEnabled(false);
    this._allocator.setEnabled(false);
    this._playerGrid.lockAll();

    // Build allocations
    const playerAllocs = this._allocator.getAllocations();
    const enemyAllocs = allocateEnemy(
      [...this._enemyInfo.diceValues],
      this._data.enemy.equipment,
      this._data.enemy.pattern,
    );

    // Reveal enemy allocation visually
    for (const ea of enemyAllocs) {
      this._enemyGrid.placeDie(ea.equipmentIndex, ea.dieValue);
    }
    this._enemyInfo.setDiceVisible(false);
    await tickerWait(500);

    // Resolve via CombatState (engine + state mutation)
    const result = this._state.applyRound(
      playerAllocs, [...this._data.playerEquipment],
      enemyAllocs, [...this._data.enemy.equipment],
    );

    // Update poison HUDs
    this._applyPoisonHud(this._playerHud, result.playerPoison);
    this._applyPoisonHud(this._enemyHud, result.enemyPoison);

    // Animate resolution
    await this._resolution.play(result.resolutionData);
    this._updateHpDisplays();
    this._phase = 'results';

    await this._waitForTap();

    const rd = result.resolutionData;
    if (rd.combatEnded) {
      this._phase = 'finished';
      this._data.onCombatEnd(rd.playerWon, this._state.playerHp);
    } else {
      this._startRound();
    }
  }

  /** Drive a HUD's poison badge from a PoisonSnapshot. */
  private _applyPoisonHud(
    hud: CombatantHud, snap: PoisonSnapshot,
  ): void {
    if (snap.newPoison > 0 && snap.poisonAfterTick > 0) {
      hud.showPoisonStack(snap.poisonAfterTick, snap.totalAfter);
    } else {
      hud.setPoisonTurns(snap.totalAfter);
    }
    if (snap.ticked) hud.pulsePoisonBadge();
  }

  // -----------------------------------------------------------------------
  // Tap-to-continue
  // -----------------------------------------------------------------------

  /**
   * Show "TAP TO CONTINUE" prompt with pulsing alpha.
   * Resolves when the player taps anywhere on the scene.
   */
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
    this._tapPrompt.alpha = 1;
    this._tapPulseHandle = tickerLoop((elapsed) => {
      // Toggle every 500ms
      this._tapPrompt.visible = Math.floor(elapsed / 500) % 2 === 0;
    });
  }

  private _stopTapPulse(): void {
    this._tapPulseHandle?.stop();
    this._tapPulseHandle = null;
  }

}
