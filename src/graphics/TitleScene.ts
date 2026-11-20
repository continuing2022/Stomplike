import { HEIGHT, TILE, WIDTH } from '../engine/GameEngine';
import { rng } from '../engine/Physics';
import { drawBackground } from './Background';
import type { PixelRenderer } from './PixelRenderer';
import { BRICK, CASTLE, CLOUD_TILE, GROUND, HEROES, PIPE, SOIL, pixels, STAR } from './SpriteData';

const random = rng(431);
const lights = Array.from({ length: 27 }, () => ({ x: 476 + random() * 465, y: 78 + random() * 399, phase: random() * 9, size: random() * 9 + 3 }));
const base = pixels(
  '................................ hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh ccccggccccccccggccccccccgccccccc .ccggcccccgcccccccccgcccccgcccc. ..cccccgcccccccccccccccccccccc.. ....cccccccggcccccccccccccc..... .....ccccccccccccccccccccc...... .......ccccccccccccccccc........ .......cccccccccccccccc......... .........cccccccccccc........... ..........cccccccccc............ ............cccccc..............',
  { h: '#ffcf9a', c: '#503e66', g: '#71597a' });
const flora = pixels(
  '.............. .......wg..... ..g...wgg..... .wgg..wg...gg. .wgg..wg..ggg. ..g...wg..gg.. ...g..gg.g.... ....ggggg..... ......gg......',
  { w: '#a0f5d3', g: '#4daeae' });

function island(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, x: number, y: number, tiles: number) {
  renderer.draw(ctx, base, x, y + 20, tiles * TILE, 74 + tiles * 4);
  for (let i = 0; i < tiles; i++) renderer.draw(ctx, BRICK[2], x + i * TILE, y, TILE, TILE);
  renderer.draw(ctx, flora, x + 7, y - 18, 30, 19);
  renderer.draw(ctx, flora, x + tiles * TILE - 37, y - 20, 34, 22, true);
}

export function drawTitle(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number, skin: number) {
  drawBackground(ctx, renderer, 2, 198, time * 0.65);
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, '#1a19346b');
  grad.addColorStop(0.65, '#2b224531');
  grad.addColorStop(1, '#291e4932');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  renderer.draw(ctx, CASTLE, 563, 122, 336, 237);
  island(ctx, renderer, 590, 360, 9);
  island(ctx, renderer, 527, 410, 3);
  island(ctx, renderer, 795, 438, 4);
  island(ctx, renderer, 905, 297, 4);
  for (const [x, y] of [[485, 464], [902, 389], [730, 479], [537, 349]]) renderer.draw(ctx, CLOUD_TILE, x, y, 24, 11);
  renderer.draw(ctx, HEROES[skin].idle, 665, 297, 67, 67);
  for (const light of lights) {
    ctx.globalAlpha = 0.28 + (Math.sin(time * 2.3 + light.phase) + 1) * 0.29;
    renderer.draw(ctx, STAR, light.x, light.y + Math.sin(time + light.phase) * 5, light.size, light.size);
  }
  ctx.globalAlpha = 1;
  const sourceY = 216 + Math.sin(time * 2.4) * 6;
  ctx.shadowColor = '#ffd88b';
  ctx.shadowBlur = 18;
  renderer.draw(ctx, STAR, 732, sourceY, 32, 32);
  ctx.shadowBlur = 0;
}

export function drawShop(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, time: number) {
  drawBackground(ctx, renderer, 1, 55, time);
  for (let x = 0; x < WIDTH; x += TILE) {
    renderer.draw(ctx, GROUND[1], x, 416, TILE, TILE);
    for (let y = 448; y < HEIGHT; y += TILE) renderer.draw(ctx, SOIL[1], x, y, TILE, TILE);
  }
  for (const x of [64, WIDTH - 128]) {
    renderer.draw(ctx, PIPE, x, 310, 64, 32);
    for (let y = 342; y < 416; y += 25) renderer.draw(ctx, PIPE, x + 4, y, 56, 25);
  }
  renderer.draw(ctx, HEROES[2].idle, 790, 367, 50, 50, true);
}
