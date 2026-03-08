// ============================================================
// FILE: routes/student-entries-routes.js
// Handles:
//   POST /api/student-entries/generate/:notificationId  → resolve & save
//   GET  /api/student-entries/status/:notificationId    → check if generated
//   GET  /api/student-entries/summary/:notificationId   → summary table
// ============================================================

const express = require('express');

// ── HELPER: VARCHAR notification_id → INT hash (same everywhere) ──
function hashNotificationId(notificationId) {
    return Math.abs(notificationId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0));
}

// ── HELPER: Parse MySQL JSON field safely ──
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
    // Check if student data has been generated for this notification
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

            const total = rows[0].total;
            res.json({
                status: 'success',
                data: {
                    is_generated: total > 0,
                    total_entries: total,
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
    // Resolve all students → subjects and save to exam_student_entries
    // ============================================================
    router.post('/generate/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const notificationIdHash = hashNotificationId(notificationId);

            console.log('=== GENERATE STUDENT ENTRIES ===');
            console.log('notification_id:', notificationId, '→ hash:', notificationIdHash);

            // ── STEP 1: Get notification ──────────────────────────
            const [notifRows] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            if (notifRows.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Notification not found' });
            }
            const notif = notifRows[0];

            const semesterIds   = parseJsonField(notif.semesters);
            const regulationIds = parseJsonField(notif.regulations);
            const batchId       = notif.batch_id;

            if (!semesterIds.length || !batchId) {
                return res.status(400).json({ status: 'error', message: 'Notification missing semester or batch' });
            }

            // ── STEP 2: Get timetable entries ─────────────────────
            const [timetableEntries] = await promisePool.query(`
                SELECT
                    ete.timetable_id,
                    ete.exam_date,
                    ete.branch_id,
                    ete.semester_id,
                    ete.regulation_id,
                    ete.subject_id,
                    ete.session_order,
                    sub.is_elective,
                    sub.is_under_group,
                    sub.elective_name,
                    sub.is_replacement
                FROM exam_timetable_entries ete
                JOIN subject_master sub ON ete.subject_id = sub.subject_id
                WHERE ete.notification_id = ?
                ORDER BY ete.exam_date, ete.session_order
            `, [notificationIdHash]);

            console.log(`Found ${timetableEntries.length} timetable entries`);

            // ── STEP 3: Get all In Roll students ──────────────────
            const semPlaceholders = semesterIds.map(() => '?').join(',');
            const [students] = await promisePool.query(`
                SELECT
                    ssh.student_id,
                    ssh.semester_id,
                    ssh.branch_id,
                    ssh.regulation_id,
                    ssh.batch_id
                FROM student_semester_history ssh
                JOIN student_master sm ON ssh.student_id = sm.student_id
                WHERE ssh.batch_id = ?
                AND ssh.semester_id IN (${semPlaceholders})
                AND ssh.student_status = 'In Roll'
                AND sm.is_active = 1
            `, [batchId, ...semesterIds]);

            console.log(`Found ${students.length} In Roll students`);

            // ── STEP 4: Resolve subjects per student ──────────────
            const entriesToInsert = [];

            for (const student of students) {
                const studentTimetable = timetableEntries.filter(
                    t => t.branch_id     === student.branch_id
                      && t.semester_id   === student.semester_id
                      && t.regulation_id === student.regulation_id
                );

                for (const entry of studentTimetable) {
                    // Skip replacement subjects in timetable
                    if (entry.is_replacement === 1) continue;

                    let finalSubjectId     = entry.subject_id;
                    let isElectiveResolved = false;
                    let isReplaced         = false;

                    // RULE: Elective subject → check student mapping
                    if (entry.is_elective === 1 && entry.is_under_group === 1 && entry.elective_name) {
                        const siblingsOnSameSlot = timetableEntries.filter(
                            t => t.branch_id     === entry.branch_id
                              && t.exam_date      === entry.exam_date
                              && t.session_order  === entry.session_order
                              && t.elective_name  === entry.elective_name
                              && t.is_replacement !== 1
                        );

                        if (siblingsOnSameSlot.length > 1) {
                            // Multiple options → student must have a mapping
                            const [electiveMapping] = await promisePool.query(`
                                SELECT sem.subject_id
                                FROM student_elective_mapping sem
                                JOIN subject_master sub ON sem.subject_id = sub.subject_id
                                WHERE sem.student_id = ?
                                AND sem.semester_id  = ?
                                AND sem.branch_id    = ?
                                AND sem.batch_id     = ?
                                AND sem.is_active    = 1
                                AND sub.elective_name = ?
                            `, [student.student_id, student.semester_id, student.branch_id, student.batch_id, entry.elective_name]);

                            if (electiveMapping.length === 0) continue;

                            // Only include the entry matching student's chosen subject
                            if (electiveMapping[0].subject_id !== entry.subject_id) continue;

                            finalSubjectId     = electiveMapping[0].subject_id;
                            isElectiveResolved = true;
                        }
                        // else: single option → include directly
                    }

                    // RULE: Check replacement
                    const [replacement] = await promisePool.query(`
                        SELECT replacement_subject_id
                        FROM student_subject_replacement
                        WHERE student_id         = ?
                        AND original_subject_id  = ?
                        AND is_active            = 1
                    `, [student.student_id, finalSubjectId]);

                    if (replacement.length > 0) {
                        finalSubjectId = replacement[0].replacement_subject_id;
                        isReplaced     = true;
                    }

                    entriesToInsert.push([
                        notificationIdHash,
                        notificationId,
                        student.student_id,
                        student.branch_id,
                        student.semester_id,
                        student.regulation_id,
                        student.batch_id,
                        finalSubjectId,
                        entry.timetable_id,
                        entry.exam_date,
                        entry.session_order,
                        isElectiveResolved ? 1 : 0,
                        isReplaced ? 1 : 0
                    ]);
                }
            }

            console.log(`Resolved ${entriesToInsert.length} student-subject entries`);

            // ── STEP 5: Save to DB (replace previous generation) ──
            const connection = await promisePool.getConnection();
            await connection.beginTransaction();
            try {
                // Clear previous generation for this notification
                await connection.query(
                    'DELETE FROM exam_student_entries WHERE notification_id = ?',
                    [notificationIdHash]
                );

                // Bulk insert in batches of 500
                const batchSize = 500;
                for (let i = 0; i < entriesToInsert.length; i += batchSize) {
                    const batch = entriesToInsert.slice(i, i + batchSize);
                    await connection.query(`
                        INSERT INTO exam_student_entries (
                            notification_id, notification_ref, student_id, branch_id,
                            semester_id, regulation_id, batch_id, subject_id,
                            timetable_id, exam_date, session_order,
                            is_elective, is_replaced
                        ) VALUES ?
                    `, [batch]);
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
                status: 'success',
                message: `Student exam data generated successfully`,
                data: {
                    total_students: students.length,
                    total_entries: entriesToInsert.length,
                    notification_id: notificationId
                }
            });

        } catch (error) {
            console.error('=== GENERATE STUDENT ENTRIES ERROR ===', error);
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
                    sem.semester_name,
                    COUNT(DISTINCT ese.student_id) AS student_count
                FROM exam_student_entries ese
                JOIN branch_master bm          ON ese.branch_id  = bm.branch_id
                JOIN subject_master sub        ON ese.subject_id = sub.subject_id
                JOIN semester_master sem       ON ese.semester_id = sem.semester_id
                JOIN exam_timetable_entries ete ON ese.timetable_id = ete.timetable_id
                JOIN exam_notifications en     ON en.notification_id = ese.notification_ref
                JOIN sessions_master sm_sess   ON en.session_id = sm_sess.session_id
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
                    sem.semester_name
                ORDER BY
                    ese.exam_date,
                    ese.session_order,
                    bm.branch_name
            `, [notificationIdHash]);

            // Also get totals per date+session
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
