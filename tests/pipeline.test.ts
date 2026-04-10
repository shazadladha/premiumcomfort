import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AppConfig } from "../src/config/index.js";

// Mock generateImage before importing the module under test
vi.mock("../src/ai/image-generator.js", () => ({
  generateImage: vi.fn().mockResolvedValue({
    data: Buffer.from("fake"),
    prompt: "test",
    model: "gpt-image-1",
    generatedAt: new Date().toISOString(),
  }),
}));

// Mock image-publisher to avoid writing to the real docs/ directory
vi.mock("../src/content/image-publisher.js", () => ({
  saveImageToSite: vi.fn().mockReturnValue("/tmp/fake/image.png"),
  getPublicImageUrl: vi
    .fn()
    .mockImplementation(
      (base: string, filename: string) => `${base}/inspire/images/${filename}`
    ),
  updateGalleryPage: vi.fn(),
}));

// Mock brief-generator to avoid real API calls
vi.mock("../src/ai/brief-generator.js", () => ({
  generateBrief: vi.fn().mockResolvedValue({
    category: "bedding",
    contentType: "lifestyle",
    imagePrompt: "Scene/backdrop: serene bedroom at golden hour.",
    caption: "Sunday mornings were made for this.",
    hashtags: ["#PremiumComfort", "#LuxuryBedding", "#HomeDecor", "#SleepWell", "#LinenLove"],
  }),
  generateMultipleBriefs: vi.fn().mockImplementation(
    (_apiKey: string, count: number) => {
      const categories = ["bedding", "throws", "cushions", "towels", "fragrance", "loungewear"];
      const briefs = [];
      for (let i = 0; i < count; i++) {
        briefs.push({
          category: categories[i % categories.length],
          contentType: "lifestyle",
          imagePrompt: `Scene/backdrop: test prompt ${i + 1}.`,
          caption: `Test caption ${i + 1}.`,
          hashtags: ["#PremiumComfort", "#Test", "#Tags", "#Home", "#Comfort"],
        });
      }
      return Promise.resolve(briefs);
    }
  ),
}));

import {
  generateSingleContent,
  generateMultipleContent,
  dryRun,
} from "../src/content/pipeline.js";
import { generateImage } from "../src/ai/image-generator.js";
import { generateBrief, generateMultipleBriefs } from "../src/ai/brief-generator.js";

let tempDir: string;

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  tempDir = mkdtempSync(join(tmpdir(), "pipeline-test-"));
  return {
    clientKey: "test",
    clientSecret: "test",
    redirectUri: "http://localhost:3000/auth/callback",
    port: 3000,
    dataDir: tempDir,
    openaiApiKey: "sk-test-key",
    siteBaseUrl: "https://premiumcomfort.uk",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
});

describe("generateSingleContent", () => {
  it("creates a record with status generated", async () => {
    const config = makeConfig();
    const result = await generateSingleContent(config);

    expect(result.record).toBeTruthy();
    expect(result.record.status).toBe("generated");
    expect(result.record.id).toBeTruthy();
    expect(result.record.category).toBe("bedding");
    expect(result.record.promptHash).toBeTruthy();
  });

  it("returns imageUrl and caption", async () => {
    const config = makeConfig();
    const result = await generateSingleContent(config);

    expect(result.imageUrl).toContain("https://premiumcomfort.uk/inspire/images/");
    expect(result.caption).toContain("Sunday mornings were made for this.");
    expect(result.caption).toContain("#PremiumComfort");
  });

  it("calls generateBrief then generateImage", async () => {
    const config = makeConfig();
    await generateSingleContent(config);

    expect(generateBrief).toHaveBeenCalledOnce();
    expect(generateImage).toHaveBeenCalledOnce();

    const [apiKey] = vi.mocked(generateImage).mock.calls[0];
    expect(apiKey).toBe("sk-test-key");
  });

  it("passes recent records context to brief generator", async () => {
    const config = makeConfig();
    await generateSingleContent(config);

    const [apiKey, context] = vi.mocked(generateBrief).mock.calls[0];
    expect(apiKey).toBe("sk-test-key");
    expect(context).toHaveProperty("recentRecords");
    expect(Array.isArray(context.recentRecords)).toBe(true);
  });

  it("throws when openaiApiKey is missing", async () => {
    const config = makeConfig({ openaiApiKey: undefined });

    await expect(generateSingleContent(config)).rejects.toThrow(
      "OPENAI_API_KEY is required"
    );
  });
});

describe("generateMultipleContent", () => {
  it("returns the requested count of results", async () => {
    const config = makeConfig();
    const results = await generateMultipleContent(config, 3);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.record.status).toBe("generated");
      expect(r.imageUrl).toBeTruthy();
      expect(r.caption).toBeTruthy();
    }
  });

  it("calls generateMultipleBriefs then generateImage for each", async () => {
    const config = makeConfig();
    await generateMultipleContent(config, 4);

    expect(generateMultipleBriefs).toHaveBeenCalledOnce();
    expect(generateImage).toHaveBeenCalledTimes(4);
  });

  it("throws when openaiApiKey is missing", async () => {
    const config = makeConfig({ openaiApiKey: undefined });

    await expect(generateMultipleContent(config, 2)).rejects.toThrow(
      "OPENAI_API_KEY is required"
    );
  });
});

describe("dryRun", () => {
  it("does not call generateImage", async () => {
    const config = makeConfig();
    await dryRun(config, 3);

    expect(generateImage).not.toHaveBeenCalled();
  });

  it("calls generateMultipleBriefs", async () => {
    const config = makeConfig();
    await dryRun(config, 3);

    expect(generateMultipleBriefs).toHaveBeenCalledOnce();
  });

  it("throws when openaiApiKey is missing", async () => {
    const config = makeConfig({ openaiApiKey: undefined });

    await expect(dryRun(config, 2)).rejects.toThrow(
      "OPENAI_API_KEY is required"
    );
  });
});
