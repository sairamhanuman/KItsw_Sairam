// Course Management JavaScript - Simple Version
let subjects = [];
let currentEditId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Course Management page loaded');
    loadMasterData();
    loadSubjects();
});

// Load master data for dropdowns
async function loadMasterData() {
    try {
        console.log('🔄 Loading master data...');
        
        // Load programmes
        const programmesResponse = await fetchData('/api/programmes');
        const programmes = programmesResponse.data || programmesResponse;
        const programmeSelect = document.getElementById('programme');
        const filterProgrammeSelect = document.getElementById('filterProgramme');
        
        programmes.forEach(programme => {
            const option = new Option(programme.programme_name, programme.programme_id);
            programmeSelect.add(option);
            filterProgrammeSelect.add(new Option(programme.programme_name, programme.programme_id));
        });
        console.log('✅ Programmes loaded:', programmes.length);

        // Load branches
        const branchesResponse = await fetchData('/api/branches');
        const branches = branchesResponse.data || branchesResponse;
        const branchSelect = document.getElementById('branch');
        const filterBranchSelect = document.getElementById('filterBranch');
        
        branches.forEach(branch => {
            const option = new Option(branch.branch_name, branch.branch_id);
            branchSelect.add(option);
            filterBranchSelect.add(new Option(branch.branch_name, branch.branch_id));
        });
        console.log('✅ Branches loaded:', branches.length);

        // Load semesters
        const semestersResponse = await fetchData('/api/semesters');
        const semesters = semestersResponse.data || semestersResponse;
        const semesterSelect = document.getElementById('semester');
        const filterSemesterSelect = document.getElementById('filterSemester');
        
        semesters.forEach(semester => {
            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
            const romanNumeral = romanNumerals[semester.semester_number - 1] || semester.semester_number;
            const option = new Option(`Semester ${romanNumeral}`, semester.semester_id);
            semesterSelect.add(option);
            filterSemesterSelect.add(new Option(`Semester ${romanNumeral}`, semester.semester_id));
        });
        console.log('✅ Semesters loaded:', semesters.length);

        // Load regulations
        const regulationsResponse = await fetchData('/api/regulations');
        const regulations = regulationsResponse.data || regulationsResponse;
        const regulationSelect = document.getElementById('regulation');
        const filterRegulationSelect = document.getElementById('filterRegulation');
        
        regulations.forEach(regulation => {
            const option = new Option(regulation.regulation_name, regulation.regulation_id);
            regulationSelect.add(option);
            filterRegulationSelect.add(new Option(regulation.regulation_name, regulation.regulation_id));
        });
        console.log('✅ Regulations loaded:', regulations.length);

    } catch (error) {
        console.error('❌ Error loading master data:', error);
        showAlert('Error loading master data', 'danger');
    }
}

// Load subjects from server
async function loadSubjects(filters = {}) {
    showLoading(true);
    
    try {
        console.log('🔄 Loading subjects with filters:', filters);
        
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetchData(`/api/subjects?${queryParams}`);
        subjects = response.data || response;
        
        console.log('✅ Subjects loaded:', subjects.length);
        displaySubjects(subjects);
        showLoading(false);
        
    } catch (error) {
        console.error('❌ Error loading subjects:', error);
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
    
    console.log('✅ Subjects displayed in table:', subjects.length);
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
    document.getElementById('isUnderGroup').value = subject.is_under_group ? '1' : '0';
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

// Download sample Excel - SIMPLE VERSION
function downloadSampleExcel() {
    console.log('🔄 Downloading SIMPLE sample Excel template...');
    
    try {
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

        console.log('📊 Creating Excel workbook...');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        XLSX.utils.book_append_sheet(wb, ws, "Sample Template");
        
        console.log('💾 Writing Excel file...');
        XLSX.writeFile(wb, "subject_master_template.xlsx");
        
        console.log('✅ Sample Excel downloaded successfully');
        showAlert('Sample Excel downloaded successfully', 'success');
        
    } catch (error) {
        console.error('❌ Error downloading sample Excel:', error);
        showAlert('Error downloading sample Excel: ' + error.message, 'danger');
    }
}

// Apply filters
function applyFilters() {
    const filters = {
        programme_id: document.getElementById('filterProgramme').value,
        branch_id: document.getElementById('filterBranch').value,
        semester_id: document.getElementById('filterSemester').value,
        regulation_id: document.getElementById('filterRegulation').value,
        is_elective: document.getElementById('filterElective').value,
        search: document.getElementById('searchSubject').value
    };

    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });

    console.log('🔄 Applying filters:', filters);
    loadSubjects(filters);
}

// Reset filters
function resetFilters() {
    document.getElementById('filterProgramme').value = '';
    document.getElementById('filterBranch').value = '';
    document.getElementById('filterSemester').value = '';
    document.getElementById('filterRegulation').value = '';
    document.getElementById('filterElective').value = '';
    document.getElementById('searchSubject').value = '';
    
    loadSubjects();
}

// Save subject (create or update)
async function saveSubject() {
    try {
        const subjectData = {
            programme_id: document.getElementById('programme').value,
            branch_id: document.getElementById('branch').value,
            semester_id: document.getElementById('semester').value,
            regulation_id: document.getElementById('regulation').value,
            syllabus_code: document.getElementById('syllabusCode').value,
            ref_code: document.getElementById('refCode').value,
            subject_name: document.getElementById('subjectName').value,
            is_elective: document.getElementById('subjectType').value,
            is_under_group: document.getElementById('isUnderGroup').value,
            elective_name: document.getElementById('electiveName').value,
            subject_order: document.getElementById('subjectOrder').value || 1,
            credits: document.getElementById('credits').value || 0,
            internal_max_marks: document.getElementById('internalMarks').value || 0,
            external_max_marks: document.getElementById('externalMarks').value || 0,
            is_active: document.getElementById('isActive').value,
            is_running_curriculum: document.getElementById('isRunningCurriculum').value
        };

        console.log('🔄 Saving subject data:', subjectData);

        // Validation
        if (!subjectData.programme_id || !subjectData.branch_id || !subjectData.semester_id || 
            !subjectData.regulation_id || !subjectData.syllabus_code || !subjectData.subject_name) {
            showAlert('Please fill all required fields', 'warning');
            return;
        }

        // If elective is selected, elective_name is required
        if (subjectData.is_elective === '1' && !subjectData.elective_name) {
            showAlert('Please select elective type when subject is marked as elective', 'warning');
            return;
        }

        showLoading(true);

        let response;
        if (currentEditId) {
            // Update existing subject
            console.log('🔄 Updating subject:', currentEditId);
            response = await fetchData(`/api/subjects/${currentEditId}`, {
                method: 'PUT',
                body: JSON.stringify(subjectData)
            });
        } else {
            // Create new subject
            console.log('🔄 Creating new subject');
            response = await fetchData('/api/subjects', {
                method: 'POST',
                body: JSON.stringify(subjectData)
            });
        }

        console.log('✅ API Response:', response);

        if (response.status === 'success') {
            showAlert(response.message, 'success');
            
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
    if (!confirm('Are you sure you want to delete this subject?')) {
        return;
    }

    try {
        showLoading(true);
        
        const response = await fetchData(`/api/subjects/${subjectId}`, {
            method: 'DELETE'
        });

        if (response.status === 'success') {
            showAlert(response.message, 'success');
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
