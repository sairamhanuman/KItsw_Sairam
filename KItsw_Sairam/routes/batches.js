// Batch Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all batches
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM batch_master WHERE is_active = 1 ORDER BY start_year DESC'
        );
        
        res.json({
            status: 'success',
            message: 'Batches retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch batches',
            error: error.message
        });
    }
});

// GET single batch by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM batch_master WHERE batch_id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Batch not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Batch retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch batch',
            error: error.message
        });
    }
});

// POST create new batch
router.post('/', async (req, res) => {
    try {
        const { batch_name, start_year, end_year, is_active } = req.body;
        
        // Validation
        if (!batch_name || !start_year || !end_year) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: batch_name, start_year, end_year'
            });
        }
        
        // Insert new batch
        const [result] = await promisePool.query(
            `INSERT INTO batch_master 
            (batch_name, start_year, end_year, is_active) 
            VALUES (?, ?, ?, ?)`,
            [batch_name, start_year, end_year, is_active !== false]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Batch created successfully',
            data: {
                batch_id: result.insertId,
                batch_name,
                start_year,
                end_year,
                is_active: is_active !== false
            }
        });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create batch',
            error: error.message
        });
    }
});

// PUT update batch
router.put('/:id', async (req, res) => {
    try {
        const { batch_name, start_year, end_year, is_active } = req.body;
        
        // Check if batch exists
        const [existing] = await promisePool.query(
            'SELECT batch_id FROM batch_master WHERE batch_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Batch not found'
            });
        }
        
        // Update batch
        await promisePool.query(
            `UPDATE batch_master 
            SET batch_name = ?, start_year = ?, end_year = ?, is_active = ?
            WHERE batch_id = ?`,
            [batch_name, start_year, end_year, is_active !== false, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Batch updated successfully'
        });
    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update batch',
            error: error.message
        });
    }
});

// DELETE batch
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting batch with ID: ${id}`);
        
        // Check if batch exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM batch_master WHERE batch_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Batch not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE batch_master SET is_active = 0, deleted_at = NOW() WHERE batch_id = ?',
            [id]
        );
        
        console.log(`Batch ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Batch deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting batch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete batch',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
