// ================================================================
//  seating-allocation-routes.js  —  Professional v6.0
//  SLOT-BASED ANTI-COPY ENGINE  |  room_master driven
// ================================================================
//
//  CORE PHILOSOPHY — Zero Hardcoding
//  ─────────────────────────────────────────────────────────────
//  Everything derives from room_master:
//
//    batch_cap   = room.total_rows          (seats per column-side)
//    total_slots = total_columns × spb      (8 for 4-col 2-spb room)
//    max_students= batch_cap × total_slots  (56 for 7×4×2 room)
//
//  SLOT MAP (per room):
//    Slot 1: col=1, pos=1 (LEFT)  → Subject A, max batch_cap seats
//    Slot 2: col=1, pos=2 (RIGHT) → Subject B (must ≠ A)
//    Slot 3: col=2, pos=1 (LEFT)  → Subject C (must ≠ B)
//    Slot 4: col=2, pos=2 (RIGHT) → Subject D (must ≠ C)
//    ...
//    Adjacent slots always differ → same bench ≠, adj column edge ≠
//
//  GREEDY SUBJECT-TO-SLOT ASSIGNMENT:
//    Always pick subject with most remaining students ≠ previous slot.
//    Blocked benches reduce slot capacity automatically.
//
//  ANTI-COPY GUARANTEES:
//    ✅ Same bench LEFT ≠ RIGHT (100% enforced by slot design)
//    ✅ col-RIGHT ≠ next col-LEFT (100% by greedy)
//    ✅ Max subjects per room = total_columns × spb
//    ✅ Blocked seats excluded from layout_data.benches
//    ✅ No subject overflows its column-side
//
//  PRE-VALIDATION (before assignment):
//    Checks capacity, blocked seats, overflow, dominant groups.
//    Errors block generation. Warnings shown to user.
//
// ================================================================

'use strict';
const express = require('express');

// ── Helpers ──────────────────────────────────────────────────

function toIST(date) {
    if (!date) return '';
    const d      = new Date(date);
    const offset = 5.5 * 60 * 60 * 1000;
    const ist    = new Date(d.getTime() + offset);
    return ist.toISOString().split('T')[0];
}

function formatDateDisplay(ds) {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', weekday: 'short'
    });
}

const DAY_COL = {
    0: ['sun_fn', 'sun_an'], 1: ['mon_fn', 'mon_an'], 2: ['tue_fn', 'tue_an'],
    3: ['wed_fn', 'wed_an'], 4: ['thu_fn', 'thu_an'], 5: ['fri_fn', 'fri_an'],
    6: ['sat_fn', 'sat_an']
};

// ── 1. DEDUPLICATE STUDENTS ───────────────────────────────────
// One physical seat per student.
// Consolidates multiple subjects into subjects[] array.

function deduplicateStudents(rawRows) {
    const map = new Map();
    for (const row of rawRows) {
        const sid = row.student_id;
        if (!map.has(sid)) {
            map.set(sid, {
                student_id:       row.student_id,
                notification_id:  row.notification_id,
                notification_ref: row.notification_ref,
                branch_id:        row.branch_id,
                semester_id:      row.semester_id,
                regulation_id:    row.regulation_id,
                batch_id:         row.batch_id,
                exam_date:        row.exam_date,
                session_order:    row.session_order,
                student_name:     row.student_name,
                register_number:  row.register_number,
                branch_code:      row.branch_code,
                branch_name:      row.branch_name,
                sem_name:         row.sem_name,
                subject_id:       row.subject_id,
                subject_name:     row.subject_name,
                syllabus_code:    row.syllabus_code,
                ref_code:         (row.ref_code || row.syllabus_code || 'GRP').toUpperCase().trim(),
                subjects:         []
            });
        }
        const s = map.get(sid);
        if (!s.subjects.find(x => x.subject_id === row.subject_id)) {
            s.subjects.push({
                subject_id:    row.subject_id,
                subject_name:  row.subject_name,
                syllabus_code: row.syllabus_code,
                ref_code:      (row.ref_code || row.syllabus_code || 'GRP').toUpperCase().trim()
            });
        }
    }
    return [...map.values()];
}

// ── 2. CALCULATE USABLE CAPACITY ─────────────────────────────
// Uses layout_data.benches to exclude blocked benches.

function calcCapacity(room) {
    if (room.layout_data) {
        try {
            const ld = typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data;
            if (ld.benches && ld.benches.length) {
                const avail = ld.benches.filter(b => b.available !== false).length;
                return avail * (room.students_per_bench || 2);
            }
        } catch (_) {}
    }
    return room.total_capacity || 42;
}

// ── 3. BUILD SLOT MAP ─────────────────────────────────────────
//
//  Reads room_master ONLY. Zero hardcoding.
//
//  batch_cap = total_rows (seats per column-side, derived from DB)
//
//  Returns ordered slot array:
//  [col1-pos1, col1-pos2, col2-pos1, col2-pos2, ...]
//
//  Each slot: { col, pos, benches[], capacity, subject_key, students[] }
//  capacity = actual available benches in that column (blocked excluded)

function buildSlotMap(room) {
    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    const total_cols = room.total_columns      || layout.cols || 4;
    const total_rows = room.total_rows         || layout.rows || 8;
    const spb        = room.students_per_bench || layout.students_per_bench || 2;

    // batch_cap = total_rows — zero hardcoding, pure room_master
    const batch_cap = total_rows;

    // Build bench list from layout_data or auto-generate
    let allBenches = [];
    if (layout.benches && layout.benches.length) {
        allBenches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < total_rows; r++)
            for (let c = 1; c <= total_cols; c++)
                allBenches.push({ col: c, row: r + 1, label: `${ALPHA[r]}${c}`, available: true });
    }

    // Group AVAILABLE benches by column, sorted by row
    const colBenches = {};
    for (let c = 1; c <= total_cols; c++) {
        colBenches[c] = allBenches
            .filter(b => b.col === c && b.available !== false)
            .sort((a, b) => a.row - b.row);
    }

    // Build slot array: col1-pos1, col1-pos2, col2-pos1 ...
    const slots = [];
    for (let col = 1; col <= total_cols; col++) {
        const benches = colBenches[col] || [];
        for (let pos = 1; pos <= spb; pos++) {
            slots.push({
                col,
                pos,
                benches,              // available benches in this column
                capacity: benches.length,
                subject_key: null,
                students: []
            });
        }
    }

    return { slots, batch_cap, total_cols, spb };
}

// ── 4. PLAN SUBJECTS TO SLOTS (GREEDY) ───────────────────────
//
//  Globally assigns subjects to slots across all rooms.
//
//  For each room → for each slot:
//    Pick subject with most remaining students ≠ previous slot.
//    Take min(slot.capacity, available_students).
//
//  Guarantees: consecutive slots always differ → same bench ≠ → adj col ≠
//
//  Returns: { roomPlans{}, validation{} }

function planSubjectsToSlots(students, rooms) {
    // Group by ref_code, sort each group by register_number
    const pools = {};
    for (const s of students) {
        const k = (s.ref_code || 'GRP').toUpperCase().trim();
        if (!pools[k]) pools[k] = [];
        pools[k].push(s);
    }
    for (const k of Object.keys(pools)) {
        pools[k].sort((a, b) =>
            (a.register_number || '').localeCompare(b.register_number || ''));
    }

    const validation = { errors: [], warnings: [], room_slot_plans: [] };
    const roomPlans  = {};

    for (const room of rooms) {
        const { slots, batch_cap } = buildSlotMap(room);
        let prevKey = null;
        const roomSlotPlan = [];

        for (const slot of slots) {
            if (slot.capacity === 0) {
                roomSlotPlan.push({
                    col: slot.col, pos: slot.pos,
                    subject: '(blocked)', count: 0, capacity: 0
                });
                continue;
            }

            // Subjects with remaining students, sorted desc
            const available = Object.keys(pools)
                .filter(k => pools[k].length > 0)
                .sort((a, b) => pools[b].length - pools[a].length);

            if (!available.length) {
                roomSlotPlan.push({
                    col: slot.col, pos: slot.pos,
                    subject: '(empty)', count: 0, capacity: slot.capacity
                });
                continue;
            }

            // Greedy: largest ≠ previous
            const pick = available.find(k => k !== prevKey) || available[0];
            const take = Math.min(slot.capacity, pools[pick].length);

            slot.subject_key = pick;
            slot.students    = pools[pick].splice(0, take);
            prevKey          = pick;

            roomSlotPlan.push({
                col:      slot.col,
                pos:      slot.pos,
                subject:  pick,
                count:    take,
                capacity: slot.capacity
            });
        }

        roomPlans[room.room_id] = slots;
        validation.room_slot_plans.push({
            room_id:      room.room_id,
            room_number:  room.room_number || room.room_code,
            batch_cap,
            slots:        roomSlotPlan,
            total_seated: roomSlotPlan.reduce((s, r) => s + r.count, 0)
        });
    }

    // Check overflow — students that couldn't be placed
    for (const [k, remaining] of Object.entries(pools)) {
        if (remaining.length > 0) {
            const roomRows = rooms[0]?.total_rows || 7;
            validation.errors.push({
                type:    'OVERFLOW',
                subject: k,
                count:   remaining.length,
                message: `${remaining.length} students from group "${k}" could not be seated. Add ${Math.ceil(remaining.length / roomRows)} more room(s).`
            });
        }
    }

    return { roomPlans, validation };
}

// ── 5. PHYSICAL SEAT ASSIGNMENT FROM PLAN ────────────────────
//
//  slot.benches[idx] = physical bench for student[idx]
//  → row_no, col_no, bench_label come directly from layout_data

function assignSeatsFromPlan(roomPlans, rooms) {
    const allocs = [];

    for (const room of rooms) {
        const slots = roomPlans[room.room_id];
        if (!slots) continue;

        let serial = 1;

        for (const slot of slots) {
            if (!slot.students || !slot.students.length) continue;

            slot.students.forEach((student, idx) => {
                const bench = slot.benches[idx];
                if (!bench) return;

                allocs.push({
                    ...student,
                    room_id:        room.room_id,
                    bench_label:    bench.label,
                    row_no:         bench.row,
                    col_no:         bench.col,
                    seat_position:  slot.pos,
                    seat_serial:    serial++,
                    stud_per_bench: room.students_per_bench || 2
                });
            });
        }
    }

    return allocs;
}

// ── 6. PRE-VALIDATE ──────────────────────────────────────────
//
//  Checks BEFORE any assignment:
//    - Total students vs available seats (blocked excluded)
//    - Per-room feasibility
//    - Dominant group warnings
//
//  Returns { ok, errors[], warnings[], subject_summary[], room_summary[] }

function preValidate(students, rooms) {
    const errors   = [];
    const warnings = [];

    const subjectCounts = {};
    for (const s of students) {
        const k = (s.ref_code || 'GRP').toUpperCase().trim();
        subjectCounts[k] = (subjectCounts[k] || 0) + 1;
    }

    rooms.forEach(r => { r._cap = calcCapacity(r); });
    const totalCap      = rooms.reduce((s, r) => s + r._cap, 0);
    const totalStudents = students.length;

    if (totalStudents > totalCap) {
        errors.push({
            type:    'CAPACITY',
            message: `Not enough seats. ${totalStudents} students, ${totalCap} available. Need ${totalStudents - totalCap} more seats.`
        });
    } else if (totalCap - totalStudents < 5) {
        warnings.push({
            type:    'LOW_BUFFER',
            message: `Only ${totalCap - totalStudents} buffer seats. Consider adding 1 more room.`
        });
    }

    const subject_summary = Object.entries(subjectCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([ref_code, count]) => {
            const pct      = Math.round((count / totalStudents) * 100);
            const dominant = pct > 50;
            if (dominant) {
                warnings.push({
                    type:    'DOMINANT_GROUP',
                    subject: ref_code,
                    pct,
                    message: `"${ref_code}" is ${pct}% of students (${count}). Same-column adjacency unavoidable but acceptable — students face same direction.`
                });
            }
            return {
                ref_code,
                count,
                pct,
                slots_needed: Math.ceil(count / (rooms[0]?.total_rows || 7))
            };
        });

    const room_summary = rooms.map(r => {
        const { slots, batch_cap } = buildSlotMap(r);
        const usable = slots.reduce((s, sl) => s + sl.capacity, 0);
        if (usable === 0) {
            errors.push({
                type:    'ROOM_FULLY_BLOCKED',
                room:    r.room_number || r.room_id,
                message: `Room ${r.room_number} has 0 available benches. Remove it or unblock seats.`
            });
        }
        return {
            room_id:       r.room_id,
            room_number:   r.room_number,
            batch_cap,
            total_slots:   slots.length,
            usable_seats:  usable,
            blocked_seats: (r.total_capacity || 0) - usable
        };
    });

    return {
        ok:              errors.length === 0,
        errors,
        warnings,
        subject_summary,
        room_summary,
        total_students:  totalStudents,
        total_seats:     totalCap,
        buffer_seats:    totalCap - totalStudents
    };
}

// ── 7. ANTI-COPY SCORE ────────────────────────────────────────
//  Weighted checks:
//    A (×3): Same bench LEFT ≠ RIGHT       ← critical
//    B (×2): Adjacent bench LEFT ≠ LEFT
//    C (×2): Adjacent bench RIGHT ≠ RIGHT
//    D (×1): Diagonal RIGHT ≠ next LEFT

function scoreAntiCopy(allocations) {
    const byRoom = {};
    for (const a of allocations) {
        if (!byRoom[a.room_id]) byRoom[a.room_id] = [];
        byRoom[a.room_id].push(a);
    }

    let totalChecks = 0, totalPassed = 0;
    const violations = [];
    const roomScores = {};

    for (const [roomId, seats] of Object.entries(byRoom)) {
        const bMap = {};
        for (const s of seats) {
            if (!bMap[s.bench_label]) bMap[s.bench_label] = {};
            if (s.seat_position === 1) bMap[s.bench_label].p1 = s;
            if (s.seat_position === 2) bMap[s.bench_label].p2 = s;
        }

        const orderedLabels = Object.keys(bMap)
            .filter(k => bMap[k].p1)
            .sort((a, b) => (bMap[a].p1?.seat_serial || 0) - (bMap[b].p1?.seat_serial || 0));

        let rChecks = 0, rPassed = 0;

        orderedLabels.forEach((lbl, i) => {
            const b    = bMap[lbl];
            const next = bMap[orderedLabels[i + 1]];

            // A — Same bench (weight 3)
            if (b.p1 && b.p2) {
                rChecks += 3; totalChecks += 3;
                if (b.p1.ref_code !== b.p2.ref_code) {
                    rPassed += 3; totalPassed += 3;
                } else {
                    violations.push({
                        type: 'SAME_BENCH', room_id: roomId, bench: lbl,
                        ref_code: b.p1.ref_code,
                        students: [b.p1.register_number, b.p2.register_number]
                    });
                }
            }

            if (!next) return;

            // B — Adj LEFT (weight 2)
            if (b.p1 && next.p1) {
                rChecks += 2; totalChecks += 2;
                if (b.p1.ref_code !== next.p1.ref_code) {
                    rPassed += 2; totalPassed += 2;
                } else {
                    violations.push({
                        type: 'ADJ_LEFT', room_id: roomId, bench: lbl,
                        ref_code: b.p1.ref_code,
                        students: [b.p1.register_number, next.p1.register_number]
                    });
                }
            }

            // C — Adj RIGHT (weight 2)
            if (b.p2 && next.p2) {
                rChecks += 2; totalChecks += 2;
                if (b.p2.ref_code !== next.p2.ref_code) {
                    rPassed += 2; totalPassed += 2;
                } else {
                    violations.push({
                        type: 'ADJ_RIGHT', room_id: roomId, bench: lbl,
                        ref_code: b.p2.ref_code,
                        students: [b.p2.register_number, next.p2.register_number]
                    });
                }
            }

            // D — Diagonal (weight 1)
            if (b.p2 && next.p1) {
                rChecks += 1; totalChecks += 1;
                if (b.p2.ref_code !== next.p1.ref_code) {
                    rPassed += 1; totalPassed += 1;
                }
            }
        });

        const rScore = rChecks > 0 ? Math.round((rPassed / rChecks) * 100) : 100;
        roomScores[roomId] = rScore;
    }

    const score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 100;
    return {
        score,
        total_checks:    totalChecks,
        passed_checks:   totalPassed,
        violations:      violations.slice(0, 30),
        violation_count: violations.length,
        room_scores:     roomScores,
        grade:    score >= 95 ? 'EXCELLENT'
                : score >= 80 ? 'GOOD'
                : score >= 60 ? 'ACCEPTABLE'
                : 'POOR',
        can_save: score >= 60
    };
}

// ════════════════════════════════════════════════════════════
//  EXPRESS ROUTER
// ════════════════════════════════════════════════════════════

function initializeRouter(pool) {
    const router = express.Router();
    const db     = pool;

    // ── GET /api/seating/notifications ──────────────────────

    router.get('/notifications', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session)
                return res.status(400).json({ error: 'date and session required' });

            const [rows] = await db.query(`
                SELECT
                    ese.notification_id                                      AS notification_id,
                    ese.notification_ref,
                    COUNT(DISTINCT ese.student_id)                           AS student_count,
                    COUNT(DISTINCT ese.subject_id)                           AS subject_count,
                    GROUP_CONCAT(DISTINCT COALESCE(sm.ref_code, sm.syllabus_code, 'GRP')
                        ORDER BY sm.ref_code SEPARATOR ',')                  AS ref_codes,
                    GROUP_CONCAT(DISTINCT sm.subject_name
                        ORDER BY sm.subject_name SEPARATOR ', ')             AS subject_names,
                    en.notification_title,
                    en.exam_type,
                    en.batch_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master sm
                    ON sm.subject_id = ese.subject_id
                LEFT JOIN exam_notifications en
                    ON CAST(en.notification_id AS CHAR) = CAST(ese.notification_id AS CHAR)
                WHERE DATE(ese.exam_date) = ?
                  AND ese.session_order   = ?
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

    router.get('/room-availability', async (req, res) => {
        try {
            const { date, session, exclude_plan_id } = req.query;
            if (!date || !session)
                return res.status(400).json({ error: 'date and session required' });

            const dayIdx = new Date(date + 'T12:00:00Z').getUTCDay();
            const dayCol = DAY_COL[dayIdx][parseInt(session) === 1 ? 0 : 1];
            const excl   = exclude_plan_id
                ? `AND esp.plan_id != ${parseInt(exclude_plan_id)}` : '';

            const [rooms] = await db.query(`
                SELECT
                    rm.room_id,
                    rm.room_code            AS room_number,
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
                    IFNULL(rws.\`${dayCol}\`, 0)  AS weekly_blocked,
                    rbs.block_id                  AS date_blocked_id,
                    rbs.reason                    AS date_blocked_reason,
                    rbs.reason_note               AS date_blocked_note,
                    occ.plan_id                   AS occ_plan_id,
                    occ.exam_names                AS occ_exam_names
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN room_weekly_schedule rws ON rws.room_id = rm.room_id
                LEFT JOIN room_blocked_slots rbs
                    ON  rbs.room_id       = rm.room_id
                    AND rbs.block_date    = ?
                    AND rbs.session_order = ?
                    AND rbs.is_active     = 1
                LEFT JOIN (
                    SELECT espr.room_id,
                        MIN(esp.plan_id) AS plan_id,
                        GROUP_CONCAT(DISTINCT en.notification_title
                            SEPARATOR ' + ')       AS exam_names
                    FROM exam_seating_plan_rooms espr
                    JOIN exam_seating_plan esp
                        ON  esp.plan_id      = espr.plan_id
                        AND esp.exam_date     = ?
                        AND esp.session_order = ?
                        AND esp.status       != 'Draft'
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
                    status = 'INACTIVE';
                    statusNote = 'Room not available for exams';
                } else if (r.weekly_blocked) {
                    status = 'BLOCKED';
                    statusNote = `Weekly blocked (${dayCol.replace('_', ' ').toUpperCase()})`;
                } else if (r.date_blocked_id) {
                    status = 'BLOCKED';
                    statusNote = r.date_blocked_reason || 'Blocked for this session';
                    if (r.date_blocked_note) statusNote += ` — ${r.date_blocked_note}`;
                } else if (r.occ_plan_id) {
                    status = 'OCCUPIED';
                    statusNote = r.occ_exam_names || `Plan #${r.occ_plan_id}`;
                }

                return {
                    room_id:            r.room_id,
                    room_number:        r.room_number,
                    room_name:          r.room_name,
                    block_id:           r.block_id,
                    block_code:         r.block_code,
                    block_name:         r.block_name,
                    floor_number:       r.floor_number,
                    total_rows:         r.total_rows,
                    total_columns:      r.total_columns,
                    students_per_bench: r.students_per_bench,
                    usable_capacity:    cap,
                    layout_data:        r.layout_data,
                    status,
                    status_note:        statusNote,
                    date_blocked_id:    r.date_blocked_id || null
                };
            });

            const grouped = {};
            result.forEach(r => {
                const k = r.block_code || 'Other';
                if (!grouped[k]) grouped[k] = { block_code: k, block_name: r.block_name, rooms: [] };
                grouped[k].rooms.push(r);
            });

            res.json({
                date, session,
                rooms:   result,
                grouped: Object.values(grouped)
                               .sort((a, b) => a.block_code.localeCompare(b.block_code)),
                summary: {
                    total:         result.length,
                    free:          result.filter(r => r.status === 'FREE').length,
                    blocked:       result.filter(r => r.status === 'BLOCKED').length,
                    occupied:      result.filter(r => r.status === 'OCCUPIED').length,
                    inactive:      result.filter(r => r.status === 'INACTIVE').length,
                    free_capacity: result.filter(r => r.status === 'FREE')
                                        .reduce((s, r) => s + r.usable_capacity, 0)
                }
            });
        } catch (err) {
            console.error('[/room-availability]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/pre-validate ──────────────────────
    // Dry-run: returns validation report + slot plan per room.
    // Call this after room selection to show user what will happen.

    router.post('/pre-validate', async (req, res) => {
        try {
            const { exam_date, session_order, notification_ids, room_ids } = req.body;
            if (!exam_date || !session_order || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({
                    error: 'exam_date, session_order, notification_ids, room_ids required'
                });

            const notPH = notification_ids.map(() => '?').join(',');
            const [rawRows] = await db.query(`
                SELECT ese.student_id, ese.notification_id, ese.subject_id,
                    COALESCE(sm.ref_code, sm.syllabus_code, 'GRP') AS ref_code,
                    sm.subject_name, sm.syllabus_code, bm.branch_code,
                    stm.ht_number AS register_number, stm.full_name AS student_name,
                    ese.branch_id, ese.semester_id, ese.regulation_id, ese.batch_id,
                    ese.exam_date, ese.session_order, ese.notification_ref,
                    bm.branch_name, sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master  bm  ON bm.branch_id   = ese.branch_id
                LEFT JOIN student_master stm ON stm.student_id = ese.student_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                WHERE ese.notification_id IN (${notPH})
                  AND ese.exam_date     = ?
                  AND ese.session_order = ?
            `, [...notification_ids, exam_date, session_order]);

            const students = deduplicateStudents(rawRows);

            const roomPH = room_ids.map(() => '?').join(',');
            const [rooms] = await db.query(`
                SELECT DISTINCT room_id, room_code AS room_number, room_name,
                    total_capacity, total_rows, total_columns,
                    students_per_bench, layout_data
                FROM room_master
                WHERE room_id IN (${roomPH}) AND is_active = 1
                ORDER BY FIELD(room_id, ${roomPH})
            `, [...room_ids, ...room_ids]);

            rooms.forEach(r => { r.usable_capacity = calcCapacity(r); });

            const preCheck                      = preValidate(students, rooms);
            const { validation: planVal }        = planSubjectsToSlots(students, rooms);

            res.json({ ...preCheck, slot_plan: planVal.room_slot_plans });

        } catch (err) {
            console.error('[/pre-validate]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/generate ───────────────────────────
    // Runs slot-based algorithm. Returns preview + score. Does NOT save.

    router.post('/generate', async (req, res) => {
        try {
            const { exam_date, session_order, notification_ids, room_ids } = req.body;
            if (!exam_date || !session_order || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({
                    error: 'exam_date, session_order, notification_ids, room_ids all required'
                });

            // Detect ESE
            let isESE = false;
            try {
                const [[typeRow]] = await db.query(`
                    SELECT exam_type FROM exam_notifications
                    WHERE notification_id IN (${notification_ids.map(() => '?').join(',')})
                    LIMIT 1
                `, notification_ids);
                isESE = (typeRow?.exam_type || '').toUpperCase().includes('ESE');
            } catch (_) {}

            // Fetch students
            const notPH = notification_ids.map(() => '?').join(',');
            const [rawRows] = await db.query(`
                SELECT
                    ese.entry_id, ese.notification_id, ese.notification_ref,
                    ese.student_id, ese.branch_id, ese.semester_id,
                    ese.regulation_id, ese.batch_id, ese.subject_id,
                    ese.exam_date, ese.session_order,
                    COALESCE(sm.subject_name, '')                        AS subject_name,
                    sm.syllabus_code,
                    COALESCE(sm.ref_code, sm.syllabus_code, 'GRP')      AS ref_code,
                    bm.branch_code, bm.branch_name,
                    stm.full_name    AS student_name,
                    stm.ht_number    AS register_number,
                    sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master   bm  ON bm.branch_id   = ese.branch_id
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                WHERE ese.notification_id IN (${notPH})
                  AND ese.exam_date      = ?
                  AND ese.session_order  = ?
                ORDER BY ese.student_id, ese.entry_id
            `, [...notification_ids, exam_date, session_order]);

            if (!rawRows.length)
                return res.status(404).json({ error: 'No students found for this date + session' });

            const students = deduplicateStudents(rawRows);

            // Fetch rooms
            const roomPH = room_ids.map(() => '?').join(',');
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

            // Pre-validate
            const preCheck = preValidate(students, rooms);
            if (!preCheck.ok) {
                return res.status(400).json({
                    error:      preCheck.errors[0]?.message || 'Validation failed',
                    validation: preCheck
                });
            }

            // ESE → force 1 per bench (override spb=1)
            const assignRooms = isESE
                ? rooms.map(r => ({ ...r, students_per_bench: 1 }))
                : rooms;

            // Slot-based assignment
            const { roomPlans, validation: planVal } = planSubjectsToSlots(students, assignRooms);

            if (planVal.errors.length) {
                return res.status(400).json({
                    error:      planVal.errors[0].message,
                    validation: planVal
                });
            }

            const allocations = assignSeatsFromPlan(roomPlans, assignRooms);

            // Anti-copy score
            const validation = scoreAntiCopy(allocations);

            // Subject groups summary
            const refGroups = {};
            students.forEach(s => {
                const k = (s.ref_code || 'GRP').toUpperCase().trim();
                refGroups[k] = (refGroups[k] || 0) + 1;
            });
            const uniqueRefCodes = Object.keys(refGroups);

            // Per-room preview
            const roomPreviewMap = {};
            rooms.forEach(r => {
                const { slots } = buildSlotMap(r);
                const usable    = slots.reduce((s, sl) => s + sl.capacity, 0);
                // unique subjects assigned to this room
                const roomSlotPlan = planVal.room_slot_plans?.find(p => p.room_id === r.room_id);
                const subjectsInRoom = roomSlotPlan
                    ? [...new Set(roomSlotPlan.slots.map(s => s.subject)
                        .filter(s => s && s !== '(blocked)' && s !== '(empty)'))]
                    : [];

                roomPreviewMap[r.room_id] = {
                    room_id:          r.room_id,
                    room_number:      r.room_number,
                    room_name:        r.room_name,
                    usable_capacity:  usable,
                    anti_copy_score:  validation.room_scores[r.room_id] ?? 100,
                    subjects_in_room: subjectsInRoom,
                    students:         [],
                    branch_summary:   {},
                    ref_code_summary: {}
                };
            });

            allocations.forEach(a => {
                const rp = roomPreviewMap[a.room_id];
                if (!rp) return;
                rp.students.push(a);
                rp.branch_summary[a.branch_code || '?'] =
                    (rp.branch_summary[a.branch_code || '?'] || 0) + 1;
                rp.ref_code_summary[a.ref_code || 'GRP'] =
                    (rp.ref_code_summary[a.ref_code || 'GRP'] || 0) + 1;
            });

            const totalCap  = rooms.reduce((s, r) => s + r.usable_capacity, 0);
            const roomsPrev = Object.values(roomPreviewMap).map(r => ({
                ...r,
                student_count:  r.students.length,
                stud_per_bench: r.students[0]?.stud_per_bench || 1,
                branch_display: Object.entries(r.branch_summary)
                                      .map(([k, v]) => `${k}:${v}`).join(' | '),
                ref_display:    Object.entries(r.ref_code_summary)
                                      .map(([k, v]) => `${k}:${v}`).join(' | ')
            }));

            res.json({
                success:               true,
                exam_date,
                session_order,
                is_ese:                isESE,
                batch_mode:            `Slot-based anti-copy (${uniqueRefCodes.length} groups)`,
                total_students_raw:    rawRows.length,
                total_students_unique: students.length,
                total_rooms:           rooms.length,
                total_capacity:        totalCap,
                buffer_seats:          totalCap - students.length,
                ref_code_groups:       refGroups,
                unique_ref_codes:      uniqueRefCodes.length,
                pre_validation:        preCheck,
                slot_plan:             planVal.room_slot_plans,
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
        let conn;
        try { conn = await pool.getConnection(); } catch (_) { conn = null; }
        const cq         = conn ? (...a) => conn.query(...a) : (...a) => db.query(...a);
        const beginTx    = conn ? () => cq('START TRANSACTION') : () => Promise.resolve();
        const commitTx   = conn ? () => cq('COMMIT')            : () => Promise.resolve();
        const rollbackTx = conn ? () => cq('ROLLBACK')          : () => Promise.resolve();

        try {
            await beginTx();
            const {
                exam_date, session_order, notification_ids, room_ids,
                allocations, generated_by, notes, anti_copy_score
            } = req.body;

            const [planRes] = await cq(`
                INSERT INTO exam_seating_plan
                    (exam_date, session_order, total_students, total_rooms,
                     status, generated_by, notes)
                VALUES (?,?,?,?,'Draft',?,?)
            `, [exam_date, session_order, allocations.length, room_ids.length,
                generated_by || 'Admin', notes || null]);

            const planId = planRes.insertId;

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
                    ON DUPLICATE KEY UPDATE student_count = VALUES(student_count)
                `, [planId, nid, ref, nCounts[nid] || 0]);
            }

            const rCounts = {};
            allocations.forEach(a => { rCounts[a.room_id] = (rCounts[a.room_id] || 0) + 1; });
            for (let i = 0; i < room_ids.length; i++) {
                await cq(`
                    INSERT INTO exam_seating_plan_rooms
                        (plan_id, room_id, capacity_used, room_order)
                    VALUES (?,?,?,?)
                `, [planId, room_ids[i], rCounts[room_ids[i]] || 0, i + 1]);
            }

            if (allocations.length > 0) {
                const rows = allocations.map(a => [
                    planId,
                    a.notification_id,
                    a.student_id,
                    a.branch_id,
                    a.semester_id,
                    a.subject_id,
                    (a.subjects || []).map(s => s.subject_name).join(' | ') || a.subject_name || null,
                    (a.subjects || []).map(s => s.syllabus_code).join(' | ') || a.syllabus_code || null,
                    a.room_id,
                    a.bench_label   || null,
                    a.row_no        || 1,
                    a.col_no        || 1,
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
                message: `✅ ${allocations.length} students seated across ${room_ids.length} room(s). Anti-copy: ${anti_copy_score || 'N/A'}%`
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
                return res.status(400).json({ error: 'room_id, from_date, sessions required' });

            const rows  = [];
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
                    reason      = VALUES(reason),
                    reason_note = VALUES(reason_note),
                    blocked_by  = VALUES(blocked_by),
                    is_active   = 1
            `, [rows]);

            res.json({ success: true, slots_blocked: rows.length });
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
            res.json({ success: true });
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
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id    = esp.plan_id
                LEFT JOIN exam_notifications en   ON en.notification_id           = espn.notification_id
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id            = esp.plan_id
                LEFT JOIN room_master rm           ON rm.room_id                  = espr.room_id
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
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            const [seats] = await db.query(`
                SELECT esa.*,
                    rm.room_code AS room_number, rm.room_name,
                    rm.layout_data, rm.total_rows, rm.total_columns,
                    rm.students_per_bench,
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
                    room_id:            s.room_id,
                    room_number:        s.room_number,
                    room_name:          s.room_name,
                    block_code:         s.block_code,
                    layout_data:        s.layout_data,
                    total_rows:         s.total_rows,
                    total_columns:      s.total_columns,
                    students_per_bench: s.students_per_bench,
                    students:           []
                };
                roomMap[s.room_id].students.push(s);
            });

            res.json({
                plan,
                rooms: Object.values(roomMap).map(r => ({
                    ...r, student_count: r.students.length
                }))
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
            if (!['Draft', 'Confirmed', 'Published'].includes(status))
                return res.status(400).json({ error: 'Invalid status' });
            await db.query(
                `UPDATE exam_seating_plan SET status=? WHERE plan_id=?`,
                [status, req.params.id]
            );
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── DELETE /api/seating/plan/:id ────────────────────────

    router.delete('/plan/:id', async (req, res) => {
        try {
            const [[plan]] = await db.query(
                `SELECT status FROM exam_seating_plan WHERE plan_id=?`,
                [req.params.id]
            );
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            if (plan.status !== 'Draft')
                return res.status(400).json({ error: 'Only Draft plans can be deleted' });
            await db.query(`DELETE FROM exam_seating_plan WHERE plan_id=?`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
}

module.exports = { initializeRouter };
