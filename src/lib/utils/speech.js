// Text-to-speech (local voice + online fallback) and speech-recognition
// helpers used for word pronunciation and voice search.

function waitForVoices(timeoutMs) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length) return resolve(existing);
    let done = false;
    const finish = (list) => {
      if (done) return;
      done = true;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(list || []);
    };
    window.speechSynthesis.onvoiceschanged = () => finish(window.speechSynthesis.getVoices());
    // Some browsers never fire voiceschanged if there's truly nothing to
    // report — poll as a backup so we don't wait forever.
    const start = Date.now();
    const poll = setInterval(() => {
      const list = window.speechSynthesis.getVoices();
      if ((list && list.length) || Date.now() - start > timeoutMs) {
        clearInterval(poll);
        finish(list);
      }
    }, 150);
  });
}

function findArabicVoice(voices) {
  const ar = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("ar"));
  if (ar.length) return ar.find((v) => /sa|eg|xa/i.test(v.lang)) || ar[0];
  return voices.find((v) => /arabic|عربي/i.test(v.name || "")) || null;
}

let ttsAudioEl = null;
function playOnlineArabic(text, onFail) {
  try {
    if (ttsAudioEl) { try { ttsAudioEl.pause(); } catch (e) {} }
    // StreamElements' free speech endpoint used to work here, but it now
    // requires an authenticated key and rejects unauthenticated requests —
    // so it's dead as a fallback. Instead we go through our own /api/tts
    // serverless proxy (api/tts.js), which fetches Google Translate's TTS
    // audio server-side (no CORS issue there) and streams it back to us.
    const url = "/api/tts?lang=ar&text=" + encodeURIComponent(text);
    const audio = new Audio(url);
    ttsAudioEl = audio;
    audio.addEventListener("error", () => onFail && onFail());
    const p = audio.play();
    if (p && p.catch) p.catch(() => onFail && onFail());
  } catch (e) {
    onFail && onFail();
  }
}

async function speakArabic(text) {
  const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;
  if (hasSynth) {
    const voices = await waitForVoices(1500);
    const arVoice = findArabicVoice(voices);
    if (arVoice) {
      let started = false;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = arVoice;
      utter.lang = arVoice.lang;
      utter.rate = 0.95;
      utter.onstart = () => { started = true; };
      setTimeout(() => window.speechSynthesis.speak(utter), 30);
      // Give it a beat to actually start; if it silently never does,
      // fall through to the online voice instead of staying silent.
      setTimeout(() => {
        if (!started) {
          playOnlineArabic(text, () => {
            window.alert(
              "تعذّر نطق الكلمة العربية: مفيش صوت عربي شغال على جهازك، وخدمة النطق الأونلاين محجوبة على الشبكة دي."
            );
          });
        }
      }, 700);
      return;
    }
  }
  // No local Arabic voice at all — go straight online.
  playOnlineArabic(text, () => {
    window.alert(
      "تعذّر نطق الكلمة العربية: مفيش صوت عربي مثبت على جهازك، وخدمة النطق الأونلاين مش متاحة (محجوبة على الشبكة أو مفيش إنترنت). جرّب تثبّت حزمة اللغة العربية لقارئ الشاشة/النطق من إعدادات الجهاز (Windows: Settings → Time & Language → Speech، أو أندرويد: Settings → Text-to-speech)."
    );
  });
}

function speakEnglish(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    setTimeout(() => window.speechSynthesis.speak(utter), 30);
  } catch (e) {
    console.error("English pronunciation error:", e);
  }
}

// Web Speech API's SpeechRecognition, prefixed in some browsers. Returns
// null when the browser has no support (e.g. Firefox, most non-Chromium
// mobile browsers) so callers can hide the mic button entirely.
function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Runs one voice-search capture. `lang` is a BCP-47 tag ("ar-EG"/"en-US").
// Resolves with the recognized text, or rejects on error/no-match — callers
// should catch and show a toast rather than let this throw uncaught.
//
// `opts.onStart` fires exactly when the recognizer is actually armed and
// picking up audio (the browser's `onstart` event) — NOT when this function
// is first called. There's a real gap between the two: `rec.start()` has to
// ask for mic permission (first time) and spin up the OS audio pipeline,
// which can take anywhere from ~100ms to over a second. If a caller flips
// its "Listening…" UI on immediately at call time, the user often starts
// talking right into that gap and the first word(s) — sometimes the whole
// utterance — never reach the recognizer at all, which is exactly the
// "I'm talking and it's not hearing me" symptom. Callers should wait for
// onStart before telling the user to speak.
//
// `opts.retriesOnNoSpeech` (default 1) silently restarts once if the
// browser reports "no-speech" (nothing detected before its own internal
// silence timeout — commonly because the user was still reacting to the UI
// switching to "Listening…" a beat earlier) instead of surfacing an error
// for what the user will experience as "it just didn't work that time".
function recognizeSpeech(lang, opts) {
  const { onStart, retriesOnNoSpeech = 1 } = opts || {};
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) { reject(new Error("unsupported")); return; }

    function attempt(retriesLeft) {
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let settled = false;
      rec.onstart = () => { onStart && onStart(); };
      rec.onresult = (e) => {
        settled = true;
        const text = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
        if (text) resolve(text.trim()); else reject(new Error("empty"));
      };
      rec.onerror = (e) => {
        if (settled) return;
        settled = true;
        if (e.error === "no-speech" && retriesLeft > 0) { attempt(retriesLeft - 1); return; }
        reject(new Error(e.error || "recognition failed"));
      };
      rec.onend = () => { if (!settled) reject(new Error("no match")); };
      try { rec.start(); } catch (e) { if (!settled) { settled = true; reject(e); } }
    }

    attempt(retriesOnNoSpeech);
  });
}

function speakWord(text, dir) {
  if (!text) return;
  if (dir === "rtl") speakArabic(text);
  else speakEnglish(text);
}

/* =========================================================================
   PRONUNCIATION PRACTICE
   -------------------------------------------------------------------------
   Records one utterance via the same SpeechRecognition API used for voice
   search, then grades how close it was to the target word using the same
   fuzzy typo-distance logic the quiz's typing mode already relies on
   (normalizeForTyping + levenshtein). Returns a 0-100 score instead of a
   hard pass/fail so the UI can show a graded result rather than just
   right/wrong.
   ========================================================================= */
import { levenshtein } from "./searchUtils";

function normalizeForCompare(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, ""); // strip Arabic diacritics
}

// Scores a spoken attempt against the target word: 100 = exact match,
// scaling down with edit distance relative to the word's length, floored
// at 0. `lang` is a BCP-47 tag ("ar-EG"/"en-US"), matching recognizeSpeech.
async function scorePronunciation(targetWord, lang, onStart) {
  const transcript = await recognizeSpeech(lang, { onStart });
  const target = normalizeForCompare(targetWord);
  const said = normalizeForCompare(transcript);
  if (!target) return { transcript, score: 0, passed: false };
  const dist = levenshtein(said, target);
  const score = Math.max(0, Math.round((1 - dist / Math.max(target.length, said.length, 1)) * 100));
  return { transcript, score, passed: score >= 75 };
}

export {
  waitForVoices, findArabicVoice, playOnlineArabic, speakArabic, speakEnglish,
  getSpeechRecognitionCtor, recognizeSpeech, speakWord, scorePronunciation,
};
