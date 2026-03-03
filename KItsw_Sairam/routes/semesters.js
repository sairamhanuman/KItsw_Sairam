// Semester Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all semesters
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM semester_master WHERE is_active = 1 ORDER BY semester_number'
        );
        
        res.json({
            status: 'success',
            message: 'Semesters retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching semesters:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semesters',
            error: error.message
        });
    }
});

// GET single semester by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM semester_master WHERE semester_id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Semester not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Semester retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching semester:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch semester',
            error: error.message
        });
    }
});

// POST create new semester
router.post('/', async (req, res) => {
    try {
        console.log('=== SEMESTER CREATE REQUEST ===');
        console.log('Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('Content-Type:', req.headers['content-type']);
        
        const { semester_name, semester_number, is_active } = req.body;
        
        console.log('Parsed values:', {
            semester_name,
            semester_number,
            is_active,
            types: {
                semester_name: typeof semester_name,
                semester_number: typeof semester_number,
                is_active: typeof is_active
            }
        });
        
        // Validation
        if (!semester_name || !semester_number) {
            console.error('Validation failed - missing fields');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: semester_name, semester_number',
                received: { semester_name, semester_number }
            });
        }
        
        // Check if semester number already exists
        console.log('Checking for existing semester with number:', semester_number);
        const [existing] = await promisePool.query(
            'SELECT semester_id FROM semester_master WHERE semester_number = ?',
            [semester_number]
        );
        
        console.log('Existing semesters found:', existing.length);
        
        if (existing.length > 0) {
            console.log('Duplicate semester number detected');
            return res.status(409).json({
                status: 'error',
                message: `Semester ${semester_number} already exists. Please use a different number.`
            });
        }
        
        // Insert new semester
        console.log('Attempting to insert semester...');
        const insertQuery = `INSERT INTO semester_master 
            (semester_name, semester_number, is_active) 
            VALUES (?, ?, ?)`;
        const insertValues = [semester_name, parseInt(semester_number), is_active !== false];
        
        console.log('Insert query:', insertQuery);
        console.log('Insert values:', insertValues);
        
        const [result] = await promisePool.query(insertQuery, insertValues);
        
        console.log('Insert successful! Result:', result);
        
        const responseData = {
            status: 'success',
            message: 'Semester created successfully',
            data: {
                semester_id: result.insertId,
                semester_name,
                semester_number: parseInt(semester_number),
                is_active: is_active !== false
            }
        };
        
        console.log('Sending success response:', responseData);
        res.status(201).json(responseData);
        
    } catch (error) {
        console.error('=== SEMESTER CREATE ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error errno:', error.errno);
        console.error('Error sqlMessage:', error.sqlMessage);
        console.error('Error sql:', error.sql);
        console.error('Full error:', error);
        
        // Parse specific error types
        let errorMessage = 'Failed to create semester';
        let statusCode = 500;
        
        if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = 'A semester with this number already exists';
            statusCode = 409;
        } else if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'Database table not found. Please contact administrator.';
            statusCode = 500;
        } else if (error.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = 'Database column mismatch. Please contact administrator.';
            statusCode = 500;
        }
        
        // Return response - include SQL details only in development
        const errorResponse = {
            status: 'error',
            message: errorMessage,
            error: error.message
        };
        
        // Only include SQL details in development for debugging
        if (process.env.NODE_ENV === 'development') {
            errorResponse.errorCode = error.code;
            errorResponse.sqlMessage = error.sqlMessage;
        }
        
        res.status(statusCode).json(errorResponse);
    }
});

// PUT update semester
router.put('/:id', async (req, res) => {
    try {
        const { semester_name, description, is_active } = req.body;
        
        // Check if semester exists
        const [existing] = await promisePool.query(
            'SELECT semester_id FROM semester_master WHERE semester_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Semester not found'
            });
        }
        
        // Update semester
        await promisePool.query(
            `UPDATE semester_master 
            SET semester_name = ?, description = ?, is_active = ?
            WHERE semester_id = ?`,
            [semester_name, description || null, is_active !== false, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Semester updated successfully'
        });
    } catch (error) {
        console.error('Error updating semester:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update semester',
            error: error.message
        });
    }
});

// DELETE semester
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting semester with ID: ${id}`);
        
        // Check if semester exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM semester_master WHERE semester_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Semester not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE semester_master SET is_active = 0, deleted_at = NOW() WHERE semester_id = ?',
            [id]
        );
        
        console.log(`Semester ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Semester deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting semester:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete semester',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
