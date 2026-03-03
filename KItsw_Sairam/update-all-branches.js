const { promisePool } = require('./config/database');

async function updateAllBranches() {
    try {
        console.log('Getting all available branches...');
        
        const [branches] = await promisePool.query(
            'SELECT branch_id FROM branch_master WHERE is_active = 1 AND deleted_at IS NULL ORDER BY branch_id'
        );
        
        const branchIds = branches.map(b => b.branch_id.toString());
        console.log('Available branch IDs:', branchIds);
        
        console.log('Updating notification to include all branches...');
        
        await promisePool.query(
            'UPDATE exam_notifications SET batches = ? WHERE notification_id = ?',
            [JSON.stringify(branchIds), 'NOT-1771852790698']
        );
        
        console.log('✅ Notification updated successfully!');
        
        const [rows] = await promisePool.query(
            'SELECT notification_id, programmes, batches, semesters, regulations FROM exam_notifications WHERE notification_id = ?',
            ['NOT-1771852790698']
        );
        
        console.log('Updated notification data:');
        console.log(rows[0]);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateAllBranches();
