import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "../src/config/index.js";
import {
  schedulePost,
  listScheduledPosts,
  cancelScheduledPost,
} from "../src/scheduler/scheduler.js";

const TEST_DATA_DIR = resolve(process.cwd(), "test-data");

function makeConfig(): AppConfig {
  return {
    clientKey: "test",
    clientSecret: "test",
    redirectUri: "http://localhost:3000/auth/callback",
    port: 3000,
    dataDir: TEST_DATA_DIR,
  };
}

describe("scheduler", () => {
  beforeEach(() => {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  it("schedules a post and lists it", () => {
    const config = makeConfig();
    const futureDate = new Date(Date.now() + 3600_000).toISOString();

    const post = schedulePost(config, {
      type: "video-file",
      source: "/path/to/video.mp4",
      options: { title: "Test post" },
      scheduledTime: futureDate,
    });

    expect(post.id).toBeTruthy();
    expect(post.status).toBe("pending");
    expect(post.type).toBe("video-file");

    const posts = listScheduledPosts(config);
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe(post.id);
  });

  it("cancels a pending post", () => {
    const config = makeConfig();
    const futureDate = new Date(Date.now() + 3600_000).toISOString();

    const post = schedulePost(config, {
      type: "video-url",
      source: "https://example.com/video.mp4",
      options: {},
      scheduledTime: futureDate,
    });

    const cancelled = cancelScheduledPost(config, post.id);
    expect(cancelled).toBeTruthy();
    expect(cancelled!.status).toBe("failed");
    expect(cancelled!.error).toBe("Cancelled by user");
  });

  it("returns null when cancelling non-existent post", () => {
    const config = makeConfig();
    const result = cancelScheduledPost(config, "nonexistent");
    expect(result).toBeNull();
  });

  it("rejects past scheduled time", () => {
    const config = makeConfig();
    const pastDate = new Date(Date.now() - 3600_000).toISOString();

    expect(() =>
      schedulePost(config, {
        type: "video-file",
        source: "/path/to/video.mp4",
        options: {},
        scheduledTime: pastDate,
      })
    ).toThrow("Scheduled time must be in the future");
  });

  it("rejects invalid date", () => {
    const config = makeConfig();

    expect(() =>
      schedulePost(config, {
        type: "video-file",
        source: "/path/to/video.mp4",
        options: {},
        scheduledTime: "not-a-date",
      })
    ).toThrow("Invalid date");
  });

  it("schedules multiple posts", () => {
    const config = makeConfig();
    const futureDate1 = new Date(Date.now() + 3600_000).toISOString();
    const futureDate2 = new Date(Date.now() + 7200_000).toISOString();

    schedulePost(config, {
      type: "video-file",
      source: "/path/to/video1.mp4",
      options: { title: "Post 1" },
      scheduledTime: futureDate1,
    });

    schedulePost(config, {
      type: "photo",
      source: "https://example.com/photo.jpg",
      photoUrls: ["https://example.com/photo.jpg"],
      options: { title: "Post 2" },
      scheduledTime: futureDate2,
    });

    const posts = listScheduledPosts(config);
    expect(posts).toHaveLength(2);
  });
});
