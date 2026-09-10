-- ============================================================
-- MedCase Supabase Schema — SIH26047
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  age           INTEGER,
  gender        TEXT CHECK (gender IN ('male', 'female', 'other')),
  identity_reference TEXT,         -- ABHA ID or demo ID
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSULTATION SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS consultation_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID REFERENCES patients(id) ON DELETE CASCADE,
  consultation_type TEXT CHECK (consultation_type IN ('general', 'ayush')) DEFAULT 'general',
  language          TEXT CHECK (language IN ('hi', 'en')) DEFAULT 'hi',
  status            TEXT CHECK (status IN ('active', 'complete', 'abandoned')) DEFAULT 'active',
  consent_given     BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- ============================================================
-- CONVERSATION MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  speaker    TEXT CHECK (speaker IN ('AI', 'PATIENT')) NOT NULL,
  text       TEXT NOT NULL,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLINICAL STATE (JSON snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_state (
  session_id      UUID PRIMARY KEY REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  structured_json JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RED FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS red_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  rule_name   TEXT NOT NULL,
  severity    TEXT CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')) NOT NULL,
  description TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT CHECK (status IN ('active', 'reviewed', 'dismissed')) DEFAULT 'active'
);

-- ============================================================
-- DOCUMENTS (uploaded prescriptions/reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  document_type TEXT DEFAULT 'prescription',
  file_path     TEXT,               -- Supabase Storage path
  upload_date   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTRACTED MEDICAL DATA (OCR output)
-- ============================================================
CREATE TABLE IF NOT EXISTS extracted_medical_data (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID REFERENCES documents(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  extracted_json JSONB NOT NULL DEFAULT '{}',
  confidence    TEXT CHECK (confidence IN ('HIGH', 'LOW', 'NEEDS_VERIFICATION')) DEFAULT 'NEEDS_VERIFICATION',
  raw_text      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUMMARIES (AI-generated physician-ready summaries)
-- ============================================================
CREATE TABLE IF NOT EXISTS summaries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  summary_json    JSONB NOT NULL DEFAULT '{}',
  summary_text    TEXT,
  priority        TEXT CHECK (priority IN ('URGENT', 'HIGH', 'ROUTINE')) DEFAULT 'ROUTINE',
  status          TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'edited')) DEFAULT 'pending',
  doctor_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW-LEVEL SECURITY (basic — expand for production)
-- ============================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_medical_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- For the prototype: allow all (replace with proper policies in production)
CREATE POLICY "Allow all for prototype" ON patients FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON consultation_sessions FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON conversation_messages FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON clinical_state FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON red_flags FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON extracted_medical_data FOR ALL USING (true);
CREATE POLICY "Allow all for prototype" ON summaries FOR ALL USING (true);

-- ============================================================
-- INDEXES for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON consultation_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_redflags_session ON red_flags(session_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id);

-- ============================================================
-- DEMO: Supabase Storage bucket for documents
-- ============================================================
-- Run in Supabase Dashboard > Storage > New Bucket:
--   Name: medical-documents
--   Public: false
--   File size limit: 10MB
--   Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
