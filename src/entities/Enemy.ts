import { HEIGHT } from '../engine/GameEngine';
import { move, type Body } from '../engine/Physics';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { pixels } from '../graphics/SpriteData';
import { Tile, type TileMap } from '../level/TileMap';

export type EnemyKind = 'walker' | 'koopa' | 'plant' | 'wing' | 'miner' | 'mage' | 'guard' | 'cannonball';
export type EnemyState = 'active' | 'squashed' | 'shell' | 'rolling' | 'gone';
export interface EnemyShot { x: number; y: number; vx: number; vy: number; type: 'wrench' | 'magic' | 'cannon' }

const cap = [
  '.....dddd....... ...ddggggdd..... ..dggwwggggd.... .dggggwwwgggd... .dggggggggggd... dggggggggggggd.. ddsgdsgdsgdsdd.. ..dffddfffd..... ..dfwdfwfdd..... ..dffffffffd.... .ddgddddgddd.... .ddddd.ddddd....',
  '.....dddd....... ...ddggggdd..... ..dggwwggggd.... .dggggwwwgggd... .dggggggggggd... dggggggggggggd.. ddsgdsgdsgdsdd.. ..dffddfffd..... ..dfwdfwfdd..... ..dffffffffd.... ...ddddggd...... ...ddddddd......',
].map(rows => pixels(rows, { d: '#3e2740', g: '#e17379', w: '#f5aea0', s: '#a44d69', f: '#fbd0a5' }));
const shellPalette = { d: '#293653', g: '#27867c', w: '#aaeb9e', s: '#3eae90', f: '#ffda8d' };
const koopa = pixels('..........ddd... .........dfwdd.. .........dfffd.. ........ddfffdd. ...dddd.dffd.... ..dswwddffd..... .dsggggddfdd.... .dsgsggdffd..... dsggggggdffd.... ddddddddffdd.... ..ddffddffd..... ..ddddd.dddd....', shellPalette);
const shell = pixels('.....dddddd..... ...ddgwwgggdd... ..dswwssgggggd.. .dsgggsggsggggd. dsggggsggggggggd dddddddddddddddd .dffddffddffddf. ..dddddddddddd..', shellPalette);
const iceShell = pixels('.....dddddd..... ...ddgwwgggdd... ..dswwssgggggd.. .dsgggsggsggggd. dsggggsggggggggd dddddddddddddddd .dffddffddffddf. ..dddddddddddd..', { d: '#25416b', g: '#6ec6f5', w: '#ebffff', s: '#9be4ff', f: '#c9f2ff' });
const plant = pixels('...dddd...dddd.. ..dgrggd.drgggd. .dggrgggddggrggd .dgggggggggggggd .ddddddddddddddd ..dwwddddwwddd.. .....dggd....... ...ddgggddd..... ..dggggggggd.... ...ddddddgd..... ......dggd...... ......dggd......', { d: '#243851', r: '#ffdd80', g: '#e4587d', w: '#fff6cf' });
const wing = pixels('....w......w.... ...www....www... ..gwwww..wwwwg.. ...ggwwddwwgg... .....ddggdd..... ....dsggggsd.... ...dsgwgwgsd.... ...dgwgwggsd.... ....dggggsd..... ....dddddd...... .....d..d.......', { d: '#30284d', g: '#5f75bc', w: '#f0dbff', s: '#a691ef' });
const miner = pixels('.....dddddd..... ....dwwwwwwd.... ...dssssssssd... ..dddddddddddd.. ....dgwwgwd..... ....dgggggd..... ..ddggggggdd.... ..dbbbbbsbdd.... .ddgbbbsbbd.dd.. ..dgbbbsbddd.... ...ddddddd...... ..ddd..ddd......', { d: '#22233f', w: '#fff0ad', s: '#efae5b', g: '#f4a48a', b: '#5fa5c6' });
const mage = pixels('........w....... .......dwd...... ......dwgwd..... .....dggggwd.... ....dggggggwd... ...ddddddddddd.. .....dwwswd..... ....dswwsssd.... ...dsgggggssd... ..dggsgsggggsd.. .dggggsggggggsd. .dddddddddddddd.', { d: '#33234f', g: '#9b68df', w: '#fff1ba', s: '#d59ffb' });
const guard = pixels('.....ddd........ ....ddwdd....... ...dswwsddd..... ...dssgswdd..... ...dddddddd..ssd ..dswwwwsd..sssd .dswdsssd..ssgsd .dswdsssd..ssgsd .dswwssd...ssgsd .dssssdd...ssssd ..dddddd....ddd. ..ddd.ddd.......', { d: '#392e56', s: '#bc9bba', w: '#fff0b6', g: '#d46b90' });
const cannon = pixels('..ddddddd... .dsssssssdd. dsswssssgggd dswwsssggggd dsswssssgggd .dsssssssdd. ..ddddddd...', { d: '#342542', s: '#715879', w: '#e0a5a5', g: '#4c425f' });

export class Enemy implements Body {
  w = 26;
  h = 25;
  vx = 0;
  vy = 0;
  age = 0;
  hp: number;
  state: EnemyState = 'active';
  stateTime = 0;
  stunned = 0;
  chilled = 0;
  burn = 0;
  burnTick = 0;
  shellKills = 0;
  bounces = 0;
  split = false;
  flaming = false;
  homing = false;
  wingLost = false;
  frozenShell = false;
  orbitCooldown = 0;
  nextShot = 0.8;
  armor = 0;
  private homeX: number;
  private homeY: number;

  constructor(public kind: EnemyKind, public x: number, public y: number, public face: number, strength = 0) {
    this.homeX = x;
    this.homeY = y;
    this.hp = 1 + strength * 0.19 + (kind === 'guard' ? 0.75 : 0);
    if (kind === 'plant') { this.w = 23; this.h = 23; }
    if (kind === 'cannonball') { this.h = 18; this.vx = face * 155; }
  }

  get alive() { return this.state !== 'gone' && this.state !== 'squashed'; }
  get visible() { return this.kind !== 'plant' || this.y < this.homeY + 8; }
  get center() { return this.x + this.w / 2; }

  squash() { this.state = 'squashed'; this.stateTime = 0.4; this.vx = 0; }

  hideInShell(frozen = false) {
    if (this.kind === 'plant' || this.kind === 'cannonball') return;
    this.frozenShell = frozen;
    this.state = 'shell';
    this.stateTime = 0.19;
    this.y += this.h - 17;
    this.h = 17;
    this.vx = 0;
    this.vy = 0;
  }

  kick(direction: number, speed: number) {
    this.state = 'rolling';
    this.face = direction;
    this.vx = direction * speed;
    this.stateTime = 0.19;
    this.bounces = 0;
    this.split = false;
    this.shellKills = 0;
  }

  tick(dt: number, map: TileMap, heroX: number, speed: number, emit: (shot: EnemyShot) => void) {
    if (this.state === 'gone') return;
    this.age += dt * (this.kind === 'plant' && this.chilled > 0 ? 0.35 : 1);
    this.stateTime = Math.max(0, this.stateTime - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.chilled = Math.max(0, this.chilled - dt);
    this.orbitCooldown = Math.max(0, this.orbitCooldown - dt);
    if (this.state === 'squashed') {
      if (!this.stateTime) this.state = 'gone';
      return;
    }
    if (this.kind === 'plant') {
      const phase = (this.age + this.x * 0.001) % 3.4;
      const lift = Math.abs(heroX - this.center) < 46 || this.stunned ? 0 : Math.min(1, phase * 4, Math.max(0, 2.4 - phase) * 4);
      this.y = this.homeY + 31 - lift * 32;
      return;
    }
    if (this.kind === 'cannonball') {
      this.x += this.vx * dt;
      if (this.age > 5 || this.x < -45 || this.x > map.width + 45) this.state = 'gone';
      return;
    }
    if (this.state === 'active' && !this.stunned) this.act(dt, heroX, speed, emit);
    if (this.state === 'active' && ((this.kind === 'wing' && !this.wingLost) || this.kind === 'mage')) {
      if (this.kind === 'mage' && this.stunned > 0) this.y = this.homeY - 20 + Math.sin(this.age * 24) * 3;
      return;
    }
    if (this.state === 'shell' || this.stunned > 0 && this.state === 'active') this.vx = 0;
    this.vy = Math.min(730, this.vy + 1160 * dt);
    const velocity = this.vx;
    const result = move(this, map, dt);
    const hitSpring = this.state === 'rolling'
      ? (result.wall instanceof Tile && result.wall.kind === 'spring' ? result.wall : result.floor instanceof Tile && result.floor.kind === 'spring' ? result.floor : undefined)
      : undefined;
    if (hitSpring) {
      hitSpring.bump = 0.2;
      const dir = Math.sign(velocity || this.face) || 1;
      this.face = dir;
      this.vx = dir * Math.max(455, Math.abs(velocity));
      if (this.vy > -180) this.vy = -415;
    } else if (result.wall) {
      this.face *= -1;
      if (this.state === 'rolling') {
        this.vx = -velocity;
        this.bounces++;
      }
    }
    if (this.x < 0 || this.x + this.w > map.width) {
      this.x = Math.max(0, Math.min(map.width - this.w, this.x));
      this.face *= -1;
      if (this.state === 'rolling') { this.vx = -velocity; this.bounces++; }
    }
    if (this.state === 'active' && (this.kind === 'koopa' || this.kind === 'guard' || this.kind === 'miner') && result.floor && !result.wall) {
      const probe = { x: this.face > 0 ? this.x + this.w + 3 : this.x - 5, y: this.y + this.h, w: 2, h: 5 };
      if (!map.colliders(probe).length) this.face *= -1;
    }
    if (this.y > HEIGHT + 45) this.state = 'gone';
  }

  private act(dt: number, heroX: number, speed: number, emit: (shot: EnemyShot) => void) {
    const slowdown = this.chilled > 0 ? 0.28 : 1;
    if (this.kind === 'wing' && !this.wingLost) {
      this.x = this.homeX + Math.sin(this.age * 1.6 * slowdown) * 47;
      this.y = this.homeY + Math.sin(this.age * 3.2 * slowdown) * 22;
      return;
    }
    if (this.kind === 'miner' || this.kind === 'mage') {
      this.nextShot -= dt * slowdown;
      if (this.kind === 'mage') this.y = this.homeY - 20 - Math.sin(this.age * 3.5 * slowdown) * 20;
      if (this.nextShot <= 0 && Math.abs(heroX - this.x) < 470) {
        if (this.kind === 'mage') {
          const offset = this.x >= this.homeX ? -56 : 56;
          this.x = this.homeX + offset;
        }
        const face = Math.sign(heroX - this.x) || 1;
        this.face = face;
        emit({ x: this.center, y: this.y + 7, vx: face * (this.kind === 'mage' ? 190 : 178), vy: this.kind === 'mage' ? 72 : -310, type: this.kind === 'mage' ? 'magic' : 'wrench' });
        this.nextShot = this.kind === 'mage' ? 2.15 : 2.85;
      }
    }
    this.vx = this.face * (this.kind === 'koopa' ? 65 : this.kind === 'guard' ? 43 : 48) * slowdown * speed;
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number) {
    if (this.state === 'gone' || !this.visible) return;
    const sprite = this.state === 'shell' || this.state === 'rolling' ? (this.frozenShell ? iceShell : shell) : {
      walker: cap[Math.floor(time * 8) % 2], koopa, plant, wing: this.wingLost ? cap[1] : wing, miner, mage, guard, cannonball: cannon,
    }[this.kind];
    ctx.save();
    if (this.kind === 'plant' && this.state === 'active') {
      ctx.beginPath();
      ctx.rect(this.homeX - 14, this.homeY - 10, 55, 42);
      ctx.clip();
    }
    if (this.stunned > 0 || this.chilled > 0) ctx.globalAlpha = 0.65 + Math.sin(time * 25) * 0.18;
    if (this.flaming || this.burn > 0) { ctx.shadowColor = '#ff8855'; ctx.shadowBlur = 12; }
    const h = this.state === 'squashed' ? 8 : this.h + 4;
    renderer.draw(ctx, sprite, this.x - 4, this.y + this.h - h, this.w + 8, h, this.face < 0);
    ctx.restore();
  }
}
