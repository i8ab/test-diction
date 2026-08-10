import { useMemo, useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, primaryBtnStyle } from "../../lib/config/theme";
import { XIcon, TrophyIcon, StarIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { loadXp, levelFromXp, LEVELS, XP_REWARDS, XP_RULES } from "../../lib/state/xp";

export default function LevelsModal({ accountCode, isAr, onClose }) {
  const [xpData, setXpData] = useState(() => loadXp(accountCode));

  useEffect(() => {
    setXpData(loadXp(accountCode));
  }, [accountCode]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = useMemo(() => levelFromXp(xpData.total), [xpData.total]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Levels & XP", "المستويات والنقاط")}
      style={{
        position: "fixed", inset: 0, zIndex: 6000, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <BodyScrollLock />
      <div
        className="modal-card responsive-modal"
        style={{
          width: "100%", maxWidth: 480, maxHeight: "92dvh", overflow: "auto",
          background: CARD, borderRadius: 18, padding: "18px 18px 22px",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #f5c542, #d4a017)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <TrophyIcon size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>
              {tr(isAr, "Levels & XP", "المستويات والنقاط")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6 }}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Current level card */}
        <div style={{
          padding: 18, borderRadius: 16,
          background: "linear-gradient(135deg, rgba(var(--focus-rgb),0.15), rgba(var(--focus-rgb),0.05))",
          border: "1px solid rgba(var(--focus-rgb),0.25)", marginBottom: 18,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--accent-1)" }}>
                {tr(isAr, `Level ${info.level}`, `المستوى ${info.level}`)}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginTop: 2 }}>
                {isAr ? info.titleAr : info.titleEn}
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-1)" }}>{xpData.total}</div>
              <div style={{ fontSize: 11, color: "var(--muted-strong)" }}>XP</div>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 10, borderRadius: 6, background: "rgba(var(--border-rgb),0.15)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${info.pct}%`,
              background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
              transition: "width 0.35s ease", borderRadius: 6,
            }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-strong)" }}>
            {info.next
              ? tr(isAr, `${info.next.xp - xpData.total} XP to level ${info.next.level}`, `${info.next.xp - xpData.total} نقطة للمستوى ${info.next.level}`)
              : tr(isAr, "Max level reached!", "وصلت لأعلى مستوى!")}
          </div>
        </div>

        {/* How to earn */}
        <div style={{
          padding: 12, borderRadius: 12, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5,
          background: "rgba(var(--focus-rgb),0.08)", border: "1px solid rgba(var(--focus-rgb),0.18)", color: "var(--muted-strong)",
        }}>
          {(isAr ? XP_RULES.ar : XP_RULES.en).map((line, i) => (
            <div key={i} style={{ marginBottom: i < 4 ? 4 : 0 }}>• {line}</div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted-strong)", marginBottom: 8 }}>
          {tr(isAr, "How to earn XP (once each)", "إزاي تكسب نقاط (مرة واحدة لكل إنجاز)")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {[
            { en: "First study word", ar: "أول مذاكرة لكلمة", n: XP_REWARDS.studyWordFirst },
            { en: "First quiz correct", ar: "أول إجابة صح للكلمة", n: XP_REWARDS.quizCorrectFirst },
            { en: "SRS level up", ar: "ترقية SRS", n: XP_REWARDS.srsPromote },
            { en: "Master a word", ar: "إتقان كلمة", n: XP_REWARDS.srsMaster },
            { en: "Quiz finished", ar: "إنهاء اختبار", n: XP_REWARDS.quizSessionComplete },
            { en: "Perfect quiz", ar: "اختبار كامل", n: XP_REWARDS.quizPerfect },
            { en: "Smart card (1st)", ar: "بطاقة ذكية (أول مرة)", n: XP_REWARDS.smartCardFirst },
            { en: "Dictation (1st)", ar: "إملاء (أول مرة)", n: XP_REWARDS.dictationWordFirst },
            { en: "Conversation / day", ar: "محادثة / يوم", n: XP_REWARDS.conversationScenario },
            { en: "Daily open", ar: "فتح يومي", n: XP_REWARDS.dailyOpen },
            { en: "Streak milestone", ar: "إنجاز سلسلة", n: XP_REWARDS.dailyStreakBonus },
            { en: "Extract word", ar: "استخراج كلمة", n: XP_REWARDS.extractBatch },
          ].map((row) => (
            <div key={row.en} style={{
              padding: "10px 12px", borderRadius: 10, background: "var(--input-bg)",
              border: "1px solid rgba(var(--border-rgb),0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 12.5, color: INK }}>{isAr ? row.ar : row.en}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-1)", flexShrink: 0 }}>+{row.n}</span>
            </div>
          ))}
        </div>

        {/* All levels */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted-strong)", marginBottom: 8 }}>
          {tr(isAr, "All levels", "كل المستويات")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVELS.map((lv) => {
            const unlocked = xpData.total >= lv.xp;
            const isCurrent = lv.level === info.level;
            return (
              <div
                key={lv.level}
                style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: isCurrent ? "rgba(var(--focus-rgb),0.12)" : "var(--input-bg)",
                  border: isCurrent ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.12)",
                  opacity: unlocked ? 1 : 0.55,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: unlocked ? "linear-gradient(135deg, #f5c542, #d4a017)" : "rgba(var(--border-rgb),0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: unlocked ? "#fff" : "var(--muted-strong)", fontWeight: 800, fontSize: 14,
                }}>
                  {lv.level}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{isAr ? lv.titleAr : lv.titleEn}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-strong)" }}>
                    {lv.xp} XP
                    {lv.rewardEn ? ` · ${isAr ? lv.rewardAr : lv.rewardEn}` : ""}
                  </div>
                </div>
                {unlocked && <StarIcon size={16} style={{ color: "#f5c542" }} />}
              </div>
            );
          })}
        </div>

        <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 18 }}>
          {tr(isAr, "Close", "إغلاق")}
        </button>
      </div>
    </div>
  );
}
