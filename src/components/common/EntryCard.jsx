// Unified vertical word card (mobile / tablet / desktop).
// Actions sit in a bottom bar so they never crowd the word row.
// Each action button has an isolated hit target (no oversized tap areas).
import { useState, memo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { cambridgeUrl } from "../../lib/utils/wordCard";
import { entryPosList, posLabel, getEntrySenses } from "../../lib/utils/wordTypes";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import {
  ChevronIcon, CheckIcon, StarIcon, EditIcon, TrashIcon, ZoomIcon,
  EyeIcon, EyeOffIcon, SpeakButton,
} from "./Icons";

/** Compact Cambridge Dictionary crest (shield only — no banner text). */
function CambridgeShieldIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {/* Shield outline */}
      <path
        d="M12 1.5C12 1.5 3.5 4.2 3.5 4.2V12.8C3.5 19.2 7.8 24.6 12 26.5C16.2 24.6 20.5 19.2 20.5 12.8V4.2S12 1.5 12 1.5Z"
        fill="#1D2A57"
        stroke="#C4A35A"
        strokeWidth="1.2"
      />
      {/* Inner book / open pages hint */}
      <path
        d="M12 7.2V20.2M12 7.2C10.2 6.6 8.2 6.4 7 6.8V18.8C8.2 18.4 10.2 18.6 12 19.2M12 7.2C13.8 6.6 15.8 6.4 17 6.8V18.8C15.8 18.4 13.8 18.6 12 19.2"
        stroke="#E8D5A3"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Small star / crest jewel */}
      <circle cx="12" cy="12.5" r="1.35" fill="#C4A35A" />
    </svg>
  );
}

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
  addedByLabel, editedByLabel,
  mobileLayout = false, tabletLayout = false,
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState(false);
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  const isEnglishWord = cfg.wordDir === "ltr";
  const senses = getEntrySenses(entry);
  // Compact actions on desktop; slightly roomier on touch layouts
  const touchy = mobileLayout || tabletLayout;

  const actionSize = touchy ? 52 : "var(--entry-action, 48px)";
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
    width: actionSize,
    height: actionSize,
    minWidth: actionSize,
    maxWidth: actionSize,
    minHeight: actionSize,
    maxHeight: actionSize,
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
    // Multiple senses: one compact line — "verb meaning | adjective meaning"
    // (POS next to the word itself is unchanged elsewhere.)
    if (senses.length > 1) {
      return (
        <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: touchy ? 15 : 14, color: "var(--meaning)", lineHeight: 1.5 }}>
          {senses.map((s, i) => (
            <span key={s.id}>
              {i > 0 ? <span style={{ color: "var(--muted)", fontWeight: 500, margin: "0 6px", opacity: 0.75 }}>|</span> : null}
              {s.pos ? <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 11, marginInlineEnd: 4 }}>{posLabel(s.pos, isAr)}</span> : null}
              {s.meaning}
            </span>
          ))}
        </span>
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
        padding: touchy
          ? "14px 14px 12px"
          : "var(--entry-pad-y, 10px) var(--entry-pad-x, 14px) calc(var(--entry-pad-y, 10px) - 2px)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        animation: "fadeInUp 0.35s ease both",
      }}
    >
      {/* Content — expands on tap; actions are outside this zone */}
      <div
        style={{
          cursor: "pointer",
          minWidth: 0,
          WebkitTapHighlightColor: "transparent",
          outline: "none",
          background: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "manipulation",
        }}
        onClick={(e) => {
          setOpen((o) => !o);
          // Drop focus after tap so mobile browsers don't leave a blue/teal wash
          try { e.currentTarget.blur(); } catch (_) {}
        }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            dir={cfg.wordDir}
            style={{
              fontFamily: cfg.wordFont,
              fontSize: touchy ? 18 : 16,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.25,
              flex: "0 1 auto",
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            {entry.word}
          </span>
          {/* POS chips sit beside the word (not under it) to save vertical space */}
          {entryPosList(entry).length > 0 && (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, flex: "0 1 auto", minWidth: 0 }}>
              {entryPosList(entry).map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--accent-1) 14%, transparent)",
                    color: "var(--accent-1)",
                    border: "1px solid color-mix(in srgb, var(--accent-1) 35%, transparent)",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {posLabel(p, isAr)}
                </span>
              ))}
            </span>
          )}
          <span style={{ flex: "1 1 0", minWidth: 4 }} aria-hidden="true" />
          {/* Compact Cambridge shield — next to speaker, no banner/padding waste */}
          {isEnglishWord && (
            <a
              href={cambridgeUrl(entry.word)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")}
              aria-label={tr(isAr, "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
              className="lift-hover"
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              <CambridgeShieldIcon size={18} />
            </a>
          )}
          <span
            className="entry-speak-slot"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={isAr} size={18} />
          </span>
          <span style={{ flexShrink: 0, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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

        {/* Meanings visible on every layout (phone / tablet / PC) */}
        <div style={{ marginTop: 8 }}>{renderMeaning()}</div>

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
            {/* Definition / examples only in Zoom — hint on all layouts */}
            {(hasDefinition || hasExample) && (
              <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                {tr(isAr, "Open Zoom for full definition, examples, and pair details.", "افتح التكبير للتعريف والأمثلة وتفاصيل المرادفات/المضادات.")}
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

            {/* Full definition/examples: hidden via .entry-longform until Zoom */}
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

            {/* Synonyms + antonyms chips visible on EVERY layout */}
            <MobilePairChips label={tr(isAr, "Synonyms", "مرادفات")} pairs={entry.synonyms} tone="success" />
            <MobilePairChips label={tr(isAr, "Antonyms", "مضادات")} pairs={entry.antonyms} tone="danger" />

            {isAdmin && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                {tr(isAr, `added by ${addedByLabel}`, `أضافها ${addedByLabel}`)}
                {entry.editedBy && <span> · {tr(isAr, `edited by ${editedByLabel}`, `عدّلها ${editedByLabel}`)}</span>}
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
