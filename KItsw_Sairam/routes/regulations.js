// Regulation Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all regulations
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM regulation_master WHERE is_active = 1 ORDER BY regulation_name DESC'
        );
        
        res.json({
            status: 'success',
            message: 'Regulations retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching regulations:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch regulations',
            error: error.message
        });
    }
});

// GET single regulation by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM regulation_master WHERE regulation_id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Regulation not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Regulation retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching regulation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch regulation',
            error: error.message
        });
    }
});

// POST create new regulation
router.post('/', async (req, res) => {
    try {
        const { regulation_name, regulation_year, description, is_active } = req.body;
        
        // Validation
        if (!regulation_name || !regulation_year) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: regulation_name, regulation_year'
            });
        }
        
        // Check if regulation year already exists
        const [existing] = await promisePool.query(
            'SELECT regulation_id FROM regulation_master WHERE regulation_year = ?',
            [regulation_year]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Regulation year already exists'
            });
        }
        
        // Insert new regulation
        const [result] = await promisePool.query(
            `INSERT INTO regulation_master 
            (regulation_name, regulation_year, description, is_active) 
            VALUES (?, ?, ?, ?)`,
            [regulation_name, regulation_year, description || null, is_active !== false]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Regulation created successfully',
            data: {
                regulation_id: result.insertId,
                regulation_name,
                regulation_year,
                description,
                is_active: is_active !== false
            }
        });
    } catch (error) {
        console.error('Error creating regulation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create regulation',
            error: error.message
        });
    }
});

// PUT update regulation
router.put('/:id', async (req, res) => {
    try {
        const { regulation_name, regulation_year, description, is_active } = req.body;
        
        // Check if regulation exists
        const [existing] = await promisePool.query(
            'SELECT regulation_id FROM regulation_master WHERE regulation_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Regulation not found'
            });
        }
        
        // Update regulation
        await promisePool.query(
            `UPDATE regulation_master 
            SET regulation_name = ?, regulation_year = ?, description = ?, is_active = ?
            WHERE regulation_id = ?`,
            [regulation_name, regulation_year, description || null, is_active !== false, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Regulation updated successfully'
        });
    } catch (error) {
        console.error('Error updating regulation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update regulation',
            error: error.message
        });
    }
});

// DELETE regulation
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting regulation with ID: ${id}`);
        
        // Check if regulation exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM regulation_master WHERE regulation_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Regulation not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE regulation_master SET is_active = 0, deleted_at = NOW() WHERE regulation_id = ?',
            [id]
        );
        
        console.log(`Regulation ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Regulation deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting regulation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete regulation',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
