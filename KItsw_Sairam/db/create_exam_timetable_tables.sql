-- =====================================================
-- EXAM TIMETABLE MANAGEMENT TABLES
-- =====================================================
-- This script creates tables for comprehensive exam timetable management

-- 1. EXAM TIMETABLE MASTER TABLE
-- Main exam timetable entries
CREATE TABLE IF NOT EXISTS exam_timetable (
    timetable_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_session_id INT NOT NULL,
    exam_name VARCHAR(200) NOT NULL,
    exam_type_id INT NOT NULL,
    programme_id INT NOT NULL,
    branch_id INT NOT NULL,
    semester_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    
    -- Scheduling Information
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    exam_duration_minutes INT NOT NULL DEFAULT 120,
    
    -- Configuration
    max_students_per_room INT DEFAULT 30,
    seating_pattern ENUM('branch_wise', 'section_wise', 'roll_number_wise') DEFAULT 'branch_wise',
    requires_seating_arrangement BOOLEAN DEFAULT TRUE,
    
    -- Status
    status ENUM('Draft', 'Published', 'Cancelled', 'Completed') DEFAULT 'Draft',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by INT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id) ON DELETE CASCADE,
    FOREIGN KEY (exam_type_id) REFERENCES mse_exam_type_master(exam_type_id) ON DELETE RESTRICT,
    FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id) ON DELETE RESTRICT,
    FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id) ON DELETE RESTRICT,
    FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id) ON DELETE RESTRICT,
    
    -- Indexes
    INDEX idx_exam_session (exam_session_id),
    INDEX idx_exam_type (exam_type_id),
    INDEX idx_programme_branch (programme_id, branch_id),
    INDEX idx_semester (semester_id),
    INDEX idx_academic_year (academic_year),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. EXAM SCHEDULE DETAILS TABLE
-- Detailed exam schedule with subjects and venues
CREATE TABLE IF NOT EXISTS exam_schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    timetable_id INT NOT NULL,
    subject_id INT NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Venue Information
    room_id INT,
    block_id INT,
    
    -- Capacity Management
    total_students INT DEFAULT 0,
    allocated_students INT DEFAULT 0,
    
    -- Invigilation
    chief_invigilator_id INT,
    supporting_invigilator_ids JSON,
    
    -- Special Requirements
    special_instructions TEXT,
    equipment_required JSON,
    
    -- Status
    status ENUM('Scheduled', 'Confirmed', 'Cancelled', 'Completed') DEFAULT 'Scheduled',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Foreign Keys
    FOREIGN KEY (timetable_id) REFERENCES exam_timetable(timetable_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subject_master(subject_id) ON DELETE RESTRICT,
    FOREIGN KEY (room_id) REFERENCES room_master(room_id) ON DELETE SET NULL,
    FOREIGN KEY (block_id) REFERENCES block_master(block_id) ON DELETE SET NULL,
    FOREIGN KEY (chief_invigilator_id) REFERENCES staff_master(staff_id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_timetable (timetable_id),
    INDEX idx_subject (subject_id),
    INDEX idx_room (room_id),
    INDEX idx_date_time (exam_date, start_time),
    INDEX idx_status (status),
    INDEX idx_invigilator (chief_invigilator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. EXAM INVIGILATOR ASSIGNMENT TABLE
-- Detailed invigilator assignments and availability
CREATE TABLE IF NOT EXISTS exam_invigilator_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    staff_id INT NOT NULL,
    role ENUM('Chief Invigilator', 'Supporting Invigilator', 'Additional Support') NOT NULL,
    
    -- Assignment Details
    assigned_date DATE NOT NULL,
    assigned_by INT,
    assignment_status ENUM('Assigned', 'Confirmed', 'Declined', 'Reassigned') DEFAULT 'Assigned',
    
    -- Compensation
    duty_hours DECIMAL(4,2) DEFAULT 0.00,
    compensation_amount DECIMAL(8,2) DEFAULT 0.00,
    payment_status ENUM('Pending', 'Approved', 'Paid') DEFAULT 'Pending',
    
    -- Availability
    is_available BOOLEAN DEFAULT TRUE,
    unavailability_reason TEXT,
    
    -- Metadata
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (schedule_id) REFERENCES exam_schedule(schedule_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES staff_master(staff_id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_schedule (schedule_id),
    INDEX idx_staff (staff_id),
    INDEX idx_assigned_date (assigned_date),
    INDEX idx_role (role),
    INDEX idx_status (assignment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. EXAM CONFLICT DETECTION TABLE
-- Track and manage exam conflicts
CREATE TABLE IF NOT EXISTS exam_conflicts (
    conflict_id INT AUTO_INCREMENT PRIMARY KEY,
    conflict_type ENUM('Student Clash', 'Faculty Clash', 'Room Clash', 'Time Clash', 'Resource Clash') NOT NULL,
    
    -- Conflicting Entities
    entity1_type ENUM('Schedule', 'Student', 'Staff', 'Room') NOT NULL,
    entity1_id INT NOT NULL,
    entity2_type ENUM('Schedule', 'Student', 'Staff', 'Room') NOT NULL,
    entity2_id INT NOT NULL,
    
    -- Conflict Details
    conflict_date DATE NOT NULL,
    conflict_time_start TIME NOT NULL,
    conflict_time_end TIME NOT NULL,
    conflict_description TEXT NOT NULL,
    
    -- Resolution
    resolution_status ENUM('Pending', 'Resolved', 'Escalated', 'Ignored') DEFAULT 'Pending',
    resolution_method TEXT,
    resolved_by INT,
    resolved_at TIMESTAMP NULL,
    
    -- Priority
    priority ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_conflict_date (conflict_date),
    INDEX idx_conflict_type (conflict_type),
    INDEX idx_resolution_status (resolution_status),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. EXAM TIMETABLE SETTINGS TABLE
-- System configuration for timetable management
CREATE TABLE IF NOT EXISTS exam_timetable_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE DATA FOR EXAM TIMETABLE SETTINGS
-- =====================================================

INSERT INTO exam_timetable_settings (setting_key, setting_value, setting_type, description) VALUES
('timetable.default_exam_duration', '120', 'NUMBER', 'Default exam duration in minutes'),
('timetable.max_students_per_room', '30', 'NUMBER', 'Maximum students allowed per examination room'),
('timetable.break_between_exams', '30', 'NUMBER', 'Break time between exams in minutes'),
('timetable.max_exams_per_day', '2', 'NUMBER', 'Maximum exams allowed per day per student'),
('timetable.auto_assign_invigilators', 'true', 'BOOLEAN', 'Automatically assign invigilators based on availability'),
('timetable.require_hod_approval', 'true', 'BOOLEAN', 'Require HOD approval for timetable publication'),
('timetable.conflict_check_enabled', 'true', 'BOOLEAN', 'Enable automatic conflict detection'),
('timetable.notification_days_before', '7', 'NUMBER', 'Days before exam to send notifications'),
('timetable.seating_gap_minutes', '15', 'NUMBER', 'Gap between students in seating arrangement'),
('timetable.working_hours_start', '09:00', 'STRING', 'Standard working hours start time'),
('timetable.working_hours_end', '17:00', 'STRING', 'Standard working hours end time'),
('timetable.lunch_break_start', '13:00', 'STRING', 'Lunch break start time'),
('timetable.lunch_break_end', '14:00', 'STRING', 'Lunch break end time'),
('timetable.weekend_exams', 'false', 'BOOLEAN', 'Allow exams on weekends'),
('timetable.holiday_check', 'true', 'BOOLEAN', 'Check for holidays while scheduling')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_timetable_composite ON exam_timetable(programme_id, branch_id, semester_id, academic_year, status);
CREATE INDEX idx_schedule_composite ON exam_schedule(exam_date, start_time, room_id, status);
CREATE INDEX idx_invigilator_composite ON exam_invigilator_assignments(staff_id, assigned_date, assignment_status);

-- =====================================================
-- TRIGGERS FOR DATA INTEGRITY
-- =====================================================

DELIMITER //

-- Trigger to validate exam dates
CREATE TRIGGER validate_exam_timetable_dates
BEFORE INSERT ON exam_timetable
FOR EACH ROW
BEGIN
    IF NEW.start_date > NEW.end_date THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Start date cannot be after end date';
    END IF;
END//

-- Trigger to update allocated students count (will be activated when student registrations are implemented)
-- CREATE TRIGGER update_allocated_students
-- AFTER INSERT ON exam_schedule
-- FOR EACH ROW
-- BEGIN
--     UPDATE exam_timetable 
--     SET allocated_students = (
--         SELECT COUNT(DISTINCT student_id) 
--         FROM exam_student_registrations 
--         WHERE schedule_id = NEW.schedule_id
--     )
--     WHERE timetable_id = NEW.timetable_id;
-- END//

DELIMITER ;
