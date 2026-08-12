import { useState, useEffect, useCallback } from "react";
import {
  loadSearchHistory,
  addToSearchHistory,
  removeFromSearchHistory,
  clearSearchHistory,
} from "../state/storage";

/**
 * Search box UX: suggestions index, history, keyboard navigation.
 */
export function useEntrySearch({ section, query, setQuery, suggestions }) {
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

  const selectSuggestion = useCallback(
    (entry) => {
      setQuery(entry.word);
      setShowSuggestions(false);
      setShowHistory(false);
      setActiveIndex(-1);
      commitSearchTerm(entry.word);
    },
    [setQuery, commitSearchTerm]
  );

  const selectHistoryTerm = useCallback(
    (term) => {
      setQuery(term);
      setShowHistory(false);
      setShowSuggestions(false);
      commitSearchTerm(term);
    },
    [setQuery, commitSearchTerm]
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
      if (!showSuggestions || !suggestions || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
        } else if (String(query || "").trim()) {
          commitSearchTerm(query);
          setShowSuggestions(false);
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    },
    [
      showHistory,
      showSuggestions,
      suggestions,
      activeIndex,
      query,
      selectSuggestion,
      commitSearchTerm,
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
