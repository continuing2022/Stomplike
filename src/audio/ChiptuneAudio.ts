export type Sound = 'jump' | 'stomp' | 'blockBump' | 'blockBreak' | 'coin' | 'powerup' | 'fireball' | 'laser' | 'capsuleBreak' | 'weaponGet' | 'shellKick' | 'hurt' | 'flagpole' | 'victory' | 'uiSelect';
export type Track = 'lobby' | 'valley' | 'mine' | 'sky' | 'boss' | 'quiet';

const MELODIES: Record<Exclude<Track, 'quiet'>, number[]> = {
  lobby: [72, 0, 76, 79, 81, 79, 76, 0, 74, 0, 77, 81, 83, 81, 77, 0, 72, 76, 79, 84, 83, 79, 76, 0, 74, 77, 79, 81, 79, 76, 74, 0],
  valley: [76, 79, 81, 0, 79, 76, 74, 0, 72, 76, 79, 0, 84, 81, 79, 0, 77, 81, 84, 86, 84, 81, 77, 0, 76, 79, 83, 81, 79, 76, 74, 0],
  mine: [69, 0, 76, 0, 72, 0, 79, 76, 67, 0, 74, 0, 71, 74, 79, 0, 65, 0, 72, 0, 69, 72, 76, 0, 64, 71, 76, 0, 74, 71, 68, 0],
  sky: [69, 74, 77, 81, 84, 0, 81, 77, 70, 74, 77, 82, 86, 0, 84, 81, 72, 77, 79, 84, 88, 84, 79, 77, 73, 76, 79, 81, 85, 81, 76, 0],
  boss: [57, 57, 60, 57, 63, 62, 60, 0, 58, 58, 62, 58, 65, 64, 62, 0, 57, 69, 72, 69, 75, 74, 72, 0, 55, 67, 70, 67, 74, 73, 71, 0],
};
const BASS = { lobby: [48, 50, 45, 43], valley: [48, 45, 53, 43], mine: [45, 43, 41, 40], sky: [50, 46, 48, 45], boss: [33, 34, 33, 31] };
const NOTE = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class ChiptuneAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private track: Track = 'quiet';
  private next = 0;
  private step = 0;
  private paused = false;
  muted = false;

  unlock() {
    if (!this.ctx) {
      if (!window.AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.43;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.connect(this.master);
      this.noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.26), this.ctx.sampleRate);
      const noise = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
      window.setInterval(() => this.sequence(), 35);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
  }

  toggle() {
    this.muted = !this.muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.43, this.ctx.currentTime, 0.018);
  }

  setTrack(track: Track) {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    this.next = this.ctx?.currentTime ?? 0;
  }

  pause(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.ctx && this.music) this.music.gain.setTargetAtTime(paused ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, duration: number, volume: number, music = false) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (from !== to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    env.gain.setValueAtTime(0.001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + 0.007);
    env.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(env).connect(music ? this.music! : this.master);
    osc.start(start);
    osc.stop(start + duration + 0.015);
  }

  private noise(start: number, duration: number, volume: number, frequency: number, music = false) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    noise.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = frequency;
    env.gain.setValueAtTime(volume, start);
    env.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noise.connect(filter).connect(env).connect(music ? this.music! : this.master);
    noise.start(start);
    noise.stop(start + duration);
  }

  private sequence() {
    if (!this.ctx || this.ctx.state !== 'running' || this.track === 'quiet' || this.paused || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.next < now) this.next = now + 0.025;
    const track = this.track;
    const length = track === 'boss' ? 0.108 : track === 'lobby' ? 0.153 : 0.129;
    while (this.next < now + 0.11) {
      const melody = MELODIES[track][this.step % 32];
      if (melody) this.tone('square', NOTE(melody), NOTE(melody), this.next, length * 0.74, 0.032, true);
      if (this.step % 2 === 0) {
        const bass = NOTE(BASS[track][Math.floor(this.step / 8) % 4] + (this.step % 4 ? 7 : 0));
        this.tone('triangle', bass, bass, this.next, length * 1.45, 0.094, true);
      }
      if (this.step % 2 === 1 || this.step % 4 === 0) this.noise(this.next, 0.043, this.step % 4 ? 0.019 : 0.046, 2300, true);
      this.next += length;
      this.step = (this.step + 1) % 32;
    }
  }

  play(sound: Sound, combo = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const now = this.ctx.currentTime;
    const sweep = (type: OscillatorType, from: number, to: number, duration: number, volume = 0.14) =>
      this.tone(type, from, to, now, duration, volume);
    const melody = (notes: number[], step = 0.075, duration = 0.12) =>
      notes.forEach((note, i) => this.tone('square', NOTE(note), NOTE(note), now + i * step, duration, 0.095));
    switch (sound) {
      case 'jump': sweep('square', 180, 520, 0.115, 0.09); break;
      case 'stomp':
        sweep('triangle', 144, 48, 0.11, 0.22);
        melody([[72, 74, 76, 79, 81, 84][Math.min(5, Math.max(0, combo - 1))]]);
        break;
      case 'blockBump': sweep('triangle', 250, 90, 0.1); break;
      case 'blockBreak': this.noise(now, 0.19, 0.25, 840); break;
      case 'coin': melody([83, 88], 0.054, 0.095); break;
      case 'powerup': melody([60, 65, 69, 72, 77, 81], 0.053); break;
      case 'fireball': sweep('square', 980, 170, 0.087, 0.08); break;
      case 'laser': sweep('sawtooth', 1420, 360, 0.095, 0.085); break;
      case 'capsuleBreak':
        this.noise(now, 0.12, 0.2, 1250);
        melody([74, 81, 86], 0.038, 0.08);
        break;
      case 'weaponGet':
        melody([67, 72, 76, 79, 84, 88], 0.046, 0.11);
        break;
      case 'shellKick':
        sweep('square', 440, 100, 0.105, 0.10);
        this.noise(now, 0.07, 0.12, 1450);
        break;
      case 'hurt': sweep('sawtooth', 290, 64, 0.25, 0.12); break;
      case 'flagpole': melody([72, 76, 79, 86, 84], 0.095, 0.15); break;
      case 'victory': melody([72, 76, 79, 84, 79, 86, 88, 91], 0.097, 0.18); break;
      case 'uiSelect': melody([76, 81], 0.043, 0.075); break;
    }
  }
}
