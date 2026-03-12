/**
 * Seating Plan Management Routes
 * Handles blocks, rooms, and seating arrangements for examinations
 */

const express = require('express');

module.exports = (pool) => {
    const router = express.Router();

    // =====================================================
    // BLOCK MASTER ROUTES
    // =====================================================

    // GET all blocks
    router.get('/blocks', async (req, res) => {
        try {
            const [blocks] = await pool.query(
                'SELECT * FROM block_master WHERE deleted_at IS NULL ORDER BY block_code'
            );
            res.json({ status: 'success', data: blocks });
        } catch (error) {
            console.error('Error fetching blocks:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch blocks',
                error: error.message 
            });
        }
    });

    // POST create new block
    router.post('/blocks', async (req, res) => {
        try {
            const { block_code, block_name, total_floors, description } = req.body;

            // Validation
            if (!block_code || !block_name) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Block code and name are required'
                });
            }

            const [result] = await pool.query(
                `INSERT INTO block_master (block_code, block_name, total_floors, description) 
                 VALUES (?, ?, ?, ?)`,
                [block_code, block_name, total_floors || 1, description]
            );

            res.json({ 
                status: 'success', 
                message: 'Block created successfully',
                data: { block_id: result.insertId }
            });
        } catch (error) {
            console.error('Error creating block:', error);
            res.status(500).json({ 
                status: 'error', 
                message: error.code === 'ER_DUP_ENTRY' ? 'Block code already exists' : 'Failed to create block',
                error: error.message 
            });
        }
    });

    // PUT update block
    router.put('/blocks/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { block_code, block_name, total_floors, description, is_active } = req.body;

            await pool.query(
                `UPDATE block_master 
                 SET block_code = ?, block_name = ?, total_floors = ?, description = ?, is_active = ?
                 WHERE block_id = ? AND deleted_at IS NULL`,
                [block_code, block_name, total_floors, description, is_active, id]
            );

            res.json({ status: 'success', message: 'Block updated successfully' });
        } catch (error) {
            console.error('Error updating block:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to update block',
                error: error.message 
            });
        }
    });

    // DELETE block (soft delete)
    router.delete('/blocks/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query(
                'UPDATE block_master SET deleted_at = NOW() WHERE block_id = ?',
                [id]
            );
            res.json({ status: 'success', message: 'Block deleted successfully' });
        } catch (error) {
            console.error('Error deleting block:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to delete block',
                error: error.message 
            });
        }
    });

    // =====================================================
    // ROOM MASTER ROUTES
    // =====================================================

    // GET all rooms
    router.get('/rooms', async (req, res) => {
        try {
            const { block_id, room_type } = req.query;
            let query = `
                SELECT r.*, b.block_name, b.block_code
                FROM room_master r
                LEFT JOIN block_master b ON r.block_id = b.block_id
                WHERE r.deleted_at IS NULL
            `;
            const params = [];

            if (block_id) {
                query += ' AND r.block_id = ?';
                params.push(block_id);
            }

            if (room_type) {
                query += ' AND r.room_type = ?';
                params.push(room_type);
            }

            query += ' ORDER BY b.block_code, r.floor_number, r.room_code';

            const [rooms] = await pool.query(query, params);
            res.json({ status: 'success', data: rooms });
        } catch (error) {
            console.error('Error fetching rooms:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch rooms',
                error: error.message 
            });
        }
    });

    // GET single room with layout
    router.get('/rooms/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const [rooms] = await pool.query(
                `SELECT r.*, b.block_name, b.block_code
                 FROM room_master r
                 LEFT JOIN block_master b ON r.block_id = b.block_id
                 WHERE r.room_id = ? AND r.deleted_at IS NULL`,
                [id]
            );

            if (rooms.length === 0) {
                return res.status(404).json({ 
                    status: 'error', 
                    message: 'Room not found' 
                });
            }

            res.json({ status: 'success', data: rooms[0] });
        } catch (error) {
            console.error('Error fetching room:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch room',
                error: error.message 
            });
        }
    });

    // POST create new room
    router.post('/rooms', async (req, res) => {
        try {
            const { 
                block_id, room_code, room_name, room_type, floor_number,
                total_rows, total_columns, students_per_bench,
                has_projector, has_ac, description, remarks, layout_data
            } = req.body;

            // Validation
            if (!block_id || !room_code || !room_name || !total_rows || !total_columns || !students_per_bench) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Block, room code, name, rows, columns, and students per bench are required'
                });
            }

            // Generate default layout data if not provided
            const layoutData = layout_data || generateDefaultLayout(total_rows, total_columns);

            const [result] = await pool.query(
                `INSERT INTO room_master 
                 (block_id, room_code, room_name, room_type, floor_number, 
                  total_rows, total_columns, students_per_bench,
                  has_projector, has_ac, description, remarks, layout_data) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    block_id, room_code, room_name, room_type || 'Classroom', floor_number || 1,
                    total_rows, total_columns, students_per_bench,
                    has_projector || false, has_ac || false, description, remarks,
                    JSON.stringify(layoutData)
                ]
            );

            res.json({ 
                status: 'success', 
                message: 'Room created successfully',
                data: { room_id: result.insertId }
            });
        } catch (error) {
            console.error('Error creating room:', error);
            res.status(500).json({ 
                status: 'error', 
                message: error.code === 'ER_DUP_ENTRY' ? 'Room code already exists' : 'Failed to create room',
                error: error.message 
            });
        }
    });

    // PUT update room
    router.put('/rooms/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { 
                block_id, room_code, room_name, room_type, floor_number,
                total_rows, total_columns, students_per_bench,
                has_projector, has_ac, description, remarks, layout_data, is_active
            } = req.body;

            // If dimensions changed, regenerate layout
            let finalLayoutData = layout_data;
            if (layout_data === undefined || layout_data === null) {
                finalLayoutData = generateDefaultLayout(total_rows, total_columns);
            }

            await pool.query(
                `UPDATE room_master 
                 SET block_id = ?, room_code = ?, room_name = ?, room_type = ?, floor_number = ?,
                     total_rows = ?, total_columns = ?, students_per_bench = ?,
                     has_projector = ?, has_ac = ?, description = ?, remarks = ?,
                     layout_data = ?, is_active = ?
                 WHERE room_id = ? AND deleted_at IS NULL`,
                [
                    block_id, room_code, room_name, room_type, floor_number,
                    total_rows, total_columns, students_per_bench,
                    has_projector, has_ac, description, remarks,
                    JSON.stringify(finalLayoutData), is_active, id
                ]
            );

            res.json({ status: 'success', message: 'Room updated successfully' });
        } catch (error) {
            console.error('Error updating room:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to update room',
                error: error.message 
            });
        }
    });

    // DELETE room (soft delete)
    router.delete('/rooms/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query(
                'UPDATE room_master SET deleted_at = NOW() WHERE room_id = ?',
                [id]
            );
            res.json({ status: 'success', message: 'Room deleted successfully' });
        } catch (error) {
            console.error('Error deleting room:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to delete room',
                error: error.message 
            });
        }
    });

    // =====================================================
    // SEATING ARRANGEMENT ROUTES
    // =====================================================

    // GET all seating arrangements
    router.get('/arrangements', async (req, res) => {
        try {
            const { exam_session_id, exam_date, room_id, status } = req.query;
            let query = `
                SELECT sa.*, 
                       es.session_name, es.exam_date as exam_session_date,
                       r.room_code, r.room_name, r.total_capacity,
                       b.block_name, b.block_code
                FROM seating_arrangement sa
                LEFT JOIN exam_session_master es ON sa.exam_session_id = es.session_id
                LEFT JOIN room_master r ON sa.room_id = r.room_id
                LEFT JOIN block_master b ON r.block_id = b.block_id
                WHERE sa.deleted_at IS NULL
            `;
            const params = [];

            if (exam_session_id) {
                query += ' AND sa.exam_session_id = ?';
                params.push(exam_session_id);
            }

            if (exam_date) {
                query += ' AND sa.exam_date = ?';
                params.push(exam_date);
            }

            if (room_id) {
                query += ' AND sa.room_id = ?';
                params.push(room_id);
            }

            if (status) {
                query += ' AND sa.status = ?';
                params.push(status);
            }

            query += ' ORDER BY sa.exam_date DESC, sa.session_type, b.block_code, r.room_code';

            const [arrangements] = await pool.query(query, params);
            res.json({ status: 'success', data: arrangements });
        } catch (error) {
            console.error('Error fetching arrangements:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch arrangements',
                error: error.message 
            });
        }
    });

    // GET single arrangement with full details
    router.get('/arrangements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const [arrangements] = await pool.query(
                `SELECT sa.*, 
                        es.session_name, es.exam_date as exam_session_date,
                        r.room_code, r.room_name, r.total_capacity, r.total_rows, r.total_columns,
                        r.students_per_bench, r.layout_data,
                        b.block_name, b.block_code
                 FROM seating_arrangement sa
                 LEFT JOIN exam_session_master es ON sa.exam_session_id = es.session_id
                 LEFT JOIN room_master r ON sa.room_id = r.room_id
                 LEFT JOIN block_master b ON r.block_id = b.block_id
                 WHERE sa.arrangement_id = ? AND sa.deleted_at IS NULL`,
                [id]
            );

            if (arrangements.length === 0) {
                return res.status(404).json({ 
                    status: 'error', 
                    message: 'Arrangement not found' 
                });
            }

            res.json({ status: 'success', data: arrangements[0] });
        } catch (error) {
            console.error('Error fetching arrangement:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch arrangement',
                error: error.message 
            });
        }
    });

    // POST create new seating arrangement
    router.post('/arrangements', async (req, res) => {
        try {
            const { 
                exam_session_id, exam_date, session_type, room_id,
                arrangement_name, seating_data, created_by, remarks
            } = req.body;

            // Validation
            if (!exam_session_id || !exam_date || !session_type || !room_id || !arrangement_name) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Exam session, date, session type, room, and arrangement name are required'
                });
            }

            // Calculate total students
            const totalStudents = seating_data?.seats?.length || 0;

            const [result] = await pool.query(
                `INSERT INTO seating_arrangement 
                 (exam_session_id, exam_date, session_type, room_id, arrangement_name,
                  total_students_allocated, seating_data, created_by, remarks) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    exam_session_id, exam_date, session_type, room_id, arrangement_name,
                    totalStudents, JSON.stringify(seating_data || {}), created_by, remarks
                ]
            );

            res.json({ 
                status: 'success', 
                message: 'Seating arrangement created successfully',
                data: { arrangement_id: result.insertId }
            });
        } catch (error) {
            console.error('Error creating arrangement:', error);
            res.status(500).json({ 
                status: 'error', 
                message: error.code === 'ER_DUP_ENTRY' ? 'Arrangement already exists for this exam, date, session, and room' : 'Failed to create arrangement',
                error: error.message 
            });
        }
    });

    // PUT update seating arrangement
    router.put('/arrangements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { 
                arrangement_name, seating_data, status,
                approved_by, remarks
            } = req.body;

            // Calculate total students
            const totalStudents = seating_data?.seats?.length || 0;

            // Set approved_at if status is changing to Confirmed or Published
            const approved_at = (status === 'Confirmed' || status === 'Published') && approved_by 
                ? new Date() 
                : null;

            await pool.query(
                `UPDATE seating_arrangement 
                 SET arrangement_name = ?, seating_data = ?, total_students_allocated = ?,
                     status = ?, approved_by = ?, approved_at = ?, remarks = ?
                 WHERE arrangement_id = ? AND deleted_at IS NULL`,
                [
                    arrangement_name, JSON.stringify(seating_data || {}), totalStudents,
                    status, approved_by, approved_at, remarks, id
                ]
            );

            res.json({ status: 'success', message: 'Seating arrangement updated successfully' });
        } catch (error) {
            console.error('Error updating arrangement:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to update arrangement',
                error: error.message 
            });
        }
    });

    // DELETE arrangement (soft delete)
    router.delete('/arrangements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query(
                'UPDATE seating_arrangement SET deleted_at = NOW() WHERE arrangement_id = ?',
                [id]
            );
            res.json({ status: 'success', message: 'Seating arrangement deleted successfully' });
        } catch (error) {
            console.error('Error deleting arrangement:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to delete arrangement',
                error: error.message 
            });
        }
    });

    // =====================================================
    // HELPER FUNCTIONS
    // =====================================================

    /**
     * Generate default layout data for a room
     */
    function generateDefaultLayout(rows, columns) {
        const benches = [];
        const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                benches.push({
                    row: r + 1,
                    col: c + 1,
                    available: true,
                    label: `${rowLabels[r] || r + 1}${c + 1}`
                });
            }
        }
        
        return { benches };
    }

    return router;
};
