const mysql = require('mysql2');
const fs = require('fs');

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

async function completeSync() {
    console.log('🚀 Starting COMPLETE sync from Railway to Local...');
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
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        console.log(`📋 Found ${tableNames.length} tables in Railway: ${tableNames.join(', ')}`);
        
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
        
        // Export each table structure and data from Railway
        console.log('\n📤 Exporting tables from Railway...');
        
        for (const tableName of tableNames) {
            console.log(`🔄 Processing table: ${tableName}`);
            
            try {
                // Get table structure
                const [createTable] = await railwayPool.promise().query(`SHOW CREATE TABLE \`${tableName}\``);
                const createStatement = createTable[0]['Create Table'];
                
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
        
        console.log('\n🎉 Complete sync finished successfully!');
        console.log('📊 Summary:');
        console.log(`  - Railway tables: ${tableNames.length}`);
        console.log(`  - All local tables dropped and recreated`);
        console.log(`  - Data synchronized from Railway to local`);
        
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    } finally {
        await railwayPool.end();
        await localPool.end();
    }
}

// Run the complete sync
completeSync();
