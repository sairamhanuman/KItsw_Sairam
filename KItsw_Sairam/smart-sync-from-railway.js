const mysql = require('mysql2');

// Railway Database Configuration
const railwayConfig = {
    host: 'switchback.proxy.rlwy.net',
    port: 25051,
    user: 'root',
    password: 'aKeVerCxudubpObrWoxvMaOvHDRgbJZn',
    database: 'railway'
};

// Local Database Configuration
const localConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Iamgod@123456',
    database: 'engineering_college'
};

// Define table creation order (dependencies first)
const tableOrder = [
    'programme_master',
    'branch_master', 
    'batch_master',
    'regulation_master',
    'semester_master',
    'section_master',
    'block_master',
    'room_master',
    'exam_types_master',
    'exams_naming_master',
    'month_year_master',
    'sessions_master',
    'exam_session_master',
    'exam_names',
    'staff_master',
    'subject_master',
    'student_master',
    'exam_notifications',
    'exam_timetable',
    'notification_status_log',
    'promotion_batch_log',
    'student_elective_mapping',
    'student_regulation_mapping',
    'student_semester_history',
    'student_status_log',
    'subject_faculty_allotment',
    'seating_template',
    'seating_arrangement'
];

async function smartSync() {
    console.log('🚀 Starting SMART sync from Railway to Local...');
    console.log('⚠️  This will DROP all local tables and recreate from Railway!\n');
    
    const railwayPool = mysql.createPool(railwayConfig);
    const localPool = mysql.createPool(localConfig);
    
    try {
        // Test connections
        console.log('📡 Testing Railway connection...');
        await railwayPool.promise().query('SELECT 1');
        console.log('✅ Railway connection successful');
        
        console.log('🏠 Testing local connection...');
        await localPool.promise().query('SELECT 1');
        console.log('✅ Local connection successful');
        
        // Get all tables from Railway
        const [tables] = await railwayPool.promise().query('SHOW TABLES');
        const allTableNames = tables.map(row => Object.values(row)[0]);
        
        console.log(`📋 Found ${allTableNames.length} tables in Railway: ${allTableNames.join(', ')}`);
        
        // Get all local tables and drop them
        const [localTables] = await localPool.promise().query('SHOW TABLES');
        const localTableNames = localTables.map(row => Object.values(row)[0]);
        
        if (localTableNames.length > 0) {
            console.log(`🗑️  Dropping ${localTableNames.length} local tables...`);
            
            // Disable foreign key checks
            await localPool.promise().query('SET FOREIGN_KEY_CHECKS = 0');
            
            for (const tableName of localTableNames) {
                try {
                    await localPool.promise().query(`DROP TABLE IF EXISTS \`${tableName}\``);
                    console.log(`  ✅ Dropped ${tableName}`);
                } catch (error) {
                    console.error(`  ❌ Error dropping ${tableName}:`, error.message);
                }
            }
            
            // Re-enable foreign key checks
            await localPool.promise().query('SET FOREIGN_KEY_CHECKS = 1');
            console.log('✅ All local tables dropped');
        }
        
        // Export tables in correct order
        console.log('\n📤 Exporting tables from Railway in dependency order...');
        
        // Disable foreign key checks for import
        await localPool.promise().query('SET FOREIGN_KEY_CHECKS = 0');
        
        for (const tableName of tableOrder) {
            if (!allTableNames.includes(tableName)) {
                console.log(`⏭️  Skipping ${tableName} (not in Railway)`);
                continue;
            }
            
            console.log(`🔄 Processing table: ${tableName}`);
            
            try {
                // Get table structure
                const [createTable] = await railwayPool.promise().query(`SHOW CREATE TABLE \`${tableName}\``);
                let createStatement = createTable[0]['Create Table'];
                
                // Fix generated column issue for room_master
                if (tableName === 'room_master') {
                    createStatement = createStatement.replace(
                        'total_capacity INT GENERATED ALWAYS AS (total_rows * total_columns * students_per_bench) STORED',
                        'total_capacity INT DEFAULT 0'
                    );
                }
                
                // Create table in local database
                await localPool.promise().query(createStatement);
                console.log(`  ✅ Created table ${tableName}`);
                
                // Get data from Railway
                const [data] = await railwayPool.promise().query(`SELECT * FROM \`${tableName}\``);
                
                if (data.length > 0) {
                    // Get column information
                    const columns = Object.keys(data[0]);
                    
                    // Insert data in batches
                    const batchSize = 100;
                    for (let i = 0; i < data.length; i += batchSize) {
                        const batch = data.slice(i, i + batchSize);
                        
                        for (const row of batch) {
                            const values = Object.values(row);
                            const placeholders = values.map(() => '?').join(', ');
                            
                            const query = `INSERT INTO \`${tableName}\` (${columns.map(col => `\`${col}\``).join(', ')}) VALUES (${placeholders})`;
                            await localPool.promise().query(query, values);
                        }
                    }
                    
                    console.log(`  ✅ Inserted ${data.length} records into ${tableName}`);
                } else {
                    console.log(`  ℹ️  No data found in ${tableName}`);
                }
                
            } catch (error) {
                console.error(`  ❌ Error processing ${tableName}:`, error.message);
            }
        }
        
        // Re-enable foreign key checks
        await localPool.promise().query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('\n🎉 Smart sync finished successfully!');
        console.log('📊 Summary:');
        console.log(`  - Railway tables: ${allTableNames.length}`);
        console.log(`  - All local tables dropped and recreated`);
        console.log(`  - Data synchronized from Railway to local`);
        
        // Verify the sync
        console.log('\n🔍 Verifying sync...');
        const [localTablesAfter] = await localPool.promise().query('SHOW TABLES');
        console.log(`✅ Local database now has ${localTablesAfter.length} tables`);
        
        // Count total records
        let totalRecords = 0;
        for (const table of localTablesAfter) {
            const tableName = Object.values(table)[0];
            const [count] = await localPool.promise().query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            totalRecords += count[0].count;
        }
        console.log(`✅ Total records synchronized: ${totalRecords}`);
        
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    } finally {
        await railwayPool.end();
        await localPool.end();
    }
}

// Run the smart sync
smartSync();
