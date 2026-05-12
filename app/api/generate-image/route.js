import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { name, description, isMocktail } = await req.json();

    const imagePrompt = `A stunning professional cocktail photography shot of "${name}". ${description}. Dark moody bar atmosphere, cinematic lighting, shallow depth of field, garnished beautifully. ${isMocktail ? 'Non-alcoholic drink, vibrant fresh ingredients, colorful.' : 'Premium spirits, elegant glassware.'} High-end editorial style, no text, no labels.`;

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
    });

    const b64 = imageResponse.data[0].b64_json;
    const imageUrl = `data:image/png;base64,${b64}`;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('Image generation error:', err);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
