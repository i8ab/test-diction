import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import {
  uid, quizRangeStart, selectQuizEntries, isTypingCorrect, buildQuiz,
  quizQuestionLabel, isSrsDue, quizResultCategory, QUIZ_RESULT_CATEGORIES, formatQuizDuration,
} from "../../lib/utils/quizHelpers";
import { SpeakButton, XIcon, CheckIcon, EyeIcon, QuizIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function ReviewRow({ item, isAr }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 4, marginBottom: 8 }}>
      <div dir={item.wordDir} style={{ fontFamily: item.wordFont, fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {item.word}
        {item.pos ? (
          <span style={{ marginInlineStart: 8, fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", fontFamily: "'Source Sans 3', sans-serif" }}>
            ({item.pos})
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: 0 }}>
        {tr(isAr,
          `You said "${item.selectedAnswer}" — the correct one is "${item.correctAnswer}".`,
          `انت غلطت، قلت معناها "${item.selectedAnswer}"، وهي فعلاً "${item.correctAnswer}".`)}
      </p>
    </div>
  );
}

function QuizModal({ entries, sectionLabel, studiedIds, studiedAt, srsDueAt, sessionStart, isAr, onClose, onRecordSrsAnswer, onSaveQuizResult, initialDueOnly }) {
  // "Daily review" entry points (the reminder banner's "Review now", the
  // due-count stat) jump straight into a due-only quiz spanning every
  // studied word, not just whatever the last-used time range happened to
  // be — so default the range wide open whenever we're asked to start
  // due-only, instead of the usual "last hour" default.
  const [rangeKey, setRangeKey] = useState(initialDueOnly ? "all" : "60");
  const [customMinutes, setCustomMinutes] = useState("120");
  const mode = "mcq"; // quiz is multiple-choice only
  const [dueOnly, setDueOnly] = useState(!!initialDueOnly);
  const [stage, setStage] = useState("setup"); // setup | running | done
  const [startError, setStartError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
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
    const base = selectQuizEntries(entries, studiedIds, studiedAt, rangeStart);
    return dueOnly ? base.filter((e) => isSrsDue(e.id, srsDueAt)) : base;
  }, [entries, studiedIds, studiedAt, rangeStart, dueOnly, srsDueAt]);

  function startQuiz() {
    const built = buildQuiz(matchingEntries, entries, mode);
    if (!built.length) {
      setStartError(tr(isAr,
        "Not enough words yet to build a quiz from this selection — add a few more words to the dictionary or pick a wider time range.",
        "لا توجد كلمات كافية لعمل اختبار من هذا الاختيار — أضف كلمات أكتر للقاموس أو اختر نطاق وقت أوسع."));
      return;
    }
    setStartError("");
    setQuestions(built);
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setResults([]);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setTypedAnswer("");
    setStage("running");
  }

  function recordAnswer(q, opt, correct) {
    setSelected(opt);
    setAnswered(true);
    setResults((r) => [...r, {
      id: q.id, correct, type: q.type,
      word: q.word, wordDir: q.wordDir, wordFont: q.wordFont, pos: q.pos || "",
      selectedAnswer: opt, correctAnswer: q.correct,
    }]);
    // Feed this word's result into its spaced-repetition schedule. Fire
    // and forget — the quiz UI doesn't need to wait on the save.
    if (onRecordSrsAnswer) onRecordSrsAnswer(q.entryId, correct);
  }

  function pickOption(opt) {
    if (answered) return;
    const q = questions[index];
    recordAnswer(q, opt, opt === q.correct);
  }

  function skipQuestion() {
    if (answered) return;
    const q = questions[index];
    // Skip counts as incorrect so SRS still gets a signal
    recordAnswer(q, tr(isAr, "(skipped)", "(تخطي)"), false);
  }

  const optionLetters = isAr ? ["أ", "ب", "ج", "د", "هـ", "و"] : ["A", "B", "C", "D", "E", "F"];

  function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Typing mode: compares the typed text to every accepted answer for
  // this question (see isTypingCorrect) — ignoring case, whitespace, and
  // Arabic tashkeel, and tolerating small typos. For synonym/antonym
  // questions this means ANY valid synonym/antonym from the word's list
  // counts, not just the one specific string the quiz happened to pick.
  function submitTyped() {
    if (answered) return;
    const q = questions[index];
    const accepted = q.acceptedAnswers && q.acceptedAnswers.length ? q.acceptedAnswers : [q.correct];
    const isCorrect = isTypingCorrect(typedAnswer, accepted);
    recordAnswer(q, typedAnswer, isCorrect);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      const finishedTime = Date.now();
      setFinishedAt(finishedTime);
      setStage("done");
      if (onSaveQuizResult) {
        const finalScore = results.filter((r) => r.correct).length;
        onSaveQuizResult({
          id: uid(), at: finishedTime, section: sectionLabel || "", mode,
          score: finalScore, total: results.length,
          durationMs: startedAt ? finishedTime - startedAt : 0,
        });
      }
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      setTypedAnswer("");
    }
  }

  function retake() {
    setStage("setup");
    setStartError("");
  }

  const score = results.filter((r) => r.correct).length;
  const quizDurationMs = startedAt && finishedAt ? finishedAt - startedAt : 0;

  // Every wrong question, grouped into the three review sections. Unlike a
  // simple word list, a word can appear more than once here (e.g. wrong on
  // two different synonyms of the same word) since each mistake has its
  // own correct answer to compare against.
  const mistakesByCategory = useMemo(() => {
    const map = { meaning: [], synonym: [], antonym: [] };
    for (const r of results) {
      if (r.correct) continue;
      map[quizResultCategory(r.type)].push(r);
    }
    return map;
  }, [results]);

  // Flat list of every mistake — meaning first, then synonyms, then
  // antonyms — all shown at once in the review.
  const mistakesFlat = useMemo(
    () => [...mistakesByCategory.meaning, ...mistakesByCategory.synonym, ...mistakesByCategory.antonym],
    [mistakesByCategory]
  );

  const chipStyle = (active) => ({
    padding: "7px 13px", fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)",
    background: active ? BRASS : "none", border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.25)"}`,
    borderRadius: 20, cursor: "pointer",
  });

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 6000 }}>
      <BodyScrollLock />
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title"
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: CARD, borderRadius: 20, padding: "20px 18px 18px", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="quiz-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <QuizIcon size={19} color={BRASS} /> {tr(isAr, "Quiz", "اختبار")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)", width: 36, height: 36, padding: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 0 }}><XIcon size={20} /></button>
        </div>

        {stage === "setup" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Pick which studied words to be tested on. Questions are multiple choice — choose the correct meaning.",
                "اختار الكلمات اللي ذاكرتها واللي عايز تختبر فيها. الأسئلة اختيار من متعدد — اختار المعنى الصحيح.")}
            </p>
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
                `${matchingEntries.length} studied word${matchingEntries.length === 1 ? "" : "s"} match this range.`,
                `${matchingEntries.length} كلمة متاحة من الكلمات المدروسة في هذا النطاق.`)}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: "var(--muted-strong)", cursor: "pointer" }}>
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
              {tr(isAr, "Only words due for review (spaced repetition)", "الكلمات المستحقة للمراجعة فقط (التكرار المتباعد)")}
            </label>
            {startError && <div style={errorStyle} role="alert" aria-live="assertive">{startError}</div>}
            <button type="button" onClick={startQuiz} disabled={matchingEntries.length === 0} style={{ ...primaryBtnStyle, opacity: matchingEntries.length === 0 ? 0.5 : 1, cursor: matchingEntries.length === 0 ? "default" : "pointer" }}>
              <QuizIcon size={16} /> {tr(isAr, "Start quiz", "ابدأ الاختبار")}
            </button>
          </div>
        )}

        {stage === "running" && questions[index] && (() => {
          const q = questions[index];
          // Number strip around current question (like the screenshot)
          const total = questions.length;
          const windowSize = 9;
          let startNum = Math.max(1, (index + 1) - Math.floor(windowSize / 2));
          let endNum = Math.min(total, startNum + windowSize - 1);
          if (endNum - startNum + 1 < windowSize) startNum = Math.max(1, endNum - windowSize + 1);
          const numberStrip = [];
          for (let n = startNum; n <= endNum; n++) numberStrip.push(n);

          return (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* Top bar: timer + progress text + score */}
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
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: BRASS }}>
                  {tr(isAr, `Score ${score}`, `النتيجة ${score}`)}
                </span>
              </div>

              {/* Thin progress bar */}
              <div style={{ width: "100%", height: 5, background: "rgba(var(--border-rgb),0.15)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                <div style={{
                  width: `${((index) / Math.max(total, 1)) * 100}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, var(--accent-1), var(--accent-2))`,
                  borderRadius: 3,
                  transition: "width 0.25s ease",
                }} />
              </div>

              {/* Question type label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-strong)", margin: 0, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  {quizQuestionLabel(q.type, isAr, q.pos)}
                </p>
                <SpeakButton text={quizQuestionLabel(q.type, isAr, q.pos)} dir={isAr ? "rtl" : "ltr"} isAr={isAr} size={14} style={{ flexShrink: 0 }} />
              </div>

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

              {/* Options — modern pills with letter badges (inspired by the screenshot) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {q.options.map((opt, i) => {
                  const isCorrectOpt = opt === q.correct;
                  const isSelectedOpt = opt === selected;
                  let bg = "var(--card)";
                  let border = "rgba(var(--border-rgb),0.18)";
                  let color = INK;
                  let letterBg = "rgba(var(--border-rgb),0.12)";
                  let letterColor = "var(--muted-strong)";
                  if (answered && isCorrectOpt) {
                    bg = "var(--success-bg)";
                    border = "var(--success)";
                    color = "var(--success)";
                    letterBg = "var(--success)";
                    letterColor = "#fff";
                  } else if (answered && isSelectedOpt && !isCorrectOpt) {
                    bg = "var(--danger-bg)";
                    border = "var(--danger-border)";
                    color = "var(--danger)";
                    letterBg = "var(--danger)";
                    letterColor = "#fff";
                  }
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickOption(opt)}
                      disabled={answered}
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
                        cursor: answered ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "transform 0.12s ease, box-shadow 0.12s ease",
                        boxShadow: answered ? "none" : "0 2px 8px -4px rgba(0,0,0,0.12)",
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
                      {answered && isCorrectOpt && <CheckIcon size={18} />}
                      {answered && isSelectedOpt && !isCorrectOpt && <XIcon size={18} />}
                    </button>
                  );
                })}
              </div>

              {/* Bottom: number strip + Skip / Next */}
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                {/* Number strip */}
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  gap: 6, marginBottom: 14, flexWrap: "wrap",
                }}>
                  {numberStrip.map((n) => {
                    const isCurrent = n === index + 1;
                    const isPast = n < index + 1;
                    return (
                      <div
                        key={n}
                        style={{
                          width: isCurrent ? 36 : 28,
                          height: isCurrent ? 36 : 28,
                          borderRadius: 10,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: isCurrent ? 14 : 12,
                          fontWeight: isCurrent ? 800 : 600,
                          background: isCurrent
                            ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))"
                            : isPast
                              ? "rgba(var(--border-rgb),0.18)"
                              : "transparent",
                          color: isCurrent ? "#fff" : "var(--muted-strong)",
                          border: isCurrent ? "none" : "1px solid rgba(var(--border-rgb),0.15)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                {!answered ? (
                  <button
                    type="button"
                    onClick={skipQuestion}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#fff",
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
                  <button type="button" onClick={nextQuestion} style={{ ...primaryBtnStyle, marginTop: 0, borderRadius: 14, minHeight: 50 }}>
                    {index + 1 >= questions.length
                      ? tr(isAr, "See results", "عرض النتيجة")
                      : tr(isAr, "Next question", "السؤال التالي")}
                  </button>
                )}
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

              {mistakesFlat.length > 0 ? (
                <div style={{ textAlign: "start", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: "0 0 10px" }}>
                    {tr(isAr, "Words to review", "كلمات للمراجعة")}
                  </p>
                  {QUIZ_RESULT_CATEGORIES.map((cat) => {
                    const items = mistakesByCategory[cat.key];
                    if (!items.length) return null;
                    return (
                      <div key={cat.key} style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" }}>
                          {tr(isAr, cat.label, cat.labelAr)}
                        </p>
                        {items.map((item) => (
                          <ReviewRow key={item.id} item={item} isAr={isAr} />
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
                <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1, minHeight: 48, borderRadius: 10 }}>
                  <CheckIcon size={16} /> {tr(isAr, "Done", "تم")}
                </button>
              </div>
            </div>
          );
        })()}
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
