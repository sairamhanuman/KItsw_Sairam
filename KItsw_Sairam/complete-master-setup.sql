-- Complete Master Data Setup for Internal Exam System
USE engineering_college;

-- Create/Update Programme Master
CREATE TABLE IF NOT EXISTS programme_master (
    programme_id INT AUTO_INCREMENT PRIMARY KEY,
    programme_code VARCHAR(20) NOT NULL UNIQUE,
    programme_name VARCHAR(100) NOT NULL,
    programme_type VARCHAR(50) NOT NULL,
    duration_years DECIMAL(3,1) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert/Update Programme Data
INSERT INTO programme_master (programme_code, programme_name, programme_type, duration_years, description) VALUES
('BTECH', 'Bachelor of Technology', 'UG', 4.0, 'Four-year undergraduate engineering program'),
('MTECH', 'Master of Technology', 'PG', 2.0, 'Two-year postgraduate engineering program'),
('MBA', 'Master of Business Administration', 'PG', 2.0, 'Two-year management program')
ON DUPLICATE KEY UPDATE programme_name = VALUES(programme_name);

-- Create/Update Batch Master
CREATE TABLE IF NOT EXISTS batch_master (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_year INT NOT NULL UNIQUE,
    batch_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert/Update Batch Data
INSERT INTO batch_master (batch_year, batch_name, start_date, end_date, description) VALUES
(2025, '2025-26', '2025-08-01', '2029-05-31', 'Batch admitted in 2025'),
(2026, '2026-27', '2026-08-01', '2030-05-31', 'Batch admitted in 2026'),
(2024, '2024-25', '2024-08-01', '2028-05-31', 'Batch admitted in 2024'),
(2023, '2023-24', '2023-08-01', '2027-05-31', 'Batch admitted in 2023')
ON DUPLICATE KEY UPDATE batch_name = VALUES(batch_name);

-- Create/Update Semester Master
CREATE TABLE IF NOT EXISTS semester_master (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_number INT NOT NULL UNIQUE,
    semester_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert/Update Semester Data
INSERT INTO semester_master (semester_number, semester_name, description) VALUES
(1, 'I', 'First semester'),
(2, 'II', 'Second semester'),
(3, 'III', 'Third semester'),
(4, 'IV', 'Fourth semester')
ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name);

-- Create/Update Regulation Master
CREATE TABLE IF NOT EXISTS regulation_master (
    regulation_id INT AUTO_INCREMENT PRIMARY KEY,
    regulation_code VARCHAR(20) NOT NULL UNIQUE,
    regulation_name VARCHAR(100) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert/Update Regulation Data
INSERT INTO regulation_master (regulation_code, regulation_name, effective_from, description) VALUES
('R18', 'Regulation 2018', '2018-08-01', 'Academic regulation effective from 2018'),
('R20', 'Regulation 2020', '2020-08-01', 'Academic regulation effective from 2020'),
('R22', 'Regulation 2022', '2022-08-01', 'Academic regulation effective from 2022')
ON DUPLICATE KEY UPDATE regulation_name = VALUES(regulation_name);

-- Verify data insertion
SELECT 'Programmes:' as table_name, COUNT(*) as count FROM programme_master WHERE is_active = 1
UNION ALL
SELECT 'Batches:', COUNT(*) FROM batch_master WHERE is_active = 1  
UNION ALL
SELECT 'Semesters:', COUNT(*) FROM semester_master WHERE is_active = 1
UNION ALL
SELECT 'Regulations:', COUNT(*) FROM regulation_master WHERE is_active = 1;
