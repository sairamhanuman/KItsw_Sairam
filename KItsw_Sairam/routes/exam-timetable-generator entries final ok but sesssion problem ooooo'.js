const express = require('express');

function initializeRouter(promisePool) {
    const router = express.Router();

    // ── GET /saved/:notificationId ──────────────────────────────────────────
    router.get('/saved/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;

            const [entries] = await promisePool.query(`
                SELECT
                    ete.timetable_id,
                    CAST(ete.notification_id AS CHAR) AS notification_id,
                    DATE_FORMAT(ete.exam_date, '%Y-%m-%d') AS exam_date,
                    ete.branch_id,
                    ete.subject_id,
                    ete.session_order,
                    ete.status,
                    sm.subject_name,
                    sm.syllabus_code,
                    sm.subject_type,
                    COALESCE(sm.is_elective, 0)    AS is_elective,
                    COALESCE(sm.is_under_group, 0) AS is_under_group,
                    sm.elective_name,
                    bm.branch_name,
                    bm.branch_code
                FROM exam_timetable_entries ete
                LEFT JOIN subject_master sm ON sm.subject_id = ete.subject_id
                LEFT JOIN branch_master  bm ON bm.branch_id  = ete.branch_id
                WHERE CAST(ete.notification_id AS CHAR) = ?
                ORDER BY ete.exam_date, bm.branch_code, sm.syllabus_code
            `, [notificationId]);

            let unassigned = [];
            try {
                const [rows] = await promisePool.query(`
                    SELECT
                        eus.unassigned_id,
                        CAST(eus.notification_id AS CHAR) AS notification_id,
                        eus.branch_id,
                        eus.subject_id,
                        eus.reason,
                        sm.subject_name,
                        sm.syllabus_code,
                        sm.subject_type,
                        COALESCE(sm.is_elective, 0)    AS is_elective,
                        COALESCE(sm.is_under_group, 0) AS is_under_group,
                        sm.elective_name,
                        bm.branch_name,
                        bm.branch_code
                    FROM exam_unassigned_subjects eus
                    LEFT JOIN subject_master sm ON sm.subject_id = eus.subject_id
                    LEFT JOIN branch_master  bm ON bm.branch_id  = eus.branch_id
                    WHERE CAST(eus.notification_id AS CHAR) = ?
                    ORDER BY bm.branch_code, sm.syllabus_code
                `, [notificationId]);
                unassigned = rows;
            } catch (_) {}

            const dates = [...new Set(entries.map(e => e.exam_date))].sort();
            const branchMap = {};
            [...entries, ...unassigned].forEach(e => {
                if (e.branch_id && !branchMap[e.branch_id]) {
                    branchMap[e.branch_id] = {
                        id:   e.branch_id,
                        name: e.branch_name || `Branch ${e.branch_id}`,
                        code: e.branch_code || `B${e.branch_id}`
                    };
                }
            });
            const branches = Object.values(branchMap)
                .sort((a, b) => (a.code||'').localeCompare(b.code||''));

            res.json({ status:'success', entries, unassigned, dates, branches, total:entries.length });

        } catch (err) {
            console.error('[/saved]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /save-bulk ─────────────────────────────────────────────────────
    // FIXED: uses SELECT * to handle both 'semesters' and 'semester_ids' columns
    router.post('/save-bulk', async (req, res) => {
        try {
            const { notification_id, entries } = req.body;
            if (!notification_id || !entries?.length) {
                return res.status(400).json({ status:'error', message:'notification_id and entries required' });
            }

            // SELECT * handles both old (semester_ids) and new (semesters) column names
            const [[notif]] = await promisePool.query(
                `SELECT * FROM exam_notifications WHERE notification_id = ?`,
                [notification_id]
            );

            let semesterId   = null;
            let regulationId = null;
            let batchId      = notif?.batch_id   || null;
            let batchName    = notif?.batch_name  || null;

            const semRaw = notif?.semesters   || notif?.semester_ids   || null;
            const regRaw = notif?.regulations || notif?.regulation_ids || null;

            if (semRaw) {
                try { const a = JSON.parse(semRaw); semesterId   = Array.isArray(a) ? a[0] : a; }
                catch(_) { semesterId   = semRaw; }
            }
            if (regRaw) {
                try { const a = JSON.parse(regRaw); regulationId = Array.isArray(a) ? a[0] : a; }
                catch(_) { regulationId = regRaw; }
            }

            // Delete existing then re-insert (notification_id stored as string)
            await promisePool.query(
                `DELETE FROM exam_timetable_entries WHERE CAST(notification_id AS CHAR) = ?`,
                [notification_id]
            );

            const rows = entries.map(e => [
                notification_id,        // stored as-is (VARCHAR)
                e.exam_date,
                e.branch_id,
                e.subject_id,
                semesterId,
                regulationId,
                e.session_order || 1,
                'scheduled',
                batchId,
                batchName
            ]);

            await promisePool.query(`
                INSERT INTO exam_timetable_entries
                    (notification_id, exam_date, branch_id, subject_id,
                     semester_id, regulation_id, session_order, status,
                     batch_id, batch_name)
                VALUES ?
            `, [rows]);

            await promisePool.query(
                `UPDATE exam_notifications SET timetable_generated = 1 WHERE notification_id = ?`,
                [notification_id]
            ).catch(() => {});

            console.log(`[/save-bulk] Saved ${rows.length} entries for ${notification_id}`);

            res.json({ status:'success', message:`${rows.length} entries saved`, total:rows.length });

        } catch (err) {
            console.error('[/save-bulk]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /generate/:notificationId ─────────────────────────────────────
    // FIXED: notification_id stored as string, not parseInt
    router.post('/generate/:notificationId', async (req, res) => {
        try {
            const { notificationId } = req.params;

            const [notification] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            if (!notification.length) {
                return res.status(404).json({ status:'error', message:'Notification not found' });
            }
            const notif = notification[0];

            await promisePool.query(
                'DELETE FROM exam_timetable_entries WHERE CAST(notification_id AS CHAR) = ?',
                [notificationId]
            );
            await promisePool.query(
                'DELETE FROM exam_unassigned_subjects WHERE CAST(notification_id AS CHAR) = ?',
                [notificationId]
            );

            // Support both semesters/semester_ids and regulations/regulation_ids
            const semIds = notif.semesters   || notif.semester_ids   || '';
            const regIds = notif.regulations || notif.regulation_ids || '';

            const [subjects] = await promisePool.query(`
                SELECT sm.*, bm.branch_id, bm.branch_name, bm.branch_code
                FROM subject_master sm
                JOIN branch_master bm ON sm.branch_id = bm.branch_id
                WHERE sm.programme_id = ?
                  AND FIND_IN_SET(sm.semester_id,   ?) > 0
                  AND FIND_IN_SET(sm.regulation_id, ?) > 0
                  AND sm.is_active = 1
                ORDER BY bm.branch_code, sm.subject_order, sm.subject_name
            `, [notif.programme_id, semIds, regIds]);

            let holidayDates = [];
            try {
                const [holidays] = await promisePool.query(
                    `SELECT DATE_FORMAT(holiday_date,'%Y-%m-%d') AS hdate FROM holidays WHERE is_active = 1`
                );
                holidayDates = holidays.map(h => h.hdate);
            } catch (_) {}

            const examDates = [];
            for (let d = new Date(notif.start_date); d <= new Date(notif.end_date); d.setDate(d.getDate()+1)) {
                if (d.getDay() === 0) continue;
                const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                if (!holidayDates.includes(ds)) examDates.push(ds);
            }

            if (!examDates.length) {
                return res.status(400).json({ status:'error', message:'No valid exam dates found' });
            }

            const subjectsByBranch = {};
            subjects.forEach(s => {
                if (!subjectsByBranch[s.branch_id]) subjectsByBranch[s.branch_id] = [];
                subjectsByBranch[s.branch_id].push(s);
            });

            const timetableEntries = [];
            const unassignedSubjects = [];
            const scheduledSet = new Set();

            examDates.forEach(dateStr => {
                Object.keys(subjectsByBranch).forEach(branchId => {
                    for (const subject of subjectsByBranch[branchId]) {
                        if (!scheduledSet.has(String(subject.subject_id))) {
                            timetableEntries.push({
                                notification_id: notificationId,  // string, not parseInt
                                exam_date:       dateStr,
                                branch_id:       subject.branch_id,
                                subject_id:      subject.subject_id,
                                session_order:   1,
                                status:          'scheduled'
                            });
                            scheduledSet.add(String(subject.subject_id));
                            break;
                        }
                    }
                });
            });

            subjects.forEach(s => {
                if (!scheduledSet.has(String(s.subject_id))) {
                    unassignedSubjects.push({
                        notification_id: notificationId,  // string
                        subject_id:      s.subject_id,
                        branch_id:       s.branch_id,
                        reason:          'no_dates_available',
                        priority_order:  0
                    });
                }
            });

            if (timetableEntries.length > 0) {
                const rows = timetableEntries.map(e => [
                    e.notification_id, e.exam_date, e.branch_id,
                    e.subject_id, e.session_order, e.status
                ]);
                await promisePool.query(`
                    INSERT INTO exam_timetable_entries
                        (notification_id,exam_date,branch_id,subject_id,session_order,status)
                    VALUES ?
                `, [rows]);
            }

            if (unassignedSubjects.length > 0) {
                const rows = unassignedSubjects.map(e => [
                    e.notification_id, e.subject_id, e.branch_id, e.reason, e.priority_order
                ]);
                await promisePool.query(`
                    INSERT INTO exam_unassigned_subjects
                        (notification_id,subject_id,branch_id,reason,priority_order)
                    VALUES ?
                `, [rows]);
            }

            await promisePool.query(
                'UPDATE exam_notifications SET timetable_generated = 1 WHERE notification_id = ?',
                [notificationId]
            ).catch(() => {});

            res.json({
                status:  'success',
                message: 'Timetable generated',
                data: {
                    scheduled_entries:   timetableEntries.length,
                    unassigned_subjects: unassignedSubjects.length,
                    total_dates:         examDates.length,
                    total_branches:      Object.keys(subjectsByBranch).length
                }
            });

        } catch (err) {
            console.error('[/generate]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /update-entry ──────────────────────────────────────────────────
    router.post('/update-entry', async (req, res) => {
        try {
            const { timetable_id, new_exam_date, swap_timetable_id } = req.body;
            if (!timetable_id || !new_exam_date) {
                return res.status(400).json({ status:'error', message:'timetable_id and new_exam_date required' });
            }

            const [[entry]] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?', [timetable_id]
            );
            if (!entry) return res.status(404).json({ status:'error', message:'Entry not found' });

            if (swap_timetable_id) {
                const [[entryB]] = await promisePool.query(
                    'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?', [swap_timetable_id]
                );
                if (!entryB) return res.status(404).json({ status:'error', message:'Swap entry not found' });

                const dateA = entry.exam_date;
                const dateB = entryB.exam_date;
                await promisePool.query(
                    `UPDATE exam_timetable_entries SET exam_date = '1970-01-01' WHERE timetable_id = ?`, [timetable_id]
                );
                await promisePool.query(
                    `UPDATE exam_timetable_entries SET exam_date = ? WHERE timetable_id = ?`, [dateA, swap_timetable_id]
                );
                await promisePool.query(
                    `UPDATE exam_timetable_entries SET exam_date = ? WHERE timetable_id = ?`, [dateB, timetable_id]
                );
                return res.json({ status:'success', message:'Dates swapped', swapped:true });
            }

            const [conflicts] = await promisePool.query(`
                SELECT timetable_id FROM exam_timetable_entries
                WHERE exam_date = ? AND branch_id = ? AND CAST(notification_id AS CHAR) = ?
                  AND timetable_id != ?
            `, [new_exam_date, entry.branch_id, String(entry.notification_id), timetable_id]);

            if (conflicts.length > 0) {
                return res.status(409).json({
                    status:'error',
                    message:`Date ${new_exam_date} already has an entry for this branch.`,
                    conflict_id: conflicts[0].timetable_id
                });
            }

            await promisePool.query(
                'UPDATE exam_timetable_entries SET exam_date = ? WHERE timetable_id = ?',
                [new_exam_date, timetable_id]
            );
            res.json({ status:'success', message:'Date updated', timetable_id, new_exam_date });

        } catch (err) {
            console.error('[/update-entry]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /assign-subject ────────────────────────────────────────────────
    router.post('/assign-subject', async (req, res) => {
        try {
            const { unassigned_id, exam_date, branch_id, session_order = 1 } = req.body;
            const [[unassigned]] = await promisePool.query(
                'SELECT * FROM exam_unassigned_subjects WHERE unassigned_id = ?', [unassigned_id]
            );
            if (!unassigned) return res.status(404).json({ status:'error', message:'Not found' });

            const [conflicts] = await promisePool.query(`
                SELECT timetable_id FROM exam_timetable_entries
                WHERE exam_date = ? AND branch_id = ? AND CAST(notification_id AS CHAR) = ?
            `, [exam_date, branch_id, String(unassigned.notification_id)]);

            if (conflicts.length > 0) {
                return res.status(409).json({ status:'error', message:'Date already has an entry for this branch.' });
            }

            const [result] = await promisePool.query(`
                INSERT INTO exam_timetable_entries
                    (notification_id, exam_date, branch_id, subject_id, session_order, status)
                VALUES (?, ?, ?, ?, ?, 'scheduled')
            `, [unassigned.notification_id, exam_date, branch_id, unassigned.subject_id, session_order]);

            await promisePool.query(
                'DELETE FROM exam_unassigned_subjects WHERE unassigned_id = ?', [unassigned_id]
            );
            res.json({ status:'success', timetable_id:result.insertId });

        } catch (err) {
            console.error('[/assign-subject]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // ── POST /unassign-subject ──────────────────────────────────────────────
    router.post('/unassign-subject', async (req, res) => {
        try {
            const { timetable_id, reason = 'pending' } = req.body;
            const [[entry]] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?', [timetable_id]
            );
            if (!entry) return res.status(404).json({ status:'error', message:'Not found' });

            await promisePool.query(`
                INSERT INTO exam_unassigned_subjects
                    (notification_id, subject_id, branch_id, reason, priority_order)
                VALUES (?, ?, ?, ?, 0)
            `, [entry.notification_id, entry.subject_id, entry.branch_id, reason]);

            await promisePool.query(
                'DELETE FROM exam_timetable_entries WHERE timetable_id = ?', [timetable_id]
            );
            res.json({ status:'success', message:'Subject unassigned' });

        } catch (err) {
            console.error('[/unassign-subject]', err.message);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
