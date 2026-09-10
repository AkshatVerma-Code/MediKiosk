# MedCase — AI Patient Case-Taking Software
### SIH26047 | Ministry of Ayush | Smart Automation

> **Prototype** — Not intended for autonomous clinical diagnosis or treatment.

---

## 🏥 Overview

A kiosk-based AI patient case-taking system for busy government hospitals. The system:
- Collects patient history through **conversational AI** (voice + tap + text)
- Detects **red flags** deterministically (rule-based, not LLM-dependent)
- Reads **uploaded prescriptions/reports via OCR**
- Generates a **physician-ready structured summary**
- Presents everything on a **Doctor Dashboard** for review

---

## ⚡ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Vanilla CSS Modules — greenish theme |
| LLM | Google Gemini 1.5 Flash |
| STT | Sarvam AI (Saaras) |
| TTS | Sarvam AI (Bulbul) |
| OCR | Mistral OCR |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd medcase
npm install
```

### 2. Fill in your API keys
Edit `.env.local`:
```
SARVAM_API_KEY=your_sarvam_key
GEMINI_API_KEY=your_gemini_key
MISTRAL_API_KEY=your_mistral_key
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Set up Supabase
- Open your Supabase project → SQL Editor
- Paste and run the contents of `supabase_schema.sql`
- Create a storage bucket named `medical-documents` (private, 10MB limit)

### 4. Run the dev server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 📱 Demo Flow (MVP)

1. **Landing** → `localhost:3000/`
2. **Language** → Select Hindi or English
3. **Auth** → Enter name / click "Fill Demo Data"
4. **Consent** → Accept
5. **Select** → Click "General Medical Consultation"
6. **Case Taking** → Speak or tap answers (try: chest pain + breathlessness for red flag)
7. **Upload** → Upload a prescription image (optional)
8. **Summary** → AI generates physician-ready summary
9. **Doctor Dashboard** → Review, accept/reject, view timeline

---

## 🧩 Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — UI | ✅ Done | All screens, green theme, accessibility |
| 2 — Case Taking | ✅ Done | Conversational UI, tap+text input |
| 3 — Voice | ✅ Done | Sarvam STT/TTS API routes |
| 4 — Intelligence | ✅ Done | Gemini extraction, red-flag rules |
| 5 — Documents | ✅ Done | Mistral OCR + entity extraction |
| 6 — Summary | ✅ Done | AI summary + Doctor Dashboard |
| 7 — Database | ✅ Done | Supabase schema + session API |
| 8 — Polish | 🔄 Next | Loading states, error handling, demo |

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── page.tsx              ← Landing
│   ├── language/             ← Language selection
│   ├── auth/                 ← Patient authentication
│   ├── consent/              ← Consent screen
│   ├── select/               ← Consultation selection
│   ├── case-taking/          ← AI conversational case taking ★
│   ├── upload/               ← Document upload + OCR
│   ├── summary/              ← AI summary generation
│   ├── doctor/               ← Doctor dashboard
│   └── api/
│       ├── extract/          ← Gemini NLP extraction
│       ├── stt/              ← Sarvam Speech-to-Text
│       ├── tts/              ← Sarvam Text-to-Speech
│       ├── ocr/              ← Mistral OCR + entity extraction
│       ├── summary/          ← AI summary generation
│       └── session/          ← Supabase session persistence
├── components/
│   ├── AccessibilityBar.tsx  ← A+/A-/Language/Help bar
│   └── RedFlagAlert.tsx      ← Emergency alert banner
└── lib/
    ├── translations.ts       ← Hindi + English strings
    ├── store.ts              ← LocalStorage session state
    ├── questionEngine.ts     ← Adaptive question logic
    ├── redFlagRules.ts       ← Deterministic red-flag rules
    └── supabase.ts           ← Supabase client
```

---

## ⚠️ Important Notes

- **This is NOT an AI doctor.** The system collects and structures information. Doctors make all clinical decisions.
- **AYUSH Assessment** is visible but marked "Coming Soon" — not functional in this release.
- **Red-flag detection is rule-based**, not LLM-dependent, for reliability in clinical settings.
- All API keys must be kept in `.env.local` — never in frontend code.

---

*Prototype by Team SIH26047 | Ministry of Ayush*
