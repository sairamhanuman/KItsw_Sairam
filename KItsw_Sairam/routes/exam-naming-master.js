// Exam Naming Master Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all exam names
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT exam_naming_id, exam_name, exam_code, exam_type, max_marks, 
                    duration_minutes, passing_marks, description, is_active, 
                    created_at, updated_at
             FROM exams_naming_master 
             WHERE is_active = 1 OR is_active IS NULL
             ORDER BY exam_name`
        );
        
        res.json({
            status: 'success',
            message: 'Exam names retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching exam names:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam names',
            error: error.message
        });
    }
});

// GET single exam name by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await promisePool.query(
            `SELECT exam_naming_id, exam_name, exam_code, exam_type, max_marks, 
                    duration_minutes, passing_marks, description, is_active, 
                    created_at, updated_at
             FROM exams_naming_master 
             WHERE exam_naming_id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam name not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Exam name retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching exam name:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch exam name',
            error: error.message
        });
    }
});

// POST new exam name
router.post('/', async (req, res) => {
    try {
        const {
            exam_name,
            exam_code,
            exam_type,
            max_marks,
            duration_minutes,
            passing_marks,
            description,
            is_active = true
        } = req.body;

        // Validation
        if (!exam_name || !exam_code || !exam_type || !max_marks || !duration_minutes || !passing_marks) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: exam_name, exam_code, exam_type, max_marks, duration_minutes, passing_marks'
            });
        }

        // Check if exam code already exists
        const [existingExam] = await promisePool.query(
            'SELECT exam_naming_id FROM exams_naming_master WHERE exam_code = ?',
            [exam_code]
        );

        if (existingExam.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Exam code already exists'
            });
        }

        // Insert new exam name
        const [result] = await promisePool.query(
            `INSERT INTO exams_naming_master 
             (exam_name, exam_code, exam_type, max_marks, duration_minutes, passing_marks, description, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [exam_name, exam_code, exam_type, max_marks, duration_minutes, passing_marks, description, is_active]
        );

        res.status(201).json({
            status: 'success',
            message: 'Exam name created successfully',
            data: {
                exam_naming_id: result.insertId,
                exam_name,
                exam_code,
                exam_type,
                max_marks,
                duration_minutes,
                passing_marks,
                description,
                is_active
            }
        });
    } catch (error) {
        console.error('Error creating exam name:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create exam name',
            error: error.message
        });
    }
});

// PUT update exam name
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            exam_name,
            exam_code,
            exam_type,
            max_marks,
            duration_minutes,
            passing_marks,
            description,
            is_active
        } = req.body;

        // Check if exam name exists
        const [existingExam] = await promisePool.query(
            'SELECT exam_naming_id FROM exams_naming_master WHERE exam_naming_id = ?',
            [id]
        );

        if (existingExam.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam name not found'
            });
        }

        // Check if exam code already exists (excluding current exam)
        if (exam_code) {
            const [codeCheck] = await promisePool.query(
                'SELECT exam_naming_id FROM exams_naming_master WHERE exam_code = ? AND exam_naming_id != ?',
                [exam_code, id]
            );

            if (codeCheck.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Exam code already exists'
                });
            }
        }

        // Update exam name
        const updateFields = [];
        const updateValues = [];

        if (exam_name !== undefined) {
            updateFields.push('exam_name = ?');
            updateValues.push(exam_name);
        }
        if (exam_code !== undefined) {
            updateFields.push('exam_code = ?');
            updateValues.push(exam_code);
        }
        if (exam_type !== undefined) {
            updateFields.push('exam_type = ?');
            updateValues.push(exam_type);
        }
        if (max_marks !== undefined) {
            updateFields.push('max_marks = ?');
            updateValues.push(max_marks);
        }
        if (duration_minutes !== undefined) {
            updateFields.push('duration_minutes = ?');
            updateValues.push(duration_minutes);
        }
        if (passing_marks !== undefined) {
            updateFields.push('passing_marks = ?');
            updateValues.push(passing_marks);
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
            `UPDATE exams_naming_master SET ${updateFields.join(', ')} WHERE exam_naming_id = ?`,
            updateValues
        );

        res.json({
            status: 'success',
            message: 'Exam name updated successfully'
        });
    } catch (error) {
        console.error('Error updating exam name:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update exam name',
            error: error.message
        });
    }
});

// DELETE exam name (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if exam name exists
        const [existingExam] = await promisePool.query(
            'SELECT exam_naming_id FROM exams_naming_master WHERE exam_naming_id = ?',
            [id]
        );

        if (existingExam.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Exam name not found'
            });
        }

        // Soft delete by setting is_active to false
        await promisePool.query(
            'UPDATE exams_naming_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE exam_naming_id = ?',
            [id]
        );

        res.json({
            status: 'success',
            message: 'Exam name deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting exam name:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete exam name',
            error: error.message
        });
    }
});

module.exports = { initializeRouter };
