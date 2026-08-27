// Unified vertical word card (mobile / tablet / desktop).
// Actions sit in a bottom bar so they never crowd the word row.
// Each action button has an isolated hit target (no oversized tap areas).
import { useState, useEffect, useRef, memo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD, BRASS } from "../../lib/config/theme";
import { cambridgeUrl } from "../../lib/utils/wordCard";
import { formatDueIn, isSrsDue } from "../../lib/utils/quizHelpers";
import { entryPosList, posLabel, getEntrySenses } from "../../lib/utils/wordTypes";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import {
  ChevronIcon, CheckIcon, StarIcon, EditIcon, TrashIcon, ZoomIcon, FlameIcon,
  EyeIcon, EyeOffIcon, SpeakButton, MoreIcon,
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
  isStudied, onToggleStudied, isFavorite, onToggleFavorite, priority = 0, onCyclePriority, dueAt = null, isStudiedEntry = false,
  addedByLabel, editedByLabel,
  mobileLayout = false, tabletLayout = false,
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [moreOpen]);
  const hasDefinition = !!entry.definition;
  const hasExample = !!entry.example || !!(entry.examples && entry.examples.length);
  const hasSynAnt = !!((entry.synonyms && entry.synonyms.length) || (entry.antonyms && entry.antonyms.length));
  
  const dueLabel = (isStudiedEntry || isStudied) && dueAt != null
    ? formatDueIn(dueAt, isAr)
    : (isStudiedEntry || isStudied) && dueAt == null
      ? (isAr ? "مستحق" : "Due")
      : null;
  const dueNow = (isStudiedEntry || isStudied) && (dueAt == null || isSrsDue(entry.id, { [entry.id]: dueAt }));

  const isEnglishWord = cfg.wordDir === "ltr";
  const senses = getEntrySenses(entry);
  // Same layout language as tablet on every device: equal-width icon+label strip.
  // Dimensions only change by device (desktop tighter, phone/tablet roomier).
  const touchy = mobileLayout || tabletLayout;
  const actionMinH = mobileLayout ? 48 : tabletLayout ? 48 : 44;
  const actionPad = touchy ? "8px 4px" : "6px 2px";
  const actionRadius = touchy ? 12 : 10;
  const iconSize = touchy ? 18 : 16;

  const moreItemStyle = (color) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "var(--font-latin)",
    cursor: "pointer",
    textAlign: "start",
  });

  // Cambridge + speak + chevron: same control *type* as mobile on every device
  // (rounded chip with background, clustered at the far end of the word row).
  // Absolute size grows with the screen: phone → tablet → desktop.
  const ctrlIcon = mobileLayout ? 16 : tabletLayout ? 18 : 20;
  const chevronIcon = mobileLayout ? 14 : tabletLayout ? 15 : 17;
  const ctrlHit = mobileLayout ? 36 : tabletLayout ? 40 : 44;
  const chevronHit = mobileLayout ? 28 : tabletLayout ? 32 : 36;
  const wordFontSize = mobileLayout ? 16 : tabletLayout ? 18 : 19;
  const ctrlGap = mobileLayout ? 4 : tabletLayout ? 5 : 6;
  const ctrlRadius = mobileLayout ? 11 : tabletLayout ? 12 : 13;
  // Shared chip look (matches mobile pronounce buttons)
  const ctrlChipStyle = {
    flexShrink: 0,
    width: ctrlHit,
    height: ctrlHit,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: ctrlRadius,
    background: "var(--input-bg)",
    border: "1px solid rgba(var(--border-rgb), 0.12)",
    boxSizing: "border-box",
    padding: 0,
    margin: 0,
    color: "var(--icon-muted)",
    textDecoration: "none",
    cursor: "pointer",
  };

  const actionBtnBase = {
    border: "none",
    background: "var(--input-bg)",
    color: "var(--icon-muted)",
    padding: actionPad,
    margin: 0,
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: touchy ? 3 : 2,
    flex: "1 1 0",
    minWidth: 0,
    minHeight: actionMinH,
    height: "auto",
    borderRadius: actionRadius,
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
    // Arabic meaning word in green (e.g. قلم); POS stays neutral accent.
    const list = senses.length ? senses : (entry.meaning ? [{ id: "main", pos: entry.pos || "", meaning: entry.meaning }] : []);
    if (!list.length) return null;
    return (
      <span dir="rtl" lang="ar" style={{ fontFamily: cfg.meaningFont, fontSize: touchy ? 15 : 14, lineHeight: 1.5 }}>
        {list.map((s, i) => (
          <span key={s.id || i}>
            {i > 0 ? <span style={{ color: "var(--muted)", fontWeight: 500, margin: "0 6px", opacity: 0.75 }}>|</span> : null}
            {s.pos ? (
              <span
                style={{
                  color: "var(--accent-1)",
                  fontWeight: 700,
                  fontSize: 11,
                  marginInlineEnd: 4,
                }}
              >
                {posLabel(s.pos, isAr)}
              </span>
            ) : null}
            <span className="entry-meaning-text" style={{ color: "#22c55e", fontWeight: 700 }}>
              {s.meaning}
            </span>
          </span>
        ))}
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
      dir={cfg.dir}
      style={{
        /* background owned by CSS (card surface + clarity) — do NOT set background here
           or it forces solid and breaks data-card-clarity="clear" especially on mobile scroll */
        border: "1px solid rgba(var(--border-rgb),0.12)",
        borderInlineStart: `4px solid ${isStudied ? "var(--success)" : cfg.accent}`,
        borderRadius: touchy ? 16 : 12,
        padding: touchy
          ? "10px 12px 8px"
          : "var(--entry-pad-y, 8px) var(--entry-pad-x, 12px) calc(var(--entry-pad-y, 8px) - 2px)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        animation: "fadeInUp 0.35s ease both",
        contentVisibility: "auto",
        containIntrinsicSize: "0 132px",
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
        {/* Word row: word + POS on the start side; Cambridge / speak / chevron on the far end */}
        <div className="entry-card-word-row" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            className="entry-card-word"
            dir={cfg.wordDir}
            style={{
              fontFamily: cfg.wordFont,
              fontSize: wordFontSize,
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
          {dueLabel && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: dueNow ? "rgba(255,59,48,0.15)" : "rgba(91,141,239,0.15)",
                color: dueNow ? "#ff3b30" : "#5b8def",
                border: dueNow ? "1px solid rgba(255,59,48,0.35)" : "1px solid rgba(91,141,239,0.35)",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              title={tr(isAr, "Next review", "المراجعة القادمة")}
            >
              {dueNow ? (isAr ? "الآن" : "Now") : dueLabel}
            </span>
          )}
          {/* POS chips sit beside the word */}
          {entryPosList(entry).length > 0 && (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, flex: "0 1 auto", minWidth: 0 }}>
              {entryPosList(entry).map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
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
          {/* Spacer pushes controls to the far edge (right in LTR, left in RTL) */}
          <span style={{ flex: "1 1 0", minWidth: 8 }} aria-hidden="true" />
          {/* Cambridge + speak + chevron — same chip cluster as mobile, scales with screen */}
          <span
            className="entry-card-controls"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ctrlGap,
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isEnglishWord && (
              <a
                href={cambridgeUrl(entry.word)}
                target="_blank"
                rel="noopener noreferrer"
                title={tr(isAr, "Cambridge Dictionary", "قاموس كامبريدج")}
                aria-label={tr(isAr, "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
                className="lift-hover entry-cam-link"
                style={ctrlChipStyle}
              >
                <CambridgeShieldIcon size={ctrlIcon} />
              </a>
            )}
            {isEnglishWord && (
              <span className="entry-speak-slot" style={ctrlChipStyle}>
                <SpeakButton
                  text={entry.word}
                  dir={cfg.wordDir}
                  isAr={isAr}
                  size={ctrlIcon}
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: 0,
                    margin: 0,
                    border: "none",
                    background: "transparent",
                    color: "var(--icon-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: ctrlRadius,
                    cursor: "pointer",
                  }}
                />
              </span>
            )}
            <span
              className="entry-chevron-slot"
              style={{
                ...ctrlChipStyle,
                width: chevronHit,
                height: chevronHit,
                background: "transparent",
                border: "none",
              }}
            >
              <ChevronIcon
                size={chevronIcon}
                color={cfg.accent}
                style={{
                  transition: "transform 0.15s",
                  transform: open ? "rotate(90deg)" : "none",
                }}
              />
            </span>
          </span>
        </div>

        {/* Meanings visible on every layout (phone / tablet / PC) — Arabic + green POS */}
        <div style={{ marginTop: 4 }}>{renderMeaning()}</div>

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
          <div className="entry-card-expanded" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
            {/* Full definition/examples: hidden via .entry-longform until Zoom — no redundant hints */}
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

      {/* Action bar — hierarchy: Study + Zoom primary; rest under More */}
      <div
        className="entry-action-bar"
        ref={moreMenuRef}
        style={{
          display: "flex",
          flexWrap: "nowrap",
          justifyContent: "stretch",
          alignItems: "stretch",
          gap: touchy ? 8 : 6,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(var(--border-rgb),0.12)",
          width: "100%",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="entry-action-btn entry-action-primary"
          style={{
            ...actionBtnBase,
            flex: 1.2,
            color: isStudied ? "var(--success)" : "var(--ink)",
            background: isStudied
              ? "color-mix(in srgb, var(--success) 14%, var(--input-bg))"
              : "var(--input-bg)",
            border: isStudied
              ? "1px solid color-mix(in srgb, var(--success) 35%, transparent)"
              : "1px solid rgba(var(--border-rgb),0.12)",
            fontWeight: 700,
          }}
          onClick={(e) => { e.stopPropagation(); setMoreOpen(false); onToggleStudied(entry.id); }}
          aria-pressed={isStudied}
          aria-label={tr(isAr, "Studied", "دراسة")}
          title={tr(isAr, "Studied", "دراسة")}
        >
          {isStudied ? <EyeIcon size={iconSize} /> : <EyeOffIcon size={iconSize} />}
          <span>{tr(isAr, "Study", "دراسة")}</span>
        </button>
        <button
          type="button"
          className="entry-action-btn entry-action-primary"
          style={{
            ...actionBtnBase,
            flex: 1.2,
            color: "var(--ink)",
            fontWeight: 700,
          }}
          onClick={(e) => { e.stopPropagation(); setMoreOpen(false); onOpenZoom(entry.id); }}
          aria-label={tr(isAr, "Zoom", "تكبير")}
          title={tr(isAr, "Zoom", "تكبير")}
        >
          <ZoomIcon size={iconSize} />
          <span>{tr(isAr, "Zoom", "تكبير")}</span>
        </button>
        <button
          type="button"
          className="entry-action-btn entry-action-more"
          style={{
            ...actionBtnBase,
            flex: "0 0 auto",
            minWidth: touchy ? 52 : 48,
            color: moreOpen ? "var(--accent-1)" : "var(--icon-muted)",
            background: moreOpen
              ? "color-mix(in srgb, var(--accent-1) 12%, var(--input-bg))"
              : "var(--input-bg)",
          }}
          onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); setConfirmDel(false); }}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          aria-label={tr(isAr, "More actions", "المزيد")}
          title={tr(isAr, "More", "المزيد")}
        >
          <MoreIcon size={iconSize} />
          <span>{tr(isAr, "More", "المزيد")}</span>
        </button>

        {moreOpen && (
          <div
            role="menu"
            className="entry-more-menu"
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              insetInlineEnd: 0,
              zIndex: 20,
              minWidth: 180,
              padding: 6,
              borderRadius: 14,
              background: "var(--card)",
              border: "1px solid rgba(var(--border-rgb),0.14)",
              boxShadow: "0 12px 32px -12px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="entry-more-item"
              style={moreItemStyle(isFavorite ? BRASS : "var(--ink)")}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.id); setMoreOpen(false); }}
            >
              <StarIcon size={16} fill={isFavorite ? BRASS : "none"} />
              <span>{tr(isAr, "Favorite", "مفضلة")}</span>
            </button>
            {typeof onCyclePriority === "function" && (
              <button
                type="button"
                role="menuitem"
                className="entry-more-item"
                style={moreItemStyle(
                  priority === 3 ? "#ff3b30" : priority === 2 ? "#ff9f0a" : priority === 1 ? "#34c759" : "var(--ink)"
                )}
                onClick={(e) => { e.stopPropagation(); onCyclePriority(entry.id); }}
              >
                <FlameIcon size={16} />
                <span>{
                  priority === 3 ? tr(isAr, "Priority: High", "أولوية: عالية")
                  : priority === 2 ? tr(isAr, "Priority: Med", "أولوية: متوسطة")
                  : priority === 1 ? tr(isAr, "Priority: Low", "أولوية: منخفضة")
                  : tr(isAr, "Set priority", "تعيين أولوية")
                }</span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                className="entry-more-item"
                style={moreItemStyle("var(--ink)")}
                onClick={(e) => { e.stopPropagation(); setMoreOpen(false); onEdit(entry.id); }}
              >
                <EditIcon size={15} />
                <span>{tr(isAr, "Edit", "تعديل")}</span>
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                className="entry-more-item"
                style={moreItemStyle(confirmDel ? "var(--danger)" : "var(--ink)")}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmDel) { onDelete(entry.id); setMoreOpen(false); setConfirmDel(false); }
                  else setConfirmDel(true);
                }}
                onBlur={() => setConfirmDel(false)}
              >
                <TrashIcon size={15} />
                <span>{confirmDel ? tr(isAr, "Tap again to delete", "اضغط مرة أخرى للحذف") : tr(isAr, "Delete", "حذف")}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(EntryCard);
