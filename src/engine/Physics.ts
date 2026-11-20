export interface Box { x: number; y: number; w: number; h: number }
export interface Body extends Box { vx: number; vy: number }
export interface Collider extends Box { oneWay?: boolean }
export interface CollisionWorld { colliders(box: Box): Collider[] }

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const approach = (value: number, target: number, amount: number) =>
  value + clamp(target - value, -amount, amount);
export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const stomped = (body: Body, priorFeet: number, target: Box, falling: boolean) =>
  falling && body.x + body.w > target.x + 2 && body.x < target.x + target.w - 2 &&
  priorFeet <= target.y + target.h * 0.51 && body.y + body.h >= target.y &&
  body.y < target.y + target.h * 0.6;

export function move(body: Body, world: CollisionWorld, dt: number) {
  const oldFeet = body.y + body.h;
  let wall: Collider | undefined;
  let floor: Collider | undefined;
  let ceiling: Collider | undefined;
  body.x += body.vx * dt;
  for (const tile of world.colliders(body)) {
    if (tile.oneWay || !overlaps(body, tile) || body.vx === 0) continue;
    if (!wall || (body.vx > 0 ? tile.x < wall.x : tile.x + tile.w > wall.x + wall.w)) wall = tile;
  }
  if (wall) {
    body.x = body.vx > 0 ? wall.x - body.w : wall.x + wall.w;
    body.vx = 0;
  }
  body.y += body.vy * dt;
  for (const tile of world.colliders(body)) {
    if (!overlaps(body, tile)) continue;
    if (body.vy > 0 && (!tile.oneWay || oldFeet <= tile.y + 1) && (!floor || tile.y < floor.y)) floor = tile;
    if (body.vy < 0 && !tile.oneWay && (!ceiling || tile.y + tile.h > ceiling.y + ceiling.h)) ceiling = tile;
  }
  if (floor) {
    body.y = floor.y - body.h;
    body.vy = 0;
  } else if (ceiling) {
    body.y = ceiling.y + ceiling.h;
    body.vy = 0;
  }
  return { floor, wall, ceiling };
}

export function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
