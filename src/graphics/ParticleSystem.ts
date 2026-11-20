interface Particle {
  x: number; y: number; vx: number; vy: number; gravity: number; spin: number; angle: number;
  age: number; life: number; size: number; color: string; shape: 'square' | 'star' | 'text'; label?: string;
}

export class ParticleSystem {
  private active: Particle[] = [];
  private pool: Particle[] = [];

  private add(spec: Particle) {
    if (this.active.length >= 440) return;
    this.active.push(Object.assign(this.pool.pop() ?? {}, spec));
  }

  burst(x: number, y: number, count: number, colors: readonly string[], speed = 105, gravity = 75, star = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = (0.3 + Math.random() * 0.7) * speed;
      this.add({ x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force - speed * 0.25, gravity, spin: 0, angle: 0, age: 0, life: 0.27 + Math.random() * 0.43, size: 2 + Math.random() * 4, color: colors[i % colors.length], shape: star ? 'star' : 'square' });
    }
  }

  dust(x: number, y: number, heavy = false) {
    this.burst(x, y - 3, heavy ? 11 : 6, ['#e7d0af', '#fff0ce', '#a593a1'], heavy ? 110 : 70, -20);
  }

  debris(x: number, y: number, colors: readonly string[]) {
    for (let i = 0; i < 4; i++) {
      this.add({ x, y, vx: (i - 1.5) * 75, vy: -144 - i % 2 * 52, gravity: 470, spin: (i - 1.5) * 6, angle: 0, age: 0, life: 0.7, size: 9, color: colors[i % colors.length], shape: 'square' });
    }
  }

  text(x: number, y: number, label: string, color = '#fff1a0') {
    this.add({ x, y, vx: 0, vy: -46, gravity: 0, spin: 0, angle: 0, age: 0, life: 0.8, size: 17, color, shape: 'text', label });
  }

  tick(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.pool.push(p);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const p of this.active) {
      ctx.globalAlpha = Math.min(1, (p.life - p.age) * 6);
      ctx.fillStyle = p.color;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const size = Math.round(p.size);
      if (p.shape === 'star') {
        ctx.fillRect(x - 1, y - size, 2, size * 2 + 1);
        ctx.fillRect(x - size, y - 1, size * 2 + 1, 2);
      } else if (p.shape === 'text') {
        ctx.font = `900 ${size}px monospace`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#242037';
        ctx.strokeText(p.label ?? '', x, y);
        ctx.fillText(p.label ?? '', x, y);
      } else if (p.spin) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      } else ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }
}
