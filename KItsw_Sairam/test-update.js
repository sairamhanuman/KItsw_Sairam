const fetch = require('node-fetch');

async function testUpdate() {
    try {
        const response = await fetch('http://localhost:3000/api/subjects/41', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                programme_id: 1,
                branch_id: 7,
                semester_id: 8,
                regulation_id: 1,
                subject_order: 2,
                syllabus_code: 'U18AI801A',
                ref_code: 'EH',
                internal_exam_code: 'U18AI801A',
                external_exam_code: 'U18AI801A',
                subject_name: 'Ethical Hacking Updated',
                subject_type: 'Theory',
                internal_max_marks: 30,
                external_max_marks: 60,
                ta_max_marks: 20,
                credits: 3,
                is_elective: 1,
                is_under_group: 1,
                is_replacement: 1,
                elective_name: 'Open Elective',
                is_exempt_exam_fee: 0,
                replacement_group_order: 1,
                is_running_curriculum: 1,
                is_locked: 0
            })
        });
        
        const data = await response.json();
        console.log('Response:', data);
        console.log('Status:', response.status);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testUpdate();
