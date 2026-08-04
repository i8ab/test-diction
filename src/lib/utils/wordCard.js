// Cambridge Dictionary link lookup + shareable word-card image generation
// (renders a word onto an offscreen canvas so it can be shared as a PNG).

// Builds the Cambridge Dictionary lookup URL for a given English word.
// Renders a shareable PNG image of a single word — word + meaning, plus
// whichever of definition/example(s)/synonyms/antonyms the entry actually
// has — onto an offscreen canvas, styled to loosely match the app's
// paper/ink palette so it reads well when shared outside the app. The
// canvas height grows with how much extra content there is, so a plain
// word+meaning card stays compact instead of leaving empty space.
// Returns a Blob (image/png) via a Promise.
function generateWordCardImage(entry, cfg) {
  const width = 1080;

  // Pull whatever extra content this entry has. synonyms/antonyms are
  // {word, meaning} pairs (see pairUtils.normalizePairs) — show the word
  // side, in whichever language it was entered (Arabic or English both
  // render fine since we just draw the raw string).
  const examples = entry.examples && entry.examples.length ? entry.examples : (entry.example ? [entry.example] : []);
  const synonyms = (entry.synonyms || []).map((p) => p.word).filter(Boolean);
  const antonyms = (entry.antonyms || []).map((p) => p.word).filter(Boolean);

  // First pass on a throwaway canvas just to measure wrapped line counts,
  // so we can size the real canvas to fit everything without cropping.
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";

  mctx.font = "700 96px 'Fraunces', 'Amiri', serif";
  const wordLines = wrapLineCount(mctx, entry.word || "", width - 200);
  mctx.font = "600 56px 'Amiri', 'Fraunces', serif";
  const meaningLines = wrapLineCount(mctx, entry.meaning || "", width - 220);
  mctx.font = "italic 400 34px 'Fraunces', 'Amiri', serif";
  const exampleLineCounts = examples.slice(0, 2).map((ex) => wrapLineCount(mctx, ex, width - 260));
  mctx.font = "600 34px 'Source Sans 3', sans-serif";
  const synText = synonyms.length ? synonyms.slice(0, 6).join("، ") : "";
  const antText = antonyms.length ? antonyms.slice(0, 6).join("، ") : "";
  const synLines = synText ? wrapLineCount(mctx, synText, width - 260) : 0;
  const antLines = antText ? wrapLineCount(mctx, antText, width - 260) : 0;

  const wordBlockH = Math.max(280, 150 + wordLines * 104);
  let y = 60 + wordBlockH; // running cursor while laying out the real canvas
  const EXAMPLE_LH = 44, PAIR_LH = 44, SECTION_GAP = 34;

  let height = y + 90 + meaningLines * 66 + 40; // word block + meaning block
  if (exampleLineCounts.length) height += SECTION_GAP + 36 + exampleLineCounts.reduce((s, n) => s + n * EXAMPLE_LH + 14, 0);
  if (synText) height += SECTION_GAP + 36 + synLines * PAIR_LH;
  if (antText) height += SECTION_GAP + 36 + antLines * PAIR_LH;
  height += 120; // footer margin
  height = Math.max(height, 900);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FBF7EF";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = cfg.accent || "#146C94";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  ctx.textAlign = "center";
  ctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";

  // Word
  ctx.fillStyle = "#1B1B1B";
  ctx.font = "700 96px 'Fraunces', 'Amiri', serif";
  const wordCenterY = 60 + wordBlockH / 2;
  wrapCanvasText(ctx, entry.word || "", width / 2, wordCenterY, width - 200, 104);

  // Divider
  const dividerY = 60 + wordBlockH + 30;
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.fillRect(width / 2 - 60, dividerY, 120, 6);

  // Meaning
  let cursorY = dividerY + 90;
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.font = "600 56px 'Amiri', 'Fraunces', serif";
  wrapCanvasText(ctx, entry.meaning || "", width / 2, cursorY, width - 220, 66);
  cursorY += meaningLines * 66 + 20;

  // Examples (each drawn in the word's own script/direction, italic)
  if (exampleLineCounts.length) {
    cursorY += SECTION_GAP;
    ctx.direction = "ltr";
    ctx.fillStyle = "#8A8374";
    ctx.font = "700 26px 'Source Sans 3', sans-serif";
    ctx.fillText((cfg.dir === "rtl" ? "أمثلة" : "EXAMPLES"), width / 2, cursorY);
    cursorY += 36;
    ctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";
    ctx.fillStyle = "#4A4638";
    ctx.font = "italic 400 34px 'Fraunces', 'Amiri', serif";
    examples.slice(0, 2).forEach((ex, i) => {
      wrapCanvasText(ctx, `“${ex}”`, width / 2, cursorY + (exampleLineCounts[i] * EXAMPLE_LH) / 2, width - 260, EXAMPLE_LH);
      cursorY += exampleLineCounts[i] * EXAMPLE_LH + 14;
    });
  }

  // Synonyms
  if (synText) {
    cursorY += SECTION_GAP;
    ctx.direction = "ltr";
    ctx.fillStyle = "var(--success)" === "" ? "#2E7D32" : "#2E7D32";
    ctx.font = "700 26px 'Source Sans 3', sans-serif";
    ctx.fillText((cfg.dir === "rtl" ? "مرادفات" : "SYNONYMS"), width / 2, cursorY);
    cursorY += 36;
    ctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";
    ctx.fillStyle = "#2E7D32";
    ctx.font = "600 34px 'Source Sans 3', sans-serif";
    wrapCanvasText(ctx, synText, width / 2, cursorY + (synLines * PAIR_LH) / 2, width - 260, PAIR_LH);
    cursorY += synLines * PAIR_LH;
  }

  // Antonyms
  if (antText) {
    cursorY += SECTION_GAP;
    ctx.direction = "ltr";
    ctx.fillStyle = "#B3261E";
    ctx.font = "700 26px 'Source Sans 3', sans-serif";
    ctx.fillText((cfg.dir === "rtl" ? "مضادات" : "ANTONYMS"), width / 2, cursorY);
    cursorY += 36;
    ctx.direction = cfg.wordDir === "rtl" ? "rtl" : "ltr";
    ctx.fillStyle = "#B3261E";
    ctx.font = "600 34px 'Source Sans 3', sans-serif";
    wrapCanvasText(ctx, antText, width / 2, cursorY + (antLines * PAIR_LH) / 2, width - 260, PAIR_LH);
    cursorY += antLines * PAIR_LH;
  }

  // Footer brand
  ctx.direction = "ltr";
  ctx.fillStyle = "#8A8374";
  ctx.font = "600 30px 'Source Sans 3', sans-serif";
  ctx.fillText("Two Tongues", width / 2, height - 60);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

// Counts how many lines `text` would wrap to at `maxWidth` under ctx's
// currently-set font, without drawing anything (measurement pass only).
function wrapLineCount(ctx, text, maxWidth) {
  if (!text) return 0;
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return Math.max(lines, 1);
}

// Minimal manual word-wrap for canvas text (canvas has no built-in wrapping).
function wrapCanvasText(ctx, text, cx, startY, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  let y = startY;
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // Vertically center the block of lines around startY.
  const totalHeight = lines.length * lineHeight;
  y = startY - totalHeight / 2 + lineHeight / 2;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineHeight;
  }
}

// Shares (via Web Share API, when supported for files) or downloads the
// generated word-card image. Falls back to a plain download whenever
// navigator.share/canShare for files isn't available (most desktop browsers).
async function shareWordCard(entry, cfg) {
  const blob = await generateWordCardImage(entry, cfg);
  if (!blob) return false;
  const fileName = `${(entry.word || "word").replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: entry.word });
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false; // user cancelled the share sheet
      // fall through to download on any other failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

function cambridgeUrl(word) {
  const slug = (word || "").trim().toLowerCase().replace(/\s+/g, "-");
  return `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(slug)}`;
}

export { cambridgeUrl, generateWordCardImage, wrapCanvasText, shareWordCard };
