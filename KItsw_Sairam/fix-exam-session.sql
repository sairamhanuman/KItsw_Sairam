-- Fix exam session master table to match API expectations
-- This script will update the table structure to work with our API

-- Add missing columns if they don't exist
ALTER TABLE exam_session_master 
ADD COLUMN IF NOT EXISTS exam_session_name VARCHAR(200) AFTER session_name;

-- Copy data from session_name to exam_session_name
UPDATE exam_session_master 
SET exam_session_name = session_name 
WHERE exam_session_name IS NULL OR exam_session_name = '';

-- Add exam_session_id column as alias for session_id
ALTER TABLE exam_session_master 
ADD COLUMN IF NOT EXISTS exam_session_id INT AFTER session_id;

-- Copy data from session_id to exam_session_id  
UPDATE exam_session_master 
SET exam_session_id = session_id 
WHERE exam_session_id IS NULL;

-- Update the API to use the correct column names
-- The API should use session_id and session_name instead of exam_session_id and exam_session_name

SELECT 'Exam session master table fixed successfully!' as message;
