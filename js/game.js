import { WORLD, PHYS, WAVE_CLEAR_BONUS, COLORS, PLAYER_DEFAULTS, TABLE, CUE_TYPES, POCKETS, COMBO_BASE_BONUS, COMBO_CAP, COMBO_POWER_BOOST, RARITY_COLORS, SUCTION } from './constants.js';
import { sub, len, normalize, scale, dist } from './vector.js';
import { circlesOverlap, resolveCircleCollision, wallBounce, isInPocket, getNearestPocket, getNearestPocketIndex, applySuction, applyPlayerSuction, getSuctionRadius } from './physics.js';
import { createPlayer, generateWaveEnemies, fireEnemyProjectiles, playerHasItem, respawnPlayer } from './entities.js';
import { createInput, consumeClick, consumeRightClick, consumeMouseJustDown, consumeMouseJustUp, updateInputScale } from './input.js';
import { drawFrame, drawTitleScreen, drawGameOver, drawVictory, getZoom } from './renderer.js';
import { createShopState, generateShopItems, refreshShop, buyItem, discardItem, generateCueOffer, upgradeShop, buyCue, switchCue, drawShop, getShopHitZone } from './shop.js';

export class Game {
  constructor(canvas, hudElements) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hudElements;
    this.input = createInput(canvas);

    this.state = 'TITLE';
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.waveIndex = 0;
    this.shop = createShopState();
    this.eventLog = [];
    this.stats = { wavesCleared: 0, pocketed: 0, goldEarned: 0 };
    this.startTime = 0;
    this.pocketedThisTurn = false;
    this.selfPocketedThisTurn = false;
    this.firstBounce = true;
    this.bounceCount = 0;
    this.turnCount = 0;
    this.animations = [];
    this.goldenPockets = [];
    this.combo = 0;
    this.highestCombo = 0;
    this.pocketedCountThisTurn = 0;
    this.hitCountThisTurn = 0;
    this.hasHitThisTurn = false;
    this.armedAbility = null;
    this.abilityTutorialShown = false;
    this.settlingFramesLeft = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const wrapper = this.canvas.parentElement;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    const aspect = WORLD.w / WORLD.h;
    let cw, ch;
    if (w / h > aspect) {
      ch = h;
      cw = h * aspect;
    } else {
      cw = w;
      ch = w / aspect;
    }
    this.canvas.width = cw * devicePixelRatio;
    this.canvas.height = ch * devicePixelRatio;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.canvasCSSW = cw;
    this.canvasCSSH = ch;
    this.ctx.setTransform(cw * devicePixelRatio / WORLD.w, 0, 0, ch * devicePixelRatio / WORLD.h, 0, 0);
    updateInputScale(this.input, WORLD.w, WORLD.h, cw, ch);
  }

  log(msg) {
    this.eventLog.unshift(msg);
    if (this.eventLog.length > 8) this.eventLog.pop();
  }

  rollGoldenPockets() {
    const count = playerHasItem(this.player, 'golden_cycle') ? 2 : 1;
    this.goldenPockets = [];
    const indices = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < count && indices.length > 0; i++) {
      const pick = Math.floor(Math.random() * indices.length);
      this.goldenPockets.push(indices[pick]);
      indices.splice(pick, 1);
    }
  }

  resetAbilityCharges() {
    const p = this.player;
    p.abilityCharges = {};
    const extraCharge = playerHasItem(p, 'extra_charge') ? 1 : 0;
    for (const it of p.items) {
      if (it.ability) {
        p.abilityCharges[it.id] = (it.charges || 1) + extraCharge;
      }
    }
  }

  init() {
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.waveIndex = 0;
    this.shop = createShopState();
    this.eventLog = [];
    this.stats = { wavesCleared: 0, pocketed: 0, goldEarned: 0 };
    this.startTime = Date.now();
    this.turnCount = 0;
    this.animations = [];
    this.goldenPockets = [];
    this.rollGoldenPockets();
    this.spawnWave();
    this.state = 'AIMING';
    this.updateHUD();
    this.log('Wave 1');
  }

  spawnWave() {
    this.enemies = generateWaveEnemies(this.waveIndex + 1, this.player);
    this.projectiles = [];
    this.firstBounce = true;
    this.bounceCount = 0;
    this.resetAbilityCharges();
    this.combo = 0;
    this.highestCombo = 0;
    this.player._comboShieldUsed = 0;
    this.player._rerunUsed = 0;
    this.player._comboShieldThreshold = 0;
    this.player._rerunThreshold = 0;
    this.player._overchainUsed = false;
    this.player._echoCastUsed = false;
    this.player._pocketBoostCount = 0;
  }

  getComboStep() {
    return playerHasItem(this.player, 'gold_chain') ? 2 : COMBO_BASE_BONUS;
  }

  resetCombo() {
    if (this.combo > 0) {
      this.player._comboShieldThreshold = 0;
      this.player._rerunThreshold = 0;
    }
    this.combo = 0;
  }

  addCombo(amount) {
    this.combo += amount;
    this.highestCombo = Math.max(this.highestCombo, this.combo);
    this._checkComboThresholds();
  }

  _checkComboThresholds() {
    const p = this.player;
    const thresholds = [5, 10];
    for (const t of thresholds) {
      if (this.combo >= t) {
        if (playerHasItem(p, 'combo_shield') && (p._comboShieldThreshold || 0) < t && (p._comboShieldUsed || 0) < 2) {
          p._comboShieldThreshold = t;
          p._comboShieldActive = true;
          p._comboShieldUsed = (p._comboShieldUsed || 0) + 1;
          this.spawnScreenFlash(COLORS.accent);
          this.log('Combo Shield!');
        }
        if (playerHasItem(p, 'rerun_protocol') && (p._rerunThreshold || 0) < t && (p._rerunUsed || 0) < 2) {
          p._rerunThreshold = t;
          p._rerunUsed = (p._rerunUsed || 0) + 1;
          for (const e of this.enemies) {
            e.stunned = true;
            e.stunnedThisTurn = true;
          }
          this.log('Rerun Protocol! All stunned!');
          this.spawnScreenFlash(COLORS.accent);
        }
      }
    }
  }

  shoot() {
    const mouse = this.input.mouse;
    const dragVec = sub(mouse, this.player);
    const d = len(dragVec);

    const maxDragDist = PHYS.maxForce / PHYS.forceScale;
    const powerT = Math.min(d / maxDragDist, 1);
    if (powerT <= 0.10) {
      this.input.dragging = false;
      return;
    }

    const p = this.player;
    const n = normalize(dragVec);
    let maxF = PHYS.maxForce;
    if (playerHasItem(p, 'power_shot')) maxF *= 1.4;
    if (playerHasItem(p, 'light_frame')) maxF *= 1.15;
    const comboBoost = 1 + Math.min(this.combo, COMBO_CAP) * COMBO_POWER_BOOST;
    let force = Math.min(d * PHYS.forceScale, maxF) * comboBoost;

    p.vx = -n.x * force;
    p.vy = -n.y * force;
    this.firstBounce = true;
    this.bounceCount = 0;
    this.pocketedThisTurn = false;
    this.selfPocketedThisTurn = false;
    this.pocketedCountThisTurn = 0;
    this.hitCountThisTurn = 0;
    this.hasHitThisTurn = false;
    p.abilityUsedThisTurn = false;
    p._comboShieldActive = false;
    this.armedAbility = null;
    this.input.dragging = false;

    for (const proj of this.projectiles) proj.frozen = false;
    this.state = 'MOVING';
  }

  update() {
    if (this.state === 'MOVING') {
      const steps = this.input.spaceHeld ? 4 : 1;
      for (let i = 0; i < steps; i++) {
        this.updateMoving();
        this.updateAnimations();
        if (this.state !== 'MOVING') break;
      }
      return;
    }
    if (this.state === 'SETTLING') {
      const steps = this.input.spaceHeld ? 4 : 1;
      for (let i = 0; i < steps; i++) {
        this.updateSettling();
        this.updateAnimations();
        if (this.state !== 'SETTLING') break;
      }
      return;
    }
    this.updateAnimations();
  }

  updateAnimations() {
    for (const a of this.animations) a.frame++;
    this.animations = this.animations.filter(a => a.frame < a.duration);
  }

  spawnPocketAnim(x, y, radius, color) {
    const pocket = getNearestPocket({ x, y });
    this.animations.push({
      type: 'pocket',
      startX: x, startY: y,
      pocketX: pocket.x, pocketY: pocket.y,
      radius, color,
      frame: 0, duration: 22,
    });
  }

  spawnFlashAnim(x, y, color) {
    this.animations.push({
      type: 'flash', x, y, color,
      frame: 0, duration: 14,
    });
  }

  spawnSparks(x, y, color, count = 8) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
      const spd = 1.5 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd });
    }
    this.animations.push({
      type: 'sparks', x, y, color, particles,
      frame: 0, duration: 24,
    });
  }

  spawnRingBurst(x, y, color) {
    this.animations.push({
      type: 'ring_burst', x, y, color,
      frame: 0, duration: 30,
    });
  }

  spawnTextFloat(x, y, text, color) {
    this.animations.push({
      type: 'text_float', x, y, text, color,
      frame: 0, duration: 45,
    });
  }

  spawnScreenFlash(color) {
    this.animations.push({
      type: 'screen_flash', color,
      frame: 0, duration: 12,
    });
  }

  pocketEnemy(e, isSuction = false) {
    const p = this.player;
    let comboInc = 1;
    if (isSuction && playerHasItem(p, 'chain_lift')) comboInc = 2;
    if (e._abilityPushed && playerHasItem(p, 'ability_combo')) comboInc += 2;
    this.addCombo(comboInc);

    const comboStep = this.getComboStep();
    const effectiveCombo = Math.min(this.combo, COMBO_CAP);
    const comboBonus = effectiveCombo * comboStep;

    let goldGain = e.goldValue + comboBonus;
    if (isSuction && playerHasItem(p, 'wide_mouths')) goldGain += 1;
    if (e._abilityPushed && playerHasItem(p, 'greedy_forces')) goldGain += 5;

    const pIdx = getNearestPocketIndex(e);
    if (this.goldenPockets.includes(pIdx)) {
      goldGain = Math.round(goldGain * 1.5);
    }

    p.gold += goldGain;
    this.stats.pocketed++;
    this.stats.goldEarned += goldGain;
    this.pocketedCountThisTurn++;
    this.pocketedThisTurn = true;
    this.spawnPocketAnim(e.x, e.y, e.radius, e.color);
    this.spawnRingBurst(e.x, e.y, e.color);

    let label = `+${goldGain}g`;
    if (comboBonus > 0) label += ` C${this.combo}!`;
    if (isSuction) label = `+${goldGain}g PULL!`;
    if (this.goldenPockets.includes(pIdx)) label += ' ★';

    this.spawnTextFloat(e.x, e.y - 10, label, COLORS.gold);
    this.log(`${e.label} pocketed! ${label}`);
    this.updateHUD();
  }

  updateMoving() {
    const p = this.player;
    let friction = PHYS.friction;
    if (playerHasItem(p, 'slick_surface')) friction = 0.992;
    if (playerHasItem(p, 'momentum_buffer')) friction = 1 - (1 - friction) * 0.7;
    if (playerHasItem(p, 'infinite_runback')) friction = 1;
    if (playerHasItem(p, 'speed_drip') && !this.hasHitThisTurn) friction = 1;
    const cueMod = CUE_TYPES[p.activeCue]?.frictionMod || 1;
    if (cueMod !== 1) friction = 1 - (1 - friction) * cueMod;

    const ballSpeed = len({ x: p.vx, y: p.vy });
    const subSteps = Math.max(1, Math.ceil(ballSpeed / (p.radius * 0.8)));
    let hitThisFrame = false;

    for (let step = 0; step < subSteps; step++) {
      p.x += p.vx / subSteps;
      p.y += p.vy / subSteps;

      const bounced = wallBounce(p);
      if (bounced) {
        this.bounceCount++;
        this.spawnSparks(p.x, p.y, COLORS.accent, 4);

        if (playerHasItem(p, 'bounce_surge') && this.bounceCount <= 2) {
          p.vx *= 1.25;
          p.vy *= 1.25;
        }
        if (playerHasItem(p, 'overdrive_core') && this.bounceCount <= 3) {
          p.vx *= 1.6;
          p.vy *= 1.6;
        }
        if (playerHasItem(p, 'clean_rails')) {
          friction = Math.min(friction * 1.01, 1);
        }
        this.firstBounce = false;
      }

      const preHitSpeed = len({ x: p.vx, y: p.vy });

      for (const e of this.enemies) {
        const overlapping = circlesOverlap(p, e);

        if (e.hitByPlayer) {
          if (!overlapping) e.hitByPlayer = false;
          continue;
        }
        if (!overlapping) continue;

        e.hitByPlayer = true;
        hitThisFrame = true;
        this.hasHitThisTurn = true;
        this.hitCountThisTurn++;

        resolveCircleCollision(p, e);

        if (playerHasItem(p, 'firm_core')) {
          const postSpeed = len({ x: p.vx, y: p.vy });
          if (postSpeed > 0.1) {
            const retain = Math.min(preHitSpeed * 0.85, postSpeed * 1.2);
            const ratio = retain / postSpeed;
            p.vx *= ratio;
            p.vy *= ratio;
          }
        }

        if (playerHasItem(p, 'ricochet_engine')) {
          const postSpeed = len({ x: p.vx, y: p.vy });
          if (postSpeed > 0.1) {
            const boost = preHitSpeed * 0.9;
            const ratio = boost / postSpeed;
            p.vx *= ratio;
            p.vy *= ratio;
          }
        }

        if (playerHasItem(p, 'hit_flow')) {
          p.vx *= 1.08;
          p.vy *= 1.08;
        }

        if (playerHasItem(p, 'impact_loop') && this.hitCountThisTurn <= 3) {
          p.vx *= 1.15;
          p.vy *= 1.15;
        }

        if (playerHasItem(p, 'infinite_runback')) {
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.vx *= 1.15;
          p.vy *= 1.15;
        }

        const eSpeed = len({ x: e.vx, y: e.vy });
        const maxEnemySpeed = preHitSpeed * 0.75;
        if (eSpeed > maxEnemySpeed && eSpeed > 0.1) {
          const s = maxEnemySpeed / eSpeed;
          e.vx *= s;
          e.vy *= s;
        }

        const backspinAmt = CUE_TYPES[p.activeCue]?.backspin || 0;
        if (backspinAmt > 0) {
          p.vx = -p.vx * backspinAmt;
          p.vy = -p.vy * backspinAmt;
        }

        this.spawnSparks((p.x + e.x) / 2, (p.y + e.y) / 2, COLORS.accent, 8);
        this.spawnFlashAnim((p.x + e.x) / 2, (p.y + e.y) / 2, COLORS.white);
        if (!e.stunnedThisTurn) {
          e.stunned = true;
          e.stunnedThisTurn = true;
          this.log(`${e.label} stunned!`);
        }

        if (playerHasItem(p, 'golden_rebound') && this.hitCountThisTurn > 2 && this.hitCountThisTurn % 2 === 0) {
          p.gold += 1;
          this.stats.goldEarned += 1;
          this.spawnTextFloat(e.x, e.y - 15, '+1g', COLORS.gold);
        }

        if (playerHasItem(p, 'chain_reactor')) {
          for (const other of this.enemies) {
            if (other === e) continue;
            const cdx = other.x - e.x, cdy = other.y - e.y;
            const cd = Math.sqrt(cdx * cdx + cdy * cdy);
            if (cd > 1) {
              const force = 1.2 * Math.max(0, 1 - cd / 400);
              other.vx += (cdx / cd) * force;
              other.vy += (cdy / cd) * force;
            }
          }
          this.spawnRingBurst(e.x, e.y, COLORS.golden);
        }
      }

      if (hitThisFrame) break;
    }

    p.vx *= friction;
    p.vy *= friction;

    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        if (circlesOverlap(a, b)) {
          const preA = len({ x: a.vx, y: a.vy });
          const preB = len({ x: b.vx, y: b.vy });
          resolveCircleCollision(a, b);

          const maxEESpeed = Math.max(preA, preB) * 0.65;
          for (const eball of [a, b]) {
            const s = len({ x: eball.vx, y: eball.vy });
            if (s > maxEESpeed && s > 0.1) {
              const ratio = maxEESpeed / s;
              eball.vx *= ratio;
              eball.vy *= ratio;
            }
          }

          this.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, COLORS.projectile, 5);
          if (!a.stunnedThisTurn) { a.stunned = true; a.stunnedThisTurn = true; }
          if (!b.stunnedThisTurn) { b.stunned = true; b.stunnedThisTurn = true; }
        }
      }
    }

    for (const e of this.enemies) {
      if (Math.abs(e.vx) > 0.01 || Math.abs(e.vy) > 0.01) {
        e.x += e.vx;
        e.y += e.vy;
        e.vx *= PHYS.friction;
        e.vy *= PHYS.friction;
        const eBounced = wallBounce(e);
        if (eBounced && playerHasItem(p, 'soft_edge')) {
          for (const pocket of POCKETS) {
            const sdx = e.x - pocket.x, sdy = e.y - pocket.y;
            if (sdx * sdx + sdy * sdy < 80 * 80) {
              e.vx *= 0.4;
              e.vy *= 0.4;
              break;
            }
          }
        }
        if (eBounced && playerHasItem(p, 'clean_drop')) {
          const pIdx = getNearestPocketIndex(e);
          const sR = getSuctionRadius(pIdx, p.items, this.goldenPockets);
          const pocket = POCKETS[pIdx];
          const cdx = e.x - pocket.x, cdy = e.y - pocket.y;
          if (cdx * cdx + cdy * cdy < sR * sR) {
            e.vx *= 0.3;
            e.vy *= 0.3;
          }
        }
        if (playerHasItem(p, 'soft_landing')) {
          const slIdx = getNearestPocketIndex(e);
          const slR = getSuctionRadius(slIdx, p.items, this.goldenPockets);
          const slPocket = POCKETS[slIdx];
          const sldx = e.x - slPocket.x, sldy = e.y - slPocket.y;
          if (sldx * sldx + sldy * sldy < slR * slR) {
            e.vx = 0;
            e.vy = 0;
          }
        }
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
        if (Math.abs(e.vy) < 0.05) e.vy = 0;
      }
    }

    for (const proj of this.projectiles) {
      if (proj.frozen) continue;
      proj.x += proj.vx;
      proj.y += proj.vy;

      const hitWall = proj.x - proj.radius < TABLE.left ||
                      proj.x + proj.radius > TABLE.right ||
                      proj.y - proj.radius < TABLE.top ||
                      proj.y + proj.radius > TABLE.bottom;
      if (hitWall) {
        this.spawnFlashAnim(proj.x, proj.y, proj.color);
        proj.dead = true;
        continue;
      }

      if (playerHasItem(p, 'safe_frame') && this.hitCountThisTurn === 0) continue;

      const dx = proj.x - p.x, dy = proj.y - p.y;
      if (dx * dx + dy * dy < (proj.radius + p.radius) * (proj.radius + p.radius)) {
        if (p._comboShieldActive) {
          this.spawnFlashAnim(proj.x, proj.y, COLORS.accent);
          proj.dead = true;
          continue;
        }
        let dmg = proj.damage;
        p.lives -= dmg;
        this.resetCombo();
        this.spawnFlashAnim(proj.x, proj.y, COLORS.white);
        this.spawnSparks(proj.x, proj.y, COLORS.enemyBasic, 6);
        this.spawnScreenFlash(COLORS.enemyBasic);
        proj.dead = true;
        this.log(`Hit! -${dmg} life — combo lost`);
        this.updateHUD();
        if (p.lives <= 0) {
          this.state = 'GAME_OVER';
          return;
        }
      }
    }
    this.projectiles = this.projectiles.filter(pr => !pr.dead);

    this.enemies = this.enemies.filter(e => {
      if (isInPocket(e)) {
        this.pocketEnemy(e, false);
        return false;
      }
      return true;
    });

    if (isInPocket(p)) {
      this.selfPocketedThisTurn = true;
      this.spawnPocketAnim(p.x, p.y, p.radius, COLORS.player);
      this.spawnRingBurst(p.x, p.y, COLORS.player);

      if (playerHasItem(p, 'rebirth_loop')) {
        this.spawnTextFloat(p.x, p.y - 10, 'NO PENALTY', COLORS.accent);
        this.log('Rebirth Loop — no penalty');
      } else {
        let dmg = playerHasItem(p, 'lighter_fall') ? 0.5 : 1;
        p.lives -= dmg;
        this.spawnScreenFlash(COLORS.enemyBasic);
        this.spawnTextFloat(p.x, p.y - 10, `-${dmg} LIFE`, COLORS.enemyBasic);
        this.log(`Scratched! -${dmg} life`);
      }

      if (playerHasItem(p, 'pocket_boost') && (p._pocketBoostCount || 0) < 3) {
        p._pocketBoostCount = (p._pocketBoostCount || 0) + 1;
        p.gold += 3;
        this.stats.goldEarned += 3;
        this.spawnTextFloat(p.x, p.y - 25, '+3g', COLORS.gold);
      }

      if (playerHasItem(p, 'combo_sacrifice') && this.combo > 0) {
        const comboStep = this.getComboStep();
        const comboBonus = Math.min(this.combo, COMBO_CAP) * comboStep;
        if (comboBonus > 0) {
          p.gold += comboBonus;
          this.stats.goldEarned += comboBonus;
          this.spawnTextFloat(p.x, p.y - 40, `+${comboBonus}g SACRIFICE`, COLORS.rarityEpic);
        }
      }

      if (playerHasItem(p, 'void_detonation')) {
        const vdStr = playerHasItem(p, 'strong_push') ? 3 : 2;
        for (const e of this.enemies) {
          const vdx = e.x - p.x, vdy = e.y - p.y;
          const vdd = Math.sqrt(vdx * vdx + vdy * vdy);
          if (vdd > 1) {
            const force = vdStr * Math.max(0, 1 - vdd / 600);
            e.vx += (vdx / vdd) * force;
            e.vy += (vdy / vdd) * force;
            e._abilityPushed = true;
          }
        }
        this.spawnRingBurst(p.x, p.y, COLORS.rarityLegendary);
        this.log('Void Detonation!');
      }

      if (playerHasItem(p, 'singularity_core')) {
        const scRemove = [];
        for (let si = 0; si < this.enemies.length; si++) {
          const se = this.enemies[si];
          const result = applySuction(se, p.items, this.goldenPockets);
          if (result.pocketed) {
            this.pocketEnemy(se, true);
            scRemove.push(si);
          } else if (result.pulled) {
            this.spawnSparks(se.x, se.y, COLORS.accent, 3);
          }
        }
        for (let si = scRemove.length - 1; si >= 0; si--) {
          this.enemies.splice(scRemove[si], 1);
        }
        for (const se of this.enemies) {
          const sdx = se.x - p.x, sdy = se.y - p.y;
          const sd = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sd > 1) {
            const force = 2.5 * Math.max(0, 1 - sd / 600);
            se.vx += (sdx / sd) * force;
            se.vy += (sdy / sd) * force;
          }
        }
        this.spawnRingBurst(p.x, p.y, COLORS.rarityDivine);
        this.spawnScreenFlash(COLORS.rarityDivine);
        this.log('Singularity Core!');
      }

      if (!playerHasItem(p, 'combo_guard')) {
        this.resetCombo();
      }

      if (p._warpPoint) {
        p.x = p._warpPoint.x;
        p.y = p._warpPoint.y;
        p._warpPoint = null;
      } else {
        respawnPlayer(p);
      }
      p.vx = 0;
      p.vy = 0;
      this.updateHUD();
      if (p.lives <= 0) {
        this.state = 'GAME_OVER';
        return;
      }
    }

    const curSpeed = len({ x: p.vx, y: p.vy });
    if (curSpeed < PHYS.minSpeed) {
      p.vx = 0;
      p.vy = 0;
      this.endTurn();
    }
  }

  updateSettling() {
    const p = this.player;
    this.settlingFramesLeft--;

    for (const e of this.enemies) {
      const result = applySuction(e, p.items, this.goldenPockets);
      if (result.pocketed) {
        e._suctionPocketed = true;
      } else if (result.pulled && this.settlingFramesLeft % 5 === 0) {
        this.spawnSparks(e.x, e.y, COLORS.accent, 2);
      }
    }

    for (const e of this.enemies) {
      if (Math.abs(e.vx) > 0.01 || Math.abs(e.vy) > 0.01 || e._suctionPocketed) {
        e.x += e.vx;
        e.y += e.vy;
        e.vx *= SUCTION.settlingFriction;
        e.vy *= SUCTION.settlingFriction;
        wallBounce(e);
        if (Math.abs(e.vx) < 0.05) e.vx = 0;
        if (Math.abs(e.vy) < 0.05) e.vy = 0;
      }
    }

    this.enemies = this.enemies.filter(e => {
      if (e._suctionPocketed || isInPocket(e)) {
        delete e._suctionPocketed;
        this.pocketEnemy(e, true);
        return false;
      }
      return true;
    });

    if (this.settlingFramesLeft <= 0 || this.enemies.length === 0) {
      this.finishTurn();
    }
  }

  finishTurn() {
    const p = this.player;

    for (const e of this.enemies) {
      e.vx = 0;
      e.vy = 0;
    }

    applyPlayerSuction(p);

    if (playerHasItem(p, 'late_claim')) {
      for (const e of this.enemies) {
        if (e._lateClaimPaid) continue;
        const pocket = getNearestPocket(e);
        const dx = pocket.x - e.x, dy = pocket.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < getSuctionRadius(getNearestPocketIndex(e), p.items, this.goldenPockets) * 0.6) {
          e._lateClaimPaid = true;
          p.gold += 1;
          this.stats.goldEarned += 1;
          this.spawnTextFloat(e.x, e.y - 10, '+1g', COLORS.textMid);
        }
      }
    }

    if (this.pocketedCountThisTurn === 0) {
      if (playerHasItem(p, 'overchain') && !p._overchainUsed && this.combo > 0) {
        p._overchainUsed = true;
        this.log('Overchain — combo preserved!');
      } else {
        this.resetCombo();
      }
    }

    this.updateHUD();

    if (this.enemies.length === 0) {
      this.waveComplete();
      return;
    }

    for (const e of this.enemies) {
      e.hitByPlayer = false;
      if (e.stunned && !e.stunnedThisTurn) {
        e.stunned = false;
      }
      e.stunnedThisTurn = false;
    }

    const newProj = [];
    for (const e of this.enemies) {
      if (e.stunned) continue;
      if (e.cooldownTimer <= 0) {
        newProj.push(...fireEnemyProjectiles(e, this.player));
      } else {
        e.cooldownTimer--;
      }
    }
    this.projectiles.push(...newProj);
    if (newProj.length > 0) this.log(`${newProj.length} projectile(s) fired`);

    this.rollGoldenPockets();
    this.state = 'AIMING';
    this.updateHUD();
  }

  endTurn() {
    for (const proj of this.projectiles) proj.frozen = true;
    this.turnCount++;

    if (playerHasItem(this.player, 'early_end')) {
      for (const e of this.enemies) {
        e.vx *= 0.3;
        e.vy *= 0.3;
      }
    }

    if (playerHasItem(this.player, 'force_tap')) {
      const p = this.player;
      for (const e of this.enemies) {
        const ftdx = p.x - e.x, ftdy = p.y - e.y;
        const ftd = Math.sqrt(ftdx * ftdx + ftdy * ftdy);
        if (ftd > 1 && ftd < 200) {
          e.vx += (ftdx / ftd) * 1.0;
          e.vy += (ftdy / ftd) * 1.0;
        }
      }
    }

    this.settlingFramesLeft = SUCTION.settlingFrames;
    this.state = 'SETTLING';
  }

  waveComplete() {
    const p = this.player;
    p.gold += WAVE_CLEAR_BONUS;
    this.stats.goldEarned += WAVE_CLEAR_BONUS;
    this.stats.wavesCleared++;
    this.log(`Wave cleared! +${WAVE_CLEAR_BONUS}g`);
    this.spawnTextFloat(WORLD.w / 2, WORLD.h / 2 - 30, 'WAVE CLEAR', COLORS.accent);
    this.spawnTextFloat(WORLD.w / 2, WORLD.h / 2, `+${WAVE_CLEAR_BONUS}g`, COLORS.gold);
    this.spawnRingBurst(WORLD.w / 2, WORLD.h / 2, COLORS.accent);

    if (playerHasItem(p, 'pocket_bonus') && this.highestCombo > 0) {
      const bonus = this.highestCombo;
      p.gold += bonus;
      this.stats.goldEarned += bonus;
      this.spawnTextFloat(WORLD.w / 2, WORLD.h / 2 + 20, `+${bonus}g POCKET BONUS`, COLORS.gold);
    }

    this.waveIndex++;
    this.openShop();
  }

  openShop() {
    this.shop = createShopState();
    this.shop.items = generateShopItems(this.player.shopLevel, this.player.items);
    this.shop.cueOffer = generateCueOffer(this.player);
    this.shop.open = true;
    this.state = 'SHOP';
    this.updateHUD();
  }

  closeShop() {
    this.shop.open = false;
    this.projectiles = [];
    this.spawnWave();
    this.rollGoldenPockets();
    this.state = 'AIMING';
    this.log(`Wave ${this.waveIndex + 1}`);
    this.updateHUD();
  }

  _needsTargeting(itemId) {
    return ['blink_shard', 'pocket_warp', 'shockwave_core', 'absolute_control', 'light_pulse', 'line_drive'].includes(itemId);
  }

  activateAbility(itemId) {
    const p = this.player;

    if (this.armedAbility === itemId) {
      this.armedAbility = null;
      this.log('Ability cancelled');
      this.updateHUD();
      return;
    }

    if (p.abilityUsedThisTurn) return;
    const charges = p.abilityCharges[itemId] || 0;
    if (charges <= 0) return;

    const item = p.items.find(it => it.id === itemId);
    if (!item || !item.ability) return;
    if (item.duringMovement && this.state !== 'MOVING') return;
    if (!item.duringMovement && this.state !== 'AIMING') return;

    if (this._needsTargeting(itemId)) {
      this.armedAbility = itemId;
      this.log(`${item.name} — click to place, click ability to cancel`);
      this.updateHUD();
      return;
    }

    this._consumeAndFireAbility(itemId);
  }

  confirmArmedAbility() {
    if (!this.armedAbility) return false;
    this._consumeAndFireAbility(this.armedAbility);
    this.armedAbility = null;
    return true;
  }

  _consumeAndFireAbility(itemId) {
    const p = this.player;
    p.abilityCharges[itemId]--;
    p.abilityUsedThisTurn = true;

    this._runAbilityEffect(itemId);

    if (playerHasItem(p, 'echo_cast') && !p._echoCastUsed) {
      p._echoCastUsed = true;
      this._runAbilityEffect(itemId);
      this.log('Echo Cast!');
    }

    this.updateHUD();
  }

  _runAbilityEffect(itemId) {
    const p = this.player;

    if (itemId === 'blink_shard') {
      p.x = Math.max(TABLE.left + p.radius, Math.min(TABLE.right - p.radius, this.input.mouse.x));
      p.y = Math.max(TABLE.top + p.radius, Math.min(TABLE.bottom - p.radius, this.input.mouse.y));
      p.vx = 0;
      p.vy = 0;
      this.spawnRingBurst(p.x, p.y, COLORS.accent);
      this.log('Blink!');
    } else if (itemId === 'stasis_burst') {
      this.projectiles = [];
      this.spawnScreenFlash(COLORS.accent);
      this.log('Stasis Burst! Projectiles cleared');
    } else if (itemId === 'force_pulse') {
      const strength = playerHasItem(p, 'strong_push') ? 3 : 2;
      for (const e of this.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) {
          const force = strength * Math.max(0, 1 - d / 600);
          e.vx += (dx / d) * force;
          e.vy += (dy / d) * force;
          e._abilityPushed = true;
        }
      }
      this.spawnRingBurst(p.x, p.y, COLORS.accent);
      this.log('Force Pulse!');
    } else if (itemId === 'hard_stop') {
      p.vx = 0;
      p.vy = 0;
      this.log('Hard Stop!');
    } else if (itemId === 'time_fracture') {
      p.vx = 0;
      p.vy = 0;
      this.spawnScreenFlash(COLORS.rarityDivine);
      this.log('Time Fracture! Take another shot');
      for (const proj of this.projectiles) proj.frozen = true;
      p.abilityUsedThisTurn = false;
      this.state = 'AIMING';
    } else if (itemId === 'light_pulse') {
      const dir = normalize(sub(this.input.mouse, p));
      p.x += dir.x * 25;
      p.y += dir.y * 25;
      this.log('Light Pulse!');
    } else if (itemId === 'shockwave_core') {
      const mx = this.input.mouse.x, my = this.input.mouse.y;
      const strength = playerHasItem(p, 'strong_push') ? 2.5 : 1.5;
      for (const e of this.enemies) {
        const dx = e.x - mx, dy = e.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) {
          const force = -strength * Math.max(0, 1 - d / 600);
          e.vx += (dx / d) * force;
          e.vy += (dy / d) * force;
          e._abilityPushed = true;
        }
      }
      this.spawnRingBurst(mx, my, COLORS.rarityLegendary);
      this.log('Shockwave Core!');
    } else if (itemId === 'line_drive') {
      const dir = normalize(sub(this.input.mouse, p));
      const strength = playerHasItem(p, 'strong_push') ? 4 : 2.5;
      for (const e of this.enemies) {
        const toE = sub(e, p);
        const dotVal = toE.x * dir.x + toE.y * dir.y;
        if (dotVal < 0 || dotVal > 200) continue;
        const perpX = toE.x - dir.x * dotVal;
        const perpY = toE.y - dir.y * dotVal;
        const perpD = Math.sqrt(perpX * perpX + perpY * perpY);
        if (perpD < 30) {
          e.vx += dir.x * strength;
          e.vy += dir.y * strength;
          e._abilityPushed = true;
        }
      }
      this.log('Line Drive!');
    } else if (itemId === 'absolute_control') {
      const mx = this.input.mouse.x, my = this.input.mouse.y;
      const dir = normalize(sub({ x: mx, y: my }, p));
      for (const e of this.enemies) {
        e.vx += dir.x * 4;
        e.vy += dir.y * 4;
        e._abilityPushed = true;
      }
      this.spawnScreenFlash(COLORS.rarityDivine);
      this.log('Absolute Control!');
    } else if (itemId === 'pocket_warp') {
      p._warpPoint = {
        x: Math.max(TABLE.left + p.radius, Math.min(TABLE.right - p.radius, this.input.mouse.x)),
        y: Math.max(TABLE.top + p.radius, Math.min(TABLE.bottom - p.radius, this.input.mouse.y)),
      };
      this.spawnRingBurst(p._warpPoint.x, p._warpPoint.y, COLORS.rarityEpic);
      this.log('Warp point set!');
    }
  }

  render() {
    const { ctx, state } = this;

    if (state === 'TITLE') {
      drawTitleScreen(ctx);
      return;
    }

    if (state === 'GAME_OVER') {
      drawFrame(ctx, this);
      drawGameOver(ctx, this.stats);
      return;
    }

    if (state === 'VICTORY') {
      drawFrame(ctx, this);
      drawVictory(ctx, this.stats);
      return;
    }

    drawFrame(ctx, this);

    if (state === 'SHOP') {
      drawShop(ctx, this.shop, this.player, this.input.mouse);
    }
  }

  handleClick() {
    if (this.state === 'TITLE') {
      this.init();
      return;
    }
    if (this.state === 'GAME_OVER' || this.state === 'VICTORY') {
      this.state = 'TITLE';
      this.player = null;
      this.armedAbility = null;
      if (this.hud.modifiers) this.hud.modifiers.innerHTML = '';
      if (this.hud.threatMatrix) this.hud.threatMatrix.innerHTML = '';
      return;
    }
    if (this.state === 'SHOP') {
      this.handleShopClick();
      return;
    }
  }

  handleShopClick() {
    const hit = getShopHitZone(this.input.mouse.x, this.input.mouse.y, this.shop, this.player);
    if (!hit) return;

    if (hit.type === 'buy') {
      const item = this.shop.items[hit.index];
      if (!item) return;
      if (this.player.items.length >= PLAYER_DEFAULTS.maxItems) {
        this.shop.warningTime = Date.now();
        return;
      }
      if (buyItem(this.shop, this.player, hit.index)) {
        this.log(`Chose ${item.name}!`);
        if (item.ability && !this.abilityTutorialShown) {
          this.abilityTutorialShown = true;
          this._showAbilityTutorial();
        }
        this.updateHUD();
        this.closeShop();
        return;
      }
    } else if (hit.type === 'refresh') {
      if (refreshShop(this.shop, this.player)) {
        this.log('Shop refreshed');
        this.updateHUD();
      }
    } else if (hit.type === 'continue') {
      this.closeShop();
    } else if (hit.type === 'upgrade') {
      if (upgradeShop(this.shop, this.player)) {
        this.log(`Shop upgraded to tier ${this.player.shopLevel + 1}!`);
        this.updateHUD();
      }
    } else if (hit.type === 'buy_cue') {
      if (buyCue(this.player, hit.cueId)) {
        this.log(`Bought ${CUE_TYPES[hit.cueId].name} cue!`);
        this.updateHUD();
        if (this.hud.cueBankPanel) {
          this.hud.cueBankPanel.classList.remove('cue-highlight');
          void this.hud.cueBankPanel.offsetWidth;
          this.hud.cueBankPanel.classList.add('cue-highlight');
          setTimeout(() => this.hud.cueBankPanel.classList.remove('cue-highlight'), 3000);
        }
      }
    }
  }

  handleRightClick() {
  }

  _showAbilityTutorial() {
    if (!this.hud.modifiers) return;
    const panel = this.hud.modifiers.closest('.panel') || this.hud.modifiers.parentElement;
    if (!panel) return;
    panel.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:-4px;border:2px solid var(--accent);border-radius:8px;pointer-events:none;z-index:10;animation:tutorialPulse 1.5s ease-in-out 3;box-shadow:0 0 16px rgba(0,229,255,0.5)';
    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);background:var(--bg);color:var(--accent);font:bold 11px Orbitron,sans-serif;padding:4px 12px;border-radius:4px;white-space:nowrap;border:1px solid var(--accent-dim);pointer-events:none;z-index:10';
    label.textContent = 'CLICK ABILITIES HERE TO ACTIVATE';
    panel.appendChild(overlay);
    panel.appendChild(label);
    if (!document.getElementById('tutorial-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'tutorial-pulse-style';
      style.textContent = '@keyframes tutorialPulse{0%,100%{opacity:0.4;box-shadow:0 0 8px #00e5ff40}50%{opacity:1;box-shadow:0 0 20px #00e5ff80}}';
      document.head.appendChild(style);
    }
    setTimeout(() => { overlay.remove(); label.remove(); }, 5000);
  }

  updateHUD() {
    if (!this.hud) return;
    const p = this.player;
    if (!p) return;
    if (!this._hudCache) this._hudCache = {};
    const cache = this._hudCache;

    if (this.hud.lives) {
      const lk = p.lives;
      if (cache.lives !== lk) {
        cache.lives = lk;
        let hearts = '';
        for (let i = 0; i < Math.floor(p.lives); i++) hearts += '❤ ';
        if (p.lives % 1 >= 0.5) hearts += '♡ ';
        this.hud.lives.textContent = hearts.trim();
      }
    }

    if (this.hud.gold && cache.gold !== p.gold) {
      cache.gold = p.gold;
      this.hud.gold.textContent = p.gold;
    }

    if (this.hud.waveNum) {
      const wn = this.waveIndex + 1;
      if (cache.waveNum !== wn) {
        cache.waveNum = wn;
        this.hud.waveNum.textContent = String(wn).padStart(2, '0');
        if (this.hud.waveName) this.hud.waveName.textContent = `Wave ${wn}`;
      }
    }

    if (this.hud.enemies) {
      const ec = this.enemies.length;
      if (cache.enemies !== ec) {
        cache.enemies = ec;
        this.hud.enemies.textContent = String(ec).padStart(2, '0');
      }
    }

    if (this.hud.pocketed) {
      const pk = this.stats.pocketed;
      if (cache.pocketed !== pk) {
        cache.pocketed = pk;
        this.hud.pocketed.textContent = String(pk).padStart(2, '0');
      }
    }

    if (this.hud.combo) {
      if (cache.combo !== this.combo) {
        cache.combo = this.combo;
        this.hud.combo.textContent = this.combo;
        this.hud.combo.style.color = this.combo >= 5 ? COLORS.gold : COLORS.accent;
      }
    }

    if (this.hud.turnNum) {
      const tn = this.turnCount + 1;
      if (cache.turnNum !== tn) {
        cache.turnNum = tn;
        this.hud.turnNum.textContent = String(tn).padStart(2, '0');
      }
    }
    if (this.hud.turnStatus) {
      const readyCount = this.enemies.filter(e => !e.stunned && e.cooldownTimer <= 0).length;
      if (cache.readyCount !== readyCount) {
        cache.readyCount = readyCount;
        this.hud.turnStatus.textContent = readyCount > 0 ? `${readyCount} READY` : 'SAFE';
        this.hud.turnStatus.style.color = readyCount > 0 ? COLORS.enemyBasic : COLORS.accent;
      }
    }

    if (this.hud.timer) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      if (cache.elapsed !== elapsed) {
        cache.elapsed = elapsed;
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        this.hud.timer.textContent = `${m}:${s}`;
      }
    }

    if (this.hud.threatMatrix) {
      const tKey = this.enemies.map(e => `${e.type}:${e.stunned?1:0}:${e.cooldownTimer}`).join('|');
      if (cache.threatKey !== tKey) {
        cache.threatKey = tKey;
        this.hud.threatMatrix.innerHTML = '';
        for (const e of this.enemies) {
          const div = document.createElement('div');
          div.className = 'enemy-entry';
          const color = e.stunned ? COLORS.stunned : e.color;
          div.innerHTML = `
            <div class="enemy-dot" style="background:${color}; box-shadow: 0 0 8px ${color}80;"></div>
            <div>
              <div class="enemy-name" style="color:${color};">${e.stunned ? 'Stunned' : e.label}</div>
              <div class="enemy-status">${e.stunned ? 'STUNNED' : e.cooldownTimer <= 0 ? 'READY' : `CD: ${e.cooldownTimer}`}</div>
            </div>`;
          this.hud.threatMatrix.appendChild(div);
        }
        if (this.enemies.length === 0) {
          this.hud.threatMatrix.innerHTML = '<div class="enemy-status">NO THREATS</div>';
        }
      }
    }

    if (this.hud.modifiers) {
      const inShop = this.state === 'SHOP';
      const mKey = p.items.map(it => `${it.id}:${p.abilityCharges[it.id]||0}`).join('|') + `|${this.armedAbility}|${p.abilityUsedThisTurn}|${inShop}`;
      if (cache.modKey !== mKey) {
        cache.modKey = mKey;
        this.hud.modifiers.innerHTML = '';
        for (let idx = 0; idx < p.items.length; idx++) {
          const it = p.items[idx];
          const col = RARITY_COLORS[it.rarity] || COLORS.textLight;
          const div = document.createElement('div');
          div.className = 'modifier-entry';
          div.style.borderColor = col + '22';

          if (it.ability) {
            const charges = p.abilityCharges[it.id] || 0;
            const isArmed = this.armedAbility === it.id;
            const canUse = charges > 0 && !p.abilityUsedThisTurn;
            const clickable = canUse || isArmed;
            div.style.cursor = clickable ? 'pointer' : 'default';
            if (isArmed) div.style.borderColor = COLORS.accent;
            const icon = isArmed ? '◉' : canUse ? '⚡' : '◈';
            const nameColor = isArmed ? COLORS.accent : col;
            div.innerHTML = `<div class="modifier-icon" style="color:${nameColor};background:${nameColor}22">${icon}</div><div class="modifier-name" style="color:${nameColor}">${it.name.toUpperCase()}${isArmed ? ' — TARGETING' : ''} <span style="color:${charges > 0 ? COLORS.accent : COLORS.textDim};font-size:9px">[${charges}]</span></div>`;
            if (clickable) {
              div.addEventListener('click', () => this.activateAbility(it.id));
            }
          } else {
            div.innerHTML = `<div class="modifier-icon" style="color:${col};background:${col}22">◈</div><div class="modifier-name" style="color:${col}">${it.name.toUpperCase()}</div>`;
          }

          const desc = document.createElement('div');
          desc.className = 'modifier-desc';
          desc.textContent = it.desc;
          div.appendChild(desc);

          if (inShop) {
            const btn = document.createElement('div');
            btn.className = 'modifier-discard';
            btn.textContent = '×';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              discardItem(p, idx);
              this.log(`Discarded ${it.name}`);
              this.updateHUD();
            });
            div.insertBefore(btn, desc);
          }

          this.hud.modifiers.appendChild(div);
        }
        if (p.items.length === 0) {
          this.hud.modifiers.innerHTML = '<div class="enemy-status">NONE</div>';
        }
      }
    }

    if (this.hud.cueBank) {
      const cKey = p.cues.join(',') + ':' + p.activeCue;
      if (cache.cueKey !== cKey) {
        cache.cueKey = cKey;
        this.hud.cueBank.innerHTML = '';
        for (const cId of p.cues) {
          const cue = CUE_TYPES[cId];
          const div = document.createElement('div');
          div.className = 'cue-entry ' + (p.activeCue === cId ? 'active' : 'inactive');
          div.textContent = (p.activeCue === cId ? '▶ ' : '  ') + cue.name;
          div.addEventListener('click', () => {
            if (switchCue(p, cId)) this.updateHUD();
          });
          this.hud.cueBank.appendChild(div);
        }
      }
    }

    if (this.hud.eventLog) {
      const eKey = this.eventLog.join('||');
      if (cache.eventKey !== eKey) {
        cache.eventKey = eKey;
        this.hud.eventLog.innerHTML = '';
        for (const msg of this.eventLog) {
          const div = document.createElement('div');
          div.className = 'event-entry';
          div.innerHTML = `<strong>▶</strong> ${msg}`;
          this.hud.eventLog.appendChild(div);
        }
      }
    }
  }

  loop() {
    const zoom = getZoom(this);
    if (this.canvasCSSW) {
      updateInputScale(this.input, WORLD.w, WORLD.h, this.canvasCSSW, this.canvasCSSH, zoom);
    }

    if (this.state === 'AIMING') {
      if (consumeMouseJustDown(this.input)) {
        if (this.armedAbility && this.input.mouseDownOnCanvas) {
          this.confirmArmedAbility();
        } else if (!this.armedAbility) {
          const dx = this.input.mouse.x - this.player.x;
          const dy = this.input.mouse.y - this.player.y;
          if (dx * dx + dy * dy <= (this.player.radius + 20) * (this.player.radius + 20)) {
            this.input.dragging = true;
          }
        }
      }
      if (consumeMouseJustUp(this.input)) {
        if (this.input.dragging) this.shoot();
      }
      consumeClick(this.input);
    } else {
      consumeMouseJustDown(this.input);
      consumeMouseJustUp(this.input);
      if (this.input.dragging) this.input.dragging = false;
      if (consumeClick(this.input)) this.handleClick();
    }
    if (consumeRightClick(this.input)) this.handleRightClick();
    this.update();
    this.render();
    if (this.state === 'AIMING' || this.state === 'MOVING' || this.state === 'SETTLING') {
      if (this.hud.timer) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        this.hud.timer.textContent = `${m}:${s}`;
      }
    }
    requestAnimationFrame(() => this.loop());
  }

  start() {
    this.loop();
  }
}
