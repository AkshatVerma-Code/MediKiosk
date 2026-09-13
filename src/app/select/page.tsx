'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, defaultSession, defaultClinicalState, AppSession } from '@/lib/store';
import { t } from '@/lib/translations';
import { Stethoscope, Sparkles, Mic, Touchpad, AlertTriangle, FileText, ArrowRight, X } from 'lucide-react';
import styles from './page.module.css';

export default function SelectPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<AppSession>(defaultSession);
  const [ayushModal, setAyushModal] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setMounted(true);
  }, []);

  const lang = session.language;

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

  if (!mounted) {
    return (
      <div className="page-container" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 44, height: 44 }} />
      </div>
    );
  }

  const generalFeatures = [
    {
      icon: <Mic size={16} strokeWidth={2} />,
      label: lang === 'hi' ? 'आवाज़ से बातचीत (Voice interaction)' : 'Voice interaction',
    },
    {
      icon: <Touchpad size={16} strokeWidth={2} />,
      label: lang === 'hi' ? 'टच से उत्तर दें (Tap to answer)' : 'Tap to answer',
    },
    {
      icon: <AlertTriangle size={16} strokeWidth={2} />,
      label: lang === 'hi' ? 'रेड-फ्लैग पहचान (Red-flag detection)' : 'Red-flag detection',
    },
    {
      icon: <FileText size={16} strokeWidth={2} />,
      label: lang === 'hi' ? 'दस्तावेज़ स्कैनिंग (Document scanning)' : 'Document scanning',
    },
  ];

  const ayushFeatures = [
    lang === 'hi' ? 'दशविध परीक्षा' : 'Dashavidha Pariksha',
    lang === 'hi' ? 'प्रकृति / विकृति' : 'Prakriti / Vikriti',
    lang === 'hi' ? 'आयुष प्रश्नावली' : 'AYUSH Questionnaire',
    lang === 'hi' ? 'आयुष क्लिनिकल सारांश' : 'AYUSH Clinical Summary',
  ];

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
          <h1 className="section-title" data-read-aloud="true">{t(lang, 'consult_title')}</h1>
          <p className="section-subtitle">{t(lang, 'consult_subtitle')}</p>
        </div>

        <div className={styles.grid}>
          {/* GENERAL MEDICAL — PRIMARY ACTIVE */}
          <div
            className={`${styles.consultCard} ${styles.activeCard} animate-fade-in-up delay-200`}
            id="select-general-card"
            onClick={handleGeneral}
          >
            <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)' }}>
              <Stethoscope size={36} color="#1E5B2B" strokeWidth={2.2} />
            </div>
            <div className={styles.cardBadge}>
              <span className="badge badge-success">
                {lang === 'hi' ? 'सक्रिय (Available)' : 'Active Consultation'}
              </span>
            </div>
            <h2 className={styles.cardTitle}>{t(lang, 'consult_general_title')}</h2>
            <p className={styles.cardDesc}>{t(lang, 'consult_general_desc')}</p>

            <div className={styles.cardFeatures}>
              {generalFeatures.map((f, idx) => (
                <div key={idx} className={styles.feature}>
                  <span className={styles.featureIconWrap}>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>

            <button
              id="select-general-btn"
              className="btn btn-primary btn-xl"
              style={{ width: '100%', marginTop: 8 }}
              onClick={(e) => { e.stopPropagation(); handleGeneral(); }}
            >
              <span>{t(lang, 'consult_general_btn')}</span>
              <ArrowRight size={22} strokeWidth={2.4} />
            </button>
          </div>

          {/* AYUSH — DISTINCT COMING SOON */}
          <div
            className={`${styles.consultCard} ${styles.comingSoonCard} animate-fade-in-up delay-300`}
            id="select-ayush-card"
            onClick={() => setAyushModal(true)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setAyushModal(true)}
          >
            <div className={styles.cardIcon} style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
              <Sparkles size={36} color="#D97706" strokeWidth={2} />
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
              {ayushFeatures.map(f => (
                <div key={f} className={`${styles.feature} ${styles.featureDim}`}>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-lg"
              style={{ width: '100%', marginTop: 8, opacity: 0.7, cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setAyushModal(true); }}
            >
              {lang === 'hi' ? 'विवरण देखें (जल्द आ रहा है)' : 'Details (Coming Soon)'}
            </button>
          </div>
        </div>
      </main>

      {/* AYUSH Coming Soon Modal */}
      {ayushModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ padding: 16, background: '#FEF3C7', borderRadius: '50%', color: '#D97706' }}>
                <Sparkles size={44} strokeWidth={2} />
              </div>
            </div>
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
              <X size={18} />
              <span>{t(lang, 'consult_ayush_modal_close')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
