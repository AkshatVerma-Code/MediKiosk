// src/app/api/tts/route.ts
// Sarvam AI — Text-to-Speech (Bulbul model)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Sarvam API key not set' }, { status: 500 });
    }

    const languageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const speaker = 'priya'; // Sarvam bulbul:v3 voice option

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [text.slice(0, 500)], // limit length
        target_language_code: languageCode,
        speaker,
        model: 'bulbul:v3',
        pitch: 0,
        pace: 1.1,
        loudness: 1.5,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Sarvam TTS error:', err);
      return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
    }

    const data = await response.json();
    // Sarvam returns base64 audio
    return NextResponse.json({ audio_base64: data.audios?.[0] || null });
  } catch (err) {
    console.error('TTS route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
