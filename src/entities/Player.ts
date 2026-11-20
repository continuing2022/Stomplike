import { HEIGHT } from '../engine/GameEngine';
import { approach, clamp, move, type Body, type Collider } from '../engine/Physics';
import type { InputManager } from '../engine/InputManager';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { HEROES } from '../graphics/SpriteData';
import { Tile, type Platform, type TileMap } from '../level/TileMap';

export interface PlayerEvents {
  jump: () => void;
  land: (pound: boolean) => void;
  skid: () => void;
  block: (tile: Tile) => void;
  fall: () => void;
  skill: () => void;
}

export class Player implements Body {
  w = 22;
  h = 30;
  vx = 0;
  vy = 0;
  face = 1;
  grounded = false;
  falling = false;
  previousFeet = 0;
  crouch = false;
  skidding = false;
  hearts = 3;
  maxHearts = 3;
  shield = 0;
  powered = false;
  invulnerable = 0;
  hurtTime = 0;
  recover = 0;
  combo = 0;
  star = 0;
  speedBoost = 0;
  coinBoost = 0;
  mayPound = false;
  pounding = false;
  doubleJump = false;
  extraJump = false;
  speedScale = 1;
  jumpScale = 1;
  private coyote = 0;
  private floor?: Collider;
  private safeX: number;
  private safeY: number;

  constructor(public x: number, public y: number, readonly skin = 0) {
    this.safeX = x;
    this.safeY = y + this.h;
  }

  get center() { return this.x + this.w / 2; }
  get feet() { return this.y + this.h; }

  setPower(active: boolean, map: TileMap) {
    if (active && this.h < 38) {
      const tall = { x: this.x, y: this.feet - 38, w: this.w, h: 38 };
      const blocked = map.colliders(tall).some(t => !t.oneWay && t.y < this.y && t.y + t.h > tall.y);
      if (!blocked) { this.y = tall.y; this.h = tall.h; }
    } else if (!active && this.h > 30) {
      this.y = this.feet - 30;
      this.h = 30;
    }
    this.powered = active;
  }

  tick(dt: number, input: InputManager, map: TileMap, events: PlayerEvents, gravity = 1, friction = 1, abyss = HEIGHT + 54) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.star = Math.max(0, this.star - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.speedBoost = Math.max(0, this.speedBoost - dt);
    this.coinBoost = Math.max(0, this.coinBoost - dt);
    if (this.recover > 0) {
      this.recover = Math.max(0, this.recover - dt);
      if (!this.recover) {
        this.x = this.safeX;
        this.y = this.safeY - this.h;
        this.vx = this.vy = 0;
        this.pounding = false;
        this.falling = false;
        this.invulnerable = 1.5;
      }
      return;
    }
    if (this.powered && this.h < 38) this.setPower(true, map);
    if (this.floor?.oneWay) {
      const platform = this.floor as Platform;
      this.x += platform.dx;
      this.y += platform.dy;
    }
    const dir = Number(input.held('right')) - Number(input.held('left'));
    this.crouch = this.grounded && input.held('down');
    if (dir) this.face = dir;
    const reversing = this.grounded && dir !== 0 && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 55;
    if (reversing && !this.skidding) events.skid();
    this.skidding = reversing;
    const speed = (input.held('run') ? 330 : 220) * this.speedScale * (this.speedBoost > 0 ? 1.2 : 1) * (this.coinBoost > 0 ? 1.15 : 1);
    if (this.hurtTime < 0.15) {
      const accel = dir && !this.crouch ? 1600 * (this.grounded ? 1 : 0.75) * (reversing ? 2.2 : 1) : 1400 * (this.grounded ? friction : 0.43);
      this.vx = approach(this.vx, this.crouch ? 0 : dir * speed, accel * dt);
    }
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (input.bufferedJump && !this.crouch && (this.coyote > 0 || (this.doubleJump && this.extraJump))) {
      if (!this.coyote) this.extraJump = false;
      this.vy = -560 * this.jumpScale * (this.speedBoost > 0 ? 1.2 : 1);
      this.coyote = 0;
      this.grounded = false;
      this.pounding = false;
      input.consumeJump();
      events.jump();
    }
    if (input.cutJump && this.vy < 0) this.vy *= 0.45;
    if (this.mayPound && !this.grounded && input.pressed('down')) {
      this.pounding = true;
      this.vy = 760;
    }
    if (input.held('skill')) events.skill();
    this.previousFeet = this.feet;
    const acceleration = (this.vy < 0 ? 1450 : 2150) * (Math.abs(this.vy) < 65 && !this.grounded ? 0.55 : 1);
    this.vy = Math.min(860, this.vy + acceleration * dt * gravity);
    this.falling = this.vy > 0;
    const wasGrounded = this.grounded;
    const result = move(this, map, dt);
    if (!result.ceiling && this.vy < 0) {
      const hidden = map.candidates({ x: this.x, y: this.y, w: this.w, h: 5 })
        .find(tile => tile.kind === 'question' && tile.loot === 'hidden' && this.x + this.w > tile.x && this.x < tile.x + tile.w &&
          this.y < tile.y + tile.h && this.y - this.vy * dt >= tile.y + tile.h);
      if (hidden) { this.y = hidden.y + hidden.h; this.vy = 0; events.block(hidden); }
    }
    this.floor = result.floor;
    this.grounded = Boolean(this.floor);
    if (result.ceiling instanceof Tile) events.block(result.ceiling);
    if (result.floor instanceof Tile && result.floor.kind === 'cloud' && result.floor.collapse === Infinity) result.floor.collapse = 0.6;
    if (result.floor instanceof Tile && result.floor.kind === 'spring') {
      this.vy = -795;
      this.grounded = false;
      events.jump();
    }
    if (this.grounded) {
      if (!wasGrounded || this.pounding) events.land(this.pounding);
      this.pounding = false;
      this.extraJump = true;
      this.combo = 0;
      if (map.safe(this.x, this.feet, this.w)) { this.safeX = this.x; this.safeY = this.feet; }
    }
    this.x = clamp(this.x, 0, map.width - this.w);
    if (this.feet > abyss) {
      this.recover = 0.35;
      this.floor = undefined;
      this.combo = 0;
      events.fall();
    }
  }

  bounce(held: boolean, bonus = 1) {
    this.vy = (held ? -655 : -382) * bonus;
    this.falling = false;
    this.pounding = false;
    this.grounded = false;
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number) {
    if (this.recover > 0 || (this.invulnerable > 0 && this.hurtTime === 0 && Math.floor(time * 15) % 2)) return;
    const pose = this.hurtTime ? 'hurt' : this.crouch ? 'crouch' : this.skidding ? 'skid' :
      this.pounding ? 'fall' : !this.grounded ? this.vy < 0 ? 'jump' : 'fall' :
      Math.abs(this.vx) > 27 ? 'run' + Math.floor(time * (Math.abs(this.vx) / 27 + 4)) % 3 : 'idle';
    const size = this.powered ? 48 : 40;
    if (this.powered || this.star > 0) {
      ctx.shadowColor = this.star > 0 ? '#fff08e' : '#ff9f8a';
      ctx.shadowBlur = this.star > 0 ? 16 : 8;
    }
    renderer.draw(ctx, HEROES[this.skin][pose], this.center - size / 2 + (this.face > 0 ? 3 : -3), this.feet - size + 2, size, size, this.face < 0);
    ctx.shadowBlur = 0;
  }
}
