import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AppConfig } from "../src/config/index.js";
import {
  addRecord,
  getHistory,
  getRecentPromptHashes,
  updateRecordStatus,
  type ContentRecord,
} from "../src/content/content-history.js";

let tempDir: string;

function makeConfig(): AppConfig {
  tempDir = mkdtempSync(join(tmpdir(), "content-history-test-"));
  return {
    clientKey: "test",
    clientSecret: "test",
    redirectUri: "http://localhost:3000/auth/callback",
    port: 3000,
    dataDir: tempDir,
    siteBaseUrl: "https://premiumcomfort.uk",
  };
}

function makeRecord(overrides: Partial<ContentRecord> = {}): ContentRecord {
  return {
    id: "rec-001",
    prompt: "A cosy bedroom scene",
    promptHash: "abc123",
    category: "bedding",
    contentType: "product-hero",
    imageFilename: "rec-001.png",
    imageUrl: "https://premiumcomfort.uk/inspire/images/rec-001.png",
    caption: "Comfort meets elegance.\n\n#PremiumComfort",
    generatedAt: new Date().toISOString(),
    status: "generated",
    ...overrides,
  };
}

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
});

describe("addRecord", () => {
  it("persists a record to the JSON file", () => {
    const config = makeConfig();
    const record = makeRecord();

    addRecord(config, record);

    const history = getHistory(config);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("rec-001");
    expect(history[0].category).toBe("bedding");
  });

  it("appends multiple records", () => {
    const config = makeConfig();

    addRecord(config, makeRecord({ id: "rec-001" }));
    addRecord(config, makeRecord({ id: "rec-002", category: "throws" }));
    addRecord(config, makeRecord({ id: "rec-003", category: "towels" }));

    const history = getHistory(config);
    expect(history).toHaveLength(3);
  });
});

describe("getHistory", () => {
  it("returns all records when no days filter is given", () => {
    const config = makeConfig();

    addRecord(config, makeRecord({ id: "r1" }));
    addRecord(config, makeRecord({ id: "r2" }));

    const history = getHistory(config);
    expect(history).toHaveLength(2);
  });

  it("returns empty array when no history exists", () => {
    const config = makeConfig();
    const history = getHistory(config);
    expect(history).toHaveLength(0);
  });

  it("filters records by days parameter", () => {
    const config = makeConfig();
    const now = new Date();

    // Record from today
    addRecord(
      config,
      makeRecord({
        id: "recent",
        generatedAt: now.toISOString(),
      })
    );

    // Record from 30 days ago
    const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    addRecord(
      config,
      makeRecord({
        id: "old",
        generatedAt: oldDate.toISOString(),
      })
    );

    const allHistory = getHistory(config);
    expect(allHistory).toHaveLength(2);

    const recentHistory = getHistory(config, 7);
    expect(recentHistory).toHaveLength(1);
    expect(recentHistory[0].id).toBe("recent");
  });
});

describe("getRecentPromptHashes", () => {
  it("returns only prompt hashes from recent records", () => {
    const config = makeConfig();

    addRecord(config, makeRecord({ id: "r1", promptHash: "hash-aaa" }));
    addRecord(config, makeRecord({ id: "r2", promptHash: "hash-bbb" }));

    const hashes = getRecentPromptHashes(config);
    expect(hashes).toEqual(["hash-aaa", "hash-bbb"]);
  });

  it("returns empty array when no history exists", () => {
    const config = makeConfig();
    const hashes = getRecentPromptHashes(config);
    expect(hashes).toHaveLength(0);
  });

  it("respects the days parameter", () => {
    const config = makeConfig();

    addRecord(
      config,
      makeRecord({
        id: "recent",
        promptHash: "hash-recent",
        generatedAt: new Date().toISOString(),
      })
    );

    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    addRecord(
      config,
      makeRecord({
        id: "old",
        promptHash: "hash-old",
        generatedAt: oldDate.toISOString(),
      })
    );

    const hashes = getRecentPromptHashes(config, 7);
    expect(hashes).toEqual(["hash-recent"]);
  });
});

describe("updateRecordStatus", () => {
  it("updates the status of a record", () => {
    const config = makeConfig();
    addRecord(config, makeRecord({ id: "rec-001", status: "generated" }));

    updateRecordStatus(config, "rec-001", "posted");

    const history = getHistory(config);
    expect(history[0].status).toBe("posted");
    expect(history[0].postedAt).toBeTruthy();
  });

  it("sets publishId when provided", () => {
    const config = makeConfig();
    addRecord(config, makeRecord({ id: "rec-001" }));

    updateRecordStatus(config, "rec-001", "posted", "tiktok-publish-123");

    const history = getHistory(config);
    expect(history[0].publishId).toBe("tiktok-publish-123");
  });

  it("does nothing when record ID is not found", () => {
    const config = makeConfig();
    addRecord(config, makeRecord({ id: "rec-001" }));

    updateRecordStatus(config, "nonexistent", "failed");

    const history = getHistory(config);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("generated");
  });

  it("updates status to scheduled without setting postedAt", () => {
    const config = makeConfig();
    addRecord(config, makeRecord({ id: "rec-001" }));

    updateRecordStatus(config, "rec-001", "scheduled");

    const history = getHistory(config);
    expect(history[0].status).toBe("scheduled");
    expect(history[0].postedAt).toBeUndefined();
  });
});
