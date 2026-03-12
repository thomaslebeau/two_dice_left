/**
 * V6 event scene — diegetic loot/heal screen between combats.
 *
 * Mobile-first vertical stack (390×844 reference):
 *   Narrative text (flavor)
 *   LootPlanks (2-3 wood planks with iron plate + paper)
 *   HealPlank (bandaged wood plank)
 *   Confirm button
 *
 * Equipment choice is permanent. No swap/sell.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../../core/SceneManager';
import type { Equipment, Survivor } from '../../engine/types';
import { FONTS } from '../../theme';
import { STRINGS } from '../../data/strings';
import { LootPlank, PLANK_W, PLANK_H } from './LootPlank';
import { HealPlank } from './HealPlank';
import {
  generateLootOptions,
  pickNarrative,
  applyHealChoice,
} from './EventManager';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PADDING = 16;
const PLANK_GAP = 12;
const SECTION_GAP = 14;
const CONFIRM_BTN_W = 358;
const CONFIRM_BTN_H = 56;

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
  private _narrativeText: Text;
  private _confirmBtn = new Container();
  private _confirmBtnBg = new Graphics();
  private _confirmBtnText: Text;

  // --- State ---
  private _data: EventSceneData | null = null;
  private _lootPlanks: LootPlank[] = [];
  private _healPlank: HealPlank | null = null;
  private _selectedIndex: number | null = null; // null = none, 0+ = loot, -1 = heal
  private _lootOptions: Equipment[] = [];
  private _sw = 390;

  constructor() {
    super();

    // Narrative text
    this._narrativeText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 16,
        fill: BONE,
        fontStyle: 'italic',
        wordWrap: true,
        wordWrapWidth: 358,
        lineHeight: 22,
      },
    });
    this.addChild(this._narrativeText);

    // Confirm button
    this._confirmBtnText = new Text({
      text: STRINGS.CONFIRM,
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 22,
        fontWeight: 'bold',
        fill: BONE,
        letterSpacing: 3,
      },
    });
    this._confirmBtnText.anchor.set(0.5);
    this._confirmBtn.addChild(this._confirmBtnBg, this._confirmBtnText);
    this._confirmBtn.eventMode = 'static';
    this._confirmBtn.cursor = 'pointer';
    this._confirmBtn.on('pointerdown', () => this._handleConfirm());
    this.addChild(this._confirmBtn);
  }

  // -----------------------------------------------------------------------
  // Scene lifecycle
  // -----------------------------------------------------------------------

  onEnter(data?: unknown): void {
    const d = data as EventSceneData;
    this._data = d;
    this._selectedIndex = null;

    this._narrativeText.text = pickNarrative();

    // Generate loot
    this._lootOptions = generateLootOptions(
      d.playerEquipment, d.combatNumber,
    );
    this._buildLootPlanks();
    this._buildHealPlank(d);
    this._drawConfirmButton();
    this._layout();
  }

  onExit(): void {
    this._clearPlanks();
    this._data = null;
  }

  onResize(width: number, _height: number): void {
    this._sw = width;
    this._narrativeText.style.wordWrapWidth = width - PADDING * 2;
    this._layout();
  }

  // -----------------------------------------------------------------------
  // Layout (vertical stack, centered)
  // -----------------------------------------------------------------------

  private _layout(): void {
    const cx = this._sw / 2;
    let y = PADDING;

    // Narrative
    this._narrativeText.position.set(PADDING, y);
    y += this._narrativeText.height + SECTION_GAP + 4;

    // Loot planks
    for (const plank of this._lootPlanks) {
      plank.position.set(cx - PLANK_W / 2, y);
      y += PLANK_H + PLANK_GAP;
    }

    // Heal plank
    if (this._healPlank) {
      this._healPlank.position.set(cx - PLANK_W / 2, y);
      y += PLANK_H + SECTION_GAP;
    }

    // Confirm button (full width minus margins)
    const confirmW = Math.min(CONFIRM_BTN_W, this._sw - PADDING * 2);
    this._confirmBtn.position.set(cx - confirmW / 2, y);
    this._confirmBtnText.position.set(
      confirmW / 2, CONFIRM_BTN_H / 2,
    );
  }

  // -----------------------------------------------------------------------
  // Plank building
  // -----------------------------------------------------------------------

  private _buildLootPlanks(): void {
    this._clearPlanks();

    for (let i = 0; i < this._lootOptions.length; i++) {
      const plank = new LootPlank(this._lootOptions[i]);
      plank.onSelect = () => this._selectIndex(i);
      this._lootPlanks.push(plank);
      this.addChild(plank);
    }
  }

  private _buildHealPlank(d: EventSceneData): void {
    if (this._healPlank) {
      this._healPlank.destroy({ children: true });
    }
    this._healPlank = new HealPlank(d.playerHp, d.playerMaxHp);
    this._healPlank.onSelect = () => this._selectIndex(-1);
    this.addChild(this._healPlank);
  }

  private _clearPlanks(): void {
    for (const p of this._lootPlanks) p.destroy({ children: true });
    this._lootPlanks = [];
    if (this._healPlank) {
      this._healPlank.destroy({ children: true });
      this._healPlank = null;
    }
  }

  // -----------------------------------------------------------------------
  // Selection (toggle model)
  // -----------------------------------------------------------------------

  private _selectIndex(index: number): void {
    // Toggle: tap selected → deselect, tap other → select
    this._selectedIndex = this._selectedIndex === index ? null : index;
    this._updateSelection();
  }

  private _updateSelection(): void {
    for (let i = 0; i < this._lootPlanks.length; i++) {
      this._lootPlanks[i].setSelected(i === this._selectedIndex);
    }
    this._healPlank?.setSelected(this._selectedIndex === -1);
    this._drawConfirmButton();
  }

  // -----------------------------------------------------------------------
  // Confirm button
  // -----------------------------------------------------------------------

  private _drawConfirmButton(): void {
    const enabled = this._selectedIndex !== null;
    const confirmW = Math.min(CONFIRM_BTN_W, this._sw - PADDING * 2);
    this._confirmBtnBg.clear();
    this._confirmBtnBg.roundRect(0, 0, confirmW, CONFIRM_BTN_H, 6);
    this._confirmBtnBg.fill({
      color: enabled ? RUST : 0x333333,
    });
    this._confirmBtnBg.roundRect(0, 0, confirmW, CONFIRM_BTN_H, 6);
    this._confirmBtnBg.stroke({
      color: enabled ? RUST : 0x555555,
      width: 2,
    });
  }

  // -----------------------------------------------------------------------
  // Confirm
  // -----------------------------------------------------------------------

  private _handleConfirm(): void {
    if (!this._data || this._selectedIndex === null) return;

    if (this._selectedIndex === -1) {
      // Heal choice
      const newHp = applyHealChoice(
        this._data.playerHp, this._data.playerMaxHp,
      );
      this._data.onEventEnd(this._data.playerEquipment, newHp);
    } else {
      // Loot choice
      const chosen = this._lootOptions[this._selectedIndex];
      if (!chosen) return;
      const updatedEquipment = [...this._data.playerEquipment, chosen];
      this._data.onEventEnd(updatedEquipment, this._data.playerHp);
    }
  }
}
