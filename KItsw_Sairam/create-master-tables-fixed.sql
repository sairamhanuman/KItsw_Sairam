-- Create Master Tables for Exam Management System

USE engineering_college;

-- Programme Master Table
CREATE TABLE IF NOT EXISTS programme_master (
    programme_id INT AUTO_INCREMENT PRIMARY KEY,
    programme_code VARCHAR(20) NOT NULL UNIQUE,
    programme_name VARCHAR(100) NOT NULL,
    programme_type VARCHAR(50) NOT NULL COMMENT 'e.g., UG, PG, Diploma',
    duration_years INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_programme_code (programme_code),
    INDEX idx_programme_name (programme_name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Batch Master Table
CREATE TABLE IF NOT EXISTS batch_master (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_name VARCHAR(20) NOT NULL UNIQUE,
    batch_code VARCHAR(20) NOT NULL,
    start_year INT NOT NULL,
    end_year INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_batch_name (batch_name),
    INDEX idx_batch_code (batch_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semester Master Table
CREATE TABLE IF NOT EXISTS semester_master (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_name VARCHAR(20) NOT NULL UNIQUE,
    semester_code VARCHAR(10) NOT NULL,
    semester_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_semester_name (semester_name),
    INDEX idx_semester_order (semester_order),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Regulation Master Table
CREATE TABLE IF NOT EXISTS regulation_master (
    regulation_id INT AUTO_INCREMENT PRIMARY KEY,
    regulation_name VARCHAR(50) NOT NULL UNIQUE,
    regulation_code VARCHAR(20) NOT NULL,
    regulation_year INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_regulation_name (regulation_name),
    INDEX idx_regulation_code (regulation_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam Types Master Table
CREATE TABLE IF NOT EXISTS exam_types_master (
    exam_type_id INT AUTO_INCREMENT PRIMARY KEY,
    exam_type_name VARCHAR(50) NOT NULL UNIQUE,
    exam_type_code VARCHAR(20) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exam_type_name (exam_type_name),
    INDEX idx_exam_type_code (exam_type_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- Insert sample data for programmes
INSERT IGNORE INTO programme_master (programme_code, programme_name, programme_type, duration_years) VALUES
('BTECH', 'Bachelor of Technology', 'UG', 4),
('MTECH', 'Master of Technology', 'PG', 2),
('MBA', 'Master of Business Administration', 'PG', 2),
('MCA', 'Master of Computer Applications', 'PG', 3);

-- Insert sample data for batches
INSERT IGNORE INTO batch_master (batch_name, batch_code, start_year, end_year) VALUES
('2025-26', '2025-26', 2025, 2026),
('2026-27', '2026-27', 2026, 2027),
('2024-25', '2024-25', 2024, 2025);

-- Insert sample data for semesters
INSERT IGNORE INTO semester_master (semester_name, semester_code, semester_order) VALUES
('I', 'I', 1),
('II', 'II', 2),
('III', 'III', 3),
('IV', 'IV', 4);

-- Insert sample data for regulations
INSERT IGNORE INTO regulation_master (regulation_name, regulation_code, regulation_year) VALUES
('URR-18', 'URR-18', 2018),
('URR-20', 'URR-20', 2020),
('URR-22', 'URR-22', 2022);

-- Insert sample data for exam types
INSERT IGNORE INTO exam_types_master (exam_type_name, exam_type_code) VALUES
('Internal', 'INT'),
('External', 'EXT'),
('Practical', 'PRA'),
('Viva', 'VIV');

-- Insert sample data for sessions
INSERT IGNORE INTO sessions_master (session_name, session_type, start_time, end_time) VALUES
('Forenoon', 'Regular', '09:00:00', '12:00:00'),
('Afternoon', 'Regular', '14:00:00', '17:00:00');

-- Insert sample data for month/year
INSERT IGNORE INTO month_year_master (month_name, year_value, month_number, display_name) VALUES
('February', 2026, 2, 'February 2026'),
('March', 2026, 3, 'March 2026'),
('April', 2026, 4, 'April 2026');

-- Insert sample data for exams naming
INSERT IGNORE INTO exams_naming_master (exam_name, exam_code, exam_type, max_marks, duration_minutes, passing_marks) VALUES
('Mid-Term Examination 1', 'MT1', 'Internal', 30, 90, 12),
('Mid-Term Examination 2', 'MT2', 'Internal', 30, 90, 12),
('Final Examination', 'FINAL', 'External', 100, 180, 35),
('Practical Examination', 'PRA', 'Practical', 50, 120, 20);
