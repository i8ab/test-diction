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

/**
 * Capture one spoken phrase. Uses multiple alternatives and a longer capture
 * window so short words / letter-level differences are less likely to be lost.
 */
export function recognizeSpeech(lang, { onStart, timeoutMs = 14000 } = {}) {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      reject(new Error("Speech recognition not supported"));
      return;
    }
    const rec = new Ctor();
    rec.lang = lang || "en-US";
    // continuous + interim keeps the recognizer open longer so quiet or
    // slightly delayed speech is less likely to be dropped on first try.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 8;

    let settled = false;
    let best = "";
    let bestConf = -1;
    let silenceTimer = null;
    let hardTimer = null;
    let heardAnything = false;

    function finish(text) {
      if (settled) return;
      settled = true;
      try { clearTimeout(silenceTimer); } catch (_) {}
      try { clearTimeout(hardTimer); } catch (_) {}
      try { rec.stop(); } catch (_) {}
      resolve(String(text || best || "").trim());
    }

    function fail(err) {
      if (settled) return;
      settled = true;
      try { clearTimeout(silenceTimer); } catch (_) {}
      try { clearTimeout(hardTimer); } catch (_) {}
      try { rec.stop(); } catch (_) {}
      reject(err);
    }

    rec.onstart = () => {
      if (onStart) onStart();
      hardTimer = setTimeout(() => finish(best), timeoutMs);
    };

    rec.onspeechstart = () => {
      heardAnything = true;
      try { clearTimeout(silenceTimer); } catch (_) {}
    };

    rec.onspeechend = () => {
      // Longer grace so trailing syllables / quiet endings aren't cut off
      try { clearTimeout(silenceTimer); } catch (_) {}
      silenceTimer = setTimeout(() => finish(best), 900);
    };

    rec.onresult = (e) => {
      try {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (!result) continue;
          for (let j = 0; j < result.length; j++) {
            const alt = result[j];
            const t = (alt && alt.transcript) || "";
            const c = typeof alt.confidence === "number" ? alt.confidence : 0.45;
            // Prefer any non-empty transcript; accept lower confidence so
            // quiet speech still surfaces instead of being discarded.
            if (t && (c >= bestConf || !best)) {
              bestConf = c;
              best = t;
              heardAnything = true;
            }
          }
          if (result.isFinal && best) {
            // Short settle delay after final so late alternatives can arrive
            try { clearTimeout(silenceTimer); } catch (_) {}
            silenceTimer = setTimeout(() => finish(best), 350);
            return;
          }
        }
        // Reset silence grace whenever we get interim audio
        try { clearTimeout(silenceTimer); } catch (_) {}
        silenceTimer = setTimeout(() => finish(best), 1100);
      } catch (_) {
        /* keep listening */
      }
    };

    rec.onerror = (e) => {
      const code = (e && e.error) || "error";
      // no-speech / aborted still return whatever we caught
      if (code === "no-speech" || code === "aborted") {
        finish(best);
        return;
      }
      // network / audio-capture: still return partial if we heard something
      if (heardAnything && best) {
        finish(best);
        return;
      }
      fail(code);
    };

    rec.onend = () => {
      finish(best);
    };

    try {
      rec.start();
    } catch (err) {
      fail(err);
    }
  });
}

function normalizeSpoken(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Arabic letter variants
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    // Common English ASR confusions / filler
    .replace(/\b(uh|um|ah|er|the|a|an)\b/g, " ")
    .replace(/['']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse doubled letters so "bookk" ≈ "book" for scoring softness */
function collapseDoubles(s) {
  return String(s || "").replace(/(.)\1+/g, "$1");
}

/** Lightweight phonetic fold for English (helps letter discrimination) */
function phoneticFold(s) {
  let t = collapseDoubles(s);
  t = t
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/x/g, "ks")
    .replace(/tion/g, "shun")
    .replace(/sion/g, "zhun")
    .replace(/ough/g, "o")
    .replace(/igh/g, "i")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/([aeiou])\1+/g, "$1");
  return t;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
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
  return dp[m][n];
}

function similarityScore(expected, heard) {
  const a0 = normalizeSpoken(expected);
  const b0 = normalizeSpoken(heard);
  if (!a0 || !b0) return 0;
  if (a0 === b0) return 100;

  // Exact after collapse
  const a1 = collapseDoubles(a0);
  const b1 = collapseDoubles(b0);
  if (a1 === b1) return 98;

  // Phonetic fold
  const a2 = phoneticFold(a0);
  const b2 = phoneticFold(b0);
  if (a2 === b2) return 94;

  // Token containment (multi-word targets)
  if (a0.includes(b0) || b0.includes(a0)) {
    const ratio = Math.min(a0.length, b0.length) / Math.max(a0.length, b0.length);
    return Math.round(70 + ratio * 28);
  }

  const maxLen = Math.max(a0.length, b0.length);
  const dist = levenshtein(a0, b0);
  let score = Math.max(0, Math.round((1 - dist / maxLen) * 100));

  // Bonus if first/last letter match (letter discrimination feedback)
  if (a0[0] === b0[0]) score = Math.min(100, score + 4);
  if (a0[a0.length - 1] === b0[b0.length - 1]) score = Math.min(100, score + 3);

  // Phonetic distance as soft boost
  const pMax = Math.max(a2.length, b2.length) || 1;
  const pDist = levenshtein(a2, b2);
  const pScore = Math.max(0, Math.round((1 - pDist / pMax) * 100));
  score = Math.max(score, Math.round(score * 0.55 + pScore * 0.45));

  return Math.max(0, Math.min(100, score));
}

/**
 * Score spoken pronunciation against expected word.
 * Returns { score, heard, transcript, passed } for UI compatibility.
 */
export async function scorePronunciation(expected, lang, onListening) {
  const heard = await recognizeSpeech(lang || "en-US", {
    onStart: onListening,
    timeoutMs: 14000,
  });
  const score = similarityScore(expected, heard);
  // Slightly more forgiving pass threshold for quieter / accented speech
  const passed = score >= 65;
  return {
    score,
    heard,
    transcript: heard,
    passed,
  };
}

/** Mic level meter via getUserMedia + AnalyserNode. Returns stop function. */
export function startMicLevelMeter(onLevel) {
  let stopped = false;
  let stream = null;
  let ctx = null;
  let raf = null;

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Prefer pickup of quiet speech for the level meter visualization.
          // (SpeechRecognition uses its own mic path; this only drives the UI bars.)
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
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

/** Record microphone audio with MediaRecorder. Returns { stop, promise }. */
export function startVoiceRecording() {
  let mediaRecorder = null;
  let stream = null;
  const chunks = [];
  let resolveFn = null;
  let rejectFn = null;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const ready = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        resolveFn({ blob, url, mimeType: blob.type });
      };
      mediaRecorder.onerror = (e) => rejectFn(e.error || new Error("record failed"));
      mediaRecorder.start();
    } catch (err) {
      rejectFn(err);
    }
  })();

  return {
    ready,
    stop: async () => {
      await ready;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        try {
          if (stream) stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        rejectFn(new Error("not recording"));
      }
      return promise;
    },
    cancel: () => {
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch (_) {}
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    },
  };
}
