import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { XIcon, CheckIcon, PlusIcon, TrashIcon } from "../common/Icons";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const TODO_KEY = "twoTongues.todos";
const TODO_KEY_FOR = (code) => (code ? `twoTongues.todos.${code}` : TODO_KEY);

/** Full title is shown (wraps on small screens). Soft cap for storage only. */
const TITLE_MAX = 200;
const NOTE_MAX = 800;
const SUBTASK_MAX = 120;
const SUBTASKS_PER_TODO = 30;

function normalizeSubtasks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s.text === "string" && s.text.trim())
    .map((s) => ({
      id: typeof s.id === "string" && s.id ? s.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
      text: String(s.text).trim().slice(0, SUBTASK_MAX),
      done: !!s.done,
    }))
    .slice(0, SUBTASKS_PER_TODO);
}

function normalizeTodoList(arr, { stripActive = false } = {}) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((t) => t && typeof t.text === "string")
    .map((t) => ({
      id: typeof t.id === "string" && t.id ? t.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
      text: String(t.text).slice(0, TITLE_MAX),
      note: typeof t.note === "string" ? String(t.note).slice(0, NOTE_MAX) : "",
      done: !!t.done,
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      workedMs: typeof t.workedMs === "number" ? Math.max(0, t.workedMs) : 0,
      activeSince: stripActive
        ? null
        : typeof t.activeSince === "number"
          ? t.activeSince
          : null,
      priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
      dueDate: typeof t.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null,
      categoryId: typeof t.categoryId === "string" && t.categoryId ? t.categoryId : null,
      // Bumped on every local edit; used to decide which side "wins" a merge.
      updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
      subtasks: normalizeSubtasks(t.subtasks),
    }))
    .slice(0, 200);
}

function loadTodos(accountCode) {
  try {
    const key = TODO_KEY_FOR(accountCode);
    const raw = localStorage.getItem(key) || (!accountCode ? null : localStorage.getItem(TODO_KEY));
    if (!raw) return [];
    return normalizeTodoList(JSON.parse(raw), { stripActive: false });
  } catch (_) {
    return [];
  }
}

function saveTodosLocal(list, accountCode) {
  try {
    localStorage.setItem(TODO_KEY_FOR(accountCode), JSON.stringify(list.slice(0, 200)));
  } catch (_) {}
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CATEGORIES_KEY = "twoTongues.todoCategories";
const CATEGORIES_KEY_FOR = (code) => (code ? `twoTongues.todoCategories.${code}` : CATEGORIES_KEY);

function loadCategories(accountCode) {
  try {
    const key = CATEGORIES_KEY_FOR(accountCode);
    const raw = localStorage.getItem(key) || (!accountCode ? null : localStorage.getItem(CATEGORIES_KEY));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.name === "string" && c.name.trim())
      .map((c) => ({
        id: typeof c.id === "string" && c.id ? c.id : Math.random().toString(36).slice(2) + Date.now().toString(36),
        name: String(c.name).trim().slice(0, 40),
        color: typeof c.color === "string" && c.color ? c.color : "#6366f1",
      }))
      .slice(0, 50);
  } catch (_) {
    return [];
  }
}

function saveCategoriesLocal(list, accountCode) {
  try {
    localStorage.setItem(CATEGORIES_KEY_FOR(accountCode), JSON.stringify(list.slice(0, 50)));
  } catch (_) {}
}


function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PRIORITY_META = {
  high: { en: "High", ar: "عالية", color: "#ef4444" },
  medium: { en: "Medium", ar: "متوسطة", color: "#f59e0b" },
  low: { en: "Low", ar: "منخفضة", color: "#22c55e" },
};

function priorityRank(p) {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

/** Responsive scale: fill the screen on tablet/desktop; keep mobile compact. */
function useScreenPad() {
  const [pad, setPad] = useState({ maxW: "100%", px: 14, gap: 4, titleFs: 14, rowPy: 8 });
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth || 400;
      if (w >= 1024) {
        // Desktop — full width with comfortable padding
        setPad({ maxW: "100%", px: 28, gap: 8, titleFs: 15, rowPy: 10 });
      } else if (w >= 600) {
        // Tablet — full width
        setPad({ maxW: "100%", px: 20, gap: 6, titleFs: 14, rowPy: 9 });
      } else {
        // Mobile
        setPad({ maxW: "100%", px: 14, gap: 4, titleFs: 14, rowPy: 8 });
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
  return pad;
}

/**
 * Split long paste: first TITLE_MAX chars → title, rest → note.
 */
function splitTitleAndNote(raw, existingNote = "") {
  const full = String(raw || "").trim();
  if (full.length <= TITLE_MAX) {
    return { title: full, note: existingNote };
  }
  const title = full.slice(0, TITLE_MAX).trim();
  const overflow = full.slice(TITLE_MAX).trim();
  const note = [existingNote, overflow].filter(Boolean).join("\n").slice(0, NOTE_MAX);
  return { title, note };
}

export default function TodoPage({
  onClose,
  isAr,
  onBubbleChange,
  initialBubble = false,
  accountCode = "",
}) {
  const pad = useScreenPad();
  const [todos, setTodos] = useState(() => loadTodos(accountCode));
  const [draft, setDraft] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftPriority, setDraftPriority] = useState("medium");
  const [draftDue, setDraftDue] = useState(() => todayISO());
  const [draftCategoryId, setDraftCategoryId] = useState(null);
  const [categories, setCategories] = useState(() => loadCategories(accountCode));
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);
  const [catDraftName, setCatDraftName] = useState("");
  const [catDraftColor, setCatDraftColor] = useState("#6366f1");
  const [editingCatId, setEditingCatId] = useState(null);
  const [showExtra, setShowExtra] = useState(false);
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null });
  const [filter, setFilter] = useState("all");
  const [nowTick, setNowTick] = useState(Date.now());
  const [expandedId, setExpandedId] = useState(null);
  const [subDraft, setSubDraft] = useState({}); // { [todoId]: string }
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  // Concurrent tasks allowed — multiple activeSince timers can run at once.

  // Reload from localStorage when account switches (skip initial mount)
  const prevCodeRef = useRef(accountCode);
  useEffect(() => {
    if (prevCodeRef.current !== accountCode) {
      prevCodeRef.current = accountCode;
      setTodos(loadTodos(accountCode));
      setCategories(loadCategories(accountCode));
      setDraftCategoryId(null);
    }
  }, [accountCode]);

  // Persist exclusively to localStorage (no cloud / database upload)
  useEffect(() => {
    saveTodosLocal(todos, accountCode);
  }, [todos, accountCode]);

  useEffect(() => {
    saveCategoriesLocal(categories, accountCode);
  }, [categories, accountCode]);

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

  // Do not auto-focus the task input on open — avoids mobile/tablet keyboard popup.
  // Keyboard appears only when the user taps the field.

  const openCount = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const doneCount = todos.length - openCount;
  const workingCount = useMemo(() => todos.filter((t) => !t.done && t.activeSince).length, [todos]);

  const visible = useMemo(() => {
    let list = todos;
    if (filter === "open") list = todos.filter((t) => !t.done);
    else if (filter === "working") list = todos.filter((t) => !t.done && t.activeSince);
    else if (filter === "done") list = todos.filter((t) => t.done);
    else if (filter === "high") list = todos.filter((t) => !t.done && t.priority === "high");
    else if (filter.startsWith("cat:")) {
      const cid = filter.slice(4);
      list = todos.filter((t) => !t.done && t.categoryId === cid);
    }
    return [...list].sort((a, b) => {
      if (Number(a.done) !== Number(b.done)) return Number(a.done) - Number(b.done);
      // Active (working) tasks first
      if (!!a.activeSince !== !!b.activeSince) return a.activeSince ? -1 : 1;
      if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
      return a.createdAt - b.createdAt;
    });
  }, [todos, filter]);

  const numberMap = useMemo(() => {
    const sorted = [...todos].sort((a, b) => a.createdAt - b.createdAt);
    const map = {};
    sorted.forEach((t, i) => {
      map[t.id] = i + 1;
    });
    return map;
  }, [todos]);

  function handleTitleChange(value) {
    // Live typing: hard-cap at TITLE_MAX; if user pastes longer, overflow → note
    if (value.length <= TITLE_MAX) {
      setDraft(value);
      return;
    }
    const { title, note } = splitTitleAndNote(value, draftNote);
    setDraft(title);
    if (note && note !== draftNote) {
      setDraftNote(note);
      setShowExtra(true);
    }
  }

  function addCategory() {
    const name = catDraftName.trim();
    if (!name) return;
    const id = uid();
    setCategories((prev) => [...prev, { id, name: name.slice(0, 40), color: catDraftColor || "#6366f1" }]);
    setCatDraftName("");
    setCatDraftColor("#6366f1");
    setEditingCatId(null);
  }

  function saveEditCategory() {
    const name = catDraftName.trim();
    if (!name || !editingCatId) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === editingCatId ? { ...c, name: name.slice(0, 40), color: catDraftColor || c.color } : c))
    );
    setCatDraftName("");
    setCatDraftColor("#6366f1");
    setEditingCatId(null);
  }

  function startEditCategory(cat) {
    setEditingCatId(cat.id);
    setCatDraftName(cat.name);
    setCatDraftColor(cat.color || "#6366f1");
    setShowCategoryMgr(true);
  }

  function deleteCategory(id) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setTodos((prev) => prev.map((t) => (t.categoryId === id ? { ...t, categoryId: null, updatedAt: Date.now() } : t)));
    if (draftCategoryId === id) setDraftCategoryId(null);
    if (editingCatId === id) {
      setEditingCatId(null);
      setCatDraftName("");
    }
  }

  const categoryById = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  function addTodo(e) {
    e?.preventDefault?.();
    const { title, note } = splitTitleAndNote(draft, draftNote);
    if (!title) return;
    setTodos((prev) => [
      {
        id: uid(),
        text: title,
        note: note.slice(0, NOTE_MAX),
        done: false,
        createdAt: Date.now(),
        workedMs: 0,
        activeSince: null,
        priority: draftPriority,
        dueDate: draftDue || null,
        categoryId: draftCategoryId || null,
        updatedAt: Date.now(),
        subtasks: [],
      },
      ...prev,
    ]);
    setDraft("");
    setDraftNote("");
    setDraftDue(todayISO());
    setDraftPriority("medium");
    setDraftCategoryId(null);
    setShowExtra(false);
    inputRef.current?.focus?.();
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (!t.done && t.activeSince) {
          return {
            ...t,
            done: true,
            activeSince: null,
            workedMs: (t.workedMs || 0) + (Date.now() - t.activeSince),
            updatedAt: Date.now(),
          };
        }
        return { ...t, done: !t.done, updatedAt: Date.now() };
      })
    );
  }

  function startTask(id) {
    // Allow multiple tasks to run concurrently — do not stop other active timers.
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.done || t.activeSince) return t;
        return { ...t, activeSince: Date.now(), updatedAt: Date.now() };
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
          updatedAt: Date.now(),
        };
      })
    );
  }

  function removeTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function addSubtask(todoId, text) {
    const cleaned = String(text || "").trim().slice(0, SUBTASK_MAX);
    if (!cleaned) return;
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== todoId) return t;
        const list = Array.isArray(t.subtasks) ? t.subtasks : [];
        if (list.length >= SUBTASKS_PER_TODO) return t;
        return {
          ...t,
          subtasks: [...list, { id: uid(), text: cleaned, done: false }],
          updatedAt: Date.now(),
        };
      })
    );
  }

  function toggleSubtask(todoId, subId) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== todoId) return t;
        const list = Array.isArray(t.subtasks) ? t.subtasks : [];
        const nextSubs = list.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
        // If there is at least one subtask and all are done → complete the parent task.
        // If any subtask is reopened → reopen the parent.
        const hasSubs = nextSubs.length > 0;
        const allDone = hasSubs && nextSubs.every((s) => s.done);
        let done = t.done;
        let activeSince = t.activeSince;
        let workedMs = t.workedMs || 0;
        if (hasSubs) {
          if (allDone) {
            done = true;
            if (activeSince) {
              workedMs = workedMs + Math.max(0, Date.now() - activeSince);
              activeSince = null;
            }
          } else if (t.done) {
            // A subtask was unchecked while parent was complete
            done = false;
          }
        }
        return {
          ...t,
          subtasks: nextSubs,
          done,
          activeSince,
          workedMs,
          updatedAt: Date.now(),
        };
      })
    );
  }

  function removeSubtask(todoId, subId) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== todoId) return t;
        const list = Array.isArray(t.subtasks) ? t.subtasks : [];
        return {
          ...t,
          subtasks: list.filter((s) => s.id !== subId),
          updatedAt: Date.now(),
        };
      })
    );
  }


  function elapsedFor(t) {
    const base = t.workedMs || 0;
    if (t.activeSince) return base + Math.max(0, nowTick - t.activeSince);
    return base;
  }

  function clearDone() {
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  // ── Bubble ──────────────────────────────────────────────────────────────
  const onBubblePointerDown = useCallback(
    (e) => {
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
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch (_) {}
    },
    [bubblePos]
  );

  const onBubblePointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    setBubblePos({
      x: Math.max(8, Math.min(window.innerWidth - 160, d.origX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 100, d.origY + dy)),
    });
  }, []);

  const onBubblePointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (d && e?.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture?.(d.pointerId);
      } catch (_) {}
    }
    dragRef.current = null;
  }, []);

  if (viewMode === "bubble") {
    const style = {
      position: "fixed",
      zIndex: 5500,
      width: 168,
      borderRadius: 12,
      background: CARD,
      border: "1px solid rgba(var(--border-rgb),0.16)",
      boxShadow: "0 10px 28px -8px rgba(0,0,0,0.25)",
      padding: "8px 10px 10px",
      cursor: "grab",
      userSelect: "none",
      touchAction: "none",
      ...(bubblePos.x != null
        ? { left: bubblePos.x, top: bubblePos.y }
        : { bottom: 18, insetInlineStart: 14 }),
    };
    const preview = todos.filter((t) => !t.done).slice(0, 3);
    const actives = todos.filter((x) => x.activeSince);
    const bubble = (
      <div
        role="dialog"
        aria-label={tr(isAr, "To-do list", "قائمة المهام")}
        style={style}
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp}
        onPointerCancel={onBubblePointerUp}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#30d158" }}>{tr(isAr, "To-do", "مهام")}</span>
          <div style={{ display: "flex", gap: 2 }}>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setViewMode("full"); }} style={iconBtn}>
              <PlusIcon size={13} />
            </button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClose(); }} style={iconBtn}>
              <XIcon size={13} />
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>
          {openCount} {tr(isAr, "tasks", "مهام")}
          {workingCount > 0 ? ` · ${workingCount} ${tr(isAr, "working", "شغّال")}` : ""}
        </div>
        {actives.slice(0, 3).map((active) => (
          <div key={active.id} style={{ fontSize: 11, color: "#30d158", fontWeight: 700, marginBottom: 4, whiteSpace: "normal", wordBreak: "break-word" }}>
            ▶ {active.text} · {formatElapsed(elapsedFor(active))}
          </div>
        ))}
        {preview.map((t) => (
          <div key={t.id} style={{ fontSize: 11, color: INK, whiteSpace: "normal", wordBreak: "break-word", padding: "2px 0" }}>
            {numberMap[t.id]}. {t.text}
          </div>
        ))}
      </div>
    );
    return typeof document !== "undefined" ? createPortal(bubble, document.body) : bubble;
  }

  // ── Full view ───────────────────────────────────────────────────────────
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
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: `${pad.rowPy + 2}px ${pad.px}px`,
          borderBottom: "1px solid rgba(var(--border-rgb),0.1)",
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: pad.titleFs + 2, fontWeight: 700, color: INK }}>
            {tr(isAr, "Tasks", "المهام")}
          </h1>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>
            {openCount} {tr(isAr, "tasks", "مهام")}
            {workingCount > 0 ? ` · ${workingCount} ${tr(isAr, "working", "شغّال")}` : ""}
            {doneCount > 0 ? ` · ${doneCount} ${tr(isAr, "done", "خلصت")}` : ""}
          </div>
        </div>
        <button type="button" onClick={() => setViewMode("bubble")} style={headerBtn}>
          {tr(isAr, "Pin", "تثبيت")}
        </button>
        <button type="button" onClick={onClose} style={headerBtn} aria-label={tr(isAr, "Close", "إغلاق")}>
          <XIcon size={15} />
        </button>
      </header>

      {/* Add form */}
      <div
        style={{
          padding: `${pad.rowPy}px ${pad.px}px`,
          flexShrink: 0,
          maxWidth: pad.maxW,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        <form onSubmit={addTodo} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={tr(isAr, "Task title…", "عنوان المهمة…")}
              maxLength={TITLE_MAX + 20}
              dir="auto"
              style={{
                flex: 1,
                boxSizing: "border-box",
                padding: "9px 11px",
                fontSize: pad.titleFs,
                fontFamily: "inherit",
                color: INK,
                background: "var(--input-bg)",
                border: "1px solid rgba(var(--border-rgb),0.18)",
                borderRadius: 8,
                outline: "none",
                unicodeBidi: "plaintext",
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
                opacity: draft.trim() ? 1 : 0.55,
                minWidth: 40,
                height: 38,
                justifyContent: "center",
              }}
              aria-label={tr(isAr, "Add", "إضافة")}
            >
              <PlusIcon size={16} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowExtra((v) => !v)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--muted)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                padding: "2px 0",
                textAlign: "start",
              }}
            >
              {showExtra
                ? tr(isAr, "− Hide details", "− إخفاء التفاصيل")
                : tr(isAr, "+ Note / priority / date", "+ ملاحظة / أولوية / تاريخ")}
            </button>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>
              {draft.length}/{TITLE_MAX}
            </span>
          </div>

          {showExtra && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value.slice(0, NOTE_MAX))}
                placeholder={tr(isAr, "Description / notes (optional)…", "الشرح أو الملاحظات (اختياري)…")}
                maxLength={NOTE_MAX}
                rows={3}
                dir="auto"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: INK,
                  background: "var(--input-bg)",
                  border: "1px solid rgba(var(--border-rgb),0.16)",
                  borderRadius: 8,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.45,
                  unicodeBidi: "plaintext",
                }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {["high", "medium", "low"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDraftPriority(p)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 14,
                      border: draftPriority === p ? `1.5px solid ${PRIORITY_META[p].color}` : "1px solid rgba(var(--border-rgb),0.16)",
                      background: draftPriority === p ? `${PRIORITY_META[p].color}18` : "var(--card)",
                      color: PRIORITY_META[p].color,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isAr ? PRIORITY_META[p].ar : PRIORITY_META[p].en}
                  </button>
                ))}
                <input
                  type="date"
                  value={draftDue}
                  onChange={(e) => setDraftDue(e.target.value)}
                  style={{
                    padding: "4px 7px",
                    borderRadius: 7,
                    border: "1px solid rgba(var(--border-rgb),0.16)",
                    background: "var(--input-bg)",
                    color: INK,
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                />
              </div>
              {/* Category / tag assignment */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
                  {tr(isAr, "Category", "تصنيف")}
                </span>
                <button
                  type="button"
                  onClick={() => setDraftCategoryId(null)}
                  style={{
                    padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: !draftCategoryId ? "1.5px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.16)",
                    background: !draftCategoryId ? "var(--accent-1-soft)" : "var(--card)",
                    color: !draftCategoryId ? "var(--accent-1)" : "var(--muted-strong)",
                  }}
                >
                  {tr(isAr, "None", "بدون")}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraftCategoryId(c.id)}
                    style={{
                      padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      border: draftCategoryId === c.id ? `1.5px solid ${c.color}` : "1px solid rgba(var(--border-rgb),0.16)",
                      background: draftCategoryId === c.id ? `${c.color}22` : "var(--card)",
                      color: c.color,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCategoryMgr((v) => !v)}
                  style={{
                    padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    border: "1px dashed rgba(var(--border-rgb),0.3)",
                    background: "transparent",
                    color: "var(--muted-strong)",
                  }}
                >
                  {tr(isAr, "Manage…", "إدارة…")}
                </button>
              </div>
              {showCategoryMgr && (
                <div style={{
                  marginTop: 8, padding: 10, borderRadius: 10,
                  border: "1px solid rgba(var(--border-rgb),0.14)", background: "var(--input-bg)",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 6 }}>
                    {editingCatId ? tr(isAr, "Edit category", "تعديل تصنيف") : tr(isAr, "Add category", "إضافة تصنيف")}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={catDraftName}
                      onChange={(e) => setCatDraftName(e.target.value)}
                      placeholder={tr(isAr, "Name (e.g. Math)", "الاسم (مثل: رياضيات)")}
                      maxLength={40}
                      style={{
                        flex: 1, minWidth: 120, padding: "6px 8px", borderRadius: 7,
                        border: "1px solid rgba(var(--border-rgb),0.16)", background: "var(--card)",
                        color: INK, fontSize: 12, fontFamily: "inherit",
                      }}
                    />
                    <input
                      type="color"
                      value={catDraftColor}
                      onChange={(e) => setCatDraftColor(e.target.value)}
                      title={tr(isAr, "Color", "اللون")}
                      style={{ width: 36, height: 32, border: "none", background: "transparent", cursor: "pointer" }}
                    />
                    <button
                      type="button"
                      onClick={editingCatId ? saveEditCategory : addCategory}
                      disabled={!catDraftName.trim()}
                      style={{
                        padding: "6px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 12,
                        background: catDraftName.trim() ? "var(--accent-1)" : "rgba(var(--border-rgb),0.12)",
                        color: catDraftName.trim() ? "#fff" : "var(--muted)",
                        cursor: catDraftName.trim() ? "pointer" : "default",
                      }}
                    >
                      {editingCatId ? tr(isAr, "Save", "حفظ") : tr(isAr, "Add", "إضافة")}
                    </button>
                    {editingCatId && (
                      <button type="button" onClick={() => { setEditingCatId(null); setCatDraftName(""); }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", background: "var(--card)", fontSize: 12, cursor: "pointer", color: "var(--muted-strong)" }}>
                        {tr(isAr, "Cancel", "إلغاء")}
                      </button>
                    )}
                  </div>
                  {categories.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {categories.map((c) => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: INK, fontWeight: 600 }}>{c.name}</span>
                          <button type="button" onClick={() => startEditCategory(c)} style={{ border: "none", background: "transparent", color: "var(--muted-strong)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            {tr(isAr, "Edit", "تعديل")}
                          </button>
                          <button type="button" onClick={() => deleteCategory(c.id)} style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            {tr(isAr, "Delete", "حذف")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "all", label: tr(isAr, "All", "الكل") },
            { id: "open", label: tr(isAr, "Tasks", "مهام") },
            { id: "working", label: tr(isAr, "Working", "شغّال") },
            { id: "high", label: tr(isAr, "High", "عالية") },
            { id: "done", label: tr(isAr, "Done", "خلصت") },
            ...categories.map((c) => ({ id: `cat:${c.id}`, label: c.name, color: c.color })),
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 16,
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: filter === f.id ? BRASS : "rgba(var(--border-rgb),0.08)",
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
                border: "none",
                background: "transparent",
                color: "var(--danger, #e11)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {tr(isAr, "Clear done", "مسح اللي خلصت")}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", padding: `0 ${pad.px}px 20px` }}>
        <ul
          style={{
            listStyle: "none",
            margin: "0 auto",
            padding: 0,
            maxWidth: pad.maxW,
            display: "flex",
            flexDirection: "column",
            gap: pad.gap,
          }}
        >
          {visible.length === 0 ? (
            <li style={{ textAlign: "center", padding: "32px 12px", color: "var(--muted)", fontSize: 13 }}>
              {tr(isAr, "No tasks yet.", "مفيش مهام لسه.")}
            </li>
          ) : (
            visible.map((t) => {
              const isOpen = expandedId === t.id;
              const hasNote = !!(t.note && t.note.trim());
              const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
              const subDone = subs.filter((s) => s.done).length;
              const hasSubs = subs.length > 0;
              const subPct = hasSubs ? Math.round((subDone / subs.length) * 100) : 0;
              const batteryFill = t.done ? 100 : subPct;
              return (
                <li
                  key={t.id}
                  style={{
                    background: CARD,
                    border: "1px solid rgba(var(--border-rgb),0.1)",
                    borderRadius: 10,
                    opacity: t.done ? 0.6 : 1,
                    borderColor: t.activeSince
                      ? "color-mix(in srgb, #30d158 40%, transparent)"
                      : "rgba(var(--border-rgb),0.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: `${pad.rowPy}px 10px`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTodo(t.id)}
                      aria-label={
                        hasSubs
                          ? (t.done
                              ? tr(isAr, "Mark as task", "إرجاع كمهمة")
                              : `${tr(isAr, "Mark done", "خلصت")} (${subPct}%)`)
                          : (t.done ? tr(isAr, "Mark as task", "إرجاع كمهمة") : tr(isAr, "Mark done", "خلصت"))
                      }
                      title={hasSubs && !t.done ? `${subDone}/${subs.length}` : undefined}
                      style={{
                        position: "relative",
                        width: hasSubs ? 28 : 22,
                        height: hasSubs ? 28 : 22,
                        borderRadius: hasSubs ? 7 : 6,
                        flexShrink: 0,
                        padding: 0,
                        border: t.done || (hasSubs && batteryFill > 0)
                          ? "none"
                          : "1.5px solid rgba(var(--border-rgb),0.3)",
                        background: t.done
                          ? "#30d158"
                          : hasSubs
                            ? "rgba(var(--border-rgb),0.08)"
                            : "transparent",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      {/* Battery-style proportional fill for tasks with subtasks */}
                      {hasSubs && !t.done && batteryFill > 0 && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: `${batteryFill}%`,
                            background: batteryFill >= 100
                              ? "#30d158"
                              : "color-mix(in srgb, #30d158 75%, var(--accent-1, #0a84ff))",
                            transition: "width 0.25s ease",
                            borderRadius: "inherit",
                          }}
                        />
                      )}
                      {t.done ? (
                        <CheckIcon size={hasSubs ? 14 : 12} style={{ position: "relative", zIndex: 1 }} />
                      ) : hasSubs ? (
                        <span
                          style={{
                            position: "relative",
                            zIndex: 1,
                            fontSize: batteryFill >= 100 ? 10 : 9,
                            fontWeight: 800,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            color: batteryFill >= 45 ? "#fff" : "var(--ink)",
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            textShadow: batteryFill >= 45 ? "0 0 2px rgba(0,0,0,0.25)" : "none",
                            pointerEvents: "none",
                          }}
                        >
                          {batteryFill}%
                        </span>
                      ) : null}
                    </button>


                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "var(--muted)",
                        minWidth: 18,
                        textAlign: "center",
                        fontFamily: "ui-monospace, monospace",
                        flexShrink: 0,
                      }}
                    >
                      {numberMap[t.id] ?? "–"}
                    </span>

                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: PRIORITY_META[t.priority || "medium"].color,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : t.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "start",
                      }}
                    >
                      <span
                        dir="auto"
                        style={{
                          fontSize: pad.titleFs,
                          color: INK,
                          fontWeight: 600,
                          textDecoration: t.done ? "line-through" : "none",
                          display: "block",
                          overflow: "visible",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          lineHeight: 1.35,
                        }}
                      >
                        {t.text}
                        {(hasNote || subs.length > 0) && (
                          <span style={{ marginInlineStart: 5, fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
                            {subs.length > 0 ? `${subDone}/${subs.length} ` : ""}
                            {isOpen ? "▲" : "▼"}
                          </span>
                        )}
                      </span>
                      {(t.dueDate || t.activeSince || (t.workedMs || 0) > 0 || t.categoryId) && (
                        <span
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 2,
                            fontSize: 11,
                            color: "var(--muted)",
                            fontWeight: 600,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {t.categoryId && categoryById[t.categoryId] && (
                            <span style={{
                              padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                              background: `${categoryById[t.categoryId].color}22`,
                              color: categoryById[t.categoryId].color,
                            }}>
                              {categoryById[t.categoryId].name}
                            </span>
                          )}
                          {t.dueDate && <span>📅 {t.dueDate}</span>}
                          {(t.activeSince || (t.workedMs || 0) > 0) && (
                            <span
                              style={{
                                color: t.activeSince ? "#30d158" : "var(--muted-strong)",
                                fontFamily: "ui-monospace, monospace",
                              }}
                            >
                              {t.activeSince ? "● " : ""}
                              {formatElapsed(elapsedFor(t))}
                            </span>
                          )}
                        </span>
                      )}
                    </button>

                    {!t.done && (
                      <button
                        type="button"
                        onClick={() => (t.activeSince ? stopTask(t.id) : startTask(t.id))}
                        style={{
                          border: "none",
                          borderRadius: 7,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          flexShrink: 0,
                          background: t.activeSince
                            ? "color-mix(in srgb, #ff9f0a 20%, transparent)"
                            : "color-mix(in srgb, #30d158 16%, transparent)",
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
                        padding: 4,
                        display: "flex",
                        flexShrink: 0,
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>

                  {isOpen && (
                    <div
                      style={{
                        padding: "8px 12px 10px 40px",
                        borderTop: "1px solid rgba(var(--border-rgb),0.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {hasNote && (
                        <div
                          dir="auto"
                          style={{
                            fontSize: 13,
                            color: "var(--muted-strong)",
                            lineHeight: 1.45,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {t.note}
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>
                          {tr(isAr, "Subtasks", "مهام جانبية")}
                          {subs.length > 0 ? ` (${subDone}/${subs.length})` : ""}
                        </div>
                        {subs.map((s) => (
                          <div
                            key={s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "4px 0",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSubtask(t.id, s.id)}
                              aria-label={tr(isAr, "Toggle subtask", "تبديل المهمة الجانبية")}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 5,
                                flexShrink: 0,
                                padding: 0,
                                border: s.done ? "none" : "1.5px solid rgba(var(--border-rgb),0.3)",
                                background: s.done ? "#30d158" : "transparent",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              {s.done ? <CheckIcon size={10} /> : null}
                            </button>
                            <span
                              dir="auto"
                              style={{
                                flex: 1,
                                fontSize: 13,
                                color: INK,
                                fontWeight: 500,
                                textDecoration: s.done ? "line-through" : "none",
                                opacity: s.done ? 0.65 : 1,
                                wordBreak: "break-word",
                              }}
                            >
                              {s.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSubtask(t.id, s.id)}
                              aria-label={tr(isAr, "Delete subtask", "حذف")}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--icon-muted)",
                                cursor: "pointer",
                                padding: 2,
                                display: "flex",
                                flexShrink: 0,
                              }}
                            >
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        ))}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = subDraft[t.id] || "";
                            addSubtask(t.id, val);
                            setSubDraft((prev) => ({ ...prev, [t.id]: "" }));
                          }}
                          style={{ display: "flex", gap: 6, marginTop: 4 }}
                        >
                          <input
                            value={subDraft[t.id] || ""}
                            onChange={(e) =>
                              setSubDraft((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            placeholder={tr(isAr, "Add subtask…", "أضف مهمة جانبية…")}
                            maxLength={SUBTASK_MAX}
                            dir="auto"
                            style={{
                              flex: 1,
                              boxSizing: "border-box",
                              padding: "7px 10px",
                              fontSize: 13,
                              borderRadius: 8,
                              border: "1px solid rgba(var(--border-rgb),0.18)",
                              background: "var(--input-bg, var(--card))",
                              color: INK,
                              outline: "none",
                            }}
                          />
                          <button
                            type="submit"
                            style={{
                              border: "none",
                              borderRadius: 8,
                              padding: "7px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              background: "color-mix(in srgb, var(--accent-1, #0a84ff) 18%, transparent)",
                              color: "var(--accent-1, #0a84ff)",
                              flexShrink: 0,
                            }}
                          >
                            {tr(isAr, "Add", "إضافة")}
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </li>
              );
            })
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
  padding: 3,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 5,
};

const headerBtn = {
  border: "1px solid rgba(var(--border-rgb),0.14)",
  background: "var(--card)",
  color: INK,
  padding: "5px 10px",
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
};
