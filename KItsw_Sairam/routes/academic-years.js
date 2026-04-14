// ============================================================
// routes/academic-years.js
// Academic Year Master — CRUD API
// ============================================================

module.exports = (promisePool) => {
    const express = require('express');
    const router  = express.Router();

    // ── GET all ──────────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT * FROM academic_year_master
                 WHERE is_active = 1
                 ORDER BY academic_year DESC, semester_type ASC`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET all including inactive (for admin table) ──────────────────────
    router.get('/all', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT * FROM academic_year_master
                 ORDER BY academic_year DESC, semester_type ASC`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST create ───────────────────────────────────────────────────────
    router.post('/', async (req, res) => {
        try {
            const { academic_year, semester_type, is_current, is_active } = req.body;

            if (!academic_year || !semester_type) {
                return res.status(400).json({ success: false, message: 'Academic Year and Semester Type are required' });
            }

            // Validate format e.g. 2025-26
            if (!/^\d{4}-\d{2}$/.test(academic_year.trim())) {
                return res.status(400).json({ success: false, message: 'Format must be YYYY-YY (e.g. 2025-26)' });
            }

            // If marking as current, unset all others first
            if (parseInt(is_current) === 1) {
                await promisePool.query(
                    `UPDATE academic_year_master SET is_current = 0`
                );
            }

            const [result] = await promisePool.query(
                `INSERT INTO academic_year_master
                    (academic_year, semester_type, is_current, is_active)
                 VALUES (?, ?, ?, ?)`,
                [
                    academic_year.trim(),
                    semester_type,
                    parseInt(is_current) || 0,
                    parseInt(is_active) !== 0 ? 1 : 0
                ]
            );

            res.json({ success: true, message: 'Academic Year created successfully', id: result.insertId });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: `${req.body.academic_year} (${req.body.semester_type}) already exists`
                });
            }
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PUT update ────────────────────────────────────────────────────────
    router.put('/:id', async (req, res) => {
        try {
            const { academic_year, semester_type, is_current, is_active } = req.body;

            if (!academic_year || !semester_type) {
                return res.status(400).json({ success: false, message: 'Academic Year and Semester Type are required' });
            }

            if (!/^\d{4}-\d{2}$/.test(academic_year.trim())) {
                return res.status(400).json({ success: false, message: 'Format must be YYYY-YY (e.g. 2025-26)' });
            }

            // If marking as current, unset all others first
            if (parseInt(is_current) === 1) {
                await promisePool.query(
                    `UPDATE academic_year_master SET is_current = 0 WHERE academic_year_id != ?`,
                    [req.params.id]
                );
            }

            await promisePool.query(
                `UPDATE academic_year_master
                 SET academic_year = ?,
                     semester_type = ?,
                     is_current    = ?,
                     is_active     = ?
                 WHERE academic_year_id = ?`,
                [
                    academic_year.trim(),
                    semester_type,
                    parseInt(is_current) || 0,
                    parseInt(is_active) !== 0 ? 1 : 0,
                    req.params.id
                ]
            );

            res.json({ success: true, message: 'Academic Year updated successfully' });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: `${req.body.academic_year} (${req.body.semester_type}) already exists`
                });
            }
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── DELETE (soft) ─────────────────────────────────────────────────────
    router.delete('/:id', async (req, res) => {
        try {
            await promisePool.query(
                `UPDATE academic_year_master SET is_active = 0 WHERE academic_year_id = ?`,
                [req.params.id]
            );
            res.json({ success: true, message: 'Academic Year deactivated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── PATCH set current ─────────────────────────────────────────────────
    router.patch('/:id/set-current', async (req, res) => {
        try {
            await promisePool.query(`UPDATE academic_year_master SET is_current = 0`);
            await promisePool.query(
                `UPDATE academic_year_master SET is_current = 1 WHERE academic_year_id = ?`,
                [req.params.id]
            );
            res.json({ success: true, message: 'Current academic year updated' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    return router;
};
