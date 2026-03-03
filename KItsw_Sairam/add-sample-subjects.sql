-- Insert sample subjects for testing timetable generation
USE engineering_college;

-- Insert subjects for Programme 1 (B.Tech), Semester 8, Regulation 2
INSERT IGNORE INTO subject_master (
    programme_id, branch_id, semester_id, regulation_id, subject_order,
    syllabus_code, ref_code, subject_name, subject_type,
    internal_max_marks, external_max_marks, credits,
    is_elective, is_under_group, is_active
) VALUES
-- Core subjects for 8th Semester CSE
(1, 1, 8, 2, 1, 'CS801', 'CS801', 'Cloud Computing', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 1, 8, 2, 2, 'CS802', 'CS802', 'Big Data Analytics', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 1, 8, 2, 3, 'CS803', 'CS803', 'Machine Learning Lab', 'Practical', 50, 50, 2, 0, 0, 1),
(1, 1, 8, 2, 4, 'CS804', 'CS804', 'Project Work Phase II', 'Project', 100, 100, 6, 0, 0, 1),

-- Elective subjects for 8th Semester
(1, 1, 8, 2, 5, 'CSE801', 'CSE801', 'Artificial Intelligence', 'Theory', 30, 70, 3, 1, 1, 1),
(1, 1, 8, 2, 6, 'CSE802', 'CSE802', 'Cyber Security', 'Theory', 30, 70, 3, 1, 1, 1),
(1, 1, 8, 2, 7, 'CSE803', 'CSE803', 'Internet of Things', 'Theory', 30, 70, 3, 1, 1, 1),

-- Core subjects for other branches if needed
(1, 2, 8, 2, 1, 'EC801', 'EC801', 'VLSI Design', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 2, 8, 2, 2, 'EC802', 'EC802', 'Digital Signal Processing', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 3, 8, 2, 1, 'ME801', 'ME801', 'CAD/CAM', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 4, 8, 2, 1, 'CV801', 'CV801', 'Structural Design', 'Theory', 30, 70, 3, 0, 0, 1);

-- Also add some subjects for lower semesters to have more variety
INSERT IGNORE INTO subject_master (
    programme_id, branch_id, semester_id, regulation_id, subject_order,
    syllabus_code, ref_code, subject_name, subject_type,
    internal_max_marks, external_max_marks, credits,
    is_elective, is_under_group, is_active
) VALUES
-- 6th Semester subjects
(1, 1, 6, 2, 1, 'CS601', 'CS601', 'Database Management Systems', 'Theory', 30, 70, 4, 0, 0, 1),
(1, 1, 6, 2, 2, 'CS602', 'CS602', 'Computer Networks', 'Theory', 30, 70, 4, 0, 0, 1),
(1, 1, 6, 2, 3, 'CS603', 'CS603', 'Software Engineering', 'Theory', 30, 70, 3, 0, 0, 1),

-- 7th Semester subjects  
(1, 1, 7, 2, 1, 'CS701', 'CS701', 'Compiler Design', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 1, 7, 2, 2, 'CS702', 'CS702', 'Distributed Systems', 'Theory', 30, 70, 3, 0, 0, 1),
(1, 1, 7, 2, 3, 'CS703', 'CS703', 'Project Work Phase I', 'Project', 100, 100, 4, 0, 0, 1);
