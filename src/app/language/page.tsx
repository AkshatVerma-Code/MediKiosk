'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { Language } from '@/lib/translations';
import { loadSession, saveSession } from '@/lib/store';
import { Languages, Globe, Check, ArrowRight } from 'lucide-react';
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
          {/* Top Icon */}
          <div className={styles.iconWrap}>
            <Languages size={36} strokeWidth={2.2} />
          </div>

          <h1 className={styles.title} data-read-aloud="true">
            {selected === 'hi' ? 'नमस्ते! अपनी भाषा चुनें' : 'Welcome! Select Language'}
          </h1>
          <p className={styles.subtitle}>
            {selected === 'hi' ? 'बातचीत के लिए अपनी पसंदीदा भाषा चुनें' : 'Choose your preferred language for consultation'}
          </p>

          <div className={styles.langGrid}>
            {/* Hindi Option */}
            <button
              id="lang-hindi-btn"
              type="button"
              className={`${styles.langCard} ${selected === 'hi' ? styles.langCardActive : ''}`}
              onClick={() => updateLang('hi')}
              aria-pressed={selected === 'hi'}
            >
              <div className={styles.langIconBadge}>
                <Languages size={32} strokeWidth={2} color={selected === 'hi' ? '#1E5B2B' : '#4B5563'} />
              </div>
              <div className={styles.langName}>हिंदी</div>
              <div className={styles.langNote}>हिंदी में आगे बढ़ें</div>
              {selected === 'hi' && (
                <div className={styles.checkmark}>
                  <Check size={18} strokeWidth={3} color="#FFFFFF" />
                </div>
              )}
            </button>

            {/* English Option */}
            <button
              id="lang-english-btn"
              type="button"
              className={`${styles.langCard} ${selected === 'en' ? styles.langCardActive : ''}`}
              onClick={() => updateLang('en')}
              aria-pressed={selected === 'en'}
            >
              <div className={styles.langIconBadge}>
                <Globe size={32} strokeWidth={2} color={selected === 'en' ? '#1E5B2B' : '#4B5563'} />
              </div>
              <div className={styles.langName}>English</div>
              <div className={styles.langNote}>Continue in English</div>
              {selected === 'en' && (
                <div className={styles.checkmark}>
                  <Check size={18} strokeWidth={3} color="#FFFFFF" />
                </div>
              )}
            </button>
          </div>

          <button
            id="lang-continue-btn"
            className="btn btn-primary btn-xl"
            style={{ width: '100%', marginTop: 8 }}
            onClick={handleContinue}
          >
            <span>{selected === 'hi' ? 'आगे बढ़ें (Continue)' : 'Continue (आगे बढ़ें)'}</span>
            <ArrowRight size={22} strokeWidth={2.4} />
          </button>
        </div>
      </main>
    </div>
  );
}
