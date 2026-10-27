-- Add driver columns to daily_reports table
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS driver_name TEXT;
