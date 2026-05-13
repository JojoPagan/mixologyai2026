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
      recipePrompt = `You are a world-class mixologist. The user has sent a photo of ingredients, bottles, a drink menu, or a cocktail.
Analyze the image and craft a creative ${drinkType} recipe based on what you see.
${moodLine}
${isMocktail ? 'This must be completely non-alcoholic — use juices, sodas, syrups, teas, and other non-alcoholic ingredients.' : ''}

Respond ONLY with valid JSON (no markdown, no code fences) in this exact format:
{
  "name": "Creative drink name",
  "description": "One enticing sentence describing the drink",
  "glassware": "Coupe",
  "garnish": "Lemon twist",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
  "flavorProfile": ["Sweet", "Citrusy", "Refreshing"]
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
  "glassware": "Coupe",
  "garnish": "Lemon twist",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
  "flavorProfile": ["Sweet", "Citrusy", "Refreshing"]
}`;
    }

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

    // gpt-4.1-nano for text (fast), gpt-4.1-mini for vision (better multimodal)
    const recipeResponse = await openai.chat.completions.create({
      model: imageBase64 ? 'gpt-4.1-mini' : 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a world-class mixologist. Always respond with valid JSON only — no markdown, no extra text. Use exactly these fields: name (string), description (string), glassware (string — the specific glass the drink should be served in, e.g. "Coupe", "Highball", "Rocks", "Nick & Nora", "Collins", "Martini", "Champagne flute", "Copper mug"), garnish (string — the garnish, e.g. "Lemon twist", "Orange peel and Luxardo cherry", "Fresh mint sprig", "Cucumber ribbon"), ingredients (array of strings), steps (array of strings), flavorProfile (array of 3-5 short flavor descriptor strings like "Sweet", "Smoky", "Citrusy", "Herbal", "Bitter", "Spicy", "Tropical", "Creamy", "Tart", "Earthy").',
        },
        ...messages,
      ],
      max_tokens: 800,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    let recipe;
    try {
      const raw = recipeResponse.choices[0].message.content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      recipe = JSON.parse(raw);
    } catch {
      recipe = {
        name: 'Custom Creation',
        description: recipeResponse.choices[0].message.content,
        glassware: '',
        garnish: '',
        ingredients: [],
        steps: [],
        flavorProfile: [],
      };
    }

    return NextResponse.json(recipe);
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 });
  }
}
