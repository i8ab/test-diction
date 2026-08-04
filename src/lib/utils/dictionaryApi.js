// Auto-suggest a definition/example/synonyms for an English word from the
// free, keyless dictionaryapi.dev service, so someone adding a word to the
// EN -> AR section doesn't always have to type the definition by hand.
// Only useful for the English word side — there's no equivalent free API
// for Arabic-Arabic definitions, so callers should only offer this button
// when cfg.wordDir === "ltr".

const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";

class DictionaryLookupError extends Error {}

// Returns { definition, example, synonyms } built from the first entry/
// meaning/definition the API has for that word. Any of the three fields
// may come back empty if the API just doesn't have that info. Throws
// DictionaryLookupError with a friendly message on "not found" or network
// failure, so callers can show it directly as a toast.
async function fetchDictionarySuggestion(word) {
  const clean = (word || "").trim();
  if (!clean) throw new DictionaryLookupError("Type a word first.");

  let res;
  try {
    res = await fetch(DICTIONARY_API_BASE + encodeURIComponent(clean));
  } catch (e) {
    throw new DictionaryLookupError("network");
  }

  if (res.status === 404) throw new DictionaryLookupError("not_found");
  if (!res.ok) throw new DictionaryLookupError("network");

  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry) throw new DictionaryLookupError("not_found");

  let definition = "";
  let example = "";
  const synonyms = [];

  for (const meaning of entry.meanings || []) {
    if (Array.isArray(meaning.synonyms)) {
      for (const s of meaning.synonyms) if (!synonyms.includes(s)) synonyms.push(s);
    }
    for (const def of meaning.definitions || []) {
      if (!definition && def.definition) definition = def.definition;
      if (!example && def.example) example = def.example;
      if (Array.isArray(def.synonyms)) {
        for (const s of def.synonyms) if (!synonyms.includes(s)) synonyms.push(s);
      }
      if (definition && example) break;
    }
    if (definition && example) break;
  }

  return { definition, example, synonyms: synonyms.slice(0, 5) };
}

export { fetchDictionarySuggestion, DictionaryLookupError };
