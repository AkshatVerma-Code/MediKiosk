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
  // ─── Cardiac Red Flags ──────────────────────────────────────────────────
  {
    id: 'chest_pain_breathlessness',
    name: 'Chest Pain + Breathlessness',
    description_hi: 'सीने में दर्द + सांस की तकलीफ — तुरंत आपातकालीन ईसीजी / मूल्यांकन आवश्यक',
    description_en: 'Chest pain + breathlessness — immediate emergency ECG / evaluation required',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.chief_complaint?.includes('सीने') ||
        s.location?.toLowerCase().includes('chest') ||
        s.location === 'सीने में' ||
        s.location === 'Chest') &&
      s.breathlessness === true,
  },
  {
    id: 'chest_pain_radiation',
    name: 'Chest Pain + Arm/Jaw Radiation',
    description_hi: 'सीने में दर्द + बाएं हाथ / जबड़े में फैलाव (संभावित दिल का दौरा / एंजाइना)',
    description_en: 'Chest pain with radiation to arm or jaw (suspected acute coronary syndrome)',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.chief_complaint?.includes('सीने') ||
        s.location === 'सीने में' || s.location === 'Chest') &&
      !!(s.radiation?.toLowerCase().includes('arm') ||
        s.radiation?.toLowerCase().includes('jaw') ||
        s.radiation?.includes('हाथ') ||
        s.radiation?.includes('जबड़े') ||
        s.radiation === 'बाएं हाथ में' ||
        s.radiation === 'जबड़े में'),
  },
  {
    id: 'chest_pain_sweating',
    name: 'Chest Pain + Sweating + Dizziness',
    description_hi: 'सीने में दर्द + ठंडा पसीना + चक्कर (कार्डियक शॉक का जोखिम)',
    description_en: 'Chest pain with sweating and dizziness (risk of cardiac shock)',
    severity: 'HIGH',
    check: (s) =>
      !!(s.chief_complaint?.toLowerCase().includes('chest') ||
        s.chief_complaint?.includes('सीने') ||
        s.location === 'सीने में' || s.location === 'Chest') &&
      s.sweating === true &&
      s.dizziness === true,
  },

  // ─── Fever Red Flags ────────────────────────────────────────────────────
  {
    id: 'high_fever_critical',
    name: 'High Grade Fever (103°F+)',
    description_hi: 'अत्यधिक तेज़ बुखार (103°F या अधिक) — तुरंत तापमान नियंत्रण व जांच आवश्यक',
    description_en: 'High grade fever (103°F or above) — immediate evaluation & cooling required',
    severity: 'HIGH',
    check: (s) => {
      const isFever = Boolean(
        s.chief_complaint?.toLowerCase().includes('fever') ||
        s.chief_complaint?.includes('बुखार') ||
        (s.associated_symptoms && s.associated_symptoms.some(sym => sym.toLowerCase().includes('fever') || sym.includes('बुखार')))
      );
      const isHighTemp = Boolean(
        (s.severity !== null && s.severity >= 8) ||
        s.onset?.includes('104') ||
        s.onset?.includes('103')
      );
      return isFever && isHighTemp;
    },
  },
  {
    id: 'fever_with_breathlessness_rash',
    name: 'Fever + Breathlessness / Rash',
    description_hi: 'बुखार के साथ सांस की तकलीफ या शरीर पर दाने/चकत्ते (गंभीर संक्रमण/निमोनिया का संदेह)',
    description_en: 'Fever with breathlessness or skin rash (warning sign of severe systemic infection/pneumonia)',
    severity: 'HIGH',
    check: (s) => {
      const isFever = Boolean(
        s.chief_complaint?.toLowerCase().includes('fever') ||
        s.chief_complaint?.includes('बुखार')
      );
      const hasSevereSymptom = Boolean(
        s.breathlessness === true ||
        (s.associated_symptoms && s.associated_symptoms.some(sym =>
          sym.includes('सांस') || sym.includes('चकत्ते') || sym.toLowerCase().includes('rash') || sym.toLowerCase().includes('breath')
        ))
      );
      return isFever && hasSevereSymptom;
    },
  },
  {
    id: 'prolonged_fever',
    name: 'Prolonged Fever (> 7 days)',
    description_hi: '7 दिन से अधिक पुराना बुखार (टाइफाइड / टीबी / मलेरिया की विस्तृत जांच आवश्यक)',
    description_en: 'Prolonged fever lasting over 7 days (requires diagnostic workup)',
    severity: 'MEDIUM',
    check: (s) => {
      const isFever = Boolean(s.chief_complaint?.toLowerCase().includes('fever') || s.chief_complaint?.includes('बुखार'));
      const isProlonged = Boolean(
        s.onset?.toLowerCase().includes('week') ||
        s.onset?.includes('हफ्ते') ||
        s.onset?.includes('7 दिन') ||
        s.onset?.includes('बहुत समय')
      );
      return isFever && isProlonged;
    },
  },

  // ─── Abdominal Red Flags ────────────────────────────────────────────────
  {
    id: 'severe_acute_abdomen',
    name: 'Acute Severe Abdominal Pain',
    description_hi: 'तीव्र असहनीय पेट दर्द (एक्यूट एब्डोमेन / अपेंडिक्स / छिद्र का संदेह)',
    description_en: 'Acute severe abdominal pain (suspected acute abdomen / appendicitis / perforation)',
    severity: 'HIGH',
    check: (s) => {
      const isAbdomen = Boolean(
        s.chief_complaint?.toLowerCase().includes('stomach') ||
        s.chief_complaint?.toLowerCase().includes('abdomen') ||
        s.chief_complaint?.includes('पेट') ||
        s.location?.includes('पेट') ||
        s.location?.toLowerCase().includes('abdomen')
      );
      return isAbdomen && (s.severity !== null && s.severity >= 7);
    },
  },

  // ─── Neurological / Headache Red Flags ──────────────────────────────────
  {
    id: 'severe_headache_redflag',
    name: 'Severe Sudden / Thunderclap Headache',
    description_hi: 'अचानक बहुत तेज़ सिरदर्द / गर्दन अकड़न (मस्तिष्क रक्तस्राव / मेनिन्जाइटिस का खतरा)',
    description_en: 'Severe sudden headache or neck stiffness (risk of intracranial hemorrhage / meningitis)',
    severity: 'HIGH',
    check: (s) => {
      const isHeadache = Boolean(
        s.chief_complaint?.toLowerCase().includes('headache') ||
        s.chief_complaint?.includes('सिर')
      );
      const hasStiffNeckOrVomit = Boolean(
        s.nausea === true ||
        (s.associated_symptoms && s.associated_symptoms.some(sym => sym.includes('गर्दन') || sym.includes('उल्टी')))
      );
      const isSevere = (s.severity !== null && s.severity >= 8) || (hasStiffNeckOrVomit && (s.severity ?? 0) >= 6);
      return isHeadache && isSevere;
    },
  },

  // ─── Respiratory Red Flags ──────────────────────────────────────────────
  {
    id: 'severe_respiratory_distress',
    name: 'Severe Respiratory Distress',
    description_hi: 'तीव्र सांस की तकलीफ (आराम करने या बात करने पर भी सांस फूलना)',
    description_en: 'Severe respiratory distress (breathlessness even at rest or talking)',
    severity: 'HIGH',
    check: (s) => s.breathlessness === true && ((s.severity !== null && s.severity >= 7) || s.dizziness === true),
  },
  {
    id: 'breathlessness_alone',
    name: 'Acute Breathlessness',
    description_hi: 'सांस लेने में तकलीफ',
    description_en: 'Acute breathlessness without identified cause',
    severity: 'MEDIUM',
    check: (s) => s.breathlessness === true && !(s.chief_complaint?.toLowerCase().includes('chest') ?? false),
  },

  // ─── Generalized Severe Pain ────────────────────────────────────────────
  {
    id: 'severe_pain',
    name: 'Severe Pain (8+/10)',
    description_hi: 'गंभीर असहनीय दर्द (8/10 या अधिक)',
    description_en: 'Severe pain score (8/10 or above)',
    severity: 'HIGH',
    check: (s) => s.severity !== null && s.severity >= 8,
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
