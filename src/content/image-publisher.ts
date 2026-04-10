import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ContentRecord } from "./content-history.js";

const INSPIRE_DIR = resolve(process.cwd(), "docs", "inspire");
const IMAGES_DIR = resolve(INSPIRE_DIR, "images");
const GALLERY_JSON = resolve(INSPIRE_DIR, "gallery.json");

export interface GalleryEntry {
  filename: string;
  caption: string;
  date: string;
}

export function saveImageToSite(imageData: Buffer, filename: string): string {
  mkdirSync(IMAGES_DIR, { recursive: true });
  const filePath = resolve(IMAGES_DIR, filename);
  writeFileSync(filePath, imageData);
  return filePath;
}

export function getPublicImageUrl(
  siteBaseUrl: string,
  filename: string
): string {
  return `${siteBaseUrl}/inspire/images/${filename}`;
}

export function updateGalleryPage(records: ContentRecord[]): void {
  const sorted = [...records]
    .filter((r) => r.imageFilename)
    .sort(
      (a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

  const gallery: GalleryEntry[] = sorted.map((record) => ({
    filename: record.imageFilename,
    caption: record.caption.split("\n")[0],
    date: record.generatedAt,
  }));

  mkdirSync(INSPIRE_DIR, { recursive: true });
  writeFileSync(GALLERY_JSON, JSON.stringify(gallery, null, 2));
}
