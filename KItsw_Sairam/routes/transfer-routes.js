const express = require('express');

function initializeRouter(pool) {
    const router = express.Router();

    // ── GET /api/transfer/slot-programmes ───────────────────
    router.get('/slot-programmes', async (req, res) => {
        try {
            const { plan_id } = req.query;
            const [programmes] = await pool.query(`
                SELECT DISTINCT pm.programme_id, pm.programme_name
                FROM exam_seat_allocation esa
                JOIN student_master stm ON stm.student_id = esa.student_id
                JOIN programme_master pm ON pm.programme_id = stm.programme_id
                WHERE esa.plan_id = ?
                ORDER BY pm.programme_name
            `, [plan_id]);
            res.json({ success:true, programmes });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/slot-semesters ────────────────────
    router.get('/slot-semesters', async (req, res) => {
        try {
            const { plan_id, programme_id } = req.query;
            const [semesters] = await pool.query(`
                SELECT DISTINCT sem.semester_id, sem.semester_name
                FROM exam_seat_allocation esa
                JOIN student_master stm ON stm.student_id = esa.student_id
                JOIN semester_master sem ON sem.semester_id = esa.semester_id
                WHERE esa.plan_id = ?
                  ${programme_id ? 'AND stm.programme_id = ?' : ''}
                ORDER BY sem.semester_id
            `, [plan_id, ...(programme_id ? [programme_id] : [])]);
            res.json({ success:true, semesters });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/slot-branches ─────────────────────
    router.get('/slot-branches', async (req, res) => {
        try {
            const { plan_id, programme_id, semester_id } = req.query;
            const [branches] = await pool.query(`
                SELECT DISTINCT br.branch_id, br.branch_code, br.branch_name
                FROM exam_seat_allocation esa
                JOIN branch_master br ON br.branch_id = esa.branch_id
                JOIN student_master stm ON stm.student_id = esa.student_id
                WHERE esa.plan_id = ?
                  ${programme_id ? 'AND stm.programme_id = ?' : ''}
                  ${semester_id  ? 'AND esa.semester_id = ?'  : ''}
                ORDER BY br.branch_code
            `, [plan_id, ...(programme_id?[programme_id]:[]), ...(semester_id?[semester_id]:[])]);
            res.json({ success:true, branches });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/slot-subjects ─────────────────────
    router.get('/slot-subjects', async (req, res) => {
        try {
            const { plan_id, branch_id, exam_date, session_order } = req.query;
            const [subjects] = await pool.query(`
                SELECT DISTINCT sm.subject_id, sm.subject_name, sm.syllabus_code
                FROM exam_seat_allocation esa
                JOIN subject_master sm ON sm.subject_id = esa.subject_id
                WHERE esa.plan_id = ? AND esa.branch_id = ?
                ORDER BY sm.syllabus_code
            `, [plan_id, branch_id]);
            res.json({ success:true, subjects });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/slot-rooms ────────────────────────
    router.get('/slot-rooms', async (req, res) => {
        try {
            const { plan_id, branch_id, subject_id } = req.query;
            const [rooms] = await pool.query(`
                SELECT DISTINCT rm.room_id, rm.room_code AS room_number,
                    COUNT(esa.seat_id) AS student_count
                FROM exam_seat_allocation esa
                JOIN room_master rm ON rm.room_id = esa.room_id
                WHERE esa.plan_id = ? AND esa.branch_id = ? AND esa.subject_id = ?
                GROUP BY rm.room_id, rm.room_code
                ORDER BY rm.room_code
            `, [plan_id, branch_id, subject_id]);
            res.json({ success:true, rooms });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/subjects-for-slot ─────────────────
    // Get distinct subjects for a date+session from seat allocations
    router.get('/subjects-for-slot', async (req, res) => {
        try {
            const { exam_date, session_order, notification_id } = req.query;

            const where  = [], params = [];
            if (exam_date)     { where.push(`DATE(esa.exam_date)=?`);   params.push(exam_date); }
            if (session_order) { where.push(`esa.session_order=?`);     params.push(session_order); }
            if (notification_id) {
                where.push(`CAST(espn.notification_ref AS CHAR)=?`);
                params.push(notification_id);
            }

            const joinNotif = notification_id
                ? `JOIN exam_seating_plan esp ON esp.plan_id=esa.plan_id
                   JOIN exam_seating_plan_notifications espn ON espn.plan_id=esp.plan_id`
                : '';

            const [subjects] = await pool.query(`
                SELECT DISTINCT sm.subject_id, sm.subject_name, sm.syllabus_code
                FROM exam_seat_allocation esa
                JOIN subject_master sm ON sm.subject_id = esa.subject_id
                ${joinNotif}
                ${where.length ? 'WHERE '+where.join(' AND ') : ''}
                ORDER BY sm.syllabus_code
            `, params);

            res.json({ success:true, subjects });
        } catch(err) {
            console.error('[/transfer/subjects-for-slot]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/source-students ────────────────────
    // Fetch students in a specific room for given filters
    router.get('/source-students', async (req, res) => {
        try {
            const { plan_id, room_id, notification_id,
                    semester_id, branch_id, exam_date,
                    session_order, subject_id } = req.query;

            if (!room_id || !exam_date || !session_order)
                return res.status(400).json({ success:false, error:'room_id, exam_date, session_order required' });

            // Get latest plan for this date+session if not provided
            let planId = plan_id;
            if (!planId) {
                const [[p]] = await pool.query(`
                    SELECT plan_id FROM exam_seating_plan
                    WHERE DATE(exam_date)=? AND session_order=?
                    ORDER BY plan_id DESC LIMIT 1
                `, [exam_date, session_order]);
                planId = p?.plan_id;
            }
            if (!planId)
                return res.status(404).json({ success:false, error:'No seating plan found for this date+session' });

            const where = [`esa.plan_id=?`, `esa.room_id=?`];
            const params = [planId, room_id];

            if (semester_id) { where.push(`esa.semester_id=?`);  params.push(semester_id); }
            if (branch_id)   { where.push(`esa.branch_id=?`);    params.push(branch_id); }
            if (subject_id)  { where.push(`esa.subject_id=?`);   params.push(subject_id); }

            const [students] = await pool.query(`
                SELECT
                    esa.seat_id,
                    esa.student_id,
                    esa.bench_label,
                    esa.row_no,
                    esa.col_no,
                    esa.seat_position,
                    esa.seat_serial,
                    COALESCE(esa.is_blocked,0) AS is_blocked,
                    stm.ht_number        AS roll_no,
                    stm.full_name        AS student_name,
                    br.branch_code,
                    sec.section_name,
                    sem.semester_name,
                    sm.syllabus_code     AS subject_code,
                    sm.subject_name
                FROM exam_seat_allocation esa
                LEFT JOIN student_master  stm ON stm.student_id  = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id    = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id   = esa.subject_id
                LEFT JOIN section_master  sec ON sec.section_id  = stm.section_id
                WHERE ${where.join(' AND ')}
                ORDER BY esa.seat_serial
            `, params);

            // Room info
            const [[room]] = await pool.query(`
                SELECT rm.*,
                    bm.block_code,
                    (SELECT COUNT(*) FROM exam_seat_allocation
                     WHERE plan_id=? AND room_id=rm.room_id) AS used_seats
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id=rm.block_id
                WHERE rm.room_id=?
            `, [planId, room_id]);

            // Actual capacity from layout_data (available benches × spb)
            let actualCap = room?.total_capacity || 0;
            try {
                const ld = typeof room.layout_data === 'string'
                    ? JSON.parse(room.layout_data) : (room.layout_data || {});
                if (ld.benches?.length) {
                    actualCap = ld.benches.filter(b => b.available !== false).length
                                * (room.students_per_bench || 2);
                }
            } catch(_) {}
            if (room) room.actual_capacity = actualCap;

            res.json({
                success:  true,
                plan_id:  planId,
                students,
                room,
                total:    students.length
            });

        } catch(err) {
            console.error('[/transfer/source-students]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/free-rooms ─────────────────────────
    router.get('/free-rooms', async (req, res) => {
        try {
            const { exam_date, session_order, plan_id, exclude_room_id } = req.query;

            const [rooms] = await pool.query(`
                SELECT
                    rm.room_id,
                    rm.room_code AS room_number,
                    rm.room_name,
                    rm.total_rows,
                    rm.total_columns,
                    rm.students_per_bench,
                    rm.total_capacity,
                    rm.layout_data,
                    bm.block_code,
                    bm.block_name,
                    -- Students in THIS plan for this room
                    COUNT(DISTINCT CASE WHEN esa.plan_id=? THEN esa.seat_id END) AS this_plan_used,
                    -- Students in OTHER plans for same date+session
                    COUNT(DISTINCT CASE WHEN esa2.seat_id IS NOT NULL THEN esa2.seat_id END) AS other_plans_used
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN exam_seat_allocation esa
                    ON esa.room_id = rm.room_id AND esa.plan_id = ?
                LEFT JOIN exam_seat_allocation esa2
                    ON esa2.room_id = rm.room_id
                    AND esa2.plan_id != ?
                    AND esa2.plan_id IN (
                        SELECT plan_id FROM exam_seating_plan
                        WHERE DATE(exam_date)=? AND session_order=?
                    )
                WHERE rm.is_active=1 AND rm.deleted_at IS NULL
                  ${exclude_room_id ? 'AND rm.room_id != '+parseInt(exclude_room_id) : ''}
                GROUP BY rm.room_id, rm.room_code, rm.room_name,
                    rm.total_rows, rm.total_columns, rm.students_per_bench,
                    rm.total_capacity, rm.layout_data,
                    bm.block_code, bm.block_name
                ORDER BY bm.block_code, rm.room_code
            `, [plan_id||0, plan_id||0, plan_id||0, exam_date||'1970-01-01', session_order||1]);

            // Calculate actual usable capacity from layout_data
            const result = rooms.map(r => {
                let actualCap = r.total_capacity;
                try {
                    const ld = typeof r.layout_data === 'string'
                        ? JSON.parse(r.layout_data) : (r.layout_data || {});
                    if (ld.benches?.length) {
                        const availBenches = ld.benches.filter(b => b.available !== false).length;
                        actualCap = availBenches * (r.students_per_bench || 2);
                    }
                } catch(_) {}

                const totalUsed  = r.this_plan_used + r.other_plans_used;
                const freeSeats  = Math.max(0, actualCap - totalUsed);

                return {
                    ...r,
                    actual_capacity:  actualCap,
                    this_plan_used:   r.this_plan_used,
                    other_plans_used: r.other_plans_used,
                    total_used:       totalUsed,
                    free_seats:       freeSeats
                };
            });

            res.json({ success:true, rooms:result, total:result.length });

        } catch(err) {
            console.error('[/transfer/free-rooms]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/transfer/target-students ───────────────────
    // Students already in target room
    router.get('/target-students', async (req, res) => {
        try {
            const { plan_id, room_id } = req.query;
            if (!plan_id || !room_id)
                return res.status(400).json({ success:false, error:'plan_id and room_id required' });

            const [students] = await pool.query(`
                SELECT esa.seat_id, esa.student_id,
                    esa.bench_label, esa.row_no, esa.col_no,
                    esa.seat_position, esa.seat_serial,
                    stm.ht_number AS roll_no, stm.full_name AS student_name,
                    br.branch_code, sm.syllabus_code AS subject_code
                FROM exam_seat_allocation esa
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                WHERE esa.plan_id=? AND esa.room_id=?
                ORDER BY esa.seat_serial
            `, [plan_id, room_id]);

            const [[room]] = await pool.query(`
                SELECT rm.*, bm.block_code,
                    (SELECT COUNT(*) FROM exam_seat_allocation
                     WHERE plan_id=? AND room_id=rm.room_id) AS used_seats
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id=rm.block_id
                WHERE rm.room_id=?
            `, [plan_id, room_id]);

            res.json({ success:true, students, room, total:students.length });

        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── POST /api/transfer/execute ───────────────────────────
    // Execute the transfer: move students from source room to target room
    // Auto-assigns next available bench in target room
    router.post('/execute', async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const { plan_id, from_room_id, to_room_id,
                    student_ids, exam_date, session_order,
                    reason, transferred_by } = req.body;

            if (!plan_id || !from_room_id || !to_room_id || !student_ids?.length)
                return res.status(400).json({ success:false, error:'Missing required fields' });

            if (from_room_id === to_room_id)
                return res.status(400).json({ success:false, error:'Source and target rooms cannot be the same' });

            await conn.beginTransaction();

            // Get target room layout to find available benches
            const [[targetRoom]] = await conn.query(`
                SELECT rm.*, bm.block_code
                FROM room_master rm
                LEFT JOIN block_master bm ON bm.block_id=rm.block_id
                WHERE rm.room_id=?
            `, [to_room_id]);

            // Get already occupied seats in target room
            const [occupiedSeats] = await conn.query(`
                SELECT bench_label, row_no, col_no, seat_position
                FROM exam_seat_allocation
                WHERE plan_id=? AND room_id=?
                ORDER BY seat_serial
            `, [plan_id, to_room_id]);

            const occupiedSet = new Set(
                occupiedSeats.map(s => `${s.col_no}_${s.row_no}_${s.seat_position}`)
            );

            // Build available bench slots from layout_data
            let allBenches = [];
            try {
                const ld = typeof targetRoom.layout_data === 'string'
                    ? JSON.parse(targetRoom.layout_data) : (targetRoom.layout_data || {});
                if (ld.benches?.length) {
                    allBenches = ld.benches
                        .filter(b => b.available !== false)
                        .sort((a,b) => a.col-b.col || a.row-b.row);
                }
            } catch(_) {}

            // If no layout_data, generate default grid
            if (!allBenches.length) {
                const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const cols  = targetRoom.total_columns || 4;
                const rows  = targetRoom.total_rows    || 7;
                for (let r=0; r<rows; r++)
                    for (let c=1; c<=cols; c++)
                        allBenches.push({ col:c, row:r+1, label:`${ALPHA[r]}${c}`, available:true });
            }

            // Build full slot list (each bench × students_per_bench positions)
            const spb = targetRoom.students_per_bench || 2;
            const allSlots = [];
            for (const bench of allBenches) {
                for (let pos=1; pos<=spb; pos++) {
                    allSlots.push({ col:bench.col, row:bench.row, pos, label:bench.label });
                }
            }

            // Filter out occupied slots
            const freeSlots = allSlots.filter(sl =>
                !occupiedSet.has(`${sl.col}_${sl.row}_${sl.pos}`)
            );

            if (freeSlots.length < student_ids.length) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    error: `Not enough seats in target room. Need ${student_ids.length}, only ${freeSlots.length} available.`
                });
            }

            // Get current max seat_serial in target room
            const [[maxSerial]] = await conn.query(`
                SELECT COALESCE(MAX(seat_serial),0) AS max_s
                FROM exam_seat_allocation WHERE plan_id=? AND room_id=?
            `, [plan_id, to_room_id]);
            let nextSerial = maxSerial.max_s + 1;

            // Get source students' current bench info for log
            const ph = student_ids.map(()=>'?').join(',');
            const [sourceStudents] = await conn.query(`
                SELECT esa.seat_id, esa.student_id, esa.bench_label,
                    stm.ht_number AS roll_no
                FROM exam_seat_allocation esa
                LEFT JOIN student_master stm ON stm.student_id = esa.student_id
                WHERE esa.plan_id=? AND esa.room_id=? AND esa.student_id IN (${ph})
            `, [plan_id, from_room_id, ...student_ids]);

            const fromBenchMap = {};
            sourceStudents.forEach(s => { fromBenchMap[s.student_id] = s.bench_label; });

            // Execute transfers
            const transferLog = [];
            for (let i=0; i<student_ids.length; i++) {
                const sid  = student_ids[i];
                const slot = freeSlots[i];

                // Update seat allocation
                await conn.query(`
                    UPDATE exam_seat_allocation
                    SET room_id=?, bench_label=?, row_no=?, col_no=?,
                        seat_position=?, seat_serial=?
                    WHERE plan_id=? AND student_id=? AND room_id=?
                `, [to_room_id, slot.label, slot.row, slot.col,
                    slot.pos, nextSerial++,
                    plan_id, sid, from_room_id]);

                transferLog.push([
                    plan_id, sid,
                    fromBenchMap[sid] || '—',
                    to_room_id, slot.label,
                    from_room_id,
                    sourceStudents.find(s=>s.student_id===sid)?.roll_no || '',
                    exam_date, session_order,
                    reason || null,
                    transferred_by || 'Admin'
                ]);
            }

            // Insert transfer logs
            await conn.query(`
                INSERT INTO exam_transfer_log
                    (plan_id, student_id, from_bench, to_room_id, to_bench,
                     from_room_id, roll_no, exam_date, session_order, reason, transferred_by)
                VALUES ?
            `, [transferLog]);

            await conn.commit();

            res.json({
                success:    true,
                transferred: student_ids.length,
                to_room:    targetRoom.room_code,
                message:    `${student_ids.length} student(s) transferred to ${targetRoom.room_code}`
            });

        } catch(err) {
            await conn.rollback();
            console.error('[/transfer/execute]', err.message);
            res.status(500).json({ success:false, error:err.message });
        } finally {
            conn.release();
        }
    });

    return router;
}

module.exports = { initializeRouter };
