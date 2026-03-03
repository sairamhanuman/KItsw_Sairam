const { promisePool } = require('./config/database');

// Copy the exact backend function
async function getSubjectsForNotification(notification) {
    try {
        const programmes = Array.isArray(notification.programmes) ? notification.programmes : [notification.programmes];
        const batches = Array.isArray(notification.batches) ? notification.batches : [notification.batches];
        const semesters = Array.isArray(notification.semesters) ? notification.semesters : [notification.semesters];
        const regulations = Array.isArray(notification.regulations) ? notification.regulations : [notification.regulations];
        
        console.log('🔍 DEBUG: Notification data:', { programmes, batches, semesters, regulations });
        
        // Get branches that actually have subjects for the given criteria
        const [branchRows] = await promisePool.query(
            'SELECT DISTINCT branch_id FROM subject_master WHERE programme_id IN (?) AND semester_id IN (?) AND regulation_id IN (?) AND is_active = 1 AND deleted_at IS NULL',
            [programmes, semesters, regulations]
        );
        const relevantBranches = branchRows.map(row => row.branch_id.toString());
        
        console.log('🔍 DEBUG: Branches with subjects for criteria:', relevantBranches);
        
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
            WHERE sm.programme_id IN (${programmes.map(() => '?').join(',')})
            AND sm.branch_id IN (${relevantBranches.map(() => '?').join(',')})
            AND sm.semester_id IN (${semesters.map(() => '?').join(',')})
            AND sm.regulation_id IN (${regulations.map(() => '?').join(',')})
            AND sm.is_active = 1
            AND sm.deleted_at IS NULL
            AND bm.is_active = 1
            AND bm.deleted_at IS NULL
            ORDER BY bm.branch_code, sm.syllabus_code
        `, [...programmes, ...relevantBranches, ...semesters, ...regulations]);
        
        console.log('🔍 DEBUG: Query executed, rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('🔍 DEBUG: Sample row:', rows[0]);
        }
        
        return rows;
    } catch (error) {
        console.error('Error getting subjects:', error);
        return [];
    }
}

async function testBackendFunction() {
    try {
        const [notification] = await promisePool.query(
            'SELECT notification_id, programmes, batches, semesters, regulations FROM exam_notifications WHERE notification_id = ?',
            ['NOT-1771852790698']
        );
        
        console.log('Testing backend function with notification:', notification[0]);
        const subjects = await getSubjectsForNotification(notification[0]);
        console.log('Final result:', subjects.length, 'subjects');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testBackendFunction();
