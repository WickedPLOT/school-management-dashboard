-- Allow 'late' status in daily_schedule_attendance
ALTER TABLE daily_schedule_attendance DROP CHECK `daily_schedule_attendance.status`;
ALTER TABLE daily_schedule_attendance ADD CONSTRAINT `daily_schedule_attendance.status` CHECK (status IN ('present','absent','excused','late'));
