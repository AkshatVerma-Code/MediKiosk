'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, defaultSession, AppSession, ExtractedDocument } from '@/lib/store';
import { t } from '@/lib/translations';
import { FileUp, Camera, CheckCircle2, AlertCircle, ArrowRight, Plus } from 'lucide-react';
import styles from './page.module.css';

export default function UploadPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<AppSession>(defaultSession);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [processingStep, setProcessingStep] = useState(0);

  const ocrSteps = {
    hi: [
      'दस्तावेज़ पढ़ा जा रहा है…',
      'दवाएं और रिपोर्ट विवरण खोजे जा रहे हैं…',
      'जानकारी सत्यापित की जा रही है…',
    ],
    en: [
      'Reading your document…',
      'Finding medicines and report details…',
      'Checking extracted information…',
    ],
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadSession();
    setSession(s);
    setDocuments(s.documents || []);
    setMounted(true);
  }, []);

  // Cycle through OCR progress messages while processing
  useEffect(() => {
    if (status !== 'processing') { setProcessingStep(0); return; }
    const timer = setInterval(() => {
      setProcessingStep(prev => Math.min(prev + 1, 2));
    }, 1800);
    return () => clearInterval(timer);
  }, [status]);

  const lang = session.language;

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setStatus('idle');
    setExtracted(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleProcess = async () => {
    if (!file) return;
    setStatus('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch('/api/ocr', { method: 'POST', body: formData });
      const data = await resp.json();

      const doc: ExtractedDocument = {
        date: data.date,
        diagnosis: data.diagnosis || [],
        medications: data.medications || [],
        labs: data.labs || [],
        raw_text: data.raw_text || '',
        confidence: data.confidence || 'NEEDS_VERIFICATION',
      };

      setExtracted(doc);
      setStatus('done');

      const newDocs = [...documents, doc];
      setDocuments(newDocs);
      updateSession({ documents: newDocs });
    } catch {
      setStatus('error');
    }
  };

  const handleSkip = () => {
    router.push('/summary');
  };

  const handleContinue = () => {
    router.push('/summary');
  };

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
        <div className="animate-fade-in-up" style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.iconWrap}>
              <FileUp size={32} strokeWidth={2.2} color="#1E5B2B" />
            </div>
            <div>
              <h1 className="section-title" data-read-aloud="true">{t(lang, 'upload_title')}</h1>
              <p className="section-subtitle">{t(lang, 'upload_subtitle')}</p>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {preview ? (
              <div className={styles.previewWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Document preview" className={styles.preview} />
                <p className={styles.previewName}>{file?.name}</p>
              </div>
            ) : (
              <div className={styles.dropContent}>
                <div className={styles.dropIconPair}>
                  <div className={styles.dropIconCircle}>
                    <FileUp size={32} strokeWidth={2} color="#1E5B2B" />
                  </div>
                  <div className={styles.dropIconCircle}>
                    <Camera size={32} strokeWidth={2} color="#1E5B2B" />
                  </div>
                </div>
                <p className={styles.dropText}>{t(lang, 'upload_btn')}</p>
                <p className={styles.dropHint}>
                  {lang === 'hi' ? 'दस्तावेज़ की फ़ोटो चुनें या कैमरा से लें' : 'Choose document photo or capture with camera'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  {lang === 'hi' ? 'सुनिश्चित करें कि लिखावट साफ़ दिखाई दे रही हो' : 'Make sure the writing is clearly visible'}
                </p>
                <p className={styles.dropFormats}>JPG, PNG, PDF</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {file && status !== 'done' && (
            <button
              id="upload-process-btn"
              className={`btn btn-primary btn-xl ${styles.processBtn}`}
              onClick={handleProcess}
              disabled={status === 'processing'}
            >
              {status === 'processing' ? (
                <><div className="spinner" /><span>{lang === 'hi' ? ocrSteps.hi[processingStep] : ocrSteps.en[processingStep]}</span></>
              ) : (
                <>{lang === 'hi' ? 'दस्तावेज़ स्कैन करें' : 'Scan Document'}</>
              )}
            </button>
          )}

          {/* Result */}
          {extracted && status === 'done' && (
            <div className={`${styles.result} animate-fade-in-up`}>
              <div className={styles.resultHeader}>
                <span
                  className={`badge ${extracted.confidence === 'HIGH' ? 'badge-success' : 'badge-warning'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {extracted.confidence === 'HIGH' ? (
                    <CheckCircle2 size={16} strokeWidth={2.4} />
                  ) : (
                    <AlertCircle size={16} strokeWidth={2.4} />
                  )}
                  <span>
                    {extracted.confidence === 'NEEDS_VERIFICATION'
                      ? (lang === 'hi' ? 'सत्यापन आवश्यक' : 'Needs Verification')
                      : (lang === 'hi' ? 'स्पष्ट पढ़ा गया' : "We've read your document")}
                  </span>
                </span>
              </div>

              {extracted.diagnosis && extracted.diagnosis.length > 0 && (
                <div className={styles.resultSection}>
                  <h3>{lang === 'hi' ? 'उल्लिखित स्थितियां' : 'Mentioned Conditions'}</h3>
                  <div className={styles.pills}>
                    {extracted.diagnosis.map(d => <span key={d} className="badge badge-info">{d}</span>)}
                  </div>
                </div>
              )}

              {extracted.medications && extracted.medications.length > 0 && (
                <div className={styles.resultSection}>
                  <h3>{lang === 'hi' ? 'दवाएं' : 'Medications'}</h3>
                  {extracted.medications.map((m, i) => (
                    <div key={i} className={styles.medRow}>
                      <span className={styles.medName}>{m.name}</span>
                      {m.dose && <span className={styles.medDetail}>{m.dose}</span>}
                      {m.frequency && <span className={styles.medDetail}>{m.frequency}</span>}
                    </div>
                  ))}
                </div>
              )}

              {extracted.labs && extracted.labs.length > 0 && (
                <div className={styles.resultSection}>
                  <h3>{lang === 'hi' ? 'जांच परिणाम' : 'Lab Results'}</h3>
                  {extracted.labs.map((l, i) => (
                    <div key={i} className={styles.labRow}>
                      <span>{l.name}</span>
                      <span className={styles.labValue}>{l.value} {l.unit}</span>
                      {l.status && (
                        <span className={`badge ${l.status === 'LOW' || l.status === 'HIGH' ? 'badge-danger' : 'badge-success'}`}>
                          {l.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className={styles.navRow}>
            <button
              id="upload-skip-btn"
              className={styles.bypassBtn}
              onClick={handleSkip}
            >
              {documents.length > 0
                ? (lang === 'hi' ? 'आगे बढ़ें (Proceed)' : 'Skip further uploads')
                : (lang === 'hi' ? 'मेरे पास दस्तावेज़ नहीं हैं (आगे बढ़ें)' : 'I don\'t have documents (Proceed)')}
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              {status === 'done' && (
                <button
                  id="upload-another-btn"
                  className="btn btn-secondary btn-lg"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                    setStatus('idle');
                    setExtracted(null);
                  }}
                >
                  <Plus size={18} strokeWidth={2} />
                  <span>{lang === 'hi' ? 'एक और अपलोड करें' : 'Upload Another'}</span>
                </button>
              )}

              {(status === 'done' || (!file && documents.length > 0)) && (
                <button id="upload-continue-btn" className="btn btn-primary btn-xl" onClick={handleContinue}>
                  <span>{lang === 'hi' ? 'सारांश देखें' : 'View Summary'}</span>
                  <ArrowRight size={22} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
