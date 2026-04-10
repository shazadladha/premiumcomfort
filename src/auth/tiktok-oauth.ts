import { createServer, type Server } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import open from "open";
import type { AppConfig } from "../config/index.js";

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  openId: string;
  scope: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

function getTokenPath(config: AppConfig): string {
  return resolve(config.dataDir, "tokens.json");
}

export function loadTokens(config: AppConfig): TokenData | null {
  const tokenPath = getTokenPath(config);
  if (!existsSync(tokenPath)) return null;
  try {
    return JSON.parse(readFileSync(tokenPath, "utf-8"));
  } catch {
    return null;
  }
}

function saveTokens(config: AppConfig, tokens: TokenData): void {
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(getTokenPath(config), JSON.stringify(tokens, null, 2));
}

export async function getValidToken(config: AppConfig): Promise<TokenData> {
  const tokens = loadTokens(config);
  if (!tokens) {
    throw new Error(
      "Not authenticated. Run `npm run auth` to authorize with TikTok."
    );
  }

  if (Date.now() < tokens.expiresAt) {
    return tokens;
  }

  if (Date.now() >= tokens.refreshExpiresAt) {
    throw new Error(
      "Refresh token expired. Run `npm run auth` to re-authorize."
    );
  }

  console.log("Access token expired, refreshing...");
  return refreshAccessToken(config, tokens.refreshToken);
}

async function exchangeCodeForToken(
  config: AppConfig,
  code: string
): Promise<TokenData> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();

  if (json.error && json.error !== "ok") {
    throw new Error(
      `Token exchange failed: ${json.error} - ${json.error_description}`
    );
  }

  const now = Date.now();
  const tokens: TokenData = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    openId: json.open_id,
    scope: json.scope,
    expiresAt: now + json.expires_in * 1000,
    refreshExpiresAt: now + json.refresh_expires_in * 1000,
  };

  saveTokens(config, tokens);
  return tokens;
}

async function refreshAccessToken(
  config: AppConfig,
  refreshToken: string
): Promise<TokenData> {
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();

  if (json.error && json.error !== "ok") {
    throw new Error(
      `Token refresh failed: ${json.error} - ${json.error_description}`
    );
  }

  const now = Date.now();
  const tokens: TokenData = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    openId: json.open_id,
    scope: json.scope,
    expiresAt: now + json.expires_in * 1000,
    refreshExpiresAt: now + json.refresh_expires_in * 1000,
  };

  saveTokens(config, tokens);
  return tokens;
}

export async function revokeToken(config: AppConfig): Promise<void> {
  const tokens = loadTokens(config);
  if (!tokens) {
    console.log("No tokens to revoke.");
    return;
  }

  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    token: tokens.accessToken,
  });

  await fetch(TIKTOK_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenPath = getTokenPath(config);
  if (existsSync(tokenPath)) {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(tokenPath);
  }
  console.log("Token revoked and removed.");
}

export async function startAuthFlow(config: AppConfig): Promise<TokenData> {
  const state = randomUUID();
  const scopes = "user.info.basic,video.upload,video.publish";

  const authUrl = new URL(TIKTOK_AUTH_URL);
  authUrl.searchParams.set("client_key", config.clientKey);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("state", state);

  return new Promise<TokenData>((resolve, reject) => {
    let server: Server;

    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error("Authorization timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${config.port}`);

      if (url.pathname !== "/auth/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400);
        res.end(`Authorization failed: ${error}`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Authorization failed: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400);
        res.end("Invalid state parameter");
        clearTimeout(timeout);
        server.close();
        reject(new Error("State mismatch — possible CSRF attack"));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received");
        clearTimeout(timeout);
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      try {
        const tokens = await exchangeCodeForToken(config, code);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization successful!</h1>" +
            "<p>You can close this window and return to the terminal.</p></body></html>"
        );
        clearTimeout(timeout);
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500);
        res.end(`Token exchange failed: ${err}`);
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    server.listen(config.port, () => {
      console.log(`\nAuthorization server running on port ${config.port}`);
      console.log("Opening TikTok authorization page in your browser...\n");
      console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);
      open(authUrl.toString());
    });
  });
}
