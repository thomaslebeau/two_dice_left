/**
 * Enemy info panel — equipment description lines + muted dice display.
 *
 * Layout (vertical):
 *   [ATK Claw [1-6] -> d+0 dmg]
 *   [DEF Shell [1-6] -> d+0 abs]
 *   [die] [die]                    ← scaled-down, non-interactive
 *
 * Owns creation, layout, and cleanup of these elements.
 */

import { Container, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { DiceSprite, DIE_SIZE } from './DiceSprite';

// ---------------------------------------------------------------------------
// V6 palette
// ---------------------------------------------------------------------------

const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_HEIGHT = 15;
const DICE_SCALE = 0.85;
const DICE_GAP = 8;
const INFO_TO_DICE_GAP = 6;

// ---------------------------------------------------------------------------
// EnemyInfoPanel
// ---------------------------------------------------------------------------

export class EnemyInfoPanel extends Container {
  private _infoContainer = new Container();
  private _diceZone = new Container();
  private _diceSprites: DiceSprite[] = [];
  private _diceValues: number[] = [];
  private _panelHeight = 0;
  private _availWidth = 0;

  /** Total height after layout. */
  get panelHeight(): number { return this._panelHeight; }

  /** Current enemy dice values (for allocation by CombatScene). */
  get diceValues(): readonly number[] { return this._diceValues; }

  constructor() {
    super();
    this.addChild(this._infoContainer);
    this.addChild(this._diceZone);
  }

  // -----------------------------------------------------------------------
  // Equipment info
  // -----------------------------------------------------------------------

  /** Build descriptive text lines for enemy equipment. */
  buildEquipInfo(equipment: readonly Equipment[]): void {
    this._infoContainer.removeChildren();
    let ly = 0;
    for (const eq of equipment) {
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
      this._infoContainer.addChild(line);
      ly += LINE_HEIGHT;
    }
  }

  // -----------------------------------------------------------------------
  // Dice
  // -----------------------------------------------------------------------

  /** Create muted, non-interactive dice for display. */
  buildDice(values: number[]): void {
    this.clearDice();
    this._diceValues = values;
    for (let i = 0; i < values.length; i++) {
      const die = new DiceSprite(i);
      die.eventMode = 'none';
      die.cursor = 'default';
      die.alpha = 0.6;
      this._diceSprites.push(die);
      this._diceZone.addChild(die);
      die.roll(values[i]);
    }
  }

  /** Show/hide the free-floating dice display. */
  setDiceVisible(visible: boolean): void {
    this._diceZone.visible = visible;
  }

  /** Destroy all dice sprites. */
  clearDice(): void {
    for (const d of this._diceSprites) d.destroy();
    this._diceSprites = [];
    this._diceValues = [];
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  /** Position children vertically. Call after build methods. */
  layout(availWidth: number): void {
    this._availWidth = availWidth;
    let y = 0;

    // Equipment info lines
    this._infoContainer.position.set(0, y);
    y += this._infoContainer.height + INFO_TO_DICE_GAP;

    // Dice row
    this._diceZone.position.set(0, y);
    this._layoutDice();
    if (this._diceSprites.length > 0) {
      y += DIE_SIZE * DICE_SCALE + 4;
    }

    this._panelHeight = y;
  }

  /** Center dice within available width. */
  private _layoutDice(): void {
    const count = this._diceSprites.length;
    if (count === 0) return;
    const dieW = DIE_SIZE * DICE_SCALE;
    const totalW = count * dieW + (count - 1) * DICE_GAP;
    let x = (this._availWidth - totalW) / 2;
    for (const die of this._diceSprites) {
      die.scale.set(DICE_SCALE);
      die.position.set(x, 0);
      x += dieW + DICE_GAP;
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  clear(): void {
    this.clearDice();
    this._infoContainer.removeChildren();
    this._panelHeight = 0;
  }
}
