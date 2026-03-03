const mysql = require('mysql2/promise');

async function testUpdatedGrouping() {
  try {
    console.log('🔍 Testing Updated Elective Grouping Logic...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== UPDATED GROUPING LOGIC TEST ===');
    
    // Test updated grouping logic
    const [testSubjects] = await connection.query(`
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
        END as group_category,
        CASE 
          WHEN elective_name = 'Open Elective' THEN 1
          WHEN elective_name = 'Open Elective-1' THEN 2
          WHEN elective_name = 'Open Elective-2' THEN 3
          WHEN elective_name = 'Open Elective-3' THEN 4
          WHEN elective_name = 'Open Elective-4' THEN 5
          WHEN elective_name = 'Professional Elective' THEN 6
          WHEN elective_name = 'Professional Elective-1' THEN 7
          WHEN elective_name = 'Professional Elective-2' THEN 8
          WHEN elective_name = 'Professional Elective-3' THEN 9
          WHEN elective_name = 'Professional Elective-4' THEN 10
          ELSE 11
        END as group_order
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      ORDER BY group_order, elective_name
    `);
    
    console.log(`\nAll Elective Subjects with Updated Grouping (${testSubjects.length} total):`);
    
    // Group by category
    const groups = {};
    testSubjects.forEach(subject => {
      const group = subject.group_category;
      if (!groups[group]) {
        groups[group] = {
          name: group,
          order: subject.group_order,
          subjects: []
        };
      }
      groups[group].subjects.push(subject);
    });
    
    // Display groups in order
    console.log('\n📚 ELECTIVE GROUPS STRUCTURE:');
    for (let i = 1; i <= 10; i++) {
      const groupName = `Group ${i}`;
      if (groups[groupName]) {
        const group = groups[groupName];
        console.log(`\n${groupName} (${group.subjects.length} subjects):`);
        group.subjects.forEach(subject => {
          console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
        });
      } else {
        console.log(`\n${groupName} (0 subjects):`);
        console.log(`  - No subjects in this group`);
      }
    }
    
    // Show "Other Groups" if any
    if (groups['Other Groups']) {
      console.log(`\nOther Groups (${groups['Other Groups'].subjects.length} subjects):`);
      groups['Other Groups'].subjects.forEach(subject => {
        console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
      });
    }
    
    await connection.end();
    
    console.log('\n=== GROUPING SUMMARY ===');
    console.log('✅ Updated grouping logic implemented');
    console.log('✅ Groups 1-10 structured as requested:');
    console.log('  Group 1: Open Elective');
    console.log('  Group 2: Open Elective-1');
    console.log('  Group 3: Open Elective-2');
    console.log('  Group 4: Open Elective-3');
    console.log('  Group 5: Open Elective-4');
    console.log('  Group 6: Professional Elective');
    console.log('  Group 7: Professional Elective-1');
    console.log('  Group 8: Professional Elective-2');
    console.log('  Group 9: Professional Elective-3');
    console.log('  Group 10: Professional Elective-4');
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
}

testUpdatedGrouping();
