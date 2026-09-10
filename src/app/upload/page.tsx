'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, ExtractedDocument } from '@/lib/store';
import { t } from '@/lib/translations';
import styles from './page.module.css';

export default function UploadPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [extracted, setExtracted] = useState<ExtractedDocument | null>(null);
  const [documents, setDocuments] = useState<ExtractedDocument[]>(session.documents || []);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className="section-title">{t(lang, 'upload_title')}</h1>
              <p className="section-subtitle">{t(lang, 'upload_subtitle')}</p>
            </div>
          </div>

          {/* Upload zone */}
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
                <div className={styles.dropIcon}>📄</div>
                <p className={styles.dropText}>{t(lang, 'upload_btn')}</p>
                <p className={styles.dropHint}>
                  {lang === 'hi' ? 'या यहाँ खींचें और छोड़ें' : 'or drag & drop here'}
                </p>
                <p className={styles.dropFormats}>JPG, PNG, PDF</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {file && status !== 'done' && (
            <button
              id="upload-process-btn"
              className={`btn btn-primary btn-lg ${styles.processBtn}`}
              onClick={handleProcess}
              disabled={status === 'processing'}
            >
              {status === 'processing' ? (
                <><div className="spinner" />{t(lang, 'upload_processing')}</>
              ) : (
                <>{lang === 'hi' ? 'दस्तावेज़ पढ़ें' : 'Read Document'}</>
              )}
            </button>
          )}

          {/* Result */}
          {extracted && status === 'done' && (
            <div className={`${styles.result} animate-fade-in-up`}>
              <div className={styles.resultHeader}>
                <span className="badge badge-success">
                  {extracted.confidence === 'HIGH' ? '✅ ' : '⚠️ '}
                  {extracted.confidence === 'NEEDS_VERIFICATION'
                    ? t(lang, 'upload_verify')
                    : t(lang, 'upload_success')}
                </span>
              </div>

              {extracted.diagnosis && extracted.diagnosis.length > 0 && (
                <div className={styles.resultSection}>
                  <h3>{lang === 'hi' ? 'निदान' : 'Diagnosis'}</h3>
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
            <button id="upload-skip-btn" className="btn btn-ghost" onClick={handleSkip}>
              {documents.length > 0 ? (lang === 'hi' ? 'छोड़ें' : 'Skip further uploads') : t(lang, 'upload_skip')}
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
                  {lang === 'hi' ? 'एक और अपलोड करें' : 'Upload Another'}
                </button>
              )}

              {(status === 'done' || (!file && documents.length > 0) || (!file && documents.length === 0)) && (
                <button id="upload-continue-btn" className="btn btn-primary btn-lg" onClick={handleContinue}>
                  {lang === 'hi' ? 'सारांश देखें' : 'View Summary'}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
