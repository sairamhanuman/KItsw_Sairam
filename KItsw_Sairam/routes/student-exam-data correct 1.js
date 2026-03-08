const express = require('express');
const router = express.Router();

let promisePool;

function initializeRouter(pool) {
    promisePool = pool;
    return router;
}

// ============================================================
// HELPER: Same hash used in exam-timetable-routes.js
// Converts VARCHAR notification_id → INT to match DB storage
// e.g. 'NOTIF_1772246814292' → 474965620
// ============================================================
function hashNotificationId(notificationId) {
    return Math.abs(notificationId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0));
}

// ============================================================
// HELPER: Timezone-safe date string (avoids UTC -5:30 shift)
// Returns 'YYYY-MM-DD' using local time, not UTC
// ============================================================
function toLocalDateString(dateValue) {
    if (!dateValue) return null;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return null;
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================
// GET /api/student-exam-data/students
// Fetch all students with their exam subjects for a notification
// Query params: notification_id
// ============================================================
router.get('/students', async (req, res) => {
    try {
        const { notification_id } = req.query;

        if (!notification_id) {
            return res.status(400).json({ status: 'error', message: 'notification_id is required' });
        }

        console.log('=== FETCH STUDENT EXAM DATA ===');
        console.log('notification_id:', notification_id);

        // STEP 1: Get notification details
        const [notifications] = await promisePool.query(`
            SELECT 
                en.*,
                sm.session_name,
                sm.start_time,
                sm.end_time,
                sm.session_type,
                enm.exam_name,
                enm.exam_code,
                enm.exam_type AS exam_category,
                enm.max_marks,
                enm.duration_minutes
            FROM exam_notifications en
            LEFT JOIN sessions_master sm ON en.session_id = sm.session_id
            LEFT JOIN exams_naming_master enm ON en.exam_name_id = enm.exam_naming_id
            WHERE en.notification_id = ?
        `, [notification_id]);

        if (notifications.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Notification not found' });
        }

        const notification = notifications[0];

        // Parse JSON fields safely
        const parseJsonField = (field) => {
            if (!field) return [];
            if (Array.isArray(field)) return field.map(Number);
            if (typeof field === 'string') return JSON.parse(field).map(Number);
            return [Number(field)];
        };

        const semesterIds   = parseJsonField(notification.semesters);
        const programmeIds  = parseJsonField(notification.programmes);
        const regulationIds = parseJsonField(notification.regulations);
        const batchId       = notification.batch_id;

        console.log('Notification context:', { semesterIds, programmeIds, regulationIds, batchId });

        if (!semesterIds.length || !batchId) {
            return res.status(400).json({ status: 'error', message: 'Notification missing semester or batch information' });
        }

        // ✅ FIX: Use hash to query exam_timetable_entries (same hash used when saving)
        const notificationIdHash = hashNotificationId(notification_id);
        console.log(`🔍 Querying timetable: ${notification_id} → hash: ${notificationIdHash}`);

        // STEP 2: Get timetable entries by notification_id hash
        const [timetableEntries] = await promisePool.query(`
            SELECT 
                ete.timetable_id,
                ete.exam_date,
                ete.branch_id,
                ete.subject_id,
                ete.session_order,
                ete.status,
                sub.subject_name,
                sub.syllabus_code,
                sub.subject_type,
                sub.internal_exam_code,
                sub.external_exam_code,
                sub.is_elective,
                sub.is_under_group,
                sub.elective_name,
                sub.is_replacement,
                sub.semester_id,
                sub.regulation_id
            FROM exam_timetable_entries ete
            JOIN subject_master sub ON ete.subject_id = sub.subject_id
            WHERE ete.notification_id = ?
            ORDER BY ete.exam_date, ete.session_order
        `, [notificationIdHash]);

        console.log(`Found ${timetableEntries.length} timetable entries`);

        // ✅ FIX: Convert exam_date to local date string to avoid UTC timezone shift
        timetableEntries.forEach(entry => {
            entry.exam_date = toLocalDateString(entry.exam_date);
        });

        // STEP 3: Get all In Roll students for this batch + semester
        const semesterPlaceholders = semesterIds.map(() => '?').join(',');

        const [students] = await promisePool.query(`
            SELECT 
                ssh.semester_history_id,
                ssh.student_id,
                ssh.academic_year,
                ssh.semester_id,
                ssh.programme_id,
                ssh.branch_id,
                ssh.batch_id,
                ssh.regulation_id,
                ssh.section_id,
                ssh.roll_number AS semester_roll_number,
                ssh.student_status,
                sm.full_name,
                sm.ht_number,
                sm.roll_number AS master_roll_number,
                sm.admission_number,
                sm.father_name,
                sm.mother_name,
                sm.date_of_birth,
                sm.gender,
                sm.photo_url,
                sm.student_mobile,
                sm.aadhaar_number,
                sm.is_lateral,
                sm.is_handicapped,
                pm.programme_name,
                pm.programme_code,
                bm.branch_name,
                bm.branch_code,
                sem.semester_name,
                sem.semester_number,
                rm.regulation_name,
                btm.batch_name,
                sec.section_name
            FROM student_semester_history ssh
            JOIN student_master sm ON ssh.student_id = sm.student_id
            JOIN programme_master pm ON ssh.programme_id = pm.programme_id
            JOIN branch_master bm ON ssh.branch_id = bm.branch_id
            JOIN semester_master sem ON ssh.semester_id = sem.semester_id
            JOIN regulation_master rm ON ssh.regulation_id = rm.regulation_id
            JOIN batch_master btm ON ssh.batch_id = btm.batch_id
            LEFT JOIN section_master sec ON ssh.section_id = sec.section_id
            WHERE ssh.batch_id = ?
            AND ssh.semester_id IN (${semesterPlaceholders})
            AND ssh.student_status = 'In Roll'
            AND sm.is_active = 1
            ORDER BY bm.branch_name, ssh.roll_number
        `, [batchId, ...semesterIds]);

        console.log(`Found ${students.length} In Roll students`);

        // STEP 4: For each student, resolve their subjects
        const studentsWithSubjects = [];

        for (const student of students) {
            // Filter timetable entries for this student's branch only.
            // semester_id / regulation_id are NOT used here because subject_master
            // may have NULL or mismatched values for those fields on non-AIML branches,
            // which would silently exclude those students.
            // The notification already scopes semester + regulation, so branch_id is enough.
            const studentTimetable = timetableEntries.filter(
                t => t.branch_id === student.branch_id
            );

            const resolvedSubjects = [];

            for (const entry of studentTimetable) {
                let finalSubjectId    = entry.subject_id;
                let finalSubjectName  = entry.subject_name;
                let finalSyllabusCode = entry.syllabus_code;
                let finalExamCode     = entry.internal_exam_code;
                let isReplaced        = false;
                let isElectiveResolved = false;

                // RULE 1: Skip replacement subjects in timetable
                if (entry.is_replacement === 1) continue;

                // RULE 2: For elective subjects - check student_elective_mapping
                if (entry.is_elective === 1 && entry.is_under_group === 1) {
                    const [electiveMapping] = await promisePool.query(`
                        SELECT sem.subject_id, sub.subject_name, sub.syllabus_code,
                               sub.internal_exam_code
                        FROM student_elective_mapping sem
                        JOIN subject_master sub ON sem.subject_id = sub.subject_id
                        WHERE sem.student_id = ?
                        AND sem.semester_id = ?
                        AND sem.branch_id = ?
                        AND sem.batch_id = ?
                        AND sem.is_active = 1
                        AND sub.elective_name = ?
                    `, [student.student_id, student.semester_id, student.branch_id, student.batch_id, entry.elective_name]);

                    if (electiveMapping.length === 0) continue;

                    finalSubjectId    = electiveMapping[0].subject_id;
                    finalSubjectName  = electiveMapping[0].subject_name;
                    finalSyllabusCode = electiveMapping[0].syllabus_code;
                    finalExamCode     = electiveMapping[0].internal_exam_code;
                    isElectiveResolved = true;
                }

                // RULE 3: Check if student replaced this subject
                const [replacement] = await promisePool.query(`
                    SELECT ssr.replacement_subject_id,
                           sub.subject_name, sub.syllabus_code, sub.internal_exam_code
                    FROM student_subject_replacement ssr
                    JOIN subject_master sub ON ssr.replacement_subject_id = sub.subject_id
                    WHERE ssr.student_id = ?
                    AND ssr.original_subject_id = ?
                    AND ssr.is_active = 1
                `, [student.student_id, finalSubjectId]);

                if (replacement.length > 0) {
                    finalSubjectId    = replacement[0].replacement_subject_id;
                    finalSubjectName  = replacement[0].subject_name;
                    finalSyllabusCode = replacement[0].syllabus_code;
                    finalExamCode     = replacement[0].internal_exam_code;
                    isReplaced = true;
                }

                resolvedSubjects.push({
                    timetable_id: entry.timetable_id,
                    exam_date: entry.exam_date,
                    session_order: entry.session_order,
                    session_name: notification.session_name,
                    start_time: notification.start_time,
                    end_time: notification.end_time,
                    subject_id: finalSubjectId,
                    subject_name: finalSubjectName,
                    syllabus_code: finalSyllabusCode,
                    subject_type: entry.subject_type,
                    exam_code: finalExamCode,
                    is_elective: entry.is_elective,
                    elective_name: entry.elective_name,
                    is_replaced: isReplaced,
                    is_elective_resolved: isElectiveResolved
                });
            }

            if (resolvedSubjects.length > 0) {
                studentsWithSubjects.push({
                    student_id: student.student_id,
                    semester_history_id: student.semester_history_id,
                    full_name: student.full_name,
                    ht_number: student.ht_number,
                    roll_number: student.semester_roll_number || student.master_roll_number,
                    admission_number: student.admission_number,
                    father_name: student.father_name,
                    mother_name: student.mother_name,
                    date_of_birth: student.date_of_birth,
                    gender: student.gender,
                    photo_url: student.photo_url,
                    student_mobile: student.student_mobile,
                    is_lateral: student.is_lateral,
                    is_handicapped: student.is_handicapped,
                    programme_name: student.programme_name,
                    programme_code: student.programme_code,
                    branch_name: student.branch_name,
                    branch_code: student.branch_code,
                    semester_name: student.semester_name,
                    semester_number: student.semester_number,
                    regulation_name: student.regulation_name,
                    batch_name: student.batch_name,
                    section_name: student.section_name,
                    academic_year: student.academic_year,
                    subjects: resolvedSubjects
                });
            }
        }

        // STEP 5: Group by date + session for seating arrangement
        const dateSessionGroups = {};
        for (const student of studentsWithSubjects) {
            for (const subject of student.subjects) {
                const key = `${subject.exam_date}_${subject.session_order}`;
                if (!dateSessionGroups[key]) {
                    dateSessionGroups[key] = {
                        exam_date: subject.exam_date,
                        session_order: subject.session_order,
                        session_name: subject.session_name,
                        start_time: subject.start_time,
                        end_time: subject.end_time,
                        students: []
                    };
                }
                dateSessionGroups[key].students.push({
                    student_id: student.student_id,
                    roll_number: student.roll_number,
                    full_name: student.full_name,
                    branch_name: student.branch_name,
                    branch_code: student.branch_code,
                    subject_name: subject.subject_name,
                    syllabus_code: subject.syllabus_code,
                    subject_type: subject.subject_type
                });
            }
        }

        console.log(`✅ Processed ${studentsWithSubjects.length} students`);
        console.log(`✅ Date-session groups: ${Object.keys(dateSessionGroups).length}`);

        res.json({
            status: 'success',
            data: {
                notification: {
                    notification_id: notification.notification_id,
                    notification_title: notification.notification_title,
                    exam_name: notification.exam_name,
                    exam_code: notification.exam_code,
                    exam_type: notification.exam_category,
                    max_marks: notification.max_marks,
                    duration_minutes: notification.duration_minutes,
                    session_name: notification.session_name,
                    start_time: notification.start_time,
                    end_time: notification.end_time,
                    start_date: toLocalDateString(notification.start_date),
                    end_date: toLocalDateString(notification.end_date),
                    batch_name: notification.batch_name,
                    academic_year: notification.academic_year
                },
                total_students: studentsWithSubjects.length,
                students: studentsWithSubjects,
                date_session_groups: Object.values(dateSessionGroups).sort((a, b) => {
                    if (a.exam_date !== b.exam_date) return a.exam_date.localeCompare(b.exam_date);
                    return a.session_order - b.session_order;
                })
            }
        });

    } catch (error) {
        console.error('=== STUDENT EXAM DATA ERROR ===', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ============================================================
// GET /api/student-exam-data/by-date-session
// Get students for a specific date + session (for seating)
// Query params: notification_id, exam_date, session_order
// ============================================================
router.get('/by-date-session', async (req, res) => {
    try {
        const { notification_id, exam_date, session_order } = req.query;

        if (!notification_id || !exam_date || !session_order) {
            return res.status(400).json({
                status: 'error',
                message: 'notification_id, exam_date, session_order are required'
            });
        }

        const notificationIdHash = hashNotificationId(notification_id); // ✅ FIXED

        const [students] = await promisePool.query(`
            SELECT 
                ssh.student_id,
                ssh.roll_number AS semester_roll_number,
                ssh.branch_id,
                ssh.section_id,
                sm.full_name,
                sm.ht_number,
                sm.photo_url,
                sm.gender,
                sm.is_handicapped,
                bm.branch_name,
                bm.branch_code,
                sub.subject_name,
                sub.syllabus_code,
                sub.subject_type,
                ete.exam_date,
                ete.session_order
            FROM exam_timetable_entries ete
            JOIN subject_master sub ON ete.subject_id = sub.subject_id
            JOIN student_semester_history ssh ON (
                ssh.branch_id = ete.branch_id
                AND ssh.semester_id = sub.semester_id
                AND ssh.batch_id = ete.batch_id
                AND ssh.student_status = 'In Roll'
            )
            JOIN student_master sm ON ssh.student_id = sm.student_id
            JOIN branch_master bm ON ssh.branch_id = bm.branch_id
            WHERE ete.notification_id = ?
            AND DATE(ete.exam_date) = ?
            AND ete.session_order = ?
            AND ete.status = 'scheduled'
            AND sub.is_replacement = 0
            AND sm.is_active = 1
            ORDER BY bm.branch_name, ssh.roll_number
        `, [notificationIdHash, exam_date, session_order]);

        res.json({
            status: 'success',
            data: {
                exam_date,
                session_order: parseInt(session_order),
                total_students: students.length,
                students
            }
        });

    } catch (error) {
        console.error('Error fetching by date session:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = { initializeRouter };
