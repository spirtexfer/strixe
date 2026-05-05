# Strixe

Pool-inspired turn-based roguelike browser game. Vanilla HTML5 Canvas + JS ES modules, no build step.

PC-only, mouse input only. No touch/mobile support planned. Accessibility (screen readers, etc.) is not prioritized unless critical.

## Running

```bash
python3 -m http.server 8081
# Open http://localhost:8081
```

## Architecture

Single `index.html` entry point loads ES modules from `js/`:

- `game.js` — Game class, state machine, game loop, HUD updates, ability activation, settling phase (force-based suction), combo/golden pocket logic
- `renderer.js` — All canvas drawing (table, entities, animations, UI overlays, zoom, suction radius visuals, golden pocket highlights)
- `physics.js` — Collision detection, wall bounce, suction system (velocity-based pull via `applySuction`/`getSuctionForce`), trajectory prediction
- `entities.js` — Player/enemy/projectile creation, wave generation, firing patterns
- `shop.js` — Shop state, 5-tier item generation with 6 rarities, shop UI drawing + hit detection
- `input.js` — Mouse/keyboard input handling with coordinate scaling
- `vector.js` — 2D vector math utilities
- `constants.js` — All tuning values (physics, enemies, 62 items across 6 rarities, colors, layout, shop tier weights)

## Key Patterns

- Game states: `TITLE`, `AIMING`, `MOVING`, `SETTLING`, `SHOP`, `GAME_OVER` (also `VICTORY` in renderer but no transition — game is endless)
- Shop UI is drawn on canvas (not DOM) — hit detection via `getShopHitZone()`
- Trajectory prediction in `physics.js` must exactly mirror `game.js` physics (same frame structure, friction, sub-stepping) or prediction lines diverge from actual ball paths
- Zoom is handled via canvas transform in `renderer.js` with smooth lerp
- Animations are data-driven objects in `game.animations[]`, drawn by `drawAnimations()`
- Suction is force-based — after the player ball stops, the game enters a `SETTLING` state (~45 frames). Each frame, `applySuction()` adds velocity toward the nearest pocket (linear falloff: stronger closer). Enemies drift, decelerate (settlingFriction 0.94), and may pocket. Early-exits when all enemies pocketed. Enemy velocities zeroed in `finishTurn()`. Base suction radius is 0; only items add suction range. All suction radius increases are additive
- Golden pockets: 1 random pocket per turn (2 with Golden Cycle) applies a x1.5 gold multiplier
- Abilities are items with `ability: true` — activated by clicking the item in the Modifiers HUD panel; one ability use per turn, 2 charges per wave (reset at wave start)
- Two-step ability targeting: abilities listed in `_needsTargeting()` (blink_shard, pocket_warp, shockwave_core, absolute_control, light_pulse, line_drive) use an arm→confirm flow. First click sets `armedAbility`, second click on canvas fires via `confirmArmedAbility()`. Clicking the ability again cancels
- `mouseDownOnCanvas` flag in input.js tracks whether mousedown landed on the canvas vs HUD, preventing HUD ability clicks from triggering canvas actions
- `pocketEnemy()` centralizes all pocketing logic (combo bonus, golden pocket multiplier, suction/ability bonuses)
- Ability effects are in `_runAbilityEffect()`, separated from charge/validation logic in `activateAbility()` to support echo_cast
- `_abilityPushed` flag on enemies tracks which were displaced by abilities, used by ability_combo and greedy_forces
- `getSuctionRadius()` takes `(pocketIndex, items, goldenPockets)` — goldenPockets param must be threaded through all callers

## Conventions

- No build step, no bundler, no TypeScript — plain ES modules
- Canvas coordinates: 800x500 world space, scaled to viewport
- All constants/tuning in `constants.js` — don't hardcode magic numbers in game logic
- Shop items are free (player chooses 1 per visit) — gold is spent on shop refreshes, upgrades, and cues. Owned items are excluded from the shop pool (no duplicates)
- 4 max item slots (PLAYER_DEFAULTS.maxItems)
- 6 rarity tiers: common, uncommon, rare, epic, legendary, divine
- Items with `duringMovement: true` can only be activated during MOVING state; others only during AIMING
