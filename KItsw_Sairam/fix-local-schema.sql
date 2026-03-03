-- Fix local database schema to match Railway

-- Add missing tables
CREATE TABLE IF NOT EXISTS exam_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_session_id INT,
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    recipients JSON,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_timetable (
    timetable_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_session_id INT,
    exam_type_id INT,
    programme_id INT,
    branch_id INT,
    semester_id INT,
    exam_date DATE,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_types_master (
    exam_type_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_type_name VARCHAR(100) NOT NULL,
    exam_type_code VARCHAR(20),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exams_naming_master (
    exam_naming_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(100) NOT NULL,
    exam_code VARCHAR(20),
    academic_year VARCHAR(20),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS month_year_master (
    month_year_id INT AUTO_INCREMENT PRIMARY KEY,
    month_name VARCHAR(20) NOT NULL,
    year_value INT NOT NULL,
    month_year_label VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_status_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotion_batch_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT,
    from_semester_id INT,
    to_semester_id INT,
    promotion_date DATE,
    promoted_by VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions_master (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    session_name VARCHAR(100) NOT NULL,
    session_code VARCHAR(20),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_elective_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    elective_subject_id INT,
    semester_id INT,
    academic_year VARCHAR(20),
    status VARCHAR(20) DEFAULT 'allocated',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_semester_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    semester_id INT,
    academic_year VARCHAR(20),
    status VARCHAR(20),
    gpa DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_status_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_by VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subject_faculty_allotment (
    allotment_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT,
    faculty_id INT,
    semester_id INT,
    academic_year VARCHAR(20),
    allotment_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Fix existing tables
ALTER TABLE exam_session_master ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE exam_session_master ADD COLUMN IF NOT EXISTS end_time TIME;

ALTER TABLE staff_master ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);

ALTER TABLE student_master ADD COLUMN IF NOT EXISTS joining_regulation_id INT;

ALTER TABLE room_master MODIFY COLUMN total_capacity INT DEFAULT 0;

-- Add foreign keys
ALTER TABLE exam_notifications ADD FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id);
ALTER TABLE exam_timetable ADD FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id);
ALTER TABLE exam_timetable ADD FOREIGN KEY (exam_type_id) REFERENCES exam_types_master(exam_type_id);
ALTER TABLE exam_timetable ADD FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id);
ALTER TABLE exam_timetable ADD FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id);
ALTER TABLE exam_timetable ADD FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id);
ALTER TABLE student_elective_mapping ADD FOREIGN KEY (student_id) REFERENCES student_master(student_id);
ALTER TABLE student_elective_mapping ADD FOREIGN KEY (elective_subject_id) REFERENCES subject_master(subject_id);
ALTER TABLE student_elective_mapping ADD FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id);
ALTER TABLE student_semester_history ADD FOREIGN KEY (student_id) REFERENCES student_master(student_id);
ALTER TABLE student_semester_history ADD FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id);
ALTER TABLE student_status_log ADD FOREIGN KEY (student_id) REFERENCES student_master(student_id);
ALTER TABLE subject_faculty_allotment ADD FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id);
ALTER TABLE subject_faculty_allotment ADD FOREIGN KEY (faculty_id) REFERENCES staff_master(staff_id);
ALTER TABLE subject_faculty_allotment ADD FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id);
