# Two Dice Left — Project Context

## What is this

Minimalist roguelike deckbuilder. A lone survivor fights 5 combats against possessed everyday objects using 2D6 dice allocated into equipment slots. Post-apocalyptic dark fantasy universe — nature has awakened and possesses objects to eradicate humanity. Each survivor has a unique starting loadout AND passive ability that defines their play pattern. Events between combats offer loot (new equipment) or healing. Synergy equipment enables emergent build archetypes (Poison, Reflect, Combo, Momentum).

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
│   ├── types.ts      # Equipment, Survivor, Enemy, Allocation, CombatResult, Passive
│   ├── dice.ts       # rollDie, rollDice, canUseDie
│   ├── allocation.ts # allocateOptimal, allocateEnemy, scoring
│   ├── combat.ts     # simulateCombat (resolution, min 1 rule, poison, heal, passives)
│   ├── passives.ts   # Passive definitions and resolution (pure functions)
│   ├── run.ts        # simulateRun (5 combats + loot events)
│   └── index.ts
├── data/             # PURE TS — zero Pixi imports
│   ├── equipment.ts  # Starter + loot + synergy equipment definitions
│   ├── survivors.ts  # Survivor definitions with loadouts + passive references
│   └── enemies.ts    # Enemy definitions, combat tier config
├── ui/               # PIXI ONLY — reads engine state, never mutates it
│   ├── combat/       # CombatScene, DiceSprite, EquipmentSlot, CommitButton, PoisonIndicator, ResolutionAnimation
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

Critical separation: engine/ and data/ = pure TypeScript, zero rendering dependencies. This enables headless simulation and future Unity migration (replace ui/, keep engine/). Passives live in engine/passives.ts as pure functions.

## Current game state (v6.1)

### Run structure

```
MENU → SURVIVOR_SELECTION → COMBAT_1 → EVENT_1(loot) → COMBAT_2 → EVENT_2(loot) → COMBAT_3 → EVENT_3(loot) → COMBAT_4 → EVENT_4(loot) → COMBAT_5 → REWARD / GAMEOVER
```

Player picks 1 survivor. That survivor's loadout (2-4 equipment pieces) + passive is their toolkit for the run. HP persists. 4 loot events between combats.

### Combat system (equipment-based)

Each round:

1. Player and enemy each roll 2D6
2. Player places each die into an equipment slot (core mechanic)
3. Enemy auto-allocates by pattern
4. Simultaneous resolution (with passive modifiers applied)

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

### Survivors (identity = loadout + passive)

```
ID  Name             HP  Equipment                                                Passive                                                   Identity
1   Le Rescapé       12  Rusty Blade (1-6→d+1 dmg) + Scrap Shield (1-6→d+1 abs)  Survivant: <40% HP → +1 weapon dmg                        Baseline
2   La Sentinelle    14  Rusty Blade + Reinforced Door (3-6→d+1 abs)              Rempart: excess shield → +1 next rnd (HP>50% gate)        Tank
3   Le Bricoleur     11  Rusty Blade + Twin Spike (1-4→d+2 dmg) + Light Guard     Ingénieux: 2 types → +1 to weakest effect                 3 slots
4   La Coureuse      9   Sharp Knife (1-6→d+2 dmg) × 2                            Élan: speed kill + HP>50% → +1 dmg R1 (no-chain)          Glass cannon
5   Le Mécanicien    11  Heavy Wrench (4-6→d+2 dmg) + Scrap Shield + Repair Kit   Recycleur: 1×/combat, die=1 → 2 deterministic              Balanced
```

Starting pool: Le Rescapé only. Others unlocked by successive victories (1→Sentinelle, 2→Bricoleur, 3→Coureuse, 4→Mécanicien).

Passive balance: passives contribute +3.5-6.7pp win rate. Mécanicien's 3-slot complementary loadout amplifies Recycleur structurally. Validated by simulation.

### Equipment database

Starter equipment:

```
Rusty Blade       weapon   1-6  die+1 damage
Scrap Shield      shield   1-6  die+1 absorption
Sharp Knife       weapon   1-6  die+2 damage
Twin Spike        weapon   1-4  die+2 damage
Heavy Wrench      weapon   4-6  die+2 damage
Sharpened Fork    weapon   1-3  die+1 damage
Reinforced Door   shield   3-6  die+1 absorption
Light Guard       shield   1-6  die+1 absorption
Repair Kit        utility  1-2  ceil(die/2)+1 heal
```

Core loot pool (found via events, 8 items):

```
Heavy Hammer      weapon   5-6  die+3 damage
Poison Needle     weapon   1-6  1 dmg + 1 tour de poison (toujours)
Serrated Edge     weapon   2-5  die+1 damage
Glass Shard       weapon   1-6  die damage, DOUBLE on 5-6
Thick Bark        shield   2-6  die+1 absorption
Mirror Plate      shield   4-6  die+2 abs + 1 reflect damage
Bandage Wrap      utility  1-4  heal = die value
Adrenaline Root   utility  1-6  ceil(die/2) dmg + ceil(die/2) shield
```

Synergy loot pool (v6.1, 5 items):

```
Lame Corrosive    weapon   1-6  die+1 dmg (doubled if target poisoned)           Archetype: Poison
Spore Sac         utility  1-4  +1 poison turn (no weapon slot cost)             Archetype: Poison
Bouclier à Épines shield   1-6  die/2 abs + die/2 reflect dmg (floor)            Archetype: Reflect
Câble Tressé      weapon   1-6  die dmg +2 if other die also in weapon           Archetype: Combo
Trophée Rouillé   utility  —    passive: +1 dmg 3 rounds after speed kill (cap 2) Archetype: Momentum
```

Build archetypes:

- Poison: Needle + Corrosive (+ optional Spore Sac). Simplified poison (1 turn always). DPR to re-simulate, expected not dominant vs raw DPS.
- Reflect/Counter: Mirror Plate + Bouclier à Épines. Tank that deals damage by defending.
- Combo: Câble Tressé + dual weapons. Sacrifice all defense for explosive round.
- Momentum: Trophée Rouillé + speed kill focus. Temporary buff, capped at 2 stacks.

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

### Enemy scaling per combat (HP multipliers)

```
Combat  Pool                    HP Mult (v6.1 final)
1       Commons (E1,E2,E3)      ×0.41
2       Commons (E1,E2,E3)      ×0.49
3       Commons + Uncommons     ×0.61
4       All except bosses       ×0.76
5       Boss pool (E8,E9)       ×0.91
```

Tuned by auto-tuner targeting 39.5% smart win rate. Known accepted deviation: smart/aggressive gap is 1.9pp (target >=4pp).

### Event system (loot-based)

4 events per run. Each offers: pick 1 equipment from 2-3 options OR heal +2 HP.
Loot drawn from combined pool (core + synergy, 13 items total) without repetition within a run. Loot adds to loadout (no cap, no replacement).

### Poison system

- Each poison weapon/utility used in a round adds +1 to the target's poison counter (no die condition)
- Poison Needle: 1 dmg + 1 poison turn (always, regardless of die value)
- Spore Sac: +1 poison turn (utility, no weapon slot cost)
- Multiple poison sources in the same round stack (e.g. Needle + Spore Sac = +2 poison)
- Poison deals 1 HP/turn, counter decrements each round
- Stacks cumulatively: existing turns + new poison = total
- Resolution order: weapon damage → shield absorption → poison tick → new poison queued → heal
- Persists within combat, resets between combats
- UI: skull icon + remaining turns on affected cards, poison damage shown in purple (#7B2D8B)

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
Metric                          Target              v6.1 Actual
Smart strategy win rate         35-45%              39.5% ✓
Aggressive win rate             25-35%              37.6% (accepted)
Random baseline                 10-15%              32.2% (accepted)
Defensive win rate              < random            31.5% ✓
Allocation spread (smart/rand)  2-3×                1.2× (accepted)
Zero-rounds/combat              < 0.1               0.10 ✓ (borderline)
Avg rounds/combat               3-5                 2.6 (accepted)
Survivor balance (smart)        within 5pp          11.8pp (Mécanicien outlier, accepted)
Loot vs heal balance            balanced ±3pp       —
Passive impact per survivor     +5pp accepted       +3.5-6.7pp ✓
Synergy combo impact            < 8pp               —
Smart/aggressive gap            ≥ 4pp               1.9pp (accepted)
```

Required hierarchy: smart > aggressive > random > defensive. ✓ Validated.

v6.1 reference win rates (smart, with passives): Rescapé 39.2%, Sentinelle 37.7%, Bricoleur 34.4%, Coureuse 40.3%, Mécanicien 46.2%.

## Balance history (hard-won lessons from v1-v6)

1. **Min damage kills single-card runs.** `max(1, ...)` guarantees ~25 unavoidable damage across 5 combats. The v6 fix: min 1 on PLAYER WEAPONS ONLY (asymmetric). Player can still be fully blocked.

2. **Symmetric mechanics don't shift strategy.** Tested in v5 with overkill damage — helped enemies as much as player. Any balance mechanic must be asymmetric to change strategy hierarchy.

3. **Flat stats don't create identity.** v5 survivors were +0/+1/+2 ATK/DEF. Barely distinguishable in play. v6 equipment loadouts create real identity — La Coureuse with 2 weapons and no shield plays fundamentally differently from La Sentinelle with a door that needs 3+.

4. **2D6 variance ceiling.** Average difference between two D6 = ~1.67. Allocation spread maxes at 2-3×. Don't target higher.

5. **Number tuning can't fix structural problems.** If a mechanic doesn't work at ANY multiplier setting, the mechanic is wrong. Equipment system fixes the structural stalemate that no amount of ATK/DEF tuning could solve.

6. **HP heals are disproportionately powerful** in a no-heal game. Capped at +2 HP per event in v6.

7. **Equipment count is the real power curve.** More slots = more valid allocations per turn = better adaptation to any dice roll. This is the core progression within a run.

8. **Unrestricted rerolls are broken.** (v6.1) Recycleur "reroll any die" = +3-4pp. Final form: deterministic die 1→2 (+1 only), no randomness. Even this gives +5pp on a 3-slot loadout (see lesson 15).

9. **Low HP passives barely trigger.** (v6.1) Survivant at 30% threshold was near-useless. 40% is the minimum viable threshold.

10. **Permanent stacking trivializes late-game.** (v6.1) Trophée Rouillé permanent = +5-7pp. Always cap or make temporary.

11. **Smart/aggressive gap must be maintained.** (v6.1) Baseline gap ~1pp — any aggressive buff risks hierarchy flip. Adjust smart shield weight if needed.

12. **Poison combo is NOT dominant.** (v6.1) Simplified poison (1 turn always, no die condition). DPR to re-validate. Expected still not auto-pick vs 2x Sharp Knife (11.0).

13. **Loadout spread > passive tuning.** (v6.1) Without passives, survivor spread was 15pp (Scrap Shield die+0 vs Reinforced Door die+2). Equipment rebalance (5 items) closed the gap to 5pp for top 4. Lesson: fix loadout power budgets before touching passives.

14. **Range complementarity > slot count.** (v6.1) Bricoleur (3 slots, 27%) < Coureuse (2 slots, 36%) because Twin Spike + Light Guard both cap at die 4, creating 11% dead-die rounds. Mécanicien's Wrench(4-6) + Kit(1-3) + Shield(1-6) covers all dice perfectly. Slot count is meaningless without complementary ranges.

15. **Recycleur structural amplification.** (v6.1) Even die 1→2 (+1 to die value) gives +5pp on a 3-slot complementary loadout because the smart allocator has more productive options for every improved die. The cascade: +1 shield → survive 1 more round → deal 1 more round of damage → compound over 5 combats. Passives that improve allocation flexibility are structurally stronger on multi-slot loadouts.

16. **Élan chain creates exponential feedback.** (v6.1) Speed kill → +3 HP → Élan active → +2 dmg R1 → speed kill → repeat. Must break the chain: no-chain rule prevents Élan from activating after an Élan-boosted speed kill.

## Simulation

Headless simulation in src/sim/balance.ts. Imports engine/ + data/ directly. Runs Monte Carlo across survivors × allocation strategies × event strategies. Supports passives toggle for A/B comparison. Run with `npx tsx src/sim/balance.ts`.

## Agent prompts

Specialized agent prompts in `AGENT_PROMPTS.md`:

- **Creative Director**: Vision, universe, coherence, feature evaluation, loot naming, synergy assessment
- **Tech Lead**: Code quality, architecture (engine/UI separation), Pixi.js performance, passive implementation
- **Balance Designer**: Equipment power budgets, passive impact, synergy analysis, simulation, diagnostic framework, HP tuning

When doing balance work, copy the Balance Designer prompt into CLI session. CLAUDE.md gives shared state; agent prompt gives analytical framework.
