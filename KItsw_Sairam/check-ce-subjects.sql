-- Check CIVIL ENGINEERING subjects to see what's missing
USE engineering_college;

SELECT 
    subject_code,
    syllabus_code,
    subject_name,
    branch_id,
    branch_name
FROM subject_master sm
LEFT JOIN branch_master bm ON sm.branch_id = bm.branch_id
WHERE bm.branch_name LIKE '%CIVIL%' 
    AND sm.programme_id = 1 
    AND sm.semester_id = 8 
    AND sm.regulation_id = 2
    AND sm.is_active = 1
    AND sm.deleted_at IS NULL
ORDER BY sm.syllabus_code;
