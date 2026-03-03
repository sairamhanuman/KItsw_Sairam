const express = require('express');

// Initialize routes function
function initializeRouter(promisePool) {
    const router = express.Router();

    // GET all timetable entries for a notification
    router.get('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== GET TIMETABLE ENTRIES ===');
            const { notificationId } = req.params;
            
            // For now, return empty array - we'll implement actual database fetch later
            res.json({
                status: 'success',
                message: 'Timetable entries retrieved successfully',
                data: []
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

    // PUT bulk update timetable entries - SIMPLIFIED VERSION
    router.put('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== BULK UPDATE TIMETABLE ENTRIES (SIMPLIFIED) ===');
            const { notificationId } = req.params;
            const { entries } = req.body;
            
            console.log('📋 Notification ID:', notificationId);
            console.log('📋 Entries received:', entries ? entries.length : 0);
            
            if (!entries || !Array.isArray(entries)) {
                console.log('❌ Invalid entries data');
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid entries data'
                });
            }
            
            // Log first few entries to see the data structure
            console.log('📊 Sample entry data:');
            if (entries.length > 0) {
                console.log(JSON.stringify(entries[0], null, 2));
            }
            
            // For now, just return success without actually saving to database
            // This tests if the API endpoint is working correctly
            console.log('✅ Save operation simulated successfully');
            
            res.json({
                status: 'success',
                message: 'Timetable entries saved successfully (simulated)',
                data: {
                    savedCount: entries.length,
                    notificationId: notificationId
                }
            });
            
        } catch (error) {
            console.error('Error saving timetable entries:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to save timetable entries',
                error: error.message
            });
        }
    });

    // POST new timetable entry
    router.post('/:notificationId/entries', async (req, res) => {
        try {
            console.log('=== CREATE TIMETABLE ENTRY ===');
            const { notificationId } = req.params;
            const entryData = req.body;
            
            console.log('📋 Creating entry for notification:', notificationId);
            console.log('📋 Entry data:', entryData);
            
            // For now, just return success without actual database insertion
            res.status(201).json({
                status: 'success',
                message: 'Timetable entry created successfully (simulated)',
                data: {
                    ...entryData,
                    timetable_id: Math.floor(Math.random() * 1000) // Mock ID
                }
            });
            
        } catch (error) {
            console.error('Error creating timetable entry:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to create timetable entry',
                error: error.message
            });
        }
    });

    // DELETE timetable entry
    router.delete('/:notificationId/entries/:entryId', async (req, res) => {
        try {
            console.log('=== DELETE TIMETABLE ENTRY ===');
            const { notificationId, entryId } = req.params;
            
            console.log('📋 Deleting entry:', entryId, 'for notification:', notificationId);
            
            res.json({
                status: 'success',
                message: 'Timetable entry deleted successfully (simulated)'
            });
            
        } catch (error) {
            console.error('Error deleting timetable entry:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete timetable entry',
                error: error.message
            });
        }
    });

    return router;
}

module.exports = { initializeRouter };
