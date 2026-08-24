import { describe, it, expect } from "vitest";
import {
  normalizeUsername,
  validateUsername,
  validatePassword,
  migrateAccounts,
} from "../src/lib/utils/authUtils.js";

describe("normalizeUsername", () => {
  it("trims, lowercases, and removes spaces", () => {
    expect(normalizeUsername("  Ali User ")).toBe("aliuser");
  });
  it("handles empty input", () => {
    expect(normalizeUsername("")).toBe("");
    expect(normalizeUsername(null)).toBe("");
  });
});

describe("validateUsername", () => {
  it("accepts a valid username", () => {
    const r = validateUsername("student1");
    expect(r.ok).toBe(true);
    expect(r.username).toBe("student1");
  });
  it("rejects too short", () => {
    expect(validateUsername("ab").ok).toBe(false);
  });
  it("rejects consecutive dots", () => {
    expect(validateUsername("a..b").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validateUsername("").ok).toBe(false);
  });
  it("accepts Arabic letters", () => {
    const r = validateUsername("طالب1");
    expect(r.ok).toBe(true);
  });
});

describe("validatePassword", () => {
  it("accepts a valid password", () => {
    expect(validatePassword("secret1").ok).toBe(true);
  });
  it("rejects short passwords", () => {
    expect(validatePassword("12345").ok).toBe(false);
  });
  it("rejects empty", () => {
    expect(validatePassword("").ok).toBe(false);
  });
});

describe("migrateAccounts", () => {
  it("returns empty array for non-array", () => {
    const r = migrateAccounts(null);
    expect(r.accounts).toEqual([]);
    expect(r.changed).toBe(false);
  });
  it("adds missing role/status/studied fields", () => {
    const r = migrateAccounts([{ code: "a1", name: "Ali" }]);
    expect(r.changed).toBe(true);
    expect(r.accounts[0].role).toBe("user");
    expect(r.accounts[0].status).toBe("active");
    expect(Array.isArray(r.accounts[0].studied)).toBe(true);
  });
  it("preserves existing role", () => {
    const r = migrateAccounts([{ code: "a1", role: "admin", isAdmin: true, studied: [] }]);
    expect(r.accounts[0].role).toBe("admin");
  });
});
