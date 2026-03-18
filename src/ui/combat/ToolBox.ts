/**
 * Diegetic toolbox — wooden box with 3-column dynamic grid.
 * Equipment placed sequentially left-to-right, top-to-bottom.
 * No tooltip — compartments show name + effect inline.
 */

import { Container, Graphics } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { ToolBoxCompartment } from './ToolBoxCompartment';
import type { SlotLike } from './SlotLike';

const WOOD_FILL = 0x3D2B1F;
const WOOD_GRAIN = 0x5C3D2E;
const WOOD_BORDER = 0x2A1A0F;
const SEPARATOR = 0x2A1A0F;

const COLS = 3;
const MIN_ROWS = 2;
const BORDER_W = 3;
const SEP_W = 2;

export class ToolBox extends Container {
  private _bg = new Graphics();
  private _compartments: ToolBoxCompartment[] = [];
  private _allSlots: ToolBoxCompartment[] = [];
  private _boxW = 280;
  private _boxH = 220;

  onSlotTap: ((equipmentIndex: number) => void) | null = null;

  constructor() {
    super();
    this.addChild(this._bg);
  }

  get slots(): readonly SlotLike[] { return this._allSlots; }

  build(equipment: readonly Equipment[]): void {
    this._clear();

    const active = equipment
      .map((eq, i) => ({ eq, idx: i }))
      .filter(({ eq }) => !eq.isPassive);

    const cellW = this._cellW();
    const cellH = this._cellH();
    for (let i = 0; i < active.length; i++) {
      const { eq, idx } = active[i];
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const comp = new ToolBoxCompartment(eq, idx);
      comp.resize(cellW, cellH);
      comp.position.set(this._cellX(c), this._cellY(r));
      comp.on('pointerdown', () => this.onSlotTap?.(idx));
      this.addChild(comp);
      this._compartments.push(comp);
      this._allSlots.push(comp);
    }

    this._drawBg();
  }

  layout(w: number, h: number): void {
    this._boxW = w;
    this._boxH = h;
    this._drawBg();
    this._repositionCompartments();
  }

  lockAll(): void {
    for (const s of this._allSlots) s.lock();
  }

  resetAll(): void {
    for (const s of this._allSlots) {
      s.releaseDie();
      s.removeDie();
    }
  }

  placeDie(equipmentIndex: number, dieValue: number): void {
    const slot = this._allSlots.find(
      s => s.equipmentIndex === equipmentIndex,
    );
    slot?.placeDie(dieValue);
  }

  consumeSlot(equipmentIndex: number): void {
    const idx = this._compartments.findIndex(
      c => c.equipmentIndex === equipmentIndex,
    );
    if (idx < 0) return;
    const comp = this._compartments[idx];
    comp.releaseDie();
    comp.destroy({ children: true });
    this._compartments.splice(idx, 1);
    this._allSlots = this._allSlots.filter(
      s => s.equipmentIndex !== equipmentIndex,
    );
    this._repositionCompartments();
    this._drawBg();
  }

  clear(): void { this._clear(); }

  // -----------------------------------------------------------------------
  // Grid math
  // -----------------------------------------------------------------------

  private _rows(): number {
    const count = this._compartments.length || MIN_ROWS * COLS;
    return Math.max(MIN_ROWS, Math.ceil(count / COLS));
  }

  private _cellW(): number {
    return Math.floor(
      (this._boxW - BORDER_W * 2 - SEP_W * (COLS - 1)) / COLS,
    );
  }

  private _cellH(): number {
    const rows = this._rows();
    return Math.floor(
      (this._boxH - BORDER_W * 2 - SEP_W * (rows - 1)) / rows,
    );
  }

  private _cellX(col: number): number {
    return BORDER_W + col * (this._cellW() + SEP_W);
  }

  private _cellY(row: number): number {
    return BORDER_W + row * (this._cellH() + SEP_W);
  }

  private _repositionCompartments(): void {
    const cellW = this._cellW();
    const cellH = this._cellH();
    for (let i = 0; i < this._compartments.length; i++) {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      this._compartments[i].position.set(
        this._cellX(c), this._cellY(r),
      );
      this._compartments[i].resize(cellW, cellH);
    }
  }

  // -----------------------------------------------------------------------
  // Drawing
  // -----------------------------------------------------------------------

  private _drawBg(): void {
    const g = this._bg;
    g.clear();

    g.rect(0, 0, this._boxW, this._boxH);
    g.fill(WOOD_FILL);

    const lineCount = 5;
    for (let i = 0; i < lineCount; i++) {
      const ly = 8 + (i * (this._boxH - 16)) / (lineCount - 1);
      g.moveTo(BORDER_W, ly);
      g.lineTo(this._boxW - BORDER_W, ly);
      g.stroke({ color: WOOD_GRAIN, width: 1, alpha: 0.25 });
    }

    const rows = this._rows();
    for (let c = 1; c < COLS; c++) {
      const x = this._cellX(c) - SEP_W / 2;
      g.moveTo(x, BORDER_W);
      g.lineTo(x, this._boxH - BORDER_W);
      g.stroke({ color: SEPARATOR, width: SEP_W });
    }

    for (let r = 1; r < rows; r++) {
      const y = this._cellY(r) - SEP_W / 2;
      g.moveTo(BORDER_W, y);
      g.lineTo(this._boxW - BORDER_W, y);
      g.stroke({ color: SEPARATOR, width: SEP_W });
    }

    g.rect(0, 0, this._boxW, this._boxH);
    g.stroke({ color: WOOD_BORDER, width: BORDER_W });
  }

  private _clear(): void {
    for (const comp of this._compartments) {
      comp.releaseDie();
      comp.destroy();
    }
    this._compartments = [];
    this._allSlots = [];
  }
}
