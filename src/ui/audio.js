// Procedural ambience and effects with the Web Audio API (no sound files).
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.birdTimer = 2;
    this.eagleTimer = 25;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    // Shared noise buffer.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      // Slightly pinked noise.
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w;
      d[i] = w * 0.5 + b * 3;
    }

    this.wind = this.loopNoise('lowpass', 420, 0.6);
    this.river = this.loopNoise('bandpass', 1400, 0.5);
    this.crickets = this.makeCrickets();
  }

  loopNoise(type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    return { src, filter, gain };
  }

  makeCrickets() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.value = 4400;
    const am = ctx.createOscillator();
    am.frequency.value = 28;
    const amGain = ctx.createGain();
    amGain.gain.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const chirp = ctx.createGain();
    chirp.gain.value = 0.5;
    am.connect(amGain).connect(chirp.gain);
    osc.connect(chirp).connect(gain).connect(this.master);
    osc.start();
    am.start();
    return { gain };
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.1);
    return this.muted;
  }

  // Called every frame with how windy/wet/dark it is around the player.
  update(dt, { altitude, waterDist, night }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const windLevel = 0.05 + Math.min(1, altitude / 140) * 0.22 + Math.sin(t * 0.13) * 0.03;
    this.wind.gain.gain.setTargetAtTime(windLevel, t, 0.5);
    this.wind.filter.frequency.setTargetAtTime(300 + Math.sin(t * 0.21) * 120 + altitude * 2, t, 0.5);
    const riverLevel = Math.max(0, 1 - waterDist / 45) * 0.16;
    this.river.gain.gain.setTargetAtTime(riverLevel, t, 0.3);
    const cricketLevel = night * 0.012 * (altitude < 70 ? 1 : 0.2);
    this.crickets.gain.gain.setTargetAtTime(cricketLevel, t, 0.8);

    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 1.5 + Math.random() * 5;
      if (night < 0.5 && altitude < 110) this.birdSong();
    }
    this.eagleTimer -= dt;
    if (this.eagleTimer <= 0) {
      this.eagleTimer = 30 + Math.random() * 40;
      if (night < 0.3 && altitude > 60) this.eagleCry();
    }
  }

  env(gainNode, t, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(type, freq, t, { attack = 0.01, peak = 0.2, decay = 0.3, pan = 0, glide = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, attack, peak, decay);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) {
      p.pan.value = pan;
      o.connect(g).connect(p).connect(this.master);
    } else {
      o.connect(g).connect(this.master);
    }
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  birdSong() {
    const t = this.ctx.currentTime;
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 5);
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < notes; i++) {
      const f = base * (1 + (Math.random() - 0.5) * 0.3);
      this.tone('sine', f, t + i * 0.11, { attack: 0.01, peak: 0.035, decay: 0.08, pan, glide: f * (Math.random() > 0.5 ? 1.25 : 0.8) });
    }
  }

  eagleCry() {
    const t = this.ctx.currentTime;
    this.tone('sawtooth', 2600, t, { attack: 0.04, peak: 0.02, decay: 0.7, glide: 1500, pan: Math.random() - 0.5 });
    this.tone('sine', 3200, t, { attack: 0.04, peak: 0.03, decay: 0.7, glide: 1900 });
  }

  marmotWhistle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('sine', 2900, t, { attack: 0.02, peak: 0.08, decay: 0.25, glide: 3300 });
  }

  footstep(speed, onGrass = true) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = onGrass ? 900 : 1600;
    const g = ctx.createGain();
    this.env(g, t, 0.005, 0.05 + Math.min(speed, 8) * 0.008, 0.09);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, 0.15);
  }

  splash() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.01, 0.12, 0.25);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, 0.35);
  }

  // A plucked komuz-like arpeggio in a pentatonic scale.
  pluck(freq, t, peak = 0.12) {
    this.tone('triangle', freq, t, { attack: 0.005, peak, decay: 0.6 });
    this.tone('sine', freq * 2, t, { attack: 0.005, peak: peak * 0.35, decay: 0.3 });
  }

  collect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175].forEach((f, i) => this.pluck(f, t + i * 0.07, 0.08));
  }

  discover() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const scale = [294, 330, 392, 440, 494, 587, 659];
    const tune = [0, 2, 3, 4, 3, 5, 4, 2, 3];
    tune.forEach((n, i) => this.pluck(scale[n], t + i * 0.13 + (i > 5 ? 0.1 : 0), 0.1));
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const scale = [294, 330, 392, 440, 494, 587, 659, 784];
    [0, 2, 4, 5, 7, 5, 4, 7, 7].forEach((n, i) => this.pluck(scale[n], t + i * 0.16, 0.12));
  }
}
