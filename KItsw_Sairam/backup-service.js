// ============================================================
//  backup-service.js  –  MySQL DB + Project File Backup
// ============================================================
require('dotenv').config();

const { exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const cron     = require('node-cron');

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────
const DB_CONFIG = {
    host    : process.env.DB_HOST     || 'localhost',
    port    : process.env.DB_PORT     || '3306',
    user    : process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || '',
};

const BACKUP_DIR        = 'E:\\Backup';
const AUTO_BACKUP_TIME  = '0 */3 * * *';      // Every 3 hours
const DELETE_AFTER_DAYS = 7;

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────
function ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`[Backup] Created directory: ${BACKUP_DIR}`);
    }
}

function buildFilename(prefix, ext) {
    const now  = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    return `${prefix}_${date}_${time}.${ext}`;
}

// ──────────────────────────────────────────────
//  DB BACKUP  (mysqldump → zip)
// ──────────────────────────────────────────────
function runBackup() {
    return new Promise((resolve, reject) => {
        ensureDir();

        const sqlFilename = buildFilename('backup', 'sql');
        const sqlPath     = path.join(BACKUP_DIR, sqlFilename);
        const { host, port, user, password, database } = DB_CONFIG;

        const dumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} -p${password} --databases ${database} --routines --triggers --single-transaction > "${sqlPath}"`;

        console.log(`[DB Backup] Starting -> ${sqlPath}`);

        exec(dumpCmd, { shell: true }, (err) => {
            if (err) {
                console.error('[DB Backup] FAILED:', err.message);
                return reject({ success: false, message: err.message });
            }

            const zipFilename = sqlFilename.replace('.sql', '.zip');
            const zipPath     = path.join(BACKUP_DIR, zipFilename);
            const zipCmd      = `powershell -command "Compress-Archive -Path '${sqlPath}' -DestinationPath '${zipPath}' -Force"`;

            exec(zipCmd, { shell: true }, (zipErr) => {
                if (zipErr) {
                    console.error('[DB Backup] ZIP failed:', zipErr.message);
                    const sizeKB = (fs.statSync(sqlPath).size / 1024).toFixed(1);
                    return resolve({ success: true, filename: sqlFilename, path: sqlPath, sizeKB });
                }
                fs.unlinkSync(sqlPath);
                const sizeKB = (fs.statSync(zipPath).size / 1024).toFixed(1);
                console.log(`[DB Backup] SUCCESS: ${zipFilename}  (${sizeKB} KB)`);
                resolve({ success: true, filename: zipFilename, path: zipPath, sizeKB });
            });
        });
    });
}

// ──────────────────────────────────────────────
//  PROJECT BACKUP  — uses a temp PS1 script file
//  Excludes: node_modules, uploads, .git
// ──────────────────────────────────────────────
function runProjectBackup() {
    return new Promise((resolve, reject) => {
        ensureDir();

        const zipFilename = buildFilename('project', 'zip');
        const zipPath     = path.join(BACKUP_DIR, zipFilename);
        const projectDir  = __dirname;

        // Write a .ps1 script file — avoids all quoting/escaping issues
        const ps1Path = path.join(BACKUP_DIR, '_project_backup.ps1');
        const ps1Content = `
$src     = '${projectDir.replace(/'/g, "''")}'
$dest    = '${zipPath.replace(/'/g, "''")}'
$exclude = @('node_modules', 'uploads', '.git', 'Backup')

$tmpDir  = Join-Path $env:TEMP ('proj_backup_' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir | Out-Null

Get-ChildItem -Path $src -Recurse -File | Where-Object {
    $rel  = $_.FullName.Substring($src.Length).TrimStart('\\\\')
    $skip = $false
    foreach ($ex in $exclude) {
        if ($rel -like "$ex*") { $skip = $true; break }
    }
    -not $skip
} | ForEach-Object {
    $rel     = $_.FullName.Substring($src.Length).TrimStart('\\\\')
    $target  = Join-Path $tmpDir $rel
    $dir     = Split-Path $target -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item $_.FullName -Destination $target
}

Compress-Archive -Path "$tmpDir\\*" -DestinationPath $dest -Force
Remove-Item -Recurse -Force $tmpDir
Write-Output "DONE"
`;

        fs.writeFileSync(ps1Path, ps1Content, 'utf8');

        console.log(`[Project Backup] Starting -> ${zipPath}`);

        // Run the ps1 script — much more reliable than inline command
        const cmd = `powershell -ExecutionPolicy Bypass -File "${ps1Path}"`;

        exec(cmd, { shell: true, timeout: 120000 }, (err, stdout, stderr) => {
            // Clean up ps1 file
            try { fs.unlinkSync(ps1Path); } catch(e) {}

            if (err) {
                console.error('[Project Backup] FAILED:', err.message);
                console.error('[Project Backup] stderr:', stderr);
                return reject({ success: false, message: err.message });
            }

            if (!fs.existsSync(zipPath)) {
                return reject({ success: false, message: 'ZIP file was not created. Check PowerShell permissions.' });
            }

            const sizeKB = (fs.statSync(zipPath).size / 1024).toFixed(1);
            console.log(`[Project Backup] SUCCESS: ${zipFilename}  (${sizeKB} KB)`);
            resolve({ success: true, filename: zipFilename, path: zipPath, sizeKB });
        });
    });
}

// ──────────────────────────────────────────────
//  AUTO-CLEANUP: delete backups older than 7 days
// ──────────────────────────────────────────────
function deleteOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return 0;

    const cutoff = Date.now() - DELETE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const files  = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.zip') || f.endsWith('.sql'));
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

// ──────────────────────────────────────────────
//  SCHEDULED AUTO BACKUP  (DB + Project every 3 hrs)
// ──────────────────────────────────────────────
cron.schedule(AUTO_BACKUP_TIME, async () => {
    console.log('[Backup] Scheduled backup triggered...');
    try {
        await runBackup();
        await runProjectBackup();
        deleteOldBackups();
    } catch (e) {
        console.error('[Backup] Scheduled backup error:', e.message);
    }
}, { timezone: 'Asia/Kolkata' });

console.log('[Backup] Auto-backup scheduled every 3 hours (Asia/Kolkata)');
console.log(`[Backup] Backup folder: ${BACKUP_DIR}`);
console.log(`[Backup] Auto-delete backups older than ${DELETE_AFTER_DAYS} days`);

module.exports = { runBackup, runProjectBackup, deleteOldBackups };
