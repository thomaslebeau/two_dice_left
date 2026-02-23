import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { CombatEngine } from '@engine/CombatEngine.ts';
import type { CombatSnapshot, CombatPhase } from '@engine/CombatEngine.ts';
import type { AllocationResult } from '@/core/DiceAllocator.ts';
import type { Card, EnemyCard } from '@/types/card.types';
import type { CombatCalculation } from '@/types/combat.types.ts';
import type { DiceModifier } from '@/types/diceModifier.types';
import { CardSprite, CARD_WIDTH, CARD_HEIGHT_COMPACT } from '@/sprites/CardSprite.ts';
import { DiceSprite, DICE_SIZE } from '@/sprites/DiceSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

export interface CombatData {
  playerCard: Card;
  enemyCard: EnemyCard;
  combatNumber: number;
  eventAtkBonus: number;
  eventDefBonus: number;
  diceModifiers?: DiceModifier[];
}

// ─── Allocation Panel ────────────────────────────────────────────────
// Lets the player assign their 2 rolled dice to ATK and DEF slots.
// Supports click-to-assign, drag-drop, and keyboard/gamepad navigation.

const SLOT_SIZE = DICE_SIZE + 16;

class AllocationPanel extends Container {
  // Pool dice (the 2 rolled values)
  private die0: DiceSprite;
  private die1: DiceSprite;
  private diceValues: [number, number] = [1, 1];

  // Slot backgrounds
  private atkSlotBg = new Graphics();
  private defSlotBg = new Graphics();
  private atkLabel: Text;
  private defLabel: Text;

  // Preview text
  private previewDealText: Text;
  private previewTakeText: Text;

  // Confirm button
  confirmBtn: ButtonSprite;

  // State: which die index (0 or 1) is in each slot, or null
  private _atkDieIdx: number | null = null;
  private _defDieIdx: number | null = null;

  // Positions for layout (set externally)
  private poolPositions: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: 0, y: 0 }, { x: 0, y: 0 },
  ];
  private atkSlotPos = { x: 0, y: 0 };
  private defSlotPos = { x: 0, y: 0 };

  // Drag state
  private draggingDie: DiceSprite | null = null;
  private draggingIdx: number | null = null;
  private dragOffset = { x: 0, y: 0 };

  // Callback for preview updates
  onAllocationChanged: ((allocation: AllocationResult | null) => void) | null = null;
  onConfirm: ((allocation: AllocationResult) => void) | null = null;

  constructor() {
    super();

    // ATK slot
    this.addChild(this.atkSlotBg);
    this.atkLabel = new Text({
      text: 'ATK',
      style: { fontFamily: fonts.heading, fontSize: fonts.sizes.body, fontWeight: 'bold', fill: colors.playerAccent },
    });
    this.atkLabel.anchor.set(0.5, 0);
    this.addChild(this.atkLabel);

    // DEF slot
    this.addChild(this.defSlotBg);
    this.defLabel = new Text({
      text: 'DEF',
      style: { fontFamily: fonts.heading, fontSize: fonts.sizes.body, fontWeight: 'bold', fill: colors.focus },
    });
    this.defLabel.anchor.set(0.5, 0);
    this.addChild(this.defLabel);

    // Dice (player-colored)
    this.die0 = new DiceSprite(true);
    this.die0.eventMode = 'static';
    this.die0.cursor = 'grab';
    this.addChild(this.die0);

    this.die1 = new DiceSprite(true);
    this.die1.eventMode = 'static';
    this.die1.cursor = 'grab';
    this.addChild(this.die1);

    // Drag events
    this.die0.on('pointerdown', (e) => this.startDrag(0, e));
    this.die1.on('pointerdown', (e) => this.startDrag(1, e));

    // Slot click (unassign)
    this.atkSlotBg.eventMode = 'static';
    this.atkSlotBg.cursor = 'pointer';
    this.atkSlotBg.on('pointerdown', () => this.unassignSlot('atk'));

    this.defSlotBg.eventMode = 'static';
    this.defSlotBg.cursor = 'pointer';
    this.defSlotBg.on('pointerdown', () => this.unassignSlot('def'));

    // Stage-level drag tracking
    this.eventMode = 'static';
    this.on('pointermove', this.onDragMove, this);
    this.on('pointerup', this.onDragEnd, this);
    this.on('pointerupoutside', this.onDragEnd, this);

    // Preview text
    this.previewDealText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.heal },
    });
    this.previewDealText.anchor.set(0.5, 0);
    this.addChild(this.previewDealText);

    this.previewTakeText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.damage },
    });
    this.previewTakeText.anchor.set(0.5, 0);
    this.addChild(this.previewTakeText);

    // Confirm button
    this.confirmBtn = new ButtonSprite('Confirm', { width: 140 });
    this.confirmBtn.onPress = () => this.handleConfirm();
    this.confirmBtn.setEnabled(false);
    this.addChild(this.confirmBtn);
  }

  // --- Public API ---

  /** Set the dice values and reset allocation state. */
  setDice(values: [number, number]): void {
    this.diceValues = values;
    this._atkDieIdx = null;
    this._defDieIdx = null;

    this.die0.setValue(values[0]);
    this.die1.setValue(values[1]);

    this.confirmBtn.setEnabled(false);
    this.clearPreview();
    this.syncPositions();
  }

  /** Start roll animation for both dice. */
  rollDice(values: [number, number]): void {
    this.diceValues = values;
    this._atkDieIdx = null;
    this._defDieIdx = null;

    this.die0.roll(values[0]);
    this.die1.roll(values[1]);

    this.confirmBtn.setEnabled(false);
    this.clearPreview();
  }

  /** Get current allocation, or null if incomplete. */
  getAllocation(): AllocationResult | null {
    if (this._atkDieIdx === null || this._defDieIdx === null) return null;
    return {
      atkDie: this.diceValues[this._atkDieIdx],
      defDie: this.diceValues[this._defDieIdx],
    };
  }

  /** Update damage preview text. */
  showPreview(calc: CombatCalculation): void {
    this.previewDealText.text = `Deal ~${calc.damageToEnemy} dmg`;
    this.previewTakeText.text = `Take ~${calc.damageToPlayer} dmg`;
  }

  clearPreview(): void {
    this.previewDealText.text = '';
    this.previewTakeText.text = '';
  }

  /** Assign die by index to the first available slot. Called by keyboard/gamepad. */
  assignDieToNextSlot(dieIdx: number): void {
    // Already assigned?
    if (this._atkDieIdx === dieIdx || this._defDieIdx === dieIdx) return;

    if (this._atkDieIdx === null) {
      this._atkDieIdx = dieIdx;
    } else if (this._defDieIdx === null) {
      this._defDieIdx = dieIdx;
    }
    this.syncPositions();
    this.notifyAllocationChanged();
  }

  /** Assign die directly to a specific slot. */
  assignDieToSlot(dieIdx: number, slot: 'atk' | 'def'): void {
    // If this die is already in the other slot, remove it
    if (slot === 'atk' && this._defDieIdx === dieIdx) this._defDieIdx = null;
    if (slot === 'def' && this._atkDieIdx === dieIdx) this._atkDieIdx = null;

    // If the target slot already has a different die, swap it back to pool
    if (slot === 'atk') {
      if (this._atkDieIdx !== null && this._atkDieIdx !== dieIdx) {
        // Existing die in ATK goes to pool (or swap to DEF if DEF is empty)
        if (this._defDieIdx === null) {
          this._defDieIdx = this._atkDieIdx;
        }
      }
      this._atkDieIdx = dieIdx;
    } else {
      if (this._defDieIdx !== null && this._defDieIdx !== dieIdx) {
        if (this._atkDieIdx === null) {
          this._atkDieIdx = this._defDieIdx;
        }
      }
      this._defDieIdx = dieIdx;
    }

    this.syncPositions();
    this.notifyAllocationChanged();
  }

  /** Unassign a slot, returning the die to pool. */
  unassignSlot(slot: 'atk' | 'def'): void {
    if (slot === 'atk') this._atkDieIdx = null;
    else this._defDieIdx = null;
    this.syncPositions();
    this.notifyAllocationChanged();
  }

  /** Reset allocations. */
  resetAllocation(): void {
    this._atkDieIdx = null;
    this._defDieIdx = null;
    this.confirmBtn.setEnabled(false);
    this.clearPreview();
    this.syncPositions();
  }

  // --- Layout (called externally when screen resizes) ---

  layoutAt(centerX: number, topY: number, scale: number, slotsTopY?: number): void {
    const gap = spacing.lg;
    const slotGap = slotsTopY !== undefined ? spacing.lg : spacing.xl * 2;
    const dieScaled = DICE_SIZE * scale;
    const slotScaled = SLOT_SIZE * scale;

    // Pool: 2 dice side by side above slots
    const poolTotalW = dieScaled * 2 + gap;
    this.poolPositions[0] = { x: centerX - poolTotalW / 2, y: topY };
    this.poolPositions[1] = { x: centerX - poolTotalW / 2 + dieScaled + gap, y: topY };

    // Slots below pool (or at explicit Y when provided)
    const slotY = slotsTopY ?? (topY + dieScaled + gap + 20 * scale);
    const slotsTotalW = slotScaled * 2 + slotGap;
    this.atkSlotPos = { x: centerX - slotsTotalW / 2, y: slotY };
    this.defSlotPos = { x: centerX - slotsTotalW / 2 + slotScaled + slotGap, y: slotY };

    // Scale dice
    this.die0.scale.set(scale);
    this.die1.scale.set(scale);

    // Draw slot backgrounds
    this.drawSlot(this.atkSlotBg, this.atkSlotPos.x, this.atkSlotPos.y, slotScaled, this._atkDieIdx !== null);
    this.drawSlot(this.defSlotBg, this.defSlotPos.x, this.defSlotPos.y, slotScaled, this._defDieIdx !== null);

    // Slot labels above
    this.atkLabel.style.fontSize = Math.max(16, fonts.sizes.body * scale);
    this.defLabel.style.fontSize = Math.max(16, fonts.sizes.body * scale);
    this.atkLabel.position.set(this.atkSlotPos.x + slotScaled / 2, this.atkSlotPos.y - 22 * scale);
    this.defLabel.position.set(this.defSlotPos.x + slotScaled / 2, this.defSlotPos.y - 22 * scale);

    // Preview text below slots
    const previewY = slotY + slotScaled + spacing.sm;
    this.previewDealText.style.fontSize = Math.max(16, fonts.sizes.small * scale);
    this.previewTakeText.style.fontSize = Math.max(16, fonts.sizes.small * scale);
    this.previewDealText.position.set(centerX, previewY);
    this.previewTakeText.position.set(centerX, previewY + 16 * scale);

    // Confirm button below preview
    this.confirmBtn.position.set(
      centerX - this.confirmBtn.buttonWidth / 2,
      previewY + 36 * scale,
    );

    this.syncPositions();
  }

  get panelHeight(): number { return DICE_SIZE + spacing.lg + 20 + SLOT_SIZE + spacing.sm + 16 + 36 + 44; }

  // --- Internals ---

  private syncPositions(): void {
    const die = (idx: number) => idx === 0 ? this.die0 : this.die1;

    // Position dice: either in pool or in slot
    for (let i = 0; i < 2; i++) {
      const d = die(i);
      if (this._atkDieIdx === i) {
        // Center die in ATK slot
        const slotScaled = SLOT_SIZE * d.scale.x;
        const dieScaled = DICE_SIZE * d.scale.x;
        d.position.set(
          this.atkSlotPos.x + (slotScaled - dieScaled) / 2,
          this.atkSlotPos.y + (slotScaled - dieScaled) / 2,
        );
      } else if (this._defDieIdx === i) {
        const slotScaled = SLOT_SIZE * d.scale.x;
        const dieScaled = DICE_SIZE * d.scale.x;
        d.position.set(
          this.defSlotPos.x + (slotScaled - dieScaled) / 2,
          this.defSlotPos.y + (slotScaled - dieScaled) / 2,
        );
      } else {
        // In pool
        d.position.set(this.poolPositions[i].x, this.poolPositions[i].y);
      }
    }

    this.confirmBtn.setEnabled(this._atkDieIdx !== null && this._defDieIdx !== null);
  }

  private drawSlot(gfx: Graphics, x: number, y: number, size: number, filled: boolean): void {
    gfx.clear();
    gfx.position.set(x, y);
    gfx.rect(0, 0, size, size);
    gfx.fill({ color: filled ? colors.overlayBg : colors.containerBg, alpha: filled ? 0.8 : 0.5 });
    gfx.rect(0, 0, size, size);
    gfx.stroke({ color: filled ? colors.focus : colors.text, width: 2, alpha: filled ? 1 : 0.3 });
    // Store the actual rendered size for hit-testing
    gfx.hitArea = { contains: (px: number, py: number) => px >= 0 && py >= 0 && px <= size && py <= size };
  }

  private notifyAllocationChanged(): void {
    const alloc = this.getAllocation();
    this.onAllocationChanged?.(alloc);

    // Redraw slot borders
    const s = this.die0.scale.x;
    const slotScaled = SLOT_SIZE * s;
    this.drawSlot(this.atkSlotBg, this.atkSlotPos.x, this.atkSlotPos.y, slotScaled, this._atkDieIdx !== null);
    this.drawSlot(this.defSlotBg, this.defSlotPos.x, this.defSlotPos.y, slotScaled, this._defDieIdx !== null);
  }

  private handleConfirm(): void {
    const alloc = this.getAllocation();
    if (alloc) this.onConfirm?.(alloc);
  }

  // --- Drag & Drop ---

  private startDrag(idx: number, e: { global: { x: number; y: number } }): void {
    // If die is in a slot and user clicks it, remove from slot first
    if (this._atkDieIdx === idx) {
      this._atkDieIdx = null;
      this.notifyAllocationChanged();
    } else if (this._defDieIdx === idx) {
      this._defDieIdx = null;
      this.notifyAllocationChanged();
    }

    // If not being dragged, try click-to-assign
    const d = idx === 0 ? this.die0 : this.die1;
    this.draggingDie = d;
    this.draggingIdx = idx;

    const localPos = this.toLocal(e.global);
    this.dragOffset.x = localPos.x - d.position.x;
    this.dragOffset.y = localPos.y - d.position.y;

    d.cursor = 'grabbing';
    d.alpha = 0.8;

    // Bring to front
    this.setChildIndex(d, this.children.length - 1);
  }

  private onDragMove(e: { global: { x: number; y: number } }): void {
    if (!this.draggingDie) return;
    const localPos = this.toLocal(e.global);
    this.draggingDie.position.set(
      localPos.x - this.dragOffset.x,
      localPos.y - this.dragOffset.y,
    );
  }

  private onDragEnd(e: { global: { x: number; y: number } }): void {
    if (!this.draggingDie || this.draggingIdx === null) return;

    const d = this.draggingDie;
    const idx = this.draggingIdx;
    d.cursor = 'grab';
    d.alpha = 1;

    // Check if dropped on a slot
    const localPos = this.toLocal(e.global);
    const s = d.scale.x;
    const slotScaled = SLOT_SIZE * s;

    const inAtk = localPos.x >= this.atkSlotPos.x && localPos.x <= this.atkSlotPos.x + slotScaled
      && localPos.y >= this.atkSlotPos.y && localPos.y <= this.atkSlotPos.y + slotScaled;
    const inDef = localPos.x >= this.defSlotPos.x && localPos.x <= this.defSlotPos.x + slotScaled
      && localPos.y >= this.defSlotPos.y && localPos.y <= this.defSlotPos.y + slotScaled;

    if (inAtk) {
      this.assignDieToSlot(idx, 'atk');
    } else if (inDef) {
      this.assignDieToSlot(idx, 'def');
    } else {
      // Not dropped on a slot — try click-to-assign (first empty)
      this.assignDieToNextSlot(idx);
    }

    this.draggingDie = null;
    this.draggingIdx = null;
  }
}

// ─── Enemy Dice Display ──────────────────────────────────────────────

class EnemyDicePanel extends Container {
  private atkDice: DiceSprite;
  private defDice: DiceSprite;
  private atkLabel: Text;
  private defLabel: Text;

  constructor() {
    super();

    const labelStyle = { fontFamily: fonts.heading, fontSize: fonts.sizes.body, fontWeight: 'bold' as const, fill: colors.enemyAccent };

    this.atkLabel = new Text({ text: 'ATK', style: labelStyle });
    this.atkLabel.anchor.set(0.5, 0);
    this.addChild(this.atkLabel);

    this.atkDice = new DiceSprite(false);
    this.addChild(this.atkDice);

    this.defLabel = new Text({ text: 'DEF', style: labelStyle });
    this.defLabel.anchor.set(0.5, 0);
    this.addChild(this.defLabel);

    this.defDice = new DiceSprite(false);
    this.addChild(this.defDice);
  }

  rollDice(dice: [number, number]): void {
    this.atkDice.roll(dice[0]);
    this.defDice.roll(dice[1]);
  }

  showAllocation(alloc: AllocationResult): void {
    this.atkDice.setValue(alloc.atkDie);
    this.defDice.setValue(alloc.defDie);
  }

  layoutAt(centerX: number, y: number, scale: number): void {
    const gap = spacing.md;
    const dieScaled = DICE_SIZE * scale;
    const totalW = dieScaled * 2 + gap;
    const startX = centerX - totalW / 2;

    this.atkDice.scale.set(scale);
    this.defDice.scale.set(scale);

    this.atkLabel.style.fontSize = Math.max(16, fonts.sizes.body * scale);
    this.defLabel.style.fontSize = Math.max(16, fonts.sizes.body * scale);

    const labelOffset = Math.max(20, 18 * scale);
    this.atkLabel.position.set(startX + dieScaled / 2, y);
    this.atkDice.position.set(startX, y + labelOffset);

    this.defLabel.position.set(startX + dieScaled + gap + dieScaled / 2, y);
    this.defDice.position.set(startX + dieScaled + gap, y + labelOffset);
  }
}

// ─── Results text panel ──────────────────────────────────────────────

class ResultsPanel extends Container {
  private playerDmgText: Text;
  private enemyDmgText: Text;
  private finishText: Text;

  constructor() {
    super();

    this.playerDmgText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.damage },
    });
    this.playerDmgText.anchor.set(0.5, 0);
    this.addChild(this.playerDmgText);

    this.enemyDmgText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.heal },
    });
    this.enemyDmgText.anchor.set(0.5, 0);
    this.addChild(this.enemyDmgText);

    this.finishText = new Text({
      text: '',
      style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h3, fontWeight: 'bold', fill: colors.focus },
    });
    this.finishText.anchor.set(0.5, 0);
    this.addChild(this.finishText);
  }

  layoutAt(centerX: number, startY: number, scale = 1): void {
    const lineGap = 24 * scale;
    const finishGap = 40 * scale;
    this.playerDmgText.style.fontSize = Math.max(16, fonts.sizes.body * scale);
    this.enemyDmgText.style.fontSize = Math.max(16, fonts.sizes.body * scale);
    this.finishText.style.fontSize = Math.max(16, fonts.sizes.h3 * scale);
    this.playerDmgText.position.set(centerX, startY);
    this.enemyDmgText.position.set(centerX, startY + lineGap);
    this.finishText.position.set(centerX, startY + lineGap + finishGap);
  }

  update(combatResult: CombatCalculation, finished: boolean, enemyHp: number): void {
    this.playerDmgText.text = combatResult.damageToPlayer > 0
      ? `You take -${combatResult.damageToPlayer} HP`
      : 'You take no damage';
    this.playerDmgText.style.fill = combatResult.damageToPlayer > 0 ? colors.damage : colors.heal;

    this.enemyDmgText.text = combatResult.damageToEnemy > 0
      ? `Enemy takes -${combatResult.damageToEnemy} HP`
      : 'Enemy blocked';
    this.enemyDmgText.style.fill = combatResult.damageToEnemy > 0 ? colors.heal : colors.damage;

    if (finished) {
      const won = enemyHp <= 0;
      this.finishText.text = won ? 'VICTORY!' : 'DEFEAT...';
      this.finishText.style.fill = won ? colors.focus : colors.damage;
    } else {
      this.finishText.text = '';
    }
  }

  clear(): void {
    this.playerDmgText.text = '';
    this.enemyDmgText.text = '';
    this.finishText.text = '';
  }
}

// ─── Main combat scene ──────────────────────────────────────────────

export function createCombatScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'combat';

  let engine: CombatEngine | null = null;
  let engineUnsub: (() => void) | null = null;
  let sw = 800, sh = 600;

  // Header
  const headerText = new Text({
    text: '',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h3, fontWeight: 'bold', fill: colors.text },
  });
  headerText.anchor.set(0.5, 0);
  root.addChild(headerText);

  // Status text
  const statusText = new Text({
    text: '',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.focus },
  });
  statusText.anchor.set(0.5, 0);
  root.addChild(statusText);

  // Bonus HUD — shows active event bonuses
  const bonusHud = new Text({
    text: '',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.text },
  });
  bonusHud.anchor.set(0.5, 0);
  bonusHud.alpha = 0.7;
  root.addChild(bonusHud);

  // Enemy card (top)
  let enemySprite: CardSprite | null = null;

  // Player card (bottom)
  let playerSprite: CardSprite | null = null;

  // VS label
  const vsText = new Text({
    text: 'VS',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h1, fontWeight: 'bold', fill: colors.focus },
  });
  vsText.anchor.set(0.5);
  root.addChild(vsText);

  // Enemy dice display
  const enemyDicePanel = new EnemyDicePanel();
  root.addChild(enemyDicePanel);

  // Allocation panel (replaces old DicePanel)
  const allocPanel = new AllocationPanel();
  root.addChild(allocPanel);

  // Results panel
  const resultsPanel = new ResultsPanel();
  resultsPanel.visible = false;
  root.addChild(resultsPanel);

  // "Next Round" button
  const nextRoundBtn = new ButtonSprite('Next Round', { width: 160 });
  nextRoundBtn.visible = false;
  nextRoundBtn.onPress = () => {
    if (engine && currentPhase === 'results') {
      engine.handleNextRound();
    }
  };
  root.addChild(nextRoundBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- State ---
  let currentPhase: CombatPhase = 'rolling';
  let combatNumber = 0;

  function buildBonusHud(d: CombatData): void {
    const parts: string[] = [];
    if (d.eventAtkBonus) parts.push(`ATK +${d.eventAtkBonus}`);
    if (d.eventDefBonus) parts.push(`DEF +${d.eventDefBonus}`);
    if (d.diceModifiers && d.diceModifiers.length > 0) {
      parts.push(`Dice: ${d.diceModifiers.map(m => m.name).join(', ')}`);
    }
    bonusHud.text = parts.length > 0 ? parts.join('  |  ') : '';
  }

  // --- Wire allocation callbacks ---

  allocPanel.onAllocationChanged = (alloc) => {
    if (!engine || currentPhase !== 'allocating') return;
    if (alloc) {
      const preview = engine.previewAllocation(alloc);
      allocPanel.showPreview(preview);
    } else {
      allocPanel.clearPreview();
    }
    registerAllocatingFocusables();
  };

  allocPanel.onConfirm = (alloc) => {
    if (!engine || currentPhase !== 'allocating') return;
    engine.submitAllocation(alloc);
  };

  // --- Combat update handler ---

  function onCombatUpdate(snap: CombatSnapshot) {
    currentPhase = snap.phase;

    // Update header
    headerText.text = `Combat #${combatNumber} — Round ${snap.roundNumber}`;

    // Update card sprites
    enemySprite?.updateCard(snap.currentEnemyCard);
    playerSprite?.updateCard(snap.currentPlayerCard);

    switch (snap.phase) {
      case 'rolling':
        statusText.text = 'Dice rolling...';
        allocPanel.visible = true;
        allocPanel.rollDice(snap.playerDice);
        enemyDicePanel.visible = true;
        enemyDicePanel.rollDice(snap.enemyDice);
        resultsPanel.visible = false;
        resultsPanel.clear();
        nextRoundBtn.visible = false;
        input.unregisterAll();
        break;

      case 'allocating':
        statusText.text = 'Assign your dice!';
        allocPanel.visible = true;
        allocPanel.setDice(snap.playerDice);
        // Show enemy allocation
        enemyDicePanel.showAllocation(snap.enemyAllocation);
        resultsPanel.visible = false;
        nextRoundBtn.visible = false;
        registerAllocatingFocusables();
        break;

      case 'resolving':
        statusText.text = 'Applying damage...';
        allocPanel.visible = false;
        enemyDicePanel.visible = true;
        resultsPanel.visible = true;
        if (snap.combatResult) {
          resultsPanel.update(snap.combatResult, false, snap.currentEnemyCard.currentHp);
        }
        nextRoundBtn.visible = false;
        input.unregisterAll();
        break;

      case 'results':
        statusText.text = 'Click to continue';
        allocPanel.visible = false;
        resultsPanel.visible = true;
        if (snap.combatResult) {
          resultsPanel.update(snap.combatResult, false, snap.currentEnemyCard.currentHp);
        }
        nextRoundBtn.visible = true;
        registerNextRoundFocusable();
        break;

      case 'finished':
        statusText.text = '';
        allocPanel.visible = false;
        resultsPanel.visible = true;
        if (snap.combatResult) {
          resultsPanel.update(snap.combatResult, true, snap.currentEnemyCard.currentHp);
        }
        nextRoundBtn.visible = false;
        input.unregisterAll();
        break;
    }

    layout();
  }

  // --- Focus registration ---

  function registerAllocatingFocusables() {
    input.unregisterAll();

    // Die 0 in pool (only if not assigned)
    const alloc = allocPanel.getAllocation();
    const die0assigned = alloc !== null || allocPanel.getAllocation() !== null;
    // We need to check individually — use a simpler approach
    input.register({
      id: 'alloc-die-0',
      container: allocPanel,
      onActivate: () => allocPanel.assignDieToNextSlot(0),
      onNavigate: (dir) => {
        if (dir === 'right') { input.setFocus('alloc-die-1'); return true; }
        if (dir === 'down') { input.setFocus('alloc-slot-atk'); return true; }
        return false;
      },
    });

    input.register({
      id: 'alloc-die-1',
      container: allocPanel,
      onActivate: () => allocPanel.assignDieToNextSlot(1),
      onNavigate: (dir) => {
        if (dir === 'left') { input.setFocus('alloc-die-0'); return true; }
        if (dir === 'down') { input.setFocus('alloc-slot-def'); return true; }
        return false;
      },
    });

    input.register({
      id: 'alloc-slot-atk',
      container: allocPanel,
      onActivate: () => allocPanel.unassignSlot('atk'),
      onNavigate: (dir) => {
        if (dir === 'right') { input.setFocus('alloc-slot-def'); return true; }
        if (dir === 'up') { input.setFocus('alloc-die-0'); return true; }
        if (dir === 'down') { input.setFocus('alloc-confirm'); return true; }
        return false;
      },
    });

    input.register({
      id: 'alloc-slot-def',
      container: allocPanel,
      onActivate: () => allocPanel.unassignSlot('def'),
      onNavigate: (dir) => {
        if (dir === 'left') { input.setFocus('alloc-slot-atk'); return true; }
        if (dir === 'up') { input.setFocus('alloc-die-1'); return true; }
        if (dir === 'down') { input.setFocus('alloc-confirm'); return true; }
        return false;
      },
    });

    input.register({
      id: 'alloc-confirm',
      container: allocPanel.confirmBtn,
      disabled: allocPanel.getAllocation() === null,
      onActivate: () => {
        const a = allocPanel.getAllocation();
        if (a && engine) engine.submitAllocation(a);
      },
      onNavigate: (dir) => {
        if (dir === 'up') { input.setFocus('alloc-slot-atk'); return true; }
        return false;
      },
    });

    // Suppress unused warning
    void die0assigned;
  }

  function registerNextRoundFocusable() {
    input.unregisterAll();
    input.register({
      id: 'combat-next-round',
      container: nextRoundBtn,
      onActivate: () => {
        if (engine && currentPhase === 'results') {
          engine.handleNextRound();
        }
      },
    });
  }

  // --- Layout ---

  function layout() {
    const rl = getLayout(sw, sh);
    const centerX = sw / 2;

    // All text: minimum 16px
    headerText.style.fontSize = Math.max(16, rl.fontSize.h3);
    statusText.style.fontSize = Math.max(16, rl.fontSize.body);
    vsText.style.fontSize = Math.max(16, rl.fontSize.h1);

    // Combat title
    headerText.position.set(centerX, sh * 0.03);

    // Bonus HUD font size
    bonusHud.style.fontSize = Math.max(14, rl.fontSize.small);

    if (rl.isMobile) {
      // Mobile: compact cards, enemy dice below card, no VS text
      const mobileCardScale = Math.min(1.2, (sw * 0.5) / CARD_WIDTH);
      if (enemySprite) { enemySprite.scale.set(mobileCardScale); enemySprite.setCompact(true); }
      if (playerSprite) { playerSprite.scale.set(mobileCardScale); playerSprite.setCompact(true); }
      const mCardW = CARD_WIDTH * mobileCardScale;
      const mCardH = CARD_HEIGHT_COMPACT * mobileCardScale;

      // Same dice scale for enemy and player
      const mobileDiceScale = Math.max(44, sw * 0.12) / DICE_SIZE;
      const dieScaled = DICE_SIZE * mobileDiceScale;
      const labelOffset = Math.max(20, 18 * mobileDiceScale);

      // Hide VS on mobile
      vsText.visible = false;

      // --- Compute vertical positions top-down ---
      const gap = spacing.sm;
      let y = sh * 0.02;

      // Title
      headerText.position.set(centerX, y);
      y += Math.max(16, rl.fontSize.h3) + gap;

      // Bonus HUD below title (only takes space if there's text)
      bonusHud.position.set(centerX, y);
      if (bonusHud.text) y += Math.max(14, rl.fontSize.small) + spacing.xs;

      // Enemy card centered
      if (enemySprite) {
        enemySprite.position.set(centerX - mCardW / 2, y);
      }
      y += mCardH + gap;

      // Enemy dice — centered below enemy card, same scale as player
      enemyDicePanel.layoutAt(centerX, y, mobileDiceScale);
      y += labelOffset + dieScaled + gap;

      // Player card
      if (playerSprite) {
        playerSprite.position.set(centerX - mCardW / 2, y);
      }
      y += mCardH + gap;

      // Status text ("Assign your dice!")
      statusText.position.set(centerX, y);
      y += Math.max(16, rl.fontSize.body) + gap;

      // Allocation panel: dice pool, then slots below
      const slotsY = y + dieScaled + gap;
      allocPanel.layoutAt(centerX, y, mobileDiceScale, slotsY);

      // Confirm button near bottom (above safe area)
      const confirmY = sh * 0.82;
      allocPanel.confirmBtn.position.set(
        centerX - allocPanel.confirmBtn.buttonWidth / 2,
        confirmY,
      );

      // Results panel (same area as alloc panel when visible)
      resultsPanel.position.set(0, 0);
      resultsPanel.layoutAt(centerX, y, mobileDiceScale);

      // Next round button
      nextRoundBtn.position.set(centerX - nextRoundBtn.buttonWidth / 2, confirmY);
    } else {
      // Desktop layout — full cards, dice panels to sides
      if (enemySprite) { enemySprite.scale.set(rl.cardScale); enemySprite.setCompact(false); }
      if (playerSprite) { playerSprite.scale.set(rl.cardScale); playerSprite.setCompact(false); }
      vsText.visible = true;
      vsText.alpha = 1;

      // Bonus HUD below header
      bonusHud.position.set(centerX, sh * 0.03 + Math.max(16, rl.fontSize.h3) + spacing.xs);

      const cardAreaTop = sh * 0.08;
      const cardAreaBottom = sh - rl.cardH - sh * 0.05;
      const midY = (cardAreaTop + rl.cardH + cardAreaBottom) / 2;

      if (enemySprite) {
        enemySprite.position.set(centerX - rl.cardW / 2, cardAreaTop);
      }

      if (playerSprite) {
        playerSprite.position.set(centerX - rl.cardW / 2, cardAreaBottom);
      }

      vsText.position.set(centerX, midY);

      // Enemy dice panel — to the right of center, above mid
      const enemyDiceX = centerX + rl.cardW / 2 + spacing.xl;
      enemyDicePanel.layoutAt(Math.min(sw - 120, enemyDiceX + 60), cardAreaTop + 20, rl.diceScale * 0.8);

      // Allocation panel — to the left of center
      const allocX = centerX - rl.cardW / 2 - spacing.xl;
      allocPanel.layoutAt(Math.max(120, allocX - 60), midY - 80, rl.diceScale * 0.9);

      // Results panel — to the right of center
      const resultsX = centerX + spacing.xl;
      resultsPanel.position.set(0, 0);
      resultsPanel.layoutAt(Math.min(sw - spacing.md, resultsX + 80), midY - 40, rl.fontScale);

      // Status text below VS
      statusText.position.set(centerX, midY + rl.fontSize.h1 * 0.6);

      // Next round button below status
      nextRoundBtn.position.set(centerX - nextRoundBtn.buttonWidth / 2, midY + rl.fontSize.h1 * 0.6 + rl.fontSize.body + spacing.sm);
    }
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    const d = data as CombatData | undefined;
    if (!d) return;

    combatNumber = d.combatNumber;
    currentPhase = 'rolling';

    headerText.text = `Combat #${combatNumber}`;
    buildBonusHud(d);
    statusText.text = 'Dice rolling...';
    allocPanel.visible = true;
    allocPanel.resetAllocation();
    enemyDicePanel.visible = true;
    resultsPanel.visible = false;
    resultsPanel.clear();
    nextRoundBtn.visible = false;

    // Enemy card
    if (enemySprite) {
      root.removeChild(enemySprite);
      enemySprite.destroy();
    }
    enemySprite = new CardSprite(d.enemyCard);
    root.addChildAt(enemySprite, 0);

    // Player card
    if (playerSprite) {
      root.removeChild(playerSprite);
      playerSprite.destroy();
    }
    playerSprite = new CardSprite(d.playerCard);
    root.addChildAt(playerSprite, 1);

    // Start combat engine
    engine = new CombatEngine({
      playerCard: d.playerCard,
      enemyCard: d.enemyCard,
      eventAtkBonus: d.eventAtkBonus,
      eventDefBonus: d.eventDefBonus,
      diceModifiers: d.diceModifiers,
      onCombatEnd: (result) => game.handleCombatEnd(result),
      onCardUpdate: (p, e) => game.handleCardUpdate(p, e),
    });

    engineUnsub = engine.onChange(onCombatUpdate);

    // Initial roll animation
    const snap = engine.snapshot();
    allocPanel.rollDice(snap.playerDice);
    enemyDicePanel.rollDice(snap.enemyDice);

    input.unregisterAll();
    root.addChild(input.focusIndicator);
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
    engineUnsub?.();
    engineUnsub = null;
    engine?.destroy();
    engine = null;
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
