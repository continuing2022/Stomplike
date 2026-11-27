import { HEIGHT } from '../engine/GameEngine';
import { move, overlaps, type Body } from '../engine/Physics';
import type { PixelRenderer, Sprite } from '../graphics/PixelRenderer';
import { COINS, pixels, STAR } from '../graphics/SpriteData';
import type { TileMap } from '../level/TileMap';

export type ProjectileType =
  | 'fire' | 'ice' | 'shard' | 'dart' | 'lightning' | 'wave'
  | 'wrench' | 'magic' | 'cannon' | 'rain' | 'rock'
  | 'spread' | 'laser' | 'missile' | 'flame';

const orb = (hot: string, soft: string, dark: string) =>
  pixels('...dd... ..dwwd.. .dwwssd. dwsssdwd dsswsswd .dsssdd. ..dddd.. ...dd...', { d: dark, w: hot, s: soft });

export const FLAME_ORB: Sprite = pixels(
  '..dddd.. .dssssd. dswwwwsd dwwwwwwd dwwwwwwd dswwwwsd .dssssd. ..dddd..',
  { d: '#9c2c2c', s: '#ff7b39', w: '#fff3a8' },
);

const MISSILE_SPRITE: Sprite = pixels(
  'dd...... .dssdddd fdswwwwd fdswwwwd .dssdddd dd......',
  { d: '#48236e', s: '#c77dff', w: '#ffffff', f: '#ffd166' },
);

const sprites: Record<Exclude<ProjectileType, 'laser'>, Sprite> = {
  fire: orb('#fff2a2', '#fa8060', '#c64968'),
  ice: orb('#ddffff', '#84d7f3', '#6a85ca'),
  shard: orb('#ffb386', '#c57771', '#753f63'),
  dart: COINS[0],
  lightning: STAR,
  wave: orb('#fff3d0', '#e4bfff', '#8d6fbd'),
  wrench: pixels('w....w ww..ww .wwww. ..ss.. ..ss.. ..ss.. ..ww.. ..ww..', { w: '#d8daf0', s: '#7b83aa' }),
  magic: orb('#fff2bd', '#cf84ef', '#874ea8'),
  cannon: orb('#f4d7bd', '#a47d8d', '#422743'),
  rain: orb('#fff4b4', '#f9816a', '#d34a75'),
  rock: orb('#f7baad', '#b681a9', '#694d76'),
  spread: orb('#fff8c9', '#ff6b6b', '#8f243e'),
  missile: MISSILE_SPRITE,
  flame: FLAME_ORB,
};

export class Projectile implements Body {
  w: number;
  h: number;
  age = 0;
  life: number;
  bounces: number;
  pierce = false;
  splash = 0;
  element?: 'fire' | 'ice' | 'both';
  target?: Body;
  hit = new Set<Body>();
  line?: { x: number; y: number };
  onWall?: (body: Projectile) => void;
  private readonly baseY: number;

  constructor(
    readonly type: ProjectileType, public x: number, public y: number, public vx: number, public vy: number,
    public damage = 1, readonly hostile = false, bounces = 0,
  ) {
    const sizes: Record<ProjectileType, [number, number]> = {
      fire: [14, 14], ice: [15, 15], shard: [10, 10], dart: [13, 13], lightning: [7, 7], wave: [21, 21],
      wrench: [17, 17], magic: [16, 16], cannon: [21, 21], rain: [16, 16], rock: [25, 25],
      spread: [15, 15], laser: [40, 9], missile: [17, 12], flame: [22, 22],
    };
    [this.w, this.h] = sizes[type];
    this.bounces = bounces;
    this.pierce = type === 'laser' || type === 'wave';
    this.baseY = y;
    this.life = type === 'lightning' ? 0.24 : type === 'wave' ? 0.52 : type === 'laser' ? 0.9 : 3.2;
  }

  tick(dt: number, map: TileMap) {
    this.age += dt;
    this.life -= dt;
    if (this.type === 'lightning') return;
    if (this.target && this.type === 'dart') {
      const dx = this.target.x + this.target.w / 2 - this.x - this.w / 2;
      const dy = this.target.y + this.target.h / 2 - this.y - this.h / 2;
      const scale = 410 / Math.max(1, Math.hypot(dx, dy));
      this.vx = dx * scale;
      this.vy = dy * scale;
    } else if (this.target && this.type === 'missile') {
      const dx = this.target.x + this.target.w / 2 - this.x - this.w / 2;
      const dy = this.target.y + this.target.h / 2 - this.y - this.h / 2;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const speed = 445;
      const steer = Math.min(1, dt * 8.8);
      this.vx += (dx / dist * speed - this.vx) * steer;
      this.vy += (dy / dist * speed - this.vy) * steer;
      const norm = speed / Math.max(1, Math.hypot(this.vx, this.vy));
      this.vx *= norm;
      this.vy *= norm;
    }

    if (this.type === 'flame') {
      const prevX = this.x;
      this.x += this.vx * dt;
      const wallProbe = { x: this.x, y: this.baseY, w: this.w, h: Math.min(this.h, 16) };
      if (map.colliders(wallProbe).some(tile => !tile.oneWay && overlaps(wallProbe, tile))) {
        if (this.bounces > 0) { this.bounces--; this.x = prevX; this.vx = -this.vx; this.damage *= 1.15; this.onWall?.(this); }
        else { this.life = 0; return; }
      }
      this.y = this.baseY - Math.sin(this.age * 14) * 16;
      for (const tile of map.colliders(this)) {
        if (tile.oneWay || !overlaps(this, tile)) continue;
        if (tile.y >= this.baseY) this.y = Math.min(this.y, tile.y - this.h - 1);
        else this.y = Math.max(this.y, tile.y + tile.h + 1);
      }
    } else if (this.type === 'spread' || this.type === 'missile') {
      const prevX = this.x;
      const prevY = this.y;
      this.x += this.vx * dt;
      if (map.colliders(this).some(tile => !tile.oneWay && overlaps(this, tile))) {
        if (this.bounces > 0) { this.bounces--; this.x = prevX; this.vx = -this.vx; this.damage *= 1.15; this.onWall?.(this); }
        else this.life = 0;
      }
      this.y += this.vy * dt;
      if (map.colliders(this).some(tile => !tile.oneWay && overlaps(this, tile))) {
        if (this.bounces > 0) { this.bounces--; this.y = prevY; this.vy = -this.vy; this.damage *= 1.15; this.onWall?.(this); }
        else this.life = 0;
      }
    } else if (this.type === 'laser') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (map.colliders(this).some(tile => !tile.oneWay && overlaps(this, tile))) this.life = 0;
    } else if (this.type === 'dart' || this.type === 'wave' || this.type === 'magic' || this.type === 'rock') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      const horizontal = this.vx;
      this.vy += (this.type === 'wrench' ? 620 : 930) * dt;
      const collision = move(this, map, dt);
      if (collision.floor) {
        if (this.type === 'fire' || this.type === 'ice' || this.type === 'rain') this.vy = -235;
        else this.life = 0;
      }
      if (collision.wall) {
        if (this.bounces > 0) { this.bounces--; this.vx = -horizontal; this.damage *= 1.2; this.onWall?.(this); }
        else this.life = 0;
      }
    }
    if (this.y > HEIGHT + 48 || this.y < -200 || this.x < -64 || this.x > map.width + 64) this.life = 0;
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer) {
    if (this.type === 'lightning' && this.line) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.life * 7);
      ctx.strokeStyle = '#e5fbff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.line.x, this.line.y);
      for (let i = 1; i < 7; i++) {
        const t = i / 6;
        ctx.lineTo(this.line.x + (this.x - this.line.x) * t, this.line.y + (this.y - this.line.y) * t + (i === 6 ? 0 : i % 2 ? 9 : -9));
      }
      ctx.stroke();
      ctx.restore();
    }
    if (this.type === 'laser') {
      ctx.save();
      ctx.shadowColor = '#56cfe1';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#56cfe1';
      ctx.fillRect(Math.round(this.x), Math.round(this.y), Math.round(this.w), Math.round(this.h));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(this.x + 2), Math.round(this.y + this.h * 0.25), Math.round(this.w - 4), Math.max(2, Math.round(this.h * 0.5)));
      ctx.restore();
      return;
    }
    if (this.type === 'wrench' || this.type === 'flame') {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(this.age * (this.type === 'flame' ? 18 : 15));
      renderer.draw(ctx, sprites[this.type], -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
      return;
    }
    if (this.type === 'missile') {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      renderer.draw(ctx, sprites.missile, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
      return;
    }
    renderer.draw(ctx, sprites[this.type], this.x, this.y, this.w, this.h);
  }
}
