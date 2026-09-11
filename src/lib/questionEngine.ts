// src/lib/questionEngine.ts
// Disease-Specific Clinical Question Engine & Dynamic Severity Scaler
// Tailors questions to the patient's specific disease and scales severity automatically.

import { ClinicalState } from './store';

export type DiseaseCategory =
  | 'FEVER'
  | 'CHEST_PAIN'
  | 'STOMACH_PAIN'
  | 'HEADACHE'
  | 'RESPIRATORY'
  | 'GI_INFECTION'
  | 'BODY_ACHE'
  | 'GENERAL';

export type SeverityLevel = 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export interface DynamicQuestion {
  question: string;
  options: string[];
  field: string;
  is_complete: boolean;
  disease_category?: DiseaseCategory;
}

/**
 * Detects the clinical disease category from the patient's complaint
 */
export function detectDiseaseCategory(complaint: string | null): DiseaseCategory {
  if (!complaint) return 'GENERAL';
  const c = complaint.toLowerCase();

  // 1. Fever / Pyrexia
  if (
    c.includes('बुखार') ||
    c.includes('fever') ||
    c.includes('pyrexia') ||
    c.includes('तापमान') ||
    c.includes('गर्म') ||
    c.includes('temperature') ||
    c.includes('कंपकंपी') ||
    c.includes('chills')
  ) {
    return 'FEVER';
  }

  // 2. Chest Pain / Cardiac
  if (
    c.includes('सीने') ||
    c.includes('छाती') ||
    c.includes('chest') ||
    c.includes('heart') ||
    c.includes('दिल') ||
    c.includes('cardiac') ||
    c.includes('angina')
  ) {
    return 'CHEST_PAIN';
  }

  // 3. Stomach / Abdominal Pain
  if (
    c.includes('पेट') ||
    c.includes('stomach') ||
    c.includes('abdomen') ||
    c.includes('belly') ||
    c.includes('acidity') ||
    c.includes('मरोड़') ||
    c.includes('कब्ज') ||
    c.includes('gastric')
  ) {
    return 'STOMACH_PAIN';
  }

  // 4. Headache / Neurological
  if (
    c.includes('सिरदर्द') ||
    c.includes('सिर') ||
    c.includes('headache') ||
    c.includes('head') ||
    c.includes('migraine')
  ) {
    return 'HEADACHE';
  }

  // 5. Respiratory / Cough & Breathlessness
  if (
    c.includes('खांसी') ||
    c.includes('सांस') ||
    c.includes('cough') ||
    c.includes('breath') ||
    c.includes('asthma') ||
    c.includes('दमा') ||
    c.includes('कफ') ||
    c.includes('balgam') ||
    c.includes('wheez')
  ) {
    return 'RESPIRATORY';
  }

  // 6. GI Infection / Vomiting & Diarrhea
  if (
    c.includes('उल्टी') ||
    c.includes('दस्त') ||
    c.includes('vomit') ||
    c.includes('diarrhea') ||
    c.includes('loose') ||
    c.includes('dast')
  ) {
    return 'GI_INFECTION';
  }

  // 7. Body / Joint Pain
  if (
    c.includes('जोड़ों') ||
    c.includes('बदन') ||
    c.includes('joint') ||
    c.includes('body ache') ||
    c.includes('arthritis') ||
    c.includes('गठिया') ||
    c.includes('दर्द')
  ) {
    return 'BODY_ACHE';
  }

  return 'GENERAL';
}

/**
 * Automatically computes scaled severity score (1-10) and level from answer text and field
 */
export function calculateScaledSeverity(answer: string, field: string, currentSeverity: number | null): {
  score: number;
  level: SeverityLevel;
} {
  const text = (answer || '').toLowerCase();

  // Critical cues (Score: 9-10)
  if (
    text.includes('104') ||
    text.includes('105') ||
    text.includes('9-10') ||
    text.includes('10/10') ||
    text.includes('9/10') ||
    text.includes('अत्यधिक तेज़') ||
    text.includes('अत्यंत गंभीर') ||
    text.includes('असहनीय तीव्र') ||
    text.includes('अत्यंत भयंकर') ||
    text.includes('critical') ||
    text.includes('खून') ||
    text.includes('blood') ||
    text.includes('आराम करने पर भी') ||
    text.includes('बेहोशी')
  ) {
    return { score: 10, level: 'CRITICAL' };
  }

  // Severe cues (Score: 7-8)
  if (
    text.includes('103') ||
    text.includes('7-8') ||
    text.includes('8/10') ||
    text.includes('7/10') ||
    text.includes('तेज़ बुखार') ||
    text.includes('तेज़ असहनीय') ||
    text.includes('तेज़ दर्द') ||
    text.includes('गंभीर') ||
    text.includes('severe') ||
    text.includes('बहुत तेज़') ||
    text.includes('असहनीय')
  ) {
    return { score: 8, level: 'SEVERE' };
  }

  // Moderate cues (Score: 4-6)
  if (
    text.includes('101') ||
    text.includes('102') ||
    text.includes('4-6') ||
    text.includes('5/10') ||
    text.includes('4/10') ||
    text.includes('6/10') ||
    text.includes('मध्यम') ||
    text.includes('सहन करने योग्य') ||
    text.includes('moderate') ||
    text.includes('चढ़-उतर')
  ) {
    return { score: 5, level: 'MODERATE' };
  }

  // Mild cues (Score: 1-3)
  if (
    text.includes('99') ||
    text.includes('100') ||
    text.includes('1-3') ||
    text.includes('2/10') ||
    text.includes('1/10') ||
    text.includes('3/10') ||
    text.includes('हल्का') ||
    text.includes('कम') ||
    text.includes('mild') ||
    text.includes('साधारण')
  ) {
    return { score: 2, level: 'MILD' };
  }

  // Parse pure numbers if present
  const numMatch = text.match(/\b([1-9]|10)\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 8) return { score: n, level: n >= 9 ? 'CRITICAL' : 'SEVERE' };
    if (n >= 4) return { score: n, level: 'MODERATE' };
    return { score: n, level: 'MILD' };
  }

  // Fallback to existing severity or default
  const prev = currentSeverity ?? 3;
  if (prev >= 8) return { score: prev, level: prev >= 9 ? 'CRITICAL' : 'SEVERE' };
  if (prev >= 4) return { score: prev, level: 'MODERATE' };
  return { score: prev, level: 'MILD' };
}

interface DiseaseQuestionDef {
  field: string;
  isAnswered: (state: ClinicalState) => boolean;
  questionHi: string;
  questionEn: string;
  optionsHi: string[];
  optionsEn: string[];
}

const DISEASE_PATHWAYS: Record<DiseaseCategory, DiseaseQuestionDef[]> = {
  // ─── 1. FEVER (बुखार) — 4 questions max ─────────────────────────────────────
  FEVER: [
    {
      field: 'onset',
      isAnswered: (s) => Boolean(s.onset && String(s.onset).trim()),
      questionHi: 'बुखार कितने समय से है और कैसा रहता है — लगातार या कभी-कभी उतरता है?',
      questionEn: 'Since when do you have this fever, and is it continuous or does it come and go?',
      optionsHi: ['आज से शुरू हुआ', '2-3 दिन से लगातार', '4-7 दिन से चढ़-उतर रहा', '1 हफ्ते से अधिक समय से'],
      optionsEn: ['Started today', 'Continuous for 2-3 days', 'Coming and going for 4-7 days', 'More than a week'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'बुखार की गंभीरता (Severity) कितनी है? तापमान कितना महसूस होता है?',
      questionEn: 'What is the severity of your fever? How high does the temperature feel?',
      optionsHi: ['हल्का बुखार (99-100°F)', 'मध्यम बुखार (101-102°F)', 'तेज़ बुखार (103°F)', 'अत्यधिक तेज़ बुखार (104°F+)'],
      optionsEn: ['Mild fever (99-100°F)', 'Moderate fever (101-102°F)', 'High fever (103°F)', 'Very high fever (104°F+)'],
    },
    {
      field: 'associated_symptoms',
      isAnswered: (s) => Boolean(
        (Array.isArray(s.associated_symptoms) && s.associated_symptoms.length > 0) ||
        (typeof s.associated_symptoms === 'string' && (s.associated_symptoms as string).trim())
      ),
      questionHi: 'क्या बुखार के साथ ठंड, कंपकंपी (chills) या बदन दर्द है?',
      questionEn: 'Do you experience severe chills, shivering, or body ache with the fever?',
      optionsHi: ['हाँ, तेज़ ठंड और कंपकंपी', 'हाँ, जोड़ों व बदन में तेज़ दर्द', 'हाँ, पसीना आकर बुखार उतरता है', 'नहीं, केवल बुखार है'],
      optionsEn: ['Yes, severe chills & shivering', 'Yes, intense body & joint ache', 'Yes, fever breaks with sweating', 'No, fever only'],
    },
    {
      field: 'breathlessness',
      isAnswered: (s) => s.breathlessness !== null && s.breathlessness !== undefined,
      questionHi: 'क्या बुखार के साथ सांस फूलना, खांसी, उल्टी या शरीर पर कोई चकत्ते (rash) हैं?',
      questionEn: 'Do you have difficulty breathing, cough, vomiting, or skin rashes with the fever?',
      optionsHi: ['हाँ, सांस फूलने की तकलीफ है', 'हाँ, सूखी खांसी और गले में दर्द', 'हाँ, शरीर पर लाल दाने/चकत्ते', 'नहीं, इनमें से कोई नहीं'],
      optionsEn: ['Yes, difficulty breathing', 'Yes, dry cough & sore throat', 'Yes, skin rashes/spots', 'No, none of these'],
    },
  ],

  // ─── 2. CHEST PAIN (सीने में दर्द) — 4 questions max ─────────────────────────
  CHEST_PAIN: [
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'दर्द सीने में किस जगह है और कैसा महसूस हो रहा है?',
      questionEn: 'Where in the chest is the pain and what does it feel like?',
      optionsHi: ['सीने के बीच में भारी दबाव / जकड़न', 'बाईं तरफ जलन या चुभन', 'गैस या एसिडिटी जैसा दर्द', 'सांस लेने पर तीखा दर्द'],
      optionsEn: ['Heavy pressure / squeezing in center', 'Left side burning or stabbing', 'Gas or acidity-like pain', 'Sharp pain on breathing'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: '1 से 10 के पैमाने पर सीने के दर्द की तीव्रता (Severity) कितनी है?',
      questionEn: 'On a scale of 1 to 10, how severe is your chest pain?',
      optionsHi: ['हल्का खिंचाव (1-3)', 'मध्यम दबाव (4-6)', 'तेज़ असहनीय दर्द (7-8)', 'अत्यंत गंभीर/भयंकर दर्द (9-10)'],
      optionsEn: ['Mild discomfort (1-3)', 'Moderate pressure (4-6)', 'Severe unbearable pain (7-8)', 'Extreme crushing pain (9-10)'],
    },
    {
      field: 'radiation',
      isAnswered: (s) => Boolean(s.radiation && String(s.radiation).trim()),
      questionHi: 'क्या यह दर्द बाएं हाथ, कंधे, जबड़े या पीठ की तरफ फैलता है?',
      questionEn: 'Does this pain radiate to your left arm, shoulder, jaw, or back?',
      optionsHi: ['हाँ, बाएं हाथ और कंधे में', 'हाँ, जबड़े व गर्दन में', 'हाँ, पीछे पीठ की तरफ', 'नहीं, सिर्फ सीने में रहता है'],
      optionsEn: ['Yes, to left arm and shoulder', 'Yes, to jaw and neck', 'Yes, towards the back', 'No, only in the chest'],
    },
    {
      field: 'sweating',
      isAnswered: (s) => s.sweating !== null && s.sweating !== undefined,
      questionHi: 'क्या दर्द के साथ ठंडा पसीना, सांस फूलना, चक्कर या चलने पर दर्द बढ़ता है?',
      questionEn: 'Do you have cold sweating, breathlessness, dizziness, or worsening pain on walking?',
      optionsHi: ['हाँ, सांस फूलना और ठंडा पसीना', 'हाँ, चलने-फिरने से दर्द बढ़ता है', 'हाँ, तेज़ चक्कर व घबराहट', 'नहीं, ऐसा कुछ नहीं है'],
      optionsEn: ['Yes, breathlessness & cold sweat', 'Yes, pain worsens on exertion', 'Yes, severe dizziness/panic', 'No, none of these'],
    },
  ],

  // ─── 3. STOMACH PAIN (पेट में दर्द) — 4 questions max ───────────────────────
  STOMACH_PAIN: [
    {
      field: 'location',
      isAnswered: (s) => Boolean(s.location && String(s.location).trim()),
      questionHi: 'पेट में दर्द किस जगह सबसे अधिक है?',
      questionEn: 'Where in the abdomen is the pain most severe?',
      optionsHi: ['पेट के ऊपरी हिस्से में (छाती के नीचे)', 'नाभि के आसपास (बीच में)', 'पेट के निचले हिस्से में', 'दाहिनी तरफ नीचे (Right lower)'],
      optionsEn: ['Upper abdomen (epigastric)', 'Around the navel (central)', 'Lower abdomen', 'Right lower abdomen'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'पेट दर्द की गंभीरता (Severity) कितनी है?',
      questionEn: 'How severe is the abdominal pain on a scale of 1 to 10?',
      optionsHi: ['हल्का मरोड़ (1-3)', 'मध्यम ऐंठन (4-6)', 'तेज़ असहनीय दर्द (7-8)', 'अत्यंत गंभीर/असह्य दर्द (9-10)'],
      optionsEn: ['Mild cramp (1-3)', 'Moderate colic (4-6)', 'Severe stabbing pain (7-8)', 'Extreme unbearable pain (9-10)'],
    },
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'पेट दर्द कैसा महसूस होता है?',
      questionEn: 'What type of abdominal pain is it?',
      optionsHi: ['मरोड़ या ऐंठन जैसा', 'लगातार तेज़ जलन व एसिडिटी', 'चुभन और भारीपन', 'पेट फूला हुआ और गैस जैसा'],
      optionsEn: ['Cramping or colicky', 'Constant burning & acidity', 'Sharp stabbing & fullness', 'Bloated and gassy'],
    },
    {
      field: 'nausea',
      isAnswered: (s) => s.nausea !== null && s.nausea !== undefined,
      questionHi: 'क्या उल्टी, पतले दस्त, पेट छूने पर असहनीय दर्द या खून आने की समस्या है?',
      questionEn: 'Do you have vomiting, loose motions, extreme tenderness on touch, or any blood?',
      optionsHi: ['हाँ, बार-बार उल्टी व दस्त', 'हाँ, पेट छूने पर बहुत तेज़ दर्द', 'हाँ, पानी भी नहीं पच रहा', 'नहीं, ऐसी कोई समस्या नहीं'],
      optionsEn: ['Yes, frequent vomiting & diarrhea', 'Yes, severe pain on touching abdomen', 'Yes, unable to keep liquids down', 'No, none of these'],
    },
  ],

  // ─── 4. HEADACHE (सिरदर्द) — 4 questions max ──────────────────────────────
  HEADACHE: [
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'सिरदर्द किस हिस्से में है और कैसा महसूस होता है?',
      questionEn: 'Where is the headache and what does it feel like?',
      optionsHi: ['पूरे सिर में भारीपन और खिंचाव', 'आधे सिर में धड़कन जैसा (एक तरफ)', 'माथे और आंखों के पीछे', 'गर्दन के पीछे से ऊपर की ओर'],
      optionsEn: ['Heavy tension all over head', 'Throbbing on one side (migraine)', 'Forehead and behind eyes', 'Back of neck radiating up'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'सिरदर्द की गंभीरता (Severity) कितनी है? क्या यह अचानक बहुत तेज़ हुआ?',
      questionEn: 'How severe is the headache? Did it start abruptly like a thunderclap?',
      optionsHi: ['हल्का सिरदर्द (1-3)', 'मध्यम सिरदर्द (4-6)', 'तेज़ धड़कन जैसा (7-8)', 'अचानक बिजली जैसा तीव्र (9-10)'],
      optionsEn: ['Mild headache (1-3)', 'Moderate pain (4-6)', 'Severe throbbing (7-8)', 'Sudden worst headache of life (9-10)'],
    },
    {
      field: 'dizziness',
      isAnswered: (s) => s.dizziness !== null && s.dizziness !== undefined,
      questionHi: 'क्या उल्टी, चक्कर, धुंधला दिखना या रोशनी/आवाज़ से परेशानी है?',
      questionEn: 'Do you have nausea, dizziness, blurred vision, or sensitivity to light/sound?',
      optionsHi: ['हाँ, उल्टी और जी मिचलाना', 'हाँ, रोशनी व आवाज़ से दर्द बढ़ता है', 'हाँ, चक्कर और आंखों में अंधेरा', 'नहीं, ऐसा कुछ नहीं'],
      optionsEn: ['Yes, nausea and vomiting', 'Yes, light and sound sensitivity', 'Yes, dizziness and vision issues', 'No, none of these'],
    },
    {
      field: 'associated_symptoms',
      isAnswered: (s) => Boolean(
        (Array.isArray(s.associated_symptoms) && s.associated_symptoms.length > 0) ||
        (typeof s.associated_symptoms === 'string' && (s.associated_symptoms as string).trim())
      ),
      questionHi: 'क्या गर्दन में अकड़न, तेज़ बुखार या बोलने/चलने में कोई कमज़ोरी है?',
      questionEn: 'Do you have neck stiffness, high fever, or weakness in limbs/speech?',
      optionsHi: ['हाँ, गर्दन में अकड़न और बुखार', 'हाँ, हाथ या पैर में कमज़ोरी/सुन्नपन', 'हाँ, बोलने में लड़खड़ाहट', 'नहीं, सामान्य सिरदर्द है'],
      optionsEn: ['Yes, neck stiffness with fever', 'Yes, limb weakness or numbness', 'Yes, speech difficulty', 'No, typical headache'],
    },
  ],

  // ─── 5. RESPIRATORY (खांसी व सांस फूलना) — 4 questions max ─────────────────
  RESPIRATORY: [
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'खांसी किस तरह की है और बलगम आता है या नहीं?',
      questionEn: 'What type of cough do you have and is there any phlegm/sputum?',
      optionsHi: ['सूखी खांसी (बिना कफ)', 'गाढ़ा पीला/हरा बलगम आता है', 'रात या सुबह में ज़्यादा खांसी', 'सीने में जकड़न व सीटी जैसी आवाज़'],
      optionsEn: ['Dry cough without phlegm', 'Thick yellow/green sputum', 'Worse at night or morning', 'Chest tightness with wheezing'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'सांस की तकलीफ की गंभीरता (Severity) कितनी है?',
      questionEn: 'How severe is your difficulty in breathing?',
      optionsHi: ['हल्की (तेज़ चलने या सीढ़ी पर)', 'मध्यम (सामान्य रोज़मर्रा काम पर)', 'गंभीर (बात करने या बैठने पर भी)', 'अत्यंत गंभीर (आराम करने या लेटने पर भी)'],
      optionsEn: ['Mild (only on running/stairs)', 'Moderate (on normal walking)', 'Severe (while talking or sitting)', 'Extreme (even at complete rest/lying)'],
    },
    {
      field: 'breathlessness',
      isAnswered: (s) => s.breathlessness !== null && s.breathlessness !== undefined,
      questionHi: 'क्या सांस लेते समय सीने से सीटी या घरघराहट (wheezing) की आवाज़ आती है?',
      questionEn: 'Do you hear wheezing or whistling sounds in your chest while breathing?',
      optionsHi: ['हाँ, सीने में घरघराहट और जकड़न', 'हाँ, सांस लेने पर सीने में दर्द', 'हाँ, लगातार खांसी का दौरा', 'नहीं, सामान्य सांस है'],
      optionsEn: ['Yes, wheezing & chest tightness', 'Yes, chest pain on deep breath', 'Yes, continuous coughing fits', 'No, normal breathing'],
    },
    {
      field: 'associated_symptoms',
      isAnswered: (s) => Boolean(
        (Array.isArray(s.associated_symptoms) && s.associated_symptoms.length > 0) ||
        (typeof s.associated_symptoms === 'string' && (s.associated_symptoms as string).trim())
      ),
      questionHi: 'क्या बलगम में खून आया है या ऑक्सीजन की बहुत कमी महसूस हो रही है?',
      questionEn: 'Have you coughed up any blood or noticed bluish discoloration/low oxygen?',
      optionsHi: ['हाँ, बलगम में खून (hemoptysis)', 'हाँ, ऑक्सीजन बहुत कम महसूस हो रही', 'हाँ, तेज़ बुखार के साथ सांस फूलना', 'नहीं, ऐसी कोई समस्या नहीं'],
      optionsEn: ['Yes, blood in phlegm', 'Yes, feeling severe low oxygen', 'Yes, high fever with breathlessness', 'No, none of these'],
    },
  ],

  // ─── 6. GI INFECTION (उल्टी व दस्त) — 4 questions max ───────────────────────
  GI_INFECTION: [
    {
      field: 'onset',
      isAnswered: (s) => Boolean(s.onset && String(s.onset).trim()),
      questionHi: 'दस्त या उल्टी कब से शुरू हुई और आज कितनी बार हुई?',
      questionEn: 'When did vomiting or diarrhea start and how many times today?',
      optionsHi: ['आज सुबह से (3-4 बार)', 'कल से लगातार (5-8 बार)', '2-3 दिन से गंभीर (10+ बार)', 'सिर्फ एक-दो बार उल्टी हुई'],
      optionsEn: ['Since morning (3-4 times)', 'Since yesterday (5-8 times)', 'For 2-3 days (10+ times)', 'Only 1-2 times'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'कमज़ोरी या डिहाइड्रेशन की गंभीरता कितनी है? क्या चक्कर या मुंह सूख रहा है?',
      questionEn: 'How severe is weakness or dehydration? Do you have dizziness or dry mouth?',
      optionsHi: ['हल्की कमज़ोरी (1-3)', 'मध्यम प्यास व चक्कर (4-6)', 'तेज़ चक्कर व खड़े होने पर कमजोरी (7-8)', 'अत्यधिक गंभीर/बेहोशी जैसी स्थिति (9-10)'],
      optionsEn: ['Mild weakness (1-3)', 'Moderate thirst & dizziness (4-6)', 'Severe weakness on standing (7-8)', 'Extreme / fainting (9-10)'],
    },
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'दस्त कैसा है — पानी जैसा पतला या खून/मरोड़ के साथ?',
      questionEn: 'What is the stool like — watery or with blood/mucus?',
      optionsHi: ['पानी जैसा पतला दस्त', 'पेट में तेज़ मरोड़ के साथ', 'मल में खून या आंव (mucus)', 'सिर्फ उल्टी व जी मिचलाना'],
      optionsEn: ['Watery loose stools', 'With severe stomach cramps', 'Blood or mucus in stool', 'Vomiting and nausea only'],
    },
    {
      field: 'nausea',
      isAnswered: (s) => s.nausea !== null && s.nausea !== undefined,
      questionHi: 'क्या इसके साथ तेज़ बुखार, पेट में असहनीय दर्द या पानी न पचने की समस्या है?',
      questionEn: 'Do you have high fever, severe abdominal pain, or inability to retain fluids?',
      optionsHi: ['हाँ, तेज़ बुखार और कंपकंपी', 'हाँ, पेट में बहुत तेज़ दर्द', 'हाँ, पानी भी नहीं पच रहा', 'नहीं, बुखार नहीं है'],
      optionsEn: ['Yes, high fever & chills', 'Yes, severe stomach pain', 'Cannot retain even water', 'No, no fever'],
    },
  ],

  // ─── 7. BODY ACHE (जोड़ों व बदन दर्द) — 4 questions max ─────────────────────
  BODY_ACHE: [
    {
      field: 'location',
      isAnswered: (s) => Boolean(s.location && String(s.location).trim()),
      questionHi: 'दर्द मुख्य रूप से कहाँ है — जोड़ों में, पीठ में या पूरे शरीर में?',
      questionEn: 'Where is the pain mainly — in joints, back, or entire body?',
      optionsHi: ['घुटनों व जोड़ों में दर्द', 'कमर व पीठ में तेज़ दर्द', 'पूरे शरीर में बदन दर्द', 'गर्दन और कंधों में जकड़न'],
      optionsEn: ['Knees and joints', 'Back and lower spine', 'Entire body aches', 'Neck and shoulders stiffness'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'दर्द की गंभीरता (Severity) 1 से 10 के पैमाने पर कितनी है?',
      questionEn: 'What is the pain severity on a scale of 1 to 10?',
      optionsHi: ['हल्का दर्द (1-3)', 'मध्यम दर्द (4-6)', 'तेज़ दर्द (चलने में कष्ट) (7-8)', 'असहनीय भयंकर दर्द (9-10)'],
      optionsEn: ['Mild ache (1-3)', 'Moderate pain (4-6)', 'Severe pain affecting walking (7-8)', 'Extreme unbearable pain (9-10)'],
    },
    {
      field: 'character',
      isAnswered: (s) => Boolean(s.character && String(s.character).trim()),
      questionHi: 'क्या जोड़ों में सूजन, लालिमा या सुबह उठने पर अकड़न रहती है?',
      questionEn: 'Is there swelling, redness, or morning stiffness in the joints?',
      optionsHi: ['हाँ, सुबह उठने पर तेज़ अकड़न', 'हाँ, जोड़ों में सूजन और गर्माहट', 'हिलने-डुलने पर कट-कट की आवाज़', 'नहीं, केवल साधारण दर्द'],
      optionsEn: ['Yes, morning stiffness', 'Yes, joint swelling and warmth', 'Clicking sound on movement', 'No, normal ache only'],
    },
    {
      field: 'onset',
      isAnswered: (s) => Boolean(s.onset && String(s.onset).trim()),
      questionHi: 'यह दर्द कब से है और क्या किसी चोट या बुखार के बाद शुरू हुआ?',
      questionEn: 'How long has this pain been present, and did it follow an injury or fever?',
      optionsHi: ['हाल ही में बुखार के बाद', 'किसी चोट या खिंचाव के बाद', 'कई हफ्तों या महीनों से पुराना', 'अचानक बिना कारण शुरू हुआ'],
      optionsEn: ['Recently after fever', 'After an injury or strain', 'Old pain for weeks/months', 'Started suddenly without cause'],
    },
  ],

  // ─── 8. GENERAL (सामान्य) — 3 questions max ────────────────────────────────
  GENERAL: [
    {
      field: 'onset',
      isAnswered: (s) => Boolean(s.onset && String(s.onset).trim()),
      questionHi: 'यह तकलीफ कब से शुरू हुई?',
      questionEn: 'When did this problem start?',
      optionsHi: ['आज', 'कल', 'कुछ दिन पहले', '1 हफ्ते से अधिक'],
      optionsEn: ['Today', 'Yesterday', 'A few days ago', 'More than a week'],
    },
    {
      field: 'severity',
      isAnswered: (s) => s.severity !== null && s.severity !== undefined,
      questionHi: 'इस तकलीफ की गंभीरता (Severity) कितनी है?',
      questionEn: 'What is the severity of this problem on a scale of 1 to 10?',
      optionsHi: ['हल्की (1-3)', 'मध्यम (4-6)', 'तेज़ (7-8)', 'अत्यंत गंभीर (9-10)'],
      optionsEn: ['Mild (1-3)', 'Moderate (4-6)', 'Severe (7-8)', 'Critical (9-10)'],
    },
    {
      field: 'associated_symptoms',
      isAnswered: (s) => Boolean(
        (Array.isArray(s.associated_symptoms) && s.associated_symptoms.length > 0) ||
        (typeof s.associated_symptoms === 'string' && (s.associated_symptoms as string).trim())
      ),
      questionHi: 'क्या इसके साथ बुखार, कमज़ोरी या कोई अन्य लक्षण है?',
      questionEn: 'Do you have fever, weakness, or any other symptom along with this?',
      optionsHi: ['हाँ, बुखार और कमज़ोरी', 'हाँ, भूख न लगना और थकावट', 'हाँ, दर्द और बेचैनी', 'नहीं, कोई अन्य लक्षण नहीं'],
      optionsEn: ['Yes, fever & weakness', 'Yes, fatigue & poor appetite', 'Yes, pain & restlessness', 'No other symptoms'],
    },
  ],
};

/**
 * Returns disease-specific clinical questions that automatically scale their level of severity.
 * Once the specific 3 to 4 disease questions are answered, IMMEDIATELY returns is_complete: true.
 */
export function getDiseaseSpecificQuestion(
  state: ClinicalState,
  count: number,
  lang: 'hi' | 'en'
): DynamicQuestion {
  const isHi = lang === 'hi';

  // 1. Initial Question: If chief complaint is missing
  if (!state.chief_complaint) {
    return {
      question: isHi
        ? 'आज आपको क्या मुख्य समस्या या बीमारी है?'
        : 'What main health problem or illness brings you in today?',
      options: isHi
        ? [
            'बुखार (Fever)',
            'सीने में दर्द (Chest Pain)',
            'पेट में दर्द (Stomach Pain)',
            'सिरदर्द (Headache)',
            'खांसी / सांस फूलना (Cough/Breathing)',
            'उल्टी व दस्त (Vomiting/Diarrhea)',
          ]
        : [
            'Fever',
            'Chest Pain',
            'Stomach Pain',
            'Headache',
            'Cough / Breathlessness',
            'Vomiting / Diarrhea',
          ],
      field: 'chief_complaint',
      is_complete: false,
      disease_category: 'GENERAL',
    };
  }

  const category = detectDiseaseCategory(state.chief_complaint);
  const pathway = DISEASE_PATHWAYS[category] || DISEASE_PATHWAYS.GENERAL;

  // Find first unanswered question in this disease pathway
  const nextDef = pathway.find((def) => !def.isAnswered(state));

  // If all disease questions are answered, OR if count reaches the disease pathway length:
  // Immediately complete! (No need to ask all 12 points!)
  if (!nextDef || count >= pathway.length + 1) {
    return {
      question: isHi
        ? 'बीमारी से संबंधित सभी आवश्यक जानकारी दर्ज हो गई है। आपकी संपूर्ण रिपोर्ट तैयार की जा रही है।'
        : 'All necessary information for your illness has been recorded. Generating your complete report.',
      options: [],
      field: 'completed',
      is_complete: true,
      disease_category: category,
    };
  }

  return {
    question: isHi ? nextDef.questionHi : nextDef.questionEn,
    options: isHi ? nextDef.optionsHi : nextDef.optionsEn,
    field: nextDef.field,
    is_complete: false,
    disease_category: category,
  };
}
