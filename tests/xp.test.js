import { describe, it, expect, beforeEach } from "vitest";
import {
  levelFromXp,
  LEVELS,
  XP_REWARDS,
  listUnlockedBadges,
} from "../src/lib/state/xp.js";

describe("LEVELS / XP_REWARDS constants", () => {
  it("has ordered levels starting at 1", () => {
    expect(LEVELS.length).toBeGreaterThan(5);
    expect(LEVELS[0].level).toBe(1);
    expect(LEVELS[0].xp).toBe(0);
  });
  it("defines positive reward amounts", () => {
    expect(XP_REWARDS.studyWordFirst).toBeGreaterThan(0);
    expect(XP_REWARDS.quizPerfect).toBeGreaterThan(0);
  });
});

describe("levelFromXp", () => {
  it("returns level 1 for 0 XP", () => {
    const info = levelFromXp(0);
    expect(info.level).toBe(1);
    expect(info.total).toBe(0);
  });
  it("advances when XP crosses thresholds", () => {
    const high = LEVELS[Math.min(5, LEVELS.length - 1)];
    const info = levelFromXp(high.xp);
    expect(info.level).toBeGreaterThanOrEqual(high.level);
  });
  it("reports pct between 0 and 100", () => {
    const info = levelFromXp(10);
    expect(info.pct).toBeGreaterThanOrEqual(0);
    expect(info.pct).toBeLessThanOrEqual(100);
  });
});

describe("listUnlockedBadges", () => {
  it("returns an array", () => {
    expect(Array.isArray(listUnlockedBadges(0))).toBe(true);
  });
  it("unlocks more badges at higher XP", () => {
    const low = listUnlockedBadges(0);
    const highXp = LEVELS[LEVELS.length - 1]?.xp ?? 10000;
    const high = listUnlockedBadges(highXp);
    expect(high.length).toBeGreaterThanOrEqual(low.length);
  });
});
