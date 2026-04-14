// ============================================================
//  seating-pdf-export.js  —  PDFKit  LANDSCAPE A4
//
//  LANDSCAPE = 841.89 × 595.28 pts (wider than tall)
//  Bigger cells, larger fonts, better visibility.
//  Grid: 1 row per bench, pos1+pos2 side-by-side.
//  Zero hardcoding — reads layout_data.benches exactly.
// ============================================================

const express     = require('express');
const PDFDocument = require('pdfkit');

// ─── Date helpers ─────────────────────────────────────────────

function toDateStr(val) {
    if (!val) return '';
    if (val instanceof Date) {
        return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,'0')}-${String(val.getDate()).padStart(2,'0')}`;
    }
    return String(val).substring(0, 10);
}

function fmtDate(dateVal, sessionOrder) {
    const s = toDateStr(dateVal);
    if (!s) return 'N/A';
    const [y, m, d] = s.split('-');
    return `${d}-${m}-${y} (${parseInt(sessionOrder) === 1 ? 'FN' : 'AN'})`;
}

function fmtMonthYear(dateVal) {
    const s = toDateStr(dateVal);
    if (!s) return '';
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const [y, m] = s.split('-');
    return `${MONTHS[parseInt(m) - 1]}-${y.slice(-2)}`;
}

function sessionStr(s) { return parseInt(s) === 1 ? 'FN' : 'AN'; }

// ─── Build grid from layout_data ─────────────────────────────
// Returns grid[row][col] = { available, label, pos1, pos2 }
// ONE cell per bench — pos1 and pos2 are the two seat slots.

function buildGrid(room) {
    const students = room.students || [];

    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string' ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    // Detect actual seating mode from saved allocations
    const actualStudPerBench = students.some(s => s.seat_position === 2) ? 2 : 1;

    // Build bench→seats lookup
    const benchSeats = {};
    students.forEach(s => {
        if (!s.bench_label) return;
        if (!benchSeats[s.bench_label]) benchSeats[s.bench_label] = { pos1: null, pos2: null };
        if (s.seat_position === 1) benchSeats[s.bench_label].pos1 = s;
        if (s.seat_position === 2) benchSeats[s.bench_label].pos2 = s;
    });

    let benches = [];
    if (layout.benches && layout.benches.length > 0) {
        benches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const cols  = layout.cols || room.total_columns || 4;
        const rows  = layout.rows || room.total_rows    || 8;
        for (let r = 0; r < rows; r++)
            for (let c = 1; c <= cols; c++)
                benches.push({ col:c, row:r+1, label:`${ALPHA[r]}${c}`, available:true });
    }

    const numRows = Math.max(...benches.map(b => b.row));
    const numCols = Math.max(...benches.map(b => b.col));

    // Initialise 2D grid
    const grid = {};
    for (let r = 1; r <= numRows; r++) {
        grid[r] = {};
        for (let c = 1; c <= numCols; c++)
            grid[r][c] = { available: false, label: '', pos1: null, pos2: null };
    }

    const sortedBenches = [...benches].sort((a,b) => a.row !== b.row ? a.row-b.row : a.col-b.col);
    sortedBenches.forEach(b => {
        const seats = benchSeats[b.label] || { pos1: null, pos2: null };
        grid[b.row][b.col] = {
            available: b.available === true,
            label:     b.label,
            pos1:      b.available ? seats.pos1 : null,
            pos2:      b.available ? seats.pos2 : null
        };
    });

    return { numRows, numCols, grid, actualStudPerBench };
}

// ─── Draw one [HT box][MK box] seat pair ─────────────────────

function drawSeatPair(doc, startX, boxTop, HT_W, MK_W, BOX_H, student) {
    // Full-width roll number box only — no attendance mark box
    const fullW = HT_W + MK_W + 3; // reclaim the space the [-] box used
    doc.lineWidth(0.4)
       .roundedRect(startX, boxTop, fullW, BOX_H, 1.5)
       .fillAndStroke('white', 'black');

    if (student && !student.is_blocked) {
        const lbl = student.register_number || String(student.student_id || '');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('black')
           .text(lbl, startX + 2, boxTop + (BOX_H - 9) / 2 + 1,
                 { width: fullW - 4, align: 'center', lineBreak: false });
        // CRITICAL: reset text cursor — drawSeatPair is called for every bench cell
        // (up to 56+ times per room). Without this, doc.y advances past the page
        // bottom and PDFKit auto-inserts a blank page before the next addPage().
        doc.y = boxTop;
    }
    // Blocked student → cell drawn but left blank (no text, no cursor advance)
}

// ─── PDF Generator ───────────────────────────────────────────

function generateSeatingPDF(plan, rooms, notifications, collegeInfo = {}) {
    return new Promise((resolve, reject) => {
        try {
            // LANDSCAPE: swap width and height
            const doc = new PDFDocument({
                size:          'A4',
                layout:        'landscape',    // ← KEY CHANGE
                margins:       { top:22, bottom:5, left:28, right:28 },
                // bottom:5 (not 22) moves PDFKit's overflow threshold from 573pt to 590pt.
                // The page stamp is drawn at PH-28=567pt; its text bottom = 567+9.6=576.6pt.
                // With bottom:22 → threshold=573 → 576.6>573 → PDFKit auto-adds a blank page.
                // With bottom:5  → threshold=590 → 576.6<590 → stamp stays on the room page. ✓
                autoFirstPage: false
            });

            const chunks = [];
            doc.on('data',  c  => chunks.push(c));
            doc.on('end',   () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Landscape A4: 841.89 wide × 595.28 tall
            const PW = 841.89;
            const PH = 595.28;
            const ML = 28;
            const CW = PW - ML * 2;   // ≈ 786 pts usable width

            // Helper: draw text at absolute position WITHOUT advancing doc.y.
            // doc.moveTo() is a PATH operation — it does NOT reset the text cursor.
            // The correct fix is doc.y = yPos after every doc.text() call.
            function txt(text, x, yPos, opts = {}) {
                doc.text(text, x, yPos, { ...opts, lineBreak: false });
                // Reset the text cursor to where we just drew — prevents PDFKit
                // from thinking we've scrolled past the bottom margin and
                // auto-inserting a blank page before the next doc.addPage().
                doc.y = yPos;
            }

            const collegeName = (collegeInfo.name || 'YOUR COLLEGE NAME').toUpperCase();
            const deptName    = (collegeInfo.department || 'EXAMINATION BRANCH').toUpperCase();
            const monthYear   = fmtMonthYear(plan.exam_date);

            const semLabels = [...new Set(
                notifications.map(n => n.semester_label || '').filter(Boolean)
            )].join(', ');

            const examType  = notifications[0]?.exam_type
                           || notifications[0]?.notification_title
                           || 'EXAM';
            const examTitle = `${examType} SEATING PLAN FOR - B.TECH.${semLabels ? ' '+semLabels : ''} ${monthYear} Mode: Regular`;

            const noteText   = 'Note: Roll Nos. of the students are not marked on the tables. The students are advised to sit according to the seating plan.';
            const footerNote = 'NOTE: PLEASE SUBMIT THE ATTENDANCE THROUGH "ONLINE LINK" PROVIDED BY "EXAM BRANCH".';

            // ─── One page per room ────────────────────────────
            rooms.forEach(room => {
                doc.addPage();
                let y = ML;

                // 1. College header
                doc.font('Helvetica-Bold').fontSize(16).fillColor('black');
                txt(`${collegeName} - ${deptName}`, ML, y, { align:'center', width:CW });
                y += 24;

                // 2. Exam title
                doc.font('Helvetica-Bold').fontSize(12);
                txt(examTitle, ML, y, { align:'center', width:CW });
                y += 18;

                // 3. Note
                doc.font('Helvetica').fontSize(9).fillColor('black');
                txt(noteText, ML, y, { align:'left', width:CW });
                y += 14;

                // 4. Date (left) + Hall No (right)
                doc.font('Helvetica-Bold').fontSize(12).fillColor('black');
                txt(`Date: ${fmtDate(plan.exam_date, plan.session_order)}`, ML, y, {});
                txt(`Hall No.: ${room.room_number || ''}`, ML, y, { align:'right', width:CW });
                y += 20;

                // 5. Grid ─────────────────────────────────────
                const { numRows, numCols, grid, actualStudPerBench } = buildGrid(room);

                const COL_W = CW / numCols;        // wider columns in landscape
                const HDR_H = 18;

                // Auto-size row height
                // Landscape gives more vertical breathing room too
                const availH = PH - y - 160;       // reserve for table + footer
                const ROW_H  = Math.max(14, Math.min(24, (availH - HDR_H) / numRows));
                const GRID_H = HDR_H + numRows * ROW_H;

                // Cell box sizing — larger in landscape
                const PAD    = 4;
                const BOX_H  = Math.min(ROW_H - 4, 17);

                // Each bench cell: full width per seat (no [-] box anymore)
                const pairW  = (COL_W - PAD * 2) / actualStudPerBench;
                const HT_W   = pairW - 4;   // near full pairW — just a small gap between seats
                const MK_W   = 0;            // removed

                // Outer border
                doc.lineWidth(1.0).rect(ML, y, CW, GRID_H).stroke();

                // Column headers + vertical dividers
                doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
                for (let c = 1; c <= numCols; c++) {
                    const cx = ML + (c - 1) * COL_W;
                    if (c > 1) doc.lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + GRID_H).stroke();
                    txt(`Column ${c}`, cx, y + 5, { width:COL_W, align:'center' });
                }
                doc.lineWidth(0.5)
                   .moveTo(ML, y + HDR_H)
                   .lineTo(ML + CW, y + HDR_H)
                   .stroke();

                // Draw all cells
                for (let r = 1; r <= numRows; r++) {
                    const rowTop = y + HDR_H + (r - 1) * ROW_H;
                    const boxTop = rowTop + (ROW_H - BOX_H) / 2;

                    for (let c = 1; c <= numCols; c++) {
                        const cell = grid[r][c];
                        const cx   = ML + (c - 1) * COL_W;

                        if (!cell.available) {
                            // Grey shaded — unavailable bench
                            doc.fillColor('#c8c8c8').fillOpacity(0.55)
                               .rect(cx + 0.5, rowTop + 0.5, COL_W - 1, ROW_H - 0.5)
                               .fill();
                            doc.fillOpacity(1);
                        } else if (!cell.pos1 && !cell.pos2) {
                            // Available bench but no student assigned — draw empty boxes
                            const x1 = cx + PAD;
                            drawSeatPair(doc, x1, boxTop, HT_W, MK_W, BOX_H, null);
                        } else {
                            // pos1 pair — always draw if bench is available
                            const x1 = cx + PAD;
                            drawSeatPair(doc, x1, boxTop, HT_W, MK_W, BOX_H, cell.pos1);

                            // pos2 pair — only draw if 2-per-bench AND pos2 student exists
                            if (actualStudPerBench === 2 && cell.pos2) {
                                const x2 = cx + PAD + pairW;
                                drawSeatPair(doc, x2, boxTop, HT_W, MK_W, BOX_H, cell.pos2);
                            }
                        }
                    }

                    // Light horizontal row divider
                    if (r < numRows) {
                        doc.lineWidth(0.2).strokeColor('#999999')
                           .moveTo(ML + 1, rowTop + ROW_H)
                           .lineTo(ML + CW - 1, rowTop + ROW_H)
                           .stroke();
                        doc.strokeColor('black');
                    }
                }

                y += GRID_H + 14;

                // 6. Summary table ────────────────────────────
                // Split pipe-separated subjects into individual rows
                const students = room.students || [];
                const summMap  = {};
                students.forEach(s => {
                    const subjectParts = (s.subject_name  || '').split(' | ').map(x => x.trim()).filter(Boolean);
                    const codeParts    = (s.syllabus_code || '').split(' | ').map(x => x.trim()).filter(Boolean);
                    const sem    = s.sem_name || String(s.semester_id || '');
                    const branch = s.branch_code || '';
                    if (subjectParts.length === 0) subjectParts.push('');
                    subjectParts.forEach((subj, idx) => {
                        const code = codeParts[idx] || '';
                        const key  = `${sem}||${branch}||${subj}||${code}`;
                        if (!summMap[key]) summMap[key] = { sem, branch, course:subj, code, count:0 };
                        summMap[key].count++;
                    });
                });

                const summRows   = Object.values(summMap);
                const grandTotal = students.length;

                // Wider table in landscape — center it nicely
                const TBL_W = CW * 0.65;
                const tblX  = ML + (CW - TBL_W) / 2;
                const cw2   = [TBL_W*0.08, TBL_W*0.12, TBL_W*0.48, TBL_W*0.20, TBL_W*0.12];
                const TH    = 16;
                const HDRS  = ['SEM', 'Branch', 'Course Name', 'Course Code', 'Total'];

                // Header
                doc.font('Helvetica-Bold').fontSize(9.5).fillColor('black');
                let tx = tblX;
                cw2.forEach((w, i) => {
                    doc.lineWidth(0.5).rect(tx, y, w, TH).stroke();
                    txt(HDRS[i], tx+2, y+4, { width:w-4, align:'center' });
                    tx += w;
                });
                y += TH;

                // Body
                doc.font('Helvetica').fontSize(9.5);
                summRows.forEach(row => {
                    tx = tblX;
                    const vals = [row.sem, row.branch, row.course, row.code, String(row.count)];
                    vals.forEach((v, i) => {
                        doc.lineWidth(0.4).rect(tx, y, cw2[i], TH).stroke();
                        const maxChars = Math.floor((cw2[i] - 4) / 5.5);
                        const t = (v || '').length > maxChars
                            ? (v || '').substring(0, maxChars - 1) + '…'
                            : (v || '');
                        txt(t, tx+2, y+4, { width:cw2[i]-4, align:'center' });
                        tx += cw2[i];
                    });
                    y += TH;
                });

                // Grand total row
                doc.font('Helvetica-Bold').fontSize(9.5);
                tx = tblX;
                ['','','','Grand Total', String(grandTotal)].forEach((v, i) => {
                    doc.lineWidth(0.5).rect(tx, y, cw2[i], TH).stroke();
                    txt(v, tx+2, y+4, { width:cw2[i]-4, align:'center' });
                    tx += cw2[i];
                });
                y += TH + 14;

                // 7. Red footer note
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#cc0000');
                txt(footerNote, ML, Math.min(y, PH - 50), { align:'center', width:CW });

                // Page stamp (bottom right) — MUST stay inside bottom margin (PH - margins.bottom = 573pt).
                // PH - 18 = 577pt is PAST the margin → PDFKit auto-creates a new blank page for it.
                // Use PH - 28 = 567pt (safely inside) to keep stamp on the same room page.
                doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa');
                txt(`Plan #${plan.plan_id}  ·  ${fmtDate(plan.exam_date, plan.session_order)}`,
                    ML, PH - 28, { align:'right', width:CW });

                // ── CRITICAL: reset text cursor to top-of-page before next addPage() ──
                // Without this, PDFKit sees doc.y > page bottom and auto-inserts a
                // blank page BEFORE the next explicit addPage() call.
                doc.y = doc.page.margins.top;
            });

            doc.end();

        } catch (err) {
            reject(err);
        }
    });
}

// ─── Express Router ──────────────────────────────────────────

function initializeRouter(pool) {
    const router = express.Router();

    router.get('/pdf/:planId', async (req, res) => {
        try {
            const { planId } = req.params;

            const [[plan]] = await pool.query(
                `SELECT * FROM exam_seating_plan WHERE plan_id = ?`, [planId]
            );
            if (!plan) return res.status(404).json({ error: 'Seating plan not found' });

            const [notifRows] = await pool.query(`
                SELECT
                    espn.notification_id,
                    en.notification_title,
                    en.exam_type,
                    en.batch_name,
                    GROUP_CONCAT(DISTINCT sm.semester_name ORDER BY sm.semester_name SEPARATOR ', ') AS semester_label
                FROM exam_seating_plan_notifications espn
                LEFT JOIN exam_notifications en
                    ON CAST(en.notification_id AS CHAR) = CAST(espn.notification_id AS CHAR)
                LEFT JOIN exam_student_entries ese
                    ON ese.notification_id = espn.notification_id
                    AND DATE(ese.exam_date) = DATE(?)
                LEFT JOIN semester_master sm ON sm.semester_id = ese.semester_id
                WHERE espn.plan_id = ?
                GROUP BY espn.notification_id, en.notification_title, en.exam_type, en.batch_name
            `, [plan.exam_date, planId]);

            const [seats] = await pool.query(`
                SELECT
                    esa.student_id, esa.branch_id, esa.semester_id,
                    esa.subject_id, esa.subject_name, esa.syllabus_code,
                    esa.room_id, esa.bench_label, esa.seat_position, esa.seat_serial,
                    esa.row_no, esa.col_no,
                    rm.room_code         AS room_number,
                    rm.room_name, rm.total_capacity,
                    rm.total_rows, rm.total_columns,
                    rm.students_per_bench, rm.layout_data,
                    bm.block_code,
                    stm.ht_number        AS register_number,
                    br.branch_code,
                    subm.subject_name    AS subject_name_ref,
                    subm.syllabus_code   AS syllabus_code_ref,
                    smst.semester_name   AS sem_name,
                    COALESCE(esa.is_blocked, 0) AS is_blocked
                FROM exam_seat_allocation esa
                LEFT JOIN room_master    rm   ON rm.room_id      = esa.room_id
                LEFT JOIN block_master   bm   ON bm.block_id     = rm.block_id
                LEFT JOIN student_master stm  ON stm.student_id  = esa.student_id
                LEFT JOIN branch_master  br   ON br.branch_id    = esa.branch_id
                LEFT JOIN subject_master subm ON subm.subject_id = esa.subject_id
                LEFT JOIN semester_master smst ON smst.semester_id = esa.semester_id
                WHERE esa.plan_id = ?
                ORDER BY esa.room_id, esa.row_no ASC, esa.col_no ASC, esa.seat_position ASC
            `, [planId]);

            seats.forEach(s => {
                s.subject_name  = s.subject_name  || s.subject_name_ref  || '';
                s.syllabus_code = s.syllabus_code || s.syllabus_code_ref || '';
            });

            const roomMap = {};
            seats.forEach(s => {
                if (!roomMap[s.room_id]) {
                    roomMap[s.room_id] = {
                        room_id:           s.room_id,
                        room_number:       s.room_number,
                        room_name:         s.room_name,
                        block_code:        s.block_code,
                        total_capacity:    s.total_capacity,
                        total_rows:        s.total_rows,
                        total_columns:     s.total_columns,
                        students_per_bench: s.students_per_bench || 2,
                        layout_data:       s.layout_data,
                        students:          []
                    };
                }
                roomMap[s.room_id].students.push(s);
            });

            // ── Fetch college info — exhaustive multi-table/column search ──
            let collegeInfo = { name: '', department: 'EXAMINATION BRANCH' };
            try {
                // Helper to extract name from a row trying many possible column names
                const extractName = (row) => {
                    if (!row) return null;
                    return row.college_name || row.institution_name || row.name ||
                           row.college || row.university_name || null;
                };
                const extractDept = (row) => {
                    if (!row) return null;
                    return row.college_subtitle || row.department_name || row.department ||
                           row.exam_branch_name || null;
                };

                // Attempt 1: college_settings
                const [csRows] = await pool.query(`SELECT * FROM college_settings LIMIT 1`).catch(() => [[]]);
                let found = csRows?.[0];
                if (found && extractName(found)) {
                    collegeInfo.name       = extractName(found);
                    collegeInfo.department = extractDept(found) || 'EXAMINATION BRANCH';
                    console.log('[PDF] College from college_settings:', collegeInfo.name);
                } else {
                    // Attempt 2: college_master — prefer the row with full contact info
                    // (college_id=1/SVEC has NULL email/website; KITSW id=4 has them)
                    const [cmRows] = await pool.query(
                        `SELECT * FROM college_master
                         WHERE is_active = 1
                           AND (email IS NOT NULL OR website IS NOT NULL)
                         ORDER BY college_id ASC
                         LIMIT 1`
                    ).catch(() => [[]]);
                    found = cmRows?.[0];
                    // Fallback: if none had email/website, grab first active row
                    if (!found || !extractName(found)) {
                        const [cmAll] = await pool.query(
                            `SELECT * FROM college_master WHERE is_active=1 ORDER BY college_id ASC LIMIT 1`
                        ).catch(() => [[]]);
                        found = cmAll?.[0];
                    }
                    if (found && extractName(found)) {
                        collegeInfo.name       = extractName(found);
                        collegeInfo.department = extractDept(found) || 'EXAMINATION BRANCH';
                        console.log('[PDF] College from college_master:', collegeInfo.name);
                    } else {
                        // Attempt 3: institution_master
                        const [imRows] = await pool.query(`SELECT * FROM institution_master LIMIT 1`).catch(() => [[]]);
                        found = imRows?.[0];
                        if (found && extractName(found)) {
                            collegeInfo.name       = extractName(found);
                            collegeInfo.department = extractDept(found) || 'EXAMINATION BRANCH';
                            console.log('[PDF] College from institution_master:', collegeInfo.name);
                        } else {
                            // Attempt 4: generic key-value settings table
                            const [stRows] = await pool.query(
                                `SELECT setting_key, setting_value FROM settings
                                 WHERE setting_key IN ('college_name','institution_name','org_name','university_name')
                                 LIMIT 5`
                            ).catch(() => [[]]);
                            if (stRows?.length) {
                                const m = {};
                                stRows.forEach(r => { m[r.setting_key] = r.setting_value; });
                                collegeInfo.name = m.college_name || m.institution_name || m.org_name || m.university_name || '';
                                console.log('[PDF] College from settings table:', collegeInfo.name);
                            } else {
                                // Attempt 5: app_settings or system_settings
                                const [asRows] = await pool.query(
                                    `SELECT * FROM app_settings LIMIT 1`
                                ).catch(() => [[]]);
                                found = asRows?.[0];
                                if (found && extractName(found)) {
                                    collegeInfo.name = extractName(found);
                                    console.log('[PDF] College from app_settings:', collegeInfo.name);
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[PDF] College lookup error:', e.message);
            }

            if (!collegeInfo.name) {
                // ── FALLBACK: hardcode until you configure the DB ──────────────
                // TO FIX: Run this SQL to find your college table:
                //   SHOW TABLES LIKE '%college%';
                //   SHOW TABLES LIKE '%institution%';
                //   SHOW TABLES LIKE '%settings%';
                // Then tell the developer which table + column has your college name.
                console.error('[PDF] ⚠️  College name NOT found in DB. Add your college name to college_settings.college_name');
                collegeInfo.name = 'YOUR COLLEGE NAME (Configure in DB)';
            }

            const buf   = await generateSeatingPDF(plan, Object.values(roomMap), notifRows, collegeInfo);
            const fname = `SeatingPlan_${toDateStr(plan.exam_date)}_${sessionStr(plan.session_order)}_Plan${planId}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
            res.send(buf);

        } catch (err) {
            console.error('GET /pdf/:planId error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter, generateSeatingPDF };
