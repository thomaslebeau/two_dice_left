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

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type {
  Equipment,
  Allocation,
  AllocationPattern,
  Enemy,
  Survivor,
} from '../../engine/types';
import { rollDice } from '../../engine/dice';
import { allocateEnemy } from '../../engine/allocation';
import { DiceSprite, DIE_SIZE } from './DiceSprite';
import { EquipmentSlot, SLOT_WIDTH, SLOT_HEIGHT } from './EquipmentSlot';
import { CommitButton } from './CommitButton';
import {
  ResolutionAnimation,
  type ResolutionData,
} from './ResolutionAnimation';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const BLOOD = 0x6B1C1C;

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

const PADDING = 12;
const HP_BAR_HEIGHT = 10;
const SECTION_GAP = 10;

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

function sumEffectField(
  allocs: readonly Allocation[],
  equipment: readonly Equipment[],
  field: 'damage' | 'shield' | 'heal' | 'poison',
): number {
  let total = 0;
  for (const a of allocs) {
    const eq = equipment[a.equipmentIndex];
    total += eq.effect(a.dieValue)[field];
  }
  return total;
}

// ---------------------------------------------------------------------------
// CombatScene
// ---------------------------------------------------------------------------

export class CombatScene extends Container implements Scene {
  // --- Sub-containers ---
  private _enemyZone = new Container();
  private _resolutionZone = new Container();
  private _playerDiceZone = new Container();
  private _playerSlotsZone = new Container();
  private _playerZone = new Container();

  // --- Components ---
  private _playerDice: DiceSprite[] = [];
  private _enemyDiceSprites: DiceSprite[] = [];
  private _enemyDiceValues: number[] = [];
  private _playerSlots: EquipmentSlot[] = [];
  private _enemySlots: EquipmentSlot[] = [];
  private _commitBtn = new CommitButton();
  private _resolution = new ResolutionAnimation();
  private _enemyDiceZone = new Container();

  // --- HP bars ---
  private _playerHpBg = new Graphics();
  private _playerHpFill = new Graphics();
  private _enemyHpBg = new Graphics();
  private _enemyHpFill = new Graphics();
  private _playerNameText: Text;
  private _playerHpText: Text;
  private _enemyNameText: Text;
  private _enemyPatternText: Text;
  private _enemyHpText: Text;
  private _enemyEquipContainer = new Container();

  // --- State ---
  private _phase: CombatPhase = 'rolling';
  private _data: CombatSceneData | null = null;
  private _round = 0;
  private _playerHp = 0;
  private _enemyHp = 0;
  private _playerPoisonTurns = 0;
  private _enemyPoisonTurns = 0;

  // Tap-to-continue prompt
  private _tapPrompt: Text;
  private _tapPulseId: ReturnType<typeof setInterval> | null = null;

  // Drag state
  private _draggingDie: DiceSprite | null = null;
  private _dragOffset = { x: 0, y: 0 };

  // Allocation tracking (for undo)
  private _allocations = new Map<number, number>(); // dieIndex → equipmentIndex

  // Screen dims
  private _sw = 390;

  constructor() {
    super();

    // Text elements
    this._enemyNameText = this._makeText('', 16, BONE, true);
    this._enemyPatternText = this._makeText('', 12, BONE);
    this._enemyHpText = this._makeText('', 11, BONE);
    this._playerNameText = this._makeText('', 14, BONE, true);
    this._playerHpText = this._makeText('', 12, BONE);

    // Build structure
    this._enemyZone.addChild(
      this._enemyNameText, this._enemyPatternText,
      this._enemyHpBg, this._enemyHpFill, this._enemyHpText,
      this._enemyEquipContainer,
      this._enemyDiceZone,
    );
    this._playerZone.addChild(
      this._playerNameText, this._playerHpBg,
      this._playerHpFill, this._playerHpText,
    );

    this.addChild(this._enemyZone);
    this.addChild(this._resolutionZone);
    this.addChild(this._playerDiceZone);
    this.addChild(this._playerSlotsZone);
    this.addChild(this._commitBtn);
    this.addChild(this._playerZone);
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

    // Global pointer move/up for drag
    this.eventMode = 'static';
    this.on('pointermove', this._handlePointerMove, this);
    this.on('pointerup', this._handlePointerUp, this);
    this.on('pointerupoutside', this._handlePointerUp, this);
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as CombatSceneData;
    this._data = d;
    this._round = 0;
    this._playerHp = d.playerHp;
    this._enemyHp = d.enemy.hp;
    this._playerPoisonTurns = 0;
    this._enemyPoisonTurns = 0;

    this._enemyNameText.text = d.enemy.name;
    this._enemyPatternText.text = patternLabel(d.enemy.pattern);
    this._enemyPatternText.style.fill = patternColor(d.enemy.pattern);
    this._playerNameText.text = d.survivor.name;

    this._buildEnemyEquipInfo(d.enemy);
    this._buildSlots(d);
    this._updateHpDisplays();
    this._layout();
    this._startRound();
  }

  onExit(): void {
    this._clearDice();
    this._clearSlots();
    this._enemyEquipContainer.removeChildren();
    this._resolution.reset();
    this._stopTapPulse();
    this._tapPrompt.visible = false;
    this._data = null;
  }

  onResize(width: number, _height: number): void {
    this._sw = width;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._sw;
    const cx = w / 2;
    let y = PADDING;

    // Enemy zone — name, pattern, HP bar, equipment info, then slots
    this._enemyZone.position.set(PADDING, y);
    const availW = w - PADDING * 2;
    let ey = 0;

    // Enemy name (bold, 16px)
    this._enemyNameText.position.set(0, ey);
    ey += 22;

    // Pattern indicator (12px, colored)
    this._enemyPatternText.position.set(0, ey);
    ey += 18;

    // HP bar
    this._drawHpBarBg(this._enemyHpBg, availW, ey);
    this._enemyHpFill.position.set(0, ey);
    ey += HP_BAR_HEIGHT + 2;
    this._enemyHpText.position.set(0, ey);
    ey += 16;

    // Equipment info lines
    this._enemyEquipContainer.position.set(0, ey);
    ey += this._enemyEquipContainer.height + 6;

    // Enemy equipment slots
    this._layoutSlotsRow(this._enemySlots, 0, ey, availW);
    for (const s of this._enemySlots) {
      this._enemyZone.addChild(s);
    }
    ey += SLOT_HEIGHT + 12;

    // Enemy dice (muted, display-only) — below slots with clear gap
    this._enemyDiceZone.position.set(0, ey);
    this._layoutEnemyDice();
    ey += (this._enemyDiceSprites.length > 0 ? DIE_SIZE * 0.6 + 6 : 0);

    y += ey + SECTION_GAP;

    // Resolution zone
    this._resolutionZone.position.set(0, y);
    const resH = 120;
    this._resolution.layoutAt(cx, y, w - PADDING * 2);
    y += resH + SECTION_GAP;

    // Player dice
    this._playerDiceZone.position.set(0, y);
    this._layoutDice(y);
    y += DIE_SIZE + SECTION_GAP;

    // Player equipment slots
    this._playerSlotsZone.position.set(0, y);
    this._layoutSlotsRow(this._playerSlots, PADDING, 0, w);
    y += SLOT_HEIGHT + SECTION_GAP;

    // Commit button
    this._commitBtn.position.set(
      cx - this._commitBtn.buttonWidth / 2,
      y,
    );
    // Tap prompt (overlaps commit area during results phase)
    this._tapPrompt.position.set(cx, y + this._commitBtn.buttonHeight / 2);
    y += this._commitBtn.buttonHeight + SECTION_GAP;

    // Player zone
    this._playerZone.position.set(PADDING, y);
    this._layoutCombatantZone(
      this._playerNameText, this._playerHpBg,
      this._playerHpFill, this._playerHpText,
      w - PADDING * 2,
    );
  }

  private _layoutCombatantZone(
    nameText: Text, hpBg: Graphics,
    hpFill: Graphics, hpText: Text,
    availW: number,
  ): void {
    nameText.position.set(0, 0);
    const barY = 20;
    this._drawHpBarBg(hpBg, availW, barY);
    hpFill.position.set(0, barY);
    hpText.position.set(0, barY + HP_BAR_HEIGHT + 2);
  }

  private _layoutSlotsRow(
    slots: EquipmentSlot[],
    startX: number,
    y: number,
    screenW: number,
  ): void {
    if (slots.length === 0) return;
    const totalW = slots.length * SLOT_WIDTH + (slots.length - 1) * 8;
    let x = Math.max(startX, (screenW - totalW) / 2);
    for (const slot of slots) {
      slot.position.set(x, y);
      x += SLOT_WIDTH + 8;
    }
  }

  private _layoutDice(y: number): void {
    const totalW = this._playerDice.length * DIE_SIZE
      + (this._playerDice.length - 1) * 16;
    let x = (this._sw - totalW) / 2;
    for (const die of this._playerDice) {
      die.position.set(x, y);
      x += DIE_SIZE + 16;
    }
  }

  /** Position enemy dice within _enemyDiceZone (scaled down). */
  private _layoutEnemyDice(): void {
    const scale = 0.6;
    const gap = 8;
    const dieW = DIE_SIZE * scale;
    const count = this._enemyDiceSprites.length;
    if (count === 0) return;
    const totalW = count * dieW + (count - 1) * gap;
    const availW = this._sw - PADDING * 2;
    let x = (availW - totalW) / 2;
    for (const die of this._enemyDiceSprites) {
      die.scale.set(scale);
      die.position.set(x, 0);
      x += dieW + gap;
    }
  }

  // -----------------------------------------------------------------------
  // HP display
  // -----------------------------------------------------------------------

  private _drawHpBarBg(bg: Graphics, w: number, y: number): void {
    bg.clear();
    bg.roundRect(0, y, w, HP_BAR_HEIGHT, 3);
    bg.fill({ color: 0x333333 });
  }

  private _drawHpFill(
    fill: Graphics, current: number,
    max: number, w: number,
  ): void {
    fill.clear();
    const pct = Math.max(0, current / max);
    const barW = pct * w;
    if (barW > 0) {
      fill.roundRect(0, 0, barW, HP_BAR_HEIGHT, 3);
      fill.fill({ color: pct > 0.3 ? MOSS : BLOOD });
    }
  }

  private _updateHpDisplays(): void {
    if (!this._data) return;
    const barW = this._sw - PADDING * 2;

    this._drawHpFill(
      this._playerHpFill, this._playerHp,
      this._data.playerMaxHp, barW,
    );
    this._playerHpText.text =
      `${this._playerHp}/${this._data.playerMaxHp}`;

    this._drawHpFill(
      this._enemyHpFill, this._enemyHp,
      this._data.enemy.maxHp, barW,
    );
    this._enemyHpText.text =
      `${this._enemyHp}/${this._data.enemy.maxHp}`;

    // Feed HP bars to resolution animation
    this._resolution.setHpBars(
      this._playerHpFill, barW,
      this._enemyHpFill, barW,
    );
  }

  // -----------------------------------------------------------------------
  // Slot & dice creation
  // -----------------------------------------------------------------------

  /** Build descriptive text lines for enemy equipment using formula. */
  private _buildEnemyEquipInfo(enemy: Enemy): void {
    this._enemyEquipContainer.removeChildren();
    let ly = 0;
    for (const eq of enemy.equipment) {
      const tag = eq.type === 'weapon' ? 'ATK' : 'DEF';
      const color = eq.type === 'weapon' ? RUST : MOSS;
      const line = new Text({
        text: `${tag} ${eq.name} [${eq.minDie}-${eq.maxDie}] -> ${eq.description}`,
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 11,
          fill: color,
        },
      });
      line.position.set(0, ly);
      this._enemyEquipContainer.addChild(line);
      ly += 15;
    }
  }

  private _buildSlots(d: CombatSceneData): void {
    this._clearSlots();

    for (let i = 0; i < d.playerEquipment.length; i++) {
      const slot = new EquipmentSlot(d.playerEquipment[i], i);
      slot.on('pointerdown', () => this._handleSlotTap(i));
      this._playerSlots.push(slot);
      this._playerSlotsZone.addChild(slot);
    }

    for (let i = 0; i < d.enemy.equipment.length; i++) {
      const slot = new EquipmentSlot(d.enemy.equipment[i], i);
      slot.lock();
      this._enemySlots.push(slot);
    }
  }

  private _clearSlots(): void {
    for (const s of this._playerSlots) s.destroy({ children: true });
    for (const s of this._enemySlots) s.destroy({ children: true });
    this._playerSlots = [];
    this._enemySlots = [];
  }

  private _clearDice(): void {
    for (const d of this._playerDice) d.destroy();
    this._playerDice = [];
    for (const d of this._enemyDiceSprites) d.destroy();
    this._enemyDiceSprites = [];
    this._enemyDiceValues = [];
    this._allocations.clear();
  }

  // -----------------------------------------------------------------------
  // Round flow
  // -----------------------------------------------------------------------

  private _startRound(): void {
    if (!this._data) return;
    this._round++;
    this._phase = 'rolling';
    this._allocations.clear();
    this._resolution.reset();

    // Reset player slots
    for (const s of this._playerSlots) s.removeDie();

    // Reset enemy slots from previous round
    for (const s of this._enemySlots) s.removeDie();

    // Roll BOTH sides simultaneously
    this._clearDice();
    this._enemyDiceZone.visible = true;
    const playerValues = rollDice(2);
    this._enemyDiceValues = rollDice(2);

    // Player dice — draggable
    for (let i = 0; i < playerValues.length; i++) {
      const die = new DiceSprite(i);
      die.on('pointerdown', (e) => this._handleDieDown(i, e));
      this._playerDice.push(die);
      this.addChild(die);
      die.roll(playerValues[i]);
    }

    // Enemy dice — muted, non-interactive display
    this._buildEnemyDice();

    this._commitBtn.setEnabled(false);
    this._layoutDice(this._playerDiceZone.y);
    this._layoutEnemyDice();

    // Transition to allocating after roll animation
    setTimeout(() => {
      this._phase = 'allocating';
      this._updateSlotHighlights();
    }, 2000);
  }

  /** Create muted enemy dice sprites for display only. */
  private _buildEnemyDice(): void {
    for (let i = 0; i < this._enemyDiceValues.length; i++) {
      const die = new DiceSprite(i);
      die.eventMode = 'none';
      die.cursor = 'default';
      die.alpha = 0.6;
      this._enemyDiceSprites.push(die);
      this._enemyDiceZone.addChild(die);
      die.roll(this._enemyDiceValues[i]);
    }
  }

  // -----------------------------------------------------------------------
  // Drag-drop
  // -----------------------------------------------------------------------

  private _handleDieDown(
    dieIndex: number,
    e: { global: { x: number; y: number } },
  ): void {
    if (this._phase !== 'allocating') return;
    const die = this._playerDice[dieIndex];
    if (!die) return;

    // If die is already placed, undo placement first
    if (this._allocations.has(dieIndex)) {
      this._undoPlacement(dieIndex);
    }

    die.setState('dragging');
    this._draggingDie = die;
    this._dragOffset.x = e.global.x - die.x;
    this._dragOffset.y = e.global.y - die.y;

    // Bring to front
    this.setChildIndex(die, this.children.length - 1);
    this._updateSlotHighlights();
  }

  private _handlePointerMove(
    e: { global: { x: number; y: number } },
  ): void {
    if (!this._draggingDie) return;
    this._draggingDie.x = e.global.x - this._dragOffset.x;
    this._draggingDie.y = e.global.y - this._dragOffset.y;

    // Preview on hovered slot
    for (const slot of this._playerSlots) {
      if (this._isOverSlot(this._draggingDie, slot)) {
        slot.showPreview(this._draggingDie.value);
      } else {
        slot.clearPreview();
      }
    }
  }

  private _handlePointerUp(): void {
    if (!this._draggingDie) return;
    const die = this._draggingDie;
    this._draggingDie = null;

    // Check if dropped on a valid slot
    let placed = false;
    for (const slot of this._playerSlots) {
      if (slot.slotState === 'filled' || slot.slotState === 'locked') {
        continue;
      }
      if (!this._isOverSlot(die, slot)) continue;

      if (slot.isCompatible(die.value)) {
        this._placeDie(die.dieIndex, slot.equipmentIndex);
        placed = true;
      } else {
        die.shake();
      }
      break;
    }

    if (!placed) {
      die.setState('idle');
      this._snapDieHome(die);
    }

    // Clear all slot previews
    for (const s of this._playerSlots) s.clearPreview();
    this._updateSlotHighlights();
    this._updateCommitButton();
  }

  /** Tap-to-place: place the first unplaced die into tapped slot. */
  private _handleSlotTap(slotIndex: number): void {
    if (this._phase !== 'allocating') return;
    const slot = this._playerSlots[slotIndex];
    if (!slot || slot.slotState === 'filled') return;

    // Find first unplaced die compatible with this slot
    for (const die of this._playerDice) {
      if (this._allocations.has(die.dieIndex)) continue;
      if (!slot.isCompatible(die.value)) continue;

      this._placeDie(die.dieIndex, slotIndex);
      this._updateSlotHighlights();
      this._updateCommitButton();
      return;
    }
  }

  private _placeDie(dieIndex: number, slotIndex: number): void {
    const die = this._playerDice[dieIndex];
    const slot = this._playerSlots[slotIndex];
    if (!die || !slot) return;

    this._allocations.set(dieIndex, slotIndex);
    slot.placeDie(die.value);
    die.setState('placed');

    // Snap die visually onto slot center
    die.x = slot.getGlobalPosition().x + SLOT_WIDTH / 2 - DIE_SIZE / 2;
    die.y = slot.getGlobalPosition().y - DIE_SIZE - 4;
  }

  private _undoPlacement(dieIndex: number): void {
    const slotIndex = this._allocations.get(dieIndex);
    if (slotIndex === undefined) return;

    this._allocations.delete(dieIndex);
    this._playerSlots[slotIndex]?.removeDie();
    this._snapDieHome(this._playerDice[dieIndex]);
  }

  private _snapDieHome(die: DiceSprite): void {
    const totalW = this._playerDice.length * DIE_SIZE
      + (this._playerDice.length - 1) * 16;
    const startX = (this._sw - totalW) / 2;
    die.x = startX + die.dieIndex * (DIE_SIZE + 16);
    die.y = this._playerDiceZone.y;
  }

  private _isOverSlot(die: DiceSprite, slot: EquipmentSlot): boolean {
    const slotBounds = slot.getBounds();
    const dieCX = die.x + DIE_SIZE / 2;
    const dieCY = die.y + DIE_SIZE / 2;
    return dieCX >= slotBounds.x
      && dieCX <= slotBounds.x + slotBounds.width
      && dieCY >= slotBounds.y
      && dieCY <= slotBounds.y + slotBounds.height;
  }

  // -----------------------------------------------------------------------
  // Slot highlighting
  // -----------------------------------------------------------------------

  private _updateSlotHighlights(): void {
    if (this._phase !== 'allocating') return;

    // Find currently dragged die value (if any)
    const dragValue = this._draggingDie?.value ?? null;

    for (const slot of this._playerSlots) {
      if (slot.slotState === 'filled' || slot.slotState === 'locked') {
        continue;
      }
      if (dragValue !== null && slot.isCompatible(dragValue)) {
        slot.setState('valid-target');
      } else {
        slot.setState('empty');
      }
    }
  }

  private _updateCommitButton(): void {
    // Enable commit when all dice are placed
    const allPlaced = this._playerDice.every(
      (d) => this._allocations.has(d.dieIndex),
    );
    this._commitBtn.setEnabled(allPlaced);
  }

  // -----------------------------------------------------------------------
  // Commit & resolution
  // -----------------------------------------------------------------------

  private async _handleCommit(): Promise<void> {
    if (this._phase !== 'allocating' || !this._data) return;
    this._phase = 'resolving';
    this._commitBtn.setEnabled(false);

    // Lock player slots
    for (const s of this._playerSlots) s.lock();

    // Build player allocations
    const playerAllocs: Allocation[] = [];
    for (const [dieIdx, eqIdx] of this._allocations) {
      playerAllocs.push({
        equipmentIndex: eqIdx,
        dieValue: this._playerDice[dieIdx].value,
      });
    }

    // Enemy uses ALREADY ROLLED dice (visible since round start)
    const enemyAllocs = allocateEnemy(
      this._enemyDiceValues,
      this._data.enemy.equipment,
      this._data.enemy.pattern,
    );

    // Reveal enemy allocation: snap dice into slots, then pause
    for (const ea of enemyAllocs) {
      this._enemySlots[ea.equipmentIndex]?.placeDie(ea.dieValue);
    }
    // Hide the free-floating enemy dice display
    this._enemyDiceZone.visible = false;

    // 0.5s pause so player can read enemy allocation
    await new Promise<void>((r) => setTimeout(r, 500));

    // Resolve effects (UI reads engine formulas)
    const pDmg = this._calcDamage(
      playerAllocs, this._data.playerEquipment,
      enemyAllocs, this._data.enemy.equipment,
      true,
    );
    const eDmg = this._calcDamage(
      enemyAllocs, this._data.enemy.equipment,
      playerAllocs, this._data.playerEquipment,
      false,
    );
    const pHeal = sumEffectField(
      playerAllocs, [...this._data.playerEquipment], 'heal',
    );
    const pShield = sumEffectField(
      playerAllocs, [...this._data.playerEquipment], 'shield',
    );
    const eShield = sumEffectField(
      enemyAllocs, [...this._data.enemy.equipment], 'shield',
    );

    // Poison
    const newPlayerPoison = sumEffectField(
      enemyAllocs, [...this._data.enemy.equipment], 'poison',
    );
    const newEnemyPoison = sumEffectField(
      playerAllocs, [...this._data.playerEquipment], 'poison',
    );

    // HP before
    const playerHpBefore = this._playerHp;
    const enemyHpBefore = this._enemyHp;

    // Apply damage (simultaneous)
    this._enemyHp -= pDmg;
    this._playerHp -= eDmg;

    // Apply existing poison ticks
    if (this._playerPoisonTurns > 0) {
      this._playerHp -= 1;
      this._playerPoisonTurns--;
    }
    if (this._enemyPoisonTurns > 0) {
      this._enemyHp -= 1;
      this._enemyPoisonTurns--;
    }

    // Queue new poison
    this._playerPoisonTurns += newPlayerPoison;
    this._enemyPoisonTurns += newEnemyPoison;

    // Heal (after poison, capped at max)
    if (this._playerHp > 0 && pHeal > 0) {
      this._playerHp = Math.min(
        this._data.playerMaxHp,
        this._playerHp + pHeal,
      );
    }

    // Clamp
    this._playerHp = Math.max(0, this._playerHp);
    this._enemyHp = Math.max(0, this._enemyHp);

    const combatEnded = this._playerHp <= 0 || this._enemyHp <= 0;
    const playerWon = this._enemyHp <= 0;

    // Speed kill recovery
    let speedKillRecovery = 0;
    if (playerWon && this._round <= 3) {
      const hpBefore = this._playerHp;
      this._playerHp = Math.min(
        this._data.playerMaxHp,
        this._playerHp + 3,
      );
      speedKillRecovery = this._playerHp - hpBefore;
    }

    // Play resolution animation
    const resData: ResolutionData = {
      playerAllocations: playerAllocs,
      playerEquipment: [...this._data.playerEquipment],
      playerDamageToEnemy: pDmg,
      playerShieldTotal: pShield,
      playerHealTotal: pHeal,
      enemyAllocations: enemyAllocs,
      enemyEquipment: [...this._data.enemy.equipment],
      enemyDamageToPlayer: eDmg,
      enemyShieldTotal: eShield,
      playerHpBefore,
      playerHpAfter: this._playerHp,
      playerMaxHp: this._data.playerMaxHp,
      enemyHpBefore,
      enemyHpAfter: this._enemyHp,
      enemyMaxHp: this._data.enemy.maxHp,
      combatEnded,
      playerWon,
      speedKillRecovery,
    };

    await this._resolution.play(resData);

    this._updateHpDisplays();
    this._phase = 'results';

    // Wait for player to read results and tap
    await this._waitForTap();

    if (combatEnded) {
      this._phase = 'finished';
      this._data.onCombatEnd(playerWon, this._playerHp);
    } else {
      this._startRound();
    }
  }

  /**
   * Calculate damage from attacker to defender.
   * Mirrors engine/combat.ts resolveRound logic.
   * Asymmetric min-1: player always does ≥1 if weapon used.
   */
  private _calcDamage(
    attackerAllocs: readonly Allocation[],
    attackerEquipment: readonly Equipment[],
    defenderAllocs: readonly Allocation[],
    defenderEquipment: readonly Equipment[],
    isPlayer: boolean,
  ): number {
    let totalAtk = 0;
    let usedWeapon = false;
    for (const a of attackerAllocs) {
      const eq = attackerEquipment[a.equipmentIndex];
      const eff = eq.effect(a.dieValue);
      totalAtk += eff.damage;
      if (eq.type === 'weapon' || eff.damage > 0) usedWeapon = true;
    }

    let totalDef = 0;
    for (const a of defenderAllocs) {
      const eq = defenderEquipment[a.equipmentIndex];
      totalDef += eq.effect(a.dieValue).shield;
    }

    const raw = totalAtk - totalDef;
    if (isPlayer && usedWeapon) return Math.max(1, raw);
    return Math.max(0, raw);
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
    let t = 0;
    this._tapPulseId = setInterval(() => {
      t += 50;
      // Oscillate alpha between 0.4 and 1.0 over 800ms cycle
      const cycle = (t % 800) / 800;
      const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.cos(cycle * Math.PI * 2));
      this._tapPrompt.alpha = alpha;
    }, 50);
  }

  private _stopTapPulse(): void {
    if (this._tapPulseId !== null) {
      clearInterval(this._tapPulseId);
      this._tapPulseId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

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
