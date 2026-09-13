// src/lib/translations.ts
// Hindi and English strings for all UI text

export type Language = 'hi' | 'en';

export interface Translations {
  // Landing
  landing_title: string;
  landing_subtitle: string;
  landing_start: string;
  landing_powered_by: string;

  // Language selection
  lang_select_title: string;
  lang_select_subtitle: string;
  lang_hindi: string;
  lang_english: string;
  lang_continue: string;

  // Accessibility
  a11y_increase_font: string;
  a11y_decrease_font: string;
  a11y_help: string;
  a11y_language: string;
  a11y_read_aloud: string;

  // Chief Complaint quick-tap options
  chief_fever: string;
  chief_cough: string;
  chief_stomach: string;
  chief_headache: string;
  chief_bodyache: string;
  chief_vomiting: string;
  chief_weakness: string;
  chief_chest_pain: string;
  chief_prompt: string;
  chief_quick_tap: string;

  // Patient summary reassurance
  patient_summary_confirm: string;
  patient_summary_sub: string;
  patient_summary_token: string;
  patient_summary_next_step: string;

  // Auth
  auth_title: string;
  auth_subtitle: string;
  auth_abha_label: string;
  auth_abha_placeholder: string;
  auth_name_label: string;
  auth_name_placeholder: string;
  auth_age_label: string;
  auth_age_placeholder: string;
  auth_gender_label: string;
  auth_gender_male: string;
  auth_gender_female: string;
  auth_gender_other: string;
  auth_continue: string;
  auth_demo_note: string;
  auth_demo_fill: string;

  // Consent
  consent_title: string;
  consent_body: string;
  consent_accept: string;
  consent_decline: string;
  consent_point1: string;
  consent_point2: string;
  consent_point3: string;

  // Consultation selection
  consult_title: string;
  consult_subtitle: string;
  consult_general_title: string;
  consult_general_desc: string;
  consult_general_btn: string;
  consult_ayush_title: string;
  consult_ayush_desc: string;
  consult_ayush_coming_soon: string;
  consult_ayush_modal_title: string;
  consult_ayush_modal_body: string;
  consult_ayush_modal_close: string;

  // Case taking
  case_title: string;
  case_speak: string;
  case_tap: string;
  case_type_placeholder: string;
  case_send: string;
  case_next: string;
  case_listening: string;
  case_processing: string;
  case_mic_hint: string;
  case_or: string;
  case_skip: string;
  case_progress: string;
  case_thinking: string;
  case_speaking: string;
  case_tap_to_speak: string;
  case_tap_to_stop: string;
  case_greeting: string;
  case_type_instead: string;

  // Red flag
  redflag_title: string;
  redflag_body: string;
  redflag_urgency: string;

  // Upload
  upload_title: string;
  upload_subtitle: string;
  upload_btn: string;
  upload_camera: string;
  upload_skip: string;
  upload_processing: string;
  upload_success: string;
  upload_error: string;
  upload_verify: string;

  // Timeline
  timeline_title: string;

  // Summary
  summary_title: string;
  summary_chief: string;
  summary_history: string;
  summary_medications: string;
  summary_labs: string;
  summary_red_flags: string;
  summary_ai_note: string;

  // Doctor
  doctor_title: string;
  doctor_accept: string;
  doctor_edit: string;
  doctor_reject: string;
  doctor_view_responses: string;
  doctor_view_document: string;

  // Common
  back: string;
  continue: string;
  submit: string;
  cancel: string;
  close: string;
  yes: string;
  no: string;
  error_generic: string;
  loading: string;
}

const hi: Translations = {
  landing_title: 'मेडकेस',
  landing_subtitle: 'AI-संचालित रोगी इतिहास प्रणाली',
  landing_start: 'शुरू करें',
  landing_powered_by: 'मिनिस्ट्री ऑफ आयुष | SIH26047',

  lang_select_title: 'भाषा चुनें',
  lang_select_subtitle: 'कृपया अपनी पसंदीदा भाषा चुनें',
  lang_hindi: 'हिंदी',
  lang_english: 'English',
  lang_continue: 'आगे बढ़ें',

  a11y_increase_font: 'A+',
  a11y_decrease_font: 'A-',
  a11y_help: 'सहायता',
  a11y_language: 'भाषा',
  a11y_read_aloud: 'सुनें',

  chief_fever: 'बुखार',
  chief_cough: 'खांसी और जुकाम',
  chief_stomach: 'पेट दर्द',
  chief_headache: 'सिर दर्द',
  chief_bodyache: 'बदन दर्द / थकान',
  chief_vomiting: 'उल्टी / दस्त',
  chief_weakness: 'चक्कर / कमजोरी',
  chief_chest_pain: 'सीने में दर्द या भारीपन',
  chief_prompt: 'नमस्ते! आज आपको क्या तकलीफ या परेशानी है?',
  chief_quick_tap: 'या नीचे दिए गए लक्षणों में से चुनें:',

  patient_summary_confirm: 'आपका विवरण सुरक्षित रूप से दर्ज कर लिया गया है',
  patient_summary_sub: 'यह सारांश आपके डॉक्टर के पास भेज दिया गया है।',
  patient_summary_token: 'आपका टोकन नंबर',
  patient_summary_next_step: 'कृपया प्रतीक्षा क्षेत्र में बैठें। आपका नाम बुलाए जाने पर डॉक्टर कक्ष में जाएं।',

  auth_title: 'पहचान सत्यापन',
  auth_subtitle: 'अपनी ABHA आईडी दर्ज करें या नया प्रोफाइल बनाएं',
  auth_abha_label: 'ABHA ID / मरीज़ ID',
  auth_abha_placeholder: 'ABHA नंबर दर्ज करें',
  auth_name_label: 'पूरा नाम',
  auth_name_placeholder: 'आपका नाम',
  auth_age_label: 'उम्र',
  auth_age_placeholder: 'जैसे: 45',
  auth_gender_label: 'लिंग',
  auth_gender_male: 'पुरुष',
  auth_gender_female: 'महिला',
  auth_gender_other: 'अन्य',
  auth_continue: 'आगे बढ़ें',
  auth_demo_note: 'डेमो मोड',
  auth_demo_fill: 'डेमो डेटा भरें',

  consent_title: 'सहमति',
  consent_body: 'हम आपके उत्तर और चिकित्सा दस्तावेज एकत्र करेंगे ताकि डॉक्टर के लिए आपका इतिहास तैयार किया जा सके।',
  consent_accept: 'मैं सहमत हूँ',
  consent_decline: 'अस्वीकार',
  consent_point1: 'इस परामर्श के लिए आपके उत्तर दर्ज किए जाएंगे',
  consent_point2: 'आपके अपलोड किए गए चिकित्सा दस्तावेज़ पढ़े जा सकते हैं',
  consent_point3: 'एक डॉक्टर आपके तैयार इतिहास की समीक्षा करेंगे',

  consult_title: 'परामर्श चुनें',
  consult_subtitle: 'आप किस प्रकार का परामर्श चाहते हैं?',
  consult_general_title: 'सामान्य चिकित्सा परामर्श',
  consult_general_desc: 'डॉक्टर के परामर्श के लिए स्वास्थ्य इतिहास तैयार करें',
  consult_general_btn: 'शुरू करें',
  consult_ayush_title: 'आयुष मूल्यांकन',
  consult_ayush_desc: 'आयुष-विशिष्ट मूल्यांकन और इतिहास लेना',
  consult_ayush_coming_soon: 'जल्द आ रहा है',
  consult_ayush_modal_title: 'आयुष मूल्यांकन — जल्द आ रहा है',
  consult_ayush_modal_body: 'आयुष मॉड्यूल विकास में है। इसमें दशविध परीक्षा, प्रकृति/विकृति आकलन और आयुष-विशिष्ट प्रश्नावली शामिल होगी।',
  consult_ayush_modal_close: 'बंद करें',

  case_title: 'स्वास्थ्य इतिहास',
  case_speak: 'बोलें',
  case_tap: 'विकल्प चुनें',
  case_type_placeholder: 'यहाँ टाइप करें...',
  case_send: 'भेजें',
  case_next: 'अगला',
  case_listening: 'सुन रहा हूँ...',
  case_processing: 'समझ रहा हूँ...',
  case_mic_hint: 'बोलने के लिए दबाएँ',
  case_or: 'या',
  case_skip: 'छोड़ें',
  case_progress: 'प्रश्न {{current}} / {{total}}',
  case_thinking: 'समझ रहा हूँ...',
  case_speaking: 'बोल रहा हूँ...',
  case_tap_to_speak: 'बोलने के लिए दबाएं',
  case_tap_to_stop: 'रोकने के लिए दबाएं',
  case_greeting: 'नमस्ते! डॉक्टर के लिए इतिहास तैयार करने में हम आपकी मदद करेंगे। बताइए, आज आपको क्या तकलीफ है?',
  case_type_instead: 'टाइप करें',

  redflag_title: 'प्राथमिकता चिकित्सा ध्यान आवश्यक',
  redflag_body: 'आपके लक्षण तत्काल चिकित्सा मूल्यांकन की आवश्यकता हो सकती है।',
  redflag_urgency: 'कृपया सीधे सहायता डेस्क या आपातकालीन कक्ष में संपर्क करें।',

  upload_title: 'पुरानी दवाएं या रिपोर्ट दिखाएं',
  upload_subtitle: 'वैकल्पिक — स्कैन करें या फ़ोटो/PDF चुनें',
  upload_btn: 'दस्तावेज़ चुनें',
  upload_camera: 'कैमरा से स्कैन करें',
  upload_skip: 'छोड़ें',
  upload_processing: 'दस्तावेज़ पढ़ा जा रहा है…',
  upload_success: 'दस्तावेज़ पढ़ लिया गया',
  upload_error: 'दस्तावेज़ पढ़ने में समस्या। कृपया दूसरी छवि अपलोड करें।',
  upload_verify: 'सत्यापन आवश्यक',

  timeline_title: 'चिकित्सा इतिहास टाइमलाइन',

  summary_title: 'रोगी इतिहास सारांश',
  summary_chief: 'मुख्य शिकायत',
  summary_history: 'इतिहास',
  summary_medications: 'दवाएं',
  summary_labs: 'जांच परिणाम',
  summary_red_flags: 'लाल झंडे',
  summary_ai_note: 'यह AI-जनित सारांश है। डॉक्टर द्वारा समीक्षा आवश्यक है।',

  doctor_title: 'डॉक्टर डैशबोर्ड',
  doctor_accept: 'स्वीकार करें',
  doctor_edit: 'संपादित करें',
  doctor_reject: 'अस्वीकार करें',
  doctor_view_responses: 'मरीज़ के उत्तर देखें',
  doctor_view_document: 'मूल दस्तावेज़ देखें',

  back: 'वापस',
  continue: 'जारी रखें',
  submit: 'जमा करें',
  cancel: 'रद्द करें',
  close: 'बंद करें',
  yes: 'हाँ',
  no: 'नहीं',
  error_generic: 'कुछ गलत हुआ। कृपया दोबारा कोशिश करें।',
  loading: 'लोड हो रहा है...',
};

const en: Translations = {
  landing_title: 'MedCase',
  landing_subtitle: 'AI-Powered Patient History System',
  landing_start: 'Get Started',
  landing_powered_by: 'Ministry of Ayush | SIH26047',

  lang_select_title: 'Select Language',
  lang_select_subtitle: 'Please choose your preferred language',
  lang_hindi: 'हिंदी',
  lang_english: 'English',
  lang_continue: 'Continue',

  a11y_increase_font: 'A+',
  a11y_decrease_font: 'A-',
  a11y_help: 'Help',
  a11y_language: 'Language',
  a11y_read_aloud: 'Read Aloud',

  chief_fever: 'Fever',
  chief_cough: 'Cough & Cold',
  chief_stomach: 'Stomach Pain',
  chief_headache: 'Headache',
  chief_bodyache: 'Body Ache / Fatigue',
  chief_vomiting: 'Vomiting / Loose Motion',
  chief_weakness: 'Dizziness / Weakness',
  chief_chest_pain: 'Chest Pain or Heaviness',
  chief_prompt: 'Hello! What problem or discomfort brings you in today?',
  chief_quick_tap: 'Or tap a common symptom below:',

  patient_summary_confirm: 'Your information has been securely recorded',
  patient_summary_sub: 'This summary has been transmitted to your doctor.',
  patient_summary_token: 'Your Token Number',
  patient_summary_next_step: 'Please proceed to the waiting area. When your token is called, enter the consultation room.',

  auth_title: 'Patient Identification',
  auth_subtitle: 'Enter your ABHA ID or create a new session',
  auth_abha_label: 'ABHA ID / Patient ID',
  auth_abha_placeholder: 'Enter ABHA number',
  auth_name_label: 'Full Name',
  auth_name_placeholder: 'Your full name',
  auth_age_label: 'Age',
  auth_age_placeholder: 'e.g. 45',
  auth_gender_label: 'Gender',
  auth_gender_male: 'Male',
  auth_gender_female: 'Female',
  auth_gender_other: 'Other',
  auth_continue: 'Continue',
  auth_demo_note: 'Demo Mode',
  auth_demo_fill: 'Fill Demo Data',

  consent_title: 'Consent',
  consent_body: 'We will collect your responses and medical documents to prepare your history for the doctor.',
  consent_accept: 'I Agree',
  consent_decline: 'Decline',
  consent_point1: 'Your responses will be recorded for this consultation',
  consent_point2: 'Your uploaded medical documents may be processed',
  consent_point3: 'A doctor will review the generated history',

  consult_title: 'Select Consultation',
  consult_subtitle: 'What type of consultation do you need?',
  consult_general_title: 'General Medical Consultation',
  consult_general_desc: 'Prepare clinical health history for the doctor',
  consult_general_btn: 'Start',
  consult_ayush_title: 'AYUSH Assessment',
  consult_ayush_desc: 'AYUSH-specific assessment and history taking',
  consult_ayush_coming_soon: 'Coming Soon',
  consult_ayush_modal_title: 'AYUSH Assessment — Coming Soon',
  consult_ayush_modal_body: 'The AYUSH module is under development. It will include Dashavidha Pariksha, Prakriti/Vikriti assessment, and AYUSH-specific questionnaires.',
  consult_ayush_modal_close: 'Close',

  case_title: 'Clinical History',
  case_speak: 'Speak',
  case_tap: 'Select Option',
  case_type_placeholder: 'Type your answer here...',
  case_send: 'Send',
  case_next: 'Next',
  case_listening: 'Listening...',
  case_processing: 'Understanding...',
  case_mic_hint: 'Tap to speak',
  case_or: 'or',
  case_skip: 'Skip',
  case_progress: 'Question {{current}} of {{total}}',
  case_thinking: 'Understanding...',
  case_speaking: 'Speaking...',
  case_tap_to_speak: 'Tap to speak',
  case_tap_to_stop: 'Tap to stop',
  case_greeting: 'Hello! We will help you prepare your health history for the doctor. What problem or discomfort brings you in today?',
  case_type_instead: 'Type instead',

  redflag_title: 'Priority Medical Attention Required',
  redflag_body: 'Your symptoms may require immediate medical evaluation.',
  redflag_urgency: 'Please speak with the assistance desk or triage nurse directly.',

  upload_title: 'Show us your old prescription or report',
  upload_subtitle: 'Optional — scan a paper document or choose a photo/PDF',
  upload_btn: 'Choose Document',
  upload_camera: 'Scan with Camera',
  upload_skip: 'Skip',
  upload_processing: 'Reading your document…',
  upload_success: "We've read your document",
  upload_error: 'Could not read document clearly. Please upload another image.',
  upload_verify: 'Needs Verification',

  timeline_title: 'Medical History Timeline',

  summary_title: 'Patient History Summary',
  summary_chief: 'Chief Complaint',
  summary_history: 'History',
  summary_medications: 'Medications',
  summary_labs: 'Lab Results',
  summary_red_flags: 'Red Flags',
  summary_ai_note: 'This is an AI-generated summary. Doctor review is required.',

  doctor_title: 'Doctor Dashboard',
  doctor_accept: 'Accept',
  doctor_edit: 'Edit',
  doctor_reject: 'Reject',
  doctor_view_responses: 'View Patient Responses',
  doctor_view_document: 'View Original Document',

  back: 'Back',
  continue: 'Continue',
  submit: 'Submit',
  cancel: 'Cancel',
  close: 'Close',
  yes: 'Yes',
  no: 'No',
  error_generic: 'Something went wrong. Please try again.',
  loading: 'Loading...',
};

export const translations: Record<Language, Translations> = { hi, en };

export function t(lang: Language, key: keyof Translations, vars?: Record<string, string | number>): string {
  let str = translations[lang][key] as string;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{{${k}}}`, String(v));
    });
  }
  return str;
}
