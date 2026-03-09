
class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgMusic = null;
    this.bgMusicStarted = false;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.enabled = false; }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Load a real WAV/OGG audio file and play it once
  _playFile(src, volume = 0.6) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => { });
  }

  // Synthesized fallback using Web Audio API
  _synth(fn) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    try { fn(this.ctx); } catch (e) { }
  }

  swordSwing() {
    // Try real sword sound first
    this._playFile('./1/audio/sword.wav', 0.5);
  }

  hit() {
    this._playFile('./1/audio/hit.wav', 0.55);
  }

  playerHurt() {
    this._playFile('./1/audio/hit.wav', 0.7);
    // Extra crunchy synth on top
    this._synth(ctx => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(140, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
    });
  }

  enemyDie() {
    this._playFile('./1/audio/death.wav', 0.5);
  }

  pickup() {
    // Simple pickup synth (no wav for this in the 1/ folder)
    this._synth(ctx => {
      const freqs = [523, 659, 784, 1047];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = f;
        const t = ctx.currentTime + i * 0.07;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.15);
      });
    });
  }

  heartPickup() {
    this._playFile('./1/audio/heal.wav', 0.65);
  }

  // Background music (looping ogg)
  startBgMusic() {
    if (this.bgMusicStarted) return;
    this.bgMusicStarted = true;
    try {
      this.bgMusic = new Audio('./1/audio/main.ogg');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.35;
      this.bgMusic.play().catch(() => { });
    } catch (e) { }
  }

  stopBgMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
      this.bgMusicStarted = false;
    }
  }

  gameOver() {
    this.stopBgMusic();
    this._synth(ctx => {
      const freqs = [392, 349, 330, 262];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = f;
        const t = ctx.currentTime + i * 0.35;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.48);
      });
    });
  }

  titleFanfare() {
    this._synth(ctx => {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.5], [784, 0.7], [880, 0.85], [1047, 1.05]].forEach(([f, delay]) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = f;
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.start(t); osc.stop(t + 0.3);
      });
    });
  }
}
