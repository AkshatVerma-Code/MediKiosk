'use client';

import { DetectedRedFlag } from '@/lib/redFlagRules';
import { Language } from '@/lib/translations';
import { AlertTriangle, X, Hospital } from 'lucide-react';
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
        <AlertTriangle size={32} strokeWidth={2.2} />
      </div>
      <div className={styles.content}>
        <p className={styles.title}>
          {lang === 'hi' ? 'प्राथमिकता परामर्श सूचना' : 'Priority Medical Notification'}
        </p>
        <p className={styles.body}>
          {lang === 'hi'
            ? 'आपके बताए गए लक्षणों के लिए डॉक्टर या नर्स से शीघ्र परामर्श की सलाह दी जाती है।'
            : 'Based on your reported symptoms, priority consultation with a healthcare professional is advised.'}
        </p>
        <div className={styles.flags}>
          {flags.map(f => (
            <div key={f.rule_name} className={styles.flag}>
              <span className={`badge badge-warning`}>{lang === 'hi' ? 'ध्यान दें' : 'Note'}</span>
              <span>{f.description}</span>
            </div>
          ))}
        </div>
        {hasHigh && (
          <p className={styles.urgent} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hospital size={16} strokeWidth={2} />
            <span>
              {lang === 'hi'
                ? 'कृपया सीधे सहायता डेस्क या आपातकालीन कक्ष में संपर्क करें।'
                : 'Please speak with the assistance desk or triage nurse directly.'}
            </span>
          </p>
        )}
      </div>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close alert">
        <X size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
