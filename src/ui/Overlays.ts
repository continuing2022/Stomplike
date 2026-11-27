import { CHARACTERS } from '../roguelike/Characters';
import { TALENTS, type MetaProgression, type Talent } from '../roguelike/MetaProgression';
import type { RunSummary } from '../roguelike/RunManager';
import { COINS, HEROES } from '../graphics/SpriteData';
import { WORLD_NAMES } from '../level/LevelGenerator';
import { FLAG_NAMES, type RunManager } from '../roguelike/RunManager';
import { countTags, MAX_RELICS, MAX_SHIELD, MAX_TEMPER, RARITY_NAMES, STARTER_RELICS, TAGS, TEMPER_BONUS, type Relic, type Tag } from '../roguelike/Relics';
import type { PixelRenderer, Sprite } from '../graphics/PixelRenderer';

export interface Choice {
  title: string;
  detail?: string;
  label?: string;
  accent?: string;
  icon?: Sprite;
  disabled?: boolean;
  select: () => void;
}

interface Menu {
  title: string;
  eyebrow?: string;
  intro?: string;
  details?: HTMLElement;
  choices?: Choice[];
  actions?: Choice[];
  style?: string;
}

export class Overlays {
  private buttons: HTMLButtonElement[] = [];
  private actions: Choice[] = [];
  private active = 0;

  constructor(private readonly root: HTMLElement, private readonly renderer: PixelRenderer) {}

  get visible() { return !this.root.hidden; }

  close() {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.buttons = [];
    this.actions = [];
  }

  show(menu: Menu) {
    this.root.hidden = false;
    this.root.className = 'overlay ' + (menu.style ?? '');
    const panel = document.createElement('div');
    panel.className = 'panel';
    const heading = document.createElement('header');
    heading.className = 'panel-header';
    if (menu.eyebrow) heading.append(this.line('div', 'eyebrow', menu.eyebrow));
    heading.append(this.line('h1', '', menu.title));
    if (menu.intro) heading.append(this.line('p', 'panel-intro', menu.intro));
    panel.append(heading);
    if (menu.details) panel.append(menu.details);
    this.buttons = [];
    this.actions = [];
    if (menu.choices?.length) {
      const choices = document.createElement('div');
      choices.className = 'cards';
      choices.style.setProperty('--columns', String(Math.min(4, menu.choices.length)));
      for (const choice of menu.choices) choices.append(this.button(choice, true));
      panel.append(choices);
    }
    if (menu.actions?.length) {
      const actions = document.createElement('div');
      actions.className = 'actions';
      menu.actions.forEach((choice, i) => actions.append(this.button(choice, false, i === 0)));
      panel.append(actions);
    }
    this.root.replaceChildren(panel);
    this.active = 0;
    this.mark();
  }

  key(code: string) {
    if (!this.buttons.length) return false;
    const n = this.buttons.length;
    if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(code)) {
      this.active = (this.active + n + (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(code) ? 1 : -1)) % n;
      this.mark();
      this.buttons[this.active].focus({ preventScroll: true });
      this.buttons[this.active].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    }
    if (['Enter', 'Space', 'KeyE'].includes(code)) {
      this.actions[this.active]?.select();
      return true;
    }
    return false;
  }

  line(tag: string, cls: string, content: string) {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = content;
    return el;
  }

  private mark() { this.buttons.forEach((button, i) => button.classList.toggle('selected', i === this.active)); }

  private button(choice: Choice, card: boolean, primary = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = card ? 'card' : primary ? 'primary' : 'secondary';
    button.disabled = choice.disabled ?? false;
    if (choice.accent) button.style.setProperty('--card-accent', choice.accent);
    if (choice.icon) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 48;
      canvas.className = 'card-icon';
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      this.renderer.draw(ctx, choice.icon, 0, 0, 48, 48);
      button.append(canvas);
    }
    if (choice.label) button.append(this.line('span', 'card-label', choice.label));
    button.append(this.line('span', 'choice-title', choice.title));
    if (choice.detail) button.append(this.line('span', 'choice-detail', choice.detail));
    if (choice.disabled) return button;
    const index = this.buttons.length;
    this.buttons.push(button);
    this.actions.push(choice);
    button.addEventListener('focus', () => { this.active = index; this.mark(); });
    button.onclick = choice.select;
    return button;
  }

  relic(relic: Relic, run: RunManager, select: () => void, cost?: number): Choice {
    const labels = relic.tags.map(tag => TAGS[tag].name);
    const upgrade = relic.tags.filter(tag => [1, 3].includes(run.tags[tag])).map(tag => TAGS[tag].name + ' ' + (run.tags[tag] + 1));
    return {
      title: relic.name, detail: relic.description + (upgrade.length ? '\n激活 ' + upgrade.join(' / ') : ''),
      label: RARITY_NAMES[relic.rarity] + ' · ' + (cost === undefined ? labels.join(' / ') : cost + ' 金币'),
      disabled: cost !== undefined && run.coins < cost, accent: TAGS[relic.tags[0]].color,
      icon: relic.iconMatrix, select,
    };
  }

  tags(run: RunManager) {
    const row = document.createElement('div');
    row.className = 'tag-row';
    const slotBadge = this.line('span', 'tag' + (run.isFull ? ' active' : ''), `背包 ${run.relics.length}/${MAX_RELICS}`);
    slotBadge.style.setProperty('--card-accent', '#ffd580');
    slotBadge.title = `最多同时装备 ${MAX_RELICS} 件遗物；满槽获取新遗物时可替换熔炼旧遗物`;
    row.append(slotBadge);
    if (run.temper > 0 || run.isFull) {
      const temperBadge = this.line('span', 'tag active', `淬炼 ★${run.temper}/${MAX_TEMPER} (+${Math.round(run.temper * TEMPER_BONUS * 100)}%)`);
      temperBadge.style.setProperty('--card-accent', '#ff9f8a');
      temperBadge.title = `每次熔炼遗物提升 1 星淬炼（最高 ${MAX_TEMPER} 星 +${Math.round(MAX_TEMPER * TEMPER_BONUS * 100)}% 伤害）`;
      row.append(temperBadge);
    }
    const counts = run.tags;
    for (const tag of Object.keys(TAGS) as Tag[]) {
      const t = TAGS[tag];
      const badge = this.line('span', 'tag' + (counts[tag] >= 2 ? ' active' : ''), t.name + ' ' + counts[tag] + '/4');
      badge.style.setProperty('--card-accent', t.color);
      badge.title = '2 件 ' + t.pair + '\n4 件 ' + t.set;
      row.append(badge);
    }
    return row;
  }

  starter(run: RunManager, choose: (relic: Relic) => void, back: () => void) {
    this.show({
      style: 'reward-view', eyebrow: WORLD_NAMES[run.world] + ' / 出发起誓',
      title: '选择起步流派',
      intro: '选定一件初始战技立即解锁主动能力；后续遗物抽取留有流派偏向槽，空投补给也会联动强化。',
      choices: STARTER_RELICS.map(relic => this.relic(relic, run, () => choose(relic))),
      actions: [{ title: '返回大厅', select: back }],
    });
  }

  rewards(run: RunManager, choose: (relic?: Relic) => void, reroll: () => void, salvage: () => void) {
    const baseIntro = !run.rewards.length
      ? '符合条件的遗物已全部收集'
      : run.current.kind === 'elite'
        ? (run.pendingElite
          ? '⚔ 精英试炼达成！额外获得「' + run.pendingElite.name + '」并解锁 4 选 1'
          : '已突破精英关（未完成试炼目标，未获额外稀有遗物）')
        : (run.lastTrialDone
          ? '✦ 挑战达成！已解锁第 4 个遗物选项'
          : '选择一件遗物（达成关内挑战可解锁第 4 选项）');
    const intro = run.rewards.length && run.isFull ? baseIntro + ' · 背包已满，选牌后替换熔炼旧遗物' : baseIntro;
    const smelt = run.smeltPreview('common');
    const actions: Choice[] = run.rewards.length
      ? [
          ...(run.rerolls ? [{ title: '刷新 · ' + run.rerolls + ' 次', select: reroll }] : []),
          { title: `放弃并熔炼 (+${smelt.coins}G${smelt.canTemper ? ' · 淬炼+1' : ''})`, select: salvage },
        ]
      : [{ title: '继续', select: () => choose() }];
    this.show({
      style: 'reward-view', eyebrow: WORLD_NAMES[run.world] + ' / 强化',
      title: FLAG_NAMES[run.grade],
      intro,
      details: this.tags(run),
      choices: run.rewards.map(relic => this.relic(relic, run, () => choose(relic))),
      actions,
    });
  }

  replaceRelic(
    run: RunManager,
    incoming: Relic,
    eyebrow: string,
    replaceWith: (oldRelic: Relic) => void,
    fallback: Choice,
    cost?: number,
  ) {
    const inTags = incoming.tags.map(t => TAGS[t].name).join(' / ');
    const costNote = cost !== undefined ? ` · 花费 ${cost} 金币` : '';
    const choices: Choice[] = run.relics.map(oldRelic => {
      const preview = run.smeltPreview(oldRelic.rarity);
      const nextCounts = countTags(run.relics.map(r => (r === oldRelic ? incoming : r)));
      const deltaNotes: string[] = [];
      for (const tag of Object.keys(TAGS) as Tag[]) {
        const prev = run.tags[tag];
        const next = nextCounts[tag];
        if (next > prev && (next === 2 || next === 4)) deltaNotes.push(`激活 ${TAGS[tag].name} ${next}`);
        if (next < prev && ((prev >= 4 && next < 4) || (prev >= 2 && next < 2))) {
          deltaNotes.push(`失去 ${TAGS[tag].name} ${prev >= 4 ? 4 : 2}`);
        }
      }
      return {
        title: oldRelic.name,
        detail: oldRelic.description + (deltaNotes.length ? '\n' + deltaNotes.join(' · ') : ''),
        label: `熔炼 +${preview.coins}G${preview.canTemper ? ' · 淬炼+1' : ''} · ${RARITY_NAMES[oldRelic.rarity]}`,
        accent: TAGS[oldRelic.tags[0]].color,
        icon: oldRelic.iconMatrix,
        select: () => replaceWith(oldRelic),
      };
    });
    this.show({
      style: 'reward-view replace-view',
      eyebrow,
      title: `换入「${incoming.name}」`,
      intro: `${RARITY_NAMES[incoming.rarity]} · ${inTags}${costNote} — ${incoming.description}`,
      details: this.tags(run),
      choices,
      actions: [fallback],
    });
  }

  routes(run: RunManager, select: (index: number) => void) {
    this.show({
      style: 'route-view', eyebrow: WORLD_NAMES[run.world] + ' / 节点 ' + (run.depth + 1) + ' · 4',
      title: run.depth >= 3 ? '守关挑战' : '选择下一站', details: this.tags(run),
      choices: run.routes.map((node, index) => ({
        title: node.name, detail: node.detail,
        label: ({ stage: '普通', elite: '精英', shop: '商店', event: '奇遇', boss: '首领' })[node.kind],
        accent: ({ stage: '#82dfc1', elite: '#f9a6ab', shop: '#ffdc7e', event: '#cea2f9', boss: '#ffae80' })[node.kind],
        select: () => select(index),
      })),
    });
  }

  shop(run: RunManager, buyRelic: (relic: Relic) => void, change: () => void, leave: () => void) {
    const shieldTitle = run.shield >= MAX_SHIELD
      ? `护盾已满 (${MAX_SHIELD}/${MAX_SHIELD})`
      : run.shopShieldBought
        ? '护盾 · 本店限购 1'
        : '护盾 · ' + run.shieldPrice();
    this.show({
      style: 'shop-view', eyebrow: WORLD_NAMES[run.world] + ' / ' + run.coins + ' 金币',
      title: '水管商店',
      details: this.tags(run),
      choices: run.stock.map(relic => this.relic(relic, run, () => buyRelic(relic), run.relicPrice(relic))),
      actions: [
        { title: '离开商店', select: leave },
        { title: '红心 · ' + run.price(24), disabled: run.coins < run.price(24) || run.hearts >= run.maxHearts, select: () => { if (run.spend(run.price(24))) run.hearts++; change(); } },
        { title: shieldTitle, disabled: !run.canBuyShield(), select: () => { if (run.buyShield()) change(); } },
        { title: '刷新 · ' + (run.freeRefresh ? '免费' : run.price(16)), disabled: !run.freeRefresh && run.coins < run.price(16), select: () => { run.refreshShop(); change(); } },
      ],
    });
  }

  event(run: RunManager, leave: () => void, take: () => void, result: string) {
    const event = {
      gambler: { title: '赌徒问号块', detail: '交出 1 颗红心，换取一件随机传说遗物与 35 金币。', action: '接受赌约', disabled: run.hearts < 2 },
      fountain: { title: '黄金喷泉', detail: '在 10 秒内拾取高价值泉涌金币（计入回血进度），结束时额外获得 1 星淬炼。', action: '开启喷泉', disabled: false },
      smith: { title: '炼金铁匠', detail: '支付 ' + run.price(28) + ' 金币，打造稀有遗物并附赠淬炼/护盾。', action: '支付铁匠', disabled: !run.canAcceptSmith() },
    }[run.event];
    this.show({
      style: 'event-view', eyebrow: '神秘问号房', title: event.title, intro: result || event.detail,
      actions: result ? [{ title: '继续', select: leave }] : [
        { title: event.action, select: take, disabled: event.disabled },
        { title: '离开', select: leave },
      ],
    });
  }

  fountain(active: number, seconds: number, total: number, take: (slot: number) => void, leave: () => void) {
    const details = this.line('div', 'fountain-clock', seconds + ' 秒 · ' + total + ' 金币');
    this.show({
      style: 'event-view fountain-view', title: '黄金喷泉', details,
      choices: Array.from({ length: 6 }, (_, slot) => ({
        title: active === slot ? '拾取' : '·', label: String(slot + 1), icon: active === slot ? COINS[0] : undefined,
        accent: active === slot ? '#ffd579' : '#515676', select: () => take(slot),
      })),
      actions: [{ title: '结束拾取', select: leave }],
    });
  }

  fountainClock(seconds: number, total: number) {
    const clock = this.root.querySelector('.fountain-clock');
    if (clock) clock.textContent = seconds + ' 秒 · ' + total + ' 金币';
  }

  title(meta: MetaProgression, start: () => void, characters: () => void, talents: () => void, heat: () => void) {
    const details = document.createElement('div');
    details.className = 'title-details';
    details.append(this.line('span', 'wallet', '✦ ' + meta.stars + ' 星币'));
    details.append(this.line('span', 'chosen', meta.selected.name));
    if (meta.heat) details.append(this.line('span', 'chosen', '热度 ' + meta.heat));
    if (meta.bestHeat > 0) details.append(this.line('span', 'chosen', '最高通关热度 ' + meta.bestHeat));
    this.show({
      style: 'title-view', title: '跃迁王国\n星辉闯关',
      intro: '跃过三座失落领地，夺回星辉核心。', details,
      actions: [{ title: '开始闯关', select: start }, { title: '角色选择', select: characters }, { title: '星辉天赋', select: talents },
        ...(meta.wins ? [{ title: '星辉热度', select: heat }] : [])],
    });
    const startButton = this.root.querySelector('.primary');
    if (startButton) startButton.append(this.line('kbd', 'enter-key', 'Enter'));
  }

  characters(meta: MetaProgression, select: (index: number) => void, back: () => void) {
    this.show({
      style: 'character-view', eyebrow: '✦ ' + meta.stars + ' 星币', title: '选择旅人',
      choices: CHARACTERS.map((char, i) => ({
        title: char.name, detail: char.equipment + '\n' + char.description, icon: HEROES[char.skin].idle,
        accent: ['#ffb67a', '#9ddbfa', '#e9b0fa'][i],
        label: meta.selected.id === char.id ? '已选中 · ' + char.role : meta.has(char) ? char.role : '解锁 · ' + char.stars + ' 星币',
        disabled: !meta.has(char) && meta.stars < char.stars, select: () => select(i),
      })),
      actions: [{ title: '返回大厅', select: back }],
    });
  }

  talents(meta: MetaProgression, upgrade: (talent: Talent) => void, back: () => void, reset: () => void) {
    const choices = (Object.keys(TALENTS) as Talent[]).map(key => {
      const level = meta.talents[key];
      const { name, cost, descriptions } = TALENTS[key];
      const price: number | undefined = cost[level];
      const detail = level === 0
        ? '下一级：' + descriptions[0]
        : price === undefined
          ? '当前生效：' + descriptions[descriptions.length - 1]
          : '当前：' + descriptions[level - 1] + '\n下一级：' + descriptions[level];
      return {
        title: name, detail, label: level + ' / ' + descriptions.length +
          (price === undefined ? ' · 已满级' : ' · ' + price + ' 星币'),
        accent: '#ffc984', disabled: price === undefined || meta.stars < price, select: () => upgrade(key),
      };
    });
    this.show({
      style: 'talent-view', eyebrow: '✦ ' + meta.stars + ' 星币', title: '星辉天赋树',
      choices, actions: [{ title: '返回大厅', select: back }, { title: '重置存档', select: reset }],
    });
  }

  heat(meta: MetaProgression, change: (value: number) => void, back: () => void) {
    this.show({
      style: 'talent-view', eyebrow: '挑战难度', title: '星辉热度',
      intro: '激活热度后敌人增速、生命提高，每级热度额外提高 35% 星币结算。',
      choices: Array.from({ length: 6 }, (_, value) => ({
        title: value === 0 ? '标准模式' : '热度 ' + value,
        label: value === meta.heat ? '已选中' : undefined, accent: value ? '#ff8f8d' : '#89e4cb',
        select: () => change(value),
      })),
      actions: [{ title: '返回大厅', select: back }],
    });
  }

  settle(stats: RunSummary, saved: boolean, back: () => void, again: () => void) {
    const details = document.createElement('section');
    details.className = 'stats-grid';
    const rows = [['通过关卡', stats.stages], ['击败首领', stats.bosses], ['击败敌人', stats.kills], ['最高连踩', stats.bestCombo], ['收集金币', stats.collected]] as const;
    for (const [name, value] of rows) {
      const stat = document.createElement('div');
      stat.append(this.line('strong', '', String(value)), this.line('span', '', name));
      details.append(stat);
    }
    this.show({
      style: 'settlement-view', eyebrow: stats.won ? '星辉核心已夺回' : '本局结算',
      title: stats.won ? '王国重现星辉' : '跃迁结束',
      intro: '✦ +' + stats.stars + ' 星币' + (stats.won ? ' · 已解锁星辉热度' : '') + (saved ? '' : ' · 浏览器存储不可用'),
      details, actions: [{ title: '返回大厅', select: back }, { title: '再开一局', select: again }],
    });
  }

  pause(run: RunManager, resume: () => void, settle: () => void, trialNote?: string) {
    const details = document.createElement('div');
    if (trialNote) details.append(this.line('p', 'panel-intro', trialNote));
    details.append(this.tags(run));
    if (run.relics.length) {
      const inventory = document.createElement('ul');
      inventory.className = 'inventory';
      for (const relic of run.relics) inventory.append(this.line('li', '', relic.name + '　' + relic.description));
      details.append(inventory);
    } else details.append(this.line('p', 'panel-intro', '背包里还没有遗物。'));
    this.show({
      style: 'pause-view', eyebrow: WORLD_NAMES[run.world], title: '构筑与暂停', details,
      actions: [{ title: '继续闯关', select: resume }, { title: '结束并结算', select: settle }],
    });
  }
}
