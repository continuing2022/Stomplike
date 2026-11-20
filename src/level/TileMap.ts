import { HEIGHT, TILE, WIDTH } from '../engine/GameEngine';
import { overlaps, type Box, type Collider } from '../engine/Physics';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { BRICK, CLOUD_TILE, GROUND, PIPE, QUESTION, SOIL, SPRING, USED } from '../graphics/SpriteData';

export type TileKind = 'ground' | 'brick' | 'question' | 'used' | 'pipe' | 'spring' | 'cloud' | 'switch' | 'bomb';
export type Loot = 'coin' | 'crystal' | 'hidden';

export class Tile implements Collider {
  w = TILE;
  h = TILE;
  bump = 0;
  life = Infinity;
  collapse = Infinity;
  constructor(public x: number, public y: number, public kind: TileKind, public loot: Loot = 'coin') {}
}

export interface Platform extends Collider {
  baseX: number; baseY: number; axis: 'x' | 'y'; range: number; phase: number; dx: number; dy: number;
}

export class TileMap {
  private readonly tiles = new Map<number, Tile>();
  readonly platforms: Platform[] = [];

  constructor(readonly columns: number) {}
  get width() { return this.columns * TILE; }
  private key(x: number, y: number) { return y * this.columns + x; }

  set(x: number, y: number, kind: TileKind, loot?: Loot) {
    if (x < 0 || x >= this.columns) return undefined;
    const tile = new Tile(x * TILE, y * TILE, kind, loot);
    this.tiles.set(this.key(x, y), tile);
    return tile;
  }

  get(x: number, y: number) {
    return x >= 0 && x < this.columns ? this.tiles.get(this.key(x, y)) : undefined;
  }

  remove(tile: Tile) {
    const key = this.key(tile.x / TILE, tile.y / TILE);
    if (this.tiles.get(key) === tile) this.tiles.delete(key);
  }

  candidates(box: Box) {
    const tiles: Tile[] = [];
    const minX = Math.max(0, Math.floor(box.x / TILE));
    const maxX = Math.min(this.columns - 1, Math.floor((box.x + box.w) / TILE));
    for (let y = Math.floor(box.y / TILE); y <= Math.floor((box.y + box.h) / TILE); y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = this.get(x, y);
        if (tile) tiles.push(tile);
      }
    }
    return tiles;
  }

  colliders(box: Box): Collider[] {
    return [...this.candidates(box).filter(tile => !(tile.kind === 'question' && tile.loot === 'hidden')), ...this.platforms.filter(platform => overlaps(box, platform))];
  }

  ground(x: number, y: number, width: number) {
    for (let col = x; col < x + width; col++)
      for (let row = y; row <= Math.ceil(HEIGHT / TILE); row++) this.set(col, row, 'ground');
  }

  platform(x: number, y: number, axis: Platform['axis'], range: number, phase = 0) {
    const baseX = x * TILE;
    const baseY = y * TILE;
    this.platforms.push({ x: baseX, y: baseY, w: TILE * 2, h: 13, baseX, baseY, axis, range, phase, oneWay: true, dx: 0, dy: 0 });
  }

  safe(x: number, feet: number, width: number) {
    return [x - 5, x + width + 5].every(point => {
      const tile = this.get(Math.floor(point / TILE), Math.floor((feet + 1) / TILE));
      return tile?.kind === 'ground' && Math.abs(tile.y - feet) < 1;
    });
  }

  tick(dt: number, time: number) {
    for (const tile of this.tiles.values()) {
      tile.bump = Math.max(0, tile.bump - dt);
      tile.life -= dt;
      tile.collapse -= dt;
      if (tile.life <= 0 || tile.collapse <= 0) this.remove(tile);
    }
    for (const p of this.platforms) {
      const offset = Math.sin(time * 1.55 + p.phase) * p.range;
      const x = p.baseX + (p.axis === 'x' ? offset : 0);
      const y = p.baseY + (p.axis === 'y' ? offset : 0);
      p.dx = x - p.x;
      p.dy = y - p.y;
      p.x = x;
      p.y = y;
    }
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, camera: number, time: number, world: number) {
    const visible = { x: camera - TILE, y: -TILE, w: WIDTH + TILE * 2, h: HEIGHT + TILE * 2 };
    for (const tile of this.candidates(visible)) {
      if (tile.kind === 'question' && tile.loot === 'hidden') continue;
      const frame = Math.floor(time * 7) % 4;
      const sprite = {
        ground: this.get(tile.x / TILE, tile.y / TILE - 1)?.kind === 'ground' ? SOIL[world] : GROUND[world], brick: BRICK[world], used: USED, pipe: PIPE, spring: SPRING, cloud: CLOUD_TILE,
        question: QUESTION[frame], switch: QUESTION[frame], bomb: BRICK[0],
      }[tile.kind];
      const bump = tile.bump ? Math.sin(tile.bump / 0.2 * Math.PI) * 9 : 0;
      const shake = tile.collapse < Infinity ? Math.sin(time * 75) * 2 : 0;
      if (tile.collapse < 0.25) ctx.globalAlpha = 0.5;
      renderer.draw(ctx, sprite, tile.x + shake, tile.y - bump, TILE, TILE);
      if (tile.kind === 'switch' || tile.kind === 'bomb') {
        ctx.fillStyle = tile.kind === 'switch' ? '#57e8ee' : '#ffad89';
        ctx.fillRect(tile.x + 12, tile.y + 8 - bump, 8, 16);
        ctx.fillRect(tile.x + 8, tile.y + 12 - bump, 16, 8);
      }
      ctx.globalAlpha = 1;
    }
    for (const p of this.platforms) {
      if (!overlaps(visible, p)) continue;
      renderer.draw(ctx, USED, p.x, p.y, 32, p.h);
      renderer.draw(ctx, USED, p.x + 32, p.y, 32, p.h);
    }
  }
}
