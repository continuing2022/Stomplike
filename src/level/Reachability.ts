import { STEP, TILE } from '../engine/GameEngine';
import { move, overlaps, type Body, type CollisionWorld } from '../engine/Physics';
import type { Level } from './LevelGenerator';

const W = 22;
const H = 30;
const CENTER = W * 0.5;
const SAMPLE = 8;

export interface Footing { x: number; y: number }

export function findRoute(level: Level): Footing[] {
  const { map, flag, modifier } = level;
  // Check the route with the tile geometry and without the moving platforms.
  const terrain: CollisionWorld = { colliders: box => map.candidates(box).filter(tile => tile.loot !== 'hidden') };
  const points: Footing[] = [];
  const indexByPosition = new Map<string, number>();
  const index = (x: number, y: number) => indexByPosition.get(x + ':' + y);
  for (let col = 0; col < map.columns; col++) {
    for (let row = 1; row <= 13; row++) {
      const floor = map.get(col, row);
      if (!floor || floor.loot === 'hidden') continue;
      const y = row * TILE;
      for (let offset = 4; offset < TILE; offset += SAMPLE) {
        const x = col * TILE + offset;
        const body = { x: x - CENTER, y: y - H, w: W, h: H };
        if (terrain.colliders(body).some(tile => overlaps(tile, body))) continue;
        indexByPosition.set(x + ':' + y, points.length);
        points.push({ x, y });
      }
    }
  }
  const start = index(92, 13 * TILE);
  if (start === undefined) return [];
  const parents = new Map<number, number>([[start, -1]]);
  const queue = [start];
  const gravity = modifier === 'low-gravity' ? 0.72 : 1;
  let goal: number | undefined;
  for (let i = 0; i < queue.length; i++) {
    const pointIndex = queue[i];
    const point = points[pointIndex];
    const add = (x: number, y: number) => {
      const rounded = Math.round((x - 4) / SAMPLE) * SAMPLE + 4;
      const next = index(rounded, y);
      if (next === undefined || parents.has(next)) return;
      parents.set(next, pointIndex);
      queue.push(next);
    };
    const finish = (x: number, y: number) => Math.abs(x - flag.x) <= 16 && y >= flag.top - 18 && y - H <= flag.bottom;
    if (finish(point.x, point.y)) { goal = pointIndex; break; }
    add(point.x + SAMPLE, point.y);
    add(point.x - SAMPLE, point.y);
    const floor = map.get(Math.floor(point.x / TILE), point.y / TILE);
    for (const vx of [220, 330, -220, -330, 0]) {
      for (const cut of [6, 70]) {
        const body: Body = { x: point.x - CENTER, y: point.y - H, w: W, h: H, vx, vy: floor?.kind === 'spring' ? -795 : -560 };
        for (let frame = 0; frame < 100; frame++) {
          if (frame === cut && body.vy < 0) body.vy *= 0.45;
          body.vy += (body.vy < 0 ? 1450 : 2150) * (Math.abs(body.vy) < 65 ? 0.55 : 1) * STEP * gravity;
          const contact = move(body, terrain, STEP);
          if (finish(body.x + CENTER, body.y + H)) goal = pointIndex;
          if (contact.floor) { add(body.x + CENTER, contact.floor.y); break; }
          if (body.x < 0 || body.x >= map.width || body.y > 565) break;
        }
        if (goal !== undefined) break;
      }
      if (goal !== undefined) break;
    }
    if (goal !== undefined) break;
  }
  if (goal === undefined) return [];
  const path: Footing[] = [];
  for (let from = goal; from >= 0; from = parents.get(from) ?? -1) path.push(points[from]);
  return path.reverse();
}
