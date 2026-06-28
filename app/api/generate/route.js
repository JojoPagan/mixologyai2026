import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { liquor, mixer, addOn, isMocktail, mood, imageBase64, drinkType: userDrinkType } =
      await req.json();

    // Resolve drinkType from explicit user input first (e.g. "Spritz",
    // "Highball", "Old Fashioned"). Fall back to the binary cocktail/mocktail
    // when not provided. Mocktail flag still wins for the non-alcoholic
    // constraint regardless of what the user typed.
    const baseCategory = isMocktail ? 'mocktail (non-alcoholic)' : 'cocktail';
    const drinkType =
      userDrinkType && typeof userDrinkType === 'string' && userDrinkType.trim()
        ? `${userDrinkType.trim()}${isMocktail ? ' (non-alcoholic)' : ''}`
        : baseCategory;
    const moodLine = mood ? `The vibe/mood should be: ${mood}.` : '';

    let recipePrompt;

    if (imageBase64) {
      recipePrompt = `You are a world-class mixologist. The user has sent a photo.

FIRST: decide whether the photo actually contains anything edible or drinkable — that is, ANY food, beverage, snack, candy, baked good, dessert, packaged food, fresh produce, herb, spice, sauce, syrup, condiment, dairy item, tea, coffee, soda, juice, water, spirit, wine, liqueur, mixer, garnish, a drink menu, or an existing cocktail / mocktail glass. A creative mixologist can draw flavor inspiration from anything edible — a donut suggests vanilla / glaze / cinnamon notes; a protein bar suggests chocolate / nut / caramel; a chocolate bar suggests cocoa / dessert profile; a piece of fruit suggests its juice and aroma. Treat ALL of these as valid inputs.

ONLY respond with the NO_INGREDIENTS error if the photo contains NOTHING edible or drinkable — for example: a person with no food in frame, a pet, outdoor scenery with no food, a screen / phone / laptop alone, a vehicle, a tool, an empty room, or pure abstract / random non-food objects. When in doubt, treat it as a valid input and craft a creative drink inspired by it.

If you must respond with the error, use EXACTLY this JSON and nothing else:
{ "error": "NO_INGREDIENTS", "detail": "short note describing what you actually saw" }

Otherwise, craft a creative ${drinkType} recipe inspired by what you see. You may translate the flavor profile of a non-beverage food (e.g. donut → vanilla syrup + glaze rim; protein bar → chocolate bitters + hazelnut orgeat) into proper mixology ingredients. You can add standard bar pantry items (ice, water, simple syrup, citrus, common spirits / mixers appropriate to the drink type) to complete the recipe. The visible item should clearly drive the flavor direction.
${moodLine}
${isMocktail ? 'This must be completely non-alcoholic — use juices, sodas, syrups, teas, and other non-alcoholic ingredients.' : ''}

Respond ONLY with valid JSON (no markdown, no code fences) in this exact format:
{
  "name": "Creative drink name",
  "description": "One enticing sentence describing the drink",
  "caption": "A short editorial line in second person about WHO this drink is for or WHEN to pour it — feels like a curated bar journal entry, not a tagline",
  "glassware": "<choose the specific glass that fits this drink>",
  "garnish": "<choose a garnish that actually pairs with THIS drink — match its flavor, theme, and visual story; do NOT default to a citrus twist unless the drink genuinely calls for one>",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
  "flavorProfile": ["<3-5 short flavor descriptors actually present in this drink>"]
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
  "caption": "A short editorial line in second person about WHO this drink is for or WHEN to pour it — feels like a curated bar journal entry, not a tagline",
  "glassware": "<choose the specific glass that fits this drink>",
  "garnish": "<choose a garnish that actually pairs with THIS drink — match its flavor, theme, and visual story; do NOT default to a citrus twist unless the drink genuinely calls for one>",
  "ingredients": ["ingredient 1 with amount", "ingredient 2 with amount"],
  "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
  "flavorProfile": ["<3-5 short flavor descriptors actually present in this drink>"]
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
          content: 'You are a world-class mixologist with the voice of a curated bar journal. Always respond with valid JSON only — no markdown, no extra text. Use exactly these fields: name (string), description (string — one enticing sentence about the drink itself), caption (string — a SHORT editorial line, 6–12 words, in the same curated bar-journal voice, describing the moment or mood this drink belongs to, not what\'s in it. Examples: "A quiet anchor for cold-rain Sundays.", "For the third drink, when the room softens.", "A bright pour for slow Tuesday afternoons."), glassware (string — the specific glass that actually fits THIS drink, e.g. "Coupe", "Highball", "Rocks", "Nick & Nora", "Collins", "Martini", "Champagne flute", "Copper mug", "Irish coffee mug", "Hurricane", "Tiki mug"), garnish (string — **must pair with the actual drink you\'re making; pick something that matches its theme, flavor, and visual story; do NOT fall back to a citrus twist unless the drink genuinely calls for it.** Examples by drink style: a S\'mores cocktail → "Toasted marshmallow with a graham cracker rim"; a tiki drink → "Pineapple fronds and a brandied cherry"; a smoky old fashioned → "Charred orange peel and a smoked rosemary sprig"; a coffee martini → "Three coffee beans"; a margarita → "Salt rim with a lime wheel"; a mojito → "Fresh mint sprig and a sugar cane stick"; a French 75 → "Lemon twist"; a chocolate-cherry mocktail → "Dark chocolate shaving with a fresh cherry". Match the drink. Always.), ingredients (array of strings), steps (array of strings), flavorProfile (array of 3-5 short flavor descriptors that are actually present in this drink — pick from a wide palette like "Sweet", "Smoky", "Citrusy", "Herbal", "Bitter", "Spicy", "Tropical", "Creamy", "Tart", "Earthy", "Floral", "Nutty", "Toasted", "Roasted", "Caramelized", "Chocolatey", "Fruity", "Crisp", "Boozy", "Refreshing").',
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
        caption: '',
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
