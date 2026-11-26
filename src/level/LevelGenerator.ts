import { TILE } from '../engine/GameEngine';
import { rng } from '../engine/Physics';
import type { EnemyKind } from '../entities/Enemy';
import { CHUNKS, type Chunk } from './ChunkLibrary';
import { TileMap } from './TileMap';

export type World = 0 | 1 | 2;
export type Modifier = 'normal' | 'low-gravity' | 'double-coins' | 'ice';
export const WORLD_NAMES = ['青苔菌谷', '幽光水晶工坊', '云端星辉堡垒'] as const;
export const MODIFIERS: Record<Modifier, string> = {
  normal: '', 'low-gravity': '低重力', 'double-coins': '双倍金币 · 敌人加速', ice: '冰面微滑',
};
export interface EnemySpawn { kind: EnemyKind; x: number; y: number; direction: number }
export interface CoinSpawn { x: number; y: number }
export interface Level {
  map: TileMap; world: World; modifier: Modifier; coins: CoinSpawn[]; enemies: EnemySpawn[];
  flag: { x: number; top: number; bottom: number }; seed: number; chunks: Chunk[]; arena?: true;
}

const START = 16;
const END = 24;
export function generateLevel(seed: number, world: World, depth: number, modifier: Modifier = 'normal'): Level {
  const random = rng(seed);
  const chunks: Chunk[] = [];
  const count = 6 + Math.floor(random() * 3);
  const unused = [...CHUNKS];
  for (let i = 0, exitY = 13; i < count; i++) {
    const needsGap = i === count - 2 && !chunks.some(chunk => chunk.layout[13].includes('.'));
    const eligible = unused.filter(chunk => Math.abs(chunk.entryY - exitY) <= 3 && (!needsGap || chunk.layout[13].includes('.')));
    const choice = eligible[Math.floor(random() * eligible.length)];
    if (!choice) throw new Error('找不到可衔接区块');
    unused.splice(unused.indexOf(choice), 1);
    chunks.push(choice);
    exitY = choice.exitY;
  }
  const columns = START + END + chunks.reduce((sum, c) => sum + c.layout[0].length, 0);
  const map = new TileMap(columns);
  const coins: CoinSpawn[] = [];
  const enemies: EnemySpawn[] = [];
  const spawn = (kind: EnemyKind, x: number, y: number, direction = -1) =>
    enemies.push({ kind, x: x * TILE + 3, y: y * TILE - 1, direction });
  map.ground(0, 13, START);
  [6, 7, 8, 9, 10].forEach(x => map.set(x, 10, x % 2 ? 'question' : 'brick', x === 9 ? 'crystal' : 'coin'));
  [4, 5, 11].forEach(x => coins.push({ x: x * TILE + 7, y: 389 }));
  spawn('walker', 13, 12);
  let start = START;
  for (const chunk of chunks) {
    chunk.layout.forEach((row, y) => [...row].forEach((cell, col) => {
      const x = col + start;
      switch (cell) {
        case '#': map.set(x, y, 'ground'); break;
        case 'b':
          map.set(x, y, random() < 0.24 ? 'question' : 'brick', random() < 0.12 ? 'crystal' : 'coin');
          break;
        case '?': map.set(x, y, 'question', random() < 0.16 ? 'crystal' : 'coin'); break;
        case 'R': map.set(x, y, 'question', 'crystal'); break;
        case 'h': if (random() < 0.72) map.set(x, y, 'question', 'hidden'); break;
        case 't': map.set(x, y, 'pipe'); break;
        case 'c': coins.push({ x: x * TILE + 8, y: y * TILE + 7 }); break;
        case 'k': spawn('koopa', x, y, random() < 0.5 ? -1 : 1); break;
        case 'p': if (chunk.layout[y + 1]?.[col] === 't') spawn('plant', x + 0.5, y); break;
        case 'm': spawn(random() < 0.08 * depth ? 'koopa' : 'walker', x, y, random() < 0.5 ? -1 : 1); break;
        case 'f':
          spawn(world === 0 ? 'walker' : world === 1 ? random() < 0.48 ? 'wing' : 'miner' : random() < 0.5 ? 'mage' : 'guard', x, y);
          break;
      }
    }));
    const bottom = chunk.layout[14];
    for (let i = 0; i < bottom.length; i++) if (bottom[i] === '#') map.ground(start + i, 15, 1);
    if (world === 1) {
      for (const offset of [2, 3, 1, 4]) {
        const gx = start + offset;
        if (!map.get(gx, 12) && map.get(gx, 13)?.kind === 'ground' && !enemies.some(e => Math.abs(e.x - gx * TILE) < TILE)) {
          map.set(gx, 12, 'spring');
          break;
        }
      }
      map.platform(start + 3, 9, random() < 0.5 ? 'x' : 'y', 30, random() * 6);
      if (random() < 0.35 + depth * 0.12) {
        const kind = random() < 0.5 ? 'wing' : 'miner';
        const sx = start + 4;
        if (kind === 'wing') spawn('wing', sx, 10, 1);
        else if (map.get(sx, 13)?.kind === 'ground' && !map.get(sx, 12)) spawn('miner', sx, 12, 1);
      }
    }
    if (world === 2) {
      for (let i = 0; i < 3; i++) if (!map.get(start + 4 + i, 8)) map.set(start + 4 + i, 8, 'cloud');
      if (random() < 0.35 + depth * 0.12) {
        const kind = random() < 0.5 ? 'mage' : 'guard';
        const width = chunk.layout[0].length;
        const groundCol = kind === 'guard'
          ? [13, 11, 15, 9, 16].find(c => c < width && map.get(start + c, 13)?.kind === 'ground' && !map.get(start + c, 12))
          : undefined;
        if (groundCol !== undefined) spawn('guard', start + groundCol, 12);
        else spawn('mage', start + Math.min(13, width - 3), 9);
      }
    }
    start += chunk.layout[0].length;
  }
  map.ground(start, 13, END);
  for (let i = 0; i < 3; i++) map.ground(start + 5 + i * 2, 12 - i, 2);
  const flag = { x: (start + 12.2) * TILE, top: 218, bottom: 13 * TILE };
  for (let i = 0; i < 7; i++) coins.push({ x: (start + 8.1 + i * 0.59) * TILE, y: 300 - Math.sin(i / 6 * Math.PI) * 68 });
  return { map, world, modifier, coins, enemies, flag, seed, chunks };
}

export function generateArena(seed: number, world: World): Level {
  const map = new TileMap(30);
  map.ground(0, 13, 30);
  const coins: CoinSpawn[] = [];
  if (world === 0) {
    for (const x of [6, 7, 13, 14, 21, 22]) map.set(x, 10, x % 3 === 0 ? 'question' : 'brick');
    for (const x of [9, 18, 25]) map.set(x, 7, 'switch');
  } else if (world === 1) {
    for (const x of [6, 14, 22]) map.set(x, 10, 'switch');
    for (const x of [4, 25]) map.set(x, 7, 'brick');
    for (const x of [3, 26]) map.set(x, 12, 'spring');
    map.platform(11, 8, 'x', 75);
  } else {
    [7, 8, 14, 15, 21, 22].forEach(x => map.set(x, 10, 'cloud'));
    for (const x of [4, 25]) map.set(x, 8, 'brick');
    map.platform(11, 8, 'y', 24);
    map.platform(19, 7, 'x', 50);
  }
  return { map, world, modifier: 'normal', coins, enemies: [], flag: { x: Infinity, top: 0, bottom: 0 }, seed, chunks: [], arena: true };
}
