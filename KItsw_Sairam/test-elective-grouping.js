const fetch = require('node-fetch');

async function testElectiveGrouping() {
  try {
    console.log('🔧 Testing Elective Grouping...');
    
    console.log('\n=== TESTING WITH YOUR NOTIFICATION ===');
    console.log('📋 Notification: BTECH, VIII Semester, URR-22');
    
    // Test the API with your notification
    const response = await fetch('http://localhost:3000/api/internal-exam/timetable/generate-fresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notification_id: 'NOT-26-BTEC-VII-1-667361044'
      })
    });
    
    const result = await response.json();
    
    console.log('\n=== API RESPONSE ANALYSIS ===');
    console.log('Status:', response.status);
    console.log('Response status:', result.status);
    console.log('Message:', result.message);
    
    if (result.status === 'success') {
      console.log('\n✅ SUCCESS: API returned timetable');
      console.log('Timetable entries:', result.data.timetable.length);
      console.log('Unassigned subjects:', result.data.unassigned_subjects.length);
      
      console.log('\n=== TIMETABLE ANALYSIS ===');
      const scheduleByDate = {};
      
      result.data.timetable.forEach((entry, index) => {
        const date = entry.date;
        if (!scheduleByDate[date]) {
          scheduleByDate[date] = [];
        }
        scheduleByDate[date].push(entry);
      });
      
      Object.keys(scheduleByDate).forEach(date => {
        console.log(`\n📅 ${date}:`);
        const entries = scheduleByDate[date];
        
        // Group by elective name
        const byElective = {};
        entries.forEach(entry => {
          const elective = entry.elective_name || 'NON_ELECTIVE';
          if (!byElective[elective]) {
            byElective[elective] = [];
          }
          byElective[elective].push(entry);
        });
        
        Object.keys(byElective).forEach(elective => {
          console.log(`  📚 ${elective}:`);
          byElective[elective].forEach(entry => {
            console.log(`    - ${entry.subject_name} (${entry.branch_name})`);
          });
        });
      });
      
      console.log('\n=== ELECTIVE GROUPS FOUND ===');
      const electiveGroups = new Set();
      result.data.unassigned_subjects.forEach(subject => {
        if (subject.elective_name) {
          electiveGroups.add(subject.elective_name);
        }
      });
      console.log('Elective groups:', Array.from(electiveGroups));
      
    } else {
      console.log('\n❌ ERROR: API call failed');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testElectiveGrouping();
