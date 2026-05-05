export const COLORS = {
  bg: '#06070d',
  felt: '#0d2247',
  feltLight: '#0f2a55',
  accent: '#00e5ff',
  player: '#3ec6ff',
  enemyBasic: '#ff3355',
  stunned: '#ffd700',
  projectile: '#ff6688',
  gold: '#ffd700',
  golden: '#ffaa00',
  textDim: '#6b7a8a',
  textMid: '#8899aa',
  textLight: '#c0d0e0',
  pocketVoid: '#020408',
  pocketBorder: '#1a2a44',
  cueWood: '#8B7355',
  cueGrip: '#6B5335',
  cueTip: '#d4a56a',
  white: '#ffffff',
  rarityCommon: '#c0d0e0',
  rarityUncommon: '#22cc88',
  rarityRare: '#4488ff',
  rarityEpic: '#c77dff',
  rarityLegendary: '#ffd700',
  rarityDivine: '#ff44aa',
};

export const WORLD = { w: 800, h: 500 };

export const TABLE = {
  left: 60, top: 45, right: 740, bottom: 455,
  get w() { return this.right - this.left; },
  get h() { return this.bottom - this.top; },
};

export const POCKETS = [
  { x: TABLE.left, y: TABLE.top, r: 26 },
  { x: (TABLE.left + TABLE.right) / 2, y: TABLE.top - 3, r: 22 },
  { x: TABLE.right, y: TABLE.top, r: 26 },
  { x: TABLE.left, y: TABLE.bottom, r: 26 },
  { x: (TABLE.left + TABLE.right) / 2, y: TABLE.bottom + 3, r: 22 },
  { x: TABLE.right, y: TABLE.bottom, r: 26 },
];

export const PHYS = {
  friction: 0.985,
  minSpeed: 0.3,
  maxForce: 18,
  minForce: 2,
  forceScale: 0.06,
  restitution: 0.85,
  wallRestitution: 0.88,
};

export const SUCTION = {
  baseRadius: 0,
  pullForce: 0.2,
  playerPullStrength: 0.3,
  settlingFrames: 45,
  settlingFriction: 0.94,
};

export const PLAYER_DEFAULTS = {
  radius: 14,
  lives: 3,
  gold: 10,
  maxItems: 4,
};

export const ENEMY_TYPES = {
  basic: {
    type: 'basic', label: 'BASIC', color: '#ff3355',
    radius: 13, mass: 1, projectileSpeed: 2.5, damage: 0.5,
    points: 1, cooldown: 1, firePattern: 'single',
  },
  heavy: {
    type: 'heavy', label: 'HEAVY', color: '#ff8800',
    radius: 16, mass: 2.5, projectileSpeed: 2.0, damage: 0.5,
    points: 2, cooldown: 2, firePattern: 'radial8',
  },
  speed: {
    type: 'speed', label: 'SPEED', color: '#aa44ff',
    radius: 11, mass: 0.6, projectileSpeed: 3.5, damage: 0.5,
    points: 2, cooldown: 1, firePattern: 'cone3',
  },
};

export const ITEMS = [
  // ── Common ──
  { id: 'slick_surface', name: 'Slick Surface', desc: 'Your ball has less friction', rarity: 'common' },
  { id: 'power_shot', name: 'Power Shot', desc: 'Higher max launch force', rarity: 'common' },
  { id: 'light_frame', name: 'Light Frame', desc: 'Higher ball speed cap', rarity: 'common' },
  { id: 'pocket_assist_1', name: 'Pocket Assist I', desc: '+15px suction radius on all pockets', rarity: 'common' },
  { id: 'pocket_assist_2', name: 'Pocket Assist II', desc: '+25px suction radius on all pockets', rarity: 'common' },
  { id: 'soft_edge', name: 'Soft Edge', desc: 'Reduced wall bounce inside suction radius', rarity: 'common' },
  { id: 'force_tap', name: 'Force Tap', desc: 'At turn end, enemies within 200px get pulled toward you', rarity: 'common' },
  { id: 'light_pulse', name: 'Light Pulse', desc: 'Move 25px toward cursor without ending turn', rarity: 'common', ability: true, charges: 2 },
  { id: 'lighter_fall', name: 'Lighter Fall', desc: 'Self-pocket costs ½ life instead of 1', rarity: 'common' },

  // ── Uncommon ──
  { id: 'firm_core', name: 'Firm Core', desc: 'Less speed lost when hitting enemies', rarity: 'uncommon' },
  { id: 'clean_rails', name: 'Clean Rails', desc: 'Less friction after wall bounce', rarity: 'uncommon' },
  { id: 'momentum_buffer', name: 'Momentum Buffer', desc: 'Reduced friction overall', rarity: 'uncommon' },
  { id: 'pull_field', name: 'Pull Field', desc: '+35px suction radius on all pockets', rarity: 'uncommon' },
  { id: 'pocket_assist', name: 'Pocket Assist', desc: '+20px suction radius on all pockets', rarity: 'uncommon' },
  { id: 'stable_sink', name: 'Stable Sink', desc: 'Stronger suction pull force', rarity: 'uncommon' },
  { id: 'strong_push', name: 'Strong Push', desc: 'Ability push/pull forces increased', rarity: 'uncommon' },
  { id: 'combo_guard', name: 'Combo Guard', desc: 'Self-pocket does not reset combo', rarity: 'uncommon' },

  // ── Rare ──
  { id: 'bounce_surge', name: 'Bounce Surge', desc: 'First 2 wall bounces per turn add speed', rarity: 'rare' },
  { id: 'speed_drip', name: 'Speed Drip', desc: 'Zero friction until first enemy hit', rarity: 'rare' },
  { id: 'hit_flow', name: 'Hit Flow', desc: 'Each enemy hit adds a small speed boost', rarity: 'rare' },
  { id: 'late_claim', name: 'Late Claim', desc: '+1g per enemy inside suction radius at turn end (once per enemy)', rarity: 'rare' },
  { id: 'marked_pockets', name: 'Marked Pockets', desc: 'Golden pockets have +20px suction radius', rarity: 'rare' },
  { id: 'clean_drop', name: 'Clean Drop', desc: 'Reduced wall bounce inside suction radius', rarity: 'rare' },
  { id: 'gold_chain', name: 'Gold Chain', desc: 'Combo gold per pocket becomes +2g (default +1g)', rarity: 'rare' },
  { id: 'chain_lift', name: 'Chain Lift', desc: 'Suction pockets give +2 combo instead of +1', rarity: 'rare' },
  { id: 'pocket_bonus', name: 'Pocket Bonus', desc: 'Wave clear bonus = your highest combo that wave as gold', rarity: 'rare' },
  { id: 'line_drive', name: 'Line Drive', desc: 'Push enemies in a narrow line toward cursor', rarity: 'rare', ability: true, charges: 2 },
  { id: 'ability_combo', name: 'Ability Combo', desc: 'Ability-pushed enemies count as +2 combo when pocketed', rarity: 'rare' },
  { id: 'extra_charge', name: 'Extra Charge', desc: '+1 charge for all abilities each wave', rarity: 'rare' },
  { id: 'early_end', name: 'Early End', desc: 'Enemies lose 70% momentum at turn end', rarity: 'rare' },
  { id: 'safe_frame', name: 'Safe Frame', desc: 'Brief invulnerability after launching', rarity: 'rare' },
  { id: 'pocket_boost', name: 'Pocket Boost', desc: 'Self-pocket gives +3g (up to 3× per wave)', rarity: 'rare' },

  // ── Epic ──
  { id: 'impact_loop', name: 'Impact Loop', desc: 'First 3 enemy hits per turn add speed', rarity: 'epic' },
  { id: 'ricochet_engine', name: 'Ricochet Engine', desc: 'Keep more speed after hitting enemies', rarity: 'epic' },
  { id: 'deep_pull', name: 'Deep Pull', desc: '+50px suction radius on all pockets', rarity: 'epic' },
  { id: 'soft_landing', name: 'Soft Landing', desc: 'Enemies stop instead of bouncing inside suction radius', rarity: 'epic' },
  { id: 'combo_shield', name: 'Combo Shield', desc: 'Gain invincibility at combo 5 and 10 (2× per wave)', rarity: 'epic' },
  { id: 'force_pulse', name: 'Force Pulse', desc: 'Push all enemies away from you (linear falloff)', rarity: 'epic', ability: true, charges: 2 },
  { id: 'echo_cast', name: 'Echo Cast', desc: 'First ability used each wave triggers twice', rarity: 'epic' },
  { id: 'stasis_burst', name: 'Stasis Burst', desc: 'Destroy all enemy projectiles on the field', rarity: 'epic', ability: true, charges: 2 },
  { id: 'pocket_warp', name: 'Pocket Warp', desc: 'Set respawn point at cursor (used on next self-pocket)', rarity: 'epic', ability: true, charges: 2 },
  { id: 'combo_sacrifice', name: 'Combo Sacrifice', desc: 'Self-pocket pays your current combo as gold (before reset)', rarity: 'epic' },
  { id: 'quicksand', name: 'Quicksand', desc: 'Stronger suction pull force', rarity: 'epic' },

  // ── Legendary ──
  { id: 'overdrive_core', name: 'Overdrive Core', desc: 'First 3 wall bounces massively add speed', rarity: 'legendary' },
  { id: 'chain_reactor', name: 'Chain Reactor', desc: 'Hitting an enemy pushes nearby enemies away', rarity: 'legendary' },
  { id: 'golden_rebound', name: 'Golden Rebound', desc: '3rd, 5th, 7th... enemy hit per turn gives +1g', rarity: 'legendary' },
  { id: 'wide_mouths', name: 'Wide Mouths', desc: 'Enemies pocketed during suction phase give +1g', rarity: 'legendary' },
  { id: 'golden_cycle', name: 'Golden Cycle', desc: '2 golden pockets per turn instead of 1', rarity: 'legendary' },
  { id: 'rerun_protocol', name: 'Rerun Protocol', desc: 'Stun all enemies at combo 5 and 10 (2× per wave)', rarity: 'legendary' },
  { id: 'key_mystery', name: 'Key???', desc: '???', rarity: 'legendary' },
  { id: 'shockwave_core', name: 'Shockwave Core', desc: 'Pull all enemies toward target point (linear falloff)', rarity: 'legendary', ability: true, charges: 2 },
  { id: 'greedy_forces', name: 'Greedy Forces', desc: 'Enemies pocketed after ability push give +5g', rarity: 'legendary' },
  { id: 'hard_stop', name: 'Hard Stop', desc: 'Instantly stop your ball mid-flight (ends turn)', rarity: 'legendary', ability: true, charges: 2, duringMovement: true },
  { id: 'blink_shard', name: 'Blink Shard', desc: 'Teleport to cursor position', rarity: 'legendary', ability: true, charges: 2 },
  { id: 'rebirth_loop', name: 'Rebirth Loop', desc: 'Self-pocket costs no lives', rarity: 'legendary' },
  { id: 'void_detonation', name: 'Void Detonation', desc: 'Self-pocket pushes all enemies outward (counts as ability push)', rarity: 'legendary' },

  // ── Divine ──
  { id: 'infinite_runback', name: 'Infinite Runback', desc: 'Zero friction. Enemy hits cost more speed but give a burst forward', rarity: 'divine' },
  { id: 'event_horizon', name: 'Event Horizon', desc: 'Enemies entering suction radius are instantly pocketed', rarity: 'divine' },
  { id: 'overchain', name: 'Overchain', desc: 'Once per wave, preserve combo when you miss a pocket', rarity: 'divine' },
  { id: 'absolute_control', name: 'Absolute Control', desc: 'Push all enemies in the direction you choose', rarity: 'divine', ability: true, charges: 2 },
  { id: 'time_fracture', name: 'Time Fracture', desc: 'Stop your ball mid-flight and take another shot', rarity: 'divine', ability: true, charges: 2, duringMovement: true },
  { id: 'singularity_core', name: 'Singularity Core', desc: 'Self-pocket applies suction + pushes all enemies outward', rarity: 'divine' },
];

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine'];

export const RARITY_COLORS = {
  common: COLORS.rarityCommon,
  uncommon: COLORS.rarityUncommon,
  rare: COLORS.rarityRare,
  epic: COLORS.rarityEpic,
  legendary: COLORS.rarityLegendary,
  divine: COLORS.rarityDivine,
};

export const SHOP_UPGRADE_COSTS = [25, 50, 100, 200];

export const SHOP_RARITY_WEIGHTS = [
  { common: 50, uncommon: 30, rare: 20, epic: 0, legendary: 0, divine: 0 },
  { common: 30, uncommon: 40, rare: 30, epic: 0, legendary: 0, divine: 0 },
  { common: 20, uncommon: 30, rare: 30, epic: 20, legendary: 0, divine: 0 },
  { common: 10, uncommon: 20, rare: 30, epic: 30, legendary: 10, divine: 0 },
  { common: 0, uncommon: 10, rare: 20, epic: 40, legendary: 20, divine: 10 },
];

export const CUE_TYPES = {
  standard: { id: 'standard', name: 'Standard', desc: 'Default cue', frictionMod: 1, backspin: 0, cost: 0 },
  draw: { id: 'draw', name: 'Draw', desc: 'Ball pulls back after hitting an enemy', frictionMod: 1, backspin: 0.6, cost: 30 },
};

export const WAVE_CLEAR_BONUS = 15;
export const SHOP_ITEM_COUNT = 3;
export const SHOP_BASE_REFRESH = 10;
export const COMBO_BASE_BONUS = 1;
export const COMBO_CAP = 10;
export const COMBO_POWER_BOOST = 0.05;
