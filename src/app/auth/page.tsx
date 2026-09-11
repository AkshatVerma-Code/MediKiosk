'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, PatientProfile } from '@/lib/store';
import { t } from '@/lib/translations';
import { v4 as uuidv4 } from 'uuid';
import styles from './page.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [abhaId, setAbhaId] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // const fillDemo = () => {
  //   setAbhaId('DEMO-2026-' + Math.floor(Math.random() * 9000 + 1000));
  //   setName(lang === 'hi' ? 'राजेश कुमार' : 'Rajesh Kumar');
  //   setAge('52');
  //   setGender('male');
  // };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = lang === 'hi' ? 'नाम ज़रूरी है' : 'Name is required';
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120)
      errs.age = lang === 'hi' ? 'सही उम्र दर्ज करें' : 'Enter a valid age';
    return errs;
  };

  const handleContinue = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);

    const patient: PatientProfile = {
      id: uuidv4(),
      name: name.trim(),
      age,
      gender,
      abhaId: abhaId.trim() || undefined,
    };

    const updated = { ...session, patient };
    setSession(updated);
    saveSession(updated);

    // Small delay for UX
    await new Promise(r => setTimeout(r, 500));
    setLoading(false);
    router.push('/consent');
  };

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 60px)', padding: '32px 24px' }}>
        <div className={`${styles.card} animate-fade-in-up`}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.iconWrap}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.title}>{t(lang, 'auth_title')}</h1>
              <p className={styles.subtitle}>{t(lang, 'auth_subtitle')}</p>
            </div>
          </div>

          {/* Demo fill */}
          {/*<div className={styles.demoBanner}>
            <span className={styles.demoLabel}>{t(lang, 'auth_demo_note')}</span>
            <button className={`btn btn-sm btn-secondary`} onClick={fillDemo} id="auth-demo-fill">
              {t(lang, 'auth_demo_fill')}
            </button>
          </div>*/}

          {/* Form */}
          <form className={styles.form} onSubmit={e => { e.preventDefault(); handleContinue(); }}>
            {/* ABHA ID */}
            <div className={styles.field}>
              <label className={styles.label}>{t(lang, 'auth_abha_label')} <span className={styles.optional}>(Optional)</span></label>
              <input
                id="auth-abha-input"
                className="input"
                type="text"
                placeholder={t(lang, 'auth_abha_placeholder')}
                value={abhaId}
                onChange={e => setAbhaId(e.target.value)}
              />
            </div>

            {/* Name */}
            <div className={styles.field}>
              <label className={styles.label}>{t(lang, 'auth_name_label')} *</label>
              <input
                id="auth-name-input"
                className={`input ${errors.name ? styles.inputError : ''}`}
                type="text"
                placeholder={t(lang, 'auth_name_placeholder')}
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: ''})); }}
              />
              {errors.name && <p className={styles.error}>{errors.name}</p>}
            </div>

            {/* Age + Gender row */}
            <div className={styles.row}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>{t(lang, 'auth_age_label')} *</label>
                <input
                  id="auth-age-input"
                  className={`input ${errors.age ? styles.inputError : ''}`}
                  type="number"
                  placeholder={t(lang, 'auth_age_placeholder')}
                  value={age}
                  min={1} max={120}
                  onChange={e => { setAge(e.target.value); setErrors(p => ({...p, age: ''})); }}
                />
                {errors.age && <p className={styles.error}>{errors.age}</p>}
              </div>

              <div className={styles.field} style={{ flex: 1.5 }}>
                <label className={styles.label}>{t(lang, 'auth_gender_label')}</label>
                <div className={styles.genderGroup}>
                  {(['male', 'female', 'other'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      id={`auth-gender-${g}`}
                      className={`${styles.genderBtn} ${gender === g ? styles.genderActive : ''}`}
                      onClick={() => setGender(g)}
                    >
                      {t(lang, `auth_gender_${g}` as any)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              id="auth-continue-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" />{t(lang, 'loading')}</>
              ) : (
                <>{t(lang, 'auth_continue')} <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
