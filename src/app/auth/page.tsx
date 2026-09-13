'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import { loadSession, saveSession, PatientProfile } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { UserCheck, CreditCard, User, Users, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [pathway, setPathway] = useState<'abha' | 'direct'>('direct');
  const [abhaId, setAbhaId] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = lang === 'hi' ? 'कृपया नाम दर्ज करें' : 'Please enter patient name';
    }
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120) {
      errs.age = lang === 'hi' ? 'सही उम्र दर्ज करें' : 'Please enter a valid age';
    }
    return errs;
  };

  const handleContinue = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
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

    await new Promise(r => setTimeout(r, 400));
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

      <main id="main-content" tabIndex={-1} className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 60px)', padding: '32px 24px' }}>
        <div className={`${styles.card} animate-fade-in-up`}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.iconWrap}>
              <UserCheck size={36} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className={styles.title} data-read-aloud="true">
                {lang === 'hi' ? 'पहचान सत्यापित करें' : 'Patient Identification'}
              </h1>
              <p className={styles.subtitle}>
                {lang === 'hi' ? 'अस्पताल पर्ची और परामर्श के लिए विवरण' : 'Details for your hospital consultation'}
              </p>
            </div>
          </div>

          {/* Pathway Selection: ABHA vs Direct */}
          <div className={styles.pathwayGrid}>
            <button
              type="button"
              id="auth-pathway-abha"
              className={`${styles.pathwayCard} ${pathway === 'abha' ? styles.pathwayCardActive : ''}`}
              onClick={() => {
                setPathway('abha');
                setErrors({});
              }}
            >
              <CreditCard size={24} strokeWidth={2} color={pathway === 'abha' ? '#1E5B2B' : '#4B5563'} />
              <div className={styles.pathwayInfo}>
                <span className={styles.pathwayTitle}>
                  {lang === 'hi' ? 'ABHA ID है?' : 'Have ABHA ID?'}
                </span>
                <span className={styles.pathwayDesc}>
                  {lang === 'hi' ? 'ABHA कार्ड नंबर से' : 'With ABHA Card number'}
                </span>
              </div>
            </button>

            <button
              type="button"
              id="auth-pathway-direct"
              className={`${styles.pathwayCard} ${pathway === 'direct' ? styles.pathwayCardActive : ''}`}
              onClick={() => {
                setPathway('direct');
                setErrors({});
              }}
            >
              <User size={24} strokeWidth={2} color={pathway === 'direct' ? '#1E5B2B' : '#4B5563'} />
              <div className={styles.pathwayInfo}>
                <span className={styles.pathwayTitle}>
                  {lang === 'hi' ? 'ABHA नहीं है?' : 'Don’t have ABHA?'}
                </span>
                <span className={styles.pathwayDesc}>
                  {lang === 'hi' ? 'नाम और उम्र से' : 'With Name and Age'}
                </span>
              </div>
            </button>
          </div>

          {/* Form Fields */}
          <form className={styles.form} onSubmit={e => { e.preventDefault(); handleContinue(); }}>
            {pathway === 'abha' && (
              <div className={styles.field}>
                <label className={styles.label}>
                  {lang === 'hi' ? 'ABHA ID / आभा संख्या' : 'ABHA ID / Number'}
                </label>
                <input
                  id="auth-abha-input"
                  className="input"
                  type="text"
                  placeholder={lang === 'hi' ? 'उदा. 14 अंकों का ABHA नंबर' : 'e.g. 14-digit ABHA ID'}
                  value={abhaId}
                  onChange={e => setAbhaId(e.target.value)}
                />
              </div>
            )}

            {/* Name */}
            <div className={styles.field}>
              <label className={styles.label}>
                {lang === 'hi' ? 'मरीज़ का नाम' : 'Patient Name'} *
              </label>
              <input
                id="auth-name-input"
                className={`input ${errors.name ? styles.inputError : ''}`}
                type="text"
                placeholder={lang === 'hi' ? 'पूरा नाम लिखें' : 'Enter full name'}
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: ''})); }}
              />
              {errors.name && <p className={styles.error}>{errors.name}</p>}
            </div>

            {/* Age + Gender row */}
            <div className={styles.row}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>
                  {lang === 'hi' ? 'उम्र (वर्ष)' : 'Age (Years)'} *
                </label>
                <input
                  id="auth-age-input"
                  className={`input ${errors.age ? styles.inputError : ''}`}
                  type="number"
                  placeholder={lang === 'hi' ? 'उदा. 45' : 'e.g. 45'}
                  value={age}
                  min={1} max={120}
                  onChange={e => { setAge(e.target.value); setErrors(p => ({...p, age: ''})); }}
                />
                {errors.age && <p className={styles.error}>{errors.age}</p>}
              </div>

              <div className={styles.field} style={{ flex: 1.8 }}>
                <label className={styles.label}>
                  {lang === 'hi' ? 'लिंग' : 'Gender'}
                </label>
                <div className={styles.genderGrid}>
                  {[
                    { id: 'male', label: lang === 'hi' ? 'पुरुष' : 'Male', icon: <User size={20} strokeWidth={2} /> },
                    { id: 'female', label: lang === 'hi' ? 'महिला' : 'Female', icon: <User size={20} strokeWidth={2} /> },
                    { id: 'other', label: lang === 'hi' ? 'अन्य' : 'Other', icon: <Users size={20} strokeWidth={2} /> },
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      id={`auth-gender-${g.id}`}
                      className={`${styles.genderCard} ${gender === g.id ? styles.genderCardActive : ''}`}
                      onClick={() => setGender(g.id as 'male' | 'female' | 'other')}
                    >
                      <span className={styles.genderIconWrap}>{g.icon}</span>
                      <span className={styles.genderText}>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              id="auth-continue-btn"
              type="submit"
              className="btn btn-primary btn-xl"
              style={{ width: '100%', marginTop: 12 }}
              disabled={loading}
            >
              {loading ? (
                <><div className="spinner" />{lang === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying...'}</>
              ) : pathway === 'abha' ? (
                <>
                  <span>{lang === 'hi' ? 'ABHA से जारी रखें' : 'Continue with ABHA'}</span>
                  <ArrowRight size={22} strokeWidth={2.4} />
                </>
              ) : (
                <>
                  <span>{lang === 'hi' ? 'नाम और उम्र से जारी रखें' : 'Continue with Name & Age'}</span>
                  <ArrowRight size={22} strokeWidth={2.4} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
