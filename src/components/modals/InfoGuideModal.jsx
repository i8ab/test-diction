import { useEffect, useState } from "react";
import { tr } from "../../lib/config/i18n";
import { XIcon, ChevronIcon, BookIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const GUIDES = [
  { id: "search", titleEn: "Search & filters", titleAr: "البحث والفلاتر",
    whatEn: "Find words quickly and narrow the list.", whatAr: "تلاقي الكلمات بسرعة وتضيّق القائمة.",
    stepsEn: ["Search box at the top (word or meaning).", "Mic = voice search when available.", "Filters: All · Studied · Not studied · Favorites · Due today."],
    stepsAr: ["خانة البحث فوق (كلمة أو معنى).", "الميكروفون = بحث صوتي لو متاح.", "الفلاتر: الكل · درست · لسه · مفضلة · مستحقة."] },
  { id: "cards", titleEn: "Word cards", titleAr: "كروت الكلمات",
    whatEn: "Each entry is a card with actions.", whatAr: "كل مدخل كرت عليه أزرار.",
    stepsEn: ["Tap to expand definition and examples.", "Star = favorite · Eye = studied · Zoom = large view.", "Speaker = pronunciation."],
    stepsAr: ["اضغط لفتح التعريف والأمثلة.", "نجمة = مفضلة · عين = مُذاكرة · تكبير = عرض كبير.", "السماعة = نطق."] },
  { id: "add", titleEn: "Adding & editing words", titleAr: "إضافة وتعديل الكلمات",
    whatEn: "Grow the shared dictionary.", whatAr: "زوّد القاموس المشترك.",
    stepsEn: ["+ / Add (or N).", "Word + meaning required. Optional type and multi-sense.", "Auto-fill: definition + examples only."],
    stepsAr: ["+ / إضافة (أو N).", "الكلمة والمعنى مطلوبين. نوع ومعاني متعددة اختياري.", "تعبئة تلقائية: تعريف + أمثلة فقط."] },
  { id: "pron", titleEn: "Pronunciation (Cambridge)", titleAr: "النطق (كامبريدج)",
    whatEn: "US / UK Cambridge audio.", whatAr: "نطق كامبريدج أمريكي / بريطاني.",
    stepsEn: ["Settings → Accent for default.", "Zoom view has separate US and UK buttons."],
    stepsAr: ["الإعدادات → اللهجة للافتراضي.", "العرض الكبير فيه أزرار US و UK."] },
  { id: "quiz", titleEn: "Quiz", titleAr: "الاختبار",
    whatEn: "Questions from studied words.", whatAr: "أسئلة من الكلمات المدروسة.",
    stepsEn: ["More ⋯ → Quiz.", "MCQ or typing. Multi-type words show the required type.", "Answers update SRS."],
    stepsAr: ["المزيد ⋯ → اختبار.", "اختيار أو كتابة. النوع المتعدد يتوضّح في السؤال.", "الإجابات بتحدّث SRS."] },
  { id: "flashcards", titleEn: "Flashcards", titleAr: "البطاقات التعليمية",
    whatEn: "Flip cards for light review.", whatAr: "تقليب كروت لمراجعة خفيفة.",
    stepsEn: ["More ⋯ → Flashcards.", "Flip to reveal — no score pressure."],
    stepsAr: ["المزيد ⋯ → بطاقات.", "اقلبها للكشف — من غير ضغط درجات."] },
  { id: "quick", titleEn: "Quick review", titleAr: "مراجعة سريعة",
    whatEn: "Short recall for due words.", whatAr: "تذكّر سريع للمستحقة.",
    stepsEn: ["More ⋯ → Quick review.", "Recall, reveal, then Knew it / Still learning."],
    stepsAr: ["المزيد ⋯ → مراجعة سريعة.", "افتكر، اكشف، بعدين عرفتها / لسه بتعلّم."] },
  { id: "random", titleEn: "Random word", titleAr: "كلمة عشوائية",
    whatEn: "One word at a time, no early repeats.", whatAr: "كلمة بكلمة من غير تكرار مبكر.",
    stepsEn: ["More ⋯ → Random word.", "Reveal · Knew it / Forgot updates SRS."],
    stepsAr: ["المزيد ⋯ → كلمة عشوائية.", "كشف · عرفتها / نسيتها بتحدّث SRS."] },
  { id: "dictation", titleEn: "Listening & dictation", titleAr: "استماع وإملاء",
    whatEn: "Hear or read, then type.", whatAr: "اسمع أو اقرأ، بعدين اكتب.",
    stepsEn: ["More ⋯ → Dictation.", "Mode 1: hear → meaning. Mode 2: meaning → word."],
    stepsAr: ["المزيد ⋯ → إملاء.", "وضع ١: اسمع → المعنى. وضع ٢: المعنى → الكلمة."] },
  { id: "todo", titleEn: "To-do list", titleAr: "قائمة المهام",
    whatEn: "Tasks with a live work timer.", whatAr: "مهام مع مؤقت شغل حيّ.",
    stepsEn: ["Green button or More ⋯ → To-do.", "Start on a task for a live timer."],
    stepsAr: ["الزرار الأخضر أو المزيد ⋯ → مهام.", "ابدأ على مهمة لمؤقت حيّ."] },
  { id: "goals", titleEn: "Goals & challenges", titleAr: "الأهداف والتحديات",
    whatEn: "Daily targets and weekly challenge.", whatAr: "أهداف يومية وتحدي أسبوعي.",
    stepsEn: ["Orange Goals button or More ⋯ → Goals."],
    stepsAr: ["الزرار البرتقالي أو المزيد ⋯ → أهداف."] },
  { id: "timer", titleEn: "Study timer", titleAr: "مؤقّت المذاكرة",
    whatEn: "Countdown or stopwatch.", whatAr: "عدّ تنازلي أو ساعة.",
    stepsEn: ["Open Timer from tools. Pin for a floating bubble."],
    stepsAr: ["افتح المؤقّت من الأدوات. تثبيت = فقاعة."] },
  { id: "calendar", titleEn: "Calendar", titleAr: "التقويم",
    whatEn: "Map of study days.", whatAr: "خريطة أيام المذاكرة.",
    stepsEn: ["Open Calendar · tap a day for words."],
    stepsAr: ["افتح التقويم · اضغط يوم للكلمات."] },
  { id: "achievements", titleEn: "Achievements", titleAr: "الإنجازات",
    whatEn: "Levels and progress %.", whatAr: "مستويات ونسبة تقدّم.",
    stepsEn: ["☰ → Achievements."], stepsAr: ["☰ → الإنجازات."] },
  { id: "focus", titleEn: "Focus mode", titleAr: "وضع التركيز",
    whatEn: "Hide banners for focus.", whatAr: "إخفاء البنرات للتركيز.",
    stepsEn: ["☰ → Focus mode, or press F."], stepsAr: ["☰ → وضع التركيز، أو F."] },
  { id: "settings", titleEn: "Settings & account", titleAr: "الإعدادات والحساب",
    whatEn: "Appearance, language, accent, profile.", whatAr: "المظهر واللغة واللهجة والحساب.",
    stepsEn: ["☰ → Settings. Avatar in header opens My account."],
    stepsAr: ["☰ → إعدادات. الأفاتار في الهيدر يفتح حسابي."] },
  { id: "group", titleEn: "Shared group & offline", titleAr: "المجموعة والأوفلاين",
    whatEn: "Shared dictionary; personal progress; admin block.", whatAr: "قاموس مشترك؛ تقدّم شخصي؛ حظر أدمن.",
    stepsEn: ["Admins: block users and download backup from Admin panel."],
    stepsAr: ["الأدمن: حظر المستخدمين وتنزيل النسخة من لوحة التحكم."] },
];

export default function InfoGuideModal({ isAr, onClose }) {
  const [activeId, setActiveId] = useState(null);
  const active = GUIDES.find((g) => g.id === activeId) || null;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (activeId) setActiveId(null);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, activeId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <BodyScrollLock />
      <div
        className="modal-card"
        style={{
          width: "100%", maxWidth: 420,
          maxHeight: "min(86dvh, 640px)",
          display: "flex", flexDirection: "column",
          background: "var(--card)",
          borderRadius: "var(--modal-radius, 16px)",
          border: "1px solid rgba(var(--border-rgb),0.14)",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {active ? (
              <button
                type="button"
                onClick={() => setActiveId(null)}
                style={{
                  border: "none", background: "var(--input-bg)", borderRadius: 8,
                  width: 32, height: 32, cursor: "pointer", color: "var(--ink)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
                aria-label={tr(isAr, "Back", "رجوع")}
              >
                <ChevronIcon size={16} style={{ transform: isAr ? "none" : "rotate(180deg)" }} />
              </button>
            ) : (
              <span style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--accent-1) 18%, transparent)", color: "var(--accent-1)", flexShrink: 0,
              }}>
                <BookIcon size={16} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
                {active
                  ? (isAr ? active.titleAr : active.titleEn)
                  : tr(isAr, "How to use the site", "إزاي تستخدم الموقع")}
              </div>
              {!active && (
                <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 2 }}>
                  {tr(isAr, "Pick a topic", "اختار موضوع")}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              border: "none", background: "var(--input-bg)", borderRadius: 8,
              width: 32, height: 32, cursor: "pointer", color: "var(--icon-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {!active ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {GUIDES.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveId(g.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "11px 12px",
                    border: "none", borderRadius: 10,
                    background: "transparent",
                    cursor: "pointer", textAlign: "start",
                    fontFamily: "inherit", color: "var(--ink)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--input-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "#fff",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {isAr ? g.titleAr : g.titleEn}
                  </span>
                  <span style={{ color: "var(--muted)", display: "inline-flex" }}>
                    <ChevronIcon size={14} style={{ transform: isAr ? "rotate(180deg)" : "none" }} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: "8px 10px 16px" }}>
              <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55, color: "var(--muted-strong)" }}>
                {isAr ? active.whatAr : active.whatEn}
              </p>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
                textTransform: "uppercase", color: "var(--accent-1)", marginBottom: 8,
              }}>
                {tr(isAr, "How to use it", "طريقة الاستخدام")}
              </div>
              <ol style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {(isAr ? active.stepsAr : active.stepsEn).map((s, i) => (
                  <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink)" }}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
