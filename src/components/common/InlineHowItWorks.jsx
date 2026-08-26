import { useState } from "react";
import { tr } from "../../lib/config/i18n";
import { BookIcon, XIcon } from "./Icons";

/**
 * Concise per-model "How it works" panel.
 * Renders inline under the header — no big overlapping menu.
 * Does NOT navigate or trigger logout; pure local UI.
 */
const GUIDES = {
  quiz: {
    en: [
      "Part A = multiple choice (labeled Choose / اختر).",
      "Part B = open answers (type the meaning).",
      "Practice shows feedback immediately; Exam waits until the end.",
      "Skip leaves a question unanswered without marking it wrong.",
    ],
    ar: [
      "الجزء أ = اختيار من متعدد (مكتوب عليها اختر).",
      "الجزء ب = إجابة مفتوحة (اكتب المعنى).",
      "التدريب يورّيك النتيجة فورًا؛ الامتحان في الآخر.",
      "تخطي = تسيب السؤال من غير ما يتحسب غلط.",
    ],
  },
  flashcards: {
    en: ["Tap the card to flip.", "Knew / Still learning moves you forward.", "Customize card color at the bottom."],
    ar: ["اضغط الكرت عشان يتقلب.", "عرفتها / لسه بتعلم تنقلك للكرت اللي بعده.", "تقدر تغيّر لون الكرت من تحت."],
  },
  exam: {
    en: [
      "Focuses on weak and due words only.",
      "Pick question types: multiple choice, type answer, or fill the blank.",
      "Quick Flash has been removed — use Flashcards instead.",
      "You can change answers until you finish.",
    ],
    ar: [
      "يركّز على الكلمات الضعيفة والمستحقة فقط.",
      "اختار نوع الأسئلة: اختيار من متعدد، اكتب الإجابة، أو أكمل الفراغ.",
      "المراجعة السريعة اتشالت — استخدم البطاقات التعليمية.",
      "تقدر تغيّر إجاباتك لحد ما تخلّص.",
    ],
  },
  languageNotes: {
    en: [
      "Create a named note, then add groups of related words (word1 - word2 - word3).",
      "Collapsed view shows word (type) : meaning.",
      "Expand a group to edit examples, notes, and additional notes.",
    ],
    ar: [
      "اعمل ملاحظة باسم، وبعدين ضيف مجموعات كلمات متشابهة (كلمة١ - كلمة٢ - كلمة٣).",
      "العرض المطوي يورّي: كلمة (نوع) : معنى.",
      "افتح المجموعة عشان تعدّل الأمثلة والملاحظات.",
    ],
  },
  settings: {
    en: ["Appearance, language, notifications, and backup live here.", "Changes save automatically."],
    ar: ["المظهر واللغة والإشعارات والنسخ الاحتياطي من هنا.", "التغييرات بتتحفظ أوتوماتيك."],
  },
  default: {
    en: ["Use the controls on this screen to complete the task.", "Close with the X when you are done."],
    ar: ["استخدم الأدوات في الشاشة دي عشان تخلّص المهمة.", "اقفل بالـ X لما تخلّص."],
  },
};

export default function InlineHowItWorks({ isAr = false, guideId = "default", style = {} }) {
  const [open, setOpen] = useState(false);
  const g = GUIDES[guideId] || GUIDES.default;
  const steps = isAr ? g.ar : g.en;

  return (
    <div style={{ position: "relative", flexShrink: 0, ...style }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={tr(isAr, "How it works", "كيف يعمل")}
        title={tr(isAr, "How it works", "كيف يعمل")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid rgba(var(--border-rgb, 120,120,120), 0.22)",
          background: open ? "var(--accent-1-soft)" : "var(--input-bg, rgba(0,0,0,0.04))",
          color: "var(--ink, inherit)",
          cursor: "pointer",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        <BookIcon size={15} />
        <span>{tr(isAr, "How it works", "كيف يعمل")}</span>
      </button>

      {open && (
        <div
          role="region"
          aria-label={tr(isAr, "How it works", "كيف يعمل")}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            insetInlineEnd: 0,
            zIndex: 50,
            width: "min(300px, 82vw)",
            padding: "12px 14px",
            borderRadius: 14,
            background: "var(--card)",
            border: "1.5px solid color-mix(in srgb, var(--accent-1) 35%, rgba(var(--border-rgb),0.25))",
            boxShadow: "0 12px 36px -10px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{tr(isAr, "Quick guide", "دليل سريع")}</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tr(isAr, "Close", "إغلاق")}
              style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: "var(--muted)" }}
            >
              <XIcon size={14} />
            </button>
          </div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.55, color: "var(--muted-strong)" }}>
            {steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
