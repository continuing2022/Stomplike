import { HEIGHT, WIDTH } from '../engine/GameEngine';
import { rng } from '../engine/Physics';
import { PixelRenderer, type Sprite } from './PixelRenderer';
import { pixels, STAR } from './SpriteData';

const clouds = [
  pixels('.................. .....wwww......... ...wwwwwwww....... ..wwwwwwwwww..ww.. .wwwwwwwwwwwwwww.. wwwwwwwwwwwwwwwwww .wwwwwwsswwwwwwww. ...sssssssssssss..', { w: '#e8fff2', s: '#b5e2e1' }),
  pixels('................ ...wwww......... ..wwwwww...ww... .wwwwwwwww.wwww. wwwwwwwwwwwwwwww .sssssssssssss..', { w: '#ffd9de', s: '#cfa7da' }),
];

function ridge(seed: number, palette: Record<string, string>, rough: number): Sprite {
  const random = rng(seed);
  const heights = Array.from({ length: 192 }, (_, x) => Math.round(17 + Math.sin(x * Math.PI * 2 / 64 + seed) * 8 + Math.sin(x * Math.PI * 2 / 32) * 4 + random() * rough));
  return {
    matrix: Array.from({ length: 54 }, (_, y) => heights.map((top, x) => y < top ? '.' : y < top + 3 ? 'h' : (x * 7 + y * 11) % 49 < 3 ? 's' : 'b').join('')),
    palette,
  };
}

const layers = [
  [
    ridge(2, { h: '#8bd0bd', b: '#75b9ae', s: '#95cabb' }, 1),
    ridge(6, { h: '#64ab9d', b: '#4a948b', s: '#5b9a8d' }, 2),
    ridge(9, { h: '#3f807b', b: '#326c70', s: '#4c8d81' }, 2),
  ],
  [
    ridge(3, { h: '#404880', b: '#2a345d', s: '#495d8a' }, 7),
    ridge(7, { h: '#384574', b: '#242945', s: '#516291' }, 8),
    ridge(4, { h: '#2c385f', b: '#1d2440', s: '#3e4a70' }, 7),
  ],
  [
    ridge(5, { h: '#ad7f9c', b: '#80688d', s: '#c698aa' }, 2),
    ridge(11, { h: '#81618a', b: '#634d79', s: '#926b95' }, 2),
    ridge(3, { h: '#684d77', b: '#493d66', s: '#765687' }, 2),
  ],
];

const valleyCap = pixels(
  '...........ddddd......... .......ddddgggggddd...... .....ddgwwgggggggggdd.... ...ddggggggggggwwggggdd.. ..dgggggggggggggwwwggggd. .dggwwggggggggggggggggggd dgggwwggggggggggggggggggd dgggggggggggggggggggggggd .ddddddggggggggggddddddd. .......dddssdddddd....... ..........shhhs.......... ..........shhhs.......... .........sshhhs.......... .........shhhhs.......... .........shhhhs.......... ........sshhhhs.......... ........shhhhhs.......... .......sshhhhss..........',
  { d: '#307d83', g: '#60a99b', w: '#87c7a4', s: '#3d878b', h: '#589fa0' });
const mineCrystal = pixels(
  '.......w....... ......www...... .....wgggw..... .....ggggw..w.. ..w..ghggw.www. .www.ghggw.ggw. .ggw.ghggw.ggw. .ggw.ghggw.ggw. .gghwghggw.ggw. .ghggghggwgggw. .ghggghggwgggd. .gdggghggwggd.. ..ddddddddddd..',
  { w: '#6eb8de', g: '#435f9f', h: '#5f9dcc', d: '#354576' });
const moon = pixels(
  '.....wwwww..... ...wwwwwwwww... ..wwsswwwwwww.. .wwssswwwwwwww. .wwwwwwwwswwww. wwwwwwwwssswwww wwwwwwwwwsswwww wwwswwwwwwwwwww wwwssswwwwwwwww .wwswwwwwwwwww. .wwwwwwswwwwww. ..wwwwswwwwww.. ...wwwwwwwww... .....wwwww.....',
  { w: '#ffe3ac', s: '#f4bd9b' });
const structures = [valleyCap, mineCrystal, moon];
const skyColors = [
  ['#366f91', '#639fab', '#b7d6a9'], ['#131b37', '#233957', '#497287'], ['#241e46', '#625387', '#f4a697'],
];
const random = rng(87011);
const stars = Array.from({ length: 64 }, () => [random() * WIDTH, random() * 300, random() * 5 + 2]);

export function drawBackground(ctx: CanvasRenderingContext2D, renderer: PixelRenderer, world: number, camera: number, time: number) {
  const colors = skyColors[world];
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.86);
  colors.forEach((color, i) => sky.addColorStop(i / 2, color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (world > 0) {
    ctx.globalAlpha = world === 2 ? 0.64 : 0.3;
    for (const [x, y, s] of stars) renderer.draw(ctx, STAR, (x - camera * 0.045 % WIDTH + WIDTH) % WIDTH, y, s, s);
    ctx.globalAlpha = 1;
  }
  if (world === 2) renderer.draw(ctx, moon, 722 - camera * 0.035 % 130, 78, 104, 104);
  if (world !== 1) {
    ctx.globalAlpha = 0.74;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 221 - (camera * 0.13 + time * 9) % 1326 + 1326) % 1326) - 140;
      renderer.draw(ctx, clouds[world === 2 ? 1 : 0], x, 73 + (i * 61) % 143, 108 + i % 3 * 26, 34 + i % 3 * 8);
    }
    ctx.globalAlpha = 1;
  }
  layers[world].forEach((layer, i) => {
    const period = 768;
    const x = -(camera * (0.12 + i * 0.12) % period);
    for (let j = 0; j < 3; j++) renderer.draw(ctx, layer, x + j * period, 218 + i * 50, period, 270);
  });
  if (world < 2) {
    for (let i = 0; i < 6; i++) {
      const size = 72 + (i * 63) % 135;
      const x = ((i * 201 - camera * 0.66 % 1206 + 1206) % 1206) - 110;
      renderer.draw(ctx, structures[world], x, 444 - size * 0.75, size, size * 0.8, i % 2 === 0);
    }
  }
}
