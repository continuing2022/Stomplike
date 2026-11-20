import { pixels } from '../graphics/SpriteData';
import type { Sprite } from '../graphics/PixelRenderer';

export type Tag = 'stomp' | 'block' | 'projectile' | 'greed';
export type Rarity = 'common' | 'rare' | 'legendary';
export const TAGS: Record<Tag, { name: string; color: string; pair: string; set: string }> = {
  stomp: { name: '踩踏轰击', color: '#f89198', pair: '踩踏反弹 +15%，连踩递增伤害', set: '落地或三连踩释放震荡，刷新空中能力' },
  block: { name: '砖块爆破', color: '#ffba83', pair: '顶砖飞溅四枚碎片', set: '碎砖有 25% 概率变为临时金色问号砖' },
  projectile: { name: '火球龟壳', color: '#82cffa', pair: '解锁弹跳火球，踢壳速度 +30%', set: '火球额外弹射两次，龟壳连撞增伤' },
  greed: { name: '贪婪金币', color: '#ffdc7e', pair: '拾币范围 +80%，拾币后加速', set: '拾币有 15% 概率射出追踪金币' },
};
export const RARITY_NAMES = { common: '普通', rare: '稀有', legendary: '传说' };
export type Effect = 'thunder' | 'pound' | 'insoles' | 'siphon' | 'gravity' | 'blast' | 'dice' | 'portable' | 'charge' | 'demolition' |
  'fire' | 'ice' | 'twin' | 'perpetual' | 'billiards' | 'midas' | 'talisman' | 'blackmarket' | 'heavy' | 'crown' |
  'lava' | 'alchemist' | 'wrecking' | 'windfall';
export interface Relic {
  id: Effect; name: string; rarity: Rarity; tags: readonly Tag[]; iconMatrix: Sprite;
  description: string; requires?: readonly Tag[]; hook: (effects: Set<Effect>) => void;
}

const motifs = {
  stomp: '..ll.... ..ll.... ..ll.... ..lll... ..lwwl.. ..lllll. .llllll. ........',
  block: '........ .llllll. .lwwlwl. .llllll. .lwlwwl. .llllll. ........ ........',
  projectile: '....l... ...lwl.. ..lwwl.. ..lwwll. .lwlwwl. .lwwwwl. ..llll.. ........',
  greed: '...ll... ..lwwl.. .lwlwwl. .lwwlwl. .lwlwwl. ..lwwl.. ...ll... ........',
};

function item(id: Effect, name: string, rarity: Rarity, tags: readonly Tag[], description: string, requires?: readonly Tag[]): Relic {
  return { id, name, rarity, tags, description, requires, iconMatrix: pixels(motifs[tags[0]], { l: TAGS[tags[0]].color, w: '#fff0c7' }), hook: effects => { effects.add(id); } };
}

export const RELICS: readonly Relic[] = [
  item('thunder', '雷霆铁靴', 'common', ['stomp'], '踩踏时电击最近的两名敌人。'),
  item('pound', '陨石重压', 'common', ['stomp'], '空中按 ↓ 下砸，震碎砖块并释放冲击波。'),
  item('insoles', '弹簧鞋垫', 'common', ['stomp'], '踩踏后 3 秒内移速与跳跃力提高 20%。'),
  item('siphon', '吸星踩踏', 'rare', ['stomp'], '三连踩补充 1 护盾，每关两次。'),
  item('gravity', '引力靴', 'legendary', ['stomp'], '踩踏把附近 96 像素内的敌人拉近。'),
  item('blast', '爆破头盔', 'common', ['block'], '能顶碎普通砖块，引爆附近敌人并震碎相邻砖块。'),
  item('dice', '幸运骰子', 'common', ['block'], '问号砖额外掉金币，或临时加速，或释放火球。'),
  item('portable', '随身弹簧砖', 'rare', ['block'], '按技能或下砸时召唤一块存在 4 秒的临时砖。'),
  item('charge', '砖块充能器', 'rare', ['block'], '每顶砖 5 次获得 3 秒星辉霸体。'),
  item('demolition', '连锁拆迁令', 'legendary', ['block'], '击败敌人有 40% 概率留下炸弹砖，顶撞后爆破。'),
  item('fire', '火焰花徽章', 'common', ['projectile'], 'J / X 发射弹跳火球，命中附加灼烧。'),
  item('ice', '冰霜花徽章', 'common', ['projectile'], 'J / X 发射冰球，冻结的敌人可以踢飞。'),
  item('twin', '双联火筒', 'rare', ['projectile'], '每次发射两枚不同弧度的投射物。'),
  item('perpetual', '永动刺壳', 'rare', ['projectile'], '每 6 秒在身边生成一枚可踢的追踪龟壳。'),
  item('billiards', '烈焰台球大师', 'legendary', ['projectile'], '火球点燃龟壳，将其变成可碾碎砖块的烈焰巨轮。'),
  item('midas', '点金手套', 'common', ['greed'], '败敌掉币 +50%，连续拾币最高获得 3 倍收益。'),
  item('talisman', '黄金护身符', 'rare', ['greed'], '消耗 40 金币抵消受击并散落金币，每关两次。'),
  item('blackmarket', '黑市会员卡', 'common', ['greed'], '商店多一件遗物，每店首次刷新免费。'),
  item('heavy', '重金砸人', 'rare', ['greed'], '发射或踩踏消耗 3 金币，使本次伤害 +60%。'),
  item('crown', '迈达斯王冠', 'legendary', ['greed'], '每持有 100 金币伤害 +25%，旗杆奖励翻倍。'),
  item('lava', '熔岩践踏', 'legendary', ['stomp', 'projectile'], '踩踏或重砸会向两侧各喷射两枚火球。', ['stomp', 'projectile']),
  item('alchemist', '点石成金', 'legendary', ['block', 'greed'], '碎砖喷出高价值金币，落地前能砸伤敌人。', ['block', 'greed']),
  item('wrecking', '拆迁铁球', 'legendary', ['projectile', 'block'], '高速龟壳撞碎砖块并远程顶开问号砖。', ['projectile', 'block']),
  item('windfall', '天降横财', 'legendary', ['stomp', 'greed'], '每逢偶数空中连踩喷出十枚金币。', ['stomp', 'greed']),
];

export function countTags(relics: readonly Relic[]) {
  const counts: Record<Tag, number> = { stomp: 0, block: 0, projectile: 0, greed: 0 };
  for (const relic of relics) for (const tag of relic.tags) counts[tag]++;
  return counts;
}

export function relicOffer(owned: readonly Relic[], amount: number, random: () => number, luck = 0, guaranteeRare = false, excluded: readonly Relic[] = []) {
  const counts = countTags(owned);
  const eligible = RELICS.filter(relic => !owned.includes(relic) &&
    (!relic.requires || relic.requires.every(tag => counts[tag] >= 2)));
  let pool = eligible.filter(relic => !excluded.includes(relic));
  const result: Relic[] = [];
  for (let i = 0; i < amount; i++) {
    if (!pool.length) pool = eligible.filter(relic => !result.includes(relic));
    if (!pool.length) break;
    const roll = random();
    const rarity: Rarity = roll < 0.09 * (1 + luck) ? 'legendary' : (guaranteeRare && i === 0) || roll < 0.39 * (1 + luck) ? 'rare' : 'common';
    const matching = pool.filter(relic => relic.rarity === rarity);
    const rarer = pool.filter(relic => relic.rarity !== 'common');
    const choices = matching.length ? matching : guaranteeRare && i === 0 && rarer.length ? rarer : pool;
    const relic = choices[Math.floor(random() * choices.length)];
    result.push(relic);
    pool = pool.filter(offer => offer !== relic);
  }
  return result;
}
