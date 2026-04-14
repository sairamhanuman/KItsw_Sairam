// ============================================================
//  backup-route.js  –  Add this to your Express server
//  
//  In your server.js / app.js add:
//      const backupRoute = require('./backup-route');
//      app.use('/api', backupRoute);
// ============================================================

const express       = require('express');
const router        = express.Router();
const { runBackup, deleteOldBackups } = require('./backup-service');

// POST /api/backup/manual  –  triggered by the HTML button
router.post('/backup/manual', async (req, res) => {
    try {
        const result = await runBackup();
        res.json({
            success : true,
            message : `Backup created: ${result.filename}`,
            filename: result.filename,
            sizeKB  : result.sizeKB,
            path    : result.path,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || 'Backup failed',
        });
    }
});

// GET /api/backup/list  –  list all backups in E:\Backup
router.get('/backup/list', (req, res) => {
    const fs   = require('fs');
    const path = require('path');
    const dir  = 'E:\\Backup';

    if (!fs.existsSync(dir)) {
        return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .map(f => {
            const fullPath = path.join(dir, f);
            const stats    = fs.statSync(fullPath);
            return {
                filename : f,
                sizeKB   : (stats.size / 1024).toFixed(1),
                createdAt: stats.mtime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            };
        })
        .sort((a, b) => b.filename.localeCompare(a.filename));   // newest first

    res.json({ success: true, backups: files });
});

// DELETE /api/backup/cleanup  –  force delete backups older than 7 days
router.delete('/backup/cleanup', (req, res) => {
    const count = deleteOldBackups();
    res.json({ success: true, deleted: count });
});

module.exports = router;
