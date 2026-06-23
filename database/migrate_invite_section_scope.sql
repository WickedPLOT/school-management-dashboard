-- Add section_scope column to invite_tokens table
ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS section_scope VARCHAR(20) DEFAULT NULL;
