import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { cambridgeUrl, shareWordCard } from "../../lib/utils/wordCard";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { getSpeechRecognitionCtor, scorePronunciation, AR_DIALECTS, loadArDialect, saveArDialect, startMicLevelMeter } from "../../lib/utils/speech";
import { LoaderIcon, ShareIcon, SpeakButton, XIcon, MicIcon } from "../common/Icons";
import { PairListDisplay } from "../common/PairList";

// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
export default function WordZoomModal({ entry, cfg, onClose }) {
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

  async function handlePracticePronunciation() {
    if (micState !== "idle") return;
    setMicState("preparing");
    setPronError("");
    setPronResult(null);
    const stopMeter = startMicLevelMeter(setMicLevel);
    try {
      const lang = cfg.wordDir === "rtl" ? arDialect : "en-US";
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
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="zoom-modal-word"
        style={{ width: "100%", maxWidth: 560, background: CARD, borderRadius: 6, padding: "48px 32px 40px", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)", textAlign: "center", position: "relative" }}>
        <button onClick={handleShare} disabled={sharing} aria-label={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          title={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          style={{ position: "absolute", top: 14, insetInlineStart: 14, border: "none", background: "none", cursor: sharing ? "default" : "pointer", color: "var(--icon-muted)" }}>
          {sharing ? <LoaderIcon size={19} /> : <ShareIcon size={19} />}
        </button>
        <button onClick={onClose} aria-label={tr(cfg.dir === "rtl", "Close", "إغلاق")} style={{ position: "absolute", top: 14, insetInlineEnd: 14, border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}>
          <XIcon size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={26} style={{ color: cfg.accent, flexShrink: 0 }} />
        </div>
        <div style={{ width: 48, height: 3, background: cfg.accent, borderRadius: 2, margin: "18px auto" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(22px, 4.5vw, 30px)", color: "var(--meaning)", lineHeight: 1.35, wordBreak: "break-word" }}>
            {entry.meaning}
          </div>
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={20} style={{ color: "var(--meaning)", flexShrink: 0 }} />
        </div>
        {speechSupported && (
          <div style={{ marginTop: 18 }}>
            {cfg.wordDir === "rtl" && (
              <select value={arDialect} onChange={(e) => { setArDialect(e.target.value); saveArDialect(e.target.value); }}
                disabled={micState !== "idle"} aria-label={tr(isAr, "Dialect for voice recognition", "لهجة التعرف الصوتي")}
                style={{ display: "block", margin: "0 auto 8px", fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--input-bg)", color: "var(--muted-strong)" }}>
                {AR_DIALECTS.map((d) => <option key={d.code} value={d.code}>{tr(isAr, d.en, d.ar)}</option>)}
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
