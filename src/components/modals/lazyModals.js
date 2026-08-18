/**
 * Lazily loaded feature modals / pages.
 * Kept out of the main bundle until the user opens them.
 *
 * After a deploy, old cached shells may request a hashed chunk that no longer
 * exists. We reload once automatically instead of stranding the user on an
 * error screen.
 */
import { lazy } from "react";

const CHUNK_RELOAD_KEY = "twoTongues.chunkReloadOnce";

function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch (_) {}
  window.location.reload();
}

function safeLazy(importer) {
  return lazy(() =>
    importer().catch((err) => {
      const msg = String((err && err.message) || err || "");
      if (
        /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i.test(
          msg
        )
      ) {
        reloadOnceForStaleChunk();
        // Keep the promise pending while the page reloads
        return new Promise(() => {});
      }
      throw err;
    })
  );
}

export const QuizModal = safeLazy(() => import("./QuizModal"));
export const ExamModeModal = safeLazy(() => import("./ExamModeModal"));
export const ExamSettingsModal = safeLazy(() => import("./ExamSettingsModal"));
export const StatsModal = safeLazy(() => import("./StatsModal"));
export const LeaderboardModal = safeLazy(() => import("./LeaderboardModal"));
export const FlashcardsModal = safeLazy(() => import("./FlashcardsModal"));
export const AddModal = safeLazy(() => import("./AddModal"));
export const AccountModal = safeLazy(() => import("./AccountModal"));
export const AdminModal = safeLazy(() => import("./AdminModal"));
export const WordZoomModal = safeLazy(() => import("./WordZoomModal"));
export const TimerPage = safeLazy(() => import("../timer/TimerPage"));
export const CalendarPage = safeLazy(() => import("../calendar/CalendarPage"));
export const TodoPage = safeLazy(() => import("../todo/TodoPage"));
export const QuickReviewModal = safeLazy(() => import("./QuickReviewModal"));
export const GoalsPage = safeLazy(() => import("../goals/GoalsPage"));
export const InfoGuideModal = safeLazy(() => import("./InfoGuideModal"));
export const DictationModal = safeLazy(() => import("./DictationModal"));
export const AchievementsModal = safeLazy(() => import("./AchievementsModal"));
export const RandomWordModal = safeLazy(() => import("./RandomWordModal"));
export const DashboardPage = safeLazy(() => import("../dashboard/DashboardPage"));
export const WordListsModal = safeLazy(() => import("./WordListsModal"));
export const ChallengeModal = safeLazy(() => import("./ChallengeModal"));
export const SmartCardsModal = safeLazy(() => import("./SmartCardsModal"));
export const ConversationModal = safeLazy(() => import("./ConversationModal"));
export const LevelsModal = safeLazy(() => import("./LevelsModal"));
export const LevelUpModal = safeLazy(() => import("./LevelUpModal"));
export const ProgressCompareModal = safeLazy(() => import("./ProgressCompareModal"));
export const TextExtractModal = safeLazy(() => import("./TextExtractModal"));
export const AiPdfExtractModal = safeLazy(() => import("./AiPdfExtractModal"));
export const WeaknessReviewModal = safeLazy(() => import("./WeaknessReviewModal"));
export const ListeningLoopModal = safeLazy(() => import("./ListeningLoopModal"));
export const SentencePracticeModal = safeLazy(() => import("./SentencePracticeModal"));
export const WeeklyReportModal = safeLazy(() => import("./WeeklyReportModal"));
export const TutorChatModal = safeLazy(() => import("./TutorChatModal"));
export const MotivationalQuoteModal = safeLazy(() => import("./MotivationalQuoteModal"));
export const StudyDuaModal = safeLazy(() => import("./StudyDuaModal"));
export const MotivationDuaModal = safeLazy(() => import("./MotivationDuaModal"));

/** Fire-and-forget chunk preloads so the next open feels instant. */
const _preloaded = new Set();

function preload(key, importer) {
  if (_preloaded.has(key)) return;
  _preloaded.add(key);
  try {
    importer();
  } catch (_) {}
}

export function preloadAdminModal() {
  preload("admin", () => import("./AdminModal"));
}
export function preloadAccountModal() {
  preload("account", () => import("./AccountModal"));
}
export function preloadInfoGuideModal() {
  preload("info", () => import("./InfoGuideModal"));
}
export function preloadExamSettingsModal() {
  preload("examSettings", () => import("./ExamSettingsModal"));
}
export function preloadMotivationDuaModal() {
  preload("motivationDua", () => import("./MotivationDuaModal"));
}
export function preloadSettingsHeavy() {
  preloadAdminModal();
  preloadAccountModal();
  preloadInfoGuideModal();
  preloadExamSettingsModal();
}
