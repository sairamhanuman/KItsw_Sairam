-- Engineering College Database Schema

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS engineering_college;
USE engineering_college;

-- Programme Master Table
CREATE TABLE IF NOT EXISTS programme_master (
    programme_id INT AUTO_INCREMENT PRIMARY KEY,
    programme_code VARCHAR(20) NOT NULL UNIQUE,
    programme_name VARCHAR(100) NOT NULL,
    programme_type VARCHAR(50) NOT NULL COMMENT 'e.g., UG, PG, Ph.D.',
    duration_years DECIMAL(3,1) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_programme_code (programme_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data
INSERT INTO programme_master (programme_code, programme_name, programme_type, duration_years, description) VALUES
('BTECH', 'Bachelor of Technology', 'UG', 4.0, 'Four-year undergraduate engineering program'),
('MTECH', 'Master of Technology', 'PG', 2.0, 'Two-year postgraduate engineering program'),
('PHD', 'Doctor of Philosophy', 'Ph.D.', 3.0, 'Doctoral research program in engineering'),
('MBA', 'Master of Business Administration', 'PG', 2.0, 'Two-year management program')
ON DUPLICATE KEY UPDATE programme_name = VALUES(programme_name);

-- Branch Master Table
CREATE TABLE IF NOT EXISTS branch_master (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_code VARCHAR(20) NOT NULL UNIQUE,
    branch_name VARCHAR(100) NOT NULL,
    programme_id INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_branch_code (branch_code),
    INDEX idx_programme_id (programme_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for branches
INSERT INTO branch_master (branch_code, branch_name, programme_id, description) VALUES
('CSE', 'Computer Science and Engineering', 1, 'Computer Science and Engineering branch'),
('ECE', 'Electronics and Communication Engineering', 1, 'Electronics and Communication Engineering branch'),
('MECH', 'Mechanical Engineering', 1, 'Mechanical Engineering branch'),
('CIVIL', 'Civil Engineering', 1, 'Civil Engineering branch'),
('EEE', 'Electrical and Electronics Engineering', 1, 'Electrical and Electronics Engineering branch')
ON DUPLICATE KEY UPDATE branch_name = VALUES(branch_name);

-- Batch Master Table
CREATE TABLE IF NOT EXISTS batch_master (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_year INT NOT NULL UNIQUE,
    batch_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_batch_year (batch_year),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for batches
INSERT INTO batch_master (batch_year, batch_name, start_date, end_date, description) VALUES
(2021, 'Batch 2021', '2021-08-01', '2025-05-31', 'Batch admitted in 2021'),
(2022, 'Batch 2022', '2022-08-01', '2026-05-31', 'Batch admitted in 2022'),
(2023, 'Batch 2023', '2023-08-01', '2027-05-31', 'Batch admitted in 2023'),
(2024, 'Batch 2024', '2024-08-01', '2028-05-31', 'Batch admitted in 2024')
ON DUPLICATE KEY UPDATE batch_name = VALUES(batch_name);

-- Semesters Master Table
CREATE TABLE IF NOT EXISTS semester_master (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_number INT NOT NULL UNIQUE,
    semester_name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_semester_number (semester_number),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for semesters
INSERT INTO semester_master (semester_number, semester_name, description) VALUES
(1, 'Semester I', 'First semester'),
(2, 'Semester II', 'Second semester'),
(3, 'Semester III', 'Third semester'),
(4, 'Semester IV', 'Fourth semester'),
(5, 'Semester V', 'Fifth semester'),
(6, 'Semester VI', 'Sixth semester'),
(7, 'Semester VII', 'Seventh semester'),
(8, 'Semester VIII', 'Eighth semester')
ON DUPLICATE KEY UPDATE semester_name = VALUES(semester_name);

-- Regulation Master Table
CREATE TABLE IF NOT EXISTS regulation_master (
    regulation_id INT AUTO_INCREMENT PRIMARY KEY,
    regulation_code VARCHAR(20) NOT NULL UNIQUE,
    regulation_name VARCHAR(100) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_regulation_code (regulation_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for regulations
INSERT INTO regulation_master (regulation_code, regulation_name, effective_from, description) VALUES
('R20', 'Regulation 2020', '2020-08-01', 'Academic regulation effective from 2020'),
('R21', 'Regulation 2021', '2021-08-01', 'Academic regulation effective from 2021'),
('R22', 'Regulation 2022', '2022-08-01', 'Academic regulation effective from 2022'),
('R23', 'Regulation 2023', '2023-08-01', 'Academic regulation effective from 2023')
ON DUPLICATE KEY UPDATE regulation_name = VALUES(regulation_name);

-- Section Master Table
CREATE TABLE IF NOT EXISTS section_master (
    section_id INT AUTO_INCREMENT PRIMARY KEY,
    section_code VARCHAR(20) NOT NULL UNIQUE,
    section_name VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 60,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_section_code (section_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for sections
INSERT INTO section_master (section_code, section_name, capacity, description) VALUES
('A', 'Section A', 60, 'Section A'),
('B', 'Section B', 60, 'Section B'),
('C', 'Section C', 60, 'Section C'),
('D', 'Section D', 60, 'Section D')
ON DUPLICATE KEY UPDATE section_name = VALUES(section_name);

-- Exam Sessions Master Table
CREATE TABLE IF NOT EXISTS exam_session_master (
    exam_session_id INT AUTO_INCREMENT PRIMARY KEY,
    session_code VARCHAR(20) NOT NULL UNIQUE,
    session_name VARCHAR(100) NOT NULL,
    exam_month VARCHAR(20) NOT NULL,
    exam_year INT NOT NULL,
    start_date DATE,
    end_date DATE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_code (session_code),
    INDEX idx_exam_year (exam_year),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for exam sessions
INSERT INTO exam_session_master (session_code, session_name, exam_month, exam_year, start_date, end_date, description) VALUES
('MAY2024', 'May 2024 Examination', 'May', 2024, '2024-05-01', '2024-05-31', 'Regular examination session for May 2024'),
('NOV2024', 'November 2024 Examination', 'November', 2024, '2024-11-01', '2024-11-30', 'Regular examination session for November 2024'),
('MAY2025', 'May 2025 Examination', 'May', 2025, '2025-05-01', '2025-05-31', 'Regular examination session for May 2025')
ON DUPLICATE KEY UPDATE session_name = VALUES(session_name);

-- Student Management Table
CREATE TABLE IF NOT EXISTS student_master (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    roll_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(15),
    date_of_birth DATE,
    admission_year INT NOT NULL,
    programme_id INT NOT NULL,
    branch_id INT NOT NULL,
    batch_id INT NOT NULL,
    regulation_id INT NOT NULL,
    section_id INT NOT NULL,
    current_semester INT DEFAULT 1,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_roll_number (roll_number),
    INDEX idx_email (email),
    INDEX idx_programme_id (programme_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_regulation_id (regulation_id),
    INDEX idx_section_id (section_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id) ON DELETE RESTRICT,
    FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES batch_master(batch_id) ON DELETE RESTRICT,
    FOREIGN KEY (regulation_id) REFERENCES regulation_master(regulation_id) ON DELETE RESTRICT,
    FOREIGN KEY (section_id) REFERENCES section_master(section_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for students
INSERT INTO student_master (roll_number, first_name, last_name, email, phone, date_of_birth, admission_year, programme_id, branch_id, batch_id, regulation_id, section_id, current_semester) VALUES
('21CS001', 'Rajesh', 'Kumar', 'rajesh.kumar@example.com', '9876543210', '2003-05-15', 2021, 1, 1, 1, 1, 1, 8),
('21CS002', 'Priya', 'Sharma', 'priya.sharma@example.com', '9876543211', '2003-08-20', 2021, 1, 1, 1, 1, 1, 8),
('22CS001', 'Amit', 'Patel', 'amit.patel@example.com', '9876543212', '2004-03-10', 2022, 1, 1, 2, 2, 1, 6),
('23CS001', 'Sneha', 'Reddy', 'sneha.reddy@example.com', '9876543213', '2005-01-25', 2023, 1, 1, 3, 3, 2, 4),
('24CS001', 'Karthik', 'Rao', 'karthik.rao@example.com', '9876543214', '2006-07-12', 2024, 1, 1, 4, 4, 2, 2)
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);
