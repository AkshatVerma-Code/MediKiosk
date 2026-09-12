// src/app/api/ocr/route.ts
// OCR pipeline: Mistral OCR → Gemini entity extraction
// Fallback: Gemini Vision (image → structured data in one shot)

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-3.5-flash';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;

    // Convert file to base64 once — used by both Mistral and Gemini Vision
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    let rawText = '';

    // ──────────────────────────────────────────────────────────────────
    // Step 1: Try Mistral OCR to extract raw text from the image
    // ──────────────────────────────────────────────────────────────────
    if (mistralKey) {
      try {
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

        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json();
          rawText = ocrData.pages?.map((p: { markdown: string }) => p.markdown).join('\n') || '';
        } else {
          console.warn('Mistral OCR returned error:', ocrResponse.status, await ocrResponse.text());
        }
      } catch (mErr) {
        console.warn('Mistral OCR network error:', mErr);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 2a: If Mistral produced text → use Gemini text extraction
    // ──────────────────────────────────────────────────────────────────
    if (rawText.trim() && geminiKey) {
      try {
        const result = await geminiTextExtraction(geminiKey, rawText);
        if (result) {
          return NextResponse.json({ ...result, raw_text: rawText });
        }
      } catch (gErr) {
        console.warn('Gemini text extraction failed:', gErr);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 2b: Gemini Vision fallback — send the image directly
    // This handles cases where Mistral OCR failed or is unavailable
    // ──────────────────────────────────────────────────────────────────
    if (geminiKey) {
      try {
        const result = await geminiVisionExtraction(geminiKey, base64, mimeType);
        if (result) {
          return NextResponse.json({
            ...result,
            raw_text: result.raw_text || rawText || '[Extracted via Gemini Vision]',
          });
        }
      } catch (gvErr) {
        console.warn('Gemini Vision extraction failed:', gvErr);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 3: If we at least got raw text but extraction failed
    // ──────────────────────────────────────────────────────────────────
    if (rawText.trim()) {
      return NextResponse.json({
        raw_text: rawText,
        confidence: 'NEEDS_VERIFICATION',
        diagnosis: [],
        medications: [],
        labs: [],
      });
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 4: Total failure
    // ──────────────────────────────────────────────────────────────────
    return NextResponse.json({
      error: 'Could not process document. Please ensure the image is clear and try again.',
      confidence: 'NEEDS_VERIFICATION',
      raw_text: '',
      diagnosis: [],
      medications: [],
      labs: [],
    }, { status: 500 });
  } catch (err) {
    console.error('OCR route error:', err);
    return NextResponse.json({
      error: 'Document processing failed',
      confidence: 'NEEDS_VERIFICATION',
      raw_text: '',
      diagnosis: [],
      medications: [],
      labs: [],
    }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════════════════
// Gemini text-based entity extraction (when we already have OCR text)
// ════════════════════════════════════════════════════════════════════════
async function geminiTextExtraction(
  apiKey: string,
  rawText: string
): Promise<Record<string, unknown> | null> {
  const extractPrompt = `You are a medical document parser. Extract structured information from the following medical document text.

Document text:
"""
${rawText.slice(0, 4000)}
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

If any field is uncertain or illegible, use null or empty array. Set confidence to NEEDS_VERIFICATION only if critical info is truly unclear. If you can read most of the document clearly, set confidence to HIGH.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const resp = await fetch(`${geminiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: extractPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  if (!clean) return null;

  return JSON.parse(clean);
}

// ════════════════════════════════════════════════════════════════════════
// Gemini Vision extraction — sends the image directly to Gemini
// Used as fallback when Mistral OCR is unavailable or fails
// ════════════════════════════════════════════════════════════════════════
async function geminiVisionExtraction(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<Record<string, unknown> | null> {
  const visionPrompt = `You are a medical document parser with OCR capabilities. Look at this medical document image carefully.

First, read all the text you can see in the image. Then extract structured medical information.

Return ONLY valid JSON (no markdown, no explanation):
{
  "raw_text": "All readable text from the document",
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

If you can read most of the document clearly, set confidence to HIGH. Only set NEEDS_VERIFICATION if the image is truly illegible.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const resp = await fetch(`${geminiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: visionPrompt },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) {
    console.warn('Gemini Vision API error:', resp.status);
    return null;
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  if (!clean) return null;

  return JSON.parse(clean);
}
