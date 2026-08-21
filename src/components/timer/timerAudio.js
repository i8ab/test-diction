/** Web Audio alarm + ambient helpers for the study timer (offline-safe). */
let sharedAudioCtx = null;

export function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume().catch(() => {});
  return sharedAudioCtx;
}

function tone(ctx, { freq, type = "sine", start, dur, gain = 0.15, freqEnd }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

export function playAlarmSound(alarmId, volume = 0.7) {
  if (!alarmId || alarmId === "off") return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const v = Math.max(0, Math.min(1, volume)) * 0.35;
    if (alarmId === "beep") {
      for (let i = 0; i < 3; i++) tone(ctx, { freq: 880, type: "square", start: t0 + i * 0.28, dur: 0.15, gain: v });
    } else if (alarmId === "bell") {
      tone(ctx, { freq: 660, type: "sine", start: t0, dur: 1.2, gain: v, freqEnd: 420 });
      tone(ctx, { freq: 990, type: "sine", start: t0, dur: 0.9, gain: v * 0.5, freqEnd: 600 });
    } else if (alarmId === "digital") {
      for (let i = 0; i < 4; i++) tone(ctx, { freq: 1200 - i * 80, type: "sawtooth", start: t0 + i * 0.18, dur: 0.12, gain: v * 0.7 });
    } else if (alarmId === "soft") {
      for (let i = 0; i < 2; i++) tone(ctx, { freq: 520, type: "sine", start: t0 + i * 0.55, dur: 0.45, gain: v * 0.6, freqEnd: 380 });
    } else if (alarmId === "temple") {
      tone(ctx, { freq: 220, type: "sine", start: t0, dur: 1.8, gain: v * 0.9, freqEnd: 110 });
      tone(ctx, { freq: 330, type: "triangle", start: t0 + 0.05, dur: 1.5, gain: v * 0.45, freqEnd: 165 });
      tone(ctx, { freq: 440, type: "sine", start: t0 + 0.1, dur: 1.2, gain: v * 0.25, freqEnd: 220 });
    } else if (alarmId === "xylophone") {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => tone(ctx, { freq: f, type: "triangle", start: t0 + i * 0.14, dur: 0.35, gain: v * 0.75, freqEnd: f * 0.85 }));
    } else if (alarmId === "rising") {
      tone(ctx, { freq: 300, type: "sine", start: t0, dur: 1.4, gain: v * 0.8, freqEnd: 900 });
      tone(ctx, { freq: 450, type: "triangle", start: t0 + 0.15, dur: 1.2, gain: v * 0.4, freqEnd: 1100 });
    } else if (alarmId === "double") {
      tone(ctx, { freq: 880, type: "sine", start: t0, dur: 0.25, gain: v });
      tone(ctx, { freq: 880, type: "sine", start: t0 + 0.32, dur: 0.45, gain: v * 0.9, freqEnd: 660 });
    } else {
      // chime default
      tone(ctx, { freq: 784, type: "sine", start: t0, dur: 0.35, gain: v });
      tone(ctx, { freq: 988, type: "sine", start: t0 + 0.2, dur: 0.4, gain: v * 0.85 });
      tone(ctx, { freq: 1175, type: "sine", start: t0 + 0.42, dur: 0.7, gain: v * 0.7, freqEnd: 880 });
    }
  } catch {}
}

/** Lightweight ambient loops via Web Audio (no external files, works offline). */
export function createAmbientNode(ctx, ambientId, volume) {
  if (!ambientId || ambientId === "off") return null;
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume)) * 0.22;
  master.connect(ctx.destination);
  const stopFns = [];

  if (ambientId === "rain" || ambientId === "waves") {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = ambientId === "rain" ? "bandpass" : "lowpass";
    filter.frequency.value = ambientId === "rain" ? 1200 : 400;
    filter.Q.value = ambientId === "rain" ? 0.7 : 0.5;
    src.connect(filter);
    filter.connect(master);
    src.start();
    stopFns.push(() => { try { src.stop(); } catch {} });
  } else if (ambientId === "hum" || ambientId === "focus") {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = ambientId === "hum" ? 110 : 82;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = ambientId === "hum" ? 0.15 : 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = ambientId === "hum" ? 8 : 4;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(master);
    o.start();
    lfo.start();
    stopFns.push(() => { try { o.stop(); lfo.stop(); } catch {} });
  } else if (ambientId === "tick") {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      tone(ctx, { freq: 900, type: "square", start: ctx.currentTime, dur: 0.03, gain: master.gain.value * 0.8 });
      timerId = setTimeout(tick, 1000);
    };
    let timerId = setTimeout(tick, 400);
    stopFns.push(() => { cancelled = true; clearTimeout(timerId); });
  } else if (ambientId === "birds") {
    let cancelled = false;
    const chirp = () => {
      if (cancelled) return;
      const f = 1800 + Math.random() * 1200;
      tone(ctx, { freq: f, type: "sine", start: ctx.currentTime, dur: 0.08, gain: master.gain.value * 0.55, freqEnd: f * 1.3 });
      tone(ctx, { freq: f * 1.2, type: "sine", start: ctx.currentTime + 0.09, dur: 0.07, gain: master.gain.value * 0.35, freqEnd: f });
      timerId = setTimeout(chirp, 900 + Math.random() * 2200);
    };
    let timerId = setTimeout(chirp, 500);
    stopFns.push(() => { cancelled = true; clearTimeout(timerId); });
  } else if (ambientId === "wind" || ambientId === "stream") {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = ambientId === "wind" ? 550 : 900;
    filter.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = ambientId === "wind" ? 0.12 : 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = ambientId === "wind" ? 180 : 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    src.connect(filter);
    filter.connect(master);
    src.start();
    lfo.start();
    stopFns.push(() => { try { src.stop(); lfo.stop(); } catch {} });
  } else if (ambientId === "fire") {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    src.connect(filter);
    filter.connect(master);
    src.start();
    stopFns.push(() => { try { src.stop(); } catch {} });
  } else if (ambientId === "night") {
    let cancelled = false;
    const chirp = () => {
      if (cancelled) return;
      const f = 2800 + Math.random() * 900;
      tone(ctx, { freq: f, type: "sine", start: ctx.currentTime, dur: 0.05, gain: master.gain.value * 0.25, freqEnd: f * 0.7 });
      timerId = setTimeout(chirp, 400 + Math.random() * 900);
    };
    let timerId = setTimeout(chirp, 300);
    stopFns.push(() => { cancelled = true; clearTimeout(timerId); });
  }

  return {
    master,
    stop() {
      stopFns.forEach((fn) => fn());
      try { master.disconnect(); } catch {}
    },
    setVolume(vol) {
      master.gain.value = Math.max(0, Math.min(1, vol)) * 0.22;
    },
  };
}

