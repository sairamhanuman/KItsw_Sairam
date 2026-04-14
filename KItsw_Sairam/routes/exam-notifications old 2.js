const express = require('express');

// Initialize routes function
function initializeRouter(promisePool) {
    const router = express.Router();

    // GET all exam notifications
    router.get('/', async (req, res) => {
        try {
            console.log('=== GET ALL EXAM NOTIFICATIONS ===');
            
            const query = `
                SELECT 
                    en.*,
                    pm.programme_name,
                    sm.session_name,
                    sm.start_time as session_start_time,
                    sm.end_time as session_end_time,
                    mym.display_name as month_year_display
                FROM exam_notifications en
                LEFT JOIN programme_master pm ON en.programmes LIKE CONCAT('%"', pm.programme_id, '"%')
                LEFT JOIN sessions_master sm ON en.session_id = sm.session_id
                LEFT JOIN month_year_master mym ON en.month_year_id = mym.month_year_id
                ORDER BY en.created_at DESC
            `;
            
            const [notifications] = await promisePool.query(query);
            
            res.json({
                status: 'success',
                message: 'Exam notifications retrieved successfully',
                data: notifications
            });
            
        } catch (error) {
            console.error('=== GET ALL EXAM NOTIFICATIONS ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve exam notifications',
                error: error.message
            });
        }
    });

    // GET exam notification by ID
    router.get('/:id', async (req, res) => {
        try {
            console.log('=== GET EXAM NOTIFICATION BY ID ===');
            const { id } = req.params;
            
            const query = `
                SELECT 
                    en.*,
                    pm.programme_name,
                    sm.session_name,
                    sm.start_time as session_start_time,
                    sm.end_time as session_end_time,
                    mym.display_name as month_year_display
                FROM exam_notifications en
                LEFT JOIN programme_master pm ON en.programmes LIKE CONCAT('%"', pm.programme_id, '"%')
                LEFT JOIN sessions_master sm ON en.session_id = sm.session_id
                LEFT JOIN month_year_master mym ON en.month_year_id = mym.month_year_id
                WHERE en.notification_id = ?
            `;
            
            const [notifications] = await promisePool.query(query, [id]);
            
            if (notifications.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Exam notification not found'
                });
            }
            
            res.json({
                status: 'success',
                message: 'Exam notification retrieved successfully',
                data: notifications[0]
            });
            
        } catch (error) {
            console.error('=== GET EXAM NOTIFICATION BY ID ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve exam notification',
                error: error.message
            });
        }
    });

    // POST create new exam notification
    router.post('/', async (req, res) => {
        try {
            console.log('=== CREATE EXAM NOTIFICATION ===');
            console.log('Request body:', req.body);
            
            const {
                programme_id,
                semester_ids,
                regulation_ids,
                exam_type,
                exam_name,
                session_id,
                month_year_id,
                start_date,
                end_date,
                batch_id = null,
                batch_name = null,
                created_by = 'admin'
            } = req.body;

            // Validate required fields
            if (!programme_id || !semester_ids || !regulation_ids || !exam_type ||
                !exam_name || !session_id || !month_year_id ||
                !start_date || !end_date) {
                console.log('Validation failed - missing required fields');
                return res.status(400).json({
                    status: 'error',
                    message: 'All required fields must be provided'
                });
            }

            // ── 1. Programme code (e.g. "BTECH") ─────────────────────────────
            const [programme] = await promisePool.query(
                'SELECT programme_code FROM programme_master WHERE programme_id = ?',
                [programme_id]
            );
            if (programme.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Invalid programme selected' });
            }
            const programmeCode = programme[0].programme_code;

            // ── 2. Exam name label (e.g. "MSE-1") ────────────────────────────
            // exam_name is the exam_name_id — look up the display label
            const [examNameRow] = await promisePool.query(
                'SELECT exam_name FROM exam_name_master WHERE exam_name_id = ?',
                [exam_name]
            );
            const examLabel = examNameRow.length > 0
                ? examNameRow[0].exam_name   // e.g. "MSE-1"
                : String(exam_name);          // fallback: raw value

            // ── 3. Semester name(s) (e.g. "VI SEMESTER") ─────────────────────
            const semIdArray = semester_ids.split(',').map(s => s.trim()).filter(Boolean);
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

            // ── 4. Month-Year display (e.g. "April-2026") ────────────────────
            const [monthYear] = await promisePool.query(
                'SELECT display_name FROM month_year_master WHERE month_year_id = ?',
                [month_year_id]
            );
            const monthYearLabel = monthYear.length > 0 ? monthYear[0].display_name : 'UNKNOWN';

            // ── 5. Build dynamic title ────────────────────────────────────────
            // Result: "BTECH - MSE-1 - VI SEMESTER - April-2026"
            const notification_title = [programmeCode, examLabel, semesterLabel, monthYearLabel]
                .filter(Boolean)
                .join(' - ');

            console.log('Generated notification_title:', notification_title);

            // ── 6. Insert ─────────────────────────────────────────────────────
            const notification_id = `NOTIF_${Date.now()}`;

            const insertQuery = `
                INSERT INTO exam_notifications (
                    notification_id, notification_title, programmes, semesters, regulations,
                    exam_type, exam_name_id, session_id, month_year_id,
                    start_date, end_date, batch_id, batch_name, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await promisePool.query(insertQuery, [
                notification_id,
                notification_title,
                JSON.stringify([programme_id]),
                JSON.stringify(semIdArray),
                JSON.stringify(regulation_ids.split(',').map(s => s.trim())),
                exam_type,
                exam_name,
                session_id,
                month_year_id,
                start_date,
                end_date,
                batch_id,
                batch_name,
                created_by
            ]);

            const [newNotification] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notification_id]
            );

            res.status(201).json({
                status: 'success',
                message: 'Exam notification created successfully',
                data: newNotification[0]
            });
            
        } catch (error) {
            console.error('=== CREATE EXAM NOTIFICATION ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to create exam notification',
                error: error.message
            });
        }
    });

    // PUT update exam notification
    router.put('/:id', async (req, res) => {
        try {
            console.log('=== UPDATE EXAM NOTIFICATION ===');
            const { id } = req.params;
            
            const {
                programme_id,
                semester_ids,
                regulation_ids,
                exam_type,
                exam_name,
                session_id,
                month_year_id,
                exam_start_date,
                exam_end_date,
                notification_description,
                is_published,
                batch_id = null,
                batch_name = null,
                created_by
            } = req.body;

            // Check if notification exists
            const [existing] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [id]
            );
            if (existing.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Exam notification not found' });
            }

            // ── Rebuild dynamic title (same logic as POST) ───────────────────
            const [programme] = await promisePool.query(
                'SELECT programme_code FROM programme_master WHERE programme_id = ?',
                [programme_id]
            );
            const programmeCode = programme.length > 0 ? programme[0].programme_code : '';

            const [examNameRow] = await promisePool.query(
                'SELECT exam_name FROM exam_name_master WHERE exam_name_id = ?',
                [exam_name]
            );
            const examLabel = examNameRow.length > 0 ? examNameRow[0].exam_name : String(exam_name);

            const semIdArray = semester_ids.split(',').map(s => s.trim()).filter(Boolean);
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

            const [monthYear] = await promisePool.query(
                'SELECT display_name FROM month_year_master WHERE month_year_id = ?',
                [month_year_id]
            );
            const monthYearLabel = monthYear.length > 0 ? monthYear[0].display_name : 'UNKNOWN';

            const notification_title = [programmeCode, examLabel, semesterLabel, monthYearLabel]
                .filter(Boolean)
                .join(' - ');

            console.log('Updated notification_title:', notification_title);

            // ── Update ────────────────────────────────────────────────────────
            const updateQuery = `
                UPDATE exam_notifications SET
                    programmes = ?,
                    semesters = ?,
                    regulations = ?,
                    exam_type = ?,
                    exam_name_id = ?,
                    session_id = ?,
                    month_year_id = ?,
                    start_date = ?,
                    end_date = ?,
                    notification_title = ?,
                    description = ?,
                    status = ?,
                    batch_id = ?,
                    batch_name = ?,
                    created_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE notification_id = ?
            `;

            await promisePool.query(updateQuery, [
                JSON.stringify([programme_id]),
                JSON.stringify(semIdArray),
                JSON.stringify(regulation_ids.split(',').map(s => s.trim())),
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
            ]);

            const selectQuery = `
                SELECT 
                    en.*,
                    pm.programme_name,
                    sm.session_name,
                    sm.start_time as session_start_time,
                    sm.end_time as session_end_time,
                    mym.display_name as month_year_display
                FROM exam_notifications en
                LEFT JOIN programme_master pm ON en.programmes LIKE CONCAT('%"', pm.programme_id, '"%')
                LEFT JOIN sessions_master sm ON en.session_id = sm.session_id
                LEFT JOIN month_year_master mym ON en.month_year_id = mym.month_year_id
                WHERE en.notification_id = ?
            `;
            const [updatedNotification] = await promisePool.query(selectQuery, [id]);

            res.json({
                status: 'success',
                message: 'Exam notification updated successfully',
                data: updatedNotification[0]
            });
            
        } catch (error) {
            console.error('=== UPDATE EXAM NOTIFICATION ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update exam notification',
                error: error.message
            });
        }
    });

    // DELETE exam notification
    router.delete('/:id', async (req, res) => {
        try {
            console.log('=== DELETE EXAM NOTIFICATION ===');
            const { id } = req.params;
            
            const [existing] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [id]
            );
            if (existing.length === 0) {
                return res.status(404).json({ status: 'error', message: 'Exam notification not found' });
            }
            
            await promisePool.query(
                'DELETE FROM exam_notifications WHERE notification_id = ?',
                [id]
            );
            
            res.json({ status: 'success', message: 'Exam notification deleted successfully' });
            
        } catch (error) {
            console.error('=== DELETE EXAM NOTIFICATION ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete exam notification',
                error: error.message
            });
        }
    });

    // GET timetable entries for a notification
    router.get('/:id/timetable', async (req, res) => {
        try {
            console.log('=== GET TIMETABLE FOR NOTIFICATION ===');
            const { id } = req.params;
            
            const query = `
                SELECT 
                    te.*,
                    DATE_FORMAT(te.exam_date, '%Y-%m-%d') as exam_date_formatted,
                    bm.branch_name,
                    bm.branch_code,
                    sub.subject_name,
                    sub.syllabus_code,
                    sub.subject_code,
                    sub.is_elective,
                    sub.elective_name,
                    rm.room_number,
                    rm.room_building,
                    sm.staff_name as invigilator_name
                FROM exam_timetable_entries te
                LEFT JOIN branch_master bm ON te.branch_id = bm.branch_id
                LEFT JOIN subject_master sub ON te.subject_id = sub.subject_id
                LEFT JOIN room_master rm ON te.room_id = rm.room_id
                LEFT JOIN staff_master sm ON te.invigilator_staff_id = sm.staff_id
                WHERE te.notification_id = ?
                ORDER BY te.exam_date, bm.branch_name, te.session_order
            `;
            
            const [timetableEntries] = await promisePool.query(query, [id]);
            
            res.json({
                status: 'success',
                message: 'Timetable entries retrieved successfully',
                data: timetableEntries
            });
            
        } catch (error) {
            console.error('=== GET TIMETABLE FOR NOTIFICATION ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve timetable entries',
                error: error.message
            });
        }
    });

    // GET unassigned subjects for a notification
    router.get('/:id/unassigned', async (req, res) => {
        try {
            console.log('=== GET UNASSIGNED SUBJECTS FOR NOTIFICATION ===');
            const { id } = req.params;
            
            const query = `
                SELECT 
                    us.*,
                    bm.branch_name,
                    bm.branch_code,
                    sub.subject_name,
                    sub.syllabus_code,
                    sub.subject_code,
                    sub.is_elective,
                    sub.elective_name
                FROM exam_unassigned_subjects us
                LEFT JOIN branch_master bm ON us.branch_id = bm.branch_id
                LEFT JOIN subject_master sub ON us.subject_id = sub.subject_id
                WHERE us.notification_id = ?
                ORDER BY us.priority_order, bm.branch_name, sub.subject_name
            `;
            
            const [unassignedSubjects] = await promisePool.query(query, [id]);
            
            res.json({
                status: 'success',
                message: 'Unassigned subjects retrieved successfully',
                data: unassignedSubjects
            });
            
        } catch (error) {
            console.error('=== GET UNASSIGNED SUBJECTS FOR NOTIFICATION ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to retrieve unassigned subjects',
                error: error.message
            });
        }
    });

    return router;
}

module.exports = { initializeRouter };
