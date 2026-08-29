/**
 * Map cloud/API failures to a short bilingual-friendly message.
 */
export function apiErrorMessage(err, isAr = false) {
  if (!err) {
    return isAr ? "حدث خطأ غير متوقع." : "Something went wrong.";
  }
  const status = err.status || (err.payload && err.payload.status);
  const code = (err.payload && err.payload.error) || err.message || "";
  const raw = String(code || "").toLowerCase();

  if (status === 403 || raw.includes("forbidden")) {
    return isAr
      ? "مش مسموح لك تعمل العملية دي."
      : "You are not allowed to do that.";
  }
  if (status === 429 || raw.includes("rate_limited")) {
    return isAr
      ? "طلبات كتير — استنى لحظة وحاول تاني."
      : "Too many requests — wait a moment and try again.";
  }
  if (raw.includes("conflict") || err.name === "SaveConflictError") {
    return isAr
      ? "البيانات اتغيّرت على السيرفر — حدّث الصفحة."
      : "Data changed on the server — refresh and try again.";
  }
  if (status === 413 || raw.includes("payload_too_large")) {
    return isAr ? "الملف/البيانات كبيرة جدًا." : "Payload is too large.";
  }
  if (typeof err.message === "string" && err.message && err.message !== "save failed") {
    return err.message;
  }
  return isAr ? "تعذّر الحفظ — حاول مرة أخرى." : "Could not save — try again.";
}
