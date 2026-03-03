const express = require('express');

// Initialize routes function
function initializeRouter(promisePool) {
    const router = express.Router();

    // POST generate initial timetable
    router.post('/generate/:notificationId', async (req, res) => {
        try {
            console.log('=== GENERATE INITIAL TIMETABLE ===');
            const { notificationId } = req.params;
            
            // Get notification details
            const [notification] = await promisePool.query(
                'SELECT * FROM exam_notifications WHERE notification_id = ?',
                [notificationId]
            );
            
            if (notification.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Notification not found'
                });
            }
            
            const notif = notification[0];
            
            // Clear existing timetable entries and unassigned subjects for this notification
            await promisePool.query('DELETE FROM exam_timetable_entries WHERE notification_id = ?', [notificationId]);
            await promisePool.query('DELETE FROM exam_unassigned_subjects WHERE notification_id = ?', [notificationId]);
            
            // Get all subjects matching the notification criteria
            const subjectsQuery = `
                SELECT 
                    sm.*,
                    bm.branch_id,
                    bm.branch_name,
                    bm.branch_code
                FROM subject_master sm
                JOIN branch_master bm ON sm.branch_id = bm.branch_id
                WHERE sm.programme_id = ?
                AND FIND_IN_SET(sm.semester_id, ?) > 0
                AND FIND_IN_SET(sm.regulation_id, ?) > 0
                AND sm.is_active = 1
                ORDER BY bm.branch_code, sm.subject_order, sm.subject_name
            `;
            
            const [subjects] = await promisePool.query(subjectsQuery, [
                notif.programme_id,
                notif.semester_ids,
                notif.regulation_ids
            ]);
            
            console.log(`Found ${subjects.length} subjects for timetable generation`);
            
            // Get exam dates between start_date and end_date
            const datesQuery = `
                SELECT 
                    DATE(?) as exam_date
                WHERE DATE(?) BETWEEN ? AND ?
            `;
            
            // Generate date range
            const startDate = new Date(notif.start_date);
            const endDate = new Date(notif.end_date);
            const examDates = [];
            
            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                // Skip weekends (Saturday = 6, Sunday = 0)
                if (date.getDay() !== 0 && date.getDay() !== 6) {
                    examDates.push(new Date(date));
                }
            }
            
            console.log(`Generated ${examDates.length} exam dates (excluding weekends)`);
            
            if (examDates.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No valid exam dates in the specified range (excluding weekends)'
                });
            }
            
            // Group subjects by branch
            const subjectsByBranch = {};
            subjects.forEach(subject => {
                if (!subjectsByBranch[subject.branch_id]) {
                    subjectsByBranch[subject.branch_id] = {
                        branch_info: {
                            branch_id: subject.branch_id,
                            branch_name: subject.branch_name,
                            branch_code: subject.branch_code
                        },
                        subjects: []
                    };
                }
                subjectsByBranch[subject.branch_id].subjects.push(subject);
            });
            
            // Generate timetable using round-robin algorithm
            const timetableEntries = [];
            const unassignedSubjects = [];
            
            // Create rounds for each date
            examDates.forEach((examDate, dateIndex) => {
                Object.keys(subjectsByBranch).forEach(branchId => {
                    const branchData = subjectsByBranch[branchId];
                    const subjectsForBranch = branchData.subjects;
                    
                    // Calculate which subject should be scheduled for this date
                    const subjectIndex = dateIndex % subjectsForBranch.length;
                    
                    if (subjectIndex < subjectsForBranch.length) {
                        const subject = subjectsForBranch[subjectIndex];
                        
                        // Check if this subject is already scheduled
                        const alreadyScheduled = timetableEntries.some(entry => 
                            entry.subject_id === subject.subject_id
                        );
                        
                        if (!alreadyScheduled) {
                            timetableEntries.push({
                                notification_id: parseInt(notificationId),
                                exam_date: examDate.toISOString().split('T')[0],
                                branch_id: subject.branch_id,
                                subject_id: subject.subject_id,
                                session_order: 1,
                                status: 'scheduled'
                            });
                        } else {
                            // Add to unassigned if already scheduled
                            unassignedSubjects.push({
                                notification_id: parseInt(notificationId),
                                subject_id: subject.subject_id,
                                branch_id: subject.branch_id,
                                reason: 'pending',
                                priority_order: 0
                            });
                        }
                    }
                });
            });
            
            // Add remaining subjects to unassigned
            Object.keys(subjectsByBranch).forEach(branchId => {
                const branchData = subjectsByBranch[branchId];
                const subjectsForBranch = branchData.subjects;
                
                subjectsForBranch.forEach(subject => {
                    const isScheduled = timetableEntries.some(entry => 
                        entry.subject_id === subject.subject_id
                    );
                    
                    if (!isScheduled) {
                        unassignedSubjects.push({
                            notification_id: parseInt(notificationId),
                            subject_id: subject.subject_id,
                            branch_id: subject.branch_id,
                            reason: 'no_dates_available',
                            priority_order: 0
                        });
                    }
                });
            });
            
            // Insert timetable entries
            if (timetableEntries.length > 0) {
                const timetableValues = timetableEntries.map(entry => 
                    `(${entry.notification_id}, '${entry.exam_date}', ${entry.branch_id}, ${entry.subject_id}, ${entry.session_order}, '${entry.status}')`
                ).join(', ');
                
                const insertTimetableQuery = `
                    INSERT INTO exam_timetable_entries 
                    (notification_id, exam_date, branch_id, subject_id, session_order, status)
                    VALUES ${timetableValues}
                `;
                
                await promisePool.query(insertTimetableQuery);
            }
            
            // Insert unassigned subjects
            if (unassignedSubjects.length > 0) {
                const unassignedValues = unassignedSubjects.map(entry => 
                    `(${entry.notification_id}, ${entry.subject_id}, ${entry.branch_id}, '${entry.reason}', ${entry.priority_order})`
                ).join(', ');
                
                const insertUnassignedQuery = `
                    INSERT INTO exam_unassigned_subjects 
                    (notification_id, subject_id, branch_id, reason, priority_order)
                    VALUES ${unassignedValues}
                `;
                
                await promisePool.query(insertUnassignedQuery);
            }
            
            // Update notification to mark timetable as generated
            await promisePool.query(
                'UPDATE exam_notifications SET timetable_generated = TRUE WHERE notification_id = ?',
                [notificationId]
            );
            
            res.json({
                status: 'success',
                message: 'Initial timetable generated successfully',
                data: {
                    scheduled_entries: timetableEntries.length,
                    unassigned_subjects: unassignedSubjects.length,
                    total_dates: examDates.length,
                    total_branches: Object.keys(subjectsByBranch).length
                }
            });
            
        } catch (error) {
            console.error('=== GENERATE INITIAL TIMETABLE ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to generate initial timetable',
                error: error.message
            });
        }
    });

    // POST update timetable entry (drag and drop)
    router.post('/update-entry', async (req, res) => {
        try {
            console.log('=== UPDATE TIMETABLE ENTRY ===');
            
            const {
                timetable_id,
                new_exam_date,
                new_branch_id,
                new_subject_id,
                session_order = 1
            } = req.body;
            
            // Check if entry exists
            const [existing] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?',
                [timetable_id]
            );
            
            if (existing.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable entry not found'
                });
            }
            
            // Check for conflicts
            const [conflicts] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE exam_date = ? AND branch_id = ? AND subject_id = ? AND timetable_id != ?',
                [new_exam_date, new_branch_id, new_subject_id, timetable_id]
            );
            
            if (conflicts.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Conflicting entry exists for this date, branch, and subject'
                });
            }
            
            // Update the entry
            await promisePool.query(
                'UPDATE exam_timetable_entries SET exam_date = ?, branch_id = ?, subject_id = ?, session_order = ? WHERE timetable_id = ?',
                [new_exam_date, new_branch_id, new_subject_id, session_order, timetable_id]
            );
            
            // Get updated entry
            const [updatedEntry] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?',
                [timetable_id]
            );
            
            res.json({
                status: 'success',
                message: 'Timetable entry updated successfully',
                data: updatedEntry[0]
            });
            
        } catch (error) {
            console.error('=== UPDATE TIMETABLE ENTRY ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update timetable entry',
                error: error.message
            });
        }
    });

    // POST move subject from unassigned to timetable
    router.post('/assign-subject', async (req, res) => {
        try {
            console.log('=== ASSIGN UNASSIGNED SUBJECT ===');
            
            const {
                unassigned_id,
                exam_date,
                branch_id,
                subject_id,
                session_order = 1
            } = req.body;
            
            // Check if unassigned subject exists
            const [unassigned] = await promisePool.query(
                'SELECT * FROM exam_unassigned_subjects WHERE unassigned_id = ?',
                [unassigned_id]
            );
            
            if (unassigned.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Unassigned subject not found'
                });
            }
            
            // Check for conflicts
            const [conflicts] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE exam_date = ? AND branch_id = ? AND subject_id = ?',
                [exam_date, branch_id, subject_id]
            );
            
            if (conflicts.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Conflicting entry exists for this date, branch, and subject'
                });
            }
            
            // Insert into timetable
            const [result] = await promisePool.query(
                'INSERT INTO exam_timetable_entries (notification_id, exam_date, branch_id, subject_id, session_order, status) VALUES (?, ?, ?, ?, ?, ?)',
                [unassigned[0].notification_id, exam_date, branch_id, subject_id, session_order, 'scheduled']
            );
            
            // Remove from unassigned
            await promisePool.query(
                'DELETE FROM exam_unassigned_subjects WHERE unassigned_id = ?',
                [unassigned_id]
            );
            
            // Get new entry
            const [newEntry] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?',
                [result.insertId]
            );
            
            res.json({
                status: 'success',
                message: 'Subject assigned successfully',
                data: newEntry[0]
            });
            
        } catch (error) {
            console.error('=== ASSIGN UNASSIGNED SUBJECT ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to assign subject',
                error: error.message
            });
        }
    });

    // POST move subject from timetable to unassigned
    router.post('/unassign-subject', async (req, res) => {
        try {
            console.log('=== UNASSIGN SUBJECT ===');
            
            const { timetable_id, reason = 'pending' } = req.body;
            
            // Check if timetable entry exists
            const [entry] = await promisePool.query(
                'SELECT * FROM exam_timetable_entries WHERE timetable_id = ?',
                [timetable_id]
            );
            
            if (entry.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable entry not found'
                });
            }
            
            const timetableEntry = entry[0];
            
            // Add to unassigned
            await promisePool.query(
                'INSERT INTO exam_unassigned_subjects (notification_id, subject_id, branch_id, reason, priority_order) VALUES (?, ?, ?, ?, ?)',
                [timetableEntry.notification_id, timetableEntry.subject_id, timetableEntry.branch_id, reason, 0]
            );
            
            // Remove from timetable
            await promisePool.query(
                'DELETE FROM exam_timetable_entries WHERE timetable_id = ?',
                [timetable_id]
            );
            
            res.json({
                status: 'success',
                message: 'Subject unassigned successfully'
            });
            
        } catch (error) {
            console.error('=== UNASSIGN SUBJECT ERROR ===');
            console.error('Error:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to unassign subject',
                error: error.message
            });
        }
    });

    return router;
}

module.exports = { initializeRouter };
