import { Container, Text } from 'pixi.js';
import type { Scene } from '@engine/SceneManager.ts';
import type { GameStateManager } from '@engine/GameStateManager.ts';
import type { InputManager } from '@/input/InputManager.ts';
import { CombatEngine } from '@engine/CombatEngine.ts';
import type { CombatSnapshot } from '@engine/CombatEngine.ts';
import type { Card, EnemyCard } from '@/types/card.types';
import { CardSprite } from '@/sprites/CardSprite.ts';
import { DiceSprite, DICE_SIZE } from '@/sprites/DiceSprite.ts';
import { ButtonSprite } from '@/sprites/ButtonSprite.ts';
import { colors, fonts, spacing } from '@/theme.ts';
import { getLayout } from '@/layout.ts';

export interface CombatData {
  playerCard: Card;
  enemyCard: EnemyCard;
  combatNumber: number;
}

// --- Dice panel (4 dice + labels) ---

class DicePanel extends Container {
  private playerAtkDice: DiceSprite;
  private playerDefDice: DiceSprite;
  private enemyAtkDice: DiceSprite;
  private enemyDefDice: DiceSprite;

  constructor() {
    super();

    const labelStyle = { fontFamily: fonts.body, fontSize: fonts.sizes.small, fill: colors.text };
    const gap = spacing.md;
    const colW = DICE_SIZE + gap;

    // Player column
    const pLabel = new Text({ text: 'PLAYER', style: { ...labelStyle, fontWeight: 'bold', fill: colors.playerAccent } });
    pLabel.anchor.set(0.5, 0);
    pLabel.position.set(colW / 2, 0);
    this.addChild(pLabel);

    const pAtkLabel = new Text({ text: 'ATK', style: labelStyle });
    pAtkLabel.anchor.set(0.5, 0);
    pAtkLabel.position.set(colW / 2, 22);
    this.addChild(pAtkLabel);

    this.playerAtkDice = new DiceSprite(true);
    this.playerAtkDice.position.set(gap / 2, 40);
    this.addChild(this.playerAtkDice);

    const pDefLabel = new Text({ text: 'DEF', style: labelStyle });
    pDefLabel.anchor.set(0.5, 0);
    pDefLabel.position.set(colW / 2, 40 + DICE_SIZE + 6);
    this.addChild(pDefLabel);

    this.playerDefDice = new DiceSprite(true);
    this.playerDefDice.position.set(gap / 2, 40 + DICE_SIZE + 24);
    this.addChild(this.playerDefDice);

    // Enemy column
    const eOffsetX = colW + spacing.xl;

    const eLabel = new Text({ text: 'ENEMY', style: { ...labelStyle, fontWeight: 'bold', fill: colors.enemyAccent } });
    eLabel.anchor.set(0.5, 0);
    eLabel.position.set(eOffsetX + colW / 2, 0);
    this.addChild(eLabel);

    const eAtkLabel = new Text({ text: 'ATK', style: labelStyle });
    eAtkLabel.anchor.set(0.5, 0);
    eAtkLabel.position.set(eOffsetX + colW / 2, 22);
    this.addChild(eAtkLabel);

    this.enemyAtkDice = new DiceSprite(false);
    this.enemyAtkDice.position.set(eOffsetX + gap / 2, 40);
    this.addChild(this.enemyAtkDice);

    const eDefLabel = new Text({ text: 'DEF', style: labelStyle });
    eDefLabel.anchor.set(0.5, 0);
    eDefLabel.position.set(eOffsetX + colW / 2, 40 + DICE_SIZE + 6);
    this.addChild(eDefLabel);

    this.enemyDefDice = new DiceSprite(false);
    this.enemyDefDice.position.set(eOffsetX + gap / 2, 40 + DICE_SIZE + 24);
    this.addChild(this.enemyDefDice);

  }

  rollAll(snap: CombatSnapshot): void {
    this.playerAtkDice.roll(snap.diceResults.playerAttack);
    this.playerDefDice.roll(snap.diceResults.playerDefense);
    this.enemyAtkDice.roll(snap.diceResults.enemyAttack);
    this.enemyDefDice.roll(snap.diceResults.enemyDefense);
  }

  get panelWidth(): number { return (DICE_SIZE + spacing.md) * 2 + spacing.xl; }
  get panelHeight(): number { return 40 + DICE_SIZE * 2 + 24 + spacing.md; }
}

// --- Combat results text panel ---

class ResultsPanel extends Container {
  private playerDmgText: Text;
  private enemyDmgText: Text;
  private finishText: Text;

  constructor() {
    super();

    this.playerDmgText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.damage },
    });
    this.playerDmgText.anchor.set(0.5, 0);
    this.addChild(this.playerDmgText);

    this.enemyDmgText = new Text({
      text: '',
      style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.heal },
    });
    this.enemyDmgText.anchor.set(0.5, 0);
    this.addChild(this.enemyDmgText);

    this.finishText = new Text({
      text: '',
      style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h3, fontWeight: 'bold', fill: colors.focus },
    });
    this.finishText.anchor.set(0.5, 0);
    this.addChild(this.finishText);
  }

  layoutAt(centerX: number, startY: number): void {
    this.playerDmgText.position.set(centerX, startY);
    this.enemyDmgText.position.set(centerX, startY + 24);
    this.finishText.position.set(centerX, startY + 56);
  }

  update(snap: CombatSnapshot): void {
    const r = snap.combatResult;
    if (!r) return;

    this.playerDmgText.text = r.damageToPlayer > 0
      ? `You take -${r.damageToPlayer} HP`
      : 'You take no damage';
    this.playerDmgText.style.fill = r.damageToPlayer > 0 ? colors.damage : colors.heal;

    this.enemyDmgText.text = r.damageToEnemy > 0
      ? `Enemy takes -${r.damageToEnemy} HP`
      : 'Enemy blocked';
    this.enemyDmgText.style.fill = r.damageToEnemy > 0 ? colors.heal : colors.damage;

    if (snap.combatFinished) {
      const won = snap.currentEnemyCard.currentHp <= 0;
      this.finishText.text = won ? 'VICTORY!' : 'DEFEAT...';
      this.finishText.style.fill = won ? colors.focus : colors.damage;
    } else {
      this.finishText.text = '';
    }
  }

  clear(): void {
    this.playerDmgText.text = '';
    this.enemyDmgText.text = '';
    this.finishText.text = '';
  }
}

// --- Main combat scene (v2: 1v1, click to advance) ---

export function createCombatScene(game: GameStateManager, input: InputManager): Scene {
  const root = new Container() as Scene;
  root.label = 'combat';

  let engine: CombatEngine | null = null;
  let engineUnsub: (() => void) | null = null;
  let sw = 800, sh = 600;

  // Header
  const headerText = new Text({
    text: '',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h3, fontWeight: 'bold', fill: colors.text },
  });
  headerText.anchor.set(0.5, 0);
  root.addChild(headerText);

  // Status text (dice rolling / applying damage / click to continue)
  const statusText = new Text({
    text: '',
    style: { fontFamily: fonts.body, fontSize: fonts.sizes.body, fill: colors.focus },
  });
  statusText.anchor.set(0.5, 0);
  root.addChild(statusText);

  // Enemy card (top)
  let enemySprite: CardSprite | null = null;

  // Player card (bottom)
  let playerSprite: CardSprite | null = null;

  // VS label between cards
  const vsText = new Text({
    text: 'VS',
    style: { fontFamily: fonts.heading, fontSize: fonts.sizes.h1, fontWeight: 'bold', fill: colors.focus },
  });
  vsText.anchor.set(0.5);
  root.addChild(vsText);

  // Dice panel
  const dicePanel = new DicePanel();
  root.addChild(dicePanel);

  // Results panel
  const resultsPanel = new ResultsPanel();
  resultsPanel.visible = false;
  root.addChild(resultsPanel);

  // "Next Round" button (shown after round resolves)
  const nextRoundBtn = new ButtonSprite('Next Round', { width: 160 });
  nextRoundBtn.visible = false;
  nextRoundBtn.onPress = () => {
    if (engine && !combatFinished && roundResolved) {
      engine.handleNextRound();
    }
  };
  root.addChild(nextRoundBtn);

  // Focus indicator overlay
  root.addChild(input.focusIndicator);

  // --- State ---
  let roundResolved = false;
  let combatFinished = false;
  let combatNumber = 0;

  // --- Combat update handler ---

  function onCombatUpdate(snap: CombatSnapshot) {
    roundResolved = snap.roundResolved;
    combatFinished = snap.combatFinished;

    // Update header
    headerText.text = `Combat #${combatNumber} — Round ${snap.roundNumber}`;

    // Update card sprites
    enemySprite?.updateCard(snap.currentEnemyCard);
    playerSprite?.updateCard(snap.currentPlayerCard);

    // Show results panel
    if (snap.showResults && snap.combatResult) {
      resultsPanel.visible = true;
      resultsPanel.update(snap);
    }

    // Dice roll for new round
    if (!snap.showResults && !snap.roundResolved) {
      resultsPanel.visible = false;
      resultsPanel.clear();
      dicePanel.rollAll(snap);
    }

    // Update status text and next round button
    if (snap.combatFinished) {
      statusText.text = '';
      nextRoundBtn.visible = false;
    } else if (snap.roundResolved) {
      statusText.text = 'Click to continue';
      nextRoundBtn.visible = true;
      registerNextRoundFocusable();
    } else if (snap.showResults) {
      statusText.text = 'Applying damage...';
      nextRoundBtn.visible = false;
    } else {
      statusText.text = 'Dice rolling...';
      nextRoundBtn.visible = false;
    }

    layout();
  }

  function registerNextRoundFocusable() {
    input.unregisterAll();
    input.register({
      id: 'combat-next-round',
      container: nextRoundBtn,
      onActivate: () => {
        if (engine && !combatFinished && roundResolved) {
          engine.handleNextRound();
        }
      },
    });
  }

  // --- Layout ---

  function layout() {
    const rl = getLayout(sw, sh);
    const centerX = sw / 2;

    headerText.style.fontSize = fonts.sizes.h3 * rl.fontScale;
    statusText.style.fontSize = fonts.sizes.body * rl.fontScale;
    vsText.style.fontSize = fonts.sizes.h1 * rl.fontScale;

    headerText.position.set(centerX, spacing.sm);

    // Scale cards and dice
    if (enemySprite) enemySprite.scale.set(rl.cardScale);
    if (playerSprite) playerSprite.scale.set(rl.cardScale);
    dicePanel.scale.set(rl.diceScale);

    if (rl.isMobile) {
      // Mobile: everything stacked vertically, centered
      const topY = spacing.sm + 30 * rl.fontScale;

      if (enemySprite) {
        enemySprite.position.set(centerX - rl.cardW / 2, topY);
      }

      const vsY = topY + rl.cardH + spacing.xs;
      vsText.position.set(centerX, vsY + 10);

      const playerY = vsY + 24;
      if (playerSprite) {
        playerSprite.position.set(centerX - rl.cardW / 2, playerY);
      }

      const belowCards = playerY + rl.cardH + spacing.sm;

      // Dice panel centered below cards
      const scaledPanelW = dicePanel.panelWidth * rl.diceScale;
      dicePanel.position.set(centerX - scaledPanelW / 2, belowCards);

      const scaledPanelH = dicePanel.panelHeight * rl.diceScale;

      // Results below dice
      resultsPanel.position.set(0, 0);
      resultsPanel.layoutAt(centerX, belowCards + scaledPanelH + spacing.sm);

      // Status + button below results
      statusText.position.set(centerX, belowCards + scaledPanelH + spacing.sm + 60);
      nextRoundBtn.position.set(centerX - nextRoundBtn.buttonWidth / 2, belowCards + scaledPanelH + spacing.sm + 85);
    } else {
      // Desktop: original side-by-side layout
      const cardAreaTop = spacing.sm + 40;
      const cardAreaBottom = sh - rl.cardH - spacing.lg;
      const midY = (cardAreaTop + rl.cardH + cardAreaBottom) / 2;

      if (enemySprite) {
        enemySprite.position.set(centerX - rl.cardW / 2, cardAreaTop);
      }

      if (playerSprite) {
        playerSprite.position.set(centerX - rl.cardW / 2, cardAreaBottom);
      }

      vsText.position.set(centerX, midY);

      // Dice panel to the left of center
      const scaledPanelW = dicePanel.panelWidth * rl.diceScale;
      const diceX = centerX - scaledPanelW - spacing.xl;
      const scaledPanelH = dicePanel.panelHeight * rl.diceScale;
      dicePanel.position.set(Math.max(spacing.md, diceX), midY - scaledPanelH / 2);

      // Results panel to the right of center
      const resultsX = centerX + spacing.xl;
      resultsPanel.position.set(0, 0);
      resultsPanel.layoutAt(Math.min(sw - spacing.md, resultsX + 80), midY - 40);

      // Status text below VS
      statusText.position.set(centerX, midY + 30);

      // Next round button below status
      nextRoundBtn.position.set(centerX - nextRoundBtn.buttonWidth / 2, midY + 55);
    }
  }

  // --- Scene lifecycle ---

  root.onEnter = (data?: unknown) => {
    const d = data as CombatData | undefined;
    if (!d) return;

    combatNumber = d.combatNumber;
    roundResolved = false;
    combatFinished = false;

    headerText.text = `Combat #${combatNumber}`;
    statusText.text = 'Dice rolling...';
    dicePanel.visible = true;
    resultsPanel.visible = false;
    resultsPanel.clear();
    nextRoundBtn.visible = false;

    // Enemy card
    if (enemySprite) {
      root.removeChild(enemySprite);
      enemySprite.destroy();
    }
    enemySprite = new CardSprite(d.enemyCard);
    root.addChildAt(enemySprite, 0);

    // Player card
    if (playerSprite) {
      root.removeChild(playerSprite);
      playerSprite.destroy();
    }
    playerSprite = new CardSprite(d.playerCard);
    root.addChildAt(playerSprite, 1);

    // Start combat immediately
    engine = new CombatEngine({
      playerCard: d.playerCard,
      enemyCard: d.enemyCard,
      onCombatEnd: (result) => game.handleCombatEnd(result),
      onCardUpdate: (p, e) => game.handleCardUpdate(p, e),
    });

    engineUnsub = engine.onChange(onCombatUpdate);
    dicePanel.rollAll(engine.snapshot());

    input.unregisterAll();
    root.addChild(input.focusIndicator);
    layout();
  };

  root.onExit = () => {
    input.unregisterAll();
    engineUnsub?.();
    engineUnsub = null;
    engine?.destroy();
    engine = null;
  };

  root.onResize = (w: number, h: number) => {
    sw = w; sh = h;
    layout();
  };

  return root;
}
