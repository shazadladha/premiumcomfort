import { getConfig } from "./config/index.js";
import { startAuthFlow, loadTokens, revokeToken } from "./auth/tiktok-oauth.js";
import {
  postVideoFromFile,
  postVideoFromUrl,
  postPhoto,
  checkPostStatus,
  type PostOptions,
  type PrivacyLevel,
} from "./api/content-posting.js";
import { queryCreatorInfo } from "./api/creator-info.js";
import {
  schedulePost,
  listScheduledPosts,
  cancelScheduledPost,
  startScheduler,
} from "./scheduler/scheduler.js";
import {
  generateSingleContent,
  generateMultipleContent,
  dryRun,
} from "./content/pipeline.js";
import { getHistory } from "./content/content-history.js";

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function printUsage(): void {
  console.log(`
Premium Comfort — TikTok Automation CLI

Usage:
  npm run auth                              Authorize with TikTok
  npm run auth -- revoke                    Revoke TikTok access
  npm run auth -- status                    Show auth status
  npm run auth -- info                      Show creator info

  npm run post -- --file <path>             Post a video from file
  npm run post -- --url <video-url>         Post a video from URL
  npm run post -- --photos <url1,url2>      Post photos from URLs
    Options:
      --title "caption text"                Post caption
      --privacy <level>                     SELF_ONLY (default), PUBLIC_TO_EVERYONE,
                                            MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR

  npm run schedule -- --file <path> --time "2026-04-11T10:00:00"
  npm run schedule -- --url <url> --time "2026-04-11T10:00:00"
  npm run schedule -- --photos <urls> --time "2026-04-11T10:00:00"
    Options: same as post

  npm run list                              List scheduled posts
  npm run cancel -- --id <post-id>          Cancel a scheduled post

  npm run start                             Start the scheduler daemon

  npm run generate                          Generate 1 image and update gallery
  npm run generate -- --count 5             Generate multiple images
  npm run generate -- --dry-run             Preview prompts without generating
  npm run generate -- --history             Show content generation history
`);
}

function getPostOptions(): PostOptions {
  return {
    title: getFlag("title"),
    privacyLevel: (getFlag("privacy") as PrivacyLevel) || "SELF_ONLY",
    disableDuet: hasFlag("no-duet"),
    disableStitch: hasFlag("no-stitch"),
    disableComment: hasFlag("no-comments"),
    isAigc: hasFlag("aigc"),
  };
}

async function main(): Promise<void> {
  if (!command || command === "help") {
    printUsage();
    return;
  }

  const config = getConfig();

  switch (command) {
    case "auth": {
      const subcommand = args[1];

      if (subcommand === "revoke") {
        await revokeToken(config);
        return;
      }

      if (subcommand === "status") {
        const tokens = loadTokens(config);
        if (!tokens) {
          console.log("Not authenticated. Run `npm run auth` to authorize.");
          return;
        }
        const expiresIn = Math.max(0, tokens.expiresAt - Date.now());
        const refreshExpiresIn = Math.max(0, tokens.refreshExpiresAt - Date.now());
        console.log(`Authenticated as: ${tokens.openId}`);
        console.log(`Scopes: ${tokens.scope}`);
        console.log(`Access token expires in: ${Math.round(expiresIn / 60000)} minutes`);
        console.log(`Refresh token expires in: ${Math.round(refreshExpiresIn / 86400000)} days`);
        return;
      }

      if (subcommand === "info") {
        const info = await queryCreatorInfo(config);
        console.log(`Username: @${info.creatorUsername}`);
        console.log(`Nickname: ${info.creatorNickname}`);
        console.log(`Privacy options: ${info.privacyLevelOptions.join(", ")}`);
        console.log(`Max video duration: ${info.maxVideoPostDurationSec}s`);
        return;
      }

      console.log("Starting TikTok authorization...\n");
      const tokens = await startAuthFlow(config);
      console.log(`\nAuthorized successfully!`);
      console.log(`Open ID: ${tokens.openId}`);
      console.log(`Scopes: ${tokens.scope}`);
      return;
    }

    case "post": {
      const file = getFlag("file");
      const url = getFlag("url");
      const photos = getFlag("photos");
      const options = getPostOptions();

      if (file) {
        const publishId = await postVideoFromFile(config, file, options);
        const status = await checkPostStatus(config, publishId);
        console.log(`Status: ${status.status}`);
      } else if (url) {
        const publishId = await postVideoFromUrl(config, url, options);
        const status = await checkPostStatus(config, publishId);
        console.log(`Status: ${status.status}`);
      } else if (photos) {
        const photoUrls = photos.split(",").map((u) => u.trim());
        const publishId = await postPhoto(config, photoUrls, options);
        const status = await checkPostStatus(config, publishId);
        console.log(`Status: ${status.status}`);
      } else {
        console.error("Specify --file, --url, or --photos");
        process.exit(1);
      }
      return;
    }

    case "schedule": {
      const file = getFlag("file");
      const url = getFlag("url");
      const photos = getFlag("photos");
      const time = getFlag("time");
      const options = getPostOptions();

      if (!time) {
        console.error("--time is required (e.g., --time \"2026-04-11T10:00:00\")");
        process.exit(1);
      }

      let type: "video-file" | "video-url" | "photo" = "video-file";
      let source = "";
      let photoUrls: string[] | undefined;

      if (file) {
        type = "video-file";
        source = file;
      } else if (url) {
        type = "video-url";
        source = url;
      } else if (photos) {
        type = "photo";
        photoUrls = photos.split(",").map((u) => u.trim());
        source = photoUrls[0];
      } else {
        console.error("Specify --file, --url, or --photos");
        process.exit(1);
        return;
      }

      const post = schedulePost(config, {
        type,
        source,
        photoUrls,
        options,
        scheduledTime: time,
      });

      console.log(`Scheduled post ${post.id} for ${post.scheduledTime}`);
      return;
    }

    case "list": {
      const posts = listScheduledPosts(config);
      if (posts.length === 0) {
        console.log("No scheduled posts.");
        return;
      }

      console.log(`\n${"ID".padEnd(10)} ${"Type".padEnd(12)} ${"Status".padEnd(12)} ${"Scheduled For".padEnd(26)} Title`);
      console.log("-".repeat(80));
      for (const post of posts) {
        const title = post.options.title || "(no title)";
        console.log(
          `${post.id.padEnd(10)} ${post.type.padEnd(12)} ${post.status.padEnd(12)} ${post.scheduledTime.padEnd(26)} ${title}`
        );
      }
      console.log();
      return;
    }

    case "cancel": {
      const id = getFlag("id");
      if (!id) {
        console.error("--id is required");
        process.exit(1);
      }

      const post = cancelScheduledPost(config, id!);
      if (!post) {
        console.error(`Post ${id} not found`);
        process.exit(1);
      }
      console.log(`Cancelled post ${id}`);
      return;
    }

    case "generate": {
      const count = parseInt(getFlag("count") || "1", 10);

      if (hasFlag("dry-run")) {
        await dryRun(config, count);
        return;
      }

      if (hasFlag("history")) {
        const history = getHistory(config, 30);
        if (history.length === 0) {
          console.log("No content generated yet.");
          return;
        }
        console.log(`\n${"ID".padEnd(10)} ${"Category".padEnd(12)} ${"Type".padEnd(15)} ${"Status".padEnd(12)} Generated`);
        console.log("-".repeat(70));
        for (const r of history) {
          const date = new Date(r.generatedAt).toISOString().slice(0, 16);
          console.log(
            `${r.id.padEnd(10)} ${r.category.padEnd(12)} ${r.contentType.padEnd(15)} ${r.status.padEnd(12)} ${date}`
          );
        }
        console.log();
        return;
      }

      if (count === 1) {
        const result = await generateSingleContent(config);
        console.log(`\nImage generated successfully!`);
        console.log(`File: docs/inspire/images/${result.record.imageFilename}`);
        console.log(`URL: ${result.imageUrl}`);
        console.log(`Caption: ${result.caption.split("\n")[0]}`);

        // Write result to file for CI pipelines
        const { writeFileSync, mkdirSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        mkdirSync(config.dataDir, { recursive: true });
        writeFileSync(
          resolve(config.dataDir, "generate-result.json"),
          JSON.stringify({
            imageUrl: result.imageUrl,
            caption: result.caption,
            filename: result.record.imageFilename,
          }, null, 2)
        );
      } else {
        const results = await generateMultipleContent(config, count);
        console.log(`\n${results.length} image(s) generated:`);
        for (const r of results) {
          console.log(`  - ${r.record.imageFilename}: ${r.record.category}/${r.record.contentType}`);
        }
      }
      return;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
