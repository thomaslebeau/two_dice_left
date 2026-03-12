/**
 * V6 entry point — wires V6RunOrchestrator to Pixi SceneManager.
 *
 * Registers 4 scenes: survivor_select, combat, event, end.
 * The orchestrator emits transitions; main.ts maps them to switchTo().
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import { FONTS } from './theme.ts';
import { STRINGS } from './data/strings.ts';
import { SceneManager } from './engine/SceneManager.ts';
import type { Scene } from './engine/SceneManager.ts';
import { V6RunOrchestrator } from './core/V6RunOrchestrator.ts';
import { CombatScene } from './ui/combat/CombatScene.ts';
import type { CombatSceneData } from './ui/combat/CombatScene.ts';
import { EventScene } from './ui/event/EventScene.ts';
import type { EventSceneData } from './ui/event/EventScene.ts';
import { SurvivorSelectionScene } from './ui/menu/SurvivorSelectionScene.ts';
import type { SurvivorSelectionData } from './ui/menu/SurvivorSelectionScene.ts';
import { TitleScene } from './ui/menu/TitleScene.ts';
import type { TitleSceneData } from './ui/menu/TitleScene.ts';
import { ALL_SURVIVORS } from './data/survivors.ts';
import type { Survivor } from './engine/types.ts';
import { sendRunData } from './core/Telemetry.ts';

// ---------------------------------------------------------------------------
// V6 palette (matches combat/event scenes)
// ---------------------------------------------------------------------------

const BONE = 0xD9CFBA;
const RUST = 0x8B3A1A;
const MOSS = 0x2D4A2E;
const CHARCOAL = 0x1A1A1A;

// ---------------------------------------------------------------------------
// Survivor unlock system (localStorage)
// ---------------------------------------------------------------------------

const LS_KEY = 'tdl_unlocked';

/** Slug ↔ numeric ID mapping */
const SLUG_TO_ID: Record<string, number> = {
  'le-rescape': 1,
  'la-sentinelle': 2,
  'le-bricoleur': 3,
  'la-coureuse': 4,
  'le-mecanicien': 5,
};
const DEFAULT_UNLOCKED: string[] = ['le-rescape'];

function getUnlockedSlugs(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_UNLOCKED];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
      return parsed as string[];
    }
  } catch { /* corrupt data — reset */ }
  return [...DEFAULT_UNLOCKED];
}

function setUnlockedSlugs(slugs: string[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(slugs));
}

// ---------------------------------------------------------------------------
// Survivor selection scene (SurvivorCard-based)
// ---------------------------------------------------------------------------

function buildSurvivorSelectData(
  orchestrator: V6RunOrchestrator,
): SurvivorSelectionData {
  const unlockedIds = getUnlockedSlugs()
    .map(s => SLUG_TO_ID[s])
    .filter(Boolean);
  return {
    survivors: ALL_SURVIVORS,
    unlockedIds,
    onSelect: (survivor: Survivor) => {
      orchestrator.selectSurvivor(survivor.id);
    },
  };
}

// ---------------------------------------------------------------------------
// End screen (victory/defeat) with restart
// ---------------------------------------------------------------------------

function createEndScene(onRestart: () => void): Scene {
  const scene = new Container() as Scene;

  const heading = new Text({
    text: '',
    style: {
      fontFamily: FONTS.HEADING,
      fontSize: 32,
      fontWeight: 'bold',
      fill: BONE,
      letterSpacing: 6,
    },
  });
  heading.anchor.set(0.5);
  scene.addChild(heading);

  const detail = new Text({
    text: '',
    style: {
      fontFamily: FONTS.BODY,
      fontSize: 16,
      fill: BONE,
    },
  });
  detail.anchor.set(0.5);
  scene.addChild(detail);

  const restartBg = new Graphics();
  const restartLabel = new Text({
    text: STRINGS.RESTART,
    style: {
      fontFamily: FONTS.HEADING,
      fontSize: 20,
      fontWeight: 'bold',
      fill: BONE,
      letterSpacing: 3,
    },
  });
  restartLabel.anchor.set(0.5);
  const restartBtn = new Container();
  restartBtn.addChild(restartBg, restartLabel);
  restartBtn.eventMode = 'static';
  restartBtn.cursor = 'pointer';
  restartBtn.on('pointerdown', () => onRestart());
  restartBtn.on('pointerover', () => { restartBtn.alpha = 0.8; });
  restartBtn.on('pointerout', () => { restartBtn.alpha = 1; });
  scene.addChild(restartBtn);

  scene.onEnter = (data?: unknown) => {
    const d = data as {
      victory: boolean;
      survivorName: string;
      detail: string;
    };
    heading.text = d.victory ? STRINGS.VICTORY : STRINGS.DEFEAT;
    heading.style.fill = d.victory ? MOSS : RUST;
    detail.text = `${d.survivorName} — ${d.detail}`;
  };

  scene.onResize = (w: number, h: number) => {
    const cy = h / 2 - 40;
    heading.position.set(w / 2, cy);
    detail.position.set(w / 2, cy + 50);
    const btnW = 180;
    const btnH = 48;
    restartBtn.position.set((w - btnW) / 2, cy + 100);
    restartLabel.position.set(btnW / 2, btnH / 2);
    restartBg.clear();
    restartBg.roundRect(0, 0, btnW, btnH, 6);
    restartBg.fill({ color: CHARCOAL, alpha: 0.9 });
    restartBg.roundRect(0, 0, btnW, btnH, 6);
    restartBg.stroke({ color: RUST, width: 2 });
  };

  return scene;
}

// ---------------------------------------------------------------------------
// Console debug commands: window.tdl
// ---------------------------------------------------------------------------

interface TdlDebug {
  unlock(slug: string): string;
  unlockAll(): string;
  reset(): string;
  status(): string;
}

const ALL_SLUGS = Object.keys(SLUG_TO_ID);

const tdl: TdlDebug = {
  unlock(slug: string): string {
    if (!SLUG_TO_ID[slug]) {
      return `Unknown slug "${slug}". Valid: ${ALL_SLUGS.join(', ')}`;
    }
    const current = getUnlockedSlugs();
    if (current.includes(slug)) return `"${slug}" already unlocked.`;
    current.push(slug);
    setUnlockedSlugs(current);
    return `Unlocked "${slug}". Reload or start new run to see changes.`;
  },
  unlockAll(): string {
    setUnlockedSlugs([...ALL_SLUGS]);
    return `All survivors unlocked: ${ALL_SLUGS.join(', ')}. Reload or start new run.`;
  },
  reset(): string {
    localStorage.removeItem(LS_KEY);
    return `Reset to default (le-rescape only). Reload or start new run.`;
  },
  status(): string {
    const slugs = getUnlockedSlugs();
    const locked = ALL_SLUGS.filter(s => !slugs.includes(s));
    return [
      `Unlocked: ${slugs.join(', ') || '(none)'}`,
      `Locked:   ${locked.join(', ') || '(none)'}`,
    ].join('\n');
  },
};

(window as unknown as Record<string, unknown>).tdl = tdl;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  await document.fonts.ready;

  const app = new Application();
  await app.init({
    background: CHARCOAL,
    antialias: true,
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  const canvas = app.canvas;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  document.body.appendChild(canvas);

  const orchestrator = new V6RunOrchestrator();
  const scenes = new SceneManager(app);

  // --- Register scenes ---
  const titleScene = new TitleScene();
  const survivorSelectScene = new SurvivorSelectionScene();
  const combatScene = new CombatScene();
  const eventScene = new EventScene();

  scenes.register('title', titleScene);
  scenes.register('survivor_select', survivorSelectScene);
  scenes.register('combat', combatScene);
  scenes.register('event', eventScene);
  scenes.register('end', createEndScene(() => showTitle()));

  // --- Wire orchestrator → scene transitions ---
  orchestrator.onChange((t) => {
    switch (t.scene) {
      case 'survivor_select':
        scenes.switchTo('survivor_select', buildSurvivorSelectData(orchestrator));
        break;

      case 'combat': {
        const combatData: CombatSceneData = {
          survivor: t.survivor,
          enemy: t.enemy,
          playerHp: t.playerHp,
          playerMaxHp: t.playerMaxHp,
          playerEquipment: t.equipment,
          passiveId: t.passiveId,
          passiveState: t.passiveState,
          onCombatEnd: (won, hpAfter, speedKill) => {
            orchestrator.handleCombatEnd(won, hpAfter, speedKill);
          },
        };
        scenes.switchTo('combat', combatData);
        break;
      }

      case 'event': {
        const eventData: EventSceneData = {
          survivor: t.survivor,
          playerHp: t.playerHp,
          playerMaxHp: t.playerMaxHp,
          playerEquipment: t.equipment,
          combatNumber: t.combatNumber,
          onEventEnd: (updatedEquipment, updatedHp) => {
            orchestrator.handleEventEnd(updatedEquipment, updatedHp);
          },
        };
        scenes.switchTo('event', eventData);
        break;
      }

      case 'victory': {
        const snap = orchestrator.snapshot();
        sendRunData({
          survivorId: t.survivor.id,
          survivorName: t.survivor.name,
          victory: true,
          combatReached: 5,
          finalHP: t.playerHp,
          maxHP: snap.playerMaxHp,
          equipment: snap.equipment.map(e => e.name).join(', '),
        });
        scenes.switchTo('end', {
          victory: true,
          survivorName: t.survivor.name,
          detail: STRINGS.END_HP_REMAINING(t.playerHp),
        });
        break;
      }

      case 'defeat': {
        const snap = orchestrator.snapshot();
        sendRunData({
          survivorId: t.survivor.id,
          survivorName: t.survivor.name,
          victory: false,
          combatReached: t.combatNumber,
          finalHP: 0,
          maxHP: snap.playerMaxHp,
          equipment: snap.equipment.map(e => e.name).join(', '),
        });
        scenes.switchTo('end', {
          victory: false,
          survivorName: t.survivor.name,
          detail: STRINGS.END_COMBAT_REACHED(t.combatNumber),
        });
        break;
      }
    }
  });

  // --- Resize handler ---
  // Read safe-area-inset-bottom from a sentinel div (set in index.html).
  // Scenes receive the usable height so buttons stay above the home indicator.
  const safeAreaProbe = document.getElementById('safe-area-probe');

  function handleResize() {
    const vp = window.visualViewport;
    const w = vp ? vp.width : window.innerWidth;
    const h = vp ? vp.height : window.innerHeight;
    app.renderer.resize(w, h);
    const safeBottom = safeAreaProbe?.offsetHeight ?? 0;
    scenes.resize(w, h - safeBottom);
  }

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 150);
  });
  window.visualViewport?.addEventListener('resize', handleResize);

  // Initial safe-area measurement before first scene loads
  handleResize();

  // --- Helper: show title screen ---
  function showTitle(): void {
    const titleData: TitleSceneData = {
      onContinue: () => orchestrator.startRun(),
    };
    scenes.switchTo('title', titleData);
  }

  // --- Start ---
  showTitle();
}

main();