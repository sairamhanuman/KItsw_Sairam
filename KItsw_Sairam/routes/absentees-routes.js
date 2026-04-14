const express = require('express');

function initializeRouter(promisePool) {
    const router = express.Router();

    // ── GET /api/absentees/students ──────────────────────────
    router.get('/students', async (req, res) => {
        try {
            const { programme_id, semester_id, exam_date, session_order } = req.query;

            const [students] = await promisePool.query(`
                SELECT DISTINCT
                    ese.student_id,
                    stm.ht_number        AS roll_no,
                    stm.full_name        AS student_name,
                    stm.programme_id,
                    ese.subject_id,
                    sm.syllabus_code     AS subject_code,
                    sm.subject_name,
                    br.branch_code,
                    sec.section_name,
                    ese.semester_id,
                    ese.branch_id
                FROM exam_student_entries ese
                LEFT JOIN student_master  stm ON stm.student_id = ese.student_id
                LEFT JOIN subject_master  sm  ON sm.subject_id  = ese.subject_id
                LEFT JOIN branch_master   br  ON br.branch_id   = ese.branch_id
                LEFT JOIN section_master  sec ON sec.section_id = stm.section_id
                WHERE ese.semester_id     = ?
                  AND DATE(ese.exam_date) = ?
                  AND ese.session_order   = ?
                  ${programme_id ? 'AND stm.programme_id = ?' : ''}
                ORDER BY stm.ht_number
            `, [semester_id, exam_date, session_order, ...(programme_id ? [programme_id] : [])]);

            res.json({ success:true, students, total:students.length });

        } catch(err) {
            console.error('[/absentees/students]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── GET /api/absentees ───────────────────────────────────
    // Load existing Manual entries for a slot
    router.get('/', async (req, res) => {
        try {
            const { programme_id, semester_id, exam_date, session_order } = req.query;

            const [entries] = await promisePool.query(`
                SELECT
                    ea.*,
                    stm.full_name AS student_name
                FROM exam_attendance ea
                LEFT JOIN student_master stm ON stm.student_id = ea.student_id
                WHERE ea.semester_id     = ?
                  AND DATE(ea.exam_date) = ?
                  AND ea.session_order   = ?
                  AND ea.source          = 'Manual'
                  ${programme_id ? 'AND ea.programme_id = ?' : ''}
                ORDER BY ea.roll_no
            `, [semester_id, exam_date, session_order, ...(programme_id ? [programme_id] : [])]);

            res.json({ success:true, entries });

        } catch(err) {
            console.error('[GET /absentees]', err.message);
            res.status(500).json({ success:false, error:err.message });
        }
    });

    // ── POST /api/absentees/save ─────────────────────────────
    // Save manual absentee entries (Absent / Malpractice only)
    router.post('/save', async (req, res) => {
        const conn = await promisePool.getConnection();
        try {
            const { exam_type, programme_id, semester_id, exam_date, session_order, entries } = req.body;

            if (!entries?.length)
                return res.status(400).json({ success:false, error:'No entries to save' });

            await conn.beginTransaction();

            // Delete existing Manual entries for this slot
            await conn.query(`
                DELETE FROM exam_attendance
                WHERE semester_id = ? AND DATE(exam_date) = ?
                  AND session_order = ? AND source = 'Manual'
                  ${programme_id ? 'AND programme_id = ?' : ''}
            `, [semester_id, exam_date, session_order, ...(programme_id ? [programme_id] : [])]);

            // Insert all manual entries
            const rows = entries.map(e => [
                exam_date, session_order,
                null, null,                  // plan_id, room_id (not known for manual)
                e.student_id, e.roll_no,
                e.subject_id||null, e.subject_code||null, e.subject_name||null,
                null, semester_id, programme_id||null,
                e.status,                    // Absent or Malpractice
                'Manual', 1, 'Admin'
            ]);

            await conn.query(`
                INSERT INTO exam_attendance
                    (exam_date, session_order, plan_id, room_id,
                     student_id, roll_no, subject_id, subject_code, subject_name,
                     branch_id, semester_id, programme_id,
                     status, source, version, entered_by)
                VALUES ?
            `, [rows]);

            await conn.commit();
            res.json({ success:true, saved:entries.length });

        } catch(err) {
            await conn.rollback();
            console.error('[POST /absentees/save]', err.message);
            res.status(500).json({ success:false, error:err.message });
        } finally {
            conn.release();
        }
    });

    return router;
}

module.exports = { initializeRouter };
