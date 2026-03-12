/**
 * Diegetic toolbox — wooden box with 3-column dynamic grid.
 * Equipment placed sequentially left-to-right, top-to-bottom.
 * Extra rows added automatically for >6 equipment.
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
const CHARCOAL = 0x1A1A1A;
const TOOLTIP_PAD = 8;

const COLS = 3;
const MIN_ROWS = 2;
const BORDER_W = 3;
const SEP_W = 2;

function fmtPreviewLine(dieValue: number, eq: Equipment): string {
  const eff = eq.effect(dieValue);
  const parts: string[] = [];
  if (eff.damage > 0) parts.push(`${eff.damage} dégâts`);
  if (eff.shield > 0) parts.push(`${eff.shield} blocage`);
  if (eff.heal > 0) parts.push(`${eff.heal} soin`);
  if (eff.poison > 0) parts.push(`${eff.poison} poison`);
  const effect = parts.join(', ') || '0';
  return `\u2192 ${effect} (${eq.name})`;
}

export class ToolBox extends Container {
  private _bg = new Graphics();
  private _compartments: ToolBoxCompartment[] = [];
  private _allSlots: ToolBoxCompartment[] = []; // only equipment-bearing
  private _tooltip = new Container();
  private _tooltipBg = new Graphics();
  private _tooltipText: Text;
  private _boxW = 280;
  private _boxH = 220;

  /** Callback when a compartment is tapped. */
  onSlotTap: ((equipmentIndex: number) => void) | null = null;

  constructor() {
    super();
    this.addChild(this._bg);

    // Floating tooltip
    this._tooltipText = new Text({
      text: '',
      style: {
        fontFamily: FONTS.BODY, fontSize: 16, fill: BONE,
        wordWrap: true, wordWrapWidth: 260,
      },
    });
    this._tooltipText.position.set(TOOLTIP_PAD, TOOLTIP_PAD);
    this._tooltip.addChild(this._tooltipBg, this._tooltipText);
    this._tooltip.visible = false;
    this.addChild(this._tooltip);
  }

  get slots(): readonly SlotLike[] { return this._allSlots; }

  /** Build compartments for the given equipment set. */
  build(equipment: readonly Equipment[]): void {
    this._clear();

    // Filter active (non-passive) equipment
    const active = equipment
      .map((eq, i) => ({ eq, idx: i }))
      .filter(({ eq }) => !eq.isPassive);

    // Place sequentially: left-to-right, top-to-bottom
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

  /** Show floating tooltip above the toolbox with allocation results. */
  updatePreview(
    allocations: readonly Allocation[],
    equipment: readonly Equipment[],
  ): void {
    if (allocations.length === 0) {
      this.clearPreview();
      return;
    }

    const lines = allocations
      .map(a => {
        const eq = equipment[a.equipmentIndex];
        return eq ? fmtPreviewLine(a.dieValue, eq) : null;
      })
      .filter(Boolean)
      .join('\n');

    this._tooltipText.text = lines;
    this._tooltipText.style.wordWrapWidth = this._boxW - TOOLTIP_PAD * 2;

    // Size background to text
    const tw = this._tooltipText.width + TOOLTIP_PAD * 2;
    const th = this._tooltipText.height + TOOLTIP_PAD * 2;
    this._tooltipBg.clear();
    this._tooltipBg.roundRect(0, 0, tw, th, 4);
    this._tooltipBg.fill({ color: CHARCOAL, alpha: 0.85 });

    // Position above the box
    this._tooltip.position.set(0, -th - 4);
    this._tooltip.visible = true;
  }

  clearPreview(): void {
    this._tooltip.visible = false;
    this._tooltipText.text = '';
  }

  // -----------------------------------------------------------------------
  // Private — grid math
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
      this._compartments[i].position.set(this._cellX(c), this._cellY(r));
      this._compartments[i].resize(cellW, cellH);
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
    const rows = this._rows();
    for (let c = 1; c < COLS; c++) {
      const x = this._cellX(c) - SEP_W / 2;
      g.moveTo(x, BORDER_W);
      g.lineTo(x, this._boxH - BORDER_W);
      g.stroke({ color: SEPARATOR, width: SEP_W });
    }

    // Separators — horizontal
    for (let r = 1; r < rows; r++) {
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
