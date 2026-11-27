import { TILE } from '../engine/GameEngine';
import { rng } from '../engine/Physics';
import type { EnemyKind } from '../entities/Enemy';
import { CHUNKS, type Chunk } from './ChunkLibrary';
import { TileMap } from './TileMap';

export type World = 0 | 1 | 2;
export type Modifier = 'normal' | 'low-gravity' | 'double-coins' | 'ice';
export type TrialKind = 'crests' | 'combo3' | 'shell3' | 'aerial' | 'shell4' | 'slayer8' | 'combo4';

export interface TrialMeta {
  label: string;
  routeDesc: string;
  target: number;
  elite: boolean;
}

export const WORLD_NAMES = ['青苔菌谷', '幽光水晶工坊', '云端星辉堡垒'] as const;
export const MODIFIERS: Record<Modifier, string> = {
  normal: '',
  'low-gravity': '低压乱流 · 飞兵巡弋',
  'double-coins': '狂暴悬赏 · 镀金强敌',
  ice: '凛冬冰封 · 重装防线',
};

export const TRIAL_META: Readonly<Record<TrialKind, TrialMeta>> = {
  crests: { label: '秘道星徽', routeDesc: '收集 3 枚高空星徽', target: 3, elite: false },
  combo3: { label: '腾空三连踩', routeDesc: '达成空中 3 连踩', target: 3, elite: false },
  shell3: { label: '飞壳破敌', routeDesc: '踢壳击破 3 个目标', target: 3, elite: false },
  aerial: { label: '猎空试炼', routeDesc: '击败 3 名飞兵或法师', target: 3, elite: true },
  shell4: { label: '护壳破阵', routeDesc: '用龟壳撞倒 4 名敌人', target: 4, elite: true },
  slayer8: { label: '清剿试炼', routeDesc: '正面击败 8 名强敌', target: 8, elite: true },
  combo4: { label: '极意连踏', routeDesc: '完成 2 次三连踩', target: 2, elite: true },
};

export const NORMAL_TRIALS: readonly TrialKind[] = ['crests', 'combo3', 'shell3'];
export const ELITE_TRIALS: readonly TrialKind[] = ['aerial', 'shell4', 'slayer8', 'combo4'];

export interface EnemySpawn { kind: EnemyKind; x: number; y: number; direction: number }
export interface CoinSpawn { x: number; y: number }
export interface FireZone { startX: number; endX: number }
export interface Level {
  map: TileMap;
  world: World;
  modifier: Modifier;
  trial: TrialKind;
  coins: CoinSpawn[];
  crests: CoinSpawn[];
  fireZones: FireZone[];
  enemies: EnemySpawn[];
  flag: { x: number; top: number; bottom: number };
  seed: number;
  chunks: Chunk[];
  arena?: true;
}

const START = 16;
const END = 24;

export function generateLevel(seed: number, world: World, depth: number, modifier: Modifier = 'normal', trial?: TrialKind): Level {
  const random = rng((seed ^ Math.imul(world + 1, 0x85ebca6b)) >>> 0);
  const activeTrial: TrialKind = trial ?? (modifier === 'normal'
    ? NORMAL_TRIALS[Math.floor(random() * NORMAL_TRIALS.length)]
    : ELITE_TRIALS[Math.floor(random() * ELITE_TRIALS.length)]);

  const count = 6 + Math.floor(random() * 3);
  const signatures = CHUNKS.filter(c => c.world === world);
  const sigOrder = random() < 0.5 ? signatures : [...signatures].reverse();
  const sigPosA = Math.floor(random() * 2); // 0 or 1
  const sigPosB = 2 + Math.floor(random() * 2); // 2 or 3
  const unused = CHUNKS.filter(c => c.world === undefined);

  const chunks: Chunk[] = [];
  for (let i = 0, exitY = 13; i < count; i++) {
    if (i === sigPosA && sigOrder[0] && Math.abs(sigOrder[0].entryY - exitY) <= 3) {
      chunks.push(sigOrder[0]);
      exitY = sigOrder[0].exitY;
      continue;
    }
    if (i === sigPosB && sigOrder[1] && Math.abs(sigOrder[1].entryY - exitY) <= 3) {
      chunks.push(sigOrder[1]);
      exitY = sigOrder[1].exitY;
      continue;
    }
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
  const crestSpots: CoinSpawn[] = [];
  const fireZones: FireZone[] = [];
  const enemies: EnemySpawn[] = [];
  const spawn = (kind: EnemyKind, x: number, y: number, direction = -1) =>
    enemies.push({ kind, x: x * TILE + 3, y: y * TILE - 1, direction });

  map.ground(0, 13, START);
  [6, 7, 8, 9, 10].forEach(x => map.set(x, 10, x % 2 ? 'question' : 'brick', x === 9 ? 'crystal' : 'coin'));
  [4, 5, 11].forEach(x => coins.push({ x: x * TILE + 7, y: 389 }));
  spawn('walker', 13, 12);

  let crystalsPlaced = 1;
  let start = START;
  const chunkSpans: Array<{ start: number; width: number; chunk: Chunk }> = [];
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const allowCrystal = () => chunkIdx >= 2 && crystalsPlaced < 2 && Boolean(++crystalsPlaced);
    const width = chunk.layout[0].length;
    chunkSpans.push({ start, width, chunk });
    if (chunk.fireRain) {
      fireZones.push({ startX: (start + 2) * TILE, endX: (start + width - 2) * TILE });
    }
    let hasCustomSpring = false;
    chunk.layout.forEach((row, y) => [...row].forEach((cell, col) => {
      const x = col + start;
      switch (cell) {
        case '#': map.set(x, y, 'ground'); break;
        case 'b':
          map.set(x, y, random() < 0.24 ? 'question' : 'brick', random() < 0.1 && allowCrystal() ? 'crystal' : 'coin');
          break;
        case '?': map.set(x, y, 'question', random() < 0.14 && allowCrystal() ? 'crystal' : 'coin'); break;
        case 'R': map.set(x, y, 'question', allowCrystal() ? 'crystal' : 'coin'); break;
        case 'h': if (random() < 0.72) map.set(x, y, 'question', 'hidden'); break;
        case 't': map.set(x, y, 'pipe'); break;
        case 's': map.set(x, y, 'spring'); hasCustomSpring = true; break;
        case 'u': map.set(x, y, 'cloud'); break;
        case 'c': coins.push({ x: x * TILE + 8, y: y * TILE + 7 }); break;
        case 'a': crestSpots.push({ x: x * TILE + 4, y: y * TILE + 4 }); break;
        case 'k': spawn('koopa', x, y, random() < 0.5 ? -1 : 1); break;
        case 'w': spawn('wing', x, y, -1); break;
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
      if (!hasCustomSpring) {
        for (const offset of [2, 3, 1, 4]) {
          const gx = start + offset;
          if (!map.get(gx, 12) && map.get(gx, 13)?.kind === 'ground' && !enemies.some(e => Math.abs(e.x - gx * TILE) < TILE)) {
            map.set(gx, 12, 'spring');
            break;
          }
        }
      }
      if (chunk.world !== 1) map.platform(start + 3, 9, random() < 0.5 ? 'x' : 'y', 30, random() * 6);
      if (random() < 0.35 + depth * 0.12) {
        const kind = random() < 0.5 ? 'wing' : 'miner';
        const sx = start + 4;
        if (kind === 'wing' && !map.get(sx, 10)) spawn('wing', sx, 10, 1);
        else if (kind === 'miner' && map.get(sx, 13)?.kind === 'ground' && !map.get(sx, 12) && !enemies.some(e => Math.abs(e.x - sx * TILE) < TILE)) {
          spawn('miner', sx, 12, 1);
        }
      }
    }
    if (world === 2) {
      if (chunk.world !== 2) {
        for (let i = 0; i < 3; i++) if (!map.get(start + 4 + i, 8)) map.set(start + 4 + i, 8, 'cloud');
      }
      if (random() < 0.35 + depth * 0.12) {
        const kind = random() < 0.5 ? 'mage' : 'guard';
        const groundCol = kind === 'guard'
          ? [13, 11, 15, 9, 16].find(c => c < width && map.get(start + c, 13)?.kind === 'ground' && !map.get(start + c, 12) && !enemies.some(e => Math.abs(e.x - (start + c) * TILE) < TILE))
          : undefined;
        if (groundCol !== undefined) spawn('guard', start + groundCol, 12);
        else {
          const mx = start + Math.min(13, width - 3);
          if (!map.get(mx, 9)) spawn('mage', mx, 9);
        }
      }
    }
    start += width;
  }

  const endStart = start;
  const canGround = (col: number, row = 12) =>
    col >= START + 1 && col < endStart - 2 &&
    !map.get(col, row) &&
    map.get(col, row + 1)?.kind === 'ground' &&
    !enemies.some(e => Math.abs(e.x - (col * TILE + 3)) < TILE * 0.92);

  const canAir = (col: number, row = 9) =>
    col >= START + 2 && col < endStart - 2 &&
    !map.get(col, row) &&
    !enemies.some(e => Math.abs(e.x - (col * TILE + 3)) < TILE * 0.92 && Math.abs(e.y - (row * TILE - 1)) < TILE * 1.2);

  // Elite hazard reinforcements so risk matches reward
  if (modifier === 'low-gravity') {
    for (const span of chunkSpans.filter((_, idx) => idx % 2 === 0)) {
      const col = span.start + Math.floor(span.width * 0.55);
      if (canAir(col, 8)) spawn(world === 2 ? 'mage' : 'wing', col, 8, -1);
    }
  } else if (modifier === 'ice') {
    for (const span of chunkSpans.filter((_, idx) => idx % 2 === 1)) {
      for (const off of [12, 10, 14, 8]) {
        if (off < span.width && canGround(span.start + off, 12)) {
          spawn(world === 0 ? 'miner' : 'guard', span.start + off, 12, -1);
          break;
        }
      }
    }
  }

  // Ensure trial targets are always achievable in this generated level
  if (activeTrial === 'aerial') {
    let airCount = enemies.filter(e => e.kind === 'wing' || e.kind === 'mage').length;
    for (const span of chunkSpans) {
      if (airCount >= 5) break;
      for (const off of [9, 14, 6]) {
        const col = span.start + off;
        if (off < span.width && canAir(col, 9)) {
          spawn(world === 2 && airCount % 2 === 1 ? 'mage' : 'wing', col, 9, -1);
          airCount++;
          break;
        }
      }
    }
  } else if (activeTrial === 'shell3' || activeTrial === 'shell4') {
    let koopas = enemies.filter(e => e.kind === 'koopa').length;
    for (const span of chunkSpans) {
      if (koopas >= 4) break;
      for (const off of [3, 5, 7, 11]) {
        if (off < span.width && canGround(span.start + off, 12)) {
          spawn('koopa', span.start + off, 12, 1);
          koopas++;
          break;
        }
      }
    }
    let targets = enemies.filter(e => e.kind !== 'plant').length;
    for (const span of chunkSpans) {
      if (targets >= 9) break;
      for (const off of [12, 15, 17, 9]) {
        if (off < span.width && canGround(span.start + off, 12)) {
          spawn('walker', span.start + off, 12, -1);
          targets++;
        }
      }
    }
  } else if (activeTrial === 'slayer8' || activeTrial === 'combo3' || activeTrial === 'combo4') {
    const minCount = activeTrial === 'slayer8' ? 12 : 10;
    let countEnemies = enemies.filter(e => e.kind !== 'plant').length;
    for (const span of chunkSpans) {
      if (countEnemies >= minCount) break;
      for (const off of [6, 10, 14, 17]) {
        if (countEnemies >= minCount) break;
        if (off < span.width && canGround(span.start + off, 12)) {
          spawn('walker', span.start + off, 12, -1);
          countEnemies++;
        }
      }
    }
  }

  const crests: CoinSpawn[] = [];
  if (activeTrial === 'crests' && crestSpots.length >= 3) {
    const picked = new Set<number>();
    for (let i = 0; i < 3; i++) {
      const idx = Math.min(crestSpots.length - 1, Math.floor((i + 0.5) * crestSpots.length / 3));
      picked.add(idx);
    }
    crestSpots.forEach((spot, idx) => {
      if (picked.has(idx)) crests.push(spot);
      else coins.push({ x: spot.x + 4, y: spot.y + 3 });
    });
  } else {
    for (const spot of crestSpots) coins.push({ x: spot.x + 4, y: spot.y + 3 });
  }

  map.ground(start, 13, END);
  for (let i = 0; i < 3; i++) map.ground(start + 5 + i * 2, 12 - i, 2);
  const flag = { x: (start + 12.2) * TILE, top: 218, bottom: 13 * TILE };
  for (let i = 0; i < 7; i++) coins.push({ x: (start + 8.1 + i * 0.59) * TILE, y: 300 - Math.sin(i / 6 * Math.PI) * 68 });
  return { map, world, modifier, trial: activeTrial, coins, crests, fireZones, enemies, flag, seed, chunks };
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
  return {
    map, world, modifier: 'normal', trial: 'combo3', coins, crests: [], fireZones: [],
    enemies: [], flag: { x: Infinity, top: 0, bottom: 0 }, seed, chunks: [], arena: true,
  };
}
