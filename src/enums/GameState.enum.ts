/**
 * Game state enum using as const pattern (Vite compatible)
 */
export const GameState = {
  MENU: 'menu',
  SURVIVOR_SELECTION: 'survivor_selection',
  COMBAT: 'combat',
  EVENT: 'event',
  REWARD: 'reward',
  GAMEOVER: 'gameover',
  UNLOCK: 'unlock',
} as const;

export type GameState = typeof GameState[keyof typeof GameState];
