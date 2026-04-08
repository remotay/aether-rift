// Procedural arcade sound effects via Web Audio API

export class SoundSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.4;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private osc(
    freq: number, endFreq: number,
    dur: number, vol: number,
    type: OscillatorType = 'sine',
    attack = 0.002,
  ): void {
    const ctx = this.getCtx();
    const gain = ctx.createGain();
    gain.connect(this.master!);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), ctx.currentTime + dur);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(gain);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + dur + 0.01);
  }

  private noise(dur: number, vol: number, lowpass: number): void {
    const ctx = this.getCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(gain); gain.connect(this.master!);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  shoot(): void {
    this.osc(880, 440, 0.07, 0.12, 'square');
    this.osc(1760, 880, 0.04, 0.04, 'sine');   // harmonics
  }

  focusShoot(): void {
    this.osc(1200, 900, 0.05, 0.08, 'sawtooth');
    this.osc(2400, 1800, 0.03, 0.03, 'sine');
  }

  enemyShoot(): void {
    this.osc(320, 240, 0.12, 0.06, 'sine');
  }

  graze(): void {
    this.osc(1600, 2400, 0.06, 0.12, 'sine');
    this.osc(3200, 4800, 0.04, 0.05, 'sine');  // sparkle
  }

  hit(): void {
    this.noise(0.12, 0.25, 900);
    this.osc(200, 80, 0.12, 0.2, 'square');
    this.osc(400, 160, 0.08, 0.08, 'sine');
  }

  playerDeath(): void {
    this.noise(0.7, 0.5, 400);
    this.osc(300, 40, 0.7, 0.3, 'sawtooth');
    this.osc(150, 30, 0.8, 0.15, 'sine');
    setTimeout(() => this.noise(0.4, 0.3, 200), 200);
  }

  explosion(): void {
    this.noise(0.45, 0.4, 700);
    this.osc(150, 35, 0.45, 0.25, 'square');
    this.osc(80, 25, 0.5, 0.12, 'sine');       // deep rumble
  }

  bomb(): void {
    this.osc(200, 800, 0.1, 0.3, 'sine');
    setTimeout(() => {
      this.osc(800, 150, 0.5, 0.22, 'sawtooth');
      this.osc(400, 80, 0.6, 0.15, 'sine');
    }, 80);
    this.noise(0.6, 0.2, 1400);
    setTimeout(() => this.noise(0.3, 0.15, 600), 300);
  }

  pickup(): void {
    this.osc(600, 1200, 0.1, 0.15, 'sine');
    this.osc(900, 1800, 0.08, 0.06, 'sine');   // chime
  }

  bossWarning(): void {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.osc(180, 90, 0.25, 0.3, 'sawtooth');
        this.osc(90, 45, 0.3, 0.12, 'sine');
      }, i * 300);
    }
  }

  phaseChange(): void {
    this.osc(440, 880, 0.3, 0.3, 'sine');
    this.osc(220, 440, 0.35, 0.12, 'sine');
    setTimeout(() => {
      this.osc(660, 1320, 0.3, 0.2, 'sine');
      this.osc(330, 660, 0.25, 0.08, 'sine');
    }, 200);
  }

  stageClear(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        this.osc(f, f, 0.35, 0.2, 'sine');
        this.osc(f * 2, f * 2, 0.2, 0.06, 'sine');
      }, i * 180);
    });
  }

  uiConfirm(): void {
    this.osc(660, 880, 0.1, 0.15, 'sine');
    this.osc(1320, 1760, 0.06, 0.05, 'sine');
  }

  uiCancel(): void {
    this.osc(440, 330, 0.1, 0.15, 'sine');
  }

  uiMove(): void {
    this.osc(500, 550, 0.05, 0.08, 'sine');
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
}

export const sfx = new SoundSynth();
