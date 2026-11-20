import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { generateLevel } = await server.ssrLoadModule('/src/level/LevelGenerator.ts');
  const { findRoute } = await server.ssrLoadModule('/src/level/Reachability.ts');
  const variants = ['normal', 'ice', 'double-coins', 'low-gravity'];
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const world = i % 3;
    const seed = (Math.imul(i + 1, 0x9e3779b1) ^ 0x318a42af) >>> 0;
    const modifier = variants[i % variants.length];
    const level = generateLevel(seed, world, 1 + i % 3, modifier);
    assert.ok(level.chunks.length >= 6 && level.chunks.length <= 8);
    let last = 13;
    for (const chunk of level.chunks) {
      const width = chunk.layout[0].length;
      assert.ok(width >= 16 && width <= 24 && chunk.layout.length === 15 && chunk.layout.every(row => row.length === width));
      assert.ok(Math.abs(last - chunk.entryY) <= 3, `Invalid seam in ${chunk.name}`);
      let gap = 0;
      for (let col = 0; col < width; col++) {
        gap = chunk.layout.some(row => row[col] === '#') ? 0 : gap + 1;
        assert.ok(gap <= 4, `Gap too wide in ${chunk.name}`);
      }
      last = chunk.exitY;
    }
    const path = findRoute(level);
    assert.ok(path.length > 0, `No base-jump route for seed ${seed} (world ${world + 1}, ${modifier})`);
    checked++;
  }
  console.log(`Verified chunk geometry and base-jump reachability on ${checked} generated levels across all three worlds.`);
} finally {
  await server.close();
}
