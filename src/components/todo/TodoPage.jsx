import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { XIcon, CheckIcon, PlusIcon, TrashIcon } from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const TODO_KEY = "twoTongues.todos";

function loadTodos() {
  try {
    const raw = localStorage.getItem(TODO_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
      .map((t) => ({
        id: t.id,
        text: String(t.text).slice(0, 500),
        done: !!t.done,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        workedMs: typeof t.workedMs === "number" ? Math.max(0, t.workedMs) : 0,
        // Only one task should be active; cleaned up after load
        activeSince: typeof t.activeSince === "number" ? t.activeSince : null,
      }));
  } catch (_) {
    return [];
  }
}

function saveTodos(list) {
  try {
    localStorage.setItem(TODO_KEY, JSON.stringify(list.slice(0, 200)));
  } catch (_) {}
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Simple personal to-do list (local only).
 * Full page + optional floating bubble (pin) that stays visible on the site.
 */
export default function TodoPage({
  onClose,
  isAr,
  onBubbleChange,
  initialBubble = false,
}) {
  const [todos, setTodos] = useState(loadTodos);
  const [draft, setDraft] = useState("");
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const [filter, setFilter] = useState("all"); // all | open | done
  const [nowTick, setNowTick] = useState(Date.now());
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  // Keep only the most recently started active task
  useEffect(() => {
    setTodos((prev) => {
      const actives = prev.filter((t) => t.activeSince);
      if (actives.length <= 1) return prev;
      const keepId = actives.sort((a, b) => b.activeSince - a.activeSince)[0].id;
      return prev.map((t) =>
        t.activeSince && t.id !== keepId
          ? { ...t, activeSince: null, workedMs: (t.workedMs || 0) + (Date.now() - t.activeSince) }
          : t
      );
    });
  }, []);

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  // Live tick while any task is running
  const hasActive = todos.some((t) => t.activeSince);
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActive]);

  useEffect(() => {
    onBubbleChange?.(viewMode === "bubble");
  }, [viewMode, onBubbleChange]);

  useBodyScrollLock(viewMode === "full");

  useEffect(() => {
    if (viewMode === "full") {
      const t = setTimeout(() => inputRef.current?.focus?.(), 80);
      return () => clearTimeout(t);
    }
  }, [viewMode]);

  const openCount = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const doneCount = todos.length - openCount;

  const visible = useMemo(() => {
    if (filter === "open") return todos.filter((t) => !t.done);
    if (filter === "done") return todos.filter((t) => t.done);
    // open first, then done
    return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);
  }, [todos, filter]);

  function addTodo(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text) return;
    setTodos((prev) => [{ id: uid(), text, done: false, createdAt: Date.now() }, ...prev]);
    setDraft("");
    inputRef.current?.focus?.();
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        // Completing a task stops its timer and banks the elapsed time
        if (!t.done && t.activeSince) {
          return {
            ...t,
            done: true,
            activeSince: null,
            workedMs: (t.workedMs || 0) + (Date.now() - t.activeSince),
          };
        }
        return { ...t, done: !t.done };
      })
    );
  }

  function startTask(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (t.done || t.activeSince) return t;
          return { ...t, activeSince: Date.now() };
        }
        // Stop any other active task
        if (t.activeSince) {
          return {
            ...t,
            activeSince: null,
            workedMs: (t.workedMs || 0) + (Date.now() - t.activeSince),
          };
        }
        return t;
      })
    );
  }

  function stopTask(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.activeSince) return t;
        return {
          ...t,
          activeSince: null,
          workedMs: (t.workedMs || 0) + (Date.now() - t.activeSince),
        };
      })
    );
  }

  function removeTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function elapsedFor(t) {
    const base = t.workedMs || 0;
    if (t.activeSince) return base + Math.max(0, nowTick - t.activeSince);
    return base;
  }

  function clearDone() {
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  // Bubble drag — skip when target is a button
  const onBubblePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target?.closest?.("button")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: bubblePos.x != null ? bubblePos.x : rect.left,
      origY: bubblePos.y != null ? bubblePos.y : rect.top,
      moved: false,
      pointerId: e.pointerId,
    };
    try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
  }, [bubblePos]);

  const onBubblePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const x = Math.max(8, Math.min(window.innerWidth - 180, d.origX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - 120, d.origY + dy));
    setBubblePos({ x, y });
  }, []);

  const onBubblePointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (d && e?.currentTarget) {
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch (_) {}
    }
    dragRef.current = null;
  }, []);

  // ── Bubble ───────────────────────────────────────────────────────────────
  if (viewMode === "bubble") {
    const style = {
      position: "fixed",
      zIndex: 55,
      width: 176,
      borderRadius: 14,
      background: CARD,
      border: "1px solid rgba(var(--border-rgb),0.18)",
      boxShadow: "0 12px 32px -10px rgba(0,0,0,0.28)",
      padding: "10px 10px 12px",
      cursor: "grab",
      userSelect: "none",
      touchAction: "none",
      ...(bubblePos.x != null
        ? { left: bubblePos.x, top: bubblePos.y }
        : { bottom: 20, insetInlineStart: 16 }),
    };

    const preview = todos.filter((t) => !t.done).slice(0, 3);

    return (
      <div
        role="dialog"
        aria-label={tr(isAr, "To-do list", "قائمة المهام")}
        style={style}
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp}
        onPointerCancel={onBubblePointerUp}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#30d158" }}>
            <CheckIcon size={14} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{tr(isAr, "To-do", "مهام")}</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button
              type="button"
              title={tr(isAr, "Expand", "توسيع")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setViewMode("full"); }}
              style={iconBtn}
            >
              <PlusIcon size={14} />
            </button>
            <button
              type="button"
              title={tr(isAr, "Close", "إغلاق")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={iconBtn}
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>
          {openCount} {tr(isAr, "open", "مفتوحة")}
          {doneCount > 0 && (
            <span style={{ fontWeight: 500, color: "var(--muted)", marginInlineStart: 6 }}>
              · {doneCount} {tr(isAr, "done", "منتهية")}
            </span>
          )}
        </div>

        {(() => {
          const active = todos.find((x) => x.activeSince);
          if (active) {
            return (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#30d158", marginBottom: 2 }}>
                  {tr(isAr, "Working on", "شغال على")}
                </div>
                <div style={{ fontSize: 12, color: INK, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {active.text}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#30d158", marginTop: 4 }}>
                  {formatElapsed(elapsedFor(active))}
                </div>
              </div>
            );
          }
          return null;
        })()}
        {preview.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {tr(isAr, "No open tasks", "مفيش مهام مفتوحة")}
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {preview.map((t) => (
              <li
                key={t.id}
                style={{
                  fontSize: 12,
                  color: INK,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "3px 0",
                }}
              >
                {t.activeSince ? "▶ " : "· "}{t.text}
              </li>
            ))}
            {openCount > 3 && (
              <li style={{ fontSize: 11, color: "var(--muted)" }}>+{openCount - 3}</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  // ── Full view ────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(isAr, "To-do list", "قائمة المهام")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "color-mix(in srgb, #30d158 18%, transparent)", color: "#30d158",
            }}
          >
            <CheckIcon size={18} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>
              {tr(isAr, "To-do list", "قائمة المهام")}
            </h1>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              {openCount} {tr(isAr, "open", "مفتوحة")}
              {doneCount > 0 ? ` · ${doneCount} ${tr(isAr, "done", "منتهية")}` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setViewMode("bubble")}
            title={tr(isAr, "Minimize to floating widget", "تصغير لودجت عائم")}
            style={headerBtn}
          >
            {tr(isAr, "Pin", "تثبيت")}
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify({ version: 1, todos }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `todos-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            style={headerBtn}
          >
            {tr(isAr, "Export", "تصدير")}
          </button>
          <label style={{ ...headerBtn, cursor: "pointer", margin: 0 }}>
            {tr(isAr, "Import", "استيراد")}
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                e.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(String(reader.result || "{}"));
                    const list = Array.isArray(data) ? data : (data.todos || []);
                    if (!Array.isArray(list)) return;
                    const cleaned = list
                      .filter((t) => t && typeof t.text === "string")
                      .map((t) => ({
                        id: typeof t.id === "string" ? t.id : Math.random().toString(36).slice(2),
                        text: String(t.text).slice(0, 500),
                        done: !!t.done,
                        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
                        workedMs: typeof t.workedMs === "number" ? t.workedMs : 0,
                        activeSince: null,
                      }));
                    setTodos(cleaned);
                  } catch (_) {}
                };
                reader.readAsText(file);
              }}
            />
          </label>
          <button type="button" onClick={onClose} style={headerBtn} aria-label={tr(isAr, "Close", "إغلاق")}>
            <XIcon size={16} />
          </button>
        </div>
      </header>

      <div style={{ padding: "12px 16px", flexShrink: 0, maxWidth: 560, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <form onSubmit={addTodo} style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tr(isAr, "New task…", "مهمة جديدة…")}
            maxLength={500}
            style={{
              flex: 1,
              boxSizing: "border-box",
              padding: "11px 13px",
              fontSize: 15,
              fontFamily: "inherit",
              color: INK,
              background: "var(--input-bg)",
              border: "1px solid rgba(var(--border-rgb),0.2)",
              borderRadius: 10,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            style={{
              ...headerBtn,
              background: draft.trim() ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))" : "var(--card)",
              color: draft.trim() ? "#fff" : "var(--muted)",
              border: "none",
              opacity: draft.trim() ? 1 : 0.6,
              minWidth: 48,
              justifyContent: "center",
            }}
            aria-label={tr(isAr, "Add", "إضافة")}
          >
            <PlusIcon size={18} />
          </button>
        </form>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "all", label: tr(isAr, "All", "الكل") },
            { id: "open", label: tr(isAr, "Open", "مفتوحة") },
            { id: "done", label: tr(isAr, "Done", "منتهية") },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: filter === f.id ? BRASS : "rgba(var(--border-rgb),0.1)",
                color: filter === f.id ? "#fff" : "var(--muted-strong)",
              }}
            >
              {f.label}
            </button>
          ))}
          {doneCount > 0 && (
            <button
              type="button"
              onClick={clearDone}
              style={{
                marginInlineStart: "auto",
                padding: "5px 10px",
                border: "none",
                background: "transparent",
                color: "var(--danger, #e11)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {tr(isAr, "Clear done", "مسح المنتهية")}
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 24px" }}>
        <ul
          style={{
            listStyle: "none",
            margin: "0 auto",
            padding: 0,
            maxWidth: 560,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {visible.length === 0 ? (
            <li style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)", fontSize: 14 }}>
              {filter === "done"
                ? tr(isAr, "No completed tasks yet.", "لسه مفيش مهام منتهية.")
                : filter === "open"
                ? tr(isAr, "All clear — no open tasks.", "فاضي — مفيش مهام مفتوحة.")
                : tr(isAr, "Add your first task above.", "ضيف أول مهمة من فوق.")}
            </li>
          ) : (
            visible.map((t) => (
              <li
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: CARD,
                  border: "1px solid rgba(var(--border-rgb),0.12)",
                  borderRadius: 12,
                  opacity: t.done ? 0.65 : 1,
                  borderColor: t.activeSince ? "color-mix(in srgb, #30d158 45%, transparent)" : "rgba(var(--border-rgb),0.12)",
                  boxShadow: t.activeSince ? "0 0 0 1px color-mix(in srgb, #30d158 25%, transparent)" : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleTodo(t.id)}
                  aria-label={t.done ? tr(isAr, "Mark open", "إرجاع كمفتوحة") : tr(isAr, "Mark done", "تعليم كمنتهية")}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: t.done ? "none" : "1.5px solid rgba(var(--border-rgb),0.35)",
                    background: t.done ? "#30d158" : "transparent",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  {t.done ? <CheckIcon size={14} /> : null}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 15,
                      color: INK,
                      textDecoration: t.done ? "line-through" : "none",
                      wordBreak: "break-word",
                      display: "block",
                    }}
                  >
                    {t.text}
                  </span>
                  {(t.activeSince || (t.workedMs || 0) > 0) && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "ui-monospace, 'Source Sans 3', monospace",
                        color: t.activeSince ? "#30d158" : "var(--muted-strong)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {t.activeSince ? "● " : ""}
                      {formatElapsed(elapsedFor(t))}
                      {t.activeSince
                        ? ` ${tr(isAr, "working", "شغال")}`
                        : ` ${tr(isAr, "total", "إجمالي")}`}
                    </div>
                  )}
                </div>
                {!t.done && (
                  <button
                    type="button"
                    onClick={() => (t.activeSince ? stopTask(t.id) : startTask(t.id))}
                    title={t.activeSince ? tr(isAr, "Stop", "إيقاف") : tr(isAr, "Start working", "ابدأ الشغل")}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                      background: t.activeSince
                        ? "color-mix(in srgb, #ff9f0a 22%, transparent)"
                        : "color-mix(in srgb, #30d158 18%, transparent)",
                      color: t.activeSince ? "#ff9f0a" : "#30d158",
                    }}
                  >
                    {t.activeSince ? tr(isAr, "Stop", "إيقاف") : tr(isAr, "Start", "ابدأ")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeTodo(t.id)}
                  aria-label={tr(isAr, "Delete", "حذف")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--icon-muted)",
                    cursor: "pointer",
                    padding: 6,
                    display: "flex",
                    flexShrink: 0,
                  }}
                >
                  <TrashIcon size={15} />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

const iconBtn = {
  border: "none",
  background: "transparent",
  color: "var(--icon-muted)",
  padding: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 6,
};

const headerBtn = {
  border: "1px solid rgba(var(--border-rgb),0.18)",
  background: "var(--card)",
  color: INK,
  padding: "6px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
