// ============================================================
//  backup-service.js  –  MySQL Auto Backup Service
// ============================================================
require('dotenv').config();

const { exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const cron     = require('node-cron');

const DB_CONFIG = {
    host    : process.env.DB_HOST     || 'localhost',
    port    : process.env.DB_PORT     || '3306',
    user    : process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || '',
};

const BACKUP_DIR        = 'E:\\Backup';
const AUTO_BACKUP_TIME  = '0 */3 * * *';   // Every 3 hours
const DELETE_AFTER_DAYS = 7;

function ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`[Backup] Created directory: ${BACKUP_DIR}`);
    }
}

function buildFilename() {
    const now  = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `backup_${date}_${time}.sql`;
}

function runBackup() {
    return new Promise((resolve, reject) => {
        ensureDir();
        const filename   = buildFilename();
        const outputPath = path.join(BACKUP_DIR, filename);
        const { host, port, user, password, database } = DB_CONFIG;

        const cmd = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --databases ${database} --routines --triggers --single-transaction > "${outputPath}"`;

        console.log(`[Backup] Starting backup → ${outputPath}`);

        exec(cmd, { shell: true }, (err, stdout, stderr) => {
            if (err) {
                console.error('[Backup] FAILED:', err.message);
                return reject({ success: false, message: err.message });
            }

            // ✅ ZIP the .sql file using PowerShell
            const zipPath = outputPath.replace('.sql', '.zip');
            const zipCmd  = `powershell -command "Compress-Archive -Path '${outputPath}' -DestinationPath '${zipPath}'"`;

            exec(zipCmd, { shell: true }, (zipErr) => {
                if (zipErr) {
                    console.error('[Backup] ZIP failed:', zipErr.message);
                    // Still resolve with the .sql if zip fails
                    const stats  = fs.statSync(outputPath);
                    const sizeKB = (stats.size / 1024).toFixed(1);
                    return resolve({ success: true, filename, path: outputPath, sizeKB });
                }

                // Delete the raw .sql — keep only the .zip
                fs.unlinkSync(outputPath);

                const zipFilename = filename.replace('.sql', '.zip');
                const stats       = fs.statSync(zipPath);
                const sizeKB      = (stats.size / 1024).toFixed(1);

                console.log(`[Backup] SUCCESS: ${zipFilename}  (${sizeKB} KB)`);
                resolve({ success: true, filename: zipFilename, path: zipPath, sizeKB });
            });
        });
    });
}

function deleteOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return 0;
    const cutoff = Date.now() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const files  = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql'));
    let deleted  = 0;
    files.forEach(file => {
        const fullPath = path.join(BACKUP_DIR, file);
        if (fs.statSync(fullPath).mtimeMs < cutoff) {
            fs.unlinkSync(fullPath);
            console.log(`[Backup] Deleted old backup: ${file}`);
            deleted++;
        }
    });
    if (deleted === 0) console.log('[Backup] No old backups to delete.');
    return deleted;
}

cron.schedule(AUTO_BACKUP_TIME, async () => {
    console.log('[Backup] ⏰ Scheduled backup triggered...');
    try { await runBackup(); deleteOldBackups(); }
    catch (e) { console.error('[Backup] Scheduled backup error:', e.message); }
}, { timezone: 'Asia/Kolkata' });

console.log(`[Backup] ✅ Auto-backup scheduled: ${AUTO_BACKUP_TIME}  (Asia/Kolkata)`);
console.log(`[Backup] 📁 Backup folder: ${BACKUP_DIR}`);
console.log(`[Backup] 🗑️  Auto-delete backups older than ${DELETE_AFTER_DAYS} days`);

module.exports = { runBackup, deleteOldBackups };