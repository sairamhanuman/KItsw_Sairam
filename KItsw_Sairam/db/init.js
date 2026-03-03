/**
 * Database Initialization Module
 * Creates all necessary tables if they don't exist
 */

const tableSchemas = {
    block_master: `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    
    room_master: `
        CREATE TABLE IF NOT EXISTS room_master (
            room_id INT AUTO_INCREMENT PRIMARY KEY,
            block_id INT NOT NULL,
            room_code VARCHAR(20) NOT NULL UNIQUE,
            room_name VARCHAR(100) NOT NULL,
            room_type ENUM('Classroom', 'Hall', 'Lab', 'Auditorium') DEFAULT 'Classroom',
            floor_number INT NOT NULL,
            total_rows INT NOT NULL DEFAULT 5,
            total_columns INT NOT NULL DEFAULT 6,
            students_per_bench INT NOT NULL DEFAULT 1,
            total_capacity INT GENERATED ALWAYS AS (total_rows * total_columns * students_per_bench) STORED,
            layout_data JSON,
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    
    seating_arrangement: `
        CREATE TABLE IF NOT EXISTS seating_arrangement (
            arrangement_id INT AUTO_INCREMENT PRIMARY KEY,
            exam_session_id INT NOT NULL,
            exam_date DATE NOT NULL,
            session_type VARCHAR(50) NOT NULL COMMENT 'FN/AN',
            room_id INT NOT NULL,
            arrangement_name VARCHAR(200) NOT NULL,
            total_students_allocated INT DEFAULT 0,
            seating_data JSON,
            status ENUM('Draft', 'Confirmed', 'Published', 'Completed') DEFAULT 'Draft',
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    
    seating_template: `
        CREATE TABLE IF NOT EXISTS seating_template (
            template_id INT AUTO_INCREMENT PRIMARY KEY,
            template_name VARCHAR(100) NOT NULL,
            template_type VARCHAR(50) NOT NULL COMMENT 'Alternate, Department-wise, Random, etc.',
            description TEXT,
            configuration JSON,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            INDEX idx_template_type (template_type),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    
    programme_master: `
        CREATE TABLE IF NOT EXISTS programme_master (
            programme_id INT PRIMARY KEY AUTO_INCREMENT,
            programme_code VARCHAR(20) UNIQUE NOT NULL,
            programme_name VARCHAR(200) NOT NULL,
            programme_type ENUM('UG', 'PG', 'Diploma', 'Certificate') NOT NULL,
            duration_years DECIMAL(3,1) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
    
    branch_master: `
        CREATE TABLE IF NOT EXISTS branch_master (
            branch_id INT PRIMARY KEY AUTO_INCREMENT,
            branch_code VARCHAR(20) UNIQUE NOT NULL,
            branch_name VARCHAR(200) NOT NULL,
            programme_id INT,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id)
        )
    `,
    
    batch_master: `
        CREATE TABLE IF NOT EXISTS batch_master (
            batch_id INT PRIMARY KEY AUTO_INCREMENT,
            batch_name VARCHAR(100) NOT NULL,
            start_year INT NOT NULL,
            end_year INT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
    
    semester_master: `
        CREATE TABLE IF NOT EXISTS semester_master (
            semester_id INT PRIMARY KEY AUTO_INCREMENT,
            semester_name VARCHAR(50) NOT NULL,
            semester_number INT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT uk_semester_number UNIQUE (semester_number)
        )
    `,
    
    regulation_master: `
        CREATE TABLE IF NOT EXISTS regulation_master (
            regulation_id INT PRIMARY KEY AUTO_INCREMENT,
            regulation_name VARCHAR(100) NOT NULL,
            regulation_year INT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
    
    section_master: `
        CREATE TABLE IF NOT EXISTS section_master (
            section_id INT PRIMARY KEY AUTO_INCREMENT,
            section_name VARCHAR(50) NOT NULL,
            capacity INT,
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `,
    
    exam_session_master: `
        CREATE TABLE IF NOT EXISTS exam_session_master (
            session_id INT PRIMARY KEY AUTO_INCREMENT,
            session_name VARCHAR(50) NOT NULL,
            exam_date DATE NOT NULL,
            session_type VARCHAR(100),
            timings VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            deleted_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_exam_date (exam_date)
        )
    `,
    
    student_master: `
        CREATE TABLE IF NOT EXISTS student_master (
            student_id INT PRIMARY KEY AUTO_INCREMENT,
            
            -- Basic Information
            admission_number VARCHAR(50) UNIQUE NOT NULL,
            ht_number VARCHAR(50),
            roll_number VARCHAR(50),
            full_name VARCHAR(255) NOT NULL,
            
            -- Academic Information
            programme_id INT,
            branch_id INT,
            batch_id INT,
            semester_id INT,
            section_id INT,
            regulation_id INT,
            
            -- Personal Information
            date_of_birth DATE,
            gender ENUM('Male', 'Female', 'Other') NOT NULL,
            father_name VARCHAR(255),
            mother_name VARCHAR(255),
            aadhaar_number VARCHAR(12),
            caste_category VARCHAR(50),
            
            -- Contact Information
            student_mobile VARCHAR(15),
            parent_mobile VARCHAR(15),
            email VARCHAR(255),
            
            -- Dates
            admission_date DATE,
            completion_year VARCHAR(10),
            date_of_leaving DATE NULL,
            discontinue_date DATE NULL,
            
            -- Status and Flags
            student_status ENUM('In Roll', 'Detained', 'Left out') DEFAULT 'In Roll',
            is_detainee BOOLEAN DEFAULT FALSE,
            is_transitory BOOLEAN DEFAULT FALSE,
            is_handicapped BOOLEAN DEFAULT FALSE,
            is_lateral BOOLEAN DEFAULT FALSE,
            join_curriculum BOOLEAN DEFAULT FALSE,
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
            FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id),
            FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id),
            FOREIGN KEY (batch_id) REFERENCES batch_master(batch_id),
            FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id),
            FOREIGN KEY (section_id) REFERENCES section_master(section_id),
            FOREIGN KEY (regulation_id) REFERENCES regulation_master(regulation_id),
            
            -- Indexes
            INDEX idx_admission_number (admission_number),
            INDEX idx_roll_number (roll_number),
            INDEX idx_student_status (student_status),
            INDEX idx_is_active (is_active),
            INDEX idx_programme_branch (programme_id, branch_id),
            INDEX idx_batch_semester (batch_id, semester_id)
        )
    `,
    
    staff_master: `
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
            gender ENUM('Male', 'Female', 'Other') NOT NULL,
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
        )
    `,
    
    subject_master: `
        CREATE TABLE IF NOT EXISTS subject_master (
            subject_id INT PRIMARY KEY AUTO_INCREMENT,
            programme_id INT NOT NULL,
            branch_id INT NOT NULL,
            semester_id INT NOT NULL,
            regulation_id INT NOT NULL,
            subject_order INT DEFAULT 1,
            syllabus_code VARCHAR(50) NOT NULL,
            ref_code VARCHAR(50),
            internal_exam_code VARCHAR(50),
            external_exam_code VARCHAR(50),
            subject_name VARCHAR(255) NOT NULL,
            subject_type ENUM('Theory','Practical','Drawing','Project','Others') DEFAULT 'Theory',
            internal_max_marks INT DEFAULT 0,
            external_max_marks INT DEFAULT 0,
            ta_max_marks INT DEFAULT 0,
            credits DECIMAL(3,1) DEFAULT 0,
            is_elective TINYINT(1) DEFAULT 0,
            is_under_group TINYINT(1) DEFAULT 0,
            is_exempt_exam_fee TINYINT(1) DEFAULT 0,
            replacement_group_order INT,
            is_running_curriculum TINYINT(1) DEFAULT 1,
            is_locked TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            deleted_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_programme (programme_id),
            INDEX idx_branch (branch_id),
            INDEX idx_semester (semester_id),
            INDEX idx_regulation (regulation_id),
            FOREIGN KEY (programme_id) REFERENCES programme_master(programme_id),
            FOREIGN KEY (branch_id) REFERENCES branch_master(branch_id),
            FOREIGN KEY (semester_id) REFERENCES semester_master(semester_id),
            FOREIGN KEY (regulation_id) REFERENCES regulation_master(regulation_id)
        ) ENGINE=InnoDB
    `,
    
    exam_names: `
        CREATE TABLE IF NOT EXISTS exam_names (
            exam_name_id INT AUTO_INCREMENT PRIMARY KEY,
            exam_name VARCHAR(100) NOT NULL UNIQUE,
            exam_type VARCHAR(50) NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            INDEX idx_exam_name (exam_name),
            INDEX idx_exam_type (exam_type),
            INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
};

/**
 * Create a single table
 */
async function createTable(pool, tableName, schema) {
    try {
        await pool.query(schema);
        console.log(`✓ Table '${tableName}' created/verified successfully`);
        return true;
    } catch (error) {
        console.error(`✗ Error creating table '${tableName}':`, error.message);
        return false;
    }
}

/**
 * Add deleted_at column to existing tables (migration)
 */
async function addDeletedAtColumn(pool) {
    // Whitelist of allowed table names (prevents SQL injection)
    const tables = [
        'block_master',
        'room_master',
        'seating_arrangement',
        'seating_template',
        'programme_master',
        'branch_master',
        'batch_master',
        'semester_master',
        'regulation_master',
        'section_master',
        'exam_session_master',
        'exam_names',
        'student_master',
        'staff_master',
        'subject_master'
    ];
    
    console.log('\nRunning migrations to add deleted_at column...');
    
    for (const tableName of tables) {
        try {
            // Check if column exists (uses parameterized query for table name)
            const [columns] = await pool.query(
                'SHOW COLUMNS FROM ?? LIKE ?',
                [tableName, 'deleted_at']
            );
            
            if (columns.length === 0) {
                // Column doesn't exist, add it
                // Note: MySQL does not support parameterized table names in ALTER TABLE statements
                // The table name is validated by the whitelist above, so this is safe
                await pool.query(
                    `ALTER TABLE ${tableName} 
                     ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_active`
                );
                console.log(`✓ Added deleted_at column to ${tableName}`);
            } else {
                console.log(`  Column deleted_at already exists in ${tableName}`);
            }
        } catch (error) {
            // Ignore error if column already exists
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log(`  Column deleted_at already exists in ${tableName}`);
            } else {
                console.error(`✗ Error adding deleted_at to ${tableName}:`, error.message);
            }
        }
    }
    
    console.log('✓ Migration completed\n');
}

/**
 * Insert sample data for programmes
 */
async function insertSampleProgrammes(pool) {
    try {
        // Check if table is empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM programme_master');
        
        if (rows[0].count === 0) {
            console.log('Inserting sample programme data...');
            
            const sampleProgrammes = [
                ['BTECH', 'Bachelor of Technology', 'UG', 4.0, 'Four-year undergraduate engineering program'],
                ['MTECH', 'Master of Technology', 'PG', 2.0, 'Two-year postgraduate engineering program'],
                ['DIPLOMA', 'Diploma in Engineering', 'Diploma', 3.0, 'Three-year diploma program']
            ];
            
            for (const programme of sampleProgrammes) {
                await pool.query(
                    `INSERT INTO programme_master 
                    (programme_code, programme_name, programme_type, duration_years, description) 
                    VALUES (?, ?, ?, ?, ?)`,
                    programme
                );
            }
            
            console.log('✓ Sample programmes inserted successfully');
        }
    } catch (error) {
        console.error('Error inserting sample programmes:', error.message);
    }
}

/**
 * Insert sample data for branches
 */
async function insertSampleBranches(pool) {
    try {
        // Check if table is empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM branch_master');
        
        if (rows[0].count === 0) {
            console.log('Inserting sample branch data...');
            
            // Get BTECH programme_id
            const [programmes] = await pool.query(
                'SELECT programme_id FROM programme_master WHERE programme_code = ?',
                ['BTECH']
            );
            
            if (programmes.length > 0) {
                const btechId = programmes[0].programme_id;
                
                const sampleBranches = [
                    ['CSE', 'Computer Science and Engineering', btechId, 'Computer Science and Engineering department'],
                    ['ECE', 'Electronics and Communication Engineering', btechId, 'Electronics and Communication Engineering department'],
                    ['MECH', 'Mechanical Engineering', btechId, 'Mechanical Engineering department']
                ];
                
                for (const branch of sampleBranches) {
                    await pool.query(
                        `INSERT INTO branch_master 
                        (branch_code, branch_name, programme_id, description) 
                        VALUES (?, ?, ?, ?)`,
                        branch
                    );
                }
                
                console.log('✓ Sample branches inserted successfully');
            }
        }
    } catch (error) {
        console.error('Error inserting sample branches:', error.message);
    }
}

/**
 * Insert sample data for exam names
 */
async function insertSampleExamNames(pool) {
    try {
        // Check if table is empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM exam_names');
        
        if (rows[0].count === 0) {
            // Insert sample exam names
            const sampleExamNames = [
                ['Mid Semester Examination - 1', 'MSE-1', 'First Mid Semester Examination'],
                ['Mid Semester Examination - 2', 'MSE-2', 'Second Mid Semester Examination'],
                ['Semester End Examination', 'SEE', 'Final Semester Examination'],
                ['Supplementary Examination', 'SUP', 'Supplementary Examination'],
                ['Makeup Examination', 'MAKEUP', 'Makeup Examination']
            ];
            
            for (const exam of sampleExamNames) {
                await pool.query(
                    'INSERT INTO exam_names (exam_name, exam_type, description) VALUES (?, ?, ?)',
                    exam
                );
            }
            
            console.log('✓ Sample exam names inserted successfully');
        }
    } catch (error) {
        console.error('Error inserting sample exam names:', error.message);
    }
}

/**
 * Main initialization function
 */
async function initializeDatabase(pool) {
    console.log('\n========================================');
    console.log('Starting Database Initialization...');
    console.log('========================================\n');
    
    try {
        // Create tables in order (respecting foreign key dependencies)
        const tableOrder = [
            'block_master',
            'programme_master',
            'branch_master',
            'batch_master',
            'semester_master',
            'regulation_master',
            'section_master',
            'exam_session_master',
            'exam_names',
            'room_master',
            'seating_template',
            'seating_arrangement',
            'student_master',
            'staff_master',
            'subject_master'
        ];
        
        let allTablesCreated = true;
        
        for (const tableName of tableOrder) {
            const created = await createTable(pool, tableName, tableSchemas[tableName]);
            if (!created) {
                allTablesCreated = false;
            }
        }
        
        // Run migrations to add deleted_at column to existing tables
        await addDeletedAtColumn(pool);
        
        // Insert sample data if tables were just created
        await insertSampleProgrammes(pool);
        await insertSampleBranches(pool);
        await insertSampleExamNames(pool);
        
        console.log('\n========================================');
        if (allTablesCreated) {
            console.log('✓ Database initialization completed successfully!');
        } else {
            console.log('⚠ Database initialization completed with some errors');
        }
        console.log('========================================\n');
        
        return allTablesCreated;
        
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Database initialization failed:', error.message);
        console.error('========================================\n');
        throw error;
    }
}

module.exports = initializeDatabase;
