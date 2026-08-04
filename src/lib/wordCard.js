// Cambridge Dictionary link lookup + shareable word-card image generation
// (renders a word onto an offscreen canvas so it can be shared as a PNG).

// Builds the Cambridge Dictionary lookup URL for a given English word.
// Renders a shareable PNG image of a single word (word + meaning + optional
// definition/example) onto an offscreen canvas, styled to loosely match the
// app's paper/ink palette so it reads well when shared outside the app.
// Returns a Blob (image/png) via a Promise.
function generateWordCardImage(entry, cfg) {
  const width = 1080, height = 1080;
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
  wrapCanvasText(ctx, entry.word || "", width / 2, 420, width - 200, 104);

  // Divider
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.fillRect(width / 2 - 60, 470, 120, 6);

  // Meaning
  ctx.fillStyle = cfg.accent || "#146C94";
  ctx.font = "600 56px 'Amiri', 'Fraunces', serif";
  wrapCanvasText(ctx, entry.meaning || "", width / 2, 580, width - 220, 66);

  // Footer brand
  ctx.fillStyle = "#8A8374";
  ctx.font = "600 30px 'Source Sans 3', sans-serif";
  ctx.direction = "ltr";
  ctx.fillText("Two Tongues", width / 2, height - 60);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
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
