import { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { cambridgeUrl, shareWordCard } from "../../lib/utils/wordCard";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { getEntrySenses, posLabel } from "../../lib/utils/wordTypes";
import { getSpeechRecognitionCtor, scorePronunciation, AR_DIALECTS, loadArDialect, saveArDialect, loadEnAccent, enAccentLang, startVoiceRecording } from "../../lib/utils/speech";
import { LoaderIcon, ShareIcon, SpeakButton, XIcon, MicIcon } from "../common/Icons";
import { PairListDisplay } from "../common/PairList";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { useSwipeDownClose } from "../../lib/utils/useModalDismiss";

// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
export default function WordZoomModal({ entry, cfg, onClose, wordNote = "", onSaveNote, alreadyExists = false }) {
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
          background: CARD,
          borderRadius: 20,
          boxShadow: "0 28px 64px -16px rgba(0,0,0,0.5)",
          textAlign: "center",
          position: "relative",
          border: "1px solid rgba(var(--border-rgb),0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
        {/* Header outside scroll so nothing appears above it */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, zIndex: 3, padding: "14px 24px 10px", background: CARD, borderBottom: "1px solid rgba(var(--border-rgb),0.08)" }}>
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
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 24px 32px", flex: 1, minHeight: 0 }}>

        {alreadyExists && (
          <div
            role="status"
            style={{
              margin: "0 0 14px",
              padding: "10px 14px",
              borderRadius: 12,
              background: "color-mix(in srgb, var(--warning, #e6a817) 18%, transparent)",
              border: "1px solid color-mix(in srgb, var(--warning, #e6a817) 45%, transparent)",
              color: "var(--ink, #1a1a1a)",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.45,
              textAlign: "center",
            }}
          >
            {tr(isAr, "This word is already in your dictionary.", "الكلمة دي موجودة أصلًا في قاموسك.")}
          </div>
        )}

        {/* Word + single listen button (accent from settings) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(28px, 5.5vw, 44px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word", letterSpacing: "-0.01em" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={22} style={{ color: cfg.accent, flexShrink: 0 }} showBoth={false} />
        </div>
        <div style={{ width: 40, height: 3, background: `linear-gradient(90deg, ${cfg.accent}, transparent)`, borderRadius: 2, margin: "16px auto 18px" }} />
        {(() => {
          const senses = getEntrySenses(entry);
          if (senses.length > 1) {
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 420, margin: "0 auto" }}>
                {senses.map((s, i) => (
                  <div
                    key={s.id || i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "var(--input-bg)",
                      border: "1px solid rgba(var(--border-rgb),0.1)",
                    }}
                  >
                    {s.pos && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
                          color: "var(--accent-1)",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {posLabel(s.pos, isAr)}
                      </span>
                    )}
                    <div
                      className="entry-meaning-text"
                      dir="rtl"
                      lang="ar"
                      style={{
                        fontFamily: cfg.meaningFont,
                        fontSize: "clamp(17px, 3.8vw, 24px)",
                        color: "#22c55e",
                        fontWeight: 700,
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                      }}
                    >
                      {s.meaning}
                    </div>
                    <SpeakButton
                      text={s.meaning}
                      dir={cfg.meaningDir}
                      isAr={cfg.dir === "rtl"}
                      size={17}
                      style={{ color: "#22c55e", flexShrink: 0 }}
                      showBoth={false}
                    />
                  </div>
                ))}
              </div>
            );
          }
          // Single meaning (legacy or one sense)
          const one = senses[0]?.meaning || entry.meaning || "";
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(18px, 4vw, 26px)", color: "var(--meaning)", lineHeight: 1.4, wordBreak: "break-word" }}>
                {one}
              </div>
              {!!one && (
                <SpeakButton text={one} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={18} style={{ color: "var(--meaning)", flexShrink: 0 }} showBoth={false} />
              )}
            </div>
          );
        })()}
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
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", fontSize: 13, fontWeight: 700, color: "var(--on-accent, #fff)", background: micState !== "idle" ? "var(--muted)" : cfg.accent, border: "none", borderRadius: 999, cursor: micState !== "idle" ? "default" : "pointer" }}>
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
                color: "var(--on-accent, #fff)",
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
            aria-label={tr(cfg.dir === "rtl", "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
            className="lift-hover"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginTop: 18,
              padding: "10px 16px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #1a2744 0%, #2c3e6b 55%, #1D2A57 100%)",
              border: "1px solid rgba(196, 163, 90, 0.45)",
              boxShadow: "0 6px 18px rgba(29, 42, 87, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
              textDecoration: "none",
              color: "#F5E6C8",
              fontWeight: 700,
              fontSize: 13.5,
              letterSpacing: "0.02em",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(255,255,255,0.1)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="20" viewBox="0 0 24 28" fill="none" aria-hidden="true">
                <path d="M12 1.5C12 1.5 3.5 4.2 3.5 4.2V12.8C3.5 19.2 7.8 24.6 12 26.5C16.2 24.6 20.5 19.2 20.5 12.8V4.2S12 1.5 12 1.5Z" fill="#1D2A57" stroke="#C4A35A" strokeWidth="1.2" />
                <path d="M12 7.2V20.2M12 7.2C10.2 6.6 8.2 6.4 7 6.8V18.8C8.2 18.4 10.2 18.6 12 19.2M12 7.2C13.8 6.6 15.8 6.4 17 6.8V18.8C15.8 18.4 13.8 18.6 12 19.2" stroke="#E8D5A3" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12.5" r="1.35" fill="#C4A35A" />
              </svg>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#F8F1E3" }}>Cambridge</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(245,230,200,0.75)" }}>
                {tr(cfg.dir === "rtl", "Dictionary", "القاموس")}
              </span>
            </span>
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
    </div>
  );
}
