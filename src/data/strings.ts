/**
 * Centralized player-facing strings.
 * Single source of truth for all displayed text.
 * To switch language: duplicate this file and swap the import.
 */

export const STRINGS = {
  // UI
  TITLE: 'TWO DICE LEFT',
  SUBTITLE: 'You have two dice left. Make them count.',
  TAP_TO_START: 'TAP TO CONTINUE',
  CHOOSE_SURVIVOR: 'CHOOSE A SURVIVOR',
  START: 'START',
  CONFIRM: 'CONFIRM',
  VALIDATE: 'VALIDATE',
  CANCEL: 'CANCEL',
  ADJUST: 'ADJUST',
  REPAIR: 'HEAL',
  RESTART: 'PLAY AGAIN',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
  LOCKED: '???',
  DRAG_HINT: 'DRAG A DIE TO A SLOT',
  NO_DAMAGE: 'No damage',

  // Tutorial
  TUTO_PHASE1: 'This is your enemy. They have weapons \u{1F5E1} and shields \u{1F6E1}. Their dice are already placed \u2014 you can see what they\'ll do this turn.',
  TUTO_PHASE2: 'These are your dice and equipment. Drag each die into a slot to assign it. Tap a placed die to remove it. When both dice are placed, tap VALIDATE.',
  TUTO_NEXT: 'NEXT',
  TUTO_GOT_IT: 'GOT IT',
  TUTO_SKIP: 'SKIP',
  SPEED_KILL: (hp: number) => `Speed kill! +${hp} HP`,

  // Resolution (impact numbers, not formulas)
  RES_BLOCK: (n: number) => `\u{1F6E1} ${n}`,
  RES_DMG_TO_ENEMY: (n: number) => `\u{1F5E1} ${n}`,
  RES_DMG_TO_PLAYER: (n: number) => `\u{1F5E1} ${n}`,
  RES_BYPASS: (n: number) => `\u{1F5E1} ${n} bypass`,
  RES_POISON_TICK: '\u2620 1',
  RES_PLAYER_POISON_TICK: '\u2620 1',
  RES_NEW_POISON: (n: number) => `\u2620 +${n}`,
  RES_HEAL: (n: number) => `\u2764 +${n}`,
  RES_HP: (label: string, hp: number, max: number) =>
    `${label} ${hp}/${max} HP`,

  // End screen
  END_HP_REMAINING: (hp: number) => `${hp} HP remaining`,
  END_COMBAT_REACHED: (n: number) => `Combat ${n}/5`,

  // Vocabulary (used in preview formatting)
  DAMAGE: '\u{1F5E1}',
  BLOCK: '\u{1F6E1}',
  HEAL: '\u2764',
  POISON: '\u2620',
  REFLECT: '\u21A9',
  ONE_USE: '\u{1F4A5}',
  IGNORES_BLOCK: 'ignore \u{1F6E1}',

  // Types
  WEAPON: 'Weapon',
  SHIELD: 'Shield',
  UTILITY: 'Utility',

  // Survivors
  SURVIVOR_RESCAPÉ: 'The Survivor',
  SURVIVOR_SENTINELLE: 'The Sentinel',
  SURVIVOR_BRICOLEUR: 'The Tinkerer',
  SURVIVOR_COUREUSE: 'The Runner',
  SURVIVOR_MÉCANICIEN: 'The Mechanic',

  // Passives
  PASSIVE_SURVIVANT: 'Tenacity',
  PASSIVE_SURVIVANT_DESC: 'Below 40% HP, +1 weapon damage',
  PASSIVE_REMPART: 'Bulwark',
  PASSIVE_REMPART_DESC: 'Excess block \u2192 +1 block next round',
  PASSIVE_INGENIEUX: 'Resourceful',
  PASSIVE_INGENIEUX_DESC: '2 different types \u2192 +1 to weakest',
  PASSIVE_ELAN: 'Momentum',
  PASSIVE_ELAN_DESC: 'Speed kill + HP>50% \u2192 +1 damage R1',
  PASSIVE_RECYCLEUR: 'Tinker',
  PASSIVE_RECYCLEUR_DESC: '1\u00D7/combat, die of 1 \u2192 2',

  // Equipment names
  EQ_LAME_CASSEE: 'Broken Blade',
  EQ_PANNEAU_STOP: 'Stop Sign',
  EQ_CRAN_ARRET: 'Switchblade',
  EQ_DOUBLE_FOURCHE: 'Bent Fork',
  EQ_CLE_LOURDE: 'Heavy Wrench',
  EQ_PORTE_BLINDEE: 'Armored Door',
  EQ_PLAQUE_EGOUT: 'Manhole Cover',
  EQ_KIT_SURVIE: 'Survival Kit',
  EQ_MASSE: 'Sledgehammer',
  EQ_AIGUILLE: 'Poison Needle',
  EQ_SCIE_COURTE: 'Short Saw',
  EQ_ECLAT_VERRE: 'Glass Shard',
  EQ_ECORCE: 'Thick Bark',
  EQ_BOUCLIER_EPINES: 'Thorn Shield',
  EQ_BANDAGE: 'Plant Bandage',
  EQ_RACINE_AMERE: 'Bitter Root',
  EQ_LAME_CORROSIVE: 'Corrosive Blade',
  EQ_SAC_SPORES: 'Spore Sac',
  EQ_CABLE_TRESSE: 'Braided Cable',
  EQ_MOLOTOV: 'Molotov Cocktail',

  // Equipment effects (icon format)
  EFF_LAME_CASSEE: '\uD83C\uDFB2+1 \u{1F5E1}',
  EFF_PANNEAU_STOP: '\uD83C\uDFB2 \u{1F6E1}',
  EFF_CRAN_ARRET: '\uD83C\uDFB2+2 \u{1F5E1}',
  EFF_DOUBLE_FOURCHE: '\uD83C\uDFB2+2 \u{1F5E1}',
  EFF_CLE_LOURDE: '\uD83C\uDFB2+2 \u{1F5E1}',
  EFF_PORTE_BLINDEE: '\uD83C\uDFB2+1 \u{1F6E1} (\uD83C\uDFB2+2 if 5-6)',
  EFF_PLAQUE_EGOUT: '\uD83C\uDFB2+1 \u{1F6E1}',
  EFF_KIT_SURVIE: '\uD83C\uDFB2/2+1 \u2764',
  EFF_MASSE: '\uD83C\uDFB2+3 \u{1F5E1}',
  EFF_AIGUILLE: '1 \u{1F5E1} + 1 \u2620',
  EFF_SCIE_COURTE: '\uD83C\uDFB2+1 \u{1F5E1}',
  EFF_ECLAT_VERRE: '\uD83C\uDFB2\u00D72 \u{1F5E1} \u{1F4A5}',
  EFF_ECORCE: '\uD83C\uDFB2+1 \u{1F6E1}',
  EFF_BOUCLIER_EPINES: '\uD83C\uDFB2 \u{1F6E1} + \uD83C\uDFB2/3 \u21A9',
  EFF_BANDAGE: '\uD83C\uDFB2 \u2764',
  EFF_RACINE_AMERE: '\uD83C\uDFB2/2 \u{1F5E1} + \uD83C\uDFB2/2 \u{1F6E1}',
  EFF_LAME_CORROSIVE: '\uD83C\uDFB2+1 \u{1F5E1} (\u00D72 if \u2620)',
  EFF_SAC_SPORES: '+1 \u2620',
  EFF_CABLE_TRESSE: '\uD83C\uDFB2 \u{1F5E1} (+2 if duo \u{1F5E1})',
  EFF_MOLOTOV: '\uD83C\uDFB2 \u{1F5E1} (ignore \u{1F6E1})',

  // Enemies
  ENEMY_SECATEUR: 'Creeping Shears',
  ENEMY_LAMPE: 'Thorn Lamp',
  ENEMY_FOURCHETTE: 'Twisted Fork',
  ENEMY_VENTILATEUR: 'Claw Fan',
  ENEMY_RADIATEUR: 'Moss Radiator',
  ENEMY_TRONCONNEUSE: 'Ivy Chainsaw',
  ENEMY_FRIGO: 'Jaw Fridge',
  ENEMY_VOITURE: 'Root Car',
  ENEMY_GRUE: 'Tentacle Crane',

  // Patterns
  PATTERN_AGGRESSIVE: 'Aggressive',
  PATTERN_DEFENSIVE: 'Defensive',
  PATTERN_NEUTRAL: 'Neutral',

  // Event
  EVENT_HEAL: 'HEAL +2 HP',

  // Event narratives
  NARRATIVES: [
    'You rummage through the rubble of a workshop. Something glints beneath the moss.',
    'A rusted chest, wedged under a root. It gives way on the third blow.',
    'The remains of a campsite. Someone left in a hurry.',
    'An old armory, almost entirely swallowed by ivy.',
    'A metallic sound beneath the dead leaves. You dig.',
    'Behind a collapsed wall, a crate still intact.',
  ] as readonly string[],
} as const;

/** Format die range: nothing for 1-6, "Min X" / "Max Y" / both. */
export function formatRange(minDie: number, maxDie: number): string {
  if (minDie === 1 && maxDie === 6) return '';
  const parts: string[] = [];
  if (minDie > 1) parts.push(`Min ${minDie}`);
  if (maxDie < 6) parts.push(`Max ${maxDie}`);
  return parts.join('  ');
}
