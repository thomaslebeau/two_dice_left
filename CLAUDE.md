# Dice & Cards — Project Context

## What is this

Minimalist roguelike deckbuilder. A lone survivor fights 5 combats against possessed everyday objects using 2D6 dice with player-controlled ATK/DEF allocation. Post-apocalyptic dark fantasy universe "Rouille & Légendes" — nature has awakened and possesses objects to eradicate humanity.

## Tech stack

- Pixi.js v8 (WebGL/Canvas renderer)
- TypeScript strict mode
- Vite
- No React, no DOM rendering, no SCSS — pure Pixi.js
- gaming-ui-a11y-toolkit (custom gamepad navigation)
- SQLite (via sql.js WASM) for simulation data
- GitHub Pages deployment

## Code conventions

- ALL code, comments, variables, types, strings: English
- Card names/descriptions: French (data only)
- Classes: PascalCase. Functions: camelCase. Constants: UPPER_SNAKE_CASE. Private: \_underscore prefix.
- Pure game logic (enums/, types/, shared/) has ZERO pixi.js imports
- Max 40 lines per function, max 200 lines per file
- No `any` types, no non-null assertions without comment

## Architecture

```
src/
├── enums/          # GameState, Rarity, EventType (pure TS)
├── types/          # Card, Combat, Event, DiceModifier types (pure TS)
├── shared/
│   ├── constants/  # cards.ts, enemies.ts, events.ts, diceModifiers.ts
│   └── utils/      # combatCalculations.ts, enemyGenerator.ts, eventGenerator.ts
├── core/
│   ├── GameStateManager.ts
│   ├── CombatEngine.ts
│   ├── DiceAllocator.ts
│   ├── EventSystem.ts
│   ├── MetaProgression.ts
│   └── SceneManager.ts
├── engine/         # Game loop, Pixi app setup
├── scenes/         # Pixi Container subclasses (MainMenu, Combat, Event, etc.)
├── components/     # Reusable Pixi visuals (CardSprite, DiceSprite, etc.)
├── sprites/        # Visual assets
├── input/          # Keyboard, gamepad, spatial navigation
├── simulation/     # Headless autoplay for balance testing
├── db/             # SQLite integration
├── layout.ts
├── theme.ts        # Design tokens
└── main.ts
```

Separation rule: GameStateManager, CombatEngine, DiceAllocator, EventSystem = plain TypeScript, no Pixi imports. Only scenes/ and components/ import pixi.js.

## Current game state (v5)

### Run structure

```
MENU → SURVIVOR_SELECTION → COMBAT_1 → EVENT_1 → COMBAT_2 → EVENT_2 → COMBAT_3 → EVENT_3 → COMBAT_4 → EVENT_4 → COMBAT_5 → REWARD / GAMEOVER
```

Player picks 1 survivor. That card fights all 5 combats. HP persists. 4 events between combats.

### Damage formula (direct subtraction)

```typescript
damage = Math.max(0, atkTotal - defTotal);
// atkTotal = dieRoll + card.atkMod + eventBonuses
// defTotal = dieRoll + card.defMod + eventBonuses
```

No minimum damage. DEF ≥ ATK = 0 damage (full block). This formula is load-bearing — changing it invalidates all balance work.

### Dice allocation (core mechanic)

Each round: player rolls 2D6, enemy rolls 2D6. Player CHOOSES which die → ATK, which → DEF. Enemy auto-allocates by pattern (aggressive/defensive/neutral).

### Speed kill recovery

```typescript
const SPEED_KILL_THRESHOLD = 3; // rounds or fewer
const SPEED_KILL_RECOVERY = 3; // HP recovered (capped at max)
```

Player-only. Asymmetric by design — incentivizes aggressive play without nerfing defensive.

### Survivor cards (current stats)

```
ID  Name             HP   ATK  DEF  Archetype       Pool
1   Le Récupérateur  12   +0   +1   Baseline tank   Starter
2   La Sentinelle    13   +0   +1   HP tank         Starter
3   Le Bricoleur     10   +1   +1   Scrapper        Starter
4   La Coureuse      8    +2   +1   Glass cannon    Starter
5   Le Mécanicien    11   +1   +1   Balanced        Starter
6   Le Forgeron      10   +3   +1   Bruiser         Meta-unlock
7   Le Blindé        16   +0   +3   Heavy tank      Meta-unlock
8   Le Vétéran       13   +2   +2   Elite           Meta-unlock
```

All starters have +1 DEF minimum (required by subtraction formula).

### Enemy cards

```
ID  Name                 HP  ATK  DEF  Allocation
E1  Sécateur Rampant     8   +0   +0   Neutral
E2  Lampe Épineuse       6   +1   −1   Aggressive
E3  Fourchette Vrille    5   +0   +0   Neutral
E4  Ventilateur Griffe   10  +2   +0   Aggressive
E5  Radiateur Mousse     14  +0   +2   Defensive
E6  Tronçonneuse Lierre  10  +2   +0   Aggressive
E7  Frigo Mâchoire       12  +0   +1   Defensive
E8  Voiture-Racine       14  +1   +1   Neutral
E9  Grue Tentacule       13  +2   +0   Aggressive
```

### Enemy scaling (final balanced values)

```
Combat  Pool                   HP Mult  ATK Boost  DEF Boost
1       Commons (E1,E2,E3)     ×0.25    +0         +0
2       Commons (E1,E2,E3)     ×0.45    +0         +0
3       Commons + Uncommons    ×0.6     +0         +0
4       All except bosses      ×0.75    +1         +0
5       Boss pool (E8,E9)      ×0.9     +1         +1
```

### Dice modifiers (found via Forge events, max 2 per run)

```
Rusty Die    [1,2,3,4,5,5]  Min 2 damage on ATK
Heavy Die    [3,3,4,4,5,5]  Consistent but capped
Broken Die   [1,1,1,6,6,6]  All or nothing
Ivy Die      [1,2,3,4,5,6]  On 6: poison (1 dmg/turn ×2)
Needle Die   [1,2,3,4,5,6]  Pierces 2 enemy DEF
Root Die     [1,2,3,3,4,5]  If used as DEF: +1 HP
```

### Balance targets

```
Metric                          Target     Actual (75k sims)
Optimal (hpThreshold+balanced)  35–45%     36.1% ✓
Pure aggressive                 25–35%     25.1% ✓
Pure defensive                  20–30%     28%   ✓
Random baseline                 10–15%     23.4% (2D6 variance ceiling)
Allocation spread               2–3×       1.1×  (2D6 variance ceiling)
Event impact                    10–15pp    27.5pp (structural)
Per survivor (optimal play)     15–55%     all ✓
```

Required hierarchy: hpThreshold > aggressive ≈ defensive > random.
Actual: defensive (28%) ≈ hpThreshold (26.9%) > aggressive (25.1%) ≈ random (23.4%).
The 1.1pp gap between defensive and hpThreshold is noise at 75k runs. Accepted as baseline.

Three unmet targets (random, spread, event impact) are structurally bound by 2D6 variance — not fixable with number tuning. Would require changing the dice system entirely.

### Event heal values (nerfed for balance)

```
Event                    Effect
Workshop basic repair    +2 HP
Workshop advanced patch  +2 HP
Encounter trader trade   -1 ATK, +3 HP
Salvage vehicle coolant  +2 HP
Forge "leave it"         +1 HP
```

All ATK/DEF event values unchanged from initial design.

## Balance history (lessons learned)

These are hard-won lessons from 6+ simulation iterations. Do NOT re-learn them:

1. **Minimum damage kills single-card runs.** `max(1, ...)` guarantees ~25 unavoidable damage across 5 combats. With 10 HP survivors, that's mathematically unwinnable. Always use `max(0, ...)`.

2. **Symmetric mechanics don't shift strategy balance.** Overkill bonus damage (tested and reverted) helped enemies as much as the player. If defensive dominates, the fix must be ASYMMETRIC (player-only reward for speed).

3. **+0 DEF is unviable with subtraction formula.** `max(0, atk - def)` makes DEF binary — blocks or doesn't. +0 DEF means the survivor can never fully block. All starters need +1 DEF minimum.

4. **2D6 variance ceiling.** Average difference between two D6 is ~1.67. This physically limits allocation spread to 2-3×. Don't target 3-4× — it's unrealistic. Design supporting systems (speed kill) instead.

5. **Number tuning can't fix structural problems.** If defensive > hpThreshold at ALL multiplier settings, the problem is the formula/mechanics, not the numbers. Diagnose the level before tuning.

6. **HP heals are disproportionately powerful** in a no-heal game. Even +3 HP ≈ surviving one extra combat. Keep heal events modest.

## Agent prompts

Specialized agent prompts are in `AGENT_PROMPTS.md`:

- **Creative Director**: Universe, vision, coherence, feature evaluation
- **Tech Lead**: Code quality, architecture, Pixi.js performance
- **Balance Designer**: Simulation, probability, diagnostic framework

When doing balance work, copy the Balance Designer prompt into your CLI session along with the specific rebalance task. The CLAUDE.md context here gives the shared state; the agent prompt gives the analytical framework.

## Simulation

Headless autoplay in `src/simulation/`. Runs 75,000 simulations (5 survivors × 5 allocation strategies × 6 event strategies × 500 iterations). Outputs to SQLite in `data/autoplay_v5.db`. Run with `npx tsx src/simulation/autoplay.ts`.
