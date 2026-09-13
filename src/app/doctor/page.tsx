'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope,
  ArrowLeft,
  LogOut,
  Search,
  X,
  Clock,
  User,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  FileCheck,
  Pencil,
  Copy,
  CheckCheck,
  ShieldAlert,
  Activity,
  Calendar
} from 'lucide-react';
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
  const [authChecking, setAuthChecking] = useState(true);

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

  // Copy state for OCR raw text
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  // ─── Auth guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('medcase_doctor') || localStorage.getItem('medcase_doctor');
      if (!stored) {
        setAuthChecking(false);
        router.push('/doctor/login');
        return;
      }
      try {
        const doc = JSON.parse(stored);
        setDoctorId(doc.id);
      } catch {
        router.push('/doctor/login');
      } finally {
        setAuthChecking(false);
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
      // Update patients list immediately
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

  // ─── Copy OCR text handler ────────────────────────────────────────────
  const copyOcrText = (docId: string, text: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedDocId(docId);
    setTimeout(() => {
      setCopiedDocId(null);
    }, 2000);
  };

  if (authChecking || !doctorId) {
    return (
      <div className={styles.loadingWrap} style={{ minHeight: '100dvh' }}>
        <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
        <p>Verifying clinical session...</p>
      </div>
    );
  }

  // ─── Detail View ──────────────────────────────────────────────────────
  if (selectedSessionId) {
    return (
      <div className={styles.main}>
        {/* Detail header */}
        <header className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={goBackToList}>
            <ArrowLeft size={16} />
            <span>Back to Patients</span>
          </button>
          
          <div className={styles.brandGroup}>
            <div className={styles.stethoscopeBadge} style={{ width: 36, height: 36, borderRadius: 10 }}>
              <Stethoscope size={18} />
            </div>
            <div>
              <h1 className={styles.headerTitle} style={{ fontSize: 17 }}>MediKiosk Clinical Portal</h1>
              <p className={styles.headerSub}>
                Doctor Workstation
                <span className={styles.docIdChip}>
                  <span className={styles.statusDot} />
                  ID: {doctorId}
                </span>
              </p>
            </div>
          </div>
        </header>

        {detailLoading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
            <p>Loading patient clinical record...</p>
          </div>
        ) : detail ? (
          <>
            {/* Patient Hero / Banner */}
            <section className={styles.patientHero}>
              <div className={styles.heroContent}>
                <div className={styles.heroLeft}>
                  <div className={styles.heroAvatar}>
                    {detail.patient?.name?.charAt(0) || <User size={26} />}
                  </div>
                  <div className={styles.heroInfo}>
                    <h2 className={styles.heroName}>{detail.patient?.name || 'Unknown Patient'}</h2>
                    <div className={styles.heroMeta}>
                      <span>{detail.patient?.age ? `${detail.patient.age} yrs` : 'Age not recorded'}</span>
                      <span>·</span>
                      <span style={{ textTransform: 'capitalize' }}>{detail.patient?.gender || 'Gender unspecified'}</span>
                      {detail.patient?.abhaId && (
                        <>
                          <span>·</span>
                          <span className={styles.cardAbha} style={{ margin: 0 }}>
                            ABHA: {detail.patient.abhaId}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {detail.session?.consultationType || 'General'} Consultation
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.heroActions}>
                  {detail.redFlags.length > 0 && (
                    <div className={styles.redFlagAlert}>
                      <ShieldAlert size={16} />
                      <span>{detail.redFlags.length} Red Flag{detail.redFlags.length > 1 ? 's' : ''} Detected</span>
                    </div>
                  )}
                  
                  {detail.summaryMeta?.status === 'accepted' ? (
                    <div className={styles.diagnosedPill}>
                      <CheckCircle2 size={18} />
                      <span>Diagnosed & Verified</span>
                    </div>
                  ) : (
                    <button className={styles.diagnoseBtn} onClick={markDiagnosed}>
                      <CheckCircle2 size={16} />
                      <span>Mark as Diagnosed</span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Navigation Tabs */}
            <div className={styles.detailTabsBar}>
              <nav className={styles.detailTabs}>
                <button
                  className={`${styles.detailTab} ${activeTab === 'summary' ? styles.detailTabActive : ''}`}
                  onClick={() => setActiveTab('summary')}
                >
                  <FileText size={16} />
                  <span>Clinical Summary</span>
                </button>
                <button
                  className={`${styles.detailTab} ${activeTab === 'history' ? styles.detailTabActive : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <ClipboardList size={16} />
                  <span>Case History</span>
                </button>
                <button
                  className={`${styles.detailTab} ${activeTab === 'documents' ? styles.detailTabActive : ''}`}
                  onClick={() => setActiveTab('documents')}
                >
                  <FileCheck size={16} />
                  <span>Documents & OCR ({detail.documents.length})</span>
                </button>
              </nav>
            </div>

            {/* Tab content */}
            <div className={styles.detailContent}>
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
                              {key.replace(/_/g, ' ')}
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
                                Array.isArray(value) ? (
                                  value.length > 0 ? (
                                    value.map((v, i) => (
                                      <span key={i} className={styles.clinicalChip}>
                                        {toSafeString(v)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className={styles.emptyDash}>—</span>
                                  )
                                ) : typeof value === 'object' && value !== null ? (
                                  <span>{toSafeString(value)}</span>
                                ) : (
                                  <span>{String(value || '—')}</span>
                                )
                              )}
                            </div>
                            <div className={styles.editActions}>
                              {editingField === key ? (
                                <>
                                  <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                    <Check size={14} />
                                    Save
                                  </button>
                                  <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className={styles.editBtn}
                                  onClick={() => startEdit(key, value)}
                                  title="Edit entry"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconCircle}>
                        <FileText size={32} />
                      </div>
                      <h3>No Summary Available</h3>
                      <p>Clinical summary is not yet generated for this consultation session.</p>
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
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconCircle}>
                        <FileCheck size={32} />
                      </div>
                      <h3>No Documents Uploaded</h3>
                      <p>The patient did not provide any clinical documents or test reports.</p>
                    </div>
                  ) : (
                    detail.documents.map((doc, i) => {
                      const docKey = doc.id || `doc-${i}`;
                      const isHighConf = doc.confidence === 'HIGH';
                      return (
                        <div key={docKey} className={styles.docCard}>
                          <div className={styles.docHeader}>
                            <div className={styles.docHeaderTitle}>
                              <FileText size={18} color="var(--green-600)" />
                              <span>Document {i + 1}</span>
                              {doc.uploadDate && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                                  ({new Date(doc.uploadDate).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                            <span className={`${styles.confBadge} ${isHighConf ? styles.confHigh : styles.confVerify}`}>
                              {isHighConf ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                              {doc.confidence || 'NEEDS_VERIFICATION'}
                            </span>
                          </div>

                          <div className={styles.docBody}>
                            {/* Structured Findings */}
                            {doc.extractedData && Object.entries(doc.extractedData)
                              .filter(([k, v]) => {
                                if (['raw_text', 'confidence'].includes(k)) return false;
                                if (Array.isArray(v) && v.length === 0) return false;
                                if (!v) return false;
                                return true;
                              })
                              .map(([k, v]) => (
                                <div key={k} className={styles.structuredItem}>
                                  <span className={styles.structuredLabel}>{k.replace(/_/g, ' ')}</span>
                                  <div className={styles.structuredValue}>{toSafeString(v)}</div>
                                </div>
                              ))}

                            {/* Raw Document OCR Viewer */}
                            {doc.rawText && (
                              <div className={styles.ocrTerminal}>
                                <div className={styles.ocrTerminalHeader}>
                                  <div className={styles.ocrTerminalTitle}>
                                    <FileCheck size={15} />
                                    <span>Raw OCR Extract</span>
                                  </div>
                                  <button
                                    className={styles.copyBtn}
                                    onClick={() => copyOcrText(docKey, doc.rawText)}
                                    title="Copy extracted text"
                                  >
                                    {copiedDocId === docKey ? (
                                      <>
                                        <CheckCheck size={13} color="var(--green-600)" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={13} />
                                        <span>Copy Text</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className={styles.ocrPre}>{doc.rawText}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptyState} style={{ margin: 28 }}>
            <div className={styles.emptyIconCircle}>
              <AlertTriangle size={32} />
            </div>
            <h3>Failed to Load Record</h3>
            <p>Could not retrieve patient details. Please try again or return to the list.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Patient Cards List View ──────────────────────────────────────────
  const pendingCount = patients.filter(p => p.summaryStatus !== 'accepted').length;
  const diagnosedCount = patients.filter(p => p.summaryStatus === 'accepted').length;

  return (
    <div className={styles.main}>
      {/* Dashboard header */}
      <header className={styles.dashHeader}>
        <div className={styles.brandGroup}>
          <div className={styles.stethoscopeBadge}>
            <Stethoscope size={24} />
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.headerTitle}>MediKiosk Doctor Portal</h1>
            <p className={styles.headerSub}>
              Clinical Workstation
              <span className={styles.docIdChip}>
                <span className={styles.statusDot} />
                Doctor ID: {doctorId}
              </span>
            </p>
          </div>
        </div>

        <button
          className={styles.logoutBtn}
          onClick={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('medcase_doctor');
              localStorage.removeItem('medcase_doctor');
            }
            router.push('/');
          }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </header>

      {/* Control bar: Tabs + Search */}
      <div className={styles.controlBar}>
        {/* Dashboard Tabs */}
        <div className={styles.tabPills}>
          <button
            className={`${styles.tabPill} ${dashboardTab === 'pending' ? styles.tabPillActive : ''}`}
            onClick={() => setDashboardTab('pending')}
          >
            <Clock size={15} />
            <span>Pending Review</span>
            <span className={styles.pillBadge}>{pendingCount}</span>
          </button>
          <button
            className={`${styles.tabPill} ${dashboardTab === 'diagnosed' ? styles.tabPillActive : ''}`}
            onClick={() => setDashboardTab('diagnosed')}
          >
            <CheckCircle2 size={15} />
            <span>Diagnosed</span>
            <span className={styles.pillBadge}>{diagnosedCount}</span>
          </button>
        </div>

        {/* Search bar */}
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            id="doctor-search"
            className={styles.searchInput}
            type="text"
            placeholder="Search patient name, ABHA ID or session..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => setSearch('')} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Patient cards container */}
      <main className={styles.cardsContainer}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Activity size={16} color="var(--green-600)" />
            <span>{dashboardTab === 'pending' ? 'Active Consultation Queue' : 'Completed Diagnoses'}</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            Showing {dashboardTab === 'pending' ? pendingCount : diagnosedCount} records
          </span>
        </div>

        {listLoading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
            <p>Loading patient records...</p>
          </div>
        ) : (() => {
          const filtered = patients.filter(p => dashboardTab === 'diagnosed' ? p.summaryStatus === 'accepted' : p.summaryStatus !== 'accepted');
          
          if (filtered.length === 0) {
            return (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <ClipboardList size={34} />
                </div>
                <h3>No Patients Found</h3>
                <p>
                  {search
                    ? 'No matching patient records found. Try a different name or ABHA ID.'
                    : `There are currently no ${dashboardTab === 'pending' ? 'pending' : 'diagnosed'} consultations in queue.`}
                </p>
              </div>
            );
          }

          return (
            <div className={styles.cardsGrid}>
              {filtered.map(p => {
                const priorityKey = (p.priority?.toLowerCase() || 'routine') as 'routine' | 'high' | 'urgent';
                const priorityClass = styles[`priority_${priorityKey}`] || styles.priority_routine;

                return (
                  <button
                    key={p.sessionId}
                    className={styles.patientCard}
                    onClick={() => openPatient(p.sessionId)}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.cardAvatar}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={`${styles.priorityBadge} ${priorityClass}`}>
                        {p.priority === 'URGENT' && <AlertTriangle size={11} />}
                        {p.priority}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardName}>{p.name}</h3>
                      <div className={styles.cardMeta}>
                        <span>{p.age ? `${p.age} yrs` : 'Age N/A'}</span>
                        <span>·</span>
                        <span style={{ textTransform: 'capitalize' }}>{p.gender || 'Other'}</span>
                      </div>
                      
                      {p.abhaId && (
                        <div className={styles.cardAbha}>
                          ABHA: {p.abhaId}
                        </div>
                      )}
                    </div>

                    <div className={styles.cardFooter}>
                      <span className={styles.cardTime}>
                        <Clock size={12} />
                        {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`${styles.cardStatus} ${p.status === 'complete' ? styles.statusComplete : ''}`}>
                        {p.status === 'complete' ? (
                          <>
                            <CheckCircle2 size={12} />
                            Completed
                          </>
                        ) : (
                          <>
                            <Activity size={12} />
                            In Progress
                          </>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
