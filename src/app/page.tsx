'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, saveSession, defaultSession } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    // Small delay for animation
    const t = setTimeout(() => setIsAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleStart = () => {
    // Clear any old session and start fresh
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
      {/* Animated background blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />
      <div className={styles.blob3} />

      <div className={`${styles.content} ${isAnimated ? styles.visible : ''}`}>
        {/* Logo / Icon */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <rect width="56" height="56" rx="16" fill="white" fillOpacity="0.2" />
              <path d="M28 12C19.16 12 12 19.16 12 28s7.16 16 16 16 16-7.16 16-16S36.84 12 28 12zm2 24h-4v-4h4v4zm0-8h-4V20h4v8z"
                fill="white" />
            </svg>
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoMain}>MedCase</span>
            <span className={styles.logoSub}>मेडकेस</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className={styles.headline}>
          AI-Powered Patient<br />History System
        </h1>
        <p className={styles.sub}>
          AI-संचालित रोगी इतिहास प्रणाली
        </p>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statNum}>2x</span>
            <span className={styles.statLabel}>Faster intake</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>2</span>
            <span className={styles.statLabel}>Languages</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statNum}>AI</span>
            <span className={styles.statLabel}>Red-flag detection</span>
          </div>
        </div>

        {/* CTA */}
        <button
          id="landing-start-btn"
          className={`btn btn-primary btn-xl ${styles.startBtn}`}
          onClick={handleStart}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M8 5l8 7-8 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Get Started &nbsp;·&nbsp; शुरू करें
        </button>

        {/* Ministry badge */}
        <div className={styles.ministry}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7v10c0 4.4 4.27 8.5 10 10 5.73-1.5 10-5.6 10-10V7L12 2z"
              fill="currentColor" opacity="0.6" />
          </svg>
          Ministry of Ayush &nbsp;|&nbsp; SIH26047
        </div>

        <p className={styles.disclaimer}>
          This is a demonstration prototype. Not intended for autonomous clinical diagnosis.
        </p>
      </div>
    </main>
  );
}
