// src/app/api/extract/route.ts
// Extract structured clinical data from patient's natural language answer

import { NextRequest, NextResponse } from 'next/server';
import { calculateScaledSeverity } from '@/lib/questionEngine';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

export async function POST(req: NextRequest) {
  try {
    const { question_field, answer, clinical_state, lang } = await req.json();

    const geminiKey = process.env.GEMINI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;

    // Helper for deterministic extraction fallback
    const extractFallback = () => {
      const lower = (answer || '').toLowerCase();
      const updated: Record<string, any> = {};

      if (question_field === 'chief_complaint') {
        updated.chief_complaint = answer;
      } else if (question_field === 'onset') {
        updated.onset = answer;
      } else if (question_field === 'severity') {
        const scaled = calculateScaledSeverity(answer, 'severity', clinical_state?.severity);
        updated.severity = scaled.score;
      } else if (question_field === 'location') {
        updated.location = answer;
      } else if (question_field === 'character') {
        updated.character = answer;
      } else if (question_field === 'radiation') {
        updated.radiation = answer;
      } else if (question_field === 'associated_symptoms') {
        const existing = Array.isArray(clinical_state?.associated_symptoms) ? [...clinical_state.associated_symptoms] : [];
        if (!existing.includes(answer)) existing.push(answer);
        updated.associated_symptoms = existing;
      } else if (question_field === 'aggravating_factors') {
        const existing = Array.isArray(clinical_state?.aggravating_factors) ? [...clinical_state.aggravating_factors] : [];
        if (!existing.includes(answer)) existing.push(answer);
        updated.aggravating_factors = existing;
      } else if (['breathlessness', 'sweating', 'dizziness', 'nausea', 'previous_episode'].includes(question_field)) {
        updated[question_field] = lower.includes('हाँ') || lower.includes('yes') || lower.includes('ha') || lower.includes('true');
      } else {
        updated[question_field] = answer;
      }

      // Check for scaled severity cues in any answer
      const scaled = calculateScaledSeverity(answer, question_field || '', clinical_state?.severity);
      if (scaled.score > (clinical_state?.severity || 0) || question_field === 'severity') {
        updated.severity = scaled.score;
      }

      // Auto-extract red flag symptoms
      if (lower.includes('सांस') || lower.includes('breath')) updated.breathlessness = true;
      if (lower.includes('पसीना') || lower.includes('sweat')) updated.sweating = true;
      if (lower.includes('चक्कर') || lower.includes('dizzy')) updated.dizziness = true;
      if (lower.includes('उल्टी') || lower.includes('vomit') || lower.includes('जी मिचलाना') || lower.includes('nausea')) updated.nausea = true;

      return updated;
    };

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

    if (geminiKey) {
      try {
        const response = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsed = JSON.parse(cleanText);
          return NextResponse.json(parsed.updated_state ? parsed : { updated_state: parsed });
        }
      } catch (geminiErr) {
        console.warn('Gemini extract failed, falling back:', geminiErr);
      }
    }

    if (mistralKey) {
      try {
        const mistralModel = process.env.MISTRAL_MODEL || 'open-mistral-7b';
        const mistralResp = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mistralKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: mistralModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          }),
        });

        if (mistralResp.ok) {
          const mData = await mistralResp.json();
          const rawMText = mData.choices?.[0]?.message?.content || '{}';
          const cleanMText = rawMText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsedM = JSON.parse(cleanMText);
          return NextResponse.json(parsedM.updated_state ? parsedM : { updated_state: parsedM });
        }
      } catch (mistralErr) {
        console.warn('Mistral extract failed, falling back:', mistralErr);
      }
    }

    // Deterministic fallback
    return NextResponse.json({ updated_state: extractFallback() });
  } catch (err) {
    console.error('Extract route error:', err);
    return NextResponse.json({ updated_state: {} });
  }
}
