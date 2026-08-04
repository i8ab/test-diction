// Admin activity log helpers: building/capping log entries, human-readable
// labels for the admin log viewer, and translating validation error strings.
import { uid } from "../utils/quizHelpers";
import { BRASS } from "../config/theme";

const MAX_LOG_ENTRIES = 500;

function capLogs(list) {
  return list.length > MAX_LOG_ENTRIES ? list.slice(list.length - MAX_LOG_ENTRIES) : list;
}
function makeLogEntry(action, message, actorName, actorCode) {
  return { id: uid(), action, message, actorName: actorName || "", actorCode: actorCode || "", at: Date.now() };
}

function translateAdminError(msg, isAr) {
  if (!isAr) return msg;
  const retryMatch = /^Too many attempts — try again in (\d+)s\.$/.exec(msg || "");
  if (retryMatch) return `محاولات كثيرة جدًا — حاول مرة أخرى بعد ${retryMatch[1]} ثانية.`;
  if (msg === "Server not configured: missing ACCESS_CODE env var.") return "الخادم غير مُهيأ: متغير ACCESS_CODE مفقود.";
  const map = {
    "Enter a name.": "أدخل اسمًا.",
    "An account with this name already exists.": "يوجد حساب بهذا الاسم بالفعل.",
    "That name is already taken.": "هذا الاسم مستخدم بالفعل.",
    "Enter the access code.": "أدخل رمز الوصول.",
    "Still loading — please try again in a moment.": "جارٍ التحميل — يرجى المحاولة مرة أخرى بعد لحظة.",
    "Enter your personal code.": "أدخل رمزك الشخصي.",
    "That personal code doesn't match any account.": "هذا الرمز الشخصي لا يطابق أي حساب.",
    "Couldn't verify the access code — check your connection and try again.": "تعذّر التحقق من رمز الوصول — تحقق من اتصالك وحاول مرة أخرى.",
    "That access code doesn't match.": "رمز الوصول غير مطابق.",
  };
  return map[msg] || msg;
}

// Human-readable labels/colors for each action type in the admin activity log.
const LOG_ACTION_META = {
  word_add: { label: "Word added", labelAr: "تمت إضافة كلمة", color: "var(--success)" },
  word_edit: { label: "Word edited", labelAr: "تم تعديل كلمة", color: BRASS },
  word_delete: { label: "Word deleted", labelAr: "تم حذف كلمة", color: "var(--danger)" },
  account_add: { label: "Account added", labelAr: "تمت إضافة حساب", color: "var(--success)" },
  account_edit: { label: "Account edited", labelAr: "تم تعديل حساب", color: BRASS },
  account_delete: { label: "Account deleted", labelAr: "تم حذف حساب", color: "var(--danger)" },
  first_sign_in: { label: "First sign in", labelAr: "أول تسجيل دخول", color: "var(--success)" },
  sign_in: { label: "Sign in", labelAr: "تسجيل دخول", color: "var(--accent-1)" },
  sign_out: { label: "Sign out", labelAr: "تسجيل خروج", color: "var(--muted-strong)" },
};

// Sections shown as filter tabs at the top of the admin activity log.
const LOG_SECTIONS = [
  { key: "all", label: "All", labelAr: "الكل", match: () => true },
  { key: "words", label: "Words", labelAr: "الكلمات", match: (a) => a === "word_add" || a === "word_edit" || a === "word_delete" },
  { key: "accounts", label: "Accounts", labelAr: "الحسابات", match: (a) => a === "account_add" || a === "account_edit" || a === "account_delete" },
  { key: "first_sign_in", label: "First Sign In", labelAr: "أول تسجيل دخول", match: (a) => a === "first_sign_in" },
  { key: "sign_in", label: "Sign In", labelAr: "تسجيل الدخول", match: (a) => a === "sign_in" },
  { key: "sign_out", label: "Sign Out", labelAr: "تسجيل الخروج", match: (a) => a === "sign_out" },
];

export { capLogs, makeLogEntry, translateAdminError, LOG_ACTION_META, LOG_SECTIONS };
