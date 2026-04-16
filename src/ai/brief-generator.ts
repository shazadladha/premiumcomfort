import { BRAND_STYLE, CATEGORIES } from "../content/prompt-templates.js";
import type { ContentRecord } from "../content/content-history.js";

export interface CreativeBrief {
  category: string;
  contentType: string;
  imagePrompt: string;
  title: string;
  caption: string;
  hashtags: string[];
}

export interface BriefContext {
  recentRecords: ContentRecord[];
  previousBriefs?: CreativeBrief[];
}

const CONTENT_TYPES = [
  "product-hero",
  "lifestyle",
  "flat-lay",
  "texture",
  "room-setting",
  "seasonal",
] as const;

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

const BRIEF_SCHEMA = {
  name: "creative_brief",
  strict: true,
  schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: [...CATEGORIES],
      },
      contentType: {
        type: "string",
        enum: [...CONTENT_TYPES],
      },
      imagePrompt: { type: "string" },
      title: { type: "string" },
      caption: { type: "string" },
      hashtags: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["category", "contentType", "imagePrompt", "title", "caption", "hashtags"],
    additionalProperties: false,
  },
};

function getSeasonalHint(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

const EXEMPLAR_PROMPTS = [
  `Scene/backdrop: warm beige studio background with a stainless steel rolling cart as prop. Subject: a vibrant stack of decorative cushions in mixed bold patterns — pink and red gingham, cobalt blue checks, green and cream stripes, orange striped bolsters — with ruffled and fringed edges. Composition/framing: full-length shot of the cart, products piled high and overflowing with personality. Lighting/mood: soft even studio lighting, warm and playful atmosphere. Materials/textures: gingham cotton, checked wool, striped linen, ruffled trim, fringed edges, bold saturated colours contrasting against each other. ${BRAND_STYLE}`,
  `Scene/backdrop: warm-toned living room with beige plastered walls, a low wooden bookshelf with ceramics and art books, abstract art on wall. Subject: a wide corduroy armchair in rich terracotta with a button-tufted cushion, sitting on an abstract colour-blocked rug in navy, tan, and burgundy. Composition/framing: three-quarter angle, medium shot, full room context visible. Lighting/mood: warm natural light from side, cosy and sophisticated. Materials/textures: wide-wale corduroy, tapered wooden legs, colour-blocked wool rug, matte ceramics, natural wood. ${BRAND_STYLE}`,
  `Scene/backdrop: bright, airy living room with light oak floors, large windows with sheer curtains, a rattan accent chair, fiddle leaf fig plant. Subject: a bold olive green area rug with a terracotta border and black-and-cream striped edges, anchoring a round wooden coffee table with a small vase of greenery. Composition/framing: elevated angle wide shot showing full rug and surrounding furniture. Lighting/mood: abundant natural daylight, fresh and inviting. Materials/textures: dense wool pile rug, striped woven border, natural oak, cream linen sofa, woven rattan, knitted pouf. ${BRAND_STYLE}`,
];

function buildSystemPrompt(): string {
  const exemplarBlock = EXEMPLAR_PROMPTS
    .map((p, i) => `Example ${i + 1}:\n${p}`)
    .join("\n\n");

  return `You are a creative director for Premium Comfort, a contemporary luxury home comfort brand. You generate creative briefs for product photography that will be used as prompts for AI image generation.

BRAND IDENTITY:
${BRAND_STYLE}

PRODUCT CATEGORIES (pick one per brief):
- bedding: sheets, duvet covers, pillowcases, bed sets. Materials: sateen, Egyptian cotton, percale. Patterns/colours: tonal stripes, contrast piping, warm whites with terracotta or olive accents.
- throws: throw blankets, knit throws, cashmere-blend throws. Materials: chunky knit, waffle weave, ribbed faux fur, cashmere-blend. Patterns/colours: colour-blocked panels, striped knit, bold single colours (mustard, blush, navy).
- cushions: cushion covers, decorative pillows, bolsters. Materials: bouclé, velvet, ribbed knit, brushed cotton, linen. Patterns/colours: gingham, stripes, checks, ruffled or fringed edges, bold mixed colours (cobalt, pink, olive, terracotta).
- towels: bath towels, hand towels, bath mats, bath accessories. Materials: Turkish cotton, dense loop pile. Patterns/colours: contrast stripe details, warm whites, terracotta or sage accents.
- rugs: area rugs, runners, layering rugs. Materials: dense wool pile, woven cotton, jute. Patterns/colours: geometric borders, striped edges, colour-blocked abstract, bold centre colours (olive, navy, terracotta) with contrasting borders.
- pillows: bed pillows, euro shams, decorative bed pillows. Materials: sateen, percale, bouclé. Patterns/colours: contrast flanges, striped shams, layered arrangements mixing patterns and solids.

CONTENT TYPES (pick one per brief):
- product-hero: single product as focal point, beauty shot
- lifestyle: product in use, lived-in moment, aspirational but relatable
- flat-lay: overhead/top-down arrangement, editorial styling
- texture: extreme close-up/macro of fabric or material detail
- room-setting: wide shot showing product in full room context
- seasonal: product tied to current season or time of day

IMAGE PROMPT RULES:
1. Structure every prompt as labeled lines: Scene/backdrop -> Subject -> Composition/framing -> Lighting/mood -> Materials/textures -> then end with the full brand style block.
2. Write as a real photography brief. Use photography language: lens implications (wide, tight, macro), depth of field, directional lighting, framing.
3. Be highly specific. Name exact materials (sateen weave, bouclé loops, Turkish cotton loop pile), exact lighting conditions (golden hour side light, soft diffused overcast), exact compositions (three-quarter angle, top-down flat lay, eye-level centered).
4. Include intended use context (social media product photography) to set the level of polish.
5. ALLOWED augmentation: composition/framing cues, practical layout guidance, reasonable scene concreteness (specific furniture pieces, architectural elements, complementary objects that naturally belong in the scene).
6. DO NOT add: extra characters or people, arbitrary left/right placement decisions, text overlays, logos, or watermarks.
7. Every prompt MUST end with: "${BRAND_STYLE}"
8. Photorealistic-natural style: prompt as if capturing a real photograph. Call for real textures, real materials, real lighting. No over-stylised polish.
9. Vary your scenes, backdrops, lighting conditions, and compositions. Do not default to the same room or setup each time.
10. BOLD COLOUR AND PATTERN: Always include at least one bold pattern (stripes, gingham, checks, geometric, corduroy) or saturated colour (terracotta, cobalt, olive, mustard, navy, blush pink). Avoid all-neutral or all-muted compositions.
11. STRONG CONTRAST: Products must pop against their backgrounds. Pair bold products with neutral backdrops, or neutral products with bold accent pieces. Never let everything blend into the same tonal range.
12. LAYERED STYLING: Rooms and scenes should feel curated and lived-in — include complementary accessories (plants, ceramics, books, art, rugs, lamps). Avoid sparse, single-product-on-empty-surface compositions.

TITLE RULES:
- Short, punchy, scroll-stopping hook that makes people pause
- Maximum 90 characters
- Must NOT repeat the caption — the title is a teaser, the caption tells the story
- Conversational, intriguing, or evocative — think "the line that stops the scroll"
- No emojis. No hashtags. No ALL CAPS.
- British English spelling

CAPTION RULES:
- 1-2 sentences, conversational luxury tone
- Evocative, not salesy. Suggest a feeling or moment, not a product specification.
- No emojis. No excessive exclamation marks.
- British English spelling (colour, favourite, centre)

HASHTAG RULES:
- Exactly 5 hashtags
- First hashtag is always #PremiumComfort
- Remaining 4 should be relevant to the specific content (mix of niche and discoverable tags)
- Use PascalCase (#LuxuryBedding not #luxurybedding)

EXAMPLES OF GOOD IMAGE PROMPTS:
${exemplarBlock}`;
}

function buildUserMessage(context: BriefContext): string {
  const season = getSeasonalHint();
  const parts: string[] = [
    "Generate one creative brief for Premium Comfort social media content.",
    `Current season: ${season}.`,
  ];

  if (context.recentRecords.length > 0) {
    const summaries = context.recentRecords.slice(-10).map(
      (r) =>
        `- ${r.category}/${r.contentType}: ${r.prompt.slice(0, 80)}...`
    );
    parts.push(
      "Recently generated content (avoid repeating these categories, content types, and scenes):",
      ...summaries
    );
  }

  if (context.previousBriefs && context.previousBriefs.length > 0) {
    const batchSummaries = context.previousBriefs.map(
      (b) =>
        `- ${b.category}/${b.contentType}: ${b.imagePrompt.slice(0, 80)}...`
    );
    parts.push(
      "Already generated in this batch (pick a DIFFERENT category and content type):",
      ...batchSummaries
    );
  }

  return parts.join("\n");
}

export async function generateBrief(
  apiKey: string,
  context: BriefContext
): Promise<CreativeBrief> {
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(context);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_schema", json_schema: BRIEF_SCHEMA },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      throw new Error(`OpenAI rate limit exceeded. Try again later. ${body}`);
    }
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const json: OpenAIChatResponse = await res.json();

  if (json.error) {
    throw new Error(`OpenAI error: ${json.error.message}`);
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from OpenAI chat completion");
  }

  return JSON.parse(content) as CreativeBrief;
}

export async function generateMultipleBriefs(
  apiKey: string,
  count: number,
  context: BriefContext
): Promise<CreativeBrief[]> {
  const briefs: CreativeBrief[] = [];
  const runningContext: BriefContext = {
    recentRecords: context.recentRecords,
    previousBriefs: [...(context.previousBriefs || [])],
  };

  for (let i = 0; i < count; i++) {
    const brief = await generateBrief(apiKey, runningContext);
    briefs.push(brief);
    runningContext.previousBriefs!.push(brief);
  }

  return briefs;
}
