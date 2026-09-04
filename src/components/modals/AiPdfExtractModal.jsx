import { useState, useEffect, useMemo } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, primaryBtnStyle, inputStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, BookIcon, SearchIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import WaterProgressBar from "../common/WaterProgressBar";

// Calls go through /api/ai-agent so the real upstream secret stays
// server-side and is never shipped to the browser bundle.
const AI_AGENT_PROXY_URL = "/api/ai-agent?action=extract-pdf";

/**
 * Upload a PDF textbook → AI Agent extracts vocabulary → admin picks words to add.
 */
export default function AiPdfExtractModal({
  section = "en-ar",
  entries = [],
  isAr,
  onClose,
  onAddEntries, // async (entries[], unitId?, targetSection?) => void
  showToast,
  academicUnits = [],
  activeUnitId = null,
}) {
  const [file, setFile] = useState(null);
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [phase, setPhase] = useState("upload"); // upload | extracting | review | saving
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  // Destination dictionary: EN→AR, Academic, or AR→AR (independent of current tab)
  const [targetSection, setTargetSection] = useState(
    () => (section === "academic" || section === "ar-ar" || section === "en-ar" ? section : "en-ar")
  );
  const isAcademic = targetSection === "academic";
  const [targetUnitId, setTargetUnitId] = useState(
    () => activeUnitId || academicUnits[0]?.id || null
  );

  // existing words in the chosen destination; academic scoped by unit
  const existing = new Set(
    (entries || [])
      .filter((e) => {
        if (e.section !== targetSection) return false;
        if (!isAcademic) return true;
        return (e.unitId || null) === (targetUnitId || null);
      })
      .map((e) => String(e.word || "").toLowerCase())
  );

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && phase !== "extracting" && phase !== "saving") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError(tr(isAr, "Only PDF files are allowed", "مسموح بملفات PDF فقط"));
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError(tr(isAr, "File is too large (max 100 MB)", "الملف كبير أوي (الحد 100 ميجا)"));
      return;
    }
    setFile(f);
    setError("");
  }

  async function startExtract() {
    if (!file) return;

    // Validate optional page range before uploading
    const rawFrom = String(pageFrom || "").trim();
    const rawTo = String(pageTo || "").trim();
    let pf = rawFrom === "" ? null : parseInt(rawFrom, 10);
    let pt = rawTo === "" ? null : parseInt(rawTo, 10);
    if (rawFrom !== "" && (Number.isNaN(pf) || pf < 1)) {
      setError(tr(isAr, "Page “from” must be a whole number ≥ 1", "رقم صفحة «من» لازم يكون عدد صحيح ≥ 1"));
      return;
    }
    if (rawTo !== "" && (Number.isNaN(pt) || pt < 1)) {
      setError(tr(isAr, "Page “to” must be a whole number ≥ 1", "رقم صفحة «إلى» لازم يكون عدد صحيح ≥ 1"));
      return;
    }
    if (pf != null && pt != null && pf > pt) {
      setError(tr(isAr, "Page “from” cannot be greater than “to”", "صفحة «من» مش ممكن تكون أكبر من «إلى»"));
      return;
    }

    setPhase("extracting");
    setError("");
    setProgressMsg(tr(isAr, "Uploading and analyzing the book…", "جاري رفع وتحليل الكتاب…"));

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("section", targetSection || "en-ar");
      if (pf != null) form.append("page_from", String(pf));
      if (pt != null) form.append("page_to", String(pt));

      const res = await fetch(AI_AGENT_PROXY_URL, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.entries)) {
        throw new Error(data.message || "Unexpected response");
      }

      // Merge rows with same word into one display item for review
      const byWord = new Map();
      for (const e of data.entries) {
        const w = String(e.word || "").trim();
        if (!w) continue;
        const k = w.toLowerCase();
        if (!byWord.has(k)) {
          byWord.set(k, {
            ...e,
            word: w,
            section: targetSection || e.section || "en-ar",
            alreadyExists: existing.has(k),
            _meanings: [],
          });
        }
        const row = byWord.get(k);
        const meaning = String(e.meaning || "").trim();
        if (meaning) row._meanings.push({ pos: e.pos || "", meaning });
        if (Array.isArray(e.senses)) {
          for (const s of e.senses) {
            if (s?.meaning) row._meanings.push({ pos: s.pos || e.pos || "", meaning: s.meaning });
          }
        }
      }
      const list = [...byWord.values()].map((e) => ({
        ...e,
        meaning: e._meanings.map((m) => m.meaning).filter(Boolean).join(" · ") || e.meaning,
      }));

      setExtracted(list);
      // pre-select all new words (key = word|pos so same word different POS are independent)
      const entryKey = (e) => {
        const w = String(e.word || "");
        const p = String(e.pos || "");
        return p ? `${w}|${p}` : w;
      };
      setSelected(new Set(list.filter((e) => !e.alreadyExists).map(entryKey)));
      setPhase("review");
      setProgressMsg("");
    } catch (err) {
      console.error(err);
      setError(err.message || tr(isAr, "Extraction failed", "فشل الاستخراج"));
      setPhase("upload");
      setProgressMsg("");
    }
  }

  function entryKey(e) {
    return String(e.word || "");
  }

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllNew() {
    setSelected(new Set(extracted.filter((e) => !e.alreadyExists).map(entryKey)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  // Search box: filter the review list by word/meaning so you don't have to
  // scroll and click cards one by one to find a specific word.
  const filteredExtracted = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    if (!q) return extracted;
    return extracted.filter(
      (e) =>
        String(e.word || "").toLowerCase().includes(q) ||
        String(e.meaning || "").toLowerCase().includes(q)
    );
  }, [extracted, reviewSearch]);

  // Group the (filtered) list by part-of-speech so whole groups — e.g. all
  // nouns, or everything matching a search — can be selected in one tap
  // instead of picking each word card individually.
  const reviewGroups = useMemo(() => {
    const map = new Map();
    for (const e of filteredExtracted) {
      const g = e.pos || tr(isAr, "Other", "أخرى");
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(e);
    }
    return [...map.entries()];
  }, [filteredExtracted, isAr]);

  function selectGroup(list) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of list) if (!e.alreadyExists) next.add(entryKey(e));
      return next;
    });
  }

  function clearGroup(list) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of list) next.delete(entryKey(e));
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of filteredExtracted) if (!e.alreadyExists) next.add(entryKey(e));
      return next;
    });
  }

  async function handleConfirm() {
    const toAdd = extracted.filter((e) => selected.has(entryKey(e)) && !e.alreadyExists);
    if (!toAdd.length) {
      showToast?.(tr(isAr, "No new words selected", "مفيش كلمات جديدة محددة"));
      return;
    }

    setPhase("saving");
    try {
      // Tag every entry with the chosen destination section
      const tagged = toAdd.map((e) => ({ ...e, section: targetSection }));
      await onAddEntries(tagged, isAcademic ? targetUnitId : null, targetSection);
      showToast?.(
        tr(
          isAr,
          `Added ${toAdd.length} word(s) successfully`,
          `تمت إضافة ${toAdd.length} كلمة بنجاح`
        )
      );
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || tr(isAr, "Failed to save", "فشل الحفظ"));
      setPhase("review");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <BodyScrollLock />
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--card-bg, #1a1a1a)",
          borderRadius: 20,
          border: "1px solid rgba(var(--border-rgb),0.15)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: "1px solid rgba(var(--border-rgb),0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookIcon size={20} />
            <div style={{ fontWeight: 800, fontSize: 16, color: INK }}>
              {tr(isAr, "AI Book Extractor", "استخراج كلمات من كتاب")}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "extracting" || phase === "saving"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              padding: 6,
            }}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          {/* UPLOAD PHASE */}
          {phase === "upload" && (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--muted-strong)", lineHeight: 1.5 }}>
                {tr(
                  isAr,
                  "Upload an English textbook PDF. The AI will extract key vocabulary, Arabic meanings, synonyms and antonyms that appear in the book.",
                  "ارفع ملف PDF لكتاب إنجليزي. الذكاء الاصطناعي هيستخرج الكلمات المهمة + معانيها بالعربي + المرادفات والمضادات الموجودة في الكتاب."
                )}
              </p>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "28px 16px",
                  borderRadius: 16,
                  border: "2px dashed rgba(var(--border-rgb),0.25)",
                  background: "var(--input-bg)",
                  cursor: "pointer",
                  marginBottom: 14,
                }}
              >
                <BookIcon size={28} />
                <span style={{ fontWeight: 700, fontSize: 14, color: INK, wordBreak: "break-all", textAlign: "center" }}>
                  {file ? file.name : tr(isAr, "Choose PDF file", "اختر ملف PDF")}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {file
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · PDF`
                    : tr(isAr, "Max 100 MB · PDF only", "الحد الأقصى 100 ميجا · PDF فقط")}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>

              <div style={{ marginBottom: 14 }} dir={isAr ? "rtl" : "ltr"}>
                <div style={{ fontWeight: 700, fontSize: 13, color: INK, marginBottom: 8 }}>
                  {tr(isAr, "Page range (optional)", "نطاق الصفحات (اختياري)")}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                  {tr(
                    isAr,
                    "For large books, extract one unit at a time (recommended ≤ 50 pages). Leave both empty to extract all pages.",
                    "للكتب الكبيرة استخرج وحدة وحدة (مستحسن ≤ 50 صفحة). سيّب الحقلين فاضيين لاستخراج كل الصفحات."
                  )}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", letterSpacing: "0.03em" }}>
                      {tr(isAr, "From page", "من صفحة")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="1"
                      value={pageFrom}
                      onChange={(e) => setPageFrom(e.target.value.replace(/[^\d]/g, ""))}
                      aria-label={tr(isAr, "From page", "من صفحة")}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(var(--border-rgb),0.2)",
                        background: "var(--input-bg)",
                        color: "var(--ink)",
                        fontSize: 14,
                        direction: "ltr",
                        textAlign: "center",
                      }}
                    />
                  </label>
                  <span
                    aria-hidden="true"
                    style={{
                      color: "var(--muted)",
                      fontWeight: 700,
                      paddingBottom: 10,
                      fontSize: 16,
                    }}
                  >
                    {isAr ? "←" : "→"}
                  </span>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-strong)", letterSpacing: "0.03em" }}>
                      {tr(isAr, "To page", "إلى صفحة")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="50"
                      value={pageTo}
                      onChange={(e) => setPageTo(e.target.value.replace(/[^\d]/g, ""))}
                      aria-label={tr(isAr, "To page", "إلى صفحة")}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(var(--border-rgb),0.2)",
                        background: "var(--input-bg)",
                        color: "var(--ink)",
                        fontSize: 14,
                        direction: "ltr",
                        textAlign: "center",
                      }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {tr(isAr, "Save words to dictionary", "حفظ الكلمات في القاموس")}
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { key: "en-ar", en: "English → Arabic", ar: "إنجليزي ← عربي" },
                    { key: "academic", en: "Baccalaureate Curriculum", ar: "منهج البكالوريا" },
                    { key: "ar-ar", en: "Arabic → Arabic", ar: "عربي ← عربي" },
                  ].map((opt) => {
                    const active = targetSection === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTargetSection(opt.key)}
                        style={{
                          flex: "1 1 120px",
                          padding: "10px 12px",
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: active ? "2px solid var(--accent-1)" : "1px solid rgba(var(--border-rgb),0.2)",
                          background: active ? "var(--accent-1-soft)" : "var(--input-bg)",
                          color: active ? "var(--accent-1)" : "var(--muted-strong)",
                        }}
                      >
                        {isAr ? opt.ar : opt.en}
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--icon-muted)", lineHeight: 1.4 }}>
                  {targetSection === "en-ar"
                    ? tr(isAr, "Words go into the general English → Arabic dictionary (not Academic units).", "الكلمات هتنزل في قاموس الإنجليزي ← عربي العام (مش وحدات الأكاديمي).")
                    : targetSection === "academic"
                      ? tr(isAr, "Words go into Academic — pick a unit below.", "الكلمات هتنزل في الأكاديمي — اختار الوحدة تحت.")
                      : tr(isAr, "Words go into the Arabic → Arabic dictionary.", "الكلمات هتنزل في قاموس عربي ← عربي.")}
                </p>
              </div>

              {isAcademic && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted-strong)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {tr(isAr, "Save words to unit", "حفظ الكلمات في وحدة")}
                  </label>
                  <select
                    value={targetUnitId || ""}
                    onChange={(e) => setTargetUnitId(e.target.value || null)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)",
                      color: "var(--ink)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {(academicUnits || []).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--icon-muted)" }}>
                    {tr(
                      isAr,
                      "Words go only into Academic → this unit.",
                      "الكلمات هتنزل بس في الأكاديميك ← الوحدة دي."
                    )}
                  </p>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(220,50,50,0.12)",
                    color: "#ff6b6b",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={startExtract}
                disabled={!file || (isAcademic && !targetUnitId)}
                style={{
                  ...primaryBtnStyle,
                  width: "100%",
                  opacity: !file || (isAcademic && !targetUnitId) ? 0.5 : 1,
                  cursor: !file || (isAcademic && !targetUnitId) ? "not-allowed" : "pointer",
                }}
              >
                {tr(isAr, "Extract Vocabulary", "استخراج المفردات")}
              </button>
            </>
          )}

          {/* EXTRACTING PHASE */}
          {phase === "extracting" && (
            <div style={{ textAlign: "center", padding: "36px 10px" }}>
              <LoaderIcon size={32} />
              <p style={{ marginTop: 16, fontWeight: 700, color: INK }}>{progressMsg}</p>
              <p style={{ marginTop: 6, marginBottom: 18, fontSize: 13, color: "var(--muted)" }}>
                {tr(isAr, "This may take up to 2–3 minutes for scanned books…", "ممكن ياخد لحد 2–3 دقايق لو الكتاب صور ممسوحة…")}
              </p>
              <div style={{ maxWidth: 320, margin: "0 auto", textAlign: "start" }}>
                <WaterProgressBar
                  progress={null}
                  label={tr(isAr, "Extracting vocabulary…", "جاري استخراج المفردات…")}
                  height={12}
                  showPercent={false}
                />
              </div>
            </div>
          )}

          {/* REVIEW PHASE */}
          {phase === "review" && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>
                  {tr(
                    isAr,
                    `Found ${extracted.length} words · ${selected.size} selected`,
                    `تم العثور على ${extracted.length} كلمة · ${selected.size} محددة`
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={selectAllNew}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--input-bg)",
                      color: "var(--muted-strong)",
                      cursor: "pointer",
                    }}
                  >
                    {tr(isAr, "Select all", "تحديد الكل")}
                  </button>
                  <button
                    onClick={deselectAll}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--input-bg)",
                      color: "var(--muted-strong)",
                      cursor: "pointer",
                    }}
                  >
                    {tr(isAr, "Clear", "مسح")}
                  </button>
                </div>
              </div>

              {/* Search box — jump straight to a word instead of scrolling
                  through every card to find it. */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <SearchIcon
                  size={15}
                  style={{
                    position: "absolute",
                    insetInlineStart: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder={tr(isAr, "Search a word…", "دور على كلمة…")}
                  style={{
                    ...inputStyle,
                    margin: 0,
                    width: "100%",
                    boxSizing: "border-box",
                    paddingInlineStart: 36,
                  }}
                />
              </div>

              {reviewSearch.trim() && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {tr(isAr, `${filteredExtracted.length} match`, `${filteredExtracted.length} نتيجة`)}
                  </span>
                  <button
                    onClick={selectAllFiltered}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(var(--border-rgb),0.2)",
                      background: "var(--input-bg)",
                      color: "var(--accent-1, var(--muted-strong))",
                      cursor: "pointer",
                    }}
                  >
                    {tr(isAr, "Select these", "حدد دول")}
                  </button>
                </div>
              )}

              <div
                style={{
                  maxHeight: 340,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                {reviewGroups.length === 0 && (
                  <div style={{ padding: 14, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
                    {tr(isAr, "No matching words", "مفيش كلمات مطابقة")}
                  </div>
                )}
                {reviewGroups.map(([group, list]) => {
                  const selectableCount = list.filter((e) => !e.alreadyExists).length;
                  const selectedCount = list.filter((e) => selected.has(entryKey(e))).length;
                  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
                  return (
                    <div key={group}>
                      {/* Group header: one tap selects/clears every word of this
                          part-of-speech (or every word left after a search) —
                          the "select whole section" shortcut. */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                          padding: "0 2px",
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {group} · {list.length}
                        </span>
                        <button
                          onClick={() => (allSelected ? clearGroup(list) : selectGroup(list))}
                          disabled={selectableCount === 0}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 9px",
                            borderRadius: 7,
                            border: "none",
                            background: "transparent",
                            color: selectableCount === 0 ? "var(--muted)" : "var(--accent-1, var(--muted-strong))",
                            cursor: selectableCount === 0 ? "default" : "pointer",
                            opacity: selectableCount === 0 ? 0.5 : 1,
                          }}
                        >
                          {allSelected
                            ? tr(isAr, "Clear group", "إلغاء القسم")
                            : tr(isAr, `Select all (${selectableCount})`, `تحديد الكل (${selectableCount})`)}
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {list.map((e) => {
                          const key = entryKey(e);
                          const isSelected = selected.has(key);
                          const isDup = e.alreadyExists;
                          return (
                            <label
                              key={e.id || key}
                              style={{
                                display: "flex",
                                gap: 12,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: isDup
                                  ? "rgba(120,120,120,0.08)"
                                  : isSelected
                                  ? "rgba(var(--accent-rgb, 100,180,255),0.12)"
                                  : "var(--input-bg)",
                                border: `1px solid ${
                                  isSelected ? "rgba(var(--accent-rgb, 100,180,255),0.35)" : "rgba(var(--border-rgb),0.1)"
                                }`,
                                cursor: isDup ? "default" : "pointer",
                                opacity: isDup ? 0.55 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDup}
                                onChange={() => !isDup && toggle(key)}
                                style={{ marginTop: 3, width: 16, height: 16 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: INK }}>{e.word}</span>
                                  {e.pos && (
                                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                                      {e.pos}
                                    </span>
                                  )}
                                  {isDup && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--muted)",
                                        background: "rgba(120,120,120,0.15)",
                                        padding: "2px 7px",
                                        borderRadius: 6,
                                      }}
                                    >
                                      {tr(isAr, "Already exists", "موجودة")}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    marginTop: 3,
                                    fontSize: 14,
                                    color: "var(--meaning, var(--muted-strong))",
                                    direction: "rtl",
                                    fontFamily: "'Amiri', serif",
                                  }}
                                >
                                  {e.meaning}
                                </div>
                                {(e.synonyms?.length > 0 || e.antonyms?.length > 0) && (
                                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                                    {e.synonyms?.length > 0 && (
                                      <span>
                                        ≈ {Array.isArray(e.synonyms) ? e.synonyms.join(", ") : ""}
                                      </span>
                                    )}
                                    {e.synonyms?.length > 0 && e.antonyms?.length > 0 && " · "}
                                    {e.antonyms?.length > 0 && (
                                      <span>
                                        ≠ {Array.isArray(e.antonyms) ? e.antonyms.join(", ") : ""}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(220,50,50,0.12)",
                    color: "#ff6b6b",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setPhase("upload");
                    setExtracted([]);
                    setSelected(new Set());
                    setFile(null);
                    setReviewSearch("");
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--icon-muted)",
                    background: "var(--input-bg)",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  {tr(isAr, "Back", "رجوع")}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  style={{
                    ...primaryBtnStyle,
                    flex: 1.4,
                    marginTop: 0,
                    opacity: selected.size ? 1 : 0.5,
                  }}
                >
                  <CheckIcon size={16} />{" "}
                  {tr(isAr, `Add ${selected.size} words`, `إضافة ${selected.size} كلمة`)}
                </button>
              </div>
            </>
          )}

          {/* SAVING PHASE */}
          {phase === "saving" && (
            <div style={{ textAlign: "center", padding: "40px 10px" }}>
              <LoaderIcon size={32} />
              <p style={{ marginTop: 16, fontWeight: 700, color: INK }}>
                {tr(isAr, "Saving words…", "جاري حفظ الكلمات…")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
