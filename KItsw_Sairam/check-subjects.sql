-- Check subjects by branch and semester for B.Tech programme
USE engineering_college;

SELECT 
    bm.branch_id,
    bm.branch_code,
    bm.branch_name,
    sm.semester_id,
    sem.semester_name,
    COUNT(*) as subject_count
FROM branch_master bm
LEFT JOIN subject_master sm ON bm.branch_id = sm.branch_id 
    AND sm.programme_id = 1 
    AND sm.is_active = 1
    AND sm.deleted_at IS NULL
LEFT JOIN semester_master sem ON sm.semester_id = sem.semester_id
WHERE bm.is_active = 1 AND bm.deleted_at IS NULL
GROUP BY bm.branch_id, bm.branch_code, bm.branch_name, sm.semester_id, sem.semester_name
ORDER BY bm.branch_id, sm.semester_id;
