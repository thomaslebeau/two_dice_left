/**
 * Inline enemy dice display — muted, non-interactive dice row.
 * Replaces the dice portion of the old EnemyInfoPanel.
 */

import { Container } from 'pixi.js';
import { DiceSprite, DIE_SIZE } from './DiceSprite';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DICE_SCALE = 0.75;
const DICE_GAP = 8;

// ---------------------------------------------------------------------------
// EnemyDiceRow
// ---------------------------------------------------------------------------

export class EnemyDiceRow extends Container {
  private _diceSprites: DiceSprite[] = [];
  private _diceValues: number[] = [];

  get diceValues(): readonly number[] { return this._diceValues; }
  get rowHeight(): number {
    return this._diceSprites.length > 0 ? DIE_SIZE * DICE_SCALE : 0;
  }

  /** Create muted dice for display. */
  buildDice(values: number[]): void {
    this.clearDice();
    this._diceValues = values;
    for (let i = 0; i < values.length; i++) {
      const die = new DiceSprite(i);
      die.eventMode = 'none';
      die.cursor = 'default';
      die.alpha = 0.6;
      die.scale.set(DICE_SCALE);
      this._diceSprites.push(die);
      this.addChild(die);
      die.roll(values[i]);
    }
  }

  /** Position dice centered within given width. */
  layout(availWidth: number): void {
    const count = this._diceSprites.length;
    if (count === 0) return;
    const dieW = DIE_SIZE * DICE_SCALE;
    const totalW = count * dieW + (count - 1) * DICE_GAP;
    let x = (availWidth - totalW) / 2;
    for (const die of this._diceSprites) {
      die.position.set(x, 0);
      x += dieW + DICE_GAP;
    }
  }

  clearDice(): void {
    for (const d of this._diceSprites) d.destroy();
    this._diceSprites = [];
    this._diceValues = [];
  }
}
