// ============================================================
// FILE: routes/student-entries-routes.js
//
// ARCHITECTURE: Subject-first (35 subjects → 35 queries)
//
// CASE 1 — Regular Subject (is_elective=0, is_under_group=0, is_replacement=0)
//   → All students from student_semester_history matching branch+sem+reg+batch
//
// CASE 2 — Elective Subject (is_elective=1, is_under_group=1)
//   → Only students from student_elective_mapping WHERE subject_id = this subject
//
// CASE 3 — Replacement Subject (is_replacement=1)
//   → Only students from student_subject_replacement WHERE replacement_subject_id = this subject
//
// ENDPOINTS:
//   POST /api/student-entries/generate/:notificationId  → resolve & save
//   GET  /api/student-entries/status/:notificationId    → check if generated
//   GET  /api/student-entries/summary/:notificationId   → summary table
// ============================================================

const express = require('express');

// ── HELPER: VARCHAR notification_id → INT hash ───────────────
function hashNotificationId(notificationId) {
    return Math.abs(notificationId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0));
}

// ── HELPER: Parse MySQL JSON field safely ─────────────────────
function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field.map(Number);
    if (typeof field === 'string') return JSON.parse(field).map(Number);
    return [Number(field)];
}

function initializeRouter(promisePool) {
    const router = express.Router();

    // ============================================================
    // GET /api/student-entries/status/:notificationId
    // ============================================================
    router.get('/status/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const notificationIdHash = hashNotificationId(notificationId);

            const [rows] = await promisePool.query(`
                SELECT COUNT(*) as total, MAX(generated_at) as last_generated
                FROM exam_student_entries
                WHERE notification_id = ?
            `, [notificationIdHash]);

            res.json({
                status: 'success',
                data: {
                    is_generated:   rows[0].total > 0,
                    total_entries:  rows[0].total,
                    last_generated: rows[0].last_generated
                }
            });
        } catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    // ============================================================
    // POST /api/student-entries/generate/:notificationId
    // ============================================================
    router.post('/generate/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const notificationIdHash = hashNotificationId(notificationId);

            console.log('\n=== GENERATE STUDENT ENTRIES (Subject-First) ===');
            console.log('notification_id:', notificationId, '→ hash:', notificationIdHash);

            // ── STEP 1: Get notification ──────────────────────────
            const [notifRows] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            if (notifRows.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Notification not found' });
            }

            const notif       = notifRows[0];
            const batchId     = notif.batch_id;
            const semesterIds = parseJsonField(notif.semesters);

            if (!semesterIds.length || !batchId) {
                return res.status(400).json({ status: 'error', message: 'Notification missing semester or batch' });
            }

            console.log(`Batch: ${batchId} | Semesters: ${semesterIds}`);

            // ── STEP 2: Get timetable entries with subject details ─
            const [timetableEntries] = await promisePool.query(`
                SELECT
                    ete.timetable_id,
                    ete.exam_date,
                    ete.branch_id,
                    ete.semester_id,
                    ete.regulation_id,
                    ete.subject_id,
                    ete.session_order,
                    sub.syllabus_code,
                    sub.subject_name,
                    sub.is_elective,
                    sub.is_under_group,
                    sub.elective_name,
                    sub.is_replacement
                FROM exam_timetable_entries ete
                JOIN subject_master sub ON ete.subject_id = sub.subject_id
                WHERE ete.notification_id = ?
                ORDER BY ete.exam_date, ete.session_order, ete.branch_id
            `, [notificationIdHash]);

            console.log(`Found ${timetableEntries.length} timetable entries`);

            if (timetableEntries.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No timetable entries found. Please save the timetable first.'
                });
            }

            // ── STEP 3: Subject-first loop ────────────────────────
            const entriesToInsert = [];

            for (const entry of timetableEntries) {

                let students    = [];
                let subjectType = '';

                // ════════════════════════════════════════════════════
                // CASE 3 — REPLACEMENT SUBJECT
                // is_replacement = 1
                // Fetch from: student_subject_replacement
                //             JOIN student_semester_history
                // ════════════════════════════════════════════════════
                if (entry.is_replacement === 1) {
                    subjectType = 'REPLACEMENT';

                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT
                            ssh.student_id,
                            ssh.branch_id,
                            ssh.semester_id,
                            ssh.regulation_id,
                            ssh.batch_id
                        FROM student_subject_replacement ssr
                        JOIN student_semester_history ssh
                             ON ssr.student_id = ssh.student_id
                        JOIN student_master sm
                             ON ssh.student_id = sm.student_id
                        WHERE ssr.replacement_subject_id = ?
                        AND   ssh.batch_id               = ?
                        AND   ssh.student_status         = 'In Roll'
                        AND   sm.is_active               = 1
                        AND   ssr.is_active              = 1
                    `, [entry.subject_id, batchId]);

                    students = rows;
                }

                // ════════════════════════════════════════════════════
                // CASE 2 — ELECTIVE SUBJECT
                // is_elective = 1 AND is_under_group = 1
                // Fetch from: student_elective_mapping
                //             JOIN student_semester_history
                // ════════════════════════════════════════════════════
                else if (entry.is_elective === 1 && entry.is_under_group === 1) {
                    subjectType = 'ELECTIVE';

                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT
                            ssh.student_id,
                            ssh.branch_id,
                            ssh.semester_id,
                            ssh.regulation_id,
                            ssh.batch_id
                        FROM student_elective_mapping sem
                        JOIN student_semester_history ssh
                             ON sem.student_id = ssh.student_id
                        JOIN student_master sm
                             ON ssh.student_id = sm.student_id
                        WHERE sem.subject_id     = ?
                        AND   ssh.branch_id      = ?
                        AND   ssh.semester_id    = ?
                        AND   ssh.batch_id       = ?
                        AND   ssh.student_status = 'In Roll'
                        AND   sm.is_active       = 1
                        AND   sem.is_active      = 1
                    `, [
                        entry.subject_id,
                        entry.branch_id,
                        entry.semester_id,
                        batchId
                    ]);

                    students = rows;
                }

                // ════════════════════════════════════════════════════
                // CASE 1 — REGULAR SUBJECT
                // All students of branch + semester + regulation + batch
                // Fetch from: student_semester_history directly
                // ════════════════════════════════════════════════════
                else {
                    subjectType = 'REGULAR';

                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT
                            ssh.student_id,
                            ssh.branch_id,
                            ssh.semester_id,
                            ssh.regulation_id,
                            ssh.batch_id
                        FROM student_semester_history ssh
                        JOIN student_master sm
                             ON ssh.student_id = sm.student_id
                        WHERE ssh.branch_id      = ?
                        AND   ssh.semester_id    = ?
                        AND   ssh.regulation_id  = ?
                        AND   ssh.batch_id       = ?
                        AND   ssh.student_status = 'In Roll'
                        AND   sm.is_active       = 1
                    `, [
                        entry.branch_id,
                        entry.semester_id,
                        entry.regulation_id,
                        batchId
                    ]);

                    students = rows;
                }

                console.log(`[${subjectType}] ${entry.syllabus_code} | ${entry.subject_name} | branch=${entry.branch_id} | students=${students.length}`);

                // ── Build insert rows ─────────────────────────────
                students.forEach(student => {
                    entriesToInsert.push([
                        notificationIdHash,
                        notificationId,
                        student.student_id,
                        student.branch_id,
                        entry.semester_id,
                        entry.regulation_id,
                        student.batch_id,
                        entry.subject_id,
                        entry.timetable_id,
                        entry.exam_date,
                        entry.session_order,
                        (entry.is_elective === 1 && entry.is_under_group === 1) ? 1 : 0,
                        entry.is_replacement === 1 ? 1 : 0
                    ]);
                });
            }

            console.log(`\n✅ Total entries resolved: ${entriesToInsert.length}`);

            // ── STEP 4: Save to DB ────────────────────────────────
            const connection = await promisePool.getConnection();
            await connection.beginTransaction();

            try {
                // Clear previous generation for this notification
                await connection.query(
                    'DELETE FROM exam_student_entries WHERE notification_id = ?',
                    [notificationIdHash]
                );

                // Bulk insert in batches of 500
                if (entriesToInsert.length > 0) {
                    const batchSize = 500;
                    for (let i = 0; i < entriesToInsert.length; i += batchSize) {
                        const batch = entriesToInsert.slice(i, i + batchSize);
                        await connection.query(`
                            INSERT INTO exam_student_entries (
                                notification_id, notification_ref,
                                student_id, branch_id,
                                semester_id, regulation_id, batch_id,
                                subject_id, timetable_id,
                                exam_date, session_order,
                                is_elective, is_replaced
                            ) VALUES ?
                        `, [batch]);
                    }
                }

                await connection.commit();
                console.log(`✅ Saved ${entriesToInsert.length} entries to exam_student_entries`);

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }

            // ── STEP 5: Response ──────────────────────────────────
            const uniqueStudents = new Set(entriesToInsert.map(r => r[2])).size;

            res.json({
                status:  'success',
                message: 'Student exam data generated successfully',
                data: {
                    total_students:    uniqueStudents,
                    total_entries:     entriesToInsert.length,
                    timetable_entries: timetableEntries.length,
                    notification_id:   notificationId
                }
            });

        } catch (error) {
            console.error('=== GENERATE ERROR ===', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    // ============================================================
    // GET /api/student-entries/summary/:notificationId
    // Returns: Date | Session | Branch | Syllabus Code | Subject | Count
    // ============================================================
    router.get('/summary/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const notificationIdHash = hashNotificationId(notificationId);

            // ── Per subject breakdown ─────────────────────────────
            const [summary] = await promisePool.query(`
                SELECT
                    ese.exam_date,
                    ese.session_order,
                    sm_sess.session_name,
                    sm_sess.start_time,
                    sm_sess.end_time,
                    bm.branch_id,
                    bm.branch_name,
                    bm.branch_code,
                    sub.subject_id,
                    sub.syllabus_code,
                    sub.subject_name,
                    sub.subject_type,
                    sub.is_elective,
                    sub.is_replacement,
                    sem_m.semester_name,
                    COUNT(DISTINCT ese.student_id) AS student_count
                FROM exam_student_entries ese
                JOIN branch_master   bm      ON ese.branch_id   = bm.branch_id
                JOIN subject_master  sub     ON ese.subject_id  = sub.subject_id
                JOIN semester_master sem_m   ON ese.semester_id = sem_m.semester_id
                JOIN exam_notifications en   ON en.notification_id = ese.notification_ref
                JOIN sessions_master sm_sess ON en.session_id   = sm_sess.session_id
                WHERE ese.notification_id = ?
                GROUP BY
                    ese.exam_date,
                    ese.session_order,
                    sm_sess.session_name,
                    sm_sess.start_time,
                    sm_sess.end_time,
                    bm.branch_id,
                    bm.branch_name,
                    bm.branch_code,
                    sub.subject_id,
                    sub.syllabus_code,
                    sub.subject_name,
                    sub.subject_type,
                    sub.is_elective,
                    sub.is_replacement,
                    sem_m.semester_name
                ORDER BY
                    ese.exam_date,
                    ese.session_order,
                    bm.branch_name,
                    sub.syllabus_code
            `, [notificationIdHash]);

            // ── Totals per date+session ───────────────────────────
            const [totals] = await promisePool.query(`
                SELECT
                    exam_date,
                    session_order,
                    COUNT(DISTINCT student_id) AS total_students
                FROM exam_student_entries
                WHERE notification_id = ?
                GROUP BY exam_date, session_order
                ORDER BY exam_date, session_order
            `, [notificationIdHash]);

            res.json({
                status: 'success',
                data: {
                    summary,
                    totals,
                    grand_total: summary.reduce((sum, r) => sum + r.student_count, 0)
                }
            });

        } catch (error) {
            console.error('Summary error:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
