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

    benches.forEach(b => {
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

    if (student) {
        const lbl = student.register_number || String(student.student_id || '');
        doc.font('Helvetica-Bold').fontSize(9).fillColor('black')
           .text(lbl, startX + 2, boxTop + (BOX_H - 9) / 2 + 1,
                 { width: fullW - 4, align: 'center', lineBreak: false });
    }
}

// ─── PDF Generator ───────────────────────────────────────────

function generateSeatingPDF(plan, rooms, notifications, collegeInfo = {}) {
    return new Promise((resolve, reject) => {
        try {
            // LANDSCAPE: swap width and height
            const doc = new PDFDocument({
                size:          'A4',
                layout:        'landscape',    // ← KEY CHANGE
                margins:       { top:22, bottom:22, left:28, right:28 },
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

            const collegeName = (collegeInfo.name       || 'KITS, WARANGAL').toUpperCase();
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
                doc.font('Helvetica-Bold').fontSize(16).fillColor('black')
                   .text(`${collegeName} - ${deptName}`, ML, y, { align:'center', width:CW, lineBreak:false });
                y += 24;

                // 2. Exam title
                doc.font('Helvetica-Bold').fontSize(12)
                   .text(examTitle, ML, y, { align:'center', width:CW, lineBreak:false });
                y += 18;

                // 3. Note
                doc.font('Helvetica').fontSize(9).fillColor('black')
                   .text(noteText, ML, y, { align:'left', width:CW, lineBreak:false });
                y += 14;

                // 4. Date (left) + Hall No (right)
                doc.font('Helvetica-Bold').fontSize(12).fillColor('black');
                doc.text(`Date: ${fmtDate(plan.exam_date, plan.session_order)}`, ML, y, { lineBreak:false });
                doc.text(`Hall No.: ${room.room_number || ''}`, ML, y, { align:'right', width:CW, lineBreak:false });
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
                    doc.text(`Column ${c}`, cx, y + 5, { width:COL_W, align:'center', lineBreak:false });
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
                    doc.text(HDRS[i], tx+2, y+4, { width:w-4, align:'center', lineBreak:false });
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
                        // Truncate long text to prevent wrapping
                        const maxChars = Math.floor((cw2[i] - 4) / 5.5);
                        const txt = (v || '').length > maxChars
                            ? (v || '').substring(0, maxChars - 1) + '…'
                            : (v || '');
                        doc.text(txt, tx+2, y+4, { width:cw2[i]-4, align:'center', lineBreak:false });
                        tx += cw2[i];
                    });
                    y += TH;
                });

                // Grand total
                doc.font('Helvetica-Bold').fontSize(9.5);
                tx = tblX;
                ['','','','Grand Total', String(grandTotal)].forEach((v, i) => {
                    doc.lineWidth(0.5).rect(tx, y, cw2[i], TH).stroke();
                    doc.text(v, tx+2, y+4, { width:cw2[i]-4, align:'center', lineBreak:false });
                    tx += cw2[i];
                });
                y += TH + 16;

                // 7. Red footer
                doc.font('Helvetica-Bold').fontSize(10).fillColor('#cc0000')
                   .text(footerNote, ML, Math.min(y, PH - 40), { align:'center', width:CW, lineBreak:false });

                // Page stamp
                doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa')
                   .text(`Plan #${plan.plan_id}  ·  ${fmtDate(plan.exam_date, plan.session_order)}`,
                         ML, PH - 18, { align:'right', width:CW, lineBreak:false });
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
                    smst.semester_name   AS sem_name
                FROM exam_seat_allocation esa
                LEFT JOIN room_master    rm   ON rm.room_id      = esa.room_id
                LEFT JOIN block_master   bm   ON bm.block_id     = rm.block_id
                LEFT JOIN student_master stm  ON stm.student_id  = esa.student_id
                LEFT JOIN branch_master  br   ON br.branch_id    = esa.branch_id
                LEFT JOIN subject_master subm ON subm.subject_id = esa.subject_id
                LEFT JOIN semester_master smst ON smst.semester_id = esa.semester_id
                WHERE esa.plan_id = ?
                ORDER BY esa.room_id, esa.seat_serial
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

            let collegeInfo = {};
            try {
                const [[col]] = await pool.query(`SELECT * FROM college_master LIMIT 1`);
                if (col) collegeInfo = {
                    name:       col.college_name || col.name || 'KITS, WARANGAL',
                    department: col.department   || 'EXAMINATION BRANCH'
                };
            } catch (_) {}

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
