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

// Masters Data Routes
const { initializeRouter: mastersRoutes } = require('./routes/masters');
app.use('/api/masters', mastersRoutes(promisePool));

// Exam Timetable Routes
// const { initializeRouter: examTimetableRoutes } = require('./routes/exam-timetable');
// app.use('/api/exam-timetable', examTimetableRoutes(promisePool));

// Staff Management Routes
const staffRoutes = require('./routes/staff');
app.use('/api/staff', staffRoutes);

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



// Serve index.html for all other routes (SPA support) - MUST BE LAST
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
