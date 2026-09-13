'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, saveSession, defaultSession } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { Stethoscope, ArrowRight, Languages, Mic, Touchpad, ShieldCheck } from 'lucide-react';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    clearSession();
    const newSession = {
      ...defaultSession,
      sessionId: uuidv4(),
    };
    saveSession(newSession);
    router.push('/language');
  };

  return (
    <main className={styles.landing}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={`${styles.content} ${isAnimated ? styles.visible : ''}`}>
        {/* Hospital Kiosk Brand Header */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <Stethoscope size={36} color="#FFFFFF" strokeWidth={2.2} />
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoMain}>MediKiosk</span>
            <span className={styles.logoSub}>अस्पताल रोगी सहायता कियोस्क</span>
          </div>
        </div>

        {/* Primary Hospital Intake Heading */}
        <div className={styles.headingSection}>
          <h1 className={styles.headline}>
            Let&apos;s get your health history ready for the doctor.
          </h1>
          <p className={styles.headlineHi}>
            डॉक्टर के लिए अपना स्वास्थ्य इतिहास तैयार करें।
          </p>
          <p className={styles.sub}>
            You can speak or tap. We&apos;ll guide you step by step.
          </p>
          <p className={styles.subHi}>
            आप बोलकर या छूकर बता सकते हैं। हम कदम-दर-कदम मार्गदर्शन करेंगे।
          </p>
        </div>

        {/* Primary Kiosk Action Button */}
        <button
          id="landing-start-btn"
          className={styles.startBtn}
          onClick={handleStart}
          aria-label="Get Started / शुरू करें"
        >
          <span>शुरू करें &nbsp;·&nbsp; Get Started</span>
          <ArrowRight size={28} strokeWidth={2.4} />
        </button>

        {/* Clinical Capability Line */}
        <div className={styles.capabilityRow}>
          <div className={styles.capabilityItem}>
            <Languages size={18} strokeWidth={2} />
            <span>Hindi • English</span>
          </div>
          <span className={styles.capabilityDot}>•</span>
          <div className={styles.capabilityItem}>
            <Mic size={18} strokeWidth={2} />
            <span>Voice / आवाज़</span>
          </div>
          <span className={styles.capabilityDot}>•</span>
          <div className={styles.capabilityItem}>
            <Touchpad size={18} strokeWidth={2} />
            <span>Touch / टच</span>
          </div>
          <span className={styles.capabilityDot}>•</span>
          <div className={styles.capabilityItem}>
            <ShieldCheck size={18} strokeWidth={2} />
            <span>Private &amp; Secure</span>
          </div>
        </div>

        {/* Doctor Login Link */}
        <button
          className={styles.doctorLoginLink}
          onClick={() => router.push('/doctor/login')}
        >
          <Stethoscope size={16} strokeWidth={2} />
          <span>Doctor Login &nbsp;·&nbsp; डॉक्टर लॉगिन</span>
        </button>
      </div>
    </main>
  );
}
