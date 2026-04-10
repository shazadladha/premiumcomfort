import sharp from "sharp";

export interface GeneratedImage {
  data: Buffer;
  prompt: string;
  model: string;
  generatedAt: string;
}

interface OpenAIImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  options: { size?: string; quality?: string } = {}
): Promise<GeneratedImage> {
  const size = options.size || "1024x1536";
  const quality = options.quality || "high";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      throw new Error(`OpenAI rate limit exceeded. Try again later. ${body}`);
    }
    if (res.status === 400 && body.includes("content_policy_violation")) {
      throw new Error(`Content policy violation: prompt was rejected by OpenAI. ${body}`);
    }
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }

  const json: OpenAIImageResponse = await res.json();

  if (json.error) {
    throw new Error(`OpenAI error: ${json.error.message}`);
  }

  const b64 = json.data[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data returned from OpenAI");
  }

  const rawBuffer = Buffer.from(b64, "base64");

  const resizedBuffer = await sharp(rawBuffer)
    .resize(1080, 1920, { fit: "cover" })
    .png()
    .toBuffer();

  return {
    data: resizedBuffer,
    prompt,
    model: "gpt-image-1",
    generatedAt: new Date().toISOString(),
  };
}
