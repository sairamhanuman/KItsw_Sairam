-- =====================================================
-- SEATING PLAN MASTER TABLES
-- =====================================================
-- This script creates tables for comprehensive seating plan management
-- for examination purposes

-- 1. BLOCK MASTER TABLE
-- Stores building/block information
CREATE TABLE IF NOT EXISTS block_master (
    block_id INT AUTO_INCREMENT PRIMARY KEY,
    block_code VARCHAR(20) NOT NULL UNIQUE,
    block_name VARCHAR(100) NOT NULL,
    total_floors INT DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_block_code (block_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ROOM MASTER TABLE
-- Stores room/hall/lab information with seating layout
CREATE TABLE IF NOT EXISTS room_master (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    block_id INT NOT NULL,
    room_code VARCHAR(20) NOT NULL UNIQUE,
    room_name VARCHAR(100) NOT NULL,
    room_type ENUM('Classroom', 'Hall', 'Lab', 'Auditorium') DEFAULT 'Classroom',
    floor_number INT NOT NULL,
    
    -- Layout Configuration
    total_rows INT NOT NULL DEFAULT 5,
    total_columns INT NOT NULL DEFAULT 6,
    students_per_bench INT NOT NULL DEFAULT 1,
    
    -- Capacity Calculation: total_rows × total_columns × students_per_bench
    total_capacity INT GENERATED ALWAYS AS (total_rows * total_columns * students_per_bench) STORED,
    
    -- Layout Data (JSON format for visual representation)
    -- Format: {"benches": [{"row": 1, "col": 1, "available": true, "label": "A1"}, ...]}
    layout_data JSON,
    
    -- Additional Information
    has_projector BOOLEAN DEFAULT FALSE,
    has_ac BOOLEAN DEFAULT FALSE,
    description TEXT,
    remarks TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (block_id) REFERENCES block_master(block_id) ON DELETE CASCADE,
    INDEX idx_room_code (room_code),
    INDEX idx_block_id (block_id),
    INDEX idx_room_type (room_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. SEATING ARRANGEMENT TABLE
-- Stores actual seating arrangements for examinations
CREATE TABLE IF NOT EXISTS seating_arrangement (
    arrangement_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Exam Details
    exam_session_id INT NOT NULL,
    exam_date DATE NOT NULL,
    session_type VARCHAR(50) NOT NULL COMMENT 'FN/AN',
    
    -- Room Details
    room_id INT NOT NULL,
    
    -- Arrangement Details
    arrangement_name VARCHAR(200) NOT NULL,
    total_students_allocated INT DEFAULT 0,
    
    -- Seating Data (JSON format)
    -- Format: {"seats": [{"row": 1, "col": 1, "student_id": 123, "roll_number": "20CS001", "name": "John Doe"}, ...]}
    seating_data JSON,
    
    -- Status
    status ENUM('Draft', 'Confirmed', 'Published', 'Completed') DEFAULT 'Draft',
    
    -- Metadata
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    FOREIGN KEY (exam_session_id) REFERENCES exam_session_master(session_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES room_master(room_id) ON DELETE CASCADE,
    INDEX idx_exam_session (exam_session_id),
    INDEX idx_exam_date (exam_date),
    INDEX idx_room_id (room_id),
    INDEX idx_status (status),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_arrangement (exam_session_id, exam_date, session_type, room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SEATING TEMPLATE TABLE (Optional - for reusable layouts)
-- Stores predefined seating templates
CREATE TABLE IF NOT EXISTS seating_template (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL COMMENT 'Alternate, Department-wise, Random, etc.',
    description TEXT,
    
    -- Configuration (JSON format)
    -- Format: {"pattern": "alternate", "gap": 1, "departments": [...], "rules": {...}}
    configuration JSON,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_template_type (template_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample blocks
INSERT INTO block_master (block_code, block_name, total_floors, description) VALUES
('BLK-A', 'A Block (Main Building)', 3, 'Main academic block with classrooms and labs'),
('BLK-B', 'B Block (Engineering)', 4, 'Engineering departments block'),
('BLK-C', 'C Block (Administration)', 2, 'Administrative and auditorium block')
ON DUPLICATE KEY UPDATE block_name = VALUES(block_name);

-- Insert sample rooms
INSERT INTO room_master (block_id, room_code, room_name, room_type, floor_number, total_rows, total_columns, students_per_bench, has_projector, has_ac, layout_data) VALUES
(1, 'A-101', 'Room 101 - Classroom', 'Classroom', 1, 6, 5, 1, TRUE, TRUE, '{"benches": []}'),
(1, 'A-102', 'Room 102 - Classroom', 'Classroom', 1, 6, 6, 1, TRUE, FALSE, '{"benches": []}'),
(1, 'A-201', 'Room 201 - Lab', 'Lab', 2, 5, 8, 2, TRUE, TRUE, '{"benches": []}'),
(2, 'B-HALL', 'Main Hall', 'Hall', 1, 10, 10, 1, TRUE, TRUE, '{"benches": []}'),
(3, 'C-AUD', 'Auditorium', 'Auditorium', 1, 15, 12, 1, TRUE, TRUE, '{"benches": []}')
ON DUPLICATE KEY UPDATE room_name = VALUES(room_name);

-- Insert sample seating templates
INSERT INTO seating_template (template_name, template_type, description, configuration) VALUES
('Alternate Department', 'Department-wise', 'Alternate students from different departments', '{"pattern": "alternate", "gap": 1, "mix_departments": true}'),
('Random Mix', 'Random', 'Completely random seating arrangement', '{"pattern": "random", "seed": null}'),
('Branch Separation', 'Branch-wise', 'Separate students by branch with gaps', '{"pattern": "branch", "gap": 2, "group_by": "branch_id"}')
ON DUPLICATE KEY UPDATE template_name = VALUES(template_name);
