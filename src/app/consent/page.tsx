'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession } from '@/lib/store';
import { t } from '@/lib/translations';
import styles from './page.module.css';

export default function ConsentPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  const handleAccept = () => {
    updateSession({ consentGiven: true });
    router.push('/select');
  };

  const handleDecline = () => {
    // Go back to start
    router.push('/');
  };

  const points = [
    t(lang, 'consent_point1'),
    t(lang, 'consent_point2'),
    t(lang, 'consent_point3'),
  ];

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 60px)', padding: '32px 24px' }}>
        <div className={`${styles.card} animate-scale-in`}>
          {/* Shield icon */}
          <div className={styles.shieldWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.5 3.8 10.74 9 12 5.2-1.26 9-6.5 9-12V7L12 2z"
                stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 className={styles.title}>{t(lang, 'consent_title')}</h1>

          <p className={styles.body}>{t(lang, 'consent_body')}</p>

          <div className={styles.points}>
            {points.map((pt, i) => (
              <div key={i} className={styles.point}>
                <div className={styles.pointCheck}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              id="consent-accept-btn"
              className="btn btn-primary btn-lg"
              style={{ flex: 2 }}
              onClick={handleAccept}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t(lang, 'consent_accept')}
            </button>
            <button
              id="consent-decline-btn"
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={handleDecline}
            >
              {t(lang, 'consent_decline')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
