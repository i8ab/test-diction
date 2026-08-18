import React, { useState, useEffect, useCallback } from "react";
import {
  fetchInbox,
  markInboxRead,
  deleteInboxItems,
  clearInbox,
  getLocalCache,
  setLocalCache,
} from "../../lib/state/inbox";

/**
 * Header bell – shows unread count, opens dropdown with synced inbox.
 * All mutations (read / delete / clear) go to the server → other devices see the change.
 */
export default function InboxBell({ code }) {
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    // show cache instantly
    const cached = getLocalCache(code);
    if (cached.length) {
      setInbox(cached);
      setUnread(cached.filter((i) => !i.read).length);
    }
    // then refresh from server
    const data = await fetchInbox(code);
    setInbox(data.inbox);
    setUnread(data.unread);
    setLocalCache(code, data.inbox);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
    // refresh every 30s while open, or on focus
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const t = setInterval(load, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [load]);

  // also listen for custom event (when a push arrives while app is open)
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("twotongues:inbox", handler);
    return () => window.removeEventListener("twotongues:inbox", handler);
  }, [load]);

  const handleMarkAllRead = async () => {
    const data = await markInboxRead(code, null);
    setInbox(data.inbox);
    setUnread(data.unread);
    setLocalCache(code, data.inbox);
  };

  const handleClearAll = async () => {
    if (!window.confirm("مسح كل الإشعارات من كل الأجهزة؟")) return;
    const data = await clearInbox(code);
    setInbox(data.inbox);
    setUnread(data.unread);
    setLocalCache(code, data.inbox);
  };

  const handleDeleteOne = async (id) => {
    const data = await deleteInboxItems(code, [id]);
    setInbox(data.inbox);
    setUnread(data.unread);
    setLocalCache(code, data.inbox);
  };

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  if (!code) return null;

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        aria-label="الإشعارات"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-700 dark:text-gray-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute left-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="font-semibold text-sm">الإشعارات</span>
              <div className="flex gap-2 text-xs">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-blue-600 hover:underline"
                  >
                    تعليم الكل كمقروء
                  </button>
                )}
                {inbox.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-red-500 hover:underline"
                  >
                    مسح الكل
                  </button>
                )}
              </div>
            </div>

            {loading && inbox.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</div>
            ) : inbox.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">لا توجد إشعارات</div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {inbox.map((item) => (
                  <li
                    key={item.id}
                    className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      !item.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <p className="font-medium text-sm truncate">{item.title}</p>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {item.body}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(item.ts).toLocaleString("ar-EG")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteOne(item.id)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                        title="حذف"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
