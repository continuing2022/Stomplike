export interface Chunk {
  name: string;
  entryY: number;
  exitY: number;
  layout: readonly string[];
}

function chunk(name: string, floor: string, objects: Readonly<Record<number, string>>, entryY = 13, exitY = 13): Chunk {
  const layout = Array.from({ length: 15 }, () => Array<string>(floor.length).fill('.'));
  for (let x = 0; x < floor.length; x++) {
    const top = floor[x] === '-' ? 15 : 13 - Number(floor[x]);
    for (let y = top; y < 15; y++) layout[y][x] = '#';
  }
  for (const [row, line] of Object.entries(objects)) {
    if (line.length > floor.length) throw new Error('区块对象越界 ' + name);
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') layout[Number(row)][x] = line[x];
  }
  return { name, entryY, exitY, layout: layout.map(row => row.join('')) };
}

// ?/R = prizes, b = destructible brick, h = hidden coin, c = coin.
// m/k/p = walker/shell/pipe plant, t = pipe, f = world-specific enemy.
export const CHUNKS = [
  chunk('问号回廊', '000000000000000000', { 8: '........c.c.......', 10: '....b?b?R?bb......', 12: '..............m...' }),
  chunk('壳球长廊', '00000000000000000000', { 9: '.......c.c.c.c......', 12: '....k......m...mm...' }),
  chunk('菌伞台阶', '00000112233322110000', { 7: '........ccc.........', 9: '..........R.........', 12: '..m.................' }),
  chunk('翠管花圃', '00000000000000000000', { 10: '.........c.c.c......', 11: '......p.......p.....', 12: '......tt......tt....' }),
  chunk('飞跃裂谷', '000000----0000000000', { 9: '........cc..........', 10: '......cc..cc........', 11: '....cc......cc......', 12: '...............k....' }),
  chunk('云上秘道', '00000000000000000000', { 6: '........cccc........', 8: '......b??bbb........', 10: '....bb.......?b.....', 12: '.........m.....f....' }),
  chunk('双层采集道', '0000000000000000000000', { 7: '.........cccccc.......', 9: '.....bb?bbb...bb......', 10: '....b............b....', 12: '........c.c.c..m......' }),
  chunk('空中踏点', '00000---0000---00000', { 8: '......c......c......', 10: '.....c.c....c.c.....', 11: '....c...c..c...c....', 12: '..........m.........' }),
  chunk('矮墙庭院', '00000001100001100000', { 8: '...........c........', 10: '.....?....bRb.......', 11: '.......k............', 12: '...............f....' }),
  chunk('碎砖储藏室', '00000000000000000000', { 8: '.........h..........', 10: '.....b?bb.b?bb......', 12: '...m............k...' }),
  chunk('晶梯长桥', '00000112222110000000', { 7: '........c.c.........', 9: '......?.....R.......', 12: '.................f..' }),
  chunk('弹跳花园', '00000000000000000000', { 7: '.........ccc........', 9: '............b?......', 11: '....p...............', 12: '....tt......k....m..' }),
] as const;
