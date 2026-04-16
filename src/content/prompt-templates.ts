import { createHash } from "node:crypto";

export const BRAND_STYLE = "Style/medium: contemporary luxury editorial home lifestyle photography, shot on medium format digital. Lighting/mood: warm directional lighting with natural light accents, inviting and lived-in atmosphere. Color palette: warm earthy base (terracotta, olive, warm beige, natural wood) with bold saturated accents (cobalt blue, mustard, blush pink, navy, forest green). Materials/textures: bold patterns — stripes, gingham, checks, corduroy ribs, geometric prints — mixed with solid textures like bouclé, velvet, and chunky knit. Composition: eclectic editorial-curated styling with intentional layering, strong tonal contrast between product and backdrop, rooms that feel styled and lived-in. Constraints: no text, no logos, no watermarks, premium quality feel.";

export const CATEGORIES = ["bedding", "throws", "cushions", "towels", "rugs", "pillows"] as const;

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}
