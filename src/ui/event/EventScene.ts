/**
 * V6 event scene — loot/heal screen between combats.
 *
 * Mobile-first layout (390×844 reference):
 *   Narrative text (flavor, 1-2 sentences)
 *   Loot cards (2-3 side by side, stacked on narrow screens)
 *   "Repair +2 HP" heal button as alternative
 *   Current loadout preview at bottom
 *
 * Equipment choice is permanent. No swap/sell.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../../engine/SceneManager';
import type { Equipment, Survivor } from '../../engine/types';
import { LootCard, CARD_W } from './LootCard';
import {
  generateLootOptions,
  pickNarrative,
  applyHealChoice,
  HEAL_AMOUNT,
} from './EventManager';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PADDING = 16;
const SECTION_GAP = 14;
const HEAL_BTN_W = 200;
const HEAL_BTN_H = 48;
const CONFIRM_BTN_W = 180;
const CONFIRM_BTN_H = 48;
const NARROW_BREAKPOINT = 400;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface EventSceneData {
  survivor: Survivor;
  playerHp: number;
  playerMaxHp: number;
  playerEquipment: readonly Equipment[];
  combatNumber: number;
  /** Called when event is resolved. */
  onEventEnd: (
    updatedEquipment: readonly Equipment[],
    updatedHp: number,
  ) => void;
}

// ---------------------------------------------------------------------------
// EventScene
// ---------------------------------------------------------------------------

export class EventScene extends Container implements Scene {
  // --- Layout containers ---
  private _narrativeText: Text;
  private _cardsContainer = new Container();
  private _healBtn = new Container();
  private _healBtnBg = new Graphics();
  private _healBtnText: Text;
  private _confirmBtn = new Container();
  private _confirmBtnBg = new Graphics();
  private _confirmBtnText: Text;
  private _loadoutContainer = new Container();
  private _loadoutTitle: Text;

  // --- State ---
  private _data: EventSceneData | null = null;
  private _lootCards: LootCard[] = [];
  private _selectedIndex = -1; // -1 = heal, 0+ = loot card index
  private _lootOptions: Equipment[] = [];
  private _sw = 390;

  constructor() {
    super();

    // Narrative text
    this._narrativeText = new Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace',
        fontSize: 13,
        fill: BONE,
        fontStyle: 'italic',
        wordWrap: true,
        wordWrapWidth: 358,
        lineHeight: 20,
      },
    });
    this.addChild(this._narrativeText);

    // Cards container
    this.addChild(this._cardsContainer);

    // Heal button
    this._healBtnText = this._makeText(
      `REPARER +${HEAL_AMOUNT} PV`, 14, BONE, true,
    );
    this._healBtnText.anchor.set(0.5);
    this._healBtn.addChild(this._healBtnBg, this._healBtnText);
    this._healBtn.eventMode = 'static';
    this._healBtn.cursor = 'pointer';
    this._healBtn.on('pointerdown', () => this._selectHeal());
    this._healBtn.on('pointerover', () => {
      if (this._selectedIndex !== -1) this._healBtn.alpha = 0.85;
    });
    this._healBtn.on('pointerout', () => {
      this._healBtn.alpha = 1;
    });
    this.addChild(this._healBtn);

    // Confirm button
    this._confirmBtnText = this._makeText('CONFIRMER', 15, BONE, true);
    this._confirmBtnText.anchor.set(0.5);
    this._confirmBtn.addChild(this._confirmBtnBg, this._confirmBtnText);
    this._confirmBtn.eventMode = 'static';
    this._confirmBtn.cursor = 'pointer';
    this._confirmBtn.on('pointerdown', () => this._handleConfirm());
    this.addChild(this._confirmBtn);

    // Loadout preview
    this._loadoutTitle = this._makeText('Equipement actuel', 12, BONE, true);
    this._loadoutContainer.addChild(this._loadoutTitle);
    this.addChild(this._loadoutContainer);
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as EventSceneData;
    this._data = d;
    this._selectedIndex = -1;

    this._narrativeText.text = pickNarrative();

    // Generate loot
    this._lootOptions = generateLootOptions(
      d.playerEquipment, d.combatNumber,
    );
    this._buildLootCards(d);
    this._buildLoadoutPreview(d);
    this._drawHealButton();
    this._drawConfirmButton();
    this._layout();

    // Default to heal selected
    this._selectHeal();
  }

  onExit(): void {
    this._clearLootCards();
    this._data = null;
  }

  onResize(width: number, _height: number): void {
    this._sw = width;
    this._narrativeText.style.wordWrapWidth = width - PADDING * 2;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  private _layout(): void {
    const w = this._sw;
    const cx = w / 2;
    const narrow = w < NARROW_BREAKPOINT;
    let y = PADDING;

    // Narrative
    this._narrativeText.position.set(PADDING, y);
    y += this._narrativeText.height + SECTION_GAP + 4;

    // Loot cards
    this._cardsContainer.position.set(0, y);
    if (narrow) {
      y += this._layoutCardsStacked(y);
    } else {
      y += this._layoutCardsSideBySide(y);
    }
    y += SECTION_GAP;

    // Heal button
    this._healBtn.position.set(cx - HEAL_BTN_W / 2, y);
    this._healBtnText.position.set(HEAL_BTN_W / 2, HEAL_BTN_H / 2);
    y += HEAL_BTN_H + SECTION_GAP;

    // Confirm button
    this._confirmBtn.position.set(cx - CONFIRM_BTN_W / 2, y);
    this._confirmBtnText.position.set(
      CONFIRM_BTN_W / 2, CONFIRM_BTN_H / 2,
    );
    y += CONFIRM_BTN_H + SECTION_GAP;

    // Loadout preview
    this._loadoutContainer.position.set(PADDING, y);
  }

  /** Returns total height consumed by cards. */
  private _layoutCardsSideBySide(y: number): number {
    const count = this._lootCards.length;
    if (count === 0) return 0;
    const gap = 10;
    const totalW = count * CARD_W + (count - 1) * gap;
    let x = (this._sw - totalW) / 2;
    let maxH = 0;
    for (const card of this._lootCards) {
      card.position.set(x, y);
      x += CARD_W + gap;
      if (card.cardHeight > maxH) maxH = card.cardHeight;
    }
    return maxH;
  }

  /** Returns total height consumed by stacked cards. */
  private _layoutCardsStacked(startY: number): number {
    const cx = this._sw / 2;
    const gap = 6;
    let y = startY;
    for (const card of this._lootCards) {
      card.position.set(cx - CARD_W / 2, y);
      y += card.cardHeight + gap;
    }
    return y - startY;
  }

  // -----------------------------------------------------------------------
  // Card building
  // -----------------------------------------------------------------------

  private _buildLootCards(d: EventSceneData): void {
    this._clearLootCards();
    const slotCount = d.playerEquipment.length;

    for (let i = 0; i < this._lootOptions.length; i++) {
      const card = new LootCard(this._lootOptions[i], slotCount);
      card.onSelect = () => this._selectLoot(i);
      this._lootCards.push(card);
      this.addChild(card);
    }
  }

  private _clearLootCards(): void {
    for (const c of this._lootCards) c.destroy({ children: true });
    this._lootCards = [];
  }

  // -----------------------------------------------------------------------
  // Loadout preview
  // -----------------------------------------------------------------------

  private _buildLoadoutPreview(d: EventSceneData): void {
    // Clear old children except title
    while (this._loadoutContainer.children.length > 1) {
      this._loadoutContainer.removeChildAt(1);
    }

    const availW = this._sw - PADDING * 2;
    let y = 20;

    for (const eq of d.playerEquipment) {
      const tag = eq.type === 'weapon' ? 'ATK'
        : eq.type === 'shield' ? 'DEF' : 'UTL';
      const color = eq.type === 'weapon' ? RUST
        : eq.type === 'shield' ? MOSS : BONE;
      const line = new Text({
        text: `${tag} ${eq.name} [${eq.minDie}-${eq.maxDie}] -> ${eq.description}`,
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 11,
          fill: color,
          wordWrap: true,
          wordWrapWidth: availW,
        },
      });
      line.position.set(0, y);
      this._loadoutContainer.addChild(line);
      y += 16;
    }
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  private _selectLoot(index: number): void {
    this._selectedIndex = index;
    this._updateSelection();
  }

  private _selectHeal(): void {
    this._selectedIndex = -1;
    this._updateSelection();
  }

  private _updateSelection(): void {
    // Update loot card visuals
    for (let i = 0; i < this._lootCards.length; i++) {
      this._lootCards[i].setSelected(i === this._selectedIndex);
    }

    // Update heal button visual
    this._drawHealButton();

    // Update confirm button
    this._drawConfirmButton();
  }

  // -----------------------------------------------------------------------
  // Buttons
  // -----------------------------------------------------------------------

  private _drawHealButton(): void {
    const selected = this._selectedIndex === -1;
    this._healBtnBg.clear();
    this._healBtnBg.roundRect(0, 0, HEAL_BTN_W, HEAL_BTN_H, 6);
    this._healBtnBg.fill({ color: selected ? MOSS : CHARCOAL, alpha: 0.9 });
    this._healBtnBg.roundRect(0, 0, HEAL_BTN_W, HEAL_BTN_H, 6);
    this._healBtnBg.stroke({
      color: selected ? MOSS : 0x555555,
      width: selected ? 3 : 1,
    });

    // Show current/max HP context
    if (this._data) {
      const atMax = this._data.playerHp >= this._data.playerMaxHp;
      this._healBtnText.text = atMax
        ? 'PV au maximum'
        : `REPARER +${HEAL_AMOUNT} PV (${this._data.playerHp}/${this._data.playerMaxHp})`;
    }
  }

  private _drawConfirmButton(): void {
    const hasSelection = this._selectedIndex >= -1;
    this._confirmBtnBg.clear();
    this._confirmBtnBg.roundRect(0, 0, CONFIRM_BTN_W, CONFIRM_BTN_H, 6);
    this._confirmBtnBg.fill({
      color: hasSelection ? RUST : 0x333333,
    });
    this._confirmBtnBg.roundRect(0, 0, CONFIRM_BTN_W, CONFIRM_BTN_H, 6);
    this._confirmBtnBg.stroke({
      color: hasSelection ? RUST : 0x555555,
      width: 2,
    });
  }

  // -----------------------------------------------------------------------
  // Confirm
  // -----------------------------------------------------------------------

  private _handleConfirm(): void {
    if (!this._data) return;

    if (this._selectedIndex === -1) {
      // Heal choice
      const newHp = applyHealChoice(
        this._data.playerHp, this._data.playerMaxHp,
      );
      this._data.onEventEnd(this._data.playerEquipment, newHp);
    } else {
      // Loot choice — append to current equipment, not survivor's starting loadout
      const chosen = this._lootOptions[this._selectedIndex];
      if (!chosen) return;
      const updatedEquipment = [...this._data.playerEquipment, chosen];
      this._data.onEventEnd(updatedEquipment, this._data.playerHp);
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
