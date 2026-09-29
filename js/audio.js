// All sound is synthesised with WebAudio: hit SFX plus a small procedural
// gamelan (saron, peking, bonang, kenong, gong, kendang) in slendro tuning.

const SLENDRO = { 1: 261.6, 2: 300.5, 3: 345.2, 5: 396.6, 6: 455.6 };
const note = (n, oct = 0) => SLENDRO[n] * Math.pow(2, oct);

const GENDING = {
  fight: {
    bpm: 132,
    balungan: [6, 5, 3, 2, 5, 3, 2, 1, 3, 2, 1, 6, 1, 2, 3, 5, 6, 1, 6, 5, 3, 5, 6, 1, 6, 5, 3, 2, 1, 2, 6, 5],
    kendang: true,
  },
  menu: {
    bpm: 64,
    balungan: [2, 1, 2, 6, 2, 1, 2, 6, 3, 3, 0, 0, 6, 5, 3, 2, 5, 6, 5, 3, 2, 1, 2, 6, 3, 5, 3, 2, 1, 6, 1, 2],
    kendang: false,
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.mode = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.3;
    this.music.connect(this.master);

    // reverb (pendopo hall)
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.master);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.dist = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    this.dist.curve = curve;
    this.dist.connect(this.sfx);

    this.scheduler = setInterval(() => this.schedule(), 25);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ----------------------------------------------------------- primitives
  tone(freq, dur, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(o.dest || this.sfx);
    if (o.verb) g.connect(this.verb);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = o.t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.dest || this.sfx);
    if (o.verb) g.connect(this.verb);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ----------------------------------------------------------- SFX
  whoosh(pitch = 1) {
    this.noise(0.16, { filter: 'bandpass', freq: 500 * pitch, to: 2200 * pitch, q: 1.2, gain: 0.12, attack: 0.03 });
  }
  punch(power = 1) {
    this.noise(0.09, { freq: 2200, to: 300, gain: 0.55 * power });
    this.tone(170, 0.14, { to: 55, gain: 0.8 * power });
    this.noise(0.02, { filter: 'highpass', freq: 3000, gain: 0.25 });
  }
  kick(power = 1) {
    this.tone(125, 0.22, { to: 42, gain: 0.95 * power });
    this.noise(0.14, { filter: 'bandpass', freq: 900, to: 250, q: 0.8, gain: 0.5 * power });
    this.noise(0.03, { filter: 'highpass', freq: 2500, gain: 0.2 });
  }
  heavy() {
    this.punch(1.1);
    this.tone(90, 0.35, { to: 35, gain: 0.7, dest: this.dist });
    this.noise(0.25, { freq: 900, to: 120, gain: 0.35, dest: this.dist });
  }
  // metallic clank like the dalang's kecrek plates
  block() {
    [1180, 1790, 2630, 3410].forEach((f, i) => this.tone(f, 0.12 + i * 0.03, { type: i % 2 ? 'square' : 'triangle', gain: 0.07, to: f * 0.97 }));
    this.noise(0.05, { filter: 'highpass', freq: 3500, gain: 0.3 });
    this.tone(220, 0.06, { to: 120, gain: 0.25 });
  }
  parry() {
    this.saron(note(6, 2), this.now, 0.35, 1.2);
    this.saron(note(3, 2), this.now + 0.07, 0.3, 1.2);
    this.noise(0.4, { filter: 'highpass', freq: 5000, gain: 0.12, attack: 0.01 });
    this.block();
  }
  jump(p = 1) {
    this.noise(0.12, { filter: 'bandpass', freq: 600 * p, to: 1400 * p, gain: 0.12 });
    this.tone(160 * p, 0.1, { to: 260 * p, gain: 0.08 });
  }
  land() {
    this.tone(95, 0.1, { to: 45, gain: 0.35 });
    this.noise(0.07, { freq: 700, gain: 0.15 });
  }
  thud(p = 1) {
    this.tone(80, 0.3, { to: 32, gain: 0.8 * p });
    this.noise(0.2, { freq: 500, to: 100, gain: 0.35 * p });
  }
  roll() {
    this.noise(0.28, { filter: 'bandpass', freq: 300, to: 900, q: 0.7, gain: 0.2, attack: 0.05 });
  }
  slash() {
    this.noise(0.12, { filter: 'bandpass', freq: 2500, to: 7000, q: 2, gain: 0.35 });
    this.punch(0.6);
  }
  arrow(big) {
    this.tone(big ? 180 : 260, 0.3, { type: 'triangle', to: big ? 90 : 140, gain: 0.35 });
    this.noise(big ? 0.9 : 0.5, { filter: 'bandpass', freq: 800, to: 4000, q: 1.5, gain: big ? 0.35 : 0.2, attack: 0.02 });
    if (big) this.tone(880, 1.2, { type: 'sine', to: 1760, gain: 0.12, attack: 0.05, verb: true });
  }
  arrowThud() {
    this.noise(0.04, { filter: 'highpass', freq: 2000, gain: 0.15 });
    this.tone(300, 0.05, { to: 120, gain: 0.12 });
  }
  arrowHit() {
    this.noise(0.05, { filter: 'bandpass', freq: 3000, gain: 0.35 });
    this.tone(200, 0.08, { to: 80, gain: 0.35 });
  }
  roar() {
    this.tone(70, 1.0, { type: 'sawtooth', to: 50, gain: 0.25, attack: 0.1, dest: this.dist });
    this.noise(1.0, { freq: 600, to: 200, gain: 0.3, attack: 0.1 });
  }
  dive() {
    this.noise(0.8, { filter: 'bandpass', freq: 3000, to: 300, q: 1, gain: 0.4, attack: 0.05 });
  }
  thunder() {
    this.noise(1.6, { freq: 5000, to: 80, gain: 0.8, verb: true });
    this.tone(55, 1.4, { to: 28, gain: 0.9, dest: this.dist });
    for (let i = 0; i < 6; i++) this.noise(0.03, { t: this.now + i * 0.05 + Math.random() * 0.05, filter: 'highpass', freq: 3000, gain: 0.3 });
  }
  boom(p = 1) {
    this.tone(60, 0.8, { to: 30, gain: 0.8 * p, dest: this.dist });
    this.noise(0.6, { freq: 1500, to: 80, gain: 0.5 * p, verb: true });
  }
  ultCharge() {
    if (!this.ctx) return;
    this.gong(note(6, -2), this.now, 0.7);
    this.tone(110, 0.9, { type: 'sawtooth', to: 880, slide: 0.8, gain: 0.12, attack: 0.3, verb: true });
    this.tone(165, 0.9, { type: 'sawtooth', to: 1320, slide: 0.8, gain: 0.08, attack: 0.3, verb: true });
    this.noise(0.9, { filter: 'bandpass', freq: 300, to: 5000, q: 2, gain: 0.2, attack: 0.5 });
  }
  ultReady() {
    this.saron(note(1, 1), this.now, 0.25);
    this.saron(note(3, 1), this.now + 0.08, 0.25);
    this.saron(note(5, 1), this.now + 0.16, 0.3);
  }
  ko() {
    this.gong(note(5, -3), this.now, 1.1);
    this.boom(1);
  }
  uiMove() { this.saron(note(5, 2), this.now, 0.12, 0.4); }
  uiSelect() { this.kenong(note(2, 0), this.now, 0.35); }
  uiBack() { this.saron(note(2, 1), this.now, 0.15, 0.4); }
  roundStart() {
    const t = this.now;
    this.kendang('dhe', t, 1);
    this.kendang('tak', t + 0.18, 1);
    this.kendang('dhe', t + 0.36, 1);
    this.kendang('dhung', t + 0.54, 1);
  }
  fightStart() {
    this.gong(note(6, -3), this.now, 1);
    this.kendang('dhe', this.now, 1.2);
  }

  // ----------------------------------------------------------- gamelan voices
  saron(freq, t, gain = 0.2, dur = 0.9) {
    // metallic bar: fundamental + inharmonic partials, paired detune = ombak
    this.tone(freq, dur, { t, gain, dest: this.music, verb: true });
    this.tone(freq * 1.003, dur * 0.9, { t, gain: gain * 0.6, dest: this.music });
    this.tone(freq * 2.76, dur * 0.25, { t, gain: gain * 0.25, dest: this.music });
    this.tone(freq * 5.4, dur * 0.08, { t, gain: gain * 0.12, dest: this.music });
  }
  bonang(freq, t, gain = 0.12) {
    this.tone(freq, 0.5, { t, gain, dest: this.music, verb: true });
    this.tone(freq * 2.01, 0.25, { t, gain: gain * 0.35, dest: this.music });
    this.tone(freq * 0.5, 0.35, { t, gain: gain * 0.3, type: 'triangle', dest: this.music });
  }
  kenong(freq, t, gain = 0.25) {
    this.tone(freq, 1.8, { t, gain, dest: this.music, verb: true, attack: 0.01 });
    this.tone(freq * 1.006, 1.6, { t, gain: gain * 0.7, dest: this.music });
    this.tone(freq * 2.02, 0.6, { t, gain: gain * 0.2, dest: this.music });
  }
  gong(freq, t, gain = 0.6) {
    this.tone(freq, 5, { t, gain, dest: this.music, verb: true, attack: 0.04 });
    this.tone(freq * 1.012, 4.5, { t, gain: gain * 0.8, dest: this.music });
    this.tone(freq * 2.03, 3, { t, gain: gain * 0.25, dest: this.music });
    this.tone(freq * 2.9, 1.5, { t, gain: gain * 0.1, dest: this.music });
    this.noise(0.15, { t, freq: 300, gain: gain * 0.2, dest: this.music });
  }
  kendang(kind, t, gain = 0.5) {
    if (kind === 'dhe') {
      this.tone(120, 0.25, { t, to: 70, gain: gain * 0.7, dest: this.music });
    } else if (kind === 'dhung') {
      this.tone(190, 0.35, { t, to: 150, gain: gain * 0.5, dest: this.music });
    } else if (kind === 'tak') {
      this.noise(0.05, { t, filter: 'bandpass', freq: 2200, q: 1.5, gain: gain * 0.6, dest: this.music });
    } else if (kind === 'tlang') {
      this.tone(320, 0.12, { t, to: 280, gain: gain * 0.3, dest: this.music });
      this.noise(0.03, { t, filter: 'highpass', freq: 1500, gain: gain * 0.2, dest: this.music });
    }
  }

  // ----------------------------------------------------------- music scheduler
  setMusic(mode) {
    if (!this.ctx) {
      this.mode = mode;
      return;
    }
    if (this.mode === mode) return;
    this.mode = mode;
    this.beat = 0;
    this.nextT = this.ctx.currentTime + 0.1;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.music) this.music.gain.setTargetAtTime(this.musicOn ? 0.3 : 0, this.now, 0.1);
    return this.musicOn;
  }

  schedule() {
    if (!this.ctx || !this.mode || !GENDING[this.mode]) return;
    if (this.nextT == null) {
      this.nextT = this.ctx.currentTime + 0.1;
      this.beat = 0;
    }
    const G = GENDING[this.mode];
    const spb = 60 / G.bpm;
    while (this.nextT < this.ctx.currentTime + 0.15) {
      const t = this.nextT;
      const bal = G.balungan;
      const i = this.beat % bal.length;
      const n = bal[i];
      const next = bal[(i + 1) % bal.length] || n || 6;
      if (n) this.saron(note(n, 0), t, 0.13);
      // peking plays each note twice, twice as fast, an octave up
      const pk = n || next;
      this.saron(note(pk, 1), t, 0.05, 0.4);
      this.saron(note(pk, 1), t + spb / 2, 0.04, 0.4);
      // bonang imbal on the off-beats
      this.bonang(note(next, 0), t + spb / 2, 0.06);
      if (i % 4 === 3) this.kenong(note(n || 6, -1), t, 0.16);
      if (i % 4 === 1) this.tone(note(2, -1), 0.15, { t, gain: 0.05, dest: this.music }); // kethuk
      if (i % 16 === 15) this.gong(note(6, -3), t + spb * 0.02, 0.45);
      if (G.kendang) {
        const pat = ['dhe', 'tak', 'tlang', 'dhe', 'dhung', 'tak', 'dhe', 'tak'];
        const k = pat[i % 8];
        this.kendang(k, t, 0.5);
        if (i % 2 === 1) this.kendang('tak', t + spb / 2, 0.3);
      }
      this.beat++;
      this.nextT += spb;
    }
  }
}
