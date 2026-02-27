# Two Dice Left — Project Context

## What is this

Minimalist roguelike deckbuilder. A lone survivor fights 5 combats against possessed everyday objects using 2D6 dice allocated into equipment slots. Post-apocalyptic dark fantasy universe — nature has awakened and possesses objects to eradicate humanity. Each survivor has a unique starting loadout that defines their play pattern. Events between combats offer loot (new equipment) or healing.

## Tech stack

- Pixi.js v8 (WebGL/Canvas renderer)
- TypeScript strict mode
- Vite
- No React, no DOM rendering, no SCSS — pure Pixi.js
- gaming-ui-a11y-toolkit (custom gamepad navigation)
- GitHub Pages deployment (v5 at root, v6 at /v6/ subdirectory)

## Code conventions

- ALL code, comments, variables, types, strings: English
- Survivor/enemy/equipment names: French (data only)
- Classes: PascalCase. Functions: camelCase. Constants: UPPER_SNAKE_CASE. Private: \_underscore prefix.
- Pure game logic (engine/, data/) has ZERO pixi.js imports
- Max 40 lines per function, max 200 lines per file
- No `any` types, no non-null assertions without comment

## Architecture

```
src/
├── engine/           # PURE TS — zero Pixi imports
│   ├── types.ts      # Equipment, Survivor, Enemy, Allocation, CombatResult
│   ├── dice.ts       # rollDie, rollDice, canUseDie
│   ├── allocation.ts # allocateOptimal, allocateEnemy, scoring
│   ├── combat.ts     # simulateCombat (resolution, min 1 rule, poison, heal)
│   ├── run.ts        # simulateRun (5 combats + loot events)
│   └── index.ts
├── data/             # PURE TS — zero Pixi imports
│   ├── equipment.ts  # Starter + loot equipment definitions
│   ├── survivors.ts  # Survivor definitions with loadouts
│   └── enemies.ts    # Enemy definitions, combat tier config
├── ui/               # PIXI ONLY — reads engine state, never mutates it
│   ├── combat/       # CombatScene, DiceSprite, EquipmentSlot, CommitButton, ResolutionAnimation
│   ├── event/        # EventScene, LootCard, EventManager
│   ├── menu/         # MainMenuScene, SurvivorSelectionScene
│   ├── shared/       # HPBar, ButtonSprite, CardSprite
│   ├── SceneManager.ts
│   └── theme.ts      # Design tokens (colors, fonts, spacing, timings)
├── core/
│   ├── GameStateManager.ts  # State machine, run flow
│   └── MetaProgression.ts   # Persistent unlocks (localStorage)
├── sim/              # Headless balance simulation (imports engine/ + data/)
│   └── balance.ts
├── input/            # Keyboard, gamepad, spatial navigation
└── main.ts
```

Critical separation: engine/ and data/ = pure TypeScript, zero rendering dependencies. This enables headless simulation and future Unity migration (replace ui/, keep engine/).

## Current game state (v6)

### Run structure

```
MENU → SURVIVOR_SELECTION → COMBAT_1 → EVENT_1(loot) → COMBAT_2 → EVENT_2(loot) → COMBAT_3 → EVENT_3(loot) → COMBAT_4 → EVENT_4(loot) → COMBAT_5 → REWARD / GAMEOVER
```

Player picks 1 survivor. That survivor's loadout (2-4 equipment pieces) is their toolkit for the run. HP persists. 4 loot events between combats.

### Combat system (equipment-based)

Each round:

1. Player and enemy each roll 2D6
2. Player places each die into an equipment slot (core mechanic)
3. Enemy auto-allocates by pattern
4. Simultaneous resolution

Equipment has: type (weapon/shield/utility), die range (minDie-maxDie), effect function (dieValue → {damage, shield, heal, poison}).

```typescript
// Resolution
playerDamageToEnemy = sum(weaponEffects) - sum(enemyShieldEffects);
enemyDamageToPlayer = sum(enemyWeaponEffects) - sum(playerShieldEffects);

// Anti-stalemate (asymmetric, player only)
if (playerUsedAnyWeapon) playerDamageToEnemy = max(1, playerDamageToEnemy);
// Enemies have NO min damage — player can fully block
```

### Speed kill recovery

```typescript
const SPEED_KILL_THRESHOLD = 3; // rounds or fewer
const SPEED_KILL_RECOVERY = 3; // HP recovered (capped at max)
```

Player-only. Asymmetric by design — incentivizes aggressive play.

### Survivors (identity = loadout)

```
ID  Name             HP  Equipment                                              Identity
1   Le Rescapé       12  Rusty Blade (1-6→d+1 dmg) + Scrap Shield (1-6→d abs)  Baseline
2   La Sentinelle    14  Rusty Blade + Reinforced Door (3-6→d+2 abs)            Tank
3   Le Bricoleur     10  Rusty Blade + Twin Spike (1-4→d+2 dmg) + Light Guard   3 slots
4   La Coureuse      9   Sharp Knife (1-6→d+2 dmg) × 2                          Glass cannon
5   Le Mécanicien    11  Heavy Wrench (4-6→d+3 dmg) + Scrap Shield + Repair Kit Balanced
```

Starting pool: Le Rescapé only. Others unlocked by successive victories (1→Sentinelle, 2→Bricoleur, 3→Coureuse, 4→Mécanicien).

### Equipment database

Starter equipment:

```
Rusty Blade       weapon   1-6  die+1 damage
Scrap Shield      shield   1-6  die absorption
Sharp Knife       weapon   1-6  die+2 damage
Twin Spike        weapon   1-4  die+2 damage
Heavy Wrench      weapon   4-6  die+3 damage
Sharpened Fork    weapon   1-3  die+1 damage
Reinforced Door   shield   3-6  die+2 absorption
Light Guard       shield   1-4  die+1 absorption
Repair Kit        utility  1-3  ceil(die/2)+1 heal
```

Loot pool (found via events, 8 items):

```
Heavy Hammer      weapon   5-6  die+3 damage
Poison Needle     weapon   1-6  1 dmg + poison (2 turns if die≥3)
Serrated Edge     weapon   2-5  die+1 damage
Glass Shard       weapon   1-6  die damage, DOUBLE on 5-6
Thick Bark        shield   2-6  die+1 absorption
Mirror Plate      shield   4-6  die+2 abs + 1 reflect damage
Bandage Wrap      utility  1-4  heal = die value
Adrenaline Root   utility  1-6  ceil(die/2) dmg + ceil(die/2) shield
```

### Enemy cards

```
ID  Name                 HP  Equipment                           Pattern
E1  Sécateur Rampant     8   Claw(1-6,+0) + Shell(1-6,+0 abs)   Neutral
E2  Lampe Épineuse       6   Spike(1-6,+1) + Spark(1-3,+0)      Aggressive
E3  Fourchette Vrille    5   Prong(1-6,+0) + Guard(1-4,+0 abs)  Neutral
E4  Ventilateur Griffe   10  Blade(1-6,+2) + Slash(3-6,+0)      Aggressive
E5  Radiateur Mousse     14  Bump(1-4,+0) + Armor(1-6,+2 abs)   Defensive
E6  Tronçonneuse Lierre  10  Chain(1-6,+2) + Bark(3-6,+0 abs)   Aggressive
E7  Frigo Mâchoire       12  Bite(1-6,+0) + Hull(2-6,+2 abs)    Defensive
E8  Voiture-Racine       14  Ram(3-6,+2) + Chassis(2-6,+2 abs)  Neutral
E9  Grue Tentacule       13  Whip(1-6,+2) + Crush(4-6,+1)       Aggressive
```

### Enemy scaling per combat (HP multipliers — needs final tuning)

```
Combat  Pool                    HP Mult
1       Commons (E1,E2,E3)      ×0.18
2       Commons (E1,E2,E3)      ×0.30
3       Commons + Uncommons     ×0.45
4       All except bosses       ×0.60
5       Boss pool (E8,E9)       ×0.78
```

Note: These multipliers need final tuning. Smart strategy currently hits ~17% (target 35-45%). Sweet spot is between current values and the higher pass 1 values.

### Event system (loot-based)

4 events per run. Each offers: pick 1 equipment from 2-3 options OR heal +2 HP.
Loot drawn from pool without repetition within a run. Loot adds to loadout (no cap, no replacement).

### Visual identity

```
Color           Hex       Usage
Rust orange     #8B3A1A   Dominant — corroded metal
Dark moss       #2D4A2E   Secondary — vegetation
Bone white      #D9CFBA   UI text — bleached bone
Charcoal        #1A1A1A   Background — ash
Blood red       #6B1C1C   Danger accent — dried blood
```

Typography: eroded stencil (system monospace fallback). Mobile-first (390×844 reference).

## Balance targets

```
Metric                          Target
Smart strategy win rate         35-45%
Aggressive win rate             25-35%
Random baseline                 10-15%
Defensive win rate              < random
Allocation spread (smart/rand)  2-3×
Zero-rounds/combat              < 0.1 (was 2.16 in v5) ✓ actual: 0.03
Avg rounds/combat               3-5
Survivor balance (smart)        within 5pp
Loot vs heal balance            balanced ±3pp of optimal
```

Required hierarchy: smart > aggressive > random > defensive.

## Balance history (hard-won lessons from v1-v5)

1. **Min damage kills single-card runs.** `max(1, ...)` guarantees ~25 unavoidable damage across 5 combats. The v6 fix: min 1 on PLAYER WEAPONS ONLY (asymmetric). Player can still be fully blocked.

2. **Symmetric mechanics don't shift strategy.** Tested in v5 with overkill damage — helped enemies as much as player. Any balance mechanic must be asymmetric to change strategy hierarchy.

3. **Flat stats don't create identity.** v5 survivors were +0/+1/+2 ATK/DEF. Barely distinguishable in play. v6 equipment loadouts create real identity — La Coureuse with 2 weapons and no shield plays fundamentally differently from La Sentinelle with a door that needs 3+.

4. **2D6 variance ceiling.** Average difference between two D6 = ~1.67. Allocation spread maxes at 2-3×. Don't target higher.

5. **Number tuning can't fix structural problems.** If a mechanic doesn't work at ANY multiplier setting, the mechanic is wrong. Equipment system fixes the structural stalemate that no amount of ATK/DEF tuning could solve.

6. **HP heals are disproportionately powerful** in a no-heal game. Capped at +2 HP per event in v6.

7. **Equipment count is the real power curve.** More slots = more valid allocations per turn = better adaptation to any dice roll. This is the core progression within a run.

## Simulation

Headless simulation in src/sim/balance.ts. Imports engine/ + data/ directly. Runs Monte Carlo across survivors × allocation strategies × event strategies. Run with `npx tsx src/sim/balance.ts`.

## Agent prompts

Specialized agent prompts in `AGENT_PROMPTS.md`:

- **Creative Director**: Vision, universe, coherence, feature evaluation, loot naming
- **Tech Lead**: Code quality, architecture (engine/UI separation), Pixi.js performance
- **Balance Designer**: Equipment power budgets, simulation, diagnostic framework, HP tuning

When doing balance work, copy the Balance Designer prompt into CLI session. CLAUDE.md gives shared state; agent prompt gives analytical framework.
