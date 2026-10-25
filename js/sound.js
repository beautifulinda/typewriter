// ---------- 聲音：全部用 Web Audio 合成，不下載音檔 ----------
let ctx, noise;
function audio() {
  if (!soundOn) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch { return null; }
}
function burst(a, t, { freq, q = 1.2, gain, dur }) {
  const src = a.createBufferSource(); src.buffer = noise;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
}
function thunk(a, t, { freq, gain, dur }) {
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sounds = {
  key() {
    const a = audio(); if (!a) return; const t = a.currentTime, j = 0.85 + Math.random() * 0.3;
    burst(a, t, { freq: 2600 * j, q: 0.9, gain: 0.55, dur: 0.035 });       // 字錘打到滾筒的「喀」
    burst(a, t + 0.012, { freq: 5200 * j, q: 2, gain: 0.18, dur: 0.02 });
    thunk(a, t, { freq: 140 * j, gain: 0.35, dur: 0.06 });                 // 機身的悶響
  },
  space() {
    const a = audio(); if (!a) return; const t = a.currentTime;
    burst(a, t, { freq: 900, q: 0.8, gain: 0.35, dur: 0.05 });
    thunk(a, t, { freq: 90, gain: 0.3, dur: 0.07 });
  },
  back() {
    const a = audio(); if (!a) return; const t = a.currentTime;
    burst(a, t, { freq: 1400, q: 1.5, gain: 0.3, dur: 0.04 });
  },
  oops() {   // 按錯：兩聲低低的「咚咚」，不刺耳
    const a = audio(); if (!a) return; const t = a.currentTime;
    thunk(a, t, { freq: 230, gain: 0.3, dur: 0.15 });
    thunk(a, t + 0.09, { freq: 170, gain: 0.25, dur: 0.18 });
  },
  bell(delay = 0) {
    const a = audio(); if (!a) return; const t = a.currentTime + delay;
    [[2093, 0.22], [5230, 0.06], [3140, 0.05]].forEach(([f, v]) => {
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = a.createGain();
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 1.5);
    });
  },
  ret() {
    const a = audio(); if (!a) return; const t = a.currentTime;
    for (let i = 0; i < 9; i++) burst(a, t + i * 0.028, { freq: 1800 + i * 90, q: 3, gain: 0.16, dur: 0.018 }); // 滑架的棘輪聲
    thunk(a, t + 0.27, { freq: 110, gain: 0.45, dur: 0.1 });                // 撞到左邊的「咚」
    burst(a, t + 0.27, { freq: 1200, q: 0.8, gain: 0.35, dur: 0.05 });
  },
};
const buzz = ms => { try { navigator.vibrate?.(ms); } catch {} };
