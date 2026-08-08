// TTS + Whisper (in-browser) speech recognition helpers.
// English TTS prefers Cambridge Dictionary audio (US / UK) via
// /api/cambridge-audio, with browser speechSynthesis as fallback.
// STT uses @huggingface/transformers Whisper-tiny — no Web Speech API.

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

/**
 * Feature detection: Whisper path needs getUserMedia + AudioContext.
 * Kept name for compatibility with existing call sites that check
 * `!!getSpeechRecognitionCtor()`.
 */
export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  if (!(window.AudioContext || window.webkitAudioContext)) return null;
  return true;
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

// ---------------------------------------------------------------------------
// Whisper (in-browser) STT — replaces Web Speech API
// ---------------------------------------------------------------------------

let _whisperPipe = null;
let _whisperLoading = null;

/** Map BCP-47 / dialect codes to Whisper language ids. */
function whisperLangFrom(lang) {
  const s = String(lang || "").toLowerCase();
  if (s.startsWith("ar")) return "arabic";
  if (s.startsWith("en")) return "english";
  return "english";
}

/**
 * Lazy-load Xenova Whisper tiny (quantized). First call downloads ~40MB and
 * caches it in the browser; later calls reuse the same pipeline.
 */
export async function loadWhisperPipeline(onProgress) {
  if (_whisperPipe) return _whisperPipe;
  if (_whisperLoading) return _whisperLoading;

  _whisperLoading = (async () => {
    const mod = await import("@huggingface/transformers");
    const { pipeline, env } = mod;
    // Prefer remote weights from Hugging Face hub; cache in IndexedDB/Cache API.
    try {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
    } catch (_) {}

    const pipe = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      {
        quantized: true,
        progress_callback: typeof onProgress === "function" ? onProgress : undefined,
      }
    );
    _whisperPipe = pipe;
    return pipe;
  })();

  try {
    return await _whisperLoading;
  } catch (err) {
    _whisperLoading = null;
    throw err;
  }
}

/** Decode a recorded Blob to mono Float32Array @ 16 kHz for Whisper. */
async function blobToFloat32_16k(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    try { await ctx.close(); } catch (_) {}
  }

  // Mix down to mono
  const ch = decoded.numberOfChannels;
  const len = decoded.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / ch;
  }

  // Resample to 16 kHz if needed
  const srcRate = decoded.sampleRate;
  const targetRate = 16000;
  if (srcRate === targetRate) return mono;

  const newLen = Math.max(1, Math.round(len * (targetRate / srcRate)));
  const out = new Float32Array(newLen);
  const ratio = len / newLen;
  for (let i = 0; i < newLen; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, len - 1);
    const t = x - i0;
    out[i] = mono[i0] * (1 - t) + mono[i1] * t;
  }
  return out;
}

/**
 * Record mic audio for durationMs (or until silence after speech).
 * Calls onStart when capture begins. Returns a Blob (webm/ogg/mp4).
 */
function recordMicBlob({ durationMs = 3200, onStart, onLevel } = {}) {
  return new Promise(async (resolve, reject) => {
    let stream = null;
    let mediaRecorder = null;
    let ctx = null;
    let raf = null;
    const chunks = [];
    let settled = false;

    function cleanup() {
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch (_) {}
      try {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      try { if (ctx) ctx.close(); } catch (_) {}
    }

    function done(blob) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    }

    function fail(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // Optional live level meter from the same stream
      if (onLevel) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (settled) return;
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            onLevel(Math.min(1, sum / (data.length * 128)));
            raf = requestAnimationFrame(tick);
          };
          tick();
        } catch (_) {}
      }

      const mime =
        (typeof MediaRecorder !== "undefined" &&
          ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(
            (t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)
          )) ||
        "";

      mediaRecorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onerror = (e) => fail((e && e.error) || new Error("record failed"));
      mediaRecorder.onstop = () => {
        const type = (mediaRecorder && mediaRecorder.mimeType) || mime || "audio/webm";
        done(new Blob(chunks, { type }));
      };

      mediaRecorder.start(200);
      if (onStart) onStart();

      setTimeout(() => {
        try {
          if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        } catch (_) {
          fail(new Error("stop failed"));
        }
      }, Math.max(1200, durationMs));
    } catch (err) {
      fail(err);
    }
  });
}

/**
 * Capture speech with Whisper.
 * @param {string} lang  BCP-47 or dialect code (e.g. en-US, ar-EG)
 * @param {{ onStart?: Function, onLevel?: Function, onProgress?: Function, durationMs?: number }} [opts]
 * @returns {Promise<string>} transcript
 */
export async function recognizeSpeech(lang, { onStart, onLevel, onProgress, durationMs = 3200 } = {}) {
  if (!getSpeechRecognitionCtor()) {
    throw new Error("Speech recognition not supported");
  }

  // Load model (may download on first use)
  const pipe = await loadWhisperPipeline(onProgress);

  const blob = await recordMicBlob({
    durationMs,
    onStart,
    onLevel,
  });

  if (!blob || blob.size < 100) return "";

  const audio = await blobToFloat32_16k(blob);
  // Amplify quiet speech a bit before inference
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    const a = Math.abs(audio[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0 && peak < 0.25) {
    const gain = Math.min(4, 0.35 / peak);
    for (let i = 0; i < audio.length; i++) {
      audio[i] = Math.max(-1, Math.min(1, audio[i] * gain));
    }
  }

  const language = whisperLangFrom(lang);
  const result = await pipe(audio, {
    language,
    task: "transcribe",
    // Short clips: no chunking needed
    return_timestamps: false,
  });

  const text = typeof result === "string"
    ? result
    : (result && (result.text || result.output || "")) || "";
  return String(text || "").trim();
}

/**
 * Score spoken pronunciation against expected word via Whisper.
 * Returns { score, heard, transcript, passed, empty }.
 */
export async function scorePronunciation(expected, lang, onListening, onProgress, onLevel) {
  const target = String(expected || "").trim();
  const heard = await recognizeSpeech(lang || "en-US", {
    onStart: onListening,
    onProgress,
    onLevel,
    durationMs: 3000,
  });
  if (!heard) {
    return {
      score: 0,
      heard: "",
      transcript: "",
      passed: false,
      empty: true,
    };
  }
  const score = similarityScore(target, heard);
  const passed = score >= 60;
  return {
    score,
    heard,
    transcript: heard,
    passed,
    empty: false,
  };
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
