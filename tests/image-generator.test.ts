import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock sharp before importing the module under test
vi.mock("sharp", () => {
  const resizeMock = vi.fn().mockReturnThis();
  const pngMock = vi.fn().mockReturnThis();
  const toBufferMock = vi.fn().mockResolvedValue(Buffer.from("resized-image"));
  const sharpFn = vi.fn(() => ({
    resize: resizeMock,
    png: pngMock,
    toBuffer: toBufferMock,
  }));
  return { default: sharpFn };
});

import { generateImage } from "../src/ai/image-generator.js";

const FAKE_B64 = Buffer.from("fake-png-data").toString("base64");

function mockFetchOk(b64: string = FAKE_B64) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        created: Date.now(),
        data: [{ b64_json: b64 }],
      }),
  });
}

describe("generateImage", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sends correct request to OpenAI API", async () => {
    const fetchMock = mockFetchOk();
    globalThis.fetch = fetchMock;

    await generateImage("sk-test-key", "a cosy bedroom");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer sk-test-key");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.model).toBe("gpt-image-1");
    expect(body.prompt).toBe("a cosy bedroom");
    expect(body.n).toBe(1);
    expect(body.size).toBe("1024x1536");
    expect(body.quality).toBe("high");
  });

  it("passes custom size and quality options", async () => {
    const fetchMock = mockFetchOk();
    globalThis.fetch = fetchMock;

    await generateImage("sk-test-key", "a throw blanket", {
      size: "1024x1024",
      quality: "standard",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.size).toBe("1024x1024");
    expect(body.quality).toBe("standard");
  });

  it("decodes base64 and returns resized image buffer", async () => {
    globalThis.fetch = mockFetchOk();

    const result = await generateImage("sk-test-key", "pillows on a sofa");

    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.prompt).toBe("pillows on a sofa");
    expect(result.model).toBe("gpt-image-1");
    expect(result.generatedAt).toBeTruthy();
  });

  it("throws on 429 rate limit response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(
      generateImage("sk-test-key", "test prompt")
    ).rejects.toThrow("rate limit exceeded");
  });

  it("throws on 400 content policy violation", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          '{"error":{"code":"content_policy_violation","message":"rejected"}}'
        ),
    });

    await expect(
      generateImage("sk-test-key", "bad prompt")
    ).rejects.toThrow("Content policy violation");
  });

  it("throws on general API errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    await expect(
      generateImage("sk-test-key", "test prompt")
    ).rejects.toThrow("OpenAI API error (500)");
  });

  it("throws when response contains error object", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          created: Date.now(),
          data: [],
          error: {
            message: "Something went wrong",
            type: "server_error",
            code: "server_error",
          },
        }),
    });

    await expect(
      generateImage("sk-test-key", "test prompt")
    ).rejects.toThrow("OpenAI error: Something went wrong");
  });

  it("throws when no image data is returned", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          created: Date.now(),
          data: [{}],
        }),
    });

    await expect(
      generateImage("sk-test-key", "test prompt")
    ).rejects.toThrow("No image data returned from OpenAI");
  });
});
