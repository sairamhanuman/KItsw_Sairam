// Student Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;
let currentStudents = [];
let currentFilters = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load all dropdown data
    loadProgrammes();
    loadBranches();
    loadBatches();
    loadSemesters();
    loadSections();
    loadRegulations();
    
    // Load students with default filters
    loadStudents();
    
    // Setup event listeners
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    // Form submit
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveStudent();
        });
    }
    
    // Photo form submit
    const photoForm = document.getElementById('photoForm');
    if (photoForm) {
        photoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const studentId = document.getElementById('photoStudentId').value;
            await uploadPhoto(studentId);
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Filter button
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilters);
    }
    
    // Clear filter button
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilters);
    }
    
    // Export button
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
    
    // Photo file input preview
    const photoFileInput = document.getElementById('photoFile');
    if (photoFileInput) {
        photoFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('photoPreview');
                    if (preview) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// ==================== FORM MANAGEMENT FUNCTIONS ====================

// Open modal for adding new student
function openStudentModal() {
    resetForm();
    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('modalTitle').textContent = 'Add New Student';
    }
}

// Edit student
async function editStudent(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const student = result.data;
            
            // Populate form fields
            document.getElementById('studentId').value = student.student_id || '';
            document.getElementById('admissionNumber').value = student.admission_number || '';
            document.getElementById('htNumber').value = student.ht_number || '';
            document.getElementById('rollNumber').value = student.roll_number || '';
            document.getElementById('fullName').value = student.full_name || '';
            document.getElementById('dateOfBirth').value = student.date_of_birth ? student.date_of_birth.split('T')[0] : '';
            
            // Set gender radio button
            if (student.gender) {
                const genderRadio = document.querySelector(`input[name="gender"][value="${student.gender}"]`);
                if (genderRadio) genderRadio.checked = true;
            }
            
            document.getElementById('fatherName').value = student.father_name || '';
            document.getElementById('motherName').value = student.mother_name || '';
            document.getElementById('aadhaarNumber').value = student.aadhaar_number || '';
            document.getElementById('casteCategory').value = student.caste_category || '';
            document.getElementById('studentMobile').value = student.student_mobile || '';
            document.getElementById('parentMobile').value = student.parent_mobile || '';
            document.getElementById('email').value = student.email || '';
            document.getElementById('admissionDate').value = student.admission_date ? student.admission_date.split('T')[0] : '';
            document.getElementById('completionYear').value = student.completion_year || '';
            document.getElementById('dateOfLeaving').value = student.date_of_leaving ? student.date_of_leaving.split('T')[0] : '';
            document.getElementById('discontinueDate').value = student.discontinue_date ? student.discontinue_date.split('T')[0] : '';
            document.getElementById('programmeId').value = student.programme_id || '';
            document.getElementById('branchId').value = student.branch_id || '';
            document.getElementById('batchId').value = student.batch_id || '';
            document.getElementById('semesterId').value = student.semester_id || '';
            document.getElementById('regulationId').value = student.regulation_id || '';
            document.getElementById('sectionId').value = student.section_id || '';
            
            // Load student status from student_semester_history
            await loadStudentStatusFromHistory(student.student_id, student.semester_id || 1);
            
            // Set checkboxes
            document.getElementById('detainee').checked = student.is_detainee || false;
            document.getElementById('transitory').checked = student.is_transitory || false;
            document.getElementById('handicapped').checked = student.is_handicapped || false;
            document.getElementById('lateral').checked = student.is_lateral || false;
            document.getElementById('joinCurriculum').checked = student.join_curriculum || false;
            document.getElementById('lockStudent').checked = student.is_locked || false;
            
            // Update modal
            document.getElementById('modalTitle').textContent = 'Edit Student';
            document.getElementById('submitBtnText').textContent = 'Update Student';
            
            currentEditId = id;
            
            // Open modal
            const modal = document.getElementById('studentModal');
            if (modal) {
                modal.style.display = 'block';
            }
        } else {
            showAlert('Failed to load student details', 'danger');
        }
    } catch (error) {
        console.error('Error loading student:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Save student (Create or Update)
async function saveStudent() {
    // Validate form
    if (!validateForm()) {
        return;
    }
    
    // Collect form data
    const formData = {
        admission_number: document.getElementById('admissionNumber').value.trim(),
        ht_number: document.getElementById('htNumber').value.trim(),
        roll_number: document.getElementById('rollNumber').value.trim(),
        full_name: document.getElementById('fullName').value.trim(),
        date_of_birth: document.getElementById('dateOfBirth').value || null,
        gender: document.querySelector('input[name="gender"]:checked')?.value || null,
        father_name: document.getElementById('fatherName').value.trim(),
        mother_name: document.getElementById('motherName').value.trim(),
        aadhaar_number: document.getElementById('aadhaarNumber').value.trim(),
        caste_category: document.getElementById('casteCategory').value.trim(),
        student_mobile: document.getElementById('studentMobile').value.trim(),
        parent_mobile: document.getElementById('parentMobile').value.trim(),
        email: document.getElementById('email').value.trim(),
        admission_date: document.getElementById('admissionDate').value || null,
        completion_year: document.getElementById('completionYear').value.trim(),
        date_of_leaving: document.getElementById('dateOfLeaving').value || null,
        discontinue_date: document.getElementById('discontinueDate').value || null,
        programme_id: parseInt(document.getElementById('programmeId').value) || null,
        branch_id: parseInt(document.getElementById('branchId').value) || null,
        batch_id: parseInt(document.getElementById('batchId').value) || null,
        semester_id: parseInt(document.getElementById('semesterId').value) || null,
        regulation_id: parseInt(document.getElementById('regulationId').value) || null,
        section_id: parseInt(document.getElementById('sectionId').value) || null,
        student_status: document.getElementById('studentStatus').value || 'In Roll',
        is_detainee: document.getElementById('detainee').checked,
        is_transitory: document.getElementById('transitory').checked,
        is_handicapped: document.getElementById('handicapped').checked,
        is_lateral: document.getElementById('lateral').checked,
        join_curriculum: document.getElementById('joinCurriculum').checked,
        is_locked: document.getElementById('lockStudent').checked
    };
    
    try {
        let response;
        if (currentEditId) {
            // Update existing student
            response = await fetch(`${API_BASE_URL}/api/students/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new student
            response = await fetch(`${API_BASE_URL}/api/students`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Student saved successfully', 'success');
            closeModal('studentModal');
            resetForm();
            loadStudents();
        } else {
            showAlert(result.message || 'Failed to save student', 'danger');
        }
    } catch (error) {
        console.error('Error saving student:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    const form = document.getElementById('studentForm');
    if (form) {
        form.reset();
    }
    document.getElementById('studentId').value = '';
    document.getElementById('submitBtnText').textContent = 'Add Student';
    document.getElementById('studentStatus').value = 'In Roll';
    currentEditId = null;
}

// Validate form
function validateForm() {
    const fullName = document.getElementById('fullName').value.trim();
    const admissionNumber = document.getElementById('admissionNumber').value.trim();
    const rollNumber = document.getElementById('rollNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    const studentMobile = document.getElementById('studentMobile').value.trim();
    const aadhaarNumber = document.getElementById('aadhaarNumber').value.trim();
    const programmeId = document.getElementById('programmeId').value;
    const branchId = document.getElementById('branchId').value;
    const batchId = document.getElementById('batchId').value;
    
    // Check required fields
    if (!fullName || !admissionNumber) {
        showAlert('Please fill in all required fields', 'danger');
        return false;
    }
    
    if (!programmeId || !branchId || !batchId) {
        showAlert('Please select programme, branch, and batch', 'danger');
        return false;
    }
    
    // Validate email format
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAlert('Please enter a valid email address', 'danger');
            return false;
        }
    }
    
    // Validate mobile number (10 digits)
    if (studentMobile) {
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(studentMobile)) {
            showAlert('Student mobile number must be 10 digits', 'danger');
            return false;
        }
    }
    
    // Validate Aadhaar (12 digits)
    if (aadhaarNumber) {
        const aadhaarRegex = /^[0-9]{12}$/;
        if (!aadhaarRegex.test(aadhaarNumber)) {
            showAlert('Aadhaar number must be 12 digits', 'danger');
            return false;
        }
    }
    
    return true;
}

// Load student status from student_semester_history
async function loadStudentStatusFromHistory(studentId, semesterId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/semester-status?semester_id=${semesterId}`);
        const result = await response.json();
        
        if (response.ok && result.data && result.data.length > 0) {
            // Use the most recent status (first record since ordered by semester_id DESC)
            const statusRecord = result.data[0];
            const statusSelect = document.getElementById('studentStatus');
            
            if (statusSelect) {
                statusSelect.value = statusRecord.student_status || 'In Roll';
                console.log('Loaded student status from history:', statusRecord.student_status);
            }
        } else {
            // Fallback to student_master table if no history found
            const statusSelect = document.getElementById('studentStatus');
            if (statusSelect) {
                statusSelect.value = 'In Roll';
            }
        }
    } catch (error) {
        console.error('Error loading student status from history:', error);
        // Fallback to default status
        const statusSelect = document.getElementById('studentStatus');
        if (statusSelect) {
            statusSelect.value = 'In Roll';
        }
    }
}

// ==================== PHOTO UPLOAD FUNCTIONS ====================

// Open photo upload modal
function openPhotoUploadModal(studentId) {
    document.getElementById('photoStudentId').value = studentId;
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('photoFile').value = '';
    
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Upload photo
async function uploadPhoto(studentId) {
    const fileInput = document.getElementById('photoFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('Please select a photo to upload', 'danger');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('Only JPG, JPEG, and PNG files are allowed', 'danger');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('File size must be less than 5MB', 'danger');
        return;
    }
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${studentId}/photo`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Photo uploaded successfully', 'success');
            closeModal('photoModal');
            loadStudents();
        } else {
            showAlert(result.message || 'Failed to upload photo', 'danger');
        }
    } catch (error) {
        console.error('Error uploading photo:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// ==================== FILTER FUNCTIONS ====================

// Apply filters
function applyFilters() {
    currentFilters = {};
    
    const programmeId = document.getElementById('filterProgramme').value;
    const branchId = document.getElementById('filterBranch').value;
    const batchId = document.getElementById('filterBatch').value;
    const semesterId = document.getElementById('filterSemester').value;
    const sectionId = document.getElementById('filterSection').value;
    const regulationId = document.getElementById('filterRegulation').value;
    const status = document.getElementById('filterStatus').value;
    
    if (programmeId) currentFilters.programme_id = programmeId;
    if (branchId) currentFilters.branch_id = branchId;
    if (batchId) currentFilters.batch_id = batchId;
    if (semesterId) currentFilters.semester_id = semesterId;
    if (sectionId) currentFilters.section_id = sectionId;
    if (regulationId) currentFilters.regulation_id = regulationId;
    if (status) currentFilters.status = status;
    
    loadStudents();
}

// Clear filters
function clearFilters() {
    // Clear all filter dropdowns
    document.getElementById('filterProgramme').value = '';
    document.getElementById('filterBranch').value = '';
    document.getElementById('filterBatch').value = '';
    document.getElementById('filterSemester').value = '';
    document.getElementById('filterSection').value = '';
    document.getElementById('filterRegulation').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('searchInput').value = '';
    
    // Clear filters object
    currentFilters = {};
    
    // Reload students
    loadStudents();
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (searchTerm.length >= 2) {
        currentFilters.search = searchTerm;
    } else {
        delete currentFilters.search;
    }
    
    loadStudents();
}

// ==================== STATISTICS FUNCTIONS ====================

// Update statistics
function updateStatistics(data) {
    // If data is an object with statistics property (from API response), use it
    if (data && typeof data === 'object' && 'statistics' in data) {
        const stats = data.statistics;
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statBoys').textContent = stats.boys || 0;
        document.getElementById('statGirls').textContent = stats.girls || 0;
        document.getElementById('statInRoll').textContent = stats.in_roll || 0;
        document.getElementById('statDetained').textContent = stats.detained || 0;
        document.getElementById('statLeftOut').textContent = stats.left_out || 0;
    } 
    // If data is an array of students, calculate statistics
    else if (Array.isArray(data)) {
        const total = data.length;
        const boys = data.filter(s => s.gender === 'Male').length;
        const girls = data.filter(s => s.gender === 'Female').length;
        const inRoll = data.filter(s => s.student_status === 'In Roll').length;
        const detained = data.filter(s => s.student_status === 'Detained').length;
        const leftOut = data.filter(s => s.student_status === 'Left Out' || s.student_status === 'Left out').length;
        
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statBoys').textContent = boys;
        document.getElementById('statGirls').textContent = girls;
        document.getElementById('statInRoll').textContent = inRoll;
        document.getElementById('statDetained').textContent = detained;
        document.getElementById('statLeftOut').textContent = leftOut;
    }
    // Otherwise, set all to 0
    else {
        document.getElementById('statTotal').textContent = 0;
        document.getElementById('statBoys').textContent = 0;
        document.getElementById('statGirls').textContent = 0;
        document.getElementById('statInRoll').textContent = 0;
        document.getElementById('statDetained').textContent = 0;
        document.getElementById('statLeftOut').textContent = 0;
    }
}

// ==================== TABLE DISPLAY FUNCTIONS ====================

// Display students in table
function displayStudents(students) {
    currentStudents = students;
    const tableContainer = document.getElementById('tableContainer');
    
    if (students.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No students found. Add students using the "Add New Student" button or adjust your filters.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Photo</th>
                    <th>Admission No</th>
                    <th>Full Name</th>
                    <th>Gender</th>
                    <th>Branch</th>
                    <th>Batch</th>
                    <th>Semester</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    students.forEach((student, index) => {
        const fullName = student.full_name || 'N/A';
        const photoUrl = student.photo_url ? `${API_BASE_URL}${student.photo_url}` : '';
        
        // Status badge color
        let statusClass = 'status-active';
        if (student.student_status === 'Detained') statusClass = 'status-warning';
        else if (student.student_status === 'Left Out') statusClass = 'status-inactive';
        
        tableHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>
                    ${photoUrl 
                        ? `<img src="${photoUrl}" alt="Photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
                        : '<div style="width: 40px; height: 40px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center;">👤</div>'}
                </td>
                <td><strong>${escapeHtml(student.admission_number)}</strong></td>
                <td>${escapeHtml(fullName)}</td>
                <td>${escapeHtml(student.gender || 'N/A')}</td>
                <td>${escapeHtml(student.branch_name || 'N/A')}</td>
                <td>${escapeHtml(student.batch_name || 'N/A')}</td>
                <td>${escapeHtml(student.current_semester || 'N/A')}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(student.student_status || 'N/A')}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editStudent(${student.student_id})" title="Edit">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-info" onclick="openPhotoUploadModal(${student.student_id})" title="Upload Photo">
                            📷
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${student.student_id}, '${escapeHtml(fullName)}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// ==================== CRUD OPERATIONS ====================

// Load students with filters
async function loadStudents() {
    try {
        // Build query string from filters
        const params = new URLSearchParams(currentFilters);
        const url = `${API_BASE_URL}/api/students${params.toString() ? '?' + params.toString() : ''}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.ok) {
            // The API returns result.data as an object with students and statistics
            if (result.data && result.data.students) {
                displayStudents(result.data.students);
                updateStatistics(result.data); // Pass the whole data object which has statistics
            } else if (Array.isArray(result.data)) {
                // Fallback if API returns array directly
                displayStudents(result.data);
                updateStatistics(result.data);
            } else {
                displayStudents([]);
                updateStatistics([]);
            }
        } else {
            showAlert(result.message || 'Failed to load students', 'danger');
            displayStudents([]);
            updateStatistics([]);
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayStudents([]);
        updateStatistics([]);
    }
}

// Get single student
async function getStudent(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${id}`);
        const result = await response.json();
        
        if (response.ok) {
            return result.data;
        } else {
            showAlert(result.message || 'Failed to get student', 'danger');
            return null;
        }
    } catch (error) {
        console.error('Error getting student:', error);
        showAlert('Error: ' + error.message, 'danger');
        return null;
    }
}

// Delete student
async function deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to delete student "${name}"?\n\nThis will soft-delete the record and it can be restored later.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Student deleted successfully', 'success');
            loadStudents();
        } else {
            showAlert(result.message || 'Failed to delete student', 'danger');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Restore student (if needed)
async function restoreStudent(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/students/${id}/restore`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Student restored successfully', 'success');
            loadStudents();
        } else {
            showAlert(result.message || 'Failed to restore student', 'danger');
        }
    } catch (error) {
        console.error('Error restoring student:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// ==================== EXCEL EXPORT ====================

// Export to Excel
async function exportToExcel() {
    try {
        // Build query string from current filters
        const params = new URLSearchParams(currentFilters);
        const url = `${API_BASE_URL}/api/students/export/excel${params.toString() ? '?' + params.toString() : ''}`;
        
        showAlert('Preparing Excel file...', 'info');
        
        // Trigger download
        window.location.href = url;
        
        setTimeout(() => {
            showAlert('Excel file downloaded successfully', 'success');
        }, 2000);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// ==================== DROPDOWN LOAD FUNCTIONS ====================

// Load programmes
async function loadProgrammes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/programmes`);
        const result = await response.json();
        
        if (response.ok) {
            const programmes = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('programmeId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Programme</option>';
                programmes.forEach(prog => {
                    if (prog.is_active) {
                        const option = document.createElement('option');
                        option.value = prog.programme_id;
                        option.textContent = prog.programme_code;
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterProgramme');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Programmes</option>';
                programmes.forEach(prog => {
                    if (prog.is_active) {
                        const option = document.createElement('option');
                        option.value = prog.programme_id;
                        option.textContent = prog.programme_code;
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading programmes:', error);
    }
}

// Load branches
async function loadBranches() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/branches`);
        const result = await response.json();
        
        if (response.ok) {
            const branches = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('branchId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Branch</option>';
                branches.forEach(branch => {
                    if (branch.is_active) {
                        const option = document.createElement('option');
                        option.value = branch.branch_id;
                        option.textContent = branch.branch_code;
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterBranch');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Branches</option>';
                branches.forEach(branch => {
                    if (branch.is_active) {
                        const option = document.createElement('option');
                        option.value = branch.branch_id;
                        option.textContent = branch.branch_code;
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

// Load batches
async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/batches`);
        const result = await response.json();
        
        if (response.ok) {
            const batches = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('batchId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Batch</option>';
                batches.forEach(batch => {
                    if (batch.is_active) {
                        const option = document.createElement('option');
                        option.value = batch.batch_id;
                        option.textContent = batch.batch_name;
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterBatch');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Batches</option>';
                batches.forEach(batch => {
                    if (batch.is_active) {
                        const option = document.createElement('option');
                        option.value = batch.batch_id;
                        option.textContent = batch.batch_name;
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading batches:', error);
    }
}

// Load semesters
async function loadSemesters() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/semesters`);
        const result = await response.json();
        
        if (response.ok) {
            const semesters = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('semesterId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Semester</option>';
                semesters.forEach(sem => {
                    if (sem.is_active) {
                        const option = document.createElement('option');
                        option.value = sem.semester_id;
                        option.textContent = sem.semester_name;
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterSemester');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Semesters</option>';
                semesters.forEach(sem => {
                    if (sem.is_active) {
                        const option = document.createElement('option');
                        option.value = sem.semester_id;
                        option.textContent = sem.semester_name;
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading semesters:', error);
    }
}

// Load sections
async function loadSections() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sections`);
        const result = await response.json();
        
        if (response.ok) {
            const sections = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('sectionId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Section</option>';
                sections.forEach(section => {
                    if (section.is_active) {
                        const option = document.createElement('option');
                        option.value = section.section_id;
                        option.textContent = section.section_name;
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterSection');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Sections</option>';
                sections.forEach(section => {
                    if (section.is_active) {
                        const option = document.createElement('option');
                        option.value = section.section_id;
                        option.textContent = section.section_name;
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

// Load regulations
async function loadRegulations() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/regulations`);
        const result = await response.json();
        
        if (response.ok) {
            const regulations = result.data || [];
            
            // Populate form dropdown
            const formSelect = document.getElementById('regulationId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Select Regulation</option>';
                regulations.forEach(reg => {
                    if (reg.is_active) {
                        const option = document.createElement('option');
                        option.value = reg.regulation_id;
                        option.textContent = `${reg.regulation_name}`;  // ✅ Use regulation_name
                        formSelect.appendChild(option);
                    }
                });
            }
            
            // Populate filter dropdown
            const filterSelect = document.getElementById('filterRegulation');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">All Regulations</option>';
                regulations.forEach(reg => {
                    if (reg.is_active) {
                        const option = document.createElement('option');
                        option.value = reg.regulation_id;
                        option.textContent = `${reg.regulation_name}`;  // ✅ Use regulation_name
                        filterSelect.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading regulations:', error);
    }
}

// ==================== ALERT FUNCTIONS ====================

// Show alert message
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
    
    // Scroll to top to show alert
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== HELPER FUNCTIONS ====================

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? String(text).replace(/[&<>"']/g, m => map[m]) : '';
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const studentModal = document.getElementById('studentModal');
    const photoModal = document.getElementById('photoModal');
    
    if (event.target === studentModal) {
        closeModal('studentModal');
    }
    if (event.target === photoModal) {
        closeModal('photoModal');
    }
};
