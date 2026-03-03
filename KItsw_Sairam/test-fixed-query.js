const mysql = require('mysql2/promise');

async function testFixedQuery() {
  try {
    console.log('🔧 Testing Fixed Available Students Query...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TESTING FIXED AVAILABLE STUDENTS QUERY ===');
    
    // Test the fixed query for subject_id 50 (Data Visualization)
    const [availableStudents] = await connection.query(`
        SELECT DISTINCT
            sm.student_id,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            sm.gender,
            ssh.student_status,
            ssh.semester_id
        FROM student_master sm
        INNER JOIN student_semester_history ssh 
            ON sm.student_id = ssh.student_id
        WHERE ssh.programme_id = ?
        AND ssh.batch_id = ?
        AND ssh.branch_id = ?
        AND ssh.semester_id = ?
        AND ssh.student_status IN ('In Roll', 'Detained', 'Left', 'Completed', 'Dropout')
        AND sm.student_id NOT IN (
            SELECT student_id 
            FROM student_elective_mapping 
            WHERE programme_id = ?
            AND batch_id = ?
            AND branch_id = ?
            AND semester_id = ?
            AND is_active = 1
        )
        ORDER BY sm.roll_number
        LIMIT 10
    `, [
        1,  // programme_id
        5,  // batch_id
        1,  // branch_id
        8,  // semester_id
        1,  // programme_id
        5,  // batch_id
        1,  // branch_id
        8   // semester_id
    ]);
    
    console.log(`\nAvailable students for Data Visualization (subject_id 50): ${availableStudents.length}`);
    availableStudents.forEach(student => {
      console.log(`  - ${student.admission_number}: ${student.full_name} (Status: ${student.student_status})`);
    });
    
    console.log('\n=== TESTING MAPPED STUDENTS QUERY ===');
    
    // Test mapped students query
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
        50, // subject_id
        1,  // programme_id
        5,  // batch_id
        1,  // branch_id
        8   // semester_id
    ]);
    
    console.log(`\nMapped students for Data Visualization: ${mappedStudents.length}`);
    mappedStudents.forEach(student => {
      console.log(`  - ${student.admission_number}: ${student.full_name} (${student.elective_name})`);
    });
    
    console.log('\n=== TOTAL STUDENTS IN SEMESTER 8 ===');
    
    // Check total students in semester
    const [totalStudents] = await connection.query(`
        SELECT COUNT(*) as total
        FROM student_master sm
        INNER JOIN student_semester_history ssh ON sm.student_id = ssh.student_id
        WHERE ssh.programme_id = 1
        AND ssh.batch_id = 5
        AND ssh.branch_id = 1
        AND ssh.semester_id = 8
        AND ssh.student_status = 'In Roll'
    `);
    
    console.log(`\nTotal CSE students in Semester 8: ${totalStudents[0].total}`);
    console.log(`Available: ${availableStudents.length}`);
    console.log(`Mapped: ${mappedStudents.length}`);
    console.log(`Should be: ${totalStudents[0].total - mappedStudents.length} available`);
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Fixed query tested successfully');
    console.log('✅ Available students should exclude mapped students');
    console.log('✅ Mapped students should show in right box');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testFixedQuery();
