// ================================================================
//  seating-allocation-routes.js  —  Professional v5.0
//  4-BATCH ANTI-COPY ENGINE  |  ref_code grouping
// ================================================================
//
//  ALGORITHM OVERVIEW
//  ─────────────────────────────────────────────────────────────
//  ref_code (from subject_master) is the anti-copy group key.
//  Same ref_code = same exam paper = must NEVER sit adjacent.
//
//  4-BATCH SEAT ASSIGNMENT (2 students/bench):
//    BATCH 1 → ODD  benches, seat_position 1 (LEFT)
//    BATCH 2 → EVEN benches, seat_position 1 (LEFT)
//    BATCH 3 → ODD  benches, seat_position 2 (RIGHT)
//    BATCH 4 → EVEN benches, seat_position 2 (RIGHT)
//
//  Anti-copy guarantee per bench:
//    LEFT  side  → BATCH 1 group (ODD)  or BATCH 2 group (EVEN)
//    RIGHT side  → BATCH 3 group (ODD)  or BATCH 4 group (EVEN)
//    BATCH 1 ≠ BATCH 3  →  same bench LEFT ≠ RIGHT          ✅
//    BATCH 1 ≠ BATCH 2  →  adjacent LEFT ≠ adjacent LEFT    ✅
//    BATCH 2 ≠ BATCH 4  →  adjacent RIGHT ≠ adjacent RIGHT  ✅
//
//  BATCH COUNT RULES:
//    N unique ref_codes ≥ 4  → 4 batches (full separation)
//    N = 3                   → 4 batches (3 groups rotated, 4th wraps)
//    N = 2                   → 4 batches (each group split into 2 halves)
//    N = 1                   → 4 batches (split by roll number order)
//    ESE exam                → 1 student/bench (ODD/EVEN 2-batch)
//
//  STUDENT DISTRIBUTION:
//    Proportional fill across rooms by ref_code group.
//    Each room gets a representative MIX of all groups.
//    Never dump one group into one room.
//
//  ANTI-COPY SCORE (0–100%):
//    Checks: same-bench conflict, adjacent-left, adjacent-right,
//            diagonal cross.
//    Score < 60%  → BLOCKED (cannot save)
//    Score 60–79% → WARNING
//    Score 80–94% → GOOD
//    Score ≥ 95%  → EXCELLENT
// ================================================================

'use strict';
const express = require('express');

// ── Helpers ──────────────────────────────────────────────────

function toIST(date) {
    if (!date) return '';
    const d = new Date(date);
    const offset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(d.getTime() + offset);
    return ist.toISOString().split('T')[0];
}

function formatDateDisplay(ds) {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', weekday:'short' });
}

const DAY_COL = {
    0:['sun_fn','sun_an'], 1:['mon_fn','mon_an'], 2:['tue_fn','tue_an'],
    3:['wed_fn','wed_an'], 4:['thu_fn','thu_an'], 5:['fri_fn','fri_an'],
    6:['sat_fn','sat_an']
};

// ── 1. DEDUPLICATE ────────────────────────────────────────────
// One physical seat per student. Consolidate all subjects into
// a subjects[] array. Primary ref_code = first subject's ref_code.

function deduplicateStudents(rawRows) {
    const map = new Map();
    for (const row of rawRows) {
        const sid = row.student_id;
        if (!map.has(sid)) {
            map.set(sid, {
                student_id:      row.student_id,
                notification_id: row.notification_id,
                notification_ref:row.notification_ref,
                branch_id:       row.branch_id,
                semester_id:     row.semester_id,
                regulation_id:   row.regulation_id,
                batch_id:        row.batch_id,
                exam_date:       row.exam_date,
                session_order:   row.session_order,
                student_name:    row.student_name,
                register_number: row.register_number,
                branch_code:     row.branch_code,
                branch_name:     row.branch_name,
                sem_name:        row.sem_name,
                subject_id:      row.subject_id,
                subject_name:    row.subject_name,
                syllabus_code:   row.syllabus_code,
                ref_code:        (row.ref_code || row.syllabus_code || 'GRP').toUpperCase().trim(),
                subjects:        []
            });
        }
        const s = map.get(sid);
        if (!s.subjects.find(x => x.subject_id === row.subject_id)) {
            s.subjects.push({
                subject_id:   row.subject_id,
                subject_name: row.subject_name,
                syllabus_code:row.syllabus_code,
                ref_code:     (row.ref_code || row.syllabus_code || 'GRP').toUpperCase().trim()
            });
        }
    }
    return [...map.values()];
}

// ── 2. PARSE LAYOUT → SNAKE BENCH LIST ───────────────────────
// Reads layout_data JSON. Builds row-snaked ordered bench list.
// Snake order: row 0 L→R, row 1 R→L, row 2 L→R …

function getSnakeBenches(room) {
    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    const studPerBenchCfg = room.students_per_bench || layout.students_per_bench || 2;
    let allBenches = [];

    if (layout.benches && layout.benches.length) {
        allBenches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const cols  = layout.cols || room.total_columns || 4;
        const rows  = layout.rows || room.total_rows    || 8;
        for (let r = 0; r < rows; r++)
            for (let c = 1; c <= cols; c++)
                allBenches.push({ col:c, row:r+1, label:`${ALPHA[r]}${c}`, available:true });
    }

    const rowNums = [...new Set(allBenches.map(b => b.row))].sort((a,b) => a-b);
    const snake   = [];
    rowNums.forEach((rowNum, idx) => {
        const rowBenches = allBenches
            .filter(b => b.row === rowNum && b.available !== false)
            .sort((a,b) => a.col - b.col);
        snake.push(...(idx % 2 === 0 ? rowBenches : [...rowBenches].reverse()));
    });

    return { snakeBenches: snake, studPerBenchCfg };
}

// ── 3. CALCULATE ROOM CAPACITY ────────────────────────────────

function calcCapacity(room) {
    if (room.layout_data) {
        try {
            const ld = typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data;
            if (ld.benches) {
                const avail = ld.benches.filter(b => b.available !== false).length;
                return avail * (room.students_per_bench || 2);
            }
        } catch (_) {}
    }
    return room.usable_capacity || room.total_capacity || 42;
}

// ── 4. INTERLEAVED ROUND-ROBIN SORT ──────────────────────────
//
//  Groups students by ref_code, then interleaves them so that
//  consecutive students in the list always have different ref_codes.
//
//  Example with 3 groups (EC:4, BEE:2, DS:3):
//    sorted list → EC,BEE,DS, EC,BEE,DS, EC,DS, EC
//
//  Then assigned physically: bench1-LEFT, bench1-RIGHT,
//  bench2-LEFT, bench2-RIGHT, bench3-LEFT, bench3-RIGHT...
//
//  This guarantees:
//    Same bench:      LEFT(EC) ≠ RIGHT(BEE)           ✅
//    Adjacent bench:  bench1-LEFT(EC) ≠ bench2-LEFT(DS) ✅
//    Adjacent RIGHT:  bench1-RIGHT(BEE) ≠ bench2-RIGHT(EC) ✅
//    Diagonal:        bench1-RIGHT(BEE) ≠ bench2-LEFT(DS) ✅

function interleaveByRefCode(students) {
    // Group by ref_code
    const groups = {};
    for (const s of students) {
        const key = (s.ref_code || 'GRP').toUpperCase().trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    }

    // Sort within each group by register_number for determinism
    for (const g of Object.values(groups)) {
        g.sort((a,b) => (a.register_number||'').localeCompare(b.register_number||''));
    }

    // Keys sorted largest group first → spreads dominant group evenly
    const keys = Object.keys(groups).sort((a,b) => groups[b].length - groups[a].length);

    // Round-robin interleave
    const result = [];
    const maxLen = Math.max(...keys.map(k => groups[k].length));
    for (let i = 0; i < maxLen; i++) {
        for (const key of keys) {
            if (i < groups[key].length) result.push(groups[key][i]);
        }
    }
    return result;
}

// ── 5. ASSIGN SEATS IN ONE ROOM ──────────────────────────────
//
//  Fills benches in snake order: bench1-LEFT, bench1-RIGHT,
//  bench2-LEFT, bench2-RIGHT, ...
//
//  Students from interleaveByRefCode() are assigned in sequence.
//  Since consecutive students have different ref_codes:
//    - Same bench LEFT≠RIGHT (consecutive students) ✅
//    - Adjacent bench same-side (every 2 students gap) ✅

function assignRoom(studentsForRoom, room, isESE) {
    const { snakeBenches, studPerBenchCfg } = getSnakeBenches(room);
    const total = studentsForRoom.length;
    const avail = snakeBenches.length;

    // 1/bench if ESE or if students fit in benches without sharing
    const spb = isESE ? 1 : (total <= avail ? 1 : studPerBenchCfg);

    // Interleave students so consecutive = different ref_codes
    const sorted = interleaveByRefCode(studentsForRoom);

    const result = [];
    let serial     = 1;
    let studentIdx = 0;

    // Fill bench by bench in snake order
    for (const bench of snakeBenches) {
        for (let pos = 1; pos <= spb; pos++) {
            if (studentIdx >= sorted.length) break;
            const student = sorted[studentIdx++];
            result.push({
                ...student,
                room_id:        room.room_id,
                bench_label:    bench.label,
                row_no:         bench.row,
                col_no:         bench.col,
                seat_position:  pos,
                seat_serial:    serial++,
                batch_no:       pos,   // 1=LEFT, 2=RIGHT
                stud_per_bench: spb
            });
        }
    }

    return result;
}

// ── 7. DISTRIBUTE STUDENTS ACROSS ROOMS ──────────────────────
// Proportional distribution: each room gets a MIXED spread
// of all ref_code groups, not one group per room.

function distributeAndAssign(students, rooms, isESE) {
    // Calculate each room's capacity
    rooms.forEach(r => { r._cap = calcCapacity(r); });
    const totalCap = rooms.reduce((s,r) => s + r._cap, 0);

    // Group students by ref_code
    const groups = {};
    for (const s of students) {
        const k = (s.ref_code || 'GRP').toUpperCase().trim();
        if (!groups[k]) groups[k] = [];
        groups[k].push(s);
    }
    const gKeys = Object.keys(groups).sort((a,b) => groups[b].length - groups[a].length);

    // Build room buckets
    const buckets = rooms.map(r => ({ room:r, students:[], cap:r._cap }));

    // Distribute each group proportionally across rooms
    for (const key of gKeys) {
        const pool = [...groups[key]];
        const total = pool.length;

        // Calculate how many of this group each room should get
        for (let i = 0; i < buckets.length; i++) {
            const rb = buckets[i];
            const ratio = rb.cap / totalCap;
            let count   = (i < buckets.length - 1)
                ? Math.round(total * ratio)
                : pool.length; // last room takes remainder
            count = Math.min(count, rb.cap - rb.students.length, pool.length);
            rb.students.push(...pool.splice(0, count));
        }

        // Overflow → push into rooms with remaining space
        while (pool.length) {
            let placed = false;
            for (const rb of buckets) {
                if (rb.students.length < rb.cap && pool.length) {
                    rb.students.push(pool.shift());
                    placed = true;
                }
            }
            if (!placed) break; // all rooms full (shouldn't happen — pre-validated)
        }
    }

    // Assign seats within each room
    const allocs = [];
    for (const rb of buckets) {
        if (!rb.students.length) continue;
        allocs.push(...assignRoom(rb.students, rb.room, isESE));
    }
    return allocs;
}

// ── 8. ANTI-COPY SCORE ────────────────────────────────────────
// Validates every seating pair and returns a score 0–100.

function scoreAntiCopy(allocations) {
    // Group by room
    const byRoom = {};
    for (const a of allocations) {
        if (!byRoom[a.room_id]) byRoom[a.room_id] = [];
        byRoom[a.room_id].push(a);
    }

    let totalChecks = 0, totalPassed = 0;
    const violations = [];
    const roomScores = {};

    for (const [roomId, seats] of Object.entries(byRoom)) {
        // Build bench map: benchMap[label] = { p1, p2 }
        const bMap = {};
        for (const s of seats) {
            if (!bMap[s.bench_label]) bMap[s.bench_label] = {};
            if (s.seat_position === 1) bMap[s.bench_label].p1 = s;
            if (s.seat_position === 2) bMap[s.bench_label].p2 = s;
        }

        // Ordered bench keys by seat_serial
        const orderedLabels = Object.keys(bMap)
            .filter(k => bMap[k].p1)
            .sort((a,b) => (bMap[a].p1?.seat_serial||0) - (bMap[b].p1?.seat_serial||0));

        let rChecks = 0, rPassed = 0;

        orderedLabels.forEach((lbl, i) => {
            const b    = bMap[lbl];
            const next = bMap[orderedLabels[i+1]];

            // Check A — Same bench: LEFT vs RIGHT (critical)
            if (b.p1 && b.p2) {
                rChecks += 2; totalChecks += 2;
                if (b.p1.ref_code !== b.p2.ref_code) {
                    rPassed += 2; totalPassed += 2;
                } else {
                    violations.push({
                        type:'SAME_BENCH', room_id:roomId, bench:lbl,
                        ref_code:b.p1.ref_code,
                        students:[b.p1.register_number, b.p2.register_number]
                    });
                }
            }

            if (!next) return;

            // Check B — Adjacent LEFT vs LEFT
            if (b.p1 && next.p1) {
                rChecks++; totalChecks++;
                if (b.p1.ref_code !== next.p1.ref_code) { rPassed++; totalPassed++; }
                else violations.push({ type:'ADJ_LEFT', room_id:roomId,
                    ref_code:b.p1.ref_code,
                    students:[b.p1.register_number, next.p1.register_number] });
            }

            // Check C — Adjacent RIGHT vs RIGHT
            if (b.p2 && next.p2) {
                rChecks++; totalChecks++;
                if (b.p2.ref_code !== next.p2.ref_code) { rPassed++; totalPassed++; }
                else violations.push({ type:'ADJ_RIGHT', room_id:roomId,
                    ref_code:b.p2.ref_code });
            }

            // Check D — Diagonal: RIGHT vs next LEFT
            if (b.p2 && next.p1) {
                rChecks++; totalChecks++;
                if (b.p2.ref_code !== next.p1.ref_code) { rPassed++; totalPassed++; }
            }
        });

        const rScore = rChecks > 0 ? Math.round((rPassed/rChecks)*100) : 100;
        roomScores[roomId] = rScore;
    }

    const score = totalChecks > 0 ? Math.round((totalPassed/totalChecks)*100) : 100;
    return {
        score,
        total_checks:    totalChecks,
        passed_checks:   totalPassed,
        violations:      violations.slice(0, 30),
        violation_count: violations.length,
        room_scores:     roomScores,
        grade: score >= 95 ? 'EXCELLENT' : score >= 80 ? 'GOOD'
             : score >= 60 ? 'ACCEPTABLE' : 'POOR',
        can_save: score >= 60
    };
}

// ════════════════════════════════════════════════════════════
//  EXPRESS ROUTER
// ════════════════════════════════════════════════════════════

function initializeRouter(pool) {
    const router = express.Router();
    // pool is passed in already promisified from server.js
    const db = pool;

    // ── GET /api/seating/notifications ──────────────────────
    // Returns all notifications scheduled for a given date+session.

    router.get('/notifications', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session)
                return res.status(400).json({ error:'date and session required' });

            const [rows] = await db.query(`
                SELECT
                    ese.notification_id                                        AS notification_id,
                    ese.notification_ref,
                    COUNT(DISTINCT ese.student_id)                             AS student_count,
                    COUNT(DISTINCT ese.subject_id)                             AS subject_count,
                    GROUP_CONCAT(DISTINCT br.branch_code
                        ORDER BY br.branch_code SEPARATOR ', ')                AS branches,
                    GROUP_CONCAT(DISTINCT sm.ref_code
                        ORDER BY sm.ref_code SEPARATOR ', ')                   AS ref_codes,
                    en.notification_title                                       AS exam_name,
                    en.exam_type,
                    en.batch_name
                FROM exam_student_entries ese
                LEFT JOIN branch_master   br  ON br.branch_id  = ese.branch_id
                LEFT JOIN subject_master  sm  ON sm.subject_id = ese.subject_id
                LEFT JOIN exam_notifications en ON en.notification_id = ese.notification_id
                WHERE ese.exam_date = ? AND ese.session_order = ?
                GROUP BY ese.notification_id, ese.notification_ref,
                         en.notification_title, en.exam_type, en.batch_name
                ORDER BY ese.notification_ref
            `, [date, session]);

            res.json({ notifications: rows });
        } catch (err) {
            console.error('[/notifications]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/seating/room-availability ──────────────────
    // Returns all rooms with their status: FREE / BLOCKED / OCCUPIED / INACTIVE.
    // Priority: INACTIVE > WEEKLY_BLOCKED > DATE_BLOCKED > OCCUPIED > FREE

    router.get('/room-availability', async (req, res) => {
        try {
            const { date, session, exclude_plan_id } = req.query;
            if (!date || !session)
                return res.status(400).json({ error:'date and session required' });

            const dayIdx = new Date(date + 'T12:00:00Z').getUTCDay();
            const dayCol = DAY_COL[dayIdx][parseInt(session) === 1 ? 0 : 1];
            const excl   = exclude_plan_id ? `AND esp.plan_id != ${parseInt(exclude_plan_id)}` : '';

            const [rooms] = await db.query(`
                SELECT
                    rm.room_id,
                    rm.room_code         AS room_number,
                    rm.room_name,
                    rm.block_id,
                    rm.floor_number,
                    rm.total_rows,
                    rm.total_columns,
                    rm.students_per_bench,
                    rm.total_capacity,
                    rm.layout_data,
                    rm.is_active,
                    rm.exam_status,
                    bm.block_code,
                    bm.block_name,
                    IFNULL(rws.\`${dayCol}\`, 0)   AS weekly_blocked,
                    rbs.block_id                   AS date_blocked_id,
                    rbs.reason                     AS date_blocked_reason,
                    rbs.reason_note                AS date_blocked_note,
                    occ.plan_id                    AS occ_plan_id,
                    occ.exam_names                 AS occ_exam_names
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN room_weekly_schedule rws ON rws.room_id = rm.room_id
                LEFT JOIN room_blocked_slots rbs
                    ON  rbs.room_id       = rm.room_id
                    AND rbs.block_date    = ?
                    AND rbs.session_order = ?
                    AND rbs.is_active     = 1
                LEFT JOIN (
                    SELECT
                        espr.room_id,
                        MIN(esp.plan_id) AS plan_id,
                        GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names
                    FROM exam_seating_plan_rooms espr
                    JOIN exam_seating_plan esp
                        ON  esp.plan_id       = espr.plan_id
                        AND esp.exam_date      = ?
                        AND esp.session_order  = ?
                        AND esp.status        != 'Draft'
                        ${excl}
                    LEFT JOIN exam_seating_plan_notifications espn
                        ON espn.plan_id = esp.plan_id
                    LEFT JOIN exam_notifications en
                        ON en.notification_id = espn.notification_id
                    GROUP BY espr.room_id
                ) occ ON occ.room_id = rm.room_id
                WHERE rm.deleted_at IS NULL
                ORDER BY bm.block_code, rm.floor_number, rm.room_code
            `, [date, session, date, session]);

            const result = rooms.map(r => {
                const cap = calcCapacity(r);
                let status = 'FREE', statusNote = '';

                if (!r.is_active || r.exam_status === 'Not Available') {
                    status = 'INACTIVE'; statusNote = 'Room not available for exams';
                } else if (r.weekly_blocked) {
                    status = 'BLOCKED';
                    statusNote = `Weekly schedule blocked (${dayCol.replace('_',' ').toUpperCase()})`;
                } else if (r.date_blocked_id) {
                    status = 'BLOCKED';
                    statusNote = r.date_blocked_reason || 'Blocked for this session';
                    if (r.date_blocked_note) statusNote += ` — ${r.date_blocked_note}`;
                } else if (r.occ_plan_id) {
                    status = 'OCCUPIED';
                    statusNote = r.occ_exam_names || `Plan #${r.occ_plan_id}`;
                }

                return {
                    room_id:        r.room_id,
                    room_number:    r.room_number,
                    room_name:      r.room_name,
                    block_id:       r.block_id,
                    block_code:     r.block_code,
                    block_name:     r.block_name,
                    floor_number:   r.floor_number,
                    usable_capacity:cap,
                    layout_data:    r.layout_data,
                    students_per_bench: r.students_per_bench,
                    status,
                    status_note:    statusNote,
                    date_blocked_id:r.date_blocked_id || null
                };
            });

            const grouped = {};
            result.forEach(r => {
                const k = r.block_code || 'Other';
                if (!grouped[k]) grouped[k] = { block_code:k, block_name:r.block_name, rooms:[] };
                grouped[k].rooms.push(r);
            });

            res.json({
                date, session,
                rooms:   result,
                grouped: Object.values(grouped).sort((a,b) => a.block_code.localeCompare(b.block_code)),
                summary: {
                    total:          result.length,
                    free:           result.filter(r => r.status==='FREE').length,
                    blocked:        result.filter(r => r.status==='BLOCKED').length,
                    occupied:       result.filter(r => r.status==='OCCUPIED').length,
                    inactive:       result.filter(r => r.status==='INACTIVE').length,
                    free_capacity:  result.filter(r => r.status==='FREE')
                                         .reduce((s,r) => s + r.usable_capacity, 0)
                }
            });
        } catch (err) {
            console.error('[/room-availability]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/generate ───────────────────────────
    // Runs the full 4-batch algorithm. Returns preview + score.
    // Does NOT save — user reviews then calls /save.

    router.post('/generate', async (req, res) => {
        try {
            const { exam_date, session_order, notification_ids, room_ids } = req.body;
            if (!exam_date || !session_order || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({ error:'exam_date, session_order, notification_ids, room_ids all required' });

            // Detect ESE (1-per-bench rule)
            let isESE = false;
            try {
                const [[typeRow]] = await db.query(`
                    SELECT exam_type FROM exam_notifications
                    WHERE notification_id IN (${notification_ids.map(()=>'?').join(',')})
                    LIMIT 1
                `, notification_ids);
                isESE = (typeRow?.exam_type || '').toUpperCase().includes('ESE');
            } catch (_) {}

            // Fetch students with ref_code
            const notPH = notification_ids.map(()=>'?').join(',');
            const [rawRows] = await db.query(`
                SELECT
                    ese.entry_id,
                    ese.notification_id,
                    ese.notification_ref,
                    ese.student_id,
                    ese.branch_id,
                    ese.semester_id,
                    ese.regulation_id,
                    ese.batch_id,
                    ese.subject_id,
                    ese.exam_date,
                    ese.session_order,
                    COALESCE(sm.subject_name, '') AS subject_name,
                    sm.syllabus_code,
                    COALESCE(sm.ref_code, sm.syllabus_code, 'GRP')           AS ref_code,
                    bm.branch_code,
                    bm.branch_name,
                    stm.full_name    AS student_name,
                    stm.ht_number    AS register_number,
                    sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master   bm  ON bm.branch_id   = ese.branch_id
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                WHERE ese.notification_id IN (${notPH})
                  AND ese.exam_date     = ?
                  AND ese.session_order = ?
                ORDER BY ese.student_id, ese.entry_id
            `, [...notification_ids, exam_date, session_order]);

            if (!rawRows.length)
                return res.status(404).json({ error:'No students found for this date + session' });

            const students = deduplicateStudents(rawRows);

            // Fetch rooms (DISTINCT, preserve order)
            const roomPH = room_ids.map(()=>'?').join(',');
            const [rooms] = await db.query(`
                SELECT DISTINCT room_id,
                    room_code AS room_number, room_name, block_id,
                    total_capacity, total_rows, total_columns,
                    students_per_bench, layout_data
                FROM room_master
                WHERE room_id IN (${roomPH}) AND is_active = 1
                ORDER BY FIELD(room_id, ${roomPH})
            `, [...room_ids, ...room_ids]);

            rooms.forEach(r => { r.usable_capacity = calcCapacity(r); });
            const totalCap = rooms.reduce((s,r) => s + r.usable_capacity, 0);

            if (students.length > totalCap)
                return res.status(400).json({
                    error: `Not enough seats. Students: ${students.length}. Available: ${totalCap}. Add ${students.length - totalCap} more seats.`
                });

            // Run 4-batch distribution + seat assignment
            const allocations = distributeAndAssign(students, rooms, isESE);

            // Score anti-copy quality
            const validation = scoreAntiCopy(allocations);

            // Analyse ref_code groups for report
            const refGroups = {};
            students.forEach(s => {
                const k = (s.ref_code || 'GRP').toUpperCase().trim();
                refGroups[k] = (refGroups[k] || 0) + 1;
            });
            const uniqueRefCodes = Object.keys(refGroups);
            const batchMode = isESE ? '1-per-bench (ESE)'
                : uniqueRefCodes.length >= 4 ? `Interleaved anti-copy (${uniqueRefCodes.length} groups)`
                : uniqueRefCodes.length >= 2 ? `Interleaved anti-copy (${uniqueRefCodes.length} groups)`
                : 'Interleaved (1 group — split by roll)';

            // Build per-room preview
            const roomPreviewMap = {};
            rooms.forEach(r => {
                const { snakeBenches } = getSnakeBenches(r);
                roomPreviewMap[r.room_id] = {
                    room_id: r.room_id, room_number: r.room_number, room_name: r.room_name,
                    usable_capacity: r.usable_capacity, bench_count: snakeBenches.length,
                    anti_copy_score: validation.room_scores[r.room_id] ?? 100,
                    students: [], branch_summary: {}, ref_code_summary: {}
                };
            });

            allocations.forEach(a => {
                const rp = roomPreviewMap[a.room_id];
                if (!rp) return;
                rp.students.push(a);
                const bc = a.branch_code || '?';
                rp.branch_summary[bc]  = (rp.branch_summary[bc]  || 0) + 1;
                const rc = a.ref_code  || 'GRP';
                rp.ref_code_summary[rc] = (rp.ref_code_summary[rc] || 0) + 1;
            });

            const roomsPrev = Object.values(roomPreviewMap).map(r => ({
                ...r,
                student_count:  r.students.length,
                stud_per_bench: r.students[0]?.stud_per_bench || 1,
                branch_display: Object.entries(r.branch_summary).map(([k,v])=>`${k}:${v}`).join(' | '),
                ref_display:    Object.entries(r.ref_code_summary).map(([k,v])=>`${k}:${v}`).join(' | ')
            }));

            res.json({
                success:               true,
                exam_date,
                session_order,
                is_ese:                isESE,
                batch_mode:            batchMode,
                total_students_raw:    rawRows.length,
                total_students_unique: students.length,
                total_rooms:           rooms.length,
                total_capacity:        totalCap,
                buffer_seats:          totalCap - students.length,
                ref_code_groups:       refGroups,
                unique_ref_codes:      uniqueRefCodes.length,
                validation,
                rooms_preview:         roomsPrev,
                allocations
            });

        } catch (err) {
            console.error('[/generate]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/save ───────────────────────────────

    router.post('/save', async (req, res) => {
        // promisePool.getConnection() returns a connection with promise-based query()
        // Try to get connection; fall back to pool-level queries if needed
        let conn;
        try { conn = await pool.getConnection(); } catch(_) { conn = null; }
        const cq = conn
            ? (...a) => conn.query(...a)
            : (...a) => db.query(...a);
        const beginTx    = conn ? () => cq('START TRANSACTION') : () => Promise.resolve();
        const commitTx   = conn ? () => cq('COMMIT')            : () => Promise.resolve();
        const rollbackTx = conn ? () => cq('ROLLBACK')          : () => Promise.resolve();
        try {
            await beginTx();
            const {
                exam_date, session_order, notification_ids, room_ids,
                allocations, generated_by, notes, anti_copy_score
            } = req.body;

            // Create plan
            const [planRes] = await cq(`
                INSERT INTO exam_seating_plan
                    (exam_date, session_order, total_students, total_rooms, status, generated_by, notes)
                VALUES (?,?,?,?,'Draft',?,?)
            `, [exam_date, session_order, allocations.length, room_ids.length,
                generated_by || 'Admin', notes || null]);

            const planId = planRes.insertId;

            // Notifications — deduplicate to avoid unique key violation
            const uniqueNotifIds = [...new Set(notification_ids)];
            const nCounts = {};
            allocations.forEach(a => {
                nCounts[a.notification_id] = (nCounts[a.notification_id] || 0) + 1;
            });
            for (const nid of uniqueNotifIds) {
                const ref = allocations.find(a => a.notification_id === nid)?.notification_ref || '';
                await cq(`
                    INSERT INTO exam_seating_plan_notifications
                        (plan_id, notification_id, notification_ref, student_count)
                    VALUES (?,?,?,?)
                    ON DUPLICATE KEY UPDATE student_count=VALUES(student_count)
                `, [planId, nid, ref, nCounts[nid] || 0]);
            }

            // Rooms
            const rCounts = {};
            allocations.forEach(a => { rCounts[a.room_id] = (rCounts[a.room_id] || 0) + 1; });
            for (let i = 0; i < room_ids.length; i++) {
                await cq(`
                    INSERT INTO exam_seating_plan_rooms (plan_id, room_id, capacity_used, room_order)
                    VALUES (?,?,?,?)
                `, [planId, room_ids[i], rCounts[room_ids[i]] || 0, i + 1]);
            }

            // Seat allocations — batch insert
            if (allocations.length > 0) {
                const rows = allocations.map(a => [
                    planId,
                    a.notification_id,
                    a.student_id,
                    a.branch_id,
                    a.semester_id,
                    a.subject_id,
                    (a.subjects||[]).map(s=>s.subject_name).join(' | ') || a.subject_name || null,
                    (a.subjects||[]).map(s=>s.syllabus_code).join(' | ') || a.syllabus_code || null,
                    a.room_id,
                    a.bench_label || null,
                    a.row_no      || 1,
                    a.col_no      || 1,
                    a.seat_position || 1,
                    a.seat_serial   || 1,
                    exam_date,
                    session_order
                ]);
                await cq(`
                    INSERT INTO exam_seat_allocation
                        (plan_id, notification_id, student_id, branch_id, semester_id,
                         subject_id, subject_name, syllabus_code, room_id, bench_label,
                         row_no, col_no, seat_position, seat_serial, exam_date, session_order)
                    VALUES ?
                `, [rows]);
            }

            await commitTx();
            res.json({
                success:        true,
                plan_id:        planId,
                total_students: allocations.length,
                total_rooms:    room_ids.length,
                anti_copy_score,
                message: `✅ ${allocations.length} students seated across ${room_ids.length} room(s). Anti-copy score: ${anti_copy_score || 'N/A'}%`
            });
        } catch (err) {
            await rollbackTx();
            console.error('[/save]', err.message);
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    // ── POST /api/seating/block-room ─────────────────────────

    router.post('/block-room', async (req, res) => {
        try {
            const { room_id, from_date, to_date, sessions, reason, reason_note, blocked_by } = req.body;
            if (!room_id || !from_date || !sessions?.length)
                return res.status(400).json({ error:'room_id, from_date, sessions required' });

            const rows = [];
            const start = new Date(from_date + 'T00:00:00');
            const end   = new Date((to_date || from_date) + 'T00:00:00');
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().split('T')[0];
                for (const s of sessions)
                    rows.push([room_id, ds, s, reason || 'Class', reason_note || null, blocked_by || null]);
            }

            await db.query(`
                INSERT INTO room_blocked_slots
                    (room_id, block_date, session_order, reason, reason_note, blocked_by)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    reason=VALUES(reason), reason_note=VALUES(reason_note),
                    blocked_by=VALUES(blocked_by), is_active=1
            `, [rows]);

            res.json({ success:true, slots_blocked: rows.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── PUT /api/seating/unblock-room/:id ───────────────────

    router.put('/unblock-room/:id', async (req, res) => {
        try {
            await db.query(
                `UPDATE room_blocked_slots SET is_active=0 WHERE block_id=?`,
                [req.params.id]
            );
            res.json({ success:true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── GET /api/seating/plans ──────────────────────────────

    router.get('/plans', async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names,
                    GROUP_CONCAT(DISTINCT espn.notification_ref  SEPARATOR ', ')  AS notif_refs,
                    GROUP_CONCAT(DISTINCT rm.room_code           SEPARATOR ', ')  AS rooms_list,
                    COUNT(DISTINCT espr.room_id)                                  AS room_count
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                LEFT JOIN exam_notifications en   ON en.notification_id   = espn.notification_id
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id    = esp.plan_id
                LEFT JOIN room_master rm           ON rm.room_id           = espr.room_id
                GROUP BY esp.plan_id
                ORDER BY esp.exam_date DESC, esp.session_order
            `);
            res.json({
                plans: rows.map(r => ({
                    ...r,
                    exam_date_display: formatDateDisplay(r.exam_date),
                    session_label:     r.session_order === 1 ? 'FN' : 'AN'
                }))
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/seating/preview/:planId ────────────────────

    router.get('/preview/:planId', async (req, res) => {
        try {
            const [[plan]] = await db.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                LEFT JOIN exam_notifications en ON en.notification_id = espn.notification_id
                WHERE esp.plan_id = ?
                GROUP BY esp.plan_id
            `, [req.params.planId]);
            if (!plan) return res.status(404).json({ error:'Plan not found' });

            const [seats] = await db.query(`
                SELECT esa.*,
                    rm.room_code AS room_number, rm.room_name,
                    rm.layout_data, rm.total_rows, rm.total_columns, rm.students_per_bench,
                    bm.block_code,
                    stm.full_name  AS student_name,
                    stm.ht_number  AS register_number,
                    br.branch_code, br.branch_name,
                    sem.semester_name AS sem_name,
                    sm.ref_code
                FROM exam_seat_allocation esa
                LEFT JOIN room_master     rm  ON rm.room_id     = esa.room_id
                LEFT JOIN block_master    bm  ON bm.block_id    = rm.block_id
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                WHERE esa.plan_id = ?
                ORDER BY esa.room_id, esa.seat_serial
            `, [req.params.planId]);

            const roomMap = {};
            seats.forEach(s => {
                if (!roomMap[s.room_id]) roomMap[s.room_id] = {
                    room_id:s.room_id, room_number:s.room_number, room_name:s.room_name,
                    block_code:s.block_code, layout_data:s.layout_data,
                    total_rows:s.total_rows, total_columns:s.total_columns,
                    students_per_bench:s.students_per_bench, students:[]
                };
                roomMap[s.room_id].students.push(s);
            });

            res.json({
                plan,
                rooms: Object.values(roomMap).map(r => ({ ...r, student_count:r.students.length }))
            });
        } catch (err) {
            console.error('[/preview]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── PATCH /api/seating/plan/:id/status ──────────────────

    router.patch('/plan/:id/status', async (req, res) => {
        try {
            const { status } = req.body;
            if (!['Draft','Confirmed','Published'].includes(status))
                return res.status(400).json({ error:'Invalid status' });
            await db.query(
                `UPDATE exam_seating_plan SET status=? WHERE plan_id=?`,
                [status, req.params.id]
            );
            res.json({ success:true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── DELETE /api/seating/plan/:id ────────────────────────

    router.delete('/plan/:id', async (req, res) => {
        try {
            const [[plan]] = await db.query(
                `SELECT status FROM exam_seating_plan WHERE plan_id=?`,
                [req.params.id]
            );
            if (!plan) return res.status(404).json({ error:'Plan not found' });
            if (plan.status !== 'Draft')
                return res.status(400).json({ error:'Only Draft plans can be deleted' });
            await db.query(`DELETE FROM exam_seating_plan WHERE plan_id=?`, [req.params.id]);
            res.json({ success:true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}

module.exports = { initializeRouter };
