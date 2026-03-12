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
  REPAIR: 'REPAIR',
  RESTART: 'PLAY AGAIN',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
  LOCKED: '???',
  DRAG_HINT: 'DRAG A DIE TO A SLOT',
  NO_DAMAGE: 'No damage',
  SPEED_KILL: (hp: number) => `Speed kill! +${hp} HP`,

  // Resolution
  RES_YOU: (atk: number, shd: number, dmg: number) =>
    `You: ${atk} damage - ${shd} block = ${dmg} damage`,
  RES_ENEMY: (atk: number, shd: number, dmg: number) =>
    `Enemy: ${atk} damage - ${shd} block = ${dmg} damage`,
  RES_ENEMY_HP: (dmg: number) => `Enemy -${dmg} HP`,
  RES_PLAYER_HP: (dmg: number) => `You -${dmg} HP`,
  RES_POISON_TICK: '\u2620 -1 poison',
  RES_PLAYER_POISON_TICK: '\u2620 You -1 poison',
  RES_NEW_POISON: (n: number) => `\u2620 +${n} poison`,
  RES_HEAL: (n: number) => `You +${n} heal`,

  // End screen
  END_HP_REMAINING: (hp: number) => `${hp} HP remaining`,
  END_COMBAT_REACHED: (n: number) => `Combat ${n}/5`,

  // Vocabulary
  DAMAGE: 'damage',
  BLOCK: 'block',
  HEAL: 'heal',
  POISON: 'poison',
  REFLECT: 'reflect',
  ONE_USE: 'one use',
  IGNORES_BLOCK: 'ignores block',

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

  // Equipment effects
  EFF_LAME_CASSEE: 'die+1 damage',
  EFF_PANNEAU_STOP: 'die block',
  EFF_CRAN_ARRET: 'die+2 damage',
  EFF_DOUBLE_FOURCHE: 'die+2 damage',
  EFF_CLE_LOURDE: 'die+2 damage',
  EFF_PORTE_BLINDEE: 'die+1 block (die+2 if 5-6)',
  EFF_PLAQUE_EGOUT: 'die+1 block',
  EFF_KIT_SURVIE: 'heal',
  EFF_MASSE: 'die+3 damage',
  EFF_AIGUILLE: '1 damage + 1 poison turn',
  EFF_SCIE_COURTE: 'die+1 damage',
  EFF_ECLAT_VERRE: 'die\u00D72 damage, one use',
  EFF_ECORCE: 'die+1 block',
  EFF_BOUCLIER_EPINES: 'die block + die/3 reflect',
  EFF_BANDAGE: 'heal = die value',
  EFF_RACINE_AMERE: 'die/2 damage + die/2 block',
  EFF_LAME_CORROSIVE: 'die+1 damage (\u00D72 if poisoned)',
  EFF_SAC_SPORES: '+1 poison turn',
  EFF_CABLE_TRESSE: 'die damage (+2 if dual weapon)',
  EFF_MOLOTOV: 'die damage (ignores block)',

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
  EVENT_HEAL: 'REPAIR +2 HP',
  EVENT_SYNERGY: 'SYNERGY',

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
