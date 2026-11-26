// Original synthesized cues and a quiet, looping orbital arpeggio.
const CUES = {
  launch: [155, 310, 622],
  transfer: [420, 580],
  flipper: [125],
  strike: [186, 292],
  bumper: [415, 523, 659],
  sling: [285, 440],
  target: [690, 840],
  rail: [145],
  combo: [523, 659, 784],
  mission: [523, 659, 784, 988],
  rank: [392, 523, 659, 1047],
  bonus: [330, 494, 659, 880],
  multiball: [220, 330, 440, 660],
  extra: [659, 784, 1047],
  drain: [160, 95],
  over: [220, 166, 110],
  nudge: [110],
  tilt: [175, 130],
  daily: [587, 740, 880]
};
const SEQUENCE = [110, 220, 277, 330, 130.81, 261.63, 329.63, 392, 98, 196, 246.94, 293.66, 123.47, 246.94, 311.13, 369.99];

export class PinballAudio {
  constructor() {
    this.ctx = null;
    this.voices = new Set();
    this.noteIndex = 0;
    this.nextBeat = 0;
    this.active = false;
    this.lastCue = new Map();
  }

  unlock(settings) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!this.ctx) {
        this.ctx = new Context();
        this.master = this.ctx.createGain();
        this.music = this.ctx.createGain();
        this.music.connect(this.master);
        this.master.connect(this.ctx.destination);
      }
      this.configure(settings, this.active);
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    } catch {
      // Unsupported sound hardware must not interrupt the game.
    }
  }

  configure(settings, active) {
    this.active = active;
    this.settings = settings;
    if (!this.master) return;
    const time = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.mute ? 0 : settings.volume / 100 * .55, time, .035);
    this.music.gain.setTargetAtTime(settings.music && active ? .18 : 0, time, .05);
  }

  tone(frequency, start, duration, amplitude, destination, shape = 'sine', endFrequency = frequency) {
    if (this.voices.size >= 24) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== frequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(amplitude, start + .009);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain).connect(destination);
    this.voices.add(osc);
    osc.addEventListener('ended', () => {
      this.voices.delete(osc);
      osc.disconnect();
      gain.disconnect();
    }, { once: true });
    osc.start(start);
    osc.stop(start + duration + .01);
  }

  cue(event) {
    const notes = CUES[event.type];
    if (!notes || this.ctx?.state !== 'running' || this.settings.mute || !this.settings.volume) return;
    const now = this.ctx.currentTime;
    const last = this.lastCue.get(event.type) ?? -1;
    if (now - last < (event.type === 'flipper' ? .025 : .055)) return;
    this.lastCue.set(event.type, now);
    const mechanical = ['flipper', 'rail', 'strike', 'nudge'].includes(event.type);
    const root = event.type === 'bumper' ? 1 + event.index * .17 : 1;
    for (const [i, note] of notes.entries()) {
      const frequency = note * root;
      this.tone(frequency, now + i * .046, mechanical ? .075 : .17,
        event.type === 'rail' ? .025 + event.power * .04 : .15, this.master,
        mechanical ? 'triangle' : 'sine', mechanical ? frequency * .55 : frequency);
    }
  }

  update() {
    if (!this.active || !this.settings?.music || this.settings.mute || !this.settings.volume || this.ctx?.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextBeat < now - .12) this.nextBeat = now + .025;
    while (this.nextBeat < now + .12) {
      const i = this.noteIndex;
      this.tone(SEQUENCE[i], this.nextBeat, i % 4 === 0 ? .65 : .23, .28, this.music, i % 4 === 0 ? 'triangle' : 'sine');
      this.noteIndex = (i + 1) % SEQUENCE.length;
      this.nextBeat += .24;
    }
  }
}
