-- Create Master Tables for Exam Management System

USE engineering_college;

-- Sessions Master Table
CREATE TABLE IF NOT EXISTS sessions_master (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    session_name VARCHAR(100) NOT NULL UNIQUE,
    session_type VARCHAR(50) NOT NULL COMMENT 'e.g., Regular, Special, Practical',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_name (session_name),
    INDEX idx_session_type (session_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Month/Year Master Table
CREATE TABLE IF NOT EXISTS month_year_master (
    month_year_id INT AUTO_INCREMENT PRIMARY KEY,
    month_name VARCHAR(20) NOT NULL,
    year_value INT NOT NULL,
    month_number INT NOT NULL COMMENT '1-12 for January-December',
    display_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_month_year (month_name, year_value),
    INDEX idx_year_value (year_value),
    INDEX idx_month_number (month_number),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exams Naming Master Table
CREATE TABLE IF NOT EXISTS exams_naming_master (
    exam_naming_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_name VARCHAR(200) NOT NULL,
    exam_code VARCHAR(20) NOT NULL UNIQUE,
    exam_type VARCHAR(50) NOT NULL COMMENT 'e.g., Internal, External, Practical, Viva',
    max_marks INT NOT NULL,
    duration_minutes INT NOT NULL,
    passing_marks INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exam_name (exam_name),
    INDEX idx_exam_code (exam_code),
    INDEX idx_exam_type (exam_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam Types Master Table
CREATE TABLE IF NOT EXISTS exam_types_master (
    exam_type_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_type_name VARCHAR(200) NOT NULL,
    exam_type_code VARCHAR(20) NOT NULL UNIQUE,
    exam_category VARCHAR(50) NOT NULL COMMENT 'e.g., Internal, External, Practical, Viva, Project',
    weightage DECIMAL(5,2) COMMENT 'Weightage percentage',
    min_passing_percentage DECIMAL(5,2) COMMENT 'Minimum passing percentage',
    max_attempts INT COMMENT 'Maximum attempts allowed',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exam_type_name (exam_type_name),
    INDEX idx_exam_type_code (exam_type_code),
    INDEX idx_exam_category (exam_category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Sample Data for Sessions Master
INSERT INTO sessions_master (session_name, session_type, start_time, end_time) VALUES
('FN', 'Regular', '09:00:00', '12:00:00'),
('AN', 'Regular', '14:00:00', '17:00:00'),
('Evening', 'Special', '18:00:00', '21:00:00'),
('Practical', 'Practical', '10:00:00', '13:00:00')
ON DUPLICATE KEY UPDATE session_name = VALUES(session_name);

-- Insert Sample Data for Month/Year Master
INSERT INTO month_year_master (month_name, year_value, month_number, display_name) VALUES
('January', 2026, 1, 'January 2026'),
('February', 2026, 2, 'February 2026'),
('March', 2026, 3, 'March 2026'),
('April', 2026, 4, 'April 2026'),
('May', 2026, 5, 'May 2026'),
('June', 2026, 6, 'June 2026'),
('July', 2026, 7, 'July 2026'),
('August', 2026, 8, 'August 2026'),
('September', 2026, 9, 'September 2026'),
('October', 2026, 10, 'October 2026'),
('November', 2026, 11, 'November 2026'),
('December', 2026, 12, 'December 2026')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Insert Sample Data for Exams Naming Master
INSERT INTO exams_naming_master (exam_name, exam_code, exam_type, max_marks, duration_minutes, passing_marks, description) VALUES
('Mid-Term Examination 1', 'MT1', 'Internal', 50, 120, 18, 'First mid-term examination'),
('Mid-Term Examination 2', 'MT2', 'Internal', 50, 120, 18, 'Second mid-term examination'),
('Final Examination', 'FE', 'External', 100, 180, 35, 'Final semester examination'),
('Practical Examination', 'PE', 'Practical', 50, 180, 20, 'Practical examination'),
('Viva Voce', 'VV', 'Viva', 25, 30, 10, 'Viva voce examination')
ON DUPLICATE KEY UPDATE exam_name = VALUES(exam_name);

-- Insert Sample Data for Exam Types Master
INSERT INTO exam_types_master (exam_type_name, exam_type_code, exam_category, weightage, min_passing_percentage, max_attempts, description) VALUES
('Internal Assessment', 'INT', 'Internal', 30.00, 35.00, 3, 'Internal assessment tests'),
('External Examination', 'EXT', 'External', 70.00, 35.00, 5, 'External university examinations'),
('Practical Examination', 'PRACT', 'Practical', 25.00, 40.00, 3, 'Practical laboratory examinations'),
('Viva Voce', 'VIVA', 'Viva', 15.00, 40.00, 2, 'Oral viva examinations'),
('Project Work', 'PROJ', 'Project', 20.00, 40.00, 2, 'Project work evaluation')
ON DUPLICATE KEY UPDATE exam_type_name = VALUES(exam_type_name);
