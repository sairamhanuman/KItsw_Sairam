-- Create exam notifications table
CREATE TABLE IF NOT EXISTS exam_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_code VARCHAR(100) NOT NULL UNIQUE,
    programme_id INT NOT NULL,
    semester_ids VARCHAR(500) NOT NULL, -- Comma-separated semester IDs
    regulation_ids VARCHAR(500) NOT NULL, -- Comma-separated regulation IDs
    exam_type VARCHAR(50) NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    exam_code VARCHAR(50) NOT NULL,
    session_id INT NOT NULL,
    month_year_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'draft',
    timetable_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id),
    FOREIGN KEY (session_id) REFERENCES sessions_master(session_id),
    FOREIGN KEY (month_year_id) REFERENCES month_year_master(month_year_id),
    INDEX idx_notification_code (notification_code),
    INDEX idx_status (status),
    INDEX idx_programme (programme_id)
);

-- Create exam timetable entries table
CREATE TABLE IF NOT EXISTS exam_timetable_entries (
    timetable_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    exam_date DATE NOT NULL,
    branch_id INT NOT NULL,
    subject_id INT NOT NULL,
    session_order INT NOT NULL DEFAULT 1, -- For multiple sessions per day
    room_id INT NULL,
    invigilator_staff_id INT NULL,
    status ENUM('scheduled', 'cancelled', 'completed') DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES exam_notifications(notification_id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id),
    FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id),
    FOREIGN KEY (room_id) REFERENCES room_master(room_id),
    FOREIGN KEY (invigilator_staff_id) REFERENCES staff_master(staff_id),
    INDEX idx_notification_date (notification_id, exam_date),
    INDEX idx_branch_date (branch_id, exam_date),
    INDEX idx_subject (subject_id),
    UNIQUE KEY unique_schedule (notification_id, exam_date, branch_id, subject_id, session_order)
);

-- Create unassigned subjects table for tracking subjects not yet scheduled
CREATE TABLE IF NOT EXISTS exam_unassigned_subjects (
    unassigned_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    subject_id INT NOT NULL,
    branch_id INT NOT NULL,
    reason ENUM('no_dates_available', 'conflict', 'pending') DEFAULT 'pending',
    priority_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES exam_notifications(notification_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id),
    FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id),
    INDEX idx_notification (notification_id),
    INDEX idx_priority (notification_id, priority_order)
);

-- Insert sample data for testing
INSERT IGNORE INTO exam_notifications (
    notification_code, programme_id, semester_ids, regulation_ids, 
    exam_type, exam_name, exam_code, session_id, month_year_id, 
    start_date, end_date, status, created_by
) VALUES (
    'NOTIFICATION_B.TECH_SEM1_MIDTERM_OCT2024',
    1, -- Assuming B.Tech programme_id = 1
    '1,2', -- Semesters 1 and 2
    '1,2', -- Regulations 1 and 2
    'MIDTERM',
    'Mid Semester Examination',
    'MID2024',
    1, -- Assuming session_id = 1
    1, -- Assuming month_year_id = 1 (October 2024)
    '2024-10-15',
    '2024-10-25',
    'draft',
    'admin'
);
