'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import RedFlagAlert from '@/components/RedFlagAlert';
import { loadSession, saveSession, defaultSession, AppSession } from '@/lib/store';
import { CheckCircle2, Hospital, RotateCcw } from 'lucide-react';
import styles from './page.module.css';

interface AISummary {
  chief_complaint?: string;
  history_of_present_illness?: string;
  severity_assessment?: { score?: number; level?: string; description?: string };
  associated_symptoms?: string[];
  past_medical_history?: string[];
  current_medications?: { name: string; dose?: string; frequency?: string }[];
  relevant_investigations?: { name: string; value?: string; status?: string }[];
  red_flags?: string[];
  priority?: 'URGENT' | 'HIGH' | 'ROUTINE';
  recommended_actions?: string[];
  summary_text?: string;
  ai_disclaimer?: string;
}

/**
 * Safely converts any value to a displayable string.
 * Handles cases where the AI returns an object instead of a string field.
 */
function toSafeString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(toSafeString).join('; ');
  if (typeof val === 'object') {
    // Flatten object values into a readable narrative
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${toSafeString(v)}`)
      .join('. ');
  }
  return String(val);
}

/**
 * Safely converts any value to a string array.
 * Handles cases where the AI returns an object or a plain string instead of an array.
 */
function toSafeStringArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(toSafeString).filter(Boolean);
  if (typeof val === 'string') return val ? [val] : [];
  if (typeof val === 'object') {
    // Flatten object values
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${toSafeString(v)}`)
      .filter(Boolean);
  }
  return [String(val)];
}

/**
 * Sanitizes the raw AI summary to ensure all fields are the expected primitive types.
 * This prevents "Objects are not valid as a React child" runtime errors when the AI
 * hallucinates a nested object structure instead of a flat string.
 */
function sanitizeSummary(raw: Record<string, unknown>): AISummary {
  // Normalize severity_assessment — it might itself be a nested object or a string
  let severityAssessment: AISummary['severity_assessment'] = undefined;
  const rawSev = raw.severity_assessment;
  if (rawSev && typeof rawSev === 'object' && !Array.isArray(rawSev)) {
    const sev = rawSev as Record<string, unknown>;
    severityAssessment = {
      score: typeof sev.score === 'number' ? sev.score : undefined,
      level: typeof sev.level === 'string' ? sev.level : toSafeString(sev.level),
      description: toSafeString(sev.description),
    };
  } else if (rawSev != null) {
    severityAssessment = { description: toSafeString(rawSev) };
  }

  // Normalize medications — each entry should be { name, dose?, frequency? }
  const rawMeds = raw.current_medications;
  const medications: AISummary['current_medications'] = Array.isArray(rawMeds)
    ? rawMeds.map((m) => {
        if (m && typeof m === 'object' && !Array.isArray(m)) {
          const mo = m as Record<string, unknown>;
          return {
            name: toSafeString(mo.name || mo.drug || mo.medication || Object.values(mo)[0]),
            dose: mo.dose != null ? toSafeString(mo.dose) : undefined,
            frequency: mo.frequency != null ? toSafeString(mo.frequency) : undefined,
          };
        }
        return { name: toSafeString(m) };
      })
    : rawMeds != null
    ? [{ name: toSafeString(rawMeds) }]
    : [];

  // Normalize investigations
  const rawInv = raw.relevant_investigations;
  const investigations: AISummary['relevant_investigations'] = Array.isArray(rawInv)
    ? rawInv.map((inv) => {
        if (inv && typeof inv === 'object' && !Array.isArray(inv)) {
          const io = inv as Record<string, unknown>;
          return {
            name: toSafeString(io.name || Object.values(io)[0]),
            value: io.value != null ? toSafeString(io.value) : undefined,
            status: io.status != null ? toSafeString(io.status) : undefined,
          };
        }
        return { name: toSafeString(inv) };
      })
    : [];

  const validPriorities = ['URGENT', 'HIGH', 'ROUTINE'];
  const rawPriority = toSafeString(raw.priority).toUpperCase();

  return {
    chief_complaint: toSafeString(raw.chief_complaint) || undefined,
    history_of_present_illness: toSafeString(raw.history_of_present_illness) || undefined,
    severity_assessment: severityAssessment,
    associated_symptoms: toSafeStringArray(raw.associated_symptoms),
    past_medical_history: toSafeStringArray(raw.past_medical_history),
    current_medications: medications,
    relevant_investigations: investigations,
    red_flags: toSafeStringArray(raw.red_flags),
    priority: validPriorities.includes(rawPriority) ? (rawPriority as AISummary['priority']) : undefined,
    recommended_actions: toSafeStringArray(raw.recommended_actions),
    summary_text: toSafeString(raw.summary_text) || undefined,
    ai_disclaimer: toSafeString(raw.ai_disclaimer) || undefined,
  };
}

export default function SummaryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<AppSession>(defaultSession);

  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [persisted, setPersisted] = useState(false);

  const lang = session.language;

  const tokenNumber = session.patient
    ? `TK-${Math.abs(session.patient.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 100) % 900 + 100)}`
    : 'TK-101';

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setMounted(true);

    if (s.summary) {
      try {
        const parsed = JSON.parse(s.summary);
        // Sanitize to ensure no raw objects slip through to React rendering
        setSummary(sanitizeSummary(parsed as Record<string, unknown>));
        setLoading(false);
        if (s.documents && s.documents.length > 0) {
          generateSummary(s);
        }
        return;
      } catch {}
    }
    generateSummary(s);
  }, []); // eslint-disable-line

  const generateSummary = async (sess?: AppSession) => {
    const active = sess || session;
    setLoading(true);
    setError(false);
    try {
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_state: active.clinicalState,
          red_flags: active.redFlags,
          documents: active.documents,
          lang: active.language,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        // Sanitize AI response before rendering — the model sometimes returns
        // nested objects (e.g. history_of_present_illness as an object) instead
        // of the expected flat strings, which causes React to throw.
        const safe = sanitizeSummary(data.summary as Record<string, unknown>);
        setSummary(safe);
        updateSession({ summary: JSON.stringify(safe) });
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    // Clear session and go back to landing
    if (typeof window !== 'undefined') {
      localStorage.removeItem('medcase_session');
    }
    router.push('/');
  };

  // ─── Persist entire session to Supabase once summary is ready ─────
  const persistToSupabase = async (summaryData: AISummary) => {
    if (persisted) return; // Only persist once
    setPersisted(true);
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: session.patient,
          clinicalState: session.clinicalState,
          messages: session.messages,
          redFlags: session.redFlags,
          documents: session.documents,
          language: session.language,
          consultationType: session.consultationType,
          consentGiven: session.consentGiven,
          summary: summaryData,
        }),
      });
    } catch (err) {
      console.error('Failed to persist session to Supabase:', err);
      // Don't block the UI if persistence fails — the patient can still see their summary
    }
  };

  // Trigger persistence when summary becomes available
  useEffect(() => {
    if (summary && !persisted) {
      persistToSupabase(summary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  if (!mounted) {
    return (
      <div className="page-container" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 44, height: 44 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className="page-content">
        <div className="animate-fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className="section-title">
              {lang === 'hi' ? 'रोगी इतिहास सारांश' : 'Patient History Summary'}
            </h1>
            {session.patient && (
              <div className={styles.patientChip}>
                <span className={styles.patientAvatar}>{session.patient.name.charAt(0)}</span>
                {session.patient.name} · {session.patient.age} {lang === 'hi' ? 'वर्ष' : 'yrs'} · {session.patient.gender}
              </div>
            )}
          </div>

          {/* Red flags */}
          {session.redFlags.length > 0 && (
            <RedFlagAlert flags={session.redFlags} lang={lang} onClose={() => {}} />
          )}

          {loading ? (
            <div className={styles.loadingCard}>
              <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
              <p>{lang === 'hi' ? 'विवरण सुरक्षित किया जा रहा है...' : 'Saving your details...'}</p>
            </div>
          ) : error ? (
            <div className={styles.errorCard}>
              <p>{lang === 'hi' ? 'सारांश तैयार नहीं हो सका।' : 'Could not generate summary.'}</p>
              <button className="btn btn-primary" onClick={() => generateSummary()}>
                {lang === 'hi' ? 'दोबारा कोशिश करें' : 'Try Again'}
              </button>
            </div>
          ) : summary ? (
            <>
              {/* Patient Friendly Confirmation Hero Card */}
              <div className={styles.patientSuccessCard}>
                <div className={styles.successIconWrap}>
                  <CheckCircle2 size={42} strokeWidth={2.4} color="#FFFFFF" />
                </div>

                <h2 className={styles.successTitle} data-read-aloud="true">
                  {lang === 'hi'
                    ? 'आपका स्वास्थ्य इतिहास तैयार है'
                    : 'Your health history is ready'}
                </h2>

                <p className={styles.successSub}>
                  {lang === 'hi'
                    ? 'आपकी जानकारी डॉक्टर के लिए तैयार कर ली गई है।'
                    : 'Your information has been prepared for the doctor.'}
                </p>

                {/* Token Box */}
                <div className={styles.tokenCard}>
                  <span className={styles.tokenLabel}>{lang === 'hi' ? 'आपका टोकन' : 'Your Token'}</span>
                  <span className={styles.tokenNum}>{tokenNumber}</span>
                </div>

                {/* Next Step Instructions */}
                <div className={styles.instructionsCard}>
                  <div className={styles.instructionIconWrap}>
                    <Hospital size={28} strokeWidth={2.2} color="#1E5B2B" />
                  </div>
                  <p className={styles.instructionText}>
                    {lang === 'hi'
                      ? 'कृपया प्रतीक्षा क्षेत्र में बैठें। टोकन नंबर बुलाए जाने पर डॉक्टर कक्ष में जाएं।'
                      : 'Please take a seat in the waiting area. Enter the doctor’s chamber when your token is announced.'}
                  </p>
                </div>

                {/* AI disclaimer */}
                <div className={styles.disclaimer} style={{ marginTop: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>
                    {lang === 'hi'
                      ? 'AI-सहायता प्राप्त सारांश — डॉक्टर द्वारा समीक्षा अनिवार्य है।'
                      : 'AI-assisted history summary — physician review required.'}
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {/* Actions */}
          <div className={styles.actions}>
            <button id="summary-new-session-btn" className="btn btn-primary btn-xl" onClick={handleNewSession} disabled={loading}>
              <RotateCcw size={20} strokeWidth={2.2} />
              <span>{lang === 'hi' ? 'समाप्त करें (नया सत्र)' : 'Finish (New Session)'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
