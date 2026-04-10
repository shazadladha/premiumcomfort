import { BRAND_STYLE, CATEGORIES } from "../content/prompt-templates.js";
import type { ContentRecord } from "../content/content-history.js";

export interface CreativeBrief {
  category: string;
  contentType: string;
  imagePrompt: string;
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
      caption: { type: "string" },
      hashtags: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["category", "contentType", "imagePrompt", "caption", "hashtags"],
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
  `Scene/backdrop: contemporary bedroom with dark upholstered headboard and concrete accent wall. Subject: beautifully styled king-size bed with crisp white sateen sheets and layered pillows in ivory and charcoal. Composition/framing: wide shot, eye-level, bed centered. Lighting/mood: warm directional light from side, soft shadows. Materials/textures: sateen weave sheets, velvet pillows, brushed brass bedside lamp. ${BRAND_STYLE}`,
  `Scene/backdrop: contemporary living room, rain visible through the window. Subject: cashmere-blend throw artfully draped on a sofa, with a cup of tea and an open book. Composition/framing: medium-wide shot, natural framing through window light. Lighting/mood: overcast diffused light, intimate and cosy atmosphere. Materials/textures: cashmere-blend knit, dark upholstery, matte ceramic cup. ${BRAND_STYLE}`,
  `Scene/backdrop: neutral background. Subject: extreme close-up of thick Turkish cotton towel showing dense loop pile, soft white colour with subtle charcoal stripe detail. Composition/framing: extreme close-up macro, shallow depth of field. Lighting/mood: soft directional side light, highlighting loop pile texture. Materials/textures: Turkish cotton loop pile, individual loops visible, woven stripe detail. ${BRAND_STYLE}`,
];

function buildSystemPrompt(): string {
  const exemplarBlock = EXEMPLAR_PROMPTS
    .map((p, i) => `Example ${i + 1}:\n${p}`)
    .join("\n\n");

  return `You are a creative director for Premium Comfort, a contemporary luxury home comfort brand. You generate creative briefs for product photography that will be used as prompts for AI image generation.

BRAND IDENTITY:
${BRAND_STYLE}

PRODUCT CATEGORIES (pick one per brief):
- bedding: sheets, duvet covers, pillowcases, bed sets. Materials: sateen, Egyptian cotton, percale.
- throws: throw blankets, knit throws, cashmere-blend throws. Materials: chunky knit, waffle weave, ribbed faux fur, cashmere-blend.
- cushions: cushion covers, decorative pillows. Materials: bouclé, velvet, ribbed knit, brushed cotton.
- towels: bath towels, hand towels, bath mats, bath accessories. Materials: Turkish cotton, dense loop pile.
- fragrance: candles, reed diffusers, room sprays, linen mists. Materials: soy wax, stone vessels, frosted glass.
- loungewear: robes, pyjama sets, lounge sets, slippers. Materials: brushed cotton jersey, lightweight cotton, cashmere knit.

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
6. DO NOT add: extra characters or people, brand palettes or colours not established in the brand identity, arbitrary left/right placement decisions, text overlays, logos, or watermarks.
7. Every prompt MUST end with: "${BRAND_STYLE}"
8. Photorealistic-natural style: prompt as if capturing a real photograph. Call for real textures, real materials, real lighting. No over-stylised polish.
9. Vary your scenes, backdrops, lighting conditions, and compositions. Do not default to the same room or setup each time.

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
