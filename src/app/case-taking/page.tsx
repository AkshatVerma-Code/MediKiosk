'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import RedFlagAlert from '@/components/RedFlagAlert';
import { loadSession, saveSession, ConversationMessage, ClinicalState } from '@/lib/store';
import { t } from '@/lib/translations';
import { detectRedFlags } from '@/lib/redFlagRules';
import { v4 as uuidv4 } from 'uuid';
import styles from './page.module.css';

type InputMode = 'idle' | 'speaking' | 'listening' | 'processing' | 'asking';

interface DynamicQuestion {
  question: string;
  options: string[];
  field: string;
  is_complete: boolean;
}

const MAX_QUESTIONS = 12;

export default function CaseTakingPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [clinicalState, setClinicalState] = useState<ClinicalState>(session.clinicalState);
  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null);
  const [lastAnswer, setLastAnswer] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>('asking');
  const [textInput, setTextInput] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [redFlags, setRedFlags] = useState(session.redFlags);
  const [showRedFlag, setShowRedFlag] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Refs — these hold live/mutable objects that don't need re-renders
  const messagesRef = useRef<ConversationMessage[]>([]);
  const voiceEnabledRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const skipProcessRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceFallbackTimerRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakResolveRef = useRef<(() => void) | null>(null);
  const consecutiveFailuresRef = useRef(0);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  function addAIMessage(text: string, options?: string[]) {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.speaker === 'AI' && lastMsg.text === text) return prev;
      const msg: ConversationMessage = { id: uuidv4(), speaker: 'AI', text, timestamp: new Date().toISOString(), options };
      return [...prev, msg];
    });
  }

  function addPatientMessage(text: string) {
    const msg: ConversationMessage = { id: uuidv4(), speaker: 'PATIENT', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
  }

  // ─── Text-to-speech playback (Sarvam) ─────────────────────────────────────
  function interruptSpeech() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (speakResolveRef.current) {
      const resolve = speakResolveRef.current;
      speakResolveRef.current = null;
      resolve();
    }
  }

  async function speak(text: string): Promise<void> {
    if (!voiceEnabledRef.current || !text) return;
    setInputMode('speaking');
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          currentAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            speakResolveRef.current = resolve;
            audio.onended = () => { speakResolveRef.current = null; resolve(); };
            audio.onerror = () => { speakResolveRef.current = null; resolve(); };
            audio.play().catch(() => { speakResolveRef.current = null; resolve(); });
          });
          currentAudioRef.current = null;
        }
      }
    } catch {
      // Voice playback is best-effort — the on-screen caption + tap options still work.
    }
  }

  // ─── Silence detection while the mic is listening ─────────────────────────
  function cleanupSilenceWatch() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (silenceFallbackTimerRef.current) { window.clearTimeout(silenceFallbackTimerRef.current); silenceFallbackTimerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
  }

  function stopListening(discard = false) {
    skipProcessRef.current = discard;
    cleanupSilenceWatch();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setInputMode(discard ? 'idle' : 'processing');
      recorder.stop();
    }
  }

  function startSilenceWatch(stream: MediaStream) {
    try {
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const startedAt = Date.now();
      let silenceStart: number | null = null;
      const THRESHOLD = 6;      // RMS amplitude below this counts as silence
      const MIN_MS = 900;       // always record at least this long
      const SILENCE_MS = 1700;  // stop after this much continuous silence
      const MAX_MS = 20000;     // hard cap so we never listen forever

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = data[i] - 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        const elapsed = Date.now() - startedAt;

        if (rms < THRESHOLD) {
          if (silenceStart === null) silenceStart = Date.now();
          if (elapsed > MIN_MS && Date.now() - silenceStart > SILENCE_MS) { stopListening(); return; }
        } else {
          silenceStart = null;
        }
        if (elapsed > MAX_MS) { stopListening(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Silence detection unsupported on this browser — fall back to a fixed max duration.
      silenceFallbackTimerRef.current = window.setTimeout(() => stopListening(), 8000);
    }
  }

  async function startListening() {
    if (inputMode === 'processing' || inputMode === 'asking') return;
    interruptSpeech();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicHint(null);
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      skipProcessRef.current = false;
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop());
        cleanupSilenceWatch();
        if (skipProcessRef.current) { skipProcessRef.current = false; return; }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoice(blob);
      };
      recorder.start();
      setInputMode('listening');
      startSilenceWatch(stream);
    } catch {
      setInputMode('idle');
      setMicHint(lang === 'hi'
        ? 'माइक उपलब्ध नहीं। कृपया नीचे विकल्प चुनें या टाइप करें।'
        : 'Microphone unavailable. Please tap an option below or type your answer.');
    }
  }

  async function processVoice(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('lang', lang);
      const resp = await fetch('/api/stt', { method: 'POST', body: formData });
      if (resp.ok) {
        const data = await resp.json();
        if (data.transcript?.trim()) { await processAnswer(data.transcript); return; }
      }
    } catch {
      // fall through to retry prompt below
    }
    setInputMode('idle');
    setMicHint(lang === 'hi'
      ? 'समझ नहीं आया। कृपया फिर से बोलें या नीचे विकल्प चुनें।'
      : 'Sorry, I could not understand that. Please try again or tap an option below.');
  }

  // ─── Fetch next question from Gemini, then speak it, then auto-listen ────
  async function fetchNextQuestion(state: ClinicalState, msgs: ConversationMessage[], count: number) {
    setInputMode('asking');
    try {
      const resp = await fetch('/api/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_state: state,
          conversation_history: msgs.slice(-8).map(m => ({ speaker: m.speaker, text: m.text })),
          question_count: count,
          lang,
        }),
      });

      if (!resp.ok) throw new Error('API failed');
      const q: DynamicQuestion = await resp.json();
      consecutiveFailuresRef.current = 0;

      if (q.is_complete || count >= MAX_QUESTIONS) {
        await finishInterview();
        return;
      }

      setCurrentQuestion(q);
      addAIMessage(q.question, q.options);
      await speak(q.question);
      await startListening();
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        await finishInterview();
        return;
      }
      // Fallback question — pick based on what's still missing so we never re-ask
      // the chief complaint once it's already known (this used to cause an
      // infinite "same question" loop whenever the next-question API failed).
      const fallback = buildFallbackQuestion(state, lang);
      setCurrentQuestion(fallback);
      addAIMessage(fallback.question, fallback.options);
      await speak(fallback.question);
      await startListening();
    }
  }

  async function finishInterview() {
    setIsComplete(true);
    setCurrentQuestion(null);
    const closingText = lang === 'hi'
      ? '🙏 धन्यवाद! आपकी सभी जानकारी ले ली गई है। अब आप अपने पिछले दस्तावेज़ अपलोड कर सकते हैं।'
      : '🙏 Thank you! I have collected your history. You may now upload any previous medical documents.';
    addAIMessage(closingText);
    setInputMode('idle');
    await speak(closingText);
  }

  // ─── Initial greeting + first question ───────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = lang === 'hi'
        ? `नमस्ते${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! मैं आपकी AI सहायक हूँ। बताइए, मैं आपकी क्या मदद कर सकती हूँ?`
        : `Hello${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! I'm your AI assistant. Tell me, how can I help you today?`;

      const greetMsg: ConversationMessage = { id: uuidv4(), speaker: 'AI', text: greeting, timestamp: new Date().toISOString() };
      setMessages([greetMsg]);

      (async () => {
        await speak(greeting);
        await fetchNextQuestion(clinicalState, [greetMsg], 0);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop any audio/mic activity if the user navigates away mid-conversation
  useEffect(() => {
    return () => {
      interruptSpeech();
      stopListening(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Process patient answer (from voice, tap, or typed text) ─────────────
  async function processAnswer(answer: string) {
    if (!answer.trim() || !currentQuestion || inputMode === 'processing' || inputMode === 'asking') return;

    interruptSpeech();
    addPatientMessage(answer);
    setLastAnswer(answer);
    setMicHint(null);
    setInputMode('processing');
    setTextInput('');
    setShowTypeInput(false);

    try {
      const resp = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.field,
          question_field: currentQuestion.field,
          answer,
          clinical_state: clinicalState,
          lang,
        }),
      });

      let newState = { ...clinicalState };
      if (resp.ok) {
        const data = await resp.json();
        if (data.updated_state) newState = { ...clinicalState, ...data.updated_state };
        else newState = applyAnswerFallback(currentQuestion.field as keyof ClinicalState, answer, clinicalState);
      } else {
        newState = applyAnswerFallback(currentQuestion.field as keyof ClinicalState, answer, clinicalState);
      }

      setClinicalState(newState);

      const flags = detectRedFlags(newState, lang);
      if (flags.length > 0 && flags.length > redFlags.length) {
        setRedFlags(flags);
        setShowRedFlag(true);
      }

      const updSession = { ...session, clinicalState: newState, messages: messagesRef.current, redFlags: flags };
      saveSession(updSession);

      const newCount = questionCount + 1;
      setQuestionCount(newCount);
      await fetchNextQuestion(newState, messagesRef.current, newCount);
    } catch {
      const newCount = questionCount + 1;
      setQuestionCount(newCount);
      await fetchNextQuestion(clinicalState, messagesRef.current, newCount);
    }
  }

  // ─── Fallback: pick the next question locally when the AI API fails ──────
  // Walks the clinical state and asks about the first field that's still
  // empty, so a transient API failure never re-asks something already known.
  function buildFallbackQuestion(state: ClinicalState, lang: 'hi' | 'en'): DynamicQuestion {
    const isHi = lang === 'hi';

    if (!state.chief_complaint) {
      return {
        question: isHi ? 'आज आपको क्या तकलीफ है?' : 'What brings you in today?',
        options: isHi
          ? ['सीने में दर्द', 'पेट दर्द', 'बुखार', 'सिरदर्द', 'अन्य']
          : ['Chest pain', 'Stomach pain', 'Fever', 'Headache', 'Other'],
        field: 'chief_complaint',
        is_complete: false,
      };
    }
    if (!state.onset) {
      return {
        question: isHi ? 'यह तकलीफ कब से शुरू हुई?' : 'When did this problem start?',
        options: isHi
          ? ['आज', 'कल', 'कुछ दिन पहले', 'कुछ हफ्ते पहले', 'बहुत समय से']
          : ['Today', 'Yesterday', 'A few days ago', 'A few weeks ago', 'A long time ago'],
        field: 'onset',
        is_complete: false,
      };
    }
    if (state.severity == null) {
      return {
        question: isHi ? '1 से 10 में, दर्द/तकलीफ कितनी है?' : 'On a scale of 1 to 10, how severe is it?',
        options: ['2', '4', '6', '8', '10'],
        field: 'severity',
        is_complete: false,
      };
    }

    // Everything important has at least a partial answer — wrap up.
    return {
      question: isHi ? 'क्या कुछ और है जो डॉक्टर को बताना चाहते हैं?' : 'Is there anything else you would like to tell the doctor?',
      options: isHi ? ['नहीं, यही सब है', 'हाँ, एक और बात है'] : ["No, that's all", 'Yes, one more thing'],
      field: 'associated_symptoms',
      is_complete: true,
    };
  }

  // ─── Fallback: apply answer without LLM ──────────────────────────────────
  function applyAnswerFallback(field: keyof ClinicalState, answer: string, state: ClinicalState): ClinicalState {
    const s = { ...state };
    const boolYes = answer.toLowerCase().includes('हाँ') || answer.toLowerCase().includes('yes');
    const boolFields = ['breathlessness', 'sweating', 'dizziness', 'nausea', 'previous_episode'];
    if (boolFields.includes(field)) { (s as Record<string, unknown>)[field] = boolYes; }
    else if (field === 'severity') { const n = parseInt(answer); if (!isNaN(n)) (s as Record<string, unknown>)[field] = n; }
    else if (Array.isArray(s[field])) { (s[field] as string[]).push(answer); }
    else { (s as Record<string, unknown>)[field] = answer; }
    return s;
  }

  // ─── UI event handlers ────────────────────────────────────────────────────
  function handleMicTap() {
    if (inputMode === 'listening') { stopListening(false); return; }
    if (inputMode === 'speaking') { interruptSpeech(); startListening(); return; }
    if (inputMode === 'idle') { startListening(); return; }
  }

  function handleOptionTap(opt: string) {
    if (inputMode === 'processing' || inputMode === 'asking') return;
    if (inputMode === 'listening') stopListening(true);
    else if (inputMode === 'speaking') interruptSpeech();
    processAnswer(opt);
  }

  function handleTypedSubmit() {
    if (!textInput.trim()) return;
    if (inputMode === 'listening') stopListening(true);
    else if (inputMode === 'speaking') interruptSpeech();
    processAnswer(textInput);
  }

  function handleContinue() {
    saveSession({ ...session, clinicalState, messages, redFlags });
    router.push('/upload');
  }

  function updateSession(updates: Partial<typeof session>) {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  }

  const progress = Math.min(Math.round((questionCount / MAX_QUESTIONS) * 100), 100);

  const statusLabel =
    inputMode === 'speaking' ? t(lang, 'case_speaking') :
    inputMode === 'listening' ? t(lang, 'case_listening') :
    inputMode === 'processing' ? t(lang, 'case_processing') :
    inputMode === 'asking' ? t(lang, 'case_thinking') :
    !isComplete ? t(lang, 'case_tap_to_speak') : '';

  return (
    <div className="page-container">
      <AccessibilityBar
        lang={lang}
        onLangChange={(l) => updateSession({ language: l })}
        fontScale={session.fontScale}
        onFontChange={(s) => updateSession({ fontScale: s })}
      />

      <main className={styles.main}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.topTitle}>{t(lang, 'case_title')}</h1>
            {session.patient && (
              <p className={styles.topPatient}>{session.patient.name} · {session.patient.age} {lang === 'hi' ? 'वर्ष' : 'yrs'}</p>
            )}
          </div>
          <div className={styles.progressWrap}>
            <button
              className={styles.voiceToggleBtn}
              onClick={() => setVoiceEnabled(v => !v)}
              aria-label={voiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
              title={voiceEnabled ? (lang === 'hi' ? 'AI आवाज़ बंद करें' : 'Mute AI voice') : (lang === 'hi' ? 'AI आवाज़ चालू करें' : 'Unmute AI voice')}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>
            <div className={styles.progressLabel}>{questionCount} / {MAX_QUESTIONS}</div>
            <div className="progress-bar-track" style={{ width: 120 }}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Red flag */}
        {showRedFlag && redFlags.length > 0 && (
          <div style={{ padding: '0 20px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
            <RedFlagAlert flags={redFlags} lang={lang} onClose={() => setShowRedFlag(false)} />
          </div>
        )}

        {/* Voice-first conversation stage */}
        <div className={styles.stage}>
          {currentQuestion && !isComplete && (
            <p className={styles.questionCaption}>{currentQuestion.question}</p>
          )}
          {isComplete && (
            <p className={styles.questionCaption}>
              {lang === 'hi' ? '🙏 धन्यवाद! आपकी जानकारी पूरी हो गई है।' : '🙏 Thank you! Your history is complete.'}
            </p>
          )}

          <div className={styles.avatarWrap}>
            <div className={`${styles.avatarRing} ${styles['state_' + inputMode]}`}>
              <div className={styles.avatarCore}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white" opacity="0.95" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              {(inputMode === 'processing' || inputMode === 'asking') && (
                <div className={styles.avatarSpinner}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
              )}
            </div>
          </div>

          {micHint ? (
            <p className={styles.micHintText}>{micHint}</p>
          ) : (
            <p className={styles.statusLabel}>{statusLabel}</p>
          )}

          {lastAnswer && !isComplete && (
            <p className={styles.answerCaption}>“{lastAnswer}”</p>
          )}

          {/* MCQ tap options */}
          {!isComplete && currentQuestion && currentQuestion.options?.length > 0 && (
            <div className={styles.mcqGrid}>
              {currentQuestion.options.map(opt => (
                <button
                  key={opt}
                  className={styles.mcqBtn}
                  onClick={() => handleOptionTap(opt)}
                  disabled={inputMode === 'processing' || inputMode === 'asking'}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Mic button */}
          {!isComplete && (
            <div className={styles.micColumn}>
              <button
                id="case-mic-btn"
                className={`${styles.micBtnLarge} ${inputMode === 'listening' ? styles.micBtnActive : ''}`}
                onClick={handleMicTap}
                disabled={inputMode === 'processing' || inputMode === 'asking'}
                aria-label={inputMode === 'listening' ? 'Stop recording' : 'Start voice input'}
              >
                {inputMode === 'listening' && <div className={styles.rippleLarge} />}
                {inputMode === 'listening' ? (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="white" /></svg>
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>

              <button className={styles.typeInsteadBtn} onClick={() => setShowTypeInput(v => !v)}>
                ⌨ {t(lang, 'case_type_instead')}
              </button>

              {showTypeInput && (
                <div className={styles.typeInputRow}>
                  <input
                    id="case-text-input"
                    className="input"
                    type="text"
                    placeholder={t(lang, 'case_type_placeholder')}
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTypedSubmit()}
                    autoFocus
                  />
                  <button id="case-send-btn" className="btn btn-primary" onClick={handleTypedSubmit} disabled={!textInput.trim()}>
                    {t(lang, 'case_send')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isComplete && (
          <div className={styles.completeBar}>
            <div className={styles.completeMsg}><span>✅</span><span>{lang === 'hi' ? 'इतिहास पूर्ण हुआ' : 'History complete'}</span></div>
            <button id="case-continue-btn" className="btn btn-primary btn-lg" onClick={handleContinue}>
              {lang === 'hi' ? 'दस्तावेज़ अपलोड करें' : 'Upload Documents'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
