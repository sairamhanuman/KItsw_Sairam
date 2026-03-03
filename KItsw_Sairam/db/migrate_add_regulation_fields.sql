-- Migration: Add joining_regulation_id and current_regulation_id to student_master
-- Date: 2026-02-07
-- Description: Add two new regulation tracking fields to student_master table

USE engineering_college;

-- Add new columns
ALTER TABLE student_master 
ADD COLUMN joining_regulation_id INT NULL COMMENT 'Regulation at time of joining' AFTER regulation_id,
ADD COLUMN current_regulation_id INT NULL COMMENT 'Current active regulation' AFTER joining_regulation_id;

-- Add foreign key constraints
ALTER TABLE student_master
ADD CONSTRAINT fk_student_joining_regulation 
    FOREIGN KEY (joining_regulation_id) 
    REFERENCES regulation_master(regulation_id)
    ON DELETE SET NULL;

ALTER TABLE student_master
ADD CONSTRAINT fk_student_current_regulation 
    FOREIGN KEY (current_regulation_id) 
    REFERENCES regulation_master(regulation_id)
    ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_joining_regulation ON student_master(joining_regulation_id);
CREATE INDEX idx_current_regulation ON student_master(current_regulation_id);

-- Optional: Migrate existing regulation_id data to new fields
-- This sets both joining and current regulation to the existing regulation_id
UPDATE student_master 
SET joining_regulation_id = regulation_id,
    current_regulation_id = regulation_id
WHERE regulation_id IS NOT NULL;

-- Verification query
SELECT 
    COUNT(*) as total_students,
    COUNT(joining_regulation_id) as with_joining_reg,
    COUNT(current_regulation_id) as with_current_reg
FROM student_master 
WHERE is_active = 1;
