import { useState, useEffect, useCallback } from "react";
import {
  loadSearchHistory,
  addToSearchHistory,
  removeFromSearchHistory,
  clearSearchHistory,
} from "../state/storage";

/**
 * Search box UX: suggestions index, history, keyboard navigation.
 * Optional onSelectEntry(entry) is called after a suggestion is chosen
 * (e.g. to open zoom / scroll to the word).
 */
export function useEntrySearch({ section, query, setQuery, suggestions, onSelectEntry, inputRef, findBestMatch }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory(section));

  useEffect(() => {
    setSearchHistory(loadSearchHistory(section));
  }, [section]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const commitSearchTerm = useCallback(
    (term) => {
      if (!String(term || "").trim()) return;
      setSearchHistory(addToSearchHistory(section, term));
    },
    [section]
  );

  // Dismiss the on-screen keyboard once a search is committed, so it stops
  // covering the results/suggestions on mobile. Never touches the query
  // text itself — the typed word stays visible in the box.
  const dismissKeyboard = useCallback(() => {
    try {
      inputRef?.current?.blur?.();
    } catch (_) {}
  }, [inputRef]);

  const selectSuggestion = useCallback(
    (entry) => {
      // Picking a suggestion jumps straight to that word (zoom card), so
      // there's nothing left to filter on — clear the box instead of
      // leaving the word sitting in it.
      setQuery("");
      setShowSuggestions(false);
      setShowHistory(false);
      setActiveIndex(-1);
      commitSearchTerm(entry.word);
      dismissKeyboard();
      if (typeof onSelectEntry === "function" && entry) {
        // Defer so the query filter can settle; parent can open zoom / scroll
        requestAnimationFrame(() => onSelectEntry(entry));
      }
    },
    [setQuery, commitSearchTerm, onSelectEntry, dismissKeyboard]
  );

  // Actually run a search for a typed/recalled term: jump straight to the
  // best-matching word (same as picking a suggestion) when one exists,
  // otherwise just leave the list filtered on that term. Used both by
  // pressing Enter (even with the suggestions dropdown closed) and by
  // picking a term from history — neither of those did an actual search
  // before, they only filled the box.
  const submitSearch = useCallback(
    (term) => {
      const t = String(term || "").trim();
      if (!t) return;
      commitSearchTerm(t);
      setShowSuggestions(false);
      setShowHistory(false);
      setActiveIndex(-1);
      dismissKeyboard();
      const match = typeof findBestMatch === "function" ? findBestMatch(t) : null;
      if (match && typeof onSelectEntry === "function") {
        setQuery("");
        requestAnimationFrame(() => onSelectEntry(match));
      } else {
        setQuery(t);
      }
    },
    [commitSearchTerm, dismissKeyboard, findBestMatch, onSelectEntry, setQuery]
  );

  const selectHistoryTerm = useCallback(
    (term) => {
      submitSearch(term);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitSearch]
  );

  const handleRemoveHistoryTerm = useCallback(
    (e, term) => {
      e.preventDefault();
      e.stopPropagation();
      setSearchHistory(removeFromSearchHistory(section, term));
    },
    [section]
  );

  const handleClearHistory = useCallback(() => {
    setSearchHistory(clearSearchHistory(section));
  }, [section]);

  const handleSearchKeyDown = useCallback(
    (e) => {
      if (showHistory && !showSuggestions) {
        if (e.key === "Escape") setShowHistory(false);
        return;
      }
      if (showSuggestions && suggestions && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            selectSuggestion(suggestions[activeIndex]);
          } else {
            submitSearch(query);
          }
          return;
        }
        if (e.key === "Escape") {
          setShowSuggestions(false);
          setActiveIndex(-1);
          return;
        }
      }
      // No suggestions dropdown open (or nothing in it) — Enter should
      // still run the search instead of doing nothing.
      if (e.key === "Enter" && String(query || "").trim()) {
        e.preventDefault();
        submitSearch(query);
      }
    },
    [
      showHistory,
      showSuggestions,
      suggestions,
      activeIndex,
      query,
      selectSuggestion,
      submitSearch,
    ]
  );

  return {
    showSuggestions,
    setShowSuggestions,
    activeIndex,
    setActiveIndex,
    showHistory,
    setShowHistory,
    searchHistory,
    commitSearchTerm,
    selectSuggestion,
    selectHistoryTerm,
    handleRemoveHistoryTerm,
    handleClearHistory,
    handleSearchKeyDown,
  };
}
