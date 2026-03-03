# Two Dice Left — Design Tokens Summary

Exhaustive inventory of every visual constant used in the V6 UI.
Generated from source code scan of `src/ui/`, `src/input/`, `src/main.ts`, and `src/theme.ts`.

> **Note:** `src/theme.ts` exists but is **completely unused** by V6 code. All colors/fonts are redeclared locally per file. The tokens below reflect actual runtime values.

---

## 1. COLORS

### Brand Palette

| Token | Hex | Pixi | Used In |
|-------|-----|------|---------|
| `bone` | `#D9CFBA` | `0xD9CFBA` | Primary text, UI labels, utility equipment, neutral pattern |
| `rust` | `#8B3A1A` | `0x8B3A1A` | Dominant accent, weapon equipment, aggressive pattern, commit button stroke |
| `moss` | `#2D4A2E` | `0x2D4A2E` | Secondary accent, shield equipment, defensive pattern, HP healthy, commit button fill |
| `charcoal` | `#1A1A1A` | `0x1A1A1A` | App background, overlay fills, locked slot fill |
| `blood` | `#6B1C1C` | `0x6B1C1C` | Critical HP, damage text, defeat text |
| `venom` | `#7B2D8B` | `0x7B2D8B` | Poison badge background |
| `orange` | `#CC8833` | `0xCC8833` | Warning HP (player 30-60%) |

**Files declaring brand colors:** CombatScene, DiceSprite, CircularHpBadge, CreaturePlaceholder, EquipmentSlotIcon, CommitButton, ResetButton, ResolutionAnimation, EnemyZone, LootCard, EventScene, main.ts

### Gray Scale (unnamed inline values)

| Token | Hex | Used For |
|-------|-----|----------|
| `gray.900` | `#222222` | Filled slot fill |
| `gray.800` | `#333333` | HP bar bg, disabled button fill, out-of-range die face fill |
| `gray.700` | `#444444` | Dimmed/locked slot border |
| `gray.600` | `#555555` | Disabled button stroke, empty slot border, unselected card/button stroke |
| `gray.500` | `#666666` | Out-of-range die face number text |
| `gray.300` | `#999999` | Die background stroke |
| `charcoal-light` | `#2A2A2A` | Die face fill variant (DiceSprite.ts:17) |

### Equipment Type Colors

| Type | Color | Source |
|------|-------|--------|
| `weapon` | `rust` (#8B3A1A) | EquipmentSlotIcon.ts:11, LootCard.ts, EventScene.ts |
| `shield` | `moss` (#2D4A2E) | EquipmentSlotIcon.ts:12, LootCard.ts, EventScene.ts |
| `utility` | `bone` (#D9CFBA) | EquipmentSlotIcon.ts:13, LootCard.ts, EventScene.ts |

### HP Thresholds

| Range | Player Color | Enemy Color |
|-------|-------------|-------------|
| > 60% | `moss` | `moss` |
| 30-60% | `orange` | `moss` (no orange tier) |
| <= 30% | `blood` | `blood` |

Sources: CircularHpBadge.ts:164-168, ResolutionAnimation.ts:148, EnemyZone.ts:99

### Other Colors

| Value | Context | Source |
|-------|---------|--------|
| `#7ED957` | Gamepad focus indicator | InputManager.ts:281 |
| `#0D1410` | HTML body background | index.html:10 |

---

## 2. TYPOGRAPHY

### Font Family

**Every Text object uses:** `"Courier New", monospace`

> `theme.ts` declares `Crimson Text, Georgia, serif` (headings) and `Inter, system-ui, sans-serif` (body) but these are never imported or used.

### Font Sizes

| Size | Context | Source |
|------|---------|--------|
| 28px | Game title "TWO DICE LEFT", Victory/Defeat text | main.ts:82, ResolutionAnimation.ts:71 |
| 18px | HP number inside circular badge | CircularHpBadge.ts:55 |
| 16px | Valider button, subtitle, Rejouer button, die fallback text, resolution result | CommitButton.ts:42, main.ts:95,214, DiceSprite.ts:76, ResolutionAnimation.ts:58 |
| 15px | Confirmer button (event scene) | EventScene.ts:125 |
| 14px | Tap prompt, enemy name, resolution calc lines, heal button | CombatScene.ts:59, CreaturePlaceholder.ts:35, ResolutionAnimation.ts:56-57 |
| 13px | Loot card name, narrative text, survivor button label | LootCard.ts:79, EventScene.ts:94, main.ts:147 |
| 12px | Annuler button, loot card effect, loadout title | ResetButton.ts:28, LootCard.ts:101, EventScene.ts:134 |
| 11px | Pattern label, synergy text, die face numbers | CreaturePlaceholder.ts:48, LootCard.ts:120,193 |
| 10px | Equipment slot type icon | EquipmentSlotIcon.ts:76 |
| 9px | Poison badge label, enemy HP text | CircularHpBadge.ts:71, EnemyZone.ts:40-41 |
| 8px | Die range text, slot effect text | EquipmentSlotIcon.ts:78,83 |

### Font Weights

| Weight | Context |
|--------|---------|
| `bold` | Titles, buttons, HP numbers, names, effect labels, die values |
| `normal` | Body text, secondary labels, detail text |

### Letter Spacing

| Value | Context | Source |
|-------|---------|--------|
| 4px | Game title | main.ts:84 |
| 3px | Victory/Defeat, end screen heading | ResolutionAnimation.ts:72, main.ts:193 |
| 2px | Tap prompt, Valider, subtitle, Rejouer | CombatScene.ts:60, CommitButton.ts:44, main.ts:98,217 |
| 1px | Annuler | ResetButton.ts:29 |

### Line Height

| Value | Context | Source |
|-------|---------|--------|
| 20px | Event narrative text | EventScene.ts:99 |
| 18px | Survivor selection button label | main.ts:149 |

### Font Style

| Value | Context | Source |
|-------|---------|--------|
| `italic` | Narrative/flavor text | EventScene.ts:96 |

---

## 3. SPACING

### Scene Padding

| Value | Context | Source |
|-------|---------|--------|
| 8px | Combat scene edge padding (`PADDING`) | CombatScene.ts:23 |
| 16px | Event scene edge padding (`PADDING`) | EventScene.ts:37 |

### Component Gaps

| Value | Context | Source |
|-------|---------|--------|
| 3px | Enemy equipment slot gap | EnemyZone.ts:17 |
| 4px | Combat zone gap, player slot gap (H & V), enemy zone row gap, enemy dice gap | CombatScene.ts:23, EquipmentGrid.ts:18-19, EnemyZone.ts:19-20 |
| 6px | Stacked loot cards gap | EventScene.ts:233 |
| 8px | HP badge to equipment grid, button pair gap | PlayerZone.ts:12, CombatScene.ts:112 |
| 10px | Side-by-side loot cards, survivor button gap | EventScene.ts:218, main.ts:116 |
| 12px | Player dice gap | DiceAllocator.ts:14 |
| 14px | Event section gap | EventScene.ts:38 |

---

## 4. SIZING

### Core Components

| Component | Width | Height | Source |
|-----------|-------|--------|--------|
| Die sprite | 36px | 36px | DiceSprite.ts:23 (`DIE_SIZE`) |
| Equipment slot icon | 44px | 44px | EquipmentSlotIcon.ts:15 (`ICON_SIZE`) |
| HP circular badge | 60px | 60px | CircularHpBadge.ts:25 (`BADGE_DIAMETER`) |
| Commit button (Valider) | 160px | 36px | CommitButton.ts:20-21 |
| Reset button (Annuler) | 100px | 36px | ResetButton.ts:10-11 |
| Heal button | 200px | 48px | EventScene.ts:39-40 |
| Confirm button | 180px | 48px | EventScene.ts:41-42 |
| Loot card | 160px | auto | LootCard.ts:26 |
| Survivor button | max 340px | 52px | main.ts:114-115 |
| Restart button | 180px | 48px | main.ts:245-246 |
| Die face (loot card) | 20px | 20px | LootCard.ts:29 |
| HP arc stroke | 4px wide | — | CircularHpBadge.ts:27 |
| Enemy HP bar | variable | 6px | EnemyZone.ts:16 |
| Pip dot radius | 3px | — | DiceSprite.ts:25 |

### Layout Limits

| Dimension | Value | Source |
|-----------|-------|--------|
| Max creature placeholder height | 200px | CombatScene.ts:23 |
| Narrow breakpoint (card stacking) | 400px | EventScene.ts:43 |
| Reference mobile width | 390px | CLAUDE.md, main.ts:105 |
| Reference mobile height | 844px | CLAUDE.md, main.ts:106 |
| Combat viewport width | 360px | CombatScene.ts default |
| Combat viewport height | 640px | CombatScene.ts:50 |

---

## 5. BORDERS

### Corner Radius

| Value | Context | Source |
|-------|---------|--------|
| 2px | Enemy HP bar | EnemyZone.ts:91,98 |
| 3px | Die face in loot card, enemy poison badge | LootCard.ts:184, EnemyZone.ts:164 |
| 4px | Player poison badge | CircularHpBadge.ts:173 |
| 5px | Die face, equipment slot | DiceSprite.ts:24, EquipmentSlotIcon.ts:16 |
| 6px | Buttons (commit, reset, heal, survivor, creature) | CommitButton.ts:22, ResetButton.ts:12, EventScene.ts, main.ts, CreaturePlaceholder.ts:75 |
| 8px | Loot card | LootCard.ts:27 |

### Stroke Width

| Value | Context | Source |
|-------|---------|--------|
| 1px | Default borders: die face, empty slot, creature, unselected card, reset button | DiceSprite.ts:167, EquipmentSlotIcon.ts:146, CreaturePlaceholder.ts:91 |
| 2px | Emphasized borders: valid-target slot, filled slot, commit button, confirm button, survivor card | EquipmentSlotIcon.ts:150,155, CommitButton.ts:77, main.ts:126 |
| 3px | Active/selected borders: dragging die glow, selected card/button, focus indicator | DiceSprite.ts:174, LootCard.ts:170, InputManager.ts:281 |

### Dash Patterns

| Context | Dash | Gap | Source |
|---------|------|-----|--------|
| Creature placeholder | 6px | 4px | CreaturePlaceholder.ts:79-80 |
| Empty equipment slot | 4px | 3px | EquipmentSlotIcon.ts:178 |

---

## 6. ANIMATIONS

### Durations

| Value | Context | Source |
|-------|---------|--------|
| 1800ms | Dice roll total duration | DiceSprite.ts:27 |
| 2000ms | Wait after roll before allocation enabled | CombatScene.ts:156 |
| 800ms | Victory/defeat text display; poison stack transition | ResolutionAnimation.ts:19, CircularHpBadge.ts:121 |
| 500ms | Resolution reveal pause; commit-to-resolve delay; tap blink interval | ResolutionAnimation.ts:16, CombatScene.ts:167,187 |
| 300ms | HP bar/badge animation tween | ResolutionAnimation.ts:18 |
| 150ms | Orientation change resize debounce | main.ts:427 |

### Dice Roll Easing

| Parameter | Value | Source |
|-----------|-------|--------|
| Start speed | 40ms per face change | DiceSprite.ts:28 |
| Slow speed | 120ms per face change | DiceSprite.ts:30 |
| Slow point | 60% progress | DiceSprite.ts:29 |
| Stop point | 92% progress | DiceSprite.ts:31 |

### Shake Animation

| Parameter | Value | Source |
|-----------|-------|--------|
| Steps | 6 | DiceSprite.ts:149 |
| Interval | 40ms | DiceSprite.ts:149 |
| Displacement | +/-3px | DiceSprite.ts:150 |

### Poison Pulse

| Parameter | Value | Source |
|-----------|-------|--------|
| Steps | 6 blinks | CircularHpBadge.ts:131, EnemyZone.ts:127 |
| Interval | 80ms | CircularHpBadge.ts:131, EnemyZone.ts:127 |
| Alpha range | 1.0 / 0.3 | CircularHpBadge.ts:132, EnemyZone.ts:127 |

---

## 7. OPACITY / ALPHA

### Interactive States

| Value | Context | Source |
|-------|---------|--------|
| 1.0 | Enabled/active state | CommitButton.ts:67, LootCard.ts:224 |
| 0.85 | Commit button hover, loot card hover, overlay bg, poison badge bg | CommitButton.ts:87, LootCard.ts:220 |
| 0.8 | Survivor/restart button hover | main.ts:157,226 |
| 0.35 | Disabled button, dimmed slot | CommitButton.ts:67, EquipmentSlotIcon.ts:152 |

### Dice States

| Value | Context | Source |
|-------|---------|--------|
| 1.0 | Roll complete | DiceSprite.ts:131 |
| 0.7 | During roll animation | DiceSprite.ts:121 |
| 0.6 | Enemy dice display | EnemyZone.ts:74 |
| 0.4 | Incompatible die | DiceSprite.ts:105 |

### Surface/Background

| Value | Context | Source |
|-------|---------|--------|
| 0.9 | Card fill, heal button fill, filled slot fill | LootCard.ts:164, EventScene.ts:332, EquipmentSlotIcon.ts:155 |
| 0.85 | HP badge bg, resolution overlay, poison badge | CircularHpBadge.ts:28, ResolutionAnimation.ts:94 |
| 0.7 | Empty slot fill | EquipmentSlotIcon.ts:146 |
| 0.6 | Locked slot fill | EquipmentSlotIcon.ts:156 |
| 0.5 | Dashed border (empty slot) | EquipmentSlotIcon.ts:186 |
| 0.3 | Creature placeholder bg | CreaturePlaceholder.ts:76 |
| 0.25 | Valid-target slot fill | EquipmentSlotIcon.ts:150 |
| 0.2 | Creature dashed border | CreaturePlaceholder.ts:91 |

### Text Alpha

| Value | Context | Source |
|-------|---------|--------|
| 0.7 | Non-locked range text | EquipmentSlotIcon.ts:167 |
| 0.5 | Locked icon text | EquipmentSlotIcon.ts:166 |
| 0.4 | Locked range text | EquipmentSlotIcon.ts:167 |

---

## 8. SCALE

| Value | Context | Source |
|-------|---------|--------|
| 1.05 | Focus scale (theme.ts, unused) | theme.ts:97 |
| 1.04 | Selected loot card | LootCard.ts:153 |
| 1.0 | Default | — |
| 0.6 | Enemy dice | EnemyZone.ts:18 |

---

## 9. DISCREPANCIES & TECH DEBT

1. **`theme.ts` is dead code.** No V6 file imports it. The "Living Wild" theme fonts (Crimson Text, Inter) and colors (0x2D5A1E, etc.) are vestigial.

2. **All brand colors are copy-pasted.** BONE, RUST, MOSS, CHARCOAL each appear in 8-12 files. A single `palette.ts` would eliminate 50+ duplicate declarations.

3. **Gray scale values are magic numbers.** `0x333333`, `0x555555`, `0x444444` appear inline without names. These should be named tokens.

4. **Enemy HP lacks orange tier.** Player uses 3-tier HP coloring (moss/orange/blood). Enemy uses 2-tier (moss/blood). Intentional asymmetry or oversight?

5. **Border radii inconsistent.** HP bars use 2px or 3px depending on which component draws them. Buttons all use 6px. Cards use 8px. Could be standardized.
