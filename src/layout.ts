import { CARD_WIDTH, CARD_HEIGHT } from '@/sprites/CardSprite.ts';
import { DICE_SIZE } from '@/sprites/DiceSprite.ts';

export interface ResponsiveLayout {
  // Scale factors
  cardScale: number;
  diceScale: number;
  fontScale: number;

  // Derived card dimensions (for positioning math)
  cardW: number;
  cardH: number;
  diceS: number;

  // Layout mode
  isMobile: boolean;  // sw < 600
  isNarrow: boolean;  // sw < 480
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function getLayout(sw: number, _sh: number): ResponsiveLayout {
  const cardScale = clamp(sw / 900, 0.5, 1.0);
  const diceScale = clamp(sw / 700, 0.6, 1.0);
  const fontScale = clamp(sw / 800, 0.65, 1.0);

  return {
    cardScale,
    diceScale,
    fontScale,
    cardW: CARD_WIDTH * cardScale,
    cardH: CARD_HEIGHT * cardScale,
    diceS: DICE_SIZE * diceScale,
    isMobile: sw < 600,
    isNarrow: sw < 480,
  };
}
