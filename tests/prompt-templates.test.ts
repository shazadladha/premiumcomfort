import { describe, it, expect } from "vitest";
import {
  hashPrompt,
  BRAND_STYLE,
  CATEGORIES,
} from "../src/content/prompt-templates.js";

describe("BRAND_STYLE", () => {
  it("is a non-empty string", () => {
    expect(typeof BRAND_STYLE).toBe("string");
    expect(BRAND_STYLE.length).toBeGreaterThan(0);
  });

  it("contains key brand elements", () => {
    expect(BRAND_STYLE).toContain("luxury");
    expect(BRAND_STYLE).toContain("no text");
    expect(BRAND_STYLE).toContain("no logos");
  });
});

describe("CATEGORIES", () => {
  it("contains all 6 product categories", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(CATEGORIES).toContain("bedding");
    expect(CATEGORIES).toContain("throws");
    expect(CATEGORIES).toContain("cushions");
    expect(CATEGORIES).toContain("towels");
    expect(CATEGORIES).toContain("fragrance");
    expect(CATEGORIES).toContain("loungewear");
  });
});

describe("hashPrompt", () => {
  it("returns a 16-character hex string", () => {
    const hash = hashPrompt("test prompt");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns the same hash for the same input", () => {
    const a = hashPrompt("some prompt text");
    const b = hashPrompt("some prompt text");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", () => {
    const a = hashPrompt("prompt one");
    const b = hashPrompt("prompt two");
    expect(a).not.toBe(b);
  });
});
