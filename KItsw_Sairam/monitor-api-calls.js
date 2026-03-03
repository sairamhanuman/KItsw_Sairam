const http = require('http');
const fs = require('fs');

// Create a simple HTTP server to monitor API calls
const server = http.createServer((req, res) => {
    console.log('\n🔥🔥🔥 API CALL DETECTED! 🔥🔥🔥');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Timestamp:', new Date().toISOString());
    
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        console.log('Request body:', body);
        console.log('=====================================\n');
        
        // Forward the request to the actual server
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: req.url,
            method: req.method,
            headers: req.headers
        };
        
        const proxy = http.request(options, (proxyRes) => {
            console.log('📥 RESPONSE RECEIVED:');
            console.log('Status:', proxyRes.statusCode);
            console.log('Headers:', proxyRes.headers);
            
            let responseBody = '';
            proxyRes.on('data', chunk => {
                responseBody += chunk.toString();
            });
            
            proxyRes.on('end', () => {
                console.log('Response body:', responseBody);
                console.log('=====================================\n');
                
                // Send response back to client
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(responseBody);
            });
        });
        
        proxy.on('error', (err) => {
            console.error('❌ Proxy error:', err);
            res.writeHead(500);
            res.end('Proxy error: ' + err.message);
        });
        
        if (body) {
            proxy.write(body);
        }
        proxy.end();
    });
});

// Start monitoring server on port 3001
server.listen(3001, () => {
    console.log('🔧 API Monitor started on port 3001');
    console.log('🔧 Change your frontend to use http://localhost:3001 instead of http://localhost:3000');
    console.log('🔧 This will show all API calls in real-time');
    console.log('🔧 Press Ctrl+C to stop monitoring');
});

// Also create a direct test function
async function testDirectAPI() {
    console.log('\n🔧 TESTING API DIRECTLY...');
    
    const postData = JSON.stringify({
        notification_id: 'NOT-26-BTEC-VII-1-667361044'
    });
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/internal-exam/timetable/generate-fresh',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const req = http.request(options, (res) => {
        console.log('📥 Direct API Response Status:', res.statusCode);
        console.log('📥 Direct API Response Headers:', res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('📥 Direct API Response Body:', data);
            console.log('=====================================\n');
            
            try {
                const result = JSON.parse(data);
                console.log('🔍 ANALYSIS:');
                console.log('Status:', result.status);
                console.log('Message:', result.message);
                
                if (result.data) {
                    console.log('Timetable entries:', result.data.timetable?.length || 0);
                    console.log('Unassigned subjects:', result.data.unassigned_subjects?.length || 0);
                    
                    if (result.data.timetable && result.data.timetable.length > 0) {
                        console.log('\n✅ TIMETABLE DATA FOUND:');
                        console.log('Sample entry:', JSON.stringify(result.data.timetable[0], null, 2));
                        
                        // Check field names
                        const entry = result.data.timetable[0];
                        console.log('\n🔍 FIELD NAMES CHECK:');
                        console.log('Has exam_date:', !!entry.exam_date);
                        console.log('Has session:', !!entry.session);
                        console.log('Has time_slot:', !!entry.time_slot);
                        console.log('Has subject_name:', !!entry.subject_name);
                        console.log('Has branch:', !!entry.branch);
                        
                        // Check grouping
                        console.log('\n🔍 GROUPING ANALYSIS:');
                        const grouped = {};
                        result.data.timetable.forEach(item => {
                            const key = `${item.exam_date}_${item.branch}_${item.elective_name}`;
                            if (!grouped[key]) {
                                grouped[key] = [];
                            }
                            grouped[key].push(item);
                        });
                        
                        console.log('Groups found:', Object.keys(grouped).length);
                        Object.keys(grouped).forEach(key => {
                            console.log(`  ${key}: ${grouped[key].length} subjects`);
                        });
                    } else {
                        console.log('\n❌ NO TIMETABLE DATA FOUND!');
                        console.log('This is the problem - server needs restart!');
                    }
                }
            } catch (parseError) {
                console.error('❌ JSON Parse Error:', parseError);
            }
        });
    });
    
    req.on('error', (e) => {
        console.error('❌ Request Error:', e);
    });
    
    req.write(postData);
    req.end();
}

// Test API directly every 5 seconds
setInterval(testDirectAPI, 5000);

console.log('🔧 Also testing API directly every 5 seconds...');
