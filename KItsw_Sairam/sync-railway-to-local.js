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

async function syncDatabases() {
    console.log('🚀 Starting database sync from Railway to Local...');
    
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
        
        console.log(`📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}`);
        
        // Sync each table
        for (const tableName of tableNames) {
            console.log(`🔄 Syncing table: ${tableName}`);
            
            try {
                // Get data from Railway
                const [data] = await railwayPool.promise().query(`SELECT * FROM ${tableName}`);
                
                if (data.length > 0) {
                    // Clear local table
                    await localPool.promise().query(`DELETE FROM ${tableName}`);
                    console.log(`  🗑️  Cleared local ${tableName} table`);
                    
                    // Insert data into local table
                    for (const row of data) {
                        const columns = Object.keys(row);
                        const values = Object.values(row);
                        const placeholders = values.map(() => '?').join(', ');
                        
                        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                        await localPool.promise().query(query, values);
                    }
                    
                    console.log(`  ✅ Synced ${data.length} records to ${tableName}`);
                } else {
                    console.log(`  ℹ️  No data found in ${tableName}`);
                }
            } catch (error) {
                console.error(`  ❌ Error syncing ${tableName}:`, error.message);
            }
        }
        
        console.log('🎉 Database sync completed successfully!');
        
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    } finally {
        await railwayPool.end();
        await localPool.end();
    }
}

// Run the sync
syncDatabases();
