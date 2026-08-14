import { useState, useEffect } from "react";
import { tr } from "../../lib/config/i18n";
import { INK, primaryBtnStyle, inputStyle } from "../../lib/config/theme";
import { XIcon, CheckIcon, LoaderIcon, BookIcon } from "../common/Icons";
import { BodyScrollLock } from "../../lib/utils/useBodyScrollLock";

const AI_AGENT_URL = "https://web-production-40a8e.up.railway.app";
const AI_API_SECRET = "bacaloria-secret-2026";

/**
 * Upload a PDF textbook → AI Agent extracts vocabulary → admin picks words to add.
 */
export default function AiPdfExtractModal({
  section = "en-ar",
  entries = [],
  isAr,
  onClose,
  onAddEntries, // async (entries[]) => void
  showToast,
}) {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("upload"); // upload | extracting | review | saving
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [progressMsg, setProgressMsg] = useState("");

  // existing words in this section (to mark already-present ones)
  const existing = new Set(
    (entries || [])
      .filter((e) => e.section === section)
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
    if (f.size > 25 * 1024 * 1024) {
      setError(tr(isAr, "File is too large (max 25 MB)", "الملف كبير أوي (الحد 25 ميجا)"));
      return;
    }
    setFile(f);
    setError("");
  }

  async function startExtract() {
    if (!file) return;
    setPhase("extracting");
    setError("");
    setProgressMsg(tr(isAr, "Uploading and analyzing the book…", "جاري رفع وتحليل الكتاب…"));

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${AI_AGENT_URL}/extract-pdf`, {
        method: "POST",
        headers: {
          "X-API-Secret": AI_API_SECRET,
        },
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

      const list = data.entries.map((e) => ({
        ...e,
        section: e.section || section,
        alreadyExists: existing.has(String(e.word || "").toLowerCase()),
      }));

      setExtracted(list);
      // pre-select all new words
      setSelected(new Set(list.filter((e) => !e.alreadyExists).map((e) => e.word)));
      setPhase("review");
      setProgressMsg("");
    } catch (err) {
      console.error(err);
      setError(err.message || tr(isAr, "Extraction failed", "فشل الاستخراج"));
      setPhase("upload");
      setProgressMsg("");
    }
  }

  function toggle(word) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }

  function selectAllNew() {
    setSelected(new Set(extracted.filter((e) => !e.alreadyExists).map((e) => e.word)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleConfirm() {
    const toAdd = extracted.filter((e) => selected.has(e.word) && !e.alreadyExists);
    if (!toAdd.length) {
      showToast?.(tr(isAr, "No new words selected", "مفيش كلمات جديدة محددة"));
      return;
    }

    setPhase("saving");
    try {
      await onAddEntries(toAdd);
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
                <span style={{ fontWeight: 700, fontSize: 14, color: INK }}>
                  {file ? file.name : tr(isAr, "Choose PDF file", "اختر ملف PDF")}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {tr(isAr, "Max 25 MB", "الحد الأقصى 25 ميجا")}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>

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
                disabled={!file}
                style={{
                  ...primaryBtnStyle,
                  width: "100%",
                  opacity: file ? 1 : 0.5,
                  cursor: file ? "pointer" : "not-allowed",
                }}
              >
                {tr(isAr, "Extract Vocabulary", "استخراج المفردات")}
              </button>
            </>
          )}

          {/* EXTRACTING PHASE */}
          {phase === "extracting" && (
            <div style={{ textAlign: "center", padding: "40px 10px" }}>
              <LoaderIcon size={32} />
              <p style={{ marginTop: 16, fontWeight: 700, color: INK }}>{progressMsg}</p>
              <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                {tr(isAr, "This may take 20–60 seconds…", "ممكن ياخد من 20 لـ 60 ثانية…")}
              </p>
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
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>
                  {tr(isAr, `Found ${extracted.length} words`, `تم العثور على ${extracted.length} كلمة`)}
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
                    {tr(isAr, "Select new", "تحديد الجديد")}
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

              <div
                style={{
                  maxHeight: 340,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {extracted.map((e) => {
                  const isSelected = selected.has(e.word);
                  const isDup = e.alreadyExists;
                  return (
                    <label
                      key={e.id || e.word}
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
                        onChange={() => !isDup && toggle(e.word)}
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
