// The card showing a single dictionary entry in the main word list —
// collapsed to word + meaning, expandable to definition/examples/synonyms.
// Mobile layout stacks content vertically (actions as a bottom bar) so the
// narrow screen is not crowded. Desktop/tablet keep the classic side actions.
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
    <div className="entry-mobile-pair-block" style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 6, letterSpacing: "0.02em" }}>{label}</div>
      <div className="entry-mobile-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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

function EntryCard({ entry, cfg, isAdmin, isAr, canEdit, onDelete, onEdit, onOpenZoom, isStudied, onToggleStudied, isFavorite, onToggleFavorite, addedByLabel, editedByLabel, wordNote = "", onSaveNote, mobileLayout = false, tabletLayout = false }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(wordNote || "");
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  const isEnglishWord = cfg.wordDir === "ltr";
  const isExpandable = true;
  const senses = getEntrySenses(entry);

  const actionBtn = {
    border: "none",
    background: "var(--input-bg)",
    color: "var(--icon-muted)",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 48,
    minWidth: 0,
    flex: 1,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "inherit",
    WebkitTapHighlightColor: "transparent",
  };

  function renderMeaning() {
    if (senses.length > 1) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {senses.map((s) => (
            <span key={s.id} dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: mobileLayout ? 15 : 13.5, color: "var(--meaning)", lineHeight: 1.4 }}>
              {s.pos ? <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 11, marginInlineEnd: 5 }}>{posLabel(s.pos, isAr)}</span> : null}
              {s.meaning}
            </span>
          ))}
        </div>
      );
    }
    return (
      <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: mobileLayout ? 15 : 14, color: "var(--meaning)", lineHeight: 1.4 }}>
        {entry.meaning}
        {!mobileLayout && !!entry.meaning && (
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={isAr} size={13} />
        )}
      </span>
    );
  }

  function renderExpanded() {
    if (!open) return null;
    return (
      <div className="entry-card-expanded" style={{ marginTop: mobileLayout ? 12 : 8 }} onClick={(e) => e.stopPropagation()}>
        {mobileLayout && (hasDefinition || hasExample || hasSynAnt) && (
          <p className="entry-mobile-zoom-hint" style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
            {tr(isAr, "Open Zoom for full definition, examples, and pair details.", "افتح التكبير للتعريف والأمثلة وتفاصيل المرادفات/المضادات.")}
            {" "}
            <button type="button" onClick={() => onOpenZoom && onOpenZoom(entry.id)} style={{ border: "none", background: "none", color: "var(--accent-1)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12.5 }}>
              {tr(isAr, "Zoom", "تكبير")}
            </button>
          </p>
        )}

        {!mobileLayout && isEnglishWord && (
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

        <div className="entry-longform">
          {isEnglishWord && mobileLayout && (
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
            <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 13, color: "var(--muted-strong)", margin: "6px 0 0", lineHeight: 1.6 }}>{entry.definition}</p>
          )}
          {!!entry.example && (
            <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.6 }}>“{entry.example}”</p>
          )}
          {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
            <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 13, fontStyle: "italic", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.6 }}>“{ex}”</p>
          ))}
        </div>

        {mobileLayout ? (
          <>
            <MobilePairChips label={tr(isAr, "Synonyms", "مرادفات")} pairs={entry.synonyms} tone="success" />
            <MobilePairChips label={tr(isAr, "Antonyms", "مضادات")} pairs={entry.antonyms} tone="danger" />
          </>
        ) : (
          <>
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
          </>
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
              onBlur={() => { if ((noteDraft || "") !== (wordNote || "") && typeof onSaveNote === "function") onSaveNote(noteDraft); }}
              rows={2}
              placeholder={tr(isAr, "Write a private note…", "اكتب ملاحظة خاصة…")}
              style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid rgba(var(--border-rgb),0.2)", padding: "10px 12px", fontSize: 14, background: "var(--input-bg)", color: "var(--ink)", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        )}
      </div>
    );
  }

  // ——— Mobile: vertical stack, actions as bottom bar ———
  if (mobileLayout) {
    return (
      <div
        className="lift-hover entry-card entry-card--mobile"
        style={{
          background: CARD,
          border: "1px solid rgba(var(--border-rgb),0.12)",
          borderInlineStart: `4px solid ${isStudied ? "var(--success)" : cfg.accent}`,
          borderRadius: 16,
          padding: "14px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          animation: "fadeInUp 0.35s ease both",
        }}
      >
        <div
          style={{ cursor: "pointer", minWidth: 0 }}
          onClick={() => setOpen((o) => !o)}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        >
          {/* Word + speak + chevron */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1.25, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
              {entry.word}
            </span>
            <span onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
              <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
            </span>
            <ChevronIcon
              size={14}
              color={cfg.accent}
              style={{ flexShrink: 0, transition: "transform 0.15s", transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}` }}
            />
          </div>

          {/* POS badges */}
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

          {/* Meaning — full width */}
          <div style={{ marginTop: 10 }}>{renderMeaning()}</div>

          {(isStudied || isFavorite) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {isStudied && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--success)", background: "var(--success-bg)", borderRadius: 8, padding: "4px 8px" }}>
                  <CheckIcon size={11} /> {tr(isAr, "Studied", "تمت الدراسة")}
                </span>
              )}
              {isFavorite && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: BRASS, background: "color-mix(in srgb, " + BRASS + " 14%, transparent)", borderRadius: 8, padding: "4px 8px" }}>
                  <StarIcon size={11} fill={BRASS} /> {tr(isAr, "Favorite", "مفضلة")}
                </span>
              )}
            </div>
          )}

          {renderExpanded()}
        </div>

        {/* Bottom action bar — horizontal, not beside the word */}
        <div
          className="entry-mobile-action-bar"
          style={{
            display: "flex",
            gap: 6,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(var(--border-rgb),0.12)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" style={{ ...actionBtn, color: isFavorite ? BRASS : "var(--icon-muted)" }} onClick={() => onToggleFavorite(entry.id)} aria-pressed={isFavorite} aria-label={tr(isAr, "Favorite", "مفضلة")}>
            <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
            <span>{tr(isAr, "Fav", "مفضلة")}</span>
          </button>
          <button type="button" style={actionBtn} onClick={() => onOpenZoom(entry.id)} aria-label={tr(isAr, "Zoom", "تكبير")}>
            <ZoomIcon size={18} />
            <span>{tr(isAr, "Zoom", "تكبير")}</span>
          </button>
          <button type="button" style={{ ...actionBtn, color: isStudied ? "var(--success)" : "var(--icon-muted)" }} onClick={() => onToggleStudied(entry.id)} aria-pressed={isStudied} aria-label={tr(isAr, "Studied", "دراسة")}>
            {isStudied ? <EyeIcon size={18} /> : <EyeOffIcon size={18} />}
            <span>{tr(isAr, "Study", "دراسة")}</span>
          </button>
          {canEdit && (
            <button type="button" style={actionBtn} onClick={() => onEdit(entry.id)} aria-label={tr(isAr, "Edit", "تعديل")}>
              <EditIcon size={16} />
              <span>{tr(isAr, "Edit", "تعديل")}</span>
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              style={{ ...actionBtn, color: confirmDel ? "var(--danger)" : "var(--icon-muted)", background: confirmDel ? "var(--danger-border)" : "var(--input-bg)" }}
              onClick={() => (confirmDel ? onDelete(entry.id) : setConfirmDel(true))}
              onBlur={() => setConfirmDel(false)}
              aria-label={tr(isAr, "Delete", "حذف")}
            >
              <TrashIcon size={14} />
              <span>{confirmDel ? tr(isAr, "Sure?", "تأكيد؟") : tr(isAr, "Del", "حذف")}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ——— Desktop / tablet: classic side actions ———
  return (
    <div
      className={`lift-hover entry-card${tabletLayout ? " entry-card--tablet" : ""}`}
      style={{
        background: CARD,
        border: "1px solid rgba(var(--border-rgb),0.1)",
        borderInlineStart: `3px solid ${isStudied ? "var(--success)" : cfg.accent}`,
        borderRadius: 3,
        padding: "9px 14px",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
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
        <div className="entry-card-top" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontWeight: 600, color: INK }}>{entry.word}</span>
          {entryPosList(entry).map((p) => (
            <span key={p} style={{
              marginInlineStart: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
              padding: "1px 6px", borderRadius: 999, verticalAlign: "middle",
              background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
              color: "var(--accent-1)", border: "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)",
            }}>
              {posLabel(p, isAr)}
            </span>
          ))}
          {isExpandable && (
            <ChevronIcon size={11} color={cfg.accent}
              style={{ flexShrink: 0, transition: "transform 0.15s", transform: `${cfg.dir === "rtl" ? "scaleX(-1) " : ""}${open ? "rotate(90deg)" : ""}` }} />
          )}
          {renderMeaning()}
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
        {renderExpanded()}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
        <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); }} title={isFavorite ? tr(isAr, "Remove from favorites", "إزالة من المفضلة") : tr(isAr, "Add to favorites", "إضافة للمفضلة")} aria-label={isFavorite ? tr(isAr, `Remove ${entry.word} from favorites`, `إزالة ${entry.word} من المفضلة`) : tr(isAr, `Add ${entry.word} to favorites`, `إضافة ${entry.word} للمفضلة`)} aria-pressed={isFavorite} style={{ border: "none", background: "none", color: isFavorite ? BRASS : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <StarIcon size={18} fill={isFavorite ? BRASS : "none"} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onOpenZoom(entry.id); }} title={tr(isAr, "Zoom", "تكبير")} aria-label={tr(isAr, `Zoom in on ${entry.word}`, `تكبير ${entry.word}`)} style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ZoomIcon size={18} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleStudied(entry.id); }} title={isStudied ? tr(isAr, "Mark as not studied", "إلغاء وضع علامة الدراسة") : tr(isAr, "Mark as studied/seen", "وضع علامة كمدروسة")} aria-label={isStudied ? tr(isAr, `Mark ${entry.word} as not studied`, `إلغاء علامة الدراسة عن ${entry.word}`) : tr(isAr, `Mark ${entry.word} as studied`, `وضع علامة الدراسة على ${entry.word}`)} aria-pressed={isStudied} style={{ border: "none", background: "none", color: isStudied ? "var(--success)" : "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
          {isStudied ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
        </button>
        {canEdit && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(entry.id); }} title={tr(isAr, "Edit", "تعديل")} aria-label={tr(isAr, `Edit ${entry.word}`, `تعديل ${entry.word}`)} style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <EditIcon size={16} />
          </button>
        )}
        {canEdit && (
          <button onClick={() => (confirmDel ? onDelete(entry.id) : setConfirmDel(true))} onBlur={() => setConfirmDel(false)} title={confirmDel ? tr(isAr, "Click again to confirm", "اضغط مرة أخرى للتأكيد") : tr(isAr, "Delete", "حذف")} aria-label={confirmDel ? tr(isAr, `Confirm delete ${entry.word}`, `تأكيد حذف ${entry.word}`) : tr(isAr, `Delete ${entry.word}`, `حذف ${entry.word}`)} style={{ border: "none", background: confirmDel ? "var(--danger-border)" : "transparent", color: confirmDel ? "var(--danger)" : "var(--icon-muted)", borderRadius: 3, padding: 6, cursor: "pointer" }}>
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(EntryCard);
