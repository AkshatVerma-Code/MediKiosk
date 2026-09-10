// src/app/api/summary/route.ts
// Gemini AI — Generate structured physician-ready summary from clinical state

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { clinical_state, red_flags, documents, lang } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini key not set' }, { status: 500 });
    }

    const prompt = `You are a clinical documentation assistant. Generate a concise, structured physician-ready summary.

Clinical State (collected from patient interview):
${JSON.stringify(clinical_state, null, 2)}

Red Flags Detected:
${JSON.stringify(red_flags, null, 2)}

Previous Documents Extracted:
${JSON.stringify(documents, null, 2)}

Generate a structured summary in ${lang === 'hi' ? 'BOTH Hindi and English' : 'English'}.

Return ONLY valid JSON with no markdown code fences, no explanation, nothing else:
{
  "chief_complaint": "brief 1-line statement",
  "history_of_present_illness": "1-3 sentence narrative",
  "associated_symptoms": ["symptom1", "symptom2"],
  "past_medical_history": ["condition1"],
  "current_medications": [{"name": "drug", "dose": "dose or null", "frequency": "freq or null"}],
  "relevant_investigations": [{"name": "test", "value": "val", "status": "NORMAL or LOW or HIGH"}],
  "red_flags": ["flag description"],
  "priority": "URGENT",
  "summary_text": "2-3 sentence overall summary for the doctor",
  "ai_disclaimer": "This is an AI-generated summary based on patient-reported history. Clinical judgment required."
}

priority must be one of: URGENT, HIGH, ROUTINE
Be factual. Do not diagnose. Only report what was collected.
If a field has no data, use null or empty array.`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini summary error:', errText);
      return NextResponse.json({ error: 'Summary generation failed', detail: errText }, { status: 500 });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code fences if present
    const cleanText = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    let summary: Record<string, unknown> = {};
    try {
      summary = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('Summary parse error:', parseErr, 'Raw:', cleanText);
      // Return a fallback summary built from clinical state
      summary = buildFallbackSummary(clinical_state, red_flags);
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Summary route error:', err);
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 });
  }
}

function buildFallbackSummary(
  cs: Record<string, unknown>,
  redFlags: { rule_name: string; severity: string; description: string }[]
) {
  return {
    chief_complaint: cs.chief_complaint || 'Not specified',
    history_of_present_illness: `Patient presents with ${cs.chief_complaint || 'unspecified complaint'} for ${cs.onset || 'unspecified duration'}.`,
    associated_symptoms: [
      cs.breathlessness ? 'Breathlessness' : null,
      cs.sweating ? 'Sweating' : null,
      cs.dizziness ? 'Dizziness' : null,
      cs.nausea ? 'Nausea' : null,
    ].filter(Boolean),
    past_medical_history: cs.past_history || [],
    current_medications: cs.medications
      ? (cs.medications as string[]).map((m) => ({ name: m, dose: null, frequency: null }))
      : [],
    relevant_investigations: [],
    red_flags: redFlags.map((f) => f.description),
    priority: redFlags.some((f) => f.severity === 'HIGH') ? 'URGENT' : 'ROUTINE',
    summary_text: `Patient reports ${cs.chief_complaint || 'complaint'}. ${redFlags.length > 0 ? 'Red flags detected — immediate evaluation recommended.' : 'No immediate red flags detected.'}`,
    ai_disclaimer:
      'This is an AI-generated summary based on patient-reported history. Clinical judgment required.',
  };
}
