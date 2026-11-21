// Shadow Lantern — all sounds are synthesized with WebAudio; no audio files.
// The context is created lazily on the first user gesture, so headless
// screenshot runs (no gesture) stay silent and error-free.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let lastStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* audio is best-effort */ }
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch { /* audio is best-effort */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'triangle', 0.25); },
    step() {
      const now = performance.now();
      if (now - lastStep < 240) return;
      lastStep = now;
      noiseBurst(0.05, 0.12, 500);
    },
    pickup() { tone(880, 0.1, 'sine', 0.3); tone(1318, 0.16, 'sine', 0.28, 0.08); },
    alert() { tone(220, 0.28, 'sawtooth', 0.3, 0, 110); tone(233, 0.28, 'sawtooth', 0.22, 0.02, 116); },
    suspicious() { tone(392, 0.14, 'triangle', 0.25, 0, 330); },
    caught() { tone(196, 0.5, 'sawtooth', 0.32, 0, 65); tone(98, 0.7, 'square', 0.2, 0.1, 49); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, i * 0.11));
    },
    levelClear() { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, i * 0.09)); },
  };
}
