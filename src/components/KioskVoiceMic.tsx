'use client';

import React from 'react';
import { Mic, Square, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import styles from './KioskVoiceMic.module.css';

export type MicKioskState = 'idle' | 'listening' | 'processing' | 'result' | 'speaking';

interface KioskVoiceMicProps {
  state: MicKioskState;
  lang: 'hi' | 'en';
  onStart: () => void;
  onStop: () => void;
  onSpeakAgain?: () => void;
  recognizedText?: string | null;
  hint?: string | null;
  exampleText?: string;
  disabled?: boolean;
}

export const KioskVoiceMic: React.FC<KioskVoiceMicProps> = ({
  state,
  lang,
  onStart,
  onStop,
  onSpeakAgain,
  recognizedText,
  hint,
  exampleText,
  disabled = false,
}) => {
  const isHindi = lang === 'hi';

  const handleMicClick = () => {
    if (disabled || state === 'processing') return;
    if (state === 'listening') {
      onStop();
    } else {
      onStart();
    }
  };

  const defaultExample = isHindi
    ? 'उदाहरण: "मुझे 3 दिन से बुखार है"'
    : 'Example: “I have had a fever for 3 days.”';

  return (
    <div className={styles.voiceMicContainer}>
      {/* ─── Hero Mic Trigger Area ─── */}
      <div className={styles.micWrap}>
        {state === 'listening' && (
          <>
            <div className={styles.rippleRing} />
            <div className={styles.rippleRingSecond} />
          </>
        )}
        {state === 'processing' && <div className={styles.processingRing} />}

        <button
          type="button"
          id="kiosk-mic-btn"
          className={`${styles.micButton} ${
            state === 'listening'
              ? styles.stateListening
              : state === 'processing'
              ? styles.stateProcessing
              : state === 'speaking'
              ? styles.stateSpeaking
              : styles.stateIdle
          }`}
          onClick={handleMicClick}
          disabled={disabled || state === 'processing'}
          aria-label={
            state === 'listening'
              ? isHindi ? 'रोकें' : 'Stop'
              : isHindi ? 'बोलने के लिए दबाएँ' : 'Tap to speak'
          }
        >
          {state === 'listening' ? (
            <Square size={32} strokeWidth={2.5} fill="#FFFFFF" />
          ) : state === 'processing' ? (
            <Loader2 size={36} strokeWidth={2.5} className={styles.spinIcon} />
          ) : (
            <Mic size={38} strokeWidth={2.2} />
          )}
        </button>
      </div>

      {/* ─── Status Text (Consistent 2-line height across all states) ─── */}
      <div className={styles.statusContainer}>
        {state === 'idle' && (
          <div className={styles.statusContentFade}>
            <h3 className={styles.primaryStatusText}>
              {isHindi ? 'बोलने के लिए दबाएँ' : 'Tap to speak'}
            </h3>
            <p className={styles.secondaryStatusText}>
              {isHindi ? 'अपनी समस्या बोलकर बताएं' : 'Tell your health issue in your own words'}
            </p>
          </div>
        )}

        {state === 'speaking' && (
          <div className={styles.statusContentFade}>
            <h3 className={styles.primaryStatusText} style={{ color: '#166534' }}>
              {isHindi ? 'सवाल सुनिए...' : 'Listening to question…'}
            </h3>
            <p className={styles.secondaryStatusText}>
              {isHindi ? 'सवाल सुनने के बाद बोलें या अभी शुरू करें' : 'Listen or tap the mic anytime to speak'}
            </p>
          </div>
        )}

        {state === 'listening' && (
          <div className={styles.statusContentFade}>
            <h3 className={styles.primaryStatusText} style={{ color: '#DC2626' }}>
              {isHindi ? 'सुन रहा हूँ...' : 'Listening…'}
            </h3>
            <p className={styles.secondaryStatusText}>
              {isHindi ? 'बोलिए — रोकने के लिए माइक छुएं' : 'Speak now — or tap mic to finish'}
            </p>
          </div>
        )}

        {state === 'processing' && (
          <div className={styles.statusContentFade}>
            {recognizedText ? (
              <>
                <h3 className={styles.primaryStatusText} style={{ color: '#166534' }}>
                  {isHindi ? 'ठीक है।' : 'Got it.'}
                </h3>
                <p className={styles.secondaryStatusText}>
                  {isHindi ? 'आगे बढ़ रहे हैं…' : 'Moving to next question…'}
                </p>
              </>
            ) : (
              <>
                <h3 className={styles.primaryStatusText} style={{ color: '#0369A1' }}>
                  {isHindi ? 'समझ रहा हूँ...' : 'Understanding…'}
                </h3>
                <p className={styles.secondaryStatusText}>
                  {isHindi ? 'कृपया थोड़ी प्रतीक्षा करें' : 'Processing what you said…'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Reserved Constant-Height Feedback Slot (48px) — Zero Layout Shift ─── */}
      <div className={styles.feedbackSlot}>
        {hint ? (
          <div className={styles.hintBanner} role="status">
            <AlertCircle size={16} className={styles.feedbackIcon} />
            <span>{hint}</span>
          </div>
        ) : recognizedText && state !== 'listening' ? (
          <div className={styles.resultPill}>
            <div className={styles.resultPillContent}>
              <CheckCircle2 size={16} color="#166534" className={styles.resultCheckIcon} />
              <span className={styles.resultPillLabel}>{isHindi ? 'सुना:' : 'Heard:'}</span>
              <span className={styles.resultPillText}>“{recognizedText}”</span>
            </div>
            <button
              type="button"
              id="kiosk-speak-again-btn"
              className={styles.speakAgainBtn}
              onClick={() => {
                if (onSpeakAgain) {
                  onSpeakAgain();
                } else {
                  onStart();
                }
              }}
            >
              <RotateCcw size={13} strokeWidth={2.2} />
              <span>{isHindi ? 'फिर से बोलें' : 'Speak again'}</span>
            </button>
          </div>
        ) : state === 'listening' ? (
          <div className={styles.waveVisualizer} aria-label={isHindi ? 'आवाज़ रिकॉर्ड हो रही है' : 'Voice recording'}>
            <div className={styles.waveBars}>
              <span className={`${styles.waveBar} ${styles.waveBar1}`} />
              <span className={`${styles.waveBar} ${styles.waveBar2}`} />
              <span className={`${styles.waveBar} ${styles.waveBar3}`} />
              <span className={`${styles.waveBar} ${styles.waveBar4}`} />
              <span className={`${styles.waveBar} ${styles.waveBar5}`} />
            </div>
            <span className={styles.waveLabel}>{isHindi ? 'आवाज़ पहचान चालू है' : 'Live voice audio'}</span>
          </div>
        ) : state === 'speaking' ? (
          <div className={styles.speakingVisualizer}>
            <div className={styles.speakingBars}>
              <span className={`${styles.speakingBar} ${styles.speakBar1}`} />
              <span className={`${styles.speakingBar} ${styles.speakBar2}`} />
              <span className={`${styles.speakingBar} ${styles.speakBar3}`} />
              <span className={`${styles.speakingBar} ${styles.speakBar4}`} />
              <span className={`${styles.speakingBar} ${styles.speakBar5}`} />
            </div>
            <span className={styles.speakingLabel}>{isHindi ? 'ऑडियो चल रहा है' : 'Reading aloud'}</span>
          </div>
        ) : (
          <span className={styles.exampleHelper}>
            {exampleText || defaultExample}
          </span>
        )}
      </div>
    </div>
  );
};
