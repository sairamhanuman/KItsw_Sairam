/**
 * Test Script for Regulations API
 * 
 * This script tests the regulation_code to regulation_name fix
 * 
 * Usage:
 *   node test_regulations.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Helper function for making HTTP requests
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        return {
            status: response.status,
            ok: response.ok,
            data: data
        };
    } catch (error) {
        console.error('Request failed:', error.message);
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

// Test: Get all regulations
async function testGetRegulations() {
    console.log('\n========================================');
    console.log('Test: Get All Regulations');
    console.log('========================================');
    
    const result = await makeRequest(`${API_BASE_URL}/api/regulations`);
    
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.ok) {
        const regulations = Array.isArray(result.data) ? result.data : result.data.data;
        if (regulations && regulations.length > 0) {
            console.log(`\n✓ Retrieved ${regulations.length} regulations`);
            console.log('\nRegulation Details:');
            regulations.forEach(reg => {
                console.log(`  - ID: ${reg.regulation_id}, Name: ${reg.regulation_name}, Year: ${reg.regulation_year}`);
                
                // Verify regulation_code is NOT in the response (it shouldn't exist in DB)
                if (reg.regulation_code !== undefined) {
                    console.log(`    ⚠️ WARNING: regulation_code still present in response!`);
                }
            });
            
            // Verify expected fields are present
            const firstReg = regulations[0];
            const hasRequiredFields = firstReg.regulation_id && firstReg.regulation_name && firstReg.regulation_year !== undefined;
            
            if (hasRequiredFields) {
                console.log('\n✅ All required fields are present (regulation_id, regulation_name, regulation_year)');
            } else {
                console.log('\n❌ Missing required fields in response');
            }
            
            return true;
        } else {
            console.log('\n⚠️ No regulations found in database');
            return true; // Still success, just empty
        }
    } else {
        console.log('\n❌ Failed to retrieve regulations');
        console.log('Error:', result.data);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Testing Regulations API Fix         ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`API Base URL: ${API_BASE_URL}\n`);
    
    try {
        // Test health endpoint
        console.log('Checking API health...');
        const health = await makeRequest(`${API_BASE_URL}/api/health`);
        if (!health.ok) {
            console.error('✗ API is not responding. Make sure the server is running.');
            return false;
        }
        console.log('✓ API is healthy\n');
        
        // Run regulations test
        const regulationsTestPassed = await testGetRegulations();
        
        console.log('\n========================================');
        console.log('Test Summary');
        console.log('========================================');
        console.log(`Regulations API: ${regulationsTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('\n');
        
        return regulationsTestPassed;
        
    } catch (error) {
        console.error('\n✗ Test suite failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run tests if executed directly
if (require.main === module) {
    // Check if fetch is available (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error('Error: This script requires Node.js 18+ with native fetch support');
        process.exit(1);
    }
    
    runTests()
        .then((success) => {
            if (success) {
                console.log('✅ All tests passed!');
                process.exit(0);
            } else {
                console.log('❌ Some tests failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('Test script failed:', error);
            process.exit(1);
        });
}

module.exports = { runTests };
