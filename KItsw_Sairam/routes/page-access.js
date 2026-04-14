// ============================================================
// routes/page-access.js
// Page Access Control — API
// ============================================================

module.exports = (promisePool) => {
    const express = require('express');
    const router  = express.Router();

    // ── GET all pages (for admin UI) ──────────────────────────────────────────
    router.get('/pages', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT * FROM page_master WHERE is_active=1
                 ORDER BY module_group, display_order`
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET pages accessible by a specific user ───────────────────────────────
    router.get('/user/:userId', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT pm.*
                 FROM user_page_access upa
                 JOIN page_master pm ON upa.page_id = pm.page_id
                 WHERE upa.user_id = ? AND pm.is_active = 1
                 ORDER BY pm.module_group, pm.display_order`,
                [req.params.userId]
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET pages with access status for a user (for admin checkbox UI) ───────
    router.get('/user/:userId/all', async (req, res) => {
        try {
            const [rows] = await promisePool.query(
                `SELECT pm.*,
                    CASE WHEN upa.access_id IS NOT NULL THEN 1 ELSE 0 END AS has_access
                 FROM page_master pm
                 LEFT JOIN user_page_access upa
                    ON pm.page_id = upa.page_id AND upa.user_id = ?
                 WHERE pm.is_active = 1
                 ORDER BY pm.module_group, pm.display_order`,
                [req.params.userId]
            );
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST save user page access (replace all) ──────────────────────────────
    router.post('/user/:userId', async (req, res) => {
        const conn = await promisePool.getConnection();
        try {
            await conn.beginTransaction();
            const { page_ids, granted_by } = req.body;
            const userId = req.params.userId;

            // Delete existing access
            await conn.query(
                `DELETE FROM user_page_access WHERE user_id = ?`, [userId]
            );

            // Insert new access
            if (page_ids && page_ids.length > 0) {
                const rows = page_ids.map(pid => [userId, pid, granted_by || null]);
                await conn.query(
                    `INSERT INTO user_page_access (user_id, page_id, granted_by) VALUES ?`,
                    [rows]
                );
            }

            await conn.commit();
            res.json({
                success: true,
                message: `Access updated — ${page_ids?.length || 0} pages granted`
            });
        } catch (err) {
            await conn.rollback();
            res.status(500).json({ success: false, message: err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET check if user can access a specific page URL ─────────────────────
    router.get('/check', async (req, res) => {
        const { user_id, page_url } = req.query;
        if (!user_id || !page_url) {
            return res.json({ success: true, allowed: false });
        }
        try {
            const [rows] = await promisePool.query(
                `SELECT upa.access_id
                 FROM user_page_access upa
                 JOIN page_master pm ON upa.page_id = pm.page_id
                 WHERE upa.user_id = ? AND pm.page_url = ? AND pm.is_active = 1`,
                [user_id, page_url]
            );
            res.json({ success: true, allowed: rows.length > 0 });
        } catch (err) {
            res.status(500).json({ success: false, allowed: false });
        }
    });

    return router;
};
