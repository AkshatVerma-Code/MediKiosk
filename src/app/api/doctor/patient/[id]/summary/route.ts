// src/app/api/doctor/patient/[id]/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionId = params.id;
    const body = await req.json();
    const { summary_json, status } = body;

    const supabase = createServiceClient();
    
    // Build update payload
    const updates: Record<string, unknown> = {};
    if (summary_json !== undefined) updates.summary_json = summary_json;
    if (status !== undefined) updates.status = status;
    
    if (Object.keys(updates).length > 0) {
      if (status === 'accepted') {
        updates.reviewed_at = new Date().toISOString();
      } else if (summary_json !== undefined && !status) {
        // If we are just editing, mark as edited unless we specify a new status
        updates.status = 'edited';
      }
      
      const { error } = await supabase
        .from('summaries')
        .update(updates)
        .eq('session_id', sessionId);
        
      if (error) {
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update summary:', err);
    return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 });
  }
}
