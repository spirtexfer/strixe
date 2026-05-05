import { ITEMS, SHOP_ITEM_COUNT, SHOP_BASE_REFRESH, COLORS, WORLD, SHOP_RARITY_WEIGHTS, SHOP_UPGRADE_COSTS, CUE_TYPES, RARITY_COLORS, PLAYER_DEFAULTS } from './constants.js';

export function createShopState() {
  return {
    items: [],
    refreshCount: 0,
    open: false,
    upgradeUsed: false,
    cueOffer: null,
    highlightSection: null,
    highlightTime: 0,
    warningTime: 0,
  };
}

export function generateShopItems(shopLevel = 0, ownedItems = []) {
  const weights = SHOP_RARITY_WEIGHTS[Math.min(shopLevel, SHOP_RARITY_WEIGHTS.length - 1)];
  const picked = [];
  const used = new Set();
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine'];
  const ownedIds = new Set(ownedItems.map(it => it.id));

  while (picked.length < SHOP_ITEM_COUNT) {
    let roll = Math.random() * 100;
    let rarity = 'common';
    let cumulative = 0;
    for (const r of rarities) {
      cumulative += weights[r] || 0;
      if (roll < cumulative) { rarity = r; break; }
    }

    const allowedRarities = rarities.filter(r => (weights[r] || 0) > 0);
    const available = ITEMS.map((it, i) => ({ it, i }))
      .filter(({ it, i }) => it.rarity === rarity && !used.has(i) && !ownedIds.has(it.id));

    if (available.length === 0) {
      const fallback = ITEMS.map((it, i) => ({ it, i }))
        .filter(({ it, i }) => allowedRarities.includes(it.rarity) && !used.has(i) && !ownedIds.has(it.id));
      if (fallback.length === 0) break;
      const { it, i } = fallback[Math.floor(Math.random() * fallback.length)];
      picked.push({ ...it });
      used.add(i);
    } else {
      const { it, i } = available[Math.floor(Math.random() * available.length)];
      picked.push({ ...it });
      used.add(i);
    }
  }
  return picked;
}

export function getRefreshCost(shop) {
  return SHOP_BASE_REFRESH * Math.pow(2, shop.refreshCount);
}

export function refreshShop(shop, player) {
  const cost = getRefreshCost(shop);
  if (player.gold < cost) return false;
  player.gold -= cost;
  shop.refreshCount++;
  shop.items = generateShopItems(player.shopLevel, player.items);
  return true;
}

export function buyItem(shop, player, index) {
  const item = shop.items[index];
  if (!item) return false;
  if (player.items.length >= PLAYER_DEFAULTS.maxItems) return false;
  player.items.push(item);
  shop.items[index] = null;
  return true;
}

export function discardItem(player, index) {
  if (index < 0 || index >= player.items.length) return false;
  player.items.splice(index, 1);
  return true;
}

export function generateCueOffer(player) {
  const allCues = Object.keys(CUE_TYPES).filter(id => id !== 'standard');
  const unowned = allCues.filter(id => !player.cues.includes(id));
  if (unowned.length === 0) return null;
  return unowned[Math.floor(Math.random() * unowned.length)];
}

export function getUpgradeCost(player) {
  return SHOP_UPGRADE_COSTS[Math.min(player.shopLevel, SHOP_UPGRADE_COSTS.length - 1)];
}

export function upgradeShop(shop, player) {
  if (player.shopLevel >= SHOP_UPGRADE_COSTS.length) return false;
  if (shop.upgradeUsed) return false;
  const cost = getUpgradeCost(player);
  if (player.gold < cost) return false;
  player.gold -= cost;
  player.shopLevel++;
  shop.upgradeUsed = true;
  return true;
}

export function buyCue(player, cueId) {
  const cue = CUE_TYPES[cueId];
  if (!cue) return false;
  if (player.cues.includes(cueId)) return false;
  if (player.gold < cue.cost) return false;
  player.gold -= cue.cost;
  player.cues.push(cueId);
  player.activeCue = cueId;
  return true;
}

export function switchCue(player, cueId) {
  if (!player.cues.includes(cueId)) return false;
  player.activeCue = cueId;
  return true;
}

const CARD_W = 180, CARD_H = 140, CARD_GAP = 24, CARD_Y = 120;
const BTN_W = 200, BTN_H = 24;
const CUE_CARD_W = 220, CUE_CARD_H = 76;

function shopLayout(shop, player) {
  const totalItemsW = shop.items.length * CARD_W + (shop.items.length - 1) * CARD_GAP;
  const startX = (WORLD.w - totalItemsW) / 2;
  let y = CARD_Y + CARD_H + 18;

  const showUpgrade = player.shopLevel < SHOP_UPGRADE_COSTS.length && !shop.upgradeUsed;
  const upgradeY = showUpgrade ? y : -1;
  if (showUpgrade) y += 26;

  const refreshY = y; y += 26;
  const continueY = y; y += 28;

  const hasCueOffer = shop.cueOffer && !player.cues.includes(shop.cueOffer);
  const cueCardY = hasCueOffer ? y : -1;

  return { startX, cueCardY, upgradeY, refreshY, continueY };
}

function inRect(mx, my, x, y, w, h) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

export function getShopHitZone(mx, my, shop, player) {
  const { startX, cueCardY, upgradeY, refreshY, continueY } = shopLayout(shop, player);
  const rbx = WORLD.w / 2 - BTN_W / 2;

  for (let i = 0; i < shop.items.length; i++) {
    const cx = startX + i * (CARD_W + CARD_GAP);
    if (inRect(mx, my, cx, CARD_Y, CARD_W, CARD_H)) return { type: 'buy', index: i };
  }

  if (cueCardY > 0 && inRect(mx, my, WORLD.w / 2 - CUE_CARD_W / 2, cueCardY, CUE_CARD_W, CUE_CARD_H)) {
    return { type: 'buy_cue', cueId: shop.cueOffer };
  }

  if (upgradeY > 0 && inRect(mx, my, rbx, upgradeY, BTN_W, BTN_H)) return { type: 'upgrade' };
  if (inRect(mx, my, rbx, refreshY, BTN_W, BTN_H)) return { type: 'refresh' };
  if (inRect(mx, my, rbx, continueY, BTN_W, BTN_H)) return { type: 'continue' };

  return null;
}

export function drawShop(ctx, shop, player, mousePos) {
  ctx.fillStyle = 'rgba(6, 7, 13, 0.92)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  const mx = mousePos ? mousePos.x : -1;
  const my = mousePos ? mousePos.y : -1;
  const { startX, cueCardY, upgradeY, refreshY, continueY } = shopLayout(shop, player);
  const rbx = WORLD.w / 2 - BTN_W / 2;

  ctx.save();
  ctx.textAlign = 'center';

  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur = 20;
  ctx.font = "900 32px 'Orbitron', sans-serif";
  ctx.fillStyle = COLORS.accent;
  ctx.fillText('SHOP', WORLD.w / 2, 60);
  ctx.shadowBlur = 0;

  ctx.font = "12px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.gold;
  const maxTier = SHOP_UPGRADE_COSTS.length;
  const stars = '★'.repeat(player.shopLevel + 1) + '☆'.repeat(maxTier - player.shopLevel);
  ctx.fillText(`Gold: ${player.gold}g   ${stars}`, WORLD.w / 2, 85);

  const weights = SHOP_RARITY_WEIGHTS[Math.min(player.shopLevel, SHOP_RARITY_WEIGHTS.length - 1)];
  ctx.font = "10px 'Share Tech Mono', monospace";
  ctx.fillStyle = COLORS.textDim;
  const parts = [];
  for (const [k, v] of Object.entries(weights)) {
    if (v > 0) parts.push(`${v}% ${k}`);
  }
  ctx.fillText(parts.join('  '), WORLD.w / 2, 100);

  // Item cards
  const invFull = player.items.length >= PLAYER_DEFAULTS.maxItems;
  for (let i = 0; i < shop.items.length; i++) {
    const item = shop.items[i];
    const cx = startX + i * (CARD_W + CARD_GAP);
    const hovered = inRect(mx, my, cx, CARD_Y, CARD_W, CARD_H);
    const canPick = item && !invFull;

    ctx.fillStyle = hovered && canPick ? 'rgba(13, 34, 71, 0.95)' : 'rgba(13, 34, 71, 0.8)';
    ctx.strokeStyle = item ? (invFull ? COLORS.textDim : rarityColor(item.rarity)) : 'rgba(0,229,255,0.1)';
    ctx.lineWidth = hovered && canPick ? 2.5 : 1.5;
    roundRect(ctx, cx, CARD_Y, CARD_W, CARD_H, 6);
    ctx.fill(); ctx.stroke();

    if (!item) {
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText('SOLD', cx + CARD_W / 2, CARD_Y + CARD_H / 2 + 4);
      continue;
    }

    ctx.globalAlpha = invFull ? 0.4 : 1;

    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.fillStyle = rarityColor(item.rarity);
    ctx.fillText(item.rarity.toUpperCase(), cx + CARD_W / 2, CARD_Y + 22);

    ctx.font = "bold 13px 'Orbitron', sans-serif";
    ctx.fillStyle = COLORS.textLight;
    ctx.fillText(item.name, cx + CARD_W / 2, CARD_Y + 48);

    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillStyle = COLORS.textMid;
    wrapText(ctx, item.desc, cx + CARD_W / 2, CARD_Y + 72, CARD_W - 20, 14);

    ctx.globalAlpha = 1;

    const buyBtnY = CARD_Y + CARD_H - 20;
    if (invFull) {
      ctx.fillStyle = 'rgba(255,51,85,0.06)';
      roundRect(ctx, cx + 30, buyBtnY, CARD_W - 60, 18, 3);
      ctx.fill();
      ctx.font = "bold 10px 'Orbitron', sans-serif";
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText('FULL', cx + CARD_W / 2, buyBtnY + 13);
    } else {
      ctx.fillStyle = hovered ? 'rgba(0,229,255,0.15)' : 'rgba(0,229,255,0.06)';
      roundRect(ctx, cx + 30, buyBtnY, CARD_W - 60, 18, 3);
      ctx.fill();
      ctx.font = "bold 10px 'Orbitron', sans-serif";
      ctx.fillStyle = hovered ? COLORS.accent : COLORS.textMid;
      ctx.fillText('CHOOSE', cx + CARD_W / 2, buyBtnY + 13);
    }
  }

  // Upgrade button
  if (upgradeY > 0) {
    const upHover = inRect(mx, my, rbx, upgradeY, BTN_W, BTN_H);
    ctx.fillStyle = upHover ? 'rgba(255,215,0,0.12)' : 'rgba(255,215,0,0.04)';
    roundRect(ctx, rbx, upgradeY, BTN_W, BTN_H, 4);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1;
    roundRect(ctx, rbx, upgradeY, BTN_W, BTN_H, 4);
    ctx.stroke();
    const upgCost = getUpgradeCost(player);
    ctx.strokeStyle = player.gold >= upgCost ? COLORS.gold : COLORS.textDim;
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillStyle = upHover ? COLORS.gold : COLORS.textMid;
    ctx.fillText(`UPGRADE T${player.shopLevel + 1}→T${player.shopLevel + 2}  (${upgCost}g)`, WORLD.w / 2, upgradeY + 16);
  }

  // Refresh button
  const refreshCost = getRefreshCost(shop);
  const refreshHover = inRect(mx, my, rbx, refreshY, BTN_W, BTN_H);
  ctx.fillStyle = refreshHover ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.04)';
  roundRect(ctx, rbx, refreshY, BTN_W, BTN_H, 4);
  ctx.fill();
  ctx.strokeStyle = player.gold >= refreshCost ? COLORS.accent : COLORS.textDim;
  ctx.lineWidth = 1;
  roundRect(ctx, rbx, refreshY, BTN_W, BTN_H, 4);
  ctx.stroke();
  ctx.font = "11px 'Share Tech Mono', monospace";
  ctx.fillStyle = player.gold >= refreshCost ? COLORS.accent : COLORS.textDim;
  ctx.fillText(`REFRESH (${refreshCost}g)`, WORLD.w / 2, refreshY + 16);

  // Continue button
  const contHover = inRect(mx, my, rbx, continueY, BTN_W, BTN_H);
  ctx.fillStyle = contHover ? 'rgba(0,229,255,0.12)' : 'rgba(0,229,255,0.04)';
  roundRect(ctx, rbx, continueY, BTN_W, BTN_H, 4);
  ctx.fill();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1;
  roundRect(ctx, rbx, continueY, BTN_W, BTN_H, 4);
  ctx.stroke();
  ctx.fillStyle = contHover ? COLORS.accent : COLORS.textMid;
  ctx.fillText('SKIP', WORLD.w / 2, continueY + 16);

  // Cue card (own row)
  if (cueCardY > 0) {
    const offeredCue = CUE_TYPES[shop.cueOffer];
    const ccx = WORLD.w / 2 - CUE_CARD_W / 2;
    const cueHover = inRect(mx, my, ccx, cueCardY, CUE_CARD_W, CUE_CARD_H);
    ctx.fillStyle = cueHover ? 'rgba(13, 34, 71, 0.95)' : 'rgba(13, 34, 71, 0.8)';
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = cueHover ? 2.5 : 1.5;
    roundRect(ctx, ccx, cueCardY, CUE_CARD_W, CUE_CARD_H, 6);
    ctx.fill(); ctx.stroke();

    ctx.font = "bold 11px 'Orbitron', sans-serif";
    ctx.fillStyle = COLORS.textLight;
    ctx.fillText(offeredCue.name + ' Cue', WORLD.w / 2, cueCardY + 22);

    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.fillStyle = COLORS.textMid;
    wrapText(ctx, offeredCue.desc, WORLD.w / 2, cueCardY + 38, CUE_CARD_W - 20, 12);

    ctx.font = "bold 12px 'Orbitron', sans-serif";
    ctx.fillStyle = player.gold >= offeredCue.cost ? COLORS.gold : '#ff3355';
    ctx.fillText(`${offeredCue.cost}g`, WORLD.w / 2, cueCardY + CUE_CARD_H - 6);
  }


  // Inventory full warning popup
  if (shop.warningTime && Date.now() - shop.warningTime < 2000) {
    const warnT = (Date.now() - shop.warningTime) / 2000;
    const warnAlpha = warnT < 0.1 ? warnT / 0.1 : warnT > 0.8 ? (1 - warnT) / 0.2 : 1;
    const popW = 280, popH = 40;
    const popX = WORLD.w / 2 - popW / 2;
    const popY = CARD_Y - 50;
    ctx.globalAlpha = warnAlpha * 0.95;
    ctx.fillStyle = 'rgba(255, 51, 85, 0.15)';
    ctx.strokeStyle = COLORS.enemyBasic;
    ctx.lineWidth = 1.5;
    roundRect(ctx, popX, popY, popW, popH, 6);
    ctx.fill(); ctx.stroke();
    ctx.font = "bold 11px 'Orbitron', sans-serif";
    ctx.fillStyle = COLORS.enemyBasic;
    ctx.fillText('INVENTORY FULL', WORLD.w / 2, popY + 16);
    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.fillStyle = COLORS.textMid;
    ctx.fillText('Discard from Modifiers panel or skip', WORLD.w / 2, popY + 32);
    ctx.globalAlpha = 1;
  }


  ctx.restore();
}

function rarityColor(rarity) {
  return RARITY_COLORS[rarity] || COLORS.accent;
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      ctx.fillText(line.trim(), x, cy);
      line = word + ' ';
      cy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
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
