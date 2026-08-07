// Modern admin panel: accounts, activity log, invite & backup tools.
import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { translateAdminError, LOG_ACTION_META, LOG_SECTIONS } from "../../lib/state/logs";
import { downloadFullBackup } from "../../lib/utils/backupUtils";
import {
  XIcon, CheckIcon, LoaderIcon, PlusIcon, EditIcon, TrashIcon, LinkIcon,
  BookIcon, ChevronIcon, CopyIcon, DownloadIcon, UsersIcon, SettingsIcon,
} from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

function initials(name) {
  const p = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function StatPill({ label, value, accent }) {
  return (
    <div
      style={{
        flex: "1 1 90px",
        minWidth: 88,
        padding: "12px 12px",
        borderRadius: 14,
        background: "var(--input-bg)",
        border: "1px solid rgba(var(--border-rgb),0.12)",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || INK, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AdminModal({ accounts, entries, myAccountCode, logs, onClearLogs, onClose, onAdd, onEdit, onDelete, isAr }) {
  const [backupDone, setBackupDone] = useState(false);
  const [tab, setTab] = useState("accounts"); // accounts | log | tools
  const [mode, setMode] = useState("list"); // list | add | edit | added
  const [editingCode, setEditingCode] = useState(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formStatus, setFormStatus] = useState("active");
  const [formUsername, setFormUsername] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCode, setNewAccountCode] = useState("");
  const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (mode !== "list") {
        setError("");
        setConfirmClearLogs(false);
        setMode("list");
      } else {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, mode]);

  function startAdd() {
    setFormName("");
    setFormUsername("");
    setFormRole("user");
    setError("");
    setMode("add");
  }
  function startEdit(account) {
    setEditingCode(account.code);
    setFormName(account.name);
    setFormUsername(account.username || "");
    setFormRole(account.role === "admin" ? "admin" : "user");
    setFormStatus(account.status === "blocked" ? "blocked" : (account.status === "pending" ? "pending" : "active"));
    setError("");
    setMode("edit");
  }

  function goBack() {
    setError("");
    setConfirmClearLogs(false);
    setConfirmDeleteCode(null);
    if (mode === "list") onClose();
    else setMode("list");
  }

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const result = await onAdd(formName, formRole, formUsername);
    setSaving(false);
    if (result && result.error) {
      setError(translateAdminError(result.error, isAr));
      return;
    }
    setNewAccountName(formName.trim());
    setNewAccountCode(result.code);
    setMode("added");
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const result = await onEdit(editingCode, { name: formName, role: formRole, username: formUsername, status: formStatus });
    setSaving(false);
    if (result && result.error) {
      setError(translateAdminError(result.error, isAr));
      return;
    }
    setMode("list");
  }

  async function copyText(text, setFlag) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (_) {}
      document.body.removeChild(ta);
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 1800);
  }

  function handleClearLogsClick() {
    if (!confirmClearLogs) {
      setConfirmClearLogs(true);
      return;
    }
    onClearLogs && onClearLogs();
    setConfirmClearLogs(false);
    setLogFilter("all");
  }

  const stats = useMemo(() => {
    const list = accounts || [];
    return {
      total: list.length,
      admins: list.filter((a) => a.role === "admin").length,
      pending: list.filter((a) => a.status === "pending").length,
      words: (entries || []).length,
    };
  }, [accounts, entries]);

  const sortedLogs = useMemo(() => [...(logs || [])].sort((a, b) => b.at - a.at), [logs]);
  const activeSection = LOG_SECTIONS.find((s) => s.key === logFilter) || LOG_SECTIONS[0];
  const filteredLogs = useMemo(
    () => sortedLogs.filter((entry) => activeSection.match(entry.action)),
    [sortedLogs, activeSection]
  );

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = accounts || [];
    if (!q) return list;
    return list.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.username || "").toLowerCase().includes(q) ||
        (a.code || "").toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const title =
    mode === "add"
      ? tr(isAr, "Add account", "إضافة حساب")
      : mode === "added"
      ? tr(isAr, "Account created", "تم إنشاء الحساب")
      : mode === "edit"
      ? tr(isAr, "Edit account", "تعديل الحساب")
      : tr(isAr, "Admin panel", "لوحة التحكم");

  const tabs = [
    { id: "accounts", label: tr(isAr, "Accounts", "الحسابات"), icon: UsersIcon },
    { id: "log", label: tr(isAr, "Activity", "النشاط"), icon: BookIcon },
    { id: "tools", label: tr(isAr, "Tools", "أدوات"), icon: SettingsIcon },
  ];

  return (
    <div
      onClick={goBack}
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2000,
      }}
    >
      <BodyScrollLock />
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        style={{
          width: "100%",
          maxWidth: "min(560px, 100%)",
          maxHeight: "min(92dvh, 920px)",
          overflowY: "auto",
          background: CARD,
          borderRadius: 20,
          padding: 0,
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.45)",
          border: "1px solid rgba(var(--border-rgb),0.12)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 18px 14px",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-1) 18%, transparent), color-mix(in srgb, var(--accent-2) 10%, transparent))",
            borderBottom: "1px solid rgba(var(--border-rgb),0.1)",
            position: "sticky",
            top: 0,
            zIndex: 2,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <h2 id="admin-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>
                {title}
              </h2>
              {mode === "list" && (
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted-strong)" }}>
                  {tr(isAr, "Manage members, activity, and backups", "إدارة الأعضاء والنشاط والنسخ الاحتياطي")}
                </p>
              )}
            </div>
            <button
              onClick={goBack}
              aria-label={mode === "list" ? tr(isAr, "Close", "إغلاق") : tr(isAr, "Back", "رجوع")}
              style={{
                border: "none",
                background: "var(--input-bg)",
                cursor: "pointer",
                color: "var(--icon-muted)",
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <XIcon size={18} />
            </button>
          </div>

          {mode === "list" && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <StatPill label={tr(isAr, "Accounts", "حسابات")} value={stats.total} accent="var(--accent-1)" />
                <StatPill label={tr(isAr, "Admins", "مسؤولون")} value={stats.admins} accent={BRASS} />
                <StatPill label={tr(isAr, "Pending", "معلّق")} value={stats.pending} accent={stats.pending ? "var(--danger)" : "var(--muted)"} />
                <StatPill label={tr(isAr, "Words", "كلمات")} value={stats.words} />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 14,
                  padding: 4,
                  borderRadius: 12,
                  background: "var(--input-bg)",
                  border: "1px solid rgba(var(--border-rgb),0.1)",
                }}
              >
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const on = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "9px 8px",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 12.5,
                        background: on ? CARD : "transparent",
                        color: on ? "var(--accent-1)" : "var(--muted-strong)",
                        boxShadow: on ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                      }}
                    >
                      <Icon size={14} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "14px 18px 20px" }}>
          {mode === "list" && tab === "accounts" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr(isAr, "Search name or username…", "ابحث بالاسم أو اليوزرنيم…")}
                  style={{ ...inputStyle, flex: 1, minWidth: 140, margin: 0, borderRadius: 12 }}
                />
                <button
                  onClick={startAdd}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 16px",
                    minHeight: 44,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--accent-1) 55%, transparent)",
                  }}
                >
                  <PlusIcon size={15} /> {tr(isAr, "Add", "إضافة")}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredAccounts.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--muted-strong)", textAlign: "center", padding: 24 }}>
                    {tr(isAr, "No accounts match.", "مفيش حسابات مطابقة.")}
                  </p>
                )}
                {filteredAccounts.map((a) => {
                  const pending = a.status === "pending";
                  const isYou = a.code === myAccountCode;
                  return (
                    <div
                      key={a.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(var(--border-rgb),0.12)",
                        background: isYou ? "color-mix(in srgb, var(--accent-1) 8%, var(--card))" : "var(--input-bg)",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 13,
                          color: "#fff",
                          overflow: "hidden",
                          background:
                            a.role === "admin"
                              ? `linear-gradient(135deg, ${BRASS}, #c9a227)`
                              : "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                        }}
                        aria-hidden="true"
                      >
                        {a.avatar ? (
                          <img
                            src={a.avatar}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          initials(a.name)
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: INK, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                          {isYou && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--accent-1-soft)", color: "var(--accent-1)" }}>
                              {tr(isAr, "You", "أنت")}
                            </span>
                          )}
                          {pending && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--danger-bg)", color: "var(--danger)" }}>
                              {tr(isAr, "Pending", "معلّق")}
                            </span>
                          )}
                          {a.status === "blocked" && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--danger-bg)", color: "var(--danger)" }}>
                              {tr(isAr, "Blocked", "محظور")}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted-strong)", fontFamily: "ui-monospace, monospace", marginTop: 2 }} dir="ltr">
                          @{a.username || "—"}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: a.role === "admin" ? BRASS : "var(--muted)", marginTop: 2 }}>
                          {a.role === "admin" ? tr(isAr, "Admin", "مسؤول") : tr(isAr, "User", "مستخدم")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => startEdit(a)}
                          title={tr(isAr, "Edit", "تعديل")}
                          aria-label={tr(isAr, `Edit ${a.name}`, `تعديل ${a.name}`)}
                          style={{
                            border: "none",
                            background: CARD,
                            color: "var(--icon-muted)",
                            borderRadius: 10,
                            width: 36,
                            height: 36,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                          }}
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          onClick={() => (confirmDeleteCode === a.code ? onDelete(a.code) : setConfirmDeleteCode(a.code))}
                          onBlur={() => setConfirmDeleteCode(null)}
                          title={confirmDeleteCode === a.code ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Remove", "إزالة")}
                          aria-label={tr(isAr, `Remove ${a.name}`, `إزالة ${a.name}`)}
                          style={{
                            border: "none",
                            background: confirmDeleteCode === a.code ? "var(--danger-bg)" : CARD,
                            color: confirmDeleteCode === a.code ? "var(--danger)" : "var(--icon-muted)",
                            borderRadius: 10,
                            width: 36,
                            height: 36,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                          }}
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {mode === "list" && tab === "log" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted-strong)" }}>
                  {filteredLogs.length} {tr(isAr, "events", "حدث")}
                </div>
                {sortedLogs.length > 0 && (
                  <button
                    onClick={handleClearLogsClick}
                    onBlur={() => setConfirmClearLogs(false)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: confirmClearLogs ? "#fff" : "var(--danger)",
                      background: confirmClearLogs ? "var(--danger)" : "transparent",
                      border: "1px solid var(--danger)",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    {confirmClearLogs
                      ? tr(isAr, "Confirm clear", "تأكيد المسح")
                      : tr(isAr, "Clear log", "مسح السجل")}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {LOG_SECTIONS.map((s) => {
                  const active = s.key === logFilter;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setLogFilter(s.key)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "#fff" : "var(--icon-muted)",
                        background: active ? "linear-gradient(135deg, var(--accent-1), var(--accent-2))" : "var(--input-bg)",
                        border: "none",
                        borderRadius: 20,
                        cursor: "pointer",
                      }}
                    >
                      {tr(isAr, s.label, s.labelAr)}
                    </button>
                  );
                })}
              </div>
              {filteredLogs.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted-strong)", textAlign: "center", padding: 28 }}>
                  {sortedLogs.length === 0
                    ? tr(isAr, "No activity recorded yet.", "لا يوجد نشاط مسجل بعد.")
                    : tr(isAr, "No activity in this section yet.", "لا يوجد نشاط في هذا القسم بعد.")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "52vh", overflowY: "auto" }}>
                  {filteredLogs.map((entry) => {
                    const meta = LOG_ACTION_META[entry.action] || {
                      label: entry.action,
                      labelAr: entry.action,
                      color: "var(--muted-strong)",
                    };
                    return (
                      <div
                        key={entry.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(var(--border-rgb),0.1)",
                          background: "var(--input-bg)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: meta.color,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "color-mix(in srgb, currentColor 12%, transparent)",
                            }}
                          >
                            {tr(isAr, meta.label, meta.labelAr)}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                            {new Date(entry.at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: INK, marginTop: 6, lineHeight: 1.4 }}>{entry.message}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mode === "list" && tab === "tools" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "var(--input-bg)",
                  border: "1px solid rgba(var(--border-rgb),0.12)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: INK, marginBottom: 6 }}>
                  {tr(isAr, "Invite link", "رابط الدعوة")}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                  {tr(
                    isAr,
                    "Anyone with this link can request an account. You must approve them before they can sign in.",
                    "أي حد معاه الرابط يقدر يطلب حساب. لازم توافق عليه قبل ما يسجّل دخول."
                  )}
                </p>
                <button
                  onClick={() =>
                    copyText(`${window.location.origin}${window.location.pathname}?invite=1`, setInviteCopied)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    color: inviteCopied ? "var(--success)" : "#fff",
                    background: inviteCopied
                      ? "var(--success-bg)"
                      : "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  }}
                >
                  {inviteCopied ? <CheckIcon size={15} /> : <LinkIcon size={15} />}
                  {inviteCopied ? tr(isAr, "Copied!", "تم النسخ!") : tr(isAr, "Copy invite link", "نسخ رابط الدعوة")}
                </button>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "var(--input-bg)",
                  border: "1px solid rgba(var(--border-rgb),0.12)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: INK, marginBottom: 6 }}>
                  {tr(isAr, "Full backup", "نسخة احتياطية كاملة")}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.45 }}>
                  {tr(
                    isAr,
                    "Downloads words, accounts, and the activity log as a file on your device. Nothing is uploaded.",
                    "ينزّل الكلمات والحسابات وسجل النشاط كملف على جهازك. مش بيترفع لأي سيرفر."
                  )}
                </p>
                <button
                  onClick={() => {
                    downloadFullBackup({ entries, accounts, logs });
                    setBackupDone(true);
                    setTimeout(() => setBackupDone(false), 1800);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    minHeight: 44,
                    borderRadius: 12,
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                    color: backupDone ? "var(--success)" : INK,
                    background: CARD,
                  }}
                >
                  {backupDone ? <CheckIcon size={15} /> : <DownloadIcon size={15} />}
                  {backupDone ? tr(isAr, "Downloaded", "تم التنزيل") : tr(isAr, "Download backup", "تنزيل النسخة")}
                </button>
              </div>
            </div>
          )}

          {(mode === "add" || mode === "edit") && (
            <form onSubmit={mode === "add" ? submitAdd : submitEdit}>
              <label style={labelStyle} htmlFor="acct-form-name">
                {tr(isAr, "Display name", "الاسم الظاهر")}
              </label>
              <input
                id="acct-form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ ...inputStyle, borderRadius: 12 }}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
              />
              <label style={labelStyle} htmlFor="acct-form-username">
                {tr(isAr, "Username", "اسم المستخدم")}
              </label>
              <input
                id="acct-form-username"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", borderRadius: 12 }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                placeholder={tr(isAr, "e.g. omar_23", "مثال: omar_23")}
              />
              <label style={labelStyle} htmlFor="acct-form-role">
                {tr(isAr, "Role", "الدور")}
              </label>
              <select
                id="acct-form-role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                style={{ ...inputStyle, borderRadius: 12, fontFamily: "inherit" }}
              >
                <option value="user">{tr(isAr, "User", "مستخدم")}</option>
                <option value="admin">{tr(isAr, "Admin", "مسؤول")}</option>
              </select>
              {mode === "edit" && (
                <>
                  <label style={labelStyle} htmlFor="acct-form-status">
                    {tr(isAr, "Access", "الوصول للموقع")}
                  </label>
                  <select
                    id="acct-form-status"
                    value={formStatus === "pending" ? "active" : formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    style={{ ...inputStyle, borderRadius: 12, fontFamily: "inherit" }}
                  >
                    <option value="active">{tr(isAr, "Allowed — can open the site", "مسموح — يقدر يفتح الموقع")}</option>
                    <option value="blocked">{tr(isAr, "Blocked — cannot open the site", "محظور — مش يقدر يفتح الموقع")}</option>
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                    {tr(isAr, "Blocked users are logged out and cannot sign in until you allow them again.", "المحظورون بيتسجل خروجهم ومش يقدروا يدخلوا لحد ما تسمح لهم تاني.")}
                  </p>
                </>
              )}
              {error && (
                <div style={errorStyle} role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--icon-muted)",
                    background: "var(--input-bg)",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  {tr(isAr, "Cancel", "إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...primaryBtnStyle,
                    marginTop: 0,
                    flex: 1,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                  }}
                >
                  {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save", "حفظ")}
                </button>
              </div>
            </form>
          )}

          {mode === "added" && (
            <div>
              <p style={{ color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px", lineHeight: 1.5 }}>
                {tr(
                  isAr,
                  `“${newAccountName}” is ready. Temporary password is the code below — they should change it after first sign-in.`,
                  `«${newAccountName}» جاهز. كلمة المرور المؤقتة هي الرمز تحت — يفضّل يغيّرها بعد أول دخول.`
                )}
              </p>
              <div
                onClick={() => copyText(newAccountCode, setCodeCopied)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    copyText(newAccountCode, setCodeCopied);
                  }
                }}
                style={{
                  textAlign: "center",
                  padding: "20px 12px",
                  background: codeCopied ? "var(--success-bg)" : "var(--input-bg)",
                  border: `1px dashed ${codeCopied ? "var(--success)" : "rgba(var(--border-rgb),0.3)"}`,
                  borderRadius: 16,
                  marginBottom: 8,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, letterSpacing: "0.08em", color: INK }}>
                  {newAccountCode}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 12,
                  color: codeCopied ? "var(--success)" : "var(--muted)",
                  marginBottom: 18,
                }}
              >
                {codeCopied ? (
                  <>
                    <CheckIcon size={13} /> {tr(isAr, "Copied", "تم النسخ")}
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} /> {tr(isAr, "Tap to copy", "اضغط للنسخ")}
                  </>
                )}
              </div>
              <button
                onClick={() => setMode("list")}
                style={{
                  ...primaryBtnStyle,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                }}
              >
                {tr(isAr, "Done", "تم")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminModal;
