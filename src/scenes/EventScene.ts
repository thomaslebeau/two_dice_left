import { Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import type { GameEvent, EventChoice, EventEffect } from '@/types/event.types';
import type { DiceModifier } from '@/types/diceModifier.types';
import type { Card } from '@/types/card.types';
import { DICE_MODIFIERS } from '@shared/constants/diceModifiers';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

export interface EventData {
  combatNumber: number;
  currentEvent: GameEvent | null;
  survivor: Card | null;
  atkBonus: number;
  defBonus: number;
  diceModifiers: DiceModifier[];
}

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  workshop: 'Workshop',
  diceForge: 'Dice Forge',
  encounter: 'Encounter',
  salvage: 'Salvage',
};

// Category accent colors
const CATEGORY_COLORS: Record<string, number> = {
  workshop: colors.focus,
  diceForge: 0xD4A030,
  encounter: 0x6AAED6,
  salvage: 0xB0A894,
};

/**
 * Format effect list as human-readable text.
 */
function formatEffects(effects: EventEffect[]): string {
  return effects.map(e => {
    switch (e.type) {
      case 'hp': return `${e.value > 0 ? '+' : ''}${e.value} HP`;
      case 'atk': return `${e.value > 0 ? '+' : ''}${e.value} ATK`;
      case 'def': return `${e.value > 0 ? '+' : ''}${e.value} DEF`;
      case 'diceModifier': {
        const mod = e.modifierId ? DICE_MODIFIERS[e.modifierId] : null;
        return mod ? `Equip: ${mod.name}` : 'Dice modifier';
      }
    }
  }).join(', ');
}

// ─── Choice Panel ─────────────────────────────────────────────────────

const PANEL_WIDTH = 340;
const PANEL_PADDING = spacing.md;

class ChoicePanel extends Container {
  private bg = new Graphics();
  private _width = PANEL_WIDTH;
  private _height = 0;
  private _enabled = true;

  onPress: (() => void) | null = null;

  constructor(choice: EventChoice, accentColor: number) {
    super();
    this.addChild(this.bg);

    let yOff = PANEL_PADDING;
    const textW = this._width - PANEL_PADDING * 2;

    // Label
    const label = new Text({
      text: choice.label,
      style: {
        fontFamily: fonts.heading,
        fontSize: fonts.sizes.h3,
        fontWeight: 'bold',
        fill: accentColor,
        wordWrap: true,
        wordWrapWidth: textW,
      },
    });
    label.position.set(PANEL_PADDING, yOff);
    this.addChild(label);
    yOff += label.height + spacing.xs;

    // Description
    const desc = new Text({
      text: choice.description,
      style: {
        fontFamily: fonts.body,
        fontSize: fonts.sizes.body,
        fill: colors.text,
        wordWrap: true,
        wordWrapWidth: textW,
      },
    });
    desc.position.set(PANEL_PADDING, yOff);
    this.addChild(desc);
    yOff += desc.height + spacing.sm;

    // Effect summary
    const effectStr = formatEffects(choice.effects);
    if (effectStr) {
      const effectText = new Text({
        text: effectStr,
        style: {
          fontFamily: fonts.body,
          fontSize: fonts.sizes.body,
          fontWeight: 'bold',
          fill: colors.focus,
        },
      });
      effectText.position.set(PANEL_PADDING, yOff);
      this.addChild(effectText);
      yOff += effectText.height + spacing.xs;
    }

    // Risk info
    if (choice.risk) {
      const pct = Math.round(choice.risk.chance * 100);
      const failStr = formatEffects(choice.risk.failEffects);
      const riskText = new Text({
        text: `Risk: ${pct}% success — fail: ${failStr}`,
        style: {
          fontFamily: fonts.body,
          fontSize: fonts.sizes.small,
          fill: colors.damage,
        },
      });
      riskText.position.set(PANEL_PADDING, yOff);
      this.addChild(riskText);
      yOff += riskText.height + spacing.xs;
    }

    // Dice modifier faces preview
    const modEffect = choice.effects.find(e => e.type === 'diceModifier');
    if (modEffect?.modifierId) {
      const mod = DICE_MODIFIERS[modEffect.modifierId];
      if (mod) {
        const facesStr = `Faces: [${mod.faces.join(', ')}]`;
        const facesText = new Text({
          text: facesStr,
          style: {
            fontFamily: fonts.body,
            fontSize: fonts.sizes.small,
            fill: 0xD4A030,
          },
        });
        facesText.position.set(PANEL_PADDING, yOff);
        this.addChild(facesText);
        yOff += facesText.height + spacing.xs;
      }
    }

    this._height = yOff + PANEL_PADDING;
    this.drawBg(accentColor);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', this.handlePress, this);
    this.on('pointerover', () => { if (this._enabled) this.alpha = 0.85; });
    this.on('pointerout', () => { this.alpha = this._enabled ? 1 : 0.4; });
  }

  get panelWidth(): number { return this._width; }
  get panelHeight(): number { return this._height; }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.4;
  }

  setPanelWidth(w: number): void {
    this._width = w;
    // Redraw bg only (text positions set externally or at creation)
    this.drawBg(colors.primary);
  }

  private drawBg(accentColor: number): void {
    this.bg.clear();
    this.bg.rect(0, 0, this._width, this._height);
    this.bg.fill({ color: colors.cardBg, alpha: colors.cardBgAlpha });
    this.bg.rect(0, 0, this._width, this._height);
    this.bg.stroke({ color: accentColor, width: 2 });
  }

  private handlePress(): void {
    if (!this._enabled) return;
    this.onPress?.();
  }
}

// ─── Event Scene ──────────────────────────────────────────────────────

export function createEventScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'event';

  let sw = 800, sh = 600;
  let choicePanels: ChoicePanel[] = [];
  let choicesLocked = false;
  let currentData: EventData | null = null;

  // --- Static text elements ---

  const categoryText = new Text({
    text: '',
    style: {
      fontFamily: fonts.heading,
      fontSize: fonts.sizes.h2,
      fontWeight: 'bold',
      fill: colors.focus,
    },
  });
  categoryText.anchor.set(0.5, 0);
  root.addChild(categoryText);

  const flavorText = new Text({
    text: '',
    style: {
      fontFamily: fonts.body,
      fontSize: fonts.sizes.body,
      fill: colors.text,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 500,
    },
  });
  flavorText.anchor.set(0.5, 0);
  root.addChild(flavorText);

  const hudText = new Text({
    text: '',
    style: {
      fontFamily: fonts.body,
      fontSize: fonts.sizes.small,
      fill: colors.text,
    },
  });
  hudText.anchor.set(0.5, 0);
  hudText.alpha = 0.7;
  root.addChild(hudText);

  // Result feedback text (shown after choice)
  const resultText = new Text({
    text: '',
    style: {
      fontFamily: fonts.heading,
      fontSize: fonts.sizes.h3,
      fontWeight: 'bold',
      fill: colors.focus,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 400,
    },
  });
  resultText.anchor.set(0.5, 0);
  resultText.visible = false;
  root.addChild(resultText);

  // Continue button (shown after choice result)
  const continueBtn = new ButtonSprite('Continue', { color: colors.primary });
  continueBtn.visible = false;
  continueBtn.onPress = () => {
    continueBtn.visible = false;
    game.handleEventContinue();
  };
  root.addChild(continueBtn);

  // Choice container
  const choicesContainer = new Container();
  root.addChild(choicesContainer);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- Helpers ---

  function clearChoices(): void {
    for (const p of choicePanels) {
      choicesContainer.removeChild(p);
      p.destroy();
    }
    choicePanels = [];
  }

  function buildHud(d: EventData): void {
    const parts = [`HP: ${d.survivor?.currentHp ?? '?'}/${d.survivor?.maxHp ?? '?'}`];
    if (d.atkBonus) parts.push(`ATK +${d.atkBonus}`);
    if (d.defBonus) parts.push(`DEF +${d.defBonus}`);
    if (d.diceModifiers.length > 0) {
      parts.push(`Dice: ${d.diceModifiers.map(m => m.name).join(', ')}`);
    }
    hudText.text = parts.join('  |  ');
  }

  function buildChoices(event: GameEvent): void {
    clearChoices();
    const accent = CATEGORY_COLORS[event.category] ?? colors.focus;
    const { fontScale } = getLayout(sw, sh);
    const panelW = Math.min(PANEL_WIDTH, sw - spacing.xl * 2);

    event.choices.forEach((choice, i) => {
      const panel = new ChoicePanel(choice, accent);
      panel.setPanelWidth(panelW);
      panel.onPress = () => handleChoice(i);
      choicesContainer.addChild(panel);
      choicePanels.push(panel);

      input.register({
        id: `event-choice-${i}`,
        container: panel,
        onActivate: () => handleChoice(i),
      });
    });

    layoutChoices(fontScale);
  }

  function handleChoice(index: number): void {
    if (choicesLocked) return;
    choicesLocked = true;

    // Disable all panels
    for (const p of choicePanels) p.setEnabled(false);

    const result = game.handleEventChoice(index);

    // Show result feedback
    const effectStr = formatEffects(result.effects);
    if (result.riskSucceeded !== undefined) {
      resultText.text = result.riskSucceeded
        ? `Success! ${effectStr}`
        : `Failed... ${effectStr}`;
      resultText.style.fill = result.riskSucceeded ? colors.focus : colors.damage;
    } else {
      resultText.text = effectStr || 'Nothing happened.';
      resultText.style.fill = colors.focus;
    }
    resultText.visible = true;
    continueBtn.visible = true;

    // Update HUD to reflect new state after effects applied
    if (currentData) {
      const snap = game.snapshot();
      currentData.survivor = snap.survivor;
      currentData.atkBonus = snap.atkBonus;
      currentData.defBonus = snap.defBonus;
      currentData.diceModifiers = snap.diceModifiers;
      buildHud(currentData);
    }

    input.register({
      id: 'event-continue',
      container: continueBtn,
      onActivate: () => {
        continueBtn.visible = false;
        game.handleEventContinue();
      },
    });

    layoutAll();
  }

  // --- Layout ---

  function layoutChoices(fontScale: number): void {
    let yOff = 0;
    for (const p of choicePanels) {
      const px = (sw - p.panelWidth) / 2;
      p.position.set(px, yOff);
      yOff += p.panelHeight + spacing.sm;
    }
    // Center the choices container vertically
    const totalH = yOff - spacing.sm;
    const topArea = sh * 0.30 * fontScale; // space used by title + flavor
    const availH = sh - topArea - 60; // 60 for bottom HUD
    const startY = topArea + Math.max(0, (availH - totalH) / 2);
    choicesContainer.position.set(0, startY);
  }

  function layoutAll(): void {
    const { fontScale } = getLayout(sw, sh);
    const cx = sw / 2;

    categoryText.style.fontSize = fonts.sizes.h2 * fontScale;
    flavorText.style.fontSize = fonts.sizes.body * fontScale;
    hudText.style.fontSize = fonts.sizes.small * fontScale;
    flavorText.style.wordWrapWidth = Math.min(500, sw - 40);

    categoryText.position.set(cx, spacing.xl * fontScale);
    flavorText.position.set(cx, spacing.xl * fontScale + categoryText.height + spacing.sm);

    hudText.position.set(cx, sh - 30 * fontScale);

    resultText.style.fontSize = fonts.sizes.h3 * fontScale;
    resultText.style.wordWrapWidth = Math.min(400, sw - 40);
    // Position result text and continue button below choices
    if (resultText.visible) {
      const choicesBottom = choicesContainer.y + choicesContainer.height;
      resultText.position.set(cx, choicesBottom + spacing.md);

      if (continueBtn.visible) {
        const btnY = resultText.y + resultText.height + spacing.md;
        continueBtn.position.set(cx - continueBtn.buttonWidth / 2, btnY);
      }
    }

    layoutChoices(fontScale);
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    currentData = (data as EventData | undefined) ?? null;
    choicesLocked = false;
    resultText.visible = false;
    continueBtn.visible = false;

    input.unregisterAll();

    if (!currentData?.currentEvent) {
      categoryText.text = 'Event';
      flavorText.text = 'Something stirs in the ruins...';
      clearChoices();
      layoutAll();
      return;
    }

    const event = currentData.currentEvent;
    const accent = CATEGORY_COLORS[event.category] ?? colors.focus;

    categoryText.text = CATEGORY_LABELS[event.category] ?? 'Event';
    categoryText.style.fill = accent;
    flavorText.text = event.flavorText;

    buildHud(currentData);
    buildChoices(event);
    layoutAll();
  };

  root.onExit = () => {
    input.unregisterAll();
    clearChoices();
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layoutAll();
  };

  return root;
}
