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
    "Enter a username.": "أدخل اسم مستخدم.",
    "Username must be at least 3 characters.": "اسم المستخدم يجب ألا يقل عن ٣ أحرف.",
    "Username must be at most 30 characters.": "اسم المستخدم يجب ألا يزيد عن ٣٠ حرفًا.",
    "Username can't contain consecutive periods.": "اسم المستخدم لا يمكن أن يحتوي على نقاط متتالية.",
    "Username can only use letters, numbers, underscores and periods, and must start/end with a letter or number.": "اسم المستخدم يقبل حروفًا وأرقامًا و _ و . فقط، ويجب أن يبدأ وينتهي بحرف أو رقم.",
    "Enter a password.": "أدخل كلمة مرور.",
    "Password must be at least 6 characters.": "كلمة المرور يجب ألا تقل عن ٦ أحرف.",
    "Password is too long.": "كلمة المرور طويلة جدًا.",
    "Passwords do not match.": "كلمتا المرور غير متطابقتين.",
    "That username is already taken. Pick another.": "اسم المستخدم مستخدم بالفعل. اختر آخر.",
    "That username is already taken.": "اسم المستخدم مستخدم بالفعل.",
    "That username doesn't match any account.": "اسم المستخدم لا يطابق أي حساب.",
    "Your account is still waiting for admin approval.": "حسابك ما زال في انتظار موافقة الأدمن.",
    "Your account request was declined. Contact an admin.": "تم رفض طلب حسابك. تواصل مع الأدمن.",
    "Wrong password.": "كلمة المرور خاطئة.",
    "Couldn't verify the password — try again.": "تعذّر التحقق من كلمة المرور — حاول مرة أخرى.",
    "Enter your password.": "أدخل كلمة المرور.",
    "Someone else just made a change — please try again.": "شخص آخر عدّل للتو — حاول مرة أخرى.",
    "Couldn't create the account — check your connection and try again.": "تعذّر إنشاء الحساب — تحقق من اتصالك وحاول مرة أخرى.",
    "Please select Male or Female.": "من فضلك اختر ذكر أو أنثى.",
    "Enter a valid birth date.": "أدخل تاريخ ميلاد صحيح.",
    "Birth date can't be in the future.": "تاريخ الميلاد مش ينفع يكون في المستقبل.",
    "Birth date is too far in the past.": "تاريخ الميلاد قديم زيادة.",
    "You must be at least 5 years old.": "لازم يكون عمرك ٥ سنين على الأقل.",
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
