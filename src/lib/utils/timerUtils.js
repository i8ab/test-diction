/** Timer pure helpers & constants — extracted from TimerPage for maintainability */
export const TIMER_PREFS_KEY = "twoTongues.timerPrefs";
export const TIMER_STATE_KEY = "twoTongues.timerState";
export const CHANNEL_NAME = "twoTongues.timerSync";

export const FONTS = [
  { id: "fraunces", label: "Fraunces", css: "'Fraunces', Georgia, serif" },
  { id: "source", label: "Source Sans", css: "'Source Sans 3', system-ui, sans-serif" },
  { id: "amiri", label: "Amiri", css: "'Amiri', 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", css: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { id: "system", label: "System", css: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
];

export const BG_PRESETS = [
  { id: "ink", label: { en: "Deep ink", ar: "حبر غامق" }, value: "linear-gradient(160deg, #0f1419 0%, #1a2332 50%, #0d1117 100%)" },
  { id: "paper", label: { en: "Warm paper", ar: "ورق دافئ" }, value: "linear-gradient(160deg, #f7f0e4 0%, #ebe3d4 50%, #e2d8c4 100%)" },
  { id: "ocean", label: { en: "Ocean", ar: "محيط" }, value: "linear-gradient(160deg, #0c4a6e 0%, #0369a1 40%, #0e7490 100%)" },
  { id: "forest", label: { en: "Forest", ar: "غابة" }, value: "linear-gradient(160deg, #14532d 0%, #166534 45%, #15803d 100%)" },
  { id: "sunset", label: { en: "Sunset", ar: "غروب" }, value: "linear-gradient(160deg, #7c2d12 0%, #c2410c 40%, #ea580c 100%)" },
  { id: "plum", label: { en: "Plum", ar: "برقوق" }, value: "linear-gradient(160deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 100%)" },
  { id: "slate", label: { en: "Slate", ar: "رمادي" }, value: "linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)" },
  { id: "rose", label: { en: "Rose", ar: "وردي" }, value: "linear-gradient(160deg, #881337 0%, #be123c 45%, #e11d48 100%)" },
  // Nature-inspired gradients
  { id: "meadow", label: { en: "Meadow", ar: "مروج" }, value: "linear-gradient(165deg, #86efac 0%, #4ade80 35%, #22c55e 70%, #15803d 100%)" },
  { id: "mountain", label: { en: "Mountains", ar: "جبال" }, value: "linear-gradient(180deg, #bfdbfe 0%, #93c5fd 25%, #64748b 55%, #334155 100%)" },
  { id: "desert", label: { en: "Desert", ar: "صحراء" }, value: "linear-gradient(160deg, #fde68a 0%, #fbbf24 40%, #d97706 75%, #92400e 100%)" },
  { id: "aurora", label: { en: "Aurora", ar: "شفق" }, value: "linear-gradient(145deg, #0f172a 0%, #14532d 30%, #0e7490 60%, #4c1d95 100%)" },
  { id: "lake", label: { en: "Lake", ar: "بحيرة" }, value: "linear-gradient(170deg, #e0f2fe 0%, #7dd3fc 40%, #0ea5e9 75%, #0369a1 100%)" },
  { id: "sky", label: { en: "Open sky", ar: "سماء" }, value: "linear-gradient(180deg, #38bdf8 0%, #7dd3fc 40%, #bae6fd 70%, #f0f9ff 100%)" },
  { id: "night", label: { en: "Starry night", ar: "ليلة نجوم" }, value: "linear-gradient(160deg, #020617 0%, #1e1b4b 45%, #312e81 80%, #0f172a 100%)" },
  { id: "mist", label: { en: "Morning mist", ar: "ضباب الصباح" }, value: "linear-gradient(160deg, #f1f5f9 0%, #cbd5e1 40%, #94a3b8 70%, #64748b 100%)" },
];

export const DEFAULT_PREFS = {
  fontId: "fraunces",
  fontSize: 96,
  textColor: "#ffffff",
  bgId: "ink",
  customBg: null, // data URL from user upload
  mode: "countdown", // countdown | stopwatch
  alarmId: "chime",
  ambientId: "off",
  alarmVolume: 0.7,
  ambientVolume: 0.25,
};

export const ALARM_SOUNDS = [
  { id: "chime", en: "Chime", ar: "جرس ناعم" },
  { id: "beep", en: "Beep", ar: "صفارة" },
  { id: "bell", en: "Bell", ar: "جرس" },
  { id: "digital", en: "Digital", ar: "رقمي" },
  { id: "soft", en: "Soft pulse", ar: "نبضة هادئة" },
  { id: "temple", en: "Temple", ar: "معبد" },
  { id: "xylophone", en: "Xylophone", ar: "زيلوفون" },
  { id: "rising", en: "Rising tone", ar: "نغمة صاعدة" },
  { id: "double", en: "Double ding", ar: "رنين مزدوج" },
  { id: "off", en: "Silent", ar: "صامت" },
];

export const AMBIENT_SOUNDS = [
  { id: "off", en: "Off", ar: "إيقاف" },
  { id: "rain", en: "Rain", ar: "مطر" },
  { id: "hum", en: "Soft hum", ar: "همهمة" },
  { id: "waves", en: "Waves", ar: "أمواج" },
  { id: "focus", en: "Focus drone", ar: "تركيز" },
  { id: "tick", en: "Clock tick", ar: "تكتكة ساعة" },
  { id: "birds", en: "Birds", ar: "طيور" },
  { id: "wind", en: "Wind", ar: "رياح" },
  { id: "fire", en: "Campfire", ar: "نار مخيم" },
  { id: "stream", en: "Stream", ar: "جدول ماء" },
  { id: "night", en: "Night insects", ar: "ليل" },
];

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(TIMER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...p };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function loadLiveState() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLiveState(state) {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export function clearLiveState() {
  try {
    localStorage.removeItem(TIMER_STATE_KEY);
  } catch {}
}

export function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function parseHms(h, m, s) {
  const hh = Math.max(0, Math.min(999, Number(h) || 0));
  const mm = Math.max(0, Math.min(59, Number(m) || 0));
  const ss = Math.max(0, Math.min(59, Number(s) || 0));
  return ((hh * 3600) + (mm * 60) + ss) * 1000;
}


/** True on phones / narrow touch screens where window.open becomes a full tab. */
export function isMobileLike() {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touch = typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
  return !!(narrow || (coarse && touch));
}

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

export function tone(ctx, { freq, type = "sine", start, dur, gain = 0.15, freqEnd }) {
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

/**
 * Full-page study timer with custom fonts, sizes, colors, preset + custom
 * backgrounds, free duration (no hard limits), and a mini floating window
 * when the user leaves the tab (Document PiP or popup fallback).
 */
