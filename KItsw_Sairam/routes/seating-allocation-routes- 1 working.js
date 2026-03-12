// ============================================================
//  seating-allocation-routes.js  —  ROBUST PROFESSIONAL v4
//
//  RULE 1: Mix branches + semesters + subjects across all rooms
//  RULE 2: Jumping snake — odd benches FIRST then even benches
//          1-per-bench: 2 passes  (odd → even)
//          2-per-bench: 4 passes  (L-odd → L-even → R-odd → R-even)
//  RULE 3: Same subject_name = same anti-copy group
//          (different syllabus codes treated as same subject)
//  RULE 4: ESE → always 1-per-bench. Others → auto detect.
//
//  AUTO batch size:
//    students ≤ available_benches  →  1 per bench
//    students >  available_benches  →  room.students_per_bench (2)
//    No hardcoded numbers.
// ============================================================

const express = require('express');

// ─── Helpers ─────────────────────────────────────────────────

function toLocalDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', weekday:'short' });
}

// ─── STEP 1: Deduplicate students ────────────────────────────
// One physical seat per unique student_id.
// Primary subject = earliest entry_id (ORDER BY entry_id ASC in SQL).
// All subjects stored in subjects[] for PDF multi-subject display.

function deduplicateStudents(rawRows) {
    const map = {};
    rawRows.forEach(row => {
        const sid = row.student_id;
        if (!map[sid]) {
            map[sid] = {
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
                subject_id:       row.subject_id,    // primary
                subject_name:     row.subject_name,  // primary (for anti-copy grouping)
                syllabus_code:    row.syllabus_code,
                subjects:         []
            };
        }
        if (!map[sid].subjects.find(s => s.subject_id === row.subject_id)) {
            map[sid].subjects.push({
                subject_id:    row.subject_id,
                subject_name:  row.subject_name,
                syllabus_code: row.syllabus_code
            });
        }
    });
    return Object.values(map);
}

// ─── STEP 2: Global mix sort (Rules 1 + 3) ───────────────────
// Groups students by normalised subject_name (Rule 3: same name = same group).
// Round-robin interleaves groups → each consecutive block of seats
// alternates subjects, branches, semesters.
//
// Example:
//   Group DV: [CSE-S6, CSE-S8, IT-S6, AIML-S6]
//   Group EH: [AIML-S8, IT-S8, CSE-S6, AIML-S6]
//   Result  : [CSE-S6/DV, AIML-S8/EH, CSE-S8/DV, IT-S8/EH, IT-S6/DV ...]

function globalMixSort(students) {
    const groups = {};
    students.forEach(s => {
        const key = (s.subject_name || 'UNKNOWN').toUpperCase().trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    // Within each subject group, sub-sort by branch+semester for further mixing
    Object.values(groups).forEach(g => {
        g.sort((a, b) =>
            (a.branch_code||'').localeCompare(b.branch_code||'') ||
            (a.semester_id - b.semester_id)
        );
    });

    // Largest group first → ensures even spread across passes
    const groupArrays = Object.values(groups).sort((a,b) => b.length - a.length);
    const maxLen = Math.max(...groupArrays.map(g => g.length));

    const result = [];
    for (let i = 0; i < maxLen; i++)
        for (const grp of groupArrays)
            if (i < grp.length) result.push(grp[i]);

    return result;
}

// ─── STEP 3: Parse layout_data → snake-ordered bench list ────
// Snake:
//   Row A (idx 0) → cols 1,2,3,4 (left→right)
//   Row B (idx 1) → cols 4,3,2,1 (right→left)  ← reversal
//   Row C (idx 2) → cols 1,2,3,4 ...

function getSnakeBenches(room) {
    let layout = {};
    try {
        layout = room.layout_data
            ? (typeof room.layout_data === 'string' ? JSON.parse(room.layout_data) : room.layout_data)
            : {};
    } catch (_) {}

    const studPerBenchConfig = room.students_per_bench || layout.students_per_bench || 2;

    let allBenches = [];
    if (layout.benches && layout.benches.length > 0) {
        allBenches = layout.benches;
    } else {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const cols  = layout.cols || room.total_columns || 4;
        const rows  = layout.rows || room.total_rows    || 8;
        for (let r = 0; r < rows; r++)
            for (let c = 1; c <= cols; c++)
                allBenches.push({ col:c, row:r+1, label:`${ALPHA[r]}${c}`, available:true });
    }

    const rowNums = [...new Set(allBenches.map(b => b.row))].sort((a,b) => a-b);

    const snakeBenches = [];
    rowNums.forEach((rowNum, idx) => {
        const rowBenches = allBenches
            .filter(b => b.row === rowNum && b.available === true)
            .sort((a,b) => a.col - b.col);
        snakeBenches.push(...(idx % 2 === 0 ? rowBenches : [...rowBenches].reverse()));
    });

    return { snakeBenches, studPerBenchConfig };
}

// ─── STEP 4: Build seat passes — JUMPING ODD/EVEN (Rule 2) ───
//
// The snake-ordered bench list is split into:
//   odd  = benches at index 0,2,4,6... (1st, 3rd, 5th physical bench)
//   even = benches at index 1,3,5,7... (2nd, 4th, 6th physical bench)
//
// 1-per-bench → 2 passes:
//   [odd-pos1, even-pos1]
//   Student 1 at A1, Student 2 at A3 → empty A2 between them ✓
//   Student 3 at B4, Student 4 at B2 → empty B3 between them ✓
//
// 2-per-bench → 4 passes:
//   [odd-LEFT, even-LEFT, odd-RIGHT, even-RIGHT]
//   LEFT of A1, LEFT of A3 filled first (gap at A2)
//   Then LEFT of A2, A4 fill gaps
//   Then RIGHT seats follow same pattern
//   → Same bench L+R seats get students far apart in the sorted list
//      (different subjects guaranteed by globalMixSort)

function buildSeatPasses(snakeBenches, studPerBench) {
    const odd  = snakeBenches.filter((_,i) => i % 2 === 0);
    const even = snakeBenches.filter((_,i) => i % 2 !== 0);

    if (studPerBench === 1) {
        return [
            ...odd.map(b  => ({ ...b, seat_position: 1 })),
            ...even.map(b => ({ ...b, seat_position: 1 }))
        ];
    } else {
        return [
            ...odd.map(b  => ({ ...b, seat_position: 1 })),   // Left  odd benches
            ...even.map(b => ({ ...b, seat_position: 1 })),   // Left  even benches
            ...odd.map(b  => ({ ...b, seat_position: 2 })),   // Right odd benches
            ...even.map(b => ({ ...b, seat_position: 2 }))    // Right even benches
        ];
    }
}

// ─── STEP 5: Assign seats to rooms ───────────────────────────

function calcRoomCapacity(room) {
    if (room.layout_data) {
        try {
            const ld = typeof room.layout_data === 'string' ? JSON.parse(room.layout_data) : room.layout_data;
            if (ld.benches) {
                const avail = ld.benches.filter(b => b.available).length;
                return avail * (room.students_per_bench || 2);
            }
        } catch (_) {}
    }
    return room.usable_capacity || room.total_capacity || 42;
}

function assignSeatsToRooms(sortedStudents, rooms, isESE) {
    const allocations = [];
    let studentIdx = 0;

    for (const room of rooms) {
        if (studentIdx >= sortedStudents.length) break;

        const { snakeBenches, studPerBenchConfig } = getSnakeBenches(room);
        const availBenchCount   = snakeBenches.length;
        const remainingStudents = sortedStudents.length - studentIdx;

        // Auto-decide students per bench (Rule 4 overrides)
        let studPerBench;
        if (isESE) {
            studPerBench = 1;  // ESE: always 1
        } else {
            studPerBench = (remainingStudents <= availBenchCount) ? 1 : studPerBenchConfig;
        }

        const roomCapacity     = availBenchCount * studPerBench;
        const studentsThisRoom = Math.min(remainingStudents, roomCapacity);

        // Build the ordered seat slots with jumping odd/even passes
        const seatPasses = buildSeatPasses(snakeBenches, studPerBench);

        let seatSerial = 1;
        for (let i = 0; i < seatPasses.length && seatSerial <= studentsThisRoom; i++) {
            if (studentIdx >= sortedStudents.length) break;

            const seat    = seatPasses[i];
            const student = sortedStudents[studentIdx++];

            allocations.push({
                ...student,
                room_id:        room.room_id,
                bench_label:    seat.label,
                row_no:         seat.row,
                col_no:         seat.col,
                seat_position:  seat.seat_position,
                seat_serial:    seatSerial++,
                stud_per_bench: studPerBench
            });
        }
    }

    return allocations;
}

// ─── Router ──────────────────────────────────────────────────

function initializeRouter(pool) {
    const router = express.Router();

    // GET /api/seating/notifications
    router.get('/notifications', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session) return res.status(400).json({ error: 'date and session required' });

            const [rows] = await pool.query(`
                SELECT DISTINCT
                    ese.notification_id   AS hashed_id,
                    ese.notification_ref,
                    COUNT(DISTINCT ese.student_id) AS student_count,
                    GROUP_CONCAT(DISTINCT br.branch_code ORDER BY br.branch_code SEPARATOR ', ') AS branches
                FROM exam_student_entries ese
                LEFT JOIN branch_master br ON br.branch_id = ese.branch_id
                WHERE ese.exam_date = ? AND ese.session_order = ?
                GROUP BY ese.notification_id, ese.notification_ref
                ORDER BY ese.notification_ref
            `, [date, session]);

            // Enrich with exam_notifications title + type
            for (const row of rows) {
                try {
                    const [[enrich]] = await pool.query(`
                        SELECT en.notification_title, en.exam_type, en.batch_name
                        FROM exam_notifications en
                        WHERE ABS(CONV(SUBSTRING(MD5(en.notification_id),1,8),16,10)) % 2147483647 = ?
                        LIMIT 1
                    `, [row.hashed_id]);
                    if (enrich) Object.assign(row, {
                        exam_name:  enrich.notification_title,
                        exam_type:  enrich.exam_type,
                        batch_name: enrich.batch_name
                    });
                } catch (_) {}
            }

            res.json({ notifications: rows });
        } catch (err) {
            console.error('GET /notifications error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/seating/room-availability
    router.get('/room-availability', async (req, res) => {
        try {
            const { date, session } = req.query;
            if (!date || !session) return res.status(400).json({ error: 'date and session required' });

            // Resolve date → weekly schedule day column
            const _DAY_COLS = {
                0:['sun_fn','sun_an'], 1:['mon_fn','mon_an'], 2:['tue_fn','tue_an'],
                3:['wed_fn','wed_an'], 4:['thu_fn','thu_an'], 5:['fri_fn','fri_an'],
                6:['sat_fn','sat_an']
            };
            const _dayCol = _DAY_COLS[new Date(date+'T12:00:00Z').getUTCDay()][parseInt(session)===1?0:1];

            const [rooms] = await pool.query(`
                SELECT
                    rm.room_id,
                    rm.room_code          AS room_number,
                    rm.room_name,
                    rm.block_id,
                    rm.total_rows,
                    rm.total_columns,
                    rm.students_per_bench,
                    bm.block_code,
                    bm.block_name,
                    rm.floor_number,
                    rm.total_capacity     AS usable_capacity,
                    rm.layout_data,
                    rm.is_active,
                    rm.exam_status,
                    IFNULL(rws.\`${_dayCol}\`, 0) AS weekly_blocked,
                    rbs.block_id          AS blocked_slot_id,
                    rbs.reason            AS blocked_reason,
                    rbs.reason_note       AS blocked_note,
                    rbs.blocked_by,
                    esp.plan_id           AS occupied_plan_id,
                    en_occ.notification_title AS occupied_exam_name
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN room_weekly_schedule rws ON rws.room_id = rm.room_id
                LEFT JOIN room_blocked_slots rbs
                    ON rbs.room_id=rm.room_id AND rbs.block_date=?
                    AND rbs.session_order=? AND rbs.is_active=1
                LEFT JOIN exam_seating_plan_rooms espr ON espr.room_id=rm.room_id
                LEFT JOIN exam_seating_plan esp
                    ON esp.plan_id=espr.plan_id AND esp.exam_date=?
                    AND esp.session_order=? AND esp.status!='Draft'
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id=esp.plan_id
                LEFT JOIN exam_notifications en_occ ON (
                    ABS(CONV(SUBSTRING(MD5(en_occ.notification_id),1,8),16,10)) % 2147483647 = espn.notification_id
                )
                WHERE rm.deleted_at IS NULL
                ORDER BY bm.block_code, rm.floor_number, rm.room_code
            `, [date, session, date, session]);

            const result = rooms.map(r => {
                let status = 'FREE', statusNote = '';
                // Priority: INACTIVE → WEEKLY BLOCKED → DATE OVERRIDE → OCCUPIED → FREE
                if (!r.is_active || r.exam_status === 'Not Available') {
                    status = 'INACTIVE'; statusNote = 'Not available for exams';
                } else if (r.weekly_blocked) {
                    status = 'BLOCKED'; statusNote = `Weekly schedule (${_dayCol.replace('_',' ').toUpperCase()})`;
                } else if (r.blocked_slot_id) {
                    status = 'BLOCKED';
                    statusNote = (r.blocked_reason||'') + (r.blocked_note ? ` — ${r.blocked_note}` : '');
                } else if (r.occupied_plan_id) {
                    status = 'OCCUPIED';
                    statusNote = r.occupied_exam_name || `Plan #${r.occupied_plan_id}`;
                }
                return {
                    room_id:         r.room_id,
                    room_number:     r.room_number,
                    room_name:       r.room_name,
                    block_id:        r.block_id,
                    block_code:      r.block_code,
                    block_name:      r.block_name,
                    floor_number:    r.floor_number,
                    usable_capacity: calcRoomCapacity(r),
                    layout_data:     r.layout_data,
                    exam_status:     r.exam_status,
                    status, status_note: statusNote,
                    blocked_slot_id: r.blocked_slot_id || null
                };
            });

            const grouped = {};
            result.forEach(r => {
                const k = r.block_code || 'Other';
                if (!grouped[k]) grouped[k] = { block_code:k, block_name:r.block_name, rooms:[] };
                grouped[k].rooms.push(r);
            });

            res.json({
                date, session, rooms: result, grouped: Object.values(grouped),
                summary: {
                    total:         result.length,
                    free:          result.filter(r=>r.status==='FREE').length,
                    blocked:       result.filter(r=>r.status==='BLOCKED').length,
                    occupied:      result.filter(r=>r.status==='OCCUPIED').length,
                    inactive:      result.filter(r=>r.status==='INACTIVE').length,
                    free_capacity: result.filter(r=>r.status==='FREE').reduce((s,r)=>s+r.usable_capacity,0)
                }
            });
        } catch (err) {
            console.error('GET /room-availability error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/seating/block-room
    router.post('/block-room', async (req, res) => {
        try {
            const { room_id, from_date, to_date, sessions, reason, reason_note, blocked_by } = req.body;
            if (!room_id || !from_date || !sessions?.length)
                return res.status(400).json({ error: 'room_id, from_date, sessions required' });
            const start = new Date(from_date + 'T00:00:00');
            const end   = new Date((to_date||from_date) + 'T00:00:00');
            const rowsToInsert = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
                const ds = toLocalDateString(d);
                for (const s of sessions)
                    rowsToInsert.push([room_id, ds, s, reason||'Regular Lecture', reason_note||null, blocked_by||null]);
            }
            if (!rowsToInsert.length) return res.status(400).json({ error: 'No slots to block' });
            await pool.query(`
                INSERT INTO room_blocked_slots (room_id,block_date,session_order,reason,reason_note,blocked_by)
                VALUES ?
                ON DUPLICATE KEY UPDATE reason=VALUES(reason),reason_note=VALUES(reason_note),
                    blocked_by=VALUES(blocked_by),is_active=1
            `, [rowsToInsert]);
            res.json({ success:true, slots_blocked:rowsToInsert.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/seating/unblock-room/:blockId
    router.put('/unblock-room/:blockId', async (req, res) => {
        try {
            await pool.query(`UPDATE room_blocked_slots SET is_active=0 WHERE block_id=?`, [req.params.blockId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/seating/blocked-slots/:roomId
    router.get('/blocked-slots/:roomId', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT block_id,room_id,block_date,session_order,reason,reason_note,blocked_by,is_active,created_at
                FROM room_blocked_slots
                WHERE room_id=? AND block_date>=CURDATE() AND is_active=1
                ORDER BY block_date,session_order
            `, [req.params.roomId]);
            res.json({ blocked_slots: rows.map(r=>({
                ...r,
                block_date_display: formatDateDisplay(r.block_date),
                session_label: r.session_order===1?'FN':'AN'
            }))});
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ─────────────────────────────────────────────────────────
    // POST /api/seating/generate  —  MASTER ALGORITHM
    // ─────────────────────────────────────────────────────────
    router.post('/generate', async (req, res) => {
        try {
            const { exam_date, session_order, notification_ids, room_ids } = req.body;
            if (!exam_date || !session_order || !notification_ids?.length || !room_ids?.length)
                return res.status(400).json({ error: 'exam_date, session_order, notification_ids, room_ids required' });

            // Rule 4: detect ESE
            let isESE = false;
            try {
                const [[typeRow]] = await pool.query(`
                    SELECT exam_type FROM exam_notifications
                    WHERE ABS(CONV(SUBSTRING(MD5(notification_id),1,8),16,10)) % 2147483647
                        IN (${notification_ids.map(()=>'?').join(',')})
                    LIMIT 1
                `, notification_ids);
                isESE = (typeRow?.exam_type||'').toUpperCase().includes('ESE');
            } catch (_) {}

            // Fetch all student×subject rows, earliest subject first per student
            const ph = notification_ids.map(()=>'?').join(',');
            const [rawRows] = await pool.query(`
                SELECT
                    ese.entry_id, ese.notification_id, ese.notification_ref,
                    ese.student_id, ese.branch_id, ese.semester_id,
                    ese.regulation_id, ese.batch_id, ese.subject_id,
                    ese.exam_date, ese.session_order,
                    sm_sub.subject_name, sm_sub.syllabus_code,
                    bm.branch_code, bm.branch_name,
                    stm.full_name   AS student_name,
                    stm.ht_number   AS register_number,
                    sem.semester_name AS sem_name
                FROM exam_student_entries ese
                LEFT JOIN subject_master  sm_sub ON sm_sub.subject_id = ese.subject_id
                LEFT JOIN branch_master   bm     ON bm.branch_id      = ese.branch_id
                LEFT JOIN student_master  stm    ON stm.student_id    = ese.student_id
                LEFT JOIN semester_master sem    ON sem.semester_id   = ese.semester_id
                WHERE ese.notification_id IN (${ph})
                  AND ese.exam_date     = ?
                  AND ese.session_order = ?
                ORDER BY ese.student_id ASC, ese.entry_id ASC
            `, [...notification_ids, exam_date, session_order]);

            if (!rawRows.length)
                return res.status(404).json({ error: 'No students found for selected date+session' });

            // STEP 1: deduplicate → one seat per student
            const uniqueStudents = deduplicateStudents(rawRows);

            // Fetch rooms ordered by user selection
            const rph = room_ids.map(()=>'?').join(',');
            const [rooms] = await pool.query(`
                SELECT room_id, room_code AS room_number, room_name, block_id,
                       total_capacity AS usable_capacity,
                       total_rows, total_columns, students_per_bench, layout_data
                FROM room_master
                WHERE room_id IN (${rph}) AND is_active=1
                ORDER BY FIELD(room_id,${rph})
            `, [...room_ids, ...room_ids]);

            rooms.forEach(r => { r.usable_capacity = calcRoomCapacity(r); });

            const totalCapacity = rooms.reduce((s,r) => s+r.usable_capacity, 0);
            if (uniqueStudents.length > totalCapacity)
                return res.status(400).json({
                    error: `Seats needed: ${uniqueStudents.length}. Available: ${totalCapacity}. Please add more rooms.`
                });

            // STEP 2: global mix sort (Rules 1+3)
            const sorted = globalMixSort(uniqueStudents);

            // STEP 3: assign with jumping snake (Rules 2+4)
            const allocations = assignSeatsToRooms(sorted, rooms, isESE);

            // Build preview per room
            const roomPreview = {};
            rooms.forEach(r => {
                const { snakeBenches } = getSnakeBenches(r);
                roomPreview[r.room_id] = {
                    room_id: r.room_id, room_number: r.room_number, room_name: r.room_name,
                    usable_capacity: r.usable_capacity, available_benches: snakeBenches.length,
                    students: [], branch_summary: {}, subject_summary: {}, semester_summary: {}
                };
            });
            allocations.forEach(a => {
                const rp = roomPreview[a.room_id];
                if (!rp) return;
                rp.students.push(a);
                rp.branch_summary[a.branch_code||'?']   = (rp.branch_summary[a.branch_code||'?']||0)+1;
                rp.subject_summary[a.subject_name||'?'] = (rp.subject_summary[a.subject_name||'?']||0)+1;
                rp.semester_summary[a.sem_name||'?']    = (rp.semester_summary[a.sem_name||'?']||0)+1;
            });

            res.json({
                success: true, exam_date, session_order,
                is_ese: isESE,
                seating_mode: isESE ? '1-per-bench (ESE mandatory)' : 'Auto-detected per room',
                total_students_raw:    rawRows.length,
                total_students_unique: uniqueStudents.length,
                total_rooms:           rooms.length,
                total_capacity:        totalCapacity,
                rooms_preview: Object.values(roomPreview).map(r => ({
                    ...r,
                    student_count:            r.students.length,
                    stud_per_bench_used:      r.students[0]?.stud_per_bench || 'N/A',
                    branch_summary_display:   Object.entries(r.branch_summary).map(([k,v])=>`${k}:${v}`).join(' | '),
                    subject_summary_display:  Object.entries(r.subject_summary).map(([k,v])=>`${k}:${v}`).join(' | '),
                    semester_summary_display: Object.entries(r.semester_summary).map(([k,v])=>`${k}:${v}`).join(' | ')
                })),
                allocations
            });

        } catch (err) {
            console.error('POST /generate error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/seating/save
    router.post('/save', async (req, res) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const { exam_date, session_order, notification_ids, room_ids, allocations, generated_by, notes } = req.body;

            const [planRes] = await conn.query(`
                INSERT INTO exam_seating_plan
                    (exam_date,session_order,total_students,total_rooms,status,generated_by,notes)
                VALUES (?,?,?,?,'Draft',?,?)
            `, [exam_date, session_order, allocations.length, room_ids.length, generated_by||'Admin', notes||null]);

            const planId = planRes.insertId;

            const notifCounts = {};
            allocations.forEach(a => { notifCounts[a.notification_id]=(notifCounts[a.notification_id]||0)+1; });
            for (const nid of notification_ids) {
                await conn.query(`
                    INSERT INTO exam_seating_plan_notifications
                        (plan_id,notification_id,notification_ref,student_count)
                    VALUES (?,?,?,?)
                `, [planId, nid,
                    allocations.find(a=>a.notification_id===nid)?.notification_ref||'',
                    notifCounts[nid]||0]);
            }

            const roomCaps = {};
            allocations.forEach(a => { roomCaps[a.room_id]=(roomCaps[a.room_id]||0)+1; });
            for (let i=0; i<room_ids.length; i++) {
                await conn.query(`
                    INSERT INTO exam_seating_plan_rooms (plan_id,room_id,capacity_used,room_order)
                    VALUES (?,?,?,?)
                `, [planId, room_ids[i], roomCaps[room_ids[i]]||0, i+1]);
            }

            if (allocations.length > 0) {
                await conn.query(`
                    INSERT INTO exam_seat_allocation
                        (plan_id,notification_id,student_id,branch_id,semester_id,
                         subject_id,subject_name,syllabus_code,room_id,bench_label,
                         row_no,col_no,seat_position,seat_serial,exam_date,session_order)
                    VALUES ?
                `, [allocations.map(a => [
                    planId, a.notification_id, a.student_id, a.branch_id, a.semester_id,
                    a.subject_id,
                    (a.subjects||[]).map(s=>s.subject_name).join(' | ') || a.subject_name || null,
                    (a.subjects||[]).map(s=>s.syllabus_code).join(' | ') || a.syllabus_code || null,
                    a.room_id, a.bench_label||null,
                    a.row_no||1, a.col_no||1, a.seat_position||1, a.seat_serial||1,
                    exam_date, session_order
                ])]);
            }

            await conn.commit();
            res.json({
                success:true, plan_id:planId,
                total_students:allocations.length, total_rooms:room_ids.length,
                message:`${allocations.length} students seated across ${room_ids.length} room(s). Jumping snake anti-copy applied.`
            });
        } catch (err) {
            await conn.rollback();
            console.error('POST /save error:', err);
            res.status(500).json({ error: err.message });
        } finally {
            conn.release();
        }
    });

    // GET /api/seating/preview/:planId
    router.get('/preview/:planId', async (req, res) => {
        try {
            const { planId } = req.params;
            const [[plan]] = await pool.query(`
                SELECT esp.*, GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id=esp.plan_id
                LEFT JOIN exam_notifications en ON (
                    ABS(CONV(SUBSTRING(MD5(en.notification_id),1,8),16,10)) % 2147483647 = espn.notification_id
                )
                WHERE esp.plan_id=? GROUP BY esp.plan_id
            `, [planId]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            const [seats] = await pool.query(`
                SELECT esa.*,
                    rm.room_code AS room_number, rm.room_name,
                    rm.layout_data, rm.total_rows, rm.total_columns, rm.students_per_bench,
                    bm.block_code,
                    stm.full_name  AS student_name,
                    stm.ht_number  AS register_number,
                    br.branch_code, br.branch_name,
                    sem.semester_name AS sem_name
                FROM exam_seat_allocation esa
                LEFT JOIN room_master    rm  ON rm.room_id    =esa.room_id
                LEFT JOIN block_master   bm  ON bm.block_id   =rm.block_id
                LEFT JOIN student_master stm ON stm.student_id=esa.student_id
                LEFT JOIN branch_master  br  ON br.branch_id  =esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id=esa.semester_id
                WHERE esa.plan_id=?
                ORDER BY esa.room_id, esa.seat_serial
            `, [planId]);

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

            res.json({ plan, rooms:Object.values(roomMap).map(r=>({...r,student_count:r.students.length})) });
        } catch (err) {
            console.error('GET /preview error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/seating/plans
    router.get('/plans', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT en.notification_title SEPARATOR ' + ') AS exam_names,
                    GROUP_CONCAT(DISTINCT espn.notification_ref  SEPARATOR ', ')  AS notification_refs,
                    GROUP_CONCAT(DISTINCT rm.room_code           SEPARATOR ', ')  AS rooms_list
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id=esp.plan_id
                LEFT JOIN exam_notifications en ON (
                    ABS(CONV(SUBSTRING(MD5(en.notification_id),1,8),16,10)) % 2147483647 = espn.notification_id
                )
                LEFT JOIN exam_seating_plan_rooms espr ON espr.plan_id=esp.plan_id
                LEFT JOIN room_master rm ON rm.room_id=espr.room_id
                GROUP BY esp.plan_id
                ORDER BY esp.exam_date DESC, esp.session_order
            `);
            res.json({ plans: rows.map(r=>({
                ...r,
                exam_date_display: formatDateDisplay(r.exam_date),
                session_label: r.session_order===1?'FN':'AN'
            }))});
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PATCH /api/seating/plan/:planId/status
    router.patch('/plan/:planId/status', async (req, res) => {
        try {
            const { status } = req.body;
            if (!['Draft','Confirmed','Published'].includes(status))
                return res.status(400).json({ error: 'Invalid status' });
            await pool.query(`UPDATE exam_seating_plan SET status=? WHERE plan_id=?`, [status, req.params.planId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE /api/seating/plan/:planId
    router.delete('/plan/:planId', async (req, res) => {
        try {
            const [[plan]] = await pool.query(`SELECT status FROM exam_seating_plan WHERE plan_id=?`,[req.params.planId]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });
            if (plan.status !== 'Draft') return res.status(400).json({ error: 'Only Draft plans can be deleted' });
            await pool.query(`DELETE FROM exam_seating_plan WHERE plan_id=?`, [req.params.planId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
