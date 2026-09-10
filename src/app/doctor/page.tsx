'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession } from '@/lib/store';
import styles from './page.module.css';

export default function DoctorPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;
  const { patient, clinicalState, redFlags, documents } = session;

  const [summaryObj, setSummaryObj] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'documents' | 'timeline'>('summary');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  useEffect(() => {
    if (session.summary) {
      try { setSummaryObj(JSON.parse(session.summary)); } catch {}
    }
  }, [session.summary]);

  const handleAccept = () => setReviewStatus('accepted');
  const handleReject = () => setReviewStatus('rejected');
  const handleNewSession = () => { router.push('/'); };

  const tabs = [
    { id: 'summary', label: lang === 'hi' ? 'सारांश' : 'Summary', icon: '📋' },
    { id: 'history', label: lang === 'hi' ? 'इतिहास' : 'History', icon: '📝' },
    { id: 'documents', label: lang === 'hi' ? 'दस्तावेज़' : 'Documents', icon: '📄' },
    { id: 'timeline', label: lang === 'hi' ? 'टाइमलाइन' : 'Timeline', icon: '📅' },
  ] as const;

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className={styles.main}>
        {/* Doctor header */}
        <div className={styles.doctorHeader}>
          <div className={styles.doctorInfo}>
            <div className={styles.doctorIcon}>👨‍⚕️</div>
            <div>
              <h1 className={styles.doctorTitle}>
                {lang === 'hi' ? 'डॉक्टर डैशबोर्ड' : 'Doctor Dashboard'}
              </h1>
              <p className={styles.doctorSub}>
                {lang === 'hi' ? 'AI-जनित सारांश समीक्षा करें' : 'Review AI-generated patient summary'}
              </p>
            </div>
          </div>

          {/* Review actions */}
          {reviewStatus === 'pending' ? (
            <div className={styles.reviewActions}>
              <button id="doctor-reject-btn" className="btn btn-secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleReject}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                {lang === 'hi' ? 'अस्वीकार' : 'Reject'}
              </button>
              <button id="doctor-accept-btn" className="btn btn-primary" onClick={handleAccept}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {lang === 'hi' ? 'स्वीकार करें' : 'Accept'}
              </button>
            </div>
          ) : (
            <div className={styles.reviewBadge} style={{ background: reviewStatus === 'accepted' ? 'var(--green-100)' : '#FEE2E2', color: reviewStatus === 'accepted' ? 'var(--green-700)' : '#B91C1C' }}>
              {reviewStatus === 'accepted' ? (lang === 'hi' ? '✅ स्वीकृत' : '✅ Accepted') : (lang === 'hi' ? '❌ अस्वीकृत' : '❌ Rejected')}
            </div>
          )}
        </div>

        {/* Patient pill */}
        {patient && (
          <div className={styles.patientRow}>
            <div className={styles.patientAvatar}>{patient.name.charAt(0)}</div>
            <div>
              <p className={styles.patientName}>{patient.name}</p>
              <p className={styles.patientMeta}>{patient.age} {lang === 'hi' ? 'वर्ष' : 'yrs'} · {patient.gender} {patient.abhaId ? `· ABHA: ${patient.abhaId}` : ''}</p>
            </div>
            {redFlags.length > 0 && (
              <div className="badge badge-danger" style={{ marginLeft: 'auto', fontSize: 15 }}>
                🚩 {redFlags.length} Red Flag{redFlags.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`doctor-tab-${tab.id}`}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.content}>
          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="animate-fade-in">
              {summaryObj ? (
                <div className={styles.card}>
                  {Object.entries(summaryObj)
                    .filter(([k]) => k !== 'ai_disclaimer')
                    .map(([key, value]) => (
                      <div key={key} className={styles.summaryRow}>
                        <div className={styles.summaryKey}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </div>
                        <div className={styles.summaryValue}>
                          {Array.isArray(value)
                            ? value.length > 0
                              ? value.map((v, i) => (
                                  <span key={i} className="badge badge-gray" style={{ marginRight: 4 }}>
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </span>
                                ))
                              : <span className={styles.empty}>—</span>
                            : String(value || '—')}
                        </div>
                        {editingField !== key ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingField(key)} title="Edit">
                            ✏️
                          </button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => setEditingField(null)}>Save</button>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  {lang === 'hi' ? 'सारांश उपलब्ध नहीं है' : 'Summary not available. Go back to Summary page.'}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className={`${styles.card} animate-fade-in`}>
              <div className={styles.historyGrid}>
                {[
                  ['Chief Complaint', clinicalState.chief_complaint],
                  ['Duration', clinicalState.onset],
                  ['Location', clinicalState.location],
                  ['Severity', clinicalState.severity !== null ? `${clinicalState.severity}/10` : null],
                  ['Character', clinicalState.character],
                  ['Radiation', clinicalState.radiation],
                  ['Breathlessness', clinicalState.breathlessness !== null ? (clinicalState.breathlessness ? 'Yes' : 'No') : null],
                  ['Sweating', clinicalState.sweating !== null ? (clinicalState.sweating ? 'Yes' : 'No') : null],
                  ['Dizziness', clinicalState.dizziness !== null ? (clinicalState.dizziness ? 'Yes' : 'No') : null],
                  ['Nausea', clinicalState.nausea !== null ? (clinicalState.nausea ? 'Yes' : 'No') : null],
                  ['Previous Episode', clinicalState.previous_episode !== null ? (clinicalState.previous_episode ? 'Yes' : 'No') : null],
                  ['Past History', clinicalState.past_history.join(', ')],
                  ['Medications', clinicalState.medications.join(', ')],
                  ['Allergies', clinicalState.allergies.join(', ')],
                ].map(([label, value]) => (
                  <div key={label as string} className={styles.historyItem}>
                    <span className={styles.historyLabel}>{label}</span>
                    <span className={styles.historyValue}>{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="animate-fade-in">
              {documents.length === 0 ? (
                <div className={styles.empty}>
                  {lang === 'hi' ? 'कोई दस्तावेज़ अपलोड नहीं किया गया' : 'No documents uploaded'}
                </div>
              ) : (
                documents.map((doc, i) => (
                  <div key={i} className={styles.card} style={{ marginBottom: 16 }}>
                    <div className={styles.docHeader}>
                      <span>📄 Document {i + 1}</span>
                      <span className={`badge ${doc.confidence === 'HIGH' ? 'badge-success' : 'badge-warning'}`}>
                        {doc.confidence || 'NEEDS_VERIFICATION'}
                      </span>
                      {doc.date && <span className="badge badge-gray">{doc.date}</span>}
                    </div>
                    {doc.diagnosis && doc.diagnosis.length > 0 && (
                      <div className={styles.docSection}>
                        <h4>{lang === 'hi' ? 'निदान' : 'Diagnosis'}</h4>
                        <div>{doc.diagnosis.map(d => <span key={d} className="badge badge-info" style={{ marginRight: 4 }}>{d}</span>)}</div>
                      </div>
                    )}
                    {doc.medications && doc.medications.length > 0 && (
                      <div className={styles.docSection}>
                        <h4>{lang === 'hi' ? 'दवाएं' : 'Medications'}</h4>
                        {doc.medications.map((m, j) => <div key={j}>{m.name} {m.dose} {m.frequency}</div>)}
                      </div>
                    )}
                    {doc.labs && doc.labs.length > 0 && (
                      <div className={styles.docSection}>
                        <h4>{lang === 'hi' ? 'जांच' : 'Labs'}</h4>
                        {doc.labs.map((l, j) => (
                          <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {l.name}: {l.value} {l.unit}
                            {l.status && <span className={`badge ${l.status !== 'NORMAL' ? 'badge-danger' : 'badge-success'}`}>{l.status}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === 'timeline' && (
            <div className={`animate-fade-in`}>
              <div className={styles.timeline}>
                {documents.map((doc, i) => doc.date && (
                  <div key={i} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineDate}>{doc.date}</div>
                      {doc.diagnosis?.map(d => <div key={d} className={styles.timelineEntry}>🔴 {d}</div>)}
                      {doc.medications?.map((m, j) => <div key={j} className={styles.timelineEntry}>💊 {m.name} {m.dose}</div>)}
                      {doc.labs?.map((l, j) => <div key={j} className={styles.timelineEntry}>🧪 {l.name}: {l.value} {l.unit} {l.status && `(${l.status})`}</div>)}
                    </div>
                  </div>
                ))}
                {/* Current visit */}
                <div className={styles.timelineItem}>
                  <div className={styles.timelineDot} style={{ background: 'var(--green-500)', width: 16, height: 16, marginLeft: -5 }} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineDate}>{new Date().toLocaleDateString()}</div>
                    {clinicalState.chief_complaint && (
                      <div className={styles.timelineEntry}>🩺 {lang === 'hi' ? 'शिकायत:' : 'CC:'} {clinicalState.chief_complaint}</div>
                    )}
                    {clinicalState.medications.map((m, i) => (
                      <div key={i} className={styles.timelineEntry}>💊 {m}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className={styles.bottomBar}>
          <button className="btn btn-ghost" onClick={handleNewSession}>
            {lang === 'hi' ? 'नया सत्र शुरू करें' : 'Start New Session'}
          </button>
          <div className={styles.fhirBadge}>
            FHIR-ready · SIH26047
          </div>
        </div>
      </main>
    </div>
  );
}
