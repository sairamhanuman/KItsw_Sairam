const express = require('express');

// ============================================================
// HELPER: Convert VARCHAR notification_id → INT hash
// Same algorithm used everywhere so DB values always match
// e.g. 'NOTIF_1772246814292' → 474965620
// ============================================================
function hashNotificationId(notificationId) {
    return Math.abs(notificationId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0));
}

// Initialize routes function
function initializeRouter(promisePool) {
    const router = express.Router();

    // GET all timetable entries for a notification
    router.get('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== GET TIMETABLE ENTRIES ===');
            const { notificationId } = req.params;
            const notificationIdNumber = hashNotificationId(notificationId);
            console.log(`🔍 notification_id: ${notificationId} → hash: ${notificationIdNumber}`);
            
            const [entries] = await promisePool.query(
                `SELECT ete.*, 
                        bm.branch_name,
                        bm.branch_code,
                        sm.subject_name,
                        sm.syllabus_code,
                        sm.subject_type
                 FROM exam_timetable_entries ete
                 LEFT JOIN branch_master bm ON ete.branch_id = bm.branch_id
                 LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                 WHERE ete.notification_id = ?
                 ORDER BY ete.exam_date, ete.branch_id, ete.session_order`,
                [notificationIdNumber]
            );
            
            res.json({
                status: 'success',
                message: 'Timetable entries retrieved successfully',
                data: entries
            });
            
        } catch (error) {
            console.error('Error fetching timetable entries:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch timetable entries',
                error: error.message
            });
        }
    });

    // PUT bulk update timetable entries
    router.put('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== BULK UPDATE TIMETABLE ENTRIES ===');
            const { notificationId } = req.params;
            const { entries } = req.body;
            
            if (!entries || !Array.isArray(entries)) {
                return res.status(400).json({ status: 'error', message: 'Invalid entries data' });
            }
            
            const notificationIdNumber = hashNotificationId(notificationId);
            console.log(`🔄 ${entries.length} entries for ${notificationId} → hash: ${notificationIdNumber}`);
            
            const connection = await promisePool.getConnection();
            await connection.beginTransaction();
            
            try {
                await connection.query(
                    'DELETE FROM exam_timetable_entries WHERE notification_id = ?',
                    [notificationIdNumber]
                );
                
                for (const entry of entries) {
                    await connection.query(`
                        INSERT INTO exam_timetable_entries (
                            notification_id, exam_date, branch_id, subject_id, 
                            session_order, room_id, invigilator_staff_id, 
                            status, notes, batch_id, batch_name,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `, [
                        notificationIdNumber,
                        entry.exam_date,
                        entry.branch_id,
                        entry.subject_id,
                        entry.session_order || 1,
                        entry.room_id || null,
                        entry.invigilator_staff_id || null,
                        entry.status || 'scheduled',
                        entry.notes || null,
                        entry.batch_id || null,
                        entry.batch_name || null
                    ]);
                }
                
                await connection.commit();
                console.log(`✅ Inserted ${entries.length} entries`);
                
                const [updatedEntries] = await promisePool.query(
                    `SELECT ete.*, 
                            bm.branch_name,
                            bm.branch_code,
                            sm.subject_name,
                            sm.syllabus_code,
                            sm.subject_type
                     FROM exam_timetable_entries ete
                     LEFT JOIN branch_master bm ON ete.branch_id = bm.branch_id
                     LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                     WHERE ete.notification_id = ?
                     ORDER BY ete.exam_date, ete.branch_id, ete.session_order`,
                    [notificationIdNumber]
                );
                
                res.json({ status: 'success', message: 'Timetable entries updated successfully', data: updatedEntries });
                
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
            
        } catch (error) {
            console.error('Error updating timetable entries:', error);
            res.status(500).json({ status: 'error', message: 'Failed to update timetable entries', error: error.message });
        }
    });

    // PATCH single timetable entry
    // ✅ FIX: Was using raw notificationId string → now uses hash
    router.patch('/:notificationId/entries/:entryId', async (req, res) => {
        try {
            console.log('=== UPDATE SINGLE TIMETABLE ENTRY ===');
            const { notificationId, entryId } = req.params;
            const notificationIdNumber = hashNotificationId(notificationId); // ✅ FIXED
            const updateData = req.body;
            
            const updateFields = [];
            const updateValues = [];
            
            if (updateData.exam_date !== undefined) { updateFields.push('exam_date = ?'); updateValues.push(updateData.exam_date); }
            if (updateData.branch_id !== undefined) { updateFields.push('branch_id = ?'); updateValues.push(updateData.branch_id); }
            if (updateData.subject_id !== undefined) { updateFields.push('subject_id = ?'); updateValues.push(updateData.subject_id); }
            if (updateData.session_order !== undefined) { updateFields.push('session_order = ?'); updateValues.push(updateData.session_order); }
            if (updateData.room_id !== undefined) { updateFields.push('room_id = ?'); updateValues.push(updateData.room_id); }
            if (updateData.invigilator_staff_id !== undefined) { updateFields.push('invigilator_staff_id = ?'); updateValues.push(updateData.invigilator_staff_id); }
            if (updateData.status !== undefined) { updateFields.push('status = ?'); updateValues.push(updateData.status); }
            if (updateData.notes !== undefined) { updateFields.push('notes = ?'); updateValues.push(updateData.notes); }
            
            if (updateFields.length === 0) {
                return res.status(400).json({ status: 'error', message: 'No fields to update' });
            }
            
            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            updateValues.push(entryId, notificationIdNumber); // ✅ FIXED: was notificationId (string)
            
            const [result] = await promisePool.query(
                `UPDATE exam_timetable_entries 
                 SET ${updateFields.join(', ')}
                 WHERE timetable_id = ? AND notification_id = ?`,
                updateValues
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ status: 'error', message: 'Timetable entry not found' });
            }
            
            const [updatedEntry] = await promisePool.query(
                `SELECT ete.*, 
                        bm.branch_name, bm.branch_code,
                        sm.subject_name, sm.syllabus_code, sm.subject_type,
                        rm.room_number, rm.building_name,
                        sf.staff_name as invigilator_name
                 FROM exam_timetable_entries ete
                 LEFT JOIN branch_master bm ON ete.branch_id = bm.branch_id
                 LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                 LEFT JOIN room_master rm ON ete.room_id = rm.room_id
                 LEFT JOIN staff_master sf ON ete.invigilator_staff_id = sf.staff_id
                 WHERE ete.timetable_id = ? AND ete.notification_id = ?`,
                [entryId, notificationIdNumber] // ✅ FIXED
            );
            
            res.json({ status: 'success', message: 'Timetable entry updated successfully', data: updatedEntry[0] });
            
        } catch (error) {
            console.error('Error updating timetable entry:', error);
            res.status(500).json({ status: 'error', message: 'Failed to update timetable entry', error: error.message });
        }
    });

    // POST new timetable entry
    router.post('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== CREATE TIMETABLE ENTRY ===');
            const { notificationId } = req.params;
            const notificationIdNumber = hashNotificationId(notificationId); // ✅ Use hash here too
            const entryData = req.body;
            
            const [result] = await promisePool.query(`
                INSERT INTO exam_timetable_entries (
                    notification_id, exam_date, branch_id, subject_id, 
                    session_order, room_id, invigilator_staff_id, 
                    status, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                notificationIdNumber, // ✅ FIXED: was raw notificationId
                entryData.exam_date,
                entryData.branch_id,
                entryData.subject_id,
                entryData.session_order || 1,
                entryData.room_id || null,
                entryData.invigilator_staff_id || null,
                entryData.status || 'scheduled',
                entryData.notes || null
            ]);
            
            const [createdEntry] = await promisePool.query(
                `SELECT ete.*, 
                        bm.branch_name, bm.branch_code,
                        sm.subject_name, sm.syllabus_code, sm.subject_type,
                        rm.room_number, rm.building_name,
                        sf.staff_name as invigilator_name
                 FROM exam_timetable_entries ete
                 LEFT JOIN branch_master bm ON ete.branch_id = bm.branch_id
                 LEFT JOIN subject_master sm ON ete.subject_id = sm.subject_id
                 LEFT JOIN room_master rm ON ete.room_id = rm.room_id
                 LEFT JOIN staff_master sf ON ete.invigilator_staff_id = sf.staff_id
                 WHERE ete.timetable_id = ?`,
                [result.insertId]
            );
            
            res.status(201).json({ status: 'success', message: 'Timetable entry created successfully', data: createdEntry[0] });
            
        } catch (error) {
            console.error('Error creating timetable entry:', error);
            res.status(500).json({ status: 'error', message: 'Failed to create timetable entry', error: error.message });
        }
    });

    // DELETE timetable entry
    // ✅ FIX: Was using raw notificationId string → now uses hash
    router.delete('/:notificationId/entries/:entryId', async (req, res) => {
        try {
            console.log('=== DELETE TIMETABLE ENTRY ===');
            const { notificationId, entryId } = req.params;
            const notificationIdNumber = hashNotificationId(notificationId); // ✅ FIXED
            
            const [result] = await promisePool.query(
                'DELETE FROM exam_timetable_entries WHERE timetable_id = ? AND notification_id = ?',
                [entryId, notificationIdNumber] // ✅ FIXED: was notificationId (string)
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ status: 'error', message: 'Timetable entry not found' });
            }
            
            res.json({ status: 'success', message: 'Timetable entry deleted successfully' });
            
        } catch (error) {
            console.error('Error deleting timetable entry:', error);
            res.status(500).json({ status: 'error', message: 'Failed to delete timetable entry', error: error.message });
        }
    });

    // Check for conflicts
    router.post('/:notificationId/check-conflicts', async (req, res) => {
        try {
            console.log('=== CHECK TIMETABLE CONFLICTS ===');
            const { notificationId } = req.params;
            const notificationIdNumber = hashNotificationId(notificationId); // ✅ Use hash
            const { entries } = req.body;
            
            const conflicts = [];
            
            for (const entry of entries) {
                const [roomConflicts] = await promisePool.query(
                    `SELECT timetable_id, exam_date, session_order
                     FROM exam_timetable_entries 
                     WHERE room_id = ? AND exam_date = ? AND session_order = ?
                     AND timetable_id != ? AND notification_id = ?`,
                    [entry.room_id, entry.exam_date, entry.session_order, entry.timetable_id, notificationIdNumber]
                );
                
                if (roomConflicts.length > 0) {
                    conflicts.push({
                        type: 'room_conflict',
                        entryId: entry.timetable_id,
                        conflictWith: roomConflicts[0],
                        message: 'Room already booked for this session'
                    });
                }
                
                if (entry.invigilator_staff_id) {
                    const [invigilatorConflicts] = await promisePool.query(
                        `SELECT timetable_id, exam_date, session_order
                         FROM exam_timetable_entries 
                         WHERE invigilator_staff_id = ? AND exam_date = ? AND session_order = ?
                         AND timetable_id != ? AND notification_id = ?`,
                        [entry.invigilator_staff_id, entry.exam_date, entry.session_order, entry.timetable_id, notificationIdNumber]
                    );
                    
                    if (invigilatorConflicts.length > 0) {
                        conflicts.push({
                            type: 'invigilator_conflict',
                            entryId: entry.timetable_id,
                            conflictWith: invigilatorConflicts[0],
                            message: 'Invigilator already assigned for this session'
                        });
                    }
                }
            }
            
            res.json({
                status: 'success',
                message: 'Conflict check completed',
                data: { hasConflicts: conflicts.length > 0, conflicts }
            });
            
        } catch (error) {
            console.error('Error checking conflicts:', error);
            res.status(500).json({ status: 'error', message: 'Failed to check conflicts', error: error.message });
        }
    });

    return router;
}

module.exports = { initializeRouter };
