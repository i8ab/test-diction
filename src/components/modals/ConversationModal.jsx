import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, labelStyle, primaryBtnStyle } from "../../lib/config/theme";
import { shuffleArray } from "../../lib/utils/quizHelpers";
import { XIcon, MicIcon, CheckIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { SECTIONS } from "../../lib/config/sections";

/**
 * Simple conversation practice — scenario-based prompts that require
 * using target vocabulary words in short replies.
 */

const SCENARIOS = [
  {
    id: "cafe",
    en: "At a café",
    ar: "في مقهى",
    icon: "☕",
    prompts: [
      { en: "The waiter asks what you want to drink. Reply using one of your words.", ar: "النادل يسأل ماذا تريد أن تشرب. أجب مستخدماً إحدى كلماتك." },
      { en: "A friend asks if the place is quiet. Describe it with a word you know.", ar: "صديق يسأل إن كان المكان هادئاً. صفه بكلمة تعرفها." },
      { en: "You want to order food. Make a short polite request.", ar: "تريد طلب طعام. اطلب بأدب بجملة قصيرة." },
    ],
  },
  {
    id: "airport",
    en: "At the airport",
    ar: "في المطار",
    icon: "✈️",
    prompts: [
      { en: "An officer asks about your luggage. Reply briefly.", ar: "موظف يسأل عن أمتعتك. أجب باختصار." },
      { en: "Someone asks for directions to the gate. Help them using your words.", ar: "شخص يسأل عن بوابة الصعود. ساعده بكلماتك." },
      { en: "You need to explain a delay. Say one sentence.", ar: "تحتاج شرح تأخير. قل جملة واحدة." },
    ],
  },
  {
    id: "market",
    en: "At the market",
    ar: "في السوق",
    icon: "🛒",
    prompts: [
      { en: "Ask about the price of something using a target word.", ar: "اسأل عن سعر شيء مستخدماً كلمة مستهدفة." },
      { en: "The seller offers a discount. Accept or refuse politely.", ar: "البائع يعرض خصماً. اقبل أو ارفض بأدب." },
      { en: "Describe an item you want to buy in one sentence.", ar: "صف شيئاً تريد شراءه في جملة واحدة." },
    ],
  },
  {
    id: "school",
    en: "At school",
    ar: "في المدرسة",
    icon: "📚",
    prompts: [
      { en: "A classmate asks what you studied today. Answer with a word from your list.", ar: "زميل يسأل ماذا ذاكرت اليوم. أجب بكلمة من قائمتك." },
      { en: "The teacher asks if the lesson was clear. Reply honestly.", ar: "المعلم يسأل إن كان الدرس واضحاً. أجب بصدق." },
      { en: "Invite a friend to review vocabulary together.", ar: "ادعُ صديقاً لمراجعة المفردات معاً." },
    ],
  },
  {
    id: "doctor",
    en: "At the clinic",
    ar: "في العيادة",
    icon: "🏥",
    prompts: [
      { en: "Describe a simple symptom in one sentence.", ar: "صف عرضاً بسيطاً في جملة واحدة." },
      { en: "The doctor asks when it started. Answer briefly.", ar: "الطبيب يسأل متى بدأ. أجب باختصار." },
      { en: "Thank the doctor and ask one short question.", ar: "اشكر الطبيب واطرح سؤالاً قصيراً." },
    ],
  },
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => w && t.includes(String(w).toLowerCase()));
}

export default function ConversationModal({
  entries,
  studiedIds,
  isAr,
  onClose,
  onXp,
}) {
  const [scenarioId, setScenarioId] = useState(null);
  const [step, setStep] = useState(0);
  const [targets, setTargets] = useState([]);
  const [reply, setReply] = useState("");
  const [results, setResults] = useState([]); // { ok, reply, targets }
  const [phase, setPhase] = useState("pick"); // pick | play | done

  const studied = useMemo(() => {
    return (entries || []).filter((e) => studiedIds && studiedIds.has(e.id));
  }, [entries, studiedIds]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function start(id) {
    const pool = shuffleArray(studied).slice(0, 6);
    if (pool.length < 2) return;
    setScenarioId(id);
    setTargets(pool);
    setStep(0);
    setReply("");
    setResults([]);
    setPhase("play");
  }

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  const prompt = scenario && scenario.prompts[step % scenario.prompts.length];
  const roundTargets = targets.slice(step * 2, step * 2 + 2);
  // always show at least 2 target words cycling
  const shownTargets = roundTargets.length >= 1 ? roundTargets : targets.slice(0, 2);

  function submit() {
    const words = shownTargets.map((e) => e.word);
    const ok = reply.trim().length >= 3 && containsAny(reply, words);
    const nextResults = [...results, { ok, reply: reply.trim(), targets: words }];
    setResults(nextResults);
    setReply("");
    if (step + 1 >= 3) {
      setPhase("done");
      const good = nextResults.filter((r) => r.ok).length;
      if (good >= 2 && typeof onXp === "function") {
        try { onXp(scenarioId); } catch (_) {}
      }
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "Conversation practice", "تدريب محادثة")}
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
          width: "100%", maxWidth: 480, maxHeight: "92dvh", overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: CARD, borderRadius: 18, padding: "18px 18px 22px",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #af52de, #5e5ce6)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <MicIcon size={18} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: INK }}>
              {tr(isAr, "Conversation", "محادثة")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", padding: 6 }}>
            <XIcon size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>


        {phase === "pick" && (
          <div>
            <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {tr(
                isAr,
                "Pick a scenario. You'll get short prompts and must use your studied words in replies.",
                "اختر سيناريو. هتاخد أسئلة قصيرة ولازم تستخدم كلماتك المُذاكرة في الرد."
              )}
            </p>
            {studied.length < 2 && (
              <div style={{ padding: 12, borderRadius: 10, background: "var(--danger-bg)", color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>
                {tr(isAr, "Mark at least 2 words as studied first.", "علّم كلمتين على الأقل كمُذاكرة أولاً.")}
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={studied.length < 2}
                  onClick={() => start(s.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 14px",
                    borderRadius: 12, border: "1px solid rgba(var(--border-rgb),0.15)",
                    background: "var(--input-bg)", cursor: studied.length < 2 ? "not-allowed" : "pointer",
                    opacity: studied.length < 2 ? 0.5 : 1, textAlign: "start",
                  }}
                >
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: INK }}>{isAr ? s.ar : s.en}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "play" && scenario && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-1)", marginBottom: 6 }}>
              {scenario.icon} {isAr ? scenario.ar : scenario.en} · {step + 1}/3
            </div>
            <div style={{
              padding: 14, borderRadius: 12, background: "rgba(var(--focus-rgb),0.08)",
              border: "1px solid rgba(var(--focus-rgb),0.2)", marginBottom: 14, fontSize: 15, lineHeight: 1.5, color: INK,
            }}>
              {isAr ? prompt.ar : prompt.en}
            </div>

            <div style={labelStyle}>{tr(isAr, "Try to use", "حاول تستخدم")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {shownTargets.map((e) => {
                const cfg = SECTIONS[e.section] || SECTIONS["en-ar"];
                return (
                  <span
                    key={e.id}
                    dir={cfg.wordDir}
                    style={{
                      padding: "6px 12px", borderRadius: 20, fontSize: 14, fontWeight: 700,
                      background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))", color: "#fff",
                    }}
                  >
                    {e.word}
                  </span>
                );
              })}
            </div>

            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder={tr(isAr, "Write your reply…", "اكتب ردك…")}
              style={{
                width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 15,
                borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)", color: INK, resize: "vertical", fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              disabled={reply.trim().length < 2}
              onClick={submit}
              style={{ ...primaryBtnStyle, opacity: reply.trim().length < 2 ? 0.5 : 1 }}
            >
              {tr(isAr, "Submit reply", "إرسال الرد")}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div style={{ textAlign: "center", padding: "12px 4px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: INK }}>{tr(isAr, "Conversation done", "انتهت المحادثة")}</div>
            <div style={{ marginTop: 8, fontSize: 14, color: "var(--muted-strong)" }}>
              {tr(
                isAr,
                `${results.filter((r) => r.ok).length} of ${results.length} replies used target words`,
                `${results.filter((r) => r.ok).length} من ${results.length} ردود استخدمت الكلمات المستهدفة`
              )}
            </div>
            <div style={{ marginTop: 16, textAlign: "start" }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  padding: "10px 12px", borderRadius: 10, marginBottom: 8,
                  background: r.ok ? "rgba(48,209,88,0.1)" : "rgba(255,69,58,0.08)",
                  border: `1px solid ${r.ok ? "rgba(48,209,88,0.25)" : "rgba(255,69,58,0.2)"}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.ok ? "#30d158" : "var(--danger)", marginBottom: 4 }}>
                    {r.ok ? tr(isAr, "Used a target word", "استخدمت كلمة مستهدفة") : tr(isAr, "Missed target words", "فاتتك الكلمات المستهدفة")}
                  </div>
                  <div style={{ fontSize: 14, color: INK }}>{r.reply || "—"}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => setPhase("pick")} style={{
                flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(var(--border-rgb),0.2)",
                background: "var(--input-bg)", color: INK, fontWeight: 700, cursor: "pointer",
              }}>
                {tr(isAr, "Again", "مرة أخرى")}
              </button>
              <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}>
                {tr(isAr, "Done", "تم")}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
