const fetch = require('node-fetch');

async function testAPIUpdate() {
  try {
    console.log('🔧 Testing Updated API...');
    
    console.log('\n=== TESTING UPDATED API ===');
    
    // Test the updated API with your notification parameters
    const response = await fetch('http://localhost:3000/api/internal-exam/timetable/subjects?programme_id=1&batch_id=5&semester_id=4&regulation_id=2');
    const result = await response.json();
    
    console.log('\n=== API RESPONSE ANALYSIS ===');
    console.log('Status:', response.status);
    console.log('Data type:', typeof result.data);
    console.log('Data length:', result.data ? result.data.length : 'null/undefined');
    
    if (result.status === 'success' && result.data) {
      console.log('\n✅ SUCCESS: API returned subjects');
      console.log('\n=== SUBJECTS RETURNED ===');
      result.data.forEach((subject, index) => {
        console.log(`  ${index + 1}. ${subject.subject_name} (${subject.subject_code || 'N/A'})`);
        console.log(`      Programme: ${subject.programme}`);
        console.log(`      Branch: ${subject.branch_name}`);
        console.log(`      Semester: ${subject.semester}`);
        console.log(`      Regulation: ${subject.regulation_name}`);
      });
      
      console.log('\n=== SEMESTER ANALYSIS ===');
      const semesters = [...new Set(result.data.map(s => s.semester))];
      console.log('Semesters found:', semesters);
      
      if (semesters.includes('4')) {
        console.log('✅ CORRECT: API returning Semester 4 subjects');
        console.log('✅ This matches your notification selection');
      } else if (semesters.includes('8')) {
        console.log('❌ ISSUE: API returning Semester 8 subjects');
        console.log('❌ Wrong semester subjects');
      } else {
        console.log('⚠️  WARNING: API returning other semesters:', semesters);
      }
      
    } else {
      console.log('\n❌ ERROR: API call failed');
      console.log('Status:', result.status);
      console.log('Message:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAPIUpdate();
