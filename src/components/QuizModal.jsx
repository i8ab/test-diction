import { useState, useEffect, useMemo } from "react";
import { tr } from "../lib/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle } from "../lib/theme";
import {
  uid, quizRangeStart, selectQuizEntries, isTypingCorrect, buildQuiz,
  quizQuestionLabel, isSrsDue, quizResultCategory, formatQuizDuration,
} from "../lib/quizHelpers";
import { SpeakButton, XIcon, CheckIcon, EyeIcon, QuizIcon } from "./Icons";

function ReviewRow({ item, isAr }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 4, marginBottom: 8 }}>
      <div dir={item.wordDir} style={{ fontFamily: item.wordFont, fontSize: 16, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {item.word}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-strong)", margin: 0 }}>
        {tr(isAr,
          `You said "${item.selectedAnswer}" — the correct one is "${item.correctAnswer}".`,
          `انت غلطت، قلت معناها "${item.selectedAnswer}"، وهي فعلاً "${item.correctAnswer}".`)}
      </p>
    </div>
  );
}

function QuizModal({ entries, sectionLabel, studiedIds, studiedAt, srsDueAt, sessionStart, isAr, onClose, onRecordSrsAnswer, onSaveQuizResult }) {
  const [rangeKey, setRangeKey] = useState("60");
  const [customMinutes, setCustomMinutes] = useState("120");
  const [mode, setMode] = useState("mcq"); // mcq | typing
  const [dueOnly, setDueOnly] = useState(false);
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

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
      word: q.word, wordDir: q.wordDir, wordFont: q.wordFont,
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
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={isAr ? "rtl" : "ltr"} role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title"
        style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="quiz-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <QuizIcon size={19} color={BRASS} /> {tr(isAr, "Quiz", "اختبار")}
            {sectionLabel && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {sectionLabel}</span>}
          </h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {stage === "setup" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr,
                "Pick which studied words to be tested on. The quiz mixes meaning, definition, fill-in-the-blank (when a word has an example sentence), and synonyms/antonyms for any word that has them — so it's not just rote memorization.",
                "اختر الكلمات التي تمت دراستها والتي عايز تختبر فيها. الاختبار بيخلط بين المعنى والتعريف وإكمال الفراغ (لو الكلمة ليها جملة مثال) والمرادفات/المضادات لأي كلمة ليها — مش مجرد حفظ.")}
            </p>
            <label style={labelStyle}>{tr(isAr, "Studied within", "تمت دراستها خلال")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
              {RANGE_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => { setRangeKey(o.key); setStartError(""); }} style={chipStyle(rangeKey === o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
            {rangeKey === "custom" && (
              <>
                <label style={labelStyle} htmlFor="quiz-custom-minutes">{tr(isAr, "Minutes", "عدد الدقائق")}</label>
                <input id="quiz-custom-minutes" type="number" min="1" max="10080" value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }} inputMode="numeric" />
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 13, color: "var(--muted-strong)" }}>
              <EyeIcon size={14} color="var(--success)" />
              {tr(isAr,
                `${matchingEntries.length} studied word${matchingEntries.length === 1 ? "" : "s"} match this range.`,
                `${matchingEntries.length} كلمة متاحة من الكلمات المدروسة في هذا النطاق.`)}
            </div>
            <label style={{ ...labelStyle, marginTop: 16 }}>{tr(isAr, "Question type", "نوع الأسئلة")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
              <button type="button" onClick={() => setMode("mcq")} style={chipStyle(mode === "mcq")}>
                {tr(isAr, "Multiple choice", "اختيار من متعدد")}
              </button>
              <button type="button" onClick={() => setMode("typing")} style={chipStyle(mode === "typing")}>
                {tr(isAr, "Type the answer", "اكتب الإجابة")}
              </button>
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
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                <span>{tr(isAr, `Question ${index + 1} of ${questions.length}`, `السؤال ${index + 1} من ${questions.length}`)}</span>
                <span>{tr(isAr, `Score: ${score}`, `النتيجة: ${score}`)}</span>
              </div>
              <div style={{ width: "100%", height: 4, background: "var(--input-bg)", borderRadius: 2, marginBottom: 18 }}>
                <div style={{ width: `${((index) / questions.length) * 100}%`, height: "100%", background: BRASS, borderRadius: 2, transition: "width 0.2s" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px" }}>
                <p style={{ fontSize: 21, fontWeight: 700, color: "var(--muted-strong)", margin: 0 }}>{quizQuestionLabel(q.type, isAr)}</p>
                <SpeakButton text={quizQuestionLabel(q.type, isAr)} dir={isAr ? "rtl" : "ltr"} isAr={isAr} size={16}
                  style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--input-bg)", borderRadius: 4, padding: "20px 16px", marginBottom: 16 }}>
                <div dir={q.promptDir} style={{ flex: 1, minWidth: 0, fontFamily: q.promptFont, fontSize: "clamp(26px, 4.2vw, 34px)", fontWeight: 700, color: INK, wordBreak: "break-word", lineHeight: 1.3 }}>
                  {q.promptText}
                </div>
                {q.promptText && (
                  <SpeakButton text={q.promptText} dir={q.promptDir} isAr={isAr} size={22}
                    style={{ flexShrink: 0, background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: "50%", width: 38, height: 38, justifyContent: "center", color: BRASS }} />
                )}
              </div>
              {mode === "mcq" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {q.options.map((opt, i) => {
                    const isCorrectOpt = opt === q.correct;
                    const isSelectedOpt = opt === selected;
                    let bg = "var(--card)", border = "rgba(var(--border-rgb),0.2)", color = INK;
                    if (answered && isCorrectOpt) { bg = "var(--success-bg)"; border = "var(--success)"; color = "var(--success)"; }
                    else if (answered && isSelectedOpt && !isCorrectOpt) { bg = "var(--danger-bg)"; border = "var(--danger-border)"; color = "var(--danger)"; }
                    return (
                      <button key={i} type="button" onClick={() => pickOption(opt)} disabled={answered}
                        dir={q.optionDir}
                        style={{ textAlign: "start", fontFamily: q.optionFont, fontSize: 16, padding: "12px 14px", background: bg, border: `1.5px solid ${border}`, color, borderRadius: 4, cursor: answered ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span>{opt}</span>
                        {answered && isCorrectOpt && <CheckIcon size={16} />}
                        {answered && isSelectedOpt && !isCorrectOpt && <XIcon size={16} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Typing mode: one free-text input, checked on submit (or
                // Enter) against the correct answer, case/diacritic-insensitive.
                <div>
                  <input
                    type="text"
                    dir={q.optionDir}
                    autoFocus
                    disabled={answered}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); answered ? nextQuestion() : submitTyped(); } }}
                    placeholder={tr(isAr, "Type your answer…", "اكتب إجابتك…")}
                    style={{ ...inputStyle, fontFamily: q.optionFont, fontSize: 17,
                      borderColor: answered ? (results[results.length - 1]?.correct ? "var(--success)" : "var(--danger-border)") : undefined }}
                  />
                  {!answered && (
                    <button type="button" onClick={submitTyped} disabled={!typedAnswer.trim()} style={{ ...primaryBtnStyle, opacity: typedAnswer.trim() ? 1 : 0.5, cursor: typedAnswer.trim() ? "pointer" : "default" }}>
                      {tr(isAr, "Check answer", "تحقق من الإجابة")}
                    </button>
                  )}
                  {answered && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 4, fontSize: 14,
                      background: results[results.length - 1]?.correct ? "var(--success-bg)" : "var(--danger-bg)",
                      color: results[results.length - 1]?.correct ? "var(--success)" : "var(--danger)" }}>
                      {results[results.length - 1]?.correct
                        ? tr(isAr, "Correct!", "إجابة صحيحة!")
                        : tr(isAr, `Not quite — the answer is "${q.correct}".`, `مش صح — الإجابة الصح هي "${q.correct}".`)}
                    </div>
                  )}
                </div>
              )}
              {answered && (
                <button type="button" onClick={nextQuestion} style={primaryBtnStyle}>
                  {index + 1 >= questions.length ? tr(isAr, "See results", "عرض النتيجة") : tr(isAr, "Next question", "السؤال التالي")}
                </button>
              )}
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

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={retake} style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                  {tr(isAr, "New quiz", "اختبار جديد")}
                </button>
                <button type="button" onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}>
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
