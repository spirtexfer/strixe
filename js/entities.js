import { PLAYER_DEFAULTS, ENEMY_TYPES, TABLE, POCKETS, COLORS } from './constants.js';
import { normalize, sub } from './vector.js';

export function createPlayer() {
  const cx = (TABLE.left + TABLE.right) / 2;
  const cy = (TABLE.top + TABLE.bottom) / 2;
  return {
    x: cx, y: cy,
    vx: 0, vy: 0,
    radius: PLAYER_DEFAULTS.radius,
    mass: 1.2,
    lives: PLAYER_DEFAULTS.lives,
    gold: PLAYER_DEFAULTS.gold,
    items: [],
    blinkUsed: false,
    shopLevel: 0,
    cues: ['standard'],
    activeCue: 'standard',
    abilityCharges: {},
    abilityUsedThisTurn: false,
  };
}

export function createEnemy(typeName, x, y) {
  const t = ENEMY_TYPES[typeName];
  return {
    x, y,
    vx: 0, vy: 0,
    radius: t.radius,
    mass: t.mass,
    type: typeName,
    color: t.color,
    label: t.label,
    stunned: false,
    stunnedThisTurn: false,
    projectileSpeed: t.projectileSpeed,
    damage: t.damage,
    goldValue: t.points * 5,
    cooldownTimer: t.cooldown - 1,
    cooldownMax: t.cooldown,
    firePattern: t.firePattern,
  };
}

export function createProjectile(x, y, vx, vy, damage, color) {
  return {
    x, y, vx, vy,
    radius: 4,
    damage,
    color: color || COLORS.projectile,
    frozen: true,
  };
}

function randomEnemyPos(existing, player) {
  const margin = 40;
  const minPocketDist = 60;
  const minPlayerDist = 120;
  const minEnemyDist = 40;

  for (let attempt = 0; attempt < 200; attempt++) {
    const x = TABLE.left + margin + Math.random() * (TABLE.w - margin * 2);
    const y = TABLE.top + margin + Math.random() * (TABLE.h - margin * 2);

    let valid = true;
    for (const p of POCKETS) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < minPocketDist * minPocketDist) { valid = false; break; }
    }
    if (!valid) continue;

    if (player) {
      const dx = x - player.x, dy = y - player.y;
      if (dx * dx + dy * dy < minPlayerDist * minPlayerDist) continue;
    }

    let tooClose = false;
    for (const e of existing) {
      const dx = x - e.x, dy = y - e.y;
      if (dx * dx + dy * dy < minEnemyDist * minEnemyDist) { tooClose = true; break; }
    }
    if (tooClose) continue;

    return [x, y];
  }

  return [TABLE.left + TABLE.w * 0.3, TABLE.top + TABLE.h * 0.3];
}

export function generateWaveEnemies(waveNumber, player) {
  let points = waveNumber;
  const enemies = [];

  const [fx, fy] = randomEnemyPos(enemies, player);
  enemies.push(createEnemy('basic', fx, fy));

  const types = ['basic', 'heavy', 'speed'];
  while (points > 0) {
    const affordable = types.filter(t => ENEMY_TYPES[t].points <= points);
    if (affordable.length === 0) break;
    const pick = affordable[Math.floor(Math.random() * affordable.length)];
    points -= ENEMY_TYPES[pick].points;
    const [ex, ey] = randomEnemyPos(enemies, player);
    enemies.push(createEnemy(pick, ex, ey));
  }

  return enemies;
}

export function fireEnemyProjectiles(enemy, player) {
  if (enemy.stunned || enemy.cooldownTimer > 0) return [];

  const projectiles = [];
  const speed = enemy.projectileSpeed;

  if (enemy.firePattern === 'single') {
    const dir = normalize(sub(player, enemy));
    projectiles.push(createProjectile(
      enemy.x + dir.x * (enemy.radius + 6),
      enemy.y + dir.y * (enemy.radius + 6),
      dir.x * speed, dir.y * speed,
      enemy.damage, enemy.color,
    ));
  } else if (enemy.firePattern === 'radial8') {
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 2 * i / 8;
      const dx = Math.cos(a), dy = Math.sin(a);
      projectiles.push(createProjectile(
        enemy.x + dx * (enemy.radius + 6),
        enemy.y + dy * (enemy.radius + 6),
        dx * speed, dy * speed,
        enemy.damage, enemy.color,
      ));
    }
  } else if (enemy.firePattern === 'cone3') {
    const dir = normalize(sub(player, enemy));
    const baseAngle = Math.atan2(dir.y, dir.x);
    const spread = 30 * Math.PI / 180;
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * (spread / 2);
      const dx = Math.cos(a), dy = Math.sin(a);
      projectiles.push(createProjectile(
        enemy.x + dx * (enemy.radius + 6),
        enemy.y + dy * (enemy.radius + 6),
        dx * speed, dy * speed,
        enemy.damage, enemy.color,
      ));
    }
  }

  enemy.cooldownTimer = enemy.cooldownMax;
  return projectiles;
}

export function playerHasItem(player, itemId) {
  return player.items.some(it => it.id === itemId);
}

export function respawnPlayer(player) {
  player.x = (TABLE.left + TABLE.right) / 2;
  player.y = (TABLE.top + TABLE.bottom) / 2;
  player.vx = 0;
  player.vy = 0;
}
