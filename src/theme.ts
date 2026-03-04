/**
 * Design tokens extracted from SCSS variables.
 * Living Wild theme — flat aesthetic, nature/forest palette.
 */

// --- Colors ---

export const colors = {
  // Base
  primary: 0x2D5A1E,
  secondary: 0xA83232,
  background: 0x0D1410,
  text: 0xE2DDD0,
  focus: 0x7ED957,

  // Player
  player: 0x2D5A1E,
  playerLight: 0x3E7A2A,
  playerAccent: 0x4A9E32,

  // Enemy
  enemy: 0xA83232,
  enemyDark: 0x5C1818,
  enemyAccent: 0xD44040,

  // HP
  hp: 0xD44040,
  hpBar: 0x4A9E32,
  hpBarLight: 0x7ED957,

  // Damage / Heal
  damage: 0xD44040,
  heal: 0x7ED957,

  // UI surfaces (as solid hex — alpha handled per-draw)
  cardBg: 0x141E18,
  cardBgAlpha: 0.9,
  containerBg: 0x0D1410,
  containerBgAlpha: 0.9,
  overlayBg: 0x1C2B22,
  overlayBgAlpha: 0.8,
  darkOverlay: 0x000000,
  darkOverlayAlpha: 0.3,
} as const;

// Rarity colors (mirrors RARITY_COLORS in cards.ts but as hex numbers for Pixi)
export const rarityColors = {
  common: 0xB0A894,
  uncommon: 0x4A9E32,
  rare: 0xD4A030,
  epic: 0xA8E060,
} as const;

// --- Spacing (in pixels) ---

export const spacing = {
  xs: 5,
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
  xxl: 40,
} as const;

// --- Borders ---

export const borders = {
  radiusSm: 0,
  radiusMd: 0,
  radiusLg: 0,
  widthThin: 2,
  widthMedium: 3,
} as const;

// --- Typography ---

export const fonts = {
  heading: 'Crimson Text, Georgia, serif',
  body: 'Inter, system-ui, sans-serif',
  sizes: {
    h1: 48,
    h2: 32,
    h3: 24,
    body: 16,
    small: 12,
  },
} as const;

// --- Animation timings (ms) ---

export const timings = {
  diceRoll: 2100,
  resultDelay: 1000,
  combatEndDelay: 2000,
  hoverTransition: 200,
  cardHoverLift: 5,
  focusedScale: 1.05,
  passivePopupDuration: 600,
  passiveGlowDuration: 300,
  passiveBannerHold: 800,
  recycleurSpinDuration: 400,
} as const;
