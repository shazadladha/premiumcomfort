import { createHash } from "node:crypto";

export const BRAND_STYLE = "Style/medium: contemporary luxury editorial home lifestyle photography, shot on medium format digital. Lighting/mood: controlled directional lighting with warm accents, sophisticated and inviting atmosphere. Color palette: deep charcoal and ivory contrast with brushed brass details. Materials/textures: bouclé, ribbed faux fur, polished concrete, sculptural forms. Composition: gallery-curated minimalist framing. Constraints: no text, no logos, no watermarks, premium quality feel.";

export const CATEGORIES = ["bedding", "throws", "cushions", "towels", "rugs", "pillows"] as const;

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}
