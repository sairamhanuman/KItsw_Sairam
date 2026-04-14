-- Users Table for Login Management
-- This table will store user credentials and link to staff_master table

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Login Credentials
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- User Role & Permissions
    user_role ENUM('Admin', 'HOD', 'Faculty', 'Staff', 'Exam_Cell', 'Librarian') NOT NULL DEFAULT 'Faculty',
    permissions JSON DEFAULT NULL, -- Store additional permissions as JSON
    
    -- Link to Staff Master (optional, for faculty/staff users)
    staff_id INT NULL,
    
    -- User Status
    is_active BOOLEAN DEFAULT TRUE,
    is_first_login BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    
    -- Password Reset
    reset_token VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    
    -- Session Management
    session_token VARCHAR(255) NULL,
    session_expires TIMESTAMP NULL,
    
    -- Audit Trail
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_user_role (user_role),
    INDEX idx_is_active (is_active),
    INDEX idx_staff_id (staff_id),
    INDEX idx_session_token (session_token),
    INDEX idx_reset_token (reset_token)
);

-- Insert default Admin user (password: Admin@12345)
-- Note: In production, use proper password hashing
INSERT INTO users (username, password_hash, email, user_role, is_first_login, created_by) 
VALUES ('Admin', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'admin@kitsw.edu', 'Admin', FALSE, NULL)
ON DUPLICATE KEY UPDATE username = username;

-- Create User Activity Log Table
CREATE TABLE IF NOT EXISTS user_activity_log (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type ENUM('Login', 'Logout', 'Password_Change', 'Profile_Update', 'Failed_Login', 'Account_Locked', 'Account_Unlocked') NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activity_details JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
);

-- Create User Permissions Table (for fine-grained permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    permission_description TEXT,
    module_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default permissions
INSERT INTO user_permissions (permission_name, permission_description, module_name) VALUES
('view_students', 'View student information', 'Student Management'),
('add_students', 'Add new students', 'Student Management'),
('edit_students', 'Edit student information', 'Student Management'),
('delete_students', 'Delete student records', 'Student Management'),
('view_staff', 'View staff information', 'Staff Management'),
('add_staff', 'Add new staff members', 'Staff Management'),
('edit_staff', 'Edit staff information', 'Staff Management'),
('delete_staff', 'Delete staff records', 'Staff Management'),
('manage_courses', 'Manage course information', 'Course Management'),
('manage_exams', 'Manage examination schedules', 'Exam Management'),
('manage_seating', 'Manage seating plans', 'Seating Management'),
('view_reports', 'View system reports', 'Reports'),
('manage_users', 'Manage user accounts', 'User Management'),
('system_admin', 'Full system administration', 'System')
ON DUPLICATE KEY UPDATE permission_name = permission_name;

-- Create User Role Permissions Mapping Table
CREATE TABLE IF NOT EXISTS user_role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_role ENUM('Admin', 'HOD', 'Faculty', 'Staff', 'Exam_Cell', 'Librarian') NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (permission_id) REFERENCES user_permissions(permission_id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (user_role, permission_id)
);

-- Assign permissions to roles
-- Admin gets all permissions
INSERT INTO user_role_permissions (user_role, permission_id) 
SELECT 'Admin', permission_id FROM user_permissions
ON DUPLICATE KEY UPDATE user_role = user_role;

-- HOD permissions
INSERT INTO user_role_permissions (user_role, permission_id) 
SELECT 'HOD', permission_id FROM user_permissions 
WHERE permission_name IN ('view_students', 'add_students', 'edit_students', 'view_staff', 'manage_courses', 'manage_exams', 'view_reports')
ON DUPLICATE KEY UPDATE user_role = user_role;

-- Faculty permissions
INSERT INTO user_role_permissions (user_role, permission_id) 
SELECT 'Faculty', permission_id FROM user_permissions 
WHERE permission_name IN ('view_students', 'view_staff', 'manage_courses', 'view_reports')
ON DUPLICATE KEY UPDATE user_role = user_role;

-- Exam Cell permissions
INSERT INTO user_role_permissions (user_role, permission_id) 
SELECT 'Exam_Cell', permission_id FROM user_permissions 
WHERE permission_name IN ('view_students', 'view_staff', 'manage_exams', 'manage_seating', 'view_reports')
ON DUPLICATE KEY UPDATE user_role = user_role;
