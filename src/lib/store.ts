// src/lib/store.ts
// Global session state using localStorage-backed context
// Keeps patient session, language, and clinical state across pages

import { Language } from './translations';

export interface PatientProfile {
  id: string;
  name: string;
  age: string;
  gender: 'male' | 'female' | 'other';
  abhaId?: string;
}

export interface ClinicalState {
  chief_complaint: string | null;
  onset: string | null;
  duration: string | null;
  location: string | null;
  severity: number | null;
  character: string | null;
  radiation: string | null;
  aggravating_factors: string[];
  relieving_factors: string[];
  breathlessness: boolean | null;
  sweating: boolean | null;
  dizziness: boolean | null;
  nausea: boolean | null;
  previous_episode: boolean | null;
  past_history: string[];
  medications: string[];
  allergies: string[];
  associated_symptoms: string[];
  // Free-form Q&A captured when the dynamic AI question engine asks about
  // something specific to this complaint that doesn't fit a fixed field above
  // (e.g. for a dog bite: which animal, vaccination status, wound care done).
  additional_findings: { field: string; question: string; answer: string }[];
}

// The fixed/structured fields above — anything the dynamic question engine
// asks about outside this set gets captured in `additional_findings` instead.
export const KNOWN_CLINICAL_FIELDS: (keyof ClinicalState)[] = [
  'chief_complaint', 'onset', 'duration', 'location', 'severity', 'character', 'radiation',
  'aggravating_factors', 'relieving_factors', 'breathlessness', 'sweating', 'dizziness',
  'nausea', 'previous_episode', 'past_history', 'medications', 'allergies', 'associated_symptoms',
];

export interface RedFlag {
  rule_name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface ConversationMessage {
  id: string;
  speaker: 'AI' | 'PATIENT';
  text: string;
  timestamp: string;
  options?: string[];
}

export interface ExtractedDocument {
  date?: string;
  diagnosis?: string[];
  medications?: { name: string; dose?: string; frequency?: string }[];
  labs?: { name: string; value?: string | number; unit?: string; reference_range?: string; status?: string }[];
  raw_text?: string;
  confidence?: 'HIGH' | 'LOW' | 'NEEDS_VERIFICATION';
}

export interface AppSession {
  sessionId: string;
  language: Language;
  patient: PatientProfile | null;
  consultationType: 'general' | 'ayush' | null;
  clinicalState: ClinicalState;
  messages: ConversationMessage[];
  redFlags: RedFlag[];
  documents: ExtractedDocument[];
  summary: string | null;
  consentGiven: boolean;
  fontScale: number;
}

export const defaultClinicalState: ClinicalState = {
  chief_complaint: null,
  onset: null,
  duration: null,
  location: null,
  severity: null,
  character: null,
  radiation: null,
  aggravating_factors: [],
  relieving_factors: [],
  breathlessness: null,
  sweating: null,
  dizziness: null,
  nausea: null,
  previous_episode: null,
  past_history: [],
  medications: [],
  allergies: [],
  associated_symptoms: [],
  additional_findings: [],
};

export const defaultSession: AppSession = {
  sessionId: '',
  language: 'hi',
  patient: null,
  consultationType: null,
  clinicalState: { ...defaultClinicalState },
  messages: [],
  redFlags: [],
  documents: [],
  summary: null,
  consentGiven: false,
  fontScale: 1,
};

const SESSION_KEY = 'medcase_session';

export function saveSession(session: AppSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function loadSession(): AppSession {
  if (typeof window === 'undefined') return { ...defaultSession };
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { ...defaultSession };
    return { ...defaultSession, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSession };
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}
