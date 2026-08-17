/**
 * Lazily loaded feature modals / pages.
 * Kept out of the main bundle until the user opens them.
 */
import { lazy } from "react";

export const QuizModal = lazy(() => import("./QuizModal"));
export const ExamModeModal = lazy(() => import("./ExamModeModal"));
export const ExamSettingsModal = lazy(() => import("./ExamSettingsModal"));
export const StatsModal = lazy(() => import("./StatsModal"));
export const LeaderboardModal = lazy(() => import("./LeaderboardModal"));
export const FlashcardsModal = lazy(() => import("./FlashcardsModal"));
export const AddModal = lazy(() => import("./AddModal"));
export const AccountModal = lazy(() => import("./AccountModal"));
export const AdminModal = lazy(() => import("./AdminModal"));
export const WordZoomModal = lazy(() => import("./WordZoomModal"));
export const TimerPage = lazy(() => import("../timer/TimerPage"));
export const CalendarPage = lazy(() => import("../calendar/CalendarPage"));
export const TodoPage = lazy(() => import("../todo/TodoPage"));
export const QuickReviewModal = lazy(() => import("./QuickReviewModal"));
export const GoalsPage = lazy(() => import("../goals/GoalsPage"));
export const InfoGuideModal = lazy(() => import("./InfoGuideModal"));
export const DictationModal = lazy(() => import("./DictationModal"));
export const AchievementsModal = lazy(() => import("./AchievementsModal"));
export const RandomWordModal = lazy(() => import("./RandomWordModal"));
export const DashboardPage = lazy(() => import("../dashboard/DashboardPage"));
export const WordListsModal = lazy(() => import("./WordListsModal"));
export const ChallengeModal = lazy(() => import("./ChallengeModal"));
export const SmartCardsModal = lazy(() => import("./SmartCardsModal"));
export const ConversationModal = lazy(() => import("./ConversationModal"));
export const LevelsModal = lazy(() => import("./LevelsModal"));
export const LevelUpModal = lazy(() => import("./LevelUpModal"));
export const ProgressCompareModal = lazy(() => import("./ProgressCompareModal"));
export const TextExtractModal = lazy(() => import("./TextExtractModal"));
export const AiPdfExtractModal = lazy(() => import("./AiPdfExtractModal"));
export const WeaknessReviewModal = lazy(() => import("./WeaknessReviewModal"));
export const ListeningLoopModal = lazy(() => import("./ListeningLoopModal"));
export const SentencePracticeModal = lazy(() => import("./SentencePracticeModal"));
export const WeeklyReportModal = lazy(() => import("./WeeklyReportModal"));
export const TutorChatModal = lazy(() => import("./TutorChatModal"));
export const MotivationalQuoteModal = lazy(() => import("./MotivationalQuoteModal"));
export const StudyDuaModal = lazy(() => import("./StudyDuaModal"));


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
export function preloadSettingsHeavy() {
  preloadAdminModal();
  preloadAccountModal();
  preloadInfoGuideModal();
  preloadExamSettingsModal();
}
