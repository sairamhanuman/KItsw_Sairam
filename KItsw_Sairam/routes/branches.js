// Branch Routes
const express = require('express');
const router = express.Router();

// Create a promise pool for database operations
let promisePool;

// Initialize the router with database pool
function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all branches
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT b.*, p.programme_name 
             FROM branch_master b 
             LEFT JOIN programme_master p ON b.programme_id = p.programme_id 
             WHERE b.is_active = 1
               AND (p.is_active = 1 OR p.is_active IS NULL)
             ORDER BY b.branch_code`
        );
        
        res.json({
            status: 'success',
            message: 'Branches retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch branches',
            error: error.message
        });
    }
});

// GET single branch by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT b.*, p.programme_name 
             FROM branch_master b 
             LEFT JOIN programme_master p ON b.programme_id = p.programme_id 
             WHERE b.branch_id = ?`,
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Branch not found'
            });
        }
        
        res.json({
            status: 'success',
            message: 'Branch retrieved successfully',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching branch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch branch',
            error: error.message
        });
    }
});

// POST create new branch
router.post('/', async (req, res) => {
    try {
        const { branch_code, branch_name, programme_id, description, is_active } = req.body;
        
        // Validation
        if (!branch_code || !branch_name || !programme_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: branch_code, branch_name, programme_id'
            });
        }
        
        // Check if branch code already exists
        const [existing] = await promisePool.query(
            'SELECT branch_id FROM branch_master WHERE branch_code = ?',
            [branch_code]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'Branch code already exists'
            });
        }
        
        // Verify programme exists
        const [programme] = await promisePool.query(
            'SELECT programme_id FROM programme_master WHERE programme_id = ?',
            [programme_id]
        );
        
        if (programme.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid programme_id'
            });
        }
        
        // Insert new branch
        const [result] = await promisePool.query(
            `INSERT INTO branch_master 
            (branch_code, branch_name, programme_id, description, is_active) 
            VALUES (?, ?, ?, ?, ?)`,
            [branch_code, branch_name, programme_id, description || null, is_active !== false]
        );
        
        res.status(201).json({
            status: 'success',
            message: 'Branch created successfully',
            data: {
                branch_id: result.insertId,
                branch_code,
                branch_name,
                programme_id,
                description,
                is_active: is_active !== false
            }
        });
    } catch (error) {
        console.error('Error creating branch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create branch',
            error: error.message
        });
    }
});

// PUT update branch
router.put('/:id', async (req, res) => {
    try {
        const { branch_name, programme_id, description, is_active } = req.body;
        
        // Check if branch exists
        const [existing] = await promisePool.query(
            'SELECT branch_id FROM branch_master WHERE branch_id = ?',
            [req.params.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Branch not found'
            });
        }
        
        // Verify programme exists if provided
        if (programme_id) {
            const [programme] = await promisePool.query(
                'SELECT programme_id FROM programme_master WHERE programme_id = ?',
                [programme_id]
            );
            
            if (programme.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid programme_id'
                });
            }
        }
        
        // Update branch
        await promisePool.query(
            `UPDATE branch_master 
            SET branch_name = ?, programme_id = ?, description = ?, is_active = ?
            WHERE branch_id = ?`,
            [branch_name, programme_id, description || null, is_active !== false, req.params.id]
        );
        
        res.json({
            status: 'success',
            message: 'Branch updated successfully'
        });
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update branch',
            error: error.message
        });
    }
});

// DELETE branch
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Soft deleting branch with ID: ${id}`);
        
        // Check if branch exists and is active
        const [existing] = await promisePool.query(
            'SELECT * FROM branch_master WHERE branch_id = ? AND is_active = 1',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Branch not found or already deleted'
            });
        }
        
        // Soft delete: Set is_active = 0 and deleted_at = NOW()
        await promisePool.query(
            'UPDATE branch_master SET is_active = 0, deleted_at = NOW() WHERE branch_id = ?',
            [id]
        );
        
        console.log(`Branch ${id} soft deleted successfully`);
        
        res.json({
            status: 'success',
            message: 'Branch deleted successfully (can be restored)'
        });
    } catch (error) {
        console.error('Error soft deleting branch:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete branch',
            error: error.message
        });
    }
});

module.exports = initializeRouter;
