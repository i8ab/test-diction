import { useState, useEffect, useMemo, useRef } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, primaryBtnStyle, errorStyle } from "../../lib/config/theme";
import {
  selectExamPool, buildQuiz, isTypingCorrect, quizQuestionLabel, uid,
} from "../../lib/utils/quizHelpers";
import { SpeakButton, XIcon, CheckIcon, QuizIcon, ClockIcon, FlameIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { loadExamDate, daysUntilExam, formatExamCountdown } from "../../lib/state/exam";

/**
 * Exam Mode — focused session on weak + due words only.
 * Modes: flash (quick review), mcq, typing, cloze.
 * Optional session countdown timer.
 */
export default function ExamModeModal({
  entries,
  studiedIds,
  studiedAt,
  srsDueAt,
  srsBox,
  isAr,
  onClose,
  onRecordSrsAnswer,
  onSaveQuizResult,
  sectionLabel = "",
}) {
  const [stage, setStage] = useState("setup"); // setup | running | done
  const [modes, setModes] = useState(() => new Set(["mcq", "typing"])); // multi-select
  const [limit, setLimit] = useState(15);
  const [timerMin, setTimerMin] = useState(0); // 0 = off
  const [startError, setStartError] = useState("");

  // Running state
  const [pool, setPool] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("prompt"); // flash: prompt | revealed
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [knew, setKnew] = useState(0);
  const [learning, setLearning] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);

  // Session timer
  const [remainingMs, setRemainingMs] = useState(null);
  const endAtRef = useRef(null);

  const examDays = daysUntilExam(loadExamDate());
  const countdownLabel = formatExamCountdown(examDays, isAr);

  const examPoolPreview = useMemo(
    () => selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, 200),
    [entries, studiedIds, srsDueAt, srsBox, studiedAt]
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Countdown ticker
  useEffect(() => {
    if (stage !== "running" || !endAtRef.current) return;
    const tick = () => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        finishSession();
        return;
      }
      setRemainingMs(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [stage]);

  function toggleMode(key) {
    setModes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function startSession() {
    const selectedPool = selectExamPool(entries, studiedIds, srsDueAt, srsBox, studiedAt, limit);
    if (!selectedPool.length) {
      setStartError(tr(isAr,
        "No weak or due words yet. Study a few words first, then come back for exam practice.",
        "مفيش كلمات ضعيفة أو مستحقة للمراجعة. ذاكر شوية كلمات الأول وبعدين ارجع لوضع الامتحان."));
      return;
    }
    if (!modes.size) {
      setStartError(tr(isAr, "Pick at least one question type.", "اختار نوع أسئلة واحد على الأقل."));
      return;
    }
    setStartError("");
    setPool(selectedPool);
    setResults([]);
    setKnew(0);
    setLearning(0);
    setIndex(0);
    setAnswered(false);
    setSelected(null);
    setTypedAnswer("");
    setPhase("prompt");
    setStartedAt(Date.now());
    setFinishedAt(null);

    if (timerMin > 0) {
      endAtRef.current = Date.now() + timerMin * 60 * 1000;
      setRemainingMs(timerMin * 60 * 1000);
    } else {
      endAtRef.current = null;
      setRemainingMs(null);
    }

    const quizModes = [...modes].filter((m) => m !== "flash");
    const flashOnly = modes.has("flash") && quizModes.length === 0;

    if (flashOnly) {
      setQuestions([]);
      setStage("running");
      return;
    }

    // Build a mixed quiz: for each mode, build questions, then interleave.
    const perMode = [];
    for (const m of quizModes) {
      const built = buildQuiz(selectedPool, entries, m);
      perMode.push(built);
    }
    // Round-robin merge so types alternate
    const mixed = [];
    const usedEntry = new Set();
    let maxLen = Math.max(0, ...perMode.map((a) => a.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of perMode) {
        if (i < arr.length) {
          const q = arr[i];
          // Prefer variety: skip if same entryId already added from another mode this round
          // but still allow if pool is small
          mixed.push(q);
        }
      }
    }
    // Cap to ~limit * modes but not crazy long
    const capped = mixed.slice(0, Math.max(limit, Math.min(mixed.length, limit * quizModes.length)));
    if (!capped.length) {
      setStartError(tr(isAr,
        "Couldn't build questions from these words.",
        "مش قادر أبني أسئلة من الكلمات دي."));
      return;
    }
    setQuestions(capped);
    setStage("running");
  }

  function finishSession() {
    if (stage === "done") return;
    const finishedTime = Date.now();
    setFinishedAt(finishedTime);
    setStage("done");
    endAtRef.current = null;
    if (onSaveQuizResult && questions.length > 0) {
      const finalScore = results.filter((r) => r.correct).length;
      onSaveQuizResult({
        id: uid(),
        at: finishedTime,
        section: sectionLabel || "exam",
        mode: `exam-mixed`,
        score: finalScore,
        total: results.length,
        durationMs: startedAt ? finishedTime - startedAt : 0,
      });
    }
  }

  function recordQuizAnswer(q, opt, correct) {
    setSelected(opt);
    setAnswered(true);
    setResults((r) => [...r, {
      id: q.id, correct, type: q.type,
      word: q.word, wordDir: q.wordDir, wordFont: q.wordFont, pos: q.pos || "",
      selectedAnswer: opt, correctAnswer: q.correct,
    }]);
    if (onRecordSrsAnswer) onRecordSrsAnswer(q.entryId, correct);
  }

  function pickOption(opt) {
    if (answered) return;
    const q = questions[index];
    recordQuizAnswer(q, opt, opt === q.correct);
  }

  function submitTyped() {
    if (answered) return;
    const q = questions[index];
    const accepted = q.acceptedAnswers?.length ? q.acceptedAnswers : [q.correct];
    const isCorrect = isTypingCorrect(typedAnswer, accepted);
    recordQuizAnswer(q, typedAnswer, isCorrect);
  }

  function nextQuestion() {
    if (index + 1 >= questions.length) {
      finishSession();
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      setTypedAnswer("");
    }
  }

  // Flash mode handlers
  function handleFlashKnew(ok) {
    const entry = pool[index];
    if (!entry) return;
    if (ok) setKnew((n) => n + 1);
    else setLearning((n) => n + 1);
    if (onRecordSrsAnswer) onRecordSrsAnswer(entry.id, ok);
    if (index < pool.length - 1) {
      setIndex((i) => i + 1);
      setPhase("prompt");
    } else {
      finishSession();
    }
  }

  const score = results.filter((r) => r.correct).length;
  const chipStyle = (active) => ({
    padding: "7px 13px", fontSize: 12.5, fontWeight: 600,
    color: active ? "#fff" : "var(--icon-muted)",
    background: active ? BRASS : "none",
    border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.25)"}`,
    borderRadius: 20, cursor: "pointer",
  });

  function formatTimer(ms) {
    if (ms == null) return "";
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  return (
    <div
      onClick={onClose}
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom))",
        zIndex: 6100,
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        dir={isAr ? "rtl" : "ltr"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-mode-title"
        style={{
          width: "100%", maxWidth: 540, maxHeight: "min(92dvh, 92vh)",
          overflowY: "auto", background: CARD, borderRadius: 12,
          padding: "22px 22px 20px",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="exam-mode-title" style={{
            fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <FlameIcon size={19} color="#e85d04" />
            {tr(isAr, "Exam Mode", "وضع الامتحان")}
          </h2>
          <button
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)",
              width: 36, height: 36, padding: 0, borderRadius: 10,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        {countdownLabel && stage === "setup" && (
          <div style={{
            marginTop: 10, padding: "10px 12px", borderRadius: 8,
            background: examDays != null && examDays <= 7 ? "var(--danger-bg)" : "var(--input-bg)",
            border: `1px solid ${examDays != null && examDays <= 7 ? "var(--danger-border)" : "rgba(var(--border-rgb),0.15)"}`,
            fontSize: 13.5, fontWeight: 600, color: examDays != null && examDays <= 7 ? "var(--danger)" : "var(--muted-strong)",
          }}>
            {countdownLabel}
            {examPoolPreview.length > 0 && (
              <span style={{ fontWeight: 500, marginInlineStart: 6 }}>
                · {tr(isAr, `${examPoolPreview.length} weak/due words`, `${examPoolPreview.length} كلمة ضعيفة/مستحقة`)}
              </span>
            )}
          </div>
        )}

        {/* ——— SETUP ——— */}
        {stage === "setup" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 14, color: "var(--muted-strong)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {tr(isAr,
                "Focused practice on words you still struggle with or that are due for review. No distractions — just the words that matter before the exam.",
                "تدريب مركّز على الكلمات اللي لسه ضعيفة أو مستحقة للمراجعة. بدون تشتيت — بس الكلمات المهمة قبل الامتحان.")}
            </p>

            <div style={{ fontSize: 13, color: "var(--muted-strong)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <QuizIcon size={14} color="var(--success)" />
              {tr(isAr,
                `${examPoolPreview.length} weak or due word${examPoolPreview.length === 1 ? "" : "s"} available`,
                `${examPoolPreview.length} كلمة ضعيفة أو مستحقة متاحة`)}
            </div>

            <label style={labelStyle}>{tr(isAr, "How many words", "عدد الكلمات")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {[10, 15, 20, 30].map((n) => (
                <button key={n} type="button" onClick={() => setLimit(n)} style={chipStyle(limit === n)}>
                  {n}
                </button>
              ))}
            </div>

            <label style={{ ...labelStyle, marginTop: 14 }}>{tr(isAr, "Question types (pick one or more)", "أنواع الأسئلة (اختار واحد أو أكتر)")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => toggleMode("flash")} style={chipStyle(modes.has("flash"))}>
                {tr(isAr, "Quick flash", "مراجعة سريعة")}
              </button>
              <button type="button" onClick={() => toggleMode("mcq")} style={chipStyle(modes.has("mcq"))}>
                {tr(isAr, "Multiple choice", "اختيار من متعدد")}
              </button>
              <button type="button" onClick={() => toggleMode("typing")} style={chipStyle(modes.has("typing"))}>
                {tr(isAr, "Type answer", "اكتب الإجابة")}
              </button>
              <button type="button" onClick={() => toggleMode("cloze")} style={chipStyle(modes.has("cloze"))}>
                {tr(isAr, "Fill the blank", "أكمل الفراغ")}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
              {tr(isAr,
                "Selecting more than one mixes question types in the same session.",
                "لو اخترت أكتر من نوع، الأسئلة هتتخلط في نفس الجلسة.")}
            </p>

            <label style={{ ...labelStyle, marginTop: 14 }}>{tr(isAr, "Session timer (optional)", "مؤقّت الجلسة (اختياري)")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {[0, 5, 10, 15, 20].map((n) => (
                <button key={n} type="button" onClick={() => setTimerMin(n)} style={chipStyle(timerMin === n)}>
                  {n === 0 ? tr(isAr, "Off", "إيقاف") : `${n} ${tr(isAr, "min", "د")}`}
                </button>
              ))}
            </div>

            {startError && <div style={errorStyle} role="alert">{startError}</div>}

            <button
              type="button"
              onClick={startSession}
              disabled={examPoolPreview.length === 0}
              style={{
                ...primaryBtnStyle,
                opacity: examPoolPreview.length === 0 ? 0.5 : 1,
                cursor: examPoolPreview.length === 0 ? "default" : "pointer",
                background: "linear-gradient(135deg, #e85d04, #f4a261)",
              }}
            >
              <FlameIcon size={16} /> {tr(isAr, "Start exam practice", "ابدأ تدريب الامتحان")}
            </button>
          </div>
        )}

        {/* ——— RUNNING ——— */}
        {stage === "running" && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 12.5, color: "var(--muted)", marginBottom: 10, gap: 8, flexWrap: "wrap",
            }}>
              <span>
                {questions.length === 0
                  ? tr(isAr, `Word ${index + 1} of ${pool.length}`, `كلمة ${index + 1} من ${pool.length}`)
                  : tr(isAr, `Question ${index + 1} of ${questions.length}`, `السؤال ${index + 1} من ${questions.length}`)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {questions.length > 0 && <span>{tr(isAr, `Score: ${score}`, `النتيجة: ${score}`)}</span>}
                {remainingMs != null && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700,
                    color: remainingMs < 60_000 ? "var(--danger)" : "var(--muted-strong)",
                  }}>
                    <ClockIcon size={13} /> {formatTimer(remainingMs)}
                  </span>
                )}
              </span>
            </div>

            <div style={{ width: "100%", height: 4, background: "var(--input-bg)", borderRadius: 2, marginBottom: 16 }}>
              <div style={{
                width: `${(index / Math.max(1, questions.length === 0 ? pool.length : questions.length)) * 100}%`,
                height: "100%", background: "#e85d04", borderRadius: 2, transition: "width 0.2s",
              }} />
            </div>

            {questions.length === 0 && pool[index] && (() => {
              const entry = pool[index];
              const isArWord = entry.section === "ar-ar";
              const wordDir = isArWord ? "rtl" : "ltr";
              const wordFont = isArWord ? "'Amiri', serif" : "'Fraunces', serif";
              const meaning = entry.meaning || (entry.senses && entry.senses[0]?.meaning) || "";
              return (
                <div>
                  <div style={{
                    background: "var(--input-bg)", borderRadius: 8, padding: "28px 18px",
                    textAlign: "center", marginBottom: 16,
                  }}>
                    <div dir={wordDir} style={{
                      fontFamily: wordFont, fontSize: "clamp(28px, 5vw, 36px)",
                      fontWeight: 700, color: INK, wordBreak: "break-word",
                    }}>
                      {entry.word}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <SpeakButton text={entry.word} dir={wordDir} isAr={isAr} size={20} />
                    </div>
                  </div>
                  {phase === "prompt" ? (
                    <button type="button" onClick={() => setPhase("revealed")} style={primaryBtnStyle}>
                      {tr(isAr, "Show meaning", "أظهر المعنى")}
                    </button>
                  ) : (
                    <div>
                      <div dir="rtl" style={{
                        fontFamily: "'Amiri', serif", fontSize: 20, color: INK,
                        textAlign: "center", marginBottom: 18, lineHeight: 1.5,
                      }}>
                        {meaning}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => handleFlashKnew(true)}
                          style={{
                            flex: 1, padding: "12px 10px", borderRadius: 10, border: "none",
                            background: "var(--success-bg)", color: "var(--success)",
                            fontWeight: 700, fontSize: 14, cursor: "pointer",
                          }}
                        >
                          <CheckIcon size={15} /> {tr(isAr, "I knew it", "عرفتها")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFlashKnew(false)}
                          style={{
                            flex: 1, padding: "12px 10px", borderRadius: 10, border: "none",
                            background: "var(--danger-bg)", color: "var(--danger)",
                            fontWeight: 700, fontSize: 14, cursor: "pointer",
                          }}
                        >
                          <XIcon size={15} /> {tr(isAr, "Still learning", "لسه بتعلمها")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {questions.length > 0 && questions[index] && (() => {
              const q = questions[index];
              return (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted-strong)", margin: "0 0 10px" }}>
                    {quizQuestionLabel(q.type, isAr, q.pos)}
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--input-bg)", borderRadius: 8, padding: "18px 14px", marginBottom: 14,
                  }}>
                    <div dir={q.promptDir} style={{
                      flex: 1, fontFamily: q.promptFont,
                      fontSize: (q.mode === "cloze" || q.type === "cloze") ? "clamp(18px, 3.5vw, 24px)" : "clamp(24px, 4vw, 32px)",
                      fontWeight: 700, color: INK, wordBreak: "break-word", lineHeight: 1.35,
                    }}>
                      {q.promptText}
                    </div>
                    {q.promptText && q.mode !== "cloze" && q.type !== "cloze" && (
                      <SpeakButton text={q.word} dir={q.wordDir} isAr={isAr} size={20}
                        style={{ flexShrink: 0 }} />
                    )}
                  </div>

                  {(q.mode === "mcq" || q.type === "mcq") ? (
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
                            style={{
                              textAlign: "start", fontFamily: q.optionFont, fontSize: 15.5,
                              padding: "11px 13px", background: bg, border: `1.5px solid ${border}`,
                              color, borderRadius: 6, cursor: answered ? "default" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                            }}>
                            <span>{opt}</span>
                            {answered && isCorrectOpt && <CheckIcon size={15} />}
                            {answered && isSelectedOpt && !isCorrectOpt && <XIcon size={15} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        dir={q.optionDir}
                        autoFocus
                        disabled={answered}
                        value={typedAnswer}
                        onChange={(e) => setTypedAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            answered ? nextQuestion() : submitTyped();
                          }
                        }}
                        placeholder={(q.mode === "cloze" || q.type === "cloze")
                          ? tr(isAr, "Type the missing word…", "اكتب الكلمة الناقصة…")
                          : tr(isAr, "Type your answer…", "اكتب إجابتك…")}
                        style={{
                          width: "100%", boxSizing: "border-box", padding: "11px 13px",
                          fontFamily: q.optionFont, fontSize: 16, color: INK,
                          background: "var(--input-bg)",
                          border: `1px solid ${answered
                            ? (results[results.length - 1]?.correct ? "var(--success)" : "var(--danger-border)")
                            : "rgba(var(--border-rgb),0.2)"}`,
                          borderRadius: 6,
                        }}
                      />
                      {!answered && (
                        <button type="button" onClick={submitTyped} disabled={!typedAnswer.trim()}
                          style={{
                            ...primaryBtnStyle,
                            opacity: typedAnswer.trim() ? 1 : 0.5,
                            cursor: typedAnswer.trim() ? "pointer" : "default",
                          }}>
                          {tr(isAr, "Check answer", "تحقق من الإجابة")}
                        </button>
                      )}
                      {answered && (q.mode === "cloze" || q.type === "cloze") && q.fullExample && (
                        <p dir={q.promptDir} style={{ marginTop: 12, fontSize: 14, color: "var(--muted-strong)", fontFamily: q.promptFont }}>
                          {tr(isAr, "Full sentence: ", "الجملة كاملة: ")}
                          <span style={{ color: INK }}>{q.fullExample}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {answered && (
                    <button type="button" onClick={nextQuestion} style={{ ...primaryBtnStyle, marginTop: 14 }}>
                      {index + 1 >= questions.length
                        ? tr(isAr, "Finish", "إنهاء")
                        : tr(isAr, "Next", "التالي")}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ——— DONE ——— */}
        {stage === "done" && (
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: "0 0 8px", color: INK }}>
              {tr(isAr, "Session complete", "انتهت الجلسة")}
            </h3>
            {questions.length === 0 ? (
              <p style={{ fontSize: 15, color: "var(--muted-strong)", margin: "0 0 16px" }}>
                {tr(isAr,
                  `Knew ${knew} · Still learning ${learning}`,
                  `عرفت ${knew} · لسه بتعلّم ${learning}`)}
              </p>
            ) : (
              <p style={{ fontSize: 15, color: "var(--muted-strong)", margin: "0 0 16px" }}>
                {tr(isAr,
                  `Score: ${score} / ${results.length}`,
                  `النتيجة: ${score} من ${results.length}`)}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => { setStage("setup"); setStartError(""); }}
                style={{ ...primaryBtnStyle, marginTop: 0, width: "auto", padding: "11px 20px" }}>
                {tr(isAr, "Practice again", "تدريب تاني")}
              </button>
              <button type="button" onClick={onClose}
                style={{
                  marginTop: 0, padding: "11px 20px", borderRadius: 12, border: "1px solid rgba(var(--border-rgb),0.25)",
                  background: "none", color: "var(--muted-strong)", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}>
                {tr(isAr, "Close", "إغلاق")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
