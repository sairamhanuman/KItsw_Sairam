// Sessions Master Routes
const express = require('express');
const router = express.Router();

let promisePool;

function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// GET all sessions
router.get('/', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            `SELECT session_id, session_name, start_time, end_time, session_type, session_group, is_active, 
                    created_at, updated_at
             FROM sessions_master 
             WHERE is_active = 1
             ORDER BY session_name`
        );
        res.json({ status: 'success', message: 'Sessions retrieved successfully', data: rows });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch sessions', error: error.message });
    }
});

// GET single session by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await promisePool.query(
            `SELECT session_id, session_name, start_time, end_time, session_type, session_group, is_active, 
                    created_at, updated_at
             FROM sessions_master WHERE session_id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ status: 'error', message: 'Session not found' });
        res.json({ status: 'success', message: 'Session retrieved successfully', data: rows[0] });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch session', error: error.message });
    }
});

// POST new session
router.post('/', async (req, res) => {
    try {
        const { session_name, session_type, session_group, start_time, end_time, is_active = true } = req.body;

        if (!session_name || !session_type || !session_group || !start_time || !end_time) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: session_name, session_type, session_group, start_time, end_time'
            });
        }

        if (!['FN', 'AN'].includes(session_group)) {
            return res.status(400).json({ status: 'error', message: 'Invalid session_group. Must be FN or AN' });
        }

        // Only block duplicate among ACTIVE sessions
        const [existingSession] = await promisePool.query(
            'SELECT session_id FROM sessions_master WHERE session_name = ? AND is_active = 1',
            [session_name]
        );
        if (existingSession.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Session name already exists' });
        }

        const [result] = await promisePool.query(
            `INSERT INTO sessions_master (session_name, session_type, session_group, start_time, end_time, is_active) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [session_name, session_type, session_group, start_time, end_time, is_active]
        );

        res.status(201).json({
            status: 'success',
            message: 'Session created successfully',
            data: { session_id: result.insertId, session_name, session_type, session_group, start_time, end_time, is_active }
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ status: 'error', message: 'Failed to create session', error: error.message });
    }
});

// PUT update session
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { session_name, session_type, session_group, start_time, end_time, is_active } = req.body;

        const [existingSession] = await promisePool.query(
            'SELECT session_id FROM sessions_master WHERE session_id = ?', [id]
        );
        if (existingSession.length === 0) return res.status(404).json({ status: 'error', message: 'Session not found' });

        // Only block duplicate among OTHER active sessions
        if (session_name) {
            const [nameCheck] = await promisePool.query(
                'SELECT session_id FROM sessions_master WHERE session_name = ? AND session_id != ? AND is_active = 1',
                [session_name, id]
            );
            if (nameCheck.length > 0) return res.status(400).json({ status: 'error', message: 'Session name already exists' });
        }

        if (session_group !== undefined && !['FN', 'AN'].includes(session_group)) {
            return res.status(400).json({ status: 'error', message: 'Invalid session_group. Must be FN or AN' });
        }

        const updateFields = [];
        const updateValues = [];

        if (session_name  !== undefined) { updateFields.push('session_name = ?');  updateValues.push(session_name);  }
        if (session_type  !== undefined) { updateFields.push('session_type = ?');  updateValues.push(session_type);  }
        if (session_group !== undefined) { updateFields.push('session_group = ?'); updateValues.push(session_group); }
        if (start_time    !== undefined) { updateFields.push('start_time = ?');    updateValues.push(start_time);    }
        if (end_time      !== undefined) { updateFields.push('end_time = ?');      updateValues.push(end_time);      }
        if (is_active     !== undefined) { updateFields.push('is_active = ?');     updateValues.push(is_active);     }

        if (updateFields.length === 0) return res.status(400).json({ status: 'error', message: 'No fields to update' });

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        await promisePool.query(
            `UPDATE sessions_master SET ${updateFields.join(', ')} WHERE session_id = ?`,
            updateValues
        );

        res.json({ status: 'success', message: 'Session updated successfully' });
    } catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update session', error: error.message });
    }
});

// DELETE session (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [existingSession] = await promisePool.query(
            'SELECT session_id FROM sessions_master WHERE session_id = ?', [id]
        );
        if (existingSession.length === 0) return res.status(404).json({ status: 'error', message: 'Session not found' });

        await promisePool.query(
            'UPDATE sessions_master SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?', [id]
        );
        res.json({ status: 'success', message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ status: 'error', message: 'Failed to delete session', error: error.message });
    }
});

module.exports = { initializeRouter };
