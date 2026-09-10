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
  associated_symptoms?: string[];
  past_medical_history?: string[];
  current_medications?: { name: string; dose?: string; frequency?: string }[];
  relevant_investigations?: { name: string; value?: string; status?: string }[];
  red_flags?: string[];
  priority?: 'URGENT' | 'HIGH' | 'ROUTINE';
  summary_text?: string;
  ai_disclaimer?: string;
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
        setSummary(data.summary);
        updateSession({ summary: JSON.stringify(data.summary) });
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
