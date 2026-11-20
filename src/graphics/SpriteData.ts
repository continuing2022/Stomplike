import type { Sprite } from './PixelRenderer';

export const pixels = (rows: string, palette: Sprite['palette']): Sprite =>
  ({ matrix: rows.trim().split(/\s+/), palette });

const heroPalette = { d: '#191f40', a: '#ed593d', b: '#fa9b59', c: '#ffdf8d', e: '#a94343', s: '#ffd3a2', f: '#52d9c4', g: '#227f8d', w: '#fff0c6' };
const heroHead = [
  '.....dddd.......', '...ddbbbbdd.....', '..daabccbbad....', '.daabbbbbbbaad..',
  'ddaadaaaadddddd.', '.dddsswssdd.....', '..dsssdsssdd....', '..dsssssssdd....',
];
const heroTorso = ['...ddgffdd......', '..dgffffggd.....', '.dsgffcfggsd....', '.ddgffffggdd....'];
const boots: Readonly<Record<string, readonly string[]>> = {
  idle: ['..dgfddgfgd.....', '..dggd.dggd.....', '..ddddd.ddddd...', '..ddddd.ddddd...'],
  run0: ['...dgfdggd......', '..dggd.dggd.....', '.dddd...ddddd...', '.dddd...ddddd...'],
  run1: ['...dgfd.........', '...dggd.........', '...ddddd........', '....dddd........'],
  run2: ['....dggdgfd.....', '...dggd.dggd....', '..dddd...ddddd..', '..dddd...ddddd..'],
  jump: ['.ddgfgdgfggd....', '.dggdd..ddggd...', '.dddd....dddd...', '................'],
  fall: ['..dggdd.ggd.....', '..dddd..dggd....', '.........dddd...', '................'],
  skid: ['..dgfdgggd......', '.dggd..dggd.....', 'ddddd..ddddd....', 'ddddd..ddddd....'],
  hurt: ['.dggd..dggd.....', '.dddd..dddd.....', '................', '................'],
  crouch: ['..dggddgggd.....', '..ddddddddd.....', '................', '................'],
};
export const HEROES = [heroPalette, { ...heroPalette, a: '#58b7f4', b: '#a4e5ff', c: '#f4fbff', f: '#c294ff', g: '#714ab1' }, { ...heroPalette, a: '#a46adb', b: '#dfa0f3', c: '#ffe370', f: '#ffd969', g: '#b67949' }]
  .map((palette, i) => Object.fromEntries(Object.entries(boots).map(([name, feet]) => {
    const head = [...heroHead];
    if (i === 1) { head[0] = '...w...dd.......'; head[1] = '..wfwddbbdd.....'; head[2] = '.wfwabccbbad....'; }
    if (i === 2) { head[0] = '....dddddd......'; head[1] = '....dbbbbd......'; head[2] = '....dccccd......'; head[3] = '..ddddddddddd...'; }
    return [name, { matrix: [...head, ...heroTorso, ...feet], palette }];
  })) as Record<string, Sprite>);

function tile(kind: string, palette: Sprite['palette']): Sprite {
  const matrix = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return y === 0 ? 'h' : 'd';
    const n = (x * 31 + y * 17 + x * y * 11) % 37;
    if (kind === 'ground' && y < 5 + ((x >> 1) % 3)) return y < 3 ? 'h' : n < 9 ? 's' : 'g';
    if (kind === 'brick' && (y === 5 || y === 10 || (x + (y > 5 && y < 10 ? 4 : 0)) % 8 === 0)) return 'd';
    if (kind === 'metal' && (x === 2 || x === 13) && (y === 2 || y === 13)) return 'h';
    return n < 4 ? 's' : n < 8 ? 'g' : 'b';
  }).join(''));
  return { matrix, palette };
}

export const GROUND = [
  { h: '#b1e579', g: '#477d5d', s: '#348052', b: '#63475c', d: '#372f4c' },
  { h: '#91defc', g: '#4a77ba', s: '#607cac', b: '#2d345d', d: '#20223f' },
  { h: '#f9d98e', g: '#b17b73', s: '#a08499', b: '#72566f', d: '#433653' },
].map(palette => tile('ground', palette));

export const SOIL = [
  { h: '#665066', g: '#6c4a60', s: '#79586b', b: '#59445b', d: '#4e3c54' },
  { h: '#353e68', g: '#2d365b', s: '#3d4872', b: '#282e50', d: '#252a49' },
  { h: '#80617a', g: '#735570', s: '#947087', b: '#6c536f', d: '#604a66' },
].map(palette => tile('soil', palette));

export const BRICK = [
  { h: '#ffad7f', s: '#df815c', g: '#87485b', b: '#ae5a59', d: '#55364d' },
  { h: '#9bbcfb', s: '#6e8ac3', g: '#4f5396', b: '#525e9f', d: '#2d305d' },
  { h: '#ffdbad', s: '#ebac91', g: '#ae7e94', b: '#ba89a1', d: '#72536d' },
].map(palette => tile('brick', palette));

export const USED = tile('metal', { h: '#bfc6d3', s: '#75879d', g: '#404966', b: '#515d77', d: '#272a43' });
export const PIPE = tile('metal', { h: '#9cea9d', s: '#71d995', g: '#4cb786', b: '#278477', d: '#1e505c' });
export const CLOUD_TILE = tile('metal', { h: '#fff4e6', s: '#f8dcfa', g: '#e3badf', b: '#ae96cd', d: '#78648b' });
export const SPRING = pixels('................ ................ .hhhhhhhhhhhhhh. .dddddddddddddd. ...s.s.s.s.s.... ....s.s.s.s..... ...s.s.s.s.s.... ....s.s.s.s..... ...s.s.s.s.s.... .dddddddddddddd. .hhhhhhhhhhhhhh.', { h: '#ffe18d', d: '#9d526b', s: '#fff1dc' });
export const QUESTION = ['#f7be53', '#ffcb60', '#ffd972', '#ffce5f'].map((gold, i) => pixels(
  `.hhhhhhhhhhhhhh. hssssssssssssssd hsbbbbbbbbbbbbsd hsbbbwwwwbbbbsbd hsbbwwwwwwbbbsbd hsbbwwbbwwbbbsbd hsbbbbbbwwbbbsbd hsbbbbbwwbbbbsbd hsbbbbwwbbbbbsbd hsbbbbwwbbbbbsbd hsbbbbbbbbbbbsbd hsbbbbwwbbbbbsbd hsbbbbwwbbbbbsbd hsbbbbbbbbbbbsbd hsddddddddddddsd .dddddddddddddd.`,
  { h: '#fff1a4', s: '#f99a49', b: gold, d: '#a85446', w: i === 2 ? '#fffde2' : '#fff1bf' }));

const coinPalette = { d: '#aa5d4b', g: '#ffbd51', w: '#fff4ad', h: '#ffdc7a' };
export const COINS = [
  '....dddd.... ..ddhhhhd... .dhwwhhhhd.. dhwgghhhhhd. dhwghghhhhd. dhwghghhhhd. dhhggghhhhd. dhhhhhhhhhd. .dhhhhhhd... ..dddddd....',
  '.....dd..... ....dhhd.... ...dhwhhd... ...dwghhd... ...dwghhd... ...dwghhd... ...dhghhd... ...dhhhhd... ....dhhd.... .....dd.....',
  '.....dd..... .....wd..... .....wd..... .....hd..... .....hd..... .....hd..... .....hd..... .....hd..... .....hd..... .....dd.....',
  '.....dd..... ....dhhd.... ....dhwhd... ....dhgwd... ....dhgwd... ....dhgwd... ....dhghd... ....dhhhd... ....dhhd.... .....dd.....',
].map(rows => pixels(rows, coinPalette));
export const CRYSTAL = pixels('....rrdd.... ..rrhrrrdd.. .rrhhrhrrrd. rrrhrrhrrrrd drrrhhrrrrrd .ddddddddd.. ...dsssd.... ...dswsd.... ..dsswsdd... ...ddddd....',
  { r: '#ef5072', d: '#662e56', h: '#ff9a98', s: '#ffc991', w: '#fff0c6' });
export const FLAG = [0, 1, 2].map(i => {
  const rows = ['gggggggggggggg..', 'gggwwggggggggg..', 'gggwwgggggggg...', 'gwwwwwwgggggg...', 'gggwwggggggg....', 'gggwwgggggg.....', 'ggggggggg.......'];
  return { matrix: rows.map((row, y) => (y + i) % 3 === 0 ? row.slice(0, -2) : row), palette: { g: '#41d7ad', w: '#e7ffd3' } };
});
export const STAR = pixels('....h.... ....w.... ...www... ..wwwww.. hwwwwwwwh ..wwwww.. ...www... ....w.... ....h....', { h: '#ffb456', w: '#fff1a2' });
export const CASTLE = pixels(
  '................................ .......a.................a...... .......ggg...............aaa.... ......gggggg............ggggg... .....ggggggggg.........ggggggg.. ....ggggggggggg...a...ggggggggg. .....scccccs.....aaa...scccccs.. .....scssscs....ggggg..scssscs.. .....scscscs...ggggggg.scccscc.. .....scccccs..gggggggggscccscc.. .....ccccccc...scccccs.cccsccc.. .....cssscsc...scssscs.ccscccc.. .....cscscsc...scccscc.ccccscc.. .....ccccccccccssssscccccccccc.. .....ssssssscsscssscccssssssss.. .....sccccccscwowowcsscccccccs.. .....sccscccscwowowcsscccscccs.. .....sccccscscooooocssccsccccs.. .....sccccccsodddddosscccccccs.. .....sccccccoodddddooscccccccs.. .....cccccccoodddddooccccccccc.. .....sssssssoodddddoosssssssss..',
  { a: '#ffd375', g: '#3e7e8a', s: '#685279', c: '#9d7898', w: '#ffe2a1', o: '#583e62', d: '#252842' });
