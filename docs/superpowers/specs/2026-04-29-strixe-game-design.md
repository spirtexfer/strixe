# Strixe — Game Design Spec

## Overview

Strixe is a pool-inspired turn-based roguelike survival browser game. The player controls a ball by dragging to launch it across a pool-table arena, killing enemies by knocking them into pockets. Enemies are stationary but fire projectiles that only move while the player is in motion, making every shot a strategic decision.

**Platform:** Front-end only web browser game (HTML/CSS/JS). No downloads, deployable on GitHub Pages and itch.io.
**Tech:** Vanilla HTML5 Canvas + JavaScript ES modules. No frameworks, no build step.
**Perspective:** Pure top-down.
**Art style:** Minimalist/geometric with cyberpunk sci-fi aesthetic — deep navy backgrounds, cyan accents, neon glow effects, Orbitron + Share Tech Mono fonts.

## Core Mechanic: The Shot

### Aiming (Slingshot Drag)
- Click and hold near the player ball to begin aiming.
- Drag away from the ball — a pool cue renders on the drag side, pulling back further as the cursor moves away, visually indicating launch force.
- A dotted trajectory prediction line shows the full simulated path: wall bounces, enemy collisions, and predicted enemy trajectories after being hit.
- Pocketed enemies are highlighted with a gold ring in the prediction.
- A power ring around the player fills to show force percentage (color-coded: grey <10% = cancel, cyan = low, gold = medium, red = high).
- The camera smoothly zooms out when the cue extends beyond the viewport, with asymmetric lerp (faster zoom-out, slower zoom-in).

### Shooting
- Release the mouse to launch the ball in the opposite direction of the drag (slingshot).
- Force scales with drag distance (further = stronger).
- Releasing below 10% power cancels the shot.

### Motion Phase
- While the ball is moving:
  - Ball bounces off walls with reflection physics (wall restitution 0.88).
  - Ball decelerates via friction (base 0.985, modified by items: Slick Surface 0.992, Momentum Buffer −30% loss, Infinite Runback no friction, Speed Drip no friction until first hit).
  - All enemy projectiles unfreeze and move at their own fixed velocities.
  - Projectiles are destroyed on wall contact.
  - Projectiles damage the player on contact (0.5 per hit). Combo Shield blocks and destroys them. Safe Frame grants invulnerability until first enemy hit.
  - Colliding with an enemy: momentum transfer (physics with pocket bias disabled for prediction accuracy), enemy gets stunned. Various speed-modifying items apply (Firm Core, Ricochet Engine, Hit Flow, Impact Loop, Infinite Runback). Backspin reverses player velocity on hit.
  - Enemy-enemy collisions: both stunned, momentum capped at 65% of max pre-collision speed.
  - Enemy wall collisions: Soft Edge, Clean Drop, Soft Landing apply velocity reduction.
  - Any ball (player or enemy) entering a pocket is pocketed.

### Turn Resolution
1. Ball speed drops below threshold (0.3) → ball stops, all projectiles freeze.
2. **Early End** (rare): if equipped, all enemies lose 70% momentum.
3. **Force Tap** (uncommon): if equipped, enemies within 200px of player receive velocity kick toward player.
4. **Settling phase** (SETTLING state, ~45 frames) — each frame, suction applies a per-frame force (velocity) to enemies within suction radius, pulling them toward the nearest pocket. Enemies move, decelerate (friction 0.94), wall-bounce, and may pocket. Early-exits when all enemies pocketed. All enemy velocities zeroed when settling ends. Visually animated. Space bar fast-forwards settling at 4×.
5. Player pulled slightly toward nearest pocket (0.3px, once after settling).
6. **Late Claim** awards gold for enemies still near pockets. Track max combo. **Chain Lift** awards +3g if combo ≥2.
7. Check wave complete — if all enemies cleared, award wave bonus + **Pocket Bonus** and open shop.
8. Stunned enemies recover (unless stunned this turn).
9. **Rerun Protocol** check: 3+ combo stuns all enemies.
10. Non-stunned enemies fire new projectiles (respecting cooldowns).
11. Golden pockets reroll for next turn.
12. Return to AIMING state.

## Physics

### Collision Physics
Standard circle-circle collision resolution with restitution (0.85). No pocket bias — collisions resolve purely based on physics. Enemy speed is capped at 75% of the player's pre-hit speed to prevent runaway velocities.

### Suction System
After each turn ends (player ball stops), the game enters a **SETTLING** state that runs for ~45 frames (animated, fast-forwardable with spacebar):
- Each pocket has a suction radius. **Base radius is 0** — only items add suction range.
- All suction radius increases are **additive** — flat values stack on top of each other.
- Each settling frame, enemies within a pocket's suction radius receive a **velocity impulse** toward that pocket: `force = pullForce × (1 − distance/radius)`. Closer enemies feel stronger pull (linear falloff).
- Base pull force is **0.15 per frame**. Settling friction is **0.94** per frame (separate from game physics friction 0.985).
- Enemies drift, decelerate, wall-bounce, and may enter pockets over the settling period. This produces a visible gravitational pull effect.
- The player is always pulled slightly toward the nearest pocket (0.3px, once after settling).
- Suction radius is visible as dashed circles around pockets (only when items grant radius).

**Items that increase suction radius (additive):**
| Item | Radius Bonus |
|------|-------------|
| Pocket Assist I (common) | +35 |
| Pocket Assist II (common) | +55 |
| Pocket Assist (uncommon) | +50 |
| Pull Field (uncommon) | +65 |
| Deep Pull (epic) | +100 |
| Quicksand (epic) | +45 |
| Marked Pockets (rare) | Golden pockets get floor of 70 + 40 bonus |

**Items that increase suction pull force (additive, base 0.15/frame):**
| Item | Force Bonus |
|------|-----------|
| Quicksand (epic) | +0.06 |
| Stable Sink (uncommon) | +0.04 |

- **Event Horizon** (divine): enemies in suction range are instantly pocketed (bypasses force-based settling entirely).
- **Marked Pockets** (rare): golden pocket suction radius = max(current radius, 70) + 40. Additive, not multiplicative.

### Sub-stepping
Collision detection uses sub-stepping based on ball speed to prevent tunneling through enemies at high velocities.

### Ball-to-Ball Collisions
- Player hitting an enemy: momentum transfer, enemy slides, enemy gets stunned for 1 turn.
- Enemy hitting another enemy: both get stunned.
- Hit enemies that don't reach a pocket stay where they land.

### Ball-to-Wall Collisions
- Standard reflection physics with restitution (wall restitution: 0.88).
- Walls near pockets have openings to allow pocketing (6px clearance around pocket edges).
- **Soft Edge** (common): enemies bouncing within 80px of pockets lose 60% velocity.
- **Clean Drop** (rare): enemies bouncing within suction radius lose 70% velocity.
- **Soft Landing** (epic): enemies within suction radius are stopped completely (velocity zeroed).

### Pocketing
- Player pocketed: lose 1 life (0.5 with Lighter Fall, 0 with Rebirth Loop), respawn at center (or warp point if Pocket Warp was activated). Additional self-pocket effects: Pocket Boost (+3g), Combo Sacrifice (retrigger combo reward), Void Detonation (radial push), Singularity Core (suction + radial push), Self-Combo (2+ combo → next turn starts at 1).
- Enemy pocketed: enemy removed, player earns gold (base gold + combo bonus + golden pocket ×1.5 multiplier). Ability-pushed enemies can trigger Ability Combo (+2 combo) and Greedy Forces (+5g).

## Golden Pockets

- Each turn, 1 random pocket is designated as "golden" (2 with Golden Cycle).
- Golden pockets have a gold gradient fill and pulsing gold ring.
- Enemies pocketed in a golden pocket receive a **x1.5 gold multiplier** (applied after all other bonuses, rounded).
- Golden pockets reroll each turn.

## Arena

### Standard Layout
- Rectangular pool table (680×410 playable area within 800×500 world space). Table bounds: left 60, top 45, right 740, bottom 455.
- 6 pockets: 4 corners (radius 26) + 2 top/bottom midpoints (radius 22, offset ±3px vertically for visual depth).
- Deep navy blue table felt with radial gradient and cyan dashed rail border (single border, no inner dotted outline).
- Black pocket voids with subtle glow and dark border. Golden pockets have gold gradient fill and pulsing ring.
- Arena shape is fixed across all normal waves.

## Enemies

### Current Roster

| Enemy | Color | Size | Weight | Projectile | Damage | Gold | Cooldown |
|-------|-------|------|--------|------------|--------|------|----------|
| Basic | Red (#ff3355) | 13r | 1.0 | Single aimed shot | 0.5 | 5g | 1 turn |
| Heavy | Orange (#ff8800) | 16r | 2.5 | 8-way radial burst | 0.5 | 10g | 2 turns |
| Speed | Purple (#aa44ff) | 11r | 0.6 | 3-shot cone | 0.5 | 10g | 1 turn |

More enemy types and bosses are planned.

### Enemy Behavior
- Enemies are stationary — they do not move on their own.
- Enemies fire projectiles at the end of each turn (when player ball stops), unless stunned or on cooldown.
- Projectiles move at their own fixed velocity, only while the player ball is in motion.
- Projectiles are destroyed on wall contact.

### Stun Mechanic
- Any enemy hit by the player ball (or another enemy via chain collision) is stunned for 1 turn.
- Stunned enemies do not fire projectiles.
- Stunned enemies display a gold (#ffd700) dashed-border visual indicator.
- Stun wears off at the start of the next turn, unless stunned again.

## Damage & Health

### Lives System
- Player starts with 3 lives.
- Projectile damage: 0.5 per hit.
- Self-pocketing costs 1 life (0.5 with Lighter Fall, 0 with Rebirth Loop).
- No meta-progression — every run starts fresh.

## Waves

### Endless Structure
- The game is endless — waves continue indefinitely with scaling difficulty.
- Each wave has a point budget equal to the wave number.
- Enemies are randomly selected from the roster (basic=1pt, heavy=2pt, speed=2pt).
- Each wave always includes at least one basic enemy.
- Enemy positions are randomized with constraints (away from pockets, player, and each other).

### Wave Flow
- Clear all enemies to complete a wave.
- Wave clear bonus: **+15g**.
- Shop appears after every wave.
- No victory condition — play until death.

## Economy

### Gold
- Starting gold: **10g**
- Gold per enemy pocketed: **5g** (basic), **10g** (heavy, speed)
- Wave clear bonus: **+15g**

### Combo System
- Pocketing multiple enemies in the same turn triggers escalating combo bonuses.
- Base combo bonus: **+5g** per additional pocket past the starting combo (Gold Chain increases to +6g).
- With default starting combo (0): 1st pocket = base gold only, 2nd = base + 5g, 3rd = base + 10g, etc.
- **Overchain** (divine): combo counter starts at (last turn's max combo − 2) instead of 0. The starting value doesn't generate free gold — only pockets past the start count.
- Combo pockets show "COMBO!" text float.
- **Combo Shield** (epic): reaching combo 3 grants projectile invulnerability for the rest of the turn (1× per wave). Blocked projectiles show flash and are destroyed.
- **Rerun Protocol** (legendary): 3+ combo stuns all enemies (2× per wave).
- **Chain Lift** (rare): +3g at end of turn if combo ≥2.
- **Pocket Bonus** (rare): +3g at wave completion if any combo pocketed.
- **Ability Combo** (rare): enemies pocketed after being pushed by an ability count as +2 combo.

## Shop

### Structure
- Appears between every wave.
- Displays **3 items** at a time.
- **Choose 1 item per shop visit** — items are free, you pick one and the shop closes.
- **Skip button** to leave without picking an item.
- **Refresh button** to reroll selection. Cost: 10g base, doubles per refresh. Resets each visit.
- **No duplicate items** — items the player already owns are excluded from the shop pool.
- **4 item cap** — equipped items shown at bottom of shop with discard option.
- **Discard option** — drop any equipped item at any time.
- Inventory-full warning popup when trying to pick with max items.

### 5-Tier Shop System
- Player can upgrade shop tier (T1-T5) to improve item rarity odds.
- Upgrade costs: **20g, 30g, 50g, 67g**.
- Rarity weights per tier:

| Tier | Common | Uncommon | Rare | Epic | Legendary | Divine |
|------|--------|----------|------|------|-----------|--------|
| T1 | 50% | 30% | 20% | 0% | 0% | 0% |
| T2 | 30% | 40% | 30% | 0% | 0% | 0% |
| T3 | 20% | 30% | 30% | 20% | 0% | 0% |
| T4 | 10% | 20% | 30% | 30% | 10% | 0% |
| T5 | 0% | 10% | 20% | 40% | 20% | 10% |

### Item Pool (62 items, 6 rarities)

**Common (9 items)** — Passive stat tweaks
| Item | Effect |
|------|--------|
| Slick Surface | Friction reduced to 0.992 (from 0.985) |
| Power Shot | Max launch force ×1.4 |
| Light Frame | Max launch force ×1.15 |
| Pocket Assist I | Suction radius +35 |
| Pocket Assist II | Suction radius +55 |
| Soft Edge | Enemies bouncing within 80px of pockets lose 60% velocity |
| Force Tap | At turn end, kick enemies within 200px toward player (velocity impulse 1.0) |
| Light Pulse | **Ability:** 25px self-movement toward cursor (2 charges) |
| Lighter Fall | Self-pocket damage halved (1 → 0.5) |

**Uncommon (8 items)** — Momentum & suction
| Item | Effect |
|------|--------|
| Firm Core | On enemy hit, retain min(preHitSpeed×0.85, postSpeed×1.2) |
| Clean Rails | Friction slightly improved per wall bounce (×1.01, capped at 1) |
| Momentum Buffer | Friction loss reduced by 30% |
| Pull Field | Suction radius +65 |
| Pocket Assist | Suction radius +50 |
| Stable Sink | Suction pull force +0.04 (base 0.15 → 0.19) |
| Strong Push | Ability push/pull strength increased |
| Self-Combo | Self-pocket at 2+ combo → next turn starts at combo 1 |

**Rare (15 items)** — Specialized mechanics
| Item | Effect |
|------|--------|
| Bounce Surge | First 2 wall bounces give ×1.25 speed |
| Speed Drip | No friction until first enemy hit |
| Hit Flow | ×1.08 speed per enemy hit |
| Late Claim | +1g per enemy within 60% of suction radius at turn end |
| Marked Pockets | Golden pockets get suction floor of 70 + 40 bonus |
| Clean Drop | Enemies bouncing within suction radius lose 70% velocity |
| Gold Chain | Combo bonus increased to +6g (from +5g) |
| Chain Lift | +3g at end of turn if combo ≥2 |
| Pocket Bonus | +3g at wave completion if any combo this turn |
| Line Drive | **Ability:** Push beam (200px long, 30px wide, strength 2.5/4, 2 charges) |
| Ability Combo | Ability-pushed enemy pockets count as +2 combo |
| Extra Charge | +1 charge to all abilities |
| Early End | Enemies lose 70% momentum at turn end |
| Safe Frame | Invulnerable to projectiles until first enemy hit this turn |
| Pocket Boost | Self-pocket gives +3g |

**Epic (11 items)** — Powerful synergy pieces
| Item | Effect |
|------|--------|
| Impact Loop | First 3 enemy hits per turn give ×1.15 speed |
| Ricochet Engine | Enemy hits preserve momentum (boost to preHitSpeed×0.9) |
| Deep Pull | Suction radius +100 |
| Soft Landing | Enemies within suction radius are stopped completely |
| Combo Shield | 3-combo grants projectile invulnerability (1× per wave) |
| Force Pulse | **Ability:** Global radial push from self (falloff 600px, strength 2/3, 2 charges) |
| Echo Cast | First ability activation per wave triggers twice |
| Stasis Burst | **Ability:** Delete all active projectiles (2 charges) |
| Pocket Warp | **Ability:** Set respawn point for next self-pocket (2 charges) |
| Combo Sacrifice | Self-pocket retriggers full combo gold reward |
| Quicksand | Suction radius +45, pull force +0.06 |

**Legendary (13 items)** — Build-defining
| Item | Effect |
|------|--------|
| Overdrive Core | First 3 wall bounces give ×1.6 speed |
| Chain Reactor | Enemy hits release global shockwave (falloff 400px, force 1.2) pushing all other enemies |
| Golden Rebound | Every even hit after 2nd gives +1g |
| Wide Mouths | Suction-pocketed enemies give +1g |
| Golden Cycle | 2 golden pockets per turn instead of 1 |
| Rerun Protocol | 3+ combo stuns all enemies (2× per wave) |
| Key??? | ??? (placeholder for secret boss unlock) |
| Shockwave Core | **Ability:** Global radial pull at cursor (falloff 600px, strength 1.5/2.5, 2 charges) |
| Greedy Forces | Ability-pushed enemy pockets give +5g |
| Hard Stop | **Ability:** Instantly stop ball, ends turn (during MOVING, 2 charges) |
| Blink Shard | **Ability:** Teleport to cursor, clamped to table bounds (2 charges) |
| Rebirth Loop | Remove self-pocket life penalty entirely |
| Void Detonation | Self-pocket creates global radial push (falloff 600px, strength 2/3), counts as ability push |

**Divine (6 items)** — Game-warping
| Item | Effect |
|------|--------|
| Infinite Runback | No friction. Enemy hits cost 40% momentum but give ×1.15 boost |
| Event Horizon | Enemies in suction range are instantly pocketed |
| Overchain | Combo starts at (last turn's max combo − 2), no free gold for starting value |
| Absolute Control | **Ability:** Bend all enemies toward cursor direction (force 4, 2 charges) |
| Time Fracture | **Ability:** Stop ball, return to AIMING for another shot (2 charges, during MOVING) |
| Singularity Core | Self-pocket triggers suction phase + global radial push (falloff 600px, force 2.5) |

### Ability System
- Items with `ability: true` are click-activated from the Modifiers panel in the HUD sidebar.
- One ability use per turn, **2 charges per wave** (reset at wave start).
- Charges reset at the start of each wave.

**Two-Step Targeting:**
Location-based abilities use a two-step click system:
1. Click the ability in the Modifiers HUD panel → ability is "armed" (shows "TARGETING" label, icon changes to ◉).
2. Click on the canvas → ability fires at the cursor position.
3. Click the ability again to cancel.
- Targeting abilities: Blink Shard, Pocket Warp, Shockwave Core, Absolute Control, Light Pulse, Line Drive.
- Non-targeting abilities (Stasis Burst, Force Pulse) fire immediately on click.
- The system uses `mouseDownOnCanvas` to distinguish canvas clicks from HUD clicks, preventing accidental immediate activation.

**Ability Tutorial:**
On first ability item acquisition, a pulsing cyan overlay highlights the Modifiers panel with "CLICK ABILITIES HERE TO ACTIVATE" label (5 seconds, shown once per run).

**Ability Support Items:**
- **Extra Charge** (rare): +1 charge to all abilities.
- **Echo Cast** (epic): first ability activation per wave triggers twice.
- **Strong Push** (uncommon): push/pull ability strength increased (Force Pulse 2→3, Shockwave Core 1.5→2.5, Line Drive 2.5→4, Void Detonation 2→3).
- Abilities with `duringMovement: true` (Hard Stop, Time Fracture) can only be used while the ball is moving; all others only during AIMING.

**Ability Details:**

| Ability | Rarity | Effect | Charges | Targeting |
|---------|--------|--------|---------|-----------|
| Light Pulse | Common | 25px self-movement toward cursor | 2 | Two-step |
| Line Drive | Rare | Push beam (200px long, 30px wide) in aimed direction | 2 | Two-step |
| Force Pulse | Epic | Global radial push from self (falloff 600px, strength 2/3) | 2 | Instant |
| Stasis Burst | Epic | Delete all projectiles | 2 | Instant |
| Pocket Warp | Epic | Set custom respawn point for next self-pocket | 2 | Two-step |
| Shockwave Core | Legendary | Global radial pull at cursor (falloff 600px, strength 1.5/2.5) | 2 | Two-step |
| Hard Stop | Legendary | Instantly stop (ends turn) | 2 | Instant (during MOVING) |
| Blink Shard | Legendary | Teleport to cursor (clamped to table bounds) | 2 | Two-step |
| Absolute Control | Divine | Bend all enemies toward cursor direction (force 4) | 2 | Two-step |
| Time Fracture | Divine | Stop ball, return to AIMING for another shot | 2 | Instant (during MOVING) |

### Cue System
- Player starts with the Standard cue.
- Additional cues are offered in the shop (one random unowned cue per shop visit).
- Player can switch between owned cues in the Cue Bank panel (right sidebar HUD).
- Cues affect friction and add backspin. Backspin reverses the player's velocity on enemy hit (×backspin factor).
- More cue types with varied gameplay effects are planned.

| Cue | Effect | Cost |
|-----|--------|------|
| Standard | Default cue, no special effects | Free |
| Draw | Ball pulls back after hitting an enemy (backspin 0.6) | 30g |

## UI Layout

### Screen Layout (During Gameplay)
Three-column grid layout filling the full viewport:
- **Left sidebar:** Threat Matrix (enemy list with status/cooldowns) + Modifiers (equipped items — abilities show charge count and are clickable when available).
- **Center:** Arena (the pool table canvas).
- **Right sidebar:** Cue Bank (owned cues, click to switch) + Event Log (recent game events).
- **Top bar:** STRIXE logo + version, Turn counter + status (SAFE/READY), Lives (hearts), Timer.
- **Bottom bar:** Wave number + name, Enemy count, Pocketed count, Gold display.

### Visual Style
- Background: Deep navy (#06070d).
- Table felt: Dark blue (#0d2247) with radial gradient.
- Primary accent: Electric cyan (#00e5ff).
- Player ball: Cyan (#3ec6ff) with pulsing glow.
- Enemy colors: Red (Basic), Orange (Heavy), Purple (Speed).
- Stunned state: Gold (#ffd700) with dashed border.
- Projectiles: Small glowing dots matching enemy color, pulsing opacity when frozen, motion trails when active.
- Suction radius: Dashed circles around pockets (cyan, or gold for golden pockets).
- Golden pockets: Gold gradient fill, gold border, pulsing gold ring.
- 6 rarity colors: Common (#c0d0e0), Uncommon (#22cc88), Rare (#4488ff), Epic (#c77dff), Legendary (#ffd700), Divine (#ff44aa).
- Typography: Orbitron (headings), Share Tech Mono (body).
- Glow effects via canvas shadow blur.

### Animations
- Motion trails on fast-moving balls.
- Spark particles on wall bounces and ball collisions.
- Flash + ring burst on pocketing.
- Floating text for gold gains and combos.
- Screen flash on player damage.
- CRT-style static filter during fast-forward (hold Space).
- Ring bursts on ability activations.

## Game States

1. **TITLE** — STRIXE logo + version, "Click to Play" prompt. Table and pockets drawn as background.
2. **AIMING** — Player stationary, drag near ball to aim (slingshot). Aim line + cue visible during drag. Projectiles frozen. Non-movement abilities can be activated. If an ability is armed, clicking canvas fires it instead of starting a drag.
3. **MOVING** — Ball in motion, projectiles active, collisions resolving. Hold Space for 4× speed (CRT static filter overlay). Movement abilities (Hard Stop, Time Fracture) can be activated. Ball stops when speed < 0.3.
4. **SETTLING** — Post-turn suction phase (~45 frames, early-exits when all enemies pocketed). Suction force pulls enemies toward pockets each frame. Enemies move, decelerate (friction 0.94), may pocket. Enemy velocities zeroed on exit. Hold Space for 4× speed. No player interaction. Transitions to AIMING (or SHOP on wave clear).
5. **SHOP** — Between waves. 3 item cards, refresh, upgrade tier, cue offer, equipped items (with discard), skip button. Inventory-full warning popup. All drawn on canvas.
6. **GAME_OVER** — Stats summary (waves cleared, enemies pocketed, gold earned), "Click to Play Again". Clicking resets to TITLE, clears player/HUD.
7. **VICTORY** — Exists in renderer but currently unreachable (no transition). The game is endless.

## Technical Architecture

- **Entry point:** Single `index.html` with linked JS modules.
- **Modules:** `game.js`, `renderer.js`, `physics.js`, `entities.js`, `shop.js`, `input.js`, `vector.js`, `constants.js`.
- **Game loop:** `requestAnimationFrame` based, state machine driven.
- **Rendering:** Canvas 2D context, full redraw each frame. Zoom via canvas transform.
- **Physics:** Custom circle-circle collision with sub-stepping, pocket bias. Full trajectory prediction mirrors game physics exactly.
- **Input:** Slingshot drag via mousedown/mousemove/mouseup. Space for fast-forward. Ability activation via HUD clicks. `mouseDownOnCanvas` flag prevents HUD clicks from triggering canvas actions. Two-step ability targeting uses `armedAbility` state.
- **State management:** Simple JS objects — player state, enemy array, projectile array, item inventory, gold, wave number.
- **Persistence:** None. No localStorage, no meta-progression.
- **Dev server:** `python3 -m http.server 8081`.

## Planned Features

### Near-Term (Active Roadmap)
- **Number polishing** — Tuning all physics, suction, gold, and item values based on playtesting feedback.
- **More cue options** — Additional cue types that give gameplay variety beyond stat changes (e.g., curve shots, split shots, etc.).
- **Bosses on select waves** — Boss encounters on specific waves with unique mechanics and possible arena modifications (blocked pockets, spike walls, etc.). Multiple boss types planned. Design still open.
- **More enemy types** — Expand the roster beyond Basic/Heavy/Speed with new behavior patterns and projectile types. Design still open.
- **Secret boss** — Hidden boss encounter unlocked by possessing the Key??? legendary item.
- **HP restore** — Healing mechanics (after boss kills and/or via items).
- **Shields** — Defensive mechanics (specifics TBD).

### Future Considerations
- **Settings/pause menu** (ESC).
- **Sound effects and music.**
