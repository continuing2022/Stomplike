import { clamp } from '../engine/Physics';
import { CHARACTERS, type Character, type CharacterId } from './Characters';
import type { RunOptions, RunSummary } from './RunManager';

export const SAVE_KEY = 'hoprealm.starlight.v1';
export const TALENTS = {
  life: { name: '生命之泉', descriptions: ['初始 +1 最大红心', '初始 +1 最大红心、+1 护盾', '初始 +2 最大红心、+1 护盾'], cost: [20, 55, 105] },
  caravan: { name: '商队人脉', descriptions: ['初始 +25 金币，每店首次免费刷新', '初始 +50 金币，每店首次免费刷新', '初始 +80 金币，每店首次免费刷新'], cost: [22, 58, 104] },
  luck: { name: '幸运星辉', descriptions: ['稀有与传说出现率 +10%', '稀有与传说出现率 +20%', '稀有与传说出现率 +35%'], cost: [26, 64, 114] },
  parachute: { name: '应急降落伞', descriptions: ['每局第 1 次掉坑免扣血', '每局前 2 次掉坑免扣血'], cost: [18, 60] },
  reroll: { name: '流派重骰', descriptions: ['每局免费刷新一次遗物奖励', '每局免费刷新两次遗物奖励'], cost: [24, 70] },
} as const;

export type Talent = keyof typeof TALENTS;
const talentKeys = Object.keys(TALENTS) as Talent[];
interface Save {
  stars: number; wins: number; bestHeat: number; heat: number; selected: CharacterId;
  characters: CharacterId[]; talents: Record<Talent, number>; muted: boolean;
}
const fresh = (): Save => ({
  stars: 0, wins: 0, bestHeat: 0, heat: 0, selected: 'leo',
  characters: ['leo'], talents: { life: 0, caravan: 0, luck: 0, parachute: 0, reroll: 0 }, muted: false,
});
const safeInt = (n: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof n === 'number' && Number.isFinite(n) ? clamp(Math.floor(n), 0, max) : 0;

function parse(raw: string | null): Save {
  if (!raw) return fresh();
  const data = JSON.parse(raw) as Partial<Save> | null;
  if (typeof data !== 'object' || data === null) return fresh();
  const save = fresh();
  save.stars = safeInt(data.stars);
  save.wins = safeInt(data.wins);
  save.bestHeat = safeInt(data.bestHeat, 5);
  save.heat = save.wins ? safeInt(data.heat, 5) : 0;
  save.muted = data.muted === true;
  if (Array.isArray(data.characters)) {
    for (const char of CHARACTERS) if (char.id !== 'leo' && data.characters.includes(char.id)) save.characters.push(char.id);
  }
  if (data.selected && save.characters.includes(data.selected)) save.selected = data.selected;
  for (const key of talentKeys) save.talents[key] = safeInt(data.talents?.[key], TALENTS[key].cost.length);
  return save;
}

export class MetaProgression {
  private data: Save;
  saving = true;

  constructor(private readonly storage: () => Storage = () => localStorage) {
    try { this.data = parse(storage().getItem(SAVE_KEY)); }
    catch { this.data = fresh(); }
  }

  get stars() { return this.data.stars; }
  get wins() { return this.data.wins; }
  get heat() { return this.data.heat; }
  get selected() { return CHARACTERS.find(char => char.id === this.data.selected) ?? CHARACTERS[0]; }
  get muted() { return this.data.muted; }
  get talents() { return this.data.talents; }
  has(character: Character) { return this.data.characters.includes(character.id); }

  private save() {
    try { this.storage().setItem(SAVE_KEY, JSON.stringify(this.data)); this.saving = true; }
    catch { this.saving = false; }
  }

  setMuted(value: boolean) { this.data.muted = value; this.save(); }

  setHeat(value: number) {
    if (!this.wins) return;
    this.data.heat = safeInt(value, 5);
    this.save();
  }

  choose(character: Character) {
    if (!this.has(character)) {
      if (this.stars < character.stars) return false;
      this.data.stars -= character.stars;
      this.data.characters.push(character.id);
    }
    this.data.selected = character.id;
    this.save();
    return true;
  }

  upgrade(talent: Talent) {
    const current = this.data.talents[talent];
    const cost: number | undefined = TALENTS[talent].cost[current];
    if (cost === undefined || this.stars < cost) return false;
    this.data.stars -= cost;
    this.data.talents[talent]++;
    this.save();
    return true;
  }

  record(summary: RunSummary, heat: number) {
    this.data.stars = safeInt(this.data.stars + summary.stars);
    if (summary.won) {
      this.data.wins++;
      this.data.bestHeat = Math.max(this.data.bestHeat, heat);
    }
    this.save();
  }

  reset() {
    this.data = fresh();
    this.save();
  }

  runOptions(): RunOptions {
    const character = this.selected;
    const { life, caravan, luck, parachute, reroll } = this.data.talents;
    return {
      character, heat: this.heat, hearts: character.hearts + [0, 1, 1, 2][life],
      shield: character.shield + Number(life >= 2), coins: character.coins + [0, 25, 50, 80][caravan],
      luck: [0, 0.1, 0.2, 0.35][luck], parachutes: parachute, rerolls: reroll, freeShop: caravan > 0,
    };
  }
}
