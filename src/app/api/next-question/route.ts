// src/app/api/next-question/route.ts
// Clinical question engine — disease-specific questioning with automatic severity scaling
// Completes immediately after disease-specific questions (typically 3-4) without asking all 12 points.

import { NextRequest, NextResponse } from 'next/server';
import { getDiseaseSpecificQuestion, detectDiseaseCategory } from '@/lib/questionEngine';
import { defaultClinicalState } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { clinical_state, question_count, lang } = await req.json();

    const currentCount = typeof question_count === 'number' ? question_count : 0;
    const currentState = clinical_state || defaultClinicalState;
    const disease = detectDiseaseCategory(currentState.chief_complaint);

    // Get disease-specific question (determines question based on disease & answered fields)
    const diseaseEngineQ = getDiseaseSpecificQuestion(currentState, currentCount, lang || 'hi');

    // If disease-specific questions are complete, OR safety cap reached:
    // IMMEDIATELY finalize the interview so the complete report can be created!
    if (diseaseEngineQ.is_complete || currentCount >= 5) {
      return NextResponse.json({
        ...diseaseEngineQ,
        is_complete: true,
      });
    }

    // Return the disease-specific question with scaled severity options
    return NextResponse.json(diseaseEngineQ);
  } catch (err) {
    console.error('Next-question route error:', err);
    const fallback = getDiseaseSpecificQuestion(defaultClinicalState, 0, 'hi');
    return NextResponse.json(fallback);
  }
}
