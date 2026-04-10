import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config when env vars are set", async () => {
    process.env.TIKTOK_CLIENT_KEY = "test_key";
    process.env.TIKTOK_CLIENT_SECRET = "test_secret";

    const { getConfig } = await import("../src/config/index.js");
    const config = getConfig();

    expect(config.clientKey).toBe("test_key");
    expect(config.clientSecret).toBe("test_secret");
    expect(config.redirectUri).toBe("http://localhost:3000/auth/callback");
    expect(config.port).toBe(3000);
  });

  it("uses custom redirect URI and port from env", async () => {
    process.env.TIKTOK_CLIENT_KEY = "test_key";
    process.env.TIKTOK_CLIENT_SECRET = "test_secret";
    process.env.TIKTOK_REDIRECT_URI = "http://localhost:8080/cb";
    process.env.PORT = "8080";

    const { getConfig } = await import("../src/config/index.js");
    const config = getConfig();

    expect(config.redirectUri).toBe("http://localhost:8080/cb");
    expect(config.port).toBe(8080);
  });

  it("exits when credentials are missing", async () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    const { getConfig } = await import("../src/config/index.js");
    expect(() => getConfig()).toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
