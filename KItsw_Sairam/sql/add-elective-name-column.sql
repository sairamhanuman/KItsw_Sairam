-- Add elective_name column to subject_master table
-- This will help distinguish between Open Elective and Professional Elective groups

ALTER TABLE subject_master 
ADD COLUMN elective_name VARCHAR(50) DEFAULT NULL 
AFTER is_under_group;

-- Update existing elective subjects with elective names
-- Open Elective Group (subject_order = 1)
UPDATE subject_master 
SET elective_name = 'Open Elective'
WHERE is_elective = 1 
AND is_under_group = 1 
AND subject_order = 1;

-- Professional Elective Group (subject_order = 2)
UPDATE subject_master 
SET elective_name = 'Professional Elective'
WHERE is_elective = 1 
AND is_under_group = 1 
AND subject_order = 2;

-- Verify the updates
SELECT 
    subject_id,
    syllabus_code,
    ref_code,
    subject_name,
    is_elective,
    elective_name,
    subject_order,
    is_under_group
FROM subject_master 
WHERE is_elective = 1 
AND is_under_group = 1 
ORDER BY subject_order, replacement_group_order;
