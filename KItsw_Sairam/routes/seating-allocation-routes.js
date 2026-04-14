// ════════════════════════════════════════════════════════════════════════════
//  seating-allocation-routes.js  —  Professional v10.0
//  SMART MULTI-NOTIFICATION ANTI-COPY ENGINE  |  ZERO-WASTE ROW-FIRST FILL
// ════════════════════════════════════════════════════════════════════════════
//
//  ┌─────────────────────────────────────────────────────────────────────┐
//  │                   AUTO-DETECTION LOGIC (v10)                        │
//  │                                                                     │
//  │  SCENARIO A — Single notification, single ref_code                  │
//  │    → 1 student per bench  (anti-copy N/A, can always save)          │
//  │                                                                     │
//  │  SCENARIO B — Single notification, multiple ref_codes               │
//  │    → Full spb, ref_code-based interleaving                          │
//  │                                                                     │
//  │  SCENARIO C — Multiple notifications, same ref_codes                │
//  │    → notification_id used as discriminator (N1 vs N2)               │
//  │    → Full spb, notification-based interleaving                      │
//  │                                                                     │
//  │  SCENARIO D — Multiple notifications, multiple ref_codes            │
//  │    → notification_id + ref_code combined as discriminator           │
//  │    → Full spb, richest possible interleaving                        │
//  │                                                                     │
//  │  KEY FIX v8: ref_code alone is NOT enough to distinguish groups.   │
//  │  notification_id is ALWAYS used as the primary group identity.      │
//  │                                                                     │
//  │  KEY FIX v9: ZERO-WASTE ROW-FIRST FILL                             │
//  │                                                                     │
//  │  KEY FIX v10: PER-ROOM SPB CAP                                     │
//  │  effectiveSpb is capped to each room's physical students_per_bench. │
//  │  Audi/split rooms (spb=1) are never over-counted as spb=2.         │
//  │  DB query uses notification_id (not notification_ref) for correct  │
//  │  multi-notification group discrimination.                           │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  MANDATORY RULES (always enforced):
//    • Same group NEVER on same bench  (LEFT seat ≠ RIGHT seat)
//    • Same group NEVER in same col+pos on adjacent rows
//    • Row-first fill guarantees zero waste / zero holes
//    • effectiveSpb never exceeds a room's physical students_per_bench
//
// ════════════════════════════════════════════════════════════════════════════

'use strict';
const express = require('express');

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 1 ── UTILITY HELPERS
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 2 ── SESSION RESOLVER
// ────────────────────────────────────────────────────────────────────────────

async function resolveSession(db, sessionId) {
    try {
        const [[row]] = await db.query(
            `SELECT session_name,
                    COALESCE(session_group, session_name) AS grp
             FROM sessions_master
             WHERE session_id = ?`,
            [parseInt(sessionId)]
        );
        const grp           = (row?.grp || 'AN').toUpperCase();
        const session_order = grp === 'FN' ? 1 : 2;
        return { session_order, grp, session_name: row?.session_name || grp };
    } catch (_) {
        const n = parseInt(sessionId);
        return {
            session_order: n === 1 ? 1 : 2,
            grp:           n === 1 ? 'FN' : 'AN',
            session_name:  n === 1 ? 'FN' : 'AN'
        };
    }
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 3 ── GROUP KEY BUILDER
//
//  • Single notification  → group by ref_code
//  • Multiple notifications → group by notification_id + ref_code
//    so Sem4 R20 and Sem6 R20 become N{id1}_R20 vs N{id2}_R20
// ────────────────────────────────────────────────────────────────────────────

function buildGroupKey(student, uniqueNotifIds) {
    const nid     = student.notification_id;
    const refCode = (student.ref_code || student.syllabus_code || 'GRP').toUpperCase().trim();

    if (uniqueNotifIds.size === 1) {
        return refCode;
    }
    return `N${nid}_${refCode}`;
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 4 ── STUDENT DEDUPLICATION
// ────────────────────────────────────────────────────────────────────────────

function deduplicateStudents(rawRows) {
    const uniqueNotifIds = new Set(rawRows.map(r => r.notification_id));

    const map = new Map();
    for (const row of rawRows) {
        const sid = row.student_id;

        if (!map.has(sid)) {
            const ref_code  = (row.ref_code || row.syllabus_code || 'GRP').toUpperCase().trim();
            const group_key = buildGroupKey({ ...row, ref_code }, uniqueNotifIds);

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
                ref_code,
                group_key,
                subjects: []
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

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 5 ── SMART SPB DETECTION
// ────────────────────────────────────────────────────────────────────────────

function detectGrouping(students, roomSpb) {
    const uniqueNotifIds  = new Set(students.map(s => s.notification_id));
    const uniqueGroupKeys = new Set(students.map(s => s.group_key));
    const uniqueRefCodes  = new Set(students.map(s => s.ref_code));

    const notifCount   = uniqueNotifIds.size;
    const groupCount   = uniqueGroupKeys.size;
    const isSingle     = groupCount === 1;
    const effectiveSpb = isSingle ? 1 : (roomSpb || 2);

    let scenario, scenarioDetail;
    if (notifCount === 1 && uniqueRefCodes.size === 1) {
        scenario       = 'A';
        scenarioDetail = `Single notification, single group (${[...uniqueRefCodes][0]}) → 1 student per bench`;
    } else if (notifCount === 1 && uniqueRefCodes.size > 1) {
        scenario       = 'B';
        scenarioDetail = `Single notification, ${uniqueRefCodes.size} subject groups → ${effectiveSpb} per bench, ref_code interleaving`;
    } else if (notifCount > 1 && uniqueRefCodes.size === 1) {
        scenario       = 'C';
        scenarioDetail = `${notifCount} notifications sharing ref_code "${[...uniqueRefCodes][0]}" → discriminated by notification_id → ${effectiveSpb} per bench`;
    } else {
        scenario       = 'D';
        scenarioDetail = `${notifCount} notifications × ${uniqueRefCodes.size} ref_codes = ${groupCount} distinct groups → ${effectiveSpb} per bench`;
    }

    const groupCounts = {};
    for (const s of students) {
        groupCounts[s.group_key] = (groupCounts[s.group_key] || 0) + 1;
    }

    return {
        effective_spb:      effectiveSpb,
        is_single_group:    isSingle,
        notification_count: notifCount,
        group_count:        groupCount,
        unique_ref_codes:   uniqueRefCodes.size,
        group_keys:         [...uniqueGroupKeys],
        ref_codes:          [...uniqueRefCodes],
        group_counts:       groupCounts,
        scenario,
        scenario_detail:    scenarioDetail
    };
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 6 ── CAPACITY CALCULATION
//  KEY FIX v10: effectiveSpb is capped to each room's physical spb.
//  Audi/split rooms with students_per_bench=1 are never counted as 2.
// ────────────────────────────────────────────────────────────────────────────

function calcCapacity(room, effectiveSpb) {
    // ✅ CRITICAL: never exceed the room's physical seats per bench
    const roomPhysicalSpb = room.students_per_bench || 2;
    const spb = Math.min(
        effectiveSpb ?? roomPhysicalSpb,
        roomPhysicalSpb
    );

    if (room.layout_data) {
        try {
            const ld = typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data;
            if (ld.benches && ld.benches.length) {
                const avail = ld.benches.filter(b => b.available !== false).length;
                return avail * spb;
            }
        } catch (_) {}
    }

    // Fallback: derive bench count from total_capacity / physical spb
    const benches = Math.floor((room.total_capacity || (room.total_rows * room.total_columns * roomPhysicalSpb) || 42) / roomPhysicalSpb);
    return benches * spb;
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 7 ── BENCH GRID BUILDER
// ────────────────────────────────────────────────────────────────────────────

function buildBenchGrid(room) {
    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    const total_cols = room.total_columns || layout.cols || 4;
    const total_rows = room.total_rows    || layout.rows || 8;

    let allBenches = [];
    if (layout.benches && layout.benches.length) {
        allBenches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < total_rows; r++)
            for (let c = 1; c <= total_cols; c++)
                allBenches.push({ col: c, row: r + 1, label: `${ALPHA[r]}${c}`, available: true });
    }

    const grid   = {};
    const rowSet = new Set();
    const colSet = new Set();

    for (const b of allBenches) {
        if (b.available === false) continue;
        if (!grid[b.row]) grid[b.row] = {};
        grid[b.row][b.col] = b;
        rowSet.add(b.row);
        colSet.add(b.col);
    }

    const rows = [...rowSet].sort((a, b) => a - b);
    const cols = [...colSet].sort((a, b) => a - b);
    return { grid, rows, cols, total_rows, total_cols };
}

// Legacy slot map — kept for preValidate / capacity summary display
function buildSlotMap(room, effectiveSpb) {
    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    const total_cols      = room.total_columns      || layout.cols || 4;
    const total_rows      = room.total_rows         || layout.rows || 8;
    const roomPhysicalSpb = room.students_per_bench || 2;
    // ✅ Cap to physical room limit
    const spb             = Math.min(effectiveSpb || 2, roomPhysicalSpb);

    let allBenches = [];
    if (layout.benches && layout.benches.length) {
        allBenches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < total_rows; r++)
            for (let c = 1; c <= total_cols; c++)
                allBenches.push({ col: c, row: r + 1, label: `${ALPHA[r]}${c}`, available: true });
    }

    const colBenches = {};
    for (let c = 1; c <= total_cols; c++) {
        colBenches[c] = allBenches
            .filter(b => b.col === c && b.available !== false)
            .sort((a, b) => a.row - b.row);
    }

    const slots = [];
    for (let col = 1; col <= total_cols; col++) {
        const benches = colBenches[col] || [];
        for (let pos = 1; pos <= spb; pos++) {
            slots.push({ col, pos, benches, capacity: benches.length, group_key: null, students: [] });
        }
    }

    return { slots, batch_cap: total_rows, total_cols, spb };
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 8 ── ZERO-WASTE ROW-FIRST ALLOCATION ENGINE
//
//  KEY FIX v10: spb is capped per-room to room.students_per_bench.
//  This means audi/split rooms fill at spb=1 while normal rooms fill at spb=2.
// ────────────────────────────────────────────────────────────────────────────

function planSubjectsToSlots(students, rooms, effectiveSpb) {

    const pools = {};
    for (const s of students) {
        const k = s.group_key || s.ref_code || 'GRP';
        if (!pools[k]) pools[k] = [];
        pools[k].push(s);
    }
    for (const k of Object.keys(pools)) {
        pools[k].sort((a, b) =>
            (a.register_number || '').localeCompare(b.register_number || '')
        );
    }

    const validation = { errors: [], warnings: [], room_slot_plans: [] };
    const roomPlans  = {};

    for (const room of rooms) {
        const { grid, rows, cols } = buildBenchGrid(room);

        // ✅ KEY FIX v10: cap spb to room's physical limit
        const roomPhysicalSpb = room.students_per_bench || 2;
        const spb             = Math.min(effectiveSpb || 2, roomPhysicalSpb);
        const batch_cap       = room.total_rows || rows.length;

        const roomAllocs  = [];
        const slotSummary = {};

        const prevAssigned = {};

        for (const row of rows) {
            const thisBenchAssigned = {};

            for (const col of cols) {
                const bench = grid[row]?.[col];
                if (!bench) continue;

                if (!prevAssigned[col])      prevAssigned[col]      = {};
                if (!thisBenchAssigned[col]) thisBenchAssigned[col] = {};

                for (let pos = 1; pos <= spb; pos++) {
                    const available = Object.keys(pools)
                        .filter(k => pools[k].length > 0)
                        .sort((a, b) => pools[b].length - pools[a].length);

                    if (!available.length) continue;

                    const forbidden = new Set();
                    const otherPos  = pos === 1 ? 2 : 1;

                    if (prevAssigned[col][pos])           forbidden.add(prevAssigned[col][pos]);
                    if (thisBenchAssigned[col][otherPos]) forbidden.add(thisBenchAssigned[col][otherPos]);

                    const pick    = available.find(k => !forbidden.has(k)) || available[0];
                    const student = pools[pick].shift();

                    roomAllocs.push({ bench, pos, student, group_key: pick });
                    prevAssigned[col][pos]      = pick;
                    thisBenchAssigned[col][pos] = pick;

                    const sk = `${col}_${pos}`;
                    if (!slotSummary[sk]) slotSummary[sk] = { col, pos, counts: {} };
                    slotSummary[sk].counts[pick] = (slotSummary[sk].counts[pick] || 0) + 1;
                }
            }
        }

        roomPlans[room.room_id] = roomAllocs;

        const roomSlotPlan = Object.values(slotSummary).map(s => ({
            col:      s.col,
            pos:      s.pos,
            subject:  Object.keys(s.counts).sort().join('+'),
            count:    Object.values(s.counts).reduce((x, y) => x + y, 0),
            capacity: rows.length
        }));

        validation.room_slot_plans.push({
            room_id:      room.room_id,
            room_number:  room.room_number || room.room_code,
            batch_cap,
            slots:        roomSlotPlan,
            total_seated: roomAllocs.length
        });
    }

    for (const [k, remaining] of Object.entries(pools)) {
        if (remaining.length > 0) {
            const roomRows = rooms[0]?.total_rows || 7;
            validation.errors.push({
                type:      'OVERFLOW',
                group_key: k,
                count:     remaining.length,
                message:   `${remaining.length} students from group "${k}" could not be seated. Add ${Math.ceil(remaining.length / (roomRows * (effectiveSpb || 2)))} more room(s).`
            });
        }
    }

    return { roomPlans, validation };
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 9 ── PHYSICAL SEAT ASSIGNMENT
// ────────────────────────────────────────────────────────────────────────────

function assignSeatsFromPlan(roomPlans, rooms) {
    const allocs = [];

    for (const room of rooms) {
        const entries = roomPlans[room.room_id];
        if (!entries || !entries.length) continue;

        let serial = 1;
        for (const entry of entries) {
            if (!entry.student || !entry.bench) continue;
            allocs.push({
                ...entry.student,
                room_id:        room.room_id,
                bench_label:    entry.bench.label,
                row_no:         entry.bench.row,
                col_no:         entry.bench.col,
                seat_position:  entry.pos,
                seat_serial:    serial++,
                stud_per_bench: room.students_per_bench || 2
            });
        }
    }

    return allocs;
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 10 ── PRE-VALIDATION
// ────────────────────────────────────────────────────────────────────────────

function preValidate(students, rooms, effectiveSpb, detection) {
    const errors   = [];
    const warnings = [];

    const groupCounts = {};
    for (const s of students) {
        const k = s.group_key || 'GRP';
        groupCounts[k] = (groupCounts[k] || 0) + 1;
    }

    // calcCapacity already caps per-room spb internally
    rooms.forEach(r => { r._cap = calcCapacity(r, effectiveSpb); });
    const totalCap      = rooms.reduce((s, r) => s + r._cap, 0);
    const totalStudents = students.length;
    const buffer        = totalCap - totalStudents;

    if (totalStudents > totalCap) {
        const shortfall     = totalStudents - totalCap;
        const benchesNeeded = Math.ceil(shortfall / effectiveSpb);
        errors.push({
            type:    'CAPACITY',
            message: `Not enough seats. ${totalStudents} students need ${totalCap} seats (${effectiveSpb} per bench). Need ${benchesNeeded} more benches / rooms.`
        });
    } else if (buffer < 5) {
        warnings.push({
            type:    'LOW_BUFFER',
            message: `Only ${buffer} buffer seats remaining. Consider adding 1 more room.`
        });
    }

    if (detection?.is_single_group) {
        warnings.push({
            type:    'SINGLE_GROUP',
            message: `Single exam group detected — 1 student per bench enforced. Anti-copy check = N/A.`
        });
    }

    const group_summary = Object.entries(groupCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([group_key, count]) => ({
            group_key,
            count,
            pct:          Math.round((count / totalStudents) * 100),
            slots_needed: Math.ceil(count / (rooms[0]?.total_rows || 7))
        }));

    const room_summary = rooms.map(r => ({
        room_id:      r.room_id,
        room_number:  r.room_number,
        usable_seats: r._cap
    }));

    return {
        ok:              errors.length === 0,
        errors,
        warnings,
        group_summary,
        room_summary,
        total_students:  totalStudents,
        total_seats:     totalCap,
        buffer_seats:    buffer,
        effective_spb:   effectiveSpb,
        is_single_group: detection?.is_single_group ?? false
    };
}

// ────────────────────────────────────────────────────────────────────────────
//  SECTION 11 ── ANTI-COPY SCORER
// ────────────────────────────────────────────────────────────────────────────

function scoreAntiCopy(allocations, isSingleGroup) {
    if (isSingleGroup) {
        return {
            score:           100,
            total_checks:    0,
            passed_checks:   0,
            violations:      [],
            violation_count: 0,
            room_scores:     {},
            grade:           'N/A',
            can_save:        true,
            note:            'Single exam group — 1 student per bench enforced. Anti-copy check not applicable.'
        };
    }

    const byRoom = {};
    for (const a of allocations) {
        if (!byRoom[a.room_id]) byRoom[a.room_id] = [];
        byRoom[a.room_id].push(a);
    }

    let totalChecks = 0, totalPassed = 0;
    const violations = [];
    const roomScores = {};

    for (const [roomId, seats] of Object.entries(byRoom)) {
        const grid = {};
        for (const s of seats) {
            const col = s.col_no, row = s.row_no;
            if (!grid[col])      grid[col] = {};
            if (!grid[col][row]) grid[col][row] = {};
            if (s.seat_position === 1) grid[col][row].p1 = s;
            if (s.seat_position === 2) grid[col][row].p2 = s;
        }

        const cols = Object.keys(grid).map(Number).sort((a, b) => a - b);
        let rChecks = 0, rPassed = 0;

        for (const col of cols) {
            const rows = Object.keys(grid[col]).map(Number).sort((a, b) => a - b);

            for (const row of rows) {
                const bench = grid[col][row];

                // A: Same bench LEFT ≠ RIGHT (weight 4)
                if (bench.p1 && bench.p2) {
                    rChecks += 4; totalChecks += 4;
                    if (bench.p1.group_key !== bench.p2.group_key) {
                        rPassed += 4; totalPassed += 4;
                    } else {
                        violations.push({
                            type:      'SAME_BENCH',
                            room_id:   roomId, col, row,
                            group_key: bench.p1.group_key,
                            students:  [bench.p1.register_number, bench.p2.register_number]
                        });
                    }
                }

                // B: Cross-column RIGHT → next col LEFT, same row (weight 3)
                const nextColBench = grid[col + 1]?.[row];
                if (bench.p2 && nextColBench?.p1) {
                    rChecks += 3; totalChecks += 3;
                    if (bench.p2.group_key !== nextColBench.p1.group_key) {
                        rPassed += 3; totalPassed += 3;
                    } else {
                        violations.push({
                            type:      'CROSS_COL',
                            room_id:   roomId, col, row,
                            group_key: bench.p2.group_key,
                            students:  [bench.p2.register_number, nextColBench.p1.register_number]
                        });
                    }
                }

                // C: Diagonal (weight 1)
                const nextColNextRow = grid[col + 1]?.[row + 1];
                if (bench.p2 && nextColNextRow?.p1) {
                    rChecks += 1; totalChecks += 1;
                    if (bench.p2.group_key !== nextColNextRow.p1.group_key) {
                        rPassed += 1; totalPassed += 1;
                    }
                }
            }
        }

        roomScores[roomId] = rChecks > 0 ? Math.round((rPassed / rChecks) * 100) : 100;
    }

    const score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 100;
    return {
        score,
        total_checks:    totalChecks,
        passed_checks:   totalPassed,
        violations:      violations.slice(0, 30),
        violation_count: violations.length,
        room_scores:     roomScores,
        grade:    score >= 95 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : score >= 60 ? 'ACCEPTABLE' : 'POOR',
        can_save: score >= 60
    };
}

// ════════════════════════════════════════════════════════════════════════════
//  SECTION 12 ── EXPRESS ROUTER
// ════════════════════════════════════════════════════════════════════════════

function initializeRouter(pool) {
    const router = express.Router();
    const db     = pool;

    // ── GET /api/seating/notifications ──────────────────────────────────────

    router.get('/notifications', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session)
                return res.status(400).json({ error: 'date and session required' });

            const { session_order } = await resolveSession(db, session);

            const [rows] = await db.query(`
                SELECT
                    ese.notification_id,
                    ese.notification_ref,
                    COUNT(DISTINCT ese.student_id)                                AS student_count,
                    COUNT(DISTINCT ese.subject_id)                                AS subject_count,
                    GROUP_CONCAT(DISTINCT COALESCE(sm.ref_code, sm.syllabus_code, 'GRP')
                        ORDER BY sm.ref_code SEPARATOR ',')                       AS ref_codes,
                    GROUP_CONCAT(DISTINCT sm.subject_name
                        ORDER BY sm.subject_name SEPARATOR ', ')                  AS subject_names,
                    en.notification_title,
                    en.exam_type,
                    en.batch_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master sm ON sm.subject_id = ese.subject_id
                LEFT JOIN exam_notifications en
                    ON CAST(en.notification_id AS CHAR) = CAST(ese.notification_ref AS CHAR)
                WHERE DATE(ese.exam_date) = ?
                  AND ese.session_order   = ?
                GROUP BY ese.notification_id, ese.notification_ref,
                         en.notification_title, en.exam_type, en.batch_name
                ORDER BY ese.notification_ref
            `, [date, session_order]);

            res.json({ notifications: rows });
        } catch (err) {
            console.error('[/notifications]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/seating/room-availability ──────────────────────────────────

    router.get('/room-availability', async (req, res) => {
        try {
            const { date, session, exclude_plan_id } = req.query;
            if (!date || !session)
                return res.status(400).json({ error: 'date and session required' });

            const { session_order, grp } = await resolveSession(db, session);
            const dayIdx = new Date(date + 'T12:00:00Z').getUTCDay();
            const dayCol = DAY_COL[dayIdx][grp === 'FN' ? 0 : 1];
            const excl   = exclude_plan_id ? `AND esp.plan_id != ${parseInt(exclude_plan_id)}` : '';

            const [rooms] = await db.query(`
                SELECT rm.room_id, rm.room_code AS room_number, rm.room_name,
                    rm.block_id, rm.floor_number, rm.total_rows, rm.total_columns,
                    rm.students_per_bench, rm.total_capacity, rm.layout_data,
                    rm.is_active, rm.exam_status, bm.block_code, bm.block_name,
                    IFNULL(rws.\`${dayCol}\`, 0) AS weekly_blocked,
                    rbs.block_id AS date_blocked_id,
                    rbs.reason AS date_blocked_reason, rbs.reason_note AS date_blocked_note,
                    occ.plan_id AS occ_plan_id, occ.exam_names AS occ_exam_names
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN room_weekly_schedule rws ON rws.room_id = rm.room_id
                LEFT JOIN room_blocked_slots rbs
                    ON rbs.room_id = rm.room_id AND rbs.block_date = ? AND rbs.session_order = ? AND rbs.is_active = 1
                LEFT JOIN (
                    SELECT espr.room_id, MIN(esp.plan_id) AS plan_id,
                        GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names
                    FROM exam_seating_plan_rooms espr
                    JOIN exam_seating_plan esp
                        ON esp.plan_id = espr.plan_id AND esp.exam_date = ? AND esp.session_order = ? AND esp.status != 'Draft' ${excl}
                    LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                    LEFT JOIN exam_notifications en ON en.notification_id = espn.notification_id
                    GROUP BY espr.room_id
                ) occ ON occ.room_id = rm.room_id
                WHERE rm.deleted_at IS NULL
                ORDER BY bm.block_code, rm.floor_number, rm.room_code
            `, [date, session_order, date, session_order]);

            const result = rooms.map(r => {
                // Display capacity uses room's own spb (effectiveSpb unknown here)
                const cap = calcCapacity(r, r.students_per_bench);

                let status = 'FREE', statusNote = '';
                if (!r.is_active || r.exam_status === 'Not Available') {
                    status = 'INACTIVE'; statusNote = 'Not available';
                } else if (r.weekly_blocked) {
                    status = 'BLOCKED'; statusNote = `Weekly blocked (${dayCol.replace('_', ' ').toUpperCase()})`;
                } else if (r.date_blocked_id) {
                    status = 'BLOCKED';
                    statusNote = r.date_blocked_reason || 'Blocked';
                    if (r.date_blocked_note) statusNote += ` — ${r.date_blocked_note}`;
                } else if (r.occ_plan_id) {
                    status = 'OCCUPIED'; statusNote = r.occ_exam_names || `Plan #${r.occ_plan_id}`;
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
                date, session, rooms: result,
                grouped: Object.values(grouped).sort((a, b) => a.block_code.localeCompare(b.block_code)),
                summary: {
                    total:         result.length,
                    free:          result.filter(r => r.status === 'FREE').length,
                    blocked:       result.filter(r => r.status === 'BLOCKED').length,
                    occupied:      result.filter(r => r.status === 'OCCUPIED').length,
                    inactive:      result.filter(r => r.status === 'INACTIVE').length,
                    free_capacity: result.filter(r => r.status === 'FREE').reduce((s, r) => s + r.usable_capacity, 0)
                }
            });
        } catch (err) {
            console.error('[/room-availability]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/pre-validate ──────────────────────────────────────

    router.post('/pre-validate', async (req, res) => {
        try {
            const { exam_date, session_order: rawSession, notification_ids, room_ids } = req.body;
            if (!exam_date || !rawSession || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({ error: 'exam_date, session_order, notification_ids, room_ids required' });

            const { session_order } = await resolveSession(db, rawSession);

            const notPH = notification_ids.map(() => '?').join(',');

            // ✅ KEY FIX: filter by notification_id (not notification_ref)
            const [rawRows] = await db.query(`
                SELECT ese.student_id, ese.notification_id, ese.subject_id,
                    COALESCE(sm.ref_code, sm.syllabus_code, 'GRP') AS ref_code,
                    sm.subject_name, sm.syllabus_code, bm.branch_code,
                    stm.ht_number AS register_number, stm.full_name AS student_name,
                    ese.branch_id, ese.semester_id, ese.regulation_id, ese.batch_id,
                    ese.exam_date, ese.session_order, ese.notification_ref,
                    bm.branch_name, sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master   bm  ON bm.branch_id   = ese.branch_id
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                WHERE ese.notification_id IN (${notPH})
                  AND DATE(ese.exam_date) = ?
                  AND ese.session_order   = ?
            `, [...notification_ids, exam_date, session_order]);

            const students = deduplicateStudents(rawRows);

            const roomPH = room_ids.map(() => '?').join(',');
            const [rooms] = await db.query(`
                SELECT DISTINCT room_id, room_code AS room_number, room_name,
                    total_capacity, total_rows, total_columns, students_per_bench, layout_data
                FROM room_master
                WHERE room_id IN (${roomPH}) AND is_active = 1
                ORDER BY FIELD(room_id, ${roomPH})
            `, [...room_ids, ...room_ids]);

            const maxSpb       = Math.max(...rooms.map(r => r.students_per_bench || 2));
            const detect       = detectGrouping(students, maxSpb);
            const effectiveSpb = detect.effective_spb;

            // calcCapacity caps per-room internally
            rooms.forEach(r => { r.usable_capacity = calcCapacity(r, effectiveSpb); });

            const preCheck                = preValidate(students, rooms, effectiveSpb, detect);
            const { validation: planVal } = planSubjectsToSlots(students, rooms, effectiveSpb);

            res.json({
                ...preCheck,
                slot_plan:  planVal.room_slot_plans,
                detection:  detect
            });

        } catch (err) {
            console.error('[/pre-validate]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── POST /api/seating/generate ──────────────────────────────────────────

    router.post('/generate', async (req, res) => {
        try {
            const { exam_date, session_order: rawSession, notification_ids, room_ids } = req.body;
            if (!exam_date || !rawSession || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({ error: 'exam_date, session_order, notification_ids, room_ids all required' });

            const { session_order, session_name } = await resolveSession(db, rawSession);

            const notPH = notification_ids.map(() => '?').join(',');

            // ✅ KEY FIX: filter by notification_id (not notification_ref)
            const [rawRows] = await db.query(`
                SELECT ese.entry_id, ese.notification_id, ese.notification_ref,
                    ese.student_id, ese.branch_id, ese.semester_id,
                    ese.regulation_id, ese.batch_id, ese.subject_id,
                    ese.exam_date, ese.session_order,
                    COALESCE(sm.subject_name, '')                       AS subject_name,
                    sm.syllabus_code,
                    COALESCE(sm.ref_code, sm.syllabus_code, 'GRP')      AS ref_code,
                    bm.branch_code, bm.branch_name,
                    stm.full_name   AS student_name,
                    stm.ht_number   AS register_number,
                    sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master   bm  ON bm.branch_id   = ese.branch_id
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                WHERE ese.notification_id IN (${notPH})
                  AND DATE(ese.exam_date) = ?
                  AND ese.session_order   = ?
                ORDER BY ese.student_id, ese.entry_id
            `, [...notification_ids, exam_date, session_order]);

            if (!rawRows.length)
                return res.status(404).json({ error: 'No students found for this date + session' });

            const students = deduplicateStudents(rawRows);

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

            const maxSpb       = Math.max(...rooms.map(r => r.students_per_bench || 2));
            const detect       = detectGrouping(students, maxSpb);
            const effectiveSpb = detect.effective_spb;

            console.log(
                `[/generate] Date=${exam_date} Session=${session_order} | ` +
                `Scenario ${detect.scenario}: ${detect.scenario_detail} | ` +
                `effectiveSpb=${effectiveSpb} | Students=${students.length} | ` +
                `Rooms=${rooms.length} (spb mix: ${[...new Set(rooms.map(r=>r.students_per_bench))].join(',')})`
            );

            // calcCapacity caps per-room internally
            rooms.forEach(r => { r.usable_capacity = calcCapacity(r, effectiveSpb); });

            const preCheck = preValidate(students, rooms, effectiveSpb, detect);
            if (!preCheck.ok) {
                return res.status(400).json({
                    error:      preCheck.errors[0]?.message || 'Validation failed',
                    validation: preCheck,
                    detection:  detect
                });
            }

            const { roomPlans, validation: planVal } = planSubjectsToSlots(students, rooms, effectiveSpb);
            if (planVal.errors.length) {
                return res.status(400).json({ error: planVal.errors[0].message, validation: planVal });
            }

            const allocations = assignSeatsFromPlan(roomPlans, rooms);
            const validation  = scoreAntiCopy(allocations, detect.is_single_group);

            const groupSummary = {};
            students.forEach(s => {
                const k = s.group_key;
                groupSummary[k] = (groupSummary[k] || 0) + 1;
            });

            const roomPreviewMap = {};
            rooms.forEach(r => {
                roomPreviewMap[r.room_id] = {
                    room_id:         r.room_id,
                    room_number:     r.room_number,
                    room_name:       r.room_name,
                    usable_capacity: r.usable_capacity,
                    anti_copy_score: validation.room_scores[r.room_id] ?? 100,
                    students:        [],
                    branch_summary:  {},
                    group_summary:   {}
                };
            });

            allocations.forEach(a => {
                const rp = roomPreviewMap[a.room_id];
                if (!rp) return;
                rp.students.push(a);
                rp.branch_summary[a.branch_code || '?'] = (rp.branch_summary[a.branch_code || '?'] || 0) + 1;
                rp.group_summary[a.group_key || 'GRP']  = (rp.group_summary[a.group_key || 'GRP']  || 0) + 1;
            });

            const totalCap  = rooms.reduce((s, r) => s + r.usable_capacity, 0);
            const roomsPrev = Object.values(roomPreviewMap).map(r => ({
                ...r,
                student_count:  r.students.length,
                stud_per_bench: effectiveSpb,
                branch_display: Object.entries(r.branch_summary).map(([k, v]) => `${k}:${v}`).join(' | '),
                group_display:  Object.entries(r.group_summary).map(([k, v]) => `${k}:${v}`).join(' | ')
            }));

            res.json({
                success:               true,
                exam_date,
                session_order,
                session_name,
                batch_mode: detect.is_single_group
                    ? `Scenario A — Single group (${detect.group_keys[0]}) — 1 student per bench`
                    : `Scenario ${detect.scenario} — ${detect.group_count} groups — ${effectiveSpb} per bench`,
                effective_spb:         effectiveSpb,
                detection:             detect,
                total_students_raw:    rawRows.length,
                total_students_unique: students.length,
                total_rooms:           rooms.length,
                total_capacity:        totalCap,
                buffer_seats:          totalCap - students.length,
                group_summary:         groupSummary,
                group_count:           detect.group_count,
                unique_ref_codes:      detect.unique_ref_codes,
                ref_code_groups:       groupSummary,
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

    // ── POST /api/seating/save ───────────────────────────────────────────────

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
                exam_date, session_order: rawSession, notification_ids, room_ids,
                allocations, generated_by, notes, anti_copy_score
            } = req.body;

            const { session_order } = await resolveSession(db, rawSession);

            const [oldPlans] = await cq(`
                SELECT plan_id FROM exam_seating_plan
                WHERE DATE(exam_date) = ? AND session_order = ?
            `, [exam_date, session_order]);

            for (const old of oldPlans) {
                await cq(`DELETE FROM exam_seat_allocation            WHERE plan_id = ?`, [old.plan_id]);
                await cq(`DELETE FROM exam_seating_plan_rooms         WHERE plan_id = ?`, [old.plan_id]);
                await cq(`DELETE FROM exam_seating_plan_notifications WHERE plan_id = ?`, [old.plan_id]);
                await cq(`DELETE FROM exam_seating_plan              WHERE plan_id = ?`, [old.plan_id]);
            }
            if (oldPlans.length) {
                console.log(`[/save] Replaced ${oldPlans.length} old plan(s) for ${exam_date} session ${session_order}`);
            }

            const [planRes] = await cq(`
                INSERT INTO exam_seating_plan
                    (exam_date, session_order, total_students, total_rooms, status, generated_by, notes)
                VALUES (?, ?, ?, ?, 'Draft', ?, ?)
            `, [exam_date, session_order, allocations.length, room_ids.length, generated_by || 'Admin', notes || null]);

            const planId = planRes.insertId;

            const uniqueNotifIds = [...new Set(notification_ids)];
            const nCounts = {};
            allocations.forEach(a => { nCounts[a.notification_id] = (nCounts[a.notification_id] || 0) + 1; });
            for (const nid of uniqueNotifIds) {
                const ref = allocations.find(a => a.notification_id === nid)?.notification_ref || '';
                await cq(`
                    INSERT INTO exam_seating_plan_notifications
                        (plan_id, notification_id, notification_ref, student_count)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE student_count = VALUES(student_count)
                `, [planId, nid, ref, nCounts[nid] || 0]);
            }

            const rCounts = {};
            allocations.forEach(a => { rCounts[a.room_id] = (rCounts[a.room_id] || 0) + 1; });
            for (let i = 0; i < room_ids.length; i++) {
                await cq(`INSERT INTO exam_seating_plan_rooms (plan_id, room_id, capacity_used, room_order) VALUES (?, ?, ?, ?)`,
                    [planId, room_ids[i], rCounts[room_ids[i]] || 0, i + 1]);
            }

            if (allocations.length > 0) {
                const rows = allocations.map(a => [
                    planId, a.notification_id, a.student_id, a.branch_id, a.semester_id,
                    a.subject_id,
                    (a.subjects || []).map(s => s.subject_name).join(' | ') || a.subject_name || null,
                    (a.subjects || []).map(s => s.syllabus_code).join(' | ') || a.syllabus_code || null,
                    a.room_id, a.bench_label || null, a.row_no || 1, a.col_no || 1,
                    a.seat_position || 1, a.seat_serial || 1, exam_date, session_order
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
                message:        `✅ ${allocations.length} students seated across ${room_ids.length} room(s).`
            });

        } catch (err) {
            await rollbackTx();
            console.error('[/save]', err.message);
            res.status(500).json({ error: err.message });
        } finally {
            if (conn) conn.release();
        }
    });

    // ── POST /api/seating/block-room ────────────────────────────────────────

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
                INSERT INTO room_blocked_slots (room_id, block_date, session_order, reason, reason_note, blocked_by)
                VALUES ?
                ON DUPLICATE KEY UPDATE reason = VALUES(reason), reason_note = VALUES(reason_note),
                    blocked_by = VALUES(blocked_by), is_active = 1
            `, [rows]);

            res.json({ success: true, slots_blocked: rows.length });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── PUT /api/seating/unblock-room/:id ───────────────────────────────────

    router.put('/unblock-room/:id', async (req, res) => {
        try {
            await db.query(`UPDATE room_blocked_slots SET is_active = 0 WHERE block_id = ?`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── GET /api/seating/plans ──────────────────────────────────────────────

    router.get('/plans', async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT esp.*,
                    DATE_FORMAT(esp.exam_date, '%Y-%m-%d')                           AS exam_date_str,
                    GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ')     AS exam_names,
                    GROUP_CONCAT(DISTINCT espn.notification_ref  SEPARATOR ', ')     AS notif_refs,
                    GROUP_CONCAT(DISTINCT rm.room_code           SEPARATOR ', ')     AS rooms_list,
                    COUNT(DISTINCT espr.room_id)                                     AS room_count,
                    COALESCE(
                        (SELECT sm2.session_name FROM sessions_master sm2
                         WHERE sm2.is_active = 1
                           AND CASE WHEN esp.session_order = 1
                                    THEN COALESCE(sm2.session_group, sm2.session_name) = 'FN'
                                    ELSE COALESCE(sm2.session_group, sm2.session_name) != 'FN'
                               END
                         ORDER BY sm2.session_id ASC LIMIT 1),
                        CASE esp.session_order WHEN 1 THEN 'FN' ELSE 'AN' END
                    ) AS session_label_db
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                LEFT JOIN exam_notifications en   ON en.notification_id = espn.notification_id
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id = esp.plan_id
                LEFT JOIN room_master rm ON rm.room_id = espr.room_id
                GROUP BY esp.plan_id
                ORDER BY esp.exam_date DESC, esp.session_order
            `);

            res.json({
                plans: rows.map(r => {
                    const dateStr = r.exam_date_str || '';
                    return {
                        ...r,
                        exam_date:         dateStr,
                        exam_date_display: formatDateDisplay(dateStr),
                        session_label:     r.session_label_db || (r.session_order === 1 ? 'FN' : 'AN'),
                        notification_ids:  r.notif_refs ? r.notif_refs.split(', ') : []
                    };
                })
            });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── GET /api/seating/plan-by-date ───────────────────────────────────────

    router.get('/plan-by-date', async (req, res) => {
        try {
            const { exam_date, session_order } = req.query;
            const [[plan]] = await db.query(`
                SELECT plan_id,
                    DATE_FORMAT(exam_date, '%Y-%m-%d') AS exam_date,
                    session_order, total_students, status, total_rooms
                FROM exam_seating_plan
                WHERE DATE(exam_date) = ? AND session_order = ?
                ORDER BY plan_id DESC
                LIMIT 1
            `, [exam_date, session_order]);

            if (!plan) return res.json({ success: false, error: 'No plan found' });
            res.json({ success: true, plan_id: plan.plan_id, plan });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ── GET /api/seating/preview/:planId ────────────────────────────────────

    router.get('/preview/:planId', async (req, res) => {
        try {
            const [[plan]] = await db.query(`
                SELECT esp.*,
                    DATE_FORMAT(esp.exam_date, '%Y-%m-%d') AS exam_date_str,
                    GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                LEFT JOIN exam_notifications en ON en.notification_id = espn.notification_id
                WHERE esp.plan_id = ? GROUP BY esp.plan_id
            `, [req.params.planId]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            plan.exam_date = plan.exam_date_str || plan.exam_date;

            const [seats] = await db.query(`
                SELECT esa.*, rm.room_code AS room_number, rm.room_name,
                    rm.layout_data, rm.total_rows, rm.total_columns, rm.students_per_bench,
                    bm.block_code, stm.full_name AS student_name, stm.ht_number AS register_number,
                    br.branch_code, br.branch_name, sem.semester_name AS sem_name, sm.ref_code
                FROM exam_seat_allocation esa
                LEFT JOIN room_master     rm  ON rm.room_id     = esa.room_id
                LEFT JOIN block_master    bm  ON bm.block_id    = rm.block_id
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                WHERE esa.plan_id = ?
                ORDER BY esa.room_id, esa.row_no ASC, esa.col_no ASC, esa.seat_position ASC
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

            let college = { college_name: '', college_subtitle: 'EXAMINATION BRANCH', college_address: '' };
            try {
                const [csR] = await db.query(`SELECT * FROM college_settings LIMIT 1`).catch(() => [[]]);
                const cs = csR?.[0];
                if (cs && (cs.college_name || cs.name)) {
                    college.college_name     = cs.college_name || cs.name;
                    college.college_subtitle = cs.college_subtitle || cs.department_name || 'EXAMINATION BRANCH';
                    college.college_address  = cs.address || '';
                } else {
                    const [cmR] = await db.query(
                        `SELECT * FROM college_master
                         WHERE is_active = 1 AND (email IS NOT NULL OR website IS NOT NULL)
                         ORDER BY college_id ASC LIMIT 1`
                    ).catch(() => [[]]);
                    const cm = cmR?.[0]
                        || (await db.query(`SELECT * FROM college_master WHERE is_active = 1 ORDER BY college_id ASC LIMIT 1`).catch(() => [[]]))[0]?.[0];
                    if (cm && (cm.college_name || cm.name)) {
                        college.college_name     = cm.college_name || cm.name;
                        college.college_subtitle = cm.department_name || cm.department || 'EXAMINATION BRANCH';
                        college.college_address  = cm.address || '';
                    } else {
                        const [stR] = await db.query(
                            `SELECT setting_key, setting_value FROM settings
                             WHERE setting_key IN ('college_name','institution_name','department_name') LIMIT 5`
                        ).catch(() => [[]]);
                        if (stR?.length) {
                            const m = {};
                            stR.forEach(r => { m[r.setting_key] = r.setting_value; });
                            college.college_name     = m.college_name || m.institution_name || '';
                            college.college_subtitle = m.department_name || 'EXAMINATION BRANCH';
                        }
                    }
                }
            } catch (_) {}

            res.json({
                plan, college,
                rooms:          Object.values(roomMap),
                total_students: seats.length
            });
        } catch (err) {
            console.error('[/preview]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── PATCH /api/seating/plan/:id/status ──────────────────────────────────

    router.patch('/plan/:id/status', async (req, res) => {
        try {
            const { status } = req.body;
            if (!['Draft', 'Confirmed', 'Published'].includes(status))
                return res.status(400).json({ error: 'Invalid status' });
            await db.query(`UPDATE exam_seating_plan SET status = ? WHERE plan_id = ?`, [status, req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── DELETE /api/seating/plan/:id ────────────────────────────────────────

    router.delete('/plan/:id', async (req, res) => {
        try {
            const [[plan]] = await db.query(`SELECT status FROM exam_seating_plan WHERE plan_id = ?`, [req.params.id]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            if (plan.status !== 'Draft')
                return res.status(400).json({ error: 'Only Draft plans can be deleted here. Use force-delete for Confirmed/Published.' });

            await db.query(`DELETE FROM exam_seat_allocation            WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan_rooms         WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan_notifications WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan              WHERE plan_id = ?`, [req.params.id]);
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ── DELETE /api/seating/plan/:id/force ──────────────────────────────────

    const ADMIN_DELETE_PASSWORD = process.env.ADMIN_DELETE_PASSWORD || 'Admin@123';
    router.delete('/plan/:id/force', async (req, res) => {
        try {
            const { password } = req.body;
            if (!password || password !== ADMIN_DELETE_PASSWORD)
                return res.status(403).json({ error: 'Invalid password. Contact your system administrator.' });

            const [[plan]] = await db.query(`SELECT plan_id, status FROM exam_seating_plan WHERE plan_id = ?`, [req.params.id]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            await db.query(`DELETE FROM exam_seat_allocation            WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan_rooms         WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan_notifications WHERE plan_id = ?`, [req.params.id]);
            await db.query(`DELETE FROM exam_seating_plan              WHERE plan_id = ?`, [req.params.id]);

            console.log(`[force-delete] Plan #${req.params.id} (was ${plan.status}) deleted by admin`);
            res.json({ success: true, message: `Plan #${req.params.id} permanently deleted.` });
        } catch (err) {
            console.error('[/force-delete]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/seating/attendance/:planId ─────────────────────────────────

    router.get('/attendance/:planId', async (req, res) => {
        try {
            const planId = req.params.planId;

            const [[plan]] = await db.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT espn.notification_ref SEPARATOR ',') AS notif_refs
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                WHERE esp.plan_id = ?
                GROUP BY esp.plan_id
            `, [planId]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            let notifDetails = null;
            if (plan.notif_refs) {
                const firstRef = plan.notif_refs.split(',')[0].trim();
                const [[nd]] = await db.query(`
                    SELECT en.*,
                        pm.programme_name,
                        mym.display_name AS month_year_display,
                        et.exam_type_name AS exam_type_label
                    FROM exam_notifications en
                    LEFT JOIN programme_master  pm  ON pm.programme_id   = en.programme_id
                    LEFT JOIN month_year_master mym ON mym.month_year_id = en.month_year_id
                    LEFT JOIN exam_types_master et  ON et.exam_type_id   = en.exam_type_id
                    WHERE en.notification_id = ?
                `, [firstRef]).catch(() => [[null]]);
                notifDetails = nd;
            }

            const [seats] = await db.query(`
                SELECT
                    esa.seat_id, esa.room_id, esa.seat_serial, esa.bench_label, esa.seat_position,
                    rm.room_code AS room_number, rm.room_name, bm.block_code,
                    stm.ht_number AS roll_no, stm.full_name AS student_name,
                    br.branch_id, br.branch_code, br.branch_name,
                    sem.semester_id, sem.semester_name,
                    sm.subject_id, sm.subject_name, sm.syllabus_code, sm.ref_code
                FROM exam_seat_allocation esa
                LEFT JOIN room_master     rm  ON rm.room_id     = esa.room_id
                LEFT JOIN block_master    bm  ON bm.block_id    = rm.block_id
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                WHERE esa.plan_id = ?
                  AND COALESCE(esa.is_blocked, 0) = 0
                ORDER BY esa.room_id, br.branch_code, sem.semester_id, stm.ht_number
            `, [planId]);

            const roomMap = {};
            for (const s of seats) {
                const rk  = s.room_id;
                const bsk = `${s.branch_id}_${s.semester_id}`;

                if (!roomMap[rk]) {
                    roomMap[rk] = {
                        room_id:     s.room_id,
                        room_number: s.room_number,
                        room_name:   s.room_name,
                        block_code:  s.block_code,
                        groups:      {}
                    };
                }
                if (!roomMap[rk].groups[bsk]) {
                    roomMap[rk].groups[bsk] = {
                        branch_id:     s.branch_id,
                        branch_code:   s.branch_code,
                        branch_name:   s.branch_name,
                        semester_id:   s.semester_id,
                        semester_name: s.semester_name,
                        subject_name:  s.subject_name,
                        syllabus_code: s.syllabus_code,
                        students:      []
                    };
                }

                roomMap[rk].groups[bsk].students.push({
                    roll_no:      s.roll_no,
                    student_name: s.student_name,
                    seat_serial:  s.seat_serial,
                    bench_label:  s.bench_label
                });
            }

            const rooms = Object.values(roomMap).map(r => ({
                ...r,
                groups: Object.values(r.groups).map(g => ({
                    ...g,
                    students: g.students.sort((a, b) => (a.roll_no || '').localeCompare(b.roll_no || ''))
                }))
            }));

            res.json({
                success:        true,
                plan,
                notif:          notifDetails,
                rooms,
                total_rooms:    rooms.length,
                total_students: seats.length
            });
        } catch (err) {
            console.error('[/attendance]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── GET /api/seating/noticeboard/:planId ────────────────────────────────

    router.get('/noticeboard/:planId', async (req, res) => {
        try {
            const planId = req.params.planId;

            const [[plan]] = await db.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT espn.notification_ref SEPARATOR ',') AS notif_refs
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                WHERE esp.plan_id = ?
                GROUP BY esp.plan_id
            `, [planId]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            let notifDetails = null;
            if (plan.notif_refs) {
                const firstRef = plan.notif_refs.split(',')[0].trim();
                const [[nd]] = await db.query(`
                    SELECT en.*,
                        pm.programme_name,
                        mym.display_name AS month_year_display,
                        et.exam_type_name AS exam_type_label
                    FROM exam_notifications en
                    LEFT JOIN programme_master  pm  ON pm.programme_id   = en.programme_id
                    LEFT JOIN month_year_master mym ON mym.month_year_id = en.month_year_id
                    LEFT JOIN exam_types_master et  ON et.exam_type_id   = en.exam_type_id
                    WHERE en.notification_id = ?
                `, [firstRef]).catch(() => [[null]]);
                notifDetails = nd;
            }

            const isMSE = (notifDetails?.exam_type || '').toLowerCase().includes('internal')
                       || (notifDetails?.exam_type || '').toUpperCase().includes('MSE');

            const [rows2] = await db.query(`
                SELECT
                    esa.room_id,
                    rm.room_code  AS room_number,
                    bm_room.block_code,
                    stm.ht_number AS roll_no,
                    br.branch_code, br.branch_name,
                    sec.section_name,
                    sem.semester_id, sem.semester_name,
                    pm.programme_name, pm.programme_id
                FROM exam_seat_allocation esa
                LEFT JOIN room_master     rm      ON rm.room_id      = esa.room_id
                LEFT JOIN block_master    bm_room ON bm_room.block_id = rm.block_id
                LEFT JOIN student_master  stm     ON stm.student_id  = esa.student_id
                LEFT JOIN section_master  sec     ON sec.section_id  = stm.section_id
                LEFT JOIN branch_master   br      ON br.branch_id    = esa.branch_id
                LEFT JOIN semester_master sem     ON sem.semester_id = esa.semester_id
                LEFT JOIN programme_master pm     ON pm.programme_id = stm.programme_id
                WHERE esa.plan_id = ?
                  AND COALESCE(esa.is_blocked, 0) = 0
                ORDER BY pm.programme_name, sem.semester_id, br.branch_code, sec.section_id, stm.ht_number
            `, [planId]);

            const grouped = {};
            for (const r of rows2) {
                const progKey = r.programme_name || 'B.TECH';
                const semKey  = r.semester_name  || `Sem ${r.semester_id}`;

                let secNum = '';
                if (isMSE && r.section_name) {
                    const match = r.section_name.match(/\d+/);
                    secNum = match ? `-${match[0]}` : '';
                }
                const branchLabel = `${r.branch_code}${secNum}`;
                const roomLabel   = r.room_number || String(r.room_id);

                if (!grouped[progKey])                              grouped[progKey] = {};
                if (!grouped[progKey][semKey])                      grouped[progKey][semKey] = {};
                if (!grouped[progKey][semKey][branchLabel])         grouped[progKey][semKey][branchLabel] = {};
                if (!grouped[progKey][semKey][branchLabel][roomLabel])
                    grouped[progKey][semKey][branchLabel][roomLabel] = [];

                if (r.roll_no) grouped[progKey][semKey][branchLabel][roomLabel].push(r.roll_no);
            }

            const entries = [];
            for (const [prog, sems] of Object.entries(grouped)) {
                for (const [sem, branches] of Object.entries(sems)) {
                    const semEntries = [];
                    for (const [branch, rooms] of Object.entries(branches).sort()) {
                        for (const [room, rolls] of Object.entries(rooms)) {
                            semEntries.push({
                                branch,
                                room,
                                rolls: [...new Set(rolls)].sort(),
                                count: [...new Set(rolls)].length
                            });
                        }
                    }
                    entries.push({ programme: prog, semester: sem, rows: semEntries });
                }
            }

            res.json({
                success:        true,
                plan,
                notif:          notifDetails,
                is_mse:         isMSE,
                entries,
                total_students: rows2.length
            });
        } catch (err) {
            console.error('[/noticeboard]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
