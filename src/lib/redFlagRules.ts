// src/lib/redFlagRules.ts
// DETERMINISTIC red-flag detection engine — NOT LLM-dependent

import { ClinicalState } from './store';

export interface RedFlagRule {
  id: string;
  name: string;
  description_hi: string;
  description_en: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  check: (state: ClinicalState) => boolean;
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'chest_pain_breathlessness',
    name: 'Chest Pain + Breathlessness',
    description_hi: 'सीने में दर्द + सांस की तकलीफ — तुरंत चिकित्सा मूल्यांकन आवश्यक',
    description_en: 'Chest pain + breathlessness — immediate medical evaluation required',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.location?.toLowerCase().includes('chest') ||
        s.location === 'सीने में' ||
        s.location === 'Chest') &&
      s.breathlessness === true,
  },
  {
    id: 'severe_pain',
    name: 'Severe Pain (8+/10)',
    description_hi: 'गंभीर दर्द (8/10 या अधिक)',
    description_en: 'Severe pain score (8/10 or above)',
    severity: 'HIGH',
    check: (s) => s.severity !== null && s.severity >= 8,
  },
  {
    id: 'chest_pain_radiation',
    name: 'Chest Pain + Arm/Jaw Radiation',
    description_hi: 'सीने में दर्द + बाएं हाथ / जबड़े में फैलाव',
    description_en: 'Chest pain with radiation to arm or jaw (possible cardiac)',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.location === 'सीने में' || s.location === 'Chest') &&
      !!(s.radiation?.toLowerCase().includes('arm') ||
        s.radiation?.toLowerCase().includes('jaw') ||
        s.radiation === 'बाएं हाथ में' ||
        s.radiation === 'जबड़े में'),
  },
  {
    id: 'chest_pain_sweating',
    name: 'Chest Pain + Sweating + Dizziness',
    description_hi: 'सीने में दर्द + पसीना + चक्कर',
    description_en: 'Chest pain with sweating and dizziness',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.location === 'सीने में' || s.location === 'Chest') &&
      s.sweating === true &&
      s.dizziness === true,
  },
  {
    id: 'breathlessness_alone',
    name: 'Acute Breathlessness',
    description_hi: 'तीव्र सांस की तकलीफ',
    description_en: 'Acute breathlessness without identified cause',
    severity: 'MEDIUM',
    check: (s) => s.breathlessness === true && !s.chief_complaint?.toLowerCase().includes('chest'),
  },
];

export interface DetectedRedFlag {
  rule_name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export function detectRedFlags(state: ClinicalState, lang: 'hi' | 'en'): DetectedRedFlag[] {
  const detected: DetectedRedFlag[] = [];
  for (const rule of RED_FLAG_RULES) {
    if (rule.check(state)) {
      detected.push({
        rule_name: rule.name,
        severity: rule.severity,
        description: lang === 'hi' ? rule.description_hi : rule.description_en,
      });
    }
  }
  return detected;
}

export function hasHighSeverityFlag(flags: DetectedRedFlag[]): boolean {
  return flags.some((f) => f.severity === 'HIGH');
}
