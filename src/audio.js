// All sounds are made live with the Web Audio API (no sound files).

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = { sound: 0.8, music: 0.6 };
    this.tension = 0; // 0..1: how close the shadows are (set by the game each frame)
    this.danger = 0;  // 0..1: how low the oil is
  }

  // Browsers only allow audio after a key press or click.
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
      // Separate volume knobs for effects and music, both feeding the master.
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.applyVolume();
      this.startAmbience();
      this.startMusic();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(kind, value) {
    this.volume[kind] = value;
    this.applyVolume();
  }

  applyVolume() {
    if (!this.ctx) return;
    this.sfx.gain.value = this.volume.sound;
    this.musicBus.gain.value = this.volume.music;
  }

  // Generative music: a slow minor chord pad, a sparse plucked melody on a pentatonic scale,
  // and a heartbeat that fades in when shadows are close or oil is low. Notes are scheduled
  // a little ahead of time on the audio clock so timing stays steady.
  startMusic() {
    const ctx = this.ctx;
    const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]; // Am, F, G, Em (MIDI)
    const scale = [69, 72, 74, 76, 79, 81, 84];                               // A minor pentatonic
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const beat = 0.75; // seconds
    let next = ctx.currentTime + 0.2;
    let step = 0;
    let lastNote = 2;

    // A soft echo for the melody.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = beat * 1.5;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(this.musicBus);

    const pad = (freqs, t, dur) => {
      for (const f of freqs) {
        for (const detune of [-6, 6]) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const lp = ctx.createBiquadFilter();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = detune;
          lp.type = 'lowpass';
          lp.frequency.value = 500 + 900 * this.tension;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.018, t + 1.2);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(lp).connect(g).connect(this.musicBus);
          o.start(t);
          o.stop(t + dur + 0.1);
        }
      }
    };
    const pluck = (f, t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g);
      g.connect(this.musicBus);
      g.connect(delay);
      o.start(t);
      o.stop(t + 1.5);
    };
    const thump = (t, vol) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.3);
    };

    const schedule = () => {
      while (next < ctx.currentTime + 1.0) {
        const bar = Math.floor(step / 8);
        if (step % 8 === 0) pad(chords[bar % 4].map((n) => midi(n - 12)), next, beat * 8 + 1);
        // Melody: a random walk over the scale, playing on roughly half the beats.
        if (Math.random() < 0.45 + 0.2 * this.tension) {
          lastNote = Math.max(0, Math.min(scale.length - 1, lastNote + Math.floor(Math.random() * 5) - 2));
          pluck(midi(scale[lastNote]), next);
        }
        // Heartbeat: two thumps per beat-pair, louder with danger.
        const pulse = Math.max(this.tension, this.danger);
        if (pulse > 0.15 && step % 2 === 0) {
          thump(next, 0.25 * pulse);
          thump(next + 0.22, 0.15 * pulse);
        }
        next += beat;
        step++;
      }
    };
    schedule();
    setInterval(schedule, 250);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  // A low, slowly beating drone under everything.
  startAmbience() {
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.musicBus);
    for (const f of [55, 55.6, 82.4]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start();
    }
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 800, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfx);
    src.start(t);
  }

  play(name) {
    switch (name) {
      case 'oil':
        this.tone(440, 0.12, { type: 'triangle' });
        this.tone(660, 0.18, { type: 'triangle', delay: 0.08 });
        break;
      case 'buoy':
        this.tone(523, 0.6, { vol: 0.25 });
        this.tone(784, 0.8, { vol: 0.2, delay: 0.1 });
        break;
      case 'allBuoys':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.9, { vol: 0.2, delay: i * 0.12 }));
        break;
      case 'hit':
        this.noise(0.4, { vol: 0.5, freq: 200, type: 'lowpass' });
        this.tone(110, 0.4, { type: 'sawtooth', vol: 0.15, slideTo: 55 });
        break;
      case 'lunge':
        this.tone(180, 0.35, { type: 'sine', vol: 0.12, slideTo: 90 });
        break;
      case 'flare':
        this.noise(0.9, { vol: 0.35, freq: 1800 });
        this.tone(300, 0.6, { type: 'triangle', vol: 0.15, slideTo: 900 });
        break;
      case 'lightningWarn':
        this.tone(1400, 0.6, { type: 'sine', vol: 0.04, slideTo: 2200 });
        break;
      case 'lightning':
        this.noise(0.25, { vol: 0.5, freq: 3000, type: 'highpass' });
        this.noise(2.2, { vol: 0.45, freq: 120, type: 'lowpass' });
        break;
      case 'firework':
        this.noise(0.6, { vol: 0.12, freq: 900 });
        this.tone(180 + Math.random() * 120, 0.3, { type: 'triangle', vol: 0.05, slideTo: 60 });
        break;
      case 'buoyOut':
        this.tone(523, 0.5, { vol: 0.15, slideTo: 260 });
        break;
      case 'noFlare':
        this.tone(150, 0.15, { type: 'square', vol: 0.08 });
        break;
      case 'bump':
        this.noise(0.15, { vol: 0.25, freq: 300, type: 'lowpass' });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.7, { type: 'triangle', vol: 0.2, delay: i * 0.15 }));
        break;
      case 'whirl':
        this.noise(0.8, { vol: 0.3, freq: 400, type: 'lowpass' });
        this.tone(260, 0.7, { type: 'sine', vol: 0.12, slideTo: 80 });
        break;
      case 'shard':
        [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.1, delay: i * 0.06 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, { vol: 0.2, delay: i * 0.2 }));
        break;
    }
  }
}
