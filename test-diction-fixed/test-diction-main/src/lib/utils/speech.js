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
function recognizeSpeech(lang) {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) { reject(new Error("unsupported")); return; }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let settled = false;
    rec.onresult = (e) => {
      settled = true;
      const text = e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript;
      if (text) resolve(text.trim()); else reject(new Error("empty"));
    };
    rec.onerror = (e) => { if (!settled) { settled = true; reject(new Error(e.error || "recognition failed")); } };
    rec.onend = () => { if (!settled) reject(new Error("no match")); };
    try { rec.start(); } catch (e) { reject(e); }
  });
}

function speakWord(text, dir) {
  if (!text) return;
  if (dir === "rtl") speakArabic(text);
  else speakEnglish(text);
}

export { waitForVoices, findArabicVoice, playOnlineArabic, speakArabic, speakEnglish, getSpeechRecognitionCtor, recognizeSpeech, speakWord };
