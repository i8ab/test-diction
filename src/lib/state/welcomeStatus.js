/**
 * Small, dependency-free helpers around the "has the user seen the welcome
 * onboarding modal" flag. Kept in their own module (separate from
 * WelcomeOnboardingModal.jsx) so callers that only need to check/set the
 * flag don't force the ~900-line modal component into the main bundle.
 */

export function hasSeenWelcome(accountCode) {
  if (!accountCode || accountCode === "guest") return true;
  try {
    return localStorage.getItem("twoTongues.welcomeSeen." + accountCode) === "1";
  } catch (_) {
    return true;
  }
}

export function markWelcomeSeen(accountCode) {
  if (!accountCode || accountCode === "guest") return;
  try {
    localStorage.setItem("twoTongues.welcomeSeen." + accountCode, "1");
  } catch (_) {}
}
