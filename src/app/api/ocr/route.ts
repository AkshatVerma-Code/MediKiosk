// src/app/api/ocr/route.ts
// Mistral OCR + Gemini entity extraction pipeline

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const mistralKey = process.env.MISTRAL_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!mistralKey || !geminiKey) {
      return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    // Step 1: Upload to Mistral OCR
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'image_url',
          image_url: `data:${mimeType};base64,${base64}`,
        },
      }),
    });

    if (!ocrResponse.ok) {
      const err = await ocrResponse.text();
      console.error('Mistral OCR error:', err);
      return NextResponse.json({
        error: 'OCR failed',
        confidence: 'NEEDS_VERIFICATION',
        raw_text: '',
      }, { status: 500 });
    }

    const ocrData = await ocrResponse.json();
    const rawText = ocrData.pages?.map((p: { markdown: string }) => p.markdown).join('\n') || '';

    if (!rawText.trim()) {
      return NextResponse.json({
        confidence: 'NEEDS_VERIFICATION',
        raw_text: '',
        diagnosis: [],
        medications: [],
        labs: [],
      });
    }

    // Step 2: Gemini entity extraction
    const extractPrompt = `You are a medical document parser. Extract structured information from the following medical document text.

Document text:
"""
${rawText.slice(0, 3000)}
"""

Return ONLY valid JSON (no markdown, no explanation):
{
  "date": "YYYY-MM-DD or null",
  "diagnosis": ["condition1", "condition2"],
  "medications": [
    { "name": "drug name", "dose": "dose string or null", "frequency": "frequency or null" }
  ],
  "labs": [
    { "name": "test name", "value": "value", "unit": "unit or null", "reference_range": "range or null", "status": "NORMAL/LOW/HIGH/null" }
  ],
  "doctor": "doctor name or null",
  "hospital": "hospital name or null",
  "confidence": "HIGH or LOW or NEEDS_VERIFICATION"
}

If any field is uncertain or illegible, use null or empty array. Set confidence to NEEDS_VERIFICATION if critical info is unclear.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: extractPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      return NextResponse.json({ raw_text: rawText, confidence: 'NEEDS_VERIFICATION' });
    }

    const geminiData = await geminiResp.json();
    const extracted = JSON.parse(
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    );

    return NextResponse.json({ ...extracted, raw_text: rawText });
  } catch (err) {
    console.error('OCR route error:', err);
    return NextResponse.json({
      error: 'Document processing failed',
      confidence: 'NEEDS_VERIFICATION',
      raw_text: '',
    }, { status: 500 });
  }
}
