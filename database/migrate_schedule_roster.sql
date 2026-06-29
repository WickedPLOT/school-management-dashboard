-- Date-specific presenter roster for daily schedules
CREATE TABLE IF NOT EXISTS schedule_date_roster (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
  roster_date DATE NOT NULL,
  presenter_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  presenter_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (schedule_id, roster_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_date_roster_schedule ON schedule_date_roster(schedule_id, roster_date);
