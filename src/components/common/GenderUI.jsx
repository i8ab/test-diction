/** شارات وأزرار اختيار الجنس مع أنيميشن */
import { tr } from "../../lib/config/i18n";

export function GenderBadge({ gender, isAr, size = "md" }) {
  if (gender !== "male" && gender !== "female") return null;
  const male = gender === "male";
  const label = male
    ? tr(isAr, "Male", "ذكر")
    : tr(isAr, "Female", "أنثى");
  const symbol = male ? "♂" : "♀";
  const pad = size === "sm" ? "4px 10px" : "6px 12px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <span
      className={`gender-badge ${male ? "male" : "female"}`}
      style={{ padding: pad, fontSize: fs }}
      title={label}
    >
      <span className="gender-symbol" aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </span>
  );
}

export function GenderPicker({ value, onChange, isAr, atr }) {
  const t = atr || ((en, ar) => tr(isAr, en, ar));
  return (
    <div className="gender-pick" role="group" aria-label={t("Gender", "الجنس")}>
      <button
        type="button"
        className={`gender-pick-btn${value === "male" ? " selected male" : ""}`}
        onClick={() => onChange("male")}
        aria-pressed={value === "male"}
      >
        <span className="gender-symbol" aria-hidden="true">♂</span>
        {t("Male", "ذكر")}
      </button>
      <button
        type="button"
        className={`gender-pick-btn${value === "female" ? " selected female" : ""}`}
        onClick={() => onChange("female")}
        aria-pressed={value === "female"}
      >
        <span className="gender-symbol" aria-hidden="true">♀</span>
        {t("Female", "أنثى")}
      </button>
    </div>
  );
}

export default GenderBadge;
