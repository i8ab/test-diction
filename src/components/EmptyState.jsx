import { tr } from "../lib/i18n";
import { INK } from "../lib/theme";
import { PlusIcon } from "./Icons";

export default function EmptyState({ hasQuery, onAdd, accent, isAr }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted-strong)", border: "1px dashed rgba(var(--border-rgb),0.2)", borderRadius: 4 }}>
      <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: INK, marginBottom: 6 }}>
        {hasQuery ? tr(isAr, "No entries match your search", "لا توجد نتائج مطابقة لبحثك") : tr(isAr, "This dictionary is empty", "هذا القاموس فارغ")}
      </p>
      <p style={{ fontSize: 14, marginBottom: 18 }}>{hasQuery ? tr(isAr, "Try a different word.", "جرّب كلمة أخرى.") : tr(isAr, "Be the first to add a word.", "كن أول من يضيف كلمة.")}</p>
      {!hasQuery && (
        <button onClick={onAdd} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", fontSize: 14, fontWeight: 600, color: "#fff", background: accent, border: "none", borderRadius: 3, cursor: "pointer" }}>
          <PlusIcon size={16} /> {tr(isAr, "Add word", "إضافة كلمة")}
        </button>
      )}
    </div>
  );
}
