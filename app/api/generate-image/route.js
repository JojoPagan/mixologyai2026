import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { prompt, isMocktail } = await req.json();

    const fullPrompt = `${prompt}. Dark moody bar atmosphere, cinematic lighting, beautiful garnish. ${isMocktail ? 'Vibrant colorful non-alcoholic drink.' : 'Premium spirits, elegant glassware.'} No text, no labels.`;

    const imageResponse = await openai.images.generate({
      model: 'dall-e-2',
      prompt: fullPrompt.slice(0, 1000), // dall-e-2 max 1000 chars
      n: 1,
      size: '512x512',
    });

    const imageUrl = imageResponse.data[0].url;
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('Image generation error:', err);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
