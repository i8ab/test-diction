// The card showing a single dictionary entry in the main word list —
// collapsed to word + meaning, expandable to definition/examples/synonyms.
// Wrapped in React.memo below: word lists can run into the hundreds of
// visible cards, and MainView re-renders on every search keystroke, so
// without memoization every card would re-render on every keystroke too.
// The callbacks are id-based (rather than pre-bound per entry) so the
// parent can hand down stable function references that don't defeat memo.
import { useState, memo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { cambridgeUrl } from "../../lib/utils/wordCard";
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
  const isExpandable = true; // always expandable so personal notes are reachable
  return (
    <div className="lift-hover" style={{ background: CARD, border: "1px solid rgba(var(--border-rgb),0.1)", borderInlineStart: `3px solid ${isStudied ? "var(--success)" : cfg.accent}`, borderRadius: 3, padding: "9px 14px", display: "flex", justifyContent: "space-between", gap: 12, animation: "fadeInUp 0.35s ease both" }}>
      <div
        style={{ flex: 1, minWidth: 0, cursor: isExpandable ? "pointer" : "default" }}
        onClick={isExpandable ? () => setOpen((o) => !o) : undefined}
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        aria-expanded={isExpandable ? open : undefined}
        onKeyDown={isExpandable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } } : undefined}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontWeight: 600, color: INK }}>{entry.word}</span>
          {isExpandable && (
            <ChevronIcon size={11} color={cfg.accent}
              style={{ flexShrink: 0, transition: "transform 0.15s", transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}` }} />
          )}
          <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 14, color: "var(--meaning)" }}>{entry.meaning}</span>
          {!!entry.meaning && <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={isAr} size={13} />}
        </div>
        {(isStudied || isFavorite) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
            {isStudied && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-bg)", borderRadius: 3, padding: "2px 6px" }}>
                <CheckIcon size={9} /> {tr(isAr, "Studied", "تمت الدراسة")}
              </span>
            )}
            {isFavorite && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: BRASS, background: "var(--accent-1-soft)", borderRadius: 3, padding: "2px 6px" }}>
                <StarIcon size={9} fill={BRASS} /> {tr(isAr, "Favorite", "مفضلة")}
              </span>
            )}
          </div>
        )}
        {open && isExpandable && (
          <>
            {isEnglishWord && (
              <a
                href={cambridgeUrl(entry.word)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={tr(isAr, "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
                style={{ display: "inline-flex", alignItems: "center", marginTop: 6, background: "#1D2A57", borderRadius: 3, padding: "4px 8px" }}
                className="lift-hover">
                <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 18, display: "block" }} />
              </a>
            )}
            {hasDefinition && (
              <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 13, color: "var(--muted-strong)", margin: "6px 0 0", lineHeight: 1.6 }}>{entry.definition}</p>
            )}
            {hasExample && (
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
            {isAdmin && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                {tr(isAr, `added by ${addedByLabel}`, `أضافها ${addedByLabel}`)}
                {entry.editedBy && <span> · {tr(isAr, `edited by ${editedByLabel}`, `عدّلها ${editedByLabel}`)}</span>}
              </div>
            )}
            {typeof onSaveNote === "function" && (
              <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", display: "block", marginBottom: 4 }}>
                  {tr(isAr, "My note", "ملاحظتي")}
                </label>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => onSaveNote(noteDraft)}
                  placeholder={tr(isAr, "Personal note for this word…", "ملاحظة شخصية على الكلمة…")}
                  rows={2}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13,
                    fontFamily: "inherit", borderRadius: 8, border: "1px solid rgba(var(--border-rgb),0.2)",
                    background: "var(--input-bg)", color: INK, resize: "vertical",
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
        <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }}
          title={isFavorite ? tr(isAr, "Remove from favorites", "إزالة من المفضلة") : tr(isAr, "Add to favorites", "إضافة للمفضلة")}
          aria-label={isFavorite ? tr(isAr, `Remove ${entry.word} from favorites`, `إزالة ${entry.word} من المفضلة`) : tr(isAr, `Add ${entry.word} to favorites`, `إضافة ${entry.word} للمفضلة`)}
          aria-pressed={isFavorite}
          style={{ border: "none", background: "none", color: isFavorite ? BRASS : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenZoom(entry.id); }}
          title={tr(isAr, "Zoom", "تكبير")}
          aria-label={tr(isAr, `Zoom in on ${entry.word}`, `تكبير ${entry.word}`)}
          style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ZoomIcon size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStudied(entry.id); }}
          title={isStudied ? tr(isAr, "Mark as not studied", "إلغاء وضع علامة الدراسة") : tr(isAr, "Mark as studied/seen", "وضع علامة كمدروسة")}
          aria-label={isStudied ? tr(isAr, `Mark ${entry.word} as not studied`, `إلغاء علامة الدراسة عن ${entry.word}`) : tr(isAr, `Mark ${entry.word} as studied`, `وضع علامة الدراسة على ${entry.word}`)}
          aria-pressed={isStudied}
          style={{ border: "none", background: "none", color: isStudied ? "var(--success)" : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          {isStudied ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
        </button>
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(entry.id); }}
            title={tr(isAr, "Edit", "تعديل")} aria-label={tr(isAr, `Edit ${entry.word}`, `تعديل ${entry.word}`)}
            style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <EditIcon size={16} />
          </button>
        )}
        {canEdit && (
          <button onClick={() => (confirmDel ? onDelete(entry.id) : setConfirmDel(true))} onBlur={() => setConfirmDel(false)}
            title={confirmDel ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Delete", "حذف")}
            aria-label={confirmDel ? tr(isAr, `Confirm delete ${entry.word}`, `تأكيد حذف ${entry.word}`) : tr(isAr, `Delete ${entry.word}`, `حذف ${entry.word}`)}
            style={{ border: "none", background: confirmDel ? "var(--danger-border)" : "transparent", color: confirmDel ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(EntryCard);
