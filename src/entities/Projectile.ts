import { HEIGHT } from '../engine/GameEngine';
import { move, type Body } from '../engine/Physics';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { COINS, pixels, STAR } from '../graphics/SpriteData';
import type { TileMap } from '../level/TileMap';

export type ProjectileType = 'fire' | 'ice' | 'shard' | 'dart' | 'lightning' | 'wave' | 'wrench' | 'magic' | 'cannon' | 'rain' | 'rock';
const orb = (hot: string, soft: string, dark: string) => pixels('...dd... ..dwwd.. .dwwssd. dwsssdwd dsswsswd .dsssdd. ..dddd.. ...dd...', { d: dark, w: hot, s: soft });
const sprites = {
  fire: orb('#fff2a2', '#fa8060', '#c64968'), ice: orb('#ddffff', '#84d7f3', '#6a85ca'),
  shard: orb('#ffb386', '#c57771', '#753f63'), dart: COINS[0], lightning: STAR,
  wave: orb('#fff3d0', '#e4bfff', '#8d6fbd'), wrench: pixels('w....w ww..ww .wwww. ..ss.. ..ss.. ..ss.. ..ww.. ..ww..', { w: '#d8daf0', s: '#7b83aa' }),
  magic: orb('#fff2bd', '#cf84ef', '#874ea8'), cannon: orb('#f4d7bd', '#a47d8d', '#422743'),
  rain: orb('#fff4b4', '#f9816a', '#d34a75'), rock: orb('#f7baad', '#b681a9', '#694d76'),
};

export class Projectile implements Body {
  w: number;
  h: number;
  age = 0;
  life: number;
  bounces: number;
  target?: Body;
  hit = new Set<Body>();
  line?: { x: number; y: number };
  onWall?: (body: Projectile) => void;

  constructor(
    readonly type: ProjectileType, public x: number, public y: number, public vx: number, public vy: number,
    public damage = 1, readonly hostile = false, bounces = 0,
  ) {
    const sizes: Record<ProjectileType, number> = { fire: 14, ice: 15, shard: 10, dart: 13, lightning: 7, wave: 21, wrench: 17, magic: 16, cannon: 21, rain: 16, rock: 25 };
    this.w = this.h = sizes[type];
    this.bounces = bounces;
    this.life = type === 'lightning' ? 0.24 : type === 'wave' ? 0.52 : 3.2;
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
    }
    if (this.type === 'dart' || this.type === 'wave' || this.type === 'magic' || this.type === 'rock') {
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
    if (this.y > HEIGHT + 48 || this.y < -200 || this.x < -42 || this.x > map.width + 42) this.life = 0;
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
    if (this.type === 'wrench') {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.rotate(this.age * 15);
      renderer.draw(ctx, sprites[this.type], -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();
    } else renderer.draw(ctx, sprites[this.type], this.x, this.y, this.w, this.h);
  }
}
