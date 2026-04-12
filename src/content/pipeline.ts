import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config/index.js";
import { generateImage } from "../ai/image-generator.js";
import {
  generateBrief,
  generateMultipleBriefs,
  type CreativeBrief,
} from "../ai/brief-generator.js";
import { hashPrompt } from "./prompt-templates.js";
import {
  addRecord,
  getHistory,
  type ContentRecord,
} from "./content-history.js";
import {
  saveImageToSite,
  getPublicImageUrl,
  updateGalleryPage,
} from "./image-publisher.js";

export interface GenerateResult {
  record: ContentRecord;
  imageUrl: string;
  title: string;
  caption: string;
}

export async function generateSingleContent(
  config: AppConfig
): Promise<GenerateResult> {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required. Add it to your .env file."
    );
  }

  const recentRecords = getHistory(config, 7);
  const brief = await generateBrief(config.openaiApiKey, { recentRecords });

  return generateFromBrief(config, brief);
}

export async function generateMultipleContent(
  config: AppConfig,
  count: number
): Promise<GenerateResult[]> {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required. Add it to your .env file."
    );
  }

  const recentRecords = getHistory(config, 7);
  const briefs = await generateMultipleBriefs(config.openaiApiKey, count, {
    recentRecords,
  });
  const results: GenerateResult[] = [];

  for (const brief of briefs) {
    const result = await generateFromBrief(config, brief);
    results.push(result);
  }

  return results;
}

async function generateFromBrief(
  config: AppConfig,
  brief: CreativeBrief
): Promise<GenerateResult> {
  const id = randomUUID().slice(0, 8);
  const filename = `${id}.jpg`;
  const prompt = brief.imagePrompt;
  const title = brief.title;
  const caption = `${brief.caption}\n\n${brief.hashtags.join(" ")}`;
  const pHash = hashPrompt(prompt);

  console.log(`Generating image for: ${brief.category} / ${brief.contentType}...`);

  const image = await generateImage(config.openaiApiKey!, prompt);

  saveImageToSite(image.data, filename);
  console.log(`Saved: docs/inspire/images/${filename}`);

  const imageUrl = getPublicImageUrl(config.siteBaseUrl, filename);

  const record: ContentRecord = {
    id,
    prompt,
    promptHash: pHash,
    category: brief.category,
    contentType: brief.contentType,
    imageFilename: filename,
    imageUrl,
    title,
    caption,
    generatedAt: image.generatedAt,
    status: "generated",
  };

  addRecord(config, record);

  const allHistory = getHistory(config);
  updateGalleryPage(allHistory);

  return { record, imageUrl, title, caption };
}

export async function dryRun(config: AppConfig, count: number): Promise<void> {
  if (!config.openaiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for dry run. Add it to your .env file."
    );
  }

  const recentRecords = getHistory(config, 7);
  const briefs = await generateMultipleBriefs(config.openaiApiKey, count, {
    recentRecords,
  });

  console.log(`\nDry run — ${count} brief(s) generated:\n`);
  for (let i = 0; i < briefs.length; i++) {
    const b = briefs[i];
    console.log(`${i + 1}. [${b.category}/${b.contentType}]`);
    console.log(`   Prompt: ${b.imagePrompt.slice(0, 120)}...`);
    console.log(`   Title: ${b.title}`);
    console.log(`   Caption: ${b.caption}`);
    console.log(`   Tags: ${b.hashtags.join(" ")}`);
    console.log();
  }
}
