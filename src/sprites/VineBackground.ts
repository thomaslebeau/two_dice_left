import { Sprite, Texture } from 'pixi.js';
import { generateVines, computeMaxGrowthTime } from '@/components/CreepingVines/vineGenerator';
import { drawFrame } from '@/components/CreepingVines/vineRenderer';
import type { VinePath } from '@/components/CreepingVines/types';

/**
 * Renders the creeping-vine background to an offscreen canvas
 * and exposes it as a Pixi Sprite (texture updates each frame).
 */
export class VineBackground extends Sprite {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vines: VinePath[] = [];
  private maxGrowthTime = 0;
  private startMs = 0;
  private seed: number;

  constructor(width: number, height: number, seed = 42) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const texture = Texture.from(canvas);
    super(texture);

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.seed = seed;

    this.rebuild(width, height);
    this.startMs = performance.now();
  }

  /** Regenerate vines for a new size. */
  resize(w: number, h: number): void {
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.rebuild(w, h);
  }

  /** Call every frame (e.g. from scene.onUpdate). */
  update(): void {
    const nowMs = performance.now();
    const elapsed = (nowMs - this.startMs) / 1000;
    const time = elapsed;

    drawFrame(this.ctx, this.vines, elapsed, time, this.canvas.width, this.canvas.height, this.maxGrowthTime);
    this.texture.source.update();
  }

  private rebuild(w: number, h: number): void {
    this.vines = generateVines(w, h, 8, 2, this.seed);
    this.maxGrowthTime = computeMaxGrowthTime(this.vines);
  }

  override destroy(): void {
    super.destroy();
    this.texture.destroy(true);
  }
}
