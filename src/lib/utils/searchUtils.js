// Fuzzy word search, direction/font detection, and A-Z / alef-ya letter-key
// helpers used by the search box and the letter index.

const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const AR_LETTERS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");

function firstLetterKey(word, section) {
  if (!word) return "#";
  const w = word.trim();
  if (section === "en-ar") {
    const c = w[0].toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  } else {
    const c = w[0];
    return AR_LETTERS.includes(c) ? c : "#";
  }
}

// Classic edit-distance calculation — used to tolerate small typos in search.
function levenshtein(a, b) {
  a = a || ""; b = b || "";
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// How many typos we tolerate scales with the query length — short queries
// need to stay strict or everything would match.
function typoBudget(len) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

// True if `needle` appears in `haystack` as a substring, OR is a close-enough
// typo of any whitespace-separated word inside it.
function fuzzyIncludes(haystack, needle) {
  const h = (haystack || "").toLowerCase();
  const n = (needle || "").trim().toLowerCase();
  if (!n) return false;
  if (h.includes(n)) return true;
  const budget = typoBudget(n.length);
  if (budget === 0) return false;
  return h.split(/\s+/).some((tok) => Math.abs(tok.length - n.length) <= budget && levenshtein(tok, n) <= budget);
}

// Scores how well a single word matches the query, for ranking autocomplete
// suggestions (lower is better; null means "not a match").
function matchScore(word, needle) {
  const w = (word || "").toLowerCase();
  const n = (needle || "").trim().toLowerCase();
  if (!n) return null;
  if (w.startsWith(n)) return 0;
  if (w.includes(n)) return 1;
  const budget = typoBudget(n.length);
  if (budget === 0) return null;
  const dist = levenshtein(w, n);
  return dist <= budget ? 2 + dist : null;
}

function detectDir(text) {
  return /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}
function detectFont(text) {
  return /[\u0600-\u06FF]/.test(text) ? "'Amiri', serif" : "'Source Sans 3', sans-serif";
}

export {
  EN_LETTERS, AR_LETTERS, firstLetterKey,
  levenshtein, typoBudget, fuzzyIncludes, matchScore,
  detectDir, detectFont,
};
