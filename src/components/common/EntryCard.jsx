// Unified vertical word card (mobile / tablet / desktop).
// Actions sit in a bottom bar so they never crowd the word row.
// Each action button has an isolated hit target (no oversized tap areas).
import { useState, memo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { cambridgeUrl } from "../../lib/utils/wordCard";
import { entryPosList, posLabel, getEntrySenses } from "../../lib/utils/wordTypes";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { PairListDisplay } from "./PairList";
import {
  ChevronIcon, CheckIcon, StarIcon, EditIcon, TrashIcon, ZoomIcon,
  EyeIcon, EyeOffIcon, SpeakButton,
} from "./Icons";

function MobilePairChips({ label, pairs, tone = "success" }) {
  const words = (pairs || []).map((p) => (p && (p.word || p.meaning) ? (p.word || p.meaning) : "")).filter(Boolean);
  if (!words.length) return null;
  const color = tone === "danger" ? "var(--danger)" : "var(--success)";
  const bg = tone === "danger"
    ? "color-mix(in srgb, var(--danger) 12%, transparent)"
    : "color-mix(in srgb, var(--success) 12%, transparent)";
  return (
    <div className="entry-pair-chips-block" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 6, letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 11px",
              borderRadius: 999,
              background: bg,
              color: "var(--ink)",
              border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
              maxWidth: "100%",
              overflowWrap: "anywhere",
              lineHeight: 1.35,
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry, cfg, isAdmin, isAr, canEdit, onDelete, onEdit, onOpenZoom,
  isStudied, onToggleStudied, isFavorite, onToggleFavorite,
  addedByLabel, editedByLabel, wordNote = "", onSaveNote,
  mobileLayout = false, tabletLayout = false,
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(wordNote || "");
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  const isEnglishWord = cfg.wordDir === "ltr";
  const senses = getEntrySenses(entry);
  // Compact actions on desktop; slightly roomier on touch layouts
  const touchy = mobileLayout || tabletLayout;

  const actionBtnBase = {
    border: "none",
    background: "var(--input-bg)",
    color: "var(--icon-muted)",
    padding: "6px 4px",
    margin: 0,
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // Fixed personal hit box — not stretching into neighbors
    width: touchy ? 52 : 48,
    height: touchy ? 52 : 48,
    minWidth: touchy ? 52 : 48,
    maxWidth: touchy ? 52 : 48,
    minHeight: touchy ? 52 : 48,
    maxHeight: touchy ? 52 : 48,
    flex: "0 0 auto",
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "inherit",
    lineHeight: 1.1,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    position: "relative",
    zIndex: 1,
    boxSizing: "border-box",
  };

  function renderMeaning() {
    if (senses.length > 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {senses.map((s) => (
            <span key={s.id} dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: touchy ? 15 : 14, color: "var(--meaning)", lineHeight: 1.45 }}>
              {s.pos ? <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 11, marginInlineEnd: 5 }}>{posLabel(s.pos, isAr)}</span> : null}
              {s.meaning}
            </span>
          ))}
        </div>
      );
    }
    return (
      <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: touchy ? 15 : 14, color: "var(--meaning)", lineHeight: 1.45 }}>
        {entry.meaning}
      </span>
    );
  }

  return (
    <div
      className={
        "lift-hover entry-card entry-card--stack" +
        (mobileLayout ? " entry-card--mobile" : "") +
        (tabletLayout ? " entry-card--tablet" : "")
      }
      style={{
        background: CARD,
        border: "1px solid rgba(var(--border-rgb),0.12)",
        borderInlineStart: `4px solid ${isStudied ? "var(--success)" : cfg.accent}`,
        borderRadius: touchy ? 16 : 12,
        padding: touchy ? "14px 14px 12px" : "12px 14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        animation: "fadeInUp 0.35s ease both",
      }}
    >
      {/* Content — expands on tap; actions are outside this zone */}
      <div
        style={{ cursor: "pointer", minWidth: 0 }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            dir={cfg.wordDir}
            style={{
              fontFamily: cfg.wordFont,
              fontSize: touchy ? 18 : 16,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.25,
              flex: 1,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {entry.word}
          </span>
          <span
            className="entry-speak-slot"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
          </span>
          <span style={{ flexShrink: 0, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronIcon
              size={14}
              color={cfg.accent}
              style={{
                transition: "transform 0.15s",
                transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}`,
              }}
            />
          </span>
        </div>

        {entryPosList(entry).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {entryPosList(entry).map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
                  color: "var(--accent-1)",
                  border: "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)",
                }}
              >
                {posLabel(p, isAr)}
              </span>
            ))}
          </div>
        )}

        {/* Meanings: only on phone list. On tablet/PC they appear in Zoom modal only. */}
        {mobileLayout && (
          <div style={{ marginTop: 10 }}>{renderMeaning()}</div>
        )}

        {(isStudied || isFavorite) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {isStudied && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--success)", background: "var(--success-bg)", borderRadius: 8, padding: "4px 8px" }}>
                <CheckIcon size={11} /> {tr(isAr, "Studied", "تمت الدراسة")}
              </span>
            )}
            {isFavorite && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: BRASS, background: `color-mix(in srgb, ${BRASS} 14%, transparent)`, borderRadius: 8, padding: "4px 8px" }}>
                <StarIcon size={11} fill={BRASS} /> {tr(isAr, "Favorite", "مفضلة")}
              </span>
            )}
          </div>
        )}

        {open && (
          <div className="entry-card-expanded" style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
            {/* All layouts: push full meaning / definition / pronunciation details into Zoom */}
            {(hasDefinition || hasExample || hasSynAnt || !mobileLayout) && (
              <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                {tr(
                  isAr,
                  mobileLayout
                    ? "Open Zoom for full definition, examples, and pair details."
                    : "Open Zoom for meaning, pronunciation, definition, examples, and more.",
                  mobileLayout
                    ? "افتح التكبير للتعريف والأمثلة وتفاصيل المرادفات/المضادات."
                    : "افتح التكبير للمعنى والنطق والتعريف والأمثلة والمزيد."
                )}
                {" "}
                <button
                  type="button"
                  onClick={() => onOpenZoom && onOpenZoom(entry.id)}
                  style={{ border: "none", background: "none", color: "var(--accent-1)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12.5 }}
                >
                  {tr(isAr, "Zoom", "تكبير")}
                </button>
              </p>
            )}

            {isEnglishWord && (
              <a
                href={cambridgeUrl(entry.word)}
                target="_blank"
                rel="noopener noreferrer"
                className="lift-hover"
                style={{ display: "inline-flex", alignItems: "center", marginTop: 2, background: "#1D2A57", borderRadius: 3, padding: "4px 8px" }}
              >
                <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 18, display: "block" }} />
              </a>
            )}

            {/* Full definition/examples: only in Zoom on every layout */}
            <div className="entry-longform">
              {hasDefinition && (
                <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 13, color: "var(--muted-strong)", margin: "8px 0 0", lineHeight: 1.6 }}>
                  {entry.definition}
                </p>
              )}
              {!!entry.example && (
                <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
                  “{entry.example}”
                </p>
              )}
              {!!(entry.examples && entry.examples.length) &&
                entry.examples.map((ex, i) => (
                  <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.6 }}>
                    “{ex}”
                  </p>
                ))}
            </div>

            {/* Syn/ant details live in Zoom; keep light chips only on touch layouts if desired — hidden via CSS with longform */}
            {mobileLayout || tabletLayout ? (
              <div className="entry-longform">
                <MobilePairChips label={tr(isAr, "Synonyms", "مرادفات")} pairs={entry.synonyms} tone="success" />
                <MobilePairChips label={tr(isAr, "Antonyms", "مضادات")} pairs={entry.antonyms} tone="danger" />
              </div>
            ) : (
              <div className="entry-longform">
                {!!(entry.synonyms && entry.synonyms.length) && (
                  <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 8 }}>
                    <strong style={{ color: "var(--success)" }}>{tr(isAr, "Synonyms", "مرادفات")}</strong>
                    <PairListDisplay cfg={cfg} pairs={entry.synonyms} />
                  </div>
                )}
                {!!(entry.antonyms && entry.antonyms.length) && (
                  <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 6 }}>
                    <strong style={{ color: "var(--danger)" }}>{tr(isAr, "Antonyms", "مضادات")}</strong>
                    <PairListDisplay cfg={cfg} pairs={entry.antonyms} />
                  </div>
                )}
              </div>
            )}

            {isAdmin && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                {tr(isAr, `added by ${addedByLabel}`, `أضافها ${addedByLabel}`)}
                {entry.editedBy && <span> · {tr(isAr, `edited by ${editedByLabel}`, `عدّلها ${editedByLabel}`)}</span>}
              </div>
            )}

            {typeof onSaveNote === "function" && (
              <div style={{ marginTop: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 4 }}>
                  {tr(isAr, "Personal note", "ملاحظة شخصية")}
                </label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => {
                    if ((noteDraft || "") !== (wordNote || "")) onSaveNote(noteDraft);
                  }}
                  rows={2}
                  placeholder={tr(isAr, "Write a private note…", "اكتب ملاحظة خاصة…")}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 10,
                    border: "1px solid rgba(var(--border-rgb),0.2)",
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "var(--input-bg)",
                    color: "var(--ink)",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar — each button owns a fixed hit box */}
      <div
        className="entry-action-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: touchy ? 8 : 6,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(var(--border-rgb),0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="entry-action-btn"
          style={{ ...actionBtnBase, color: isFavorite ? BRASS : "var(--icon-muted)" }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }}
          aria-pressed={isFavorite}
          aria-label={tr(isAr, "Favorite", "مفضلة")}
          title={tr(isAr, "Favorite", "مفضلة")}
        >
          <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
          <span>{tr(isAr, "Fav", "مفضلة")}</span>
        </button>
        <button
          type="button"
          className="entry-action-btn"
          style={actionBtnBase}
          onClick={(e) => { e.stopPropagation(); onOpenZoom(entry.id); }}
          aria-label={tr(isAr, "Zoom", "تكبير")}
          title={tr(isAr, "Zoom", "تكبير")}
        >
          <ZoomIcon size={18} />
          <span>{tr(isAr, "Zoom", "تكبير")}</span>
        </button>
        <button
          type="button"
          className="entry-action-btn"
          style={{ ...actionBtnBase, color: isStudied ? "var(--success)" : "var(--icon-muted)" }}
          onClick={(e) => { e.stopPropagation(); onToggleStudied(entry.id); }}
          aria-pressed={isStudied}
          aria-label={tr(isAr, "Studied", "دراسة")}
          title={tr(isAr, "Studied", "دراسة")}
        >
          {isStudied ? <EyeIcon size={18} /> : <EyeOffIcon size={18} />}
          <span>{tr(isAr, "Study", "دراسة")}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            className="entry-action-btn"
            style={actionBtnBase}
            onClick={(e) => { e.stopPropagation(); onEdit(entry.id); }}
            aria-label={tr(isAr, "Edit", "تعديل")}
            title={tr(isAr, "Edit", "تعديل")}
          >
            <EditIcon size={16} />
            <span>{tr(isAr, "Edit", "تعديل")}</span>
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            className="entry-action-btn"
            style={{
              ...actionBtnBase,
              color: confirmDel ? "var(--danger)" : "var(--icon-muted)",
              background: confirmDel ? "var(--danger-border)" : "var(--input-bg)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDel) onDelete(entry.id);
              else setConfirmDel(true);
            }}
            onBlur={() => setConfirmDel(false)}
            aria-label={tr(isAr, "Delete", "حذف")}
            title={tr(isAr, "Delete", "حذف")}
          >
            <TrashIcon size={14} />
            <span>{confirmDel ? tr(isAr, "Sure?", "تأكيد؟") : tr(isAr, "Del", "حذف")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(EntryCard);
