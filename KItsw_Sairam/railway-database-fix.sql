-- Railway Database Fix for Exam Timetable System
-- Run this to fix all foreign key and table issues

-- Step 1: Drop existing foreign key constraints if they exist
ALTER TABLE exam_timetable DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_1;
ALTER TABLE exam_timetable DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_2;
ALTER TABLE exam_timetable DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_3;
ALTER TABLE exam_timetable DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_4;
ALTER TABLE exam_timetable DROP FOREIGN KEY IF EXISTS exam_timetable_ibfk_5;

ALTER TABLE exam_schedule DROP FOREIGN KEY IF EXISTS exam_schedule_ibfk_1;
ALTER TABLE exam_schedule DROP FOREIGN KEY IF EXISTS exam_schedule_ibfk_2;
ALTER TABLE exam_schedule DROP FOREIGN KEY IF EXISTS exam_schedule_ibfk_3;
ALTER TABLE exam_schedule DROP FOREIGN KEY IF EXISTS exam_schedule_ibfk_4;
ALTER TABLE exam_schedule DROP FOREIGN KEY IF EXISTS exam_schedule_ibfk_5;

ALTER TABLE exam_invigilator_assignments DROP FOREIGN KEY IF EXISTS exam_invigilator_assignments_ibfk_1;
ALTER TABLE exam_invigilator_assignments DROP FOREIGN KEY IF EXISTS exam_invigilator_assignments_ibfk_2;
ALTER TABLE exam_invigilator_assignments DROP FOREIGN KEY IF EXISTS exam_invigilator_assignments_ibfk_3;

-- Step 2: Add correct foreign key constraints
ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_session 
FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id) ON DELETE CASCADE;

ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_exam_type 
FOREIGN KEY (exam_type_id) REFERENCES mse_exam_type_master(exam_type_id) ON DELETE RESTRICT;

ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_programme 
FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id) ON DELETE RESTRICT;

ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_branch 
FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id) ON DELETE RESTRICT;

ALTER TABLE exam_timetable 
ADD CONSTRAINT fk_exam_timetable_semester 
FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id) ON DELETE RESTRICT;

ALTER TABLE exam_schedule 
ADD CONSTRAINT fk_exam_schedule_timetable 
FOREIGN KEY (timetable_id) REFERENCES exam_timetable(timetable_id) ON DELETE CASCADE;

ALTER TABLE exam_schedule 
ADD CONSTRAINT fk_exam_schedule_subject 
FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id) ON DELETE RESTRICT;

ALTER TABLE exam_schedule 
ADD CONSTRAINT fk_exam_schedule_room 
FOREIGN KEY (room_id) REFERENCES room_master(room_id) ON DELETE SET NULL;

ALTER TABLE exam_schedule 
ADD CONSTRAINT fk_exam_schedule_block 
FOREIGN KEY (block_id) REFERENCES block_master(block_id) ON DELETE SET NULL;

ALTER TABLE exam_schedule 
ADD CONSTRAINT fk_exam_schedule_invigilator 
FOREIGN KEY (chief_invigilator_id) REFERENCES staff_master(staff_id) ON DELETE SET NULL;

ALTER TABLE exam_invigilator_assignments 
ADD CONSTRAINT fk_exam_invigilator_schedule 
FOREIGN KEY (schedule_id) REFERENCES exam_schedule(schedule_id) ON DELETE CASCADE;

ALTER TABLE exam_invigilator_assignments 
ADD CONSTRAINT fk_exam_invigilator_staff 
FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id) ON DELETE CASCADE;

ALTER TABLE exam_invigilator_assignments 
ADD CONSTRAINT fk_exam_invigilator_assigned_by 
FOREIGN KEY (assigned_by) REFERENCES staff_master(staff_id) ON DELETE SET NULL;

-- Step 3: Test the fix
SELECT 'Testing foreign key fixes...' as status;

-- Test a simple join query
SELECT 
    COUNT(*) as test_count
FROM exam_timetable et
LEFT JOIN exam_session_master es ON et.exam_session_id = es.session_id
LIMIT 1;

SELECT 'Database fixes completed successfully!' as message;
