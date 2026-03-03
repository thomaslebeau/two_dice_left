/**
 * V6 entry point — wires V6RunOrchestrator to Pixi SceneManager.
 *
 * Registers 4 scenes: survivor_select, combat, event, end.
 * The orchestrator emits transitions; main.ts maps them to switchTo().
 */

import { Application, Container, Graphics, Text } from 'pixi.js';
import { SceneManager } from './engine/SceneManager.ts';
import type { Scene } from './engine/SceneManager.ts';
import { V6RunOrchestrator } from './core/V6RunOrchestrator.ts';
import { CombatScene } from './ui/combat/CombatScene.ts';
import type { CombatSceneData } from './ui/combat/CombatScene.ts';
import { EventScene } from './ui/event/EventScene.ts';
import type { EventSceneData } from './ui/event/EventScene.ts';
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

function getUnlockedSurvivors(): Survivor[] {
  const slugs = getUnlockedSlugs();
  const ids = new Set(slugs.map(s => SLUG_TO_ID[s]).filter(Boolean));
  return ALL_SURVIVORS.filter(s => ids.has(s.id));
}

// ---------------------------------------------------------------------------
// Minimal survivor selection scene
// ---------------------------------------------------------------------------

function createSurvivorSelectScene(
  orchestrator: V6RunOrchestrator,
): Scene {
  const scene = new Container() as Scene;

  // Game title
  const gameTitle = new Text({
    text: 'TWO DICE LEFT',
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 28,
      fontWeight: 'bold',
      fill: BONE,
      letterSpacing: 4,
    },
  });
  gameTitle.anchor.set(0.5);
  scene.addChild(gameTitle);

  // Subtitle
  const subtitle = new Text({
    text: 'CHOISIS TON SURVIVANT',
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 16,
      fontWeight: 'bold',
      fill: RUST,
      letterSpacing: 2,
    },
  });
  subtitle.anchor.set(0.5);
  scene.addChild(subtitle);

  const buttons: Container[] = [];
  let sw = 390;
  let sh = 844;

  function layoutAll(): void {
    const cx = sw / 2;

    gameTitle.position.set(cx, sh * 0.15);
    subtitle.position.set(cx, gameTitle.y + 50);

    const btnW = Math.min(340, sw - 40);
    const btnH = 52;
    const gap = 10;
    let cardY = subtitle.y + 40;

    for (const btn of buttons) {
      btn.position.set(cx - btnW / 2, cardY);
      const bg = btn.getChildAt(0) as Graphics;
      bg.clear();
      bg.roundRect(0, 0, btnW, btnH, 6);
      bg.fill({ color: CHARCOAL, alpha: 0.9 });
      bg.roundRect(0, 0, btnW, btnH, 6);
      bg.stroke({ color: RUST, width: 2 });
      cardY += btnH + gap;
    }
  }

  function rebuildButtons(): void {
    for (const btn of buttons) {
      scene.removeChild(btn);
      btn.destroy({ children: true });
    }
    buttons.length = 0;

    const survivors = getUnlockedSurvivors();
    for (const s of survivors) {
      const btn = new Container();
      const bg = new Graphics();
      const eqNames = s.equipment.map(e => e.name).join(', ');
      const label = new Text({
        text: `${s.name}\n${s.hp} PV | ${eqNames}`,
        style: {
          fontFamily: '"Courier New", monospace',
          fontSize: 13,
          fill: BONE,
          lineHeight: 18,
        },
      });
      label.position.set(12, 8);
      btn.addChild(bg, label);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointerdown', () => orchestrator.selectSurvivor(s.id));
      btn.on('pointerover', () => { btn.alpha = 0.8; });
      btn.on('pointerout', () => { btn.alpha = 1; });
      scene.addChild(btn);
      buttons.push(btn);
    }
    layoutAll();
  }

  scene.onEnter = () => {
    rebuildButtons();
  };

  scene.onResize = (w: number, h: number) => {
    sw = w;
    sh = h;
    layoutAll();
  };

  return scene;
}

// ---------------------------------------------------------------------------
// End screen (victory/defeat) with restart
// ---------------------------------------------------------------------------

function createEndScene(orchestrator: V6RunOrchestrator): Scene {
  const scene = new Container() as Scene;

  const heading = new Text({
    text: '',
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 28,
      fontWeight: 'bold',
      fill: BONE,
      letterSpacing: 3,
    },
  });
  heading.anchor.set(0.5);
  scene.addChild(heading);

  const detail = new Text({
    text: '',
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 14,
      fill: BONE,
    },
  });
  detail.anchor.set(0.5);
  scene.addChild(detail);

  const restartBg = new Graphics();
  const restartLabel = new Text({
    text: 'REJOUER',
    style: {
      fontFamily: '"Courier New", monospace',
      fontSize: 16,
      fontWeight: 'bold',
      fill: BONE,
      letterSpacing: 2,
    },
  });
  restartLabel.anchor.set(0.5);
  const restartBtn = new Container();
  restartBtn.addChild(restartBg, restartLabel);
  restartBtn.eventMode = 'static';
  restartBtn.cursor = 'pointer';
  restartBtn.on('pointerdown', () => orchestrator.startRun());
  restartBtn.on('pointerover', () => { restartBtn.alpha = 0.8; });
  restartBtn.on('pointerout', () => { restartBtn.alpha = 1; });
  scene.addChild(restartBtn);

  scene.onEnter = (data?: unknown) => {
    const d = data as {
      victory: boolean;
      survivorName: string;
      detail: string;
    };
    heading.text = d.victory ? 'VICTOIRE' : 'DEFAITE';
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
  const combatScene = new CombatScene();
  const eventScene = new EventScene();

  scenes.register('survivor_select', createSurvivorSelectScene(orchestrator));
  scenes.register('combat', combatScene);
  scenes.register('event', eventScene);
  scenes.register('end', createEndScene(orchestrator));

  // --- Wire orchestrator → scene transitions ---
  orchestrator.onChange((t) => {
    switch (t.scene) {
      case 'survivor_select':
        scenes.switchTo('survivor_select');
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
          detail: `${t.playerHp} PV restants`,
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
          detail: `Combat ${t.combatNumber}/5`,
        });
        break;
      }
    }
  });

  // --- Resize handler ---
  function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    app.renderer.resize(w, h);
    scenes.resize(w, h);
  }

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 150);
  });

  // --- Start ---
  orchestrator.startRun();
}

main();
