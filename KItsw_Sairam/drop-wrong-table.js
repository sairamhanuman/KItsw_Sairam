const mysql = require('mysql2/promise');

async function dropWrongTable() {
  try {
    console.log('🗑️ Dropping Wrong Table...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== CHECKING TABLES ===');
    
    // Check both tables
    const [tables] = await connection.query(`
      SHOW TABLES LIKE '%elective%'
    `);
    
    console.log('\nElective-related tables:');
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    console.log('\n=== CHECKING DATA IN BOTH TABLES ===');
    
    // Check data in student_elective_mapping
    const [oldTableData] = await connection.query(`
      SELECT COUNT(*) as count FROM student_elective_mapping
    `);
    console.log(`\nstudent_elective_mapping: ${oldTableData[0].count} rows`);
    
    // Check data in elective_group_allotment
    const [newTableData] = await connection.query(`
      SELECT COUNT(*) as count FROM elective_group_allotment
    `);
    console.log(`elective_group_allotment: ${newTableData[0].count} rows`);
    
    console.log('\n=== DROPPING WRONG TABLE ===');
    
    // Drop the wrong table
    await connection.query(`
      DROP TABLE IF EXISTS elective_group_allotment
    `);
    
    console.log('✅ Dropped elective_group_allotment table successfully!');
    
    // Verify it's gone
    const [finalCheck] = await connection.query(`
      SHOW TABLES LIKE '%elective%'
    `);
    
    console.log('\nFinal elective-related tables:');
    finalCheck.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Dropped duplicate table: elective_group_allotment');
    console.log('✅ Kept working table: student_elective_mapping');
    console.log('✅ System should now work correctly');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

dropWrongTable();
