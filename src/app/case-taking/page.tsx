'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AccessibilityBar from '@/components/AccessibilityBar';
import RedFlagAlert from '@/components/RedFlagAlert';
import { loadSession, saveSession, ConversationMessage, ClinicalState, defaultClinicalState, KNOWN_CLINICAL_FIELDS } from '@/lib/store';
import { t } from '@/lib/translations';
import { detectRedFlags } from '@/lib/redFlagRules';
import { getDiseaseSpecificQuestion, calculateScaledSeverity, SeverityLevel } from '@/lib/questionEngine';
import { v4 as uuidv4 } from 'uuid';
import styles from './page.module.css';

type InputMode = 'idle' | 'speaking' | 'listening' | 'processing' | 'asking';

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

interface DynamicQuestion {
  question: string;
  options: string[];
  field: string;
  is_complete: boolean;
}

// Absolute safety net only — the AI decides when the interview is actually
// done (via is_complete). This just guarantees we can never loop forever if
// that never happens for some reason.
const MAX_QUESTIONS = 12;

export default function CaseTakingPage() {
  const router = useRouter();
  const [session, setSession] = useState(loadSession());
  const lang = session.language;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [clinicalState, setClinicalState] = useState<ClinicalState>(
    { ...defaultClinicalState, ...session.clinicalState }
  );
  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(() =>
    getDiseaseSpecificQuestion({ ...defaultClinicalState, ...session.clinicalState }, 0, session.language || 'hi')
  );
  const [lastAnswer, setLastAnswer] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>('idle');
  const [textInput, setTextInput] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [redFlags, setRedFlags] = useState(session.redFlags);
  const [showRedFlag, setShowRedFlag] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [generatedReport, setGeneratedReport] = useState<Record<string, any> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>('MILD');

  // Refs — these hold live/mutable objects that don't need re-renders
  const messagesRef = useRef<ConversationMessage[]>([]);
  const voiceEnabledRef = useRef(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const skipProcessRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceFallbackTimerRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakResolveRef = useRef<(() => void) | null>(null);
  const consecutiveFailuresRef = useRef(0);
  const isInitializedRef = useRef(false);
  const isProcessingAnswerRef = useRef(false);
  const currentSpeechIdRef = useRef(0);
  const ttsAbortRef = useRef<AbortController | null>(null);

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
    currentSpeechIdRef.current += 1;
    if (ttsAbortRef.current) {
      try { ttsAbortRef.current.abort(); } catch {}
      ttsAbortRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {}
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
    interruptSpeech();

    const speechId = ++currentSpeechIdRef.current;
    const abortController = new AbortController();
    ttsAbortRef.current = abortController;

    setInputMode('speaking');
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
        signal: abortController.signal,
      });

      if (speechId !== currentSpeechIdRef.current) return;

      if (resp.ok) {
        const data = await resp.json();
        if (speechId !== currentSpeechIdRef.current) return;

        if (data.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audio_base64}`);
          currentAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            speakResolveRef.current = resolve;
            audio.onended = () => {
              if (currentAudioRef.current === audio) currentAudioRef.current = null;
              speakResolveRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              if (currentAudioRef.current === audio) currentAudioRef.current = null;
              speakResolveRef.current = null;
              resolve();
            };
            audio.play().catch(() => {
              if (currentAudioRef.current === audio) currentAudioRef.current = null;
              speakResolveRef.current = null;
              resolve();
            });
          });
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
    if (speechRecognitionRef.current) {
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      try {
        if (discard && recognition.abort) recognition.abort();
        else recognition.stop();
      } catch {}
      if (discard) setInputMode('idle');
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setInputMode(discard ? 'idle' : 'processing');
      try { recorder.stop(); } catch {}
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
    if (isProcessingAnswerRef.current || inputMode === 'processing' || inputMode === 'asking') return;
    interruptSpeech();
    try {
      const speechWindow = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        if (speechRecognitionRef.current) {
          try { speechRecognitionRef.current.abort?.(); } catch {}
          speechRecognitionRef.current = null;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = false;
        let handled = false;

        recognition.onresult = event => {
          if (handled || isProcessingAnswerRef.current) return;
          const transcript = Array.from(event.results)
            .map(result => result[0]?.transcript || '')
            .join(' ')
            .trim();
          if (transcript) {
            handled = true;
            try { recognition.stop(); } catch {}
            speechRecognitionRef.current = null;
            processAnswer(transcript);
          }
        };
        recognition.onerror = () => {
          if (handled) return;
          speechRecognitionRef.current = null;
          setInputMode('idle');
          setMicHint(lang === 'hi'
            ? 'माइक से आवाज़ नहीं मिली। कृपया फिर से बोलें या नीचे विकल्प चुनें।'
            : 'No voice was heard. Please try again or tap an option below.');
        };
        recognition.onend = () => {
          speechRecognitionRef.current = null;
          if (!handled && !isProcessingAnswerRef.current && inputMode === 'listening') setInputMode('idle');
        };
        speechRecognitionRef.current = recognition;
        setMicHint(null);
        setInputMode('listening');
        recognition.start();
        return;
      }

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

  // ─── Fetch next question from AI / engine, then speak it, then auto-listen ────
  async function fetchNextQuestion(state: ClinicalState, msgs: ConversationMessage[], count: number) {
    if (count >= MAX_QUESTIONS) {
      await finishInterview(state);
      return;
    }

    try {
      const resp = await fetch('/api/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_state: state,
          conversation_history: msgs.map(m => ({ speaker: m.speaker, text: m.text })),
          question_count: count,
          lang,
        }),
      });

      let q: DynamicQuestion;
      if (resp.ok) {
        q = await resp.json();
      } else {
        q = buildFallbackQuestion(state, lang, count);
      }
      consecutiveFailuresRef.current = 0;

      if (q.is_complete || count >= MAX_QUESTIONS) {
        await finishInterview(state);
        return;
      }

      // Display question & options IMMEDIATELY without waiting for audio
      setCurrentQuestion(q);
      addAIMessage(q.question, q.options);
      setInputMode('idle');

      await speak(q.question);
      if (!isProcessingAnswerRef.current) {
        await startListening();
      }
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        await finishInterview(state);
        return;
      }
      const fallback = buildFallbackQuestion(state, lang, count);
      if (fallback.is_complete || count >= MAX_QUESTIONS) {
        await finishInterview(state);
        return;
      }
      setCurrentQuestion(fallback);
      addAIMessage(fallback.question, fallback.options);
      setInputMode('idle');
      await speak(fallback.question);
      if (!isProcessingAnswerRef.current) {
        await startListening();
      }
    }
  }

  async function finishInterview(stateToUse?: ClinicalState, flagsToUse?: typeof redFlags) {
    setIsComplete(true);
    setCurrentQuestion(null);
    setInputMode('idle');
    setReportLoading(true);

    const activeState = stateToUse || clinicalState;
    const activeFlags = flagsToUse || redFlags;

    const closingText = lang === 'hi'
      ? 'आपकी सभी जानकारी दर्ज कर ली गई है। आपकी संपूर्ण रिपोर्ट तैयार की जा रही है।'
      : 'All your information has been recorded. Generating your complete report.';
    addAIMessage(closingText);
    await speak(closingText);

    try {
      const resp = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinical_state: activeState,
          red_flags: activeFlags,
          documents: session.documents || [],
          lang,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const summaryData = data.summary;
        setGeneratedReport(summaryData);
        const updSession = {
          ...session,
          clinicalState: activeState,
          messages: messagesRef.current,
          redFlags: activeFlags,
          summary: JSON.stringify(summaryData),
        };
        setSession(updSession);
        saveSession(updSession);

        const readyText = lang === 'hi'
          ? 'आपकी पूर्ण रिपोर्ट तैयार हो गई है। कृपया इसे देखें।'
          : 'Your complete report is ready. Please review it.';
        await speak(readyText);
      }
    } catch (err) {
      console.error('Failed to generate report after interview:', err);
    } finally {
      setReportLoading(false);
    }
  }

  // ─── Initial greeting + first question ───────────────────────────────────
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialQ = buildFallbackQuestion(clinicalState, lang, 0);
    setCurrentQuestion(initialQ);
    setInputMode('idle');

    if (messages.length === 0) {
      const greeting = lang === 'hi'
        ? `नमस्ते${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! मैं आपकी AI सहायक हूँ। बताइए, आज आपको क्या तकलीफ है?`
        : `Hello${session.patient ? ` ${session.patient.name.split(' ')[0]}` : ''}! I'm your AI assistant. Tell me, what brings you in today?`;

      const greetMsg: ConversationMessage = { id: uuidv4(), speaker: 'AI', text: greeting, timestamp: new Date().toISOString(), options: initialQ.options };
      setMessages([greetMsg]);

      (async () => {
        await speak(greeting);
        if (!isProcessingAnswerRef.current) {
          await startListening();
        }
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
    if (isProcessingAnswerRef.current) return;
    if (!answer.trim() || !currentQuestion || inputMode === 'processing' || inputMode === 'asking') return;

    isProcessingAnswerRef.current = true;
    interruptSpeech();
    stopListening(true);
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

      let newState: ClinicalState;
      if (resp.ok) {
        const data = await resp.json();
        newState = data.updated_state
          ? mergeExtractedState(clinicalState, data.updated_state, currentQuestion, answer)
          : applyAnswerFallback(currentQuestion, answer, clinicalState);
      } else {
        newState = applyAnswerFallback(currentQuestion, answer, clinicalState);
      }

      // Automatically scale severity according to disease question & patient answer
      const scaled = calculateScaledSeverity(answer, currentQuestion.field, newState.severity ?? null);
      if (scaled.score > (newState.severity || 0) || currentQuestion.field === 'severity') {
        newState.severity = scaled.score;
      }
      setSeverityLevel(scaled.level);

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
    } finally {
      isProcessingAnswerRef.current = false;
    }
  }

  // ─── Fallback: pick the disease-specific question when API fails ─────────
  function buildFallbackQuestion(state: ClinicalState, lang: 'hi' | 'en', count: number = 0): DynamicQuestion {
    return getDiseaseSpecificQuestion(state, count, lang);
  }

  // ─── Helpers for complaint-specific (non-fixed) fields ───────────────────
  // The dynamic AI question engine can invent a field name for anything that
  // doesn't fit the fixed ClinicalState schema (e.g. "which animal bit you").
  // Those get preserved verbatim here instead of being silently dropped.
  function isKnownField(field: string): field is keyof ClinicalState {
    return (KNOWN_CLINICAL_FIELDS as string[]).includes(field);
  }

  function withAdditionalFinding(state: ClinicalState, field: string, question: string, answer: string): ClinicalState {
    const existingIdx = state.additional_findings.findIndex(f => f.field === field);
    const entry = { field, question, answer };
    const nextFindings = existingIdx >= 0
      ? state.additional_findings.map((f, i) => (i === existingIdx ? entry : f))
      : [...state.additional_findings, entry];
    return { ...state, additional_findings: nextFindings };
  }

  // Merge whatever /api/extract returned into clinicalState: known fields go
  // into their typed slot, anything complaint-specific is kept verbatim in
  // additional_findings so it always flows through to the final report.
  function mergeExtractedState(
    base: ClinicalState,
    extracted: Record<string, unknown>,
    question: DynamicQuestion,
    rawAnswer: string
  ): ClinicalState {
    let next = { ...base };

    for (const [key, value] of Object.entries(extracted)) {
      if (isKnownField(key)) {
        (next as Record<string, unknown>)[key] = value;
      }
    }

    if (isKnownField(question.field)) {
      if (!(question.field in extracted)) {
        if (Array.isArray(next[question.field])) {
          next = { ...next, [question.field]: [...(next[question.field] as string[]), rawAnswer] };
        } else {
          (next as Record<string, unknown>)[question.field] = rawAnswer;
        }
      }
    } else {
      const answerText = typeof extracted[question.field] === 'string' ? String(extracted[question.field]) : rawAnswer;
      next = withAdditionalFinding(next, question.field, question.question, answerText);
    }

    return next;
  }

  // ─── Fallback: apply answer without any AI (extraction API unreachable) ──
  function applyAnswerFallback(question: DynamicQuestion, answer: string, state: ClinicalState): ClinicalState {
    const field = question.field;
    let s = { ...state };
    const lower = answer.toLowerCase();
    const boolYes = lower.includes('हाँ') || lower.includes('yes') || lower.includes('ha') || lower.includes('haa');
    const boolFields = ['breathlessness', 'sweating', 'dizziness', 'nausea', 'previous_episode'];

    if (isKnownField(field)) {
      if (boolFields.includes(field)) {
        (s as Record<string, unknown>)[field] = boolYes;
      } else if (field === 'severity') {
        const scaled = calculateScaledSeverity(answer, 'severity', s.severity ?? null);
        s.severity = scaled.score;
      } else if (Array.isArray(s[field])) {
        s = { ...s, [field]: [...(s[field] as string[]), answer] };
      } else {
        (s as Record<string, unknown>)[field] = answer;
      }
    } else {
      s = withAdditionalFinding(s, field, question.question, answer);
    }

    // Auto-detect symptoms from text
    if (lower.includes('सांस') || lower.includes('breath')) s.breathlessness = true;
    if (lower.includes('पसीना') || lower.includes('sweat')) s.sweating = true;
    if (lower.includes('चक्कर') || lower.includes('dizzy')) s.dizziness = true;
    if (lower.includes('उल्टी') || lower.includes('vomit') || lower.includes('जी मिचलाना') || lower.includes('nausea')) s.nausea = true;

    // Check if answer contains scaled severity information
    const scaled = calculateScaledSeverity(answer, String(field), s.severity ?? null);
    if (scaled.score > (s.severity || 0)) {
      s.severity = scaled.score;
    }

    return s;
  }

  // ─── UI event handlers ────────────────────────────────────────────────────
  function handleMicTap() {
    if (inputMode === 'listening') { stopListening(false); return; }
    if (inputMode === 'speaking') { interruptSpeech(); startListening(); return; }
    if (inputMode === 'idle') { startListening(); return; }
  }

  function handleOptionTap(opt: string) {
    if (isProcessingAnswerRef.current || inputMode === 'processing') return;
    if (inputMode === 'listening') stopListening(true);
    if (inputMode === 'speaking') interruptSpeech();
    processAnswer(opt);
  }

  function handleTypedSubmit() {
    if (!textInput.trim()) return;
    if (inputMode === 'listening') stopListening(true);
    else if (inputMode === 'speaking') interruptSpeech();
    processAnswer(textInput);
  }

  function handleContinue() {
    interruptSpeech();
    stopListening(true);
    saveSession({
      ...session,
      clinicalState,
      messages,
      redFlags,
      summary: generatedReport ? JSON.stringify(generatedReport) : session.summary,
    });
    router.push('/upload');
  }

  function updateSession(updates: Partial<typeof session>) {
    const updated = { ...session, ...updates };
    setSession(updated);
    saveSession(updated);
  }

  // The interview length is now dynamic (the AI decides when it's done), so
  // this is a soft/asymptotic indicator of progress rather than a literal
  // fraction of a fixed total — it keeps growing but never falsely implies
  // "almost done" too early.
  const progress = isComplete ? 100 : Math.min(85, 15 + questionCount * 12);

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
            {/* Live Scaled Severity Badge */}
            <div className={styles.severityWrap} title={lang === 'hi' ? 'स्वतः गंभीर स्तर (Auto-scaled severity)' : 'Auto-scaled severity'}>
              <span className={styles.severityTitle}>{lang === 'hi' ? 'गंभीरता' : 'Severity'}:</span>
              <span className={`${styles.severityBadgeLive} ${styles[`sev_${severityLevel.toLowerCase()}`] || styles.sev_mild}`}>
                <span className={styles.severityDot} />
                {severityLevel === 'MILD' && (lang === 'hi' ? 'सामान्य' : 'Mild')}
                {severityLevel === 'MODERATE' && (lang === 'hi' ? 'मध्यम' : 'Moderate')}
                {severityLevel === 'SEVERE' && (lang === 'hi' ? 'गंभीर' : 'Severe')}
                {severityLevel === 'CRITICAL' && (lang === 'hi' ? 'अति-गंभीर' : 'Critical')}
              </span>
            </div>

            <button
              className={styles.voiceToggleBtn}
              onClick={() => setVoiceEnabled(v => !v)}
              aria-label={voiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
              title={voiceEnabled ? (lang === 'hi' ? 'AI आवाज़ बंद करें' : 'Mute AI voice') : (lang === 'hi' ? 'AI आवाज़ चालू करें' : 'Unmute AI voice')}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>
            <div className={styles.progressLabel}>
              {isComplete
                ? (lang === 'hi' ? 'पूर्ण' : 'Complete')
                : (lang === 'hi' ? `प्रश्न ${questionCount + 1}` : `Question ${questionCount + 1}`)}
            </div>
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
              {lang === 'hi' ? 'आपकी जानकारी पूरी हो गई है।' : 'Your history collection is complete.'}
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
              {(inputMode === 'processing' || inputMode === 'asking' || (isComplete && reportLoading)) && (
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

          {/* Complete Clinical Report Card generated right after disease questions finish */}
          {isComplete && (
            <div className={styles.reportPreviewCard}>
              <div className={styles.reportHeader}>
                <div className={styles.reportTitleWrap}>
                  <span className={styles.reportIcon}>📋</span>
                  <div>
                    <h2 className={styles.reportTitle}>
                      {lang === 'hi' ? 'रोगी पूर्ण चिकित्सा रिपोर्ट' : 'Complete Patient Clinical Report'}
                    </h2>
                    <p className={styles.reportSubtitle}>
                      {lang === 'hi' ? 'बीमारी के प्रश्नों के आधार पर तैयार संपूर्ण रिपोर्ट' : 'Complete clinical report generated from disease assessment'}
                    </p>
                  </div>
                </div>
                {generatedReport?.priority && (
                  <span className={`${styles.priorityBadge} ${styles['priority_' + String(generatedReport.priority).toLowerCase()] || ''}`}>
                    {generatedReport.priority}
                  </span>
                )}
              </div>

              {reportLoading ? (
                <div className={styles.reportLoadingWrap}>
                  <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                  <p>{lang === 'hi' ? 'संपूर्ण रिपोर्ट तैयार की जा रही है...' : 'Generating complete clinical report...'}</p>
                </div>
              ) : generatedReport ? (
                <div className={styles.reportBody}>
                  {/* Scaled Severity Row */}
                  <div className={styles.reportSeverityRow}>
                    <span className={styles.reportSectionLabel} style={{ marginBottom: 0 }}>
                      {lang === 'hi' ? 'आकलित गंभीरता (Severity):' : 'Scaled Severity:'}
                    </span>
                    <span className={`${styles.severityBadgeLive} ${styles[`sev_${severityLevel.toLowerCase()}`] || styles.sev_mild}`}>
                      <span className={styles.severityDot} />
                      {severityLevel === 'MILD' && (lang === 'hi' ? 'सामान्य (Mild - 1-3/10)' : 'Mild (1-3/10)')}
                      {severityLevel === 'MODERATE' && (lang === 'hi' ? 'मध्यम (Moderate - 4-6/10)' : 'Moderate (4-6/10)')}
                      {severityLevel === 'SEVERE' && (lang === 'hi' ? 'गंभीर (Severe - 7-8/10)' : 'Severe (7-8/10)')}
                      {severityLevel === 'CRITICAL' && (lang === 'hi' ? 'अति-गंभीर (Critical - 9-10/10)' : 'Critical (9-10/10)')}
                    </span>
                  </div>

                  {generatedReport.summary_text && (
                    <p className={styles.reportSummaryText}>{generatedReport.summary_text}</p>
                  )}

                  <div className={styles.reportDetailsGrid}>
                    {generatedReport.chief_complaint && (
                      <div className={styles.reportSection}>
                        <span className={styles.reportSectionLabel}>
                          {lang === 'hi' ? 'मुख्य समस्या' : 'Chief Complaint'}:
                        </span>
                        <span className={styles.reportSectionValue}>{generatedReport.chief_complaint}</span>
                      </div>
                    )}

                    {generatedReport.history_of_present_illness && (
                      <div className={styles.reportSection}>
                        <span className={styles.reportSectionLabel}>
                          {lang === 'hi' ? 'लक्षण इतिहास' : 'History of Present Illness'}:
                        </span>
                        <span className={styles.reportSectionValue}>{generatedReport.history_of_present_illness}</span>
                      </div>
                    )}

                    {generatedReport.associated_symptoms && Array.isArray(generatedReport.associated_symptoms) && generatedReport.associated_symptoms.length > 0 && (
                      <div className={styles.reportSection}>
                        <span className={styles.reportSectionLabel}>
                          {lang === 'hi' ? 'संबद्ध लक्षण' : 'Associated Symptoms'}:
                        </span>
                        <div className={styles.symptomPills}>
                          {generatedReport.associated_symptoms.map((s: string, idx: number) => (
                            <span key={idx} className={styles.symptomPill}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Red flags warning if detected */}
                    {((generatedReport.red_flags && generatedReport.red_flags.length > 0) || redFlags.length > 0) && (
                      <div className={styles.reportRedFlags}>
                        <div className={styles.reportRedFlagTitle}>
                          <span>🚩</span>
                          <span>{lang === 'hi' ? 'चेतावनी संकेत (Red Flags)' : 'Warning Signs (Red Flags)'}</span>
                        </div>
                        {(generatedReport.red_flags || redFlags.map(f => f.description)).map((rf: string, idx: number) => (
                          <div key={idx} className={styles.reportRedFlagItem}>
                            <span>•</span>
                            <span>{rf}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations for triage / doctor */}
                    {generatedReport.recommended_actions && Array.isArray(generatedReport.recommended_actions) && generatedReport.recommended_actions.length > 0 && (
                      <div className={styles.reportSection}>
                        <span className={styles.reportSectionLabel}>
                          {lang === 'hi' ? 'चिकित्सक अनुशंसा (Doctor Actions)' : 'Clinical Recommendations'}:
                        </span>
                        <div className={styles.recommendationsList}>
                          {generatedReport.recommended_actions.map((rec: string, idx: number) => (
                            <div key={idx} className={styles.recommendationItem}>
                              <span>✓</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions inside report card */}
                  <div className={styles.reportActionGrid}>
                    <button
                      id="case-view-full-summary-btn"
                      className="btn btn-primary btn-lg"
                      onClick={() => {
                        saveSession({
                          ...session,
                          clinicalState,
                          messages: messagesRef.current,
                          redFlags,
                          summary: JSON.stringify(generatedReport),
                        });
                        router.push('/summary');
                      }}
                    >
                      {lang === 'hi' ? 'पूरा सारांश पृष्ठ देखें' : 'View Full Summary Page'}
                    </button>
                    <button
                      id="case-upload-docs-btn"
                      className="btn btn-outline btn-lg"
                      onClick={handleContinue}
                    >
                      {lang === 'hi' ? 'दस्तावेज़ अपलोड करें' : 'Upload Documents'}
                    </button>
                    <button
                      id="case-doctor-dash-btn"
                      className="btn btn-outline btn-lg"
                      onClick={() => {
                        saveSession({
                          ...session,
                          clinicalState,
                          messages: messagesRef.current,
                          redFlags,
                          summary: JSON.stringify(generatedReport),
                        });
                        router.push('/doctor');
                      }}
                    >
                      {lang === 'hi' ? 'डॉक्टर डैशबोर्ड' : 'Doctor Dashboard'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* MCQ tap options */}
          {!isComplete && currentQuestion && currentQuestion.options?.length > 0 && (
            <div className={styles.mcqGrid}>
              {currentQuestion.options.map(opt => (
                <button
                  key={opt}
                  className={styles.mcqBtn}
                  onClick={() => handleOptionTap(opt)}
                  disabled={inputMode === 'processing'}
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
                disabled={inputMode === 'processing'}
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
            <div className={styles.completeMsg}>
              <span>✅</span>
              <span>{lang === 'hi' ? 'इतिहास दर्ज हुआ' : 'History Recorded'}</span>
            </div>
            <button id="case-continue-btn" className="btn btn-primary btn-lg" onClick={handleContinue}>
              {lang === 'hi' ? 'दस्तावेज़ अपलोड करें (आगे बढ़ें)' : 'Upload Documents (Continue)'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
