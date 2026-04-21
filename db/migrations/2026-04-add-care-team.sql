-- Add care_team column to providers table for grouping
ALTER TABLE providers ADD COLUMN IF NOT EXISTS care_team text;
