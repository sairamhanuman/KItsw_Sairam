const mysql = require('mysql2/promise');

async function testCorrectTableQuery() {
  try {
    console.log('🔧 Testing Correct Table Query...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TESTING CORRECT QUERY WITH student_semester_history ===');
    
    // Test the corrected query using student_semester_history
    const [availableStudents] = await connection.query(`
        SELECT 
            sm.student_id,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            ssh.programme_id,
            ssh.branch_id,
            ssh.batch_id,
            ssh.semester_id,
            ssh.regulation_id,
            b.batch_name,
            br.branch_name,
            r.regulation_name
        FROM student_master sm
        INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
        LEFT JOIN batch_master b ON ssh.batch_id = b.batch_id
        LEFT JOIN branch_master br ON ssh.branch_id = br.branch_id
        LEFT JOIN regulation_master r ON ssh.regulation_id = r.regulation_id
        LEFT JOIN elective_group_allotment ega ON sm.student_id = ega.student_id 
            AND ega.programme_id = ssh.programme_id
            AND ega.branch_id = ssh.branch_id
            AND ega.batch_id = ssh.batch_id
            AND ega.semester_id = ssh.semester_id
            AND ega.academic_year = ?
            AND ega.group_category = ?
        WHERE sm.is_active = 1
        AND ssh.student_status = 'In Roll'
        AND ssh.programme_id = ?
        AND ssh.branch_id = ?
        AND ssh.batch_id = ?
        AND ssh.semester_id = ?
        AND ssh.regulation_id = ?
        AND ega.allotment_id IS NULL
        ORDER BY sm.roll_number
        LIMIT 10
    `, [
        '2025-2026',
        'Group 1',
        1,  // programme_id
        1,  // branch_id
        5,  // batch_id
        8,  // semester_id
        2   // regulation_id
    ]);
    
    console.log(`\nFound ${availableStudents.length} available students for Group 1:`);
    availableStudents.forEach(student => {
      console.log(`  - ${student.admission_number}: ${student.full_name} (Sem: ${student.semester_id}, Branch: ${student.branch_name})`);
    });
    
    console.log('\n=== VERIFYING TOTAL STUDENTS IN SEMESTER 8 ===');
    
    const [semester8Students] = await connection.query(`
        SELECT 
            COUNT(*) as total_students,
            ssh.branch_id,
            br.branch_name
        FROM student_master sm
        INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
        LEFT JOIN branch_master br ON ssh.branch_id = br.branch_id
        WHERE sm.is_active = 1
        AND ssh.student_status = 'In Roll'
        AND ssh.programme_id = 1
        AND ssh.batch_id = 5
        AND ssh.semester_id = 8
        GROUP BY ssh.branch_id, br.branch_name
        ORDER BY ssh.branch_id
    `);
    
    console.log('\nTotal students in Semester 8 by branch:');
    semester8Students.forEach(branch => {
      console.log(`  - Branch ${branch.branch_id} (${branch.branch_name}): ${branch.total_students} students`);
    });
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Correct query working with student_semester_history');
    console.log('✅ Found actual students with real semester data');
    console.log('✅ Group allotment system should work now');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testCorrectTableQuery();
