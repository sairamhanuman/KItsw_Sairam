// ============================================================
// FILE: routes/student-entries-routes.js
// FIXED: No hashing — notification_id stored as raw string
// ============================================================

const express = require('express');

function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field.map(Number);
    if (typeof field === 'string') {
        try { return JSON.parse(field).map(Number); }
        catch(_) { return [Number(field)]; }
    }
    return [Number(field)];
}

function initializeRouter(promisePool) {
    const router = express.Router();

    // ── GET /status/:notificationId ──────────────────────────────────────────
    router.get('/status/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;

            const [rows] = await promisePool.query(`
                SELECT COUNT(*) as total, MAX(generated_at) as last_generated
                FROM exam_student_entries
                WHERE CAST(notification_id AS CHAR) = ?
                   OR notification_ref = ?
            `, [notificationId, notificationId]);

            res.json({
                status: 'success',
                data: {
                    is_generated:   rows[0].total > 0,
                    total_entries:  rows[0].total,
                    last_generated: rows[0].last_generated
                }
            });
        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /generate/:notificationId ───────────────────────────────────────
    router.post('/generate/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;

            console.log('\n=== GENERATE STUDENT ENTRIES (Subject-First) ===');
            console.log('notification_id:', notificationId, '(stored as-is, no hash)');

            // STEP 1: Get notification
            const [notifRows] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            if (!notifRows.length) {
                return res.status(404).json({ status:'error', message:'Notification not found' });
            }

            const notif      = notifRows[0];
            const batchId    = notif.batch_id;
            const semRaw     = notif.semesters   || notif.semester_ids   || null;
            const semesterIds = parseJsonField(semRaw);

            if (!semesterIds.length || !batchId) {
                return res.status(400).json({ status:'error', message:'Notification missing semester or batch' });
            }

            console.log(`Batch: ${batchId} | Semesters: ${semesterIds}`);

            // ── Resolve session_order from sessions_master ────────────────
            //    This is the single source of truth — overrides any value
            //    stored in exam_timetable_entries.session_order (which may
            //    have been saved incorrectly as 1 for AN sessions)
            let sessionOrder = 1;
            try {
                const [[sessRow]] = await promisePool.query(
                    `SELECT COALESCE(session_group, session_name) AS grp
                     FROM sessions_master WHERE session_id = ?`,
                    [notif.session_id]
                );
                sessionOrder = (sessRow?.grp || 'AN').toUpperCase() === 'FN' ? 1 : 2;
            } catch (_) {}
            console.log(`[student-entries] session_id=${notif.session_id} → session_order=${sessionOrder}`);

            // STEP 2: Get timetable entries — match by string notification_id
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
                WHERE CAST(ete.notification_id AS CHAR) = ?
                ORDER BY ete.exam_date, ete.session_order, ete.branch_id
            `, [notificationId]);

            console.log(`Found ${timetableEntries.length} timetable entries`);

            if (!timetableEntries.length) {
                return res.status(400).json({
                    status:  'error',
                    message: 'No timetable entries found. Please save the timetable first.'
                });
            }

            // STEP 3: Subject-first loop
            const entriesToInsert = [];

            for (const entry of timetableEntries) {
                let students    = [];
                let subjectType = '';

                if (entry.is_replacement === 1) {
                    subjectType = 'REPLACEMENT';
                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT ssh.student_id, ssh.branch_id,
                               ssh.semester_id, ssh.regulation_id, ssh.batch_id
                        FROM student_subject_replacement ssr
                        JOIN student_semester_history ssh ON ssr.student_id = ssh.student_id
                        JOIN student_master sm ON ssh.student_id = sm.student_id
                        WHERE ssr.replacement_subject_id = ?
                          AND ssh.batch_id = ?
                          AND ssh.student_status = 'In Roll'
                          AND sm.is_active = 1
                          AND ssr.is_active = 1
                    `, [entry.subject_id, batchId]);
                    students = rows;

                } else if (entry.is_elective === 1 && entry.is_under_group === 1) {
                    subjectType = 'ELECTIVE';
                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT ssh.student_id, ssh.branch_id,
                               ssh.semester_id, ssh.regulation_id, ssh.batch_id
                        FROM student_elective_mapping sem
                        JOIN student_semester_history ssh ON sem.student_id = ssh.student_id
                        JOIN student_master sm ON ssh.student_id = sm.student_id
                        WHERE sem.subject_id     = ?
                          AND ssh.branch_id      = ?
                          AND ssh.semester_id    = ?
                          AND ssh.batch_id       = ?
                          AND ssh.student_status = 'In Roll'
                          AND sm.is_active       = 1
                          AND sem.is_active      = 1
                    `, [entry.subject_id, entry.branch_id, entry.semester_id, batchId]);
                    students = rows;

                } else {
                    subjectType = 'REGULAR';
                    const [rows] = await promisePool.query(`
                        SELECT DISTINCT ssh.student_id, ssh.branch_id,
                               ssh.semester_id, ssh.regulation_id, ssh.batch_id
                        FROM student_semester_history ssh
                        JOIN student_master sm ON ssh.student_id = sm.student_id
                        LEFT JOIN exam_blocked_students ebs
                            ON ebs.student_id = ssh.student_id AND ebs.is_active = 1
                        WHERE ssh.branch_id      = ?
                          AND ssh.semester_id    = ?
                          AND ssh.regulation_id  = ?
                          AND ssh.batch_id       = ?
                          AND ssh.student_status = 'In Roll'
                          AND sm.is_active       = 1
                          AND ebs.id IS NULL
                    `, [entry.branch_id, entry.semester_id, entry.regulation_id, batchId]);
                    students = rows;
                }

                console.log(`[${subjectType}] ${entry.syllabus_code} | branch=${entry.branch_id} | students=${students.length}`);

                students.forEach(student => {
                    entriesToInsert.push([
                        notificationId,     // notification_id  — raw string
                        notificationId,     // notification_ref — same string
                        student.student_id,
                        student.branch_id,
                        entry.semester_id,
                        entry.regulation_id,
                        student.batch_id,
                        entry.subject_id,
                        entry.timetable_id,
                        entry.exam_date,
                        sessionOrder,       // resolved from sessions_master — single source of truth
                        (entry.is_elective === 1 && entry.is_under_group === 1) ? 1 : 0,
                        entry.is_replacement === 1 ? 1 : 0
                    ]);
                });
            }

            console.log(`\n✅ Total entries resolved: ${entriesToInsert.length}`);

            // STEP 4: Save to DB
            const connection = await promisePool.getConnection();
            await connection.beginTransaction();

            try {
                // Delete previous — match both column formats
                await connection.query(
                    `DELETE FROM exam_student_entries
                     WHERE CAST(notification_id AS CHAR) = ?
                        OR notification_ref = ?`,
                    [notificationId, notificationId]
                );

                if (entriesToInsert.length > 0) {
                    const batchSize = 500;
                    for (let i = 0; i < entriesToInsert.length; i += batchSize) {
                        await connection.query(`
                            INSERT INTO exam_student_entries (
                                notification_id, notification_ref,
                                student_id, branch_id,
                                semester_id, regulation_id, batch_id,
                                subject_id, timetable_id,
                                exam_date, session_order,
                                is_elective, is_replaced
                            ) VALUES ?
                        `, [entriesToInsert.slice(i, i + batchSize)]);
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

            res.json({
                status:  'success',
                message: 'Student exam data generated successfully',
                data: {
                    total_students:    new Set(entriesToInsert.map(r => r[2])).size,
                    total_entries:     entriesToInsert.length,
                    timetable_entries: timetableEntries.length,
                    notification_id:   notificationId
                }
            });

        } catch (err) {
            console.error('=== GENERATE ERROR ===', err);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── GET /summary/:notificationId ─────────────────────────────────────────
    router.get('/summary/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;

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
                JOIN branch_master    bm      ON ese.branch_id   = bm.branch_id
                JOIN subject_master   sub     ON ese.subject_id  = sub.subject_id
                JOIN semester_master  sem_m   ON ese.semester_id = sem_m.semester_id
                JOIN exam_notifications en    ON en.notification_id = ese.notification_ref
                JOIN sessions_master  sm_sess ON en.session_id   = sm_sess.session_id
                WHERE CAST(ese.notification_id AS CHAR) = ?
                   OR ese.notification_ref = ?
                GROUP BY
                    ese.exam_date, ese.session_order,
                    sm_sess.session_name, sm_sess.start_time, sm_sess.end_time,
                    bm.branch_id, bm.branch_name, bm.branch_code,
                    sub.subject_id, sub.syllabus_code, sub.subject_name,
                    sub.subject_type, sub.is_elective, sub.is_replacement,
                    sem_m.semester_name
                ORDER BY ese.exam_date, ese.session_order, bm.branch_name, sub.syllabus_code
            `, [notificationId, notificationId]);

            const [totals] = await promisePool.query(`
                SELECT exam_date, session_order,
                       COUNT(DISTINCT student_id) AS total_students
                FROM exam_student_entries
                WHERE CAST(notification_id AS CHAR) = ?
                   OR notification_ref = ?
                GROUP BY exam_date, session_order
                ORDER BY exam_date, session_order
            `, [notificationId, notificationId]);

            res.json({
                status: 'success',
                data: {
                    summary,
                    totals,
                    grand_total: summary.reduce((s, r) => s + r.student_count, 0)
                }
            });

        } catch (err) {
            console.error('Summary error:', err);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
