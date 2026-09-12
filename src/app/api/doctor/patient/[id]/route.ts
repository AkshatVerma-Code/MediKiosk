// src/app/api/doctor/patient/[id]/route.ts
// Fetch full details for a single patient session

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const supabase = createServiceClient();

    // Fetch session with patient info
    const { data: session, error: sessionErr } = await supabase
      .from('consultation_sessions')
      .select(`
        *,
        patients (*)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch clinical state
    const { data: clinicalState } = await supabase
      .from('clinical_state')
      .select('structured_json')
      .eq('session_id', sessionId)
      .single();

    // Fetch conversation messages
    const { data: messages } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    // Fetch red flags
    const { data: redFlags } = await supabase
      .from('red_flags')
      .select('*')
      .eq('session_id', sessionId);

    // Fetch summary
    const { data: summary } = await supabase
      .from('summaries')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    // Fetch documents + extracted data
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        *,
        extracted_medical_data (*)
      `)
      .eq('session_id', sessionId);

    const patient = Array.isArray(session.patients) ? session.patients[0] : session.patients;

    return NextResponse.json({
      session: {
        id: session.id,
        consultationType: session.consultation_type,
        language: session.language,
        status: session.status,
        createdAt: session.created_at,
        completedAt: session.completed_at,
      },
      patient: patient ? {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        abhaId: patient.identity_reference,
      } : null,
      clinicalState: clinicalState?.structured_json || {},
      messages: messages || [],
      redFlags: (redFlags || []).map((f: Record<string, unknown>) => ({
        rule_name: f.rule_name,
        severity: f.severity,
        description: f.description,
      })),
      summary: summary?.summary_json || null,
      summaryMeta: summary ? {
        priority: summary.priority,
        status: summary.status,
        doctorNotes: summary.doctor_notes,
      } : null,
      documents: (documents || []).map((doc: Record<string, unknown>) => {
        const extracted = Array.isArray(doc.extracted_medical_data)
          ? doc.extracted_medical_data[0]
          : doc.extracted_medical_data;
        return {
          id: doc.id,
          uploadDate: doc.upload_date,
          extractedData: extracted?.extracted_json || null,
          confidence: extracted?.confidence || 'NEEDS_VERIFICATION',
          rawText: extracted?.raw_text || '',
        };
      }),
    });
  } catch (err) {
    console.error('Patient detail route error:', err);
    return NextResponse.json({ error: 'Failed to fetch patient details' }, { status: 500 });
  }
}
