'use client';

import { useEffect, useState, useRef } from 'react';
import { Language } from '@/lib/translations';
import { Volume2, HelpCircle, X, Mic, Touchpad, Keyboard, Type, Stethoscope } from 'lucide-react';
import styles from './AccessibilityBar.module.css';

interface Props {
  lang: Language;
  onLangChange: (l: Language) => void;
  fontScale: number;
  onFontChange: (s: number) => void;
}

export default function AccessibilityBar({ lang, onLangChange, fontScale, onFontChange }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Apply font scale to root — set both the CSS var AND the html font-size
  // so that rem-based values cascade properly
  useEffect(() => {
    const pct = Math.round(fontScale * 100);
    document.documentElement.style.fontSize = `${pct}%`;
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  // Clean up any ongoing audio when unmounting
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const increase = () => onFontChange(Math.min(fontScale + 0.15, 1.6));
  const decrease = () => onFontChange(Math.max(fontScale - 0.15, 0.85));

  const handleReadAloud = async () => {
    // If currently speaking, stop immediately
    if (isSpeaking) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    // Find prominent text on the current page to read aloud
    const targetElement = document.querySelector('h1, .section-title, [data-read-aloud]');
    const subtitleElement = document.querySelector('.section-subtitle, p');
    let textToRead = '';

    if (targetElement?.textContent) {
      const clone = targetElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button, [role="button"], .replaySpeechBtn').forEach(el => el.remove());
      textToRead = (clone.textContent || targetElement.textContent).trim();
    }

    // Only append subtitle if it is not already contained within targetElement
    if (subtitleElement?.textContent && (!targetElement || (!targetElement.contains(subtitleElement) && targetElement !== subtitleElement))) {
      const subText = subtitleElement.textContent.trim();
      if (subText && !textToRead.includes(subText)) {
        textToRead += (textToRead ? '. ' : '') + subText;
      }
    } else if (!textToRead && subtitleElement?.textContent) {
      textToRead = subtitleElement.textContent.trim();
    }

    if (!textToRead) {
      textToRead = lang === 'hi' ? 'मेडकिओस्क में आपका स्वागत है' : 'Welcome to MediKiosk';
    }

    // Sanitize punctuation to prevent TTS engines from vocalizing "question mark", "period", etc.
    textToRead = textToRead
      .replace(/\?\s*\.+/g, '? ')
      .replace(/\.+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Primary: Use Sarvam AI high-quality neural voice via /api/tts (same as case-taking assistant)
    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsSpeaking(true);

      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead, lang }),
        signal: abortController.signal,
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
          };

          await audio.play();
          return;
        }
      }
    } catch {
      // If server TTS aborted or failed, proceed to local browser fallback
    }

    // 2. Fallback: Browser Web Speech API (with punctuation stripped so it never utters 'question mark')
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Crucial: remove literal '?' so English fallback synthesizer never vocalizes "question mark"
      const safeText = textToRead.replace(/\?/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(safeText);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.9;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const helpGuides = [
    {
      icon: <Mic size={20} strokeWidth={2.2} color="#1E5B2B" />,
      main: lang === 'hi' ? 'माइक बटन दबाएं और बोलें' : 'Press mic and speak',
      sub: lang === 'hi' ? 'आप बोलकर जवाब दे सकते हैं' : 'Speak your answers naturally',
    },
    {
      icon: <Touchpad size={20} strokeWidth={2.2} color="#1E5B2B" />,
      main: lang === 'hi' ? 'स्क्रीन पर विकल्प टैप करें' : 'Tap options on screen',
      sub: lang === 'hi' ? 'छूकर भी उत्तर चुन सकते हैं' : 'Touch any card or answer pill',
    },
    {
      icon: <Keyboard size={20} strokeWidth={2.2} color="#1E5B2B" />,
      main: lang === 'hi' ? 'टाइप करके भी जवाब दे सकते हैं' : 'Type your answer if preferred',
      sub: lang === 'hi' ? 'कीबोर्ड से लिखकर बताएं' : 'Use screen keyboard to type',
    },
    {
      icon: <Type size={20} strokeWidth={2.2} color="#1E5B2B" />,
      main: lang === 'hi' ? 'A+ A- से फ़ॉन्ट बड़ा/छोटा करें' : 'Use A+/A- to change text size',
      sub: lang === 'hi' ? 'अक्षरों का आकार अपनी सुविधा अनुसार बदलें' : 'Adjust font size for comfortable reading',
    },
  ];

  return (
    <>
      <header className={styles.bar} role="banner">
        <div className={styles.inner}>
          {/* Brand */}
          <div className={styles.brand}>
            <Stethoscope size={18} strokeWidth={2.2} color="#2D7A3A" />
            <span className={styles.brandName}>MediKiosk</span>
          </div>

          <div className={styles.controls}>
            {/* Read Aloud Button */}
            <button
              id="a11y-read-aloud"
              className={`${styles.ctrl} ${styles.readAloudBtn} ${isSpeaking ? styles.readAloudActive : ''}`}
              onClick={handleReadAloud}
              aria-label={lang === 'hi' ? 'स्क्रीन पढ़ें' : 'Read screen aloud'}
              title={lang === 'hi' ? 'स्क्रीन पढ़ें (आवाज़ में सुनें)' : 'Read screen aloud'}
            >
              <Volume2 size={16} strokeWidth={2.2} />
              <span>{isSpeaking ? (lang === 'hi' ? 'रोकें' : 'Stop') : (lang === 'hi' ? 'सुनें' : 'Read')}</span>
            </button>

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
              <HelpCircle size={16} strokeWidth={2.2} />
              <span>{lang === 'hi' ? 'सहायता' : 'Help'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {helpOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Help">
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ color: '#1E5B2B', margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 800 }}>
                {lang === 'hi' ? 'सहायता निर्देशिका (Kiosk Guide)' : 'Kiosk Help Guide'}
              </h2>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setHelpOpen(false)}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {helpGuides.map((guide, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#F9FAFB', padding: '10px 14px', borderRadius: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {guide.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{guide.main}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{guide.sub}</div>
                  </div>
                </li>
              ))}
            </ul>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20 }}
              onClick={() => setHelpOpen(false)}
            >
              {lang === 'hi' ? 'समझ गया · बंद करें' : 'Got it · Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
