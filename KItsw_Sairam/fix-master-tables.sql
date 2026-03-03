-- Fix Master Tables to Match Code Requirements

USE engineering_college;

-- Drop and recreate exams_naming_master with correct structure
DROP TABLE IF EXISTS exams_naming_master;

CREATE TABLE exams_naming_master (
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

-- Drop and recreate exam_types_master with correct structure
DROP TABLE IF EXISTS exam_types_master;

CREATE TABLE exam_types_master (
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
