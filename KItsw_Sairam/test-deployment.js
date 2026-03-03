// Test script to check if Railway deployment has updated
// Run this in browser console

async function testDeploymentUpdate() {
    console.log('🔧 Testing if Railway deployment has updated...');
    
    try {
        // Test the main endpoint
        const response = await fetch('/api/exam-timetable');
        const data = await response.json();
        
        console.log('📥 Main API response:', {
            status: response.status,
            success: data.status === 'success',
            message: data.message
        });
        
        // Test a specific timetable ID (use one that you created)
        const testId = 2; // Change this to your timetable ID
        const detailResponse = await fetch(`/api/exam-timetable/${testId}`);
        const detailData = await detailResponse.json();
        
        console.log('📥 Detail API response:', {
            status: detailResponse.status,
            success: detailData.status === 'success',
            message: detailData.message,
            hasData: !!detailData.data
        });
        
        if (detailResponse.status === 500) {
            console.log('❌ Railway deployment has NOT updated yet');
            console.log('⏰ Please wait 2-3 more minutes for Railway to redeploy');
        } else if (detailData.status === 'success') {
            console.log('✅ Railway deployment has updated successfully!');
            console.log('🎉 View/Edit functionality should now work');
        }
        
    } catch (error) {
        console.error('❌ Error testing deployment:', error);
    }
}

// Test immediately
testDeploymentUpdate();

// Test again after 30 seconds
setTimeout(testDeploymentUpdate, 30000);

// Test again after 60 seconds  
setTimeout(testDeploymentUpdate, 60000);

console.log('🔧 Deployment test loaded. Will test every 30 seconds for 1 minute.');
console.log('If you still see 500 errors after 1 minute, the deployment may need more time.');
