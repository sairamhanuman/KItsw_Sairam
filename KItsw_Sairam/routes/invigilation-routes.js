const express = require('express');

function initializeRouter(pool) {
    const router = express.Router();

    // ── GET /api/invigilation/session-status ─────────────────
    router.get('/session-status', async (req, res) => {
        try {
            // Convert to IST (UTC+5:30)
            const now     = new Date();
            const istOffset = 5.5 * 60 * 60 * 1000;
            const ist     = new Date(now.getTime() + istOffset);
            const todayDs = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth()+1).padStart(2,'0')}-${String(ist.getUTCDate()).padStart(2,'0')}`;
            const nowMins = ist.getUTCHours() * 60 + ist.getUTCMinutes();

            console.log(`[session-status] IST time: ${ist.toISOString()} → ${nowMins} mins`);

            const [sessions] = await pool.query(
                `SELECT session_name,
                    MIN(start_time) AS start_time,
                    MIN(end_time)   AS end_time,
                    CASE WHEN session_name='FN' THEN 1
                         WHEN session_name='AN' THEN 2
                         ELSE 3 END AS session_order
                 FROM sessions_master
                 WHERE is_active=1 AND session_type='Regular'
                 GROUP BY session_name,
                    CASE WHEN session_name='FN' THEN 1
                         WHEN session_name='AN' THEN 2
                         ELSE 3 END
                 ORDER BY MIN(start_time)`
            );

            let active = null, next = null;

            for (const s of sessions) {
                const [sh,sm] = s.start_time.split(':').map(Number);
                const [eh,em] = s.end_time.split(':').map(Number);
                const startMins = sh*60+sm;
                const endMins   = eh*60+em;
                const openMins  = startMins - 10;

                console.log(`[session-status] ${s.session_name}: open@${openMins}, end@${endMins}, now=${nowMins}`);

                if (nowMins >= openMins && nowMins <= endMins) {
                    active = { ...s, open_at:openMins, today:todayDs };
                    break;
                }
                if (nowMins < openMins && !next) {
                    next = { ...s, opens_in_mins:openMins-nowMins, today:todayDs };
                }
            }

            res.json({ success:true, active, next, today:todayDs, now_mins:nowMins });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── POST /api/invigilation/verify-pin ────────────────────
    router.post('/verify-pin', async (req, res) => {
        try {
            const { pin } = req.body;
            const [[cfg]] = await pool.query(`SELECT pin_code FROM exam_invigilation_config WHERE id=1`);
            const ok = cfg && cfg.pin_code === String(pin);
            res.json({ success:ok, error:ok?null:'Invalid PIN' });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/invigilation/rooms ──────────────────────────
    router.get('/rooms', async (req, res) => {
        try {
            const { exam_date, session_order } = req.query;

            const [rooms] = await pool.query(`
                SELECT DISTINCT
                    rm.room_id, rm.room_code AS room_number, rm.room_name,
                    rm.total_rows, rm.total_columns, rm.students_per_bench,
                    bm.block_id, bm.block_code, bm.block_name,
                    esp.plan_id,
                    COUNT(DISTINCT esa.student_id) AS student_count,
                    MAX(CASE WHEN ea.id IS NOT NULL THEN 1 ELSE 0 END) AS is_submitted,
                    MAX(ea.version) AS last_version,
                    MAX(ea.updated_at) AS last_submitted_at
                FROM exam_seating_plan esp
                JOIN exam_seating_plan_rooms espr ON espr.plan_id = esp.plan_id
                JOIN room_master rm ON rm.room_id = espr.room_id
                LEFT JOIN block_master bm ON bm.block_id = rm.block_id
                LEFT JOIN exam_seat_allocation esa
                    ON esa.plan_id = esp.plan_id AND esa.room_id = rm.room_id
                LEFT JOIN exam_attendance ea
                    ON ea.room_id = rm.room_id
                    AND DATE(ea.exam_date) = ?
                    AND ea.session_order = ?
                    AND ea.source = 'Invigilation'
                WHERE DATE(esp.exam_date) = ?
                  AND esp.session_order   = ?
                GROUP BY rm.room_id, rm.room_code, rm.room_name,
                    rm.total_rows, rm.total_columns, rm.students_per_bench,
                    bm.block_id, bm.block_code, bm.block_name, esp.plan_id
                HAVING esp.plan_id = (
                    SELECT MAX(plan_id) FROM exam_seating_plan
                    WHERE DATE(exam_date) = ? AND session_order = ?
                )
                ORDER BY bm.block_code, rm.room_code
            `, [exam_date, session_order, exam_date, session_order, exam_date, session_order]);

            const blocks = {};
            for (const r of rooms) {
                const bk = r.block_code || 'Other';
                if (!blocks[bk]) blocks[bk] = { block_code:bk, block_name:r.block_name, rooms:[] };
                blocks[bk].rooms.push(r);
            }

            res.json({ success:true, blocks:Object.values(blocks), total_rooms:rooms.length });
        } catch(err) {
            console.error('[/invigilation/rooms]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/invigilation/students/:planId/:roomId ───────
    router.get('/students/:planId/:roomId', async (req, res) => {
        try {
            const { planId, roomId } = req.params;
            const { exam_date, session_order } = req.query;

            const [students] = await pool.query(`
                SELECT
                    esa.seat_serial, esa.bench_label, esa.student_id,
                    stm.ht_number    AS roll_no,
                    stm.full_name    AS student_name,
                    br.branch_id, br.branch_code, br.branch_name,
                    sec.section_name,
                    sem.semester_id, sem.semester_name,
                    sm.subject_id,
                    sm.syllabus_code AS subject_code,
                    sm.subject_name,
                    stm.programme_id,
                    COALESCE(ea.status, 'Present') AS attendance_status,
                    ea.source AS attendance_source
                FROM exam_seat_allocation esa
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                LEFT JOIN section_master  sec ON sec.section_id = stm.section_id
                LEFT JOIN (
                    -- Manual entry wins over Invigilation
                    SELECT student_id,
                        COALESCE(
                            MAX(CASE WHEN source='Manual' THEN status END),
                            MAX(CASE WHEN source='Invigilation' THEN status END)
                        ) AS status,
                        MAX(source) AS source
                    FROM exam_attendance
                    WHERE DATE(exam_date) = ? AND session_order = ?
                    GROUP BY student_id
                ) ea ON ea.student_id = esa.student_id
                WHERE esa.plan_id = ? AND esa.room_id = ?
                  AND COALESCE(esa.is_blocked, 0) = 0
                ORDER BY br.branch_code, sec.section_id, stm.ht_number
            `, [exam_date, session_order, planId, roomId]);

            res.json({ success:true, students, total:students.length });
        } catch(err) {
            console.error('[/invigilation/students]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── POST /api/invigilation/submit ────────────────────────
    // Saves ALL students (Present + Absent) to exam_attendance
    router.post('/submit', async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const { plan_id, room_id, exam_date, session_order, entries, submitted_by } = req.body;

            await conn.beginTransaction();

            // Get next version for this room+date
            const [[vRow]] = await conn.query(`
                SELECT COALESCE(MAX(version),0)+1 AS next_v
                FROM exam_attendance
                WHERE room_id=? AND DATE(exam_date)=? AND session_order=? AND source='Invigilation'
            `, [room_id, exam_date, session_order]);
            const version = vRow.next_v;

            // Delete previous Invigilation entries for this room (replace with new version)
            await conn.query(`
                DELETE FROM exam_attendance
                WHERE room_id=? AND DATE(exam_date)=? AND session_order=? AND source='Invigilation'
            `, [room_id, exam_date, session_order]);

            // Insert all students with their status
            if (entries?.length) {
                const rows = entries.map(e => [
                    exam_date, session_order, plan_id, room_id,
                    e.student_id, e.roll_no,
                    e.subject_id||null, e.subject_code||null, e.subject_name||null,
                    e.branch_id||null, e.semester_id||null, e.programme_id||null,
                    e.status, 'Invigilation', version, submitted_by||'Invigilator'
                ]);
                await conn.query(`
                    INSERT INTO exam_attendance
                        (exam_date, session_order, plan_id, room_id,
                         student_id, roll_no, subject_id, subject_code, subject_name,
                         branch_id, semester_id, programme_id,
                         status, source, version, entered_by)
                    VALUES ?
                `, [rows]);
            }

            await conn.commit();

            const absent = entries.filter(e => e.status !== 'Present');
            res.json({
                success:      true,
                version,
                total:        entries.length,
                present:      entries.filter(e => e.status === 'Present').length,
                absent:       absent.length,
                absent_rolls: absent.map(e => e.roll_no)
            });

        } catch(err) {
            await conn.rollback();
            console.error('[/invigilation/submit]', err.message);
            res.status(500).json({ success:false, error:err.message });
        } finally {
            conn.release();
        }
    });

    // ── GET /api/invigilation/dform/:planId ──────────────────
    // Returns data needed to generate D-Form PDF
    router.get('/dform/:planId', async (req, res) => {
        try {
            const planId = req.params.planId;

            // Plan + notification info
            const [[plan]] = await pool.query(`
                SELECT esp.*,
                    GROUP_CONCAT(DISTINCT espn.notification_ref SEPARATOR ',') AS notif_refs
                FROM exam_seating_plan esp
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esp.plan_id
                WHERE esp.plan_id = ?
                GROUP BY esp.plan_id
            `, [planId]);
            if (!plan) return res.status(404).json({ error:'Plan not found' });

            // Notification details
            let notif = null;
            if (plan.notif_refs) {
                const firstRef = plan.notif_refs.split(',')[0].trim();
                const [[nd]] = await pool.query(`
                    SELECT en.*,
                        pm.programme_name,
                        mym.display_name AS month_year_display,
                        sm.session_name, sm.start_time, sm.end_time
                    FROM exam_notifications en
                    LEFT JOIN programme_master  pm  ON pm.programme_id   = en.programme_id
                    LEFT JOIN month_year_master mym ON mym.month_year_id = en.month_year_id
                    LEFT JOIN sessions_master   sm  ON sm.session_id     = en.session_id
                    WHERE en.notification_id = ?
                `, [firstRef]).catch(()=>[[null]]);
                notif = nd;
            }

            // All students in this plan with their attendance status
            const [rows] = await pool.query(`
                SELECT
                    esa.student_id,
                    stm.ht_number       AS roll_no,
                    stm.full_name       AS student_name,
                    stm.programme_id,
                    pm.programme_name,
                    br.branch_id, br.branch_code, br.branch_name,
                    sec.section_name,
                    sem.semester_id, sem.semester_name,
                    sm.subject_id, sm.syllabus_code AS subject_code,
                    sm.subject_name,
                    -- Final status: Manual wins over Invigilation
                    COALESCE(
                        (SELECT status FROM exam_attendance
                         WHERE student_id = esa.student_id
                           AND DATE(exam_date) = DATE(?)
                           AND session_order = ?
                           AND source = 'Manual'
                         LIMIT 1),
                        (SELECT status FROM exam_attendance
                         WHERE student_id = esa.student_id
                           AND DATE(exam_date) = DATE(?)
                           AND session_order = ?
                           AND source = 'Invigilation'
                         ORDER BY version DESC LIMIT 1),
                        'Present'
                    ) AS final_status
                FROM exam_seat_allocation esa
                LEFT JOIN student_master  stm ON stm.student_id = esa.student_id
                LEFT JOIN branch_master   br  ON br.branch_id   = esa.branch_id
                LEFT JOIN semester_master sem ON sem.semester_id = esa.semester_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = esa.subject_id
                LEFT JOIN section_master  sec ON sec.section_id = stm.section_id
                LEFT JOIN programme_master pm ON pm.programme_id = stm.programme_id
                WHERE esa.plan_id = ?
                  AND COALESCE(esa.is_blocked, 0) = 0
                ORDER BY pm.programme_name, br.branch_code, sec.section_id, stm.ht_number
            `, [plan.exam_date, plan.session_order, plan.exam_date, plan.session_order, planId]);

            // Group: programme → branch+section+subject → students[]
            const groups = {};
            for (const r of rows) {
                const secNum  = r.section_name ? r.section_name.replace('Sec-','') : '';
                const brLabel = r.branch_code + (secNum ? `-${secNum}` : '');
                const gk      = `${r.programme_name}||${brLabel}||${r.subject_code}`;

                if (!groups[gk]) {
                    groups[gk] = {
                        programme:    r.programme_name || 'B.TECH',
                        branch_label: brLabel,
                        branch_name:  r.branch_name,
                        semester:     r.semester_name,
                        subject_code: r.subject_code,
                        subject_name: r.subject_name,
                        students:     []
                    };
                }
                groups[gk].students.push({
                    roll_no: r.roll_no,
                    name:    r.student_name,
                    status:  r.final_status
                });
            }

            const sections = Object.values(groups).map(g => {
                const absent      = g.students.filter(s => s.status === 'Absent').length;
                const malpractice = g.students.filter(s => s.status === 'Malpractice').length;
                return {
                    ...g,
                    total:       g.students.length,
                    present:     g.students.length - absent - malpractice,
                    absent,
                    malpractice
                };
            });

            res.json({
                success: true,
                plan,
                notif,
                sections
            });

        } catch(err) {
            console.error('[/dform]', err.message);
            res.status(500).json({ error:err.message });
        }
    });


    return router;
}

module.exports = { initializeRouter };
