-- Staff Master Table Migration
-- Complete schema for staff management system
-- Follows the pattern of student_master table

-- Drop existing table if you want to recreate it (CAUTION: This will delete all data!)
-- DROP TABLE IF EXISTS staff_master;

CREATE TABLE IF NOT EXISTS staff_master (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Basic Information
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    title_prefix ENUM('Mr', 'Ms', 'Mrs', 'Dr', 'Prof') DEFAULT 'Mr',
    full_name VARCHAR(255) NOT NULL,
    
    -- Department & Designation
    department_id INT,
    designation ENUM(
        'Principal',
        'Professor', 
        'Associate Professor', 
        'Assistant Professor', 
        'Lecturer',
        'Lab Assistant',
        'Superintendent',
        'Senior Assistant',
        'Junior Assistant',
        'Attender',
        'Lab Technician',
        'Librarian',
        'Office Assistant'
    ) NOT NULL,
    
    -- Personal Details
    date_of_birth DATE,
    gender ENUM('Male', 'Female', 'Other'),
    qualification VARCHAR(255),
    years_of_experience INT DEFAULT 0,
    mobile_number VARCHAR(15),
    email VARCHAR(255),
    date_of_joining DATE,
    emergency_contact VARCHAR(15),
    address TEXT,
    
    -- Account Details
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(11),
    pan_number VARCHAR(10),
    aadhaar_number VARCHAR(12),
    uan_number VARCHAR(50),
    basic_salary DECIMAL(10, 2),
    
    -- Status & Flags
    employment_status ENUM('Active', 'On Leave', 'Retired') DEFAULT 'Active',
    is_hod BOOLEAN DEFAULT FALSE,
    is_class_coordinator BOOLEAN DEFAULT FALSE,
    is_exam_invigilator BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    
    -- Photo
    photo_url VARCHAR(500),
    
    -- Soft Delete
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (department_id) REFERENCES branch_master(branch_id),
    
    -- Indexes
    INDEX idx_employee_id (employee_id),
    INDEX idx_designation (designation),
    INDEX idx_employment_status (employment_status),
    INDEX idx_is_active (is_active),
    INDEX idx_department (department_id)
);

-- Sample Data (Optional)
-- Uncomment to insert sample staff data
/*
INSERT INTO staff_master 
(employee_id, title_prefix, full_name, department_id, designation, gender, 
 date_of_birth, qualification, years_of_experience, mobile_number, email, 
 date_of_joining, employment_status) 
VALUES
('S1001', 'Dr', 'RAJESH KUMAR', 1, 'Professor', 'Male', 
 '1975-05-15', 'Ph.D in Computer Science', 20, '9876543210', 'rajesh.kumar@college.edu',
 '2005-07-01', 'Active'),
('S1002', 'Ms', 'PRIYA SHARMA', 1, 'Assistant Professor', 'Female',
 '1985-08-20', 'M.Tech in Computer Science', 10, '9876543211', 'priya.sharma@college.edu',
 '2014-08-15', 'Active'),
('S1003', 'Mr', 'SURESH REDDY', 2, 'Senior Assistant', 'Male',
 '1980-03-10', 'MBA', 15, '9876543212', 'suresh.reddy@college.edu',
 '2009-06-01', 'Active');
*/
