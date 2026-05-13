import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { prompt, isMocktail } = await req.json();

    const fullPrompt = `${prompt}. Dark moody bar atmosphere, cinematic lighting, beautiful garnish. ${isMocktail ? 'Vibrant colorful non-alcoholic drink.' : 'Premium spirits, elegant glassware.'} No text, no labels.`;

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: fullPrompt.slice(0, 4000),
      n: 1,
      size: '1024x1024',
      quality: 'medium',
    });

    // gpt-image-1 returns b64_json (no `url` field). Send as data URI so the
    // client can use it directly in <Image source={{ uri }} />.
    const b64 = imageResponse.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${b64}`;
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('Image generation error:', err?.message || err, err?.status, err?.code);
    return NextResponse.json({ error: 'Image generation failed', detail: err?.message }, { status: 500 });
  }
}
