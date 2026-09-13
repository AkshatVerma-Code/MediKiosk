// src/app/api/stt/route.ts
// Sarvam AI — Speech-to-Text (Saaras model)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const lang = formData.get('lang') as string || 'hi';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Sarvam API key not set' }, { status: 500 });
    }

    // Map lang to Sarvam language code
    const languageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';

    // Determine appropriate filename & extension based on incoming MIME type
    const mimeType = audioFile.type || '';
    let filename = 'recording.webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      filename = 'recording.mp4';
    } else if (mimeType.includes('wav')) {
      filename = 'recording.wav';
    } else if (mimeType.includes('ogg') || mimeType.includes('opus')) {
      filename = 'recording.ogg';
    }

    const sarvamFormData = new FormData();
    sarvamFormData.append('file', audioFile, filename);
    sarvamFormData.append('model', 'saarika:v2.5');
    sarvamFormData.append('language_code', languageCode);
    sarvamFormData.append('with_timestamps', 'false');

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: sarvamFormData,
      signal: AbortSignal.timeout(30000) // Increase timeout to 30s
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Sarvam STT error:', response.status, err);
      return NextResponse.json({ error: 'STT failed', details: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ transcript: data.transcript || '' });
  } catch (err) {
    console.error('STT route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
