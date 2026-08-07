import { useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { srsLevelFromStats } from "../../lib/utils/quizHelpers";
import { XIcon, TrophyIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function LeaderboardModal({ accounts, sectionEntries, accountCode, sectionLabel, isAr, cfg, onClose }) {
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sectionIds = useMemo(() => new Set(sectionEntries.map((e) => e.id)), [sectionEntries]);

  const ranked = useMemo(() => {
    const rows = accounts.map((a) => {
      const studiedHere = ((a.studied) || []).filter((id) => sectionIds.has(id)).length;
      const srsStats = a.srsStats || {};
      // "studiedHere" is just a self-toggled flag — someone can mark a word
      // as studied without ever actually being quizzed on it. So ranking
      // uses quiz-verified progress instead: a word only counts once the
      // account has answered questions on it in the Quiz and reached at
      // least the "Familiar" accuracy level (see srsLevelFromStats).
      let verifiedHere = 0;
      let masteredHere = 0;
      for (const id of sectionIds) {
        const level = srsLevelFromStats(srsStats[id]);
        if (level >= 2) verifiedHere++;
        if (level === 3) masteredHere++;
      }
      const history = a.quizHistory || [];
      const totalScore = history.reduce((sum, h) => sum + (h.score || 0), 0);
      const totalQuestions = history.reduce((sum, h) => sum + (h.total || 0), 0);
      const avgPct = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : null;
      return { code: a.code, name: a.name, studiedHere, verifiedHere, masteredHere, avgPct, quizCount: history.length };
    });
    return rows
      .filter((r) => r.verifiedHere > 0 || r.quizCount > 0)
      .sort((a, b) => b.verifiedHere - a.verifiedHere || b.masteredHere - a.masteredHere || (b.avgPct || 0) - (a.avgPct || 0));
  }, [accounts, sectionIds]);

  const medalColors = ["#d4af37", "#a8a8a8", "#c98a4b"];

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="leaderboard-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="leaderboard-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <TrophyIcon size={19} color={BRASS} /> {tr(isAr, "Leaderboard", "الترتيب")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 16px" }}>
          {tr(isAr, "Ranked by words verified through the Quiz (not just marked \"studied\"); average quiz score and mastered words break ties.", "الترتيب حسب الكلمات اللي اتأكدت فعليًا عن طريق الاختبار (مش بس اللي اتعلّمت عليها \"درستها\")؛ متوسط نتيجة الاختبارات وعدد الكلمات المتقنة بيفصلوا التعادل.")}
        </p>
        {ranked.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--muted)", textAlign: "center", marginTop: 20 }}>
            {tr(isAr, "No one has been quizzed on any words here yet — take a quiz to be the first!", "محدش اتاختبر في أي كلمة هنا لسه — خد اختبار عشان تكون أول واحد!")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ranked.map((r, i) => {
              const isMe = r.code === accountCode;
              return (
                <div key={r.code} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 6,
                  background: isMe ? cfg.accentSoft : "var(--input-bg)",
                  border: isMe ? `1px solid ${cfg.accent}` : "1px solid transparent",
                }}>
                  <div style={{ width: 26, textAlign: "center", fontSize: 14, fontWeight: 700, color: i < 3 ? medalColors[i] : "var(--muted)" }}>
                    {i < 3 ? <TrophyIcon size={16} color={medalColors[i]} /> : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name} {isMe && <span style={{ fontSize: 11, fontWeight: 600, color: cfg.accent }}>({tr(isAr, "you", "انت")})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {tr(isAr, `${r.masteredHere} mastered`, `${r.masteredHere} متقنة`)}
                      {r.avgPct !== null && ` · ${tr(isAr, `Avg quiz score: ${r.avgPct}%`, `متوسط الاختبارات: ${r.avgPct}%`)}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cfg.accent }}>{r.verifiedHere}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   STUDY REMINDER
   -------------------------------------------------------------------------
   A small dismissible banner shown when the signed-in account hasn't
   studied anything (in ANY section) in over a day. Also offers to turn on
   browser notifications for a nudge next time the app is opened after a
   gap — this is a soft, in-app reminder (fired when the page loads), NOT
   a true background/push notification while the site is closed, since
   that needs a service worker + push server this project doesn't have.
   Preferences are stored in localStorage, same pattern as the personal
   login code.
   ========================================================================= */

export default LeaderboardModal;
