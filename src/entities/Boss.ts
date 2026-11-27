import { TILE, WIDTH } from '../engine/GameEngine';
import { approach, clamp, move, type Body } from '../engine/Physics';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { pixels, STAR } from '../graphics/SpriteData';
import type { World } from '../level/LevelGenerator';
import type { TileMap } from '../level/TileMap';
import type { Player } from './Player';
import type { ProjectileType } from './Projectile';

const groundY = TILE * 13;
const names = ['巨型蘑菇王·波波', '发条巨龟·铁甲号', '星辉暴君·库洛斯'];
const hp = [11, 18, 28];
const heatHp = [2.5, 3.5, 5];

const mushroom = pixels(
  '........................ ........ddddddd......... .....dddrrrrrrrddd...... ...ddrrrroorrrrrrrdd.... ..drrrrroooorrrrrrrrd... .drrrooorrroowoorrrrd.. .drrooorrwoooorrrrrrrd. drrroorrrrooorrrroorrrd drrrrrrrrrrrrrroooorrrd drrrrrrrrrrrrrrrrrrrrrd .ddddrrrrrrrrrrrrddddd. ..dsddddddddddddddssd.. ....dsffffsfffffsd...... ....dffwdsfsdwfffd...... ...dsffddsfsddfffsd..... ...dsffffssffffffsd..... ..ddsffddddddfffsddd.... ..dsdffdwffwdffdsdsd.... ..dsdfffddddfffdsdsd.... ...ddddsffffsdddddd..... .....dgddddddddgd....... ....dggggd..dggggd...... ...ddddddd..ddddddd.....',
  { d: '#382044', r: '#d4517a', o: '#ffab96', w: '#fff3c2', s: '#a05d7d', f: '#ffd49e', g: '#588687' });
const tortoise = pixels(
  '........................ ......d................. .....dwd....d........... ....dwwdddddwd....d..... ...ddbbbbbddwwd..dwd.... ..dsbbbwwbbdbbdddwwd.... .dsbbbwwwbbbbbbbdbbd..d. .dssbbbbbbbbwbbbbbbd.dwd dssbbbddbbbbwwbbbbbbdbbd dsbbbdsbdbbbbbbbbbbbbbbd dsssdsbbsdbbbbbbdddddded .dddddddddddddddeddeeed. ....ddffffdddddeeeedded. ...dffwffwffdddeeeeeed.. ..dffdfffdfffdeeeeeedd.. ..dffffffffffdeeeddd.... ...ddddddddddeeddd...... ...dsdsdddsdsdd......... ..ddddddd.dddddd........',
  { d: '#222542', b: '#4c9eb8', w: '#d1ffff', s: '#34738f', f: '#ffd67b', e: '#b67268' });
const tyrant = pixels(
  '........................ ..........d...d......... ..dd.....dwd.dwd....dd.. .dwdd....dwddwwd...ddwd. dwgdd...ddggggddd..ddgwd dwggdd.ddggwwgggddddggwd dggggdddggwwwwgggddggggd dgggggdgggggwwggggddgggd dggdgdddggrggrgggddgdggd .dgdd...dgggggggd..ddgd. ..dd....ddgwwwgdd...dd.. .......ddsdddddsdd...... .....ddgssssssssgd...... ...dddgssssswwsggdd..... ..dggdgssswwwwsggddd.... .dggdddgsswsssgggdggd... dgdd..dgggssggggddgggd.. dd....dggddddgggd.ddggd. .....dggd....dggd..dddd. ....dddddd..dddddd......',
  { d: '#332049', g: '#8e63ba', w: '#fae5b2', r: '#f47b8d', s: '#c78ec8' });
const bodies = [mushroom, tortoise, tyrant];
const warning = ['跃起重压', '巨壳冲撞', '俯冲逼近'];
type Mode = 'rest' | 'warning' | 'air' | 'dash' | 'exposed' | 'dead';
export type BossHitSource = 'stomp' | 'shot' | 'orbit';
export interface BossEvents {
  emit: (type: ProjectileType, x: number, y: number, vx: number, vy: number, hostile: boolean) => void;
  minion: (x: number, y: number) => void;
  cannon: (x: number, y: number, face: number) => void;
  slam: (x: number, y: number, strength: number) => void;
  clouds: () => void;
}

export class Boss implements Body {
  readonly name: string;
  readonly maxHp: number;
  hp: number;
  w: number;
  h: number;
  x = 646;
  y: number;
  vx = 0;
  vy = 0;
  face = -1;
  mode: Mode = 'rest';
  time = 0;
  since = 0;
  cooldown = 0;
  stompCooldown = 0;
  shotCooldown = 0;
  orbitCooldown = 0;
  flash = 0;
  deadTime = 0;
  private shotWindowHits = 0;
  private cycle = 0;
  private cast = 0;

  constructor(readonly world: World, heat: number) {
    this.name = names[world];
    this.maxHp = this.hp = hp[world] + heat * heatHp[world];
    this.w = world === 2 ? 94 : 92;
    this.h = world === 0 ? 77 : world === 1 ? 56 : 80;
    this.y = groundY - this.h;
  }

  get center() { return this.x + this.w / 2; }
  get phase() { return this.hp <= this.maxHp * 0.24 && this.world === 2 ? 3 : this.hp <= this.maxHp * 0.5 ? 2 : 1; }
  get dead() { return this.mode === 'dead'; }
  get vulnerable() { return !this.dead && (this.world !== 1 || this.mode === 'exposed'); }
  get hint() {
    if (this.mode === 'exposed') return '破绽开启 · 踩踏弱点';
    if (this.mode === 'warning') return warning[this.world];
    return ['踩踏菌冠 · 躲避落砖', '顶开电磁砖 · 也可踩返炮弹', '借云台起跳 · 躲开火雨'][this.world];
  }

  expose() {
    if (this.dead || this.mode === 'exposed') return;
    this.mode = 'exposed';
    this.since = 0;
    this.vx = 0;
  }

  capDamage(damage: number) {
    const knee = this.maxHp * (this.world === 0 ? 0.18 : this.world === 1 ? 0.16 : 0.14);
    const hardCap = this.maxHp * (this.world === 0 ? 0.28 : this.world === 1 ? 0.26 : 0.24);
    return damage <= knee ? damage : Math.min(hardCap, knee + (damage - knee) * 0.35);
  }

  hit(damage: number, source: BossHitSource = 'shot') {
    if (!this.vulnerable || this.dead) return 0;
    let effective = 0;
    if (source === 'stomp') {
      if (this.stompCooldown > 0) return 0;
      effective = this.capDamage(damage);
      this.stompCooldown = 0.3;
    } else if (source === 'orbit') {
      if (this.orbitCooldown > 0) return 0;
      effective = this.capDamage(damage);
      this.orbitCooldown = 0.52;
    } else {
      if (this.shotCooldown <= 0) {
        effective = this.capDamage(damage);
        this.shotCooldown = 0.34;
        this.shotWindowHits = 1;
      } else if (this.shotWindowHits < 4) {
        effective = this.capDamage(damage * 0.35);
        this.shotWindowHits++;
      } else return 0;
    }
    this.hp = this.hp - effective <= 0.0001 ? 0 : this.hp - effective;
    this.flash = 0.23;
    this.cooldown = 0.12;
    if (!this.hp) { this.mode = 'dead'; this.vx = 0; this.vy = 0; }
    return effective;
  }

  tick(dt: number, map: TileMap, player: Player, events: BossEvents) {
    this.time += dt;
    this.since += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.stompCooldown = Math.max(0, this.stompCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.orbitCooldown = Math.max(0, this.orbitCooldown - dt);
    if (this.shotCooldown <= 0) this.shotWindowHits = 0;
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.deadTime += dt; return; }
    if (this.mode === 'exposed') {
      this.vy = Math.min(720, this.vy + 1200 * dt);
      move(this, map, dt);
      if (this.since > (this.world === 1 ? 4.1 : 1.9)) this.enter('rest');
      return;
    }
    if (this.world === 0) this.valley(dt, map, player, events);
    if (this.world === 1) this.mine(dt, map, player, events);
    if (this.world === 2) this.sky(dt, map, player, events);
    if (this.x < 45 || this.x > WIDTH - 45 - this.w) {
      this.x = clamp(this.x, 45, WIDTH - 45 - this.w);
      if (this.mode === 'dash') { this.vx *= -1; this.face *= -1; }
      else this.vx = 0;
    }
  }

  private enter(mode: Mode) { this.mode = mode; this.since = 0; }

  private valley(dt: number, map: TileMap, p: Player, events: BossEvents) {
    const rage = this.phase > 1;
    if (this.mode === 'rest') {
      this.face = Math.sign(p.center - this.center) || this.face;
      this.vx = approach(this.vx, this.face * (rage ? 68 : 42), dt * 255);
      if (this.since > (rage ? 1.37 : 1.98)) { this.vx = 0; this.enter('warning'); }
    } else if (this.mode === 'warning' && this.since > 0.56) {
      this.vy = rage ? -630 : -560;
      this.vx = clamp((p.center - this.center) * 0.66, -185, 185);
      this.enter('air');
    }
    this.vy = Math.min(730, this.vy + (this.vy < 0 ? 1000 : 1850) * dt);
    const result = move(this, map, dt);
    if (this.mode === 'air' && result.floor) {
      this.vx = 0;
      this.cycle++;
      events.slam(this.center, this.y + this.h, rage ? 10 : 7);
      if (this.cycle <= 5 || rage) events.minion(clamp(this.center + this.face * 82, 95, WIDTH - 95), this.y - 16);
      const columns = this.cycle % 2 ? [288, 576, 800] : [165, 448, 678];
      for (const x of columns) events.emit('rock', x, 98, 0, 340, true);
      this.enter('rest');
    }
  }

  private mine(dt: number, map: TileMap, p: Player, events: BossEvents) {
    const rage = this.phase > 1;
    if (this.mode === 'rest') {
      this.face = Math.sign(p.center - this.center) || this.face;
      this.vx = 0;
      if (this.since > (rage ? 1.1 : 1.72)) this.enter('warning');
    } else if (this.mode === 'warning' && this.since > 0.69) {
      events.cannon(this.center, 302, this.face);
      this.vx = this.face * (rage ? 385 : 285);
      this.enter('dash');
    } else if (this.mode === 'dash' && this.since > (rage ? 2.75 : 2.15)) {
      events.cannon(this.center, 299, this.face);
      this.vx = 0;
      this.enter('rest');
    }
    this.vy = Math.min(730, this.vy + 1600 * dt);
    move(this, map, dt);
  }

  private sky(dt: number, map: TileMap, p: Player, events: BossEvents) {
    const rage = this.phase > 1;
    if (this.mode === 'rest') {
      this.face = Math.sign(p.center - this.center) || this.face;
      this.x += this.face * Math.min(Math.abs(p.center - this.center), (rage ? 120 : 70) * dt);
      const targetY = (rage ? 250 : 299) + Math.sin(this.time * 2.4) * 31;
      this.y = approach(this.y, targetY, 140 * dt);
      this.cast += dt;
      if (this.cast >= (rage ? 1.1 : 1.55)) {
        this.cast = 0;
        for (const dir of [-1, 0, 1]) {
          const x = clamp(p.center + dir * 88 - 8, 70, WIDTH - 80);
          events.emit('rain', x, 82, dir * 45, 80, true);
        }
      }
      if (this.since > (rage ? 2.3 : 3.4)) { events.clouds(); this.enter('warning'); }
    } else if (this.mode === 'warning' && this.since > 0.67) {
      this.vx = this.face * (this.phase === 3 ? 370 : 265);
      this.vy = 430;
      this.enter('dash');
    } else if (this.mode === 'dash') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y + this.h > groundY) {
        this.y = groundY - this.h;
        if (this.vy) events.slam(this.center, groundY, 8);
        this.vy = 0;
        const foot = { x: this.x + this.w * 0.4, y: groundY - 9, w: this.w * 0.2, h: 12 };
        const onGround = map.colliders(foot).length > 0;
        if (!onGround) this.y -= 5;
      }
      if (this.since > (this.phase === 3 ? 0.85 : 0.68)) this.expose();
    }
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer) {
    if (this.dead && this.deadTime > 0.88) return;
    ctx.save();
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deadTime / 0.88);
    else if (this.flash > 0) ctx.globalAlpha = Math.cos(this.flash * 130) > 0 ? 0.39 : 1;
    if (this.mode === 'warning') {
      ctx.shadowColor = '#ff8e83';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff0a5';
      ctx.fillRect(Math.round(this.center) - 2, Math.round(this.y) - 24, 4, 12);
      ctx.fillRect(Math.round(this.center) - 2, Math.round(this.y) - 8, 4, 3);
    } else if (this.mode === 'exposed') {
      ctx.shadowColor = '#9beaff';
      ctx.shadowBlur = 15;
      renderer.draw(ctx, STAR, this.center - 10, this.y - 19 + Math.sin(this.time * 8) * 4, 20, 20);
    }
    const compress = this.mode === 'dash' && this.world === 1 ? 12 : 0;
    renderer.draw(ctx, bodies[this.world], this.x - 4, this.y - 9 + compress, this.w + 8, this.h + 11 - compress, this.face < 0 !== (this.mode === 'exposed' && this.world === 1));
    ctx.restore();
  }
}
