// src/app/api/ocr/route.ts
// OCR pipeline: Mistral OCR → Gemini entity extraction
// Fallback: Gemini Vision (image → structured data in one shot)

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-3.5-flash';

function extractJsonFromText(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null;
  let clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    console.warn('JSON parse error in OCR extraction:', err);
    return null;
  }
}

function determineConfidence(result: Record<string, unknown>): 'HIGH' | 'NEEDS_VERIFICATION' {
  const hasMeds = Array.isArray(result.medications) && result.medications.length > 0;
  const hasLabs = Array.isArray(result.labs) && result.labs.length > 0;
  const hasDiagnosis = Array.isArray(result.diagnosis) && result.diagnosis.length > 0;
  const hasDoctorOrClinic = Boolean(result.doctor || result.hospital);

  if (hasMeds || hasLabs || hasDiagnosis || hasDoctorOrClinic) {
    return 'HIGH';
  }
  return (result.confidence as string) === 'HIGH' ? 'HIGH' : 'NEEDS_VERIFICATION';
}

function parseBasicMedicalText(rawText: string): {
  diagnosis: string[];
  medications: { name: string; dose: string | null; frequency: string | null }[];
  labs: { name: string; value: string; unit: string | null; reference_range: string | null; status: string | null }[];
} {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const medications: { name: string; dose: string | null; frequency: string | null }[] = [];
  const labs: { name: string; value: string; unit: string | null; reference_range: string | null; status: string | null }[] = [];

  for (const line of lines) {
    const medMatch = line.match(/(?:Tab(?:let)?|Cap(?:sule)?|Syp|T\.|Inj|Rx)\s+([A-Za-z0-9\-\s]+?)(?:\s+(\d+(?:\.\d+)?\s*(?:mg|ml|gm|mcg|IU)))?(?:\s+(.*))?$/i);
    if (medMatch) {
      medications.push({
        name: medMatch[1].trim(),
        dose: medMatch[2]?.trim() || null,
        frequency: medMatch[3]?.trim() || null,
      });
    }

    const bpMatch = line.match(/(?:B\.?P\.?|Blood Pressure)\s*[:=]?\s*(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) {
      labs.push({ name: 'BP', value: bpMatch[1], unit: 'mmHg', reference_range: '120/80', status: 'NORMAL' });
    }
    const tempMatch = line.match(/(?:Temp(?:erature)?)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?\s*°?[FC]?)/i);
    if (tempMatch) {
      labs.push({ name: 'Temperature', value: tempMatch[1], unit: null, reference_range: null, status: null });
    }
    const spo2Match = line.match(/(?:SPO2|SpO2|Pulse Ox)\s*[:=]?\s*(\d{2,3}\s*%?)/i);
    if (spo2Match) {
      labs.push({ name: 'SPO2', value: spo2Match[1], unit: '%', reference_range: '>95%', status: 'NORMAL' });
    }
  }

  return { diagnosis: [], medications, labs };
}

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
          const confidence = determineConfidence(result);
          return NextResponse.json({
            ...result,
            confidence,
            raw_text: rawText,
          });
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
          const confidence = determineConfidence(result);
          return NextResponse.json({
            ...result,
            confidence,
            raw_text: result.raw_text || rawText || '[Extracted via Gemini Vision]',
          });
        }
      } catch (gvErr) {
        console.warn('Gemini Vision extraction failed:', gvErr);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 3: If we at least got raw text from Mistral OCR
    // Extract medications and vitals via fallback parser
    // ──────────────────────────────────────────────────────────────────
    if (rawText.trim()) {
      const parsed = parseBasicMedicalText(rawText);
      const confidence = (parsed.medications.length > 0 || parsed.labs.length > 0) ? 'HIGH' : 'NEEDS_VERIFICATION';
      return NextResponse.json({
        raw_text: rawText,
        confidence,
        diagnosis: parsed.diagnosis,
        medications: parsed.medications,
        labs: parsed.labs,
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
  const extractPrompt = `You are an expert clinical document parser. Extract structured information from the following medical document text.

Document text:
"""
${rawText.slice(0, 4000)}
"""

Return ONLY valid JSON (no markdown, no backticks, no conversational filler):
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
  "hospital": "hospital or clinic name or null",
  "confidence": "HIGH or NEEDS_VERIFICATION"
}

CRITICAL RULES:
1. If the text has identifiable medicines, dosages, vitals, doctor names, or clinic details, ALWAYS extract them thoroughly into the arrays and set "confidence": "HIGH".
2. Only set "confidence": "NEEDS_VERIFICATION" if the text is completely garbled or contains no readable clinical data.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const resp = await fetch(`${geminiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: extractPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) {
    console.warn('Gemini text extraction HTTP error:', resp.status, await resp.text());
    return null;
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || '').join('\n');
  return extractJsonFromText(text);
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
  const visionPrompt = `You are an expert clinical document parser with OCR capabilities. Look at this medical document image carefully.

First, read all the text you can see in the image. Then extract structured medical information.

Return ONLY valid JSON (no markdown, no backticks, no conversational filler):
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
  "hospital": "hospital or clinic name or null",
  "confidence": "HIGH or NEEDS_VERIFICATION"
}

CRITICAL RULES:
1. Read all medicines, prescription lines, test values, and clinic details clearly.
2. If medicines, tests, or clinical notes are legible, ALWAYS extract them and set "confidence": "HIGH". Only set "confidence": "NEEDS_VERIFICATION" if the image is truly illegible.`;

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
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) {
    console.warn('Gemini Vision API error:', resp.status, await resp.text());
    return null;
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || '').join('\n');
  return extractJsonFromText(text);
}
