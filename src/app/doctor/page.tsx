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
  ChevronDown,
  ChevronUp,
  Save,
  Info,
  RotateCcw
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
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (typeof item === 'object' && item !== null) {
          const entry = item as Record<string, unknown>;
          if (entry.name) {
            return `${entry.name}${entry.dose ? ` (${entry.dose}${entry.frequency ? `, ${entry.frequency}` : ''})` : ''}${entry.value ? `: ${entry.value}` : ''}`;
          }
          return Object.entries(entry).map(([k, v]) => `${k}: ${toSafeString(v)}`).join(', ');
        }
        return toSafeString(item);
      })
      .join(', ');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (obj.level || obj.description) {
      return `${obj.level ? `[${obj.level}] ` : ''}${obj.score != null ? `Score: ${obj.score}/10. ` : ''}${obj.description || ''}`.trim();
    }
    return Object.entries(obj)
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

  // Doctor notes state
  const [doctorNotesInput, setDoctorNotesInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  // Document OCR collapsible state & copy state
  const [expandedOcrDocId, setExpandedOcrDocId] = useState<string | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const fetchPatients = useCallback(async (query: string, silent = false) => {
    if (!silent) setListLoading(true);
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
      if (!silent) setListLoading(false);
    }
  }, []);

  const refreshPatientDetail = useCallback(async (sessionId: string) => {
    try {
      const resp = await fetch(`/api/doctor/patient/${sessionId}`);
      if (resp.ok) {
        const data: PatientDetail = await resp.json();
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to refresh patient detail:', err);
    }
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchPatients(search, true);
    if (selectedSessionId) {
      await refreshPatientDetail(selectedSessionId);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    if (doctorId) {
      fetchPatients(search);

      // Live sync every 8s when window is visible so kiosk submissions appear immediately
      const timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchPatients(search, true);
        }
      }, 8000);

      return () => clearInterval(timer);
    }
  }, [doctorId, fetchPatients, search]);

  // ─── Fetch patient detail ─────────────────────────────────────────────
  const openPatient = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    setActiveTab('summary');
    setEditingField(null);
    setEditValue('');
    setExpandedOcrDocId(null);
    try {
      const resp = await fetch(`/api/doctor/patient/${sessionId}`);
      if (resp.ok) {
        const data: PatientDetail = await resp.json();
        setDetail(data);
        setDoctorNotesInput(data.summaryMeta?.doctorNotes || '');
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

  // ─── Edit handlers for intake summary fields ──────────────────────────
  const startEdit = (key: string, currentValue: unknown) => {
    setEditingField(key);
    setEditValue(toSafeString(currentValue));
  };

  const saveEdit = async () => {
    if (!editingField || !detail?.summary || !selectedSessionId) return;

    const updatedSummary = { ...detail.summary };
    // Try to preserve array structures
    if (Array.isArray(detail.summary[editingField])) {
      updatedSummary[editingField] = editValue
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      updatedSummary[editingField] = editValue;
    }

    // Update local state immediately
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

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  // ─── Save Doctor Clinical Notes ───────────────────────────────────────
  const saveDoctorNotes = async () => {
    if (!selectedSessionId || !detail) return;
    setIsSavingNotes(true);
    try {
      const resp = await fetch(`/api/doctor/patient/${selectedSessionId}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_notes: doctorNotesInput })
      });
      if (resp.ok) {
        setDetail(prev => prev ? {
          ...prev,
          summaryMeta: {
            priority: prev.summaryMeta?.priority || 'ROUTINE',
            status: prev.summaryMeta?.status || 'pending',
            doctorNotes: doctorNotesInput
          }
        } : null);
        setNotesSavedSuccess(true);
        setTimeout(() => setNotesSavedSuccess(false), 2500);
      }
    } catch (err) {
      console.error('Failed to save doctor notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // ─── Mark as Diagnosed ────────────────────────────────────────────────
  const markDiagnosed = async () => {
    if (!selectedSessionId || !detail) return;

    const currentNotes = doctorNotesInput || detail.summaryMeta?.doctorNotes || null;

    // Update local state
    setDetail({
      ...detail,
      summaryMeta: {
        priority: detail.summaryMeta?.priority || 'ROUTINE',
        status: 'accepted',
        doctorNotes: currentNotes
      }
    });

    // Persist to Supabase
    try {
      await fetch(`/api/doctor/patient/${selectedSessionId}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          doctor_notes: currentNotes || undefined
        })
      });
      // Update patients list immediately
      setPatients(prev =>
        prev.map(p =>
          p.sessionId === selectedSessionId ? { ...p, summaryStatus: 'accepted' } : p
        )
      );
    } catch (err) {
      console.error('Failed to mark as diagnosed:', err);
    }
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
    const summary = detail?.summary || {};
    const clinicalState = detail?.clinicalState || {};
    const redFlags = detail?.redFlags || [];
    const priority = (detail?.summaryMeta?.priority || (summary.priority as string) || 'ROUTINE').toUpperCase();

    // Intake summary properties (properly coerced for type-safe rendering)
    const chiefComplaint = toSafeString(summary.chief_complaint || clinicalState.chief_complaint);
    const hpi = summary.history_of_present_illness ? toSafeString(summary.history_of_present_illness) : '';
    const summarySynthesis = summary.summary_text ? toSafeString(summary.summary_text) : '';
    const associatedSymptoms = summary.associated_symptoms || clinicalState.associated_symptoms;
    const pastMedicalHistory = summary.past_medical_history || clinicalState.past_history;
    const currentMedications = summary.current_medications || clinicalState.medications;
    const relevantInvestigations = summary.relevant_investigations;
    const allergies = clinicalState.allergies;
    const triageConsiderations = summary.recommended_actions;

    // Severity assessment
    const severityObj = (summary.severity_assessment as Record<string, unknown>) || null;
    const severityScore = severityObj?.score ?? clinicalState.severity ?? null;
    const severityLevel = severityObj?.level ?? (severityScore != null ? (Number(severityScore) >= 8 ? 'SEVERE' : Number(severityScore) >= 4 ? 'MODERATE' : 'MILD') : null);

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
              <h1 className={styles.headerTitle} style={{ fontSize: 16 }}>MediKiosk Clinical Portal</h1>
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
            {/* Patient Identity Hero */}
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
                  {redFlags.length > 0 && (
                    <div className={styles.redFlagAlertPill}>
                      <ShieldAlert size={16} />
                      <span>{redFlags.length} Red Flag{redFlags.length > 1 ? 's' : ''} Identified</span>
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

                  <button
                    className={styles.refreshQueueBtn}
                    style={{ background: '#ffffff', border: '1px solid #d5ddd6', height: 38 }}
                    onClick={handleManualRefresh}
                    title="Refresh patient record and documents"
                  >
                    <RotateCcw size={14} className={isRefreshing ? styles.spinIcon : ''} />
                    <span>{isRefreshing ? 'Syncing...' : 'Sync Record'}</span>
                  </button>
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
            <main id="main-content" tabIndex={-1} className={styles.detailContent}>
              {/* ─── SUMMARY TAB ────────────────────────────────────────── */}
              {activeTab === 'summary' && (
                <div className="animate-fade-in">
                  {/* AI Disclaimer Banner */}
                  <div className={styles.aiDisclaimerBanner}>
                    <Info size={18} className={styles.disclaimerIcon} />
                    <div className={styles.disclaimerText}>
                      <span className={styles.disclaimerTitle}>
                        AI-assisted Intake Summary — Physician evaluation required
                      </span>
                      This summary aggregates patient-reported responses and automated document extractions.
                      It is provided as clinical decision support for intake triaging and must not replace direct physician examination or judgment.
                    </div>
                  </div>

                  {/* 1. Triage & Red Flags Card */}
                  <div className={styles.clinicalCard}>
                    <div className={styles.clinicalCardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <ShieldAlert size={15} />
                        <span>Triage & Risk Stratification</span>
                      </div>
                      <span className={styles.cardHeaderBadge}>
                        Priority: {priority}
                      </span>
                    </div>
                    <div className={styles.clinicalCardBody}>
                      <div className={styles.triageStatsGrid}>
                        <div className={styles.triageStatItem}>
                          <span className={styles.statItemLabel}>Red Flag Assessment</span>
                          <div className={styles.statItemValue}>
                            {redFlags.length > 0 ? (
                              <div className={styles.redFlagAlertPill}>
                                <AlertTriangle size={15} />
                                <span>{redFlags.length} Flagged ({redFlags.map(r => r.rule_name || r.severity).join(', ')})</span>
                              </div>
                            ) : (
                              <div className={styles.noRedFlagPill}>
                                <CheckCircle2 size={15} />
                                <span>No immediate clinical red flags identified</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={styles.triageStatItem}>
                          <span className={styles.statItemLabel}>Intake Severity Assessment</span>
                          <div className={styles.statItemValue}>
                            {severityScore != null ? (
                              <span>
                                Score: <strong>{String(severityScore)}/10</strong>
                                {severityLevel ? ` · Level: ${String(severityLevel)}` : ''}
                              </span>
                            ) : (
                              <span className={styles.emptyDash}>Not recorded</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Chief Complaint & Clinical Presentation */}
                  <div className={styles.clinicalCard}>
                    <div className={styles.clinicalCardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <Activity size={15} />
                        <span>Chief Complaint & Clinical Presentation</span>
                      </div>
                      <span className={styles.cardHeaderBadge}>AI-Assisted Intake</span>
                    </div>
                    <div className={styles.clinicalCardBody}>
                      {/* Chief Complaint */}
                      <div className={styles.clinicalItemRow}>
                        <div className={styles.itemLabelGroup}>
                          <span className={styles.itemLabel}>Chief Complaint</span>
                          <span className={styles.sourceLabel}>Source: Patient report</span>
                        </div>
                        <div className={styles.itemValue}>
                          {editingField === 'chief_complaint' ? (
                            <textarea
                              className={styles.editTextarea}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                          ) : (
                            <span>{toSafeString(chiefComplaint) || <span className={styles.emptyDash}>—</span>}</span>
                          )}
                        </div>
                        <div>
                          {editingField === 'chief_complaint' ? (
                            <div className={styles.editActionsGroup}>
                              <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                <Check size={13} />
                                Save
                              </button>
                              <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit('chief_complaint', chiefComplaint)}
                              title="Edit Chief Complaint"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* History of Present Illness */}
                      {Boolean(hpi) && (
                        <div className={styles.clinicalItemRow}>
                          <div className={styles.itemLabelGroup}>
                            <span className={styles.itemLabel}>History of Present Illness (HPI)</span>
                            <span className={styles.sourceLabel}>Narrative synthesis</span>
                          </div>
                          <div className={styles.itemValue}>
                            {editingField === 'history_of_present_illness' ? (
                              <textarea
                                className={styles.editTextarea}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                rows={4}
                                autoFocus
                              />
                            ) : (
                              <span>{toSafeString(hpi)}</span>
                            )}
                          </div>
                          <div>
                            {editingField === 'history_of_present_illness' ? (
                              <div className={styles.editActionsGroup}>
                                <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                  <Check size={13} />
                                  Save
                                </button>
                                <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className={styles.editBtn}
                                onClick={() => startEdit('history_of_present_illness', hpi)}
                                title="Edit HPI"
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Clinical Synthesis / Summary Text */}
                      {Boolean(summarySynthesis) && (
                        <div className={styles.clinicalItemRow}>
                          <div className={styles.itemLabelGroup}>
                            <span className={styles.itemLabel}>Clinical Synthesis</span>
                            <span className={styles.sourceLabel}>Summary overview</span>
                          </div>
                          <div className={styles.itemValue}>
                            {editingField === 'summary_text' ? (
                              <textarea
                                className={styles.editTextarea}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                rows={3}
                                autoFocus
                              />
                            ) : (
                              <span>{toSafeString(summarySynthesis)}</span>
                            )}
                          </div>
                          <div>
                            {editingField === 'summary_text' ? (
                              <div className={styles.editActionsGroup}>
                                <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                  <Check size={13} />
                                  Save
                                </button>
                                <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className={styles.editBtn}
                                onClick={() => startEdit('summary_text', summarySynthesis)}
                                title="Edit Synthesis"
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Extracted Symptoms & Patient History */}
                  <div className={styles.clinicalCard}>
                    <div className={styles.clinicalCardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <ClipboardList size={15} />
                        <span>Symptoms & Reported Patient History</span>
                      </div>
                      <span className={styles.cardHeaderBadge}>AI-Assisted Intake</span>
                    </div>
                    <div className={styles.clinicalCardBody}>
                      {/* Associated Symptoms */}
                      <div className={styles.clinicalItemRow}>
                        <div className={styles.itemLabelGroup}>
                          <span className={styles.itemLabel}>Associated Symptoms</span>
                          <span className={styles.sourceLabel}>Source: Patient report</span>
                        </div>
                        <div className={styles.itemValue}>
                          {editingField === 'associated_symptoms' ? (
                            <textarea
                              className={styles.editTextarea}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                          ) : Array.isArray(associatedSymptoms) && associatedSymptoms.length > 0 ? (
                            <div className={styles.chipsWrap}>
                              {associatedSymptoms.map((s, idx) => (
                                <span key={idx} className={styles.clinicalChip}>
                                  {toSafeString(s)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>{toSafeString(associatedSymptoms) || <span className={styles.emptyDash}>None reported</span>}</span>
                          )}
                        </div>
                        <div>
                          {editingField === 'associated_symptoms' ? (
                            <div className={styles.editActionsGroup}>
                              <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                <Check size={13} />
                                Save
                              </button>
                              <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit('associated_symptoms', associatedSymptoms)}
                              title="Edit Symptoms"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Past Medical History */}
                      <div className={styles.clinicalItemRow}>
                        <div className={styles.itemLabelGroup}>
                          <span className={styles.itemLabel}>Past Medical History</span>
                          <span className={styles.sourceLabel}>Source: Patient report</span>
                        </div>
                        <div className={styles.itemValue}>
                          {editingField === 'past_medical_history' ? (
                            <textarea
                              className={styles.editTextarea}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                          ) : Array.isArray(pastMedicalHistory) && pastMedicalHistory.length > 0 ? (
                            <div className={styles.chipsWrap}>
                              {pastMedicalHistory.map((m, idx) => (
                                <span key={idx} className={styles.clinicalChip}>
                                  {toSafeString(m)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>{toSafeString(pastMedicalHistory) || <span className={styles.emptyDash}>None reported</span>}</span>
                          )}
                        </div>
                        <div>
                          {editingField === 'past_medical_history' ? (
                            <div className={styles.editActionsGroup}>
                              <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                <Check size={13} />
                                Save
                              </button>
                              <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit('past_medical_history', pastMedicalHistory)}
                              title="Edit Past History"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Current Medications */}
                      <div className={styles.clinicalItemRow}>
                        <div className={styles.itemLabelGroup}>
                          <span className={styles.itemLabel}>Current Medications</span>
                          <span className={styles.sourceLabel}>Source: Patient report & OCR</span>
                        </div>
                        <div className={styles.itemValue}>
                          {editingField === 'current_medications' ? (
                            <textarea
                              className={styles.editTextarea}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                          ) : Array.isArray(currentMedications) && currentMedications.length > 0 ? (
                            <div className={styles.chipsWrap}>
                              {currentMedications.map((m, idx) => (
                                <span key={idx} className={styles.clinicalChip}>
                                  {toSafeString(m)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>{toSafeString(currentMedications) || <span className={styles.emptyDash}>None reported</span>}</span>
                          )}
                        </div>
                        <div>
                          {editingField === 'current_medications' ? (
                            <div className={styles.editActionsGroup}>
                              <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                <Check size={13} />
                                Save
                              </button>
                              <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.editBtn}
                              onClick={() => startEdit('current_medications', currentMedications)}
                              title="Edit Medications"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Allergies */}
                      <div className={styles.clinicalItemRow}>
                        <div className={styles.itemLabelGroup}>
                          <span className={styles.itemLabel}>Known Allergies</span>
                          <span className={styles.sourceLabel}>Source: Patient report</span>
                        </div>
                        <div className={styles.itemValue}>
                          {Array.isArray(allergies) && allergies.length > 0 ? (
                            <div className={styles.chipsWrap}>
                              {allergies.map((a, idx) => (
                                <span key={idx} className={styles.clinicalChip}>
                                  {toSafeString(a)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span>{toSafeString(allergies) || <span className={styles.emptyDash}>None reported</span>}</span>
                          )}
                        </div>
                        <div />
                      </div>

                      {/* Relevant Investigations */}
                      {Boolean(relevantInvestigations) && (
                        <div className={styles.clinicalItemRow}>
                          <div className={styles.itemLabelGroup}>
                            <span className={styles.itemLabel}>Relevant Investigations</span>
                            <span className={styles.sourceLabel}>Extracted reports</span>
                          </div>
                          <div className={styles.itemValue}>
                            {Array.isArray(relevantInvestigations) && relevantInvestigations.length > 0 ? (
                              <div className={styles.chipsWrap}>
                                {relevantInvestigations.map((inv, idx) => (
                                  <span key={idx} className={styles.clinicalChip}>
                                    {toSafeString(inv)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span>{toSafeString(relevantInvestigations)}</span>
                            )}
                          </div>
                          <div />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Intake Observations & Triage Considerations (Reframed from Recommended Actions) */}
                  {Boolean(triageConsiderations) && (
                    <div className={styles.clinicalCard}>
                      <div className={styles.clinicalCardHeader}>
                        <div className={styles.cardHeaderTitle}>
                          <FileText size={15} />
                          <span>Intake Observations & Triage Considerations</span>
                        </div>
                        <span className={styles.cardHeaderBadge}>AI Triage Assistance</span>
                      </div>
                      <div className={styles.clinicalCardBody}>
                        <div className={styles.clinicalItemRow}>
                          <div className={styles.itemLabelGroup}>
                            <span className={styles.itemLabel}>Triage Considerations</span>
                            <span className={styles.sourceLabel}>Preliminary intake guidance</span>
                          </div>
                          <div className={styles.itemValue}>
                            {editingField === 'recommended_actions' ? (
                              <textarea
                                className={styles.editTextarea}
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                rows={3}
                                autoFocus
                              />
                            ) : Array.isArray(triageConsiderations) && triageConsiderations.length > 0 ? (
                              <div className={styles.chipsWrap}>
                                {triageConsiderations.map((action, idx) => (
                                  <span key={idx} className={styles.clinicalChip}>
                                    {toSafeString(action)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span>{toSafeString(triageConsiderations)}</span>
                            )}
                          </div>
                          <div>
                            {editingField === 'recommended_actions' ? (
                              <div className={styles.editActionsGroup}>
                                <button className={styles.saveBtn} onClick={saveEdit} title="Save changes">
                                  <Check size={13} />
                                  Save
                                </button>
                                <button className={styles.cancelBtn} onClick={cancelEdit} title="Cancel">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className={styles.editBtn}
                                onClick={() => startEdit('recommended_actions', triageConsiderations)}
                                title="Edit Considerations"
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. Doctor Clinical Notes Card */}
                  <div className={styles.clinicalCard}>
                    <div className={styles.clinicalCardHeader}>
                      <div className={styles.cardHeaderTitle}>
                        <Pencil size={15} />
                        <span>Doctor Clinical Notes</span>
                      </div>
                      <span className={`${styles.cardHeaderBadge} ${styles.doctorEnteredBadge}`}>
                        Doctor-Entered
                      </span>
                    </div>
                    <div className={styles.clinicalCardBody}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
                        Enter your professional clinical evaluation, confirmed diagnosis, prescription instructions, or referral plan:
                      </p>
                      <textarea
                        className={styles.notesTextarea}
                        placeholder="Enter physician assessment, differential diagnosis, prescription, or clinical guidance here..."
                        value={doctorNotesInput}
                        onChange={e => setDoctorNotesInput(e.target.value)}
                        rows={4}
                      />
                      <div className={styles.notesActions}>
                        <button
                          className={styles.saveBtn}
                          onClick={saveDoctorNotes}
                          disabled={isSavingNotes}
                        >
                          {isSavingNotes ? (
                            <span>Saving Notes...</span>
                          ) : notesSavedSuccess ? (
                            <>
                              <CheckCheck size={14} />
                              <span>Clinical Notes Saved</span>
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              <span>Save Clinical Notes</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── HISTORY TAB ────────────────────────────────────────── */}
              {activeTab === 'history' && (
                <div className={`${styles.clinicalCard} animate-fade-in`}>
                  <div className={styles.clinicalCardHeader}>
                    <div className={styles.cardHeaderTitle}>
                      <ClipboardList size={15} />
                      <span>Intake Interview & Case History</span>
                    </div>
                    <span className={styles.cardHeaderBadge}>Recorded Intake</span>
                  </div>
                  <div className={styles.historyCardGrid}>
                    {(() => {
                      const cs = detail.clinicalState || {};
                      return [
                        ['Chief Complaint', cs.chief_complaint],
                        ['Duration / Onset', cs.onset],
                        ['Location', cs.location],
                        ['Severity Level', cs.severity != null ? `${cs.severity}/10` : null],
                        ['Character / Quality', cs.character],
                        ['Radiation', cs.radiation],
                        ['Associated Breathlessness', cs.breathlessness != null ? (cs.breathlessness ? 'Yes' : 'No') : null],
                        ['Associated Sweating', cs.sweating != null ? (cs.sweating ? 'Yes' : 'No') : null],
                        ['Associated Dizziness', cs.dizziness != null ? (cs.dizziness ? 'Yes' : 'No') : null],
                        ['Associated Nausea', cs.nausea != null ? (cs.nausea ? 'Yes' : 'No') : null],
                        ['Previous Episode', cs.previous_episode != null ? (cs.previous_episode ? 'Yes' : 'No') : null],
                        ['Past Medical History', Array.isArray(cs.past_history) ? (cs.past_history as string[]).join(', ') : toSafeString(cs.past_history)],
                        ['Current Medications', Array.isArray(cs.medications) ? (cs.medications as string[]).join(', ') : toSafeString(cs.medications)],
                        ['Known Allergies', Array.isArray(cs.allergies) ? (cs.allergies as string[]).join(', ') : toSafeString(cs.allergies)],
                        ['Consultation Category', detail.session?.consultationType],
                        ['Intake Language', detail.session?.language === 'hi' ? 'Hindi (हिन्दी)' : 'English'],
                      ].map(([label, value]) => (
                        <div key={label as string} className={styles.historyCell}>
                          <span className={styles.historyCellLabel}>{label as string}</span>
                          <span className={styles.historyCellValue}>{toSafeString(value) || <span className={styles.emptyDash}>—</span>}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* ─── DOCUMENTS TAB ──────────────────────────────────────── */}
              {activeTab === 'documents' && (
                <div className="animate-fade-in">
                  {detail.documents.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIconCircle}>
                        <FileCheck size={32} />
                      </div>
                      <h3>No Documents Uploaded</h3>
                      <p>The patient did not upload clinical documents or test reports for this session.</p>
                    </div>
                  ) : (
                    detail.documents.map((doc, i) => {
                      const docKey = doc.id || `doc-${i}`;
                      const isHighConf = doc.confidence === 'HIGH';
                      const isExpanded = expandedOcrDocId === docKey;

                      return (
                        <div key={docKey} className={styles.docCard}>
                          <div className={styles.docHeader}>
                            <div className={styles.docHeaderLeft}>
                              <FileText size={18} color="var(--green-600)" />
                              <span className={styles.docHeaderTitle}>Clinical Document {i + 1}</span>
                              {doc.uploadDate && (
                                <span className={styles.docDate}>
                                  · {new Date(doc.uploadDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <span className={isHighConf ? styles.confBadgeVerified : styles.confBadgeVerify}>
                              {isHighConf ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                              {isHighConf ? 'VERIFIED' : 'NEEDS VERIFICATION'}
                            </span>
                          </div>

                          <div className={styles.docCardBody}>
                            {/* Structured Findings First */}
                            {doc.extractedData && Object.entries(doc.extractedData)
                              .filter(([k, v]) => {
                                if (['raw_text', 'confidence'].includes(k)) return false;
                                if (Array.isArray(v) && v.length === 0) return false;
                                if (!v) return false;
                                return true;
                              })
                              .map(([k, v]) => (
                                <div key={k} className={styles.extractedSection}>
                                  <span className={styles.extractedLabel}>{k.replace(/_/g, ' ')}</span>
                                  <div>{toSafeString(v)}</div>
                                </div>
                              ))}

                            {/* Collapsible Toggle for Raw OCR */}
                            {doc.rawText && (
                              <div>
                                <button
                                  className={styles.ocrToggleBtn}
                                  onClick={() => setExpandedOcrDocId(isExpanded ? null : docKey)}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  <span>{isExpanded ? 'Hide Raw OCR Extraction' : 'View Raw OCR Extraction'}</span>
                                </button>

                                {isExpanded && (
                                  <div className={styles.ocrExpandedBox}>
                                    <div className={styles.ocrHeader}>
                                      <span className={styles.ocrTitle}>Raw Extracted Text</span>
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
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </main>
          </>
        ) : (
          <div className={styles.emptyState} style={{ margin: 28 }}>
            <div className={styles.emptyIconCircle}>
              <AlertTriangle size={32} />
            </div>
            <h3>Failed to Load Record</h3>
            <p>Could not retrieve patient details. Please try again or return to the queue.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Patient Cards Queue View ─────────────────────────────────────────
  const pendingPatients = patients.filter(p => p.summaryStatus !== 'accepted');
  const diagnosedPatients = patients.filter(p => p.summaryStatus === 'accepted');
  const pendingCount = pendingPatients.length;
  const diagnosedCount = diagnosedPatients.length;
  const urgentCount = pendingPatients.filter(p => p.priority?.toUpperCase() === 'URGENT').length;
  const routineCount = pendingPatients.filter(p => p.priority?.toUpperCase() !== 'URGENT').length;

  return (
    <div className={styles.main}>
      {/* Workstation Top Navigation Header */}
      <header className={styles.dashHeader}>
        <div className={styles.brandGroup}>
          <div className={styles.stethoscopeBadge}>
            <Stethoscope size={22} />
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
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </header>

      {/* Queue Control Bar with Live Status Metrics */}
      <div className={styles.queueControlBar}>
        <div className={styles.queueControlInner}>
          <div className={styles.queueMetaSummary}>
            <h2 className={styles.queueHeading}>
              <Activity size={18} color="var(--green-600)" />
              <span>{dashboardTab === 'pending' ? 'Active Consultation Queue' : 'Completed Diagnoses'}</span>
            </h2>
            <div className={styles.queueCountsLine}>
              {dashboardTab === 'pending' ? (
                <span>
                  <span className={styles.countHighlight}>{pendingCount}</span> patients waiting for review
                  {' · '}
                  <span className={styles.urgentCountHighlight}>{urgentCount} urgent</span>
                  {' · '}
                  <span className={styles.countHighlight}>{routineCount} routine</span>
                </span>
              ) : (
                <span>
                  <span className={styles.countHighlight}>{diagnosedCount}</span> verified clinical records archived
                </span>
              )}
            </div>
          </div>

          <div className={styles.queueRightActions}>
            {/* Dashboard Tab Pills */}
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

            {/* Search Input */}
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                id="doctor-search"
                className={styles.searchInput}
                type="text"
                placeholder="Search patient, ABHA, session..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch('')} title="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Live Sync Badge */}
            <div className={styles.liveBadge} title="Real-time queue sync active">
              <span className={styles.livePulseDot} />
              <span>Live Sync</span>
            </div>

            {/* Manual Sync Button */}
            <button
              className={styles.refreshQueueBtn}
              onClick={handleManualRefresh}
              title="Sync and refresh patient queue"
            >
              <RotateCcw size={14} className={isRefreshing ? styles.spinIcon : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patient Cards Container */}
      <main id="main-content" tabIndex={-1} className={styles.cardsContainer}>
        {listLoading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
            <p>Loading patient consultation queue...</p>
          </div>
        ) : (() => {
          const currentList = dashboardTab === 'diagnosed' ? diagnosedPatients : pendingPatients;

          if (currentList.length === 0) {
            return (
              <div className={styles.emptyState}>
                <div className={styles.emptyIconCircle}>
                  <ClipboardList size={32} />
                </div>
                <h3>No Patients Found</h3>
                <p>
                  {search
                    ? 'No matching patient records found. Try another search query.'
                    : `There are currently no ${dashboardTab === 'pending' ? 'pending' : 'diagnosed'} consultations in this queue.`}
                </p>
              </div>
            );
          }

          return (
            <div className={styles.cardsGrid}>
              {currentList.map(p => {
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
                        {priorityKey === 'urgent' && <span className={styles.urgentDot} />}
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
