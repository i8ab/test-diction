// Free English dictionary lookup (dictionaryapi.dev).

export class DictionaryLookupError extends Error {
  constructor(message) {
    super(message);
    this.name = "DictionaryLookupError";
  }
}

/**
 * Auto-fill payload: definitions + example sentences only.
 * Returns { definition, example, examples: string[] }
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

  const definitions = [];
  const examples = [];

  for (const entry of data) {
    for (const m of entry.meanings || []) {
      for (const d of m.definitions || []) {
        if (d.definition && definitions.length < 5) {
          const def = String(d.definition).trim();
          if (def && !definitions.includes(def)) definitions.push(def);
        }
        if (d.example) {
          const ex = String(d.example).trim();
          if (ex && !examples.includes(ex) && examples.length < 6) examples.push(ex);
        }
      }
    }
  }

  return {
    definition: definitions[0] || "",
    // Join extra senses into the definition field when useful
    definitions,
    example: examples[0] || "",
    examples,
  };
}
