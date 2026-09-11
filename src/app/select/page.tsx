'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, defaultClinicalState } from '@/lib/store';
import { t } from '@/lib/translations';
import styles from './page.module.css';

export default function SelectPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;
  const [ayushModal, setAyushModal] = useState(false);

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  const handleGeneral = () => {
    updateSession({
      consultationType: 'general',
      clinicalState: { ...defaultClinicalState },
      messages: [],
      redFlags: [],
      summary: null,
    });
    router.push('/case-taking');
  };

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className="page-content" style={{ minHeight: 'calc(100dvh - 60px)' }}>
        {/* Patient greeting */}
        {session.patient && (
          <div className={`${styles.greeting} animate-fade-in`}>
            <div className={styles.greetingAvatar}>
              {session.patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className={styles.greetingHello}>
                {lang === 'hi' ? 'नमस्ते,' : 'Hello,'}
              </p>
              <p className={styles.greetingName}>{session.patient.name}</p>
            </div>
          </div>
        )}

        <div className={`${styles.header} animate-fade-in delay-100`}>
          <h1 className="section-title">{t(lang, 'consult_title')}</h1>
          <p className="section-subtitle">{t(lang, 'consult_subtitle')}</p>
        </div>

        <div className={styles.grid}>
          {/* GENERAL MEDICAL */}
          <div
            className={`${styles.consultCard} ${styles.activeCard} animate-fade-in-up delay-200`}
            id="select-general-card"
          >
            <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" stroke="#2D7A3A" strokeWidth="1.5"/>
                <path d="M12 8v8M8 12h8" stroke="#2D7A3A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.cardBadge}>
              <span className="badge badge-success">
                {lang === 'hi' ? 'उपलब्ध' : 'Available'}
              </span>
            </div>
            <h2 className={styles.cardTitle}>{t(lang, 'consult_general_title')}</h2>
            <p className={styles.cardDesc}>{t(lang, 'consult_general_desc')}</p>

            <div className={styles.cardFeatures}>
              {(lang === 'hi'
                ? ['🎤 आवाज़ से बात करें', '👆 विकल्प टैप करें', '🚩 रेड-फ्लैग डिटेक्शन', '📄 OCR दस्तावेज़ पढ़ना']
                : ['🎤 Voice interaction', '👆 Tap to answer', '🚩 Red-flag detection', '📄 OCR document reading']
              ).map(f => (
                <div key={f} className={styles.feature}>{f}</div>
              ))}
            </div>

            <button
              id="select-general-btn"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              onClick={handleGeneral}
            >
              {t(lang, 'consult_general_btn')}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* AYUSH */}
          <div
            className={`${styles.consultCard} ${styles.comingSoonCard} animate-fade-in-up delay-300`}
            id="select-ayush-card"
            onClick={() => setAyushModal(true)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setAyushModal(true)}
          >
            <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #FFF8E1, #FFF3CD)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" stroke="#F59E0B" strokeWidth="1.5"/>
                <path d="M12 6c-1 2-4 3-4 6s3 4 4 6c1-2 4-3 4-6s-3-4-4-6z" stroke="#F59E0B" strokeWidth="1.5"/>
                <path d="M6 12h12" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className={styles.cardBadge}>
              <span className="coming-soon-badge">
                {t(lang, 'consult_ayush_coming_soon')}
              </span>
            </div>
            <h2 className={styles.cardTitle} style={{ color: 'var(--gray-500)' }}>
              {t(lang, 'consult_ayush_title')}
            </h2>
            <p className={styles.cardDesc} style={{ color: 'var(--gray-400)' }}>
              {t(lang, 'consult_ayush_desc')}
            </p>

            <div className={styles.cardFeatures}>
              {(lang === 'hi'
                ? ['🌿 दशविध परीक्षा', '🔬 प्रकृति / विकृति', '📋 आयुष प्रश्नावली', '👨‍⚕️ आयुष सारांश']
                : ['🌿 Dashavidha Pariksha', '🔬 Prakriti / Vikriti', '📋 AYUSH Questionnaire', '👨‍⚕️ AYUSH Summary']
              ).map(f => (
                <div key={f} className={`${styles.feature} ${styles.featureDim}`}>{f}</div>
              ))}
            </div>

            <button
              className="btn btn-secondary btn-lg"
              style={{ width: '100%', marginTop: 8, opacity: 0.6, cursor: 'not-allowed' }}
              disabled
            >
              {t(lang, 'consult_ayush_coming_soon')}
            </button>
          </div>
        </div>
      </main>

      {/* AYUSH Coming Soon Modal */}
      {ayushModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
              {t(lang, 'consult_ayush_modal_title')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.6, marginBottom: 24 }}>
              {t(lang, 'consult_ayush_modal_body')}
            </p>
            <button
              id="ayush-modal-close"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setAyushModal(false)}
            >
              {t(lang, 'consult_ayush_modal_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
