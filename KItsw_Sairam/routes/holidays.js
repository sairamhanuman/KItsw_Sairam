const express = require('express');
const router = express.Router();

// Database connection will be passed as parameter
let db;

// Initialize router with database connection
function initializeRouter(database) {
    db = database;
    
    // GET all holidays
    router.get('/', async (req, res) => {
        try {
            console.log('📅 Fetching all holidays...');
            
            const [holidays] = await db.query(`
                SELECT * FROM holidays 
                ORDER BY holiday_date ASC
            `);
            
            console.log('✅ Holidays fetched successfully:', holidays.length);
            
            res.json({
                status: 'success',
                data: holidays,
                message: 'Holidays retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error fetching holidays:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch holidays',
                error: error.message
            });
        }
    });
    
    // GET holiday by ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            console.log('📅 Fetching holiday with ID:', id);
            
            const [holidays] = await db.query(`
                SELECT * FROM holidays WHERE id = ?
            `, [id]);
            
            if (holidays.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Holiday not found'
                });
            }
            
            console.log('✅ Holiday fetched successfully');
            
            res.json({
                status: 'success',
                data: holidays[0],
                message: 'Holiday retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error fetching holiday:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch holiday',
                error: error.message
            });
        }
    });
    
    // POST new holiday
    router.post('/', async (req, res) => {
        try {
            const {
                holiday_date,
                holiday_name,
                holiday_type,
                academic_year,
                description,
                is_recurring
            } = req.body;
            
            console.log('📅 Adding new holiday:', {
                holiday_date,
                holiday_name,
                holiday_type,
                academic_year,
                description,
                is_recurring
            });
            
            // Validation
            if (!holiday_date || !holiday_name || !holiday_type || !academic_year) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Required fields: holiday_date, holiday_name, holiday_type, academic_year'
                });
            }
            
            // Check if holiday already exists for this date
            const [existing] = await db.query(`
                SELECT id FROM holidays WHERE holiday_date = ? AND academic_year = ?
            `, [holiday_date, academic_year]);
            
            if (existing.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Holiday already exists for this date and academic year'
                });
            }
            
            const [result] = await db.query(`
                INSERT INTO holidays (
                    holiday_date, holiday_name, holiday_type, academic_year, 
                    description, is_recurring, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                holiday_date,
                holiday_name,
                holiday_type,
                academic_year,
                description || null,
                is_recurring || false
            ]);
            
            console.log('✅ Holiday added successfully with ID:', result.insertId);
            
            res.status(201).json({
                status: 'success',
                data: {
                    id: result.insertId,
                    holiday_date,
                    holiday_name,
                    holiday_type,
                    academic_year,
                    description,
                    is_recurring: is_recurring || false
                },
                message: 'Holiday added successfully'
            });
        } catch (error) {
            console.error('❌ Error adding holiday:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to add holiday',
                error: error.message
            });
        }
    });
    
    // PUT update holiday
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const {
                holiday_date,
                holiday_name,
                holiday_type,
                academic_year,
                description,
                is_recurring
            } = req.body;
            
            console.log('📅 Updating holiday with ID:', id);
            
            // Check if holiday exists
            const [existing] = await db.query(`
                SELECT id FROM holidays WHERE id = ?
            `, [id]);
            
            if (existing.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Holiday not found'
                });
            }
            
            // Update holiday
            await db.query(`
                UPDATE holidays SET 
                    holiday_date = ?, holiday_name = ?, holiday_type = ?, 
                    academic_year = ?, description = ?, is_recurring = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                holiday_date,
                holiday_name,
                holiday_type,
                academic_year,
                description || null,
                is_recurring || false,
                id
            ]);
            
            console.log('✅ Holiday updated successfully');
            
            res.json({
                status: 'success',
                data: {
                    id: parseInt(id),
                    holiday_date,
                    holiday_name,
                    holiday_type,
                    academic_year,
                    description,
                    is_recurring: is_recurring || false
                },
                message: 'Holiday updated successfully'
            });
        } catch (error) {
            console.error('❌ Error updating holiday:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to update holiday',
                error: error.message
            });
        }
    });
    
    // DELETE holiday
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            console.log('📅 Deleting holiday with ID:', id);
            
            // Check if holiday exists
            const [existing] = await db.query(`
                SELECT id FROM holidays WHERE id = ?
            `, [id]);
            
            if (existing.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Holiday not found'
                });
            }
            
            // Delete holiday
            await db.query(`
                DELETE FROM holidays WHERE id = ?
            `, [id]);
            
            console.log('✅ Holiday deleted successfully');
            
            res.json({
                status: 'success',
                message: 'Holiday deleted successfully'
            });
        } catch (error) {
            console.error('❌ Error deleting holiday:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete holiday',
                error: error.message
            });
        }
    });
    
    // GET holidays by academic year
    router.get('/year/:academicYear', async (req, res) => {
        try {
            const { academicYear } = req.params;
            console.log('📅 Fetching holidays for academic year:', academicYear);
            
            const [holidays] = await db.query(`
                SELECT * FROM holidays 
                WHERE academic_year = ?
                ORDER BY holiday_date ASC
            `, [academicYear]);
            
            console.log('✅ Holidays fetched successfully:', holidays.length);
            
            res.json({
                status: 'success',
                data: holidays,
                message: 'Holidays retrieved successfully'
            });
        } catch (error) {
            console.error('❌ Error fetching holidays by year:', error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch holidays',
                error: error.message
            });
        }
    });
    
    return router;
}

module.exports = initializeRouter;
