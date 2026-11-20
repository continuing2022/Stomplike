import type { ChiptuneAudio } from '../audio/ChiptuneAudio';
import { Camera } from '../engine/Camera';
import { HEIGHT, TILE, WIDTH } from '../engine/GameEngine';
import type { InputManager } from '../engine/InputManager';
import { clamp, move, overlaps, stomped, type Body } from '../engine/Physics';
import { Boss, type BossEvents } from '../entities/Boss';
import { Enemy, type EnemyShot } from '../entities/Enemy';
import { Player, type PlayerEvents } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { drawBackground } from '../graphics/Background';
import { ParticleSystem } from '../graphics/ParticleSystem';
import type { PixelRenderer } from '../graphics/PixelRenderer';
import { CASTLE, COINS, CRYSTAL, FLAG, STAR } from '../graphics/SpriteData';
import { countTags, type Effect } from '../roguelike/Relics';
import type { RunManager } from '../roguelike/RunManager';
import { type Level, type Modifier } from './LevelGenerator';
import { Tile, TileMap } from './TileMap';

export type FlagGrade = 'clear' | 'great' | 'perfect';
export interface StageResult { grade: FlagGrade; coins: number; kills: number; bestCombo: number }

export interface StageFeedback { audio: ChiptuneAudio; freeze: (seconds: number) => void }
const GOLD = ['#fff1a0', '#ffd05c', '#ffad51'];

interface Pickup extends Body { kind: 'coin' | 'crystal'; life: number; moving: boolean; value: number; harmful: boolean }

export class Stage {
  readonly particles = new ParticleSystem();
  private redFlash = 0;
  readonly camera = new Camera();
  readonly pickups: Pickup[] = [];
  readonly player: Player;
  readonly boss?: Boss;
  private readonly bossEvents: BossEvents;
  readonly enemies: Enemy[] = [];
  readonly projectiles: Projectile[] = [];
  private readonly effects = new Set<Effect>();
  private readonly tags;
  private readonly random: () => number;
  private charges = 0;
  private siphons = 0;
  private talismans = 0;
  private coinChain = 0;
  private lastCoin = -Infinity;
  private nextLife = 100;
  private skillDelay = 0;
  private nextShell = 6;
  readonly map: TileMap;
  readonly world: number;
  readonly modifier: Modifier;
  private flagTime = 0;
  private flagY = 0;
  private flagStartY = 0;
  grade: FlagGrade = 'clear';
  kills = 0;
  bestCombo = 0;
  time = 0;
  coins = 0;
  balance: number;
  finished = false;
  private readonly playerEvents: PlayerEvents;

  constructor(readonly level: Level, private readonly input: InputManager, private readonly feedback: StageFeedback, readonly run: RunManager) {
    this.balance = run.coins;
    this.tags = countTags(run.relics);
    this.random = run.random;
    for (const relic of run.relics) relic.hook(this.effects);
    this.map = level.map;
    this.world = level.world;
    this.modifier = level.modifier;
    const character = run.character;
    this.player = new Player(84, 13 * TILE - 30, character.skin);
    this.player.doubleJump = character.doubleJump;
    this.player.speedScale = character.speed;
    this.player.jumpScale = character.jump;
    this.boss = level.arena ? new Boss(level.world, run.heat) : undefined;
    this.bossEvents = {
      emit: (kind, x, y, vx, vy, hostile) => this.projectiles.push(new Projectile(kind, x, y, vx, vy, 1, hostile)),
      minion: (x, y) => {
        if (this.enemies.filter(enemy => enemy.alive).length < 4) this.enemies.push(new Enemy('walker', x, y, x > this.player.x ? -1 : 1, run.heat));
      },
      cannon: (x, y, face) => this.enemies.push(new Enemy('cannonball', x + face * 46, y, face)),
      slam: (x, y, strength) => {
        this.camera.shake(strength);
        this.feedback.audio.play('blockBreak');
        this.particles.dust(x, y, true);
        if (this.player.grounded && Math.abs(this.player.center - x) < 114) this.hurt(Math.sign(this.player.center - x));
      },
      clouds: () => {
        for (let i = 0; i < 5; i++) {
          const x = clamp(Math.round(this.player.center / TILE) - 2 + i, 3, 26);
          const y = i === 0 || i === 4 ? 11 : 10;
          if (!this.map.get(x, y)) {
            const tile = this.map.set(x, y, 'cloud');
            if (tile) tile.life = 5;
          }
        }
      },
    };
    this.player.hearts = run.hearts;
    this.player.maxHearts = run.maxHearts;
    this.player.shield = run.shield;
    this.player.mayPound = this.effects.has('pound');
    for (const coin of level.coins) this.pickup(coin.x, coin.y, 'coin', 2);
    for (const spawn of level.enemies) this.enemies.push(new Enemy(spawn.kind, spawn.x, spawn.y, spawn.direction, run.heat + (run.current.kind === 'elite' ? 1 : 0)));
    this.flagY = level.flag.top + 6;
    this.playerEvents = {
      jump: () => { this.particles.dust(this.player.center, this.player.feet); this.feedback.audio.play('jump'); },
      skid: () => this.particles.dust(this.player.center, this.player.feet, true),
      land: pound => this.land(pound), skill: () => this.skill(),
      block: tile => this.hitBlock(tile),
      fall: () => this.hurt(0, true),
    };
  }

  pickup(x: number, y: number, kind: Pickup['kind'] = 'coin', value = 1, moving = false, vx = 0, vy = 0, harmful = false) {
    this.pickups.push({ x, y, w: kind === 'coin' ? 16 : 24, h: kind === 'coin' ? 16 : 24, vx, vy, kind, value, moving, harmful, life: moving && kind === 'coin' ? 8 : Infinity });
  }

  private has(effect: Effect) { return this.effects.has(effect); }

  private hitBlock(tile: Tile, force = false) {
    if (tile.kind === 'switch' && tile.bump <= 0 && this.boss) {
      tile.bump = 0.2;
      if (this.world === 1) this.boss.expose();
      else if (this.world === 0) this.bossEvents.emit('rock', tile.x + 4, tile.y + 36, 0, 110, false);
      this.feedback.audio.play('powerup');
      this.particles.burst(tile.x + 16, tile.y + 16, 16, ['#bcfcff', '#7bd7f7'], 120, 40, true);
      return;
    }
    if (!['question', 'brick', 'bomb'].includes(tile.kind) || tile.bump > 0) return;
    const kind = tile.kind;
    tile.bump = 0.2;
    const x = tile.x + 16;
    const y = tile.y + 16;
    const broken = kind === 'bomb' || kind === 'brick' && (force || this.player.powered || this.has('blast'));
    const steel = this.run.character.id === 'leo';
    for (const enemy of this.enemies) {
      if (!enemy.alive || Math.abs(enemy.center - x) >= (steel ? 43 : 24) || enemy.y + enemy.h < tile.y - 16 || enemy.y + enemy.h > tile.y + 9) continue;
      enemy.stunned = steel ? 2 : 1.3;
      enemy.vy = -205;
      if (broken || enemy.kind === 'plant') this.defeat(enemy);
    }
    if (kind === 'question') {
      tile.kind = 'used';
      if (tile.loot === 'crystal') this.pickup(tile.x + 4, tile.y - 26, 'crystal', 0, true, 82, -130);
      else this.collect(x, tile.y - 22, tile.loot === 'hidden' ? 10 : 5);
      if (this.has('dice')) {
        const roll = this.random();
        if (roll < 0.34) this.collect(x, tile.y - 38, 6);
        else if (roll < 0.67) this.player.speedBoost = 4;
        else this.fire('fire', x, y - 22, this.player.face);
      }
    }
    if (this.tags.block >= 2) for (let i = 0; i < 4; i++) this.projectiles.push(new Projectile('shard', x, y - 28, (i - 1.5) * 120, -195 - i % 2 * 65, 1.15));
    if (this.has('charge') && ++this.charges % 5 === 0) {
      this.player.star = 3;
      this.feedback.audio.play('powerup');
      this.particles.text(x, y - 24, 'STAR!');
    }
    if (!broken) { this.feedback.audio.play('blockBump'); return; }
    this.map.remove(tile);
    if (steel && kind === 'brick') this.sprayCoins(x, y - 8, 2, 1);
    if (this.has('alchemist')) this.sprayCoins(x, y - 9, 6, 3, true);
    else this.particles.debris(x, y, ['#f0a27c', '#aa5d59']);
    if (this.tags.block >= 4 && this.random() < 0.25 && kind === 'brick') {
      const bonus = this.map.set(tile.x / TILE, tile.y / TILE, 'question');
      if (bonus) { bonus.life = 5; bonus.bump = 0.2; }
    }
    if (this.has('blast') || kind === 'bomb') {
      const radius = kind === 'bomb' ? 290 : 66;
      this.particles.burst(x, y, 22, ['#ff9b7c', '#ffd082', '#ed6387'], 144);
      for (const enemy of this.enemies) if (enemy.alive && Math.hypot(enemy.center - x, enemy.y - y) < radius) this.defeat(enemy);
      if (!force && this.has('blast')) {
        const adjacent = this.map.candidates({ x: tile.x - TILE, y: tile.y - 1, w: TILE * 3, h: 2 });
        for (const other of adjacent) if (other !== tile && other.kind === 'brick') this.hitBlock(other, true);
      }
    }
    this.feedback.audio.play('blockBreak');
    this.feedback.freeze(0.04);
    this.camera.shake(kind === 'bomb' ? 8 : 4);
  }

  private sprayCoins(x: number, y: number, amount: number, value: number, harmful = false) {
    for (let i = 0; i < amount; i++) this.pickup(x - 8, y, 'coin', value, true, (i - (amount - 1) / 2) * 38, -170 - (i % 4) * 44, harmful);
  }

  private collect(x: number, y: number, value: number) {
    if (this.has('midas')) {
      this.coinChain = this.time - this.lastCoin < 0.8 ? this.coinChain + 1 : 1;
      this.lastCoin = this.time;
      value = Math.round(value * Math.min(3, 1 + (this.coinChain - 1) * 0.23));
    }
    value *= this.modifier === 'double-coins' ? 2 : 1;
    this.coins += value;
    this.balance += value;
    if (this.coins >= this.nextLife) {
      this.nextLife += 100;
      if (this.player.hearts < this.player.maxHearts) this.player.hearts++;
      else this.player.shield++;
      this.feedback.audio.play('powerup');
      this.particles.text(this.player.center, this.player.y - 10, '1UP!', '#a8f1bd');
    }
    if (this.tags.greed >= 2) this.player.coinBoost = 4;
    if (this.tags.greed >= 4 && this.random() < 0.15) {
      const target = this.nearby(x, y, 480)[0];
      if (target) {
        const dart = new Projectile('dart', x, y, 0, 0, this.damage(1.4));
        dart.target = target;
        this.projectiles.push(dart);
      }
    }
    this.feedback.audio.play('coin');
    this.particles.burst(x, y, 7, GOLD, 65, 35, true);
    this.particles.text(x, y - 8, '+' + value);
  }

  private nearby(x: number, y: number, max: number) {
    const dist = (enemy: Enemy) => Math.hypot(enemy.center - x, enemy.y - y);
    return this.enemies.filter(e => e.alive && e.visible && dist(e) < max).sort((a, b) => dist(a) - dist(b));
  }

  private damage(base: number, expensive = false) {
    let value = base * (1 + (this.run.character.id === 'buck' ? Math.floor(this.balance / 50) * 0.1 : 0)) * (this.has('crown') ? 1 + Math.floor(this.balance / 100) * 0.25 : 1);
    if (expensive && this.has('heavy') && this.balance >= 3) { this.balance -= 3; value *= 1.6; }
    return value;
  }

  private hitEnemy(enemy: Enemy, value: number) {
    enemy.hp -= value;
    if (enemy.hp <= 0.0001) this.defeat(enemy);
    else { enemy.stunned = 0.32; this.particles.text(enemy.center, enemy.y, '−' + Number(value.toFixed(1))); }
  }

  private fire(type: 'fire' | 'ice', x: number, y: number, face: number, vy = -95, power = 1) {
    const bounces = this.tags.projectile >= 4 ? 2 : 0;
    const shot = new Projectile(type, x, y, face * 420, vy, power, false, bounces);
    shot.onWall = body => this.particles.burst(body.x, body.y, 5, ['#ffd684', '#ff8f69']);
    this.projectiles.push(shot);
  }

  private temporaryBrick(below: boolean) {
    const x = Math.floor(this.player.center / TILE);
    const y = below ? Math.ceil(this.player.feet / TILE) : Math.floor((this.player.y - TILE - 5) / TILE);
    if (y < 3 || y > 15 || this.map.get(x, y)) return false;
    const tile = this.map.set(x, y, 'brick');
    if (tile) tile.life = 4;
    return Boolean(tile);
  }

  private skill() {
    if (this.skillDelay > 0) return;
    const p = this.player;
    const canShoot = this.has('fire') || this.has('ice') || this.tags.projectile >= 2;
    const summons = this.has('portable') && this.input.pressed('skill') && this.temporaryBrick(!p.grounded && p.vy >= 0);
    if (!canShoot && !summons) return;
    if (canShoot) {
      const x = p.center + p.face * 16 - 7;
      const kind = this.has('ice') ? 'ice' : 'fire';
      const power = this.damage(1.25, true);
      this.fire(this.has('fire') ? 'fire' : kind, x, p.y + 9, p.face, -108, power);
      if (this.has('twin')) this.fire(kind, x, p.y + 2, p.face, -235, power);
      this.feedback.audio.play('fireball');
    } else this.feedback.audio.play('blockBump');
    this.skillDelay = (canShoot ? 0.45 : 0.75) / (p.coinBoost > 0 ? 1.15 : 1);
  }

  private shock(x: number, y: number, power: number) {
    for (const face of [-1, 1]) this.projectiles.push(new Projectile('wave', x, y, face * 380, 0, power));
    for (const e of this.nearby(x, y, this.tags.stomp >= 4 ? 290 : 115)) { e.stunned = 0.8; e.vy = -130; }
    this.camera.shake(5);
  }

  private lava(x: number, y: number) {
    for (const face of [-1, 1]) {
      this.fire('fire', x, y, face, -120, this.damage(1.1));
      this.fire('fire', x, y - 4, face, -258, this.damage(1.1));
    }
  }

  private land(pound: boolean) {
    const p = this.player;
    this.particles.dust(p.center, p.feet, pound);
    if (pound) {
      const tiles = this.map.candidates({ x: p.x - 20, y: p.feet, w: p.w + 40, h: 5 });
      for (const tile of tiles) this.hitBlock(tile, true);
      this.shock(p.center, p.feet - 21, this.damage(1.7));
      if (this.has('lava')) this.lava(p.center, p.feet - 20);
      if (this.has('portable')) this.temporaryBrick(true);
      this.feedback.audio.play('blockBreak');
      this.feedback.freeze(0.05);
    } else if (this.tags.stomp >= 4 && p.combo > 0) this.shock(p.center, p.feet - 21, this.damage(0.8));
  }

  private stompEffects(x: number, y: number) {
    const p = this.player;
    if (this.has('thunder')) {
      const enemies = this.nearby(x, y, 220).filter(e => Math.abs(e.center - x) > 10).slice(0, 2);
      for (const e of enemies) {
        const bolt = new Projectile('lightning', e.center, e.y + 9, 0, 0, 0);
        bolt.line = { x, y };
        this.projectiles.push(bolt);
        this.hitEnemy(e, this.damage(1.2));
      }
    }
    if (this.has('gravity')) for (const e of this.nearby(x, y, 96)) {
      const offset = Math.sign(x - e.center) * 25;
      if (!this.map.colliders({ ...e, x: e.x + offset }).some(tile => overlaps({ ...e, x: e.x + offset }, tile))) e.x += offset;
    }
    if (this.has('insoles')) p.speedBoost = 3;
    if (this.has('siphon') && p.combo % 3 === 0 && this.siphons < 2) {
      this.siphons++;
      p.shield++;
      this.particles.text(p.center, p.y - 14, '+1 SHIELD', '#8ceaff');
    }
    if (this.tags.stomp >= 4 && p.combo % 3 === 0) { this.shock(x, y, this.damage(0.8)); p.extraJump = true; }
    if (this.has('lava')) this.lava(x, y);
    if (this.has('windfall') && p.combo % 2 === 0) this.sprayCoins(x, y - 14, 10, 1);
  }

  protected hurt(direction: number, fall = false) {
    const p = this.player;
    if (!fall && (p.invulnerable > 0 || p.star > 0)) return;
    if (fall && this.run.parachutes > 0) {
      this.run.parachutes--;
      this.particles.text(p.center, p.y - 45, 'SAFE!', '#a4f3dd');
      return;
    }
    if (!fall && this.has('talisman') && this.balance >= 40 && this.talismans < 2) {
      this.talismans++;
      this.balance -= 40;
      p.invulnerable = 1.5;
      this.sprayCoins(p.center, p.y, 8, 3);
      this.feedback.audio.play('coin');
      return;
    }
    if (!fall && p.shield) p.shield--;
    else if (!fall && p.powered) p.setPower(false, this.map);
    else p.hearts--;
    p.invulnerable = 1.5;
    p.hurtTime = 0.26;
    p.combo = 0;
    if (!fall) { p.vx = direction * 205; p.vy = -295; }
    this.redFlash = 0.22;
    this.feedback.audio.play('hurt');
    this.feedback.freeze(0.035);
    this.camera.shake(fall ? 4 : 7);
  }

  get result(): StageResult {
    return { grade: this.grade, coins: this.coins, kills: this.kills, bestCombo: this.bestCombo };
  }

  private defeat(enemy: Enemy, shellCombo = 0) {
    if (!enemy.alive) return;
    enemy.squash();
    this.kills++;
    const reward = (5 + shellCombo * 2) * (this.has('midas') ? 1.5 : 1);
    this.pickup(enemy.center - 8, enemy.y - 12, 'coin', Math.ceil(reward), true, shellCombo ? this.player.face * 48 : 0, -140);
    this.particles.burst(enemy.center, enemy.y + 8, 9, GOLD, 102, 110, true);
    if (shellCombo > 1) this.particles.text(enemy.center, enemy.y - 10, 'x' + shellCombo + '!');
    if (this.has('demolition') && this.random() < 0.4) {
      const x = Math.floor(enemy.center / TILE);
      const y = Math.max(5, Math.floor(enemy.y / TILE) - 2);
      if (!this.map.get(x, y)) {
        const bomb = this.map.set(x, y, 'bomb');
        if (bomb) bomb.life = 8;
      }
    }
  }

  private emit(shot: EnemyShot) {
    this.projectiles.push(new Projectile(shot.type, shot.x, shot.y, shot.vx, shot.vy, 1, true));
  }

  private projectileTick(dt: number) {
    const p = this.player;
    for (const shot of this.projectiles) {
      shot.tick(dt, this.map);
      if (shot.life <= 0 || shot.type === 'lightning') continue;
      if (this.boss && this.boss.world === 0 && shot.type === 'rock' && this.boss.vulnerable && overlaps(shot, this.boss)) {
        this.boss.expose();
        this.hitBoss(this.damage(1.5), shot.x, shot.y);
        shot.life = 0;
        continue;
      }
      if (shot.hostile) {
        if (!p.recover && overlaps(shot, p)) { this.hurt(Math.sign(p.center - shot.x)); shot.life = 0; }
        continue;
      }
      if (this.boss && this.boss.vulnerable && !shot.hit.has(this.boss) && overlaps(shot, this.boss)) {
        if (this.hitBoss(shot.damage * 0.75, shot.x, shot.y)) {
          shot.hit.add(this.boss);
          if (shot.type !== 'wave') { shot.life = 0; continue; }
        }
      }
      if ((shot.type === 'fire' || shot.type === 'ice') && Math.floor(shot.age * 60) % 3 === 0) this.particles.burst(shot.x + 7, shot.y + 7, 1, shot.type === 'ice' ? ['#b9ecfa'] : ['#fdb26d'], 38, 40);
      for (const e of this.enemies) {
        if (!e.alive || !e.visible || shot.hit.has(e) || !overlaps(shot, e)) continue;
        if (shot.type === 'fire' && (e.state === 'shell' || e.state === 'rolling') && this.has('billiards')) {
          e.flaming = true;
          e.y += e.h - 27;
          e.h = 27;
          if (e.state === 'shell') e.kick(Math.sign(shot.vx) || 1, 475);
          shot.life = 0;
          break;
        }
        const blocked = e.kind === 'guard' && shot.type === 'fire' && Math.sign(shot.x - e.center) === e.face;
        if (!blocked) {
          if (shot.type === 'ice') { e.chilled = 3.5; e.stunned = 0.55; }
          if (shot.type === 'fire' && this.has('fire')) { e.burn = 1.8; e.burnTick = 0.4; }
          this.hitEnemy(e, shot.damage * (shot.type === 'ice' ? 0.62 : 1));
        }
        shot.hit.add(e);
        this.particles.burst(shot.x, shot.y, 6, blocked ? ['#baddf1'] : GOLD);
        if (shot.type !== 'wave') {
          if (shot.bounces > 0 && !blocked) { shot.bounces--; shot.vx *= -1; shot.vy = -240; shot.damage *= 1.2; }
          else shot.life = 0;
          break;
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].life <= 0) this.projectiles.splice(i, 1);
  }

  private splitShell(shell: Enemy) {
    if (this.tags.projectile < 4 || shell.split) return;
    shell.split = true;
    for (const face of [-1, 1]) {
      this.fire('fire', shell.center + face * 9, shell.y - 13, face, -220, this.damage(1.2));
    }
  }

  private enemyTick(dt: number) {
    const p = this.player;
    const speed = (this.modifier === 'double-coins' ? 1.35 : 1) * (1 + this.run.heat * 0.07);
    for (const enemy of this.enemies) {
      if (enemy.state !== 'rolling' && Math.abs(enemy.center - p.center) > WIDTH * 1.15) continue;
      if (enemy.homing && enemy.state === 'rolling') {
        const target = this.nearby(enemy.center, enemy.y, 280).find(e => e !== enemy && e.state === 'active');
        if (target && Math.abs(target.y - enemy.y) < 40 && enemy.stateTime === 0) enemy.vx = Math.sign(target.center - enemy.center) * Math.abs(enemy.vx);
      }
      const priorBounces = enemy.bounces;
      enemy.tick(dt, this.map, p.center, speed, shot => this.emit(shot));
      if (enemy.bounces > priorBounces) this.splitShell(enemy);
      if (enemy.burn > 0) {
        enemy.burn -= dt;
        enemy.burnTick -= dt;
        if (enemy.burnTick <= 0) { enemy.burnTick = 0.4; this.hitEnemy(enemy, 0.36); }
      }
      if (!enemy.alive || !enemy.visible) continue;
      if (enemy.state === 'rolling') {
        if (enemy.homing && enemy.bounces >= 6) { enemy.state = 'gone'; continue; }
        if (enemy.flaming || this.has('wrecking')) {
          const contact = { x: enemy.x - 5, y: enemy.y + 2, w: enemy.w + 10, h: enemy.h - 3 };
          for (const tile of this.map.candidates(contact)) if (overlaps(contact, tile)) this.hitBlock(tile, true);
        }
        for (const target of this.enemies) {
          if (target !== enemy && target.alive && target.visible && target.state !== 'rolling' && overlaps(enemy, target)) {
            this.splitShell(enemy);
            if (this.tags.projectile >= 4 && !enemy.flaming) {
              const hits = 1.45 * (1 + Math.min(2, enemy.shellKills) * 0.2);
              if (hits < target.hp) this.hitEnemy(target, hits);
              else this.defeat(target, ++enemy.shellKills);
            } else this.defeat(target, ++enemy.shellKills);
          }
        }
      }
      if (p.recover > 0 || p.hearts <= 0) continue;
      if (p.star > 0 && overlaps(p, enemy)) { this.defeat(enemy); continue; }
      if (enemy.state === 'active' && enemy.chilled > 0 && overlaps(p, enemy) && !p.falling) enemy.hideInShell();
      if (enemy.state === 'shell' && enemy.stateTime <= 0 && overlaps(p, enemy)) {
        enemy.kick(Math.sign(enemy.center - p.center) || p.face, 410 * (this.tags.projectile >= 2 ? 1.3 : 1));
        this.feedback.audio.play('shellKick');
        this.particles.burst(enemy.center, enemy.y, 8, GOLD);
        continue;
      }
      if (enemy.kind !== 'plant' && enemy.stateTime <= 0 && enemy.state !== 'shell' && stomped(p, p.previousFeet, enemy, p.falling)) {
        p.combo++;
        const press = this.stompDamage();
        if (enemy.kind === 'cannonball' && this.boss?.world === 1) {
          this.boss.expose();
          this.hitBoss(0.65, enemy.center, enemy.y);
        }
        if (enemy.kind === 'wing' && !enemy.wingLost) { enemy.wingLost = true; enemy.vy = 160; }
        else if ((enemy.kind === 'koopa' && enemy.state === 'active') || enemy.state === 'rolling') enemy.hideInShell();
        else this.hitEnemy(enemy, press);
        p.y = Math.min(p.y, enemy.y - p.h);
        p.bounce(this.input.held('jump'), this.tags.stomp >= 2 ? 1.15 : 1);
        this.bestCombo = Math.max(this.bestCombo, p.combo);
        this.stompEffects(enemy.center, enemy.y);
        this.feedback.audio.play('stomp', p.combo);
        if (p.combo > 1) this.particles.text(p.center, p.y - 7, 'x' + p.combo + '!');
        this.particles.burst(p.center, p.feet + 2, 8, GOLD, 100, 100, true);
        this.feedback.freeze(0.035);
        this.camera.shake(2.5);
      } else if (enemy.state !== 'shell' && (enemy.state !== 'rolling' || enemy.stateTime <= 0) && overlaps(p, enemy)) {
        this.hurt(Math.sign(p.center - enemy.center) || -p.face);
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].state === 'gone') this.enemies.splice(i, 1);
  }

  private stompDamage() {
    const p = this.player;
    return this.damage((p.pounding ? 2.2 : 1) * (1 + (this.run.character.comboDamage + (this.tags.stomp >= 2 ? 0.25 : 0)) * (p.combo - 1)), true);
  }

  private hitBoss(damage: number, x: number, y: number) {
    const boss = this.boss;
    if (!boss || !boss.hit(damage)) return false;
    this.particles.text(x, y - 10, '−' + Number(damage.toFixed(1)));
    this.particles.burst(x, y, 14, GOLD, 135, 130, true);
    this.feedback.freeze(0.045);
    this.camera.shake(6);
    if (boss.dead) {
      for (const enemy of this.enemies) enemy.state = 'gone';
      for (const shot of this.projectiles) if (shot.hostile) shot.life = 0;
      this.feedback.audio.setTrack('quiet');
      this.feedback.audio.play('victory');
      this.collect(boss.center, boss.y - 18, boss.world === 2 ? 55 : 27);
      this.particles.burst(boss.center, boss.y + 30, boss.world === 2 ? 100 : 65, GOLD, 238, 195, true);
      this.sprayCoins(boss.center, boss.y - 28, boss.world === 2 ? 24 : 12, 2);
    }
    return true;
  }

  private bossTick(dt: number) {
    const boss = this.boss;
    if (!boss) return;
    const p = this.player;
    boss.tick(dt, this.map, p, this.bossEvents);
    if (boss.dead) { this.finished = boss.deadTime > 1.8; return; }
    if (p.recover > 0) return;
    for (const shell of this.enemies) {
      if (shell.state !== 'rolling' || shell.stateTime > 0 || !overlaps(shell, boss)) continue;
      if (boss.world === 1 && !boss.vulnerable) boss.expose();
      if (this.hitBoss(this.damage(shell.flaming ? 2.5 : 1.3), shell.center, shell.y)) {
        shell.stateTime = 0.45;
        shell.vx *= -1;
      }
    }
    if (stomped(p, p.previousFeet, boss, p.falling)) {
      if (boss.vulnerable) {
        p.combo++;
        if (this.hitBoss(this.stompDamage(), boss.center, boss.y)) {
          this.bestCombo = Math.max(this.bestCombo, p.combo);
          this.feedback.audio.play('stomp', p.combo);
          this.stompEffects(boss.center, boss.y);
        }
      } else this.feedback.audio.play('blockBump');
      p.y = Math.min(p.y, boss.y - p.h);
      p.bounce(this.input.held('jump'), this.tags.stomp >= 2 ? 1.15 : 1);
    } else if (overlaps(p, boss)) {
      const side = Math.sign(p.center - boss.center) || 1;
      if (boss.mode === 'exposed') {
        if (side > 0) p.x = boss.x + boss.w;
        else p.x = boss.x - p.w;
      } else this.hurt(side);
    }
  }

  private flagTick(dt: number) {
    const p = this.player;
    const flag = this.level.flag;
    if (this.flagTime > 0) {
      this.flagTime += dt;
      const t = clamp(this.flagTime / 0.73, 0, 1);
      p.y = this.flagStartY + (flag.bottom - p.h - this.flagStartY) * t;
      p.x = flag.x - p.w;
      this.flagY = p.y + 3;
      if (this.flagTime > 1.0) this.finished = true;
      return;
    }
    if (p.recover || p.center + 16 < flag.x || p.center - 16 > flag.x || p.feet < flag.top - 18 || p.y > flag.bottom) return;
    const fraction = clamp((flag.bottom - (p.y + p.h / 2)) / (flag.bottom - flag.top), 0, 1);
    this.grade = fraction >= 0.85 ? 'perfect' : fraction >= 0.4 ? 'great' : 'clear';
    this.flagTime = dt;
    this.flagStartY = p.y;
    p.vx = p.vy = 0;
    p.face = 1;
    p.invulnerable = 0;
    this.feedback.audio.play('flagpole');
    const bonus = this.grade === 'perfect' ? 20 : this.grade === 'great' ? 12 : 10;
    this.collect(flag.x, p.y - 18, bonus * (this.has('crown') ? 2 : 1));
    this.particles.burst(flag.x, p.y, this.grade === 'perfect' ? 54 : 21, GOLD, 170, 150, true);
    this.particles.text(flag.x, p.y - 29, this.grade === 'perfect' ? 'PERFECT!' : this.grade === 'great' ? 'GREAT!' : 'CLEAR!');
    if (this.grade === 'perfect') this.feedback.freeze(0.05);
  }

  tick(dt: number) {
    if (this.finished || this.player.hearts <= 0) return;
    this.time += dt;
    this.redFlash = Math.max(0, this.redFlash - dt);
    this.particles.tick(dt);
    this.map.tick(dt, this.time);
    if (this.flagTime > 0) { this.flagTick(dt); this.camera.tick(dt); return; }
    this.player.tick(dt, this.input, this.map, this.playerEvents, this.modifier === 'low-gravity' ? 0.72 : 1, this.modifier === 'ice' ? 0.46 : 1, this.world === 2 ? HEIGHT - 17 : undefined);
    this.skillDelay = Math.max(0, this.skillDelay - dt);
    if (this.has('perpetual') && this.time >= this.nextShell) {
      this.nextShell += 6;
      const shell = new Enemy('koopa', clamp(this.player.x + this.player.face * 34, 0, this.map.width - 32), this.player.y - 16, this.player.face);
      shell.hideInShell();
      shell.homing = true;
      this.enemies.push(shell);
    }
    this.enemyTick(dt);
    this.bossTick(dt);
    this.projectileTick(dt);
    for (const item of this.pickups) {
      item.life -= dt;
      if (item.moving) {
        const direction = Math.sign(item.vx);
        item.vy = Math.min(650, item.vy + 850 * dt);
        const result = move(item, this.map, dt);
        if (result.floor) item.harmful = false;
        if (result.wall && item.kind === 'crystal') item.vx = -direction * 82;
      }
      if (item.y > HEIGHT + 60) item.life = 0;
      if (item.harmful) {
        const enemy = this.enemies.find(e => e.alive && e.visible && overlaps(e, item));
        if (enemy) { this.hitEnemy(enemy, this.damage(0.9)); item.harmful = false; }
      }
      if (item.kind === 'coin' && (this.tags.greed >= 2 || this.run.character.magnet > 0) && !this.player.recover) {
        const dx = this.player.center - item.x - item.w / 2;
        const dy = this.player.y + 15 - item.y - item.h / 2;
        if (Math.hypot(dx, dy) < Math.max(this.run.character.magnet, this.tags.greed >= 2 ? 40 : 0)) {
          item.x += dx * Math.min(dt * 12, 1);
          item.y += dy * Math.min(dt * 12, 1);
        }
      }
      if (item.life > 0 && !this.player.recover && overlaps(item, this.player)) {
        item.life = 0;
        if (item.kind === 'crystal') {
          this.player.setPower(true, this.map);
          this.feedback.audio.play('powerup');
          this.particles.burst(item.x, item.y, 18, ['#ffad9b', '#ff7e91', '#ffdf9a'], 130, 40, true);
        } else this.collect(item.x + 8, item.y, item.value);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].life <= 0) this.pickups.splice(i, 1);
    this.camera.follow(this.player.center, this.player.vx, this.map.width, dt);
    this.camera.tick(dt);
    if (!this.boss) this.flagTick(dt);
  }

  draw(ctx: CanvasRenderingContext2D, renderer: PixelRenderer) {
    drawBackground(ctx, renderer, this.world, this.camera.x, this.time);
    ctx.save();
    ctx.translate(-Math.round(this.camera.x) + this.camera.dx, this.camera.dy);
    if (this.world === 2) {
      ctx.fillStyle = '#9c527d';
      ctx.fillRect(this.camera.x - 20, HEIGHT - 19, WIDTH + 40, 24);
      for (let x = Math.floor(this.camera.x / 32) * 32; x < this.camera.x + WIDTH + 32; x += 32) {
        ctx.fillStyle = '#ffb275';
        ctx.fillRect(x, HEIGHT - 18 + Math.sin(x + this.time * 5) * 2, 18, 3);
        ctx.fillStyle = '#d2738e';
        ctx.fillRect(x + 10, HEIGHT - 9, 17, 3);
      }
    }
    const flag = this.level.flag;
    if (flag.x < this.camera.x + WIDTH + 30) {
      renderer.draw(ctx, CASTLE, flag.x + 104, flag.bottom - 132, 192, 132);
      ctx.fillStyle = '#34536b';
      ctx.fillRect(flag.x - 3, flag.top, 8, flag.bottom - flag.top);
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect(flag.x - 1, flag.top, 3, flag.bottom - flag.top);
      renderer.draw(ctx, STAR, flag.x - 12, flag.top - 13, 24, 24);
      renderer.draw(ctx, FLAG[Math.floor(this.time * 7) % 3], flag.x + 4, this.flagY, 43, 22);
    }
    this.map.draw(ctx, renderer, this.camera.x, this.time, this.world);
    this.boss?.draw(ctx, renderer);
    for (const enemy of this.enemies) if (enemy.x >= this.camera.x - 48 && enemy.x <= this.camera.x + WIDTH + 48) enemy.draw(ctx, renderer, this.time);
    for (const item of this.pickups) {
      if (item.x < this.camera.x - 26 || item.x > this.camera.x + WIDTH + 26) continue;
      const frame = Math.floor(this.time * 9 + item.x * 0.02) % 4;
      renderer.draw(ctx, item.kind === 'coin' ? COINS[frame] : CRYSTAL, item.x, item.y + (item.moving ? 0 : Math.sin(this.time * 5 + item.x) * 2), item.w, item.h);
    }
    for (const shot of this.projectiles) shot.draw(ctx, renderer);
    this.player.draw(ctx, renderer, this.time);
    this.particles.draw(ctx);
    ctx.restore();
    if (this.redFlash > 0) {
      ctx.fillStyle = 'rgba(244,75,95,' + this.redFlash * 1.05 + ')';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    if (this.player.recover > 0) {
      ctx.fillStyle = `rgba(20,19,39,${0.66 * Math.sin(this.player.recover / 0.35 * Math.PI)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }
}
