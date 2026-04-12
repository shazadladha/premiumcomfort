import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig } from "../config/index.js";

export interface ContentRecord {
  id: string;
  prompt: string;
  promptHash: string;
  category: string;
  contentType: string;
  imageFilename: string;
  imageUrl: string;
  title?: string;
  caption: string;
  generatedAt: string;
  postedAt?: string;
  publishId?: string;
  status: "generated" | "scheduled" | "posted" | "failed";
}

function getHistoryPath(config: AppConfig): string {
  return resolve(config.dataDir, "content-history.json");
}

function loadHistory(config: AppConfig): ContentRecord[] {
  const path = getHistoryPath(config);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

function saveHistory(config: AppConfig, records: ContentRecord[]): void {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(getHistoryPath(config), JSON.stringify(records, null, 2));
}

export function addRecord(config: AppConfig, record: ContentRecord): void {
  const records = loadHistory(config);
  records.push(record);
  saveHistory(config, records);
}

export function getHistory(config: AppConfig, days?: number): ContentRecord[] {
  const records = loadHistory(config);
  if (!days) return records;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return records.filter((r) => new Date(r.generatedAt).getTime() >= cutoff);
}

export function getRecentPromptHashes(
  config: AppConfig,
  days = 7
): string[] {
  const recent = getHistory(config, days);
  return recent.map((r) => r.promptHash);
}

export function updateRecordStatus(
  config: AppConfig,
  id: string,
  status: ContentRecord["status"],
  publishId?: string
): void {
  const records = loadHistory(config);
  const record = records.find((r) => r.id === id);
  if (!record) return;

  record.status = status;
  if (publishId) record.publishId = publishId;
  if (status === "posted") record.postedAt = new Date().toISOString();

  saveHistory(config, records);
}
