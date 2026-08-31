import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { BookIcon, XIcon } from "./Icons";
import { tr } from "../../lib/config/i18n";

/**
 * Per-screen concise "How it works" — opens ABOVE everything via portal.
 * Does NOT open the old site-wide InfoGuide list.
 * Fully stops event propagation to avoid accidental logout / modal close.
 */

const GUIDES = {
  schedule: {
    en: [
      "Set your sleep times first — everything else builds around rest.",
      "Add school and study blocks. Tap a block to edit or mark it done.",
      "Use Week view to balance the whole week. Keep Friday/Saturday lighter.",
      "Same bedtime every day beats late-night cramming.",
    ],
    ar: [
      "ظبط مواعيد النوم الأول — الباقي يتبني على الراحة.",
      "ضيف الحصص والمذاكرة. اضغط على بلوك تعدّل أو علّم إنه خلص.",
      "من عرض الأسبوع توازن الأسبوع كله. الجمعة والسبت يفضل يكونوا أخف.",
      "مواعيد نوم ثابتة أحسن من السهر على المذاكرة.",
    ],
  },
  quiz: {
    en: [
      "Part A = multiple choice (labeled Choose / اختر).",
      "Part B = type the meaning when asked.",
      "Practice shows feedback right away; Exam waits until you finish.",
      "Skip leaves a question unanswered without marking it wrong.",
    ],
    ar: [
      "الجزء أ = اختيار من متعدد (مكتوب عليها اختر).",
      "الجزء ب = اكتب المعنى لما يُطلب منك.",
      "التدريب يورّيك النتيجة فورًا؛ الامتحان في الآخر.",
      "تخطي = تسيب السؤال من غير ما يتحسب غلط.",
    ],
  },
  exam: {
    en: [
      "Focuses on weak and due words only.",
      "Question types: multiple choice, type answer, fill the blank.",
      "Quick Flash is not part of exam — use Quick review or Flashcards instead.",
      "You can change answers until you finish the session.",
    ],
    ar: [
      "يركّز على الكلمات الضعيفة والمستحقة فقط.",
      "أنواع الأسئلة: اختيار من متعدد، اكتب الإجابة، أكمل الفراغ.",
      "المراجعة السريعة مش جزء من الامتحان — استخدم مراجعة سريعة أو البطاقات.",
      "تقدر تغيّر إجاباتك لحد ما تخلّص الجلسة.",
    ],
  },
  flashcards: {
    en: ["Tap the card to flip.", "Knew / Still learning moves you forward.", "Customize card color at the bottom."],
    ar: ["اضغط الكرت عشان يتقلب.", "عرفتها / لسه بتعلم تنقلك للي بعده.", "تقدر تغيّر لون الكرت من تحت."],
  },
  languageNotes: {
    en: [
      "Create a named note, then add related words: word1 - word2 - word3.",
      "Collapsed view shows word (type) : meaning.",
      "Expand a group to edit examples, notes, and additional notes.",
    ],
    ar: [
      "اعمل ملاحظة باسم، وبعدين ضيف كلمات متشابهة: كلمة١ - كلمة٢ - كلمة٣.",
      "العرض المطوي: كلمة (نوع) : معنى.",
      "افتح المجموعة لتعديل الأمثلة والملاحظات.",
    ],
  },
  settings: {
    en: ["Appearance, language, notifications, and backup live here.", "Changes save automatically."],
    ar: ["المظهر واللغة والإشعارات والنسخ الاحتياطي من هنا.", "التغييرات بتتحفظ أوتوماتيك."],
  },
  search: {
    en: ["Search by word, meaning, or example.", "Use filters: studied, favorites, due, weak.", "Sort A–Z, newest, or weakest first."],
    ar: ["ابحث بالكلمة أو المعنى أو المثال.", "فلاتر: مدروسة، مفضلة، مستحقة، ضعيفة.", "رتّب أبجدي أو الأحدث أو الأضعف."],
  },
  default: {
    en: ["Use the controls on this screen to finish the task.", "Close with the X when you are done."],
    ar: ["استخدم أدوات الشاشة دي عشان تخلّص المهمة.", "اقفل بالـ X لما تخلّص."],
  },
};

export function openHowItWorks() {
  // No-op for legacy callers — do not open the big site guide list.
}

export default function HowItWorksButton({
  isAr = false,
  guideId = null,
  label,
  size = 15,
  style = {},
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const text = label != null ? label : tr(isAr, "How it works", "كيف يعمل");
  const g = GUIDES[guideId] || GUIDES.default;
  const steps = isAr ? g.ar : g.en;

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleOpen(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.nativeEvent?.stopImmediatePropagation === "function") {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    setOpen(true);
  }

  function handleClose(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpen(false);
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="presentation"
            onClick={handleClose}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 12000,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={text}
              dir={isAr ? "rtl" : "ltr"}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: "min(360px, 92vw)",
                maxHeight: "min(70dvh, 480px)",
                overflow: "auto",
                borderRadius: 16,
                background: "var(--card, #1c1c1e)",
                border: "1.5px solid color-mix(in srgb, var(--accent-1, #5e5ce6) 40%, transparent)",
                boxShadow: "0 24px 64px -12px rgba(0,0,0,0.55)",
                padding: "16px 18px 18px",
                color: "var(--ink, #f5f5f7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <BookIcon size={18} />
                <strong style={{ flex: 1, fontSize: 15 }}>{text}</strong>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label={tr(isAr, "Close", "إغلاق")}
                  style={{
                    border: "none",
                    background: "var(--input-bg, rgba(255,255,255,0.08))",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    color: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <XIcon size={16} />
                </button>
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13.5, lineHeight: 1.55, color: "var(--muted-strong, #aeaeb2)" }}>
                {steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>{s}</li>
                ))}
              </ul>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleOpen}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        aria-label={text}
        title={text}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid rgba(var(--border-rgb, 120,120,120), 0.22)",
          background: "var(--input-bg, rgba(0,0,0,0.04))",
          color: "var(--ink, inherit)",
          cursor: "pointer",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.2,
          flexShrink: 0,
          whiteSpace: "nowrap",
          ...style,
        }}
      >
        <BookIcon size={size} />
        <span>{text}</span>
      </button>
      {panel}
    </>
  );
}
