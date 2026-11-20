export interface Sprite { matrix: readonly string[]; palette: Readonly<Record<string, string>> }

export class PixelRenderer {
  private readonly cache = new WeakMap<Sprite, [HTMLCanvasElement, HTMLCanvasElement]>();

  private compile(sprite: Sprite): [HTMLCanvasElement, HTMLCanvasElement] {
    const original = document.createElement('canvas');
    original.width = Math.max(...sprite.matrix.map(row => row.length));
    original.height = sprite.matrix.length;
    const ctx = original.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    sprite.matrix.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = sprite.palette[row[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    const flipped = document.createElement('canvas');
    flipped.width = original.width;
    flipped.height = original.height;
    const mirror = flipped.getContext('2d')!;
    mirror.imageSmoothingEnabled = false;
    mirror.setTransform(-1, 0, 0, 1, original.width, 0);
    mirror.drawImage(original, 0, 0);
    const pair: [HTMLCanvasElement, HTMLCanvasElement] = [original, flipped];
    this.cache.set(sprite, pair);
    return pair;
  }

  preload(sprites: readonly Sprite[]) {
    sprites.forEach(sprite => { if (!this.cache.has(sprite)) this.compile(sprite); });
  }

  draw(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, w: number, h: number, flip = false) {
    const pair = this.cache.get(sprite) ?? this.compile(sprite);
    ctx.drawImage(pair[+flip], Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
}
