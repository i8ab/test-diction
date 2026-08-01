import { useEffect, useState } from "react";
import { detectPartOfSpeech, POS_LABELS } from "../lib/detectPos.js";
import { buildTwelveTenses } from "../lib/verbConjugationEn.js";
import { conjugateArabicVerb } from "../lib/verbConjugationAr.js";
import { analyzeEnglishAdjective } from "../lib/adjectiveAnalysisEn.js";

const POS_COLORS = {
  noun: "#146C94", pronoun: "#7B4B94", adjective: "#B5651D",
  adverb: "#1F7A5C", verb: "#B8323C", other: "#7FA3B5",
};

// Detects the word's part of speech automatically (never manually chosen),
// and — depending on that result — shows the full English tense table,
// an approximate Arabic ماضي/مضارع/أمر table, or the adjective's
// root + prefix/suffix breakdown (English only, per the product spec).
export default function WordAnalysisPanel({ word, isEnglish, isAr }) {
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const w = (word || "").trim();
    if (w.length < 2) { setResult(null); return; }
    setPending(true);
    const handle = setTimeout(async () => {
      try {
        const detected = await detectPartOfSpeech(w, isEnglish);
        setResult(detected);
      } finally {
        setPending(false);
      }
    }, 450); // debounce so we don't hit the dictionary API on every keystroke
    return () => clearTimeout(handle);
  }, [word, isEnglish]);

  const w = (word || "").trim();
  if (w.length < 2) return null;

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ marginTop: 10, marginBottom: 4, padding: "10px 12px", background: "var(--input-bg)", borderRadius: 4, fontSize: 13 }}>
      {pending && !result && (
        <span style={{ color: "var(--muted)" }}>{isAr ? "جاري تحديد نوع الكلمة…" : "Detecting word type…"}</span>
      )}
      {result && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              color: "#fff", background: POS_COLORS[result.pos] || POS_COLORS.other,
            }}>
              {isAr ? POS_LABELS[result.pos]?.ar : POS_LABELS[result.pos]?.en}
            </span>
            {result.source === "heuristic" && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {isAr ? "(تخمين قواعدي تقريبي)" : "(rule-based estimate)"}
              </span>
            )}
            {result.note && <span style={{ fontSize: 11, color: "var(--muted)" }}>{result.note}</span>}
          </div>

          {result.pos === "verb" && isEnglish && <EnglishVerbTable word={w} isAr={isAr} />}
          {result.pos === "verb" && !isEnglish && <ArabicVerbTable word={w} isAr={isAr} />}
          {result.pos === "adjective" && isEnglish && <AdjectiveBreakdown word={w} isAr={isAr} />}
        </>
      )}
    </div>
  );
}

function EnglishVerbTable({ word, isAr }) {
  const { tenses, forms } = buildTwelveTenses(word);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: "var(--muted-strong)", marginBottom: 6 }}>
        {isAr ? `الأصل: ${forms.base} — الماضي: ${forms.past} — التصريف الثالث: ${forms.pastParticiple}` :
          `Base: ${forms.base} — Past: ${forms.past} — Past participle: ${forms.pastParticiple}`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {tenses.map((t) => (
          <div key={t.name + t.group} style={{ padding: "6px 8px", border: "1px solid rgba(var(--border-rgb),0.15)", borderRadius: 3 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)" }}>{isAr ? t.nameAr : `${t.group.split(" — ")[0]} ${t.name}`}</div>
            <div dir="ltr" style={{ fontSize: 13, color: "var(--ink, #146C94)" }}>{t.example}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArabicVerbTable({ word, isAr }) {
  const conj = conjugateArabicVerb(word);
  if (!conj) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
        {isAr ? "تصريف تقريبي للفعل الثلاثي السالم — قد يختلف مع الأفعال المعتلّة أو المضعّفة."
          : "Approximate conjugation for a regular triliteral verb — may differ for weak/doubled verbs."}
      </div>
      {conj.tenses.map((group) => (
        <div key={group.name} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 4 }}>{group.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {group.rows.map((r) => (
              <div key={r.label} style={{ fontSize: 13, padding: "3px 6px", border: "1px solid rgba(var(--border-rgb),0.12)", borderRadius: 3 }}>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{r.label}: </span>{r.form}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdjectiveBreakdown({ word, isAr }) {
  const info = analyzeEnglishAdjective(word);
  if (!info) return null;
  return (
    <div style={{ marginTop: 10, fontSize: 13 }}>
      {info.affixType === "none" ? (
        <span style={{ color: "var(--muted-strong)" }}>
          {isAr ? "لم يتم العثور على بادئة/لاحقة معروفة — الكلمة تبدو صفة أصلية." : "No known prefix/suffix found — looks like a base adjective."}
        </span>
      ) : (
        <span style={{ color: "var(--muted-strong)" }}>
          {isAr
            ? `الجذر المحتمل: "${info.root}" + ${info.affixType === "suffix" ? "لاحقة" : "بادئة"} "${info.affix}"${info.note ? ` (${info.note})` : ""}`
            : `Likely root: "${info.root}" + ${info.affixType} "${info.affix}"${info.note ? ` (${info.note})` : ""}`}
        </span>
      )}
    </div>
  );
}
