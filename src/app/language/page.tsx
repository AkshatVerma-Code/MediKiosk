'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { Language } from '@/lib/translations';
import { loadSession, saveSession } from '@/lib/store';
import styles from './page.module.css';

export default function LanguagePage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const [selected, setSelected] = useState<Language>(session.language || 'hi');

  const updateLang = (l: Language) => {
    setSelected(l);
    const updated = { ...session, language: l };
    setSession(updated);
    saveSession(updated);
  };

  const handleContinue = () => {
    const updated = { ...session, language: selected };
    saveSession(updated);
    router.push('/auth');
  };

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={session.language}
        onLangChange={updateLang}
        fontScale={session.fontScale}
        onFontChange={(s) => {
          const updated = { ...session, fontScale: s };
          setSession(updated);
          saveSession(updated);
        }}
      />

      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 60px)' }}>
        <div className={`${styles.card} animate-fade-in-up`}>
          {/* Top icon */}
          <div className={styles.iconWrap}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/>
            </svg>
          </div>

          <h1 className={styles.title}>
            {selected === 'hi' ? 'भाषा चुनें' : 'Select Language'}
          </h1>
          <p className={styles.subtitle}>
            {selected === 'hi' ? 'कृपया अपनी पसंदीदा भाषा चुनें' : 'Please choose your preferred language'}
          </p>

          <div className={styles.langGrid}>
            {/* Hindi */}
            <button
              id="lang-hindi-btn"
              className={`${styles.langCard} ${selected === 'hi' ? styles.langCardActive : ''}`}
              onClick={() => updateLang('hi')}
              aria-pressed={selected === 'hi'}
            >
              <div className={styles.langFlag}>🇮🇳</div>
              <div className={styles.langName}>हिंदी</div>
              <div className={styles.langNote}>Hindi</div>
              {selected === 'hi' && (
                <div className={styles.checkmark}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>

            {/* English */}
            <button
              id="lang-english-btn"
              className={`${styles.langCard} ${selected === 'en' ? styles.langCardActive : ''}`}
              onClick={() => updateLang('en')}
              aria-pressed={selected === 'en'}
            >
              <div className={styles.langFlag}>🇬🇧</div>
              <div className={styles.langName}>English</div>
              <div className={styles.langNote}>अंग्रेज़ी</div>
              {selected === 'en' && (
                <div className={styles.checkmark}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          </div>

          <button
            id="lang-continue-btn"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            onClick={handleContinue}
          >
            {selected === 'hi' ? 'आगे बढ़ें' : 'Continue'}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}
