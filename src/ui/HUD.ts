import type { Boss } from '../entities/Boss';
import { MODIFIERS, WORLD_NAMES, type Modifier, type World } from '../level/LevelGenerator';

interface Status {
  hearts: number; maxHearts: number; shield: number; coins: number; fps: number; boss?: Boss;
  world: World; depth: number; modifier: Modifier; heat: number; combo: number; powered: boolean; progress?: number;
}

export function drawHUD(element: HTMLElement, status: Status) {
  const { hearts, maxHearts, shield, coins, fps, boss, world, depth, modifier, heat, combo, powered, progress } = status;
  const percent = progress === undefined ? -1 : Math.min(100, Math.floor(progress * 100));
  const signature = [hearts, maxHearts, shield, coins, fps, boss?.name, boss?.hp, boss?.hint, world, depth, modifier, heat, combo, powered, percent].join('/');
  if (element.dataset.state === signature) return;
  element.dataset.state = signature;
  const mark = modifier === 'normal' ? '' : ' · ' + MODIFIERS[modifier];
  element.innerHTML = `<div class="health" aria-label="${hearts} / ${maxHearts} 心，${shield} 护盾">${'<i class="heart"></i>'.repeat(Math.max(0, hearts))}${'<i class="heart empty"></i>'.repeat(Math.max(0, maxHearts - hearts))}${'<i class="shield"></i>'.repeat(shield)}${powered ? '<i class="power" title="红晶强化"></i>' : ''}</div>
    <div class="money" aria-label="金币"><i aria-hidden="true"></i>${coins.toString().padStart(2, '0')}</div>
    ${combo > 1 ? `<div class="combo" aria-label="连踩">×${combo}</div>` : ''}
    <div class="world-indicator"><span>${world + 1}–${Math.min(4, depth + 1)}　${WORLD_NAMES[world]}${heat ? ' · 热度 ' + heat : ''}${mark}</span>${percent >= 0 ? `<div class="progress"><i style="width:${percent}%"></i></div>` : ''}</div>
    <div class="fps">${fps} FPS</div>
    ${boss ? `<section class="boss-meter" aria-label="首领生命"><div><strong>${boss.name}</strong><span>阶段 ${boss.phase}</span></div><div class="boss-bar"><i style="width:${Math.max(0, boss.hp / boss.maxHp * 100)}%"></i></div><small>${boss.hint}</small></section>` : ''}`;
}
