// Exam Session Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all exam sessions
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT session_id, session_name, exam_date, session_type, 
                    start_time, end_time, is_active, created_at, updated_at
             FROM exam_session_master 
             WHERE is_active = 1 
             ORDER BY exam_date DESC, start_time ASC`
        );
        
        res.json({
            status: 'success',
            message: 'Exam sessions retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching exam sessions:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam sessions',
            error: error.message
        });
    }
});

// GET single exam session by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT session_id, session_name, exam_date, session_type, 
                    start_time, end_time, is_active, created_at, updated_at
             FROM exam_session_master 
             WHERE session_id = ? AND is_active = 1`,
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam session not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Exam session retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching exam session:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam session',
            error: error.message
        });
    }
});

// POST create new exam session
router.post('/', async (req, res) => {
    try {
        console.log('=== EXAM SESSION CREATE REQUEST ===');
        console.log('Request body:', req.body);
        
        const { session_name, exam_date, session_type, start_time, end_time, is_active } = req.body;
        
        // Validation
        if (!session_name || !exam_date) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: session_name, exam_date'
            });
        }
        
        // Insert new exam session with separate start_time and end_time
        console.log('Inserting exam session...');
        const [result] = await promisePool.query(
            `INSERT INTO exam_session_master 
            (session_name, exam_date, session_type, start_time, end_time, is_active) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                session_name, 
                exam_date, 
                session_type || null, 
                start_time || null, 
                end_time || null, 
                is_active !== false
            ]
        );
        
        console.log('Exam session created successfully:', result.insertId);
        
        res.status(201).json({
            status: 'success',
            message: 'Exam session created successfully',
            data: {
                session_id: result.insertId,
                session_name,
                exam_date,
                session_type,
                start_time,
                end_time,
                is_active: is_active !== false
            }
        });
    } catch (error) {
        console.error('=== EXAM SESSION CREATE ERROR ===');
        console.error('Error:', error);
        
        let errorMessage = 'Failed to create exam session';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'Database table not found';
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = 'Database column mismatch';
        }
        
        const errorResponse = {
            status: 'error',
            message: errorMessage,
            error: error.message
        };
        
        // Only include SQL details in development for debugging
        if (process.env.NODE_ENV === 'development') {
            errorResponse.sqlMessage = error.sqlMessage;
        }
        
        res.status(500).json(errorResponse);
    }
});

// PUT update exam session
router.put('/:id', async (req, res) => {
    try {
        const { session_name, exam_date, session_type, start_time, end_time, is_active } = req.body;
        
        // Check if exam session exists
        const [existing] = await promisePool.query(
            'SELECT * FROM exam_session_master WHERE session_id = ? AND is_active = 1',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam session not found'
            });
        }
        
        // Update exam session
        await promisePool.query(
            `UPDATE exam_session_master 
             SET session_name = ?, exam_date = ?, session_type = ?, 
                 start_time = ?, end_time = ?, is_active = ?
             WHERE session_id = ?`,
            [
                session_name || existing[0].session_name,
                exam_date || existing[0].exam_date,
                session_type !== undefined ? session_type : existing[0].session_type,
                start_time !== undefined ? start_time : existing[0].start_time,
                end_time !== undefined ? end_time : existing[0].end_time,
                is_active !== undefined ? is_active : existing[0].is_active,
                req.params.id
            ]
        );
        
        res.json({
            status: 'success',
            message: 'Exam session updated successfully',
            data: {
                session_id: req.params.id,
                session_name,
                exam_date,
                session_type,
                start_time,
                end_time,
                is_active
            }
        });
    } catch (error) {
        console.error('Error updating exam session:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update exam session',
            error: error.message
        });
    }
});

// DELETE exam session
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting exam session with ID: ${id}`);
        
        // Check if exam session exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM exam_session_master WHERE session_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam session not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE exam_session_master SET is_active = 0, deleted_at = NOW() WHERE session_id = ?',
            [id]
        );
        
        console.log(`Exam session ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Exam session deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting exam session:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete exam session',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
