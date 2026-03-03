const fetch = require('node-fetch');

async function testFinalFix() {
  try {
    console.log('🔧 Testing Final Fix...');
    
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
      console.log('\n✅ SUCCESS: API returned subjects');
      console.log('Unassigned subjects:', result.data.unassigned_subjects.length);
      
      console.log('\n=== SUBJECTS RETURNED ===');
      result.data.unassigned_subjects.forEach((subject, index) => {
        console.log(`  ${index + 1}. ${subject.subject_name} (${subject.subject_code || 'N/A'})`);
        console.log(`      Programme: ${subject.programme}`);
        console.log(`      Branch: ${subject.branch_name}`);
        console.log(`      Semester: ${subject.semester}`);
        console.log(`      Regulation: ${subject.regulation}`);
      });
      
      console.log('\n=== SEMESTER ANALYSIS ===');
      const semesters = [...new Set(result.data.unassigned_subjects.map(s => s.semester))];
      console.log('Semesters found:', semesters);
      
      if (semesters.includes('8')) {
        console.log('✅ CORRECT: API returning Semester 8 subjects');
        console.log('✅ This matches your notification (VIII Semester)');
      } else {
        console.log('⚠️  WARNING: API returning other semesters:', semesters);
      }
      
    } else {
      console.log('\n❌ ERROR: API call failed');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testFinalFix();
