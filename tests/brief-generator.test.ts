import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../src/content/prompt-templates.js", () => ({
  BRAND_STYLE: "test brand style",
  CATEGORIES: ["bedding", "throws", "cushions", "towels", "fragrance", "loungewear"],
}));

import {
  generateBrief,
  generateMultipleBriefs,
  type CreativeBrief,
} from "../src/ai/brief-generator.js";

const VALID_BRIEF: CreativeBrief = {
  category: "bedding",
  contentType: "lifestyle",
  imagePrompt: "Scene/backdrop: serene bedroom at golden hour.",
  caption: "Sunday mornings were made for this.",
  hashtags: ["#PremiumComfort", "#LuxuryBedding", "#HomeDecor", "#SleepWell", "#LinenLove"],
};

function mockChatOk(brief: CreativeBrief = VALID_BRIEF) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [
          {
            message: {
              content: JSON.stringify(brief),
            },
          },
        ],
      }),
  });
}

describe("generateBrief", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends correct request to OpenAI Chat API", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    await generateBrief("sk-test-key", { recentRecords: [] });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer sk-test-key");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.model).toBe("gpt-4o");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: expect.objectContaining({ name: "creative_brief", strict: true }),
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });

  it("parses valid CreativeBrief from response", async () => {
    globalThis.fetch = mockChatOk();

    const brief = await generateBrief("sk-test-key", { recentRecords: [] });

    expect(brief.category).toBe("bedding");
    expect(brief.contentType).toBe("lifestyle");
    expect(brief.imagePrompt).toBeTruthy();
    expect(brief.caption).toBeTruthy();
    expect(brief.hashtags).toHaveLength(5);
    expect(brief.hashtags[0]).toBe("#PremiumComfort");
  });

  it("includes brand style in system prompt", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    await generateBrief("sk-test-key", { recentRecords: [] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("test brand style");
  });

  it("includes recent records in user message", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    const recentRecords = [
      {
        id: "abc",
        prompt: "Scene/backdrop: bedroom with dark headboard and sheets",
        promptHash: "hash1",
        category: "bedding",
        contentType: "product-hero",
        imageFilename: "abc.png",
        imageUrl: "https://example.com/abc.png",
        caption: "Test caption",
        generatedAt: new Date().toISOString(),
        status: "generated" as const,
      },
    ];

    await generateBrief("sk-test-key", { recentRecords });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = body.messages[1].content;
    expect(userMsg).toContain("bedding/product-hero");
    expect(userMsg).toContain("Recently generated content");
  });

  it("includes previous briefs in user message for batch context", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    const previousBriefs: CreativeBrief[] = [
      {
        category: "throws",
        contentType: "lifestyle",
        imagePrompt: "Scene/backdrop: living room with rain visible.",
        caption: "Rainy days call for our softest throws.",
        hashtags: ["#PremiumComfort", "#RainyDay", "#CozyHome", "#ThrowBlanket", "#HomeMoments"],
      },
    ];

    await generateBrief("sk-test-key", { recentRecords: [], previousBriefs });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = body.messages[1].content;
    expect(userMsg).toContain("Already generated in this batch");
    expect(userMsg).toContain("throws/lifestyle");
  });

  it("includes seasonal hint in user message", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    await generateBrief("sk-test-key", { recentRecords: [] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = body.messages[1].content;
    expect(userMsg).toMatch(/Current season: (spring|summer|autumn|winter)/);
  });

  it("throws on 429 rate limit response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(
      generateBrief("sk-test-key", { recentRecords: [] })
    ).rejects.toThrow("rate limit exceeded");
  });

  it("throws on general API errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    await expect(
      generateBrief("sk-test-key", { recentRecords: [] })
    ).rejects.toThrow("OpenAI API error (500)");
  });

  it("throws when response contains error object", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [],
          error: {
            message: "Something went wrong",
            type: "server_error",
            code: "server_error",
          },
        }),
    });

    await expect(
      generateBrief("sk-test-key", { recentRecords: [] })
    ).rejects.toThrow("OpenAI error: Something went wrong");
  });

  it("throws when no content is returned", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "" } }],
        }),
    });

    await expect(
      generateBrief("sk-test-key", { recentRecords: [] })
    ).rejects.toThrow("No content returned");
  });
});

describe("generateMultipleBriefs", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the requested count of briefs", async () => {
    let callCount = 0;
    const categories = ["bedding", "throws", "cushions"];
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const brief = {
        ...VALID_BRIEF,
        category: categories[callCount % categories.length],
      };
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: JSON.stringify(brief) } }],
          }),
      });
    });

    const briefs = await generateMultipleBriefs("sk-test-key", 3, {
      recentRecords: [],
    });

    expect(briefs).toHaveLength(3);
  });

  it("accumulates context across calls", async () => {
    const fetchMock = mockChatOk();
    globalThis.fetch = fetchMock;

    await generateMultipleBriefs("sk-test-key", 3, { recentRecords: [] });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    // First call should have no previous briefs
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(firstBody.messages[1].content).not.toContain("Already generated in this batch");

    // Third call should have 2 previous briefs
    const thirdBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(thirdBody.messages[1].content).toContain("Already generated in this batch");
  });
});
