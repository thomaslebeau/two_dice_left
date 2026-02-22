import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetaProgression } from '../MetaProgression';

// Mock localStorage for Node test environment
function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe('MetaProgression', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMockStorage(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('default state', () => {
    it('starts with only survivor 1 unlocked', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockedSurvivorIds()).toEqual([1]);
    });

    it('starts with rusty, heavy, broken modifiers unlocked', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockedDiceModifierIds()).toEqual(['rusty', 'heavy', 'broken']);
    });

    it('starts with 0 runs and 0 wins', () => {
      const meta = new MetaProgression();
      const stats = meta.getStats();
      expect(stats.totalRuns).toBe(0);
      expect(stats.totalWins).toBe(0);
    });
  });

  describe('recordRun — losses', () => {
    it('increments totalRuns on loss', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, false, 0);
      expect(meta.getStats().totalRuns).toBe(1);
    });

    it('does not increment totalWins on loss', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, false, 0);
      expect(meta.getStats().totalWins).toBe(0);
    });

    it('does not track perSurvivorWins on loss', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, false, 0);
      expect(meta.getStats().perSurvivorWins[1]).toBeUndefined();
    });
  });

  describe('recordRun — wins', () => {
    it('increments both totalRuns and totalWins', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, true, 5);
      const stats = meta.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalWins).toBe(1);
    });

    it('tracks perSurvivorWins', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, true, 5);
      meta.recordRun(1, true, 5);
      meta.recordRun(2, true, 5);
      const stats = meta.getStats();
      expect(stats.perSurvivorWins[1]).toBe(2);
      expect(stats.perSurvivorWins[2]).toBe(1);
    });
  });

  describe('unlock — progressive starters (IDs 2-5)', () => {
    it('unlocks ID 2 at 1 win', () => {
      const meta = new MetaProgression();
      const unlocks = meta.recordRun(1, true, 10);
      expect(unlocks.find(u => u.id === 2)).toBeDefined();
      expect(meta.getUnlockedSurvivorIds()).toContain(2);
    });

    it('unlocks ID 3 at 2 wins', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, true, 10);
      const unlocks = meta.recordRun(1, true, 10);
      expect(unlocks.find(u => u.id === 3)).toBeDefined();
      expect(meta.getUnlockedSurvivorIds()).toContain(3);
    });

    it('unlocks ID 4 at 3 wins', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 2; i++) meta.recordRun(1, true, 10);
      const unlocks = meta.recordRun(1, true, 10);
      expect(unlocks.find(u => u.id === 4)).toBeDefined();
    });

    it('unlocks ID 5 at 4 wins', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 3; i++) meta.recordRun(1, true, 10);
      const unlocks = meta.recordRun(1, true, 10);
      expect(unlocks.find(u => u.id === 5)).toBeDefined();
    });

    it('does not unlock ID 2 on loss', () => {
      const meta = new MetaProgression();
      const unlocks = meta.recordRun(1, false, 0);
      expect(unlocks.find(u => u.id === 2)).toBeUndefined();
    });
  });

  describe('unlock — Le Forgeron (ID 6)', () => {
    it('unlocks at 5 wins', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 4; i++) meta.recordRun(1, true, 10);
      const unlocks = meta.recordRun(1, true, 10);
      const forgeronUnlock = unlocks.find(u => u.id === 6);
      expect(forgeronUnlock).toBeDefined();
      expect(forgeronUnlock!.type).toBe('survivor');
      expect(meta.getUnlockedSurvivorIds()).toContain(6);
    });

    it('does not unlock at 4 wins', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 3; i++) meta.recordRun(1, true, 10);
      const unlocks = meta.recordRun(1, true, 10);
      expect(unlocks.find(u => u.id === 6)).toBeUndefined();
      expect(meta.getUnlockedSurvivorIds()).not.toContain(6);
    });
  });

  describe('unlock — Le Blindé (ID 7)', () => {
    it('unlocks on win with finalHP < 3', () => {
      const meta = new MetaProgression();
      const unlocks = meta.recordRun(1, true, 2);
      const blindeUnlock = unlocks.find(u => u.id === 7);
      expect(blindeUnlock).toBeDefined();
      expect(blindeUnlock!.type).toBe('survivor');
    });

    it('does NOT unlock on win with finalHP = 3', () => {
      const meta = new MetaProgression();
      const unlocks = meta.recordRun(1, true, 3);
      expect(unlocks.find(u => u.id === 7)).toBeUndefined();
    });

    it('does NOT unlock on loss with finalHP < 3', () => {
      const meta = new MetaProgression();
      const unlocks = meta.recordRun(1, false, 1);
      expect(unlocks.find(u => u.id === 7)).toBeUndefined();
    });
  });

  describe('unlock — Le Vétéran (ID 8)', () => {
    it('unlocks with 7 unique survivor winners', () => {
      const meta = new MetaProgression();
      // Win with 7 different survivors
      for (let i = 1; i <= 6; i++) {
        meta.recordRun(i, true, 10);
      }
      const unlocks = meta.recordRun(7, true, 10);
      const veteranUnlock = unlocks.find(u => u.id === 8);
      expect(veteranUnlock).toBeDefined();
      expect(veteranUnlock!.type).toBe('survivor');
    });

    it('does not unlock with 6 unique survivors', () => {
      const meta = new MetaProgression();
      for (let i = 1; i <= 5; i++) {
        meta.recordRun(i, true, 10);
      }
      const unlocks = meta.recordRun(6, true, 10);
      expect(unlocks.find(u => u.id === 8)).toBeUndefined();
    });
  });

  describe('unlock — dice modifiers', () => {
    it('unlocks ivy and needle at 5 runs', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 4; i++) {
        meta.recordRun(1, false, 0);
      }
      const unlocks = meta.recordRun(1, false, 0);
      const modIds = unlocks.filter(u => u.type === 'diceModifier').map(u => u.id);
      expect(modIds).toContain('ivy');
      expect(modIds).toContain('needle');
    });

    it('unlocks root at 10 runs', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 9; i++) {
        meta.recordRun(1, false, 0);
      }
      const unlocks = meta.recordRun(1, false, 0);
      const rootUnlock = unlocks.find(u => u.id === 'root');
      expect(rootUnlock).toBeDefined();
      expect(rootUnlock!.type).toBe('diceModifier');
    });

    it('does not unlock ivy/needle before 5 runs', () => {
      const meta = new MetaProgression();
      for (let i = 0; i < 3; i++) {
        meta.recordRun(1, false, 0);
      }
      const unlocks = meta.recordRun(1, false, 0);
      expect(unlocks.find(u => u.id === 'ivy')).toBeUndefined();
      expect(unlocks.find(u => u.id === 'needle')).toBeUndefined();
    });
  });

  describe('no duplicate unlocks', () => {
    it('does not re-unlock already unlocked items', () => {
      const meta = new MetaProgression();
      // Trigger Le Forgeron unlock (5 wins)
      for (let i = 0; i < 5; i++) meta.recordRun(i + 1, true, 10);

      // 6th win should not re-unlock Forgeron
      const unlocks = meta.recordRun(6, true, 10);
      expect(unlocks.find(u => u.id === 6)).toBeUndefined();
    });
  });

  describe('save/load persistence', () => {
    it('persists state across instances', () => {
      const meta1 = new MetaProgression();
      meta1.recordRun(1, true, 10);
      meta1.recordRun(2, true, 10);

      const meta2 = new MetaProgression();
      const stats = meta2.getStats();
      expect(stats.totalRuns).toBe(2);
      expect(stats.totalWins).toBe(2);
    });
  });

  describe('reset', () => {
    it('resets to defaults', () => {
      const meta = new MetaProgression();
      meta.recordRun(1, true, 10);
      meta.recordRun(2, true, 10);
      meta.recordRun(3, true, 10);

      meta.reset();
      expect(meta.getStats().totalRuns).toBe(0);
      expect(meta.getStats().totalWins).toBe(0);
      expect(meta.getUnlockedSurvivorIds()).toEqual([1]);
      expect(meta.getUnlockedDiceModifierIds()).toEqual(['rusty', 'heavy', 'broken']);
    });
  });

  describe('getUnlockConditionText', () => {
    it('returns dynamic text for Le Forgeron (ID 6)', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockConditionText(6)).toBe('Win 5 more run(s)');
      meta.recordRun(1, true, 10);
      expect(meta.getUnlockConditionText(6)).toBe('Win 4 more run(s)');
    });

    it('returns dynamic text for starters (IDs 2-5)', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockConditionText(2)).toBe('Win 1 more run(s)');
      expect(meta.getUnlockConditionText(3)).toBe('Win 2 more run(s)');
      expect(meta.getUnlockConditionText(4)).toBe('Win 3 more run(s)');
      expect(meta.getUnlockConditionText(5)).toBe('Win 4 more run(s)');
    });

    it('returns fixed text for Le Blindé (ID 7)', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockConditionText(7)).toBe('Win a run with < 3 HP');
    });

    it('returns dynamic text for Le Vétéran (ID 8)', () => {
      const meta = new MetaProgression();
      expect(meta.getUnlockConditionText(8)).toBe('Win with 7 more survivor(s)');
      meta.recordRun(1, true, 10);
      expect(meta.getUnlockConditionText(8)).toBe('Win with 6 more survivor(s)');
    });
  });
});
