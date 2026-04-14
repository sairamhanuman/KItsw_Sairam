const express = require('express');

// ============================================================
// FIXED: No more hashing — notification_id stored as string
// ============================================================

function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field.map(Number);
    if (typeof field === 'string') {
        try { return JSON.parse(field).map(Number); } catch(_) { return [Number(field)]; }
    }
    return [Number(field)];
}

function initializeRouter(promisePool) {
    const router = express.Router();

    // GET all timetable entries for a notification
    router.get('/:notificationId/entries', async (req, res) => {
        try {
            const { notificationId } = req.params;

            const [entries] = await promisePool.query(`
                SELECT ete.*,
                       bm.branch_name, bm.branch_code,
                       sm.subject_name, sm.syllabus_code, sm.subject_type
                FROM exam_timetable_entries ete
                LEFT JOIN branch_master  bm ON ete.branch_id  = bm.branch_id
                LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                WHERE CAST(ete.notification_id AS CHAR) = ?
                ORDER BY ete.exam_date, ete.branch_id, ete.session_order
            `, [notificationId]);

            res.json({ status:'success', message:'Timetable entries retrieved', data:entries });

        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // PUT bulk update timetable entries — FIXED: stores raw string notification_id
    router.put('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== BULK UPDATE TIMETABLE ENTRIES ===');
            const { notificationId } = req.params;
            const { entries } = req.body;

            if (!entries || !Array.isArray(entries)) {
                return res.status(400).json({ status:'error', message:'Invalid entries data' });
            }

            console.log(`🔄 ${entries.length} entries for ${notificationId} (stored as-is, no hash)`);

            const [notifRows] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            if (!notifRows.length) {
                return res.status(404).json({ status:'error', message:'Notification not found' });
            }

            const notif       = notifRows[0];
            const semRaw      = notif.semesters   || notif.semester_ids   || null;
            const regRaw      = notif.regulations || notif.regulation_ids || null;
            let semesterId    = null;
            let regulationId  = null;

            if (semRaw) {
                try { const a = JSON.parse(semRaw); semesterId   = Array.isArray(a) ? a[0] : a; }
                catch(_) { semesterId = semRaw; }
            }
            if (regRaw) {
                try { const a = JSON.parse(regRaw); regulationId = Array.isArray(a) ? a[0] : a; }
                catch(_) { regulationId = regRaw; }
            }

            console.log(`📌 Stamping all entries: semester_id=${semesterId}, regulation_id=${regulationId}`);

            // ── Resolve session_order from sessions_master ────────────────
            let sessionOrder = 1;
            try {
                const [[sessRow]] = await promisePool.query(
                    `SELECT COALESCE(session_group, session_name) AS grp
                     FROM sessions_master WHERE session_id = ?`,
                    [notif.session_id]
                );
                sessionOrder = (sessRow?.grp || 'AN').toUpperCase() === 'FN' ? 1 : 2;
            } catch (_) {}
            console.log(`[entries PUT] session_id=${notif.session_id} → session_order=${sessionOrder}`);

            const connection = await promisePool.getConnection();
            await connection.beginTransaction();

            try {
                // Delete using string match
                await connection.query(
                    'DELETE FROM exam_timetable_entries WHERE CAST(notification_id AS CHAR) = ?',
                    [notificationId]
                );

                for (const entry of entries) {
                    await connection.query(`
                        INSERT INTO exam_timetable_entries (
                            notification_id, exam_date, branch_id, semester_id, regulation_id,
                            subject_id, session_order, room_id, invigilator_staff_id,
                            status, notes, batch_id, batch_name,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `, [
                        notificationId,          // raw string — no hash
                        entry.exam_date,
                        entry.branch_id,
                        semesterId,
                        regulationId,
                        entry.subject_id,
                        sessionOrder,                              // resolved from sessions_master
                        entry.room_id || null,
                        entry.invigilator_staff_id || null,
                        entry.status || 'scheduled',
                        entry.notes || null,
                        entry.batch_id || null,
                        entry.batch_name || null
                    ]);
                }

                await connection.commit();
                console.log(`✅ Inserted ${entries.length} entries for ${notificationId}`);

                const [updated] = await promisePool.query(`
                    SELECT ete.*, bm.branch_name, bm.branch_code,
                           sm.subject_name, sm.syllabus_code, sm.subject_type
                    FROM exam_timetable_entries ete
                    LEFT JOIN branch_master  bm ON ete.branch_id  = bm.branch_id
                    LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                    WHERE CAST(ete.notification_id AS CHAR) = ?
                    ORDER BY ete.exam_date, ete.branch_id, ete.session_order
                `, [notificationId]);

                res.json({ status:'success', message:'Timetable updated', data:updated });

            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }

        } catch (err) {
            console.error('Error updating timetable entries:', err);
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // PATCH single timetable entry
    router.patch('/:notificationId/entries/:entryId', async (req, res) => {
        try {
            const { notificationId, entryId } = req.params;
            const updateData = req.body;

            const updateFields = [];
            const updateValues = [];

            if (updateData.exam_date !== undefined)            { updateFields.push('exam_date = ?');            updateValues.push(updateData.exam_date); }
            if (updateData.branch_id !== undefined)            { updateFields.push('branch_id = ?');            updateValues.push(updateData.branch_id); }
            if (updateData.subject_id !== undefined)           { updateFields.push('subject_id = ?');           updateValues.push(updateData.subject_id); }
            if (updateData.session_order !== undefined)        { updateFields.push('session_order = ?');        updateValues.push(updateData.session_order); }
            if (updateData.room_id !== undefined)              { updateFields.push('room_id = ?');              updateValues.push(updateData.room_id); }
            if (updateData.invigilator_staff_id !== undefined) { updateFields.push('invigilator_staff_id = ?');updateValues.push(updateData.invigilator_staff_id); }
            if (updateData.status !== undefined)               { updateFields.push('status = ?');              updateValues.push(updateData.status); }
            if (updateData.notes !== undefined)                { updateFields.push('notes = ?');               updateValues.push(updateData.notes); }

            if (!updateFields.length) {
                return res.status(400).json({ status:'error', message:'No fields to update' });
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(entryId, notificationId);

            const [result] = await promisePool.query(
                `UPDATE exam_timetable_entries
                 SET ${updateFields.join(', ')}
                 WHERE timetable_id = ? AND CAST(notification_id AS CHAR) = ?`,
                updateValues
            );

            if (!result.affectedRows) {
                return res.status(404).json({ status:'error', message:'Entry not found' });
            }

            res.json({ status:'success', message:'Entry updated' });

        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // POST new timetable entry
    router.post('/:notificationId/entries', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const entryData = req.body;

            const [notifRows] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?', [notificationId]
            );
            const notif      = notifRows[0] || {};
            const semRaw     = notif.semesters   || notif.semester_ids   || null;
            const regRaw     = notif.regulations || notif.regulation_ids || null;
            let semesterId   = null;
            let regulationId = null;
            if (semRaw) { try { const a = JSON.parse(semRaw); semesterId   = Array.isArray(a)?a[0]:a; } catch(_){semesterId=semRaw;} }
            if (regRaw) { try { const a = JSON.parse(regRaw); regulationId = Array.isArray(a)?a[0]:a; } catch(_){regulationId=regRaw;} }

            // ── Resolve session_order from sessions_master ────────────────
            let sessionOrder = 1;
            try {
                const [[sessRow]] = await promisePool.query(
                    `SELECT COALESCE(session_group, session_name) AS grp
                     FROM sessions_master WHERE session_id = ?`,
                    [notif.session_id]
                );
                sessionOrder = (sessRow?.grp || 'AN').toUpperCase() === 'FN' ? 1 : 2;
            } catch (_) {}

            const [result] = await promisePool.query(`
                INSERT INTO exam_timetable_entries (
                    notification_id, exam_date, branch_id, semester_id, regulation_id,
                    subject_id, session_order, room_id, invigilator_staff_id,
                    status, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                notificationId,  // raw string
                entryData.exam_date, entryData.branch_id,
                semesterId, regulationId, entryData.subject_id,
                sessionOrder,                                      // resolved from sessions_master
                entryData.room_id || null, entryData.invigilator_staff_id || null,
                entryData.status || 'scheduled', entryData.notes || null
            ]);

            res.status(201).json({ status:'success', message:'Entry created', timetable_id:result.insertId });

        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // DELETE timetable entry
    router.delete('/:notificationId/entries/:entryId', async (req, res) => {
        try {
            const { notificationId, entryId } = req.params;
            const [result] = await promisePool.query(
                'DELETE FROM exam_timetable_entries WHERE timetable_id = ? AND CAST(notification_id AS CHAR) = ?',
                [entryId, notificationId]
            );
            if (!result.affectedRows) {
                return res.status(404).json({ status:'error', message:'Entry not found' });
            }
            res.json({ status:'success', message:'Entry deleted' });
        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    // Check conflicts
    router.post('/:notificationId/check-conflicts', async (req, res) => {
        try {
            const { notificationId } = req.params;
            const { entries } = req.body;
            const conflicts = [];

            for (const entry of entries) {
                const [roomConflicts] = await promisePool.query(`
                    SELECT timetable_id FROM exam_timetable_entries
                    WHERE room_id = ? AND exam_date = ? AND session_order = ?
                      AND timetable_id != ? AND CAST(notification_id AS CHAR) = ?
                `, [entry.room_id, entry.exam_date, entry.session_order, entry.timetable_id, notificationId]);

                if (roomConflicts.length) {
                    conflicts.push({ type:'room_conflict', entryId:entry.timetable_id, message:'Room already booked' });
                }
            }

            res.json({ status:'success', data:{ hasConflicts:conflicts.length>0, conflicts } });
        } catch (err) {
            res.status(500).json({ status:'error', message:err.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
