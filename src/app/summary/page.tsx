'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import RedFlagAlert from '@/components/RedFlagAlert';
import { loadSession, saveSession } from '@/lib/store';
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
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  useEffect(() => {
    if (session.summary) {
      try {
        const parsed = JSON.parse(session.summary);
        // Sanitize to ensure no raw objects slip through to React rendering
        setSummary(sanitizeSummary(parsed as Record<string, unknown>));
        setLoading(false);
        if (session.documents && session.documents.length > 0) {
          generateSummary();
        }
        return;
      } catch {}
    }
    generateSummary();
  }, []); // eslint-disable-line

  const generateSummary = async () => {
    setLoading(true);
    setError(false);
    try {
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_state: session.clinicalState,
          red_flags: session.redFlags,
          documents: session.documents,
          lang,
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

  const handleDoctorDashboard = () => router.push('/doctor');

  const priorityColor: Record<string, string> = {
    URGENT: '#DC2626',
    HIGH: '#D97706',
    ROUTINE: '#2D7A3A',
  };

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
              <p>{lang === 'hi' ? 'सारांश तैयार हो रहा है...' : 'Generating summary...'}</p>
            </div>
          ) : error ? (
            <div className={styles.errorCard}>
              <p>{lang === 'hi' ? 'सारांश तैयार नहीं हो सका।' : 'Could not generate summary.'}</p>
              <button className="btn btn-primary" onClick={generateSummary}>
                {lang === 'hi' ? 'दोबारा कोशिश करें' : 'Try Again'}
              </button>
            </div>
          ) : summary ? (
            <div className={styles.summaryCard}>
              {/* Priority badge */}
              {summary.priority && (
                <div className={styles.priorityBadge} style={{ background: `${priorityColor[summary.priority]}20`, color: priorityColor[summary.priority], borderColor: `${priorityColor[summary.priority]}40` }}>
                  🔴 {summary.priority === 'URGENT' ? (lang === 'hi' ? 'तुरंत' : 'URGENT') : summary.priority}
                </div>
              )}

              {/* Summary text */}
              {summary.summary_text && (
                <div className={styles.summaryText}>
                  <p>{summary.summary_text}</p>
                </div>
              )}

              <div className={styles.grid}>
                {/* Chief complaint */}
                {summary.chief_complaint && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'मुख्य शिकायत' : 'Chief Complaint'}</h3>
                    <p className={styles.sectionValue}>{summary.chief_complaint}</p>
                  </div>
                )}

                {/* History */}
                {summary.history_of_present_illness && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'वर्तमान बीमारी' : 'History of Present Illness'}</h3>
                    <p className={styles.sectionValue}>{summary.history_of_present_illness}</p>
                  </div>
                )}

                {/* Associated symptoms */}
                {summary.associated_symptoms && summary.associated_symptoms.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'संबद्ध लक्षण' : 'Associated Symptoms'}</h3>
                    <div className={styles.pills}>
                      {summary.associated_symptoms.map(s => <span key={s} className="badge badge-info">{s}</span>)}
                    </div>
                  </div>
                )}

                {/* Past history */}
                {summary.past_medical_history && summary.past_medical_history.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'पुरानी बीमारियाँ' : 'Past Medical History'}</h3>
                    <div className={styles.pills}>
                      {summary.past_medical_history.map(h => <span key={h} className="badge badge-gray">{h}</span>)}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {summary.current_medications && summary.current_medications.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'वर्तमान दवाएं' : 'Current Medications'}</h3>
                    {summary.current_medications.map((m, i) => (
                      <div key={i} className={styles.medRow}>
                        <strong>{m.name}</strong>
                        {m.dose && <span> — {m.dose}</span>}
                        {m.frequency && <span>, {m.frequency}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Investigations */}
                {summary.relevant_investigations && summary.relevant_investigations.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'जांच परिणाम' : 'Investigations'}</h3>
                    {summary.relevant_investigations.map((inv, i) => (
                      <div key={i} className={styles.labRow}>
                        <span>{inv.name}</span>
                        {inv.value && <span> — {inv.value}</span>}
                        {inv.status && (
                          <span className={`badge ${inv.status !== 'NORMAL' ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: 8 }}>
                            {inv.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Severity Assessment */}
                {summary.severity_assessment && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'आकलित गंभीरता' : 'Scaled Severity'}</h3>
                    <p className={styles.sectionValue}>
                      <span className="badge badge-warning" style={{ fontWeight: 700, marginRight: 8 }}>
                        {summary.severity_assessment.score}/10 — {summary.severity_assessment.level}
                      </span>
                      {summary.severity_assessment.description}
                    </p>
                  </div>
                )}

                {/* Red flags */}
                {summary.red_flags && summary.red_flags.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel} style={{ color: '#DC2626' }}>
                      {lang === 'hi' ? '🚩 लाल झंडे' : '🚩 Red Flags'}
                    </h3>
                    {summary.red_flags.map(f => (
                      <div key={f} className="badge badge-danger" style={{ display: 'block', marginBottom: 4 }}>{f}</div>
                    ))}
                  </div>
                )}

                {/* Recommended Actions */}
                {summary.recommended_actions && summary.recommended_actions.length > 0 && (
                  <div className={styles.section}>
                    <h3 className={styles.sectionLabel}>{lang === 'hi' ? 'चिकित्सक अनुशंसा' : 'Recommended Actions'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {summary.recommended_actions.map((act, i) => (
                        <div key={i} className="badge badge-success" style={{ display: 'block', textAlign: 'left', padding: '6px 12px' }}>
                          ✓ {act}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI disclaimer */}
              <div className={styles.disclaimer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {lang === 'hi'
                  ? 'यह AI-जनित सारांश है। डॉक्टर द्वारा समीक्षा आवश्यक है।'
                  : (summary.ai_disclaimer || 'This is an AI-generated summary. Doctor review required.')}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className={styles.actions}>
            <button id="summary-doctor-btn" className="btn btn-primary btn-lg" onClick={handleDoctorDashboard} disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2"/>
                <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="2"/>
              </svg>
              {lang === 'hi' ? 'डॉक्टर डैशबोर्ड' : 'Doctor Dashboard'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
