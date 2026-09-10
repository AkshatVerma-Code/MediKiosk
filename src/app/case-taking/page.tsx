'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import RedFlagAlert from '@/components/RedFlagAlert';
import { loadSession, saveSession, ConversationMessage, ClinicalState } from '@/lib/store';
import { t } from '@/lib/translations';
import { detectRedFlags } from '@/lib/redFlagRules';
import { v4 as uuidv4 } from 'uuid';
import styles from './page.module.css';

type InputMode = 'idle' | 'listening' | 'processing' | 'asking';

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
  const [questionCount, setQuestionCount] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>('asking');
  const [textInput, setTextInput] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [redFlags, setRedFlags] = useState(session.redFlags);
  const [showRedFlag, setShowRedFlag] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const consecutiveFailuresRef = useRef(0);

  // Keep ref in sync (avoids stale closures)
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const scrollBottom = useCallback(() => {
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, []);

  const addAIMessage = useCallback((text: string, options?: string[]) => {
    setMessages(prev => {
      // Prevent adding the exact same question twice in a row (stops infinite loop bug)
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.speaker === 'AI' && lastMsg.text === text) {
        return prev;
      }
      const msg: ConversationMessage = { id: uuidv4(), speaker: 'AI', text, timestamp: new Date().toISOString(), options };
      return [...prev, msg];
    });
    scrollBottom();
  }, [scrollBottom]);

  const addPatientMessage = useCallback((text: string) => {
    const msg: ConversationMessage = { id: uuidv4(), speaker: 'PATIENT', text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, msg]);
    scrollBottom();
  }, [scrollBottom]);

  // ─── Fetch next question from Gemini ─────────────────────────────────────
  const fetchNextQuestion = useCallback(async (
    state: ClinicalState,
    msgs: ConversationMessage[],
    count: number
  ) => {
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

      if (q.is_complete || count >= MAX_QUESTIONS) {
        // Done
        setIsComplete(true);
        addAIMessage(
          lang === 'hi'
            ? '🙏 धन्यवाद! आपकी सभी जानकारी ले ली गई है। अब आप अपने पिछले दस्तावेज़ अपलोड कर सकते हैं।'
            : '🙏 Thank you! I have collected your history. You may now upload any previous medical documents.'
        );
        setInputMode('idle');
        return;
      }

      setCurrentQuestion(q);
      addAIMessage(q.question, q.options);
      setInputMode('idle');
      consecutiveFailuresRef.current = 0;
    } catch {
      // If the API keeps failing, don't loop forever — wrap up gracefully instead
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        setIsComplete(true);
        addAIMessage(
          lang === 'hi'
            ? '🙏 धन्यवाद! आपकी जानकारी ले ली गई है। अब आप अपने पिछले दस्तावेज़ अपलोड कर सकते हैं।'
            : '🙏 Thank you! I have collected your history so far. You may now upload any previous medical documents.'
        );
        setInputMode('idle');
        return;
      }

      // Fallback question — pick based on what's still missing so we never re-ask
      // the chief complaint once it's already known (this used to cause an
      // infinite "same question" loop whenever the next-question API failed).
      const fallback = buildFallbackQuestion(state, lang);
      setCurrentQuestion(fallback);
      addAIMessage(fallback.question, fallback.options);
      setInputMode('idle');
    }
  }, [lang, addAIMessage]);

  // ─── Initial greeting + first question ───────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = lang === 'hi'
        ? `नमस्ते${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! मैं आपका AI सहायक हूँ। डॉक्टर के लिए आपकी जानकारी तैयार करूँगा।`
        : `Hello${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! I'm your AI assistant. I'll prepare your history for the doctor.`;

      const greetMsg: ConversationMessage = { id: uuidv4(), speaker: 'AI', text: greeting, timestamp: new Date().toISOString() };
      setMessages([greetMsg]);

      setTimeout(() => fetchNextQuestion(clinicalState, [greetMsg], 0), 800);
    }
  }, []); // eslint-disable-line

  // ─── Process patient answer ───────────────────────────────────────────────
  const processAnswer = useCallback(async (answer: string) => {
    if (!answer.trim() || !currentQuestion) return;

    addPatientMessage(answer);
    setInputMode('processing');
    setTextInput('');

    try {
      // Extract structured data from answer via Gemini
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

      // Check red flags immediately
      const flags = detectRedFlags(newState, lang);
      if (flags.length > 0 && flags.length > redFlags.length) {
        setRedFlags(flags);
        setShowRedFlag(true);
      }

      // Save state to session
      const updSession = { ...session, clinicalState: newState, messages: messagesRef.current, redFlags: flags };
      saveSession(updSession);

      // Fetch next dynamic question
      const newCount = questionCount + 1;
      setQuestionCount(newCount);
      await fetchNextQuestion(newState, messagesRef.current, newCount);
    } catch {
      // Fallback without extraction
      const newCount = questionCount + 1;
      setQuestionCount(newCount);
      await fetchNextQuestion(clinicalState, messagesRef.current, newCount);
    }
  }, [currentQuestion, clinicalState, lang, redFlags, questionCount, session, fetchNextQuestion, addPatientMessage]);

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

  // ─── Voice recording ──────────────────────────────────────────────────────
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoice(blob);
      };
      recorder.start();
      setInputMode('listening');
    } catch {
      addAIMessage(lang === 'hi'
        ? 'माइक उपलब्ध नहीं। कृपया विकल्प चुनें या टाइप करें।'
        : 'Microphone unavailable. Please tap an option or type your answer.');
    }
  };

  const stopListening = () => {
    mediaRecorderRef.current?.stop();
    setInputMode('processing');
  };

  const processVoice = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('lang', lang);
      const resp = await fetch('/api/stt', { method: 'POST', body: formData });
      if (resp.ok) {
        const data = await resp.json();
        if (data.transcript?.trim()) { await processAnswer(data.transcript); return; }
      }
    } catch {}
    setInputMode('idle');
    addAIMessage(lang === 'hi'
      ? 'समझ नहीं आया। फिर बोलें या विकल्प चुनें।'
      : 'Could not understand. Please speak again or select an option.');
  };

  const handleContinue = () => {
    saveSession({ ...session, clinicalState, messages, redFlags });
    router.push('/upload');
  };

  const updateSession = (updates: Partial<typeof session>) => {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  };

  const progress = Math.min(Math.round((questionCount / MAX_QUESTIONS) * 100), 100);

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

        {/* Chat */}
        <div className={styles.chatContainer} ref={chatRef}>
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`${styles.bubble} ${msg.speaker === 'AI' ? styles.aiBubble : styles.patientBubble} animate-fade-in`}
              style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
            >
              {msg.speaker === 'AI' && <div className={styles.aiAvatar}>AI</div>}
              <div className={styles.bubbleContent}>
                <p className={styles.bubbleText}>{msg.text}</p>
                {/* Tap options — only on the LAST AI message when idle */}
                {msg.speaker === 'AI' && msg.options && msg.options.length > 0
                  && !isComplete && i === messages.length - 1 && inputMode === 'idle' && (
                  <div className={styles.options}>
                    {msg.options.map((opt) => (
                      <button
                        key={opt}
                        className={styles.optionBtn}
                        onClick={() => processAnswer(opt)}
                        disabled={inputMode !== 'idle'}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.speaker === 'PATIENT' && (
                <div className={styles.patientAvatar}>{session.patient?.name.charAt(0) || 'P'}</div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {(inputMode === 'processing' || inputMode === 'asking') && (
            <div className={`${styles.bubble} ${styles.aiBubble}`}>
              <div className={styles.aiAvatar}>AI</div>
              <div className={styles.bubbleContent}>
                <div className={styles.thinkingDots}><span /><span /><span /></div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        {!isComplete ? (
          <div className={styles.inputArea}>
            {/* Mic */}
            <button
              id="case-mic-btn"
              className={`${styles.micBtn} ${inputMode === 'listening' ? styles.micActive : ''}`}
              onClick={inputMode === 'listening' ? stopListening : startListening}
              disabled={inputMode === 'processing' || inputMode === 'asking'}
              aria-label={inputMode === 'listening' ? 'Stop recording' : 'Start voice input'}
            >
              {inputMode === 'listening' ? (
                <><div className={styles.ripple} />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="white" /></svg>
                </>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            <div className={styles.inputDivider}><span>{t(lang, 'case_or')}</span></div>

            {/* Text input */}
            <div className={styles.textInputWrap}>
              <input
                id="case-text-input"
                className={`input ${styles.textInput}`}
                type="text"
                placeholder={t(lang, 'case_type_placeholder')}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && textInput.trim() && processAnswer(textInput)}
                disabled={inputMode !== 'idle'}
              />
              <button
                id="case-send-btn"
                className={`btn btn-primary ${styles.sendBtn}`}
                onClick={() => textInput.trim() && processAnswer(textInput)}
                disabled={inputMode !== 'idle' || !textInput.trim()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {inputMode !== 'idle' && (
              <div className={styles.statusBadge}>
                {inputMode === 'listening' && <><div className={styles.recordingDot} />{t(lang, 'case_listening')}</>}
                {inputMode === 'processing' && <><div className="spinner" style={{ width: 16, height: 16 }} />{t(lang, 'case_processing')}</>}
                {inputMode === 'asking' && <><div className="spinner" style={{ width: 16, height: 16 }} />{t(lang, 'case_thinking')}</>}
              </div>
            )}
          </div>
        ) : (
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
