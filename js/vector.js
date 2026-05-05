export const vec = (x = 0, y = 0) => ({ x, y });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v, s) => ({ x: v.x * s, y: v.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const len = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
export const len2 = (v) => v.x * v.x + v.y * v.y;
export const dist = (a, b) => len(sub(a, b));
export const dist2 = (a, b) => len2(sub(a, b));

export const normalize = (v) => {
  const l = len(v);
  return l > 0 ? scale(v, 1 / l) : vec(0, 0);
};

export const reflect = (v, normal) => {
  const d = 2 * dot(v, normal);
  return { x: v.x - d * normal.x, y: v.y - d * normal.y };
};

export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const angle = (v) => Math.atan2(v.y, v.x);

export const fromAngle = (a, magnitude = 1) => ({
  x: Math.cos(a) * magnitude,
  y: Math.sin(a) * magnitude,
});

export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
