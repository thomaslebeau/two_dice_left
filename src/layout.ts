import { CARD_WIDTH, CARD_HEIGHT } from '@/sprites/CardSprite.ts';
import { DICE_SIZE } from '@/sprites/DiceSprite.ts';

export interface ResponsiveLayout {
  // Scale factors
  cardScale: number;
  diceScale: number;
  fontScale: number;

  // Responsive font sizes (in px) — prefer these over fonts.sizes * fontScale
  fontSize: {
    h1: number;
    h2: number;
    h3: number;
    body: number;
    small: number;
  };

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
  const cardScale = clamp(sw / 800, 0.55, 1.0);
  const diceScale = clamp(sw / 700, 0.6, 1.0);
  const fontScale = clamp(sw / 800, 0.7, 1.0);

  const fontSize = {
    h1:    clamp(sw * 0.06,  28, 48),
    h2:    clamp(sw * 0.04,  22, 32),
    h3:    clamp(sw * 0.03,  18, 24),
    body:  clamp(sw * 0.024, 16, 18),
    small: clamp(sw * 0.02,  14, 16),
  };

  return {
    cardScale,
    diceScale,
    fontScale,
    fontSize,
    cardW: CARD_WIDTH * cardScale,
    cardH: CARD_HEIGHT * cardScale,
    diceS: DICE_SIZE * diceScale,
    isMobile: sw < 600,
    isNarrow: sw < 480,
  };
}
