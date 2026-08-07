/**
 * خزنة الحسابات المحفوظة على الجهاز — لتبديل سريع بدون تسجيل خروج كامل.
 * - الجلسة الفعلية = personal code (كما كان).
 * - الخزنة تحفظ بيانات الحسابات بعد تسجيل دخول ناجح.
 * - تعدد الحسابات مسموح للأدمن فقط.
 * - لا نخزّن كلمة المرور نصاً صريحاً؛ نعتمد على code كرمز جلسة للجهاز.
 */

const VAULT_KEY = "twoTongues.accountVault.v1";
const MAIN_KEY = "twoTongues.mainAccountCode";

function safeParse(raw, fallback) {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/** قراءة الخزنة */
export function loadAccountVault() {
  try {
    const data = safeParse(localStorage.getItem(VAULT_KEY), { accounts: [] });
    const list = Array.isArray(data.accounts) ? data.accounts : [];
    return list
      .filter((a) => a && typeof a.code === "string" && a.code)
      .map((a) => ({
        code: String(a.code),
        username: String(a.username || ""),
        name: String(a.name || ""),
        role: a.role === "admin" ? "admin" : "user",
        avatar: typeof a.avatar === "string" ? a.avatar.slice(0, 400000) : "",
        gender: a.gender === "male" || a.gender === "female" ? a.gender : "",
        savedAt: typeof a.savedAt === "number" ? a.savedAt : Date.now(),
      }));
  } catch (_) {
    return [];
  }
}

function persistVault(accounts) {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify({ accounts, updatedAt: Date.now() }));
  } catch (_) {}
}

export function getMainAccountCode() {
  try {
    return localStorage.getItem(MAIN_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function setMainAccountCode(code) {
  try {
    if (code) localStorage.setItem(MAIN_KEY, code);
    else localStorage.removeItem(MAIN_KEY);
  } catch (_) {}
}

/**
 * إضافة/تحديث حساب بعد دخول ناجح.
 * @param {object} account - من السيرفر
 * @param {{ allowMulti?: boolean }} opts - allowMulti = المستخدم الحالي أدمن
 */
export function upsertVaultAccount(account, opts = {}) {
  if (!account || !account.code) return loadAccountVault();
  const allowMulti = !!opts.allowMulti;
  const entry = {
    code: account.code,
    username: account.username || "",
    name: account.name || "",
    role: account.role === "admin" ? "admin" : "user",
    avatar: typeof account.avatar === "string" ? account.avatar.slice(0, 400000) : "",
    gender: account.gender === "male" || account.gender === "female" ? account.gender : "",
    savedAt: Date.now(),
  };

  let list = loadAccountVault();
  const idx = list.findIndex((a) => a.code === entry.code);

  if (!allowMulti) {
    // مستخدم عادي: حساب واحد فقط على الجهاز
    list = [entry];
    setMainAccountCode(entry.code);
  } else {
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.push(entry);
    if (!getMainAccountCode()) setMainAccountCode(entry.code);
  }

  persistVault(list);
  return list;
}

/** إزالة حساب من الخزنة */
export function removeVaultAccount(code) {
  let list = loadAccountVault().filter((a) => a.code !== code);
  persistVault(list);
  if (getMainAccountCode() === code) {
    setMainAccountCode(list[0] ? list[0].code : "");
  }
  return list;
}

/** مسح الخزنة بالكامل (تسجيل خروج من كل المحفوظات) */
export function clearAccountVault() {
  try {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(MAIN_KEY);
  } catch (_) {}
}

/** هل يُسمح بإضافة حساب آخر؟ */
export function canLinkAnotherAccount(isAdmin, vault = null) {
  if (isAdmin) return true;
  const list = vault || loadAccountVault();
  return list.length === 0;
}
