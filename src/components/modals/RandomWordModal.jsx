import { useState, useEffect, useMemo, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { isSrsDue } from "../../lib/utils/quizHelpers";
import { SpeakButton, XIcon, CheckIcon, EyeIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

/**
 * Fast "random word" practice: show word → Knew it / Forgot / Reveal.
 * Updates SRS via onRecordSrsAnswer.
 */
export default function RandomWordModal({
  entries,
  studiedIds,
  srsDueAt,
  isAr,
  section,
  onClose,
  onRecordSrsAnswer,
  onToggleStudied,
}) {
  const studiedSet = useMemo(
    () => (studiedIds instanceof Set ? studiedIds : new Set(studiedIds || [])),
    [studiedIds]
  );

  const pool = useMemo(() => {
    const list = (entries || []).filter((e) => e.section === section || !section);
    const due = list.filter((e) => studiedSet.has(e.id) && isSrsDue(e.id, srsDueAt));
    if (due.length >= 3) return due;
    const studied = list.filter((e) => studiedSet.has(e.id));
    if (studied.length >= 1) return studied;
    return list;
  }, [entries, studiedSet, srsDueAt, section]);

  const [current, setCurrent] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  const pickNext = useCallback(() => {
    if (!pool.length) {
      setCurrent(null);
      return;
    }
    const unseen = pool.filter((e) => !seenIds.includes(e.id));
    const source = unseen.length ? unseen : pool;
    const next = source[Math.floor(Math.random() * source.length)];
    setCurrent(next);
    setFlipped(false);
    if (!unseen.length) setSeenIds([next.id]);
    else setSeenIds((s) => [...s, next.id]);
  }, [pool, seenIds]);

  useEffect(() => {
    pickNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (!current) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
      if (e.key === "1" && flipped) handleKnew(true);
      if (e.key === "2" && flipped) handleKnew(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function handleKnew(ok) {
    if (!current) return;
    setSessionTotal((t) => t + 1);
    if (ok) setSessionCorrect((c) => c + 1);
    if (onRecordSrsAnswer) onRecordSrsAnswer(current.id, ok);
    if (ok && onToggleStudied && !studiedSet.has(current.id)) {
      onToggleStudied(current.id, true);
    }
    pickNext();
  }

  const cfgDir = current?.section === "ar-ar" ? "rtl" : "ltr";
  const wordFont = current?.section === "ar-ar" ? "'Amiri', serif" : "'Fraunces', serif";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "92dvh",
          overflow: "auto",
          background: CARD,
          borderRadius: 16,
          padding: "20px 18px 24px",
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: INK }}>
            {tr(isAr, "Random word", "كلمة عشوائية")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}
          >
            <XIcon size={22} />
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--muted)" }}>
          {sessionTotal > 0
            ? `${sessionCorrect}/${sessionTotal} ${tr(isAr, "this session", "في الجلسة")}`
            : tr(isAr, "Prefer due words when available", "يفضّل الكلمات المستحقة")}
        </p>

        {!current ? (
          <p style={{ textAlign: "center", color: "var(--muted-strong)", padding: 24 }}>
            {tr(isAr, "No words available in this section.", "مفيش كلمات في القسم ده.")}
          </p>
        ) : (
          <>
            <div
              onClick={() => setFlipped(true)}
              style={{
                minHeight: 140,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 16px",
                borderRadius: 14,
                border: "1px solid rgba(var(--border-rgb),0.15)",
                background: "var(--input-bg)",
                cursor: flipped ? "default" : "pointer",
                textAlign: "center",
                gap: 10,
              }}
            >
              <div dir={cfgDir} style={{ fontFamily: wordFont, fontSize: 28, fontWeight: 700, color: INK }}>
                {current.word}
              </div>
              <SpeakButton text={current.word} dir={cfgDir} isAr={isAr} size={22} style={{ color: BRASS }} />
              {flipped ? (
                <div dir="rtl" style={{ fontFamily: "'Amiri', serif", fontSize: 20, color: "var(--meaning)", marginTop: 6 }}>
                  {current.meaning}
                </div>
              ) : (
                <span style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <EyeIcon size={14} /> {tr(isAr, "Tap to reveal", "اضغط للإظهار")}
                </span>
              )}
              {flipped && current.example && (
                <div style={{ fontSize: 13, color: "var(--muted-strong)", marginTop: 4, fontStyle: "italic" }}>
                  {current.example}
                </div>
              )}
            </div>

            {flipped && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => handleKnew(false)}
                  style={{
                    flex: 1,
                    padding: "14px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  {tr(isAr, "Forgot", "نسيتها")}
                </button>
                <button
                  type="button"
                  onClick={() => handleKnew(true)}
                  style={{
                    flex: 1,
                    padding: "14px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <CheckIcon size={16} /> {tr(isAr, "Knew it", "عرفتها")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
