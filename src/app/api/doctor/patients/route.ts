// src/app/api/doctor/patients/route.ts
// Fetch today's patient sessions from Supabase for doctor dashboard

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    // Get today's date range (UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Fetch consultation sessions from today, joining patients and summaries
    let query = supabase
      .from('consultation_sessions')
      .select(`
        id,
        consultation_type,
        language,
        status,
        created_at,
        completed_at,
        patients!inner (
          id,
          name,
          age,
          gender,
          identity_reference
        ),
        summaries (
          id,
          summary_json,
          priority,
          status
        )
      `)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false });

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ patients: [], error: error.message }, { status: 500 });
    }

    // Transform into card-friendly data
    const patients = (sessions || [])
      .map((s: Record<string, unknown>) => {
        const patient = s.patients as Record<string, unknown> | Record<string, unknown>[] | null;
        const p = Array.isArray(patient) ? patient[0] : patient;
        const summaries = s.summaries as Record<string, unknown>[] | null;
        const summary = summaries && summaries.length > 0 ? summaries[0] : null;

        return {
          sessionId: s.id,
          patientId: p?.id || null,
          name: (p?.name as string) || 'Unknown',
          age: p?.age || null,
          gender: (p?.gender as string) || 'other',
          abhaId: (p?.identity_reference as string) || null,
          consultationType: s.consultation_type,
          status: s.status,
          createdAt: s.created_at,
          completedAt: s.completed_at,
          priority: summary?.priority || 'ROUTINE',
          summaryStatus: summary?.status || 'pending',
        };
      })
      .filter((p: { name: string; abhaId: string | null }) => {
        if (!search) return true;
        return (
          p.name.toLowerCase().includes(search) ||
          (p.abhaId && p.abhaId.toLowerCase().includes(search))
        );
      });

    return NextResponse.json({ patients });
  } catch (err) {
    console.error('Doctor patients route error:', err);
    return NextResponse.json({ patients: [], error: 'Failed to fetch patients' }, { status: 500 });
  }
}
