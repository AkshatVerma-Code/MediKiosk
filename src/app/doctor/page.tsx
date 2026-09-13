'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────
interface PatientCard {
  sessionId: string;
  patientId: string | null;
  name: string;
  age: number | null;
  gender: string;
  abhaId: string | null;
  consultationType: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  priority: string;
  summaryStatus: string;
}

interface PatientDetail {
  session: {
    id: string;
    consultationType: string;
    language: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  };
  patient: {
    id: string;
    name: string;
    age: number;
    gender: string;
    abhaId: string | null;
  } | null;
  clinicalState: Record<string, unknown>;
  messages: { speaker: string; text: string; timestamp: string }[];
  redFlags: { rule_name: string; severity: string; description: string }[];
  summary: Record<string, unknown> | null;
  summaryMeta: { priority: string; status: string; doctorNotes: string | null } | null;
  documents: {
    id: string;
    uploadDate: string;
    extractedData: Record<string, unknown> | null;
    confidence: string;
    rawText: string;
  }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function toSafeString(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(toSafeString).join(', ');
  if (typeof val === 'object') {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${toSafeString(v)}`)
      .join('. ');
  }
  return String(val);
}

// ─── Page Component ─────────────────────────────────────────────────────────
export default function DoctorDashboardPage() {
  const router = useRouter();

  // Auth check
  const [doctorId, setDoctorId] = useState<string | null>(null);

  // Card list state
  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);

  // Detail state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'documents'>('summary');
  
  // Dashboard tabs
  const [dashboardTab, setDashboardTab] = useState<'pending' | 'diagnosed'>('pending');

  // Edit state for summary fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ─── Auth guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('medcase_doctor');
      if (!stored) {
        router.push('/doctor/login');
        return;
      }
      try {
        const doc = JSON.parse(stored);
        setDoctorId(doc.id);
      } catch {
        router.push('/doctor/login');
      }
    }
  }, [router]);

  // ─── Fetch patient list ───────────────────────────────────────────────
  const fetchPatients = useCallback(async (query: string) => {
    setListLoading(true);
    try {
      const url = `/api/doctor/patients${query ? `?search=${encodeURIComponent(query)}` : ''}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        setPatients(data.patients || []);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (doctorId) {
      fetchPatients(search);
    }
  }, [doctorId, fetchPatients, search]);

  // ─── Fetch patient detail ─────────────────────────────────────────────
  const openPatient = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    setActiveTab('summary');
    try {
      const resp = await fetch(`/api/doctor/patient/${sessionId}`);
      if (resp.ok) {
        const data = await resp.json();
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to fetch patient detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const goBackToList = () => {
    setSelectedSessionId(null);
    setDetail(null);
    setEditingField(null);
  };

  // ─── Edit handlers ────────────────────────────────────────────────────
  const startEdit = (key: string, currentValue: unknown) => {
    setEditingField(key);
    setEditValue(toSafeString(currentValue));
  };

  const saveEdit = async () => {
    if (!editingField || !detail?.summary || !selectedSessionId) return;

    const updatedSummary = { ...detail.summary };
    // Try to parse back to appropriate type
    if (editValue.includes(',') && Array.isArray(detail.summary[editingField])) {
      updatedSummary[editingField] = editValue.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      updatedSummary[editingField] = editValue;
    }

    // Update local state immediately for fast feedback
    setDetail({ ...detail, summary: updatedSummary });
    setEditingField(null);
    setEditValue('');
    
    // Persist to Supabase
    try {
      await fetch(`/api/doctor/patient/${selectedSessionId}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary_json: updatedSummary })
      });
    } catch (err) {
      console.error('Failed to save edit to Supabase:', err);
    }
  };

  const markDiagnosed = async () => {
    if (!selectedSessionId || !detail) return;
    
    // Update local state
    setDetail({
      ...detail,
      summaryMeta: { ...detail.summaryMeta, priority: detail.summaryMeta?.priority || 'ROUTINE', status: 'accepted', doctorNotes: detail.summaryMeta?.doctorNotes || null }
    });
    
    // Persist to Supabase
    try {
      await fetch(`/api/doctor/patient/${selectedSessionId}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      // Optionally update the patients list so it reflects immediately if they go back
      setPatients(prev => prev.map(p => 
        p.sessionId === selectedSessionId ? { ...p, summaryStatus: 'accepted' } : p
      ));
    } catch (err) {
      console.error('Failed to mark as diagnosed:', err);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // ─── Priority helpers ─────────────────────────────────────────────────
  const priorityColor: Record<string, string> = {
    URGENT: '#DC2626',
    HIGH: '#D97706',
    ROUTINE: '#2D7A3A',
  };
  const priorityBg: Record<string, string> = {
    URGENT: '#FEE2E2',
    HIGH: '#FEF3C7',
    ROUTINE: '#DCFCE7',
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (!doctorId) return null;

  // ─── Detail View ──────────────────────────────────────────────────────
  if (selectedSessionId) {
    return (
      <div className={styles.main}>
        {/* Detail header */}
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={goBackToList}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Patients
          </button>
          <div className={styles.headerInfo}>
            <h1 className={styles.headerTitle}>
              👨‍⚕️ Doctor Dashboard
            </h1>
            <span className={styles.headerDocId}>ID: {doctorId}</span>
          </div>
        </div>

        {detailLoading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
            <p>Loading patient details...</p>
          </div>
        ) : detail ? (
          <>
            {/* Patient info bar */}
            <div className={styles.patientBar}>
              <div className={styles.patientAvatar}>
                {detail.patient?.name?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <p className={styles.patientBarName}>{detail.patient?.name || 'Unknown'}</p>
                <p className={styles.patientBarMeta}>
                  {detail.patient?.age ? `${detail.patient.age} yrs` : ''} · {detail.patient?.gender || ''}
                  {detail.patient?.abhaId ? ` · ABHA: ${detail.patient.abhaId}` : ''}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {detail.redFlags.length > 0 && (
                  <div className="badge badge-danger" style={{ fontSize: 15 }}>
                    🚩 {detail.redFlags.length} Red Flag{detail.redFlags.length > 1 ? 's' : ''}
                  </div>
                )}
                
                {detail.summaryMeta?.status === 'accepted' ? (
                  <div className="badge badge-success" style={{ fontSize: 15, padding: '8px 12px' }}>
                    ✓ Diagnosed
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={markDiagnosed}>
                    Mark as Diagnosed
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {(['summary', 'history', 'documents'] as const).map(tab => (
                <button
                  key={tab}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'summary' && '📋'} {tab === 'history' && '📝'} {tab === 'documents' && '📄'}
                  {' '}{tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={styles.content}>
              {/* SUMMARY TAB */}
              {activeTab === 'summary' && (
                <div className="animate-fade-in">
                  {detail.summary ? (
                    <div className={styles.card}>
                      {Object.entries(detail.summary)
                        .filter(([k]) => k !== 'ai_disclaimer')
                        .map(([key, value]) => (
                          <div key={key} className={styles.summaryRow}>
                            <div className={styles.summaryKey}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </div>
                            <div className={styles.summaryValue}>
                              {editingField === key ? (
                                <textarea
                                  className={styles.editTextarea}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  rows={3}
                                  autoFocus
                                />
                              ) : (
                                Array.isArray(value)
                                  ? value.length > 0
                                    ? value.map((v, i) => (
                                        <span key={i} className="badge badge-gray" style={{ marginRight: 4, marginBottom: 4 }}>
                                          {toSafeString(v)}
                                        </span>
                                      ))
                                    : <span className={styles.empty}>—</span>
                                  : typeof value === 'object' && value !== null
                                    ? <span>{toSafeString(value)}</span>
                                    : <span>{String(value ?? '—')}</span>
                              )}
                            </div>
                            <div className={styles.editActions}>
                              {editingField === key ? (
                                <>
                                  <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>✕</button>
                                </>
                              ) : (
                                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(key, value)} title="Edit">
                                  ✏️
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      Summary not available for this session.
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <div className={`${styles.card} animate-fade-in`}>
                  <div className={styles.historyGrid}>
                    {(() => {
                      const cs = detail.clinicalState || {};
                      return [
                        ['Chief Complaint', cs.chief_complaint],
                        ['Duration / Onset', cs.onset],
                        ['Location', cs.location],
                        ['Severity', cs.severity != null ? `${cs.severity}/10` : null],
                        ['Character', cs.character],
                        ['Radiation', cs.radiation],
                        ['Breathlessness', cs.breathlessness != null ? (cs.breathlessness ? 'Yes' : 'No') : null],
                        ['Sweating', cs.sweating != null ? (cs.sweating ? 'Yes' : 'No') : null],
                        ['Dizziness', cs.dizziness != null ? (cs.dizziness ? 'Yes' : 'No') : null],
                        ['Nausea', cs.nausea != null ? (cs.nausea ? 'Yes' : 'No') : null],
                        ['Previous Episode', cs.previous_episode != null ? (cs.previous_episode ? 'Yes' : 'No') : null],
                        ['Past History', Array.isArray(cs.past_history) ? (cs.past_history as string[]).join(', ') : toSafeString(cs.past_history)],
                        ['Medications', Array.isArray(cs.medications) ? (cs.medications as string[]).join(', ') : toSafeString(cs.medications)],
                        ['Allergies', Array.isArray(cs.allergies) ? (cs.allergies as string[]).join(', ') : toSafeString(cs.allergies)],
                      ].map(([label, value]) => (
                        <div key={label as string} className={styles.historyItem}>
                          <span className={styles.historyLabel}>{label as string}</span>
                          <span className={styles.historyValue}>{toSafeString(value) || '—'}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === 'documents' && (
                <div className="animate-fade-in">
                  {detail.documents.length === 0 ? (
                    <div className={styles.emptyState}>No documents uploaded</div>
                  ) : (
                    detail.documents.map((doc, i) => (
                      <div key={doc.id || i} className={styles.card} style={{ marginBottom: 16 }}>
                        <div className={styles.docHeader}>
                          <span>📄 Document {i + 1}</span>
                          <span className={`badge ${doc.confidence === 'HIGH' ? 'badge-success' : 'badge-warning'}`}>
                            {doc.confidence || 'NEEDS_VERIFICATION'}
                          </span>
                        </div>
                        {doc.extractedData && (
                          <div style={{ padding: '12px 20px' }}>
                            {Object.entries(doc.extractedData)
                              .filter(([k, v]) => {
                                if (['raw_text', 'confidence'].includes(k)) return false;
                                if (Array.isArray(v) && v.length === 0) return false;
                                if (!v) return false;
                                return true;
                              })
                              .map(([k, v]) => (
                                <div key={k} style={{ marginBottom: 8 }}>
                                  <strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</strong>{' '}
                                  {toSafeString(v)}
                                </div>
                              ))}
                              
                            {/* Ensure raw OCR text is visible for verification */}
                            {doc.rawText && (
                              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <strong style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)' }}>Raw Document Text (OCR):</strong>
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, margin: 0 }}>
                                  {doc.rawText}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>Failed to load patient details.</div>
        )}
      </div>
    );
  }

  // ─── Patient Cards List View ──────────────────────────────────────────
  return (
    <div className={styles.main}>
      {/* Dashboard header */}
      <div className={styles.dashHeader}>
        <div className={styles.headerInfo}>
          <h1 className={styles.headerTitle}>👨‍⚕️ Doctor Dashboard</h1>
          <p className={styles.headerSub}>Today&apos;s patients · Doctor ID: {doctorId}</p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (typeof window !== 'undefined') sessionStorage.removeItem('medcase_doctor');
            router.push('/');
          }}
        >
          Logout
        </button>
      </div>

      {/* Dashboard Tabs */}
      <div className={styles.tabs} style={{ padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
        <button
          className={`${styles.tab} ${dashboardTab === 'pending' ? styles.tabActive : ''}`}
          onClick={() => setDashboardTab('pending')}
        >
          📋 Pending ({patients.filter(p => p.summaryStatus !== 'accepted').length})
        </button>
        <button
          className={`${styles.tab} ${dashboardTab === 'diagnosed' ? styles.tabActive : ''}`}
          onClick={() => setDashboardTab('diagnosed')}
        >
          ✓ Diagnosed ({patients.filter(p => p.summaryStatus === 'accepted').length})
        </button>
      </div>

      {/* Search bar */}
      <div className={styles.searchWrap}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.searchIcon}>
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          id="doctor-search"
          className={styles.searchInput}
          type="text"
          placeholder="Search by patient name or ABHA ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Patient cards */}
      <div className={styles.cardsContainer}>
        {listLoading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <p>Loading patients...</p>
          </div>
        ) : (() => {
          const filtered = patients.filter(p => dashboardTab === 'diagnosed' ? p.summaryStatus === 'accepted' : p.summaryStatus !== 'accepted');
          
          if (filtered.length === 0) {
            return (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📋</div>
                <h3>No patients found</h3>
                <p>{search ? 'No matching patients. Try a different search.' : `No ${dashboardTab} patients found.`}</p>
              </div>
            );
          }

          return (
            <div className={styles.cardsGrid}>
              {filtered.map(p => (
              <button
                key={p.sessionId}
                className={styles.patientCard}
                onClick={() => openPatient(p.sessionId)}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardAvatar}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={styles.cardPriority}
                    style={{
                      color: priorityColor[p.priority] || '#2D7A3A',
                      background: priorityBg[p.priority] || '#DCFCE7',
                    }}
                  >
                    {p.priority}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardName}>{p.name}</h3>
                  <div className={styles.cardMeta}>
                    {p.age && <span>{p.age} yrs</span>}
                    {p.gender && <span>· {p.gender}</span>}
                  </div>
                  {p.abhaId && (
                    <div className={styles.cardAbha}>
                      ABHA: {p.abhaId}
                    </div>
                  )}
                  <div className={styles.cardFooter}>
                    <span className={styles.cardTime}>
                      {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`${styles.cardStatus} ${p.status === 'complete' ? styles.statusComplete : ''}`}>
                      {p.status === 'complete' ? '✓ Complete' : 'Active'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
