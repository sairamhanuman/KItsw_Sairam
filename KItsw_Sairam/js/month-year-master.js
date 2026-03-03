// Month/Year Master Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all month/year records
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT month_year_id, month_name, year_value, month_number, display_name, is_active, 
                    created_at, updated_at
             FROM month_year_master 
             WHERE is_active = 1 OR is_active IS NULL
             ORDER BY year_value DESC, month_number ASC`
        );
        
        res.json({
            status: 'success',
            message: 'Month/Year records retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching month/year records:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch month/year records',
            error: error.message
        });
    }
});

// GET single month/year record by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await promisePool.query(
            `SELECT month_year_id, month_name, year_value, month_number, display_name, is_active, 
                    created_at, updated_at
             FROM month_year_master 
             WHERE month_year_id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Month/Year record not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Month/Year record retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching month/year record:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch month/year record',
            error: error.message
        });
    }
});

// POST new month/year record
router.post('/', async (req, res) => {
    try {
        const {
            month_name,
            year_value,
            month_number,
            display_name,
            is_active = true
        } = req.body;

        // Validation
        if (!month_name || !year_value || !month_number || !display_name) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: month_name, year_value, month_number, display_name'
            });
        }

        // Check if month/year combination already exists
        const [existingRecord] = await promisePool.query(
            'SELECT month_year_id FROM month_year_master WHERE month_name = ? AND year_value = ?',
            [month_name, year_value]
        );

        if (existingRecord.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'This month/year combination already exists'
            });
        }

        // Insert new month/year record
        const [result] = await promisePool.query(
            `INSERT INTO month_year_master 
             (month_name, year_value, month_number, display_name, is_active) 
             VALUES (?, ?, ?, ?, ?)`,
            [month_name, year_value, month_number, display_name, is_active]
        );

        res.status(201).json({
            status: 'success',
            message: 'Month/Year record created successfully',
            data: {
                month_year_id: result.insertId,
                month_name,
                year_value,
                month_number,
                display_name,
                is_active
            }
        });
    } catch (error) {
        console.error('Error creating month/year record:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create month/year record',
            error: error.message
        });
    }
});

// PUT update month/year record
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            month_name,
            year_value,
            month_number,
            display_name,
            is_active
        } = req.body;

        // Check if month/year record exists
        const [existingRecord] = await promisePool.query(
            'SELECT month_year_id FROM month_year_master WHERE month_year_id = ?',
            [id]
        );

        if (existingRecord.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Month/Year record not found'
            });
        }

        // Check if month/year combination already exists (excluding current record)
        if (month_name && year_value) {
            const [duplicateCheck] = await promisePool.query(
                'SELECT month_year_id FROM month_year_master WHERE month_name = ? AND year_value = ? AND month_year_id != ?',
                [month_name, year_value, id]
            );

            if (duplicateCheck.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'This month/year combination already exists'
                });
            }
        }

        // Update month/year record
        const updateFields = [];
        const updateValues = [];

        if (month_name !== undefined) {
            updateFields.push('month_name = ?');
            updateValues.push(month_name);
        }
        if (year_value !== undefined) {
            updateFields.push('year_value = ?');
            updateValues.push(year_value);
        }
        if (month_number !== undefined) {
            updateFields.push('month_number = ?');
            updateValues.push(month_number);
        }
        if (display_name !== undefined) {
            updateFields.push('display_name = ?');
            updateValues.push(display_name);
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
            `UPDATE month_year_master SET ${updateFields.join(', ')} WHERE month_year_id = ?`,
            updateValues
        );

        res.json({
            status: 'success',
            message: 'Month/Year record updated successfully'
        });
    } catch (error) {
        console.error('Error updating month/year record:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update month/year record',
            error: error.message
        });
    }
});

// DELETE month/year record (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if month/year record exists
        const [existingRecord] = await promisePool.query(
            'SELECT month_year_id FROM month_year_master WHERE month_year_id = ?',
            [id]
        );

        if (existingRecord.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Month/Year record not found'
            });
        }

        // Soft delete by setting is_active to false
        await promisePool.query(
            'UPDATE month_year_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE month_year_id = ?',
            [id]
        );

        res.json({
            status: 'success',
            message: 'Month/Year record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting month/year record:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete month/year record',
            error: error.message
        });
    }
});

module.exports = { initializeRouter };
