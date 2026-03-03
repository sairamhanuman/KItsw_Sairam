-- Add missing subjects for all branches for semesters I and II
USE engineering_college;

-- Insert subjects for Semester I (1st year) - Common for all branches
INSERT IGNORE INTO subject_master (
    programme_id, branch_id, semester_id, regulation_id, subject_order,
    syllabus_code, ref_code, subject_name, subject_type,
    internal_max_marks, external_max_marks, credits,
    is_elective, is_under_group, is_active, created_at, updated_at
) VALUES
-- CSE Branch (branch_id = 1)
(1, 1, 1, 2, 1, 'U18CS101', 'CS101', 'Engineering Mathematics I', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 1, 2, 2, 'U18CS102', 'CS102', 'Engineering Physics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 1, 1, 2, 3, 'U18CS103', 'CS103', 'Engineering Chemistry', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 1, 1, 2, 4, 'U18CS104', 'CS104', 'Programming for Problem Solving', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 1, 2, 5, 'U18CS105', 'CS105', 'Engineering Graphics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- ECE Branch (branch_id = 2)
(1, 2, 1, 2, 1, 'U18EC101', 'EC101', 'Engineering Mathematics I', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 1, 2, 2, 'U18EC102', 'EC102', 'Engineering Physics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 2, 1, 2, 3, 'U18EC103', 'EC103', 'Engineering Chemistry', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 2, 1, 2, 4, 'U18EC104', 'EC104', 'Programming for Problem Solving', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 1, 2, 5, 'U18EC105', 'EC105', 'Engineering Graphics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- MECH Branch (branch_id = 3)
(1, 3, 1, 2, 1, 'U18ME101', 'ME101', 'Engineering Mathematics I', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 1, 2, 2, 'U18ME102', 'ME102', 'Engineering Physics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 3, 1, 2, 3, 'U18ME103', 'ME103', 'Engineering Chemistry', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 3, 1, 2, 4, 'U18ME104', 'ME104', 'Programming for Problem Solving', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 1, 2, 5, 'U18ME105', 'ME105', 'Engineering Graphics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- CIVIL Branch (branch_id = 4)
(1, 4, 1, 2, 1, 'U18CV101', 'CV101', 'Engineering Mathematics I', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 1, 2, 2, 'U18CV102', 'CV102', 'Engineering Physics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 4, 1, 2, 3, 'U18CV103', 'CV103', 'Engineering Chemistry', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 4, 1, 2, 4, 'U18CV104', 'CV104', 'Programming for Problem Solving', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 1, 2, 5, 'U18CV105', 'CV105', 'Engineering Graphics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- EEE Branch (branch_id = 5)
(1, 5, 1, 2, 1, 'U18EE101', 'EE101', 'Engineering Mathematics I', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 1, 2, 2, 'U18EE102', 'EE102', 'Engineering Physics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 5, 1, 2, 3, 'U18EE103', 'EE103', 'Engineering Chemistry', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),
(1, 5, 1, 2, 4, 'U18EE104', 'EE104', 'Programming for Problem Solving', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 1, 2, 5, 'U18EE105', 'EE105', 'Engineering Graphics', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW());

-- Insert subjects for Semester II (2nd year) - Branch-specific subjects
INSERT IGNORE INTO subject_master (
    programme_id, branch_id, semester_id, regulation_id, subject_order,
    syllabus_code, ref_code, subject_name, subject_type,
    internal_max_marks, external_max_marks, credits,
    is_elective, is_under_group, is_active, created_at, updated_at
) VALUES
-- CSE Branch (branch_id = 1)
(1, 1, 2, 2, 1, 'U18CS201', 'CS201', 'Engineering Mathematics II', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 2, 2, 2, 'U18CS202', 'CS202', 'Digital Electronics', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 2, 2, 3, 'U18CS203', 'CS203', 'Data Structures', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 2, 2, 4, 'U18CS204', 'CS204', 'Object Oriented Programming', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 1, 2, 2, 5, 'U18CS205', 'CS205', 'Environmental Science', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- ECE Branch (branch_id = 2)
(1, 2, 2, 2, 1, 'U18EC201', 'EC201', 'Engineering Mathematics II', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 2, 2, 2, 'U18EC202', 'EC202', 'Network Analysis', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 2, 2, 3, 'U18EC203', 'EC203', 'Electronic Devices', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 2, 2, 4, 'U18EC204', 'EC204', 'Signals and Systems', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 2, 2, 2, 5, 'U18EC205', 'EC205', 'Environmental Science', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- MECH Branch (branch_id = 3)
(1, 3, 2, 2, 1, 'U18ME201', 'ME201', 'Engineering Mathematics II', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 2, 2, 2, 'U18ME202', 'ME202', 'Engineering Mechanics', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 2, 2, 3, 'U18ME203', 'ME203', 'Strength of Materials', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 2, 2, 4, 'U18ME204', 'ME204', 'Thermodynamics', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 3, 2, 2, 5, 'U18ME205', 'ME205', 'Environmental Science', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- CIVIL Branch (branch_id = 4)
(1, 4, 2, 2, 1, 'U18CV201', 'CV201', 'Engineering Mathematics II', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 2, 2, 2, 'U18CV202', 'CV202', 'Surveying', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 2, 2, 3, 'U18CV203', 'CV203', 'Strength of Materials', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 2, 2, 4, 'U18CV204', 'CV204', 'Fluid Mechanics', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 4, 2, 2, 5, 'U18CV205', 'CV205', 'Environmental Science', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW()),

-- EEE Branch (branch_id = 5)
(1, 5, 2, 2, 1, 'U18EE201', 'EE201', 'Engineering Mathematics II', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 2, 2, 2, 'U18EE202', 'EE202', 'Electrical Circuits', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 2, 2, 3, 'U18EE203', 'EE203', 'Electromagnetic Fields', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 2, 2, 4, 'U18EE204', 'EE204', 'Electrical Machines', 'Theory', 30, 70, 4, 0, 0, 1, NOW(), NOW()),
(1, 5, 2, 2, 5, 'U18EE205', 'EE205', 'Environmental Science', 'Theory', 30, 70, 3, 0, 0, 1, NOW(), NOW());
