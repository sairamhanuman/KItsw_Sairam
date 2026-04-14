// ============================================================
// routes/lab-panel.js  — Full CRUD API (Updated)
// Changes: created_by tracking, HOD filter, COE full view,
//          session dropdown support, bulk download endpoint
// ============================================================

module.exports = (promisePool) => {
    const express      = require('express');
    const router       = express.Router();
    const nodemailer   = require('nodemailer');
    const fs_sync      = require('fs');
    const path_mod     = require('path');

    // ── Load image from disk as base64 data URI (server-side) ────────────────
    function loadImageB64(filename) {
        const imgExts   = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];
        const isLogo    = filename === 'logo';
        const keywords  = isLogo
            ? ['kitsw_header', 'kitsw header', 'kitsw', 'header', 'logo']
            : ['controller sing', 'controller_sing', 'controller sign', 'controller_sign', 'sign'];

        const searchDirs = [
            process.env.COLLEGE_IMAGES_PATH,
            path_mod.join(process.cwd(), 'logs'),
            path_mod.join(__dirname, '..', 'logs'),
            path_mod.join(__dirname, 'logs'),
        ].filter(Boolean);

        for (const dir of searchDirs) {
            try {
                if (!fs_sync.existsSync(dir)) continue;
                const files = fs_sync.readdirSync(dir);
                for (const kw of keywords) {
                    for (const file of files) {
                        const ext = path_mod.extname(file).toLowerCase();
                        if (!imgExts.map(e => e.toLowerCase()).includes(ext)) continue;
                        if (file.toLowerCase().includes(kw.toLowerCase())) {
                            const buf  = fs_sync.readFileSync(path_mod.join(dir, file));
                            const mime = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
                            console.log(`[lab-panel] ✅ Server image loaded: ${path_mod.join(dir, file)}`);
                            return `data:${mime};base64,${buf.toString('base64')}`;
                        }
                    }
                }
            } catch(e) { /* skip */ }
        }
        console.warn(`[lab-panel] ⚠️ Server image NOT found: ${filename}`);
        return null;
    }

    // ── Convert HTML string to PDF Buffer using puppeteer ────────────────────
    async function htmlToPdfBuffer(htmlString) {
        let puppeteer;
        try { puppeteer = require('puppeteer'); }
        catch(e) {
            console.error('[lab-panel] puppeteer not installed. Run: npm install puppeteer');
            return null;
        }
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        try {
            const page = await browser.newPage();
            await page.setContent(htmlString, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format:               'A4',
                printBackground:      true,
                margin: { top:'16mm', bottom:'16mm', left:'14mm', right:'14mm' }
            });
            return pdf;
        } finally {
            await browser.close();
        }
    }

    // ── COE Email Transport ──────────────────────────────────────────────────
    // Add to your .env:
    //   COE_EMAIL_USER=sairamhanuman85@gmail.com
    //   COE_EMAIL_PASS=nymj kcxg xxxx xxxx   (16-digit Google App Password, spaces OK)
    const coeTransport = nodemailer.createTransport({
        service: 'gmail',                       // use Gmail service shortcut
        auth: {
            user: process.env.COE_EMAIL_USER || 'sairamhanuman85@gmail.com',
            pass: (process.env.COE_EMAIL_PASS || '').replace(/\s+/g, '')  // strip spaces from app password
        }
    });
    // Verify transport on startup (non-blocking)
    coeTransport.verify((err) => {
        if (err) console.error('[lab-panel] COE email transport verify FAILED:', err.message);
        else     console.log('[lab-panel] COE email transport ready ✓');
    });

    // ── GET college images as base64 ─────────────────────────────────────────
    // Accepts: 'logo' or 'signature' as the :name param
    // Searches the COLLEGE_IMAGES_PATH folder for files whose name CONTAINS
    // 'header' or 'kitsw' (for logo) and 'sign' or 'controller' (for signature)
    // so the exact filename on disk does NOT matter.
    router.get('/images/:name', async (req, res) => {
        const fs   = require('fs');
        const path = require('path');

        const key  = req.params.name.toLowerCase().replace(/[^a-z]/g, '');
        // key will be 'logo', 'signature', 'logopng', 'controllersignpng', etc.

        // Determine which type of image was requested
        let isLogo = key.includes('logo') || key.includes('header') || key.includes('kitsw');
        let isSign = key.includes('sign') || key.includes('controller');
        if (!isLogo && !isSign) {
            return res.status(400).json({ success: false, message: 'Request logo or signature only.' });
        }

        // Folders to search
        const searchDirs = [
            process.env.COLLEGE_IMAGES_PATH,
            path.join(process.cwd(), 'logs'),
            path.join(__dirname, '..', 'logs'),
            path.join(__dirname, 'logs'),
            path.join(__dirname, '..', 'public', 'logs'),
        ].filter(Boolean);

        const imageExts = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'];

        // Keywords to match in filename
        const logoKeywords = ['kitsw_header', 'kitsw header', 'kitsw', 'header', 'logo'];
        const signKeywords = ['controller sing', 'controller_sing', 'controller sign', 'controller_sign', 'sign'];
        const keywords     = isLogo ? logoKeywords : signKeywords;

        let fileBuffer = null;
        let foundExt   = '.png';

        outer:
        for (const dir of searchDirs) {
            try {
                if (!fs.existsSync(dir)) continue;
                const files = fs.readdirSync(dir);
                // Try each keyword pattern against each file
                for (const kw of keywords) {
                    for (const file of files) {
                        const nameLower = file.toLowerCase();
                        const extLower  = path.extname(file).toLowerCase();
                        if (!imageExts.map(e => e.toLowerCase()).includes(extLower)) continue;
                        if (nameLower.includes(kw.toLowerCase())) {
                            const fullPath = path.join(dir, file);
                            fileBuffer = fs.readFileSync(fullPath);
                            foundExt   = extLower;
                            console.log(`[lab-panel] ✅ Image found: ${fullPath}`);
                            break outer;
                        }
                    }
                }
                // Also try exact common names with various extensions
                const tryNames = isLogo
                    ? ['logo', 'kitsw_header', 'kitsw header', 'header']
                    : ['controller_sign', 'controller sign', 'controller sing', 'signature'];
                for (const tryName of tryNames) {
                    for (const ext of imageExts) {
                        const fullPath = path.join(dir, tryName + ext);
                        if (fs.existsSync(fullPath)) {
                            fileBuffer = fs.readFileSync(fullPath);
                            foundExt   = ext.toLowerCase();
                            console.log(`[lab-panel] ✅ Image found: ${fullPath}`);
                            break outer;
                        }
                    }
                }
            } catch(e) {
                console.warn(`[lab-panel] Skipping dir ${dir}:`, e.message);
            }
        }

        if (!fileBuffer) {
            const searched = searchDirs.join(', ');
            console.error(`[lab-panel] ❌ Image not found for key='${key}'. Searched: ${searched}`);
            return res.status(404).json({
                success: false,
                message: `Image not found. Searched in: ${searched}. ` +
                         `Files in logs folder: ${(() => { try { return fs.readdirSync(searchDirs[0]).join(', '); } catch(e) { return 'folder not readable'; } })()}`
            });
        }

        const mimeType = (foundExt === '.jpg' || foundExt === '.jpeg') ? 'image/jpeg' : 'image/png';
        const b64      = fileBuffer.toString('base64');
        res.json({ success: true, data: `data:${mimeType};base64,${b64}` });
    });

    // ── GET filter data ───────────────────────────────────────────────────────
    router.get('/filter-data', async (req, res) => {
        try {
            const [programmes]    = await promisePool.query(`SELECT programme_id, programme_code, programme_name FROM programme_master WHERE is_active=1 ORDER BY programme_name`);
            const [branches]      = await promisePool.query(`SELECT branch_id, branch_code, branch_name, programme_id FROM branch_master WHERE is_active=1 ORDER BY branch_name`);
            const [semesters]     = await promisePool.query(`SELECT semester_id, semester_name, semester_number FROM semester_master WHERE is_active=1 ORDER BY semester_number`);
            const [sections]      = await promisePool.query(`SELECT section_id, section_name FROM section_master WHERE is_active=1 ORDER BY section_name`);
            const [batches]       = await promisePool.query(`SELECT batch_id, batch_name FROM batch_master WHERE is_active=1 ORDER BY batch_name DESC`);
            const [academicYears] = await promisePool.query(`SELECT academic_year_id, academic_year, semester_type, is_current FROM academic_year_master WHERE is_active=1 ORDER BY academic_year DESC`);
            const [monthYears]    = await promisePool.query(`SELECT month_year_id, display_name, month_name, year_value FROM month_year_master WHERE is_active=1 ORDER BY year_value DESC, month_number ASC`);
            const [colleges]      = await promisePool.query(`SELECT college_id, college_code, college_name FROM college_master WHERE is_active=1 ORDER BY college_name`);
            const [sessions]      = await promisePool.query(`SELECT session_id, session_name, start_time, end_time, session_type, session_group FROM sessions_master WHERE is_active=1 ORDER BY start_time`);

            res.json({ success: true, data: { programmes, branches, semesters, sections, batches, academicYears, monthYears, colleges, sessions } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET practical subjects ────────────────────────────────────────────────
    router.get('/subjects', async (req, res) => {
        const { programme_id, branch_id, semester_id, regulation_id } = req.query;
        if (!programme_id || !branch_id || !semester_id) return res.json({ success: true, data: [] });
        try {
            let sql = `
                SELECT DISTINCT sm.subject_id, sm.syllabus_code, sm.ref_code,
                       sm.subject_name, sm.subject_type, sm.subject_order
                FROM subject_master sm
                WHERE sm.programme_id = ? AND sm.branch_id = ? AND sm.semester_id = ?
                  AND sm.subject_type = 'Practical' AND sm.is_active = 1 AND sm.deleted_at IS NULL`;
            const params = [programme_id, branch_id, semester_id];
            if (regulation_id) { sql += ' AND sm.regulation_id = ?'; params.push(regulation_id); }
            sql += ' ORDER BY sm.subject_order, sm.subject_name';
            const [rows] = await promisePool.query(sql, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET allotted internal faculty ─────────────────────────────────────────
    router.get('/allotted-faculty', async (req, res) => {
        const { subject_id, section_id } = req.query;
        try {
            const [allotted] = await promisePool.query(`
                SELECT st.staff_id, st.employee_id, st.full_name, st.title_prefix,
                       st.designation, br.branch_code, br.branch_id,
                       st.mobile_number, st.email,
                       st.pan_card, st.bank_name, st.ifsc_code, st.account_number
                FROM subject_faculty_allotment sfa
                JOIN staff_master st  ON sfa.staff_id     = st.staff_id
                JOIN branch_master br ON st.department_id = br.branch_id
                WHERE sfa.subject_id = ? AND sfa.section_id = ?
                  AND sfa.deleted_at IS NULL AND sfa.is_active = 1
                LIMIT 1
            `, [subject_id, section_id]);

            const [allStaff] = await promisePool.query(`
                SELECT st.staff_id, st.employee_id, st.full_name, st.title_prefix,
                       st.designation, br.branch_code, br.branch_id,
                       st.mobile_number, st.email,
                       st.pan_card, st.bank_name, st.ifsc_code, st.account_number
                FROM staff_master st
                JOIN branch_master br ON st.department_id = br.branch_id
                WHERE st.is_active = 1 AND st.deleted_at IS NULL
                  AND st.employment_status = 'Active'
                  AND (st.college_id IS NULL OR st.college_id = (
                      SELECT college_id FROM college_master WHERE college_code = 'KITSW' LIMIT 1
                  ))
                ORDER BY br.branch_code, st.full_name
            `);

            res.json({ success: true, data: { allotted: allotted[0] || null, all_staff: allStaff } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET search external evaluator ─────────────────────────────────────────
    router.get('/search-external', async (req, res) => {
        const { q, college_id } = req.query;
        if (!q || q.length < 2) return res.json({ success: true, data: [] });
        try {
            let query = `
                SELECT st.staff_id, st.full_name, st.title_prefix, st.designation,
                       st.mobile_number, st.email, st.bank_name, st.ifsc_code,
                       st.account_number, st.pan_card,
                       c.college_id, c.college_code, c.college_name,
                       br.branch_id, br.branch_code, br.branch_name
                FROM staff_master st
                LEFT JOIN college_master c  ON st.college_id    = c.college_id
                LEFT JOIN branch_master br  ON st.department_id = br.branch_id
                WHERE st.is_active = 1 AND st.deleted_at IS NULL
                  AND st.college_id != (SELECT college_id FROM college_master WHERE college_code = 'KITSW' LIMIT 1)
                  AND (st.full_name LIKE ? OR c.college_code LIKE ?)`;
            const params = [`%${q}%`, `%${q}%`];
            if (college_id) { query += ' AND st.college_id = ?'; params.push(college_id); }
            query += ' ORDER BY st.full_name LIMIT 20';
            const [rows] = await promisePool.query(query, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET load existing panel ───────────────────────────────────────────────
    router.get('/load', async (req, res) => {
        const { academic_year_id, subject_id, section_id, month_year_id, exam_type } = req.query;
        try {
            const [headers] = await promisePool.query(`
                SELECT h.*, ay.academic_year, ay.semester_type,
                    b.batch_name, p.programme_code, p.programme_name,
                    br.branch_code, br.branch_name,
                    sm.semester_name, sm.semester_number,
                    sub.syllabus_code, sub.subject_name,
                    sec.section_name, my.display_name AS exam_month_display
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN batch_master b          ON h.batch_id         = b.batch_id
                JOIN programme_master p      ON h.programme_id     = p.programme_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                WHERE h.academic_year_id=? AND h.subject_id=? AND h.section_id=?
                  AND h.month_year_id=? AND h.exam_type=?
            `, [academic_year_id, subject_id, section_id, month_year_id, exam_type]);

            if (!headers.length) return res.json({ success: true, data: null });
            const header = headers[0];

            const [internal] = await promisePool.query(`
                SELECT li.*, st.staff_id, st.full_name, st.title_prefix,
                       st.employee_id, st.designation, br.branch_code
                FROM lab_panel_internal li
                JOIN staff_master st        ON li.staff_id      = st.staff_id
                LEFT JOIN branch_master br  ON st.department_id = br.branch_id
                WHERE li.panel_id = ?
            `, [header.panel_id]);

            const [externals] = await promisePool.query(`
                SELECT le.*, c.college_name, br.branch_name
                FROM lab_panel_external le
                LEFT JOIN college_master c ON le.college_id = c.college_id
                LEFT JOIN branch_master br ON le.branch_id  = br.branch_id
                WHERE le.panel_id = ? ORDER BY le.slot_no
            `, [header.panel_id]);

            res.json({ success: true, data: { header, internal: internal[0] || null, externals } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET panels list (HOD = own only, COE/Admin = all) ─────────────────────
    router.get('/list', async (req, res) => {
        const { user_id, user_role } = req.query;
        const isCOE = user_role === 'Admin' || user_role === 'Exam_Cell';
        try {
            let sql = `
                SELECT h.panel_id, h.exam_date, h.exam_type, h.status, h.created_by,
                    h.sendback_remark,
                    ay.academic_year, ay.semester_type,
                    br.branch_code, br.branch_name,
                    sm.semester_name, sm.semester_number,
                    sub.syllabus_code, sub.subject_name,
                    sec.section_name, my.display_name AS exam_month,
                    u.username AS created_by_name
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                LEFT JOIN users u            ON h.created_by       = u.user_id`;

            const params = [];
            if (!isCOE && user_id) { sql += ' WHERE h.created_by = ?'; params.push(user_id); }
            sql += ' ORDER BY h.created_at DESC';
            const [rows] = await promisePool.query(sql, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET COE dashboard stats ───────────────────────────────────────────────
    router.get('/coe-stats', async (req, res) => {
        const { academic_year_id, semester_ids } = req.query;
        if (!academic_year_id || !semester_ids) {
            return res.json({ success: true, data: { expected: 0, draft: 0, submitted: 0, approved: 0, not_started: 0 } });
        }
        try {
            const semArray = semester_ids.split(',').map(Number).filter(Boolean);
            if (!semArray.length) return res.json({ success: true, data: { expected: 0, draft: 0, submitted: 0, approved: 0, not_started: 0 } });
            const placeholders = semArray.map(() => '?').join(',');

            const [expectedRows] = await promisePool.query(`
                SELECT COUNT(*) AS expected
                FROM subject_master sm
                WHERE sm.semester_id IN (${placeholders})
                  AND sm.subject_type = 'Practical'
                  AND sm.is_active = 1 AND sm.deleted_at IS NULL
            `, semArray);

            const [statusRows] = await promisePool.query(`
                SELECT h.status, COUNT(*) AS cnt FROM lab_panel_header h
                WHERE h.academic_year_id = ? AND h.semester_id IN (${placeholders})
                GROUP BY h.status
            `, [academic_year_id, ...semArray]);

            const expected = expectedRows[0]?.expected || 0;
            const stats = { draft: 0, submitted: 0, approved: 0 };
            statusRows.forEach(r => { stats[r.status] = r.cnt; });
            const done = stats.draft + stats.submitted + stats.approved;
            res.json({ success: true, data: { expected, draft: stats.draft, submitted: stats.submitted, approved: stats.approved, not_started: Math.max(0, expected - done) } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET COE branch-wise summary ──────────────────────────────────────────
    router.get('/coe-branch-summary', async (req, res) => {
        const { academic_year_id, semester_ids } = req.query;
        if (!academic_year_id || !semester_ids) return res.json({ success: true, data: [] });
        try {
            const semArray = semester_ids.split(',').map(Number).filter(Boolean);
            if (!semArray.length) return res.json({ success: true, data: [] });
            const placeholders = semArray.map(() => '?').join(',');

            const [expRows] = await promisePool.query(`
                SELECT sm.branch_id, COUNT(*) AS expected
                FROM subject_master sm
                WHERE sm.semester_id IN (${placeholders})
                  AND sm.subject_type = 'Practical'
                  AND sm.is_active = 1 AND sm.deleted_at IS NULL
                GROUP BY sm.branch_id
            `, semArray);
            const expectedMap = {};
            expRows.forEach(r => { expectedMap[r.branch_id] = Number(r.expected); });

            const [panelRows] = await promisePool.query(`
                SELECT br.branch_id, br.branch_code, br.branch_name,
                    SUM(CASE WHEN h.status='submitted' THEN 1 ELSE 0 END) AS submitted,
                    SUM(CASE WHEN h.status='approved'  THEN 1 ELSE 0 END) AS approved,
                    SUM(CASE WHEN h.status='draft'     THEN 1 ELSE 0 END) AS draft,
                    COUNT(h.panel_id) AS total_entered
                FROM lab_panel_header h
                JOIN branch_master br ON h.branch_id = br.branch_id
                WHERE h.academic_year_id = ? AND h.semester_id IN (${placeholders})
                GROUP BY br.branch_id, br.branch_code, br.branch_name ORDER BY br.branch_name
            `, [academic_year_id, ...semArray]);

            const seenBranches = new Set();
            const merged = panelRows.map(r => {
                seenBranches.add(r.branch_id);
                return { branch_id: r.branch_id, branch_code: r.branch_code, branch_name: r.branch_name,
                    expected: expectedMap[r.branch_id] || 0, submitted: Number(r.submitted),
                    approved: Number(r.approved), draft: Number(r.draft),
                    not_started: Math.max(0, (expectedMap[r.branch_id] || 0) - Number(r.total_entered)) };
            });
            for (const [branchId, expected] of Object.entries(expectedMap)) {
                if (!seenBranches.has(Number(branchId)))
                    merged.push({ branch_id: Number(branchId), branch_code: '?', branch_name: '?', expected, submitted: 0, approved: 0, draft: 0, not_started: expected });
            }
            res.json({ success: true, data: merged });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET COE panel list with filters ───────────────────────────────────────
    router.get('/coe-list', async (req, res) => {
        const { academic_year_id, semester_ids, status } = req.query;
        if (!academic_year_id) return res.json({ success: true, data: [] });
        try {
            const semArray = semester_ids ? semester_ids.split(',').map(Number).filter(Boolean) : [];
            const placeholders = semArray.length ? semArray.map(() => '?').join(',') : null;

            let sql = `
                SELECT h.panel_id, h.exam_date, h.exam_type, h.status, h.created_by,
                    h.exam_time_from, h.exam_time_to,
                    ay.academic_year, ay.semester_type,
                    br.branch_code, br.branch_name,
                    sm.semester_name, sm.semester_number,
                    sub.syllabus_code, sub.subject_name, sub.ref_code,
                    sec.section_name, my.display_name AS exam_month,
                    u.username AS created_by_name,
                    li_st.full_name AS internal_name, li_st.title_prefix AS internal_prefix
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                LEFT JOIN users u            ON h.created_by       = u.user_id
                LEFT JOIN lab_panel_internal li ON h.panel_id      = li.panel_id
                LEFT JOIN staff_master li_st    ON li.staff_id     = li_st.staff_id
                WHERE h.academic_year_id = ?`;

            const params = [academic_year_id];
            if (placeholders) { sql += ` AND h.semester_id IN (${placeholders})`; params.push(...semArray); }
            if (status && status !== 'all') { sql += ' AND h.status = ?'; params.push(status); }
            if (req.query.branch_id) { sql += ' AND h.branch_id = ?'; params.push(req.query.branch_id); }
            sql += ` ORDER BY FIELD(h.status,'submitted','draft','approved'), br.branch_name, sm.semester_number, sub.subject_name, sec.section_name`;

            const [rows] = await promisePool.query(sql, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET HOD bulk download ─────────────────────────────────────────────────
    // Returns all submitted/approved panels for a HOD scoped to their branch,
    // for a given academic year + semester + exam month, with full
    // internal evaluator and all 3 external evaluator details attached.
    // Frontend groups by semester → branch and renders print layout.
    router.get('/download', async (req, res) => {
        const { user_id, academic_year_id, semester_id, month_year_id } = req.query;
        if (!user_id || !academic_year_id || !semester_id || !month_year_id) {
            return res.status(400).json({ success: false, message: 'user_id, academic_year_id, semester_id and month_year_id are required' });
        }
        try {
            // Fetch all matching panel headers
            const [headers] = await promisePool.query(`
                SELECT
                    h.panel_id, h.exam_date, h.exam_time_from, h.exam_time_to,
                    h.exam_type, h.status, h.created_at, h.approved_at,
                    ay.academic_year, ay.semester_type,
                    b.batch_name,
                    p.programme_code, p.programme_name,
                    br.branch_code, br.branch_name, br.branch_id,
                    sm.semester_name, sm.semester_number, sm.semester_id,
                    sub.syllabus_code, sub.ref_code, sub.subject_name,
                    sec.section_name,
                    my.display_name AS exam_month_display,
                    col.college_name, col.college_code
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN batch_master b          ON h.batch_id         = b.batch_id
                JOIN programme_master p      ON h.programme_id     = p.programme_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                LEFT JOIN college_master col ON col.college_code   = 'KITSW'
                WHERE h.created_by       = ?
                  AND h.academic_year_id = ?
                  AND h.semester_id      = ?
                  AND h.month_year_id    = ?
                  AND h.status IN ('submitted', 'approved')
                ORDER BY br.branch_name, sub.subject_name, sec.section_name
            `, [user_id, academic_year_id, semester_id, month_year_id]);

            if (!headers.length) return res.json({ success: true, data: [] });

            const panelIds    = headers.map(h => h.panel_id);
            const ph          = panelIds.map(() => '?').join(',');

            const [internals] = await promisePool.query(`
                SELECT li.panel_id, li.is_allotted,
                       st.staff_id, st.full_name, st.title_prefix,
                       st.employee_id, st.designation,
                       br.branch_code, br.branch_name
                FROM lab_panel_internal li
                JOIN staff_master st        ON li.staff_id      = st.staff_id
                LEFT JOIN branch_master br  ON st.department_id = br.branch_id
                WHERE li.panel_id IN (${ph})
            `, panelIds);

            const [externals] = await promisePool.query(`
                SELECT le.*,
                       c.college_name  AS college_name_master,
                       br.branch_name  AS branch_name_master
                FROM lab_panel_external le
                LEFT JOIN college_master c ON le.college_id = c.college_id
                LEFT JOIN branch_master br ON le.branch_id  = br.branch_id
                WHERE le.panel_id IN (${ph})
                ORDER BY le.panel_id, le.slot_no
            `, panelIds);

            // Map onto headers
            const internalMap = {};
            internals.forEach(i => { internalMap[i.panel_id] = i; });
            const externalMap = {};
            externals.forEach(e => {
                if (!externalMap[e.panel_id]) externalMap[e.panel_id] = [];
                externalMap[e.panel_id].push(e);
            });

            const result = headers.map(h => ({
                ...h,
                internal:  internalMap[h.panel_id] || null,
                externals: externalMap[h.panel_id] || []
            }));

            res.json({ success: true, data: result });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST save panel ───────────────────────────────────────────────────────
    router.post('/save', async (req, res) => {
        const conn = await promisePool.getConnection();
        try {
            await conn.beginTransaction();
            const { header, internal, externals } = req.body;

            if (header.panel_id) {
                const [existing] = await conn.query(`SELECT status FROM lab_panel_header WHERE panel_id = ?`, [header.panel_id]);
                if (existing.length > 0 && existing[0].status === 'approved') {
                    await conn.rollback();
                    return res.status(403).json({ success: false, message: 'Panel approved by COE. Editing not allowed.' });
                }
            }

            let panel_id = header.panel_id || null;
            if (panel_id) {
                await conn.query(`
                    UPDATE lab_panel_header SET
                        academic_year_id=?, batch_id=?, programme_id=?, branch_id=?,
                        semester_id=?, subject_id=?, section_id=?, month_year_id=?,
                        exam_type=?, exam_date=?, exam_time_from=?, exam_time_to=?, status='draft'
                    WHERE panel_id=?
                `, [header.academic_year_id, header.batch_id, header.programme_id, header.branch_id,
                    header.semester_id, header.subject_id, header.section_id, header.month_year_id,
                    header.exam_type, header.exam_date||null, header.exam_time_from||null, header.exam_time_to||null, panel_id]);
            } else {
                const [ins] = await conn.query(`
                    INSERT INTO lab_panel_header
                        (academic_year_id, batch_id, programme_id, branch_id, semester_id,
                         subject_id, section_id, month_year_id, exam_type,
                         exam_date, exam_time_from, exam_time_to, status, created_by)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)
                `, [header.academic_year_id, header.batch_id, header.programme_id, header.branch_id,
                    header.semester_id, header.subject_id, header.section_id, header.month_year_id,
                    header.exam_type, header.exam_date||null, header.exam_time_from||null, header.exam_time_to||null,
                    header.created_by || null]);
                panel_id = ins.insertId;
            }

            if (internal && internal.staff_id) {
                await conn.query(`DELETE FROM lab_panel_internal WHERE panel_id=?`, [panel_id]);
                await conn.query(`INSERT INTO lab_panel_internal (panel_id, staff_id, is_allotted) VALUES (?,?,?)`,
                    [panel_id, internal.staff_id, internal.is_allotted ? 1 : 0]);
            }

            if (externals && externals.length > 0) {
                await conn.query(`DELETE FROM lab_panel_external WHERE panel_id=?`, [panel_id]);
                for (const ext of externals) {
                    if (!ext.full_name) continue;
                    let staff_id = ext.staff_id || null;
                    if (!staff_id && ext.full_name) {
                        const [existing] = await conn.query(`SELECT staff_id FROM staff_master WHERE full_name=? AND college_id=? LIMIT 1`, [ext.full_name, ext.college_id || null]);
                        if (existing.length > 0) {
                            staff_id = existing[0].staff_id;
                            await conn.query(`
                                UPDATE staff_master SET
                                    designation=COALESCE(?,designation), mobile_number=COALESCE(?,mobile_number),
                                    email=COALESCE(?,email), bank_name=COALESCE(?,bank_name),
                                    ifsc_code=COALESCE(?,ifsc_code), account_number=COALESCE(?,account_number),
                                    pan_card=COALESCE(?,pan_card), department_id=COALESCE(?,department_id)
                                WHERE staff_id=?
                            `, [ext.designation||null, ext.mobile_number||null, ext.email||null,
                                ext.bank_name||null, ext.ifsc_code||null, ext.account_number||null,
                                ext.pan_card||null, ext.branch_id||null, staff_id]);
                        } else {
                            // Auto-generate employee_id: CollegeCode-1001, -1002, ...
                            let autoEmpId = null;
                            try {
                                const collegeCode = ext.college_code_text || 'EXT';
                                const prefix = `${collegeCode}-`;
                                const [maxRow] = await conn.query(
                                    `SELECT employee_id FROM staff_master WHERE employee_id LIKE ? ORDER BY employee_id DESC LIMIT 1`,
                                    [`${prefix}%`]
                                );
                                if (maxRow.length > 0) {
                                    const lastNum = parseInt((maxRow[0].employee_id || '').replace(prefix, ''), 10);
                                    autoEmpId = `${prefix}${isNaN(lastNum) ? 1001 : lastNum + 1}`;
                                } else {
                                    autoEmpId = `${prefix}1001`;
                                }
                            } catch(e) { autoEmpId = null; }

                            const [newStaff] = await conn.query(`
                                INSERT INTO staff_master (college_id, employee_id, title_prefix, full_name, department_id,
                                     designation, mobile_number, email, bank_name, ifsc_code,
                                     account_number, pan_card, employment_status, is_active)
                                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'Active',1)
                            `, [ext.college_id||null, autoEmpId, ext.title_prefix||'Dr', ext.full_name,
                                ext.branch_id||null, ext.designation||'Professor',
                                ext.mobile_number||null, ext.email||null, ext.bank_name||null,
                                ext.ifsc_code||null, ext.account_number||null, ext.pan_card||null]);
                            staff_id = newStaff.insertId;
                        }
                    }
                    await conn.query(`
                        INSERT INTO lab_panel_external
                            (panel_id, slot_no, staff_id, college_id, college_code_text,
                             full_name, designation, branch_text, branch_id,
                             email, mobile_number, bank_name, ifsc_code, account_number, pan_card)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `, [panel_id, ext.slot_no, staff_id, ext.college_id||null, ext.college_code_text||null,
                        ext.full_name, ext.designation||null, ext.branch_text||null, ext.branch_id||null,
                        ext.email||null, ext.mobile_number||null, ext.bank_name||null,
                        ext.ifsc_code||null, ext.account_number||null, ext.pan_card||null]);
                }
            }

            await conn.commit();
            res.json({ success: true, message: 'Panel saved successfully', panel_id });
        } catch (err) {
            await conn.rollback();
            res.status(500).json({ success: false, message: err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET check duplicate external examiner ───────────────────────────────
    // Called on mobile/email blur — returns matching staff from DB
    // Query: ?mobile=X&email=Y&exclude_staff_id=Z
    router.get('/check-duplicate-external', async (req, res) => {
        const { mobile, email, exclude_staff_id } = req.query;
        if (!mobile && !email) return res.json({ success: true, matches: [] });
        try {
            const conditions = [], params = [];
            if (mobile && mobile.trim()) {
                conditions.push('st.mobile_number = ?');
                params.push(mobile.trim());
            }
            if (email && email.trim()) {
                conditions.push('LOWER(st.email) = LOWER(?)');
                params.push(email.trim());
            }
            let sql = `
                SELECT st.staff_id, st.employee_id, st.full_name, st.title_prefix,
                       st.designation, st.mobile_number, st.email,
                       c.college_name, c.college_code,
                       br.branch_code, br.branch_name
                FROM staff_master st
                LEFT JOIN college_master c ON st.college_id    = c.college_id
                LEFT JOIN branch_master br ON st.department_id = br.branch_id
                WHERE st.is_active = 1 AND (${conditions.join(' OR ')})`;
            if (exclude_staff_id && exclude_staff_id !== 'null' && exclude_staff_id !== '') {
                sql += ' AND st.staff_id != ?';
                params.push(exclude_staff_id);
            }
            sql += ' LIMIT 5';
            const [rows] = await promisePool.query(sql, params);
            res.json({ success: true, matches: rows });
        } catch(err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET check duplicate by name (save-time) ──────────────────────────────
    // Query: ?name=X&mobile=Y&email=Z&exclude_staff_id=W
    router.get('/check-duplicate-name', async (req, res) => {
        const { name, mobile, email, exclude_staff_id } = req.query;
        if (!name || name.trim().length < 3) return res.json({ success: true, matches: [] });
        try {
            // Match: same mobile OR same email OR SOUNDEX name match
            const nameParts  = name.trim().split(/\s+/).filter(Boolean);
            const nameTokens = nameParts.map(p => `st.full_name LIKE ?`).join(' AND ');
            const nameParams = nameParts.map(p => `%${p}%`);

            let sql = `
                SELECT st.staff_id, st.employee_id, st.full_name, st.title_prefix,
                       st.designation, st.mobile_number, st.email,
                       c.college_name, c.college_code, br.branch_name
                FROM staff_master st
                LEFT JOIN college_master c ON st.college_id    = c.college_id
                LEFT JOIN branch_master br ON st.department_id = br.branch_id
                WHERE st.is_active = 1
                  AND (
                    (${nameTokens})
                    ${mobile ? 'OR st.mobile_number = ?' : ''}
                    ${email  ? 'OR LOWER(st.email) = LOWER(?)' : ''}
                    OR SOUNDEX(st.full_name) = SOUNDEX(?)
                  )`;
            const params = [...nameParams];
            if (mobile) params.push(mobile);
            if (email)  params.push(email);
            params.push(name.trim());

            if (exclude_staff_id && exclude_staff_id !== 'null' && exclude_staff_id !== '') {
                sql += ' AND st.staff_id != ?';
                params.push(exclude_staff_id);
            }
            sql += ' ORDER BY CASE WHEN st.mobile_number=? THEN 0 WHEN LOWER(st.email)=LOWER(?) THEN 1 ELSE 2 END LIMIT 5';
            params.push(mobile||'', email||'');

            const [rows] = await promisePool.query(sql, params);
            res.json({ success: true, matches: rows });
        } catch(err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET check examiner conflict ───────────────────────────────────────────
    // Called by COE when opening a panel modal — checks each external examiner
    // Query: ?staff_id=X&mobile=Y&exam_date=YYYY-MM-DD&exclude_panel_id=Z
    router.get('/check-examiner-conflict', async (req, res) => {
        const { staff_id, mobile, email, exam_date, exclude_panel_id } = req.query;
        if (!exam_date) return res.json({ success: true, conflict: false });

        // ── Helper: build the common WHERE suffix for exclude_panel_id ─────────
        const excl    = exclude_panel_id && String(exclude_panel_id) !== 'null' && String(exclude_panel_id) !== '';
        const exclSQL = excl ? 'AND h.panel_id != ?' : '';

        // ── Shared SQL fragments ───────────────────────────────────────────────
        const EXT_SELECT = `
            SELECT h.panel_id, h.status, br.branch_code, sub.subject_name, sec.section_name,
                   le.full_name, le.slot_no,
                   DATE_FORMAT(h.exam_date, '%d/%m/%Y') AS exam_date_fmt
            FROM lab_panel_external le
            JOIN lab_panel_header h  ON le.panel_id  = h.panel_id
            JOIN branch_master br   ON h.branch_id   = br.branch_id
            JOIN subject_master sub ON h.subject_id  = sub.subject_id
            JOIN section_master sec ON h.section_id  = sec.section_id`;

        const EXT_DATE_STATUS = `
              AND DATE(h.exam_date) = DATE(?)
              AND h.status = 'approved'
              AND le.is_coe_selected = 1`;

        const INT_SELECT = `
            SELECT h.panel_id, h.status, br.branch_code, sub.subject_name, sec.section_name,
                   st.full_name,
                   DATE_FORMAT(h.exam_date, '%d/%m/%Y') AS exam_date_fmt
            FROM lab_panel_internal li
            JOIN lab_panel_header h  ON li.panel_id  = h.panel_id
            JOIN staff_master st    ON li.staff_id   = st.staff_id
            JOIN branch_master br   ON h.branch_id   = br.branch_id
            JOIN subject_master sub ON h.subject_id  = sub.subject_id
            JOIN section_master sec ON h.section_id  = sec.section_id`;

        const INT_DATE_STATUS = `
              AND DATE(h.exam_date) = DATE(?)
              AND h.status IN ('draft','submitted','approved')`;

        try {
            // ══════════════════════════════════════════════════════════════════
            // LEVEL 1 — Match by staff_id  (most reliable — exact DB record)
            // ══════════════════════════════════════════════════════════════════
            const hasStaffId = staff_id && String(staff_id).trim() !== '' && String(staff_id) !== 'null';
            if (hasStaffId) {
                // 1a. Was this person selected as External Examiner in an approved panel?
                const [extRows] = await promisePool.query(`
                    ${EXT_SELECT}
                    WHERE le.staff_id = ? ${EXT_DATE_STATUS} ${exclSQL}
                    LIMIT 1
                `, excl ? [staff_id, exam_date, exclude_panel_id] : [staff_id, exam_date]);

                if (extRows.length > 0) {
                    const r = extRows[0];
                    return res.json({ success: true, conflict: true,
                        matched_by: 'staff_id', type: 'external', panelStatus: r.status,
                        message: `Already Appointed (Approved) as External Examiner in ${r.branch_code} — ${r.subject_name} (${r.section_name}) on ${r.exam_date_fmt}` });
                }

                // 1b. Is this person assigned as Internal Examiner in any panel (any status)?
                const [intRows] = await promisePool.query(`
                    ${INT_SELECT}
                    WHERE li.staff_id = ? ${INT_DATE_STATUS} ${exclSQL}
                    ORDER BY FIELD(h.status,'approved','submitted','draft')
                    LIMIT 1
                `, excl ? [staff_id, exam_date, exclude_panel_id] : [staff_id, exam_date]);

                if (intRows.length > 0) {
                    const r = intRows[0];
                    const lbl = r.status === 'approved' ? 'Appointed (Approved)' : r.status === 'submitted' ? 'Listed (Submitted)' : 'Listed (Draft)';
                    return res.json({ success: true, conflict: true,
                        matched_by: 'staff_id', type: 'internal', panelStatus: r.status,
                        message: `Already ${lbl} as Internal Examiner in ${r.branch_code} — ${r.subject_name} (${r.section_name}) on ${r.exam_date_fmt}` });
                }
            }

            // ══════════════════════════════════════════════════════════════════
            // LEVEL 2 — Match by mobile number  (fallback — staff_id not matched)
            // ══════════════════════════════════════════════════════════════════
            const hasMobile = mobile && String(mobile).trim() !== '' && String(mobile) !== 'null';
            if (hasMobile) {
                const [mobRows] = await promisePool.query(`
                    ${EXT_SELECT}
                    WHERE le.mobile_number = ? ${EXT_DATE_STATUS} ${exclSQL}
                    LIMIT 1
                `, excl ? [mobile, exam_date, exclude_panel_id] : [mobile, exam_date]);

                if (mobRows.length > 0) {
                    const r = mobRows[0];
                    return res.json({ success: true, conflict: true,
                        matched_by: 'mobile', type: 'external', panelStatus: r.status,
                        message: `Already Appointed (matched by Mobile) as External Examiner in ${r.branch_code} — ${r.subject_name} (${r.section_name}) on ${r.exam_date_fmt}` });
                }
            }

            // ══════════════════════════════════════════════════════════════════
            // LEVEL 3 — Match by email  (catches duplicate DB records where the
            //           same physical person has two staff_id entries with
            //           different mobiles but the same institutional email)
            // ══════════════════════════════════════════════════════════════════
            const hasEmail = email && String(email).trim() !== '' && String(email) !== 'null';
            if (hasEmail) {
                const [emailRows] = await promisePool.query(`
                    ${EXT_SELECT}
                    WHERE LOWER(le.email) = LOWER(?) ${EXT_DATE_STATUS} ${exclSQL}
                    LIMIT 1
                `, excl ? [email, exam_date, exclude_panel_id] : [email, exam_date]);

                if (emailRows.length > 0) {
                    const r = emailRows[0];
                    return res.json({ success: true, conflict: true,
                        matched_by: 'email', type: 'external', panelStatus: r.status,
                        message: `Already Appointed (matched by Email) as External Examiner in ${r.branch_code} — ${r.subject_name} (${r.section_name}) on ${r.exam_date_fmt}` });
                }
            }

            return res.json({ success: true, conflict: false });
        } catch(err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST submit to COE ────────────────────────────────────────────────────
    router.post('/:id/submit', async (req, res) => {
        try {
            const [panels] = await promisePool.query(`
                SELECT h.status, h.exam_date, h.academic_year_id, h.subject_id,
                       h.section_id, h.month_year_id, h.branch_id, h.semester_id,
                       h.batch_id, h.programme_id, h.exam_type
                FROM lab_panel_header h WHERE h.panel_id = ?
            `, [req.params.id]);
            if (!panels.length) return res.status(404).json({ success: false, message: 'Panel not found' });
            const panel = panels[0];
            if (panel.status === 'approved') return res.status(403).json({ success: false, message: 'Already approved by COE' });

            // ── Mandatory field check before submit ──
            const missing = [];
            if (!panel.academic_year_id) missing.push('Academic Year');
            if (!panel.programme_id)     missing.push('Programme');
            if (!panel.branch_id)        missing.push('Branch');
            if (!panel.semester_id)      missing.push('Semester');
            if (!panel.batch_id)         missing.push('Admitted Batch');
            if (!panel.section_id)       missing.push('Section');
            if (!panel.subject_id)       missing.push('Practical Subject');
            if (!panel.month_year_id)    missing.push('Exam Month');
            if (!panel.exam_type)        missing.push('Exam Type');
            if (!panel.exam_date)        missing.push('Exam Date (mandatory before submitting to COE)');
            if (missing.length > 0) {
                return res.status(400).json({ success: false,
                    message: `Cannot submit — the following fields are required: ${missing.join(', ')}` });
            }

            // ── Check internal evaluator is assigned ──
            const [intCheck] = await promisePool.query(
                `SELECT staff_id FROM lab_panel_internal WHERE panel_id = ?`, [req.params.id]);
            if (!intCheck.length) return res.status(400).json({ success: false, message: 'Cannot submit — Internal Evaluator is not assigned' });

            // ── Check at least one external evaluator ──
            const [extCheck] = await promisePool.query(
                `SELECT external_id FROM lab_panel_external WHERE panel_id = ? LIMIT 1`, [req.params.id]);
            if (!extCheck.length) return res.status(400).json({ success: false, message: 'Cannot submit — No External Evaluators entered' });

            await promisePool.query(`UPDATE lab_panel_header SET status='submitted' WHERE panel_id=?`, [req.params.id]);
            res.json({ success: true, message: 'Panel submitted to COE successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── POST COE approve ──────────────────────────────────────────────────────
    router.post('/:id/approve', async (req, res) => {
        const conn = await promisePool.getConnection();
        try {
            await conn.beginTransaction();
            const { selected_external_id, internal_staff_id, approved_by } = req.body;
            const panel_id = req.params.id;
            await conn.query(`UPDATE lab_panel_external SET is_coe_selected=0 WHERE panel_id=?`, [panel_id]);
            if (selected_external_id)
                await conn.query(`UPDATE lab_panel_external SET is_coe_selected=1 WHERE external_id=? AND panel_id=?`, [selected_external_id, panel_id]);
            if (internal_staff_id)
                await conn.query(`UPDATE lab_panel_internal SET staff_id=? WHERE panel_id=?`, [internal_staff_id, panel_id]);
            await conn.query(`UPDATE lab_panel_header SET status='approved', approved_by=?, approved_at=NOW() WHERE panel_id=?`, [approved_by || null, panel_id]);
            await conn.commit();

            // ── Send email to HOD ──────────────────────────────────────────
            let emailSent = false;
            try {
                const [panRows] = await promisePool.query(`
                    SELECT DATE_FORMAT(h.exam_date, '%d %M %Y') AS exam_date_fmt,
                        h.exam_time_from, h.exam_time_to, h.exam_type,
                        h.created_by,
                        br.branch_code, br.branch_name, sec.section_name,
                        sub.syllabus_code, sub.ref_code, sub.subject_name,
                        sm.semester_number, my.display_name AS exam_month
                    FROM lab_panel_header h
                    JOIN branch_master br        ON h.branch_id   = br.branch_id
                    JOIN semester_master sm      ON h.semester_id = sm.semester_id
                    JOIN subject_master sub      ON h.subject_id  = sub.subject_id
                    JOIN section_master sec      ON h.section_id  = sec.section_id
                    JOIN month_year_master my    ON h.month_year_id = my.month_year_id
                    WHERE h.panel_id = ?
                `, [panel_id]);

                if (panRows.length) {
                    const p = panRows[0];
                    // HOD email: send to whoever CREATED the panel (not branch HOD).
                    // If HOD_CE created a panel for another branch, email goes to HOD_CE.
                    const [hodRows] = await promisePool.query(
                        `SELECT email, username FROM users WHERE user_id = ? LIMIT 1`,
                        [p.created_by]
                    );
                    const hodEmail    = hodRows[0]?.email    || null;
                    const hodUsername = hodRows[0]?.username || `User #${p.created_by}`;

                    // Selected external evaluator details
                    let extRow = '';
                    if (selected_external_id) {
                        const [extR] = await promisePool.query(
                            `SELECT full_name, designation, email, mobile_number, college_code_text, branch_text
                             FROM lab_panel_external WHERE external_id=?`, [selected_external_id]);
                        if (extR.length) {
                            const e = extR[0];
                            extRow = `<tr style="background:#f0fff0">
                                <td style="padding:6px 10px"><b>External Evaluator</b></td>
                                <td style="padding:6px 10px">${e.full_name}</td>
                                <td style="padding:6px 10px">${e.designation||'—'}</td>
                                <td style="padding:6px 10px">${e.college_code_text||'—'}</td>
                                <td style="padding:6px 10px">${e.branch_text||'—'}</td>
                                <td style="padding:6px 10px">${e.mobile_number||'—'}</td>
                                <td style="padding:6px 10px">${e.email||'—'}</td>
                            </tr>`;
                        }
                    }

                    const examDate   = p.exam_date_fmt || '—';
                    const subjectStr = `${p.syllabus_code} — ${p.subject_name}`;
                    const hodName    = hodUsername;  // the user who created/submitted this panel

                    // ── Ext info for order copy attachment ──
                    let extForCopy = {};
                    if (selected_external_id) {
                        const [extFull] = await promisePool.query(
                            `SELECT le.*, st.employee_id, c.college_name AS college_name_master,
                                    br.branch_code AS branch_code_master,
                                    br.branch_name AS branch_name_master
                             FROM lab_panel_external le
                             LEFT JOIN staff_master st  ON le.staff_id  = st.staff_id
                             LEFT JOIN college_master c ON le.college_id = c.college_id
                             LEFT JOIN branch_master br ON le.branch_id  = br.branch_id
                             WHERE le.external_id = ?`, [selected_external_id]);
                        if (extFull.length) extForCopy = extFull[0];
                    }

                    // ── Internal evaluator for order copy ──
                    const [intRows] = await promisePool.query(
                        `SELECT st.employee_id, st.full_name, st.title_prefix,
                                st.designation, st.mobile_number, st.email,
                                br.branch_code, br.branch_name
                         FROM lab_panel_internal li
                         JOIN staff_master st       ON li.staff_id      = st.staff_id
                         LEFT JOIN branch_master br ON st.department_id = br.branch_id
                         WHERE li.panel_id = ?`, [panel_id]);
                    const intForCopy = intRows[0] || null;

                    // ── Build order copy HTML (server-side, no images) ──
                    const fmt       = v => (v !== null && v !== undefined && String(v).trim() !== '') ? String(v) : '—';
                    const toRoman   = n => { const r=[['X',10],['IX',9],['V',5],['IV',4],['I',1]]; let s='',num=Number(n)||0; for(const[sym,val]of r){while(num>=val){s+=sym;num-=val;}} return s||String(n); };

                    // Load images from disk for embedding in PDF
                    const logoB64  = loadImageB64('logo');
                    const signB64  = loadImageB64('signature');
                    const logoTag  = logoB64
                        ? `<img src="${logoB64}" alt="KITSW" style="height:75px;width:auto;display:block;margin:0 auto 6px;object-fit:contain;">`
                        : `<div style="height:75px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#1a237e;border:3px solid #1a237e;padding:4px 16px;border-radius:4px;">KITSW</div>`;
                    const signTag  = signB64
                        ? `<img src="${signB64}" alt="Signature" style="height:55px;width:auto;display:block;margin:0 auto 4px;object-fit:contain;">`
                        : `<div style="height:55px;"></div>`;
                    const subCode   = p.syllabus_code || '';
                    const courseStr = `${subCode} — ${fmt(p.subject_name)}`;
                    const intEmpId  = intForCopy?.employee_id || 'N/A';
                    const extEmpId  = extForCopy?.employee_id || 'N/A';
                    const intUID    = `${intEmpId}-${subCode}-${extEmpId}-${p.section_name||''}-${p.branch_code||''}`;
                    const extUID    = `${extEmpId}-${subCode}-${intEmpId}-${p.section_name||''}-${p.branch_code||''}`;
                    const refNo     = `KITSW/COE/LAB/${(p.exam_type||'').toUpperCase()}/SEM${p.semester_number}/${(p.exam_month||'').replace(' ','-')}`;
                    const todayStr  = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});
                    const sessionTimings = '9:00 AM – 11:30 AM &nbsp;|&nbsp; 11:30 AM – 2:00 PM &nbsp;|&nbsp; 2:00–2:30 PM (LUNCH) &nbsp;|&nbsp; 2:30 PM – 5:00 PM';

                    const orderCopyHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Order Copy — ${p.branch_code} | ${subCode} | ${p.section_name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @page{size:A4 portrait;margin:16mm 14mm;}
  .wrap{max-width:182mm;margin:0 auto;}
  /* Header */
  .hdr{text-align:center;border-bottom:3px double #1a237e;padding-bottom:10px;margin-bottom:8px;}
  /* Confidential */
  .confidential{font-size:11px;font-weight:900;color:#b71c1c;text-align:center;letter-spacing:2.5px;margin:8px 0;}
  /* Ref row */
  .ref-row{display:flex;justify-content:space-between;font-size:11px;font-weight:700;padding:6px 12px;background:#f0f4ff;border:1.5px solid #c5cae9;border-radius:4px;margin-bottom:12px;}
  /* Section heading */
  .sec-h{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin:12px 0 7px;}
  /* Evaluator cards */
  .two-col{display:table;width:100%;border-spacing:10px;border-collapse:separate;margin-bottom:10px;}
  .eval-card{display:table-cell;width:50%;border:1.5px solid #9fa8da;border-radius:6px;overflow:hidden;vertical-align:top;}
  .eval-head{background: ;color: ;padding:7px 12px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid #000;}
  .eval-body{padding:9px 12px;background:#f8f9ff;}
  .uid{background:#e8eaf6;border:1px dashed #9fa8da;border-radius:3px;padding:3px 7px;font-size:9px;font-family:monospace;color:#1a237e;margin-bottom:7px;word-break:break-all;}
  .er{display:flex;margin-bottom:4px;font-size:11px;line-height:1.4;}
  .el{font-weight:700;min-width:90px;color:#333;flex-shrink:0;}
  /* Session pills */
  .session-pills{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
  .sp{display:inline-block;padding:3px 9px;border-radius:12px;font-size:9px;font-weight:700;}
  /* Schedule table */
  table.sch{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px;border:1px solid #000;}
  table.sch thead tr{background:#a8c9a5;color:#000;border-bottom:1px solid #000;}
  table.sch th{padding:8px 10px;text-align:center;font-size:11px;font-weight:800;border:1px solid #000;}
  table.sch td{padding:8px 10px;border:1px solid #000;background:#f8f9ff;vertical-align:top;font-size:11px;}
  /* Letter */
  .letter{border:1px solid #c5cae9;border-radius:5px;padding:13px 16px;background:#fafbff;font-size:12px;line-height:2;margin-bottom:12px;}
  .letter-sub{font-size:12px;font-weight:700;margin-bottom:8px;color:#1a237e;}
  /* Signature */
  .sig-row{display:flex;justify-content:flex-end;margin-top:20px;}
  .sig-box{text-align:center;min-width:180px;}
  .sig-line{border-top:2px solid #000;padding-top:5px;font-size:11px;font-weight:700;margin-top:2px;}
  .sig-title{font-size:10px;color:#555;margin-top:2px;}
  /* Footer */
  .copy-to{font-size:10px;color:#555;border-top:1px solid #e0e0e0;padding-top:7px;margin-top:10px;}
  .footer-note{font-size:8.5px;color:#aaa;margin-top:5px;font-style:italic;}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    ${logoTag}
  </div>
  <div class="confidential">// STRICTLY CONFIDENTIAL //</div>
  <div class="ref-row"><span><b>Ref No.:</b> ${refNo}</span><span><b>Date:</b> ${todayStr}</span></div>

  <div class="sec-h">Evaluator Details</div>
  <div class="two-col">
    <div class="eval-card">
      <div class="eval-head">📋 INTERNAL EXAMINER</div>
      <div class="eval-body">
        <div class="uid">UID: ${intUID}</div>
        <div class="er"><span class="el">Emply ID</span><span>${fmt(intForCopy?.employee_id)}</span></div>
        <div class="er"><span class="el">Name</span><span>${fmt(intForCopy?.title_prefix)} ${fmt(intForCopy?.full_name)}</span></div>
        <div class="er"><span class="el">College</span><span>Kakatiya Institute of Technology &amp; Science, Warangal</span></div>
        <div class="er"><span class="el">Branch/Dept</span><span>${fmt(intForCopy?.branch_name || intForCopy?.branch_code)}</span></div>
        <div class="er"><span class="el">Contact No.</span><span>${fmt(intForCopy?.mobile_number)}</span></div>
        <div class="er"><span class="el">Email</span><span>${fmt(intForCopy?.email)}</span></div>
      </div>
    </div>
    <div class="eval-card">
      <div class="eval-head">🏛 EXTERNAL EXAMINER</div>
      <div class="eval-body">
        <div class="uid">UID: ${extUID}</div>
        <div class="er"><span class="el">Emply ID</span><span>${fmt(extForCopy?.employee_id)}</span></div>
        <div class="er"><span class="el">Name</span><span>${fmt(extForCopy?.full_name)}</span></div>
        <div class="er"><span class="el">College</span><span>${fmt(extForCopy?.college_name_master || extForCopy?.college_code_text)}</span></div>
        <div class="er"><span class="el">Branch/Dept</span><span>${fmt(extForCopy?.branch_name_master || extForCopy?.branch_text)}</span></div>
        <div class="er"><span class="el">Contact No.</span><span>${fmt(extForCopy?.mobile_number)}</span></div>
        <div class="er"><span class="el">Email</span><span>${fmt(extForCopy?.email)}</span></div>
      </div>
    </div>
  </div>

  <div class="letter">
    <p class="letter-sub">Sub: Appointment of Internal &amp; External Examiners — ${fmt(p.programme_code)||'B.Tech.'} Sem ${toRoman(p.semester_number)} (${fmt(p.exam_type)} Examination)</p>
    <p>Respected Sir / Madam,</p>
    <p>I am pleased to inform you that you have been appointed as an Examiner to conduct the <b>${fmt(p.exam_type)} Practical Examination</b> at <b>KITS, Warangal</b> as per the schedule detailed above.</p>
    <p>You are requested to kindly communicate your acceptance and ensure your presence on the scheduled date to conduct the examination diligently.</p>

  <div class="sec-h">📅 Examination Schedule</div>
  <div class="session-pills">
    <span class="sp" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;">9:00 AM – 11:30 AM</span>
    <span class="sp" style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;">11:30 AM – 2:00 PM</span>
    <span class="sp" style="background:#fff3cd;color:#856404;border:1px solid #ffc107;">2:00 – 2:30 PM (LUNCH)</span>
    <span class="sp" style="background:#fce7f3;color:#9d174d;border:1px solid #f9a8d4;">2:30 PM – 5:00 PM</span>
  </div>
  <table class="sch">
    <thead><tr><th>Branch</th><th>Section</th><th>Course Code &amp; Name</th><th>Date of Exam</th><th>Type</th></tr></thead>
    <tbody><tr>
      <td><b>${fmt(p.branch_code)}</b></td>
      <td>${fmt(p.section_name)}</td>
      <td>${courseStr}</td>
      <td><b>${examDate}</b></td>
      <td>${fmt(p.exam_type)}</td>
    </tr></tbody>
  </table>

    <p>Your cooperation in this regard is highly appreciated.</p>
  </div>

  <div class="sig-row">
    <div class="sig-box">
      ${signTag}
      <div class="sig-line">Controller of Examinations</div>
      <div class="sig-title">KITSW, Warangal</div>
    </div>
  </div>

  <div class="copy-to">
    <b>Copy to:</b> The Principal, KITSW — for information and necessary action.
    <div class="footer-note">System-generated order copy — KITSW Examination Cell</div>
  </div>
</div>
</body></html>`;

                    // ── Professional "Dear HoD" email body ──
                    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1a2e;margin:0;padding:0;background:#f4f6fa;">
<div style="max-width:620px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a237e,#3949ab);padding:24px 30px;text-align:center;">
    <div style="font-size:20px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.8px;">
      Kakatiya Institute of Technology and Science
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.75);margin-top:4px;">
      Controller of Examinations — Examination Cell
    </div>
  </div>

  <!-- Status Banner -->
  <div style="background:#e8f5e9;border-bottom:3px solid #43a047;padding:12px 30px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:22px;">✅</span>
    <div>
      <div style="font-size:14px;font-weight:800;color:#1b5e20;">Lab Panel Approved</div>
      <div style="font-size:11px;color:#388e3c;margin-top:1px;">${p.branch_code} | ${subjectStr} | ${p.section_name} | ${p.exam_month}</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:28px 30px;">
    <p style="font-size:14px;font-weight:700;margin-bottom:16px;">Dear ${hodName},</p>

    <p style="line-height:1.8;margin-bottom:16px;">
      I am pleased to inform you that the <b>Lab External Panel</b> for the following subject has been
      <b style="color:#2e7d32;">approved</b> by the Controller of Examinations.
      The Order Copy is attached to this email for your records.
    </p>

    <!-- Details Card -->
    <div style="background:#f8f9ff;border:1.5px solid #c5cae9;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#3949ab;margin-bottom:12px;">Panel Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#777;width:130px;vertical-align:top;"><b>Branch</b></td><td style="padding:4px 0;">${p.branch_code} — ${p.branch_name}</td></tr>
        <tr><td style="padding:4px 0;color:#777;vertical-align:top;"><b>Section</b></td><td style="padding:4px 0;">${p.section_name}</td></tr>
        <tr><td style="padding:4px 0;color:#777;vertical-align:top;"><b>Subject</b></td><td style="padding:4px 0;">${subjectStr}</td></tr>
        <tr><td style="padding:4px 0;color:#777;vertical-align:top;"><b>Exam Date</b></td><td style="padding:4px 0;">${examDate}</td></tr>
        <tr><td style="padding:4px 0;color:#777;vertical-align:top;"><b>Exam Type</b></td><td style="padding:4px 0;">${p.exam_type}</td></tr>
        <tr><td style="padding:4px 0;color:#777;vertical-align:top;"><b>External Evaluator</b></td><td style="padding:4px 0;"><b>${fmt(extForCopy?.full_name)}</b><br><span style="font-size:11px;color:#555;">${fmt(extForCopy?.designation)} | ${fmt(extForCopy?.college_code_text||extForCopy?.college_name_master)}</span></td></tr>
      </table>
    </div>

    <p style="line-height:1.8;margin-bottom:8px;">
      Please ensure all necessary arrangements are made for the smooth conduct of the practical examination.
      Kindly acknowledge receipt of this email.
    </p>

    <p style="line-height:1.8;">
      For any queries, please contact the Examination Cell.
    </p>

    <!-- Action Note -->
    <div style="background:#fff8e1;border:1.5px solid #ffe082;border-radius:6px;padding:10px 16px;margin-top:20px;font-size:11px;color:#795548;">
      📎 <b>The Order Copy (HTML) is attached</b> to this email. Open it in a browser and use <b>Print → Save as PDF</b> to get a printable copy.
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f0f2f5;padding:16px 30px;text-align:center;border-top:1px solid #e0e0e0;">
    <div style="font-size:11px;font-weight:700;color:#3949ab;">Controller of Examinations — KITSW, Warangal</div>
    <div style="font-size:10px;color:#aaa;margin-top:4px;">This is a system-generated email. Please do not reply directly.</div>
  </div>

</div>
</body></html>`;

                    if (hodEmail) {
                        // Convert order copy HTML → PDF using puppeteer
                        const pdfFilename = `OrderCopy_${p.branch_code}_${subCode}_${p.section_name}_${(p.exam_month||'').replace(' ','')}.pdf`;
                        let pdfBuffer = null;
                        try {
                            pdfBuffer = await htmlToPdfBuffer(orderCopyHtml);
                            if (pdfBuffer) console.log(`[lab-panel] ✅ PDF generated: ${pdfFilename} (${Math.round(pdfBuffer.length/1024)}KB)`);
                            else          console.warn('[lab-panel] ⚠️ PDF generation returned null — attaching HTML fallback');
                        } catch(pdfErr) {
                            console.error('[lab-panel] ❌ PDF generation failed:', pdfErr.message);
                        }

                        const attachments = pdfBuffer ? [{
                            filename:    pdfFilename,
                            content:     pdfBuffer,
                            contentType: 'application/pdf'
                        }] : [{
                            filename:    pdfFilename.replace('.pdf', '.html'),
                            content:     orderCopyHtml,
                            contentType: 'text/html'
                        }];

                        const mailResult = await coeTransport.sendMail({
                            from:    `"COE - KITSW" <${process.env.COE_EMAIL_USER || 'sairamhanuman85@gmail.com'}>`,
                            to:      hodEmail,
                            subject: `[APPROVED] Lab Panel Order Copy — ${p.branch_code} | ${subjectStr} | ${p.section_name} | ${p.exam_month}`,
                            html:    emailHtml,
                            attachments
                        });
                        emailSent = true;
                        console.log(`[lab-panel] ✅ Approval email sent to ${hodEmail} — MessageID: ${mailResult.messageId}`);
                    } else {
                        console.warn(`[lab-panel] ⚠️ No email found for panel creator (user_id=${p.created_by}, username=${hodUsername}). Panel branch: ${p.branch_code}`);
                    }
                }
            } catch(mailErr) {
                emailSent = false;
                console.error('[lab-panel] ❌ Email send FAILED:', mailErr.message);
                console.error(mailErr.stack);
            }

            res.json({ success: true, message: 'Panel approved successfully', emailSent });
        } catch (err) {
            await conn.rollback();
            res.status(500).json({ success: false, message: err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET order copy data for a panel ─────────────────────────────────────
    router.get('/order-copy/:id', async (req, res) => {
        try {
            const [rows] = await promisePool.query(`
                SELECT h.panel_id, h.exam_date, h.exam_time_from, h.exam_time_to,
                    h.exam_type, h.status, h.approved_at, h.created_at,
                    ay.academic_year, ay.semester_type,
                    br.branch_code, br.branch_name, br.branch_id,
                    sm.semester_number, sec.section_name,
                    sub.syllabus_code, sub.ref_code, sub.subject_name,
                    my.display_name AS exam_month,
                    p.programme_code
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                JOIN programme_master p      ON h.programme_id     = p.programme_id
                WHERE h.panel_id = ?
            `, [req.params.id]);

            if (!rows.length) return res.status(404).json({ success:false, message:'Panel not found' });
            const header = rows[0];

            const [internal] = await promisePool.query(`
                SELECT st.staff_id, st.employee_id, st.full_name, st.title_prefix,
                       st.designation, st.mobile_number, st.email,
                       br.branch_code, br.branch_name
                FROM lab_panel_internal li
                JOIN staff_master st       ON li.staff_id      = st.staff_id
                LEFT JOIN branch_master br ON st.department_id = br.branch_id
                WHERE li.panel_id = ?
            `, [req.params.id]);

            const [externals] = await promisePool.query(`
                SELECT le.*, st.employee_id,
                       c.college_name AS college_name_master,
                       br.branch_code AS branch_code_master,
                       br.branch_name AS branch_name_master
                FROM lab_panel_external le
                LEFT JOIN staff_master st  ON le.staff_id  = st.staff_id
                LEFT JOIN college_master c ON le.college_id = c.college_id
                LEFT JOIN branch_master br ON le.branch_id  = br.branch_id
                WHERE le.panel_id = ? ORDER BY le.is_coe_selected DESC, le.slot_no
            `, [req.params.id]);

            // HOD info — derive from username HOD_{BRANCH_CODE}
            const branchCode = header.branch_code;
            const [hodRows] = await promisePool.query(
                `SELECT username, email FROM users WHERE user_role='HOD' AND username = ? LIMIT 1`,
                [`HOD_${branchCode}`]
            );
            const hod = hodRows[0] || null;

            res.json({ success:true, data:{ header, internal: internal[0]||null, externals, hod } });
        } catch(err) {
            res.status(500).json({ success:false, message:err.message });
        }
    });

    // ── POST COE send back to HOD ─────────────────────────────────────────────
    router.post('/:id/sendback', async (req, res) => {
        try {
            const { remark } = req.body;
            const [sb] = await promisePool.query(
                `UPDATE lab_panel_header SET status='draft', sendback_remark=? WHERE panel_id=? AND status IN ('submitted','approved')`,
                [remark || null, req.params.id]);
            if (sb.affectedRows === 0) {
                return res.status(400).json({ success: false, message: 'Panel cannot be sent back (check status)' });
            }
            res.json({ success: true, message: 'Panel sent back to HOD successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // ── GET single panel by id ────────────────────────────────────────────────
    router.get('/:id', async (req, res) => {
        try {
            const [headers] = await promisePool.query(`
                SELECT h.*, ay.academic_year, ay.semester_type,
                    b.batch_name, p.programme_code, p.programme_name,
                    br.branch_code, br.branch_name,
                    sm.semester_name, sm.semester_number,
                    sub.syllabus_code, sub.subject_name, sub.ref_code,
                    sec.section_name, my.display_name AS exam_month_display
                FROM lab_panel_header h
                JOIN academic_year_master ay ON h.academic_year_id = ay.academic_year_id
                JOIN batch_master b          ON h.batch_id         = b.batch_id
                JOIN programme_master p      ON h.programme_id     = p.programme_id
                JOIN branch_master br        ON h.branch_id        = br.branch_id
                JOIN semester_master sm      ON h.semester_id      = sm.semester_id
                JOIN subject_master sub      ON h.subject_id       = sub.subject_id
                JOIN section_master sec      ON h.section_id       = sec.section_id
                JOIN month_year_master my    ON h.month_year_id    = my.month_year_id
                WHERE h.panel_id=?
            `, [req.params.id]);

            if (!headers.length) return res.status(404).json({ success: false, message: 'Not found' });

            const [internal] = await promisePool.query(`
                SELECT li.*, st.full_name, st.title_prefix, st.employee_id,
                       st.designation, br.branch_code
                FROM lab_panel_internal li
                JOIN staff_master st        ON li.staff_id      = st.staff_id
                LEFT JOIN branch_master br  ON st.department_id = br.branch_id
                WHERE li.panel_id=?
            `, [req.params.id]);

            const [externals] = await promisePool.query(`
                SELECT le.*, c.college_name, br.branch_name, st.employee_id
                FROM lab_panel_external le
                LEFT JOIN college_master c ON le.college_id = c.college_id
                LEFT JOIN branch_master br ON le.branch_id  = br.branch_id
                LEFT JOIN staff_master st  ON le.staff_id   = st.staff_id
                WHERE le.panel_id=? ORDER BY le.slot_no
            `, [req.params.id]);

            res.json({ success: true, data: { header: headers[0], internal: internal[0] || null, externals } });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });

    return router;
};
