// "Word of the Day" — a single entry from the current section, picked
// deterministically from today's date so everyone studying this section
// sees the same word all day (and it only changes once every 24h, not on
// every re-render/navigation). Purely derived from entries already loaded
// client-side — no extra network calls or stored fields.
import { useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { CARD } from "../../lib/config/theme";
import { SpeakButton, CalendarIcon } from "../common/Icons";

// Small deterministic string hash (djb2) — used to turn today's date +
// section key into a stable index into the entries array.
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function WordOfTheDay({ entries, section, cfg, isAr, onOpenZoom }) {
  const word = useMemo(() => {
    if (!entries || !entries.length) return null;
    const idx = hashStr(`${todayDateKey()}:${section}`) % entries.length;
    return entries[idx];
  }, [entries, section]);

  if (!word) return null;

  return (
    <div
      className="lift-hover"
      onClick={() => onOpenZoom(word.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenZoom(word.id); } }}
      style={{
        marginTop: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        background: `linear-gradient(135deg, ${cfg.accentSoft}, ${CARD})`,
        border: `1px solid ${cfg.accent}`, borderRadius: 10, padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", background: cfg.accent, color: "var(--on-accent, #fff)", flexShrink: 0 }}>
        <CalendarIcon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: cfg.accent }}>
          {tr(isAr, "Word of the day", "كلمة اليوم")}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <span dir={cfg.wordDir} style={{ fontFamily: cfg.wordFont, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{word.word}</span>
          <span dir={cfg.meaningDir} style={{ fontFamily: cfg.meaningFont, fontSize: 13.5, color: "var(--meaning)" }}>{word.meaning}</span>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <SpeakButton text={word.word} dir={cfg.wordDir} isAr={isAr} size={17} />
      </div>
    </div>
  );
}
