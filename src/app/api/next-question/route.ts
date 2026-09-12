// src/app/api/next-question/route.ts
// Dynamic clinical question engine — an LLM decides the single most clinically
// useful next question based on the FULL conversation so far, for ANY complaint
// (not just a fixed list of diseases). It keeps asking only as many questions
// as are clinically necessary and decides for itself when enough has been
// gathered (`is_complete`), instead of stopping at a fixed question count.
//
// If the AI call fails for any reason (no API key, network error, bad/invalid
// response), we fall back to the deterministic disease-pathway engine in
// questionEngine.ts so the demo never breaks.

import { NextRequest, NextResponse } from 'next/server';
import { getDiseaseSpecificQuestion } from '@/lib/questionEngine';
import { defaultClinicalState, KNOWN_CLINICAL_FIELDS } from '@/lib/store';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

// Absolute safety net — NOT communicated to the model as a target. This only
// exists to guarantee the interview can never run away indefinitely if the
// model keeps returning is_complete: false.
const ABSOLUTE_MAX_QUESTIONS = 12;

interface NextQuestionResult {
  question: string;
  options: string[];
  field: string;
  is_complete: boolean;
  reasoning?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { clinical_state, conversation_history, question_count, lang } = await req.json();

    const currentCount = typeof question_count === 'number' ? question_count : 0;
    const currentState = clinical_state || defaultClinicalState;
    const history = Array.isArray(conversation_history) ? conversation_history : [];
    const language = lang === 'en' ? 'en' : 'hi';

    // The very first question (chief complaint) doesn't need the LLM — it's
    // always the same deterministic opener. Guard here too in case this route
    // is ever called before a chief complaint is set.
    if (!currentState.chief_complaint) {
      return NextResponse.json(getDiseaseSpecificQuestion(currentState, currentCount, language));
    }

    // Hard safety cap — force completion regardless of what the model says.
    if (currentCount >= ABSOLUTE_MAX_QUESTIONS) {
      return NextResponse.json({
        question: '',
        options: [],
        field: 'completed',
        is_complete: true,
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const dynamicQ = await getDynamicQuestion(currentState, history, currentCount, language, geminiKey);
        if (dynamicQ) return NextResponse.json(dynamicQ);
      } catch (err) {
        console.warn('Dynamic next-question (Gemini) failed, falling back to rule engine:', err);
      }
    }

    // Fallback: deterministic disease-pathway engine (works with no API key).
    return NextResponse.json(getDiseaseSpecificQuestion(currentState, currentCount, language));
  } catch (err) {
    console.error('Next-question route error:', err);
    const fallback = getDiseaseSpecificQuestion(defaultClinicalState, 0, 'hi');
    return NextResponse.json(fallback);
  }
}

async function getDynamicQuestion(
  state: Record<string, unknown>,
  history: { speaker: string; text: string }[],
  count: number,
  lang: 'hi' | 'en',
  apiKey: string
): Promise<NextQuestionResult | null> {
  const langLabel = lang === 'hi' ? 'Hindi (Devanagari script)' : 'English';
  const knownFields = KNOWN_CLINICAL_FIELDS.join(', ');

  const prompt = `You are an expert clinical intake assistant conducting a focused, adaptive patient history interview at a hospital kiosk before the doctor consultation. Ask ONE question at a time, and dynamically decide the single most clinically useful next question — for ANY type of complaint (injury, animal/insect bite, poisoning, burn, allergic reaction, fever, pain, cough, skin issue, pregnancy-related, mental health, etc.), not just common ones. You must think like an experienced triage doctor, not follow a script.

Chief complaint: "${state.chief_complaint}"

Full clinical state collected so far (fixed fields + any complaint-specific findings already recorded in additional_findings):
${JSON.stringify(state, null, 2)}

Conversation so far:
${history.map(h => `${h.speaker}: ${h.text}`).join('\n')}

Your task — decide the SINGLE next question to ask:
1. Reason like a doctor taking a focused history for THIS SPECIFIC complaint. Examples of the kind of reasoning expected (apply the same logic to ANY complaint, including ones not listed):
   - "Dog/animal bite" → which animal, provoked or unprovoked, exact body location, time since bite, bleeding/wound depth, whether the wound was cleaned, vaccination/rabies risk.
   - "Chest pain" → onset, character, radiation, breathlessness, sweating, sudden vs gradual onset.
   - "Fever" → duration/pattern, associated chills/rash/cough/neck stiffness.
   - "Allergic reaction" → suspected trigger, swelling location, difficulty breathing/swallowing, past history of severe allergy.
2. NEVER re-ask something already answered in clinical_state (including additional_findings) or the conversation above. If the patient's last answer didn't clearly address your previous question, you may ask ONE clarified/rephrased version of it at most — if it still isn't answered after that, DROP that angle entirely and move to a genuinely different, more productive question instead of asking a third similar variant. Never ask about the same underlying field/topic more than twice in total.
3. Prioritize red-flag / safety-relevant questions early (uncontrolled bleeding, breathing difficulty, severe/worsening pain, loss of consciousness, spreading swelling, high fever with red flags, etc.).
4. Pick a "field" name for what this question targets:
   - Use one of these standard fields if it truly fits: ${knownFields}.
   - If none fit (e.g. "which animal", "wound cleaned or not", "vaccination status"), invent a short, descriptive snake_case field name specific to this question — that is expected and fine for complaint-specific details.
5. Give 4-6 short, tappable multiple-choice options in ${langLabel} covering realistic answers.
6. Decide "is_complete": true once you have gathered enough FOCUSED clinical information for a doctor to safely triage this specific complaint — there is NO fixed number of questions to hit. A simple, low-risk complaint may only need 2-4 follow-ups total; a complex or red-flag complaint may genuinely need 6-8. Judge sufficiency, don't chase a quota.
7. Be decisive about finishing, don't pad the interview:
   - If severity/character/onset are known, no red flags have appeared, and the patient has already given a clear negative to a general "anything else / other symptoms" style question, that is a strong signal to set is_complete: true — do not keep hunting for additional rare red flags one by one.
   - If the last 1-2 answers were simple denials/negatives ("no", "nothing else", "I'm fine", "not sure") and you already have the core picture (timing + severity/nature + a basic safety check), COMPLETE the interview instead of asking yet another red-flag screening question.
   - Only keep going past 5-6 questions if there is a genuinely concerning/red-flag answer still being actively investigated.
8. This is question number ${count + 1} of the interview. The higher this number gets, the more strongly you should lean towards completing once the core angles (timing, severity/nature, red flags, and complaint-specific risk factors) are covered — avoid asking marginal or repetitive questions just to keep going.

Return ONLY valid JSON, no markdown fences, no extra text:
{
  "question": "question text in ${langLabel}",
  "options": ["option1", "option2", "option3", "option4"],
  "field": "field_name",
  "is_complete": false,
  "reasoning": "one short internal sentence, never shown to the patient"
}

If you determine no more questions are needed, instead return exactly:
{"question": "", "options": [], "field": "completed", "is_complete": true}`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini next-question error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const parsed = JSON.parse(cleanText);

  // Validate shape before trusting it — fall back if malformed.
  if (parsed.is_complete) {
    return { question: '', options: [], field: 'completed', is_complete: true };
  }
  if (typeof parsed.question !== 'string' || !parsed.question.trim() || !Array.isArray(parsed.options) || typeof parsed.field !== 'string' || !parsed.field.trim()) {
    return null;
  }

  return {
    question: parsed.question,
    options: parsed.options.filter((o: unknown) => typeof o === 'string').slice(0, 6),
    field: parsed.field,
    is_complete: false,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
  };
}
