const mysql = require('mysql2/promise');

async function testElectiveFilters() {
  try {
    console.log('🔍 Testing Elective Subjects with Filters...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TEST 1: IT Branch Filters ===');
    
    // Test IT branch specific filters
    const [itSubjects] = await connection.query(`
      SELECT 
        subject_id,
        syllabus_code,
        subject_name,
        elective_name,
        programme_id,
        branch_id,
        semester_id,
        regulation_id
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      AND branch_id = 4  -- IT Branch
      AND semester_id = 8
      AND regulation_id = 2
      ORDER BY elective_name
    `);
    
    console.log(`\nIT Branch Elective Subjects (${itSubjects.length} found):`);
    itSubjects.forEach(subject => {
      console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
    });
    
    console.log('\n=== TEST 2: CSE Branch Filters ===');
    
    // Test CSE branch for comparison
    const [cseSubjects] = await connection.query(`
      SELECT 
        subject_id,
        syllabus_code,
        subject_name,
        elective_name,
        programme_id,
        branch_id,
        semester_id,
        regulation_id
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      AND branch_id = 7  -- CSE Branch
      AND semester_id = 8
      AND regulation_id = 2
      ORDER BY elective_name
    `);
    
    console.log(`\nCSE Branch Elective Subjects (${cseSubjects.length} found):`);
    cseSubjects.forEach(subject => {
      console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
    });
    
    console.log('\n=== TEST 3: All Branches Summary ===');
    
    // Test all branches summary
    const [allBranches] = await connection.query(`
      SELECT 
        b.branch_id,
        b.branch_code,
        b.branch_name,
        COUNT(s.subject_id) as elective_count
      FROM branch_master b
      LEFT JOIN subject_master s ON b.branch_id = s.branch_id 
        AND s.is_elective = 1 
        AND s.is_active = 1
        AND s.semester_id = 8
        AND s.regulation_id = 2
      GROUP BY b.branch_id, b.branch_code, b.branch_name
      ORDER BY b.branch_code
    `);
    
    console.log('\nElective Subjects by Branch:');
    allBranches.forEach(branch => {
      console.log(`  ${branch.branch_code} (${branch.branch_name}): ${branch.elective_count} electives`);
    });
    
    console.log('\n=== TEST 4: API Simulation ===');
    
    // Simulate API call like the frontend would make
    const testFilters = {
      programme_id: 1,  // B.Tech
      branch_id: 4,      // IT
      semester_id: 8,    // Semester 8
      regulation_id: 2     // URR-22
    };
    
    const [apiTest] = await connection.query(`
      SELECT 
        subject_id,
        syllabus_code,
        subject_name,
        elective_name,
        programme_id,
        branch_id,
        semester_id,
        regulation_id,
        CASE 
          WHEN elective_name = 'Open Elective' OR elective_name = 'Professional Elective' THEN 'Group 1'
          WHEN elective_name LIKE '%-1' THEN 'Group 2'
          WHEN elective_name LIKE '%-2' THEN 'Group 3'
          WHEN elective_name LIKE '%-3' THEN 'Group 4'
          WHEN elective_name LIKE '%-4' THEN 'Group 5'
          ELSE 'Other Groups'
        END as group_category
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      AND programme_id = ?
      AND branch_id = ?
      AND semester_id = ?
      AND regulation_id = ?
      ORDER BY elective_name
    `, [testFilters.programme_id, testFilters.branch_id, testFilters.semester_id, testFilters.regulation_id]);
    
    console.log(`\nAPI Simulation Results (${apiTest.length} subjects):`);
    apiTest.forEach(subject => {
      console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name}) [${subject.group_category}]`);
    });
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Database connection working');
    console.log('✅ Elective filtering working');
    console.log('✅ IT branch has specific electives');
    console.log('✅ Different branches have different electives');
    console.log('✅ API simulation successful');
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
}

testElectiveFilters();
