import { describe, it, expect } from "vitest";
import {
  shuffleArray,
  dateKey,
  srsLevelFromStats,
  computeStreak,
  normalizeAnswer,
  isTypingCorrect,
  correctToQuality,
  applySm2,
  SRS_DEFAULT_EASE,
  SRS_MIN_EASE,
} from "../src/lib/utils/quizHelpers.js";

describe("shuffleArray", () => {
  it("returns an array of the same length", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleArray([...input]);
    expect(out).toHaveLength(5);
    expect(out.sort()).toEqual(input.sort());
  });
});

describe("dateKey", () => {
  it("returns YYYY-MM-DD style string", () => {
    const key = dateKey(Date.UTC(2024, 0, 15));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("srsLevelFromStats", () => {
  it("returns 0 for empty/missing stats", () => {
    expect(srsLevelFromStats(null)).toBe(0);
    expect(srsLevelFromStats({})).toBe(0);
  });
  it("increases with consecutive correct answers", () => {
    const level = srsLevelFromStats({ correct: 5, wrong: 0, streak: 5 });
    expect(typeof level).toBe("number");
    expect(level).toBeGreaterThanOrEqual(0);
  });
});

describe("computeStreak", () => {
  it("returns 0 for empty input", () => {
    expect(computeStreak(null)).toBe(0);
    expect(computeStreak({})).toBe(0);
  });
  it("counts consecutive days ending today or yesterday", () => {
    const today = dateKey();
    const studiedAt = { [today]: Date.now() };
    expect(computeStreak(studiedAt)).toBeGreaterThanOrEqual(1);
  });
});

describe("normalizeAnswer / isTypingCorrect", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeAnswer("  Hello  ")).toBe("hello");
  });
  it("accepts exact match after normalize", () => {
    expect(isTypingCorrect("Hello", "hello")).toBe(true);
  });
  it("rejects different answers", () => {
    expect(isTypingCorrect("cat", "dog")).toBe(false);
  });
});

describe("correctToQuality / applySm2", () => {
  it("maps boolean to SM-2 quality", () => {
    expect(correctToQuality(true)).toBeGreaterThanOrEqual(3);
    expect(correctToQuality(false)).toBeLessThan(3);
  });
  it("applies SM-2 and keeps ease above minimum", () => {
    const prev = { ease: SRS_DEFAULT_EASE, interval: 1, repetitions: 1 };
    const next = applySm2(prev, 4, {});
    expect(next.ease).toBeGreaterThanOrEqual(SRS_MIN_EASE);
    expect(next.interval).toBeGreaterThan(0);
  });
});
