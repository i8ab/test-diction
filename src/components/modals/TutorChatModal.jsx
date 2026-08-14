import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { tr } from "../../lib/config/i18n";
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
 * Small live summary of the user's progress (numbers + short samples only).
 */
/**
 * Small live summary across ALL sections (not only the open tab).
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

  const SECTION_KEYS = ["academic", "en-ar", "ar-ar"];
  const SECTION_LABELS = {
    academic: "Academic",
    "en-ar": "EN→AR",
    "ar-ar": "AR→AR",
  };

  // Per-section buckets
  const bySection = {};
  for (const key of SECTION_KEYS) {
    bySection[key] = {
      label: SECTION_LABELS[key],
      in_dictionary: 0,
      studied: 0,
      not_studied: 0,
      mastered: 0,
      weak: 0,
      weak_words: [],
    };
  }

  let mastered = 0;
  let learning = 0;
  const weakCandidates = []; // { word, score, section }

  for (const e of entries || []) {
    if (!e) continue;
    const sec = e.section || "en-ar";
    if (!bySection[sec]) {
      bySection[sec] = {
        label: sec,
        in_dictionary: 0,
        studied: 0,
        not_studied: 0,
        mastered: 0,
        weak: 0,
        weak_words: [],
      };
    }
    const bucket = bySection[sec];
    bucket.in_dictionary += 1;

    const isStudied = studiedSet.has(e.id);
    if (!isStudied) {
      bucket.not_studied += 1;
      continue;
    }
    bucket.studied += 1;

    const word = String(e.word || e.term || "").trim();
    if (!word) continue;

    const stats = srsStats[e.id] || { correct: 0, total: 0 };
    const level = srsLevelFromStats(stats);
    const total = stats.total || 0;
    const correct = stats.correct || 0;
    const ratio = total > 0 ? correct / total : 0;

    if (level >= 5 || (total >= 6 && ratio >= 0.9)) {
      mastered += 1;
      bucket.mastered += 1;
    } else if (total >= 2 && ratio < 0.85) {
      learning += 1;
      bucket.weak += 1;
      const score = level + ratio * 0.5 + Math.min(total, 20) * 0.01;
      weakCandidates.push({ word, score, section: sec });
      bucket.weak_words.push({ word, score });
    } else {
      learning += 1;
    }
  }

  weakCandidates.sort((a, b) => a.score - b.score);
  const weakWords = weakCandidates.slice(0, MAX_WEAK_SAMPLE).map((w) => w.word);

  // Cap weak samples per section
  for (const key of Object.keys(bySection)) {
    const list = bySection[key].weak_words || [];
    list.sort((a, b) => a.score - b.score);
    bySection[key].weak_words = list.slice(0, 8).map((w) => w.word);
  }

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

  const totalInDict = (entries || []).length;
  const totalStudied = studiedSet.size || 0;
  const totalNotStudied = Math.max(0, totalInDict - totalStudied);

  // Compact sections object for the prompt (only non-empty)
  const sections = {};
  for (const key of Object.keys(bySection)) {
    const b = bySection[key];
    if (b.in_dictionary === 0) continue;
    sections[key] = {
      label: b.label,
      in_dictionary: b.in_dictionary,
      studied: b.studied,
      not_studied: b.not_studied,
      mastered: b.mastered,
      weak: b.weak,
      weak_words: b.weak_words,
    };
  }

  return {
    name: name || undefined,
    total_in_dictionary: totalInDict,
    total_words: totalStudied,
    not_studied: totalNotStudied,
    mastered,
    learning,
    weak: weakCandidates.length,
    weak_words: weakWords,
    recent_words: recent,
    today_studied: todayStudied,
    streak: computeStreak(studiedAt || {}),
    level,
    sections,
  };
}

/** Strip machine ACTION lines from the visible reply text. */
function cleanAnswerText(text) {
  if (!text) return "";
  return String(text)
    .replace(/(?:→\s*)?ACTION:\s*[a-z0-9_]+\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function actionLabel(action, isAr) {
  const map = {
    quiz_weak: isAr ? "فتح اختبار الكلمات الضعيفة" : "Open weak-words quiz",
    quiz_all: isAr ? "فتح اختبار" : "Open quiz",
    flashcards_weak: isAr ? "فتح بطاقات الكلمات الضعيفة" : "Open weak-words flashcards",
    flashcards_all: isAr ? "فتح البطاقات" : "Open flashcards",
    flashcards_recent: isAr ? "فتح بطاقات حديثة" : "Open recent flashcards",
  };
  return map[action] || null;
}


/** Detect dominant script so mixed AR/EN doesn't flip the whole bubble wrongly. */
function detectTextDir(text) {
  const s = String(text || "");
  let ar = 0;
  let en = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x0600 && c <= 0x06ff) ar += 1;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) en += 1;
  }
  if (ar === 0 && en === 0) return "auto";
  return ar >= en ? "rtl" : "ltr";
}


/** Infer tool action from user question and/or model reply (backup if server omits action). */
function inferActionFromText(question, answer) {
  const q = String(question || "").toLowerCase();
  const a = String(answer || "").toLowerCase();
  const blob = q + "\n" + a;

  // Explicit ACTION line in answer
  const m = String(answer || "").match(/(?:→\s*)?ACTION:\s*([a-z0-9_]+)/i);
  if (m) {
    const act = m[1].toLowerCase();
    if (/^(quiz|flashcards)_/.test(act)) return act;
  }

  const wantsQuiz = /كويز|اختبار|quiz|test/.test(blob);
  const wantsFlash = /فلاش\s*كارد|بطاقات|flash\s*cards?|flashcards/.test(blob);
  const wantsWeak = /ضعيف|الضعف|weak/.test(blob);
  const wantsRecent = /حديث|أخيرة|recent/.test(blob);

  if (wantsQuiz) return wantsWeak ? "quiz_weak" : "quiz_all";
  if (wantsFlash) {
    if (wantsRecent) return "flashcards_recent";
    return wantsWeak ? "flashcards_weak" : "flashcards_all";
  }
  return null;
}

function ChatBubble({ role, text, action, isAr, onAction }) {
  const isUser = role === "user";
  const label = action ? actionLabel(action, isAr) : null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div style={{ maxWidth: "92%" }}>
        <div
          dir={detectTextDir(text)}
          style={{
            padding: "11px 14px",
            borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: isUser
              ? "var(--accent-1, #5b8def)"
              : "rgba(var(--border-rgb), 0.12)",
            color: isUser ? "#fff" : "var(--ink, #e8eaed)",
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            border: isUser ? "none" : "1px solid rgba(var(--border-rgb), 0.16)",
            // Isolate bidi so English words inside Arabic (and vice versa) don't reverse neighbors
            unicodeBidi: "plaintext",
            textAlign: "start",
          }}
        >
          {text}
        </div>
        {/* Optional action — user must tap; never auto-navigate */}
        {!isUser && label && typeof onAction === "function" && (
          <button
            type="button"
            onClick={() => onAction(action)}
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(var(--border-rgb), 0.22)",
              background: "transparent",
              color: "var(--accent-1, #5b8def)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
            }}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Personal study tutor — user types freely; no preset question list.
 * Never navigates away on its own; optional action buttons only.
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
    setMessages([
      {
        role: "assistant",
        content: isAr
          ? `أهلاً${name ? ` ${name}` : ""}.\nاكتب أي سؤال عن مذاكرتك أو تقدمك — هجاوب من بياناتك الحالية.`
          : `Hi${name ? ` ${name}` : ""}.\nType any question about your study progress — I'll answer from your current data.`,
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = useCallback(
    (action) => {
      if (!action) return;
      const act = String(action).toLowerCase().trim();
      // Parent closes this modal then opens the tool — small delay avoids race with overlay state
      const go = () => {
        try {
          if (act.startsWith("quiz")) {
            if (typeof onOpenQuiz === "function") {
              onOpenQuiz({ weakOnly: act === "quiz_weak", dueOnly: act === "quiz_weak" });
            }
          } else if (act.startsWith("flashcards") || act.startsWith("flash")) {
            if (typeof onOpenFlashcards === "function") {
              onOpenFlashcards({
                weakOnly: act === "flashcards_weak",
                recentOnly: act === "flashcards_recent",
              });
            }
          }
        } catch (_) {}
      };
      // Let the click finish, then navigate
      setTimeout(go, 50);
    },
    [onOpenQuiz, onOpenFlashcards]
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
      .slice(-MAX_HISTORY - 1, -1)
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
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.message || `Error ${res.status}`;
        const isRate =
          res.status === 429 ||
          /rate limit|tokens per day|429|استهلاك الحد/i.test(String(detail));
        if (isRate) {
          throw new Error(
            isAr
              ? "الخدمة مشغولة حاليًا (تم استهلاك الحد اليومي للذكاء الاصطناعي). جرّب بعد شوية."
              : "AI is busy right now (daily rate limit). Please try again in a bit."
          );
        }
        throw new Error(detail);
      }

      const rawAnswer = data.answer || (isAr ? "مفيش رد." : "No answer.");
      const resolvedAction =
        data.action ||
        inferActionFromText(question, rawAnswer) ||
        null;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: cleanAnswerText(rawAnswer),
          action: resolvedAction,
        },
      ]);
      // Do NOT auto-navigate. User taps the optional button if they want.
    } catch (err) {
      const raw = err?.message || "";
      const msg =
        raw ||
        (isAr ? "حصل خطأ في الاتصال بالمساعد." : "Failed to reach the tutor.");
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: msg,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 40);
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
      parts.push(isAr ? `${userContext.weak} ضعيفة` : `${userContext.weak} weak`);
    }
    if (userContext.streak != null && userContext.streak > 0) {
      parts.push(isAr ? `سلسلة ${userContext.streak}` : `${userContext.streak}d streak`);
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
        zIndex: 5600,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          height: "min(78vh, 640px)",
          background: "var(--card, #1c1f26)",
          borderRadius: 18,
          border: "1px solid rgba(var(--border-rgb), 0.18)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(var(--border-rgb), 0.14)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--accent-1, #5b8def)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
            aria-hidden
          >
            🤖
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink, #e8eaed)" }}>
              {tr(isAr, "Study Coach", "مساعد الدراسة")}
            </div>
            {statsLine ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted-strong, #9aa0a6)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {statsLine}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(var(--border-rgb), 0.2)",
              background: "transparent",
              color: "var(--ink, #e8eaed)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Messages only — no preset questions */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 12px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {messages.map((m, i) => (
            <ChatBubble
              key={i}
              role={m.role}
              text={m.content}
              action={m.action}
              isAr={isAr}
              onAction={runAction}
            />
          ))}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 6px",
                color: "var(--muted-strong, #9aa0a6)",
                fontSize: 13,
              }}
            >
              <LoaderIcon size={15} />
              {tr(isAr, "Thinking…", "بيفكّر…")}
            </div>
          )}
          {error ? (
            <div style={{ fontSize: 12, color: "var(--danger, #ff453a)", padding: "4px 6px" }}>
              {error}
            </div>
          ) : null}
        </div>

        {/* Input bar — premium chat style */}
        <form
          onSubmit={onSubmit}
          style={{
            padding: "10px 12px 14px",
            borderTop: "1px solid rgba(var(--border-rgb), 0.12)",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexShrink: 0,
            background: "var(--card, #1c1f26)",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              height: 44,
              borderRadius: 22,
              padding: "0 16px",
              background: "rgba(var(--border-rgb), 0.1)",
              border: "1px solid rgba(var(--border-rgb), 0.18)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.12)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr(isAr, "Type your question…", "اكتب سؤالك…")}
              disabled={loading}
              autoComplete="off"
              dir="auto"
              style={{
                flex: 1,
                width: "100%",
                minWidth: 0,
                height: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--ink, #e8eaed)",
                fontSize: 14,
                lineHeight: 1.4,
                padding: 0,
                margin: 0,
                boxShadow: "none",
                unicodeBidi: "plaintext",
                textAlign: "start",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label={tr(isAr, "Send", "إرسال")}
            title={tr(isAr, "Send", "إرسال")}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: loading || !input.trim() ? "default" : "pointer",
              background: loading || !input.trim()
                ? "rgba(var(--border-rgb), 0.18)"
                : "linear-gradient(135deg, var(--accent-1, #5b8def), #4a7de0)",
              color: loading || !input.trim() ? "var(--muted-strong, #9aa0a6)" : "#fff",
              boxShadow: loading || !input.trim()
                ? "none"
                : "0 4px 14px rgba(91, 141, 239, 0.4)",
              transition: "background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease",
              padding: 0,
            }}
          >
            {loading ? (
              <LoaderIcon size={18} />
            ) : (
              /* Paper-plane / send triangle (social style) */
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ marginLeft: 2 }}
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
