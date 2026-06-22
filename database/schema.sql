-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('student','brothers_admin','sisters_admin','super_admin')),
  section VARCHAR(20) NOT NULL CHECK (section IN ('brothers','sisters')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student profiles
CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(30),
  gender VARCHAR(10),
  institution VARCHAR(255),
  course VARCHAR(255),
  year_of_study INT,
  quran_level VARCHAR(100),
  home_county VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invite tokens (admin-generated registration links)
CREATE TABLE IF NOT EXISTS invite_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  used TINYINT(1) DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin notes on registrations
CREATE TABLE IF NOT EXISTS registration_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parent/guardian contact details
CREATE TABLE IF NOT EXISTS guardian_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  parent_name VARCHAR(255),
  parent_phone VARCHAR(30),
  parent_email VARCHAR(255),
  alt_student_phone VARCHAR(30),
  alt_parent_phone VARCHAR(30),
  emergency_contact_1_name VARCHAR(255),
  emergency_contact_1_phone VARCHAR(30),
  emergency_contact_1_relation VARCHAR(100),
  emergency_contact_2_name VARCHAR(255),
  emergency_contact_2_phone VARCHAR(30),
  emergency_contact_2_relation VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Delivery provider settings managed by the client/admin
CREATE TABLE IF NOT EXISTS communication_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  sms_enabled TINYINT(1) NOT NULL DEFAULT FALSE,
  sms_provider VARCHAR(50) NOT NULL DEFAULT 'africastalking',
  at_username VARCHAR(255),
  at_api_key TEXT,
  at_sender_id VARCHAR(50),
  at_use_sandbox TINYINT(1) NOT NULL DEFAULT TRUE,
  at_paybill_number VARCHAR(30),
  at_wallet_reference VARCHAR(100),
  at_balance_currency VARCHAR(10) DEFAULT 'KES',
  at_credit_balance DECIMAL(12,2),
  at_topup_notes TEXT,
  email_enabled TINYINT(1) NOT NULL DEFAULT FALSE,
  smtp_host VARCHAR(255),
  smtp_port INT,
  smtp_secure TINYINT(1) NOT NULL DEFAULT FALSE,
  smtp_user VARCHAR(255),
  smtp_pass TEXT,
  smtp_from_name VARCHAR(255),
  smtp_from_email VARCHAR(255),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO communication_settings (id) VALUES (1);

-- Broadcasts / official communications
CREATE TABLE IF NOT EXISTS message_broadcasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  audience VARCHAR(20) NOT NULL CHECK (audience IN ('students','parents','both')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email','both')),
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters','all')),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','partial','failed')),
  recipient_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  broadcast_id INT REFERENCES message_broadcasts(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('student','parent')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email')),
  provider VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(30),
  external_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_broadcast_id ON message_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_created_at ON message_broadcasts(created_at DESC);

-- Email verification / one-time codes
CREATE TABLE IF NOT EXISTS verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup ON verification_codes(email, purpose, code);

-- Event attendance
CREATE TABLE IF NOT EXISTS event_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date TIMESTAMP NOT NULL,
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters','all')),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sessions_date ON event_sessions(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user_id ON event_attendance(user_id);

-- Student activity / progress updates
CREATE TABLE IF NOT EXISTS student_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track VARCHAR(20) NOT NULL CHECK (track IN ('academic','religious','activity')),
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  progress_score DECIMAL(5,2),
  review_status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','reviewed')),
  admin_note TEXT,
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_updates_user_id ON student_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_student_updates_track ON student_updates(track);

-- Resident issue reporting
CREATE TABLE IF NOT EXISTS issue_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  description TEXT NOT NULL,
  attachment_name VARCHAR(255),
  attachment_data TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','inprogress','resolved')),
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_user_id ON issue_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  kind VARCHAR(50) NOT NULL DEFAULT 'general',
  action_url VARCHAR(255),
  is_read TINYINT(1) NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- Routine/program items published by admins for students
CREATE TABLE IF NOT EXISTS program_routines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL CHECK (category IN ('daily','holiday','personal','activity')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  day_scope VARCHAR(100),
  period VARCHAR(100),
  start_time TIME,
  end_time TIME,
  section_scope VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (section_scope IN ('brothers','sisters','all')),
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Daily activities / planner
CREATE TABLE IF NOT EXISTS daily_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  schedule_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters')),
  repeat_mode VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (repeat_mode IN ('once','daily')),
  presenter_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  presenter_name VARCHAR(255),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','done','cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  repeat_pattern VARCHAR(50) DEFAULT 'once' CHECK (repeat_pattern IN ('once', 'daily', 'weekdays', 'weekends', 'specific_days', 'week_only', 'month_only')),
  repeat_days JSON,
  end_date DATE
);

CREATE TABLE IF NOT EXISTS daily_schedule_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','excused')),
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(schedule_id, user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_schedule_attendance_schedule_id ON daily_schedule_attendance(schedule_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedule_attendance_user_id ON daily_schedule_attendance(user_id);

CREATE INDEX IF NOT EXISTS idx_program_routines_scope ON program_routines(section_scope, category, is_published);

INSERT IGNORE INTO program_routines (category, title, description, day_scope, period, sort_order, section_scope)
VALUES
  ('daily', 'Fajir prayer', NULL, 'Monday to Friday', 'Morning', 10, 'all'),
  ('daily', 'Morning Tasbihat', NULL, 'Monday to Friday', 'Morning', 20, 'all'),
  ('daily', 'Quran memorisation', NULL, 'Monday to Friday', 'Morning', 30, 'all'),
  ('daily', 'Maghreb Prayer', NULL, 'Monday to Friday', 'Evening', 40, 'all'),
  ('daily', 'Islamic lectures between Maghreb to Isha', NULL, 'Monday to Friday', 'Evening', 50, 'all'),
  ('daily', 'Isha prayers', NULL, 'Monday to Friday', 'Evening', 60, 'all'),
  ('daily', 'Fajir salah and Tasbihat', NULL, 'Saturday', 'Morning', 70, 'all'),
  ('daily', 'Quran memorisation', NULL, 'Saturday', 'Morning', 80, 'all'),
  ('daily', 'Islamic lecture until 9am', NULL, 'Saturday', 'Morning', 90, 'all'),
  ('holiday', 'One week spiritual camp', 'December holiday program', 'December holiday', NULL, 100, 'all'),
  ('holiday', 'Two weeks camp', 'Long holiday program', 'June to July', NULL, 110, 'all'),
  ('personal', 'Daily Quran readings', NULL, 'Daily', NULL, 120, 'all'),
  ('personal', 'Daily Risael Nur readings', NULL, 'Daily', NULL, 130, 'all'),
  ('personal', 'Group discussions', NULL, 'Daily', NULL, 140, 'all'),
  ('activity', 'Picnics after camps', NULL, 'After camps', NULL, 150, 'all');

-- Knowledge hub resources
CREATE TABLE IF NOT EXISTS knowledge_resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
  is_published TINYINT(1) NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_resources_scope ON knowledge_resources(section_scope, audience, is_published);

-- Accommodation management
CREATE TABLE IF NOT EXISTS accommodation_buildings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  section_scope VARCHAR(20) NOT NULL CHECK (section_scope IN ('brothers','sisters')),
  manager_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accommodation_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  building_id INT NOT NULL REFERENCES accommodation_buildings(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS room_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  room_id INT NOT NULL REFERENCES accommodation_rooms(id) ON DELETE CASCADE,
  assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_building_id ON accommodation_rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_room_id ON room_assignments(room_id);

-- Disciplinary records
CREATE TABLE IF NOT EXISTS disciplinary_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','moderate','serious')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  action_taken TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_records_user_id ON disciplinary_records(user_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_status ON disciplinary_records(status);
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_incident_date ON disciplinary_records(incident_date DESC);

-- General system settings
CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY CHECK (id = 1),
  centre_name VARCHAR(255) NOT NULL DEFAULT 'Centre of Suffa',
  platform_label VARCHAR(255) NOT NULL DEFAULT 'Student Resident Management System',
  support_email VARCHAR(255),
  registration_invite_expiry_days INT NOT NULL DEFAULT 7,
  approval_required TINYINT(1) NOT NULL DEFAULT TRUE,
  allow_student_profile_edits TINYINT(1) NOT NULL DEFAULT TRUE,
  attendance_late_weight DECIMAL(4,2) NOT NULL DEFAULT 0.50,
  attendance_warning_threshold DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  default_event_section_scope VARCHAR(20) NOT NULL DEFAULT 'brothers' CHECK (default_event_section_scope IN ('brothers','sisters','all')),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO app_settings (id) VALUES (1);

-- Fee and accommodation payment tracking
CREATE TABLE IF NOT EXISTS fee_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'accommodation' CHECK (category IN ('accommodation','meal','camp','general','other')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  billing_cycle VARCHAR(30) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('once','weekly','monthly','termly','yearly')),
  section_scope VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (section_scope IN ('brothers','sisters','all')),
  active TINYINT(1) NOT NULL DEFAULT TRUE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fee_charges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT REFERENCES fee_plans(id) ON DELETE SET NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','waived')),
  note TEXT,
  mpesa_account_ref VARCHAR(100),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(plan_id, user_id, due_date)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  charge_id INT REFERENCES fee_charges(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'mpesa' CHECK (payment_method IN ('mpesa','cash','bank','other')),
  mpesa_receipt VARCHAR(100),
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_plans_section_scope ON fee_plans(section_scope);
CREATE INDEX IF NOT EXISTS idx_fee_charges_user_id ON fee_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_fee_charges_due_date ON fee_charges(due_date);
CREATE INDEX IF NOT EXISTS idx_fee_charges_status ON fee_charges(status);
CREATE INDEX IF NOT EXISTS idx_fee_payments_charge_id ON fee_payments(charge_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_user_id ON fee_payments(user_id);

-- M-Pesa STK push requests and callback reconciliation
CREATE TABLE IF NOT EXISTS mpesa_payment_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  charge_id INT REFERENCES fee_charges(id) ON DELETE SET NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  phone VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  account_reference VARCHAR(100),
  merchant_request_id VARCHAR(100),
  checkout_request_id VARCHAR(100) UNIQUE,
  response_code VARCHAR(20),
  response_description TEXT,
  customer_message TEXT,
  result_code INT,
  result_desc TEXT,
  mpesa_receipt VARCHAR(100),
  transaction_date VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pending','paid','failed','cancelled')),
  raw_response JSON,
  raw_callback JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mpesa_payment_requests_charge_id ON mpesa_payment_requests(charge_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_payment_requests_user_id ON mpesa_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_payment_requests_checkout ON mpesa_payment_requests(checkout_request_id);

-- Extended student registration/profile details
CREATE TABLE IF NOT EXISTS student_profile_extensions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nationality VARCHAR(120),
  country VARCHAR(120),
  county VARCHAR(120),
  sub_county VARCHAR(120),
  passport_photo_data TEXT,
  entry_date DATE DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_profile_extensions_user_id ON student_profile_extensions(user_id);

-- Student uploaded verification documents
CREATE TABLE IF NOT EXISTS student_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(120),
  file_data TEXT,
  review_status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','approved','rejected')),
  review_note TEXT,
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(user_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_student_documents_user_id ON student_documents(user_id);

-- Reading progress tracking for knowledge hub resources
CREATE TABLE IF NOT EXISTS reading_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resource_id INT NOT NULL REFERENCES knowledge_resources(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','reading','completed')),
  pages_read INT NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  total_pages INT CHECK (total_pages IS NULL OR total_pages > 0),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (resource_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_resource_id ON reading_progress(resource_id);

-- Platform books uploaded by admins for student progress tracking
CREATE TABLE IF NOT EXISTS platform_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  description TEXT,
  cover_data TEXT,
  total_pages INT NOT NULL DEFAULT 0 CHECK (total_pages >= 0),
  section_scope VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (section_scope IN ('brothers','sisters','all')),
  is_published TINYINT(1) NOT NULL DEFAULT TRUE,
  file_name VARCHAR(255),
  file_data TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Student progress on platform books
CREATE TABLE IF NOT EXISTS book_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL REFERENCES platform_books(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pages_read INT NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','reading','completed')),
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_progress_user_id ON book_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_book_progress_book_id ON book_progress(book_id);
CREATE INDEX IF NOT EXISTS idx_platform_books_scope ON platform_books(section_scope, is_published);

-- Routine attendance tracking
CREATE TABLE IF NOT EXISTS program_routine_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  routine_id INT NOT NULL REFERENCES program_routines(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','excused','late')),
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (routine_id, user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_routine_attendance_routine_id ON program_routine_attendance(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_attendance_user_id ON program_routine_attendance(user_id);

-- Default super admin (password: superadmin123)
INSERT IGNORE INTO users (email, password_hash, role, section, status)
VALUES (
  'superadmin@hayrat.com',
  '$2b$10$hRHLDmOYPqKfpOQvcAVPn.8nHy0GvxKBOb6k6jcVQik66Hy05xFUa',
  'super_admin',
  'brothers',
  'approved'
);

-- Per-day-of-week presenter overrides for recurring activities
CREATE TABLE IF NOT EXISTS schedule_day_presenters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  presenter_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  presenter_name VARCHAR(255),
  UNIQUE (schedule_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_schedule_day_presenters_schedule_id ON schedule_day_presenters(schedule_id);

-- Quran memorisation assignments
CREATE TABLE IF NOT EXISTS quran_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_from VARCHAR(50) NOT NULL,
  page_to VARCHAR(50) NOT NULL,
  assigned_for DATE NOT NULL,
  notes TEXT,
  assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
  admin_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  marked_by INT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quran_assignments_user_id ON quran_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_quran_assignments_assigned_for ON quran_assignments(assigned_for DESC);

-- One-on-one student meetings
CREATE TABLE IF NOT EXISTS student_meetings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  agenda TEXT,
  meeting_at TIMESTAMP NOT NULL,
  location VARCHAR(255),
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  outcome_note TEXT,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_meetings_user_id ON student_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_student_meetings_meeting_at ON student_meetings(meeting_at DESC);
