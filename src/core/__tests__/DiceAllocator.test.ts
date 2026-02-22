import { describe, it, expect } from 'vitest';
import {
  rollDie,
  rollPair,
  autoAllocate,
  computeTotals,
} from '../DiceAllocator';
import type { AllocationResult } from '../DiceAllocator';
import type { DiceModifier } from '@/types/diceModifier.types';

describe('rollDie', () => {
  it('returns a value between 1 and 6 with no modifier', () => {
    for (let i = 0; i < 100; i++) {
      const val = rollDie();
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });

  it('returns null-modifier same as no modifier', () => {
    for (let i = 0; i < 50; i++) {
      const val = rollDie(null);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });

  it('uses custom faces from modifier', () => {
    const mod: DiceModifier = {
      id: 'test',
      name: 'test',
      faces: [10, 20, 30],
      description: 'test modifier',
    };

    for (let i = 0; i < 100; i++) {
      const val = rollDie(mod);
      expect([10, 20, 30]).toContain(val);
    }
  });
});

describe('rollPair', () => {
  it('returns a tuple of 2 valid die values', () => {
    const [a, b] = rollPair();
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(6);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(6);
  });

  it('applies modifiers per die', () => {
    const mod: DiceModifier = {
      id: 'test',
      name: 'test',
      faces: [99],
      description: 'test modifier',
    };

    const [a, b] = rollPair(mod, null);
    expect(a).toBe(99);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(6);
  });
});

describe('autoAllocate', () => {
  it('returns both dice values (sum preserved)', () => {
    for (let i = 0; i < 100; i++) {
      const dice: [number, number] = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      const result = autoAllocate(dice, 'neutral');
      const inputSum = dice[0] + dice[1];
      expect(result.atkDie + result.defDie).toBe(inputSum);
    }
  });

  it('handles equal dice correctly', () => {
    const result = autoAllocate([3, 3], 'aggressive');
    expect(result.atkDie).toBe(3);
    expect(result.defDie).toBe(3);
  });

  it('aggressive pattern puts high die on ATK ~70% of the time', () => {
    const N = 10000;
    let highToAtk = 0;

    for (let i = 0; i < N; i++) {
      // Use distinct dice so the pattern matters
      const dice: [number, number] = [2, 5];
      const result = autoAllocate(dice, 'aggressive');
      if (result.atkDie === 5) highToAtk++;
    }

    const ratio = highToAtk / N;
    // Should be close to 0.7 (allow ±5% tolerance)
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.75);
  });

  it('defensive pattern puts high die on DEF ~70% of the time', () => {
    const N = 10000;
    let highToDef = 0;

    for (let i = 0; i < N; i++) {
      const dice: [number, number] = [2, 5];
      const result = autoAllocate(dice, 'defensive');
      if (result.defDie === 5) highToDef++;
    }

    const ratio = highToDef / N;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.75);
  });

  it('neutral pattern is roughly 50/50', () => {
    const N = 10000;
    let highToAtk = 0;

    for (let i = 0; i < N; i++) {
      const dice: [number, number] = [2, 5];
      const result = autoAllocate(dice, 'neutral');
      if (result.atkDie === 5) highToAtk++;
    }

    const ratio = highToAtk / N;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });
});

describe('computeTotals', () => {
  it('sums die + cardMod + eventBonus', () => {
    const alloc: AllocationResult = { atkDie: 4, defDie: 2 };
    const totals = computeTotals(alloc, 1, -1, 2, 0);
    // atkTotal = 4 + 1 + 2 = 7
    expect(totals.atkTotal).toBe(7);
    // defTotal = 2 + (-1) + 0 = 1
    expect(totals.defTotal).toBe(1);
  });

  it('handles zero bonuses', () => {
    const alloc: AllocationResult = { atkDie: 3, defDie: 5 };
    const totals = computeTotals(alloc, 0, 0, 0, 0);
    expect(totals.atkTotal).toBe(3);
    expect(totals.defTotal).toBe(5);
  });
});
