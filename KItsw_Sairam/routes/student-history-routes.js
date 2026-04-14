const express = require('express');

function initializeRouter(pool) {
    const router = express.Router();

    // ── GET /api/student-history/search?q= ──────────────────
    router.get('/search', async (req, res) => {
        try {
            const { q } = req.query;
            if (!q || q.length < 2)
                return res.json({ success:true, students:[] });

            const [students] = await pool.query(`
                SELECT
                    stm.student_id,
                    stm.ht_number    AS roll_no,
                    stm.full_name    AS student_name,
                    stm.photo_url,
                    br.branch_code,
                    br.branch_name,
                    sem.semester_name,
                    pm.programme_name,
                    bm.batch_name,
                    sec.section_name,
                    stm.student_status,
                    stm.gender
                FROM student_master stm
                LEFT JOIN branch_master    br  ON br.branch_id    = stm.branch_id
                LEFT JOIN semester_master  sem ON sem.semester_id = stm.semester_id
                LEFT JOIN programme_master pm  ON pm.programme_id = stm.programme_id
                LEFT JOIN batch_master     bm  ON bm.batch_id     = stm.batch_id
                LEFT JOIN section_master   sec ON sec.section_id  = stm.section_id
                WHERE stm.ht_number   LIKE ?
                   OR stm.full_name   LIKE ?
                   OR stm.roll_number LIKE ?
                ORDER BY stm.ht_number
                LIMIT 10
            `, [`%${q}%`, `%${q}%`, `%${q}%`]);

            res.json({ success:true, students });
        } catch(err) {
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/student-history/:studentId ──────────────────
    router.get('/:studentId', async (req, res) => {
        try {
            const { studentId } = req.params;

            // Student profile
            const [[student]] = await pool.query(`
                SELECT
                    stm.*,
                    br.branch_code, br.branch_name,
                    sem.semester_name,
                    pm.programme_name,
                    bm.batch_name,
                    sec.section_name,
                    reg.regulation_name
                FROM student_master stm
                LEFT JOIN branch_master    br  ON br.branch_id      = stm.branch_id
                LEFT JOIN semester_master  sem ON sem.semester_id   = stm.semester_id
                LEFT JOIN programme_master pm  ON pm.programme_id   = stm.programme_id
                LEFT JOIN batch_master     bm  ON bm.batch_id       = stm.batch_id
                LEFT JOIN section_master   sec ON sec.section_id    = stm.section_id
                LEFT JOIN regulation_master reg ON reg.regulation_id = stm.current_regulation_id
                WHERE stm.student_id = ?
            `, [studentId]);

            if (!student) return res.status(404).json({ success:false, error:'Student not found' });

            // Exam history from seat allocation
            const [history] = await pool.query(`
                SELECT
                    esa.seat_id,
                    esa.plan_id,
                    esa.room_id,
                    esa.bench_label,
                    esa.seat_position,
                    esa.seat_serial,
                    esa.exam_date,
                    esa.session_order,
                    COALESCE(esa.is_blocked, 0) AS is_blocked,
                    esa.block_reason,
                    rm.room_code  AS room_number,
                    bm.block_code,
                    sm.subject_id,
                    sm.syllabus_code  AS subject_code,
                    sm.subject_name,
                    en.notification_id,
                    en.notification_title,
                    en.exam_type,
                    en.exam_name_id,
                    mym.display_name AS month_year_display,
                    ses.session_name,
                    -- Attendance status (Manual wins over Invigilation)
                    COALESCE(
                        (SELECT status FROM exam_attendance
                         WHERE student_id = esa.student_id
                           AND DATE(exam_date) = DATE(esa.exam_date)
                           AND session_order   = esa.session_order
                           AND source = 'Manual'
                         LIMIT 1),
                        (SELECT status FROM exam_attendance
                         WHERE student_id = esa.student_id
                           AND DATE(exam_date) = DATE(esa.exam_date)
                           AND session_order   = esa.session_order
                           AND source = 'Invigilation'
                         ORDER BY version DESC LIMIT 1),
                        'Not Recorded'
                    ) AS attendance_status,
                    -- Attendance source
                    COALESCE(
                        (SELECT source FROM exam_attendance
                         WHERE student_id = esa.student_id
                           AND DATE(exam_date) = DATE(esa.exam_date)
                           AND session_order   = esa.session_order
                         ORDER BY FIELD(source,'Manual','Invigilation') LIMIT 1),
                        NULL
                    ) AS attendance_source,
                    -- Transfer info
                    (SELECT CONCAT(rm2.room_code, ' → ', rm3.room_code)
                     FROM exam_transfer_log etl
                     LEFT JOIN room_master rm2 ON rm2.room_id = etl.from_room_id
                     LEFT JOIN room_master rm3 ON rm3.room_id = etl.to_room_id
                     WHERE etl.student_id = esa.student_id
                       AND etl.plan_id    = esa.plan_id
                     ORDER BY etl.created_at DESC LIMIT 1
                    ) AS transfer_info,
                    -- Blocked info
                    (SELECT reason FROM exam_blocked_students
                     WHERE student_id = esa.student_id
                       AND (DATE(exam_date) = DATE(esa.exam_date) OR notification_id = en.notification_id)
                       AND is_active = 1
                     LIMIT 1
                    ) AS block_reason_text
                FROM exam_seat_allocation esa
                LEFT JOIN room_master      rm  ON rm.room_id        = esa.room_id
                LEFT JOIN block_master     bm  ON bm.block_id       = rm.block_id
                LEFT JOIN subject_master   sm  ON sm.subject_id     = esa.subject_id
                LEFT JOIN exam_seating_plan_notifications espn ON espn.plan_id = esa.plan_id
                LEFT JOIN exam_notifications en ON en.notification_id = espn.notification_ref
                LEFT JOIN month_year_master mym ON mym.month_year_id = en.month_year_id
                LEFT JOIN sessions_master  ses ON ses.session_id    = en.session_id
                WHERE esa.student_id = ?
                ORDER BY esa.exam_date DESC, esa.session_order
            `, [studentId]);

            // Summary stats
            const total       = history.length;
            const present     = history.filter(h => h.attendance_status === 'Present').length;
            const absent      = history.filter(h => h.attendance_status === 'Absent').length;
            const malpractice = history.filter(h => h.attendance_status === 'Malpractice').length;
            const notRecorded = history.filter(h => h.attendance_status === 'Not Recorded').length;
            const transferred = history.filter(h => h.transfer_info).length;
            const blocked     = history.filter(h => h.is_blocked).length;

            res.json({
                success: true,
                student,
                history,
                summary: { total, present, absent, malpractice, notRecorded, transferred, blocked }
            });

        } catch(err) {
            console.error('[/student-history]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
