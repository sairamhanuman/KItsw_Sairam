const fetch = require('node-fetch');

async function testAPIDirect() {
  try {
    console.log('🔧 Testing API Direct...');
    
    console.log('\n=== TESTING API WITH DEBUG ===');
    
    // Test the API directly to see what's happening
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
    
    console.log('\n=== API RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response status:', result.status);
    console.log('Message:', result.message);
    
    if (result.status === 'success') {
      console.log('\n✅ SUCCESS: API returned subjects');
      console.log('Unassigned subjects:', result.data.unassigned_subjects.length);
      
      console.log('\n=== SUBJECTS ANALYSIS ===');
      const branches = new Set();
      const semesters = new Set();
      
      result.data.unassigned_subjects.forEach((subject, index) => {
        if (index < 10) { // Show first 10
          console.log(`  ${index + 1}. ${subject.subject_name} (${subject.subject_code || 'N/A'})`);
          console.log(`      Programme: ${subject.programme}`);
          console.log(`      Branch: ${subject.branch_name || subject.branch || 'undefined'}`);
          console.log(`      Semester: ${subject.semester}`);
          console.log(`      Regulation: ${subject.regulation}`);
        }
        branches.add(subject.branch_name || subject.branch);
        semesters.add(subject.semester);
      });
      
      console.log('\n📊 Summary:');
      console.log('Total subjects:', result.data.unassigned_subjects.length);
      console.log('Branches found:', Array.from(branches));
      console.log('Semesters found:', Array.from(semesters));
      
      if (semesters.has('8')) {
        console.log('✅ CORRECT: API returning Semester 8 subjects');
      } else {
        console.log('❌ ISSUE: API returning wrong semesters:', Array.from(semesters));
      }
      
      if (branches.size > 3) {
        console.log('✅ CORRECT: Multiple branches included');
      } else {
        console.log('❌ ISSUE: Limited branches:', Array.from(branches));
      }
      
    } else {
      console.log('\n❌ ERROR: API call failed');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAPIDirect();
