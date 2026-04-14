const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// ✅ ADD THESE TWO LINES HERE
require('./backup-service');                          // starts auto-backup scheduler
const backupRoute = require('./backup-route');
// Load environment variables FIRST
dotenv.config();

const initializeDatabase = require('./db/init');    
const { pool, promisePool } = require('./config/database');

// Initialize Express app
const app = express();

// Authentication middleware for protecting routes
const requireAuth = (req, res, next) => {
    // For HTML pages, we'll check client-side, but for API routes we can add token-based auth later
    // For now, this middleware can be extended to use JWT or session tokens
    next();
};

// Serve login page as default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://kitswsairam-production.up.railway.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/students/')
    },
    filename: function (req, file, cb) {
        // Use crypto.randomUUID for collision-resistant unique filenames
        const uniqueId = crypto.randomUUID();
        cb(null, 'student-' + uniqueId + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG, JPG, and PNG images are allowed!'));
    }
});

// ── Multer: Bill uploads for Ledger ──────────────────────────────────────────
const fs = require('fs');

const billStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads/ledger-bills/');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueId = crypto.randomUUID();
        cb(null, 'bill-' + uniqueId + path.extname(file.originalname));
    }
});

const billUpload = multer({
    storage: billStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: function (req, file, cb) {
        const okMime = /image\/jpeg|image\/png|application\/pdf/.test(file.mimetype);
        const okExt  = /jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase());
        if (okMime && okExt) return cb(null, true);
        cb(new Error('Only JPG, PNG, PDF files are allowed for bills'));
    }
});
// ─────────────────────────────────────────────────────────────────────────────

// Test database connection and initialize tables
async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        const connection = await promisePool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        
        // Initialize database tables
        await initializeDatabase(promisePool);

        // ── Initialize Ledger Tables ──────────────────────────────────────────
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS ledger_masters (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                type        ENUM('Income','Expenditure') NOT NULL,
                name        VARCHAR(150) NOT NULL,
                code        VARCHAR(30),
                description VARCHAR(300),
                is_active   TINYINT(1) DEFAULT 1,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS ledger_master_items (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                master_id    INT NOT NULL,
                name         VARCHAR(150) NOT NULL,
                default_rate DECIMAL(12,2) DEFAULT NULL,
                is_active    TINYINT(1) DEFAULT 1,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (master_id) REFERENCES ledger_masters(id) ON DELETE CASCADE
            )
        `);
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS ledger_transactions (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                type        ENUM('Income','Expenditure') NOT NULL,
                date        DATE NOT NULL,
                category_id INT NOT NULL,
                sub_item_id INT DEFAULT NULL,
                amount      DECIMAL(14,2) NOT NULL,
                description TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES ledger_masters(id),
                FOREIGN KEY (sub_item_id) REFERENCES ledger_master_items(id) ON DELETE SET NULL
            )
        `);
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS ledger_bills (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id INT NOT NULL,
                original_name  VARCHAR(255),
                file_path      VARCHAR(500),
                file_type      VARCHAR(100),
                file_size      INT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES ledger_transactions(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Ledger tables ready');
        // ─────────────────────────────────────────────────────────────────────
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('Note: Database connection will be required for API endpoints');
        return false;
    }
}

// Initialize database on startup
(async () => {
    await testDatabaseConnection();
})();

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Engineering College Application API is running',
        timestamp: new Date().toISOString()
    });
});

// Test database endpoint
app.get('/api/db-test', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT 1 + 1 AS result');
        res.json({ 
            status: 'success', 
            message: 'Database connection successful',
            result: rows[0].result
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Database diagnostics endpoint - Development only
app.get('/api/diagnostics/tables', async (req, res) => {
    // Only allow in development environment for security
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
            status: 'error',
            message: 'This endpoint is only available in development mode'
        });
    }
    
    try {
        // Check semester_master table
        const [semesterColumns] = await promisePool.query(
            "SHOW COLUMNS FROM semester_master"
        );
        
        // Check exam_session_master table
        const [examSessionColumns] = await promisePool.query(
            "SHOW COLUMNS FROM exam_session_master"
        );
        
        res.json({
            status: 'success',
            tables: {
                semester_master: semesterColumns,
                exam_session_master: examSessionColumns
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            code: error.code
        });
    }
});

// API endpoints structure (ready for future implementation)

// Programme Management Routes
const programmeRoutes = require('./routes/programmes')(promisePool);
app.use('/api/programmes', programmeRoutes);

// Branch Management Routes
const branchRoutes = require('./routes/branches')(promisePool);
app.use('/api/branches', branchRoutes);

// Batch Management Routes
const batchRoutes = require('./routes/batches')(promisePool);
app.use('/api/batches', batchRoutes);

// MSE Exam Type Management Routes
// const mseExamTypeRoutes = require('./routes/mse-exam-types')(promisePool);
// app.use('/api/mse-exam-types', mseExamTypeRoutes);

// Master Management Routes
const sessionsMasterRoutes = require('./routes/sessions-master');
const monthYearMasterRoutes = require('./routes/month-year-master');
const examNamingMasterRoutes = require('./routes/exam-naming-master');
const examTypesMasterRoutes = require('./routes/exam-types-master');

// Initialize routes with database pool
app.use('/api/sessions-master', sessionsMasterRoutes.initializeRouter(promisePool));
app.use('/api/month-year-master', monthYearMasterRoutes.initializeRouter(promisePool));
app.use('/api/exam-naming-master', examNamingMasterRoutes.initializeRouter(promisePool));
app.use('/api/exam-types-master', examTypesMasterRoutes.initializeRouter(promisePool));


// // Subject Replacement Routes (MUST be before broad /api mounts)
const subjectReplacementRoutes = require('./routes/subject-replacement');
app.use('/api/subject-replacement', subjectReplacementRoutes.initializeRouter(promisePool));
console.log('✅ Subject replacement route registered');
// Master Lookup Routes (for resolving IDs to names)
const { initializeRouter: masterLookupRoutes } = require('./routes/master-lookup');
app.use('/api', masterLookupRoutes(promisePool));
// Setup Masters Route
const setupMastersRoutes = require('./routes/setup-masters');
app.use('/api/setup', setupMastersRoutes.initializeRouter(promisePool));

// Internal Exam Timetable Route (for compatibility)
// const internalExamTimetableRoutes = require('./routes/internal-exam-timetable');
// app.use('/api/internal-exam-timetable', internalExamTimetableRoutes.initializeRouter(promisePool));

// Course Management Route
const courseManagementRoutes = require('./routes/course-management-complete');
app.use('/api', courseManagementRoutes.initializeRouter(promisePool));

// Semester Management Routes
const semesterRoutes = require('./routes/semesters')(promisePool);
app.use('/api/semesters', semesterRoutes);

// ============================================
// REGULATIONS ENDPOINT (Top-Level)
// ============================================
// This must be at top level because it's used by multiple modules
app.get('/api/regulations', async (req, res) => {
    try {
        console.log('=== GET REGULATIONS (Top-Level Endpoint) ===');
        
        const query = `
            SELECT 
                regulation_id,
                regulation_name,
                regulation_year,
                description,
                is_active
            FROM regulation_master
            WHERE is_active = 1
            ORDER BY regulation_name DESC
        `;
        
        console.log('Executing query:', query);
        
        const [regulations] = await promisePool.query(query);
        
        console.log(`✅ Found ${regulations.length} regulations`);
        if (regulations.length > 0) {
            console.log('Regulations:', regulations.map(r => r.regulation_name).join(', '));
        }
        
        res.json({
            status: 'success',
            message: 'Regulations retrieved successfully',
            data: regulations
        });
        
    } catch (error) {
        console.error('=== GET REGULATIONS ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('SQL:', error.sql);
        
        res.status(500).json({ 
            status: 'error',
            message: error.message,
            code: error.code
        });
    }
});

// Regulation Management Routes (other CRUD operations)
const regulationRoutes = require('./routes/regulations')(promisePool);
app.use('/api/regulations', regulationRoutes);

// Section Management Routes
const sectionRoutes = require('./routes/sections')(promisePool);
app.use('/api/sections', sectionRoutes);

// Exam Session Management Routes
const examSessionRoutes = require('./routes/exam-sessions')(promisePool);
app.use('/api/exam-sessions', examSessionRoutes);

// Student Management Routes
const studentRoutes = require('./routes/students')(promisePool);
app.use('/api/students', studentRoutes);

// Professional Student Management
/*
const studentManagementProfessional = require('./routes/student-management-professional');
const studentMgmtRoutes = studentManagementProfessional.initializeRouter(promisePool);
app.use('/api/student-management', studentMgmtRoutes);*/


// Elective Mapping (NEW!)
const electiveMappingRoutes = require('./routes/elective-mapping');
const electiveMgmtRoutes = electiveMappingRoutes.initializeRouter(promisePool);
app.use('/api/elective-mapping', electiveMgmtRoutes);

// Elective Template — Download & Upload (uses /elective-mapping prefix to match frontend calls)
const electiveTemplateRoutes = require('./routes/elective-template');
app.use('/elective-mapping', electiveTemplateRoutes.initializeRouter(promisePool));
console.log('✅ Elective template route registered at /elective-mapping');



const studentManagementProfessional = require('./routes/student-management-professional-routes');
const studentMgmtRoutes = studentManagementProfessional.initializeRouter(promisePool);
app.use('/api/student-management', studentMgmtRoutes);


// ── STEP 1: Add these require() lines ────────────────────
// (Place near your other route requires at the top of server.js)

const seatingRoutes    = require('./routes/seating-allocation-routes');
const seatingPdfRoutes = require('./routes/seating-pdf-export');


// ── STEP 2: Add these app.use() lines ────────────────────
// (Place BEFORE your catch-all routes like app.use('/api', ...))
// (Place AFTER your database pool is initialized)

app.use('/api/seating', seatingRoutes.initializeRouter(promisePool));
app.use('/api/seating', seatingPdfRoutes.initializeRouter(promisePool));

const roomScheduleRoutes = require('./routes/room-weekly-schedule-routes');
app.use('/api/room-schedule', roomScheduleRoutes.initializeRouter(pool));

// Photo upload route for students (must be after students routes initialization)
app.post('/api/students/:id/upload-photo', upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }
        
        // Check if student exists
        const [student] = await promisePool.query(
            'SELECT student_id FROM student_master WHERE student_id = ?',
            [id]
        );
        
        if (student.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found'
            });
        }
        
        // Update student photo URL
        const photoUrl = `/uploads/students/${req.file.filename}`;
        await promisePool.query(
            'UPDATE student_master SET photo_url = ? WHERE student_id = ?',
            [photoUrl, id]
        );
        
        res.json({
            status: 'success',
            message: 'Photo uploaded successfully',
            data: {
                photo_url: photoUrl
            }
        });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to upload photo',
            error: error.message
        });
    }
});



// Departments API endpoint (used by staff management and other modules)
// Note: Department data is stored in branch_master table in the database schema
app.get('/api/departments', async (req, res) => {
    try {
        console.log('=== GET DEPARTMENTS ===');
        
        const query = `
            SELECT 
                branch_id as dept_id,
                branch_name as dept_name,
                branch_code as dept_code
            FROM branch_master
            WHERE is_active = 1
            ORDER BY branch_name
        `;
        
        const [departments] = await promisePool.query(query);
        
        console.log(`Found ${departments.length} departments`);
        
        res.json(departments);
        
    } catch (error) {
        console.error('=== GET DEPARTMENTS ERROR ===');
        console.error('Error:', error);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch departments',
            error: error.message
        });
    }
});

// Subect allotement to faculty Routes
const subjectAllotmentRoutes = require('./routes/subject-allotments')(promisePool);
app.use('/api/subject-allotments', subjectAllotmentRoutes);


const academicYearRoutes = require('./routes/academic-years')(promisePool);
app.use('/api/academic-years', academicYearRoutes);
// ✅ Classwork Timetable Routes
const timetableRoutes = require('./routes/classwork-timetable-route');
app.use('/api/classwork-timetable', timetableRoutes.initializeRouter(promisePool));
// Masters Data Routes
const { initializeRouter: mastersRoutes } = require('./routes/masters');
app.use('/api/masters', mastersRoutes(promisePool));

// Exam Timetable Routes
// const { initializeRouter: examTimetableRoutes } = require('./routes/exam-timetable');
// app.use('/api/exam-timetable', examTimetableRoutes(promisePool));

// Admin Authentication Routes
// ─── REPLACE YOUR ENTIRE /api/admin/login ROUTE WITH THIS ───────────────────
// Drop-in replacement in server.js

const bcrypt = require('bcrypt'); // already installed in your project

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        // Fetch user by username (all roles allowed)
        const [users] = await promisePool.execute(
            `SELECT user_id, username, password_hash, email, user_role,
                    is_active, locked_until, is_first_login, login_attempts
             FROM users WHERE username = ?`,
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const user = users[0];

        // Check account lock
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked. Please try again later.'
            });
        }

        // Check account active
        if (!user.is_active) {
            return res.status(423).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator.'
            });
        }

        // ── Password check ────────────────────────────────────────────────────
        // 1. Try bcrypt hash first (all users created via /api/users)
        // 2. Fall back to hardcoded Admin credentials for backward compatibility
        const HARDCODED_ADMIN_USER = 'Admin';
        const HARDCODED_ADMIN_PASS = 'Admin@12345';

        let passwordValid = false;

        // Check if user has password hash (bcrypt users)
        if (user.password_hash) {
            passwordValid = await bcrypt.compare(password, user.password_hash);
            console.log('Username:', username);
            console.log('Password received:', password);
            console.log('Hash in DB:', user.password_hash);
            console.log('bcrypt result:', passwordValid);
            console.log('login_attempts:', user.login_attempts);
            console.log('locked_until:', user.locked_until);
            console.log('is_active:', user.is_active);
        }
        
        // Fallback: allow hardcoded admin if bcrypt check failed or no hash stored
        if (!passwordValid && username === HARDCODED_ADMIN_USER && password === HARDCODED_ADMIN_PASS) {
            passwordValid = true;
        }
        // ─────────────────────────────────────────────────────────────────────

        if (!passwordValid) {
            // Increment failed login attempts
            const newAttempts = (user.login_attempts || 0) + 1;
            await promisePool.execute(
                'UPDATE users SET login_attempts = ? WHERE user_id = ?',
                [newAttempts, user.user_id]
            );

            // Lock after 5 failed attempts for 30 minutes
            if (newAttempts >= 5) {
                const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
                await promisePool.execute(
                    'UPDATE users SET locked_until = ? WHERE user_id = ?',
                    [lockedUntil, user.user_id]
                );
                return res.status(423).json({
                    success: false,
                    message: 'Too many failed attempts. Account locked for 30 minutes.'
                });
            }

            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        // ── Login success ─────────────────────────────────────────────────────
        await promisePool.execute(
            'UPDATE users SET last_login = NOW(), login_attempts = 0, locked_until = NULL WHERE user_id = ?',
            [user.user_id]
        );

        // Log activity
        try {
            await promisePool.execute(
                'INSERT INTO user_activity_log (user_id, activity_type, ip_address, user_agent) VALUES (?, ?, ?, ?)',
                [user.user_id, 'Login', req.ip, req.get('User-Agent')]
            );
        } catch (logErr) {
            console.error('Activity log error (non-fatal):', logErr.message);
        }

    res.json({
    success: true,
    message: 'Login successful',
    userId: user.user_id,           // ← ADD THIS LINE
    username: user.username,
    userRole: user.user_role,
    isFirstLogin: user.is_first_login
});


    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});
// Check Session
app.get('/api/admin/check-session', async (req, res) => {
    try {
        const username = req.headers['x-username'] || req.query.username;
        if (!username) return res.status(401).json({ success: false, message: 'No session found' });

        const [users] = await promisePool.execute(
            `SELECT user_id, username, user_role, is_active, locked_until 
             FROM users WHERE username = ?`, [username]
        );
        if (!users.length) return res.status(401).json({ success: false, message: 'User not found' });

        const user = users[0];
        if (!user.is_active) return res.status(401).json({ success: false, message: 'Account deactivated' });
        if (user.locked_until && new Date(user.locked_until) > new Date())
            return res.status(401).json({ success: false, message: 'Account locked' });

        // ✅ Also update localStorage values via response
        res.json({ 
            success: true, 
            username: user.username, 
            userRole: user.user_role,
            userId: user.user_id
        });
    } catch (error) {
        res.json({ success: false, message: 'Session check failed' });
    }
});

// Logout
app.post('/api/admin/logout', async (req, res) => {
    try {
        const { username } = req.body;
        if (username) {
            const [users] = await promisePool.execute(`SELECT user_id FROM users WHERE username = ?`, [username]);
            if (users.length > 0) {
                await promisePool.execute(
                    `INSERT INTO user_activity_log (user_id, activity_type, ip_address, user_agent) VALUES (?, 'Logout', ?, ?)`,
                    [users[0].user_id, req.ip, req.get('User-Agent')]
                );
            }
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.json({ success: true, message: 'Logged out' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// User Management Routes
// ─────────────────────────────────────────────────────────────────────────────
// User Management Routes
const { initializeRouter: userRoutes } = require('./routes/users');
app.use('/api/users', userRoutes(promisePool));


// Staff Management Routes
const staffRoutes = require('./routes/staff');
app.use('/api/staff', staffRoutes);


const resultAnalysisRoutes = require('./routes/result-analysis');
app.use('/api', resultAnalysisRoutes.initializeRouter(promisePool));

const resultUploadRoutes = require('./routes/result-upload');
app.use('/api', resultUploadRoutes.initializeRouter(promisePool));

// College Management Routes  ← ADD THESE TWO LINES
const collegeRoutes = require('./routes/college_routes');
app.use('/api/colleges', collegeRoutes);
// Subject/Course Management Routes
const subjectRoutes = require('./routes/subjects')(promisePool);
app.use('/api/subjects', subjectRoutes);

// Seating Plan Management Routes
const seatingPlanRoutes = require('./routes/seating-plans')(promisePool);
app.use('/api/seating-plans', seatingPlanRoutes);

// Holidays Management Routes
const holidaysRoutes = require('./routes/holidays');
app.use('/api/holidays', holidaysRoutes(promisePool));

// Exam Notification Management Routes
const examNotificationRoutes = require('./routes/exam-notifications');
app.use('/api/exam-notifications', examNotificationRoutes.initializeRouter(promisePool));

// Exam Timetable Generator Routes
const examTimetableGeneratorRoutes = require('./routes/exam-timetable-generator');
app.use('/api/exam-timetable', examTimetableGeneratorRoutes.initializeRouter(promisePool));

// Exam Timetable Entries Routes (FIXED VERSION - for Save functionality)
const examTimetableEntriesRoutes = require('./routes/exam-timetable-entries');
app.use('/api/exam-timetable', examTimetableEntriesRoutes.initializeRouter(promisePool));

// Student Exam Data Routes
const studentExamDataRoutes = require('./routes/student-exam-data');
app.use('/api/student-exam-data', studentExamDataRoutes.initializeRouter(promisePool));

const studentEntriesRoutes = require('./routes/student-entries-routes');
app.use('/api/student-entries', studentEntriesRoutes.initializeRouter(promisePool));


const absenteesRoutes = require('./routes/absentees-routes');
app.use('/api/absentees', absenteesRoutes.initializeRouter(promisePool));



const invigilationRoutes = require('./routes/invigilation-routes');
app.use('/api/invigilation', invigilationRoutes.initializeRouter(promisePool));

const blockedStudentsRoutes = require('./routes/blocked-students-routes');
app.use('/api/blocked-students', blockedStudentsRoutes.initializeRouter(promisePool));

const blockedRoutes = require('./routes/blocked-students-routes');
app.use('/api/blocked-students', blockedRoutes.initializeRouter(promisePool));

const transferRoutes = require('./routes/transfer-routes');
app.use('/api/transfer', transferRoutes.initializeRouter(promisePool));


const studentHistoryRoutes = require('./routes/student-history-routes');
app.use('/api/student-history', studentHistoryRoutes.initializeRouter(promisePool));


const labPanelRoutes = require('./routes/lab-panel')(promisePool);
app.use('/api/lab-panel', labPanelRoutes);

const qpSettingRoutes = require('./routes/qp-setting-routes')(promisePool);
app.use('/api/qp-setting', qpSettingRoutes);


// ── 2. Add save-remuneration endpoint (add near the qp-setting route) ──────
app.post('/api/qp-setting/save-remuneration', async (req, res) => {
    const { staff_id, no_of_sets, scheme_sets, course_code, exam_details, submitted_by } = req.body;
    try {
        await promisePool.query(`
            INSERT INTO qp_remuneration_bill
            (staff_id, no_of_sets, scheme_sets, submitted_at)
            VALUES (?,?,?,NOW())
        `, [staff_id, no_of_sets, scheme_sets]);
        res.json({ success: true, message: 'Bill saved' });
    } catch(err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


const pageAccessRoutes = require('./routes/page-access')(promisePool);
app.use('/api/page-access', pageAccessRoutes);



// ═════════════════════════════════════════════════════════════════════════════
// EXAM BRANCH ACCOUNT LEDGER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ledger/masters?type=Income|Expenditure|all
app.get('/api/ledger/masters', async (req, res) => {
    try {
        const { type } = req.query;
        let query  = 'SELECT * FROM ledger_masters';
        const params = [];
        if (type && type !== 'all') {
            query += ' WHERE type = ?';
            params.push(type);
        }
        query += ' ORDER BY type, name ASC';
        const [rows] = await promisePool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// POST /api/ledger/masters
app.post('/api/ledger/masters', async (req, res) => {
    try {
        const { type, name, code, description } = req.body;
        if (!type || !name)
            return res.json({ success: false, message: 'type and name are required' });
        const [result] = await promisePool.query(
            'INSERT INTO ledger_masters (type, name, code, description) VALUES (?,?,?,?)',
            [type, name.trim(), code ? code.trim() : null, description ? description.trim() : null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// DELETE /api/ledger/masters/:id
app.delete('/api/ledger/masters/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM ledger_masters WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// GET /api/ledger/master-items/:masterId
app.get('/api/ledger/master-items/:masterId', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM ledger_master_items WHERE master_id = ? AND is_active = 1 ORDER BY name ASC',
            [req.params.masterId]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// POST /api/ledger/master-items
app.post('/api/ledger/master-items', async (req, res) => {
    try {
        const { master_id, name, default_rate } = req.body;
        if (!master_id || !name)
            return res.json({ success: false, message: 'master_id and name are required' });
        const [result] = await promisePool.query(
            'INSERT INTO ledger_master_items (master_id, name, default_rate) VALUES (?,?,?)',
            [master_id, name.trim(), default_rate || null]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// DELETE /api/ledger/master-items/:id
app.delete('/api/ledger/master-items/:id', async (req, res) => {
    try {
        await promisePool.query('DELETE FROM ledger_master_items WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// POST /api/ledger/entry  — multipart: text fields + bill files
app.post('/api/ledger/entry', billUpload.array('bills', 10), async (req, res) => {
    const conn = await promisePool.getConnection();
    try {
        await conn.beginTransaction();

        const { type, date, category_id, sub_item_id, amount, description } = req.body;
        if (!type || !date || !category_id || !amount) {
            await conn.rollback();
            return res.json({ success: false, message: 'type, date, category_id, amount are required' });
        }

        const [txnResult] = await conn.query(
            `INSERT INTO ledger_transactions
             (type, date, category_id, sub_item_id, amount, description)
             VALUES (?,?,?,?,?,?)`,
            [type, date, category_id,
             sub_item_id || null,
             parseFloat(amount),
             description ? description.trim() : null]
        );
        const txnId = txnResult.insertId;

        // Save bill file references
        if (req.files && req.files.length) {
            for (const f of req.files) {
                await conn.query(
                    `INSERT INTO ledger_bills
                     (transaction_id, original_name, file_path, file_type, file_size)
                     VALUES (?,?,?,?,?)`,
                    [txnId, f.originalname,
                     '/uploads/ledger-bills/' + f.filename,
                     f.mimetype, f.size]
                );
            }
        }

        await conn.commit();
        res.json({ success: true, id: txnId, message: 'Entry saved successfully' });
    } catch (err) {
        await conn.rollback();
        res.json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/ledger/entry/:id
app.delete('/api/ledger/entry/:id', async (req, res) => {
    try {
        // ledger_bills deleted automatically via ON DELETE CASCADE
        await promisePool.query('DELETE FROM ledger_transactions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// PUT /api/ledger/entry/:id
app.put('/api/ledger/entry/:id', async (req, res) => {
    try {
        const { type, date, category_id, sub_item_id, amount, description } = req.body;
        if (!type || !date || !category_id || !amount)
            return res.json({ success: false, message: 'type, date, category_id, amount are required' });
        await promisePool.query(
            `UPDATE ledger_transactions SET type=?, date=?, category_id=?, sub_item_id=?, amount=?, description=? WHERE id=?`,
            [type, date, category_id, sub_item_id || null, parseFloat(amount), description || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// POST /api/ledger/entry/:id/bills  — add more bills to existing entry
app.post('/api/ledger/entry/:id/bills', billUpload.array('bills', 10), async (req, res) => {
    try {
        if (!req.files || !req.files.length) return res.json({ success: true });
        for (const f of req.files) {
            await promisePool.query(
                `INSERT INTO ledger_bills (transaction_id, original_name, file_path, file_type, file_size) VALUES (?,?,?,?,?)`,
                [req.params.id, f.originalname, '/uploads/ledger-bills/' + f.filename, f.mimetype, f.size]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// PUT /api/ledger/masters/:id
app.put('/api/ledger/masters/:id', async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name) return res.json({ success: false, message: 'name is required' });
        await promisePool.query(
            'UPDATE ledger_masters SET name=?, code=?, description=? WHERE id=?',
            [name.trim(), code ? code.trim() : null, description ? description.trim() : null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// PUT /api/ledger/master-items/:id
app.put('/api/ledger/master-items/:id', async (req, res) => {
    try {
        const { name, default_rate } = req.body;
        if (!name) return res.json({ success: false, message: 'name is required' });
        await promisePool.query(
            'UPDATE ledger_master_items SET name=?, default_rate=? WHERE id=?',
            [name.trim(), default_rate || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// GET /api/ledger?from=&to=&type=&category_id=
app.get('/api/ledger', async (req, res) => {
    try {
        const { from, to, type, category_id } = req.query;
        const where  = [];
        const params = [];

        if (from)        { where.push('t.date >= ?');        params.push(from); }
        if (to)          { where.push('t.date <= ?');        params.push(to); }
        if (type)        { where.push('t.type = ?');         params.push(type); }
        if (category_id) { where.push('t.category_id = ?'); params.push(category_id); }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

        // Fetch filtered transactions
        const [transactions] = await promisePool.query(`
            SELECT
                t.id, t.type, t.date, t.amount, t.description,
                m.name AS category_name,
                m.code AS category_code,
                si.name AS sub_item_name
            FROM ledger_transactions t
            JOIN  ledger_masters m      ON t.category_id = m.id
            LEFT JOIN ledger_master_items si ON t.sub_item_id = si.id
            ${whereClause}
            ORDER BY t.date ASC, t.id ASC
        `, params);

        // Fetch bills for these transactions
        if (transactions.length) {
            const ids = transactions.map(r => r.id);
            const [bills] = await promisePool.query(
                'SELECT * FROM ledger_bills WHERE transaction_id IN (?)',
                [ids]
            );
            const billMap = {};
            bills.forEach(b => {
                if (!billMap[b.transaction_id]) billMap[b.transaction_id] = [];
                billMap[b.transaction_id].push(b);
            });
            transactions.forEach(r => { r.bills = billMap[r.id] || []; });
        }

        // Running balance computed from ALL transactions (so filtered view shows correct balance)
        const [allTxns] = await promisePool.query(
            'SELECT id, type, amount FROM ledger_transactions ORDER BY date ASC, id ASC'
        );
        let runBal = 0;
        const balMap = {};
        allTxns.forEach(r => {
            runBal += r.type === 'Income' ? parseFloat(r.amount) : -parseFloat(r.amount);
            balMap[r.id] = runBal;
        });
        transactions.forEach(r => { r.running_balance = balMap[r.id] !== undefined ? balMap[r.id] : 0; });

        // Summary for the filtered set
        const [sumRows] = await promisePool.query(`
            SELECT
                COALESCE(SUM(CASE WHEN t.type='Income'      THEN t.amount ELSE 0 END),0) AS total_income,
                COALESCE(SUM(CASE WHEN t.type='Expenditure' THEN t.amount ELSE 0 END),0) AS total_expenditure,
                COUNT(*) AS total_transactions
            FROM ledger_transactions t
            ${whereClause}
        `, params);

        const summary  = sumRows[0];
        summary.balance = parseFloat(summary.total_income) - parseFloat(summary.total_expenditure);

        res.json({ success: true, data: transactions, summary });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// ✅ ADD THIS LINE HERE
app.use('/api', backupRoute);

// Handle 404 for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ 
        status: 'error',
        message: 'API endpoint not found' 
    });
});

// Serve HTML pages
app.get('/create-exam-notification', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-exam-notification.html'));
});

app.get('/view-notifications', (req, res) => {
    res.sendFile(path.join(__dirname, 'view-notifications.html'));
});

app.get('/edit-notification', (req, res) => {
    res.sendFile(path.join(__dirname, 'edit-notification.html'));
});

app.get('/generate-timetable', (req, res) => {
    res.sendFile(path.join(__dirname, 'generate-timetable.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        status: 'error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});



// Serve specific HTML pages with authentication check
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve login page for root and other routes (SPA support) - MUST BE LAST
app.get(/.*/, (req, res) => {
    // If it's an API route, let it return 404 (handled by the API 404 middleware above)
    if (req.path.startsWith('/api/')) {
        return;
    }
    
    // For HTML routes, serve login page and let client-side handle routing
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});
