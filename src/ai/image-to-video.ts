import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export function imageToVideo(
  imagePath: string,
  outputPath: string,
  durationSec = 5
): string {
  const outputDir = resolve(outputPath, "..");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Create a video from static image with a subtle slow zoom (Ken Burns effect)
  execFileSync("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-c:v", "libx264",
    "-t", String(durationSec),
    "-pix_fmt", "yuv420p",
    "-vf", "scale=1080:1920,zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1080x1920:fps=25",
    "-r", "25",
    outputPath,
  ], { stdio: "pipe" });

  console.log(`Video created: ${outputPath}`);
  return outputPath;
}
