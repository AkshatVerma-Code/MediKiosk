// src/app/api/session/route.ts
// Save and load session data to/from Supabase

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient, clinicalState, messages, redFlags, documents, language, consultationType, consentGiven } = body;

    const supabase = createServiceClient();

    // 1. Upsert patient
    const { data: patientRow, error: patientErr } = await supabase
      .from('patients')
      .upsert({
        name: patient?.name || 'Unknown',
        age: patient?.age ? parseInt(patient.age) : null,
        gender: patient?.gender || 'other',
        identity_reference: patient?.abhaId || null,
      })
      .select()
      .single();

    if (patientErr) {
      console.error('Patient upsert error:', patientErr);
      return NextResponse.json({ error: 'Failed to save patient' }, { status: 500 });
    }

    // 2. Create consultation session
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('consultation_sessions')
      .insert({
        patient_id: patientRow.id,
        consultation_type: consultationType || 'general',
        language: language || 'hi',
        status: 'complete',
        consent_given: consentGiven || false,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionErr) {
      console.error('Session insert error:', sessionErr);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const sessionId = sessionRow.id;

    // 3. Save clinical state
    await supabase.from('clinical_state').upsert({
      session_id: sessionId,
      structured_json: clinicalState || {},
    });

    // 4. Save conversation messages
    if (messages && messages.length > 0) {
      await supabase.from('conversation_messages').insert(
        messages.map((m: { speaker: string; text: string; timestamp: string }) => ({
          session_id: sessionId,
          speaker: m.speaker,
          text: m.text,
          timestamp: m.timestamp,
        }))
      );
    }

    // 5. Save red flags
    if (redFlags && redFlags.length > 0) {
      await supabase.from('red_flags').insert(
        redFlags.map((f: { rule_name: string; severity: string; description: string }) => ({
          session_id: sessionId,
          rule_name: f.rule_name,
          severity: f.severity,
          description: f.description,
        }))
      );
    }

    // 6. Save extracted documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const { data: docRow } = await supabase
          .from('documents')
          .insert({ patient_id: patientRow.id, session_id: sessionId })
          .select()
          .single();

        if (docRow) {
          await supabase.from('extracted_medical_data').insert({
            document_id: docRow.id,
            session_id: sessionId,
            extracted_json: doc,
            confidence: doc.confidence || 'NEEDS_VERIFICATION',
            raw_text: doc.raw_text || '',
          });
        }
      }
    }

    return NextResponse.json({ success: true, session_id: sessionId, patient_id: patientRow.id });
  } catch (err) {
    console.error('Session save error:', err);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}
