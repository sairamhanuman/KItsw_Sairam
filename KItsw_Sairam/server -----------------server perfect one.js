const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

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

// Test database connection and initialize tables
async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        const connection = await promisePool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        
        // Initialize database tables
        await initializeDatabase(promisePool);
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
