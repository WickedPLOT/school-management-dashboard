-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('student','brothers_admin','sisters_admin','super_admin')),
  section VARCHAR(20) NOT NULL CHECK (section IN ('brothers','sisters')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student profiles
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(30),
  gender VARCHAR(10),
  institution VARCHAR(255),
  course VARCHAR(255),
  year_of_study INTEGER,
  quran_level VARCHAR(100),
  home_county VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invite tokens (admin-generated registration links)
CREATE TABLE IF NOT EXISTS invite_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin notes on registrations
CREATE TABLE IF NOT EXISTS registration_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parent/guardian contact details in a dedicated table so the app does not require ownership of the existing profiles table
CREATE TABLE IF NOT EXISTS guardian_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  parent_name VARCHAR(255),
  parent_phone VARCHAR(30),
  parent_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery provider settings managed by the client/admin
CREATE TABLE IF NOT EXISTS communication_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_provider VARCHAR(50) NOT NULL DEFAULT 'africastalking',
  at_username VARCHAR(255),
  at_api_key TEXT,
  at_sender_id VARCHAR(50),
  at_use_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  at_wallet_reference VARCHAR(100),
  at_balance_currency VARCHAR(10) DEFAULT 'KES',
  at_credit_balance NUMERIC(12,2),
  at_topup_notes TEXT,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_secure BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,
  smtp_from_name VARCHAR(255),
  smtp_from_email VARCHAR(255),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO communication_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS at_wallet_reference VARCHAR(100);
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS at_balance_currency VARCHAR(10) DEFAULT 'KES';
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS at_credit_balance NUMERIC(12,2);
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS at_topup_notes TEXT;

-- Broadcasts / official communications
CREATE TABLE IF NOT EXISTS message_broadcasts (
  id SERIAL PRIMARY KEY,
  audience VARCHAR(20) NOT NULL CHECK (audience IN ('students','parents','both')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email','both')),
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters','all')),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','partial','failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_deliveries (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER REFERENCES message_broadcasts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('student','parent')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email')),
  provider VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(30),
  external_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_broadcast_id ON message_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_created_at ON message_broadcasts(created_at DESC);

-- Email verification / one-time codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup
  ON verification_codes(email, purpose, code);

-- Event attendance
CREATE TABLE IF NOT EXISTS event_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date TIMESTAMPTZ NOT NULL,
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters','all')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_attendance (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_date ON event_sessions(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user_id ON event_attendance(user_id);

-- Student activity / progress updates
CREATE TABLE IF NOT EXISTS student_updates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track VARCHAR(20) NOT NULL CHECK (track IN ('academic','religious','activity')),
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  progress_score NUMERIC(5,2),
  review_status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','reviewed')),
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_updates_user_id ON student_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_student_updates_track ON student_updates(track);

-- Resident issue reporting
CREATE TABLE IF NOT EXISTS issue_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  description TEXT NOT NULL,
  attachment_name VARCHAR(255),
  attachment_data TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','inprogress','resolved')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_user_id ON issue_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  kind VARCHAR(50) NOT NULL DEFAULT 'general',
  action_url VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- Knowledge hub resources
CREATE TABLE IF NOT EXISTS knowledge_resources (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('link','file','note')),
  external_url TEXT,
  file_name VARCHAR(255),
  file_data TEXT,
  note_content TEXT,
  audience VARCHAR(20) NOT NULL DEFAULT 'students' CHECK (audience IN ('students','admins','both')),
  section_scope VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (section_scope IN ('brothers','sisters','all')),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_resources_scope ON knowledge_resources(section_scope, audience, is_published);

-- Accommodation management
CREATE TABLE IF NOT EXISTS accommodation_buildings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters')),
  manager_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accommodation_rooms (
  id SERIAL PRIMARY KEY,
  building_id INTEGER NOT NULL REFERENCES accommodation_buildings(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS room_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES accommodation_rooms(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_building_id ON accommodation_rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_room_id ON room_assignments(room_id);

-- General system settings
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  centre_name VARCHAR(255) NOT NULL DEFAULT 'Hayrat Centre',
  platform_label VARCHAR(255) NOT NULL DEFAULT 'Student Resident Management System',
  support_email VARCHAR(255),
  registration_invite_expiry_days INTEGER NOT NULL DEFAULT 7,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  allow_student_profile_edits BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_late_weight NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  attendance_warning_threshold NUMERIC(5,2) NOT NULL DEFAULT 60.00,
  default_event_section_scope VARCHAR(20) NOT NULL DEFAULT 'brothers' CHECK (default_event_section_scope IN ('brothers','sisters','all')),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
