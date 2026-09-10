// src/lib/questionEngine.ts
// Deterministic clinical question engine
// Controls WHAT to ask — LLM only extracts data, not decide flow

import { ClinicalState } from './store';
import { Language } from './translations';

export interface Question {
  id: string;
  field: keyof ClinicalState;
  text_hi: string;
  text_en: string;
  options_hi?: string[];
  options_en?: string[];
  type: 'open' | 'choice' | 'scale' | 'boolean';
  required: boolean;
  conditionalOn?: Partial<ClinicalState>;  // only ask if this condition met
}

export const QUESTIONS: Question[] = [
  {
    id: 'q_chief',
    field: 'chief_complaint',
    text_hi: 'आज आपको क्या तकलीफ है?',
    text_en: 'What problem are you experiencing today?',
    type: 'open',
    required: true,
  },
  {
    id: 'q_onset',
    field: 'onset',
    text_hi: 'यह तकलीफ कब से है?',
    text_en: 'Since when have you been experiencing this?',
    type: 'open',
    required: true,
  },
  {
    id: 'q_location',
    field: 'location',
    text_hi: 'दर्द / तकलीफ कहाँ है?',
    text_en: 'Where exactly is the pain or discomfort?',
    options_hi: ['सीने में', 'पेट में', 'सिर में', 'पीठ में', 'हाथ/पैर में', 'अन्य'],
    options_en: ['Chest', 'Abdomen', 'Head', 'Back', 'Arms/Legs', 'Other'],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_severity',
    field: 'severity',
    text_hi: '1 से 10 के पैमाने पर दर्द कितना तेज़ है? (1 = कम, 10 = बहुत तेज़)',
    text_en: 'On a scale of 1 to 10, how severe is the pain? (1 = mild, 10 = worst)',
    options_hi: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    options_en: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    type: 'scale',
    required: false,
  },
  {
    id: 'q_character',
    field: 'character',
    text_hi: 'दर्द कैसा है?',
    text_en: 'What does the pain feel like?',
    options_hi: ['दबाव जैसा', 'जलन जैसा', 'चुभन जैसा', 'धड़कन जैसा', 'ऐंठन जैसी', 'अन्य'],
    options_en: ['Pressure/Squeezing', 'Burning', 'Sharp/Stabbing', 'Throbbing', 'Cramping', 'Other'],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_radiation',
    field: 'radiation',
    text_hi: 'क्या दर्द कहीं और फैलता है?',
    text_en: 'Does the pain spread anywhere?',
    options_hi: ['बाएं हाथ में', 'जबड़े में', 'पीठ में', 'गर्दन में', 'नहीं फैलता', 'अन्य'],
    options_en: ['Left arm', 'Jaw', 'Back', 'Neck', 'No radiation', 'Other'],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_breathlessness',
    field: 'breathlessness',
    text_hi: 'क्या आपको सांस लेने में तकलीफ है?',
    text_en: 'Are you experiencing breathlessness or difficulty breathing?',
    options_hi: ['हाँ', 'नहीं'],
    options_en: ['Yes', 'No'],
    type: 'boolean',
    required: true,
  },
  {
    id: 'q_sweating',
    field: 'sweating',
    text_hi: 'क्या असामान्य पसीना आ रहा है?',
    text_en: 'Are you experiencing unusual sweating?',
    options_hi: ['हाँ', 'नहीं'],
    options_en: ['Yes', 'No'],
    type: 'boolean',
    required: false,
  },
  {
    id: 'q_dizziness',
    field: 'dizziness',
    text_hi: 'क्या चक्कर या कमज़ोरी है?',
    text_en: 'Are you experiencing dizziness or weakness?',
    options_hi: ['हाँ', 'नहीं'],
    options_en: ['Yes', 'No'],
    type: 'boolean',
    required: false,
  },
  {
    id: 'q_nausea',
    field: 'nausea',
    text_hi: 'क्या जी मिचलाना या उल्टी हो रही है?',
    text_en: 'Are you experiencing nausea or vomiting?',
    options_hi: ['हाँ', 'नहीं'],
    options_en: ['Yes', 'No'],
    type: 'boolean',
    required: false,
  },
  {
    id: 'q_aggravating',
    field: 'aggravating_factors',
    text_hi: 'तकलीफ किससे बढ़ती है?',
    text_en: 'What makes it worse?',
    options_hi: ['चलने से', 'खाने से', 'लेटने से', 'तनाव से', 'ठंड से', 'पता नहीं'],
    options_en: ['Walking/Exertion', 'Eating', 'Lying down', 'Stress', 'Cold', "Don't know"],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_relieving',
    field: 'relieving_factors',
    text_hi: 'तकलीफ किससे कम होती है?',
    text_en: 'What makes it better?',
    options_hi: ['आराम से', 'दवाई से', 'गर्म सेंक से', 'खाने से', 'पता नहीं'],
    options_en: ['Rest', 'Medication', 'Heat', 'Food', "Don't know"],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_previous',
    field: 'previous_episode',
    text_hi: 'क्या पहले भी ऐसी तकलीफ हुई है?',
    text_en: 'Have you experienced this before?',
    options_hi: ['हाँ', 'नहीं'],
    options_en: ['Yes', 'No'],
    type: 'boolean',
    required: false,
  },
  {
    id: 'q_past_history',
    field: 'past_history',
    text_hi: 'आपकी पुरानी बीमारियाँ कौन सी हैं?',
    text_en: 'Do you have any existing medical conditions?',
    options_hi: ['मधुमेह', 'उच्च रक्तचाप', 'दिल की बीमारी', 'थायरॉइड', 'अस्थमा', 'कुछ नहीं'],
    options_en: ['Diabetes', 'Hypertension', 'Heart disease', 'Thyroid', 'Asthma', 'None'],
    type: 'choice',
    required: false,
  },
  {
    id: 'q_medications',
    field: 'medications',
    text_hi: 'क्या आप कोई दवाई ले रहे हैं?',
    text_en: 'Are you currently taking any medications?',
    type: 'open',
    required: false,
  },
  {
    id: 'q_allergies',
    field: 'allergies',
    text_hi: 'क्या आपको किसी दवाई से एलर्जी है?',
    text_en: 'Do you have any known drug allergies?',
    options_hi: ['हाँ', 'नहीं', 'पता नहीं'],
    options_en: ['Yes', 'No', "Don't know"],
    type: 'choice',
    required: false,
  },
];

/**
 * Returns the next unanswered question from the list.
 * Skips questions whose fields are already filled in clinical state.
 */
export function getNextQuestion(state: ClinicalState, askedIds: string[]): Question | null {
  for (const q of QUESTIONS) {
    if (askedIds.includes(q.id)) continue;

    const fieldValue = state[q.field];
    // Skip if already filled
    if (Array.isArray(fieldValue) && fieldValue.length > 0) continue;
    if (fieldValue !== null && !Array.isArray(fieldValue)) continue;

    return q;
  }
  return null; // All questions answered
}

export function getQuestionText(q: Question, lang: Language): string {
  return lang === 'hi' ? q.text_hi : q.text_en;
}

export function getQuestionOptions(q: Question, lang: Language): string[] {
  if (lang === 'hi') return q.options_hi ?? [];
  return q.options_en ?? [];
}

export function getTotalQuestions(): number {
  return QUESTIONS.length;
}

export function getProgress(askedIds: string[]): number {
  return Math.round((askedIds.length / QUESTIONS.length) * 100);
}
