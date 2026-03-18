/**
 * Diegetic loot plank — a wooden plank with iron plate (type icon)
 * and nailed paper note (equipment details).
 * Post-apocalyptic aesthetic: wood grain, rivets, torn paper edges.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Equipment } from '../../engine/types';
import { FONTS } from '../../theme';
import { formatRange } from '../../data/strings';

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export const PLANK_W = 350;
export const PLANK_H = 130;

// ---------------------------------------------------------------------------
// Diegetic palette (NOT theme — material colors)
// ---------------------------------------------------------------------------

const WOOD_FILL = 0x3D2B1F;
const WOOD_GRAIN = 0x5C3D2E;
const WOOD_BORDER = 0x2A1A0F;

const IRON_FILL = 0x3A3A3A;
const IRON_BORDER = 0x555555;
const RIVET = 0x888888;
const RIVET_SHADOW = 0x555555;

const PAPER_FILL = 0xC4B396;
const NAIL_COLOR = 0x444444;
const PAPER_TEXT = 0x2A1A0F;

// Brand accent (local copies)
const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;

// ---------------------------------------------------------------------------
// Synergy detection
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeGlyph(type: Equipment['type']): string {
  switch (type) {
    case 'weapon': return '\u{1F5E1}';
    case 'shield': return '\uD83D\uDEE1';
    case 'utility': return '\u2695';
  }
}

/** Simple numeric hash from equipment id for grain variation. */
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// LootPlank
// ---------------------------------------------------------------------------

export class LootPlank extends Container {
  private _bg = new Graphics();
  private _equipment: Equipment;
  private _selected = false;

  /** Fired when the user taps this plank. */
  onSelect: (() => void) | null = null;

  constructor(equipment: Equipment) {
    super();
    this._equipment = equipment;

    this.addChild(this._bg);
    this._drawWoodBase(this._bg, equipment.id);

    // Iron plate (left side)
    const plate = this._buildIronPlate(equipment.type);
    plate.position.set(8, 12);
    this.addChild(plate);

    // Paper note (right side)
    const note = this._buildPaperNote(equipment);
    note.position.set(116, 8);
    this.addChild(note);

    // Interaction
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.onSelect?.());
    this.on('pointerover', () => { if (!this._selected) this.alpha = 0.9; });
    this.on('pointerout', () => { this.alpha = 1; });
  }

  get equipment(): Equipment { return this._equipment; }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._drawWoodBase(this._bg, this._equipment.id);
  }

  setDimmed(dimmed: boolean): void {
    this.alpha = dimmed ? 0.6 : 1;
  }

  // -----------------------------------------------------------------------
  // Wood base
  // -----------------------------------------------------------------------

  private _drawWoodBase(g: Graphics, eqId: string): void {
    g.clear();

    // Fill
    g.rect(0, 0, PLANK_W, PLANK_H);
    g.fill(WOOD_FILL);

    // Grain lines (4-6 based on id hash)
    const hash = idHash(eqId);
    const lineCount = 4 + (hash % 3);
    for (let i = 0; i < lineCount; i++) {
      const ly = 12 + ((hash + i * 17) % (PLANK_H - 24));
      g.moveTo(4, ly);
      g.lineTo(PLANK_W - 4, ly);
      g.stroke({ color: WOOD_GRAIN, width: 1, alpha: 0.3 });
    }

    // Border
    const borderColor = this._selected ? RUST : WOOD_BORDER;
    const borderWidth = this._selected ? 3 : 2;
    g.rect(0, 0, PLANK_W, PLANK_H);
    g.stroke({ color: borderColor, width: borderWidth });
  }

  // -----------------------------------------------------------------------
  // Iron plate
  // -----------------------------------------------------------------------

  private _buildIronPlate(type: Equipment['type']): Container {
    const c = new Container();
    const plateW = 100;
    const plateH = 80;

    // Plate background
    const g = new Graphics();
    g.rect(0, 0, plateW, plateH);
    g.fill(IRON_FILL);
    g.rect(0, 0, plateW, plateH);
    g.stroke({ color: IRON_BORDER, width: 1 });
    c.addChild(g);

    // Corner rivets
    const rivetPositions = [
      [6, 6], [plateW - 6, 6],
      [6, plateH - 6], [plateW - 6, plateH - 6],
    ];
    for (const [rx, ry] of rivetPositions) {
      const rivet = new Graphics();
      rivet.circle(rx, ry, 3);
      rivet.fill(RIVET_SHADOW);
      rivet.circle(rx - 0.5, ry - 0.5, 2.5);
      rivet.fill(RIVET);
      c.addChild(rivet);
    }

    // Type glyph
    const glyph = new Text({
      text: typeGlyph(type),
      style: { fontSize: 28, fill: BONE },
    });
    glyph.anchor.set(0.5);
    glyph.position.set(plateW / 2, plateH / 2 - 8);
    c.addChild(glyph);

    return c;
  }

  // -----------------------------------------------------------------------
  // Paper note
  // -----------------------------------------------------------------------

  private _buildPaperNote(eq: Equipment): Container {
    const c = new Container();
    c.rotation = (1 + (idHash(eq.id) % 2)) * (Math.PI / 180);

    const noteW = 220;
    const noteH = 90;

    // Torn paper shape (right edge offset for torn look)
    const paper = new Graphics();
    const tearX = noteW - 2 + (idHash(eq.id) % 3);
    paper.moveTo(0, 0);
    paper.lineTo(tearX, 1);
    paper.lineTo(noteW, 3);
    paper.lineTo(noteW + 1, noteH / 3);
    paper.lineTo(tearX - 1, noteH * 2 / 3);
    paper.lineTo(noteW, noteH - 2);
    paper.lineTo(0, noteH);
    paper.closePath();
    paper.fill(PAPER_FILL);
    c.addChild(paper);

    // Nails
    const nailPositions = [[8, 8], [noteW - 12, 6], [10, noteH - 10]];
    for (const [nx, ny] of nailPositions) {
      const nail = new Graphics();
      nail.circle(nx, ny, 2.5);
      nail.fill(NAIL_COLOR);
      c.addChild(nail);
    }

    // Text stack
    let ty = 16;
    const padX = 18;
    const maxTextW = noteW - padX * 2;

    // Name
    const name = new Text({
      text: eq.name,
      style: {
        fontFamily: FONTS.HEADING,
        fontSize: 18,
        fill: PAPER_TEXT,
        letterSpacing: 1,
      },
    });
    name.position.set(padX, ty);
    c.addChild(name);
    ty += 22;

    // Range (only if restricted)
    const rangeStr = formatRange(eq.minDie, eq.maxDie);
    if (rangeStr) {
      const range = new Text({
        text: rangeStr,
        style: {
          fontFamily: FONTS.BODY,
          fontSize: 14,
          fill: PAPER_TEXT,
        },
      });
      range.position.set(padX, ty);
      c.addChild(range);
      ty += 18;
    }

    // Effect
    const effect = new Text({
      text: eq.description,
      style: {
        fontFamily: FONTS.BODY,
        fontSize: 16,
        fill: PAPER_TEXT,
        wordWrap: true,
        wordWrapWidth: maxTextW,
      },
    });
    effect.position.set(padX, ty);
    c.addChild(effect);
    ty += effect.height + 4;

    return c;
  }
}
