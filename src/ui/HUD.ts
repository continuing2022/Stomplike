import type { Boss } from '../entities/Boss';
import { EMBLEM_META, type ArsenalKind } from '../entities/SupplyPod';
import { MODIFIERS, WORLD_NAMES, type Modifier, type World } from '../level/LevelGenerator';

export interface Status {
  hearts: number;
  maxHearts: number;
  shield: number;
  coins: number;
  fps: number;
  boss?: Boss;
  world: World;
  depth: number;
  modifier: Modifier;
  heat: number;
  combo: number;
  powered: boolean;
  progress?: number;
  arsenal?: ArsenalKind;
  arsenalLevel?: 1 | 2;
  arsenalTime?: number;
  arsenalMax?: number;
  rapidTime?: number;
  starTime?: number;
}

interface HudDom {
  health: HTMLElement;
  healthSig: string;
  moneyVal: Text;
  coinsSig: number;
  combo: HTMLElement;
  arsenal: HTMLElement;
  arsenalLetter: HTMLElement;
  arsenalLabel: HTMLElement;
  arsenalFill: HTMLElement;
  rapid: HTMLElement;
  star: HTMLElement;
  worldText: HTMLElement;
  worldSig: string;
  progressWrap: HTMLElement;
  progressFill: HTMLElement;
  fps: HTMLElement;
  fpsSig: number;
  boss: HTMLElement;
  bossName: HTMLElement;
  bossPhase: HTMLElement;
  bossFill: HTMLElement;
  bossHint: HTMLElement;
}

const cache = new WeakMap<HTMLElement, HudDom>();

function mount(root: HTMLElement): HudDom {
  root.innerHTML = `
    <div class="health"></div>
    <div class="money" aria-label="金币"><i aria-hidden="true"></i><span>00</span></div>
    <div class="combo" aria-label="连踩" hidden></div>
    <div class="arsenal-badge" hidden>
      <div class="arsenal-row"><b class="arsenal-key"></b><span class="arsenal-text"></span></div>
      <div class="arsenal-bar"><i></i></div>
    </div>
    <div class="buff-pill rapid-pill" hidden></div>
    <div class="buff-pill star-pill" hidden></div>
    <div class="world-indicator"><span></span><div class="progress" hidden><i></i></div></div>
    <div class="fps">60 FPS</div>
    <section class="boss-meter" aria-label="首领生命" hidden>
      <div><strong></strong><span></span></div>
      <div class="boss-bar"><i></i></div>
      <small></small>
    </section>
  `;
  const moneySpan = root.querySelector('.money span')!;
  const moneyVal = moneySpan.firstChild as Text;
  const dom: HudDom = {
    health: root.querySelector('.health')!,
    healthSig: '',
    moneyVal,
    coinsSig: -1,
    combo: root.querySelector('.combo')!,
    arsenal: root.querySelector('.arsenal-badge')!,
    arsenalLetter: root.querySelector('.arsenal-key')!,
    arsenalLabel: root.querySelector('.arsenal-text')!,
    arsenalFill: root.querySelector('.arsenal-bar i')!,
    rapid: root.querySelector('.rapid-pill')!,
    star: root.querySelector('.star-pill')!,
    worldText: root.querySelector('.world-indicator > span')!,
    worldSig: '',
    progressWrap: root.querySelector('.progress')!,
    progressFill: root.querySelector('.progress i')!,
    fps: root.querySelector('.fps')!,
    fpsSig: -1,
    boss: root.querySelector('.boss-meter')!,
    bossName: root.querySelector('.boss-meter strong')!,
    bossPhase: root.querySelector('.boss-meter span')!,
    bossFill: root.querySelector('.boss-bar i')!,
    bossHint: root.querySelector('.boss-meter small')!,
  };
  cache.set(root, dom);
  return dom;
}

export function drawHUD(element: HTMLElement, status: Status) {
  const dom = cache.get(element) ?? mount(element);
  const {
    hearts, maxHearts, shield, coins, fps, boss, world, depth, modifier, heat,
    combo, powered, progress, arsenal, arsenalLevel = 1, arsenalTime = 0, arsenalMax = 20,
    rapidTime = 0, starTime = 0,
  } = status;

  const healthSig = `${hearts}/${maxHearts}/${shield}/${powered ? 1 : 0}`;
  if (dom.healthSig !== healthSig) {
    dom.healthSig = healthSig;
    dom.health.setAttribute('aria-label', `${hearts} / ${maxHearts} 心，${shield} 护盾`);
    dom.health.innerHTML =
      '<i class="heart"></i>'.repeat(Math.max(0, hearts)) +
      '<i class="heart empty"></i>'.repeat(Math.max(0, maxHearts - hearts)) +
      '<i class="shield"></i>'.repeat(Math.max(0, shield)) +
      (powered ? '<i class="power" title="红晶强化"></i>' : '');
  }

  if (dom.coinsSig !== coins) {
    dom.coinsSig = coins;
    dom.moneyVal.data = coins.toString().padStart(2, '0');
  }

  if (combo > 1) {
    dom.combo.hidden = false;
    const text = '×' + combo;
    if (dom.combo.textContent !== text) dom.combo.textContent = text;
  } else {
    dom.combo.hidden = true;
  }

  if (arsenal && arsenalTime > 0) {
    const meta = EMBLEM_META[arsenal];
    dom.arsenal.hidden = false;
    dom.arsenal.style.setProperty('--badge-color', meta.color);
    if (dom.arsenalLetter.textContent !== arsenal) dom.arsenalLetter.textContent = arsenal;
    const label = `${arsenalLevel === 2 ? 'MAX' : meta.name} ${Math.ceil(arsenalTime)}s`;
    if (dom.arsenalLabel.textContent !== label) dom.arsenalLabel.textContent = label;
    const pct = Math.max(0, Math.min(100, (arsenalTime / Math.max(1, arsenalMax)) * 100));
    dom.arsenalFill.style.width = pct.toFixed(1) + '%';
  } else {
    dom.arsenal.hidden = true;
  }

  if (rapidTime > 0) {
    dom.rapid.hidden = false;
    const text = `R 超载 ${Math.ceil(rapidTime)}s`;
    if (dom.rapid.textContent !== text) dom.rapid.textContent = text;
  } else {
    dom.rapid.hidden = true;
  }

  if (starTime > 0) {
    dom.star.hidden = false;
    const text = `★ 霸体 ${Math.ceil(starTime)}s`;
    if (dom.star.textContent !== text) dom.star.textContent = text;
  } else {
    dom.star.hidden = true;
  }

  const mark = modifier === 'normal' ? '' : ' · ' + MODIFIERS[modifier];
  const worldSig = `${world + 1}–${Math.min(4, depth + 1)}　${WORLD_NAMES[world]}${heat ? ' · 热度 ' + heat : ''}${mark}`;
  if (dom.worldSig !== worldSig) {
    dom.worldSig = worldSig;
    dom.worldText.textContent = worldSig;
  }

  if (progress === undefined) {
    dom.progressWrap.hidden = true;
  } else {
    dom.progressWrap.hidden = false;
    const percent = Math.max(0, Math.min(100, Math.floor(progress * 100)));
    dom.progressFill.style.width = percent + '%';
  }

  if (dom.fpsSig !== fps) {
    dom.fpsSig = fps;
    dom.fps.textContent = fps + ' FPS';
  }

  if (boss) {
    dom.boss.hidden = false;
    if (dom.bossName.textContent !== boss.name) dom.bossName.textContent = boss.name;
    const phaseText = '阶段 ' + boss.phase;
    if (dom.bossPhase.textContent !== phaseText) dom.bossPhase.textContent = phaseText;
    dom.bossFill.style.width = Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1) + '%';
    if (dom.bossHint.textContent !== boss.hint) dom.bossHint.textContent = boss.hint;
  } else {
    dom.boss.hidden = true;
  }
}
