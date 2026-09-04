/**
 * Post-build step: Vite injects the built CSS as a plain
 *   <link rel="stylesheet" href="/assets/index-XXXX.css">
 * which blocks first paint until the CSS finishes downloading.
 *
 * The app already inlines all FOUC-critical styles (theme colors, fonts,
 * loading shell) directly in index.html's <head>, so the external
 * stylesheet only needs to be applied before the React app itself paints
 * its first real content — not before the browser's first paint.
 *
 * This script rewrites every such <link> in dist/index.html to the
 * standard "preload as style, swap rel on load" pattern, with a
 * <noscript> fallback for the no-JS case. Runs automatically after
 * `vite build` (see package.json "build" script).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "..", "dist", "index.html");

const STYLESHEET_RE =
  /<link rel="stylesheet"([^>]*?)\shref="([^"]+\.css)"([^>]*)>/g;

let html = readFileSync(htmlPath, "utf8");
let count = 0;

html = html.replace(STYLESHEET_RE, (match, before, href, after) => {
  count += 1;
  const attrs = `${before}${after}`.trim();
  const extra = attrs ? ` ${attrs}` : "";
  return (
    `<link rel="preload" as="style" href="${href}"${extra} ` +
    `onload="this.onload=null;this.rel='stylesheet'">` +
    `<noscript><link rel="stylesheet" href="${href}"${extra}></noscript>`
  );
});

if (count === 0) {
  console.warn("[asyncify-css] No <link rel=\"stylesheet\"> tags found in dist/index.html — nothing to do.");
} else {
  writeFileSync(htmlPath, html);
  console.log(`[asyncify-css] Made ${count} stylesheet link(s) non-render-blocking in dist/index.html`);
}
