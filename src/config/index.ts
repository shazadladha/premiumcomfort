import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  port: number;
  dataDir: string;
  openaiApiKey?: string;
  siteBaseUrl: string;
}

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getConfig(): AppConfig {
  loadEnvFile();

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    console.error(
      "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET.\n" +
        "Copy config/.env.example to .env and fill in your credentials."
    );
    process.exit(1);
  }

  return {
    clientKey,
    clientSecret,
    redirectUri:
      process.env.TIKTOK_REDIRECT_URI || "http://localhost:3000/auth/callback",
    port: parseInt(process.env.PORT || "3000", 10),
    dataDir: resolve(process.cwd(), "data"),
    openaiApiKey: process.env.OPENAI_API_KEY,
    siteBaseUrl: process.env.SITE_BASE_URL || "https://premiumcomfort.uk",
  };
}
