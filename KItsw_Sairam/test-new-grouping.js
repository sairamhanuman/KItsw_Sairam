const mysql = require('mysql2/promise');

async function testNewGrouping() {
  try {
    console.log('🔍 Testing New Elective Grouping Logic...');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Iamgod@123456',
      database: 'engineering_college'
    });
    
    console.log('✅ Connected to database successfully!');
    
    console.log('\n=== NEW GROUPING LOGIC TEST ===');
    
    // Test new grouping logic
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
          WHEN elective_name = 'Open Elective-1' THEN 'Group 1'
          WHEN elective_name = 'Open Elective-2' THEN 'Group 2'
          WHEN elective_name = 'Open Elective-3' THEN 'Group 3'
          WHEN elective_name = 'Open Elective-4' THEN 'Group 4'
          WHEN elective_name = 'Open Elective-5' THEN 'Group 5'
          WHEN elective_name = 'Professional Elective-1' THEN 'Group 6'
          WHEN elective_name = 'Professional Elective-2' THEN 'Group 7'
          WHEN elective_name = 'Professional Elective-3' THEN 'Group 8'
          WHEN elective_name = 'Professional Elective-4' THEN 'Group 9'
          WHEN elective_name = 'Professional Elective-5' THEN 'Group 10'
          ELSE 'Other Groups'
        END as group_category,
        CASE 
          WHEN elective_name = 'Open Elective-1' THEN 1
          WHEN elective_name = 'Open Elective-2' THEN 2
          WHEN elective_name = 'Open Elective-3' THEN 3
          WHEN elective_name = 'Open Elective-4' THEN 4
          WHEN elective_name = 'Open Elective-5' THEN 5
          WHEN elective_name = 'Professional Elective-1' THEN 6
          WHEN elective_name = 'Professional Elective-2' THEN 7
          WHEN elective_name = 'Professional Elective-3' THEN 8
          WHEN elective_name = 'Professional Elective-4' THEN 9
          WHEN elective_name = 'Professional Elective-5' THEN 10
          ELSE 11
        END as group_order
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      ORDER BY group_order, elective_name
    `);
    
    console.log(`\nAll Elective Subjects with New Grouping (${testSubjects.length} total):`);
    
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
    
    // Display groups
    Object.keys(groups).sort((a, b) => groups[a].order - groups[b].order).forEach(groupName => {
      const group = groups[groupName];
      console.log(`\n📚 ${groupName} (${group.subjects.length} subjects):`);
      group.subjects.forEach(subject => {
        console.log(`  - ${subject.syllabus_code}: ${subject.subject_name} (${subject.elective_name})`);
      });
    });
    
    console.log('\n=== CURRENT ELECTIVE NAMES IN DATABASE ===');
    
    // Check what elective names currently exist
    const [electiveNames] = await connection.query(`
      SELECT DISTINCT elective_name, COUNT(*) as count
      FROM subject_master
      WHERE is_elective = 1 
      AND is_active = 1
      GROUP BY elective_name
      ORDER BY elective_name
    `);
    
    console.log('\nCurrent Elective Names:');
    electiveNames.forEach(item => {
      console.log(`  - ${item.elective_name}: ${item.count} subjects`);
    });
    
    await connection.end();
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ New grouping logic implemented');
    console.log('✅ Groups 1-10 supported as requested');
    console.log('🔍 Check if elective names match new pattern');
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
}

testNewGrouping();
