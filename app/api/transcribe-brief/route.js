import OpenAI, { toFile } from 'openai';
import { NextResponse } from 'next/server';

/**
 * Voice brief → structured craft slots.
 *
 * Flow:
 *   1. Accept { audioBase64, mimeType } in JSON.
 *   2. Whisper transcribes the audio.
 *   3. gpt-4.1-nano extracts {drinkType, ingredients, vibe, isMocktail}
 *      from the transcript.
 *   4. Return { transcript, drinkType, ingredients, vibe, isMocktail }.
 *
 * The client then auto-populates the sentence card so the user can verify
 * before tapping Craft.
 */
export async function POST(req) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { audioBase64, mimeType = 'audio/m4a' } = await req.json();
    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // 1) Transcribe with Whisper.
    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'wav';
    const audioFile = await toFile(buffer, `brief.${ext}`, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'en',
      response_format: 'json',
    });
    const transcript = (transcription.text ?? '').trim();
    if (!transcript) {
      return NextResponse.json({
        transcript: '',
        drinkType: '',
        ingredients: '',
        vibe: '',
        isMocktail: false,
      });
    }

    // 2) Extract structured slots.
    const sys = `You are parsing a voice brief from someone asking a bartender for a drink. Return ONLY valid JSON in this exact shape:
{
  "drinkType": string,          // The kind of drink — e.g. "Cocktail", "Mocktail", "Spritz", "Highball", "Martini", "Old Fashioned". "" if not mentioned.
  "ingredients": string,        // Comma-separated list of ingredients mentioned — e.g. "gin, elderflower, lime". "" if none.
  "vibe": string,               // The mood, flavor profile, or feeling — e.g. "cozy", "refreshing", "smoky and spicy". "" if not mentioned.
  "isMocktail": boolean         // true if the brief is alcohol-free: explicit mocktail / non-alcoholic / virgin / zero-proof / "no alcohol" / "without alcohol".
}
Rules:
- Output ONLY JSON, no prose, no code fences.
- Keep each value short and human-readable.
- Capitalize drinkType. Use lowercase for vibe and ingredients.
- If the user says "mocktail", "non-alcoholic", "virgin", or "zero-proof", set isMocktail=true and drinkType="Mocktail".
- If the user says "cocktail", set isMocktail=false unless other cues override.
- Ignore anything that's clearly small talk or unrelated.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: transcript },
      ],
      max_tokens: 200,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      transcript,
      drinkType: typeof parsed.drinkType === 'string' ? parsed.drinkType : '',
      ingredients: typeof parsed.ingredients === 'string' ? parsed.ingredients : '',
      vibe: typeof parsed.vibe === 'string' ? parsed.vibe : '',
      isMocktail: !!parsed.isMocktail,
    });
  } catch (err) {
    console.error('transcribe-brief error:', err?.message || err, err?.status);
    return NextResponse.json(
      { error: 'Voice brief failed', detail: err?.message },
      { status: 500 },
    );
  }
}
