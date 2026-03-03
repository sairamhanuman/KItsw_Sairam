-- Railway Database Fix for Exam Timetable System
-- Run this script to fix the foreign key reference issue

-- Fix the exam_timetable table foreign key
ALTER TABLE exam_timetable 
DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_1;

ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_session 
FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id) ON DELETE CASCADE;

-- Test the fix by running a simple query
SELECT 'Testing fix...' as status;

SELECT 
    et.timetable_id,
    es.session_name,
    es.session_id
FROM exam_timetable et
LEFT JOIN exam_session_master es ON et.exam_session_id = es.session_id
LIMIT 1;

SELECT 'Foreign key fix completed successfully!' as message;
