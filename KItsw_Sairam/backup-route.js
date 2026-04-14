// ============================================================
//  backup-route.js
//  In server.js:
//      const backupRoute = require('./backup-route');
//      app.use('/api', backupRoute);
// ============================================================

const express = require('express');
const router  = express.Router();
const { runBackup, runProjectBackup, deleteOldBackups } = require('./backup-service');

// POST /api/backup/manual  — DB backup button
router.post('/backup/manual', async (req, res) => {
    try {
        const result = await runBackup();
        res.json({ success: true, message: `DB Backup created: ${result.filename}`, filename: result.filename, sizeKB: result.sizeKB });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message || 'DB Backup failed' });
    }
});

// POST /api/backup/project  — Project backup button
router.post('/backup/project', async (req, res) => {
    try {
        const result = await runProjectBackup();
        res.json({ success: true, message: `Project Backup created: ${result.filename}`, filename: result.filename, sizeKB: result.sizeKB });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Project Backup failed' });
    }
});

// GET /api/backup/list  — list all backups
router.get('/backup/list', (req, res) => {
    const fs   = require('fs');
    const path = require('path');
    const dir  = 'E:\\Backup';

    if (!fs.existsSync(dir)) return res.json({ success: true, backups: [] });

    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.zip') || f.endsWith('.sql'))
        .map(f => {
            const stats = fs.statSync(path.join(dir, f));
            return {
                filename : f,
                type     : f.startsWith('project_') ? 'Project' : 'Database',
                sizeKB   : (stats.size / 1024).toFixed(1),
                createdAt: stats.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            };
        })
        .sort((a, b) => b.filename.localeCompare(a.filename));

    res.json({ success: true, backups: files });
});

// DELETE /api/backup/cleanup
router.delete('/backup/cleanup', (req, res) => {
    const count = deleteOldBackups();
    res.json({ success: true, deleted: count });
});

module.exports = router;
