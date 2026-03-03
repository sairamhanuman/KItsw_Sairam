const mysql = require('mysql2/promise');

async function testCurrentAPIEndpoints() {
  try {
    console.log('🔧 Testing Current API Endpoints...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TESTING AVAILABLE STUDENTS API QUERY ===');
    
    // Test the exact query used in the API
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
    `, [
        '2025-2026',
        'Group 1',
        1,  // programme_id
        1,  // branch_id  
        5,  // batch_id
        8,  // semester_id
        2   // regulation_id
    ]);
    
    console.log(`\nAvailable students for Group 1: ${availableStudents.length}`);
    if (availableStudents.length > 0) {
      availableStudents.slice(0, 5).forEach(student => {
        console.log(`  - ${student.admission_number}: ${student.full_name}`);
      });
    }
    
    console.log('\n=== TESTING MAPPED STUDENTS API QUERY ===');
    
    // Test the allotted students query
    const [allottedStudents] = await connection.query(`
        SELECT 
            ega.allotment_id,
            ega.student_id,
            ega.elective_subject_id,
            ega.elective_name,
            ega.allotment_status,
            ega.allotted_date,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            sub.syllabus_code,
            sub.subject_name
        FROM elective_group_allotment ega
        INNER JOIN student_master sm ON ega.student_id = sm.student_id
        LEFT JOIN subject_master sub ON ega.elective_subject_id = sub.subject_id
        WHERE ega.programme_id = ?
        AND ega.branch_id = ?
        AND ega.batch_id = ?
        AND ega.semester_id = ?
        AND ega.regulation_id = ?
        AND ega.academic_year = ?
        AND ega.group_category = ?
        AND ega.allotment_status = 'Allotted'
        ORDER BY sm.roll_number
    `, [
        1,  // programme_id
        1,  // branch_id
        5,  // batch_id
        8,  // semester_id
        2,  // regulation_id
        '2025-2026',
        'Group 1'
    ]);
    
    console.log(`\nAllotted students for Group 1: ${allottedStudents.length}`);
    if (allottedStudents.length > 0) {
      allottedStudents.slice(0, 5).forEach(student => {
        console.log(`  - ${student.admission_number}: ${student.full_name} (${student.elective_name})`);
      });
    }
    
    console.log('\n=== TESTING ELECTIVE SUBJECTS FOR GROUP DETECTION ===');
    
    // Test elective subjects to verify group detection
    const [electiveSubjects] = await connection.query(`
        SELECT 
            subject_id,
            syllabus_code,
            subject_name,
            elective_name,
            CASE 
                WHEN elective_name = 'Open Elective' THEN 'Group 1'
                WHEN elective_name = 'Open Elective-1' THEN 'Group 2'
                WHEN elective_name = 'Open Elective-2' THEN 'Group 3'
                WHEN elective_name = 'Open Elective-3' THEN 'Group 4'
                WHEN elective_name = 'Open Elective-4' THEN 'Group 5'
                WHEN elective_name = 'Professional Elective' THEN 'Group 6'
                WHEN elective_name = 'Professional Elective-1' THEN 'Group 7'
                WHEN elective_name = 'Professional Elective-2' THEN 'Group 8'
                WHEN elective_name = 'Professional Elective-3' THEN 'Group 9'
                WHEN elective_name = 'Professional Elective-4' THEN 'Group 10'
                ELSE 'Other Groups'
            END as group_category
        FROM subject_master
        WHERE is_elective = 1 
        AND is_active = 1
        AND programme_id = 1
        AND branch_id = 1
        AND semester_id = 8
        AND regulation_id = 2
        ORDER BY group_category, elective_name
    `);
    
    console.log('\nElective subjects with group detection:');
    const groups = {};
    electiveSubjects.forEach(subject => {
      const group = subject.group_category;
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(subject);
    });
    
    Object.keys(groups).sort().forEach(groupName => {
      console.log(`\n${groupName}:`);
      groups[groupName].forEach(subject => {
        console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
      });
    });
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ API queries tested successfully');
    console.log('🔍 Check if queries return expected results');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testCurrentAPIEndpoints();
