/**
 * Diegetic toolbox — wooden box with 4×3 grid of compartments.
 * Equipment assigned by type: weapons → row 0, shields → row 1,
 * utilities → row 2. Overflow fills other rows left-to-right.
 * Preview text below the box shows effect when dice are placed.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment, Allocation } from '../../engine/types';
import { FONTS } from '../../theme';
import { ToolBoxCompartment } from './ToolBoxCompartment';
import type { SlotLike } from './SlotLike';

// Diegetic palette (same as LootPlank)
const WOOD_FILL = 0x3D2B1F;
const WOOD_GRAIN = 0x5C3D2E;
const WOOD_BORDER = 0x2A1A0F;
const SEPARATOR = 0x2A1A0F;
const BONE = 0xD9CFBA;

const COLS = 4;
const ROWS = 3;
const BORDER_W = 3;
const SEP_W = 2;

// Row type mapping
const ROW_TYPE: readonly Equipment['type'][] = ['weapon', 'shield', 'utility'];

function fmtPreviewLine(dieValue: number, eq: Equipment): string {
  const eff = eq.effect(dieValue);
  const parts: string[] = [];
  if (eff.damage > 0) parts.push(`${eff.damage} dmg`);
  if (eff.shield > 0) parts.push(`${eff.shield} abs`);
  if (eff.heal > 0) parts.push(`${eff.heal} hp`);
  if (eff.poison > 0) parts.push(`${eff.poison} psn`);
  const effect = parts.join(', ') || '0';
  return `\u2192 ${effect} (${eq.name})`;
}

export class ToolBox extends Container {
  private _bg = new Graphics();
  private _compartments: ToolBoxCompartment[] = [];
  private _allSlots: ToolBoxCompartment[] = []; // only equipment-bearing
  private _previewContainer = new Container();
  private _previewLines: Text[] = [];
  private _boxW = 280;
  private _boxH = 220;

  /** Callback when a compartment is tapped. */
  onSlotTap: ((equipmentIndex: number) => void) | null = null;

  constructor() {
    super();
    this.addChild(this._bg);
    this.addChild(this._previewContainer);
  }

  get slots(): readonly SlotLike[] { return this._allSlots; }

  /** Build compartments for the given equipment set. */
  build(equipment: readonly Equipment[]): void {
    this._clear();

    // Assign equipment to grid cells by type
    const grid: (Equipment | null)[][] = Array.from(
      { length: ROWS }, () => Array(COLS).fill(null) as (Equipment | null)[],
    );
    const eqIndexMap = new Map<Equipment, number>();
    equipment.forEach((eq, i) => eqIndexMap.set(eq, i));

    // Place by preferred row
    const placed = new Set<Equipment>();
    for (const eq of equipment) {
      if (eq.isPassive) continue; // passive equipment has no slot
      const rowIdx = ROW_TYPE.indexOf(eq.type);
      const row = grid[rowIdx];
      const col = row.findIndex(c => c === null);
      if (col !== -1) {
        row[col] = eq;
        placed.add(eq);
      }
    }

    // Overflow: place remaining equipment in any empty cell
    for (const eq of equipment) {
      if (placed.has(eq) || eq.isPassive) continue;
      let done = false;
      for (let r = 0; r < ROWS && !done; r++) {
        for (let c = 0; c < COLS && !done; c++) {
          if (grid[r][c] === null) {
            grid[r][c] = eq;
            placed.add(eq);
            done = true;
          }
        }
      }
    }

    // Create compartments
    const cellW = this._cellW();
    const cellH = this._cellH();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const eq = grid[r][c];
        if (!eq) continue;
        const eqIdx = eqIndexMap.get(eq)!; // safe: eq came from equipment
        const comp = new ToolBoxCompartment(eq, eqIdx);
        comp.resize(cellW, cellH);
        comp.position.set(this._cellX(c), this._cellY(r));
        comp.on('pointerdown', () => this.onSlotTap?.(eqIdx));
        this.addChild(comp);
        this._compartments.push(comp);
        this._allSlots.push(comp);
      }
    }

    // Lock passive equipment
    for (const eq of equipment) {
      if (eq.isPassive) {
        // Passive slots are not shown in toolbox
      }
    }

    this._drawBg();
  }

  /** Reposition for available dimensions. */
  layout(w: number, h: number): void {
    this._boxW = w;
    this._boxH = h;
    this._drawBg();

    const cellW = this._cellW();
    const cellH = this._cellH();
    for (const comp of this._compartments) {
      // Find its grid position from current x/y — recalculate
      comp.resize(cellW, cellH);
    }
    this._repositionCompartments();
    this._previewContainer.position.set(BORDER_W, this._boxH + 4);
  }

  lockAll(): void {
    for (const s of this._allSlots) s.lock();
  }

  resetAll(): void {
    for (const s of this._allSlots) {
      s.releaseDie(); // release any reparented die
      s.removeDie();
    }
  }

  placeDie(equipmentIndex: number, dieValue: number): void {
    const slot = this._allSlots.find(s => s.equipmentIndex === equipmentIndex);
    slot?.placeDie(dieValue);
  }

  clear(): void { this._clear(); }

  /** Update preview lines below the box. */
  updatePreview(
    allocations: readonly Allocation[],
    equipment: readonly Equipment[],
  ): void {
    this.clearPreview();
    for (const a of allocations) {
      const eq = equipment[a.equipmentIndex];
      if (!eq) continue;
      const line = new Text({
        text: fmtPreviewLine(a.dieValue, eq),
        style: {
          fontFamily: FONTS.BODY, fontSize: 11, fill: BONE,
        },
      });
      line.position.set(0, this._previewLines.length * 16);
      this._previewContainer.addChild(line);
      this._previewLines.push(line);
    }
  }

  clearPreview(): void {
    for (const t of this._previewLines) t.destroy();
    this._previewLines = [];
  }

  // -----------------------------------------------------------------------
  // Private — grid math
  // -----------------------------------------------------------------------

  private _cellW(): number {
    return Math.floor(
      (this._boxW - BORDER_W * 2 - SEP_W * (COLS - 1)) / COLS,
    );
  }

  private _cellH(): number {
    return Math.floor(
      (this._boxH - BORDER_W * 2 - SEP_W * (ROWS - 1)) / ROWS,
    );
  }

  private _cellX(col: number): number {
    return BORDER_W + col * (this._cellW() + SEP_W);
  }

  private _cellY(row: number): number {
    return BORDER_W + row * (this._cellH() + SEP_W);
  }

  private _repositionCompartments(): void {
    // Rebuild position from equipment → grid mapping
    const cellW = this._cellW();
    const cellH = this._cellH();

    // Re-assign positions based on type
    const byType: Map<Equipment['type'], ToolBoxCompartment[]> = new Map();
    for (const comp of this._compartments) {
      const t = comp.equipment.type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(comp);
    }

    const usedCells = new Set<string>();
    const place = (comp: ToolBoxCompartment, r: number, c: number) => {
      comp.position.set(this._cellX(c), this._cellY(r));
      comp.resize(cellW, cellH);
      usedCells.add(`${r},${c}`);
    };

    // Place by preferred row
    for (let ri = 0; ri < ROW_TYPE.length; ri++) {
      const comps = byType.get(ROW_TYPE[ri]) ?? [];
      let col = 0;
      for (const comp of comps) {
        while (col < COLS && usedCells.has(`${ri},${col}`)) col++;
        if (col < COLS) place(comp, ri, col++);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private — drawing
  // -----------------------------------------------------------------------

  private _drawBg(): void {
    const g = this._bg;
    g.clear();

    // Wood fill
    g.rect(0, 0, this._boxW, this._boxH);
    g.fill(WOOD_FILL);

    // Grain lines
    const lineCount = 5;
    for (let i = 0; i < lineCount; i++) {
      const ly = 8 + (i * (this._boxH - 16)) / (lineCount - 1);
      g.moveTo(BORDER_W, ly);
      g.lineTo(this._boxW - BORDER_W, ly);
      g.stroke({ color: WOOD_GRAIN, width: 1, alpha: 0.25 });
    }

    // Separators — vertical
    for (let c = 1; c < COLS; c++) {
      const x = this._cellX(c) - SEP_W / 2;
      g.moveTo(x, BORDER_W);
      g.lineTo(x, this._boxH - BORDER_W);
      g.stroke({ color: SEPARATOR, width: SEP_W });
    }

    // Separators — horizontal
    for (let r = 1; r < ROWS; r++) {
      const y = this._cellY(r) - SEP_W / 2;
      g.moveTo(BORDER_W, y);
      g.lineTo(this._boxW - BORDER_W, y);
      g.stroke({ color: SEPARATOR, width: SEP_W });
    }

    // Outer border
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
    this.clearPreview();
  }
}
