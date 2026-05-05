import { COLORS, TABLE, POCKETS, WORLD, PHYS, CUE_TYPES, SUCTION, COMBO_CAP, COMBO_POWER_BOOST } from './constants.js';
import { sub, len, normalize, angle, dist } from './vector.js';
import { predictTrajectory, getNearestPocket, getSuctionRadius } from './physics.js';

let _currentZoom = 1;

export function getZoom(state) {
  let target = 1;
  if (state.state === 'AIMING' && state.input.dragging) {
    const p = state.player;
    const m = state.input.mouse;
    const dx = m.x - p.x, dy = m.y - p.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    const maxDrag = PHYS.maxForce / PHYS.forceScale;
    const clampedDist = Math.min(dragDist, maxDrag);
    if (clampedDist >= 1) {
      const nx = dx / dragDist, ny = dy / dragDist;
      const gripX = p.x + nx * (clampedDist + 120);
      const gripY = p.y + ny * (clampedDist + 120);
      const pad = 20;
      const cx = WORLD.w / 2, cy = WORLD.h / 2;
      const extX = Math.abs(gripX - cx) + pad;
      const extY = Math.abs(gripY - cy) + pad;
      const zx = extX > cx ? cx / extX : 1;
      const zy = extY > cy ? cy / extY : 1;
      target = Math.min(1, zx, zy);
    }
  }
  const speed = target < _currentZoom ? 0.08 : 0.04;
  _currentZoom += (target - _currentZoom) * speed;
  if (Math.abs(_currentZoom - target) < 0.002) _currentZoom = target;
  return _currentZoom;
}

export function drawFrame(ctx, state) {
  const zoom = getZoom(state);

  ctx.save();
  if (zoom < 1) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(-WORLD.w, -WORLD.h, WORLD.w * 3, WORLD.h * 3);
    ctx.translate(WORLD.w / 2, WORLD.h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-WORLD.w / 2, -WORLD.h / 2);
  }

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  drawTable(ctx);
  drawPockets(ctx, state.goldenPockets || [], state.player);

  if (state.state === 'AIMING' && state.input.dragging) {
    drawAimLine(ctx, state.player, state.input.mouse, state.enemies, state.combo || 0);
    drawCue(ctx, state.player, state.input.mouse);
  }

  drawBiasIndicators(ctx, state.enemies);
  drawProjectiles(ctx, state.projectiles);
  drawEnemies(ctx, state.enemies);
  drawPlayer(ctx, state.player);
  drawAnimations(ctx, state.animations || []);

  if ((state.state === 'MOVING' || state.state === 'SETTLING') && state.input.spaceHeld) {
    drawStaticFilter(ctx);
    ctx.save();
    ctx.font = "bold 11px 'Orbitron', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.accent;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.006);
    ctx.fillText('▶▶ FAST', WORLD.w - 14, WORLD.h - 12);
    ctx.restore();
  }

  ctx.restore();
}

function drawTable(ctx) {
  const grad = ctx.createRadialGradient(
    WORLD.w / 2, WORLD.h / 2, 50,
    WORLD.w / 2, WORLD.h / 2, 400,
  );
  grad.addColorStop(0, '#0f2a55');
  grad.addColorStop(1, '#0a1a3a');
  ctx.fillStyle = grad;
  roundRect(ctx, TABLE.left, TABLE.top, TABLE.w, TABLE.h, 6);
  ctx.fill();

  ctx.strokeStyle = COLORS.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.5;
  roundRect(ctx, TABLE.left - 2, TABLE.top - 2, TABLE.w + 4, TABLE.h + 4, 8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 1;
}

function drawPockets(ctx, goldenPockets, player) {
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
  const items = player ? player.items : [];

  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const isGolden = goldenPockets && goldenPockets.includes(i);
    const suctionR = getSuctionRadius(i, items, goldenPockets);

    const suctGrad = ctx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, suctionR);
    suctGrad.addColorStop(0, isGolden ? 'rgba(255, 170, 0, 0.08)' : 'rgba(0, 229, 255, 0.06)');
    suctGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, suctionR, 0, Math.PI * 2);
    ctx.fillStyle = suctGrad;
    ctx.globalAlpha = 0.4 + 0.2 * pulse;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, suctionR, 0, Math.PI * 2);
    ctx.strokeStyle = isGolden ? COLORS.golden : COLORS.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.1 + 0.06 * pulse;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r + 4);
    grad.addColorStop(0, '#020408');
    grad.addColorStop(1, '#000000');
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = isGolden ? COLORS.golden : COLORS.pocketBorder;
    ctx.lineWidth = isGolden ? 2.5 : 2;
    ctx.stroke();

    if (isGolden) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.golden;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3 + 0.25 * pulse;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.08 + 0.06 * pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(ctx, player) {
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

  if (speed > 2) {
    const trailLen = Math.min(speed * 3, 45);
    const nx = -player.vx / speed;
    const ny = -player.vy / speed;
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.arc(player.x + nx * trailLen * t, player.y + ny * trailLen * t,
        player.radius * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.player;
      ctx.globalAlpha = 0.12 * (1 - t);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();


  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEnemies(ctx, enemies) {
  for (const e of enemies) {
    const speed = Math.sqrt((e.vx || 0) * (e.vx || 0) + (e.vy || 0) * (e.vy || 0));

    if (speed > 2) {
      const trailLen = Math.min(speed * 3, 40);
      const nx = -(e.vx || 0) / speed;
      const ny = -(e.vy || 0) / speed;
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.arc(e.x + nx * trailLen * t, e.y + ny * trailLen * t,
          e.radius * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = e.stunned ? COLORS.stunned : e.color;
        ctx.globalAlpha = 0.1 * (1 - t);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (!e.stunned && e.cooldownMax > 0) {
      const ringR = e.radius + 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.12;
      ctx.stroke();

      if (e.cooldownTimer <= 0) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
        ctx.beginPath();
        ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.3 + 0.4 * pulse;
        ctx.stroke();
      } else {
        const progress = 1 - (e.cooldownTimer / e.cooldownMax);
        const startA = -Math.PI / 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, ringR, startA, startA + Math.PI * 2 * progress);
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.stunned ? COLORS.stunned : e.color;
    ctx.globalAlpha = e.stunned ? 0.55 : 0.9;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (e.type === 'heavy' && !e.stunned) {
      ctx.strokeStyle = '#cc6600';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius - 4, 0, Math.PI * 2);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
    } else if (e.type === 'speed' && !e.stunned) {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.x - 2, e.y - 2, e.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.2;
      ctx.fill();
    } else if (e.stunned) {
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = COLORS.stunned;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.font = "bold 8px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = e.stunned ? COLORS.stunned : e.color;
    ctx.globalAlpha = 0.8;
    ctx.fillText(e.stunned ? 'STUNNED' : e.label, e.x, e.y - e.radius - 8);
    ctx.globalAlpha = 1;
  }
}

function drawProjectiles(ctx, projectiles) {
  for (const p of projectiles) {
    if (!p.frozen) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 0.5) {
        const nx = -p.vx / speed;
        const ny = -p.vy / speed;
        const tailLen = Math.min(speed * 4, 20);
        const grad = ctx.createLinearGradient(p.x, p.y, p.x + nx * tailLen, p.y + ny * tailLen);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.radius * 1.5;
        ctx.globalAlpha = 0.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + nx * tailLen, p.y + ny * tailLen);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.frozen ? 0.4 + 0.2 * Math.sin(Date.now() * 0.004) : 0.8;
    ctx.fill();
    ctx.restore();
  }
}

function drawCue(ctx, player, mouse) {
  const toMouse = sub(mouse, player);
  const d = len(toMouse);
  if (d < 1) return;

  const dir = normalize(toMouse);
  const maxDragDist = PHYS.maxForce / PHYS.forceScale;
  const powerT = Math.min(d / maxDragDist, 1);

  const ringR = player.radius + 6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(player.x, player.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * powerT);
  const ringColor = powerT <= 0.10 ? COLORS.textDim : powerT < 0.4 ? COLORS.accent : powerT < 0.75 ? COLORS.gold : COLORS.enemyBasic;
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(player.x, player.y, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.08;
  ctx.stroke();

  ctx.font = "bold 10px 'Orbitron', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillStyle = ringColor;
  ctx.globalAlpha = 0.85;
  const label = powerT <= 0.10 ? 'CANCEL' : Math.round(powerT * 100) + '%';
  ctx.fillText(label, player.x, player.y + ringR + 14);
  ctx.restore();

  const cueLen = 80;
  const gripLen = 40;
  const clampedDist = Math.min(d, maxDragDist);
  const tipX = player.x + dir.x * clampedDist;
  const tipY = player.y + dir.y * clampedDist;
  const baseX = tipX + dir.x * cueLen;
  const baseY = tipY + dir.y * cueLen;
  const gripX = baseX + dir.x * gripLen;
  const gripY = baseY + dir.y * gripLen;

  ctx.save();
  ctx.lineCap = 'round';

  let woodColor = COLORS.cueWood;
  let gripColorVal = COLORS.cueGrip;
  let tipColorVal = COLORS.cueTip;
  if (player.activeCue === 'draw') {
    woodColor = '#4a4a6a';
    gripColorVal = '#2a2a4a';
    tipColorVal = '#6080ff';
  }

  ctx.strokeStyle = woodColor;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX, baseY);
  ctx.stroke();

  ctx.strokeStyle = gripColorVal;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(gripX, gripY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
  ctx.fillStyle = tipColorVal;
  ctx.globalAlpha = 0.7;
  ctx.fill();

  ctx.restore();
}

function drawAimLine(ctx, player, mouse, enemies, combo) {
  const toMouse = sub(mouse, player);
  const d = len(toMouse);
  if (d < 1) return;

  const maxDragDist = PHYS.maxForce / PHYS.forceScale;
  const powerT = Math.min(d / maxDragDist, 1);
  if (powerT <= 0.10) return;

  const dir = normalize(toMouse);
  let maxF = PHYS.maxForce;
  if (player.items && player.items.some(it => it.id === 'power_shot')) maxF *= 1.4;
  if (player.items && player.items.some(it => it.id === 'light_frame')) maxF *= 1.15;
  const comboBoost = 1 + Math.min(combo || 0, COMBO_CAP) * COMBO_POWER_BOOST;
  let force = Math.min(d * PHYS.forceScale, maxF) * comboBoost;

  const vx = -dir.x * force;
  const vy = -dir.y * force;

  let friction = PHYS.friction;
  if (player.items && player.items.some(it => it.id === 'slick_surface')) friction = 0.992;
  if (player.items && player.items.some(it => it.id === 'momentum_buffer')) friction = 1 - (1 - friction) * 0.7;
  if (player.items && player.items.some(it => it.id === 'infinite_runback')) friction = 1;
  const cueMod = CUE_TYPES[player.activeCue]?.frictionMod || 1;
  if (cueMod !== 1) friction = 1 - (1 - friction) * cueMod;

  const backspin = CUE_TYPES[player.activeCue]?.backspin || 0;
  const { playerPath, enemyPaths } = predictTrajectory(player.x, player.y, vx, vy, enemies, player.radius, friction, player.items, backspin);

  ctx.save();

  for (const ep of enemyPaths) {
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = ep.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(ep.path[0].x, ep.path[0].y);
    for (let i = 1; i < ep.path.length; i++) {
      ctx.lineTo(ep.path[i].x, ep.path[i].y);
    }
    ctx.stroke();

    const end = ep.path[ep.path.length - 1];
    ctx.setLineDash([]);
    if (ep.pocketed) {
      ctx.beginPath();
      ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = ep.color;
      ctx.globalAlpha = 0.4;
      ctx.fill();
    }
  }

  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(playerPath[0].x, playerPath[0].y);
  for (let i = 1; i < playerPath.length; i++) {
    ctx.lineTo(playerPath[i].x, playerPath[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (playerPath.length > 1) {
    const end = playerPath[playerPath.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.white;
    ctx.globalAlpha = 0.3;
    ctx.fill();
  }

  for (const pt of playerPath) {
    if (pt.hit) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.enemyBasic;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawTitleScreen(ctx) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  drawTable(ctx);
  drawPockets(ctx);

  ctx.save();
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 40;
  ctx.font = "900 64px 'Orbitron', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('STRIXE', WORLD.w / 2, WORLD.h / 2 - 30);
  ctx.shadowBlur = 0;

  ctx.font = "14px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.textMid;
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(Date.now() * 0.003);
  ctx.fillText('CLICK TO PLAY', WORLD.w / 2, WORLD.h / 2 + 30);
  ctx.globalAlpha = 1;

  ctx.font = "11px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('v0.1.0 ALPHA', WORLD.w / 2, WORLD.h / 2 + 60);
  ctx.restore();
}

export function drawGameOver(ctx, stats) {
  ctx.fillStyle = 'rgba(6, 7, 13, 0.85)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.shadowColor = COLORS.enemyBasic;
  ctx.shadowBlur = 30;
  ctx.font = "900 48px 'Orbitron', sans-serif";
  ctx.fillStyle = COLORS.enemyBasic;
  ctx.fillText('GAME OVER', WORLD.w / 2, WORLD.h / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.font = "13px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.textLight;
  ctx.fillText(`Waves Cleared: ${stats.wavesCleared}`, WORLD.w / 2, WORLD.h / 2 - 10);
  ctx.fillText(`Enemies Pocketed: ${stats.pocketed}`, WORLD.w / 2, WORLD.h / 2 + 15);
  ctx.fillText(`Gold Earned: ${stats.goldEarned}g`, WORLD.w / 2, WORLD.h / 2 + 40);

  ctx.fillStyle = COLORS.textMid;
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.003);
  ctx.fillText('CLICK TO PLAY AGAIN', WORLD.w / 2, WORLD.h / 2 + 80);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawVictory(ctx, stats) {
  ctx.fillStyle = 'rgba(6, 7, 13, 0.85)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.save();
  ctx.textAlign = 'center';

  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 30;
  ctx.font = "900 48px 'Orbitron', sans-serif";
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('VICTORY', WORLD.w / 2, WORLD.h / 2 - 60);
  ctx.shadowBlur = 0;

  ctx.font = "13px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.textLight;
  ctx.fillText(`All Waves Cleared!`, WORLD.w / 2, WORLD.h / 2 - 10);
  ctx.fillText(`Enemies Pocketed: ${stats.pocketed}`, WORLD.w / 2, WORLD.h / 2 + 15);
  ctx.fillText(`Gold Earned: ${stats.goldEarned}g`, WORLD.w / 2, WORLD.h / 2 + 40);

  ctx.fillStyle = COLORS.textMid;
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() * 0.003);
  ctx.fillText('CLICK TO PLAY AGAIN', WORLD.w / 2, WORLD.h / 2 + 80);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBiasIndicators(ctx, enemies) {
}

export function drawAnimations(ctx, animations) {
  for (const a of animations) {
    const t = a.frame / a.duration;

    if (a.type === 'pocket') {
      const cx = a.startX + (a.pocketX - a.startX) * t;
      const cy = a.startY + (a.pocketY - a.startY) * t;
      const r = a.radius * (1 - t);

      ctx.save();
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 14 * (1 - t);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(r, 0.5), 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.globalAlpha = 0.85 * (1 - t * 0.4);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

    } else if (a.type === 'flash') {
      const r = 16 * t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.fill();
      ctx.restore();

    } else if (a.type === 'sparks') {
      ctx.save();
      for (const sp of a.particles) {
        const px = sp.x + sp.vx * a.frame;
        const py = sp.y + sp.vy * a.frame;
        const size = 2.5 * (1 - t);
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(size, 0.3), 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.globalAlpha = 0.9 * (1 - t);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();

    } else if (a.type === 'ring_burst') {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const delay = i * 0.12;
        const rt = Math.max(0, t - delay) / (1 - delay);
        if (rt <= 0 || rt >= 1) continue;
        const r = 8 + 50 * rt;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 2.5 * (1 - rt);
        ctx.globalAlpha = 0.6 * (1 - rt);
        ctx.shadowColor = a.color;
        ctx.shadowBlur = 12 * (1 - rt);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();

    } else if (a.type === 'text_float') {
      ctx.save();
      ctx.font = "bold 14px 'Orbitron', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = a.color;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillText(a.text, a.x, a.y - 20 * t);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();

    } else if (a.type === 'screen_flash') {
      ctx.save();
      ctx.fillStyle = a.color;
      ctx.globalAlpha = 0.15 * (1 - t);
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

function drawStaticFilter(ctx) {
  ctx.save();
  const t = Date.now();

  for (let i = 0; i < 60; i++) {
    const x = (Math.sin(i * 7919 + t * 0.07) * 0.5 + 0.5) * WORLD.w;
    const y = (Math.cos(i * 6271 + t * 0.09) * 0.5 + 0.5) * WORLD.h;
    const size = 1 + ((i * 3571 + t) % 3);
    ctx.fillStyle = i % 3 === 0 ? COLORS.accent : '#ffffff';
    ctx.globalAlpha = 0.04 + 0.03 * Math.sin(i + t * 0.01);
    ctx.fillRect(x, y, size, size);
  }

  const scanY = (t * 0.4) % (WORLD.h + 40) - 20;
  ctx.fillStyle = COLORS.white;
  ctx.globalAlpha = 0.03;
  ctx.fillRect(0, scanY, WORLD.w, 2);
  ctx.globalAlpha = 0.015;
  ctx.fillRect(0, scanY - 8, WORLD.w, 1);
  ctx.fillRect(0, scanY + 8, WORLD.w, 1);

  for (let sy = 0; sy < WORLD.h; sy += 4) {
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.02;
    ctx.fillRect(0, sy, WORLD.w, 1);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
