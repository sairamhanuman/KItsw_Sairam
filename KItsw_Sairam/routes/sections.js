// Section Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all sections
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM section_master WHERE is_active = 1 ORDER BY section_name'
        );
        
        res.json({
            status: 'success',
            message: 'Sections retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch sections',
            error: error.message
        });
    }
});

// GET single section by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM section_master WHERE section_id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Section not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Section retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching section:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch section',
            error: error.message
        });
    }
});

// POST create new section
router.post('/', async (req, res) => {
    try {
        const { section_name, capacity, is_active } = req.body;
        
        // Validation
        if (!section_name) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required field: section_name'
            });
        }
        
        // Insert new section
        const [result] = await promisePool.query(
            `INSERT INTO section_master 
            (section_name, capacity, is_active) 
            VALUES (?, ?, ?)`,
            [section_name, capacity || 60, is_active !== false]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Section created successfully',
            data: {
                section_id: result.insertId,
                section_name,
                capacity: capacity || 60,
                is_active: is_active !== false
            }
        });
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create section',
            error: error.message
        });
    }
});

// PUT update section
router.put('/:id', async (req, res) => {
    try {
        const { section_name, capacity, is_active } = req.body;
        
        // Check if section exists
        const [existing] = await promisePool.query(
            'SELECT section_id FROM section_master WHERE section_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Section not found'
            });
        }
        
        // Update section
        await promisePool.query(
            `UPDATE section_master 
            SET section_name = ?, capacity = ?, is_active = ?
            WHERE section_id = ?`,
            [section_name, capacity || 60, is_active !== false, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Section updated successfully'
        });
    } catch (error) {
        console.error('Error updating section:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update section',
            error: error.message
        });
    }
});

// DELETE section
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting section with ID: ${id}`);
        
        // Check if section exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM section_master WHERE section_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Section not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE section_master SET is_active = 0, deleted_at = NOW() WHERE section_id = ?',
            [id]
        );
        
        console.log(`Section ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Section deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting section:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete section',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
