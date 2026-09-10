// src/app/api/extract/route.ts
// Gemini API — extract structured clinical data from patient's natural language answer

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { question_id, question_field, answer, clinical_state, lang } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not set' }, { status: 500 });
    }

    const prompt = `You are a clinical assistant extracting structured medical information.

Current clinical state:
${JSON.stringify(clinical_state, null, 2)}

Question field: "${question_field}"
Patient's answer (in ${lang === 'hi' ? 'Hindi/Hinglish' : 'English'}): "${answer}"

Extract information from the patient's answer and return a JSON object with ONLY the fields that can be determined from this answer.
For boolean fields (breathlessness, sweating, dizziness, nausea, previous_episode): return true or false.
For severity: return a number 1-10.
For array fields (aggravating_factors, relieving_factors, past_history, medications, allergies, associated_symptoms): return an array of strings.
For string fields: return a concise English string.

Return ONLY a single valid JSON object exactly in this shape:
{
  "updated_state": {
    "the_field_name_extracted": "extracted_value"
  }
}
Do NOT include explanation, markdown formatting, or code fences. Only output raw JSON.`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Strip markdown fences if present
    const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    try {
      const parsed = JSON.parse(cleanText);
      // Ensure the return format matches what the client expects
      if (parsed.updated_state) {
        return NextResponse.json(parsed);
      } else {
        return NextResponse.json({ updated_state: parsed });
      }
    } catch {
      return NextResponse.json({ updated_state: {} });
    }
  } catch (err) {
    console.error('Extract route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
