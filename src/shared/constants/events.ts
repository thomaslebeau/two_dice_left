/**
 * Event pool (GDD v5).
 * 10 events across 4 categories. 4 events per run, no repeats.
 */
import type { GameEvent } from '@/types/event.types';

export const EVENT_POOL: GameEvent[] = [
  // --- Workshop (3) ---
  {
    id: 'workshop_repair',
    category: 'workshop',
    flavorText: 'You find a makeshift repair station among the ruins. Rusty tools, but they still work.',
    choices: [
      {
        label: 'Patch Wounds',
        description: 'Bandage up with salvaged supplies.',
        effects: [{ type: 'hp', value: 3 }],
      },
      {
        label: 'Sharpen Blade',
        description: 'Hone your weapon on a whetstone.',
        effects: [{ type: 'atk', value: 1 }],
      },
    ],
  },
  {
    id: 'workshop_forge',
    category: 'workshop',
    flavorText: 'An abandoned forge still smolders. You can salvage something useful.',
    choices: [
      {
        label: 'Reinforce Armor',
        description: 'Weld scrap metal onto your gear.',
        effects: [{ type: 'def', value: 1 }],
      },
      {
        label: 'Temper Weapon',
        description: 'Heat-treat your blade for extra bite.',
        effects: [{ type: 'atk', value: 1 }],
      },
    ],
  },
  {
    id: 'workshop_overhaul',
    category: 'workshop',
    flavorText: "A survivor's workshop, well-hidden. The owner is long gone, but the tools remain.",
    choices: [
      {
        label: 'Quick Fix',
        description: 'A safe, small repair.',
        effects: [{ type: 'hp', value: 2 }],
      },
      {
        label: 'Full Overhaul',
        description: 'Risk a complex repair for a bigger payoff.',
        effects: [{ type: 'atk', value: 1 }, { type: 'def', value: 1 }],
        risk: {
          chance: 0.6,
          failEffects: [{ type: 'hp', value: -2 }],
        },
      },
    ],
  },

  // --- Dice Forge (3) ---
  {
    id: 'forge_rusty_heavy',
    category: 'diceForge',
    flavorText: 'A rusted forge pit, still warm. Two molds remain — choose one to cast your die.',
    choices: [
      {
        label: 'Rusty Die',
        description: 'Faces: 1,2,3,4,5,5. Min 2 dmg on ATK.',
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'rusty' }],
      },
      {
        label: 'Heavy Die',
        description: "Faces: 3,3,4,4,5,5. Can't exceed 5.",
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'heavy' }],
      },
    ],
  },
  {
    id: 'forge_broken_needle',
    category: 'diceForge',
    flavorText: 'Shattered molds litter the floor. Two unusual shapes catch your eye.',
    choices: [
      {
        label: 'Broken Die',
        description: 'Faces: 1,1,1,6,6,6. All or nothing.',
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'broken' }],
      },
      {
        label: 'Needle Die',
        description: 'Standard faces. Pierces 2 enemy DEF.',
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'needle' }],
      },
    ],
  },
  {
    id: 'forge_ivy_root',
    category: 'diceForge',
    flavorText: 'Thick vines crawl through an old forge. The plant life has infused two strange dice.',
    choices: [
      {
        label: 'Ivy Die',
        description: 'Standard faces. On 6: poison (1 dmg ×2).',
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'ivy' }],
      },
      {
        label: 'Root Die',
        description: 'Faces: 1,2,3,3,4,5. If DEF: heal 1 HP.',
        effects: [{ type: 'diceModifier', value: 0, modifierId: 'root' }],
      },
    ],
  },

  // --- Encounter (2) ---
  {
    id: 'encounter_wanderer',
    category: 'encounter',
    flavorText: 'A lone wanderer approaches. They look desperate, but something feels off.',
    choices: [
      {
        label: 'Help Them',
        description: 'Risk helping a stranger for mutual benefit.',
        effects: [{ type: 'atk', value: 1 }, { type: 'def', value: 1 }],
        risk: {
          chance: 0.7,
          failEffects: [{ type: 'hp', value: -3 }],
        },
      },
      {
        label: 'Keep Moving',
        description: 'Play it safe. Nothing ventured, nothing gained.',
        effects: [],
      },
    ],
  },
  {
    id: 'encounter_merchant',
    category: 'encounter',
    flavorText: "A strange merchant sits by a fire, trinkets spread on a mat. Their prices aren't measured in coin.",
    choices: [
      {
        label: 'Trade',
        description: 'Gamble on their wares.',
        effects: [{ type: 'atk', value: 2 }],
        risk: {
          chance: 0.5,
          failEffects: [{ type: 'hp', value: -2 }],
        },
      },
      {
        label: 'Barter',
        description: 'A fair exchange — modest but reliable.',
        effects: [{ type: 'def', value: 1 }],
      },
    ],
  },

  // --- Salvage (2) ---
  {
    id: 'salvage_building',
    category: 'salvage',
    flavorText: 'A collapsed building. Rubble hides useful materials, but the structure is unstable.',
    choices: [
      {
        label: 'Scavenge Surface',
        description: 'Grab what you can safely reach.',
        effects: [{ type: 'def', value: 1 }],
      },
      {
        label: 'Dig Deeper',
        description: 'Risk the unstable structure for better loot.',
        effects: [{ type: 'def', value: 2 }],
        risk: {
          chance: 0.6,
          failEffects: [{ type: 'hp', value: -3 }],
        },
      },
    ],
  },
  {
    id: 'salvage_cache',
    category: 'salvage',
    flavorText: 'An overgrown cache, half-buried in roots. Something glints beneath the vines.',
    choices: [
      {
        label: 'Take the Visible',
        description: 'Grab the easy pickings and move on.',
        effects: [{ type: 'hp', value: 2 }],
      },
      {
        label: 'Search Further',
        description: 'Tear through the vines — risk thorns for treasure.',
        effects: [{ type: 'atk', value: 1 }, { type: 'hp', value: 3 }],
        risk: {
          chance: 0.5,
          failEffects: [{ type: 'hp', value: -2 }],
        },
      },
    ],
  },
];
