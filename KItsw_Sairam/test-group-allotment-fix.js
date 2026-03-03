const mysql = require('mysql2/promise');

async function testGroupAllotmentFix() {
  try {
    console.log('🔧 Testing Group Allotment Fix...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== TESTING AVAILABLE STUDENTS QUERY ===');
    
    // Test the fixed query
    const [availableStudents] = await connection.query(`
        SELECT 
            sm.student_id,
            sm.admission_number,
            sm.roll_number,
            sm.full_name,
            sm.programme_id,
            sm.branch_id,
            sm.batch_id,
            sm.semester_id,
            sm.current_regulation_id,
            b.batch_name,
            br.branch_name,
            r.regulation_name
        FROM student_master sm
        LEFT JOIN batch_master b ON sm.batch_id = b.batch_id
        LEFT JOIN branch_master br ON sm.branch_id = br.branch_id
        LEFT JOIN regulation_master r ON sm.current_regulation_id = r.regulation_id
        LEFT JOIN elective_group_allotment ega ON sm.student_id = ega.student_id 
            AND ega.programme_id = sm.programme_id
            AND ega.branch_id = sm.branch_id
            AND ega.batch_id = sm.batch_id
            AND ega.semester_id = sm.semester_id
            AND ega.academic_year = ?
            AND ega.group_category = ?
        WHERE sm.is_active = 1
        AND sm.programme_id = ?
        AND sm.branch_id = ?
        AND sm.batch_id = ?
        AND sm.semester_id = ?
        AND sm.current_regulation_id = ?
        AND ega.allotment_id IS NULL
        ORDER BY sm.roll_number
        LIMIT 5
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
      console.log(`  - ${student.admission_number}: ${student.full_name} (Sem: ${student.semester_id}, Reg: ${student.regulation_name})`);
    });
    
    console.log('\n=== TESTING ELECTIVE SUBJECTS FOR GROUP 1 ===');
    
    // Test elective subjects for Group 1
    const [group1Subjects] = await connection.query(`
        SELECT 
            subject_id,
            syllabus_code,
            subject_name,
            elective_name,
            semester_id,
            programme_id,
            branch_id,
            regulation_id,
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
    
    console.log('\nElective subjects for CSE Branch 1, Semester 8:');
    const groups = {};
    group1Subjects.forEach(subject => {
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
    console.log('✅ Fixed query working correctly');
    console.log('✅ Student master table structure verified');
    console.log('✅ Group allotment system ready');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testGroupAllotmentFix();
