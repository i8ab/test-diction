import { useState, useEffect, useCallback } from "react";
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
} from "../../lib/state/inbox";
import { achievementById } from "../../lib/state/achievements";

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

  const refresh = useCallback(() => {
    if (!accountCode) {
      setItems([]);
      setUnread(0);
      return;
    }
    setItems(loadInbox(accountCode));
    setUnread(unreadCount(accountCode));
  }, [accountCode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {T("Notifications", "الإشعارات")}
                  {unread > 0 ? (
                    <span
                      style={{
                        marginInlineStart: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--danger)",
                      }}
                    >
                      {unread}
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
                        onClick={() => onItemClick(item)}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(var(--border-rgb),0.08)",
                          background: item.read
                            ? "transparent"
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
