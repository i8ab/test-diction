import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { BellIcon, XIcon } from "../common/Icons";
import {
  loadInbox,
  unreadCount,
  markInboxRead,
  markAllInboxRead,
  clearInbox,
  removeInboxItem,
  pushInboxItem,
  syncInboxFromServer,
} from "../../lib/state/inbox";
import { achievementById } from "../../lib/state/achievements";

// Higher threshold + drag resistance = heavier swipe, harder to delete by accident
const SWIPE_DELETE_THRESHOLD = 118;
const SWIPE_DRAG_RESISTANCE = 0.42; // row moves ~42% of finger distance
const SWIPE_AXIS_LOCK = 14; // need clearer horizontal intent before locking

/**
 * Swipe-to-delete row.
 * Direction follows language (as requested):
 *   - English / LTR → swipe RIGHT to delete
 *   - Arabic / RTL  → swipe LEFT to delete
 * Vertical scrolling of the list is preserved (only locks after a clear horizontal gesture).
 */
function SwipeDeleteRow({ children, onDelete, isRtl, deleteLabel }) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef(null); // null | "h" | "v"
  const offsetRef = useRef(0);
  const activePointer = useRef(null);

  // Allowed swipe direction: positive = right, negative = left
  const deleteSign = isRtl ? -1 : 1;

  function setOffset(v) {
    offsetRef.current = v;
    setOffsetX(v);
  }

  function onPointerDown(e) {
    if (exiting) return;
    // Only primary button / touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activePointer.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (!dragging || activePointer.current !== e.pointerId || exiting) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axis.current == null) {
      if (Math.abs(dx) < SWIPE_AXIS_LOCK && Math.abs(dy) < SWIPE_AXIS_LOCK) return;
      // Decide axis once the finger has moved enough
      axis.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v";
      if (axis.current === "v") {
        // Let the list scroll — abort swipe
        setDragging(false);
        activePointer.current = null;
        setOffset(0);
        return;
      }
    }

    if (axis.current !== "h") return;

    // Heavier feel: row lags behind the finger (resistance)
    let next = dx * SWIPE_DRAG_RESISTANCE;
    if (deleteSign > 0) {
      // LTR: prefer positive (right)
      if (next < 0) next = next * 0.12;
      next = Math.min(next, 160);
    } else {
      // RTL: prefer negative (left)
      if (next > 0) next = next * 0.12;
      next = Math.max(next, -160);
    }
    setOffset(next);
    e.preventDefault();
  }

  function finishSwipe() {
    if (exiting) return;
    const ox = offsetRef.current;
    const committed =
      (deleteSign > 0 && ox >= SWIPE_DELETE_THRESHOLD) ||
      (deleteSign < 0 && ox <= -SWIPE_DELETE_THRESHOLD);

    if (committed) {
      setExiting(true);
      setOffset(deleteSign * 420);
      // Let the slide-out animation play, then remove
      setTimeout(() => {
        try {
          onDelete();
        } catch (_) {}
      }, 200);
    } else {
      setOffset(0);
    }
    setDragging(false);
    activePointer.current = null;
    axis.current = null;
  }

  function onPointerUp(e) {
    if (activePointer.current !== e.pointerId) return;
    finishSwipe();
  }

  function onPointerCancel(e) {
    if (activePointer.current !== e.pointerId) return;
    setOffset(0);
    setDragging(false);
    activePointer.current = null;
    axis.current = null;
  }

  const progress = Math.min(1, Math.abs(offsetX) / SWIPE_DELETE_THRESHOLD);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
    >
      {/* Delete reveal under the row */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: isRtl ? "flex-start" : "flex-end",
          paddingInline: 20,
          background: "var(--danger, #e5484d)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          opacity: Math.max(0.35, progress),
          pointerEvents: "none",
        }}
      >
        {deleteLabel}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          position: "relative",
          transform: `translateX(${offsetX}px)`,
          transition: dragging || exiting ? "none" : "transform 0.2s ease",
          background: "var(--card)",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function formatWhen(at, isAr) {
  if (!at) return "";
  const d = new Date(at);
  const now = Date.now();
  const diff = Math.max(0, now - at);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "Just now";
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isAr ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isAr ? `منذ ${days} ي` : `${days}d ago`;
  try {
    return d.toLocaleDateString(isAr ? "ar" : "en", {
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return "";
  }
}

function typeLabel(type, isAr) {
  const map = {
    push: isAr ? "إشعار" : "Push",
    achievement: isAr ? "إنجاز" : "Achievement",
    banner: isAr ? "إعلان" : "Announcement",
    system: isAr ? "نظام" : "System",
    admin: isAr ? "أدمن" : "Admin",
  };
  return map[type] || map.system;
}

/**
 * Header bell: badge of unread in-app notifications + list panel.
 */
export default function InboxBell({
  accountCode = null,
  isAr = false,
  appLang = "en",
  siteBanner = null,
}) {
  const lang = appLang || (isAr ? "ar" : "en");
  const T = (en, ar) => tr(lang, en, ar);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => loadInbox(accountCode));
  const [unread, setUnread] = useState(() => unreadCount(accountCode));
  const [syncing, setSyncing] = useState(false);
  const syncTimerRef = useRef(null);

  const refresh = useCallback(() => {
    if (!accountCode) {
      setItems([]);
      setUnread(0);
      return;
    }
    setItems(loadInbox(accountCode));
    setUnread(unreadCount(accountCode));
  }, [accountCode]);

  const pullServer = useCallback(() => {
    if (!accountCode) return;
    // Debounce rapid accountCode / event storms (refresh / StrictMode)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      setSyncing(true);
      syncInboxFromServer(accountCode)
        .then(() => refresh())
        .catch(() => {})
        .finally(() => setSyncing(false));
    }, 120);
  }, [accountCode, refresh]);

  useEffect(() => {
    refresh();
    pullServer();
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [refresh, pullServer]);

  // Live updates when inbox changes (same tab or SW postMessage handler)
  useEffect(() => {
    function onInbox(e) {
      const code = e?.detail?.accountCode;
      if (code && accountCode && code !== accountCode) return;
      refresh();
    }
    window.addEventListener("twotongues:inbox", onInbox);
    return () => window.removeEventListener("twotongues:inbox", onInbox);
  }, [accountCode, refresh]);

  // Capture push payloads that the SW forwards to open clients
  useEffect(() => {
    if (!accountCode || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    function onSwMessage(event) {
      const data = event?.data;
      if (!data || data.type !== "INBOX_PUSH") return;
      pushInboxItem(accountCode, {
        type: data.notifType || "push",
        title: data.title || T("Notification", "إشعار"),
        body: data.body || "",
        url: data.url || "/",
        at: data.at || Date.now(),
      });
      refresh();
    }
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [accountCode, refresh, T]);

  // Achievements → inbox (event may carry ids[] only)
  useEffect(() => {
    if (!accountCode) return;
    function onAchievement(e) {
      const detail = e?.detail || {};
      const ids = Array.isArray(detail.ids)
        ? detail.ids
        : detail.id
          ? [detail.id]
          : [];
      if (ids.length) {
        for (const rawId of ids) {
          const id = String(rawId);
          let meta = null;
          try {
            meta = achievementById(id);
          } catch (_) {
            meta = null;
          }
          const title =
            (meta && (isAr ? meta.ar || meta.en : meta.en || meta.ar)) ||
            detail.title ||
            (isAr ? "إنجاز جديد!" : "New achievement!");
          const body =
            (meta && (isAr ? meta.descAr || meta.descEn : meta.descEn || meta.descAr)) ||
            detail.body ||
            "";
          pushInboxItem(accountCode, {
            type: "achievement",
            title,
            body: body || "",
            id: `ach-${id}`,
          });
        }
      } else {
        pushInboxItem(accountCode, {
          type: "achievement",
          title: detail.title || (isAr ? "إنجاز جديد!" : "New achievement!"),
          body: detail.body || "",
        });
      }
      refresh();
    }
    window.addEventListener("twotongues:achievement", onAchievement);
    return () => window.removeEventListener("twotongues:achievement", onAchievement);
  }, [accountCode, isAr, refresh]);

  // New/changed site banner → one inbox item (deduped by banner text)
  useEffect(() => {
    if (!accountCode || !siteBanner || !siteBanner.enabled || !siteBanner.message) return;
    const key = `banner-${String(siteBanner.message).slice(0, 80)}`;
    try {
      const seen = sessionStorage.getItem("twoTongues.bannerSeen." + accountCode);
      if (seen === key) return;
      sessionStorage.setItem("twoTongues.bannerSeen." + accountCode, key);
    } catch (_) {}
    pushInboxItem(accountCode, {
      type: "banner",
      title: isAr ? "إعلان الموقع" : "Site announcement",
      body: String(siteBanner.message).slice(0, 300),
      id: key,
    });
    refresh();
  }, [accountCode, siteBanner, isAr, refresh]);

  if (!accountCode) return null;

  function openPanel() {
    setOpen(true);
    refresh();
    pullServer();
  }

  function closePanel() {
    setOpen(false);
  }

  function onItemClick(item) {
    if (!item.read) {
      markInboxRead(accountCode, item.id);
      refresh();
    }
  }

  function onMarkAll() {
    markAllInboxRead(accountCode);
    refresh();
  }

  function onClearAll() {
    clearInbox(accountCode);
    refresh();
  }

  function onRemove(id) {
    removeInboxItem(accountCode, id);
    refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        title={T("Notifications", "الإشعارات")}
        aria-label={T("Notifications", "الإشعارات")}
        className="lift-hover touch-target"
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(var(--border-rgb),0.25)",
          background: "none",
          color: "var(--icon-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <BellIcon size={16} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              insetInlineEnd: -3,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 5300,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "max(16px, env(safe-area-inset-top)) 16px 16px",
            }}
            onClick={closePanel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={T("Notifications", "الإشعارات")}
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 400,
                maxHeight: "min(85dvh, 640px)",
                marginTop: 48,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: "var(--card)",
                color: "var(--ink)",
                borderRadius: 16,
                boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
                border: "1px solid rgba(var(--border-rgb),0.14)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
                  flexShrink: 0,
                  gap: 8,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  {T("Notifications", "الإشعارات")}
                  {unread > 0 ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#fff",
                        background: "var(--danger)",
                        borderRadius: 999,
                        minWidth: 20,
                        height: 20,
                        padding: "0 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                  {syncing ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                      {T("Syncing…", "مزامنة…")}
                    </span>
                  ) : null}
                </h2>
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label={T("Close", "إغلاق")}
                  style={{
                    border: "none",
                    background: "var(--input-bg)",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    color: "var(--icon-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <XIcon size={18} />
                </button>
              </div>

              {items.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 16px",
                    borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={onMarkAll}
                    style={{
                      flex: 1,
                      minHeight: 36,
                      borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)",
                      color: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {T("Mark all read", "تعليم الكل كمقروء")}
                  </button>
                  <button
                    type="button"
                    onClick={onClearAll}
                    style={{
                      flex: 1,
                      minHeight: 36,
                      borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)",
                      color: "var(--danger, #e5484d)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {T("Clear all", "مسح الكل")}
                  </button>
                </div>
              )}

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {items.length === 0 ? (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {T(
                      "No notifications yet. Study reminders and announcements will show up here.",
                      "مفيش إشعارات لسه. تذكيرات المذاكرة والإعلانات هتظهر هنا."
                    )}
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {items.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
                          listStyle: "none",
                        }}
                      >
                        <SwipeDeleteRow
                          isRtl={!!isAr || lang === "ar"}
                          deleteLabel={T("Delete", "حذف")}
                          onDelete={() => onRemove(item.id)}
                        >
                          <div
                            onClick={() => onItemClick(item)}
                            style={{
                              padding: "12px 16px",
                              background: item.read
                                ? "var(--card)"
                                : "rgba(var(--accent-1-rgb, 25, 167, 206), 0.06)",
                              cursor: "pointer",
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                marginTop: 4,
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: item.read
                                  ? "transparent"
                                  : "var(--accent-1, #19A7CE)",
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  marginBottom: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    letterSpacing: "0.03em",
                                    textTransform: "uppercase",
                                    color: "var(--muted)",
                                  }}
                                >
                                  {typeLabel(item.type, isAr)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "var(--muted)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {formatWhen(item.at, isAr)}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: item.read ? 600 : 700,
                                  color: "var(--ink)",
                                  lineHeight: 1.35,
                                }}
                                dir="auto"
                              >
                                {item.title}
                              </div>
                              {item.body ? (
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: "var(--muted-strong)",
                                    lineHeight: 1.4,
                                    marginTop: 3,
                                  }}
                                  dir="auto"
                                >
                                  {item.body}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              title={T("Remove", "حذف")}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemove(item.id);
                              }}
                              style={{
                                flexShrink: 0,
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                border: "none",
                                background: "transparent",
                                color: "var(--muted)",
                                cursor: "pointer",
                                fontSize: 16,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </SwipeDeleteRow>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
