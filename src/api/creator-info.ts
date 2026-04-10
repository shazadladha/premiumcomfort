import type { AppConfig } from "../config/index.js";
import { getValidToken } from "../auth/tiktok-oauth.js";

const CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";

export interface CreatorInfo {
  creatorAvatarUrl: string;
  creatorUsername: string;
  creatorNickname: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}

export async function queryCreatorInfo(
  config: AppConfig
): Promise<CreatorInfo> {
  const tokens = await getValidToken(config);

  const res = await fetch(CREATOR_INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });

  const json = await res.json();

  if (json.error?.code && json.error.code !== "ok") {
    throw new Error(
      `Creator info query failed: ${json.error.code} - ${json.error.message}`
    );
  }

  const d = json.data;
  return {
    creatorAvatarUrl: d.creator_avatar_url,
    creatorUsername: d.creator_username,
    creatorNickname: d.creator_nickname,
    privacyLevelOptions: d.privacy_level_options,
    commentDisabled: d.comment_disabled,
    duetDisabled: d.duet_disabled,
    stitchDisabled: d.stitch_disabled,
    maxVideoPostDurationSec: d.max_video_post_duration_sec,
  };
}
