-- =====================================================
-- MSE (INTERNAL EXAM) MANAGEMENT TABLES
-- =====================================================
-- This script creates tables for Mid-Semester Examination management

-- 1. MSE EXAM TYPE MASTER TABLE
-- Stores different types of internal examinations
CREATE TABLE IF NOT EXISTS mse_exam_type_master (
    exam_type_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_type_code VARCHAR(20) NOT NULL UNIQUE,
    exam_type_name VARCHAR(100) NOT NULL,
    exam_category ENUM('MSE', 'Class Test', 'Internal Assessment', 'Lab Exam', 'Viva Voce') NOT NULL,
    description TEXT,
    
    -- Configuration
    max_marks INT DEFAULT 50,
    duration_minutes INT DEFAULT 120,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Rules
    requires_invigilator BOOLEAN DEFAULT TRUE,
    allows_multiple_sections BOOLEAN DEFAULT FALSE,
    gap_required_minutes INT DEFAULT 0 COMMENT 'Gap before next exam for same department',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_exam_type_code (exam_type_code),
    INDEX idx_exam_category (exam_category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. MSE CONFIGURATION TABLE
-- Stores MSE system configuration and rules
CREATE TABLE IF NOT EXISTS mse_configuration (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MSE NOTIFICATION TEMPLATES TABLE
-- Stores templates for MSE notifications
CREATE TABLE IF NOT EXISTS mse_notification_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    template_type ENUM('MSE Announcement', 'MSE Schedule', 'MSE Results', 'MSE Reminder') NOT NULL,
    subject_template VARCHAR(500) NOT NULL,
    body_template TEXT NOT NULL,
    sms_template VARCHAR(500) NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_template_type (template_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE DATA FOR MSE SYSTEM
-- =====================================================

-- Insert MSE Exam Types
INSERT INTO mse_exam_type_master (exam_type_code, exam_type_name, exam_category, description, max_marks, duration_minutes, gap_required_minutes) VALUES
('MSE-1', 'MSE - I', 'MSE', 'First Mid-Semester Examination', 50, 120, 1440),
('MSE-2', 'MSE - II', 'MSE', 'Second Mid-Semester Examination', 50, 120, 1440),
('CT-1', 'Class Test - I', 'Class Test', 'First Class Test', 30, 60, 480),
('CT-2', 'Class Test - II', 'Class Test', 'Second Class Test', 30, 60, 480),
('IA-1', 'Internal Assessment - I', 'Internal Assessment', 'First Internal Assessment', 25, 90, 720),
('LAB-1', 'Lab Examination - I', 'Lab Exam', 'First Laboratory Examination', 50, 180, 1440),
('VIVA-1', 'Viva Voce - I', 'Viva Voce', 'First Viva Voce Examination', 25, 30, 240)
ON DUPLICATE KEY UPDATE exam_type_name = VALUES(exam_type_name);

-- Insert MSE Configuration
INSERT INTO mse_configuration (config_key, config_value, config_type, description) VALUES
('mse.default_gap_hours', '24', 'NUMBER', 'Default gap in hours between MSE exams for same department'),
('mse.max_students_per_room', '30', 'NUMBER', 'Maximum students allowed per room for MSE'),
('mse.require_hod_approval', 'true', 'BOOLEAN', 'Require HOD approval for MSE notifications'),
('mse.auto_assign_invigilators', 'true', 'BOOLEAN', 'Automatically assign internal faculty as invigilators'),
('mse.hall_ticket_days_before', '7', 'NUMBER', 'Days before MSE to generate hall tickets'),
('mse.notification_channels', '["email", "sms", "notice_board"]', 'JSON', 'Available notification channels for MSE'),
('mse.seating_pattern', 'branch_wise', 'STRING', 'Default seating pattern for MSE'),
('mse.allow_same_day_exams', 'false', 'BOOLEAN', 'Allow multiple MSE exams on same day for different subjects')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- Insert MSE Notification Templates
INSERT INTO mse_notification_templates (template_name, template_type, subject_template, body_template, sms_template, is_default) VALUES
('MSE Announcement Default', 'MSE Announcement', 
 'MSE Notification - {{exam_name}} - {{programme_name}}',
 'Dear Students,\n\nThis is to inform you that {{exam_name}} for {{programme_name}} - {{branch_name}} will be conducted as per the following schedule:\n\n{{exam_details}}\n\nImportant Instructions:\n1. Report to the venue 30 minutes before the exam time\n2. Carry your college ID card\n3. No electronic devices allowed\n4. Follow the seating arrangement displayed on the notice board\n\nFor any queries, contact the department office.\n\nBest regards,\n{{department_name}}',
 'MSE {{exam_name}} for {{programme_name}}. Check college notice board for details. Report 30 mins early with ID card.',
 TRUE),

('MSE Schedule Default', 'MSE Schedule',
 'MSE Schedule - {{exam_session_name}}',
 'Dear Students,\n\nThe detailed schedule for {{exam_session_name}} is as follows:\n\n{{schedule_details}}\n\nVenue details and seating arrangements will be displayed on the notice board 3 days before the exams.\n\nPlease note the following:\n- Carry your hall ticket and college ID\n- Reach the venue 30 minutes before exam time\n- No re-evaluation requests will be entertained\n\nBest regards,\nExamination Cell',
 'MSE Schedule for {{exam_session_name}} published. Check notice board for venue and seating details.',
 TRUE)
ON DUPLICATE KEY UPDATE template_name = VALUES(template_name);
