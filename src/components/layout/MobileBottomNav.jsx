import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";

const NAV_STORAGE_KEY = "twoTongues.mobileNavTabs";
const MAX_NAV_TABS = 5;

/** Inline icons kept small so the catalog can grow without new asset files. */
function Ico({ d, children }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}

/**
 * Full catalog of pin-able destinations.
 * Keys are stable; MainView maps each key → open action via `actions` prop.
 */
export const ALL_NAV_ITEMS = [
  { key: "words", labelEn: "Words", labelAr: "كلمات", group: "core", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )},
  { key: "add", labelEn: "Add word", labelAr: "إضافة كلمة", group: "core", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )},
  { key: "quiz", labelEn: "Quiz", labelAr: "اختبار", group: "practice", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )},
  { key: "flashcards", labelEn: "Flashcards", labelAr: "بطاقات", group: "practice", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M7 5V3h14v14h-2" />
    </svg>
  )},
  { key: "dictation", labelEn: "Dictation", labelAr: "إملاء", group: "practice", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  )},
  { key: "exam", labelEn: "Exam mode", labelAr: "وضع الامتحان", group: "practice", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  )},
  { key: "smartCards", labelEn: "Smart cards", labelAr: "بطاقات ذكية", group: "practice", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />
    </svg>
  )},
  { key: "timer", labelEn: "Timer", labelAr: "مؤقت", group: "tools", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  )},
  { key: "calendar", labelEn: "Calendar", labelAr: "تقويم", group: "tools", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )},
  { key: "schedule", labelEn: "Schedule", labelAr: "الجدول", group: "tools", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4M8 14h3M14 14h2M8 18h8" />
    </svg>
  )},
  { key: "todo", labelEn: "To-do", labelAr: "مهام", group: "tools", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M3 12h6M3 6h6M3 18h6" />
    </svg>
  )},
  { key: "goals", labelEn: "Goals", labelAr: "أهداف", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )},
  { key: "stats", labelEn: "Stats", labelAr: "إحصائيات", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V9M12 19V5M20 19v-7" />
    </svg>
  )},
  { key: "leaderboard", labelEn: "Leaderboard", labelAr: "المتصدرون", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 4h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4M7 4H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4" />
    </svg>
  )},
  { key: "dashboard", labelEn: "Dashboard", labelAr: "لوحة", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )},
  { key: "wordLists", labelEn: "Word lists", labelAr: "قوائم", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )},
  { key: "challenges", labelEn: "Challenges", labelAr: "تحديات", group: "progress", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.5-.5z" />
    </svg>
  )},
  { key: "account", labelEn: "Account", labelAr: "حسابي", group: "core", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )},
  { key: "more", labelEn: "More", labelAr: "المزيد", group: "core", icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )},
];

const GROUP_ORDER = ["core", "practice", "tools", "progress"];
const GROUP_LABELS = {
  core: { en: "Core", ar: "أساسي" },
  practice: { en: "Practice", ar: "تدريب" },
  tools: { en: "Tools", ar: "أدوات" },
  progress: { en: "Progress", ar: "تقدّم" },
};

const DEFAULT_TAB_KEYS = ["words", "quiz", "goals", "todo", "account"];

export function loadNavTabKeys() {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return [...DEFAULT_TAB_KEYS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_TAB_KEYS];
    const valid = parsed
      .filter((k) => ALL_NAV_ITEMS.some((i) => i.key === k))
      .slice(0, MAX_NAV_TABS);
    return valid.length ? valid : [...DEFAULT_TAB_KEYS];
  } catch (_) {
    return [...DEFAULT_TAB_KEYS];
  }
}

export function saveNavTabKeys(keys) {
  try {
    const cleaned = (Array.isArray(keys) ? keys : [])
      .filter((k) => ALL_NAV_ITEMS.some((i) => i.key === k))
      .slice(0, MAX_NAV_TABS);
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (_) {}
}

/**
 * ARC-style floating bottom nav (mobile + tablet).
 * Fully customizable: up to MAX_NAV_TABS items from the full feature catalog.
 *
 * `actions` — map of key → () => void open handlers from MainView.
 * `activeOverrides` — optional map of key → boolean (tool open) for highlight.
 */


/** Settings-only UI to pick up to MAX_NAV_TABS bottom-nav destinations. */
export function NavCustomizePanel({ isAr = false, tabKeys, onChangeTabKeys }) {
  const keys = Array.isArray(tabKeys) ? tabKeys : loadNavTabKeys();

  function setKeys(next) {
    const cleaned = (typeof next === "function" ? next(keys) : next)
      .filter((k) => ALL_NAV_ITEMS.some((i) => i.key === k))
      .slice(0, MAX_NAV_TABS);
    if (onChangeTabKeys) onChangeTabKeys(cleaned);
    else saveNavTabKeys(cleaned);
    try {
      window.dispatchEvent(new CustomEvent("twoTongues:navTabsChanged", { detail: cleaned }));
    } catch (_) {}
  }

  function moveTab(index, dir) {
    const next = [...keys];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setKeys(next);
  }

  function removeTab(key) {
    if (keys.length <= 1) return;
    setKeys(keys.filter((k) => k !== key));
  }

  function addTab(key) {
    if (keys.includes(key)) return;
    if (keys.length >= MAX_NAV_TABS) return;
    setKeys([...keys, key]);
  }

  const grouped = GROUP_ORDER.map((g) => ({
    id: g,
    title: tr(isAr, GROUP_LABELS[g].en, GROUP_LABELS[g].ar),
    items: ALL_NAV_ITEMS.filter((i) => i.group === g),
  })).filter((g) => g.items.length);

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted-strong)", marginBottom: 10, lineHeight: 1.45 }}>
        {tr(
          isAr,
          `Pick up to ${MAX_NAV_TABS} icons for the bottom bar (phone & tablet). Order with arrows.`,
          `اختر حتى ${MAX_NAV_TABS} أيقونات لشريط التنقل (موبايل وتابلت). رتّب بالأسهم.`
        )}
        {" · "}
        <strong style={{ color: "var(--ink)" }}>{keys.length}/{MAX_NAV_TABS}</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grouped.map((group) => (
          <div key={group.id}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--muted-strong)",
                marginBottom: 6,
              }}
            >
              {group.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.items.map((item) => {
                const active = keys.includes(item.key);
                const orderIdx = keys.indexOf(item.key);
                const atMax = !active && keys.length >= MAX_NAV_TABS;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: active
                        ? "color-mix(in srgb, var(--accent-1) 12%, var(--input-bg))"
                        : "var(--input-bg)",
                      border: active
                        ? "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)"
                        : "1px solid rgba(var(--border-rgb),0.1)",
                      opacity: atMax ? 0.55 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => (active ? removeTab(item.key) : addTab(item.key))}
                      disabled={atMax}
                      aria-pressed={active}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: active ? "none" : "1.5px solid rgba(var(--border-rgb),0.35)",
                        background: active ? "var(--accent-1)" : "transparent",
                        color: active ? "var(--on-accent, #fff)" : "var(--muted-strong)",
                        fontWeight: 900,
                        fontSize: 14,
                        cursor: atMax ? "default" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {active ? "✓" : "+"}
                    </button>
                    <span style={{ color: "var(--icon-muted)", display: "flex" }}>{item.icon}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>
                      {tr(isAr, item.labelEn, item.labelAr)}
                    </span>
                    {active && (
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => moveTab(orderIdx, -1)}
                          disabled={orderIdx <= 0}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: orderIdx <= 0 ? "default" : "pointer",
                            opacity: orderIdx <= 0 ? 0.3 : 1,
                            fontSize: 16,
                            padding: 4,
                            color: "var(--ink)",
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTab(orderIdx, 1)}
                          disabled={orderIdx >= keys.length - 1}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: orderIdx >= keys.length - 1 ? "default" : "pointer",
                            opacity: orderIdx >= keys.length - 1 ? 0.3 : 1,
                            fontSize: 16,
                            padding: 4,
                            color: "var(--ink)",
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileBottomNav({
  isAr,
  mobileNavTab,
  setMobileNavTab,
  dueCountMobile = 0,
  actions = {},
  activeOverrides = {},
  onOpenDueQuiz,
  tabKeys: controlledTabKeys,
  onChangeTabKeys,
}) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const [light, setLight] = useState({ x: 0, w: 48, ready: false });
  const [localKeys, setLocalKeys] = useState(loadNavTabKeys);

  const tabKeys = controlledTabKeys || localKeys;

  const setTabKeys = useCallback(
    (next) => {
      let keys = typeof next === "function" ? next(tabKeys) : next;
      keys = (keys || []).slice(0, MAX_NAV_TABS);
      if (onChangeTabKeys) onChangeTabKeys(keys);
      else {
        setLocalKeys(keys);
        saveNavTabKeys(keys);
      }
    },
    [tabKeys, onChangeTabKeys]
  );

  const activeKey = useMemo(() => {
    // Prefer an open tool that is currently pinned
    for (const k of tabKeys) {
      if (activeOverrides[k]) return k;
    }
    if (mobileNavTab && tabKeys.includes(mobileNavTab)) return mobileNavTab;
    return tabKeys.includes("words") ? "words" : tabKeys[0] || "words";
  }, [mobileNavTab, tabKeys, activeOverrides]);

  const runAction = useCallback(
    (key) => {
      setMobileNavTab(key);
      const fn = actions[key];
      if (typeof fn === "function") fn();
      if (key === "words") {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (_) {}
      }
    },
    [actions, setMobileNavTab]
  );

  const tabs = useMemo(() => {
    return tabKeys
      .map((key) => {
        const meta = ALL_NAV_ITEMS.find((i) => i.key === key);
        if (!meta) return null;
        return {
          key: meta.key,
          label: tr(isAr, meta.labelEn, meta.labelAr),
          onContextMenu:
            meta.key === "quiz"
              ? (e) => {
                  e.preventDefault();
                  setMobileNavTab("quiz");
                  onOpenDueQuiz?.();
                }
              : undefined,
          icon:
            meta.key === "quiz" ? (
              <span className="mobile-nav-icon-wrap">
                {meta.icon}
                {dueCountMobile > 0 && (
                  <span className="mobile-nav-badge">{dueCountMobile > 9 ? "9+" : dueCountMobile}</span>
                )}
              </span>
            ) : (
              meta.icon
            ),
        };
      })
      .filter(Boolean);
  }, [tabKeys, isAr, dueCountMobile, setMobileNavTab, onOpenDueQuiz]);

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));

  useEffect(() => {
    function measure() {
      const list = listRef.current;
      const el = itemRefs.current[activeIndex];
      if (!list || !el) return;
      const lr = list.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const size = Math.max(52, Math.min(er.width + 8, er.height + 10));
      const x = er.left - lr.left + er.width / 2 - size / 2;
      setLight({ x, w: size, ready: true });
    }
    measure();
    const t = setTimeout(measure, 40);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, isAr, tabs.length]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <nav
      className="mobile-bottom-nav arc-nav"
      aria-label={tr(isAr, "Main navigation", "التنقل الرئيسي")}
    >

      <div className="arc-nav-bar" ref={listRef} role="tablist">
        <span
          className={"arc-nav-light" + (light.ready ? " is-ready" : "")}
          style={{
            transform: `translate3d(${light.x}px, -50%, 0)`,
            width: light.w,
            height: light.w,
          }}
          aria-hidden
        />
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            data-nav-key={t.key}
            aria-selected={activeKey === t.key}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={
              "mobile-bottom-nav-item arc-nav-item" +
              (activeKey === t.key ? " is-active" : "")
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              runAction(t.key);
            }}
            onContextMenu={t.onContextMenu}
            title={
              t.key === "quiz"
                ? tr(isAr, "Tap: quiz · Long-press: due only", "ضغط: اختبار · ضغطة طويلة: المستحق فقط")
                : undefined
            }
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>,
    document.body
  );
}
