const mysql = require('mysql2/promise');

async function testMappedStudentsQuery() {
  try {
    console.log('🔍 Testing Mapped Students Query...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TESTING MAPPED STUDENTS QUERY FOR SUBJECT_ID 41 ===');
    
    // Test the exact query used by mapped-students API
    const [mappedStudents] = await connection.query(`
        SELECT 
            sem.mapping_id,
            sem.student_id,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            sm.gender,
            sem.elective_name,
            sem.mapped_date
        FROM student_elective_mapping sem
        INNER JOIN student_master sm ON sem.student_id = sm.student_id
        WHERE sem.subject_id = ?
        AND sem.programme_id = ?
        AND sem.batch_id = ?
        AND sem.branch_id = ?
        AND sem.semester_id = ?
        AND sem.is_active = 1
        ORDER BY sm.roll_number
    `, [
        41, // subject_id
        1,  // programme_id
        5,  // batch_id
        7,  // branch_id (AI Branch)
        8   // semester_id
    ]);
    
    console.log(`\nMapped students for subject_id 41 (AI Branch): ${mappedStudents.length}`);
    mappedStudents.forEach(student => {
      console.log(`  - ${student.admission_number}: ${student.full_name} (${student.elective_name})`);
    });
    
    console.log('\n=== TESTING FOR CSE BRANCH (BRANCH_ID 1) ===');
    
    // Test for CSE Branch (should be 0 results since students are mapped to AI branch)
    const [cseMappedStudents] = await connection.query(`
        SELECT 
            sem.mapping_id,
            sem.student_id,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            sm.gender,
            sem.elective_name,
            sem.mapped_date
        FROM student_elective_mapping sem
        INNER JOIN student_master sm ON sem.student_id = sm.student_id
        WHERE sem.subject_id = ?
        AND sem.programme_id = ?
        AND sem.batch_id = ?
        AND sem.branch_id = ?
        AND sem.semester_id = ?
        AND sem.is_active = 1
        ORDER BY sm.roll_number
    `, [
        41, // subject_id
        1,  // programme_id
        5,  // batch_id
        1,  // branch_id (CSE Branch)
        8   // semester_id
    ]);
    
    console.log(`\nMapped students for subject_id 41 (CSE Branch): ${cseMappedStudents.length}`);
    cseMappedStudents.forEach(student => {
      console.log(`  - ${student.admission_number}: ${student.full_name} (${student.elective_name})`);
    });
    
    console.log('\n=== CHECKING SUBJECT_ID 41 DETAILS ===');
    
    // Check what subject_id 41 actually is
    const [subject41] = await connection.query(`
        SELECT * FROM subject_master WHERE subject_id = 41
    `);
    
    if (subject41.length > 0) {
      console.log('\n✅ Subject ID 41 details:');
      console.log(`  - Code: ${subject41[0].syllabus_code}`);
      console.log(`  - Name: ${subject41[0].subject_name}`);
      console.log(`  - Branch: ${subject41[0].branch_id}`);
      console.log(`  - Elective: ${subject41[0].elective_name}`);
    }
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('🔍 ISSUE: Students mapped to AI Branch (branch_id 7) but frontend filtering for CSE Branch (branch_id 1)');
    console.log('🔍 SOLUTION: Need to check what branch the frontend is actually filtering for');
    console.log('🔍 EXPECTED: If frontend shows AI Branch subjects, should filter by branch_id 7');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMappedStudentsQuery();
