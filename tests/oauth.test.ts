import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "../src/config/index.js";
import { loadTokens } from "../src/auth/tiktok-oauth.js";
import type { TokenData } from "../src/auth/tiktok-oauth.js";

const TEST_DATA_DIR = resolve(process.cwd(), "test-data-oauth");

function makeConfig(): AppConfig {
  return {
    clientKey: "test_key",
    clientSecret: "test_secret",
    redirectUri: "http://localhost:3000/auth/callback",
    port: 3000,
    dataDir: TEST_DATA_DIR,
  };
}

describe("oauth token management", () => {
  beforeEach(() => {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  it("returns null when no tokens exist", () => {
    const config = makeConfig();
    const tokens = loadTokens(config);
    expect(tokens).toBeNull();
  });

  it("loads saved tokens from disk", () => {
    const config = makeConfig();
    const tokenData: TokenData = {
      accessToken: "test_access_token",
      refreshToken: "test_refresh_token",
      openId: "test_open_id",
      scope: "user.info.basic,video.upload",
      expiresAt: Date.now() + 86400_000,
      refreshExpiresAt: Date.now() + 365 * 86400_000,
    };

    writeFileSync(
      resolve(TEST_DATA_DIR, "tokens.json"),
      JSON.stringify(tokenData)
    );

    const loaded = loadTokens(config);
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe("test_access_token");
    expect(loaded!.openId).toBe("test_open_id");
    expect(loaded!.scope).toBe("user.info.basic,video.upload");
  });

  it("returns null for corrupted token file", () => {
    const config = makeConfig();
    writeFileSync(resolve(TEST_DATA_DIR, "tokens.json"), "not valid json");

    const tokens = loadTokens(config);
    expect(tokens).toBeNull();
  });
});
