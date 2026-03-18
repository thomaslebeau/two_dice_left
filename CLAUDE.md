# Two Dice Left — Project Context

## What is this

Minimalist roguelike deckbuilder. A lone survivor fights 5 combats against possessed everyday objects using 2D6 dice allocated into equipment slots. Post-apocalyptic dark fantasy universe — nature has awakened and possesses objects to eradicate humanity. Each survivor has a unique starting loadout AND passive ability that defines their play pattern. Events between combats offer loot (new equipment) or healing. Synergy equipment enables emergent build archetypes (Poison, Reflect, Combo, Bypass).

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
│   ├── types.ts      # Equipment (consumable?, bypassShield?), Survivor, Enemy, Allocation, CombatResult, Passive
│   ├── dice.ts       # rollDie, rollDice, canUseDie
│   ├── allocation.ts # allocateOptimal, allocateEnemy, scoring
│   ├── combat.ts     # simulateCombat (resolution, poison, heal, passives)
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

## Current game state (v6.1 FINAL) — BALANCE LOCKED

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

Equipment has: type (weapon/shield/utility), die range (minDie-maxDie), effect function (dieValue → {damage, shield, heal, poison}), optional consumable (removed after one use), optional bypassShield (damage ignores enemy shields).

```typescript
// Resolution
playerDamageToEnemy = max(0, sum(weaponEffects) - sum(enemyShieldEffects));
enemyDamageToPlayer = max(0, sum(enemyWeaponEffects) - sum(playerShieldEffects));
// No minimum damage. If block exceeds attack, damage is 0.
// Bypass tools (Molotov, poison) exist to counter high-block enemies.
```

### Speed kill recovery

```typescript
const SPEED_KILL_THRESHOLD = 3; // rounds or fewer
const SPEED_KILL_RECOVERY = 3; // HP recovered (capped at max)
```

Player-only. Asymmetric by design — incentivizes aggressive play.

### Survivors (identity = loadout + passive)

```
ID  Name             HP  Equipment                                                          Passive                                                   Identity
1   Le Rescapé       12  Lame Cassée (1-6→d+1 dmg) + Panneau Stop (1-6→d abs)               Survivant: <40% HP → +1 weapon dmg                        Baseline
2   La Sentinelle    14  Lame Cassée + Porte Blindée (3-6→d+1 abs, d+2 si 5-6)              Rempart: excess shield → +1 next rnd (HP>50% gate)        Tank
3   Le Bricoleur     11  Lame Cassée + Double Fourche (1-4→d+2 dmg) + Plaque d'Égout        Ingénieux: 2 types → +1 to weakest effect                 3 slots
4   La Coureuse      9   Cran d'Arrêt (2-6→d+2 dmg) × 2                                    Élan: speed kill + HP>50% → +1 dmg R1 (no-chain)          Glass cannon
5   Le Mécanicien    11  Clé Lourde (4-6→d+2 dmg) + Panneau Stop + Kit de Survie            Recycleur: 1×/combat, die=1 → 2 deterministic              Balanced
```

Starting pool: Le Rescapé only. Others unlocked by successive victories (1→Sentinelle, 2→Bricoleur, 3→Coureuse, 4→Mécanicien).

Passive balance: passives contribute +0.8-4.5pp win rate. Mécanicien's 3-slot complementary loadout amplifies Recycleur structurally. Validated by simulation.

### Equipment database

Starter equipment:

```
Code ID           Name FR           Type     Range  Effect                          Notes
rusty_blade       Lame Cassée       weapon   1-6    die+1 damage
stop_sign         Panneau Stop      shield   1-6    die absorption
switchblade       Cran d'Arrêt      weapon   2-6    die+2 damage                    v6.1: range narrowed from 1-6 (1 is wasted)
double_fork       Double Fourche    weapon   1-4    die+2 damage
heavy_key         Clé Lourde        weapon   4-6    die+2 damage
reinforced_door   Porte Blindée     shield   3-6    die+1 abs (die+2 if 5-6)        v6.1: conditional effect (was flat die+2)
sewer_plate       Plaque d'Égout    shield   1-6    die+1 absorption
survival_kit      Kit de Survie     utility  1-2    ceil(die/2)+1 heal
```

Core loot pool (found via events, 8 items):

```
Code ID           Name FR                Type     Range  Effect                                       Flags
mace              Masse                  weapon   5-6    die+3 damage
poison_needle     Aiguille Empoisonnée   weapon   1-6    1 dmg + 1 poison turn (always)
short_saw         Scie Courte            weapon   2-5    die+1 damage
glass_shard       Éclat de Verre         weapon   1-6    die×2 damage                                 consumable
thick_bark        Écorce Épaisse         shield   2-6    die+1 absorption
thorn_shield      Bouclier à Épines      shield   1-6    die abs + ceil(die/3) reflect dmg
vegetal_bandage   Bandage Végétal        utility  1-4    heal = die value
bitter_root       Racine Amère           utility  1-6    ceil(die/2) dmg + ceil(die/2) shield
```

Synergy loot pool (v6.1, 3 items):

```
Code ID           Name FR            Type     Range  Effect                                       Flags          Archetype
corrosive_blade   Lame Corrosive     weapon   1-6    die+1 dmg (×2 if target poisoned)                           Poison
spore_sac         Sac à Spores       utility  1-4    +1 poison turn (no weapon slot cost)                        Poison
braided_cable     Câble Tressé       weapon   1-6    die dmg +2 if other die also in weapon                      Combo
molotov           Cocktail Molotov   utility  3-6    die dmg (bypasses shields)                   bypassShield   Bypass
```

Total loot pool: 11 items (8 core + 3 synergy) + Bouclier à Épines (moved from synergy to core).

Removed items (v6.1): Fourche Aiguisée, Plaque Miroir, Trophée Rouillé (permanent stacking, see lesson 10).

Build archetypes:

- Poison: Aiguille Empoisonnée + Lame Corrosive (+ optional Sac à Spores). Simplified poison (1 turn always). Not dominant vs raw DPS.
- Reflect/Counter: Bouclier à Épines (core loot). Tank that deals damage by defending.
- Combo: Câble Tressé + dual weapons. Sacrifice all defense for explosive round.
- Bypass: Cocktail Molotov. Utility damage that ignores enemy shields, rewards high rolls.

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
Combat  Pool                    HP Mult (v6.1 FINAL)
1       Commons (E1,E2,E3)      ×0.38
2       Commons (E1,E2,E3)      ×0.45
3       Commons + Uncommons     ×0.56
4       All except bosses       ×0.70
5       Boss pool (E8,E9)       ×0.84
```

Tuned by auto-tuner. Smart allocator uses wider burst threshold (enemyHp ≤ 6) to distinguish from aggressive.

### Event system (loot-based)

4 events per run. Each offers: pick 1 equipment from 2-3 options OR heal +2 HP.
Loot drawn from combined pool (core + synergy, 11 items total) without repetition within a run. Loot adds to loadout (no cap, no replacement). Consumable equipment (e.g. Éclat de Verre) is removed from loadout after one use.

### Poison system

- Each poison weapon/utility used in a round adds +1 to the target's poison counter (no die condition)
- Aiguille Empoisonnée: 1 dmg + 1 poison turn (always, regardless of die value)
- Sac à Spores: +1 poison turn (utility, no weapon slot cost)
- Multiple poison sources in the same round stack (e.g. Aiguille + Sac à Spores = +2 poison)
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

## Balance targets — BALANCE LOCKED v6.1 FINAL

```
Metric                          Target              v6.1 FINAL          Status
Smart strategy win rate         35-45%              41.2%               ✓
Aggressive win rate             25-35%              40.8%               accepted (above target, but < smart)
Random baseline                 10-15%              35.4%               accepted (above target)
Defensive win rate              < random            31.1%               ✓
Allocation spread (smart/rand)  2-3×                1.2×                accepted (2D6 variance ceiling)
Zero-rounds/combat              < 0.1               0.06                ✓
Avg rounds/combat               3-5                 2.4                 accepted (fast combats)
Survivor balance (smart)        within 5pp          8.4pp               accepted (Sentinelle outlier)
Loot vs heal balance            balanced ±3pp       —                   not measured
Passive impact per survivor     +1-2pp              +0.8 to +4.5pp     accepted
Synergy combo impact            < 8pp               —                   not measured
Smart/aggressive gap            ≥ 4pp               +0.5pp              accepted (hierarchy holds)
```

Required hierarchy: smart > aggressive > random > defensive. ✓ Validated.

v6.1 FINAL reference win rates (smart, with passives): Rescapé 37.1%, Sentinelle 45.5%, Bricoleur 41.2%, Coureuse 38.7%, Mécanicien 43.3%.
Spread: 8.4pp (Sentinelle 45.5% − Rescapé 37.1%). Accepted.

## Balance history (hard-won lessons from v1-v6)

1. **Min damage was removed (v6.2).** Originally `max(1, ...)` guaranteed chip damage. Removed because bypass tools (Molotov, poison) and equipment diversity provide enough options against high-block enemies. If block > attack, damage is 0.

2. **Symmetric mechanics don't shift strategy.** Tested in v5 with overkill damage — helped enemies as much as player. Any balance mechanic must be asymmetric to change strategy hierarchy.

3. **Flat stats don't create identity.** v5 survivors were +0/+1/+2 ATK/DEF. Barely distinguishable in play. v6 equipment loadouts create real identity — La Coureuse with 2 weapons and no shield plays fundamentally differently from La Sentinelle with a door that needs 3+.

4. **2D6 variance ceiling.** Average difference between two D6 = ~1.67. Allocation spread maxes at 2-3×. Don't target higher.

5. **Number tuning can't fix structural problems.** If a mechanic doesn't work at ANY multiplier setting, the mechanic is wrong. Equipment system fixes the structural stalemate that no amount of ATK/DEF tuning could solve.

6. **HP heals are disproportionately powerful** in a no-heal game. Capped at +2 HP per event in v6.

7. **Equipment count is the real power curve.** More slots = more valid allocations per turn = better adaptation to any dice roll. This is the core progression within a run.

8. **Unrestricted rerolls are broken.** (v6.1) Recycleur "reroll any die" = +3-4pp. Final form: deterministic die 1→2 (+1 only), no randomness. Even this gives +5pp on a 3-slot loadout (see lesson 15).

9. **Low HP passives barely trigger.** (v6.1) Survivant at 30% threshold was near-useless. 40% is the minimum viable threshold.

10. **Permanent stacking trivializes late-game.** (v6.1) Trophée Rouillé (removed) permanent = +5-7pp. Always cap or make temporary.

11. **Smart/aggressive gap must be maintained.** (v6.1) Baseline gap ~1pp — any aggressive buff risks hierarchy flip. Adjust smart shield weight if needed.

12. **Poison combo is NOT dominant.** (v6.1) Simplified poison (1 turn always, no die condition). Not auto-pick vs 2x Cran d'Arrêt (9.0 DPR post-range nerf).

13. **Loadout spread > passive tuning.** (v6.1) Without passives, survivor spread was 15pp (Panneau Stop die+0 vs Porte Blindée die+2). Equipment rebalance (5 items) closed the gap to 5pp for top 4. Lesson: fix loadout power budgets before touching passives.

14. **Range complementarity > slot count.** (v6.1) Bricoleur (3 slots, 27%) < Coureuse (2 slots, 36%) because Twin Spike + Light Guard both cap at die 4, creating 11% dead-die rounds. Mécanicien's Wrench(4-6) + Kit(1-3) + Shield(1-6) covers all dice perfectly. Slot count is meaningless without complementary ranges.

15. **Recycleur structural amplification.** (v6.1) Even die 1→2 (+1 to die value) gives +5pp on a 3-slot complementary loadout because the smart allocator has more productive options for every improved die. The cascade: +1 shield → survive 1 more round → deal 1 more round of damage → compound over 5 combats. Passives that improve allocation flexibility are structurally stronger on multi-slot loadouts.

16. **Élan chain creates exponential feedback.** (v6.1) Speed kill → +3 HP → Élan active → +2 dmg R1 → speed kill → repeat. Must break the chain: no-chain rule prevents Élan from activating after an Élan-boosted speed kill.

17. **Conditional effects beat flat nerfs.** (v6.1) Porte Blindée flat die+2 made Sentinelle too strong (48.6%). Conditional die+1/die+2 based on die value (5-6 threshold) preserves high-roll excitement while reducing average power. Better than a flat nerf to die+1.

18. **Range restriction preserves identity better than effect nerfs.** (v6.1) Cran d'Arrêt at 1-6→die+2 was too strong on Coureuse (46.7%). Narrowing to 2-6 (1 is wasted) keeps the high damage ceiling but adds risk — a glass cannon identity tax. Better than die+1 which would make it a boring Lame Cassée clone.

19. **Smart allocator wins via burst timing, not shield weight.** (v6.1) Increasing shield weight in smart scoring made smart WORSE (shields delay kills, accumulating damage). The winning fix: wider burst threshold (enemyHp ≤ 6 vs aggressive's static weights). Smart wins by knowing WHEN to go all-in.

## Simulation

Headless simulation in src/sim/balance.ts. Imports engine/ + data/ directly. Runs Monte Carlo across survivors × allocation strategies × event strategies. Supports passives toggle for A/B comparison. Run with `npx tsx src/sim/balance.ts`.

## Agent prompts

Specialized agent prompts in `AGENT_PROMPTS.md`:

- **Creative Director**: Vision, universe, coherence, feature evaluation, loot naming, synergy assessment
- **Tech Lead**: Code quality, architecture (engine/UI separation), Pixi.js performance, passive implementation
- **Balance Designer**: Equipment power budgets, passive impact, synergy analysis, simulation, diagnostic framework, HP tuning

When doing balance work, copy the Balance Designer prompt into CLI session. CLAUDE.md gives shared state; agent prompt gives analytical framework.
