const express = require('express');

// Initialize routes function
function initializeRouter(promisePool) {
    const router = express.Router();

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER: Build dynamic notification title
    // Result format: "BTECH - MSE-1 - VI SEMESTER - April-2026"
    // ─────────────────────────────────────────────────────────────────────────
    async function buildNotificationTitle(promisePool, { programme_id, exam_name_id, semester_ids, month_year_id }) {
        // 1. Programme code  e.g. "BTECH"
        const [programme] = await promisePool.query(
            'SELECT programme_code FROM programme_master WHERE programme_id = ?',
            [programme_id]
        );
        const programmeCode = programme.length > 0 ? programme[0].programme_code : '';

        // 2. Exam code  e.g. "MSE-1"
        //    Table: exams_naming_master  |  PK: exam_naming_id  |  Value col: exam_code
        const [examRow] = await promisePool.query(
            'SELECT exam_code FROM exams_naming_master WHERE exam_naming_id = ?',
            [exam_name_id]
        );
        const examCode = examRow.length > 0 ? examRow[0].exam_code : String(exam_name_id);

        // 3. Semester name(s)  e.g. "VI SEMESTER"
        //    semester_ids can be a comma-string like "4" or "4,6"
        const semIdArray = Array.isArray(semester_ids)
            ? semester_ids
            : String(semester_ids).split(',').map(s => s.trim()).filter(Boolean);

        let semesterLabel = '';
        if (semIdArray.length > 0) {
            const placeholders = semIdArray.map(() => '?').join(',');
            const [semRows] = await promisePool.query(
                `SELECT semester_name FROM semester_master
                 WHERE semester_id IN (${placeholders})
                 ORDER BY semester_id`,
                semIdArray
            );
            semesterLabel = semRows.map(r => r.semester_name).join(', ');
        }

        // 4. Month-Year display  e.g. "April-2026"
        const [myRow] = await promisePool.query(
            'SELECT display_name FROM month_year_master WHERE month_year_id = ?',
            [month_year_id]
        );
        const monthYearLabel = myRow.length > 0 ? myRow[0].display_name : '';

        // Combine: "BTECH - MSE-1 - VI SEMESTER - April-2026"
        return [programmeCode, examCode, semesterLabel, monthYearLabel]
            .filter(Boolean)
            .join(' - ');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET all exam notifications
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            console.log('=== GET ALL EXAM NOTIFICATIONS ===');

            const query = `
                SELECT 
                    en.*,
                    pm.programme_name,
                    sm.session_name,
                    sm.start_time  AS session_start_time,
                    sm.end_time    AS session_end_time,
                    mym.display_name AS month_year_display,
                    enm.exam_code,
                    enm.exam_name  AS exam_name_label
                FROM exam_notifications en
                LEFT JOIN programme_master   pm  ON en.programmes    LIKE CONCAT('%"', pm.programme_id, '"%')
                LEFT JOIN sessions_master    sm  ON en.session_id    = sm.session_id
                LEFT JOIN month_year_master  mym ON en.month_year_id = mym.month_year_id
                LEFT JOIN exams_naming_master enm ON en.exam_name_id = enm.exam_naming_id
                ORDER BY en.created_at DESC
            `;

            const [notifications] = await promisePool.query(query);

            res.json({
                status: 'success',
                message: 'Exam notifications retrieved successfully',
                data: notifications
            });

        } catch (error) {
            console.error('=== GET ALL EXAM NOTIFICATIONS ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to retrieve exam notifications', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET exam notification by ID
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/:id', async (req, res) => {
        try {
            console.log('=== GET EXAM NOTIFICATION BY ID ===');
            const { id } = req.params;

            const query = `
                SELECT 
                    en.*,
                    pm.programme_name,
                    sm.session_name,
                    sm.start_time  AS session_start_time,
                    sm.end_time    AS session_end_time,
                    mym.display_name AS month_year_display,
                    enm.exam_code,
                    enm.exam_name  AS exam_name_label
                FROM exam_notifications en
                LEFT JOIN programme_master   pm  ON en.programmes    LIKE CONCAT('%"', pm.programme_id, '"%')
                LEFT JOIN sessions_master    sm  ON en.session_id    = sm.session_id
                LEFT JOIN month_year_master  mym ON en.month_year_id = mym.month_year_id
                LEFT JOIN exams_naming_master enm ON en.exam_name_id = enm.exam_naming_id
                WHERE en.notification_id = ?
            `;

            const [notifications] = await promisePool.query(query, [id]);

            if (notifications.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Exam notification not found' });
            }

            res.json({ status: 'success', message: 'Exam notification retrieved successfully', data: notifications[0] });

        } catch (error) {
            console.error('=== GET EXAM NOTIFICATION BY ID ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to retrieve exam notification', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // POST create new exam notification
    // ─────────────────────────────────────────────────────────────────────────
    router.post('/', async (req, res) => {
        try {
            console.log('=== CREATE EXAM NOTIFICATION ===');
            console.log('Request body:', req.body);

            const {
                programme_id,
                semester_ids,
                regulation_ids,
                exam_type,
                exam_name,          // this is actually exam_naming_id (e.g. 2)
                session_id,
                month_year_id,
                start_date,
                end_date,
                batch_id   = null,
                batch_name = null,
                created_by = 'admin'
            } = req.body;

            // Validate required fields
            if (!programme_id || !semester_ids || !regulation_ids || !exam_type ||
                !exam_name || !session_id || !month_year_id || !start_date || !end_date) {
                return res.status(400).json({ status: 'error', message: 'All required fields must be provided' });
            }

            // Build dynamic title: "BTECH - MSE-1 - VI SEMESTER - April-2026"
            const notification_title = await buildNotificationTitle(promisePool, {
                programme_id,
                exam_name_id : exam_name,   // exam_name holds the exam_naming_id value
                semester_ids,
                month_year_id
            });

            console.log('Generated notification_title:', notification_title);

            const notification_id = `NOTIF_${Date.now()}`;

            const semIdArray = String(semester_ids).split(',').map(s => s.trim()).filter(Boolean);
            const regIdArray = String(regulation_ids).split(',').map(s => s.trim()).filter(Boolean);

            await promisePool.query(
                `INSERT INTO exam_notifications (
                    notification_id, notification_title, programmes, semesters, regulations,
                    exam_type, exam_name_id, session_id, month_year_id,
                    start_date, end_date, batch_id, batch_name, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    notification_id,
                    notification_title,
                    JSON.stringify([programme_id]),
                    JSON.stringify(semIdArray),
                    JSON.stringify(regIdArray),
                    exam_type,
                    exam_name,
                    session_id,
                    month_year_id,
                    start_date,
                    end_date,
                    batch_id,
                    batch_name,
                    created_by
                ]
            );

            const [newNotification] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notification_id]
            );

            res.status(201).json({ status: 'success', message: 'Exam notification created successfully', data: newNotification[0] });

        } catch (error) {
            console.error('=== CREATE EXAM NOTIFICATION ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to create exam notification', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PUT update exam notification
    // ─────────────────────────────────────────────────────────────────────────
    router.put('/:id', async (req, res) => {
        try {
            console.log('=== UPDATE EXAM NOTIFICATION ===');
            const { id } = req.params;

            const {
                programme_id,
                semester_ids,
                regulation_ids,
                exam_type,
                exam_name,          // exam_naming_id
                session_id,
                month_year_id,
                exam_start_date,
                exam_end_date,
                notification_description,
                is_published,
                batch_id   = null,
                batch_name = null,
                created_by
            } = req.body;

            const [existing] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?', [id]
            );
            if (existing.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Exam notification not found' });
            }

            // Rebuild dynamic title
            const notification_title = await buildNotificationTitle(promisePool, {
                programme_id,
                exam_name_id : exam_name,
                semester_ids,
                month_year_id
            });

            console.log('Updated notification_title:', notification_title);

            const semIdArray = String(semester_ids).split(',').map(s => s.trim()).filter(Boolean);
            const regIdArray = String(regulation_ids).split(',').map(s => s.trim()).filter(Boolean);

            await promisePool.query(
                `UPDATE exam_notifications SET
                    programmes         = ?,
                    semesters          = ?,
                    regulations        = ?,
                    exam_type          = ?,
                    exam_name_id       = ?,
                    session_id         = ?,
                    month_year_id      = ?,
                    start_date         = ?,
                    end_date           = ?,
                    notification_title = ?,
                    description        = ?,
                    status             = ?,
                    batch_id           = ?,
                    batch_name         = ?,
                    created_by         = ?,
                    updated_at         = CURRENT_TIMESTAMP
                WHERE notification_id = ?`,
                [
                    JSON.stringify([programme_id]),
                    JSON.stringify(semIdArray),
                    JSON.stringify(regIdArray),
                    exam_type,
                    exam_name,
                    session_id,
                    month_year_id,
                    exam_start_date,
                    exam_end_date,
                    notification_title,
                    notification_description,
                    is_published ? 'Published' : 'Draft',
                    batch_id,
                    batch_name,
                    created_by,
                    id
                ]
            );

            const [updatedNotification] = await promisePool.query(
                `SELECT en.*, pm.programme_name,
                        sm.session_name, sm.start_time AS session_start_time, sm.end_time AS session_end_time,
                        mym.display_name AS month_year_display,
                        enm.exam_code, enm.exam_name AS exam_name_label
                 FROM exam_notifications en
                 LEFT JOIN programme_master   pm  ON en.programmes    LIKE CONCAT('%"', pm.programme_id, '"%')
                 LEFT JOIN sessions_master    sm  ON en.session_id    = sm.session_id
                 LEFT JOIN month_year_master  mym ON en.month_year_id = mym.month_year_id
                 LEFT JOIN exams_naming_master enm ON en.exam_name_id = enm.exam_naming_id
                 WHERE en.notification_id = ?`,
                [id]
            );

            res.json({ status: 'success', message: 'Exam notification updated successfully', data: updatedNotification[0] });

        } catch (error) {
            console.error('=== UPDATE EXAM NOTIFICATION ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to update exam notification', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE exam notification
    // ─────────────────────────────────────────────────────────────────────────
    router.delete('/:id', async (req, res) => {
        try {
            console.log('=== DELETE EXAM NOTIFICATION ===');
            const { id } = req.params;

            const [existing] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?', [id]
            );
            if (existing.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Exam notification not found' });
            }

            await promisePool.query('DELETE FROM exam_notifications WHERE notification_id = ?', [id]);

            res.json({ status: 'success', message: 'Exam notification deleted successfully' });

        } catch (error) {
            console.error('=== DELETE EXAM NOTIFICATION ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to delete exam notification', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH fix titles of ALL existing notifications that were saved incorrectly
    // Call once: POST /api/exam-notifications/fix-titles
    // ─────────────────────────────────────────────────────────────────────────
    router.post('/fix-titles', async (req, res) => {
        try {
            console.log('=== FIX EXISTING NOTIFICATION TITLES ===');

            const [rows] = await promisePool.query(
                `SELECT notification_id, programmes, semesters, exam_name_id, month_year_id
                 FROM exam_notifications`
            );

            const results = [];

            for (const row of rows) {
                try {
                    // Parse JSON arrays stored in DB
                    const programmesArr  = JSON.parse(row.programmes  || '[]');
                    const semestersArr   = JSON.parse(row.semesters   || '[]');
                    const programme_id   = programmesArr[0];
                    const semester_ids   = semestersArr.join(',');

                    const newTitle = await buildNotificationTitle(promisePool, {
                        programme_id,
                        exam_name_id : row.exam_name_id,
                        semester_ids,
                        month_year_id : row.month_year_id
                    });

                    await promisePool.query(
                        'UPDATE exam_notifications SET notification_title = ?, updated_at = CURRENT_TIMESTAMP WHERE notification_id = ?',
                        [newTitle, row.notification_id]
                    );

                    results.push({ notification_id: row.notification_id, new_title: newTitle, status: 'updated' });
                    console.log(`Fixed: ${row.notification_id} → ${newTitle}`);

                } catch (err) {
                    results.push({ notification_id: row.notification_id, status: 'error', error: err.message });
                }
            }

            res.json({ status: 'success', message: `Fixed ${results.length} notification(s)`, data: results });

        } catch (error) {
            console.error('=== FIX TITLES ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to fix notification titles', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET timetable entries for a notification
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/:id/timetable', async (req, res) => {
        try {
            const { id } = req.params;

            const [timetableEntries] = await promisePool.query(
                `SELECT te.*,
                        DATE_FORMAT(te.exam_date, '%Y-%m-%d') AS exam_date_formatted,
                        bm.branch_name, bm.branch_code,
                        sub.subject_name, sub.syllabus_code, sub.subject_code,
                        sub.is_elective, sub.elective_name,
                        rm.room_number, rm.room_building,
                        sm.staff_name AS invigilator_name
                 FROM exam_timetable_entries te
                 LEFT JOIN branch_master  bm  ON te.branch_id           = bm.branch_id
                 LEFT JOIN subject_master sub ON te.subject_id           = sub.subject_id
                 LEFT JOIN room_master    rm  ON te.room_id              = rm.room_id
                 LEFT JOIN staff_master   sm  ON te.invigilator_staff_id = sm.staff_id
                 WHERE te.notification_id = ?
                 ORDER BY te.exam_date, bm.branch_name, te.session_order`,
                [id]
            );

            res.json({ status: 'success', message: 'Timetable entries retrieved successfully', data: timetableEntries });

        } catch (error) {
            console.error('=== GET TIMETABLE FOR NOTIFICATION ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to retrieve timetable entries', error: error.message });
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET unassigned subjects for a notification
    // ─────────────────────────────────────────────────────────────────────────
    router.get('/:id/unassigned', async (req, res) => {
        try {
            const { id } = req.params;

            const [unassignedSubjects] = await promisePool.query(
                `SELECT us.*,
                        bm.branch_name, bm.branch_code,
                        sub.subject_name, sub.syllabus_code, sub.subject_code,
                        sub.is_elective, sub.elective_name
                 FROM exam_unassigned_subjects us
                 LEFT JOIN branch_master  bm  ON us.branch_id  = bm.branch_id
                 LEFT JOIN subject_master sub ON us.subject_id  = sub.subject_id
                 WHERE us.notification_id = ?
                 ORDER BY us.priority_order, bm.branch_name, sub.subject_name`,
                [id]
            );

            res.json({ status: 'success', message: 'Unassigned subjects retrieved successfully', data: unassignedSubjects });

        } catch (error) {
            console.error('=== GET UNASSIGNED SUBJECTS ERROR ===', error);
            res.status(500).json({ status: 'error', message: 'Failed to retrieve unassigned subjects', error: error.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
