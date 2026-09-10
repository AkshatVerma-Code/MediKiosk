// src/app/api/next-question/route.ts
// Gemini-powered dynamic question engine
// Decides what to ask NEXT based on chief complaint + conversation so far

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { clinical_state, conversation_history, question_count, lang } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini key not set' }, { status: 500 });
    }

    const langLabel = lang === 'hi' ? 'Hindi (Devanagari script)' : 'English';

    const prompt = `You are a clinical assistant helping a doctor take patient history at a hospital kiosk.

Current clinical state collected so far:
${JSON.stringify(clinical_state, null, 2)}

Conversation so far (${question_count} questions asked):
${conversation_history.map((m: { speaker: string; text: string }) => `${m.speaker}: ${m.text}`).join('\n')}

Your task: Decide what single question to ask NEXT.

Rules:
1. Ask in ${langLabel}. Keep it very simple — the patient may be elderly.
2. Focus on the chief complaint. Ask SOCRATES-style: Site, Onset, Character, Radiation, Associated symptoms, Time course, Exacerbating/Relieving factors, Severity.
3. CRITICAL: If \`chief_complaint\` is null, ask "What is the main problem you are facing today?"
4. CRITICAL: If \`chief_complaint\` is NOT null, YOU MUST ASK A DIFFERENT QUESTION about missing details (e.g., onset, severity, location). Look at the current clinical state and pick a field that is currently null or empty.
5. Always provide 4-6 tap options relevant to the disease (in ${langLabel}).
6. Do NOT re-ask something already answered in the conversation history or already filled in the clinical state.
7. After 10-12 questions, OR if all important fields are filled, set \`is_complete\` to true.
8. For red-flag symptoms (breathlessness with chest pain, severe pain 8+), prioritize those questions early.

Return ONLY valid JSON, no markdown fences:
{
  "question": "question text in ${langLabel}",
  "options": ["option1", "option2", "option3", "option4"],
  "field": "clinical_state field name this maps to (e.g. chief_complaint, onset, severity, breathlessness)",
  "is_complete": false,
  "reasoning": "brief note on why this question"
}

field must be one of: chief_complaint, onset, duration, location, severity, character, radiation, breathlessness, sweating, dizziness, nausea, aggravating_factors, relieving_factors, previous_episode, past_history, medications, allergies, associated_symptoms`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini next-question error:', err);
      return NextResponse.json({ error: 'Failed to generate question' }, { status: 500 });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    try {
      const parsed = JSON.parse(cleanText);
      return NextResponse.json(parsed);
    } catch {
      // Fallback — ask chief complaint if nothing works
      return NextResponse.json({
        question: lang === 'hi'
          ? 'आज आपको मुख्य रूप से क्या तकलीफ है?'
          : 'What is the main problem you are facing today?',
        options: lang === 'hi'
          ? ['सीने में दर्द', 'पेट में दर्द', 'बुखार', 'सिरदर्द', 'अन्य']
          : ['Chest pain', 'Stomach pain', 'Fever', 'Headache', 'Other'],
        field: 'chief_complaint',
        is_complete: false,
      });
    }
  } catch (err) {
    console.error('Next-question route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
