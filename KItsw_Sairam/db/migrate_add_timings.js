/**
 * Migration Script: Add timings column to exam_session_master table
 * 
 * This script adds the timings column to the exam_session_master table
 * for existing databases that don't have this column yet.
 * 
 * Usage:
 *   node db/migrate_add_timings.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    let connection;
    
    try {
        console.log('\n========================================');
        console.log('Starting Migration: Add Timings Column');
        console.log('========================================\n');
        
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'engineering_college'
        });
        
        console.log('✓ Connected to database');
        
        // Check if timings column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'exam_session_master' 
            AND COLUMN_NAME = 'timings'
        `, [process.env.DB_NAME || 'engineering_college']);
        
        if (columns.length > 0) {
            console.log('⚠ Column "timings" already exists in exam_session_master table');
            console.log('✓ Migration already applied, skipping...\n');
        } else {
            console.log('→ Adding "timings" column to exam_session_master table...');
            
            // Add timings column
            await connection.query(`
                ALTER TABLE exam_session_master 
                ADD COLUMN timings VARCHAR(50) AFTER session_type
            `);
            
            console.log('✓ Column "timings" added successfully\n');
        }
        
        console.log('========================================');
        console.log('✓ Migration completed successfully!');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n========================================');
        console.error('✗ Migration failed:', error.message);
        console.error('========================================\n');
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.\n');
        }
    }
}

// Run migration if executed directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migration script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = migrate;
