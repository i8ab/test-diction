import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, primaryBtnStyle, inputStyle } from "../../lib/config/theme";
import { XIcon, LoaderIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { srsLevelFromStats, computeStreak, dateKey } from "../../lib/utils/quizHelpers";
import { loadXp, levelFromXp } from "../../lib/state/xp";

const AI_AGENT_URL = "https://web-production-40a8e.up.railway.app";
const AI_API_SECRET = "bacaloria-secret-2026";

const MAX_WEAK_SAMPLE = 20;
const MAX_RECENT_SAMPLE = 10;
const MAX_HISTORY = 6;

/**
 * Build a small live summary of the user's progress.
 * Kept intentionally tiny for bandwidth (numbers + short word samples).
 */
export function buildUserContext({
  name,
  entries = [],
  studiedIds,
  studiedAt = {},
  srsStats = {},
  accountCode,
}) {
  const studiedSet =
    studiedIds instanceof Set
      ? studiedIds
      : new Set(Array.isArray(studiedIds) ? studiedIds : []);

  const totalWords = studiedSet.size || 0;
  let mastered = 0;
  let learning = 0;
  const weakCandidates = [];

  for (const e of entries || []) {
    if (!e || !studiedSet.has(e.id)) continue;
    const word = String(e.word || e.term || "").trim();
    if (!word) continue;
    const stats = srsStats[e.id] || { correct: 0, total: 0 };
    const level = srsLevelFromStats(stats);
    const total = stats.total || 0;
    const correct = stats.correct || 0;
    const ratio = total > 0 ? correct / total : 0;

    if (level >= 5 || (total >= 6 && ratio >= 0.9)) {
      mastered += 1;
    } else if (total >= 2 && ratio < 0.85) {
      learning += 1;
      // lower score = weaker
      const score = level + ratio * 0.5 + Math.min(total, 20) * 0.01;
      weakCandidates.push({ word, score, id: e.id });
    } else {
      learning += 1;
    }
  }

  weakCandidates.sort((a, b) => a.score - b.score);
  const weakWords = weakCandidates.slice(0, MAX_WEAK_SAMPLE).map((w) => w.word);

  // Recent by studiedAt
  const recent = Object.entries(studiedAt || {})
    .filter(([id]) => studiedSet.has(id))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, MAX_RECENT_SAMPLE)
    .map(([id]) => {
      const e = (entries || []).find((x) => x.id === id);
      return e ? String(e.word || e.term || "").trim() : "";
    })
    .filter(Boolean);

  const today = dateKey();
  let todayStudied = 0;
  for (const [id, ts] of Object.entries(studiedAt || {})) {
    if (studiedSet.has(id) && dateKey(Number(ts)) === today) todayStudied += 1;
  }

  let level = 1;
  try {
    const xp = loadXp(accountCode);
    const info = levelFromXp(xp?.total || 0);
    level = (info && info.level) || 1;
  } catch (_) {}

  const streak = computeStreak(studiedAt || {});

  return {
    name: name || undefined,
    total_words: totalWords,
    mastered,
    learning,
    weak: weakCandidates.length,
    weak_words: weakWords,
    recent_words: recent,
    today_studied: todayStudied,
    streak,
    level,
  };
}

function ChatBubble({ role, text, isAr }) {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser
            ? "linear-gradient(135deg, var(--accent-1, #5b8def), var(--accent-2, #7b2cbf))"
            : "var(--input-bg, rgba(128,128,128,0.12))",
          color: isUser ? "#fff" : INK,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          border: isUser ? "none" : "1px solid rgba(var(--border-rgb),0.14)",
          direction: isAr && !isUser ? "rtl" : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  { en: "What are my weak words?", ar: "إيه الكلمات الضعيفة عليا؟" },
  { en: "How am I doing overall?", ar: "إيه وضع تقدمي؟" },
  { en: "Make me a weak-words quiz", ar: "اعمل لي كويز على الضعيف" },
  { en: "Open flashcards for weak words", ar: "افتح فلاش كارد للكلمات الضعيفة" },
];

/**
 * Personal study tutor chat — sends a live progress summary with every message.
 * Nothing is stored on the AI server.
 */
export default function TutorChatModal({
  name,
  accountCode,
  entries = [],
  studiedIds,
  studiedAt = {},
  srsStats = {},
  isAr = false,
  onClose,
  onOpenQuiz,
  onOpenFlashcards,
  showToast,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const userContext = useMemo(
    () =>
      buildUserContext({
        name,
        entries,
        studiedIds,
        studiedAt,
        srsStats,
        accountCode,
      }),
    [name, entries, studiedIds, studiedAt, srsStats, accountCode]
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !loading) onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, loading]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    // Welcome message once
    setMessages([
      {
        role: "assistant",
        content: isAr
          ? `أهلاً${name ? ` ${name}` : ""} 👋\nأنا مساعدك الدراسي. اسألني عن تقدمك، الكلمات الضعيفة، أو اطلب كويز / فلاش كارد.`
          : `Hi${name ? ` ${name}` : ""} 👋\nI'm your study coach. Ask about your progress, weak words, or request a quiz / flashcards.`,
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = useCallback(
    (action) => {
      if (!action) return;
      if (action.startsWith("quiz")) {
        onOpenQuiz?.({ dueOnly: action === "quiz_weak", weakOnly: action === "quiz_weak" });
        showToast?.(
          isAr ? "جاري فتح الاختبار…" : "Opening quiz…"
        );
      } else if (action.startsWith("flashcards")) {
        onOpenFlashcards?.({
          weakOnly: action === "flashcards_weak",
          recentOnly: action === "flashcards_recent",
        });
        showToast?.(
          isAr ? "جاري فتح البطاقات…" : "Opening flashcards…"
        );
      }
    },
    [onOpenQuiz, onOpenFlashcards, showToast, isAr]
  );

  async function sendQuestion(rawText) {
    const question = (rawText || "").trim();
    if (!question || loading) return;

    setError("");
    setInput("");
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setLoading(true);

    const history = nextMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY - 1, -1) // previous turns only
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${AI_AGENT_URL}/tutor-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Secret": AI_API_SECRET,
        },
        body: JSON.stringify({
          question,
          user_context: userContext,
          history,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Error ${res.status}`);
      }

      const answer = data.answer || (isAr ? "مفيش رد." : "No answer.");
      setMessages((prev) => [...prev, { role: "assistant", content: answer, action: data.action }]);

      if (data.action) {
        // Small delay so user can read the suggestion first
        setTimeout(() => handleAction(data.action), 600);
      }
    } catch (err) {
      const msg =
        err?.message ||
        (isAr ? "حصل خطأ في الاتصال بالمساعد." : "Failed to reach the tutor.");
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isAr
            ? `مش قادر أوصل للسيرفر دلوقتي.\n${msg}`
            : `Couldn't reach the server right now.\n${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onSubmit(e) {
    e?.preventDefault?.();
    sendQuestion(input);
  }

  const statsLine = useMemo(() => {
    const parts = [];
    if (userContext.total_words != null) {
      parts.push(
        isAr ? `${userContext.total_words} كلمة` : `${userContext.total_words} words`
      );
    }
    if (userContext.weak != null) {
      parts.push(
        isAr ? `${userContext.weak} ضعيفة` : `${userContext.weak} weak`
      );
    }
    if (userContext.streak != null && userContext.streak > 0) {
      parts.push(
        isAr ? `سلسلة ${userContext.streak}` : `${userContext.streak}d streak`
      );
    }
    return parts.join(" · ");
  }, [userContext, isAr]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5200,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          height: "min(88vh, 720px)",
          background: "var(--card, #fff)",
          borderRadius: 20,
          border: "1px solid rgba(var(--border-rgb),0.16)",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #5b8def, #7b2cbf)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🤖
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>
              {tr(isAr, "Study Coach", "مساعد الدراسة")}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 2 }}>
              {statsLine || tr(isAr, "Live progress", "تقدم لحظي")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(var(--border-rgb),0.18)",
              background: "var(--input-bg)",
              color: INK,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 8px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} text={m.content} isAr={isAr} />
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", color: "var(--muted-strong)", fontSize: 13 }}>
              <LoaderIcon size={16} />
              {tr(isAr, "Thinking…", "بيفكّر…")}
            </div>
          )}
          {error && (
            <div style={{ fontSize: 12, color: "var(--danger, #ff453a)", padding: "4px 8px" }}>
              {error}
            </div>
          )}
        </div>

        {/* Suggestions (only at start / few messages) */}
        {messages.length <= 2 && !loading && (
          <div
            style={{
              padding: "0 12px 8px",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s.en}
                type="button"
                onClick={() => sendQuestion(isAr ? s.ar : s.en)}
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(var(--border-rgb),0.2)",
                  background: "var(--input-bg)",
                  color: INK,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {isAr ? s.ar : s.en}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={onSubmit}
          style={{
            padding: "10px 12px 12px",
            borderTop: "1px solid rgba(var(--border-rgb),0.12)",
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder={tr(isAr, "Ask about your progress…", "اسأل عن تقدمك…")}
            disabled={loading}
            style={{
              ...inputStyle,
              flex: 1,
              resize: "none",
              minHeight: 42,
              maxHeight: 100,
              padding: "10px 12px",
              fontSize: 14,
              lineHeight: 1.4,
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              ...primaryBtnStyle,
              marginTop: 0,
              padding: "0 16px",
              height: 42,
              opacity: loading || !input.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {tr(isAr, "Send", "إرسال")}
          </button>
        </form>
      </div>
    </div>
  );
}
