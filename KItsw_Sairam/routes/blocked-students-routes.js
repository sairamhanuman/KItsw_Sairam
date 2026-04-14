// ============================================================
// blocked-students-routes.js
// Professional soft-block system:
//   1. Saves to exam_blocked_students registry
//   2. Updates exam_seat_allocation.is_blocked (existing plans)
//   3. Updates exam_student_entries.is_blocked (attendance/dform)
//   All exports filter WHERE is_blocked = 0 automatically
// ============================================================

const express = require('express');

function initializeRouter(pool) {
    const router = express.Router();

    // ── GET /api/blocked-students/students ───────────────────
    // Fetch all students for given filters with block status
    router.get('/students', async (req, res) => {
        try {
            const { notification_id, programme_id, semester_id,
                    branch_id, exam_date, session_order } = req.query;

            const where = [], params = [];
            if (notification_id) {
                where.push(`CAST(ese.notification_ref AS CHAR) = ?`);
                params.push(notification_id);
            }
            if (semester_id)   { where.push(`ese.semester_id = ?`);     params.push(semester_id); }
            if (branch_id)     { where.push(`ese.branch_id = ?`);       params.push(branch_id); }
            if (exam_date)     { where.push(`DATE(ese.exam_date) = ?`); params.push(exam_date); }
            if (session_order) { where.push(`ese.session_order = ?`);   params.push(session_order); }
            if (programme_id)  { where.push(`stm.programme_id = ?`);    params.push(programme_id); }

            const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

            const [students] = await pool.query(`
                SELECT DISTINCT
                    ese.student_id,
                    stm.ht_number        AS roll_no,
                    stm.full_name        AS student_name,
                    stm.programme_id,
                    br.branch_id,
                    br.branch_code,
                    br.branch_name,
                    sec.section_name,
                    sem.semester_id,
                    sem.semester_name,
                    sm.subject_id,
                    sm.syllabus_code     AS subject_code,
                    sm.subject_name,
                    DATE_FORMAT(ese.exam_date,'%Y-%m-%d') AS exam_date,
                    ese.session_order,
                    -- Block status from registry
                    COALESCE(MAX(ebs.is_active), 0) AS is_blocked,
                    MAX(ebs.reason)                  AS block_reason,
                    MAX(ebs.reason_note)             AS block_note,
                    MAX(ebs.id)                      AS block_id
                FROM exam_student_entries ese
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = ese.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = ese.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN section_master  sec ON sec.section_id = stm.section_id
                LEFT JOIN exam_blocked_students ebs
                    ON ebs.student_id = ese.student_id
                    AND ebs.is_active = 1
                    AND (
                        (ebs.notification_id IS NOT NULL
                         AND CAST(ebs.notification_id AS CHAR) = CAST(ese.notification_ref AS CHAR))
                        OR
                        (ebs.exam_date IS NOT NULL
                         AND DATE(ebs.exam_date) = DATE(ese.exam_date)
                         AND ebs.session_order   = ese.session_order)
                    )
                ${whereSQL}
                GROUP BY ese.student_id, stm.ht_number, stm.full_name, stm.programme_id,
                    br.branch_id, br.branch_code, br.branch_name, sec.section_name,
                    sem.semester_id, sem.semester_name, sm.subject_id,
                    sm.syllabus_code, sm.subject_name, ese.exam_date, ese.session_order
                ORDER BY stm.ht_number
            `, params);

            res.json({ success:true, students, total:students.length });

        } catch(err) {
            console.error('[/blocked-students/students]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── POST /api/blocked-students/save ─────────────────────
    // Professional save:
    //   1. Upsert exam_blocked_students registry
    //   2. Soft-block in exam_seat_allocation (existing plans)
    //   3. Soft-block in exam_student_entries (attendance/dform)
    router.post('/save', async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const { notification_id, programme_id, semester_id, branch_id,
                    exam_date, session_order, blocked, unblocked } = req.body;

            await conn.beginTransaction();

            const summary = { newly_blocked:0, newly_unblocked:0,
                              seat_alloc_updated:0, student_entries_updated:0 };

            // ── STEP 1: Deactivate ALL existing blocks for this scope ──
            const delWhere = [], delParams = [];
            if (notification_id) {
                delWhere.push(`notification_id = ?`);
                delParams.push(notification_id);
            } else {
                if (exam_date)     { delWhere.push(`DATE(exam_date) = ?`); delParams.push(exam_date); }
                if (session_order) { delWhere.push(`session_order = ?`);   delParams.push(session_order); }
                if (semester_id)   { delWhere.push(`semester_id = ?`);     delParams.push(semester_id); }
                if (branch_id)     { delWhere.push(`branch_id = ?`);       delParams.push(branch_id); }
            }

            if (delWhere.length) {
                await conn.query(
                    `UPDATE exam_blocked_students SET is_active=0
                     WHERE ${delWhere.join(' AND ')}`,
                    delParams
                );
            }

            // ── STEP 2: Insert/activate new blocked list ───────────────
            if (blocked?.length) {
                const rows = blocked.map(b => [
                    notification_id || null,
                    b.student_id, b.roll_no,
                    b.subject_id || null, b.subject_code || null, b.subject_name || null,
                    exam_date || null, session_order || null,
                    semester_id || null, branch_id || null, programme_id || null,
                    b.reason || 'Other', b.reason_note || null,
                    'Admin', 1
                ]);

                await conn.query(`
                    INSERT INTO exam_blocked_students
                        (notification_id, student_id, roll_no,
                         subject_id, subject_code, subject_name,
                         exam_date, session_order,
                         semester_id, branch_id, programme_id,
                         reason, reason_note, blocked_by, is_active)
                    VALUES ?
                `, [rows]);

                summary.newly_blocked = blocked.length;
            }

            // ── STEP 3: Soft-block in exam_seat_allocation ─────────────
            // Mark blocked students in any existing seating plans
            if (blocked?.length || unblocked?.length) {
                const blockedIds   = (blocked   || []).map(b => b.student_id);
                const unblockedIds = (unblocked || []).map(b => b.student_id);

                // Build scope WHERE for seat allocation
                const scopeWhere = [], scopeParams = [];
                if (exam_date)     { scopeWhere.push(`DATE(esa.exam_date) = ?`); scopeParams.push(exam_date); }
                if (session_order) { scopeWhere.push(`esa.session_order = ?`);   scopeParams.push(session_order); }
                if (notification_id) {
                    scopeWhere.push(`CAST(espn.notification_ref AS CHAR) = ?`);
                    scopeParams.push(notification_id);
                }
                const scopeJoin = notification_id
                    ? `JOIN exam_seating_plan esp ON esp.plan_id = esa.plan_id
                       JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id`
                    : '';

                // Block
                if (blockedIds.length) {
                    const ph = blockedIds.map(()=>'?').join(',');
                    const blockReason = (blocked[0]?.reason || 'Blocked') +
                        (blocked[0]?.reason_note ? `: ${blocked[0].reason_note}` : '');

                    const [r1] = await conn.query(`
                        UPDATE exam_seat_allocation esa
                        ${scopeJoin}
                        SET esa.is_blocked=1, esa.block_reason=?
                        WHERE esa.student_id IN (${ph})
                        ${scopeWhere.length ? 'AND ' + scopeWhere.join(' AND ') : ''}
                    `, [blockReason, ...blockedIds, ...scopeParams]);
                    summary.seat_alloc_updated += r1.affectedRows;

                    // Also update exam_student_entries
                    const entryWhere = [], entryParams = [];
                    if (notification_id) {
                        entryWhere.push(`CAST(ese.notification_ref AS CHAR) = ?`);
                        entryParams.push(notification_id);
                    }
                    if (exam_date)     { entryWhere.push(`DATE(ese.exam_date) = ?`); entryParams.push(exam_date); }
                    if (session_order) { entryWhere.push(`ese.session_order = ?`);   entryParams.push(session_order); }

                    const [r2] = await conn.query(`
                        UPDATE exam_student_entries ese
                        SET ese.is_blocked=1, ese.block_reason=?
                        WHERE ese.student_id IN (${ph})
                        ${entryWhere.length ? 'AND ' + entryWhere.join(' AND ') : ''}
                    `, [blockReason, ...blockedIds, ...entryParams]);
                    summary.student_entries_updated += r2.affectedRows;
                }

                // Unblock
                if (unblockedIds.length) {
                    const ph = unblockedIds.map(()=>'?').join(',');

                    await conn.query(`
                        UPDATE exam_seat_allocation esa
                        ${scopeJoin}
                        SET esa.is_blocked=0, esa.block_reason=NULL
                        WHERE esa.student_id IN (${ph})
                        ${scopeWhere.length ? 'AND ' + scopeWhere.join(' AND ') : ''}
                    `, [...unblockedIds, ...scopeParams]);

                    const entryWhere = [], entryParams = [];
                    if (notification_id) {
                        entryWhere.push(`CAST(ese.notification_ref AS CHAR) = ?`);
                        entryParams.push(notification_id);
                    }
                    if (exam_date)     { entryWhere.push(`DATE(ese.exam_date) = ?`); entryParams.push(exam_date); }
                    if (session_order) { entryWhere.push(`ese.session_order = ?`);   entryParams.push(session_order); }

                    await conn.query(`
                        UPDATE exam_student_entries ese
                        SET ese.is_blocked=0, ese.block_reason=NULL
                        WHERE ese.student_id IN (${ph})
                        ${entryWhere.length ? 'AND ' + entryWhere.join(' AND ') : ''}
                    `, [...unblockedIds, ...entryParams]);

                    summary.newly_unblocked = unblockedIds.length;
                }
            }

            await conn.commit();

            console.log(`[/blocked-students/save] Blocked:${summary.newly_blocked} Unblocked:${summary.newly_unblocked} SeatAlloc:${summary.seat_alloc_updated} Entries:${summary.student_entries_updated}`);

            res.json({ success:true, summary });

        } catch(err) {
            await conn.rollback();
            console.error('[/blocked-students/save]', err.message);
            res.status(500).json({ success:false, error:err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET /api/blocked-students ────────────────────────────
    // Get blocked students list for a scope
    router.get('/', async (req, res) => {
        try {
            const { notification_id, semester_id, branch_id, exam_date, session_order } = req.query;
            const where = [], params = [];

            where.push(`ebs.is_active = 1`);
            if (notification_id) { where.push(`CAST(ebs.notification_id AS CHAR) = ?`); params.push(notification_id); }
            if (semester_id)     { where.push(`ebs.semester_id = ?`); params.push(semester_id); }
            if (branch_id)       { where.push(`ebs.branch_id = ?`);   params.push(branch_id); }
            if (exam_date)       { where.push(`DATE(ebs.exam_date) = ?`); params.push(exam_date); }
            if (session_order)   { where.push(`ebs.session_order = ?`);   params.push(session_order); }

            const [blocked] = await pool.query(`
                SELECT ebs.*,
                    stm.full_name AS student_name,
                    br.branch_code, sem.semester_name
                FROM exam_blocked_students ebs
                LEFT JOIN student_master  stm ON stm.student_id  = ebs.student_id
                LEFT JOIN branch_master   br  ON br.branch_id    = ebs.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = ebs.semester_id
                WHERE ${where.join(' AND ')}
                ORDER BY ebs.roll_no
            `, params);

            res.json({ success:true, blocked, total:blocked.length });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
