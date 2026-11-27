import { rng } from '../engine/Physics';
import { ELITE_TRIALS, MODIFIERS, TRIAL_META, type Modifier, type TrialKind, type World } from '../level/LevelGenerator';
import type { FlagGrade, StageResult } from '../level/Stage';
import { CHARACTERS, type Character } from './Characters';
import { canUnlockRelic, countTags, MAX_RELICS, MAX_SHIELD, MAX_TEMPER, OVERFLOW_SMELT_BONUS, RELICS, relicOffer, SMELT_COINS, type Rarity, type Relic } from './Relics';

export type NodeType = 'stage' | 'elite' | 'shop' | 'event' | 'boss';
export interface Node { kind: NodeType; name: string; detail: string; modifier: Modifier; trial?: TrialKind }
export const ELITES: Modifier[] = ['low-gravity', 'double-coins', 'ice'];
const node = (kind: NodeType, name: string, detail: string, modifier: Modifier = 'normal', trial?: TrialKind): Node => ({ kind, name, detail, modifier, trial });
export const NORMAL = node('stage', '星辉小径', '跑跳闯关 · 达成关内挑战解锁第 4 遗物项');
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
  temper = 0;
  shieldsBought = 0;
  shopShieldBought = false;
  freeRefresh = false;
  pendingElite?: Relic;
  pendingEliteOverflow = false;
  pendingEventRelic?: Relic;
  lastTrialDone = false;
  private lastResult?: StageResult;

  constructor(readonly seed: number, readonly options: RunOptions = {}) {
    this.random = rng(seed);
    this.character = options.character ?? CHARACTERS[0];
    this.maxHearts = this.hearts = options.hearts ?? this.character.hearts;
    this.shield = Math.min(MAX_SHIELD, options.shield ?? this.character.shield);
    this.coins = options.coins ?? this.character.coins;
    this.rerolls = options.rerolls ?? 0;
    this.parachutes = options.parachutes ?? 0;
    this.heat = options.heat ?? 0;
  }

  get tags() { return countTags(this.relics); }
  get isFull() { return this.relics.length >= MAX_RELICS; }
  nextSeed() { return Math.floor(this.random() * 4294967296); }

  makeRoutes() {
    if (this.depth >= 3) this.routes = [BOSS];
    else {
      const modifier = ELITES[Math.floor(this.random() * ELITES.length)];
      const trial = ELITE_TRIALS[Math.floor(this.random() * ELITE_TRIALS.length)];
      const elite = node('elite', '精英突变关', `${MODIFIERS[modifier]}\n试炼：${TRIAL_META[trial].routeDesc} → 额外稀有遗物`, modifier, trial);
      this.routes = [NORMAL, elite, this.depth === 1 || this.depth > 1 && this.random() < 0.5 ? SHOP : EVENT];
    }
  }

  enter(target: Node) {
    this.current = target;
    this.lastResult = undefined;
    this.pendingElite = undefined;
    this.pendingEliteOverflow = false;
    this.pendingEventRelic = undefined;
    if (target.kind === 'shop') {
      this.freeRefresh = Boolean(this.options.freeShop || this.owned('blackmarket'));
      this.shopShieldBought = false;
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
    this.lastTrialDone = result.trialDone;
    this.stageStars += (result.grade === 'perfect' ? 15 : result.grade === 'great' ? 13 : 10) + (result.trialDone ? 4 : 0);
    this.pendingElite = this.current.kind === 'elite' && result.trialDone
      ? relicOffer(this.relics, 10, this.random, this.options.luck, true).find(relic => relic.rarity !== 'common')
      : undefined;
    this.pendingEliteOverflow = false;
    if (this.pendingElite && !this.add(this.pendingElite)) this.pendingEliteOverflow = true;
    const slots = result.trialDone ? 4 : 3;
    const excluded = this.pendingElite ? [this.pendingElite] : [];
    this.rewards = relicOffer(this.relics, slots, this.random, this.options.luck, false, excluded);
  }

  reroll() {
    if (!this.rerolls || !this.rewards.length) return;
    this.rerolls--;
    const slots = this.lastTrialDone ? 4 : 3;
    const excluded = this.pendingElite ? [...this.rewards, this.pendingElite] : this.rewards;
    this.rewards = relicOffer(this.relics, slots, this.random, this.options.luck, false, excluded);
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
  add(relic: Relic) {
    if (this.isFull || this.relics.includes(relic)) return false;
    this.relics.push(relic);
    return true;
  }

  smeltPreview(rarity: Rarity) {
    const canTemper = this.temper < MAX_TEMPER;
    return { coins: SMELT_COINS[rarity] + (canTemper ? 0 : OVERFLOW_SMELT_BONUS), canTemper };
  }

  smelt(rarity: Rarity) {
    const { coins, canTemper } = this.smeltPreview(rarity);
    if (canTemper) this.temper++;
    this.coins += coins;
    this.collected += coins;
    return { coins, tempered: canTemper };
  }

  replace(oldRelic: Relic, newRelic: Relic) {
    const idx = this.relics.indexOf(oldRelic);
    if (idx < 0 || this.relics.includes(newRelic)) return undefined;
    this.relics[idx] = newRelic;
    return this.smelt(oldRelic.rarity);
  }

  salvageReward() {
    this.rewards = [];
    return this.smelt('common');
  }

  price(base: number) { return Math.ceil(base * (this.options.discount ?? this.character.discount)); }
  relicPrice(relic: Relic) { return this.price({ common: 45, rare: 66, legendary: 96 }[relic.rarity]); }
  shieldPrice() { return this.price(32 + this.shieldsBought * 18); }
  canBuyShield() { return !this.shopShieldBought && this.shield < MAX_SHIELD && this.coins >= this.shieldPrice(); }
  spend(price: number) {
    if (this.coins < price) return false;
    this.coins -= price;
    return true;
  }

  buyShield() {
    if (!this.canBuyShield() || !this.spend(this.shieldPrice())) return false;
    this.shield = Math.min(MAX_SHIELD, this.shield + 1);
    this.shieldsBought++;
    this.shopShieldBought = true;
    return true;
  }

  buy(relic: Relic) {
    if (this.isFull || !this.stock.includes(relic) || !this.spend(this.relicPrice(relic))) return false;
    this.add(relic);
    this.stock = this.stock.filter(item => item !== relic);
    return true;
  }

  buyWithReplace(oldRelic: Relic, relic: Relic) {
    if (!this.relics.includes(oldRelic) || !this.stock.includes(relic) || !this.spend(this.relicPrice(relic))) return undefined;
    this.stock = this.stock.filter(item => item !== relic);
    return this.replace(oldRelic, relic);
  }

  refreshShop() {
    if (!this.freeRefresh && !this.spend(this.price(16))) return;
    this.freeRefresh = false;
    this.refreshStock();
  }

  private refreshStock() {
    this.stock = relicOffer(this.relics, this.owned('blackmarket') ? 4 : 3, this.random, this.options.luck, false, this.stock);
  }

  canAcceptSmith() {
    if (this.coins < this.price(28)) return false;
    const counts = this.tags;
    const hasRarePool = RELICS.some(relic => relic.rarity === 'rare' && !this.relics.includes(relic) && canUnlockRelic(relic, counts));
    return hasRarePool || this.shield < MAX_SHIELD || this.temper < MAX_TEMPER;
  }

  resolveEvent() {
    this.pendingEventRelic = undefined;
    if (this.event === 'fountain') return '';
    if (this.event === 'gambler') {
      if (this.hearts < 2) return '';
      const chance = relicOffer(this.relics, 24, this.random, this.options.luck).find(relic => relic.rarity === 'legendary');
      if (!chance) return '';
      this.hearts--;
      this.coins += 35;
      this.collected += 35;
      if (this.add(chance)) return `获得「${chance.name}」与 35 金币。`;
      this.pendingEventRelic = chance;
      return '';
    }
    const target = relicOffer(this.relics, 24, this.random, this.options.luck, true).find(relic => relic.rarity === 'rare');
    if (!target && this.shield >= MAX_SHIELD && this.temper >= MAX_TEMPER) return '';
    if (!this.spend(this.price(28))) return '';
    if (target) {
      let bonus = '';
      if (this.temper < MAX_TEMPER) {
        this.temper++;
        bonus = `并淬炼锋芒（★${this.temper}）`;
      } else if (this.shield < MAX_SHIELD) {
        this.shield++;
        bonus = '并加固 1 点护盾';
      }
      if (this.add(target)) return `铁匠打造了「${target.name}」${bonus}。`;
      this.pendingEventRelic = target;
      return '';
    }
    const before = this.shield;
    this.shield = Math.min(MAX_SHIELD, this.shield + 2);
    const gained = this.shield - before;
    if (gained > 0 && gained < 2 && this.temper < MAX_TEMPER) {
      this.temper++;
      return `铁匠为你补满护盾（+${gained}）并淬炼了锋芒（★${this.temper}）。`;
    }
    if (gained > 0) return `铁匠为你打造了 ${gained} 点护盾。`;
    this.temper = Math.min(MAX_TEMPER, this.temper + 1);
    return `铁匠为你淬炼了流派锋芒（★${this.temper}）。`;
  }

  summarize(won: boolean): RunSummary {
    const base = Math.max(1, this.stageStars + this.bosses * 25 + Math.floor(this.collected / 10) + this.kills + this.maxCombo * 2 + (won ? 100 : 0));
    return { stages: this.clears, bosses: this.bosses, kills: this.kills, bestCombo: this.maxCombo, collected: this.collected, stars: Math.round(base * (1 + this.heat * 0.35)), won };
  }
}
