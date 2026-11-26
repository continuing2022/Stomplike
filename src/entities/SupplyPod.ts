import { TILE, WIDTH } from '../engine/GameEngine';
import { clamp, type Body } from '../engine/Physics';
import type { PixelRenderer, Sprite } from '../graphics/PixelRenderer';
import { pixels } from '../graphics/SpriteData';
import type { TileMap } from '../level/TileMap';
import type { Tag } from '../roguelike/Relics';

export type ArsenalKind = 'S' | 'L' | 'M' | 'F';
export type EmblemKind = ArsenalKind | 'B' | 'R';

export const ARSENAL_DURATION = 11;
export const RAPID_DURATION = 10;
export const EMBLEM_ORDER: readonly EmblemKind[] = ['S', 'L', 'M', 'F', 'B', 'R'];

export const EMBLEM_META: Readonly<Record<EmblemKind, {
  name: string;
  callout: string;
  color: string;
  core: string;
  dark: string;
}>> = {
  S: { name: '散射星弹', callout: 'SPREAD!', color: '#ff6b6b', core: '#ffd6a5', dark: '#7a2841' },
  L: { name: '贯穿星束', callout: 'LASER!', color: '#56cfe1', core: '#e0fbfc', dark: '#1d4e78' },
  M: { name: '追踪飞弹', callout: 'MISSILE!', color: '#c77dff', core: '#f5d9ff', dark: '#51287a' },
  F: { name: '旋风烈焰', callout: 'FLAME!', color: '#ff924c', core: '#fff3b0', dark: '#7f371d' },
  B: { name: '星辉力场', callout: 'BARRIER!', color: '#72efdd', core: '#e8fffb', dark: '#1e6064' },
  R: { name: '极速超载', callout: 'RAPID UP!', color: '#ffe66d', core: '#fffbe0', dark: '#7c5318' },
};

const POD_FRAMES = [
  pixels(
    '....dddddddddddd.... ..ddhhhhhhhhhhhhdd.. .dhssssbbbbbbsssshd. dhsbbbbddddddbbbbshd ffsbbbdbwwwwbdbbbssd ffsbbbdwwwwwwdbbbssd dhsbbbbddddddbbbbshd .dhssssbbbbbbsssshd. ..ddssssssssssssdd.. ....dddddddddddd....',
    { d: '#24223e', h: '#eef4ff', s: '#8a99bd', b: '#4f5d87', w: '#2a3154', f: '#ff9e64' },
  ),
  pixels(
    '....dddddddddddd.... ..ddhhhhhhhhhhhhdd.. .dhssssbbbbbbsssshd. dhsbbbbddddddbbbbshd .fsbbbdbwwwwbdbbbssd .fsbbbdwwwwwwdbbbssd dhsbbbbddddddbbbbshd .dhssssbbbbbbsssshd. ..ddssssssssssssdd.. ....dddddddddddd....',
    { d: '#24223e', h: '#eef4ff', s: '#8a99bd', b: '#4f5d87', w: '#2a3154', f: '#ffe082' },
  ),
];

const CYCLING_POD_FRAMES = [
  pixels(
    '....dddddddddddd.... ..ddhhhhhhhhhhhhdd.. .dhssssbbbbbbsssshd. dhsbbbbddddddbbbbshd ffsbbbdbwwwwbdbbbssd ffsbbbdwwwwwwdbbbssd dhsbbbbddddddbbbbshd .dhssssbbbbbbsssshd. ..ddssssssssssssdd.. ....dddddddddddd....',
    { d: '#352246', h: '#fff3b0', s: '#f3a66a', b: '#9b5de5', w: '#2a2244', f: '#72efdd' },
  ),
  pixels(
    '....dddddddddddd.... ..ddhhhhhhhhhhhhdd.. .dhssssbbbbbbsssshd. dhsbbbbddddddbbbbshd .fsbbbdbwwwwbdbbbssd .fsbbbdwwwwwwdbbbssd dhsbbbbddddddbbbbshd .dhssssbbbbbbsssshd. ..ddssssssssssssdd.. ....dddddddddddd....',
    { d: '#352246', h: '#fff3b0', s: '#72efdd', b: '#f15bb5', w: '#2a2244', f: '#ffe66d' },
  ),
];

const GLYPHS: Readonly<Record<EmblemKind, readonly string[]>> = {
  S: ['.wwww', 'w....', '.www.', '....w', 'wwww.'],
  L: ['w....', 'w....', 'w....', 'w....', 'wwwww'],
  M: ['w...w', 'ww.ww', 'w.w.w', 'w...w', 'w...w'],
  F: ['wwwww', 'w....', 'wwww.', 'w....', 'w....'],
  B: ['wwww.', 'w...w', 'wwww.', 'w...w', 'wwww.'],
  R: ['wwww.', 'w...w', 'wwww.', 'w..w.', 'w...w'],
};

function makeBadgeSprite(kind: EmblemKind): Sprite {
  const meta = EMBLEM_META[kind];
  const glyph = GLYPHS[kind];
  const rows = [
    '.ddddddddd.',
    'dhhhhhhhhhd',
    'dhccccccchd',
    'dhc.....chd',
    'dhc.....chd',
    'dhc.....chd',
    'dhc.....chd',
    'dhc.....chd',
    'dhccccccchd',
    'dcccccccccd',
    '.ddddddddd.',
  ].map(r => r.split(''));
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (glyph[y][x] === 'w') rows[y + 3][x + 3] = 'w';
    }
  }
  return {
    matrix: rows.map(r => r.join('')),
    palette: { d: meta.dark, h: meta.core, c: meta.color, w: '#ffffff' },
  };
}

const WING_UP = pixels(
  'ww........ww www......www .wwww..wwww. ..wwwwwwww.. ...wwwwww...',
  { w: '#fff6dc' },
);
const WING_DOWN = pixels(
  '............ .ww......ww. wwwwwwwwwwww .wwwwwwwwww. ..www..www..',
  { w: '#e7f5ff' },
);

export const BADGE_SPRITES: Readonly<Record<EmblemKind, Sprite>> = {
  S: makeBadgeSprite('S'),
  L: makeBadgeSprite('L'),
  M: makeBadgeSprite('M'),
  F: makeBadgeSprite('F'),
  B: makeBadgeSprite('B'),
  R: makeBadgeSprite('R'),
};

export const POD_PRELOAD_SPRITES: readonly Sprite[] = [
  ...POD_FRAMES,
  ...CYCLING_POD_FRAMES,
  WING_UP,
  WING_DOWN,
  ...Object.values(BADGE_SPRITES),
];

export class SupplyPod implements Body {
  w = 36;
  h = 24;
  vx: number;
  vy = 0;
  age = 0;
  life = 15;
  alive = true;
  private cycleTimer = 0;
  private turns = 0;
  private readonly baseY: number;
  private readonly phase: number;

  constructor(
    public x: number,
    public y: number,
    direction: number,
    public kind: EmblemKind,
    readonly cycling = false,
    phase = 0,
  ) {
    this.baseY = y;
    this.vx = direction * 74;
    this.phase = phase;
  }

  get center() { return this.x + this.w / 2; }

  tick(dt: number, cameraX: number, arena = false) {
    if (!this.alive) return;
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    if (this.cycling) {
      this.cycleTimer += dt;
      if (this.cycleTimer >= 1.05) {
        this.cycleTimer -= 1.05;
        const idx = EMBLEM_ORDER.indexOf(this.kind);
        this.kind = EMBLEM_ORDER[(idx + 1) % EMBLEM_ORDER.length];
      }
    }
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y = this.baseY + Math.sin(this.age * 3.3 + this.phase) * 26;
    this.vy = (this.y - prevY) / Math.max(dt, 0.001);

    const leftBound = arena ? 36 : cameraX + 44;
    const rightBound = arena ? WIDTH - 36 - this.w : cameraX + WIDTH - 44 - this.w;
    if (this.turns < 2) {
      if (this.vx < 0 && this.x < leftBound) {
        this.x = leftBound;
        this.vx = Math.abs(this.vx);
        this.turns++;
      } else if (this.vx > 0 && this.x > rightBound) {
        this.x = rightBound;
        this.vx = -Math.abs(this.vx);
        this.turns++;
      }
    } else if (this.x < cameraX - 96 || this.x > cameraX + WIDTH + 120) {
      this.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number) {
    if (!this.alive) return;
    const meta = EMBLEM_META[this.kind];
    const frame = Math.floor(time * 12) % 2;
    const podSprite = this.cycling ? CYCLING_POD_FRAMES[frame] : POD_FRAMES[frame];
    ctx.save();
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = this.cycling ? 14 : 9;
    renderer.draw(ctx, podSprite, this.x, this.y, this.w, this.h, this.vx < 0);
    ctx.shadowBlur = 0;
    renderer.draw(ctx, BADGE_SPRITES[this.kind], this.center - 8, this.y + 4, 16, 16);
    ctx.restore();
  }
}

export class WingedEmblem implements Body {
  w = 26;
  h = 24;
  vx: number;
  vy = -165;
  age = 0;
  life = 11;
  private hoverY: number;
  private hovering = false;

  constructor(
    public x: number,
    public y: number,
    readonly kind: EmblemKind,
    map: TileMap,
    drift = 0,
  ) {
    this.vx = drift;
    this.hoverY = WingedEmblem.safeHoverY(x, y, map);
  }

  get center() { return this.x + this.w / 2; }
  get ready() { return this.age >= 0.32; }

  private static safeHoverY(x: number, spawnY: number, map: TileMap) {
    const col = clamp(Math.floor((x + 13) / TILE), 0, map.columns - 1);
    for (let row = Math.max(4, Math.floor(spawnY / TILE)); row <= 13; row++) {
      const tile = map.get(col, row);
      if (tile && tile.kind !== 'cloud') {
        return clamp(row * TILE - 58, 130, 13 * TILE - 54);
      }
    }
    return clamp(spawnY, 175, 13 * TILE - 72);
  }

  tick(dt: number, map: TileMap, targetX: number, targetY: number, magnetRadius: number) {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) return;

    const dx = targetX - this.center;
    const dy = targetY - (this.y + this.h / 2);
    const dist = Math.hypot(dx, dy);
    if (this.ready && dist < magnetRadius) {
      const pull = Math.min(1, dt * 11);
      this.x += dx * pull;
      this.y += dy * pull;
      this.hoverY = this.y;
      return;
    }

    if (!this.hovering) {
      this.vy += 460 * dt;
      this.x = clamp(this.x + this.vx * dt, 16, map.width - this.w - 16);
      this.y += this.vy * dt;
      this.vx *= Math.max(0, 1 - dt * 3.5);
      if (this.vy >= 0 && this.y >= this.hoverY - 12) {
        this.hovering = true;
        this.hoverY = this.y;
      }
    } else {
      this.x = clamp(this.x + Math.sin(this.age * 1.4) * 14 * dt, 16, map.width - this.w - 16);
      const targetHover = WingedEmblem.safeHoverY(this.x, this.hoverY, map);
      this.hoverY += (targetHover - this.hoverY) * Math.min(1, dt * 2.2);
      this.y = this.hoverY + Math.sin(this.age * 4.6) * 7;
    }
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number) {
    if (this.life <= 0) return;
    if (this.life < 2.5 && Math.floor(time * 14) % 2 === 0) return;
    const meta = EMBLEM_META[this.kind];
    const wing = Math.floor(time * 8 + this.age * 2) % 2 === 0 ? WING_UP : WING_DOWN;
    ctx.save();
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 11;
    renderer.draw(ctx, wing, this.center - 19, this.y - 4, 38, 15);
    renderer.draw(ctx, BADGE_SPRITES[this.kind], this.x + 2, this.y + 2, 22, 22);
    ctx.restore();
  }
}

export function pickEmblem(random: () => number, current?: ArsenalKind, favoredTag?: Tag): EmblemKind {
  const roll = random();
  if (roll < 0.14) return 'B';
  if (roll < 0.28) return 'R';
  const weapons: ArsenalKind[] = ['S', 'L', 'M', 'F'];
  if (current && random() < 0.22) return current;
  if (favoredTag && random() < 0.45) {
    const synergyWeapon: Record<Tag, ArsenalKind> = { stomp: 'F', block: 'L', projectile: 'S', greed: 'M' };
    return synergyWeapon[favoredTag];
  }
  return weapons[Math.floor(random() * weapons.length)];
}
