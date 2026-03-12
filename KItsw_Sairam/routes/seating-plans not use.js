// ============================================================
//  routes/seating-plans.js
//  Handles: Blocks, Rooms, Arrangements (for seating-plan.html)
//  API Base: /api/seating-plans
// ============================================================

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();

    // =====================================================
    // BLOCKS
    // =====================================================

    // GET all blocks
    router.get('/blocks', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT * FROM block_master 
                WHERE deleted_at IS NULL 
                ORDER BY block_code
            `);
            res.json({ status: 'success', data: rows });
        } catch (err) {
            console.error('GET /blocks error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // POST create block
    router.post('/blocks', async (req, res) => {
        try {
            const { block_code, block_name, total_floors, description } = req.body;

            if (!block_code || !block_name) {
                return res.status(400).json({ status: 'error', message: 'block_code and block_name are required' });
            }

            const [result] = await pool.query(`
                INSERT INTO block_master (block_code, block_name, total_floors, description, is_active)
                VALUES (?, ?, ?, ?, 1)
            `, [block_code, block_name, total_floors || 1, description || null]);

            res.json({ status: 'success', data: { block_id: result.insertId }, message: 'Block created successfully' });
        } catch (err) {
            console.error('POST /blocks error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // PUT update block
    router.put('/blocks/:id', async (req, res) => {
        try {
            const { block_code, block_name, total_floors, description } = req.body;

            await pool.query(`
                UPDATE block_master 
                SET block_code = ?, block_name = ?, total_floors = ?, description = ?
                WHERE block_id = ?
            `, [block_code, block_name, total_floors, description || null, req.params.id]);

            res.json({ status: 'success', message: 'Block updated successfully' });
        } catch (err) {
            console.error('PUT /blocks/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // DELETE block
    router.delete('/blocks/:id', async (req, res) => {
        try {
            await pool.query(`DELETE FROM block_master WHERE block_id = ?`, [req.params.id]);
            res.json({ status: 'success', message: 'Block deleted successfully' });
        } catch (err) {
            console.error('DELETE /blocks/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // =====================================================
    // ROOMS
    // =====================================================

    // GET all rooms
    router.get('/rooms', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    rm.*,
                    bm.block_code,
                    bm.block_name
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                WHERE rm.deleted_at IS NULL
                ORDER BY bm.block_code, rm.floor_number, rm.room_code
            `);
            res.json({ status: 'success', data: rows });
        } catch (err) {
            console.error('GET /rooms error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // GET single room
    router.get('/rooms/:id', async (req, res) => {
        try {
            const [[room]] = await pool.query(`
                SELECT 
                    rm.*,
                    bm.block_code,
                    bm.block_name
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                WHERE rm.room_id = ?
            `, [req.params.id]);

            if (!room) return res.status(404).json({ status: 'error', message: 'Room not found' });
            res.json({ status: 'success', data: room });
        } catch (err) {
            console.error('GET /rooms/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // POST create room
    router.post('/rooms', async (req, res) => {
        try {
            const {
                block_id, room_code, room_name, room_type,
                floor_number, has_projector, has_ac,
                description
            } = req.body;

            // Parse numeric fields explicitly to avoid NaN
            const total_rows       = parseInt(req.body.total_rows, 10);
            const total_columns    = parseInt(req.body.total_columns, 10);
            const students_per_bench = parseInt(req.body.students_per_bench, 10);

            // Validate required fields
            if (!block_id || !room_code || !room_name) {
                return res.status(400).json({ status: 'error', message: 'block_id, room_code, room_name are required' });
            }
            if (isNaN(total_rows) || isNaN(total_columns) || isNaN(students_per_bench)) {
                return res.status(400).json({ status: 'error', message: 'total_rows, total_columns, and students_per_bench must be valid numbers' });
            }

            const totalCapacity = (total_rows * total_columns) * students_per_bench;

            // Guard against double-stringify: accept both object and pre-stringified JSON
            let layout_data = req.body.layout_data;
            if (typeof layout_data === 'string') {
                try { layout_data = JSON.parse(layout_data); } catch { layout_data = null; }
            }
            const layoutJson = layout_data ? JSON.stringify(layout_data) : null;

            // Calculate usable capacity from selected benches in layout_data
            let usableCapacity = totalCapacity;
            if (layout_data && Array.isArray(layout_data.benches)) {
                const available = layout_data.benches.filter(b => b.available).length;
                usableCapacity = available * students_per_bench;
            }

            const [result] = await pool.query(`
                INSERT INTO room_master 
                    (block_id, room_number, room_name, room_type, floor_number,
                     total_rows, total_columns, students_per_bench,
                     total_capacity, usable_capacity,
                     has_projector, has_ac, description, layout_data,
                     exam_status, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 1)
            `, [
                block_id, room_code, room_name,
                room_type || 'Classroom', floor_number || 1,
                total_rows, total_columns, students_per_bench,
                totalCapacity, usableCapacity,
                has_projector ? 1 : 0, has_ac ? 1 : 0,
                description || null, layoutJson
            ]);

            res.json({ status: 'success', data: { room_id: result.insertId }, message: 'Room created successfully' });
        } catch (err) {
            console.error('POST /rooms error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // PUT update room
    router.put('/rooms/:id', async (req, res) => {
        try {
            const {
                block_id, room_code, room_name, room_type,
                floor_number, total_rows, total_columns,
                students_per_bench, has_projector, has_ac,
                description, layout_data, exam_status
            } = req.body;

            const totalCapacity = (total_rows * total_columns) * students_per_bench;
            const layoutJson = layout_data ? JSON.stringify(layout_data) : null;

            let usableCapacity = totalCapacity;
            if (layout_data && layout_data.benches) {
                const available = layout_data.benches.filter(b => b.available).length;
                usableCapacity = available * students_per_bench;
            }

            await pool.query(`
                UPDATE room_master SET
                    block_id          = ?,
                    room_number       = ?,
                    room_name         = ?,
                    room_type         = ?,
                    floor_number      = ?,
                    total_rows        = ?,
                    total_columns     = ?,
                    students_per_bench = ?,
                    total_capacity    = ?,
                    usable_capacity   = ?,
                    has_projector     = ?,
                    has_ac            = ?,
                    description       = ?,
                    layout_data       = ?,
                    exam_status       = COALESCE(?, exam_status)
                WHERE room_id = ?
            `, [
                block_id, room_code, room_name,
                room_type, floor_number,
                total_rows, total_columns, students_per_bench,
                totalCapacity, usableCapacity,
                has_projector ? 1 : 0, has_ac ? 1 : 0,
                description || null, layoutJson,
                exam_status || null,
                req.params.id
            ]);

            res.json({ status: 'success', message: 'Room updated successfully' });
        } catch (err) {
            console.error('PUT /rooms/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // PATCH room — for exam_status toggle only
    router.patch('/rooms/:id', async (req, res) => {
        try {
            const { exam_status } = req.body;
            await pool.query(`
                UPDATE room_master SET exam_status = ? WHERE room_id = ?
            `, [exam_status, req.params.id]);
            res.json({ status: 'success', message: 'Room status updated' });
        } catch (err) {
            console.error('PATCH /rooms/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // DELETE room
    router.delete('/rooms/:id', async (req, res) => {
        try {
            await pool.query(`DELETE FROM room_master WHERE room_id = ?`, [req.params.id]);
            res.json({ status: 'success', message: 'Room deleted successfully' });
        } catch (err) {
            console.error('DELETE /rooms/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // =====================================================
    // ARRANGEMENTS
    // (Reads from exam_seating_plan — created by seating-plan-generator)
    // =====================================================

    // GET all arrangements
    router.get('/arrangements', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    esp.plan_id                                                      AS arrangement_id,
                    CONCAT('Plan #', esp.plan_id, ' — ', 
                        DATE_FORMAT(esp.exam_date, '%d %b %Y'), ' ',
                        CASE esp.session_order WHEN 1 THEN 'FN' ELSE 'AN' END)      AS arrangement_name,
                    NULL                                                             AS session_name,
                    esp.exam_date,
                    CASE esp.session_order WHEN 1 THEN 'FN' ELSE 'AN' END           AS session_type,
                    GROUP_CONCAT(DISTINCT rm.room_number SEPARATOR ', ')             AS room_code,
                    COALESCE(GROUP_CONCAT(DISTINCT rm.room_name SEPARATOR ', '), '-') AS room_name,
                    esp.total_students                                               AS total_students_allocated,
                    COALESCE(SUM(espr.capacity_used), esp.total_students)            AS total_capacity,
                    esp.status,
                    esp.generated_by,
                    esp.created_at
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id = esp.plan_id
                LEFT JOIN room_master rm ON rm.room_id = espr.room_id
                GROUP BY esp.plan_id
                ORDER BY esp.exam_date DESC, esp.session_order
            `);
            res.json({ status: 'success', data: rows });
        } catch (err) {
            // If seating tables don't exist yet — return empty gracefully
            console.warn('GET /arrangements — tables may not exist yet:', err.message);
            res.json({ status: 'success', data: [] });
        }
    });

    // GET single arrangement
    router.get('/arrangements/:id', async (req, res) => {
        try {
            const [[plan]] = await pool.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT rm.room_number SEPARATOR ', ') AS room_code,
                    GROUP_CONCAT(DISTINCT rm.room_name SEPARATOR ', ')   AS room_name,
                    esp.total_students AS total_students_allocated,
                    esp.total_students AS total_capacity,
                    CASE esp.session_order WHEN 1 THEN 'FN' ELSE 'AN' END AS session_type,
                    CONCAT('Plan #', esp.plan_id) AS arrangement_name
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id = esp.plan_id
                LEFT JOIN room_master rm ON rm.room_id = espr.room_id
                WHERE esp.plan_id = ?
                GROUP BY esp.plan_id
            `, [req.params.id]);

            if (!plan) return res.status(404).json({ status: 'error', message: 'Arrangement not found' });
            res.json({ status: 'success', data: plan });
        } catch (err) {
            console.error('GET /arrangements/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    // DELETE arrangement
    router.delete('/arrangements/:id', async (req, res) => {
        try {
            const [[plan]] = await pool.query(
                `SELECT status FROM exam_seating_plan WHERE plan_id = ?`, [req.params.id]
            );
            if (!plan) return res.status(404).json({ status: 'error', message: 'Not found' });
            if (plan.status === 'Published') {
                return res.status(400).json({ status: 'error', message: 'Cannot delete a Published plan' });
            }
            await pool.query(`DELETE FROM exam_seating_plan WHERE plan_id = ?`, [req.params.id]);
            res.json({ status: 'success', message: 'Arrangement deleted successfully' });
        } catch (err) {
            console.error('DELETE /arrangements/:id error:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    return router;
};
