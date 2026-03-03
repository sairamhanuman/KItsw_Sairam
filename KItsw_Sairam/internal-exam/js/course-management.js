// Course Management JavaScript
let subjects = [];
let currentEditId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadMasterData();
    loadSubjects();
});

// Load master data for dropdowns
async function loadMasterData() {
    try {
        // Load programmes
        const programmes = await fetchData('/api/programmes');
        const programmeSelect = document.getElementById('programme');
        const filterProgrammeSelect = document.getElementById('filterProgramme');
        
        programmes.forEach(programme => {
            const option = new Option(programme.programme_name, programme.programme_id);
            programmeSelect.add(option);
            filterProgrammeSelect.add(new Option(programme.programme_name, ''));
        });

        // Load branches
        const branches = await fetchData('/api/branches');
        const branchSelect = document.getElementById('branch');
        const filterBranchSelect = document.getElementById('filterBranch');
        
        branches.forEach(branch => {
            const option = new Option(branch.branch_name, branch.branch_id);
            branchSelect.add(option);
            filterBranchSelect.add(new Option(branch.branch_name, ''));
        });

        // Load semesters
        const semesters = await fetchData('/api/semesters');
        const semesterSelect = document.getElementById('semester');
        const filterSemesterSelect = document.getElementById('filterSemester');
        
        semesters.forEach(semester => {
            const option = new Option(`Semester ${semester.semester_number}`, semester.semester_id);
            semesterSelect.add(option);
            filterSemesterSelect.add(new Option(`Semester ${semester.semester_number}`, ''));
        });

        // Load regulations
        const regulations = await fetchData('/api/regulations');
        const regulationSelect = document.getElementById('regulation');
        
        regulations.forEach(regulation => {
            const option = new Option(regulation.regulation_name, regulation.regulation_id);
            regulationSelect.add(option);
        });

    } catch (error) {
        console.error('Error loading master data:', error);
        showAlert('Error loading master data', 'danger');
    }
}

// Load subjects from server
async function loadSubjects(filters = {}) {
    showLoading(true);
    
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetchData(`/api/subjects?${queryParams}`);
        subjects = response.data || response;
        
        displaySubjects(subjects);
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading subjects:', error);
        showAlert('Error loading subjects', 'danger');
        showLoading(false);
    }
}

// Display subjects in table
function displaySubjects(subjects) {
    const tbody = document.getElementById('subjectsTableBody');
    tbody.innerHTML = '';

    subjects.forEach(subject => {
        const row = createSubjectRow(subject);
        tbody.appendChild(row);
    });
}

// Create table row for subject
function createSubjectRow(subject) {
    const row = document.createElement('tr');
    
    const typeBadge = getSubjectTypeBadge(subject);
    const statusBadge = subject.is_active ? 
        '<span class="badge bg-success">Active</span>' : 
        '<span class="badge bg-danger">Inactive</span>';

    row.innerHTML = `
        <td>${subject.subject_id}</td>
        <td>${subject.syllabus_code}</td>
        <td>${subject.ref_code || '-'}</td>
        <td>${subject.subject_name}</td>
        <td>${subject.programme_name || '-'}</td>
        <td>${subject.branch_name || '-'}</td>
        <td>${subject.semester_number || '-'}</td>
        <td>${subject.regulation_name || '-'}</td>
        <td>${typeBadge}</td>
        <td>${subject.elective_name || 'Core Subject'}</td>
        <td>${subject.subject_order || '-'}</td>
        <td>${subject.credits || '-'}</td>
        <td>${subject.internal_max_marks || '-'}</td>
        <td>${statusBadge}</td>
        <td class="text-center action-buttons">
            <button class="btn btn-sm btn-primary me-1" onclick="editSubject(${subject.subject_id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteSubject(${subject.subject_id})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    return row;
}

// Get subject type badge
function getSubjectTypeBadge(subject) {
    if (subject.is_elective) {
        if (subject.elective_name === 'Open Elective') {
            return '<span class="badge elective-badge open-elective">Open Elective</span>';
        } else if (subject.elective_name === 'Professional Elective') {
            return '<span class="badge elective-badge professional-elective">Professional Elective</span>';
        } else {
            return '<span class="badge elective-badge">Elective</span>';
        }
    } else {
        return '<span class="badge core-subject">Core</span>';
    }
}

// Add new subject
function addNewSubject() {
    currentEditId = null;
    document.getElementById('subjectModalTitle').textContent = 'Add New Subject';
    document.getElementById('subjectForm').reset();
    
    // Set default values
    document.getElementById('isActive').value = '1';
    document.getElementById('isRunningCurriculum').value = '1';
    document.getElementById('subjectOrder').value = '1';
    
    const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
    modal.show();
}

// Edit subject
function editSubject(subjectId) {
    currentEditId = subjectId;
    const subject = subjects.find(s => s.subject_id === subjectId);
    
    if (!subject) {
        showAlert('Subject not found', 'danger');
        return;
    }

    document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
    
    // Fill form with subject data
    document.getElementById('syllabusCode').value = subject.syllabus_code || '';
    document.getElementById('refCode').value = subject.ref_code || '';
    document.getElementById('subjectName').value = subject.subject_name || '';
    document.getElementById('programme').value = subject.programme_id || '';
    document.getElementById('branch').value = subject.branch_id || '';
    document.getElementById('semester').value = subject.semester_id || '';
    document.getElementById('regulation').value = subject.regulation_id || '';
    document.getElementById('subjectType').value = subject.is_elective ? '1' : '0';
    document.getElementById('electiveName').value = subject.elective_name || '';
    document.getElementById('subjectOrder').value = subject.subject_order || '';
    document.getElementById('credits').value = subject.credits || '';
    document.getElementById('internalMarks').value = subject.internal_max_marks || '';
    document.getElementById('externalMarks').value = subject.external_max_marks || '';
    document.getElementById('isActive').value = subject.is_active ? '1' : '0';
    document.getElementById('isRunningCurriculum').value = subject.is_running_curriculum ? '1' : '0';
    document.getElementById('subjectId').value = subject.subject_id;

    const modal = new bootstrap.Modal(document.getElementById('subjectModal'));
    modal.show();
}

// Save subject
async function saveSubject() {
    const formData = {
        syllabus_code: document.getElementById('syllabusCode').value,
        ref_code: document.getElementById('refCode').value,
        subject_name: document.getElementById('subjectName').value,
        programme_id: document.getElementById('programme').value,
        branch_id: document.getElementById('branch').value,
        semester_id: document.getElementById('semester').value,
        regulation_id: document.getElementById('regulation').value,
        is_elective: document.getElementById('subjectType').value === '1' ? 1 : 0,
        is_under_group: document.getElementById('electiveName').value ? 1 : 0,
        elective_name: document.getElementById('electiveName').value,
        subject_order: document.getElementById('subjectOrder').value || 1,
        credits: document.getElementById('credits').value || 0,
        internal_max_marks: document.getElementById('internalMarks').value || 0,
        external_max_marks: document.getElementById('externalMarks').value || 0,
        is_active: document.getElementById('isActive').value === '1' ? 1 : 0,
        is_running_curriculum: document.getElementById('isRunningCurriculum').value === '1' ? 1 : 0
    };

    // Validation
    if (!formData.syllabus_code || !formData.subject_name || !formData.programme_id || !formData.branch_id || !formData.semester_id || !formData.regulation_id) {
        showAlert('Please fill all required fields', 'danger');
        return;
    }

    try {
        showLoading(true);
        
        let response;
        if (currentEditId) {
            // Update existing subject
            response = await fetchData(`/api/subjects/${currentEditId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
        } else {
            // Create new subject
            response = await fetchData('/api/subjects', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
        }

        if (response.status === 'success') {
            showAlert(currentEditId ? 'Subject updated successfully' : 'Subject added successfully', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('subjectModal'));
            modal.hide();
            
            // Reload subjects
            loadSubjects();
        } else {
            showAlert(response.message || 'Error saving subject', 'danger');
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error saving subject:', error);
        showAlert('Error saving subject', 'danger');
        showLoading(false);
    }
}

// Delete subject
async function deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject? This action cannot be undone.')) {
        return;
    }

    try {
        showLoading(true);
        
        const response = await fetchData(`/api/subjects/${subjectId}`, {
            method: 'DELETE'
        });

        if (response.status === 'success') {
            showAlert('Subject deleted successfully', 'success');
            loadSubjects();
        } else {
            showAlert(response.message || 'Error deleting subject', 'danger');
        }
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error deleting subject:', error);
        showAlert('Error deleting subject', 'danger');
        showLoading(false);
    }
}

// Apply filters
function applyFilters() {
    const filters = {
        programme_id: document.getElementById('filterProgramme').value,
        branch_id: document.getElementById('filterBranch').value,
        semester_id: document.getElementById('filterSemester').value,
        is_elective: document.getElementById('filterElective').value,
        search: document.getElementById('searchSubject').value
    };

    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });

    loadSubjects(filters);
}

// Reset filters
function resetFilters() {
    document.getElementById('filterProgramme').value = '';
    document.getElementById('filterBranch').value = '';
    document.getElementById('filterSemester').value = '';
    document.getElementById('filterElective').value = '';
    document.getElementById('searchSubject').value = '';
    
    loadSubjects();
}

// Download sample Excel
function downloadSampleExcel() {
    const headers = [
        'Syllabus Code*',
        'Reference Code',
        'Subject Name*',
        'Programme ID*',
        'Branch ID*',
        'Semester ID*',
        'Regulation ID*',
        'Is Elective (0/1)',
        'Is Under Group (0/1)',
        'Elective Name (Open Elective/Professional Elective)',
        'Subject Order (1/2)',
        'Credits',
        'Internal Max Marks',
        'External Max Marks',
        'Is Active (0/1)',
        'Is Running Curriculum (0/1)'
    ];

    const sampleData = [
        ['U18OE602A', 'DM', 'Disaster Management', '1', '7', '6', '2', '1', '1', 'Open Elective', '1', '3.0', '30', '60', '1', '1'],
        ['U18OE602B', 'PM', 'Project Management', '1', '7', '6', '2', '1', '1', 'Open Elective', '1', '3.0', '30', '60', '1', '1'],
        ['U18CS603A', 'DAA', 'Design and Analysis of Algorithms', '1', '7', '6', '2', '1', '1', 'Professional Elective', '2', '3.0', '30', '60', '1', '1'],
        ['U18CS603B', 'CNS', 'Cryptography and Network Security', '1', '7', '6', '2', '1', '1', 'Professional Elective', '2', '3.0', '30', '60', '1', '1'],
        ['U18CS603C', 'STM', 'Software Testing Methodologies', '1', '7', '6', '2', '1', '1', 'Professional Elective', '2', '3.0', '30', '60', '1', '1']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Sample Template");
    
    XLSX.writeFile(wb, "subject_master_template.xlsx");
}

// Export subjects to Excel
async function exportSubjectExcel() {
    try {
        showLoading(true);
        
        const filters = {
            programme_id: document.getElementById('filterProgramme').value,
            branch_id: document.getElementById('filterBranch').value,
            semester_id: document.getElementById('filterSemester').value,
            is_elective: document.getElementById('filterElective').value,
            search: document.getElementById('searchSubject').value
        };

        // Remove empty filters
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });

        const response = await fetchData(`/api/subjects/export?${new URLSearchParams(filters).toString()}`);
        const exportData = response.data || response;

        const headers = [
            'Subject ID',
            'Syllabus Code',
            'Reference Code',
            'Subject Name',
            'Programme',
            'Branch',
            'Semester',
            'Regulation',
            'Is Elective',
            'Elective Name',
            'Subject Order',
            'Credits',
            'Internal Max Marks',
            'External Max Marks',
            'Is Active',
            'Running Curriculum',
            'Created Date'
        ];

        const data = exportData.map(subject => [
            subject.subject_id,
            subject.syllabus_code,
            subject.ref_code || '',
            subject.subject_name,
            subject.programme_name || '',
            subject.branch_name || '',
            subject.semester_number || '',
            subject.regulation_name || '',
            subject.is_elective ? 'Yes' : 'No',
            subject.elective_name || 'Core Subject',
            subject.subject_order || '',
            subject.credits || '',
            subject.internal_max_marks || '',
            subject.external_max_marks || '',
            subject.is_active ? 'Yes' : 'No',
            subject.is_running_curriculum ? 'Yes' : 'No',
            subject.created_at ? new Date(subject.created_at).toLocaleDateString() : ''
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, "Subjects Export");
        
        XLSX.writeFile(wb, "subjects_export.xlsx");
        
        showLoading(false);
        showAlert('Subjects exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting subjects:', error);
        showAlert('Error exporting subjects', 'danger');
        showLoading(false);
    }
}

// Import Excel file
function importExcelFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                showAlert('Excel file is empty', 'warning');
                return;
            }

            // Validate and import data
            await importSubjectsFromExcel(jsonData);
            
        } catch (error) {
            console.error('Error reading Excel file:', error);
            showAlert('Error reading Excel file', 'danger');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Import subjects from Excel data
async function importSubjectsFromExcel(data) {
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    showLoading(true);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
            const subjectData = {
                syllabus_code: row['Syllabus Code*'],
                ref_code: row['Reference Code'],
                subject_name: row['Subject Name*'],
                programme_id: parseInt(row['Programme ID*']),
                branch_id: parseInt(row['Branch ID*']),
                semester_id: parseInt(row['Semester ID*']),
                regulation_id: parseInt(row['Regulation ID*']),
                is_elective: row['Is Elective (0/1)'] === '1' ? 1 : 0,
                is_under_group: row['Is Under Group (0/1)'] === '1' ? 1 : 0,
                elective_name: row['Elective Name (Open Elective/Professional Elective)'],
                subject_order: parseInt(row['Subject Order (1/2)']) || 1,
                credits: parseFloat(row['Credits']) || 0,
                internal_max_marks: parseInt(row['Internal Max Marks']) || 0,
                external_max_marks: parseInt(row['External Max Marks']) || 0,
                is_active: row['Is Active (0/1)'] === '1' ? 1 : 0,
                is_running_curriculum: row['Is Running Curriculum (0/1)'] === '1' ? 1 : 0
            };

            // Validation
            if (!subjectData.syllabus_code || !subjectData.subject_name || !subjectData.programme_id || !subjectData.branch_id || !subjectData.semester_id || !subjectData.regulation_id) {
                errors.push(`Row ${i + 1}: Missing required fields`);
                errorCount++;
                continue;
            }

            const response = await fetchData('/api/subjects', {
                method: 'POST',
                body: JSON.stringify(subjectData)
            });

            if (response.status === 'success') {
                successCount++;
            } else {
                errors.push(`Row ${i + 1}: ${response.message || 'Import failed'}`);
                errorCount++;
            }

        } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            errorCount++;
        }
    }

    showLoading(false);

    // Show import results
    const message = `Import completed!\n\n✅ Successfully imported: ${successCount} subjects\n❌ Failed: ${errorCount} subjects`;
    
    if (errorCount > 0) {
        console.error('Import errors:', errors);
        showAlert(message + '\n\nPlease check console for error details.', errorCount > 0 ? 'warning' : 'success');
    } else {
        showAlert(message, 'success');
    }

    // Reload subjects
    loadSubjects();

    // Clear file input
    document.getElementById('importExcel').value = '';
}

// Utility functions
function fetchData(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const finalOptions = { ...defaultOptions, ...options };

    return fetch(url, finalOptions)
        .then(response => response.json())
        .catch(error => {
            console.error('Fetch error:', error);
            throw error;
        });
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.remove('d-none');
    } else {
        spinner.classList.add('d-none');
    }
}

function showAlert(message, type = 'info') {
    // Create alert container if it doesn't exist
    let alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20px';
        alertContainer.style.right = '20px';
        alertContainer.style.zIndex = '9999';
        document.body.appendChild(alertContainer);
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}
