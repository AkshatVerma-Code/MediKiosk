'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, defaultSession, AppSession } from '@/lib/store';
import { ShieldCheck, FileText, Stethoscope, Volume2, Check, X } from 'lucide-react';
import styles from './page.module.css';

export default function ConsentPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<AppSession>(defaultSession);
  const [speaking, setSpeaking] = useState(false);

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

  const handleAccept = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateSession({ consentGiven: true });
    router.push('/select');
  };

  const handleDecline = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    router.push('/');
  };

  const handleReadAloud = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = lang === 'hi'
      ? 'गोपनीयता और सहमति। आपकी जानकारी का उपयोग डॉक्टर के परामर्श के लिए इतिहास तैयार करने में किया जाएगा। पहला: इस परामर्श के लिए आपके उत्तर दर्ज किए जाएंगे। दूसरा: आपके अपलोड किए गए चिकित्सा दस्तावेज़ पढ़े जा सकते हैं। तीसरा: एक डॉक्टर आपके तैयार इतिहास की समीक्षा करेंगे।'
      : 'Privacy and Consent. Your information will be used to prepare your history for the doctor. Point one: Your responses will be recorded for this consultation. Point two: Your uploaded medical documents may be processed. Point three: A doctor will review the generated history.';

    const utter = new SpeechSynthesisUtterance(textToRead);
    utter.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  if (!mounted) {
    return (
      <div className="page-container" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 44, height: 44 }} />
      </div>
    );
  }

  const clinicalPoints = [
    {
      icon: <ShieldCheck size={24} strokeWidth={2.2} color="#1E5B2B" />,
      text: lang === 'hi'
        ? 'इस परामर्श के लिए आपके उत्तर दर्ज किए जाएंगे'
        : 'Your responses will be recorded for this consultation',
    },
    {
      icon: <FileText size={24} strokeWidth={2.2} color="#1E5B2B" />,
      text: lang === 'hi'
        ? 'आपके अपलोड किए गए चिकित्सा दस्तावेज़ पढ़े जा सकते हैं'
        : 'Your uploaded medical documents may be processed',
    },
    {
      icon: <Stethoscope size={24} strokeWidth={2.2} color="#1E5B2B" />,
      text: lang === 'hi'
        ? 'एक डॉक्टर आपके तैयार इतिहास की समीक्षा करेंगे'
        : 'A doctor will review the generated history',
    },
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
          {/* Header Shield */}
          <div className={styles.shieldWrap}>
            <ShieldCheck size={44} strokeWidth={2.2} color="#1E5B2B" />
          </div>

          <h1 className={styles.title} data-read-aloud="true">
            {lang === 'hi' ? 'गोपनीयता और सहमति' : 'Privacy & Consent'}
          </h1>

          <p className={styles.body}>
            {lang === 'hi'
              ? 'आपकी जानकारी का उपयोग डॉक्टर के परामर्श के लिए इतिहास तैयार करने में किया जाएगा।'
              : 'Your information will be used to prepare your history for the doctor.'}
          </p>

          {/* Read Aloud Button */}
          <button
            type="button"
            id="consent-read-aloud-btn"
            className={`${styles.readAloudBtn} ${speaking ? styles.readAloudActive : ''}`}
            onClick={handleReadAloud}
          >
            <Volume2 size={18} strokeWidth={2.2} />
            <span>
              {speaking
                ? (lang === 'hi' ? 'आवाज़ रोकें' : 'Stop speaking')
                : (lang === 'hi' ? 'बोलकर सुनें (Read aloud)' : 'Read aloud')}
            </span>
          </button>

          {/* Clinical Points */}
          <div className={styles.points}>
            {clinicalPoints.map((pt, i) => (
              <div key={i} className={styles.point}>
                <div className={styles.pointIconWrap}>
                  {pt.icon}
                </div>
                <div className={styles.pointTextWrap}>
                  <div className={styles.checkBadge}>
                    <Check size={14} strokeWidth={3} color="#FFFFFF" />
                  </div>
                  <span className={styles.pointText}>{pt.text}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              id="consent-accept-btn"
              className={styles.acceptBtn}
              onClick={handleAccept}
            >
              <Check size={22} strokeWidth={2.5} />
              <span>{lang === 'hi' ? 'मैं सहमत हूँ (I Agree)' : 'I Agree'}</span>
            </button>
            <button
              id="consent-decline-btn"
              className={styles.declineBtn}
              onClick={handleDecline}
            >
              <X size={18} strokeWidth={2.2} />
              <span>{lang === 'hi' ? 'अस्वीकार करें (Decline)' : 'Decline'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
