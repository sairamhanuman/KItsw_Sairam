// Exam Types Master Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all exam types
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT exam_type_id, exam_type_name, exam_type_code, exam_category, 
                    weightage, min_passing_percentage, max_attempts, description, is_active, 
                    created_at, updated_at
             FROM exam_types_master 
             WHERE is_active = 1 OR is_active IS NULL
             ORDER BY exam_category, exam_type_name`
        );
        
        res.json({
            status: 'success',
            message: 'Exam types retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching exam types:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam types',
            error: error.message
        });
    }
});

// GET single exam type by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await promisePool.query(
            `SELECT exam_type_id, exam_type_name, exam_type_code, exam_category, 
                    weightage, min_passing_percentage, max_attempts, description, is_active, 
                    created_at, updated_at
             FROM exam_types_master 
             WHERE exam_type_id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam type not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Exam type retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching exam type:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam type',
            error: error.message
        });
    }
});

// POST new exam type
router.post('/', async (req, res) => {
    try {
        const {
            exam_type_name,
            exam_type_code,
            exam_category,
            weightage,
            min_passing_percentage,
            max_attempts,
            description,
            is_active = true
        } = req.body;

        // Validation
        if (!exam_type_name || !exam_type_code || !exam_category) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: exam_type_name, exam_type_code, exam_category'
            });
        }

        // Check if exam type code already exists
        const [existingExamType] = await promisePool.query(
            'SELECT exam_type_id FROM exam_types_master WHERE exam_type_code = ?',
            [exam_type_code]
        );

        if (existingExamType.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Exam type code already exists'
            });
        }

        // Insert new exam type
        const [result] = await promisePool.query(
            `INSERT INTO exam_types_master 
             (exam_type_name, exam_type_code, exam_category, weightage, min_passing_percentage, max_attempts, description, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [exam_type_name, exam_type_code, exam_category, weightage, min_passing_percentage, max_attempts, description, is_active]
        );

        res.status(201).json({
            status: 'success',
            message: 'Exam type created successfully',
            data: {
                exam_type_id: result.insertId,
                exam_type_name,
                exam_type_code,
                exam_category,
                weightage,
                min_passing_percentage,
                max_attempts,
                description,
                is_active
            }
        });
    } catch (error) {
        console.error('Error creating exam type:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create exam type',
            error: error.message
        });
    }
});

// PUT update exam type
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            exam_type_name,
            exam_type_code,
            exam_category,
            weightage,
            min_passing_percentage,
            max_attempts,
            description,
            is_active
        } = req.body;

        // Check if exam type exists
        const [existingExamType] = await promisePool.query(
            'SELECT exam_type_id FROM exam_types_master WHERE exam_type_id = ?',
            [id]
        );

        if (existingExamType.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam type not found'
            });
        }

        // Check if exam type code already exists (excluding current exam type)
        if (exam_type_code) {
            const [codeCheck] = await promisePool.query(
                'SELECT exam_type_id FROM exam_types_master WHERE exam_type_code = ? AND exam_type_id != ?',
                [exam_type_code, id]
            );

            if (codeCheck.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Exam type code already exists'
                });
            }
        }

        // Update exam type
        const updateFields = [];
        const updateValues = [];

        if (exam_type_name !== undefined) {
            updateFields.push('exam_type_name = ?');
            updateValues.push(exam_type_name);
        }
        if (exam_type_code !== undefined) {
            updateFields.push('exam_type_code = ?');
            updateValues.push(exam_type_code);
        }
        if (exam_category !== undefined) {
            updateFields.push('exam_category = ?');
            updateValues.push(exam_category);
        }
        if (weightage !== undefined) {
            updateFields.push('weightage = ?');
            updateValues.push(weightage);
        }
        if (min_passing_percentage !== undefined) {
            updateFields.push('min_passing_percentage = ?');
            updateValues.push(min_passing_percentage);
        }
        if (max_attempts !== undefined) {
            updateFields.push('max_attempts = ?');
            updateValues.push(max_attempts);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(description);
        }
        if (is_active !== undefined) {
            updateFields.push('is_active = ?');
            updateValues.push(is_active);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No fields to update'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        await promisePool.query(
            `UPDATE exam_types_master SET ${updateFields.join(', ')} WHERE exam_type_id = ?`,
            updateValues
        );

        res.json({
            status: 'success',
            message: 'Exam type updated successfully'
        });
    } catch (error) {
        console.error('Error updating exam type:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update exam type',
            error: error.message
        });
    }
});

// DELETE exam type (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if exam type exists
        const [existingExamType] = await promisePool.query(
            'SELECT exam_type_id FROM exam_types_master WHERE exam_type_id = ?',
            [id]
        );

        if (existingExamType.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam type not found'
            });
        }

        // Soft delete by setting is_active to false
        await promisePool.query(
            'UPDATE exam_types_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE exam_type_id = ?',
            [id]
        );

        res.json({
            status: 'success',
            message: 'Exam type deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting exam type:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete exam type',
            error: error.message
        });
    }
});

module.exports = { initializeRouter };
