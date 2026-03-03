/**
 * Test Script for Semester and Exam Session API
 * 
 * This script tests the fixes made to semester and exam session creation.
 * 
 * Usage:
 *   node test_fixes.js
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

// Test 1: Create semester with Roman numerals
async function testSemesterCreation() {
    console.log('\n========================================');
    console.log('Test 1: Create Semester with Roman Numerals');
    console.log('========================================');
    
    const semesterData = {
        semester_name: 'I',
        semester_number: 1,
        is_active: true
    };
    
    console.log('Sending:', JSON.stringify(semesterData, null, 2));
    
    const result = await makeRequest(`${API_BASE_URL}/api/semesters`, {
        method: 'POST',
        body: JSON.stringify(semesterData)
    });
    
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.ok) {
        console.log('✓ Semester created successfully');
        return result.data.data?.semester_id;
    } else {
        console.log('✗ Failed to create semester');
        return null;
    }
}

// Test 2: Create exam session with FN and timings
async function testExamSessionCreation() {
    console.log('\n========================================');
    console.log('Test 2: Create Exam Session with FN and Timings');
    console.log('========================================');
    
    const examSessionData = {
        session_name: 'FN',
        exam_date: '2026-02-06',
        session_type: 'MSE-1',
        start_time: '09:30',
        end_time: '12:30',
        is_active: true
    };
    
    console.log('Sending:', JSON.stringify(examSessionData, null, 2));
    
    const result = await makeRequest(`${API_BASE_URL}/api/exam-sessions`, {
        method: 'POST',
        body: JSON.stringify(examSessionData)
    });
    
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.ok) {
        console.log('✓ Exam session created successfully');
        return result.data.data?.session_id;
    } else {
        console.log('✗ Failed to create exam session');
        return null;
    }
}

// Test 3: Verify semester retrieval
async function testGetSemesters() {
    console.log('\n========================================');
    console.log('Test 3: Get All Semesters');
    console.log('========================================');
    
    const result = await makeRequest(`${API_BASE_URL}/api/semesters`);
    
    console.log('Status:', result.status);
    
    if (result.ok && result.data.data) {
        console.log(`✓ Retrieved ${result.data.data.length} semesters`);
        console.log('First 3 semesters:');
        result.data.data.slice(0, 3).forEach(sem => {
            console.log(`  - ${sem.semester_name} (${sem.semester_number})`);
        });
    } else {
        console.log('✗ Failed to retrieve semesters');
    }
}

// Test 4: Verify exam session retrieval
async function testGetExamSessions() {
    console.log('\n========================================');
    console.log('Test 4: Get All Exam Sessions');
    console.log('========================================');
    
    const result = await makeRequest(`${API_BASE_URL}/api/exam-sessions`);
    
    console.log('Status:', result.status);
    
    if (result.ok && result.data.data) {
        console.log(`✓ Retrieved ${result.data.data.length} exam sessions`);
        console.log('First 3 exam sessions:');
        result.data.data.slice(0, 3).forEach(session => {
            const timings = session.start_time && session.end_time 
                ? `${session.start_time} - ${session.end_time}` 
                : 'No timings';
            console.log(`  - ${session.session_name} (${session.exam_date}) - ${timings}`);
        });
    } else {
        console.log('✗ Failed to retrieve exam sessions');
    }
}

// Run all tests
async function runTests() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Testing Semester & Exam Session API  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`API Base URL: ${API_BASE_URL}\n`);
    
    try {
        // Test health endpoint
        console.log('Checking API health...');
        const health = await makeRequest(`${API_BASE_URL}/api/health`);
        if (!health.ok) {
            console.error('✗ API is not responding. Make sure the server is running.');
            return;
        }
        console.log('✓ API is healthy\n');
        
        // Run tests
        await testGetSemesters();
        await testGetExamSessions();
        
        const semesterId = await testSemesterCreation();
        const examSessionId = await testExamSessionCreation();
        
        console.log('\n========================================');
        console.log('Test Summary');
        console.log('========================================');
        console.log(`Semester created: ${semesterId ? 'Yes (ID: ' + semesterId + ')' : 'No'}`);
        console.log(`Exam session created: ${examSessionId ? 'Yes (ID: ' + examSessionId + ')' : 'No'}`);
        console.log('\n');
        
    } catch (error) {
        console.error('\n✗ Test suite failed:', error.message);
    }
}

// Run tests if executed directly
if (require.main === module) {
    // Check if fetch is available (Node 18+)
    if (typeof fetch === 'undefined') {
        console.error('Error: This script requires Node.js 18+ with native fetch support');
        console.log('Alternative: Install node-fetch and uncomment the import at the top');
        process.exit(1);
    }
    
    runTests()
        .then(() => {
            console.log('Test script completed.');
        })
        .catch((error) => {
            console.error('Test script failed:', error);
            process.exit(1);
        });
}

module.exports = { runTests };
