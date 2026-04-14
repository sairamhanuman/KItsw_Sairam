const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');

// ===== GET ALL COLLEGES =====
router.get('/', async (req, res) => {
    try {
        console.log('=== GET COLLEGES REQUEST ===');

        const [colleges] = await promisePool.query(
            'SELECT * FROM college_master WHERE is_active = 1 ORDER BY college_code'
        );

        console.log(`Found ${colleges.length} colleges`);

        res.json({
            status: 'success',
            data: colleges
        });

    } catch (error) {
        console.error('=== GET COLLEGES ERROR ===', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch colleges', error: error.message });
    }
});

// ===== GET SINGLE COLLEGE =====
router.get('/:id', async (req, res) => {
    try {
        const collegeId = req.params.id;
        console.log('=== GET COLLEGE ===', collegeId);

        const [colleges] = await promisePool.query(
            'SELECT * FROM college_master WHERE college_id = ? AND is_active = 1',
            [collegeId]
        );

        if (colleges.length === 0) {
            return res.status(404).json({ status: 'error', message: 'College not found' });
        }

        res.json({ status: 'success', data: colleges[0] });

    } catch (error) {
        console.error('=== GET COLLEGE ERROR ===', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch college', error: error.message });
    }
});

// ===== CREATE COLLEGE =====
router.post('/', async (req, res) => {
    try {
        console.log('=== CREATE COLLEGE ===', req.body);

        const { college_code, college_name, address, phone, email, website } = req.body;

        if (!college_code || !college_name) {
            return res.status(400).json({
                status: 'error',
                message: 'College Code and College Name are required'
            });
        }

        // Check duplicate college_code
        const [existing] = await promisePool.query(
            'SELECT college_id FROM college_master WHERE college_code = ?',
            [college_code.toUpperCase()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ status: 'error', message: 'College Code already exists' });
        }

        const [result] = await promisePool.query(
            `INSERT INTO college_master (college_code, college_name, address, phone, email, website)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                college_code.toUpperCase().trim(),
                college_name.trim(),
                address || null,
                phone || null,
                email || null,
                website || null
            ]
        );

        console.log('College created, ID:', result.insertId);

        res.status(201).json({
            status: 'success',
            message: 'College created successfully',
            data: { college_id: result.insertId, college_code: college_code.toUpperCase() }
        });

    } catch (error) {
        console.error('=== CREATE COLLEGE ERROR ===', error);
        res.status(500).json({ status: 'error', message: 'Failed to create college', error: error.message });
    }
});

// ===== UPDATE COLLEGE =====
router.put('/:id', async (req, res) => {
    try {
        const collegeId = req.params.id;
        console.log('=== UPDATE COLLEGE ===', collegeId, req.body);

        const { college_code, college_name, address, phone, email, website } = req.body;

        if (!college_code || !college_name) {
            return res.status(400).json({
                status: 'error',
                message: 'College Code and College Name are required'
            });
        }

        // Check duplicate college_code (excluding self)
        const [existing] = await promisePool.query(
            'SELECT college_id FROM college_master WHERE college_code = ? AND college_id != ?',
            [college_code.toUpperCase(), collegeId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ status: 'error', message: 'College Code already exists' });
        }

        const [result] = await promisePool.query(
            `UPDATE college_master SET
                college_code = ?,
                college_name = ?,
                address = ?,
                phone = ?,
                email = ?,
                website = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE college_id = ? AND is_active = 1`,
            [
                college_code.toUpperCase().trim(),
                college_name.trim(),
                address || null,
                phone || null,
                email || null,
                website || null,
                collegeId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'College not found' });
        }

        console.log('College updated successfully');

        res.json({ status: 'success', message: 'College updated successfully' });

    } catch (error) {
        console.error('=== UPDATE COLLEGE ERROR ===', error);
        res.status(500).json({ status: 'error', message: 'Failed to update college', error: error.message });
    }
});

// ===== DELETE COLLEGE (soft delete) =====
router.delete('/:id', async (req, res) => {
    try {
        const collegeId = req.params.id;
        console.log('=== DELETE COLLEGE ===', collegeId);

        // Check if any active staff are linked
        const [staffCount] = await promisePool.query(
            'SELECT COUNT(*) as cnt FROM staff_master WHERE college_id = ? AND is_active = 1',
            [collegeId]
        );

        if (staffCount[0].cnt > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot delete: ${staffCount[0].cnt} active staff member(s) are linked to this college`
            });
        }

        const [result] = await promisePool.query(
            'UPDATE college_master SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE college_id = ?',
            [collegeId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'College not found' });
        }

        console.log('College deleted successfully');

        res.json({ status: 'success', message: 'College deleted successfully' });

    } catch (error) {
        console.error('=== DELETE COLLEGE ERROR ===', error);
        res.status(500).json({ status: 'error', message: 'Failed to delete college', error: error.message });
    }
});

module.exports = router;
