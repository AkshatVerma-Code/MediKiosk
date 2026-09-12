// src/app/api/summary/route.ts
// Generate complete, structured physician-ready clinical report from disease interview

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { clinical_state, red_flags, documents, lang } = await req.json();

    const mistralKey = process.env.MISTRAL_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const isHi = lang === 'hi';

    const prompt = `You are an expert clinical documentation specialist at a hospital kiosk.
Create a comprehensive, complete, professional Physician Clinical Report based on the patient history collected.

Clinical State Collected:
${JSON.stringify(clinical_state, null, 2)}

Note: "additional_findings" inside the clinical state above holds complaint-specific
questions/answers that the dynamic intake AI asked but that don't fit the fixed fields
(e.g. for an animal bite: which animal, vaccination status, wound care done). ALWAYS
weave any entries found there into the narrative below — never ignore or drop them.

Red Flags Detected:
${JSON.stringify(red_flags, null, 2)}

Existing Uploaded Documents:
${JSON.stringify(documents, null, 2)}

Language requested: ${isHi ? 'Hindi (Devanagari script)' : 'English'}

Generate a structured, complete report. Return ONLY valid JSON with no markdown formatting:
{
  "chief_complaint": "Chief complaint with duration (in ${isHi ? 'Hindi' : 'English'})",
  "history_of_present_illness": "Detailed clinical narrative describing onset, character, severity, radiation, aggravating/relieving factors, AND any complaint-specific additional_findings (in ${isHi ? 'Hindi' : 'English'})",
  "severity_assessment": {
    "score": ${clinical_state?.severity || 3},
    "level": "${clinical_state?.severity && clinical_state.severity >= 8 ? 'SEVERE' : clinical_state?.severity && clinical_state.severity >= 4 ? 'MODERATE' : 'MILD'}",
    "description": "Severity description with clinical implications"
  },
  "associated_symptoms": ["list of positive associated symptoms"],
  "past_medical_history": ["known past conditions or None reported"],
  "current_medications": [{"name": "drug", "dose": "dose or null", "frequency": "frequency or null"}],
  "relevant_investigations": [{"name": "investigation", "value": "value", "status": "NORMAL"}],
  "red_flags": ["list of red flag warnings detected"],
  "priority": "URGENT or HIGH or ROUTINE",
  "recommended_actions": ["1-3 clinical recommendations for triage doctor"],
  "summary_text": "2-4 sentence cohesive clinical synthesis for the physician (in ${isHi ? 'Hindi' : 'English'})",
  "ai_disclaimer": "This is an AI-assisted clinical intake report. Physician evaluation and clinical examination required."
}`;

    // 1. Try Mistral AI if available
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
            temperature: 0.2,
          }),
        });

        if (mistralResp.ok) {
          const mData = await mistralResp.json();
          const rawMText = mData.choices?.[0]?.message?.content || '{}';
          const cleanMText = rawMText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsed = JSON.parse(cleanMText);
          if (parsed.chief_complaint || parsed.summary_text) {
            return NextResponse.json({ summary: parsed });
          }
        }
      } catch (mErr) {
        console.warn('Mistral summary generation failed, falling back:', mErr);
      }
    }

    // 2. Try Gemini if available
    if (geminiKey) {
      try {
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
        const gResp = await fetch(`${geminiUrl}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
          }),
        });

        if (gResp.ok) {
          const gData = await gResp.json();
          const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsed = JSON.parse(cleanText);
          return NextResponse.json({ summary: parsed });
        }
      } catch (gErr) {
        console.warn('Gemini summary generation failed, falling back:', gErr);
      }
    }

    // 3. Robust, complete deterministic fallback report
    const fallbackSummary = buildCompleteFallbackSummary(clinical_state || {}, red_flags || [], isHi);
    return NextResponse.json({ summary: fallbackSummary });
  } catch (err) {
    console.error('Summary route error:', err);
    return NextResponse.json({ summary: buildCompleteFallbackSummary({}, [], false) });
  }
}

function buildCompleteFallbackSummary(
  cs: Record<string, any>,
  redFlags: { rule_name?: string; severity?: string; description?: string }[],
  isHi: boolean
) {
  const sevScore = typeof cs.severity === 'number' ? cs.severity : 4;
  const sevLevel = sevScore >= 9 ? 'CRITICAL' : sevScore >= 7 ? 'SEVERE' : sevScore >= 4 ? 'MODERATE' : 'MILD';
  const hasRedFlags = redFlags.length > 0;
  const priority = hasRedFlags || sevScore >= 8 ? 'URGENT' : sevScore >= 5 ? 'HIGH' : 'ROUTINE';

  const symptomsList: string[] = [];
  if (Array.isArray(cs.associated_symptoms)) {
    symptomsList.push(...cs.associated_symptoms);
  } else if (typeof cs.associated_symptoms === 'string' && cs.associated_symptoms) {
    symptomsList.push(cs.associated_symptoms);
  }
  if (cs.breathlessness) symptomsList.push(isHi ? 'सांस लेने में तकलीफ (Breathlessness)' : 'Breathlessness');
  if (cs.sweating) symptomsList.push(isHi ? 'ठंडा पसीना (Cold Sweating)' : 'Cold Sweating');
  if (cs.dizziness) symptomsList.push(isHi ? 'चक्कर व आंखों में अंधेरा (Dizziness)' : 'Dizziness');
  if (cs.nausea) symptomsList.push(isHi ? 'जी मिचलाना व उल्टी (Nausea/Vomiting)' : 'Nausea / Vomiting');

  const chief = cs.chief_complaint || (isHi ? 'स्वास्थ्य समस्या' : 'Health Complaint');
  const onset = cs.onset || (isHi ? 'हाल ही में शुरू' : 'Recent onset');
  const character = cs.character ? ` (${cs.character})` : '';
  const location = cs.location ? (isHi ? `, स्थान: ${cs.location}` : `, Site: ${cs.location}`) : '';
  const radiation = cs.radiation ? (isHi ? `, फैलाव: ${cs.radiation}` : `, Radiation: ${cs.radiation}`) : '';

  // Complaint-specific Q&A that the dynamic question engine asked but that
  // doesn't fit a fixed field (e.g. for an animal bite: which animal, wound
  // care, vaccination status). Always fold these into the narrative so
  // nothing gets silently dropped, even in this fully-offline fallback.
  const additionalFindings: { field?: string; question?: string; answer?: string }[] =
    Array.isArray(cs.additional_findings) ? cs.additional_findings : [];
  const findingsNarrative = additionalFindings.length > 0
    ? (isHi
        ? ' अतिरिक्त जानकारी: ' + additionalFindings.map(f => `${f.question || f.field} — ${f.answer}`).join('; ') + '.'
        : ' Additional findings: ' + additionalFindings.map(f => `${f.question || f.field} — ${f.answer}`).join('; ') + '.')
    : '';

  const hpi = isHi
    ? `रोगी ने "${chief}" की शिकायत दर्ज की है, जो ${onset} से है${character}${location}${radiation}। गंभीरता स्तर ${sevScore}/10 (${sevLevel}) आंका गया है।${findingsNarrative}`
    : `Patient presents with ${chief} of ${onset} duration${character}${location}${radiation}. Severity scaled at ${sevScore}/10 (${sevLevel}).${findingsNarrative}`;

  const summaryNarrative = isHi
    ? `रोगी को ${chief} की समस्या है (${onset})। कुल गंभीरता स्तर ${sevScore}/10 (${sevLevel}) है। ${hasRedFlags ? 'चेतावनी संकेत (Red Flags) मौजूद हैं — तुरंत डॉक्टर जांच आवश्यक है।' : 'प्राथमिक जांच व लक्षणों के अनुसार डॉक्टर परामर्श की सलाह दी जाती है।'}`
    : `Patient reports ${chief} with onset ${onset}. Overall severity scaled at ${sevScore}/10 (${sevLevel}). ${hasRedFlags ? 'Red flags detected — urgent clinical evaluation recommended.' : 'Routine outpatient medical consultation recommended.'}`;

  return {
    chief_complaint: `${chief} (${onset})`,
    history_of_present_illness: hpi,
    severity_assessment: {
      score: sevScore,
      level: sevLevel,
      description: isHi
        ? `गंभीरता स्कोर ${sevScore}/10 (${sevLevel})`
        : `Severity score ${sevScore}/10 (${sevLevel})`,
    },
    associated_symptoms: Array.from(new Set(symptomsList)),
    past_medical_history: cs.past_history || (isHi ? ['कोई ज्ञात पुरानी बीमारी नहीं बताई गई'] : ['None reported']),
    current_medications: Array.isArray(cs.medications)
      ? cs.medications.map((m: string) => ({ name: m, dose: null, frequency: null }))
      : [],
    relevant_investigations: [],
    red_flags: redFlags.map((f) => f.description || f.rule_name || 'Warning indicator'),
    priority,
    recommended_actions: [
      isHi ? 'चिकित्सक द्वारा शारीरिक परीक्षण (Physical exam by physician)' : 'Clinical examination by physician',
      hasRedFlags || sevScore >= 8
        ? (isHi ? 'तत्काल ईसीजी / आवश्यक रक्त जांच व वाइटल्स निगरानी' : 'Urgent vitals monitoring, ECG/Stat labs')
        : (isHi ? 'दवा एवं घरेलू उपचार संबंधी निर्देश' : 'Prescription medication and care instructions'),
    ],
    summary_text: summaryNarrative,
    ai_disclaimer: isHi
      ? 'यह AI-जनित प्राथमिक इतिहास सारांश है। चिकित्सक द्वारा प्रत्यक्ष जांच अनिवार्य है।'
      : 'This is an AI-assisted clinical intake report. Physician evaluation and clinical examination required.',
  };
}
