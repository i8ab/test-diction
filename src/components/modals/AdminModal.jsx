// Admin panel: manage accounts (add/edit/remove), invite link, and the
// activity log viewer.
import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS, labelStyle, inputStyle, errorStyle, primaryBtnStyle } from "../../lib/config/theme";
import { translateAdminError, LOG_ACTION_META, LOG_SECTIONS } from "../../lib/state/logs";
import {
  XIcon, CheckIcon, LoaderIcon, PlusIcon, EditIcon, TrashIcon, LinkIcon,
  BookIcon, ChevronIcon, CopyIcon,
} from "../common/Icons";

function AdminModal({ accounts, myAccountCode, logs, onClose, onAdd, onEdit, onDelete, isAr }) {
  const [mode, setMode] = useState("list"); // list | add | edit | added | log
  const [editingCode, setEditingCode] = useState(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCode, setNewAccountCode] = useState("");
  const [confirmDeleteCode, setConfirmDeleteCode] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (mode !== "list") setMode("list");
      else onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, mode]);

  function startAdd() {
    setFormName(""); setFormRole("user"); setError(""); setMode("add");
  }
  function startEdit(account) {
    setEditingCode(account.code); setFormName(account.name); setFormRole(account.role === "admin" ? "admin" : "user"); setError(""); setMode("edit");
  }

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const result = await onAdd(formName, formRole);
    setSaving(false);
    if (result && result.error) { setError(translateAdminError(result.error, isAr)); return; }
    setNewAccountName(formName.trim());
    setNewAccountCode(result.code);
    setMode("added");
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    const result = await onEdit(editingCode, { name: formName, role: formRole });
    setSaving(false);
    if (result && result.error) { setError(translateAdminError(result.error, isAr)); return; }
    setMode("list");
  }

  async function handleCopyNewCode() {
    try {
      await navigator.clipboard.writeText(newAccountCode);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = newAccountCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  }

  const [inviteCopied, setInviteCopied] = useState(false);
  async function handleCopyInviteLink() {
    const link = `${window.location.origin}${window.location.pathname}?invite=1`;
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      document.body.removeChild(ta);
    }
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1800);
  }

  const sortedLogs = useMemo(() => [...(logs || [])].sort((a, b) => b.at - a.at), [logs]);
  const activeSection = LOG_SECTIONS.find((s) => s.key === logFilter) || LOG_SECTIONS[0];
  const filteredLogs = useMemo(() => sortedLogs.filter((entry) => activeSection.match(entry.action)), [sortedLogs, activeSection]);

  const title = mode === "list" ? tr(isAr, "Admin panel", "لوحة التحكم")
    : mode === "add" ? tr(isAr, "Add account", "إضافة حساب")
    : mode === "added" ? tr(isAr, "Account created", "تم إنشاء الحساب")
    : mode === "log" ? tr(isAr, "Activity log", "سجل النشاط")
    : tr(isAr, "Edit account", "تعديل الحساب");

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: CARD, borderRadius: 4, padding: "24px 24px 22px", boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 id="admin-modal-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label={tr(isAr, "Close", "إغلاق")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}><XIcon size={20} /></button>
        </div>

        {mode === "list" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={handleCopyInviteLink} className="lift-hover" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: inviteCopied ? "var(--success)" : INK, background: "none", border: `1px solid ${inviteCopied ? "var(--success)" : "rgba(var(--border-rgb),0.25)"}`, borderRadius: 3, cursor: "pointer" }}>
                {inviteCopied ? <CheckIcon size={14} /> : <LinkIcon size={14} />} {inviteCopied ? tr(isAr, "Link copied", "تم النسخ") : tr(isAr, "Copy invite link", "نسخ رابط الدعوة")}
              </button>
              <button onClick={() => { setLogFilter("all"); setMode("log"); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: INK, background: "none", border: "1px solid rgba(var(--border-rgb),0.25)", borderRadius: 3, cursor: "pointer" }}>
                <BookIcon size={14} /> {tr(isAr, "Activity log", "سجل النشاط")}
              </button>
              <button onClick={startAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: BRASS, border: "none", borderRadius: 3, cursor: "pointer" }}>
                <PlusIcon size={14} /> {tr(isAr, "Add account", "إضافة حساب")}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
              {tr(isAr, "Anyone with this link can create an account, but they'll still need the shared access code from you to actually sign in.", "أي حد معاه الرابط ده يقدر يعمل حساب، بس لسه محتاج منك رمز الوصول المشترك عشان يقدر يسجل دخول فعلاً.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {accounts.length === 0 && <p style={{ fontSize: 13, color: "var(--muted-strong)" }}>{tr(isAr, "No accounts yet.", "لا توجد حسابات بعد.")}</p>}
              {accounts.map((a) => (
                <div key={a.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 3 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK, display: "flex", alignItems: "center", gap: 6 }}>
                      {a.name}
                      {a.code === myAccountCode && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{tr(isAr, "(you)", "(أنت)")}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: a.role === "admin" ? BRASS : "var(--muted)", fontWeight: a.role === "admin" ? 700 : 400 }}>
                      {a.role === "admin" ? tr(isAr, "Admin", "مسؤول") : tr(isAr, "User", "مستخدم")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'Fraunces', serif", letterSpacing: "0.04em", marginTop: 2 }}>
                      {tr(isAr, `Code: ${a.code}`, `الرمز: ${a.code}`)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(a)} title={tr(isAr, "Edit", "تعديل")} aria-label={tr(isAr, `Edit ${a.name}`, `تعديل ${a.name}`)}
                      style={{ border: "1px solid rgba(var(--border-rgb),0.2)", background: "none", color: "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
                      <EditIcon size={13} />
                    </button>
                    <button
                      onClick={() => (confirmDeleteCode === a.code ? onDelete(a.code) : setConfirmDeleteCode(a.code))}
                      onBlur={() => setConfirmDeleteCode(null)}
                      title={confirmDeleteCode === a.code ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Remove", "إزالة")}
                      aria-label={confirmDeleteCode === a.code ? tr(isAr, `Confirm remove ${a.name}`, `تأكيد إزالة ${a.name}`) : tr(isAr, `Remove ${a.name}`, `إزالة ${a.name}`)}
                      style={{ border: "none", background: confirmDeleteCode === a.code ? "var(--danger-border)" : "transparent", color: confirmDeleteCode === a.code ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(mode === "add" || mode === "edit") && (
          <form onSubmit={mode === "add" ? submitAdd : submitEdit} style={{ marginTop: 14 }}>
            <label style={labelStyle} htmlFor="acct-form-name">{tr(isAr, "Name", "الاسم")}</label>
            <input id="acct-form-name" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} autoFocus autoCapitalize="off" autoCorrect="off" />
            <label style={labelStyle} htmlFor="acct-form-role">{tr(isAr, "Role", "الدور")}</label>
            <select id="acct-form-role" value={formRole} onChange={(e) => setFormRole(e.target.value)} style={{ ...inputStyle, fontFamily: "'Source Sans 3', sans-serif" }}>
              <option value="user">{tr(isAr, "User", "مستخدم")}</option>
              <option value="admin">{tr(isAr, "Admin", "مسؤول")}</option>
            </select>
            {error && <div style={errorStyle} role="alert" aria-live="assertive">{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setMode("list")} style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                {tr(isAr, "Cancel", "إلغاء")}
              </button>
              <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, marginTop: 0, flex: 1 }}>
                {saving ? <LoaderIcon size={16} /> : <CheckIcon size={16} />} {tr(isAr, "Save", "حفظ")}
              </button>
            </div>
          </form>
        )}

        {mode === "added" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "var(--muted-strong)", fontSize: 14, margin: "0 0 14px" }}>
              {tr(isAr, `Share this personal code with ${newAccountName} — they'll use it, along with the shared access code, to sign in.`, `شارك هذا الرمز الشخصي مع ${newAccountName} — سيستخدمه مع رمز الوصول المشترك لتسجيل الدخول.`)}
            </p>
            <div
              onClick={handleCopyNewCode}
              title={tr(isAr, "Click to copy", "اضغط للنسخ")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopyNewCode(); } }}
              style={{ textAlign: "center", padding: "18px 10px", background: codeCopied ? "var(--success-bg)" : "var(--input-bg)", border: `1px dashed ${codeCopied ? "rgba(var(--success-border-rgb),0.45)" : "rgba(var(--border-rgb),0.3)"}`, borderRadius: 4, marginBottom: 8, cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, letterSpacing: "0.08em", color: INK }}>{newAccountCode}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: codeCopied ? "var(--success)" : "var(--muted)", marginBottom: 18 }}>
              {codeCopied ? (<><CheckIcon size={13} /> {tr(isAr, "Copied", "تم النسخ")}</>) : (<><CopyIcon size={13} /> {tr(isAr, "Click the code to copy", "اضغط على الرمز للنسخ")}</>)}
            </div>
            <button onClick={() => setMode("list")} style={primaryBtnStyle}>{tr(isAr, "Done", "تم")}</button>
          </div>
        )}

        {mode === "log" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
              <button onClick={() => setMode("list")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "var(--icon-muted)", background: "none", border: "1px solid rgba(var(--border-rgb),0.2)", borderRadius: 3, cursor: "pointer" }}>
                <ChevronIcon size={13} style={{ transform: `rotate(${isAr ? 0 : 180}deg)` }} /> {tr(isAr, "Back", "رجوع")}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {LOG_SECTIONS.map((s) => {
                const active = s.key === logFilter;
                return (
                  <button key={s.key} onClick={() => setLogFilter(s.key)}
                    style={{ padding: "6px 11px", fontSize: 12, fontWeight: 600, color: active ? "#fff" : "var(--icon-muted)", background: active ? BRASS : "none", border: `1px solid ${active ? BRASS : "rgba(var(--border-rgb),0.2)"}`, borderRadius: 20, cursor: "pointer" }}>
                    {tr(isAr, s.label, s.labelAr)}
                  </button>
                );
              })}
            </div>
            {filteredLogs.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted-strong)" }}>
                {sortedLogs.length === 0 ? tr(isAr, "No activity recorded yet.", "لا يوجد نشاط مسجل بعد.") : tr(isAr, "No activity in this section yet.", "لا يوجد نشاط في هذا القسم بعد.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto" }}>
                {filteredLogs.map((entry) => {
                  const meta = LOG_ACTION_META[entry.action] || { label: entry.action, labelAr: entry.action, color: "var(--muted-strong)" };
                  return (
                    <div key={entry.id} style={{ padding: "8px 10px", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {tr(isAr, meta.label, meta.labelAr)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                          {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: INK, marginTop: 3 }}>{entry.message}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminModal;
