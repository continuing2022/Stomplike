export type CharacterId = 'leo' | 'pip' | 'buck';

export interface Character {
  id: CharacterId; name: string; role: string; equipment: string; description: string;
  skin: number; stars: number; hearts: number; shield: number; coins: number;
  speed: number; jump: number; doubleJump: boolean; comboDamage: number; magnet: number; discount: number;
}

export const CHARACTERS: readonly Character[] = [
  { id: 'leo', name: '工匠·里奥', role: '均衡', equipment: '精钢工帽', description: '3 心 · 顶砖范围扩大，碎砖额外掉币并震晕上方敌人。',
    skin: 0, stars: 0, hearts: 3, shield: 0, coins: 0, speed: 1, jump: 1, doubleJump: false, comboDamage: 0, magnet: 0, discount: 1 },
  { id: 'pip', name: '疾风·皮普', role: '敏捷', equipment: '羽翼短靴', description: '2 心 · 1 护盾 · 高跳与二段跳，空中每次连踩追加 35% 伤害。',
    skin: 1, stars: 80, hearts: 2, shield: 1, coins: 0, speed: 1.07, jump: 1.1, doubleJump: true, comboDamage: 0.35, magnet: 0, discount: 1 },
  { id: 'buck', name: '财迷·巴克', role: '经济', equipment: '聚宝背包', description: '3 心 · 60 金币 · 金币磁铁，商店八折，每 50 金币增伤 10%。',
    skin: 2, stars: 150, hearts: 3, shield: 0, coins: 60, speed: 0.96, jump: 1, doubleJump: false, comboDamage: 0, magnet: 68, discount: 0.8 },
];
