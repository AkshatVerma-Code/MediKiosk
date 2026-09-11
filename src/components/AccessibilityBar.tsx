'use client';

import { useEffect, useState } from 'react';
import { Language } from '@/lib/translations';
import styles from './AccessibilityBar.module.css';

interface Props {
  lang: Language;
  onLangChange: (l: Language) => void;
  fontScale: number;
  onFontChange: (s: number) => void;
}

export default function AccessibilityBar({ lang, onLangChange, fontScale, onFontChange }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);

  // Apply font scale to root — set both the CSS var AND the html font-size
  // so that rem-based values cascade properly
  useEffect(() => {
    const pct = Math.round(fontScale * 100);
    document.documentElement.style.fontSize = `${pct}%`;
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  const increase = () => onFontChange(Math.min(fontScale + 0.15, 1.6));
  const decrease = () => onFontChange(Math.max(fontScale - 0.15, 0.85));

  return (
    <>
      <header className={styles.bar} role="banner">
        <div className={styles.inner}>
          {/* Brand */}
          <div className={styles.brand}>
            <span className={styles.brandDot} />
            <span className={styles.brandName}>MediKiosk</span>
          </div>

          <div className={styles.controls}>
            {/* Font size */}
            <div className={styles.group} role="group" aria-label="Font size controls">
              <button
                id="a11y-font-increase"
                className={`${styles.ctrl} ${styles.fontBtn}`}
                onClick={increase}
                aria-label="Increase font size"
                title="Increase font size"
              >
                A+
              </button>
              <button
                id="a11y-font-decrease"
                className={`${styles.ctrl} ${styles.fontBtn}`}
                onClick={decrease}
                aria-label="Decrease font size"
                title="Decrease font size"
              >
                A-
              </button>
            </div>

            {/* Language toggle */}
            <button
              id="a11y-lang-toggle"
              className={`${styles.ctrl} ${styles.langBtn}`}
              onClick={() => onLangChange(lang === 'hi' ? 'en' : 'hi')}
              aria-label={`Switch to ${lang === 'hi' ? 'English' : 'Hindi'}`}
              title={lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
            >
              {lang === 'hi' ? 'EN' : 'हि'}
            </button>

            {/* Help */}
            <button
              id="a11y-help-btn"
              className={`${styles.ctrl} ${styles.helpBtn}`}
              onClick={() => setHelpOpen(true)}
              aria-label="Help"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
              </svg>
              {lang === 'hi' ? 'सहायता' : 'Help'}
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {helpOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Help">
          <div className="modal-box">
            <h2 style={{ color: 'var(--green-500)', marginBottom: 16, fontSize: 'var(--font-size-xl)' }}>
              {lang === 'hi' ? 'सहायता' : 'Help'}
            </h2>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                lang === 'hi'
                  ? ['🎤', 'माइक बटन दबाएं और बोलें', 'You can speak your answers']
                  : ['🎤', 'Press mic and speak', 'बोलकर जवाब दें'],
                lang === 'hi'
                  ? ['👆', 'स्क्रीन पर विकल्प टैप करें', 'Or tap the options on screen']
                  : ['👆', 'Tap options on screen', 'स्क्रीन पर टैप करें'],
                lang === 'hi'
                  ? ['⌨️', 'टाइप करके भी जवाब दे सकते हैं', 'Type if you prefer']
                  : ['⌨️', 'Type your answer if you prefer', 'टाइप करके भी जवाब दे सकते हैं'],
                lang === 'hi'
                  ? ['A+', 'A+ A- से फ़ॉन्ट बड़ा/छोटा करें', 'Use A+/A- to change text size']
                  : ['A+', 'Use A+/A- to change text size', 'A+ A- से फ़ॉन्ट बड़ा/छोटा करें'],
              ].map(([icon, main, sub]) => (
                <li key={main} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 24, minWidth: 32, textAlign: 'center' }}>{icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{main}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{sub}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 24 }}
              onClick={() => setHelpOpen(false)}
            >
              {lang === 'hi' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
