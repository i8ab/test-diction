// TTS + Web Speech Recognition helpers.
// English pronunciation prefers Cambridge Dictionary audio (US / UK) via
// /api/cambridge-audio, with browser speechSynthesis as fallback.

const EN_ACCENT_KEY = "twoTongues.enAccent";

export const EN_ACCENTS = [
  { code: "us", en: "American (US)", ar: "أمريكي", lang: "en-US" },
  { code: "uk", en: "British (UK)", ar: "بريطاني", lang: "en-GB" },
];

export function loadEnAccent() {
  try {
    const v = localStorage.getItem(EN_ACCENT_KEY);
    if (v === "us" || v === "uk") return v;
  } catch (_) {}
  return "us";
}

export function saveEnAccent(code) {
  try {
    if (code === "us" || code === "uk") localStorage.setItem(EN_ACCENT_KEY, code);
  } catch (_) {}
}

export function enAccentLang(code) {
  return code === "uk" ? "en-GB" : "en-US";
}

let _currentAudio = null;

function stopAllSpeech() {
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch (_) {}
  try {
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio.src = "";
      _currentAudio = null;
    }
  } catch (_) {}
}

/** Play Cambridge MP3 for an English word. Returns true if playback started. */
export async function playCambridgeAudio(text, accent) {
  if (!text || typeof window === "undefined") return false;
  const word = String(text).trim();
  if (!word || /[\u0600-\u06FF]/.test(word)) return false;
  const acc = accent === "uk" ? "uk" : "us";
  const url =
    "/api/cambridge-audio?word=" +
    encodeURIComponent(word) +
    "&accent=" +
    encodeURIComponent(acc);
  try {
    stopAllSpeech();
    const audio = new Audio(url);
    _currentAudio = audio;
    await new Promise((resolve, reject) => {
      let settled = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const fail = () => { if (!settled) { settled = true; reject(new Error("audio error")); } };
      audio.addEventListener("canplay", ok);
      audio.addEventListener("error", fail);
      if (audio.readyState >= 2) ok();
      else audio.load();
      setTimeout(() => { if (!settled) { settled = true; reject(new Error("timeout")); } }, 8000);
    });
    await audio.play();
    return true;
  } catch (_) {
    return false;
  }
}

function speakBrowser(text, lang) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang || "en-US";
    u.rate = 0.95;
    // Prefer a matching voice when the browser has one.
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const want = (lang || "").toLowerCase();
      const match =
        voices.find((v) => (v.lang || "").toLowerCase() === want) ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith(want.split("-")[0]));
      if (match) u.voice = match;
    } catch (_) {}
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

/**
 * Speak a word.
 * @param {string} text
 * @param {"ltr"|"rtl"|string} dir
 * @param {{ accent?: "us"|"uk" }} [opts]  force US/UK for English (overrides saved preference)
 */
export function speakWord(text, dir, opts = {}) {
  if (!text) return;
  const isRtl = dir === "rtl" || /[\u0600-\u06FF]/.test(String(text));
  if (isRtl) {
    stopAllSpeech();
    speakBrowser(text, loadArDialect());
    return;
  }
  const accent = opts.accent === "uk" || opts.accent === "us" ? opts.accent : loadEnAccent();
  const lang = enAccentLang(accent);
  // Fire-and-forget: try Cambridge, fall back to browser TTS.
  (async () => {
    const ok = await playCambridgeAudio(text, accent);
    if (!ok) speakBrowser(text, lang);
  })();
}

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const DIALECT_KEY = "twoTongues.arDialect";

export const AR_DIALECTS = [
  { code: "ar-EG", en: "Egyptian", ar: "مصري" },
  { code: "ar-SA", en: "Saudi", ar: "سعودي" },
  { code: "ar-AE", en: "Emirati", ar: "إماراتي" },
  { code: "ar-MA", en: "Moroccan", ar: "مغربي" },
  { code: "ar-LB", en: "Lebanese", ar: "لبناني" },
  { code: "ar", en: "Modern Standard", ar: "فصحى" },
];

export function loadArDialect() {
  try {
    const v = localStorage.getItem(DIALECT_KEY);
    if (v && AR_DIALECTS.some((d) => d.code === v)) return v;
  } catch (_) {}
  return "ar-EG";
}

export function saveArDialect(code) {
  try {
    localStorage.setItem(DIALECT_KEY, code);
  } catch (_) {}
}

export function recognizeSpeech(lang, { onStart } = {}) {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      reject(new Error("Speech recognition not supported"));
      return;
    }
    const rec = new Ctor();
    rec.lang = lang || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      if (onStart) onStart();
    };
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      resolve(text.trim());
    };
    rec.onerror = (e) => reject(e.error || e);
    rec.onend = () => {};
    try {
      rec.start();
    } catch (err) {
      reject(err);
    }
  });
}

function normalizeSpoken(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple pronunciation score 0–100 based on transcript similarity */
export async function scorePronunciation(expected, lang, onListening) {
  const heard = await recognizeSpeech(lang || "en-US", {
    onStart: onListening,
  });
  const a = normalizeSpoken(expected);
  const b = normalizeSpoken(heard);
  if (!a || !b) return { score: 0, heard };
  if (a === b) return { score: 100, heard };
  // Levenshtein-ish ratio
  const maxLen = Math.max(a.length, b.length);
  let dist = 0;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  dist = dp[m][n];
  const score = Math.max(0, Math.round((1 - dist / maxLen) * 100));
  return { score, heard };
}

/** Mic level meter via getUserMedia + AnalyserNode. Returns stop function. */
export function startMicLevelMeter(onLevel) {
  let stopped = false;
  let stream = null;
  let ctx = null;
  let raf = null;

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (stopped) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.min(1, sum / (data.length * 128));
        if (onLevel) onLevel(level);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {
      if (onLevel) onLevel(0);
    }
  })();

  return () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    try {
      if (ctx) ctx.close();
    } catch (_) {}
  };
}
