import { createPortal } from "react-dom";
import { useState } from "react";
import { tr } from "../../lib/config/i18n";
import { UsersIcon, XIcon, CheckIcon, TrashIcon } from "../common/Icons";

/**
 * Admin: pending signup requests (approve / reject).
 */
export default function AccountRequestsModal({
  open,
  onClose,
  pending = [],
  isAr = false,
  onApproveRequest,
  onRejectRequest,
}) {
  const [busyCode, setBusyCode] = useState(null);
  if (!open || typeof document === "undefined") return null;

  const pendingCount = pending.length;

  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5200,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr(isAr, "Account requests", "طلبات الحسابات")}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: "min(90dvh, 820px)",
          overflowY: "auto",
          background: "var(--card)",
          color: "var(--ink)",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 20px 50px -12px rgba(0,0,0,0.4)",
          border: "1px solid rgba(var(--border-rgb),0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {tr(isAr, "Account requests", "طلبات الحسابات")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
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
        {pendingCount === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              padding: "12px 4px",
              lineHeight: 1.45,
            }}
          >
            {tr(isAr, "No pending account requests.", "لا توجد طلبات حساب معلّقة.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((a) => (
              <div
                key={a.code}
                style={{
                  border: "1px solid rgba(var(--border-rgb),0.16)",
                  borderRadius: 10,
                  padding: "12px 12px",
                  background: "var(--input-bg)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  {a.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted-strong)",
                    fontFamily: "ui-monospace, monospace",
                    marginTop: 2,
                  }}
                  dir="ltr"
                >
                  @{a.username || "—"}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={busyCode === a.code}
                    className="touch-target"
                    onClick={async () => {
                      setBusyCode(a.code);
                      try {
                        await onApproveRequest?.(a.code);
                      } finally {
                        setBusyCode(null);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      background: "var(--success)",
                    }}
                  >
                    <CheckIcon size={13} /> {tr(isAr, "Approve", "موافقة")}
                  </button>
                  <button
                    type="button"
                    disabled={busyCode === a.code}
                    className="touch-target"
                    onClick={async () => {
                      setBusyCode(a.code);
                      try {
                        await onRejectRequest?.(a.code);
                      } finally {
                        setBusyCode(null);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--danger)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--danger)",
                      background: "transparent",
                    }}
                  >
                    <TrashIcon size={13} /> {tr(isAr, "Reject", "رفض")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Compact header button that opens the requests modal. */
export function AccountRequestsButton({ pendingCount, isAr, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tr(isAr, "Account requests", "طلبات الحسابات")}
      aria-label={tr(isAr, "Account requests", "طلبات الحسابات")}
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
      <UsersIcon size={16} />
      {pendingCount > 0 && (
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
            boxShadow: "0 0 0 2px var(--card)",
          }}
        >
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </button>
  );
}
