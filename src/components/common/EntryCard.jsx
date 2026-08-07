// The card showing a single dictionary entry in the main word list —
// collapsed to word + meaning, expandable to definition/examples/synonyms.
// On mobile layout (html[data-device="mobile"]) long definition/examples stay
// hidden until Zoom — keeps the list compact and readable.
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

function EntryCard({ entry, cfg, isAdmin, isAr, canEdit, onDelete, onEdit, onOpenZoom, isStudied, onToggleStudied, isFavorite, onToggleFavorite, addedByLabel, editedByLabel, wordNote = "", onSaveNote }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(wordNote || "");
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  const isEnglishWord = cfg.wordDir === "ltr";
  const isExpandable = true;
  const senses = getEntrySenses(entry);

  return (
    <div
      className="entry-card lift-hover"
      style={{
        background: CARD,
        border: "1px solid rgba(var(--border-rgb),0.1)",
        borderInlineStart: `3px solid ${isStudied ? "var(--success)" : cfg.accent}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        animation: "fadeInUp 0.35s ease both",
      }}
    >
      <div
        style={{ flex: 1, minWidth: 0, cursor: isExpandable ? "pointer" : "default" }}
        onClick={isExpandable ? () => setOpen((o) => !o) : undefined}
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? open : undefined}
        onKeyDown={isExpandable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } } : undefined}
      >
        {/* Row 1: word + speaker + type badges */}
        <div className="entry-card-word-row" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          <span
            dir={cfg.wordDir}
            className="entry-card-word"
            style={{ fontFamily: cfg.wordFont, fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.25 }}
          >
            {entry.word}
          </span>
          <span className="entry-card-speak-inline" onClick={(e) => e.stopPropagation()}>
            <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={16} />
          </span>
          {entryPosList(entry).map((p) => (
            <span
              key={p}
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.02em",
                padding: "2px 7px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
                color: "var(--accent-1)",
                border: "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)",
                flexShrink: 0,
              }}
            >
              {posLabel(p, isAr)}
            </span>
          ))}
          {isExpandable && (
            <ChevronIcon
              size={12}
              color={cfg.accent}
              style={{
                flexShrink: 0,
                transition: "transform 0.15s",
                transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}`,
              }}
            />
          )}
        </div>

        {/* Row 2: meaning only (no speaker stuck to the text) */}
        <div className="entry-card-meaning" style={{ marginTop: 4, minWidth: 0 }}>
          {senses.length > 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {senses.map((s) => (
                <span key={s.id} dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 14, color: "var(--meaning)", lineHeight: 1.35 }}>
                  {s.pos ? <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 11, marginInlineEnd: 5 }}>{posLabel(s.pos, isAr)}</span> : null}
                  {s.meaning}
                </span>
              ))}
            </div>
          ) : (
            <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 14, color: "var(--meaning)", lineHeight: 1.35 }}>
              {entry.meaning}
            </span>
          )}
        </div>

        {(isStudied || isFavorite) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
            {isStudied && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-bg)", borderRadius: 3, padding: "2px 6px" }}>
                <CheckIcon size={9} /> {tr(isAr, "Studied", "تمت الدراسة")}
              </span>
            )}
            {isFavorite && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: BRASS, background: "color-mix(in srgb, " + BRASS + " 14%, transparent)", borderRadius: 3, padding: "2px 6px" }}>
                <StarIcon size={9} fill={BRASS} /> {tr(isAr, "Favorite", "مفضلة")}
              </span>
            )}
          </div>
        )}

        {open && (
          <div className="entry-card-expanded" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {/* Mobile tip: long content lives in Zoom */}
            <p className="entry-mobile-zoom-hint" style={{ display: "none", margin: "0 0 8px", fontSize: 12, color: "var(--muted-strong)", lineHeight: 1.45 }}>
              {tr(
                isAr,
                "Definition & examples open in Zoom for a clearer mobile view.",
                "التعريف والأمثلة تظهر في وضع التكبير عشان تبقى أوضح على الموبايل."
              )}
              {" "}
              <button
                type="button"
                onClick={() => onOpenZoom && onOpenZoom(entry.id)}
                style={{ border: "none", background: "none", color: "var(--accent-1)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }}
              >
                {tr(isAr, "Open zoom", "افتح التكبير")}
              </button>
            </p>

            <div className="entry-longform">
              {isEnglishWord && (
                <a
                  href={cambridgeUrl(entry.word)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", marginTop: 2, background: "#1D2A57", borderRadius: 3, padding: "4px 8px" }}
                  className="lift-hover"
                >
                  <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 18, display: "block" }} />
                </a>
              )}
              {hasDefinition && (
                <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 13, color: "var(--muted-strong)", margin: "6px 0 0", lineHeight: 1.6 }}>
                  {entry.definition}
                </p>
              )}
              {!!entry.example && (
                <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
                  “{entry.example}”
                </p>
              )}
              {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
                <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.6 }}>
                  “{ex}”
                </p>
              ))}
              {!!(entry.synonyms && entry.synonyms.length) && (
                <div style={{ fontSize: 12, color: "var(--muted-strong)", marginTop: 6 }}>
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

            {isAdmin && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                {tr(isAr, `added by ${addedByLabel}`, `أضافها ${addedByLabel}`)}
                {entry.editedBy && <span> · {tr(isAr, `edited by ${editedByLabel}`, `عدّلها ${editedByLabel}`)}</span>}
              </div>
            )}
            {typeof onSaveNote === "function" && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 4 }}>
                  {tr(isAr, "Personal note", "ملاحظة شخصية")}
                </label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => { if ((noteDraft || "") !== (wordNote || "")) onSaveNote(entry.id, noteDraft); }}
                  rows={2}
                  placeholder={tr(isAr, "Write a private note…", "اكتب ملاحظة خاصة…")}
                  style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)", padding: "8px 10px", fontSize: 13, background: "var(--input-bg)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions — compact column; speaker for word is already next to the word */}
      <div className="entry-card-actions" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }}
          title={isFavorite ? tr(isAr, "Remove from favorites", "إزالة من المفضلة") : tr(isAr, "Add to favorites", "إضافة للمفضلة")}
          aria-label={isFavorite ? tr(isAr, `Remove ${entry.word} from favorites`, `إزالة ${entry.word} من المفضلة`) : tr(isAr, `Add ${entry.word} to favorites`, `إضافة ${entry.word} للمفضلة`)}
          aria-pressed={isFavorite}
          style={{ border: "none", background: "none", color: isFavorite ? BRASS : "var(--icon-muted)", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", minWidth: 36, minHeight: 36, justifyContent: "center" }}
        >
          <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenZoom(entry.id); }}
          title={tr(isAr, "Zoom", "تكبير")}
          aria-label={tr(isAr, `Zoom in on ${entry.word}`, `تكبير ${entry.word}`)}
          style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", minWidth: 36, minHeight: 36, justifyContent: "center" }}
        >
          <ZoomIcon size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleStudied(entry.id); }}
          title={isStudied ? tr(isAr, "Mark as not studied", "إلغاء وضع علامة الدراسة") : tr(isAr, "Mark as studied/seen", "وضع علامة كمدروسة")}
          aria-label={isStudied ? tr(isAr, `Mark ${entry.word} as not studied`, `إلغاء علامة الدراسة عن ${entry.word}`) : tr(isAr, `Mark ${entry.word} as studied`, `وضع علامة الدراسة على ${entry.word}`)}
          aria-pressed={isStudied}
          style={{ border: "none", background: "none", color: isStudied ? "var(--success)" : "var(--icon-muted)", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", minWidth: 36, minHeight: 36, justifyContent: "center" }}
        >
          {isStudied ? <EyeIcon size={20} /> : <EyeOffIcon size={20} />}
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(entry.id); }}
            title={tr(isAr, "Edit", "تعديل")}
            aria-label={tr(isAr, `Edit ${entry.word}`, `تعديل ${entry.word}`)}
            style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", minWidth: 36, minHeight: 36, justifyContent: "center" }}
          >
            <EditIcon size={16} />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => (confirmDel ? onDelete(entry.id) : setConfirmDel(true))}
            onBlur={() => setConfirmDel(false)}
            title={confirmDel ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Delete", "حذف")}
            aria-label={confirmDel ? tr(isAr, `Confirm delete ${entry.word}`, `تأكيد حذف ${entry.word}`) : tr(isAr, `Delete ${entry.word}`, `حذف ${entry.word}`)}
            style={{ border: "none", background: confirmDel ? "var(--danger-border)" : "transparent", color: confirmDel ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(EntryCard);
