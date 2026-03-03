// Course Management Routes - Fixed Version
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// Get all subjects with filters
router.get('/subjects', async (req, res) => {
    try {
        console.log('🔄 Fetching subjects with filters:', req.query);
        
        const {
            programme_id,
            branch_id,
            semester_id,
            is_elective,
            search,
            page = 1,
            limit = 50
        } = req.query;

        let query = `
            SELECT 
                sm.*,
                pm.programme_name,
                bm.branch_name,
                sem.semester_number,
                rm.regulation_name
            FROM subject_master sm
            LEFT JOIN programme_master pm ON sm.programme_id = pm.programme_id
            LEFT JOIN branch_master bm ON sm.branch_id = bm.branch_id
            LEFT JOIN semester_master sem ON sm.semester_id = sem.semester_id
            LEFT JOIN regulation_master rm ON sm.regulation_id = rm.regulation_id
            WHERE sm.is_active = 1
        `;

        const params = [];

        // Add filters
        if (programme_id) {
            query += ` AND sm.programme_id = ?`;
            params.push(programme_id);
        }

        if (branch_id) {
            query += ` AND sm.branch_id = ?`;
            params.push(branch_id);
        }

        if (semester_id) {
            query += ` AND sm.semester_id = ?`;
            params.push(semester_id);
        }

        if (is_elective !== undefined) {
            query += ` AND sm.is_elective = ?`;
            params.push(is_elective);
        }

        if (search) {
            query += ` AND (sm.subject_name LIKE ? OR sm.syllabus_code LIKE ? OR sm.ref_code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY pm.programme_name, bm.branch_name, sem.semester_number, sm.subject_name`;

        // Add pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        console.log('🔍 Executing query:', query);
        console.log('🔍 Parameters:', params);

        const [subjects] = await promisePool.query(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM subject_master sm
            WHERE sm.is_active = 1
        `;

        const countParams = [];

        if (programme_id) {
            countQuery += ` AND sm.programme_id = ?`;
            countParams.push(programme_id);
        }

        if (branch_id) {
            countQuery += ` AND sm.branch_id = ?`;
            countParams.push(branch_id);
        }

        if (semester_id) {
            countQuery += ` AND sm.semester_id = ?`;
            countParams.push(semester_id);
        }

        if (is_elective !== undefined) {
            countQuery += ` AND sm.is_elective = ?`;
            countParams.push(is_elective);
        }

        if (search) {
            countQuery += ` AND (sm.subject_name LIKE ? OR sm.syllabus_code LIKE ? OR sm.ref_code LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [countResult] = await promisePool.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            status: 'success',
            message: 'Subjects retrieved successfully',
            data: subjects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch subjects',
            error: error.message
        });
    }
});

// Sample Excel API endpoint - Fixed
router.get('/subjects/sample-excel', async (req, res) => {
    try {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        
        let query = `
            SELECT 
                sm.*,
                pm.programme_name,
                bm.branch_name,
                sem.semester_number,
                rm.regulation_name
            FROM subject_master sm
            LEFT JOIN programme_master pm ON sm.programme_id = pm.programme_id
            LEFT JOIN branch_master bm ON sm.branch_id = bm.branch_id
            LEFT JOIN semester_master sem ON sm.semester_id = sem.semester_id
            LEFT JOIN regulation_master rm ON sm.regulation_id = rm.regulation_id
            WHERE sm.is_active = 1
        `;

        const params = [];

        if (programme_id) {
            query += ` AND sm.programme_id = ?`;
            params.push(programme_id);
        }

        if (branch_id) {
            query += ` AND sm.branch_id = ?`;
            params.push(branch_id);
        }

        if (semester_id) {
            query += ` AND sm.semester_id = ?`;
            params.push(semester_id);
        }

        if (regulation_id) {
            query += ` AND sm.regulation_id = ?`;
            params.push(regulation_id);
        }

        query += ` ORDER BY pm.programme_name, bm.branch_name, sem.semester_number, sm.subject_name`;

        console.log('🔍 Sample Excel Query:', query);
        console.log('🔍 Sample Excel Params:', params);

        const [subjects] = await promisePool.query(query, params);

        if (subjects.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No subjects found for the given criteria'
            });
        }

        res.json({
            status: 'success',
            message: 'Sample subjects retrieved successfully',
            data: subjects
        });

    } catch (error) {
        console.error('❌ Error fetching sample subjects:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch sample subjects',
            error: error.message
        });
    }
});

// Get master data for dropdowns
router.get('/programmes', async (req, res) => {
    try {
        const [programmes] = await promisePool.query(`
            SELECT programme_id, programme_name 
            FROM programme_master 
            WHERE is_active = 1 
            ORDER BY programme_name
        `);

        res.json({
            status: 'success',
            data: programmes
        });

    } catch (error) {
        console.error('❌ Error fetching programmes:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch programmes',
            error: error.message
        });
    }
});

router.get('/branches', async (req, res) => {
    try {
        const [branches] = await promisePool.query(`
            SELECT branch_id, branch_name 
            FROM branch_master 
            WHERE is_active = 1 
            ORDER BY branch_name
        `);

        res.json({
            status: 'success',
            data: branches
        });

    } catch (error) {
        console.error('❌ Error fetching branches:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch branches',
            error: error.message
        });
    }
});

router.get('/semesters', async (req, res) => {
    try {
        const [semesters] = await promisePool.query(`
            SELECT semester_id, semester_number 
            FROM semester_master 
            WHERE is_active = 1 
            ORDER BY semester_number
        `);

        res.json({
            status: 'success',
            data: semesters
        });

    } catch (error) {
        console.error('❌ Error fetching semesters:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semesters',
            error: error.message
        });
    }
});

router.get('/regulations', async (req, res) => {
    try {
        const [regulations] = await promisePool.query(`
            SELECT regulation_id, regulation_name 
            FROM regulation_master 
            WHERE is_active = 1 
            ORDER BY regulation_name DESC
        `);

        res.json({
            status: 'success',
            data: regulations
        });

    } catch (error) {
        console.error('❌ Error fetching regulations:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch regulations',
            error: error.message
        });
    }
});

module.exports = { initializeRouter };
