import { rng } from '../engine/Physics';
import { MODIFIERS, type Modifier, type World } from '../level/LevelGenerator';
import type { FlagGrade, StageResult } from '../level/Stage';
import { CHARACTERS, type Character } from './Characters';
import { countTags, relicOffer, type Relic } from './Relics';

export type NodeType = 'stage' | 'elite' | 'shop' | 'event' | 'boss';
export interface Node { kind: NodeType; name: string; detail: string; modifier: Modifier }
export const ELITES: Modifier[] = ['low-gravity', 'double-coins', 'ice'];
const node = (kind: NodeType, name: string, detail: string, modifier: Modifier = 'normal'): Node => ({ kind, name, detail, modifier });
export const NORMAL = node('stage', '星辉小径', '跑跳闯关 · 终点强化');
const BOSS = node('boss', '守关竞技场', '挑战世界守卫');
const SHOP = node('shop', '水管商店', '遗物、红心与护盾');
const EVENT = node('event', '神秘问号房', '接受一项奇遇');
export const FLAG_NAMES: Record<FlagGrade, string> = { clear: '旗杆抵达', great: '精彩跃迁', perfect: '完美跃迁！' };

export interface RunOptions { character?: Character; hearts?: number; shield?: number; coins?: number; luck?: number; rerolls?: number; freeShop?: boolean; parachutes?: number; discount?: number; heat?: number }
export interface RunSummary { stages: number; bosses: number; kills: number; bestCombo: number; collected: number; stars: number; won: boolean }
export type EventId = 'gambler' | 'fountain' | 'smith';

export class RunManager {
  readonly relics: Relic[] = [];
  readonly random: () => number;
  readonly heat: number;
  readonly character: Character;
  world: World = 0;
  depth = 0;
  hearts: number;
  maxHearts: number;
  shield: number;
  coins: number;
  parachutes: number;
  current: Node = NORMAL;
  routes: Node[] = [];
  rewards: Relic[] = [];
  stock: Relic[] = [];
  grade: FlagGrade = 'clear';
  event: EventId = 'gambler';
  clears = 0;
  bosses = 0;
  kills = 0;
  maxCombo = 0;
  collected = 0;
  coinTowardsLife = 0;
  stageStars = 0;
  rerolls: number;
  freeRefresh = false;
  pendingElite?: Relic;
  private lastResult?: StageResult;

  constructor(readonly seed: number, readonly options: RunOptions = {}) {
    this.random = rng(seed);
    this.character = options.character ?? CHARACTERS[0];
    this.maxHearts = this.hearts = options.hearts ?? this.character.hearts;
    this.shield = options.shield ?? this.character.shield;
    this.coins = options.coins ?? this.character.coins;
    this.rerolls = options.rerolls ?? 0;
    this.parachutes = options.parachutes ?? 0;
    this.heat = options.heat ?? 0;
  }

  get tags() { return countTags(this.relics); }
  nextSeed() { return Math.floor(this.random() * 4294967296); }

  makeRoutes() {
    if (this.depth >= 3) this.routes = [BOSS];
    else {
      const modifier = ELITES[Math.floor(this.random() * ELITES.length)];
      const elite = node('elite', '精英突变关', MODIFIERS[modifier] + ' · 稀有遗物', modifier);
      this.routes = [NORMAL, elite, this.depth === 1 || this.depth > 1 && this.random() < 0.5 ? SHOP : EVENT];
    }
  }

  enter(target: Node) {
    this.current = target;
    this.lastResult = undefined;
    if (target.kind === 'shop') {
      this.freeRefresh = Boolean(this.options.freeShop || this.owned('blackmarket'));
      this.refreshStock();
    }
    if (target.kind === 'event') {
      const choices: EventId[] = ['gambler', 'fountain', 'smith'];
      this.event = choices[Math.floor(this.random() * choices.length)];
    }
  }

  record(result: StageResult, cleared: boolean) {
    if (this.lastResult) return;
    this.lastResult = result;
    this.kills += result.kills;
    this.maxCombo = Math.max(this.maxCombo, result.bestCombo);
    this.collected += result.coins;
    if (!cleared) return;
    if (this.current.kind === 'boss') { this.bosses++; return; }
    this.clears++;
    this.grade = result.grade;
    this.stageStars += result.grade === 'perfect' ? 15 : result.grade === 'great' ? 13 : 10;
    this.pendingElite = this.current.kind === 'elite'
      ? relicOffer(this.relics, 10, this.random, this.options.luck, true).find(relic => relic.rarity !== 'common')
      : undefined;
    if (this.pendingElite) this.add(this.pendingElite);
    this.rewards = relicOffer(this.relics, this.grade === 'perfect' ? 4 : 3, this.random, this.options.luck);
  }

  reroll() {
    if (!this.rerolls || !this.rewards.length) return;
    this.rerolls--;
    this.rewards = relicOffer(this.relics, this.grade === 'perfect' ? 4 : 3, this.random, this.options.luck, false, this.rewards);
  }

  finishNode() { this.depth++; this.makeRoutes(); }

  nextWorld() {
    if (this.world === 2) return false;
    this.world = (this.world + 1) as World;
    this.depth = 0;
    this.hearts = Math.min(this.hearts + 1, this.maxHearts);
    this.makeRoutes();
    return true;
  }

  owned(id: Relic['id']) { return this.relics.some(relic => relic.id === id); }
  add(relic: Relic) { if (!this.relics.includes(relic)) this.relics.push(relic); }

  price(base: number) { return Math.ceil(base * (this.options.discount ?? this.character.discount)); }
  relicPrice(relic: Relic) { return this.price({ common: 45, rare: 66, legendary: 96 }[relic.rarity]); }
  spend(price: number) {
    if (this.coins < price) return false;
    this.coins -= price;
    return true;
  }

  buy(relic: Relic) {
    if (!this.stock.includes(relic) || !this.spend(this.relicPrice(relic))) return;
    this.add(relic);
    this.stock = this.stock.filter(item => item !== relic);
  }

  refreshShop() {
    if (!this.freeRefresh && !this.spend(this.price(16))) return;
    this.freeRefresh = false;
    this.refreshStock();
  }

  private refreshStock() {
    this.stock = relicOffer(this.relics, this.owned('blackmarket') ? 4 : 3, this.random, this.options.luck, false, this.stock);
  }

  resolveEvent() {
    if (this.event === 'fountain') return '';
    if (this.event === 'gambler') {
      if (this.hearts < 2) return '';
      const chance = relicOffer(this.relics, 24, this.random, this.options.luck).find(relic => relic.rarity === 'legendary');
      if (!chance) return '';
      this.hearts--;
      this.add(chance);
      return `获得「${chance.name}」。`;
    }
    if (!this.spend(this.price(28))) return '';
    const target = relicOffer(this.relics, 24, this.random, this.options.luck, true).find(relic => relic.rarity === 'rare');
    if (target) { this.add(target); return `铁匠打造了「${target.name}」。`; }
    this.shield += 2;
    return '铁匠为你打造了 2 点护盾。';
  }

  summarize(won: boolean): RunSummary {
    const base = Math.max(1, this.stageStars + this.bosses * 25 + Math.floor(this.collected / 10) + this.kills + this.maxCombo * 2 + (won ? 100 : 0));
    return { stages: this.clears, bosses: this.bosses, kills: this.kills, bestCombo: this.maxCombo, collected: this.collected, stars: base * (this.heat > 0 ? 2 : 1), won };
  }
}
