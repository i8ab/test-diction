import { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { cambridgeUrl, shareWordCard } from "../../lib/utils/wordCard";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { getSpeechRecognitionCtor, scorePronunciation, AR_DIALECTS, loadArDialect, saveArDialect, EN_ACCENTS, loadEnAccent, saveEnAccent, enAccentLang, startMicLevelMeter, startVoiceRecording } from "../../lib/utils/speech";
import { LoaderIcon, ShareIcon, SpeakButton, XIcon, MicIcon } from "../common/Icons";
import { PairListDisplay } from "../common/PairList";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { useSwipeDownClose } from "../../lib/utils/useModalDismiss";

// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
export default function WordZoomModal({ entry, cfg, onClose }) {
  const swipe = useSwipeDownClose(onClose, { enabled: true });
  const [sharing, setSharing] = useState(false);
  const isAr = cfg.dir === "rtl";

  // Pronunciation practice: record one attempt via the browser's speech
  // recognition and grade it against the target word (see
  // scorePronunciation in lib/utils/speech.js). Hidden entirely when the
  // browser has no SpeechRecognition support.
  const speechSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);
  // "preparing": button pressed, mic not armed yet (permission/hardware
  // startup) — the user should NOT talk yet, since audio in this window is
  // silently lost. "listening": the recognizer's own onstart fired, so it's
  // actually capturing audio now. Splitting these two states (instead of a
  // single "listening" flag flipped at click time) is what fixes attempts
  // being missed because the person started talking a beat too early.
  const [micState, setMicState] = useState("idle"); // idle | preparing | listening
  const [micLevel, setMicLevel] = useState(0); // 0..1, live mic volume while listening
  const [pronResult, setPronResult] = useState(null); // { transcript, score, passed } | null
  const [pronError, setPronError] = useState("");
  const [arDialect, setArDialect] = useState(loadArDialect);
  const [enAccent, setEnAccent] = useState(loadEnAccent);
  const [recState, setRecState] = useState("idle"); // idle | recording | ready
  const [recUrl, setRecUrl] = useState(null);
  const recCtlRef = useRef(null);

  async function handleToggleRecord() {
    if (recState === "recording") {
      try {
        const ctl = recCtlRef.current;
        const result = ctl ? await ctl.stop() : null;
        if (result && result.url) {
          setRecUrl((prev) => {
            if (prev) try { URL.revokeObjectURL(prev); } catch (_) {}
            return result.url;
          });
          setRecState("ready");
        } else {
          setRecState("idle");
        }
      } catch (_) {
        setRecState("idle");
      }
      recCtlRef.current = null;
      return;
    }
    // start
    if (recUrl) {
      try { URL.revokeObjectURL(recUrl); } catch (_) {}
      setRecUrl(null);
    }
    try {
      const ctl = startVoiceRecording();
      recCtlRef.current = ctl;
      setRecState("recording");
      await ctl.ready;
    } catch (_) {
      setRecState("idle");
      setPronError(tr(isAr, "Microphone permission denied", "تم رفض إذن الميكروفون"));
    }
  }


  async function handlePracticePronunciation() {
    if (micState !== "idle") return;
    setMicState("preparing");
    setPronError("");
    setPronResult(null);
    const stopMeter = startMicLevelMeter(setMicLevel);
    try {
      const lang = cfg.wordDir === "rtl" ? arDialect : enAccentLang(enAccent);
      const result = await scorePronunciation(entry.word, lang, () => setMicState("listening"));
      setPronResult(result);
    } catch (e) {
      setPronError(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
    } finally {
      stopMeter();
      setMicLevel(0);
      setMicState("idle");
    }
  }

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try { await shareWordCard(entry, cfg); } finally { setSharing(false); }
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 3600 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} className="modal-card word-zoom-modal" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="zoom-modal-word"
        style={{ width: "100%", maxWidth: 560, maxHeight: "min(92dvh, 92vh)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: CARD, borderRadius: 6, padding: "16px 32px 40px", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)", textAlign: "center", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 3, margin: "0 -8px 12px", padding: "4px 8px", background: "color-mix(in srgb, var(--card, #fff) 94%, transparent)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <button onClick={handleShare} disabled={sharing} aria-label={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
            title={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
            style={{ border: "none", background: "none", cursor: sharing ? "default" : "pointer", color: "var(--icon-muted)", padding: 6, borderRadius: 8 }}>
            {sharing ? <LoaderIcon size={19} /> : <ShareIcon size={19} />}
          </button>
          <button onClick={onClose} aria-label={tr(cfg.dir === "rtl", "Close", "إغلاق")}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6, borderRadius: 8 }}>
            <XIcon size={20} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={26} style={{ color: cfg.accent, flexShrink: 0 }} showBoth={cfg.wordDir !== "rtl"} />
        </div>
        <div style={{ width: 48, height: 3, background: cfg.accent, borderRadius: 2, margin: "18px auto" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(22px, 4.5vw, 30px)", color: "var(--meaning)", lineHeight: 1.35, wordBreak: "break-word" }}>
            {entry.meaning}
          </div>
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={20} style={{ color: "var(--meaning)", flexShrink: 0 }} />
        </div>
        {speechSupported && (
          <div style={{ marginTop: 18 }}>
            {cfg.wordDir === "rtl" ? (
              <select value={arDialect} onChange={(e) => { setArDialect(e.target.value); saveArDialect(e.target.value); }}
                disabled={micState !== "idle"} aria-label={tr(isAr, "Dialect for voice recognition", "لهجة التعرف الصوتي")}
                style={{ display: "block", margin: "0 auto 8px", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--input-bg)", color: "var(--muted-strong)" }}>
                {AR_DIALECTS.map((d) => <option key={d.code} value={d.code}>{tr(isAr, d.en, d.ar)}</option>)}
              </select>
            ) : (
              <select value={enAccent} onChange={(e) => { setEnAccent(e.target.value); saveEnAccent(e.target.value); }}
                disabled={micState !== "idle"} aria-label={tr(isAr, "English accent", "لهجة الإنجليزية")}
                style={{ display: "block", margin: "0 auto 8px", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--input-bg)", color: "var(--muted-strong)" }}>
                {EN_ACCENTS.map((d) => <option key={d.code} value={d.code}>{tr(isAr, d.en, d.ar)}</option>)}
              </select>
            )}
            <button type="button" onClick={handlePracticePronunciation} disabled={micState !== "idle"}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#fff", background: micState !== "idle" ? "var(--muted)" : cfg.accent, border: "none", borderRadius: 20, cursor: micState !== "idle" ? "default" : "pointer" }}>
              <MicIcon size={14} />
              {micState === "listening"
                ? tr(isAr, "Listening — speak now…", "بسمع دلوقتي — اتكلم…")
                : micState === "preparing"
                ? tr(isAr, "One sec…", "لحظة واحدة…")
                : tr(isAr, "Practice pronunciation", "تمرين النطق")}
            </button>
            {micState === "listening" && (
              <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: 18, marginTop: 8 }}>
                {[0.6, 1, 0.8, 1, 0.7].map((mult, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2, background: cfg.accent,
                    height: Math.max(3, micLevel * 18 * mult),
                    transition: "height 80ms linear",
                  }} />
                ))}
              </div>
            )}
            {pronResult && (
              <div style={{ marginTop: 10, fontSize: 13, color: pronResult.passed ? "var(--success)" : "var(--muted-strong)" }}>
                {tr(isAr, `You said "${pronResult.transcript}" — ${pronResult.score}% match`, `قلت "${pronResult.transcript}" — تطابق ${pronResult.score}%`)}
                {pronResult.passed
                  ? ` ✓ ${tr(isAr, "Nice!", "تمام!")}`
                  : ` — ${tr(isAr, "try again for a closer match.", "جرّب تاني عشان تقرّب أكتر.")}`}
                {!pronResult.passed && (
                  <button type="button" onClick={handlePracticePronunciation} disabled={micState !== "idle"}
                    style={{ display: "block", margin: "6px auto 0", border: "none", background: "none", color: cfg.accent, fontSize: 12, fontWeight: 700, cursor: micState !== "idle" ? "default" : "pointer", textDecoration: "underline" }}>
                    {tr(isAr, "Try again", "جرّب تاني")}
                  </button>
                )}
              </div>
            )}
            {pronError && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                {pronError}
                <button type="button" onClick={handlePracticePronunciation} disabled={micState !== "idle"}
                  style={{ display: "block", margin: "6px auto 0", border: "none", background: "none", color: cfg.accent, fontSize: 12, fontWeight: 700, cursor: micState !== "idle" ? "default" : "pointer", textDecoration: "underline" }}>
                  {tr(isAr, "Try again", "جرّب تاني")}
                </button>
              </div>
            )}
          </div>
        )}
        {/* Record your voice and play it back next to the model pronunciation */}
        <div style={{ marginTop: 16, padding: "12px 12px 10px", borderRadius: 12, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.14)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {tr(isAr, "Record & compare", "سجّل وقارن")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "center" }}>
            <button
              type="button"
              onClick={handleToggleRecord}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13,
                color: "#fff",
                background: recState === "recording" ? "var(--danger, #c0392b)" : "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
              }}
            >
              <MicIcon size={14} />
              {recState === "recording"
                ? tr(isAr, "Stop", "إيقاف")
                : tr(isAr, "Record my voice", "سجّل صوتي")}
            </button>
            {recUrl && (
              <audio controls src={recUrl} style={{ height: 32, maxWidth: "100%" }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-strong)", marginTop: 6, textAlign: "center" }}>
            {tr(isAr, "Play the speaker icon above, then your recording, to compare.", "شغّل أيقونة النطق فوق، ثم تسجيلك، للمقارنة.")}
          </div>
        </div>
        {cfg.wordDir === "ltr" && (

          <a
            href={cambridgeUrl(entry.word)}
            target="_blank"
            rel="noopener noreferrer"
            title={tr(cfg.dir === "rtl", "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
            style={{ display: "inline-flex", alignItems: "center", marginTop: 18, background: "#1D2A57", borderRadius: 3, padding: "6px 10px" }}
            className="lift-hover">
            <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(cfg.dir === "rtl", "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 20, display: "block" }} />
          </a>
        )}
        {entry.definition && (
          <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 15, color: "var(--muted-strong)", marginTop: 22, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            {entry.definition}
          </p>
        )}
        {entry.example && (
          <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 14, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{entry.example}”
          </p>
        )}
        {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
          <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 8, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{ex}”
          </p>
        ))}
        {!!(entry.synonyms && entry.synonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 16, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--success)" }}>{tr(cfg.dir === "rtl", "Synonyms", "مرادفات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.synonyms} />
          </div>
        )}
        {!!(entry.antonyms && entry.antonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 10, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--danger)" }}>{tr(cfg.dir === "rtl", "Antonyms", "مضادات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.antonyms} />
          </div>
        )}
      </div>
    </div>
  );
}
