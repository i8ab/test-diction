import { useState, useEffect, useMemo, useRef } from "react";
import { useKeyboardAware, keyboardAwareBodyStyle } from "../../lib/utils/useKeyboardAware";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  uid, quizRangeStart, selectQuizEntries, isTypingCorrect, buildQuiz, buildBaccalaureateQuiz,
  quizQuestionLabel, isSrsDue, quizResultCategory, QUIZ_RESULT_CATEGORIES, formatQuizDuration,
} from "../../lib/utils/quizHelpers";
import { SpeakButton, XIcon, CheckIcon, EyeIcon, QuizIcon } from "../common/Icons";
import HowItWorksButton from "../common/HowItWorksButton";
import InlineHowItWorks from "../common/InlineHowItWorks";
import NumberStepper from "../common/NumberStepper";
import UnitScopePicker, { useUnitScope } from "../common/UnitScopePicker";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

import {
  loadQuizSession,
  saveQuizSession,
  clearQuizSession,
} from "../../lib/state/sessionUi";

function ReviewRow({ item, isAr }) {
  const row = item || {};
  return (
    <div style={{ padding: "10px 12px", border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 4, marginBottom: 8 }}>
      <div dir={row.wordDir || "auto"} style={{ fontFamily: row.wordFont || "inherit", fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {row.word || "—"}
        {row.pos ? (
          <span style={{ marginInlineStart: 8, fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", fontFamily: "var(--font-latin), sans-serif" }}>
            ({row.pos})
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: 0 }}>
        {tr(isAr,
          `You said "${row.selectedAnswer || "—"}" — the correct one is "${row.correctAnswer || "—"}".`,
          `انت غلطت، قلت معناها "${row.selectedAnswer || "—"}"، وهي فعلاً "${row.correctAnswer || "—"}".`)}
      </p>
    </div>
  );
}

function QuizModal({ entries, sectionLabel, studiedIds, studiedAt, srsDueAt, sessionStart, isAr, onClose, onRecordSrsAnswer, onSaveQuizResult, initialDueOnly, academicUnits = null, activeUnitId = null }) {
  // "Daily review" entry points (the reminder banner's "Review now", the
  // due-count stat) jump straight into a due-only quiz spanning every
  // studied word, not just whatever the last-used time range happened to
  // be — so default the range wide open whenever we're asked to start
  // due-only, instead of the usual "last hour" default.
  const [rangeKey, setRangeKey] = useState(initialDueOnly ? "all" : "60");
  const [customMinutes, setCustomMinutes] = useState("120");
  const mode = "mcq"; // quiz is multiple-choice only
  const [dueOnly, setDueOnly] = useState(!!initialDueOnly);
  // "studied" | "not_studied" | "both"
  const [studiedFilter, setStudiedFilter] = useState("studied");
  // Manual word selection: null = use all matching; Set of ids when picking
  const [wordPickMode, setWordPickMode] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState(() => new Set());
  const [wordSearch, setWordSearch] = useState("");
  // Restore mid-session after same-tab refresh
  const restoredRef = useRef(undefined);
  if (restoredRef.current === undefined) {
    restoredRef.current = loadQuizSession();
  }
  const restored = restoredRef.current;

  // "practice" = show correct/wrong immediately | "exam" = hide until finished
  const [quizMode, setQuizMode] = useState(() => restored?.quizMode || "practice");
  const [stage, setStage] = useState(() => (restored?.stage === "running" || restored?.stage === "done" ? restored.stage : "setup"));
  const [startError, setStartError] = useState("");
  const [questions, setQuestions] = useState(() => restored?.questions || []);
  const [index, setIndex] = useState(() => restored?.index || 0);
  // answers[i] = { selected, correct, ... } | null if not yet answered
  const [answers, setAnswers] = useState(() => restored?.answers || []);
  const [startedAt, setStartedAt] = useState(() => restored?.startedAt || null);
  const [finishedAt, setFinishedAt] = useState(() => restored?.finishedAt || null);
  const [typedAnswer, setTypedAnswer] = useState(() => restored?.typedAnswer || "");
  const [elapsedSec, setElapsedSec] = useState(0);

  const {
    hasUnits,
    sortedUnits,
    selectedUnitIds,
    unitFilteredEntries,
    setUnitPreset,
    toggleUnit,
    selectAllUnits,
  } = useUnitScope(academicUnits, activeUnitId, entries);

  function handleClose() {
    clearQuizSession();
    onClose();
  }

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Live elapsed timer while quiz is running
  useEffect(() => {
    if (stage !== "running" || !startedAt) return;
    setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [stage, startedAt]);

  // Persist running quiz so refresh keeps answers + progress
  useEffect(() => {
    if (stage !== "running") return;
    const payload = {
      stage,
      quizMode,
      questions,
      index,
      answers,
      startedAt,
      typedAnswer,
      finishedAt: null,
    };
    saveQuizSession(payload);
    function flush() {
      saveQuizSession(payload);
    }
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [stage, quizMode, questions, index, answers, startedAt, typedAnswer]);

  const RANGE_OPTIONS = [
    { key: "10", label: tr(isAr, "Last 10 min", "آخر 10 دقايق") },
    { key: "30", label: tr(isAr, "Last 30 min", "آخر 30 دقيقة") },
    { key: "60", label: tr(isAr, "Last hour", "آخر ساعة") },
    { key: "180", label: tr(isAr, "Last 3 hours", "آخر 3 ساعات") },
    { key: "1440", label: tr(isAr, "Last 24 hours", "آخر 24 ساعة") },
    { key: "today", label: tr(isAr, "Today", "اليوم") },
    { key: "session", label: tr(isAr, "This session", "هذه الجلسة") },
    { key: "all", label: tr(isAr, "Any time", "أي وقت") },
    { key: "custom", label: tr(isAr, "Custom", "مخصص") },
  ];

  const rangeStart = useMemo(() => quizRangeStart(rangeKey, customMinutes, sessionStart), [rangeKey, customMinutes, sessionStart]);
  const matchingEntries = useMemo(() => {
    const pick = wordPickMode && selectedWordIds.size > 0 ? selectedWordIds : null;
    const base = selectQuizEntries(unitFilteredEntries, studiedIds, studiedAt, rangeStart, studiedFilter, pick);
    return dueOnly ? base.filter((e) => isSrsDue(e.id, srsDueAt)) : base;
  }, [unitFilteredEntries, studiedIds, studiedAt, rangeStart, dueOnly, srsDueAt, studiedFilter, wordPickMode, selectedWordIds]);

  // Pool for the word-picker list (before manual selection), respecting studied filter + range
  const pickerPool = useMemo(() => {
    return selectQuizEntries(unitFilteredEntries, studiedIds, studiedAt, rangeStart, studiedFilter, null);
  }, [unitFilteredEntries, studiedIds, studiedAt, rangeStart, studiedFilter]);

  const filteredPickerPool = useMemo(() => {
    const q = wordSearch.trim().toLowerCase();
    if (!q) return pickerPool;
    return pickerPool.filter((e) => {
      const w = String(e.word || "").toLowerCase();
      const m = String(e.meaning || e.def || "").toLowerCase();
      return w.includes(q) || m.includes(q);
    });
  }, [pickerPool, wordSearch]);

  function toggleWordId(id) {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStartError("");
  }

  function selectAllPickerWords() {
    setSelectedWordIds(new Set(filteredPickerPool.map((e) => e.id)));
    setStartError("");
  }

  function clearPickerWords() {
    setSelectedWordIds(new Set());
    setStartError("");
  }

  function startQuiz() {
    // Baccalaureate-style: MCQ (Part A) + Open productive questions (Part B)
    // when the learner chooses the classic multiple-choice path.
    let built = [];
    if (mode === "mcq" || mode === "bac") {
      const pack = buildBaccalaureateQuiz(matchingEntries, unitFilteredEntries, {
        mcqLimit: 12,
        openLimit: 5,
        includeCloze: true,
      });
      built = pack.all || [];
    } else {
      built = buildQuiz(matchingEntries, unitFilteredEntries, mode) || [];
    }
    if (!built.length) {
      setStartError(tr(isAr,
        "Not enough words yet to build a quiz from this selection — add a few more words to the dictionary or pick a wider time range.",
        "لا توجد كلمات كافية لعمل اختبار من هذا الاختيار — أضف كلمات أكتر للقاموس أو اختر نطاق وقت أوسع."));
      return;
    }
    setStartError("");
    setQuestions(built);
    setIndex(0);
    setAnswers(new Array(built.length).fill(null));
    setStartedAt(Date.now());
    setFinishedAt(null);
    setTypedAnswer("");
    setStage("running");
  }

  const currentAnswer = answers[index] || null;
  const isAnswered = !!(currentAnswer && !currentAnswer.partial);
  const answeredCount = (answers || []).filter((a) => a && !a.partial).length;
  const allAnswered = (questions || []).length > 0 && answeredCount === questions.length;
  const score = (answers || []).filter((a) => a && a.correct && !a.partial).length;
  const isPractice = quizMode === "practice";
  // In practice mode, lock after a full answer so feedback stays. In exam mode, allow changing until finish.
  const isLocked = isPractice && isAnswered;
  // Show correct/wrong colors only in practice (while running)
  const showFeedback = isPractice;

  function saveAnswerAt(idx, selectedOpt, correct) {
    const q = questions[idx];
    if (!q) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = {
        selected: selectedOpt,
        correct,
        id: q.id,
        type: q.type,
        word: q.word,
        wordDir: q.wordDir,
        wordFont: q.wordFont,
        pos: q.pos || "",
        selectedAnswer: selectedOpt,
        correctAnswer: q.correct,
      };
      return next;
    });
    // Feed SRS only the first time this question is answered
    // (sound already played above — App handler may also play; duplicate is fine)
    if (wasEmpty && onRecordSrsAnswer) {
      onRecordSrsAnswer(q.entryId, correct);
    }
  }

  function pickOption(opt) {
    if (isLocked) return;
    const q = questions[index];
    if (!q) return;
    const need = q.selectCount || 1;
    const corrects = q.correctAnswers || [q.correct];

    if (need <= 1) {
      saveAnswerAt(index, opt, corrects.includes(opt) || opt === q.correct);
      return;
    }

    // Multi-select: toggle option until required count reached, then commit
    const prev = (answers[index] && Array.isArray(answers[index].selectedList))
      ? answers[index].selectedList
      : [];
    let nextList;
    if (prev.includes(opt)) {
      nextList = prev.filter((x) => x !== opt);
    } else if (prev.length < need) {
      nextList = [...prev, opt];
    } else {
      return; // already at max, must deselect first
    }

    if (nextList.length < need) {
      // partial selection — store draft without finalizing score yet
      setAnswers((old) => {
        const copy = [...old];
        copy[index] = {
          selected: nextList.join(" | "),
          selectedList: nextList,
          correct: false,
          partial: true,
          id: q.id,
          type: q.type,
          word: q.word,
          wordDir: q.wordDir,
          wordFont: q.wordFont,
          pos: q.pos || "",
          selectedAnswer: nextList.join(" | "),
          correctAnswer: (q.correctAnswers || [q.correct]).join(" | "),
        };
        return copy;
      });
      return;
    }

    // Full selection: check both answers
    const ok = nextList.length === need && nextList.every((x) => corrects.includes(x));
    setAnswers((old) => {
      const copy = [...old];
      copy[index] = {
        selected: nextList.join(" | "),
        selectedList: nextList,
        correct: ok,
        partial: false,
        id: q.id,
        type: q.type,
        word: q.word,
        wordDir: q.wordDir,
        wordFont: q.wordFont,
        pos: q.pos || "",
        selectedAnswer: nextList.join(" | "),
        correctAnswer: corrects.join(" | "),
      };
      return copy;
    });
    if (firstCommit && onRecordSrsAnswer) {
      onRecordSrsAnswer(q.entryId, ok);
    }
  }

  /** Skip = leave unanswered and jump to next unanswered question (does NOT mark wrong). */
  function skipQuestion() {
    // Clear any partial multi-select draft so the question stays unanswered
    if (answers[index] && answers[index].partial) {
      setAnswers((prev) => {
        const copy = [...prev];
        copy[index] = null;
        return copy;
      });
    }
    goToNextUnanswered();
  }

  function goToNextUnanswered() {
    let nextIdx = -1;
    for (let i = index + 1; i < questions.length; i++) {
      if (!answers[i] || answers[i].partial) { nextIdx = i; break; }
    }
    if (nextIdx === -1) {
      for (let i = 0; i < index; i++) {
        if (!answers[i] || answers[i].partial) { nextIdx = i; break; }
      }
    }
    if (nextIdx === -1) {
      // no other unanswered — stay (user can finish if all done, or answer current)
      return;
    }
    setIndex(nextIdx);
    setTypedAnswer("");
  }

  function goToNext() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setTypedAnswer("");
    }
  }

  function goToQuestion(n) {
    const i = n - 1;
    if (i >= 0 && i < questions.length) {
      setIndex(i);
      setTypedAnswer("");
    }
  }

  function finishQuiz() {
    if (!allAnswered) return;
    const finishedTime = Date.now();
    setFinishedAt(finishedTime);
    setStage("done");
    clearQuizSession();
    if (onSaveQuizResult) {
      onSaveQuizResult({
        id: uid(),
        at: finishedTime,
        section: sectionLabel || "",
        mode: `${mode}:${quizMode}`,
        score,
        total: questions.length,
        durationMs: startedAt ? finishedTime - startedAt : 0,
      });
    }
  }

  // Arabic أ ب ج د (هـ if 5 options) / English A B C D (E if 5)
  const optionLetters = isAr
    ? ["أ", "ب", "ج", "د", "هـ"]
    : ["A", "B", "C", "D", "E"];

  function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function retake() {
    clearQuizSession();
    setStage("setup");
    setStartError("");
  }

  const quizDurationMs = startedAt && finishedAt ? finishedAt - startedAt : 0;

  // Every wrong question, grouped by type (meaning / synonym / antonym).
  const mistakesByCategory = useMemo(() => {
    const map = { meaning: [], synonym: [], antonym: [] };
    for (const r of (answers || [])) {
      if (!r || r.correct || r.partial) continue;
      const cat = (r.type === "synonym" || r.type === "antonym") ? r.type : "meaning";
      map[cat].push(r);
    }
    return map;
  }, [answers]);

  // Flat list of every mistake — meaning first, then synonyms, then
  // antonyms — all shown at once in the review.
  const mistakesFlat = useMemo(
    () => [
      ...((mistakesByCategory && mistakesByCategory.meaning) || []),
      ...((mistakesByCategory && mistakesByCategory.synonym) || []),
      ...((mistakesByCategory && mistakesByCategory.antonym) || []),
    ],
    [mistakesByCategory]
  );

  const chipStyle = (active) => ({
    padding: "7px 13px", fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)",
    background: active ? BRASS : "none", border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.25)"}`,
    borderRadius: 20, cursor: "pointer",
  });

  return (
    <div onClick={handleClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 6000 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} className="modal-card kb-aware-modal" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", background: CARD, borderRadius: 20, padding: "20px 18px 18px", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexShrink: 0 }}>
          <h2 id="quiz-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <QuizIcon size={19} color={BRASS} /> {tr(isAr, "Quiz", "اختبار")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <HowItWorksButton isAr={isAr} guideId="quiz" />
            <button onClick={handleClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}><XIcon size={20} /></button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>


        {stage === "setup" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Customize which words to be tested on. Questions are multiple choice — choose the correct meaning.",
                "خصص الكلمات اللي عايز تختبر فيها. الأسئلة اختيار من متعدد — اختار المعنى الصحيح.")}
            </p>

            <UnitScopePicker
              isAr={isAr}
              hasUnits={hasUnits}
              sortedUnits={sortedUnits}
              selectedUnitIds={selectedUnitIds}
              entries={entries}
              setUnitPreset={setUnitPreset}
              toggleUnit={toggleUnit}
              selectAllUnits={selectAllUnits}
              onChange={() => setStartError("")}
            />

            <label style={labelStyle}>{tr(isAr, "Word source", "مصدر الكلمات")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, marginBottom: 12 }}>
              {[
                { key: "studied", en: "Studied", ar: "مدروسة" },
                { key: "not_studied", en: "Not studied", ar: "غير مدروسة" },
                { key: "both", en: "Both", ar: "الكل" },
              ].map((o) => (
                <button key={o.key} type="button" onClick={() => { setStudiedFilter(o.key); setStartError(""); }} style={chipStyle(studiedFilter === o.key)}>
                  {tr(isAr, o.en, o.ar)}
                </button>
              ))}
            </div>

            <label style={labelStyle}>{tr(isAr, "Studied within", "تمت دراستها خلال")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
              {RANGE_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => { setRangeKey(o.key); setStartError(""); }} style={chipStyle(rangeKey === o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
            {rangeKey === "custom" && (
              <>
                <label style={labelStyle} htmlFor="quiz-custom-minutes">{tr(isAr, "Minutes", "عدد الدقائق")}</label>
                <div style={{ marginTop: 4 }}>
                  <NumberStepper
                    min={1} max={10080}
                    value={Number(customMinutes) || 1}
                    onChange={(v) => setCustomMinutes(String(v))}
                    width={140}
                    aria-label={tr(isAr, "Minutes", "عدد الدقائق")}
                  />
                </div>
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 13, color: "var(--muted-strong)" }}>
              <EyeIcon size={14} color="var(--success)" />
              {tr(isAr,
                `${matchingEntries.length} word${matchingEntries.length === 1 ? "" : "s"} match this selection.`,
                `${matchingEntries.length} كلمة مطابقة لهذا الاختيار.`)}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: "var(--muted-strong)", cursor: "pointer" }}>
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
              {tr(isAr, "Only words due for review (spaced repetition)", "الكلمات المستحقة للمراجعة فقط (التكرار المتباعد)")}
            </label>

            {/* Manual word selection */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13.5, color: "var(--muted-strong)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={wordPickMode}
                onChange={(e) => {
                  setWordPickMode(e.target.checked);
                  if (!e.target.checked) setSelectedWordIds(new Set());
                  setStartError("");
                }}
              />
              {tr(isAr, "Pick specific words for this quiz", "اختيار كلمات محددة لهذا الاختبار")}
            </label>
            {wordPickMode && (
              <div style={{
                marginTop: 10, padding: 12, borderRadius: 12,
                border: "1px solid rgba(var(--border-rgb),0.14)", background: "var(--input-bg)",
              }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                  <input
                    value={wordSearch}
                    onChange={(e) => setWordSearch(e.target.value)}
                    placeholder={tr(isAr, "Search words…", "بحث عن كلمات…")}
                    style={{
                      flex: 1, minWidth: 120, padding: "7px 10px", borderRadius: 8,
                      border: "1px solid rgba(var(--border-rgb),0.18)", background: "var(--card)",
                      color: INK, fontSize: 13, fontFamily: "inherit",
                    }}
                  />
                  <button type="button" onClick={selectAllPickerWords} style={{ ...chipStyle(false), padding: "6px 10px" }}>
                    {tr(isAr, "Select all", "تحديد الكل")}
                  </button>
                  <button type="button" onClick={clearPickerWords} style={{ ...chipStyle(false), padding: "6px 10px" }}>
                    {tr(isAr, "Clear", "مسح")}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>
                  {tr(isAr, `${selectedWordIds.size} selected of ${pickerPool.length}`, `${selectedWordIds.size} محددة من ${pickerPool.length}`)}
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredPickerPool.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr(isAr, "No words match.", "لا توجد كلمات مطابقة.")}</div>
                  )}
                  {filteredPickerPool.map((e) => {
                    const on = selectedWordIds.has(e.id);
                    return (
                      <label key={e.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8,
                        background: on ? "var(--accent-1-soft)" : "var(--card)",
                        border: on ? "1px solid var(--accent-1)" : "1px solid transparent",
                        cursor: "pointer", fontSize: 13,
                      }}>
                        <input type="checkbox" checked={on} onChange={() => toggleWordId(e.id)} />
                        <span dir="auto" style={{ fontWeight: 700, color: INK, flex: 1 }}>{e.word || "—"}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode: Practice vs Exam */}
            <label style={labelStyle}>{tr(isAr, "Mode", "الوضع")}</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setQuizMode("practice")}
                style={{
                  flex: 1, padding: "12px 14px", fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: "pointer",
                  border: quizMode === "practice" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                  background: quizMode === "practice" ? "var(--accent-1-soft)" : "var(--card)",
                  color: quizMode === "practice" ? "var(--accent-1)" : "var(--muted-strong)",
                }}
              >
                {tr(isAr, "Practice", "تدريب")}
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.85 }}>
                  {tr(isAr, "See correct/wrong right away", "يشوف الصح والغلط فوراً")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setQuizMode("exam")}
                style={{
                  flex: 1, padding: "12px 14px", fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: "pointer",
                  border: quizMode === "exam" ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                  background: quizMode === "exam" ? "var(--accent-1-soft)" : "var(--card)",
                  color: quizMode === "exam" ? "var(--accent-1)" : "var(--muted-strong)",
                }}
              >
                {tr(isAr, "Exam", "امتحان")}
                <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.85 }}>
                  {tr(isAr, "No feedback until the end", "مفيش نتيجة إلا في الآخر")}
                </div>
              </button>
            </div>

            {startError && <div style={errorStyle} role="alert" aria-live="assertive">{startError}</div>}
            <button type="button" onClick={startQuiz} disabled={matchingEntries.length === 0} style={{ ...primaryBtnStyle, opacity: matchingEntries.length === 0 ? 0.5 : 1, cursor: matchingEntries.length === 0 ? "default" : "pointer" }}>
              <QuizIcon size={16} /> {tr(isAr, "Start quiz", "ابدأ الاختبار")}
            </button>
          </div>
        )}

        {stage === "running" && questions.length > 0 && questions[index] && (() => {
          const q = questions[index];
          const ans = answers[index]; // current answer state (or null)
          const selected = ans ? ans.selected : null;
          const selectedList = (ans && Array.isArray(ans.selectedList)) ? ans.selectedList : (selected ? [selected] : []);
          const isMulti = !!q.multi || (q.selectCount || 1) > 1;
          const isPartial = !!(ans && ans.partial);
          const total = questions.length;

          // Number strip around current question
          const windowSize = 9;
          let startNum = Math.max(1, (index + 1) - Math.floor(windowSize / 2));
          let endNum = Math.min(total, startNum + windowSize - 1);
          if (endNum - startNum + 1 < windowSize) startNum = Math.max(1, endNum - windowSize + 1);
          const numberStrip = [];
          for (let n = startNum; n <= endNum; n++) numberStrip.push(n);

          return (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* Top bar: timer + progress + answered count */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 20,
                  background: "rgba(var(--border-rgb),0.12)",
                  fontSize: 13, fontWeight: 700, color: "var(--muted-strong)",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  <span style={{ opacity: 0.7 }}>⏱</span>
                  {formatElapsed(elapsedSec)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                  {index + 1}/{total}
                  <span style={{ marginInlineStart: 6, fontSize: 11, opacity: 0.8 }}>
                    · {isPractice ? tr(isAr, "Practice", "تدريب") : tr(isAr, "Exam", "امتحان")}
                  </span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: BRASS }}>
                  {showFeedback
                    ? tr(isAr, `Score ${score}`, `النتيجة ${score}`)
                    : `${answeredCount}/${total}`}
                </span>
              </div>

              {/* Thin progress bar — based on answered count */}
              <div style={{ width: "100%", height: 5, background: "rgba(var(--border-rgb),0.15)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                <div style={{
                  width: `${(answeredCount / Math.max(total, 1)) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--accent-1), var(--accent-2))",
                  borderRadius: 3,
                  transition: "width 0.25s ease",
                }} />
              </div>

              {/* Baccalaureate part indicator */}
              {(q.mode === "open" || q.type === "open_define" || q.type === "sentence_completion" || q.mode === "mcq") && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  marginBottom: 10, padding: "4px 10px", borderRadius: 999,
                  background: q.mode === "open" ? "color-mix(in srgb, var(--accent-2) 18%, transparent)" : "color-mix(in srgb, var(--accent-1) 16%, transparent)",
                  border: `1px solid color-mix(in srgb, ${q.mode === "open" ? "var(--accent-2)" : "var(--accent-1)"} 40%, transparent)`,
                  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase",
                  color: q.mode === "open" ? "var(--accent-2)" : "var(--accent-1)",
                }}>
                  {q.mode === "open"
                    ? tr(isAr, "Part B · Open response", "الجزء ب · إجابة مفتوحة")
                    : tr(isAr, "Part A · Multiple choice", "الجزء أ · اختيار من متعدد")}
                </div>
              )}

              {/* Question type label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-strong)", margin: 0, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  {quizQuestionLabel(q.type || q.mode, isAr, q.pos, isMulti)}
                </p>
                <SpeakButton text={quizQuestionLabel(q.type || q.mode, isAr, q.pos, isMulti)} dir={isAr ? "rtl" : "ltr"} isAr={isAr} size={14} style={{ flexShrink: 0 }} />
              </div>
              {isMulti && (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
                  {tr(isAr, `Select ${q.selectCount || 2} answers`, `اختار ${(q.selectCount || 2)} إجابات`)}
                  {selectedList.length > 0 ? ` · ${selectedList.length}/${q.selectCount || 2}` : ""}
                </p>
              )}

              {/* Prompt card */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--input-bg)",
                borderRadius: 16,
                padding: "18px 16px",
                marginBottom: 18,
                border: "1px solid rgba(var(--border-rgb),0.12)",
                boxShadow: "0 4px 16px -8px rgba(0,0,0,0.15)",
              }}>
                <div dir={q.promptDir} style={{
                  flex: 1, minWidth: 0,
                  fontFamily: q.promptFont,
                  fontSize: "clamp(22px, 4vw, 30px)",
                  fontWeight: 700,
                  color: INK,
                  wordBreak: "break-word",
                  lineHeight: 1.35,
                }}>
                  {q.promptText}
                </div>
                {q.promptText && (
                  <SpeakButton
                    text={q.promptText}
                    dir={q.promptDir}
                    isAr={isAr}
                    size={20}
                    style={{
                      flexShrink: 0,
                      background: "var(--card)",
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      borderRadius: "50%",
                      width: 40, height: 40,
                      justifyContent: "center",
                      color: BRASS,
                    }}
                  />
                )}
              </div>

              {/* Open / productive response (Baccalaureate Part B) */}
              {(q.mode === "open" || q.type === "open_define" || ((q.mode === "typing" || q.mode === "cloze") && (!q.options || q.options.length === 0))) && (
                <div style={{ marginBottom: 16 }}>
                  {q.type === "open_define" && (
                    <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: "0 0 8px", lineHeight: 1.5 }}>
                      {tr(isAr,
                        "Explain the meaning in your own words — Arabic or English is fine.",
                        "اشرح المعنى بأسلوبك — عربي أو إنجليزي تمامًا.")}
                    </p>
                  )}
                  {q.sampleExample ? (
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", fontStyle: "italic" }}>
                      {tr(isAr, "Example you saw before: ", "مثال شفته قبل كده: ")}{q.sampleExample}
                    </p>
                  ) : null}
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    disabled={isLocked}
                    rows={3}
                    placeholder={tr(isAr, "Type your answer here…", "اكتب إجابتك هنا…")}
                    dir="auto"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1.5px solid rgba(var(--border-rgb),0.22)",
                      background: "var(--input-bg)",
                      color: INK,
                      fontSize: 15,
                      lineHeight: 1.5,
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                  {!isAnswered && (
                    <button
                      type="button"
                      onClick={() => {
                        const raw = (typedAnswer || "").trim();
                        if (!raw) return;
                        // For open_sentence we accept any non-empty use of the word (soft check)
                        let correct = false;
                        correct = isTypingCorrect(raw, q.correct || q.correctAnswer || "");
                        if (!correct && Array.isArray(q.acceptedAnswers)) {
                          correct = q.acceptedAnswers.some((a) => isTypingCorrect(raw, a));
                        }
                        saveAnswerAt(index, raw, correct);
                      }}
                      style={{ ...primaryBtnStyle, marginTop: 10, width: "100%" }}
                    >
                      {tr(isAr, "Submit answer", "تسليم الإجابة")}
                    </button>
                  )}
                  {showFeedback && isAnswered && (
                    <div style={{
                      marginTop: 10, padding: "10px 12px", borderRadius: 10,
                      background: currentAnswer?.correct ? "var(--success-bg)" : "var(--danger-bg)",
                      border: `1px solid ${currentAnswer?.correct ? "var(--success)" : "var(--danger-border)"}`,
                      fontSize: 13, color: currentAnswer?.correct ? "var(--success)" : "var(--danger)",
                    }}>
                      {currentAnswer?.correct
                        ? tr(isAr, "Nice work — that looks solid.", "تمام، إجابة كويسة.")
                        : tr(isAr, `Model answer: ${q.correctAnswer || q.correct || "—"}`, `الإجابة النموذجية: ${q.correctAnswer || q.correct || "—"}`)}
                    </div>
                  )}
                </div>
              )}

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {(q.options || []).map((opt, i) => {
                  const corrects = q.correctAnswers || [q.correct];
                  const isCorrectOpt = corrects.includes(opt);
                  const isSelectedOpt = selectedList.includes(opt);
                  let bg = "var(--card)";
                  let border = "rgba(var(--border-rgb),0.18)";
                  let color = INK;
                  let letterBg = "rgba(var(--border-rgb),0.12)";
                  let letterColor = "var(--muted-strong)";
                  // In exam mode: only highlight the selected option (no correct/wrong reveal)
                  // In practice mode: show green/red after answering
                  if (showFeedback && isAnswered && isCorrectOpt) {
                    bg = "var(--success-bg)";
                    border = "var(--success)";
                    color = "var(--success)";
                    letterBg = "var(--success)";
                    letterColor = "#fff";
                  } else if (showFeedback && isAnswered && isSelectedOpt && !isCorrectOpt) {
                    bg = "var(--danger-bg)";
                    border = "var(--danger-border)";
                    color = "var(--danger)";
                    letterBg = "var(--danger)";
                    letterColor = "#fff";
                  } else if (!showFeedback && isSelectedOpt) {
                    // exam mode: subtle selected state only
                    bg = "var(--accent-1-soft)";
                    border = "var(--accent-1)";
                    color = INK;
                    letterBg = "var(--accent-1)";
                    letterColor = "#fff";
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickOption(opt)}
                      disabled={isLocked}
                      dir={q.optionDir}
                      style={{
                        textAlign: "start",
                        fontFamily: q.optionFont,
                        fontSize: 15.5,
                        padding: "14px 14px",
                        background: bg,
                        border: `1.5px solid ${border}`,
                        color,
                        borderRadius: 14,
                        cursor: isLocked ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        boxShadow: isLocked ? "none" : "0 2px 8px -4px rgba(0,0,0,0.12)",
                        minHeight: 52,
                      }}
                    >
                      <span style={{
                        flexShrink: 0,
                        width: 32, height: 32,
                        borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800,
                        background: letterBg,
                        color: letterColor,
                        fontFamily: "'Source Sans 3', sans-serif",
                      }}>
                        {optionLetters[i] || (i + 1)}
                      </span>
                      <span style={{ flex: 1, lineHeight: 1.35 }}>{opt}</span>
                      {showFeedback && isAnswered && isCorrectOpt && <CheckIcon size={18} />}
                      {showFeedback && isAnswered && isSelectedOpt && !isCorrectOpt && <XIcon size={18} />}
                    </button>
                  );
                })}
              </div>

              {/* Bottom: number strip + actions */}
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  gap: 6, marginBottom: 14, flexWrap: "wrap",
                }}>
                  {numberStrip.map((n) => {
                    const isCurrent = n === index + 1;
                    const qAns = answers[n - 1];
                    const isDone = !!qAns;
                    // In practice: green/red. In exam: just a neutral "answered" mark (no reveal).
                    const isCorrect = showFeedback && qAns && qAns.correct;
                    const isWrong = showFeedback && qAns && !qAns.correct;
                    const examAnswered = !showFeedback && isDone;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => goToQuestion(n)}
                        style={{
                          width: isCurrent ? 36 : 28,
                          height: isCurrent ? 36 : 28,
                          borderRadius: 10,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: isCurrent ? 14 : 12,
                          fontWeight: isCurrent ? 800 : 600,
                          background: isCurrent
                            ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))"
                            : isCorrect
                              ? "var(--success-bg)"
                              : isWrong
                                ? "var(--danger-bg)"
                                : examAnswered
                                  ? "var(--accent-1-soft)"
                                  : "transparent",
                          color: isCurrent
                            ? "#fff"
                            : isCorrect
                              ? "var(--success)"
                              : isWrong
                                ? "var(--danger)"
                                : examAnswered
                                  ? "var(--accent-1)"
                                  : "var(--muted-strong)",
                          border: isCurrent
                            ? "none"
                            : isCorrect
                              ? "1.5px solid var(--success)"
                              : isWrong
                                ? "1.5px solid var(--danger-border)"
                                : examAnswered
                                  ? "1.5px solid var(--accent-1)"
                                  : "1px solid rgba(var(--border-rgb),0.15)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          padding: 0,
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  {!isAnswered ? (
                    <button
                      type="button"
                      onClick={skipQuestion}
                      style={{
                        flex: 1,
                        padding: "13px 16px",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--on-accent, #fff)",
                        background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                        border: "none",
                        borderRadius: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        minHeight: 50,
                        boxShadow: "0 8px 20px -10px rgba(var(--focus-rgb),0.55)",
                      }}
                    >
                      {tr(isAr, "Skip", "تخطي")} ▶
                    </button>
                  ) : (
                    <>
                      {index + 1 < total && (
                        <button
                          type="button"
                          onClick={goToNext}
                          style={{
                            flex: 1,
                            padding: "13px 16px",
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--on-accent, #fff)",
                            background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                            border: "none",
                            borderRadius: 14,
                            cursor: "pointer",
                            minHeight: 50,
                          }}
                        >
                          {tr(isAr, "Next", "التالي")} ▶
                        </button>
                      )}
                      {allAnswered && (
                        <button
                          type="button"
                          onClick={finishQuiz}
                          style={{
                            flex: 1,
                            ...primaryBtnStyle,
                            marginTop: 0,
                            borderRadius: 14,
                            minHeight: 50,
                          }}
                        >
                          <CheckIcon size={16} /> {tr(isAr, "Finish & see results", "إنهاء وعرض النتيجة")}
                        </button>
                      )}
                      {!allAnswered && index + 1 >= total && (
                        <button
                          type="button"
                          disabled
                          style={{
                            flex: 1,
                            padding: "13px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--muted)",
                            background: "rgba(var(--border-rgb),0.1)",
                            border: "1px solid rgba(var(--border-rgb),0.15)",
                            borderRadius: 14,
                            cursor: "default",
                            minHeight: 50,
                          }}
                        >
                          {tr(isAr, `Answer all questions first (${answeredCount}/${total})`, `جاوب على كل الأسئلة أولاً (${answeredCount}/${total})`)}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {stage === "done" && (() => {
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: INK, margin: "10px 0 4px" }}>
                  {score} / {questions.length}
                </p>
                <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 6px" }}>
                  {tr(isAr,
                    `You got ${score} out of ${questions.length} right (${Math.round((score / questions.length) * 100)}%).`,
                    `أجبت صح على ${score} من ${questions.length} (${Math.round((score / questions.length) * 100)}%).`)}
                </p>
                <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
                  {tr(isAr, `Time taken: ${formatQuizDuration(quizDurationMs)}`, `الوقت المستغرق لإنهاء الاختبار: ${formatQuizDuration(quizDurationMs)}`)}
                </p>
              </div>

              {(mistakesFlat || []).length > 0 ? (
                <div style={{ textAlign: "start", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
                    {tr(isAr, "Words to review", "كلمات للمراجعة")}
                  </p>
                  {[
                    { key: "meaning", label: "Meaning", labelAr: "المعنى" },
                    { key: "synonym", label: "Synonym", labelAr: "المرادف" },
                    { key: "antonym", label: "Antonym", labelAr: "المضاد" },
                  ].map((cat) => {
                    const items = (mistakesByCategory && mistakesByCategory[cat.key]) || [];
                    if (!items.length) return null;
                    return (
                      <div key={cat.key} style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" }}>
                          {tr(isAr, cat.label, cat.labelAr)}
                        </p>
                        {items.map((item, idx) => (
                          <ReviewRow key={(item && item.id) || idx} item={item || {}} isAr={isAr} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ textAlign: "center", fontSize: 14, color: "var(--success)", margin: "0 0 18px" }}>
                  {tr(isAr, "Perfect score — nothing to review!", "علامة كاملة — مفيش حاجة للمراجعة!")}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button type="button" onClick={retake} style={{ flex: 1, padding: "12px 14px", fontSize: 14, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 10, cursor: "pointer", minHeight: 48 }}>
                  {tr(isAr, "New quiz", "اختبار جديد")}
                </button>
                <button type="button" onClick={handleClose} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1, minHeight: 48, borderRadius: 10 }}>
                  <CheckIcon size={16} /> {tr(isAr, "Done", "تم")}
                </button>
              </div>
            </div>
          );
        })()}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STATS PANEL
   -------------------------------------------------------------------------
   Read-only summary for the signed-in account, scoped to the dictionary
   section it was opened from: overall progress, a spaced-repetition
   breakdown (new/learning/familiar/mastered + how many are due right
   now), a short "needs work" list, a day streak, and recent quiz scores.
   Pulls only from data that's already loaded client-side — no extra
   network calls.
   ========================================================================= */

export default QuizModal;
