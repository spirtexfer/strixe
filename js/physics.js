import { sub, scale, len, dot } from './vector.js';
import { TABLE, POCKETS, PHYS, SUCTION } from './constants.js';

export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.radius + b.radius;
  return dx * dx + dy * dy < rr * rr;
}

export function getNearestPocket(pos) {
  let best = null;
  let bestD = Infinity;
  for (const p of POCKETS) {
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function getNearestPocketIndex(pos) {
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < POCKETS.length; i++) {
    const dx = pos.x - POCKETS[i].x;
    const dy = pos.y - POCKETS[i].y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return bestIdx;
}

export function isInPocket(pos) {
  for (const p of POCKETS) {
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    if (dx * dx + dy * dy < p.r * p.r) return true;
  }
  return false;
}

export function getSuctionRadius(pocketIndex, items, goldenPockets) {
  let radius = SUCTION.baseRadius;
  if (items) {
    if (items.some(it => it.id === 'pocket_assist_1')) radius += 35;
    if (items.some(it => it.id === 'pocket_assist_2')) radius += 55;
    if (items.some(it => it.id === 'pocket_assist')) radius += 50;
    if (items.some(it => it.id === 'pull_field')) radius += 65;
    if (items.some(it => it.id === 'deep_pull')) radius += 100;
    if (items.some(it => it.id === 'quicksand')) radius += 45;
    if (items.some(it => it.id === 'marked_pockets') && goldenPockets && goldenPockets.includes(pocketIndex)) {
      radius = Math.max(radius, 70) + 40;
    }
  }
  return radius;
}

export function getSuctionForce(items) {
  let force = SUCTION.pullForce;
  if (items) {
    if (items.some(it => it.id === 'quicksand')) force += 0.06;
    if (items.some(it => it.id === 'stable_sink')) force += 0.04;
  }
  return force;
}

export function applySuction(ball, items, goldenPockets) {
  const pocket = getNearestPocket(ball);
  if (!pocket) return { pulled: false, pocketed: false, pocketIndex: -1 };

  const pIdx = getNearestPocketIndex(ball);
  let suctionR = getSuctionRadius(pIdx, items, goldenPockets);

  const dx = pocket.x - ball.x;
  const dy = pocket.y - ball.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d < 1) return { pulled: false, pocketed: true, pocketIndex: pIdx };

  const eventHorizon = items && items.some(it => it.id === 'event_horizon');
  if (d < suctionR) {
    if (eventHorizon) {
      ball.x = pocket.x;
      ball.y = pocket.y;
      return { pulled: true, pocketed: true, pocketIndex: pIdx };
    }
    const force = getSuctionForce(items) * (1 - d / suctionR);
    ball.vx = (ball.vx || 0) + (dx / d) * force;
    ball.vy = (ball.vy || 0) + (dy / d) * force;
    return { pulled: true, pocketed: false, pocketIndex: pIdx };
  }

  return { pulled: false, pocketed: false, pocketIndex: pIdx };
}

export function applyPlayerSuction(player) {
  const pocket = getNearestPocket(player);
  if (!pocket) return;
  const dx = pocket.x - player.x;
  const dy = pocket.y - player.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return;
  player.x += (dx / d) * SUCTION.playerPullStrength;
  player.y += (dy / d) * SUCTION.playerPullStrength;
}

export function resolveCircleCollision(a, b) {
  const n = sub(b, a);
  const d = len(n);
  const overlap = a.radius + b.radius - d;
  if (overlap <= 0 || d === 0) return false;

  const normal = scale(n, 1 / d);
  const sep = scale(normal, overlap / 2);
  a.x -= sep.x; a.y -= sep.y;
  b.x += sep.x; b.y += sep.y;

  const relVel = sub({ x: a.vx, y: a.vy }, { x: b.vx || 0, y: b.vy || 0 });
  const velAlongNormal = dot(relVel, normal);
  if (velAlongNormal < 0) return true;

  const massA = a.mass || 1;
  const massB = b.mass || 1;
  const e = PHYS.restitution;
  const j = -(1 + e) * velAlongNormal / (1 / massA + 1 / massB);

  const impulse = scale(normal, j);
  a.vx += impulse.x / massA;
  a.vy += impulse.y / massA;
  b.vx = (b.vx || 0) - impulse.x / massB;
  b.vy = (b.vy || 0) - impulse.y / massB;

  return true;
}

function nearAnyPocket(x, y) {
  for (const p of POCKETS) {
    const dx = x - p.x;
    const dy = y - p.y;
    const openingR = p.r + 6;
    if (dx * dx + dy * dy < openingR * openingR) return true;
  }
  return false;
}

export function wallBounce(ball) {
  let bounced = false;
  const r = ball.radius;

  if (ball.x - r < TABLE.left) {
    if (!nearAnyPocket(ball.x, ball.y)) {
      ball.x = TABLE.left + r;
      ball.vx = Math.abs(ball.vx) * PHYS.wallRestitution;
      bounced = true;
    }
  } else if (ball.x + r > TABLE.right) {
    if (!nearAnyPocket(ball.x, ball.y)) {
      ball.x = TABLE.right - r;
      ball.vx = -Math.abs(ball.vx) * PHYS.wallRestitution;
      bounced = true;
    }
  }

  if (ball.y - r < TABLE.top) {
    if (!nearAnyPocket(ball.x, ball.y)) {
      ball.y = TABLE.top + r;
      ball.vy = Math.abs(ball.vy) * PHYS.wallRestitution;
      bounced = true;
    }
  } else if (ball.y + r > TABLE.bottom) {
    if (!nearAnyPocket(ball.x, ball.y)) {
      ball.y = TABLE.bottom - r;
      ball.vy = -Math.abs(ball.vy) * PHYS.wallRestitution;
      bounced = true;
    }
  }

  return bounced;
}

export function predictTrajectory(startX, startY, vx, vy, enemies, playerRadius, friction, items, backspin) {
  const playerPath = [{ x: startX, y: startY }];
  const ball = { x: startX, y: startY, vx, vy, radius: playerRadius, mass: 1.2 };

  const backspinAmt = backspin || 0;
  let firstBounce = true;
  let bounceCount = 0;
  let hasHit = false;

  const bounceSurge = items && items.some(it => it.id === 'bounce_surge');
  const overdriveCore = items && items.some(it => it.id === 'overdrive_core');
  const cleanRails = items && items.some(it => it.id === 'clean_rails');
  const speedDrip = items && items.some(it => it.id === 'speed_drip');
  const hitFlow = items && items.some(it => it.id === 'hit_flow');
  const impactLoop = items && items.some(it => it.id === 'impact_loop');
  const ricochetEngine = items && items.some(it => it.id === 'ricochet_engine');
  const firmCore = items && items.some(it => it.id === 'firm_core');
  const infiniteRunback = items && items.some(it => it.id === 'infinite_runback');
  let hitCount = 0;

  const simEnemies = enemies.map(e => ({
    x: e.x, y: e.y, vx: e.vx || 0, vy: e.vy || 0,
    radius: e.radius, mass: e.mass || 1,
    color: e.color,
    path: [{ x: e.x, y: e.y }],
    hitByPlayer: false,
    pocketed: false,
  }));

  const maxFrames = 800;
  let sampleCounter = 0;

  for (let frame = 0; frame < maxFrames; frame++) {
    const ballSpeed = len({ x: ball.vx, y: ball.vy });
    const subSteps = Math.max(1, Math.ceil(ballSpeed / (ball.radius * 0.8)));
    let hitThisFrame = false;

    for (let step = 0; step < subSteps; step++) {
      ball.x += ball.vx / subSteps;
      ball.y += ball.vy / subSteps;

      const bounced = wallBounce(ball);
      if (bounced) {
        bounceCount++;
        if (bounceSurge && bounceCount <= 2) {
          ball.vx *= 1.25;
          ball.vy *= 1.25;
        }
        if (overdriveCore && bounceCount <= 3) {
          ball.vx *= 1.6;
          ball.vy *= 1.6;
        }
        if (cleanRails) {
          friction = Math.min(friction * 1.01, 1);
        }
      }

      const preHitSpeed = len({ x: ball.vx, y: ball.vy });

      for (const se of simEnemies) {
        if (se.pocketed) continue;
        const overlapping = circlesOverlap(ball, se);

        if (se.hitByPlayer) {
          if (!overlapping) se.hitByPlayer = false;
          continue;
        }
        if (!overlapping) continue;

        se.hitByPlayer = true;
        hitThisFrame = true;
        hasHit = true;
        hitCount++;
        playerPath.push({ x: ball.x, y: ball.y, hit: true });

        resolveCircleCollision(ball, se);

        if (firmCore) {
          const postSpeed = len({ x: ball.vx, y: ball.vy });
          if (postSpeed > 0.1) {
            const retain = Math.min(preHitSpeed * 0.85, postSpeed * 1.2);
            const ratio = retain / postSpeed;
            ball.vx *= ratio;
            ball.vy *= ratio;
          }
        }

        if (ricochetEngine) {
          const postSpeed = len({ x: ball.vx, y: ball.vy });
          if (postSpeed > 0.1) {
            const boost = preHitSpeed * 0.9;
            const ratio = boost / postSpeed;
            ball.vx *= ratio;
            ball.vy *= ratio;
          }
        }

        if (hitFlow) {
          ball.vx *= 1.08;
          ball.vy *= 1.08;
        }

        if (impactLoop && hitCount <= 3) {
          ball.vx *= 1.15;
          ball.vy *= 1.15;
        }

        if (infiniteRunback) {
          const postSpeed = len({ x: ball.vx, y: ball.vy });
          if (postSpeed > 0.1) {
            ball.vx *= 0.6;
            ball.vy *= 0.6;
            ball.vx *= 1.15;
            ball.vy *= 1.15;
          }
        }

        const eSpeed = len({ x: se.vx, y: se.vy });
        const maxES = preHitSpeed * 0.75;
        if (eSpeed > maxES && eSpeed > 0.1) {
          const ratio = maxES / eSpeed;
          se.vx *= ratio;
          se.vy *= ratio;
        }

        if (backspinAmt > 0) {
          ball.vx = -ball.vx * backspinAmt;
          ball.vy = -ball.vy * backspinAmt;
        }
      }

      if (hitThisFrame) break;
    }

    let frameFriction = friction;
    if (infiniteRunback) frameFriction = 1;
    if (speedDrip && !hasHit) frameFriction = 1;
    ball.vx *= frameFriction;
    ball.vy *= frameFriction;

    for (let a = 0; a < simEnemies.length; a++) {
      for (let b = a + 1; b < simEnemies.length; b++) {
        const ea = simEnemies[a], eb = simEnemies[b];
        if (ea.pocketed || eb.pocketed) continue;
        if (circlesOverlap(ea, eb)) {
          const preA = len({ x: ea.vx, y: ea.vy });
          const preB = len({ x: eb.vx, y: eb.vy });
          resolveCircleCollision(ea, eb);
          const maxEESpeed = Math.max(preA, preB) * 0.65;
          for (const b2 of [ea, eb]) {
            const s = len({ x: b2.vx, y: b2.vy });
            if (s > maxEESpeed && s > 0.1) {
              const ratio = maxEESpeed / s;
              b2.vx *= ratio;
              b2.vy *= ratio;
            }
          }
        }
      }
    }

    for (const se of simEnemies) {
      if (se.pocketed) continue;
      if (Math.abs(se.vx) > 0.01 || Math.abs(se.vy) > 0.01) {
        se.x += se.vx;
        se.y += se.vy;
        se.vx *= PHYS.friction;
        se.vy *= PHYS.friction;
        wallBounce(se);
        if (Math.abs(se.vx) < 0.05) se.vx = 0;
        if (Math.abs(se.vy) < 0.05) se.vy = 0;
      }
      if (isInPocket(se)) {
        se.pocketed = true;
        se.vx = 0;
        se.vy = 0;
      }
    }

    if (isInPocket(ball)) {
      playerPath.push({ x: ball.x, y: ball.y });
      break;
    }

    sampleCounter++;
    if (sampleCounter >= 3) {
      playerPath.push({ x: ball.x, y: ball.y });
      for (const se of simEnemies) {
        if (!se.pocketed && (Math.abs(se.vx) > 0.05 || Math.abs(se.vy) > 0.05 || se.path.length > 1)) {
          se.path.push({ x: se.x, y: se.y });
        }
      }
      sampleCounter = 0;
    }

    const curSpeed = len({ x: ball.vx, y: ball.vy });
    if (curSpeed < PHYS.minSpeed) {
      ball.vx = 0;
      ball.vy = 0;
      break;
    }
  }

  playerPath.push({ x: ball.x, y: ball.y });
  for (const se of simEnemies) {
    if (se.path.length > 1 || se.pocketed) {
      se.path.push({ x: se.x, y: se.y });
    }
  }

  const enemyPaths = simEnemies
    .filter(se => se.path.length > 1 || se.pocketed)
    .map(se => ({ path: se.path, color: se.color, pocketed: se.pocketed }));

  return { playerPath, enemyPaths };
}
