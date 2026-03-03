const mysql = require('mysql2/promise');

async function directSQLUpdate() {
    let connection;
    try {
        console.log('🔧 Direct SQL Update...');
        
        // Database connection
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'Iamgod@123456',
            database: 'engineering_college'
        });
        
        console.log('✅ Connected to database');
        
        // Direct SQL update with UTC DATE format
        console.log('\n=== DIRECT SQL UPDATE ===');
        const sql = "UPDATE exam_notifications SET start_date = '2026-02-23', end_date = '2026-02-25' WHERE notification_id = 'NOT-26-BTEC-VII-1-667361044'";
        
        console.log('SQL:', sql);
        
        const [result] = await connection.query(sql);
        console.log('✅ Update result:', result.affectedRows, 'rows affected');
        
        // Set timezone to UTC for verification
        await connection.query("SET time_zone = '+00:00'");
        
        // Verify with direct SQL
        console.log('\n=== VERIFICATION (UTC) ===');
        const [verify] = await connection.query(
            "SELECT DATE(start_date) as start_date, DATE(end_date) as end_date FROM exam_notifications WHERE notification_id = 'NOT-26-BTEC-VII-1-667361044'"
        );
        
        if (verify.length > 0) {
            const notif = verify[0];
            console.log('Raw Start Date:', notif.start_date);
            console.log('Raw End Date:', notif.end_date);
            
            // Convert to Date objects
            const startDate = new Date(notif.start_date);
            const endDate = new Date(notif.end_date);
            
            console.log('Date Object Start:', startDate);
            console.log('Date Object End:', endDate);
            
            // Format dates
            const formattedStart = startDate.toISOString().split('T')[0];
            const formattedEnd = endDate.toISOString().split('T')[0];
            
            console.log('Formatted Start:', formattedStart);
            console.log('Formatted End:', formattedEnd);
            
            if (formattedStart === '2026-02-23' && formattedEnd === '2026-02-25') {
                console.log('✅ NOTIFICATION DATES FIXED SUCCESSFULLY!');
                console.log('🎓 Now refresh your browser and click "Generate Initial Timetable"');
            } else {
                console.log('❌ DATE UPDATE FAILED');
                console.log('❌ Expected: 2026-02-23 to 2026-02-25');
                console.log('❌ Got:', formattedStart, 'to', formattedEnd);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

directSQLUpdate();
