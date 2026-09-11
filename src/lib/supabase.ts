// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const match = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (match) return `https://${match[1]}.supabase.co`;
  if (typeof window === 'undefined') {
    // Server-side (API routes/build) — warn loudly instead of silently pointing
    // at someone else's Supabase project when the env var isn't configured.
    console.warn('NEXT_PUBLIC_SUPABASE_URL is not set — Supabase calls will fail until it is configured.');
  }
  return 'https://placeholder.supabase.co';
}

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for API routes only)
export function createServiceClient() {
  return createClient(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    { auth: { persistSession: false } }
  );
}
