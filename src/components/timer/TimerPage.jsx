import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { XIcon, ClockIcon } from "../common/Icons";

const TIMER_PREFS_KEY = "twoTongues.timerPrefs";
const TIMER_STATE_KEY = "twoTongues.timerState";
const CHANNEL_NAME = "twoTongues.timerSync";

const FONTS = [
  { id: "fraunces", label: "Fraunces", css: "'Fraunces', Georgia, serif" },
  { id: "source", label: "Source Sans", css: "'Source Sans 3', system-ui, sans-serif" },
  { id: "amiri", label: "Amiri", css: "'Amiri', 'Times New Roman', serif" },
  { id: "mono", label: "Monospace", css: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { id: "system", label: "System", css: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
];

const BG_PRESETS = [
  { id: "ink", label: { en: "Deep ink", ar: "حبر غامق" }, value: "linear-gradient(160deg, #0f1419 0%, #1a2332 50%, #0d1117 100%)" },
  { id: "paper", label: { en: "Warm paper", ar: "ورق دافئ" }, value: "linear-gradient(160deg, #f7f0e4 0%, #ebe3d4 50%, #e2d8c4 100%)" },
  { id: "ocean", label: { en: "Ocean", ar: "محيط" }, value: "linear-gradient(160deg, #0c4a6e 0%, #0369a1 40%, #0e7490 100%)" },
  { id: "forest", label: { en: "Forest", ar: "غابة" }, value: "linear-gradient(160deg, #14532d 0%, #166534 45%, #15803d 100%)" },
  { id: "sunset", label: { en: "Sunset", ar: "غروب" }, value: "linear-gradient(160deg, #7c2d12 0%, #c2410c 40%, #ea580c 100%)" },
  { id: "plum", label: { en: "Plum", ar: "برقوق" }, value: "linear-gradient(160deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 100%)" },
  { id: "slate", label: { en: "Slate", ar: "رمادي" }, value: "linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)" },
  { id: "rose", label: { en: "Rose", ar: "وردي" }, value: "linear-gradient(160deg, #881337 0%, #be123c 45%, #e11d48 100%)" },
];

const DEFAULT_PREFS = {
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

const ALARM_SOUNDS = [
  { id: "chime", en: "Chime", ar: "جرس ناعم" },
  { id: "beep", en: "Beep", ar: "صفارة" },
  { id: "bell", en: "Bell", ar: "جرس" },
  { id: "digital", en: "Digital", ar: "رقمي" },
  { id: "soft", en: "Soft pulse", ar: "نبضة هادئة" },
  { id: "off", en: "Silent", ar: "صامت" },
];

const AMBIENT_SOUNDS = [
  { id: "off", en: "Off", ar: "إيقاف" },
  { id: "rain", en: "Rain", ar: "مطر" },
  { id: "hum", en: "Soft hum", ar: "همهمة" },
  { id: "waves", en: "Waves", ar: "أمواج" },
  { id: "focus", en: "Focus drone", ar: "تركيز" },
  { id: "tick", en: "Clock tick", ar: "تكتكة ساعة" },
];

function loadPrefs() {
  try {
    const raw = localStorage.getItem(TIMER_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...p };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function loadLiveState() {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLiveState(state) {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function clearLiveState() {
  try {
    localStorage.removeItem(TIMER_STATE_KEY);
  } catch {}
}

function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function parseHms(h, m, s) {
  const hh = Math.max(0, Math.min(999, Number(h) || 0));
  const mm = Math.max(0, Math.min(59, Number(m) || 0));
  const ss = Math.max(0, Math.min(59, Number(s) || 0));
  return ((hh * 3600) + (mm * 60) + ss) * 1000;
}


/** True on phones / narrow touch screens where window.open becomes a full tab. */
function isMobileLike() {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touch = typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0;
  return !!(narrow || (coarse && touch));
}

let sharedAudioCtx = null;
function getAudioCtx() {
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

function playAlarmSound(alarmId, volume = 0.7) {
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
    } else {
      // chime default
      tone(ctx, { freq: 784, type: "sine", start: t0, dur: 0.35, gain: v });
      tone(ctx, { freq: 988, type: "sine", start: t0 + 0.2, dur: 0.4, gain: v * 0.85 });
      tone(ctx, { freq: 1175, type: "sine", start: t0 + 0.42, dur: 0.7, gain: v * 0.7, freqEnd: 880 });
    }
  } catch {}
}

/** Lightweight ambient loops via Web Audio (no external files, works offline). */
function createAmbientNode(ctx, ambientId, volume) {
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
export default function TimerPage({ onClose, isAr }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(25);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  const [doneFlash, setDoneFlash] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // "full" = full-page timer UI; "bubble" = in-app floating mini timer
  // (used on phones instead of a broken about:blank tab from window.open).
  const [viewMode, setViewMode] = useState("full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null }); // null = default bottom-end
  const dragRef = useRef(null);

  const endAtRef = useRef(null); // absolute timestamp when countdown ends
  const startedAtRef = useRef(null); // for stopwatch
  const accumulatedRef = useRef(0); // pause-accumulated elapsed for stopwatch
  const rafRef = useRef(null);
  const channelRef = useRef(null);
  const pipWinRef = useRef(null);
  const fileInputRef = useRef(null);
  const controlsRef = useRef({ start: () => {}, pause: () => {}, reset: () => {}, openMini: () => {} });
  const runningRef = useRef(false);
  const ambientRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const fontCss = useMemo(() => (FONTS.find((f) => f.id === prefs.fontId) || FONTS[0]).css, [prefs.fontId]);
  const bgCss = useMemo(() => {
    if (prefs.customBg) return `center / cover no-repeat url(${prefs.customBg})`;
    const preset = BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0];
    return preset.value;
  }, [prefs.customBg, prefs.bgId]);

  const isLightBg = useMemo(() => {
    if (prefs.customBg) return false;
    return prefs.bgId === "paper";
  }, [prefs.customBg, prefs.bgId]);

  const displayText = prefs.mode === "stopwatch" ? formatMs(elapsedMs) : formatMs(remainingMs);

  // Persist prefs
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  // BroadcastChannel for popup / PiP sync — always routes through refs so
  // controls stay fresh without re-subscribing the channel every render.
  useEffect(() => {
    let ch = null;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = ch;
      ch.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.type !== "control") return;
        if (msg.action === "pause") controlsRef.current.pause();
        if (msg.action === "resume") controlsRef.current.start();
        if (msg.action === "reset") controlsRef.current.reset();
      };
    } catch {}
    return () => {
      try { ch && ch.close(); } catch {}
      channelRef.current = null;
    };
  }, []);

  const broadcastState = useCallback((extra = {}) => {
    const payload = {
      type: "state",
      mode: prefs.mode,
      running,
      remainingMs,
      elapsedMs,
      display: prefs.mode === "stopwatch" ? formatMs(elapsedMs) : formatMs(remainingMs),
      prefs: {
        fontId: prefs.fontId,
        fontSize: Math.min(prefs.fontSize, 64),
        textColor: prefs.textColor,
        bgId: prefs.bgId,
        customBg: null, // don't ship large data URLs over the channel
      },
      ...extra,
    };
    try {
      channelRef.current?.postMessage(payload);
    } catch {}
    saveLiveState({
      mode: prefs.mode,
      running,
      remainingMs,
      elapsedMs,
      endAt: endAtRef.current,
      startedAt: startedAtRef.current,
      accumulated: accumulatedRef.current,
      updatedAt: Date.now(),
    });
  }, [prefs, running, remainingMs, elapsedMs]);

  // Tick loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      if (prefs.mode === "countdown") {
        const left = Math.max(0, (endAtRef.current || 0) - Date.now());
        setRemainingMs(left);
        if (left <= 0) {
          runningRef.current = false;
          setRunning(false);
          setDoneFlash(true);
          playAlarmSound(prefsRef.current.alarmId, prefsRef.current.alarmVolume);
          try { ambientRef.current && ambientRef.current.stop(); } catch {}
          ambientRef.current = null;
          endAtRef.current = null;
          setTimeout(() => setDoneFlash(false), 2500);
          broadcastState({ running: false, remainingMs: 0, display: "00:00" });
          return;
        }
      } else {
        const elapsed = accumulatedRef.current + (Date.now() - (startedAtRef.current || Date.now()));
        setElapsedMs(elapsed);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, prefs.mode, broadcastState]);

  // Push state to popup periodically while running
  useEffect(() => {
    broadcastState();
  }, [running, remainingMs, elapsedMs, broadcastState]);

  // Restore mid-run state if user reopened the page
  useEffect(() => {
    const live = loadLiveState();
    if (!live) return;
    if (live.mode) setPrefs((p) => ({ ...p, mode: live.mode }));
    if (live.mode === "countdown" && live.endAt && live.running) {
      const left = live.endAt - Date.now();
      if (left > 0) {
        endAtRef.current = live.endAt;
        setRemainingMs(left);
        setRunning(true);
        setShowSettings(false);
      } else {
        clearLiveState();
      }
    } else if (live.mode === "stopwatch" && live.running) {
      accumulatedRef.current = live.accumulated || 0;
      startedAtRef.current = live.startedAt || Date.now();
      setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
      setRunning(true);
      setShowSettings(false);
    } else if (typeof live.remainingMs === "number") {
      setRemainingMs(live.remainingMs);
      const totalSec = Math.floor(live.remainingMs / 1000);
      setHours(Math.floor(totalSec / 3600));
      setMins(Math.floor((totalSec % 3600) / 60));
      setSecs(totalSec % 60);
    }
  }, []);

  useEffect(() => () => { try { ambientRef.current && ambientRef.current.stop(); } catch {} }, []);

  // On desktop only: try a real floating window when the tab is hidden.
  // On phones, window.open becomes a full blank tab (see screenshot) — so we
  // never auto-open there; the in-app bubble is the mobile path instead.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "hidden") return;
      if (!runningRef.current) return;
      if (isMobileLike()) return;
      controlsRef.current.openMini();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);


  function stopAmbient() {
    try { ambientRef.current && ambientRef.current.stop(); } catch {}
    ambientRef.current = null;
  }

  function startAmbient() {
    stopAmbient();
    const id = prefsRef.current.ambientId;
    if (!id || id === "off") return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      ambientRef.current = createAmbientNode(ctx, id, prefsRef.current.ambientVolume);
    } catch {}
  }

  function start() {
    setErrorMsg("");
    setDoneFlash(false);
    if (prefs.mode === "countdown") {
      const total = remainingMs > 0 ? remainingMs : parseHms(hours, mins, secs);
      if (total <= 0) {
        setErrorMsg(tr(isAr, "Set a duration first.", "حدد مدة أولاً."));
        return;
      }
      setRemainingMs(total);
      endAtRef.current = Date.now() + total;
    } else {
      startedAtRef.current = Date.now();
    }
    runningRef.current = true;
    setRunning(true);
    setShowSettings(false);
    startAmbient();
  }

  function pause() {
    if (prefs.mode === "countdown") {
      const left = Math.max(0, (endAtRef.current || Date.now()) - Date.now());
      setRemainingMs(left);
      endAtRef.current = null;
    } else {
      accumulatedRef.current = elapsedMs;
      startedAtRef.current = null;
    }
    runningRef.current = false;
    setRunning(false);
    stopAmbient();
  }

  function reset() {
    runningRef.current = false;
    setRunning(false);
    endAtRef.current = null;
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    const total = parseHms(hours, mins, secs);
    setRemainingMs(prefs.mode === "countdown" ? (total || 25 * 60 * 1000) : 0);
    setDoneFlash(false);
    clearLiveState();
    setShowSettings(true);
    stopAmbient();
  }

  function applyDuration() {
    const total = parseHms(hours, mins, secs);
    setRemainingMs(total);
    if (running && prefs.mode === "countdown") {
      endAtRef.current = Date.now() + total;
    }
  }

  function updatePref(patch) {
    setPrefs((p) => ({ ...p, ...patch }));
  }

  function onBgFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg(tr(isAr, "Please choose an image file.", "اختر ملف صورة من فضلك."));
      return;
    }
    // Cap ~2.5MB to keep localStorage happy
    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMsg(tr(isAr, "Image is too large (max ~2.5 MB).", "الصورة كبيرة جدًا (الحد ~٢٫٥ ميجا)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updatePref({ customBg: reader.result, bgId: "custom" });
      setErrorMsg("");
    };
    reader.onerror = () => setErrorMsg(tr(isAr, "Couldn't read the image.", "تعذّر قراءة الصورة."));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearCustomBg() {
    updatePref({ customBg: null, bgId: "ink" });
  }

  function buildMiniHtml() {
    const color = prefs.textColor || "#fff";
    const font = fontCss;
    const bg = prefs.customBg
      ? `#111`
      : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value);
    return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${tr(isAr, "Timer", "مؤقّت")}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;width:100%;overflow:hidden;font-family:${font};margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100%;min-height:100dvh;width:100%;
    background:${bg};color:${color};user-select:none;-webkit-user-select:none;
    text-align:center;padding:16px;box-sizing:border-box}
  #t{font-size:clamp(40px,16vw,80px);font-weight:700;letter-spacing:0.02em;
    font-variant-numeric:tabular-nums;text-shadow:0 2px 24px rgba(0,0,0,0.35);
    line-height:1.1;width:100%}
  #row{display:flex;gap:8px;margin-top:16px}
  button{border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;
    cursor:pointer;background:rgba(255,255,255,0.18);color:inherit;backdrop-filter:blur(6px)}
  button:hover{background:rgba(255,255,255,0.28)}
  #label{font-size:11px;opacity:0.7;margin-top:10px;letter-spacing:0.06em;text-transform:uppercase}
</style>
</head>
<body>
  <div id="t">${displayText}</div>
  <div id="row">
    <button id="toggle">${running ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة")}</button>
    <button id="reset">${tr(isAr, "Reset", "إعادة")}</button>
  </div>
  <div id="label">${tr(isAr, "Two Tongues · Timer", "لسانان · مؤقّت")}</div>
<script>
  const ch = new BroadcastChannel("${CHANNEL_NAME}");
  const t = document.getElementById("t");
  const toggle = document.getElementById("toggle");
  let isRunning = ${running ? "true" : "false"};
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (!m || m.type !== "state") return;
    if (m.display) t.textContent = m.display;
    isRunning = !!m.running;
    toggle.textContent = isRunning ? ${JSON.stringify(tr(isAr, "Pause", "إيقاف"))} : ${JSON.stringify(tr(isAr, "Resume", "متابعة"))};
  };
  toggle.onclick = () => {
    ch.postMessage({ type: "control", action: isRunning ? "pause" : "resume" });
  };
  document.getElementById("reset").onclick = () => {
    ch.postMessage({ type: "control", action: "reset" });
  };
</script>
</body>
</html>`;
  }

  function goBubble() {
    setViewMode("bubble");
    setPipOpen(true);
    setErrorMsg("");
  }

  function expandFromBubble() {
    setViewMode("full");
    setPipOpen(false);
  }

  function handleClose() {
    // While running on mobile, minimize to bubble instead of killing the timer.
    if (runningRef.current || running) {
      goBubble();
      return;
    }
    onClose();
  }

  async function openMiniWindow() {
    // Phones: in-app floating bubble (window.open → full about:blank tab).
    if (isMobileLike()) {
      goBubble();
      return;
    }

    // Prefer Document Picture-in-Picture when available (Chrome desktop).
    if (window.documentPictureInPicture && !window.documentPictureInPicture.window) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 200,
        });
        pipWinRef.current = pip;
        setPipOpen(true);
        const doc = pip.document;
        doc.head.innerHTML = "";
        doc.body.innerHTML = "";
        const style = doc.createElement("style");
        style.textContent = `
          *{box-sizing:border-box;margin:0;padding:0}
          html,body{height:100%;overflow:hidden;font-family:${fontCss}}
          body{display:flex;flex-direction:column;align-items:center;justify-content:center;
            background:${prefs.customBg ? "#111" : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value)};
            color:${prefs.textColor};user-select:none}
          #t{font-size:clamp(28px,14vw,64px);font-weight:700;font-variant-numeric:tabular-nums;
            text-shadow:0 2px 20px rgba(0,0,0,0.35)}
          #row{display:flex;gap:8px;margin-top:14px}
          button{border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;
            cursor:pointer;background:rgba(255,255,255,0.18);color:inherit}
        `;
        doc.head.appendChild(style);
        const tEl = doc.createElement("div");
        tEl.id = "t";
        tEl.textContent = displayText;
        doc.body.appendChild(tEl);
        const row = doc.createElement("div");
        row.id = "row";
        const pauseBtn = doc.createElement("button");
        pauseBtn.textContent = running ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة");
        pauseBtn.onclick = () => {
          channelRef.current?.postMessage({ type: "control", action: runningRef.current ? "pause" : "resume" });
        };
        const resetBtn = doc.createElement("button");
        resetBtn.textContent = tr(isAr, "Reset", "إعادة");
        resetBtn.onclick = () => channelRef.current?.postMessage({ type: "control", action: "reset" });
        row.appendChild(pauseBtn);
        row.appendChild(resetBtn);
        doc.body.appendChild(row);

        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.onmessage = (ev) => {
          const m = ev.data;
          if (!m || m.type !== "state") return;
          if (m.display) tEl.textContent = m.display;
          pauseBtn.textContent = m.running
            ? tr(isAr, "Pause", "إيقاف")
            : tr(isAr, "Resume", "متابعة");
        };
        pip.addEventListener("pagehide", () => {
          try { ch.close(); } catch {}
          pipWinRef.current = null;
          setPipOpen(false);
        });
        return;
      } catch (e) {
        // fall through
      }
    }

    // Desktop popup fallback — never use this path on mobile.
    try {
      const w = window.open(
        "",
        "twoTonguesTimer",
        "width=360,height=240,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
      );
      if (!w) {
        // Popup blocked → in-app bubble instead of failing.
        goBubble();
        return;
      }
      pipWinRef.current = w;
      setPipOpen(true);
      w.document.open();
      w.document.write(buildMiniHtml());
      w.document.close();
      w.addEventListener("beforeunload", () => {
        pipWinRef.current = null;
        setPipOpen(false);
      });
    } catch {
      goBubble();
    }
  }

  // Keep control refs current for BroadcastChannel + visibility handlers.
  controlsRef.current = { start, pause, reset, openMini: openMiniWindow };
  runningRef.current = running;

  const panelBg = isLightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)";
  const panelBorder = isLightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)";
  const muted = isLightBg ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const btnPrimary = {
    padding: "12px 22px",
    borderRadius: 12,
    border: "none",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    background: "linear-gradient(135deg, var(--accent-1, #19A7CE), var(--accent-2, #146C94))",
    color: "#fff",
    boxShadow: "0 10px 24px -12px rgba(0,0,0,0.45)",
  };
  const btnGhost = {
    padding: "10px 16px",
    borderRadius: 12,
    border: `1px solid ${panelBorder}`,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    background: panelBg,
    color: prefs.textColor,
  };
  const field = {
    width: 64,
    padding: "10px 8px",
    borderRadius: 10,
    border: `1px solid ${panelBorder}`,
    background: panelBg,
    color: prefs.textColor,
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  };

  // ---------- In-app floating bubble (mobile-safe mini timer) ----------
  if (viewMode === "bubble") {
    const bubbleBg = prefs.customBg
      ? "#1a1a1a"
      : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value);
    const left = bubblePos.x != null ? bubblePos.x : undefined;
    const top = bubblePos.y != null ? bubblePos.y : undefined;
    const useDefaultCorner = bubblePos.x == null;

    const onPointerDown = (e) => {
      // Only drag from the shell, not from buttons
      if (e.target.closest("button")) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      };
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const { ox, oy, w, h } = dragRef.current;
      const x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - ox));
      const y = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY - oy));
      setBubblePos({ x, y });
    };
    const onPointerUp = () => { dragRef.current = null; };

    const bubble = (
      <div
        role="dialog"
        aria-label={tr(isAr, "Mini timer", "مؤقّت مصغّر")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "fixed",
          zIndex: 3000,
          ...(useDefaultCorner
            ? { bottom: "max(16px, env(safe-area-inset-bottom))", insetInlineEnd: 16 }
            : { left, top }),
          minWidth: 168,
          maxWidth: "min(240px, calc(100vw - 24px))",
          padding: "14px 16px 12px",
          borderRadius: 18,
          background: bubbleBg,
          color: prefs.textColor,
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
          fontFamily: fontCss,
        }}
      >
        <div
          style={{
            fontSize: "clamp(28px, 8vw, 36px)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
            lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {displayText}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => (running ? pause() : start())}
            style={{
              border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.2)", color: "inherit",
            }}
          >
            {running ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة")}
          </button>
          <button
            type="button"
            onClick={expandFromBubble}
            style={{
              border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.2)", color: "inherit",
            }}
          >
            {tr(isAr, "Expand", "تكبير")}
          </button>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            style={{
              border: "none", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.12)", color: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label={tr(isAr, "Close", "إغلاق")}
          >
            <XIcon size={12} />
          </button>
        </div>
      </div>
    );

    return typeof document !== "undefined" ? createPortal(bubble, document.body) : bubble;
  }


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        background: bgCss,
        color: prefs.textColor,
        overflow: "auto",
        transition: "background 0.35s ease",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          gap: 8,
          background: isLightBg ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${panelBorder}`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "flex", color: prefs.textColor, opacity: 0.9, flexShrink: 0 }}>
            <ClockIcon size={20} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tr(isAr, "Study Timer", "مؤقّت المذاكرة")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setShowSettings((s) => !s)} style={{ ...btnGhost, padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}>
            {showSettings ? tr(isAr, "Hide", "إخفاء") : tr(isAr, "Settings", "إعدادات")}
          </button>
          <button
            type="button"
            onClick={openMiniWindow}
            style={{ ...btnGhost, padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}
            title={tr(isAr, "Open mini floating timer", "فتح مؤقّت عائم صغير")}
          >
            {tr(isAr, "Mini", "مصغّر")}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              ...btnGhost,
              width: 40,
              height: 40,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {/* Main display */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px 40px",
          gap: 28,
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontFamily: fontCss,
            fontSize: `clamp(42px, ${Math.max(8, prefs.fontSize * 0.12)}vw, ${prefs.fontSize}px)`,
            fontWeight: 700,
            letterSpacing: "0.03em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            textShadow: isLightBg ? "none" : "0 4px 40px rgba(0,0,0,0.35)",
            animation: doneFlash ? "timerPulse 0.6s ease 3" : undefined,
            transition: "font-size 0.2s ease, color 0.2s ease",
          }}
        >
          {displayText}
        </div>

        {doneFlash && (
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.95 }}>
            {tr(isAr, "Time's up!", "انتهى الوقت!")}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {!running ? (
            <button type="button" onClick={start} style={btnPrimary}>
              {tr(isAr, "Start", "ابدأ")}
            </button>
          ) : (
            <button type="button" onClick={pause} style={btnPrimary}>
              {tr(isAr, "Pause", "إيقاف مؤقت")}
            </button>
          )}
          <button type="button" onClick={reset} style={btnGhost}>
            {tr(isAr, "Reset", "إعادة تعيين")}
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              maxWidth: 420,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(220,38,38,0.18)",
              border: "1px solid rgba(220,38,38,0.45)",
              color: isLightBg ? "#991b1b" : "#fecaca",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {errorMsg}
          </div>
        )}

        {pipOpen && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {tr(isAr, "Mini timer window is open.", "نافذة المؤقّت الصغيرة مفتوحة.")}
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            flexShrink: 0,
            maxHeight: "48vh",
            overflowY: "auto",
            padding: "18px 20px 28px",
            background: isLightBg ? "rgba(251,247,239,0.97)" : "rgba(12,16,22,0.97)",
            backdropFilter: "blur(14px)",
            borderTop: `1px solid ${panelBorder}`,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Mode */}
            <section>
              <Label muted={muted}>{tr(isAr, "Mode", "الوضع")}</Label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "countdown", en: "Countdown", ar: "عدّ تنازلي" },
                  { id: "stopwatch", en: "Stopwatch", ar: "ساعة توقيت" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      updatePref({ mode: m.id });
                      setRunning(false);
                      endAtRef.current = null;
                      startedAtRef.current = null;
                      accumulatedRef.current = 0;
                      setElapsedMs(0);
                      if (m.id === "countdown") {
                        const total = parseHms(hours, mins, secs) || 25 * 60 * 1000;
                        setRemainingMs(total);
                      } else {
                        setRemainingMs(0);
                      }
                    }}
                    style={{
                      ...btnGhost,
                      background: prefs.mode === m.id ? "rgba(255,255,255,0.28)" : panelBg,
                      outline: prefs.mode === m.id ? `2px solid ${prefs.textColor}` : "none",
                      outlineOffset: 1,
                    }}
                  >
                    {tr(isAr, m.en, m.ar)}
                  </button>
                ))}
              </div>
            </section>

            {/* Duration — free, no hard cap beyond practical UI limits */}
            {prefs.mode === "countdown" && (
              <section>
                <Label muted={muted}>{tr(isAr, "Duration (no limit — set any time)", "المدة (بدون قيد — اختر أي وقت)")}</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                      style={field}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Hours", "ساعات")}</span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.5 }}>:</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={mins}
                      onChange={(e) => setMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                      style={field}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Minutes", "دقائق")}</span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.5 }}>:</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={secs}
                      onChange={(e) => setSecs(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                      style={field}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Seconds", "ثوانٍ")}</span>
                  </div>
                  <button type="button" onClick={applyDuration} style={{ ...btnGhost, marginInlineStart: 8 }}>
                    {tr(isAr, "Apply", "تطبيق")}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {[
                    { label: "5m", h: 0, m: 5, s: 0 },
                    { label: "15m", h: 0, m: 15, s: 0 },
                    { label: "25m", h: 0, m: 25, s: 0 },
                    { label: "45m", h: 0, m: 45, s: 0 },
                    { label: "1h", h: 1, m: 0, s: 0 },
                    { label: "2h", h: 2, m: 0, s: 0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setHours(p.h);
                        setMins(p.m);
                        setSecs(p.s);
                        setRemainingMs(parseHms(p.h, p.m, p.s));
                      }}
                      style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Font */}
            <section>
              <Label muted={muted}>{tr(isAr, "Font", "الخط")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => updatePref({ fontId: f.id })}
                    style={{
                      ...btnGhost,
                      fontFamily: f.css,
                      outline: prefs.fontId === f.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Size + color */}
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <Label muted={muted}>{tr(isAr, "Size", "الحجم")} — {prefs.fontSize}px</Label>
                <input
                  type="range"
                  min={36}
                  max={180}
                  value={prefs.fontSize}
                  onChange={(e) => updatePref({ fontSize: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: prefs.textColor }}
                />
              </div>
              <div>
                <Label muted={muted}>{tr(isAr, "Text color", "لون النص")}</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={prefs.textColor}
                    onChange={(e) => updatePref({ textColor: e.target.value })}
                    style={{ width: 48, height: 36, border: "none", background: "none", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", opacity: 0.8 }}>
                    {prefs.textColor}
                  </span>
                </div>
              </div>
            </section>

            {/* Backgrounds */}
            <section>
              <Label muted={muted}>{tr(isAr, "Background", "الخلفية")}</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
                {BG_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => updatePref({ bgId: b.id, customBg: null })}
                    title={tr(isAr, b.label.en, b.label.ar)}
                    style={{
                      height: 56,
                      borderRadius: 12,
                      border: prefs.bgId === b.id && !prefs.customBg ? `2px solid ${prefs.textColor}` : `1px solid ${panelBorder}`,
                      background: b.value,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px -6px rgba(0,0,0,0.35)",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
                <button type="button" onClick={() => fileInputRef.current?.click()} style={btnGhost}>
                  {tr(isAr, "Upload from device", "رفع من الجهاز")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onBgFile}
                />
                {prefs.customBg && (
                  <button type="button" onClick={clearCustomBg} style={btnGhost}>
                    {tr(isAr, "Remove custom image", "إزالة الصورة المخصصة")}
                  </button>
                )}
              </div>
              {prefs.customBg && (
                <div
                  style={{
                    marginTop: 10,
                    height: 72,
                    borderRadius: 12,
                    background: `center / cover no-repeat url(${prefs.customBg})`,
                    border: `2px solid ${prefs.textColor}`,
                  }}
                />
              )}
            </section>

            {/* Alarm + ambient sounds */}
            <section>
              <Label muted={muted}>{tr(isAr, "Alarm sound (when time is up)", "صوت المنبّه (عند انتهاء الوقت)")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALARM_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updatePref({ alarmId: s.id });
                      if (s.id !== "off") playAlarmSound(s.id, prefs.alarmVolume);
                    }}
                    style={{
                      ...btnGhost,
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: prefs.alarmId === s.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {tr(isAr, s.en, s.ar)}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, opacity: 0.75, minWidth: 72 }}>{tr(isAr, "Volume", "مستوى الصوت")}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.alarmVolume}
                  onChange={(e) => updatePref({ alarmVolume: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: prefs.textColor }}
                />
              </div>
            </section>

            <section>
              <Label muted={muted}>{tr(isAr, "Background sound (while running)", "صوت الخلفية (أثناء التشغيل)")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AMBIENT_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updatePref({ ambientId: s.id });
                      // Live preview: restart ambient if timer is running
                      if (runningRef.current) {
                        stopAmbient();
                        if (s.id !== "off") {
                          try {
                            const ctx = getAudioCtx();
                            if (ctx) ambientRef.current = createAmbientNode(ctx, s.id, prefs.ambientVolume);
                          } catch {}
                        }
                      } else if (s.id !== "off") {
                        // short preview
                        try {
                          const ctx = getAudioCtx();
                          if (!ctx) return;
                          const node = createAmbientNode(ctx, s.id, prefs.ambientVolume);
                          setTimeout(() => { try { node && node.stop(); } catch {} }, 1800);
                        } catch {}
                      }
                    }}
                    style={{
                      ...btnGhost,
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: prefs.ambientId === s.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {tr(isAr, s.en, s.ar)}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, opacity: 0.75, minWidth: 72 }}>{tr(isAr, "Volume", "مستوى الصوت")}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.ambientVolume}
                  onChange={(e) => {
                    const vol = Number(e.target.value);
                    updatePref({ ambientVolume: vol });
                    try { ambientRef.current && ambientRef.current.setVolume(vol); } catch {}
                  }}
                  style={{ flex: 1, accentColor: prefs.textColor }}
                />
              </div>
            </section>

            <p style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5, margin: 0 }}>
              {tr(
                isAr,
                "Tip: on phones, “Mini” shows a floating bubble inside the app (you can drag it). On desktop it opens a small system window. Closing while the timer runs minimizes to the bubble instead of stopping it.",
                "نصيحة: على الموبايل، «مصغّر» يعرض فقاعة عائمة داخل التطبيق (تقدر تسحبها). على الكمبيوتر تفتح نافذة نظام صغيرة. الإغلاق أثناء التشغيل يصغّر للفقاعة بدل ما يوقف المؤقّت."
              )}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

function Label({ children, muted }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: muted,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
