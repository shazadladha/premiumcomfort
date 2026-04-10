import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import cron from "node-cron";
import type { AppConfig } from "../config/index.js";
import {
  postVideoFromFile,
  postVideoFromUrl,
  postPhoto,
  type PostOptions,
} from "../api/content-posting.js";

export interface ScheduledPost {
  id: string;
  type: "video-file" | "video-url" | "photo";
  source: string;
  photoUrls?: string[];
  options: PostOptions;
  scheduledTime: string;
  status: "pending" | "posting" | "completed" | "failed";
  publishId?: string;
  error?: string;
  createdAt: string;
}

function getQueuePath(config: AppConfig): string {
  return resolve(config.dataDir, "schedule-queue.json");
}

function loadQueue(config: AppConfig): ScheduledPost[] {
  const queuePath = getQueuePath(config);
  if (!existsSync(queuePath)) return [];
  try {
    return JSON.parse(readFileSync(queuePath, "utf-8"));
  } catch {
    return [];
  }
}

function saveQueue(config: AppConfig, queue: ScheduledPost[]): void {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(getQueuePath(config), JSON.stringify(queue, null, 2));
}

export function schedulePost(
  config: AppConfig,
  params: {
    type: ScheduledPost["type"];
    source: string;
    photoUrls?: string[];
    options: PostOptions;
    scheduledTime: string;
  }
): ScheduledPost {
  const scheduled = new Date(params.scheduledTime);
  if (isNaN(scheduled.getTime())) {
    throw new Error(`Invalid date: ${params.scheduledTime}`);
  }
  if (scheduled.getTime() <= Date.now()) {
    throw new Error("Scheduled time must be in the future");
  }

  const post: ScheduledPost = {
    id: randomUUID().slice(0, 8),
    type: params.type,
    source: params.source,
    photoUrls: params.photoUrls,
    options: params.options,
    scheduledTime: params.scheduledTime,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const queue = loadQueue(config);
  queue.push(post);
  saveQueue(config, queue);

  return post;
}

export function listScheduledPosts(config: AppConfig): ScheduledPost[] {
  return loadQueue(config);
}

export function cancelScheduledPost(
  config: AppConfig,
  id: string
): ScheduledPost | null {
  const queue = loadQueue(config);
  const idx = queue.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  if (queue[idx].status !== "pending") {
    throw new Error(`Cannot cancel post with status: ${queue[idx].status}`);
  }

  queue[idx].status = "failed";
  queue[idx].error = "Cancelled by user";
  saveQueue(config, queue);
  return queue[idx];
}

async function executePost(
  config: AppConfig,
  post: ScheduledPost
): Promise<void> {
  const queue = loadQueue(config);
  const idx = queue.findIndex((p) => p.id === post.id);
  if (idx === -1) return;

  queue[idx].status = "posting";
  saveQueue(config, queue);

  try {
    let publishId: string;

    switch (post.type) {
      case "video-file":
        publishId = await postVideoFromFile(config, post.source, post.options);
        break;
      case "video-url":
        publishId = await postVideoFromUrl(config, post.source, post.options);
        break;
      case "photo":
        publishId = await postPhoto(
          config,
          post.photoUrls || [post.source],
          post.options
        );
        break;
    }

    const updated = loadQueue(config);
    const updatedIdx = updated.findIndex((p) => p.id === post.id);
    if (updatedIdx !== -1) {
      updated[updatedIdx].status = "completed";
      updated[updatedIdx].publishId = publishId;
      saveQueue(config, updated);
    }

    console.log(`[${new Date().toISOString()}] Post ${post.id} completed (publish_id: ${publishId})`);
  } catch (err) {
    const updated = loadQueue(config);
    const updatedIdx = updated.findIndex((p) => p.id === post.id);
    if (updatedIdx !== -1) {
      updated[updatedIdx].status = "failed";
      updated[updatedIdx].error = err instanceof Error ? err.message : String(err);
      saveQueue(config, updated);
    }

    console.error(`[${new Date().toISOString()}] Post ${post.id} failed:`, err);
  }
}

export function startScheduler(config: AppConfig): void {
  console.log("Scheduler started. Checking for due posts every minute...");

  cron.schedule("* * * * *", () => {
    const queue = loadQueue(config);
    const now = Date.now();

    for (const post of queue) {
      if (post.status !== "pending") continue;
      const scheduledTime = new Date(post.scheduledTime).getTime();
      if (scheduledTime <= now) {
        console.log(`[${new Date().toISOString()}] Executing post ${post.id}...`);
        executePost(config, post);
      }
    }
  });
}
