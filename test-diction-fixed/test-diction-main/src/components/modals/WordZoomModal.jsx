import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, CARD } from "../../lib/config/theme";
import { cambridgeUrl, shareWordCard } from "../../lib/utils/wordCard";
import { detectDir, detectFont } from "../../lib/utils/searchUtils";
import { LoaderIcon, ShareIcon, SpeakButton, XIcon } from "../common/Icons";
import { PairListDisplay } from "../common/PairList";

// Big, centered "zoom" view of a single word — just the word and its meaning
// (plus definition, if any) in a large, readable font. Opened via the zoom
// icon on each entry card.
export default function WordZoomModal({ entry, cfg, onClose }) {
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try { await shareWordCard(entry, cfg); } finally { setSharing(false); }
  }

  return (
    <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 2000 }}>
      <div onClick={(e) => e.stopPropagation()} className="modal-card" dir={cfg.dir} role="dialog" aria-modal="true" aria-labelledby="zoom-modal-word"
        style={{ width: "100%", maxWidth: 560, background: CARD, borderRadius: 6, padding: "48px 32px 40px", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)", textAlign: "center", position: "relative" }}>
        <button onClick={handleShare} disabled={sharing} aria-label={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          title={tr(cfg.dir === "rtl", "Share this word", "شارك الكلمة دي")}
          style={{ position: "absolute", top: 14, insetInlineStart: 14, border: "none", background: "none", cursor: sharing ? "default" : "pointer", color: "var(--icon-muted)" }}>
          {sharing ? <LoaderIcon size={19} /> : <ShareIcon size={19} />}
        </button>
        <button onClick={onClose} aria-label={tr(cfg.dir === "rtl", "Close", "إغلاق")} style={{ position: "absolute", top: 14, insetInlineEnd: 14, border: "none", background: "none", cursor: "pointer", color: "var(--icon-muted)" }}>
          <XIcon size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div dir={cfg.wordDir} id="zoom-modal-word" style={{ fontFamily: cfg.wordFont, fontSize: "clamp(30px, 6vw, 46px)", fontWeight: 700, color: INK, lineHeight: 1.2, wordBreak: "break-word" }}>
            {entry.word}
          </div>
          <SpeakButton text={entry.word} dir={cfg.wordDir} isAr={cfg.dir === "rtl"} size={26} style={{ color: cfg.accent, flexShrink: 0 }} />
        </div>
        <div style={{ width: 48, height: 3, background: cfg.accent, borderRadius: 2, margin: "18px auto" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: "clamp(22px, 4.5vw, 30px)", color: "var(--meaning)", lineHeight: 1.35, wordBreak: "break-word" }}>
            {entry.meaning}
          </div>
          <SpeakButton text={entry.meaning} dir={cfg.meaningDir} isAr={cfg.dir === "rtl"} size={20} style={{ color: "var(--meaning)", flexShrink: 0 }} />
        </div>
        {cfg.wordDir === "ltr" && (
          <a
            href={cambridgeUrl(entry.word)}
            target="_blank"
            rel="noopener noreferrer"
            title={tr(cfg.dir === "rtl", "Open in Cambridge Dictionary", "افتح في قاموس كامبريدج")}
            style={{ display: "inline-flex", alignItems: "center", marginTop: 18, background: "#1D2A57", borderRadius: 3, padding: "6px 10px" }}
            className="lift-hover">
            <img src="https://dictionary.cambridge.org/external/images/freesearch/sbl.png?version=6.0.78" alt={tr(cfg.dir === "rtl", "Cambridge Dictionary", "قاموس كامبريدج")} style={{ height: 20, display: "block" }} />
          </a>
        )}
        {entry.definition && (
          <p dir={detectDir(entry.definition)} style={{ fontFamily: detectFont(entry.definition), fontSize: 15, color: "var(--muted-strong)", marginTop: 22, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            {entry.definition}
          </p>
        )}
        {entry.example && (
          <p dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 14, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{entry.example}”
          </p>
        )}
        {!!(entry.examples && entry.examples.length) && entry.examples.map((ex, i) => (
          <p key={i} dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 15, fontStyle: "italic", color: "var(--muted)", marginTop: 8, lineHeight: 1.7, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            “{ex}”
          </p>
        ))}
        {!!(entry.synonyms && entry.synonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 16, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--success)" }}>{tr(cfg.dir === "rtl", "Synonyms", "مرادفات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.synonyms} />
          </div>
        )}
        {!!(entry.antonyms && entry.antonyms.length) && (
          <div style={{ fontSize: 14, color: "var(--muted-strong)", marginTop: 10, textAlign: cfg.dir === "rtl" ? "right" : "left" }}>
            <strong style={{ color: "var(--danger)" }}>{tr(cfg.dir === "rtl", "Antonyms", "مضادات")}</strong>
            <PairListDisplay cfg={cfg} pairs={entry.antonyms} />
          </div>
        )}
      </div>
    </div>
  );
}
