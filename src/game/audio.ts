import { WeaponId } from './types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.7;

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private ensureReady(): boolean {
    if (!this.ctx || !this.masterGain) {
      this.unlock();
    }
    if (!this.ctx || !this.masterGain || this.volume <= 0.001) return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  public playShot(weaponId: WeaponId): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Noise burst for gunshot transient
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Low punch oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    if (weaponId === 'kuzgun') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.12);
      filter.Q.value = 0.8;

      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
      oscGain.gain.setValueAtTime(0.45, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      noise.start(now);
      noise.stop(now + 0.15);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (weaponId === 'sessiz_ok') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.36);

      gain.gain.setValueAtTime(0.62, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.24);
      oscGain.gain.setValueAtTime(0.55, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.start(now);
      noise.stop(now + 0.4);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      // Diken pistol
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(520, now);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.07);
      oscGain.gain.setValueAtTime(0.38, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      noise.start(now);
      noise.stop(now + 0.1);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
  }

  public playEmptyClick(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.025);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playReload(stage: 'out' | 'in'): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    if (stage === 'out') {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.06);
    } else {
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
    }
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playHitmarker(headshot: boolean): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';

    if (headshot) {
      osc.frequency.setValueAtTime(1480, now);
      osc.frequency.setValueAtTime(2150, now + 0.03);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.055);
    }
  }

  public playEnemyShot(distance: number): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const atten = Math.max(0.08, Math.min(1, 1 - distance / 55));
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    gain.gain.setValueAtTime(0.16 * atten, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playEnemyDeath(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.35);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.32, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.38);

    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.3);
    oGain.gain.setValueAtTime(0.18, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  public playPlayerHurt(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playWaveStart(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [110, 165, 220];
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i], now + i * 0.08);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      gain.gain.setValueAtTime(0.001, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.11, now + i * 0.08 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.55);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.58);
    }
  }

  public playPurchase(): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.16, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  }

  public playFootstep(sprinting: boolean): void {
    if (!this.ensureReady() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(sprinting ? 105 : 85, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.045);
    gain.gain.setValueAtTime(sprinting ? 0.075 : 0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.noiseBuffer = null;
    }
  }
}
