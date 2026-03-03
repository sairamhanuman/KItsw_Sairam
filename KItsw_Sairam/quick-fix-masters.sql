-- Quick fix for missing master data
USE engineering_college;

-- Create programme table if not exists
CREATE TABLE IF NOT EXISTS programme_master (
    programme_id INT AUTO_INCREMENT PRIMARY KEY,
    programme_code VARCHAR(20) NOT NULL UNIQUE,
    programme_name VARCHAR(100) NOT NULL,
    programme_type VARCHAR(50) NOT NULL,
    duration_years INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create batch table if not exists
CREATE TABLE IF NOT EXISTS batch_master (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_name VARCHAR(20) NOT NULL UNIQUE,
    batch_code VARCHAR(20) NOT NULL,
    start_year INT NOT NULL,
    end_year INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create semester table if not exists
CREATE TABLE IF NOT EXISTS semester_master (
    semester_id INT AUTO_INCREMENT PRIMARY KEY,
    semester_name VARCHAR(20) NOT NULL UNIQUE,
    semester_code VARCHAR(10) NOT NULL,
    semester_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create regulation table if not exists
CREATE TABLE IF NOT EXISTS regulation_master (
    regulation_id INT AUTO_INCREMENT PRIMARY KEY,
    regulation_name VARCHAR(50) NOT NULL UNIQUE,
    regulation_code VARCHAR(20) NOT NULL,
    regulation_year INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert data
INSERT IGNORE INTO programme_master (programme_code, programme_name, programme_type, duration_years) VALUES
('BTECH', 'Bachelor of Technology', 'UG', 4),
('MTECH', 'Master of Technology', 'PG', 2),
('MBA', 'Master of Business Administration', 'PG', 2);

INSERT IGNORE INTO batch_master (batch_name, batch_code, start_year, end_year) VALUES
('2025-26', '2025-26', 2025, 2026),
('2026-27', '2026-27', 2026, 2027);

INSERT IGNORE INTO semester_master (semester_name, semester_code, semester_order) VALUES
('I', 'I', 1),
('II', 'II', 2),
('III', 'III', 3),
('IV', 'IV', 4);

INSERT IGNORE INTO regulation_master (regulation_name, regulation_code, regulation_year) VALUES
('URR-18', 'URR-18', 2018),
('URR-20', 'URR-20', 2020);
