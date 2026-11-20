import { WIDTH } from './GameEngine';
import { clamp } from './Physics';

export class Camera {
  x = 0;
  private shakeTime = 0;
  private strength = 0;
  dx = 0;
  dy = 0;

  follow(x: number, vx: number, width: number, dt: number) {
    const target = clamp(x - WIDTH * 0.42 + vx * 0.29, 0, Math.max(0, width - WIDTH));
    this.x += (target - this.x) * (1 - Math.exp(-dt * 6.5));
  }

  reset(x = 0) { this.x = x; }

  shake(strength: number) {
    this.shakeTime = 0.22;
    this.strength = Math.max(this.strength, strength);
  }

  tick(dt: number) {
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    const power = this.strength * this.shakeTime / 0.22;
    this.dx = Math.round((Math.random() - 0.5) * 2 * power);
    this.dy = Math.round((Math.random() - 0.5) * 2 * power);
    if (!this.shakeTime) this.strength = 0;
  }
}
