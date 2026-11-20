export const STEP = 1 / 60;
export const WIDTH = 960;
export const HEIGHT = 540;
export const TILE = 32;

export class GameEngine {
  private accumulator = 0;
  private last = 0;
  private hitstop = 0;
  fps = 60;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly draw: (dt: number) => void,
  ) {}

  freeze(seconds: number) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  start() {
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const elapsed = this.last ? Math.min((now - this.last) / 1000, 0.1) : STEP;
    this.last = now;
    this.fps += (1 / Math.max(elapsed, 0.001) - this.fps) * 0.08;
    this.accumulator = Math.min(this.accumulator + elapsed, STEP * 5);
    while (this.accumulator >= STEP) {
      if (this.hitstop > 0) this.hitstop -= STEP;
      else this.update(STEP);
      this.accumulator -= STEP;
    }
    this.draw(elapsed);
    requestAnimationFrame(this.frame);
  };
}
