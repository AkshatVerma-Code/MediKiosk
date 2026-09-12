'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function DoctorLoginPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!doctorId.trim()) {
      setError('Please enter your Doctor ID');
      return;
    }
    setLoading(true);
    setError('');

    // For prototype: accept any non-empty Doctor ID
    // In production, this would validate against a doctors table
    await new Promise(r => setTimeout(r, 600));

    // Store doctor info in sessionStorage (not localStorage, so it's per-tab)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('medcase_doctor', JSON.stringify({
        id: doctorId.trim(),
        loginAt: new Date().toISOString(),
      }));
    }

    setLoading(false);
    router.push('/doctor');
  };

  return (
    <main className={styles.loginPage}>
      {/* Background decorations */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.loginCard}>
        <div className={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 className={styles.title}>Doctor Login</h1>
        <p className={styles.subtitle}>Enter your Doctor ID to access the dashboard</p>

        <form className={styles.form} onSubmit={e => { e.preventDefault(); handleLogin(); }}>
          <div className={styles.field}>
            <label className={styles.label}>Doctor ID</label>
            <input
              id="doctor-login-id"
              className={`input ${error ? styles.inputError : ''}`}
              type="text"
              placeholder="e.g. DOC001"
              value={doctorId}
              onChange={e => { setDoctorId(e.target.value); setError(''); }}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <button
            id="doctor-login-btn"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" />Verifying...</>
            ) : (
              <>
                Access Dashboard
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>

        <button
          className={styles.backBtn}
          onClick={() => router.push('/')}
        >
          ← Back to Home
        </button>
      </div>
    </main>
  );
}
