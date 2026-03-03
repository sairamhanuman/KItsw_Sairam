const { promisePool } = require('./config/database');

async function testExactQuery() {
    try {
        console.log('=== TESTING EXACT QUERY ===');
        
        // Get notification data exactly as the backend does
        const [notification] = await promisePool.query(
            'SELECT notification_id, programmes, batches, semesters, regulations FROM exam_notifications WHERE notification_id = ?',
            ['NOT-1771852790698']
        );
        
        const notif = notification[0];
        console.log('Raw notification data:', notif);
        
        // Parse exactly as backend does
        const programmes = Array.isArray(notif.programmes) ? notif.programmes : [notif.programmes];
        const semesters = Array.isArray(notif.semesters) ? notif.semesters : [notif.semesters];
        const regulations = Array.isArray(notif.regulations) ? notif.regulations : [notif.regulations];
        
        console.log('Parsed data:');
        console.log('Programmes:', programmes, 'Type:', typeof programmes);
        console.log('Semesters:', semesters, 'Type:', typeof semesters);
        console.log('Regulations:', regulations, 'Type:', typeof regulations);
        
        // Test the branch query
        const [branchRows] = await promisePool.query(
            'SELECT DISTINCT branch_id FROM subject_master WHERE programme_id IN (?) AND semester_id IN (?) AND regulation_id IN (?) AND is_active = 1 AND deleted_at IS NULL',
            [programmes, semesters, regulations]
        );
        const relevantBranches = branchRows.map(row => row.branch_id.toString());
        console.log('Relevant branches:', relevantBranches);
        
        // Test the exact subject query
        const [rows] = await promisePool.query(`
            SELECT 
                sm.subject_id,
                sm.syllabus_code as subject_code,
                sm.subject_name,
                sm.syllabus_code,
                sm.programme_id as programme,
                sm.branch_id as branch,
                sm.semester_id as semester,
                sm.regulation_id as regulation,
                sm.is_elective,
                sm.is_under_group,
                sm.elective_name,
                bm.branch_code,
                bm.branch_name
            FROM subject_master sm
            LEFT JOIN branch_master bm ON sm.branch_id = bm.branch_id
            WHERE sm.programme_id IN (?)
            AND sm.branch_id IN (?)
            AND sm.semester_id IN (?)
            AND sm.regulation_id IN (?)
            AND sm.is_active = 1
            AND sm.deleted_at IS NULL
            AND bm.is_active = 1
            AND bm.deleted_at IS NULL
            ORDER BY bm.branch_code, sm.syllabus_code
        `, [programmes, relevantBranches, semesters, regulations]);
        
        console.log('Query result count:', rows.length);
        if (rows.length > 0) {
            console.log('Sample row:', rows[0]);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testExactQuery();
