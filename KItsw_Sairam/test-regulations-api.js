const fetch = require('node-fetch');

async function testRegulationsAPI() {
  try {
    console.log('🔍 Testing Regulations API...');
    
    console.log('\n=== TESTING /api/regulations ENDPOINT ===');
    
    const response = await fetch('http://localhost:3000/api/regulations');
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response data:', result);
    
    if (result.status === 'success') {
      console.log('✅ Regulations found:', result.data.length);
      result.data.forEach((regulation, index) => {
        console.log(`  ${index + 1}. ${regulation.regulation_name} (${regulation.regulation_year}) - Active: ${regulation.is_active}`);
      });
    } else {
      console.log('❌ API Error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

testRegulationsAPI();
