// Free English dictionary lookup (dictionaryapi.dev).

export class DictionaryLookupError extends Error {
  constructor(message) {
    super(message);
    this.name = "DictionaryLookupError";
  }
}

/**
 * Returns { definition, example, synonyms: string[] }
 */
export async function fetchDictionarySuggestion(word) {
  const q = String(word || "").trim();
  if (!q) throw new DictionaryLookupError("empty");
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`;
  let res;
  try {
    res = await fetch(url);
  } catch (_) {
    throw new DictionaryLookupError("network");
  }
  if (res.status === 404) throw new DictionaryLookupError("not_found");
  if (!res.ok) throw new DictionaryLookupError("http");
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new DictionaryLookupError("not_found");

  let definition = "";
  let example = "";
  const synonyms = new Set();

  for (const entry of data) {
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        if (!definition && d.definition) definition = d.definition;
        if (!example && d.example) example = d.example;
        (d.synonyms || []).forEach((s) => synonyms.add(s));
      }
      (m.synonyms || []).forEach((s) => synonyms.add(s));
    }
  }

  return {
    definition,
    example,
    synonyms: Array.from(synonyms).slice(0, 12),
  };
}
