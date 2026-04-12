import { readFileSync, statSync } from "node:fs";
import type { AppConfig } from "../config/index.js";
import { getValidToken } from "../auth/tiktok-oauth.js";

const API_BASE = "https://open.tiktokapis.com/v2/post/publish";

export type PrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export interface PostOptions {
  title?: string;
  description?: string;
  privacyLevel?: PrivacyLevel;
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
  brandContentToggle?: boolean;
  isAigc?: boolean;
}

interface InitResponse {
  data: {
    publish_id: string;
    upload_url?: string;
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface StatusResponse {
  data: {
    status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
    message: string;
    log_id: string;
  };
}

function buildVideoPostInfo(options: PostOptions) {
  return {
    privacy_level: options.privacyLevel || "SELF_ONLY",
    title: options.title || "",
    disable_duet: options.disableDuet ?? false,
    disable_stitch: options.disableStitch ?? false,
    disable_comment: options.disableComment ?? false,
    brand_content_toggle: options.brandContentToggle ?? false,
    is_aigc: options.isAigc ?? false,
  };
}

function buildPhotoPostInfo(options: PostOptions) {
  return {
    privacy_level: options.privacyLevel || "SELF_ONLY",
    title: (options.title || "").slice(0, 90),
    description: options.description || options.title || "",
    disable_comment: options.disableComment ?? false,
    brand_content_toggle: options.brandContentToggle ?? false,
    brand_organic_toggle: false,
    auto_add_music: true,
  };
}

export async function postVideoFromFile(
  config: AppConfig,
  filePath: string,
  options: PostOptions = {}
): Promise<string> {
  const tokens = await getValidToken(config);
  const fileSize = statSync(filePath).size;

  console.log(`Initializing video upload (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

  const initRes = await fetch(`${API_BASE}/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: buildVideoPostInfo(options),
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1,
      },
    }),
  });

  const initData: InitResponse = await initRes.json();

  if (initData.error.code !== "ok") {
    throw new Error(
      `Video init failed: ${initData.error.code} - ${initData.error.message}`
    );
  }

  const { publish_id, upload_url } = initData.data;

  if (!upload_url) {
    throw new Error("No upload URL returned from TikTok");
  }

  console.log("Uploading video...");
  const videoData = readFileSync(filePath);

  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": fileSize.toString(),
      "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
    },
    body: videoData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Video upload failed with status ${uploadRes.status}`);
  }

  console.log(`Video uploaded. Publish ID: ${publish_id}`);
  return publish_id;
}

export async function postVideoFromUrl(
  config: AppConfig,
  videoUrl: string,
  options: PostOptions = {}
): Promise<string> {
  const tokens = await getValidToken(config);

  console.log("Initializing video post from URL...");

  const initRes = await fetch(`${API_BASE}/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: buildVideoPostInfo(options),
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    }),
  });

  const initData: InitResponse = await initRes.json();

  if (initData.error.code !== "ok") {
    throw new Error(
      `Video init failed: ${initData.error.code} - ${initData.error.message}`
    );
  }

  console.log(`Video submitted. Publish ID: ${initData.data.publish_id}`);
  return initData.data.publish_id;
}

export async function postPhoto(
  config: AppConfig,
  photoUrls: string[],
  options: PostOptions = {}
): Promise<string> {
  const tokens = await getValidToken(config);

  console.log(`Initializing photo post (${photoUrls.length} photo(s))...`);

  const initRes = await fetch(`${API_BASE}/content/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      media_type: "PHOTO",
      post_mode: "MEDIA_UPLOAD",
      post_info: buildPhotoPostInfo(options),
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: photoUrls,
        photo_cover_index: 0,
      },
    }),
  });

  const initData: InitResponse = await initRes.json();

  if (initData.error.code !== "ok") {
    throw new Error(
      `Photo post failed: ${initData.error.code} - ${initData.error.message}`
    );
  }

  console.log(`Photo submitted. Publish ID: ${initData.data.publish_id}`);
  return initData.data.publish_id;
}

export async function checkPostStatus(
  config: AppConfig,
  publishId: string
): Promise<StatusResponse["data"]> {
  const tokens = await getValidToken(config);

  const res = await fetch(`${API_BASE}/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  const data: StatusResponse = await res.json();

  if (data.error.code !== "ok") {
    throw new Error(
      `Status check failed: ${data.error.code} - ${data.error.message}`
    );
  }

  return data.data;
}

export async function waitForPublish(
  config: AppConfig,
  publishId: string,
  maxWaitMs = 120_000
): Promise<StatusResponse["data"]> {
  const start = Date.now();
  const pollInterval = 5_000;

  while (Date.now() - start < maxWaitMs) {
    const status = await checkPostStatus(config, publishId);

    if (status.status === "PUBLISH_COMPLETE" || status.status === "SEND_TO_USER_INBOX") {
      console.log(status.status === "SEND_TO_USER_INBOX"
        ? "Post sent to your TikTok inbox for review."
        : "Post published successfully!");
      return status;
    }

    if (status.status === "FAILED") {
      throw new Error(`Post failed: ${status.fail_reason || "Unknown reason"}`);
    }

    console.log(`Status: ${status.status} — waiting...`);
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`Post did not complete within ${maxWaitMs / 1000} seconds`);
}
