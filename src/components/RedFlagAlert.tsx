'use client';

import { DetectedRedFlag } from '@/lib/redFlagRules';
import { Language } from '@/lib/translations';
import styles from './RedFlagAlert.module.css';

interface Props {
  flags: DetectedRedFlag[];
  lang: Language;
  onClose: () => void;
}

export default function RedFlagAlert({ flags, lang, onClose }: Props) {
  const hasHigh = flags.some(f => f.severity === 'HIGH');

  return (
    <div className={`${styles.alert} ${hasHigh ? styles.high : styles.medium}`} role="alert">
      <div className={styles.iconWrap}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className={styles.content}>
        <p className={styles.title}>
          {lang === 'hi' ? '⚠️ तत्काल चिकित्सा ध्यान' : '⚠️ Urgent Medical Attention'}
        </p>
        <p className={styles.body}>
          {lang === 'hi'
            ? 'आपके लक्षण तत्काल चिकित्सा मूल्यांकन की आवश्यकता हो सकती है।'
            : 'Your symptoms may require immediate medical evaluation.'}
        </p>
        <div className={styles.flags}>
          {flags.map(f => (
            <div key={f.rule_name} className={styles.flag}>
              <span className={`badge badge-danger`}>{f.severity}</span>
              <span>{f.description}</span>
            </div>
          ))}
        </div>
        {hasHigh && (
          <p className={styles.urgent}>
            {lang === 'hi'
              ? '🚨 कृपया तुरंत ट्रायज / आपातकालीन डेस्क पर जाएं।'
              : '🚨 Please proceed to the triage / emergency desk immediately.'}
          </p>
        )}
      </div>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
