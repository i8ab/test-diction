/**
 * Centralized z-index scale for the entire app.
 * Keep floating tools (bubbles) below info/modals so "How it works"
 * and critical dialogs always appear on top.
 */
export const Z_INDEX = {
  /** Base content / relative layers */
  BASE: 1,
  /** Dropdowns, tooltips, popovers */
  DROPDOWN: 1000,
  /** Sticky headers / bars */
  STICKY: 1100,
  /** Mini floating bubbles (Timer / Calendar / Todo) */
  BUBBLE: 6000,
  /** Full-screen tool views (Timer / Calendar / Todo full mode) */
  TOOL_FULL: 6000,
  /** Standard modals (quiz, add, stats, etc.) */
  MODAL: 8000,
  /** "How it works" / InfoGuide – must sit above bubbles & tool full views */
  INFO_GUIDE: 8500,
  /** High-priority overlays (dictation loading, etc.) */
  HIGH: 9000,
  /** Critical modals that must never be covered (e.g. Timer settings) */
  CRITICAL: 10000,
};

export default Z_INDEX;
