const KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyZ', 'KeyW', 'ArrowUp'],
  run: ['ShiftLeft', 'ShiftRight'],
  skill: ['KeyJ', 'KeyX'], down: ['KeyS', 'ArrowDown'],
} as const;

type Action = keyof typeof KEYS;

export class InputManager {
  private keys = new Set<string>();
  private presses = new Set<Action>();
  private jumpReleased = false;
  private jumpBuffer = 0;

  set(code: string, pressed: boolean) {
    if (pressed === this.keys.has(code)) return;
    const isJump = (KEYS.jump as readonly string[]).includes(code);
    if (pressed) {
      this.keys.add(code);
      for (const action of Object.keys(KEYS) as Action[]) {
        if ((KEYS[action] as readonly string[]).includes(code)) this.presses.add(action);
      }
      if (isJump) {
        this.jumpBuffer = 0.12;
        this.jumpReleased = false;
      }
    } else {
      this.keys.delete(code);
      if (isJump && !this.held('jump')) this.jumpReleased = true;
    }
  }

  static handles(code: string) { return Object.values(KEYS).some(keys => (keys as readonly string[]).includes(code)); }

  held(action: Action) { return KEYS[action].some(code => this.keys.has(code)); }
  pressed(action: Action) { return this.presses.has(action); }
  get cutJump() { return this.jumpReleased; }
  get bufferedJump() { return this.jumpBuffer > 0; }
  consumeJump() { this.jumpBuffer = 0; }

  tick(dt: number) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.presses.clear();
    this.jumpReleased = false;
  }

  clear() {
    this.keys.clear();
    this.consumeJump();
    this.tick(0);
  }
}
