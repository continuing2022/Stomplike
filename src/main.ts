import './styles.css';
import { ChiptuneAudio } from './audio/ChiptuneAudio';
import { GameEngine } from './engine/GameEngine';
import { InputManager } from './engine/InputManager';
import { PixelRenderer } from './graphics/PixelRenderer';
import { BRICK, COINS, CRYSTAL, GROUND, HEROES, QUESTION, SOIL, STAR } from './graphics/SpriteData';
import { drawShop, drawTitle } from './graphics/TitleScene';
import { ARSENAL_DURATION, POD_PRELOAD_SPRITES } from './entities/SupplyPod';
import { generateArena, generateLevel, TRIAL_META, WORLD_NAMES } from './level/LevelGenerator';
import { Stage } from './level/Stage';
import { CHARACTERS } from './roguelike/Characters';
import { MetaProgression } from './roguelike/MetaProgression';
import { MAX_SHIELD } from './roguelike/Relics';
import { NORMAL, RunManager, type Node } from './roguelike/RunManager';
import { drawHUD } from './ui/HUD';
import { Overlays } from './ui/Overlays';

type Screen = 'title' | 'starter' | 'characters' | 'talents' | 'heat' | 'confirm' | 'play' | 'pause' | 'routes' | 'shop' | 'event' | 'fountain' | 'rewards' | 'replace' | 'settlement';

class Game {
  private readonly ctx = document.querySelector<HTMLCanvasElement>('#game')!.getContext('2d')!;
  private readonly hud = document.querySelector<HTMLElement>('#hud')!;
  private readonly sound = document.querySelector<HTMLButtonElement>('#sound')!;
  readonly input = new InputManager();
  readonly renderer = new PixelRenderer();
  readonly audio = new ChiptuneAudio();
  readonly menus = new Overlays(document.querySelector<HTMLElement>('#overlay')!, this.renderer);
  readonly engine = new GameEngine(dt => this.update(dt), dt => this.draw(dt));
  readonly meta = new MetaProgression();
  run = new RunManager(Date.now(), this.meta.runOptions());
  stage?: Stage;
  private screen: Screen = 'title';
  private titleTime = 0;
  private fountain = { remaining: 0, total: 0, slot: 0 };
  private cancelReplace?: () => void;
  private readonly touch = document.querySelector<HTMLElement>('#touch')!;

  constructor() {
    this.ctx.imageSmoothingEnabled = false;
    this.renderer.preload([
      ...COINS, ...QUESTION, ...GROUND, ...SOIL, ...BRICK, CRYSTAL, STAR,
      ...HEROES.flatMap(hero => Object.values(hero)),
      ...POD_PRELOAD_SPRITES,
    ]);
    if (this.meta.muted) this.audio.toggle();
    this.updateSound();
    this.sound.onclick = () => this.toggleSound();
    this.installTouch();
    window.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', event => this.input.set(event.code, false));
    window.addEventListener('blur', () => this.input.clear());
    document.addEventListener('visibilitychange', () => {
      this.audio.pause(document.hidden || this.screen === 'pause');
      if (document.hidden && this.screen === 'play') this.pause();
    });
    this.title();
    this.engine.start();
  }

  private keydown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    this.audio.unlock();
    if (event.code === 'KeyM' && !event.repeat) { this.toggleSound(); return; }
    if (event.target === this.sound && (event.code === 'Enter' || (event.code === 'Space' && this.screen !== 'play'))) return;
    if (event.code === 'Escape' && !event.repeat && this.screen === 'replace' && this.cancelReplace) {
      event.preventDefault();
      this.cancelReplace();
      return;
    }
    if (event.code === 'Escape' && !event.repeat && ['starter', 'characters', 'talents', 'heat', 'confirm'].includes(this.screen)) {
      event.preventDefault();
      if (this.screen === 'confirm') this.talents();
      else this.title();
      return;
    }
    if (['Escape', 'Tab', 'KeyP'].includes(event.code) && !event.repeat) {
      if (this.screen === 'play' || this.screen === 'pause') {
        event.preventDefault();
        if (this.screen === 'play') this.pause();
        else this.resume();
        return;
      }
    }
    if (this.screen === 'fountain' && /^Digit[1-6]$/.test(event.code)) {
      if (!event.repeat) this.fountainTake(Number(event.code.slice(-1)) - 1);
      return;
    }
    if (this.menus.visible) {
      if (!event.repeat && this.menus.key(event.code)) event.preventDefault();
      return;
    }
    if (InputManager.handles(event.code)) {
      event.preventDefault();
      this.input.set(event.code, true);
    }
  };

  private toggleSound() {
    this.audio.toggle();
    this.meta.setMuted(this.audio.muted);
    this.updateSound();
  }

  private updateSound() {
    this.sound.setAttribute('aria-pressed', String(this.audio.muted));
    this.sound.querySelector('#sound-label')!.textContent = this.audio.muted ? '已静音' : '音效开启';
  }

  private installTouch() {
    const keys = [['◀', 'ArrowLeft', '向左'], ['▶', 'ArrowRight', '向右'], ['▼', 'ArrowDown', '下蹲或下砸'],
      ['疾跑', 'ShiftLeft', '疾跑'], ['跳', 'Space', '跳跃'], ['技能', 'KeyJ', '技能']];
    for (const [label, code, description] of keys) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', description);
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (this.screen !== 'play') return;
        button.setPointerCapture(event.pointerId);
        button.classList.add('held');
        this.input.set(code, true);
      });
      const release = () => { button.classList.remove('held'); this.input.set(code, false); };
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      this.touch.append(button);
    }
    const pause = document.createElement('button');
    pause.type = 'button';
    pause.textContent = '暂停';
    pause.onclick = () => { if (this.screen === 'play') this.pause(); };
    this.touch.append(pause);
  }

  private title() {
    this.screen = 'title';
    this.audio.pause(document.hidden);
    this.audio.setTrack('lobby');
    this.input.clear();
    this.menus.title(this.meta, () => this.start(), () => this.characters(), () => this.talents(), () => this.heat());
  }

  private start() {
    this.run = new RunManager(Date.now(), this.meta.runOptions());
    this.screen = 'starter';
    this.audio.setTrack('lobby');
    this.menus.starter(this.run, relic => {
      this.run.add(relic);
      this.play(NORMAL);
    }, () => this.title());
  }

  private characters() {
    this.screen = 'characters';
    this.menus.characters(this.meta, index => {
      if (this.meta.choose(CHARACTERS[index])) this.audio.play('uiSelect');
      this.characters();
    }, () => this.title());
  }

  private talents() {
    this.screen = 'talents';
    this.menus.talents(this.meta, talent => {
      if (this.meta.upgrade(talent)) this.audio.play('powerup');
      this.talents();
    }, () => this.title(), () => this.confirmReset());
  }

  private confirmReset() {
    this.screen = 'confirm';
    this.menus.show({
      title: '重置星辉存档',
      intro: '角色、星币、天赋与通关记录将恢复初始状态。',
      actions: [
        { title: '取消', select: () => this.talents() },
        { title: '确认重置', select: () => {
          this.meta.reset();
          if (this.meta.muted !== this.audio.muted) this.audio.toggle();
          this.updateSound();
          this.title();
        } },
      ],
    });
  }

  private heat() {
    this.screen = 'heat';
    this.menus.heat(this.meta, value => { this.meta.setHeat(value); this.heat(); }, () => this.title());
  }

  private newStage() {
    const { run } = this;
    const seed = run.nextSeed();
    const level = run.current.kind === 'boss'
      ? generateArena(seed, run.world)
      : generateLevel(seed, run.world, run.depth + 1, run.current.modifier, run.current.trial);
    return new Stage(level, this.input, { audio: this.audio, freeze: seconds => this.engine.freeze(seconds) }, run);
  }

  private play(node: Node) {
    this.audio.pause(document.hidden);
    this.audio.play('uiSelect');
    this.run.enter(node);
    if (node.kind === 'shop') { this.shop(); return; }
    if (node.kind === 'event') { this.event(); return; }
    this.input.clear();
    this.stage = this.newStage();
    this.screen = 'play';
    this.audio.setTrack(node.kind === 'boss' ? 'boss' : (['valley', 'mine', 'sky'] as const)[this.run.world]);
    this.menus.close();
  }

  private pause() {
    this.screen = 'pause';
    this.input.clear();
    this.audio.pause(true);
    const s = this.stage;
    const trialNote = s && !s.boss
      ? `${this.run.current.kind === 'elite' ? '精英试炼' : '本关挑战'}：${TRIAL_META[s.trial].routeDesc}（${s.trialDone ? '已达成' : `${s.trialProgress}/${s.trialTarget}`}）`
      : undefined;
    this.menus.pause(this.run, () => this.resume(), () => this.settle(false, true), trialNote);
  }

  private resume() {
    this.screen = 'play';
    this.audio.pause(document.hidden);
    this.input.clear();
    this.menus.close();
  }

  private routes() {
    this.screen = 'routes';
    this.audio.setTrack('lobby');
    this.menus.routes(this.run, index => this.play(this.run.routes[index]));
  }

  private advance() { this.run.finishNode(); this.routes(); }

  private shop() {
    this.screen = 'shop';
    this.cancelReplace = undefined;
    this.menus.shop(
      this.run,
      relic => {
        const cost = this.run.relicPrice(relic);
        if (this.run.coins < cost) return;
        if (!this.run.isFull) {
          if (this.run.buy(relic)) this.audio.play('uiSelect');
          this.shop();
          return;
        }
        this.screen = 'replace';
        this.cancelReplace = () => this.shop();
        this.menus.replaceRelic(
          this.run,
          relic,
          WORLD_NAMES[this.run.world] + ' / 水管商店 · 背包已满',
          oldRelic => {
            if (this.run.buyWithReplace(oldRelic, relic)) this.audio.play('powerup');
            this.shop();
          },
          { title: '取消购买', select: () => this.shop() },
          cost,
        );
      },
      () => { this.audio.play('uiSelect'); this.shop(); },
      () => this.advance(),
    );
  }

  private event(result = '') {
    this.screen = 'event';
    this.cancelReplace = undefined;
    this.menus.event(this.run, () => this.advance(), () => {
      if (this.run.event === 'fountain') {
        this.screen = 'fountain';
        this.fountain = { remaining: 10, total: 0, slot: Math.floor(this.run.random() * 6) };
        this.showFountain();
        return;
      }
      const message = this.run.resolveEvent();
      const pending = this.run.pendingEventRelic;
      if (pending) {
        const preview = this.run.smeltPreview(pending.rarity);
        this.screen = 'replace';
        this.cancelReplace = undefined;
        this.menus.replaceRelic(
          this.run,
          pending,
          '神秘问号房 / 背包已满 · 替换熔炼',
          oldRelic => {
            const smelt = this.run.replace(oldRelic, pending);
            this.run.pendingEventRelic = undefined;
            this.audio.play('powerup');
            const extra = smelt ? `（熔炼「${oldRelic.name}」+${smelt.coins}G${smelt.tempered ? ' · 淬炼+1' : ''}）` : '';
            this.event(`换入「${pending.name}」${extra}。`);
          },
          {
            title: `直接熔炼「${pending.name}」(+${preview.coins}G${preview.canTemper ? ' · 淬炼+1' : ''})`,
            select: () => {
              const smelt = this.run.smelt(pending.rarity);
              this.run.pendingEventRelic = undefined;
              this.audio.play('coin');
              this.event(`已熔炼「${pending.name}」，获得 ${smelt.coins} 金币${smelt.tempered ? '与 1 星淬炼' : ''}。`);
            },
          },
        );
        return;
      }
      this.event(message || '问号块安静了下来。');
    }, result);
  }

  private showFountain() {
    const { slot, remaining, total } = this.fountain;
    this.menus.fountain(slot, Math.ceil(remaining), total, choice => this.fountainTake(choice), () => this.finishFountain());
  }

  private fountainTake(slot: number) {
    if (this.screen !== 'fountain' || this.fountain.slot !== slot) return;
    const value = 3;
    this.fountain.total += value;
    this.run.coins += value;
    this.run.collected += value;
    this.fountain.slot = (slot + 1 + Math.floor(this.run.random() * 5)) % 6;
    this.audio.play('coin');
    this.showFountain();
  }

  private finishFountain() {
    this.event('你从喷泉中拾起了 ' + this.fountain.total + ' 金币。');
  }

  private rewards() {
    this.audio.setTrack('quiet');
    if (this.run.pendingElite && this.run.pendingEliteOverflow) {
      const eliteRelic = this.run.pendingElite;
      const preview = this.run.smeltPreview(eliteRelic.rarity);
      this.screen = 'replace';
      this.cancelReplace = undefined;
      this.menus.replaceRelic(
        this.run,
        eliteRelic,
        WORLD_NAMES[this.run.world] + ' / ⚔ 精英试炼遗物 · 背包已满',
        oldRelic => {
          this.run.replace(oldRelic, eliteRelic);
          this.run.pendingEliteOverflow = false;
          this.audio.play('powerup');
          this.rewards();
        },
        {
          title: `直接熔炼「${eliteRelic.name}」(+${preview.coins}G${preview.canTemper ? ' · 淬炼+1' : ''})`,
          select: () => {
            this.run.smelt(eliteRelic.rarity);
            this.run.pendingElite = undefined;
            this.run.pendingEliteOverflow = false;
            this.audio.play('coin');
            this.rewards();
          },
        },
      );
      return;
    }
    this.screen = 'rewards';
    this.cancelReplace = undefined;
    this.menus.rewards(
      this.run,
      relic => {
        if (!relic) {
          this.audio.play('uiSelect');
          this.advance();
          return;
        }
        if (!this.run.isFull) {
          this.run.add(relic);
          this.audio.play('uiSelect');
          this.advance();
          return;
        }
        this.screen = 'replace';
        this.cancelReplace = () => this.rewards();
        this.menus.replaceRelic(
          this.run,
          relic,
          WORLD_NAMES[this.run.world] + ' / 背包已满 · 选择替换熔炼的旧遗物',
          oldRelic => {
            this.run.replace(oldRelic, relic);
            this.cancelReplace = undefined;
            this.audio.play('powerup');
            this.advance();
          },
          { title: '返回重选', select: () => this.rewards() },
        );
      },
      () => {
        this.run.reroll();
        this.audio.play('uiSelect');
        this.rewards();
      },
      () => {
        this.run.salvageReward();
        this.audio.play('coin');
        this.advance();
      },
    );
  }

  private sync(cleared: boolean) {
    const stage = this.stage;
    if (!stage) return;
    this.run.hearts = stage.player.hearts;
    this.run.shield = Math.min(MAX_SHIELD, stage.player.shield);
    this.run.coins = stage.balance;
    this.run.record(stage.result, cleared);
  }

  private settle(won: boolean, record = false) {
    if (record) this.sync(false);
    this.screen = 'settlement';
    this.audio.pause(document.hidden);
    this.audio.setTrack('quiet');
    if (won) this.audio.play('victory');
    const stats = this.run.summarize(won);
    this.meta.record(stats, this.run.heat);
    this.menus.settle(stats, this.meta.saving, () => this.title(), () => this.start());
  }

  private update(dt: number) {
    if (document.hidden) return;
    if (this.screen === 'fountain') {
      const previous = Math.ceil(this.fountain.remaining);
      this.fountain.remaining -= dt;
      if (this.fountain.remaining <= 0) this.finishFountain();
      else if (Math.ceil(this.fountain.remaining) !== previous) this.menus.fountainClock(Math.ceil(this.fountain.remaining), this.fountain.total);
      return;
    }
    if (this.screen !== 'play') return;
    const stage = this.stage;
    if (!stage) return;
    stage.tick(dt);
    this.input.tick(dt);
    if (stage.player.hearts <= 0) { this.settle(false, true); return; }
    if (!stage.finished) return;
    this.sync(true);
    if (this.run.current.kind === 'boss') {
      if (this.run.nextWorld()) this.routes();
      else this.settle(true);
    } else this.rewards();
  }

  private draw(dt: number) {
    this.touch.hidden = this.screen !== 'play';
    const lobby = ['title', 'starter', 'characters', 'talents', 'heat', 'confirm'].includes(this.screen);
    const stage = this.stage;
    this.hud.hidden = lobby;
    if (lobby || !stage) {
      this.titleTime += dt;
      drawTitle(this.ctx, this.renderer, this.titleTime, this.meta.selected.skin);
      return;
    }
    if (this.screen === 'shop' || (this.screen === 'replace' && this.run.current.kind === 'shop')) {
      drawShop(this.ctx, this.renderer, this.titleTime += dt);
    } else stage.draw(this.ctx, this.renderer);
    const p = stage.player;
    const inStage = this.screen === 'play' || this.screen === 'pause';
    drawHUD(this.hud, {
      hearts: inStage ? p.hearts : this.run.hearts, maxHearts: this.run.maxHearts,
      shield: inStage ? p.shield : this.run.shield, coins: inStage ? stage.balance : this.run.coins,
      fps: Math.round(this.engine.fps), boss: this.screen === 'play' ? stage.boss : undefined,
      world: this.run.world, depth: this.run.depth, modifier: this.run.current.modifier, heat: this.run.heat,
      combo: inStage ? p.combo : 0, powered: inStage && p.powered,
      progress: inStage && !stage.boss ? p.center / stage.level.flag.x : undefined,
      trial: inStage && !stage.boss ? {
        kind: stage.trial,
        progress: stage.trialProgress,
        target: stage.trialTarget,
        done: stage.trialDone,
        elite: this.run.current.kind === 'elite',
      } : undefined,
      arsenal: inStage ? p.arsenal : undefined,
      arsenalLevel: inStage ? p.arsenalLevel : 1,
      arsenalTime: inStage ? p.arsenalTime : 0,
      arsenalMax: inStage ? p.arsenalMax : ARSENAL_DURATION,
      rapidTime: inStage ? p.rapidTime : 0,
      starTime: inStage ? p.star : 0,
    });
  }
}

new Game();
