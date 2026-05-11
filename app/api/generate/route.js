import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { liquor, mixer, addOn, isMocktail, mood, imageBase64 } = await req.json();

    const drinkType = isMocktail ? 'mocktail (non-alcoholic)' : 'cocktail';
    const moodLine = mood ? `The vibe/mood should be: ${mood}.` : '';

    let recipePrompt;

    if (imageBase64) {
      // Photo scan mode — identify ingredients and craft a recipe
      recipePrompt = `You are a world-class mixologist. The user has sent a photo of ingredients, bottles, a drink menu, or a cocktail.
Analyze the image and craft a creative ${drinkType} recipe based on what you see.
${moodLine}
${isMocktail ? 'This must be completely non-alcoholic — use juices, sodas, syrups, teas, and other non-alcoholic ingredients.' : ''}

Respond ONLY with valid JSON (no markdown, no code fences) in this exact format:
{
  "name": "Creative drink name",
  "description": "One enticing sentence describing the drink",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"]
}`;
    } else {
      const baseIngredients = [liquor, mixer, addOn].filter(Boolean).join(', ');
      const ingredientLine = baseIngredients
        ? `Using these ingredients: ${baseIngredients}.`
        : 'Surprise the user with a creative recipe using any ingredients you like.';

      recipePrompt = `You are a world-class mixologist. Create a unique, creative ${drinkType} recipe.
${ingredientLine}
${moodLine}
${isMocktail ? 'This must be completely non-alcoholic — use juices, sodas, syrups, teas, and other non-alcoholic ingredients.' : ''}

Respond ONLY with valid JSON (no markdown, no code fences) in this exact format:
{
  "name": "Creative drink name",
  "description": "One enticing sentence describing the drink",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"]
}`;
    }

    // Build messages array — include image if provided
    const messages = [
      {
        role: 'user',
        content: imageBase64
          ? [
              { type: 'text', text: recipePrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } },
            ]
          : recipePrompt,
      },
    ];

    // Generate recipe
    const recipeResponse = await openai.chat.completions.create({
      model: imageBase64 ? 'gpt-4o' : 'gpt-4o-mini',
      messages,
      max_tokens: 600,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    let recipe;
    try {
      // Strip markdown code fences GPT sometimes wraps around JSON
      const raw = recipeResponse.choices[0].message.content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      recipe = JSON.parse(raw);
    } catch {
      recipe = {
        name: 'Custom Creation',
        description: recipeResponse.choices[0].message.content,
        ingredients: [],
        steps: [],
      };
    }

    // Generate drink image
    let imageUrl = '';
    try {
      const imagePrompt = `A stunning, professional cocktail photography shot of "${recipe.name}".
${recipe.description}.
Dark moody bar atmosphere, cinematic lighting, shallow depth of field, garnished beautifully.
${isMocktail ? 'Non-alcoholic drink, vibrant fresh ingredients.' : 'Premium spirits, elegant glassware.'}
High-end editorial style, no text, no labels.`;

      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });
      imageUrl = imageResponse.data[0].url;
    } catch (imgErr) {
      console.error('Image generation failed:', imgErr.message);
    }

    return NextResponse.json({ ...recipe, imageUrl });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 });
  }
}
