/**
 * Session-only UI restore after refresh (same tab).
 * Fresh visits / new tabs do NOT reopen overlays.
 *
 * Pattern matches timer: write on open + beforeunload, consume once on load.
 */

const OPEN_KEY = "twoTongues.sessionUiOpen";
const QUIZ_SESSION_KEY = "twoTongues.quizSession";
const EXAM_SESSION_KEY = "twoTongues.examSession";

/**
 * Any overlay that should survive a same-tab refresh.
 * (Timer/calendar/todo/goals already use toolViews.js separately.)
 */
const VALID_TOOLS = new Set([
  // study sessions
  "quiz",
  "exam",
  "flashcards",
  "dictation",
  "smartCards",
  "quickReview",
  "weaknessReview",
  "listeningLoop",
  "sentencePractice",
  // viewers / tools
  "stats",
  "dashboard",
  "wordLists",
  "challenges",
  "leaderboard",
  "conversation",
  "tutorChat",
  "levels",
  "progressCompare",
  "textExtract",
  "aiPdfExtract",
  "weeklyReport",
  "achievements",
  "randomWord",
  "motivationDua",
  "infoGuide",
  "examSettings",
]);

/**
 * Mark which study overlay should reopen after a same-tab refresh.
 * Pass null to clear.
 * @param {SessionTool|null} tool
 * @param {object} [extra] e.g. { quizDueOnly: true }
 */
export function setSessionOpenTool(tool, extra = {}) {
  try {
    if (!tool || !VALID_TOOLS.has(tool)) {
      sessionStorage.removeItem(OPEN_KEY);
      return;
    }
    sessionStorage.setItem(OPEN_KEY, JSON.stringify({ tool, ...extra, at: Date.now() }));
  } catch (_) {}
}

/**
 * Read and consume the reopen flag (once per load).
 * @returns {{ tool: SessionTool, quizDueOnly?: boolean } | null}
 */
export function consumeSessionOpenTool() {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OPEN_KEY);
    const p = JSON.parse(raw);
    if (!p || !VALID_TOOLS.has(p.tool)) return null;
    // ignore very old flags (> 6h)
    if (p.at && Date.now() - p.at > 6 * 60 * 60 * 1000) return null;
    return p;
  } catch (_) {
    return null;
  }
}

/** Keep flag alive while the overlay stays open (beforeunload). */
export function peekSessionOpenTool() {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// ——— In-progress quiz / exam session (questions + answers + timer) ———

export function saveQuizSession(payload) {
  try {
    if (!payload) {
      sessionStorage.removeItem(QUIZ_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch (_) {}
}

export function loadQuizSession() {
  try {
    const raw = sessionStorage.getItem(QUIZ_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.questions) || !p.questions.length) return null;
    if (p.savedAt && Date.now() - p.savedAt > 6 * 60 * 60 * 1000) {
      sessionStorage.removeItem(QUIZ_SESSION_KEY);
      return null;
    }
    return p;
  } catch (_) {
    return null;
  }
}

export function clearQuizSession() {
  try {
    sessionStorage.removeItem(QUIZ_SESSION_KEY);
  } catch (_) {}
}

export function saveExamSession(payload) {
  try {
    if (!payload) {
      sessionStorage.removeItem(EXAM_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(EXAM_SESSION_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch (_) {}
}

export function loadExamSession() {
  try {
    const raw = sessionStorage.getItem(EXAM_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p) return null;
    // flash-only sessions have pool; question sessions have questions
    const hasQs = Array.isArray(p.questions) && p.questions.length > 0;
    const hasPool = Array.isArray(p.pool) && p.pool.length > 0;
    if (!hasQs && !hasPool) return null;
    if (p.savedAt && Date.now() - p.savedAt > 6 * 60 * 60 * 1000) {
      sessionStorage.removeItem(EXAM_SESSION_KEY);
      return null;
    }
    return p;
  } catch (_) {
    return null;
  }
}

export function clearExamSession() {
  try {
    sessionStorage.removeItem(EXAM_SESSION_KEY);
  } catch (_) {}
}
