import { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { cambridgeUrl, shareWordCard } from "../../lib/utils/wordCard";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { getSpeechRecognitionCtor, scorePronunciation, AR_DIALECTS, loadArDialect, saveArDialect, loadEnAccent, enAccentLang, startVoiceRecording } from "../../lib/utils/speech";
import { LoaderIcon, ShareIcon, SpeakButton, XIcon, MicIcon } from "../common/Icons";
import { PairListDisplay } from "../common/PairList";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { useSwipeDownClose } from "../../lib/utils/useModalDismiss";

// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
export default function WordZoomModal({ entry, cfg, onClose, wordNote = "", onSaveNote }) {
  const swipe = useSwipeDownClose(onClose, { enabled: true });
  const [sharing, setSharing] = useState(false);
  const isAr = cfg.dir === "rtl";
  const [noteDraft, setNoteDraft] = useState(wordNote || "");

  useEffect(() => {
    setNoteDraft(wordNote || "");
  }, [wordNote, entry?.id]);

  // Pronunciation practice via in-browser Whisper (see scorePronunciation).
  // Hidden when the device has no mic / AudioContext support.
  const speechSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);
  // preparing = model download / mic arming; listening = recording (~3s)
  const [micState, setMicState] = useState("idle"); // idle | preparing | listening
  const [micLevel, setMicLevel] = useState(0);
  const [pronResult, setPronResult] = useState(null);
  const [pronError, setPronError] = useState("");
  const [arDialect, setArDialect] = useState(loadArDialect);
  const enAccent = loadEnAccent();
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
    setMicLevel(0);
    try {
      const lang = cfg.wordDir === "rtl" ? arDialect : enAccentLang(enAccent);
      const result = await scorePronunciation(
        entry.word,
        lang,
        () => setMicState("listening"),
        undefined,
        (lvl) => setMicLevel(lvl)
      );
      if (result && result.empty) {
        setPronError(
          tr(
            isAr,
            "Still couldn't hear you — speak a bit closer to the mic and try again.",
            "لسه معرفتش أسمعك — قرّب من الميك شوية وجرّب تاني."
          )
        );
      } else {
        setPronResult(result);
      }
    } catch (e) {
      const msg = String((e && e.message) || e || "");
      if (/not supported/i.test(msg)) {
        setPronError(tr(isAr, "Speech recognition isn't available on this device.", "التعرف على الصوت مش متاح على الجهاز ده."));
      } else {
        setPronError(tr(isAr, "Didn't catch that — try again.", "معرفتش أسمع صح — جرّب تاني."));
      }
    } finally {
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
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 5000 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} className="modal-card word-zoom-modal" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="zoom-modal-word"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "min(92dvh, 92vh)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: CARD,
          borderRadius: 20,
          padding: "14px 24px 32px",
          boxShadow: "0 28px 64px -16px rgba(0,0,0,0.5)",
          textAlign: "center",
          position: "relative",
          border: "1px solid rgba(var(--border-rgb),0.12)",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 3, margin: "0 -8px 8px", padding: "6px 8px", background: "color-mix(in srgb, var(--card, #fff) 92%, transparent)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 12 }}>
          <button onClick={handleShare} disabled={sharing} aria-label={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
            title={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
            style={{ border: "none", background: "var(--input-bg)", cursor: sharing ? "default" : "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}>
            {sharing ? <LoaderIcon size={18} /> : <ShareIcon size={18} />}
          </button>
          <button onClick={onClose} aria-label={tr(cfg.dir === "rtl", "Close", "إغلاق")}
            style={{ border: "none", background: "var(--input-bg)", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}>
            <XIcon size={18} />
          </button>
        </div>

        {/* Word + single listen button (accent from settings) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(28px, 5.5vw, 44px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word", letterSpacing: "-0.01em" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={22} style={{ color: cfg.accent, flexShrink: 0 }} showBoth={false} />
        </div>
        <div style={{ width: 40, height: 3, background: `linear-gradient(90deg, ${cfg.accent}, transparent)`, borderRadius: 2, margin: "16px auto 18px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(18px, 4vw, 26px)", color: "var(--meaning)", lineHeight: 1.4, wordBreak: "break-word" }}>
            {entry.meaning}
          </div>
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={18} style={{ color: "var(--meaning)", flexShrink: 0 }} showBoth={false} />
        </div>
        {speechSupported && (
          <div style={{ marginTop: 20, padding: "14px 14px 12px", borderRadius: 14, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            {cfg.wordDir === "rtl" && (
              <select value={arDialect} onChange={(e) => { setArDialect(e.target.value); saveArDialect(e.target.value); }}
                disabled={micState !== "idle"} aria-label={tr(isAr, "Dialect for voice recognition", "لهجة التعرف الصوتي")}
                style={{ display: "block", margin: "0 auto 10px", fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.25)", background: "var(--card)", color: "var(--muted-strong)" }}>
                {AR_DIALECTS.map((d) => <option key={d.code} value={d.code}>{tr(isAr, d.en, d.ar)}</option>)}
              </select>
            )}
            <button type="button" onClick={handlePracticePronunciation} disabled={micState !== "idle"}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "#fff", background: micState !== "idle" ? "var(--muted)" : cfg.accent, border: "none", borderRadius: 999, cursor: micState !== "idle" ? "default" : "pointer" }}>
              <MicIcon size={14} />
              {micState === "listening"
                ? tr(isAr, "Listening — speak now…", "بسمع — اتكلم دلوقتي…")
                : micState === "preparing"
                ? tr(isAr, "Getting ready…", "بتجهز…")
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
              <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, color: pronResult.passed ? "var(--success)" : "var(--muted-strong)" }}>
                <div>
                  {tr(
                    isAr,
                    `Heard: "${pronResult.transcript}" · Target: "${entry.word}" · ${pronResult.score}%`,
                    `سمعت: "${pronResult.transcript}" · المطلوب: "${entry.word}" · ${pronResult.score}%`
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.95 }}>
                  {pronResult.passed
                    ? `✓ ${tr(isAr, "Close enough — good!", "قريب كفاية — تمام!")}`
                    : tr(
                        isAr,
                        "Not a close match yet — say only the word, clearly, once.",
                        "لسه مش قريب — قول الكلمة لوحدها بوضوح مرة واحدة."
                      )}
                </div>
                {pronResult.raw && pronResult.raw !== pronResult.transcript && (
                  <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>
                    {tr(isAr, `Full transcript: "${pronResult.raw}"`, `التفريغ كامل: "${pronResult.raw}"`)}
                  </div>
                )}
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

        {typeof onSaveNote === "function" && (
          <div style={{ marginTop: 22, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 6 }}>
              {tr(isAr, "Personal note", "ملاحظة شخصية")}
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if ((noteDraft || "") !== (wordNote || "")) onSaveNote(noteDraft);
              }}
              rows={3}
              placeholder={tr(isAr, "Write a private note…", "اكتب ملاحظة خاصة…")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 10,
                border: "1px solid rgba(var(--border-rgb),0.2)",
                padding: "12px 14px",
                fontSize: 15,
                background: "var(--input-bg)",
                color: "var(--ink)",
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
