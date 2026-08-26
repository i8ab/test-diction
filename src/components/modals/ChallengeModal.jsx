import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  challengesForUser,
  createChallenge,
  acceptChallenge,
  declineChallenge,
  refreshChallengeProgress,
  loadChallenges,
} from "../../lib/state/challenges";
import { computeStreak } from "../../lib/utils/quizHelpers";
import { getTodayTimerMinutes } from "../../lib/state/goals";
import { XIcon, TrophyIcon, FlameIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const TYPES = [
  { id: "words", en: "New words studied", ar: "كلمات جديدة" },
  { id: "quizzes", en: "Quizzes finished", ar: "اختبارات مكتملة" },
  { id: "streak", en: "Day streak", ar: "سلسلة أيام" },
  { id: "minutes", en: "Study minutes", ar: "دقائق مذاكرة" },
];

export default function ChallengeModal({
  accountCode,
  accountName,
  accounts = [],
  isAr,
  onClose,
  showToast,
}) {
  const [list, setList] = useState(() => challengesForUser(accountCode));
  const [toCode, setToCode] = useState("");
  const [type, setType] = useState("words");
  const [target, setTarget] = useState(20);
  const [days, setDays] = useState(7);

  const others = useMemo(
    () => (accounts || []).filter((a) => a.code !== accountCode),
    [accounts, accountCode]
  );

  function refresh() {
    // update progress for active challenges
    const mine = challengesForUser(accountCode);
    const me = (accounts || []).find((a) => a.code === accountCode);
    const streakMe = computeStreak(me?.studiedAt || {});
    const minsMe = getTodayTimerMinutes();
    for (const c of mine) {
      if (c.status !== "active") continue;
      const otherCode = c.fromCode === accountCode ? c.toCode : c.fromCode;
      const other = (accounts || []).find((a) => a.code === otherCode);
      const streakOther = computeStreak(other?.studiedAt || {});
      refreshChallengeProgress(c, me, other, streakMe, streakOther, minsMe, 0);
    }
    setList(challengesForUser(accountCode));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCode, accounts]);

  function handleCreate() {
    if (!toCode) {
      showToast?.(tr(isAr, "Pick a friend", "اختر صديقاً"));
      return;
    }
    const other = others.find((a) => a.code === toCode);
    createChallenge({
      fromCode: accountCode,
      fromName: accountName || accountCode,
      toCode,
      toName: other?.name || toCode,
      type,
      target: Number(target) || 10,
      durationDays: Number(days) || 7,
    });
    refresh();
    showToast?.(tr(isAr, "Challenge sent", "تم إرسال التحدي"));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: CARD,
          borderRadius: "18px 18px 0 0",
          padding: "18px 16px 28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrophyIcon size={20} />
            <span style={{ fontSize: 18, fontWeight: 800, color: INK }}>
              {tr(isAr, "Friend challenges", "تحديات الأصدقاء")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <HowItWorksButton isAr={isAr} guideId="challenges" />
            <button type="button" onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}>
            <XIcon size={20} />
          </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>


        {others.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginBottom: 16 }}>
            {tr(isAr, "No other accounts in this shared dictionary yet.", "لا يوجد حسابات أخرى في هذا القاموس المشترك بعد.")}
          </div>
        ) : (
          <div style={{ marginBottom: 18, padding: 12, borderRadius: 12, background: "var(--input-bg)", border: "1px solid rgba(var(--border-rgb),0.12)" }}>
            <div style={{ ...labelStyle, marginTop: 0 }}>{tr(isAr, "Challenge a friend", "تحدَّ صديقاً")}</div>
            <select value={toCode} onChange={(e) => setToCode(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              <option value="">{tr(isAr, "Select friend…", "اختر صديقاً…")}</option>
              {others.map((a) => (
                <option key={a.code} value={a.code}>{a.name || a.username || a.code}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>{tr(isAr, t.en, t.ar)}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--muted-strong)", marginBottom: 4 }}>{tr(isAr, "Target", "الهدف")}</div>
                <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--muted-strong)", marginBottom: 4 }}>{tr(isAr, "Days", "أيام")}</div>
                <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button type="button" onClick={handleCreate} style={{ ...primaryBtnStyle, marginTop: 4 }}>
              {tr(isAr, "Send challenge", "إرسال التحدي")}
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--muted-strong)", padding: 20, fontSize: 14 }}>
              {tr(isAr, "No challenges yet", "لا توجد تحديات بعد")}
            </div>
          )}
          {list.map((c) => {
            const iAmFrom = c.fromCode === accountCode;
            const myProg = iAmFrom ? c.fromProgress : c.toProgress;
            const theirProg = iAmFrom ? c.toProgress : c.fromProgress;
            const theirName = iAmFrom ? c.toName : c.fromName;
            const pct = Math.min(100, Math.round((myProg / (c.target || 1)) * 100));
            return (
              <div key={c.id} style={{ border: "1px solid rgba(var(--border-rgb),0.14)", borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, color: INK }}>
                    {tr(isAr, `vs ${theirName}`, `ضد ${theirName}`)}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: BRASS, textTransform: "uppercase" }}>{c.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-strong)", marginBottom: 8 }}>
                  {TYPES.find((t) => t.id === c.type)?.[isAr ? "ar" : "en"] || c.type} · {tr(isAr, "Target", "الهدف")} {c.target}
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--input-bg)", overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: INK }}>
                  <span>{tr(isAr, "You", "أنت")}: {myProg}</span>
                  <span>{theirName}: {theirProg}</span>
                </div>
                {c.status === "pending" && c.toCode === accountCode && (
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        acceptChallenge(c.id);
                        refresh();
                      }}
                      style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}
                    >
                      {tr(isAr, "Accept", "قبول")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        declineChallenge(c.id);
                        refresh();
                      }}
                      style={{ flex: 1, marginTop: 0, padding: "12px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "transparent", cursor: "pointer", fontWeight: 700 }}
                    >
                      {tr(isAr, "Decline", "رفض")}
                    </button>
                  </div>
                )}
                {c.status === "completed" && (
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--accent-1)" }}>
                    {c.winner === accountCode
                      ? tr(isAr, "You won! 🏆", "انت كسبت! 🏆")
                      : c.winner
                        ? tr(isAr, "They won", "هم كسبوا")
                        : tr(isAr, "Draw", "تعادل")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
