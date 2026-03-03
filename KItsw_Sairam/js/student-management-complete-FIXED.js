// ========================================
// PROFESSIONAL STUDENT MANAGEMENT - COMPLETE FIXED VERSION
// All bugs fixed + Elective Mapping feature
// ========================================

// Global state
let currentTab = 'import-initial';
let allStudents = [];
let currentEditingStudent = null;
let availableStudents = [];
let mappedStudents = [];

// ========================================
// UTILITY FUNCTIONS
// ========================================

function showAlert(message, type = 'info') {
    alert(message);
}

// Non-blocking notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'info' ? '#007bff' : type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#6c757d'};
        color: white;
        border-radius: 4px;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: opacity 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showLoading(elementId, show = true) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (show) {
        element.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
        element.classList.remove('hidden');
    } else {
        element.innerHTML = '';
        element.classList.add('hidden');
    }
}

// FIX: Convert ISO date to yyyy-MM-dd format
function formatDateForInput(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ========================================
// TAB MANAGEMENT
// ========================================

function openTab(tabName) {
    currentTab = tabName;
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Set active button
    event.target.classList.add('active');
    
    if (tabName === 'student-management') {
        loadMasterData('view');
        document.getElementById('student-list').innerHTML = '<div class="alert alert-info">Please select filters and click Load Students button</div>';
        document.getElementById('student-stats').classList.add('hidden');
    } else if (tabName === 'mapping') {
        loadMasterData('mapping');
    } else if (tabName === 'promotions') {
        loadMasterData('promote-from');
        loadMasterData('promote-to');
    } else if (tabName === 'import-initial') {
        loadMasterData('initial');
    } else if (tabName === 'elective-mapping') {
        loadMasterData('elective');
        clearElectiveBoxes();
    }
}

// ========================================
// MASTER DATA LOADING (FIXED)
// ========================================

async function loadMasterData(prefix) {
    try {
        console.log(`Loading master data for prefix: ${prefix}`);
        
        // Load Programmes
        const programmesResponse = await fetch('/api/programmes');
        const programmesData = await programmesResponse.json();
        const programmes = programmesData.data || programmesData;
        
        const programmeSelect = document.getElementById(`${prefix}-programme`);
        if (programmeSelect) {
            programmeSelect.innerHTML = '<option value="">Select Programme</option>';
            programmes.forEach(p => {
                programmeSelect.innerHTML += `<option value="${p.programme_id}">${p.programme_name} (${p.programme_code})</option>`;
            });
        }

        // Load Batches
        const batchesResponse = await fetch('/api/batches');
        const batchesData = await batchesResponse.json();
        const batches = batchesData.data || batchesData;
        
        const batchSelects = [
            `${prefix}-batch`,
            'update-batch',
            'promote-to-batch',
            'edit-batch'  // FIX: Added for modal
        ];
        
        batchSelects.forEach(selectId => {
            const batchSelect = document.getElementById(selectId);
            if (batchSelect) {
                const isUpdateSelect = selectId === 'update-batch';
                const isPromoteSelect = selectId === 'promote-to-batch';
                
                if (isUpdateSelect) {
                    batchSelect.innerHTML = '<option value="">Select New Batch</option>';
                } else if (isPromoteSelect) {
                    batchSelect.innerHTML = '<option value="">Keep Same Batch</option>';
                } else {
                    batchSelect.innerHTML = '<option value="">Select Batch</option>';
                }
                
                batches.forEach(b => {
                    batchSelect.innerHTML += `<option value="${b.batch_id}">${b.batch_name}</option>`;
                });
            }
        });

        // Load Regulations
        const regulationsResponse = await fetch('/api/regulations');
        const regulationsRaw = await regulationsResponse.json();
        const regulations = Array.isArray(regulationsRaw) ? regulationsRaw : (regulationsRaw.data || []);
        
        const regulationSelects = [
            `${prefix}-regulation`,
            'update-regulation',
            'promote-to-regulation'
        ];
        
        regulationSelects.forEach(selectId => {
            const regulationSelect = document.getElementById(selectId);
            if (regulationSelect) {
                const isUpdateSelect = selectId === 'update-regulation';
                const isPromoteSelect = selectId === 'promote-to-regulation';
                
                if (isUpdateSelect) {
                    regulationSelect.innerHTML = '<option value="">Select New Regulation</option>';
                } else if (isPromoteSelect) {
                    regulationSelect.innerHTML = '<option value="">Keep Same Regulation</option>';
                } else {
                    regulationSelect.innerHTML = '<option value="">Select Regulation</option>';
                }
                
                regulations.forEach(r => {
                    regulationSelect.innerHTML += `<option value="${r.regulation_id}">${r.regulation_name}</option>`;
                });
            }
        });

        // Load Semesters
        const semestersResponse = await fetch('/api/semesters');
        const semestersData = await semestersResponse.json();
        const semesters = semestersData.data || semestersData;
        
        const semesterSelects = [
            `${prefix}-semester`,
            'mapping-semester',
            'promote-from-semester',
            'edit-semester'  // FIX: Added for modal
        ];
        
        semesterSelects.forEach(selectId => {
            const semesterSelect = document.getElementById(selectId);
            if (semesterSelect) {
                semesterSelect.innerHTML = '<option value="">Select Semester</option>';
                semesters.forEach(s => {
                    semesterSelect.innerHTML += `<option value="${s.semester_id}">${s.semester_name}</option>`;
                });
            }
        });

        // Load Sections
        const sectionsResponse = await fetch('/api/sections');
        const sectionsData = await sectionsResponse.json();
        const sections = sectionsData.data || sectionsData;
        
        const sectionSelects = [`${prefix}-section`, 'edit-section']; // FIX: Added edit-section
        sectionSelects.forEach(selectId => {
            const sectionSelect = document.getElementById(selectId);
            if (sectionSelect) {
                sectionSelect.innerHTML = '<option value="">Select Section</option>';
                sections.forEach(s => {
                    sectionSelect.innerHTML += `<option value="${s.section_id}">${s.section_name}</option>`;
                });
            }
        });

        // Handle elective-specific dropdowns
        if (prefix === 'elective') {
            // Load elective-specific dropdowns
            const electiveProgrammeSelect = document.getElementById('elective-programme');
            const electiveBatchSelect = document.getElementById('elective-batch');
            const electiveBranchSelect = document.getElementById('elective-branch');
            const electiveSemesterSelect = document.getElementById('elective-semester');
            const electiveRegulationSelect = document.getElementById('elective-regulation');
            
            if (electiveProgrammeSelect) {
                electiveProgrammeSelect.innerHTML = '<option value="">Select Programme</option>';
                programmes.forEach(p => {
                    electiveProgrammeSelect.innerHTML += `<option value="${p.programme_id}">${p.programme_name} (${p.programme_code})</option>`;
                });
            }
            
            if (electiveBatchSelect) {
                electiveBatchSelect.innerHTML = '<option value="">Select Batch</option>';
                batches.forEach(b => {
                    electiveBatchSelect.innerHTML += `<option value="${b.batch_id}">${b.batch_name}</option>`;
                });
            }
            
            if (electiveBranchSelect) {
                electiveBranchSelect.innerHTML = '<option value="">Select Branch</option>';
                // Load branches for elective
                try {
                    const branchesResponse = await fetch('/api/branches');
                    const branchesData = await branchesResponse.json();
                    const branches = branchesData.data || branchesData;
                    
                    branches.forEach(b => {
                        electiveBranchSelect.innerHTML += `<option value="${b.branch_id}">${b.branch_name} (${b.branch_code})</option>`;
                    });
                } catch (error) {
                    console.error('Error loading elective branches:', error);
                }
            }
            
            if (electiveSemesterSelect) {
                electiveSemesterSelect.innerHTML = '<option value="">Select Semester</option>';
                semesters.forEach(s => {
                    electiveSemesterSelect.innerHTML += `<option value="${s.semester_id}">${s.semester_name}</option>`;
                });
            }
        }

        console.log('Master data loaded successfully');
        
    } catch (error) {
        console.error('Error loading master data:', error);
        showAlert('Failed to load master data: ' + error.message, 'error');
    }
}

async function loadBranches(prefix) {
    const programmeId = document.getElementById(`${prefix}-programme`)?.value;
    if (!programmeId) return;

    try {
        const response = await fetch(`/api/branches?programme_id=${programmeId}`);
        const data = await response.json();
        const branches = data.data || data;
        
        const branchSelect = document.getElementById(`${prefix}-branch`);
        if (branchSelect) {
            branchSelect.innerHTML = '<option value="">Select Branch</option>';
            branches.forEach(b => {
                branchSelect.innerHTML += `<option value="${b.branch_id}">${b.branch_name} (${b.branch_code})</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading branches:', error);
        showAlert('Failed to load branches', 'error');
    }
}

// ========================================
// TAB 1: IMPORT INITIAL DATABASE
// ========================================

async function generateInitialTemplate() {
    const programmeId = document.getElementById('initial-programme').value;
    const batchId = document.getElementById('initial-batch').value;
    const branchId = document.getElementById('initial-branch').value;
    const regulationId = document.getElementById('initial-regulation').value;

    if (!programmeId || !batchId || !branchId || !regulationId) {
        showAlert('Please select Programme, Batch, Branch, and Regulation', 'error');
        return;
    }

    try {
        const url = `/api/student-management/import-initial/generate-template?programme_id=${programmeId}&batch_id=${batchId}&branch_id=${branchId}&regulation_id=${regulationId}`;
        window.open(url, '_blank');
    } catch (error) {
        console.error('Error generating template:', error);
        showAlert('Failed to generate template', 'error');
    }
}

async function importInitialDatabase() {
    const fileInput = document.getElementById('initial-file-input');
    const file = fileInput.files[0];

    if (!file) return;

    const programmeId = document.getElementById('initial-programme').value;
    const batchId = document.getElementById('initial-batch').value;
    const branchId = document.getElementById('initial-branch').value;
    const regulationId = document.getElementById('initial-regulation').value;

    if (!programmeId || !batchId || !branchId || !regulationId) {
        showAlert('Please select all required filters first', 'error');
        fileInput.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('programme_id', programmeId);
    formData.append('batch_id', batchId);
    formData.append('branch_id', branchId);
    formData.append('regulation_id', regulationId);

    const resultDiv = document.getElementById('initial-import-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Importing students...</p></div>';
    resultDiv.classList.remove('hidden');

    try {
        const response = await fetch('/api/student-management/import-initial/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            let errorsHtml = '';
            if (result.data.errors && result.data.errors.length > 0) {
                errorsHtml = '<div style="margin-top: 10px;"><strong>Errors:</strong><ul style="margin: 5px 0; padding-left: 20px;">';
                result.data.errors.slice(0, 10).forEach(err => {
                    errorsHtml += `<li>${err.admission_number || err.row}: ${err.error}</li>`;
                });
                if (result.data.errors.length > 10) {
                    errorsHtml += `<li>...and ${result.data.errors.length - 10} more errors</li>`;
                }
                errorsHtml += '</ul></div>';
            }
            
            // ========================================
            // 🚨 VALIDATION: Show Validation Warnings
            // ========================================
            
            let validationHtml = '';
            if (result.data.validation_warnings && result.data.validation_warnings.length > 0) {
                validationHtml = '<div style="margin-top: 10px; background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px;"><strong>⚠️ Validation Warnings:</strong><ul style="margin: 5px 0; padding-left: 20px; color: #856404;">';
                result.data.validation_warnings.forEach(warning => {
                    validationHtml += `<li>${warning}</li>`;
                });
                validationHtml += '</ul><small style="color: #856404;">Import proceeded successfully, but please review the warnings above.</small></div>';
            }
            
            // ========================================
            // END VALIDATION - Display Results
            // ========================================
            
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h3>✅ Import Successful</h3>
                    <p><strong>Imported:</strong> ${result.data.imported} students</p>
                    <p><strong>Skipped:</strong> ${result.data.skipped} students</p>
                    ${errorsHtml}
                    ${validationHtml}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-error">
                    <h3>❌ Import Failed</h3>
                    <p>${result.message}</p>
                    ${result.validation_errors ? `
                        <div style="margin-top: 10px; background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px;">
                            <strong>🚨 Critical Validation Errors:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px; color: #721c24;">
                                ${result.validation_errors.map(error => `<li>${error}</li>`).join('')}
                            </ul>
                            <hr style="margin: 10px 0; border: 1px solid #f5c6cb;">
                            <p style="color: #721c24; font-weight: 600;">📋 Solution:</p>
                            <ol style="margin: 5px 0; padding-left: 20px; color: #721c24;">
                                <li>Go back to <strong>Generate Template</strong></li>
                                <li>Select the correct filters that match your student data</li>
                                <li>Download a new template with the correct context</li>
                                <li>Fill your student data in the new template</li>
                                <li>Try importing again</li>
                            </ol>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error importing initial database:', error);
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <h3>❌ Import Failed</h3>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        fileInput.value = '';
    }
}

// ========================================
// TAB 2: IMPORT PHOTOS
// ========================================

async function importPhotos() {
    const fileInput = document.getElementById('photos-file-input');
    const file = fileInput.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const resultDiv = document.getElementById('photos-import-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Importing photos...</p></div>';
    resultDiv.classList.remove('hidden');

    try {
        const response = await fetch('/api/student-management/import-photos/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            let errorsHtml = '';
            if (result.data.errors && result.data.errors.length > 0) {
                errorsHtml = '<div style="margin-top: 10px;"><strong>Errors:</strong><ul style="margin: 5px 0; padding-left: 20px;">';
                result.data.errors.slice(0, 10).forEach(err => {
                    errorsHtml += `<li>${err.filename}: ${err.error}</li>`;
                });
                if (result.data.errors.length > 10) {
                    errorsHtml += `<li>...and ${result.data.errors.length - 10} more errors</li>`;
                }
                errorsHtml += '</ul></div>';
            }
            
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h3>✅ Photo Import Successful</h3>
                    <p><strong>Uploaded:</strong> ${result.data.uploaded} photos</p>
                    <p><strong>Failed:</strong> ${result.data.failed} photos</p>
                    ${errorsHtml}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-error">
                    <h3>❌ Photo Import Failed</h3>
                    <p>${result.message}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error importing photos:', error);
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <h3>❌ Photo Import Failed</h3>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        fileInput.value = '';
    }
}

// ========================================
// TAB 3: STUDENT MANAGEMENT (FIXED)
// ========================================

async function applyFilters() {
    const programmeId = document.getElementById('view-programme').value;
    const branchId = document.getElementById('view-branch').value;
    const batchId = document.getElementById('view-batch').value;
    const semesterId = document.getElementById('view-semester').value;
    const status = document.getElementById('view-status').value;

    if (!programmeId && !branchId && !batchId && !semesterId && !status) {
        showAlert('Please select at least one filter', 'error');
        return;
    }

    const params = new URLSearchParams();
    if (programmeId) params.append('programme_id', programmeId);
    if (branchId) params.append('branch_id', branchId);
    if (batchId) params.append('batch_id', batchId);
    if (semesterId) params.append('semester_id', semesterId);
    if (status) params.append('student_status', status);

    const listDiv = document.getElementById('student-list');
    listDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading students...</p></div>';

    try {
        const response = await fetch(`/api/student-management/students?${params}`);
        const result = await response.json();

        if (response.ok) {
            allStudents = result.data.students;
            displayStudents(result.data.students);
            displayStatistics(result.data.statistics);
        } else {
            listDiv.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error fetching students:', error);
        listDiv.innerHTML = `<div class="alert alert-error">Failed to load students</div>`;
    }
}

function displayStudents(students) {
    const listDiv = document.getElementById('student-list');
    
    if (students.length === 0) {
        listDiv.innerHTML = '<div class="alert alert-info">No students found with selected filters</div>';
        return;
    }

    let html = `
        <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Photo</th>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Programme</th>
                    <th>Branch</th>
                    <th>Batch</th>
                    <th>Semester</th>
                    <th>Regulation</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach(s => {
        const photoHtml = s.photo_url 
            ? `<img src="${s.photo_url}" alt="${s.full_name}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">`
            : '<div style="width: 35px; height: 35px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px;">👤</div>';
        
        html += `
            <tr>
                <td>${photoHtml}</td>
                <td><a href="javascript:void(0)" onclick="openStudentEditModal('${s.student_id}')" class="roll-link">${s.roll_number || '-'}</a></td>
                <td>${s.full_name}</td>
                <td>${s.programme_code || '-'}</td>
                <td>${s.branch_code || '-'}</td>
                <td>${s.batch_name || '-'}</td>
                <td>${s.semester_id || '-'}</td>
                <td>${s.regulation_name || '-'}</td>
                <td><span style="padding: 4px 8px; border-radius: 4px; background: ${getStatusColor(s.student_status)}; color: white; font-size: 11px;">${s.student_status}</span></td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    listDiv.innerHTML = html;
}

function displayStatistics(stats) {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-boys').textContent = stats.boys;
    document.getElementById('stat-girls').textContent = stats.girls;
    document.getElementById('stat-on-roll').textContent = stats.on_roll;
    document.getElementById('stat-detained').textContent = stats.detained;
    document.getElementById('student-stats').classList.remove('hidden');
}

function getStatusColor(status) {
    switch(status) {
        case 'In Roll': return '#28a745';
        case 'Detained': return '#ffc107';
        case 'Left': return '#dc3545';
        default: return '#6c757d';
    }
}

// ========================================
// STUDENT EDIT MODAL (COMPLETE FIX!)
// ========================================

async function openStudentEditModal(studentId) {
    try {
        const response = await fetch(`/api/students/${studentId}`);
        const result = await response.json();
        
        if (!response.ok) {
            showAlert('Failed to load student details', 'error');
            return;
        }
        
        const student = result.data;
        currentEditingStudent = student;
        
        // FIX: Load all dropdowns first
        await loadMasterData('edit');
        
        // Populate form fields
        document.getElementById('edit-admission-number').value = student.admission_number || '';
        document.getElementById('edit-ht-number').value = student.ht_number || '';
        document.getElementById('edit-roll-number').value = student.roll_number || '';
        document.getElementById('edit-full-name').value = student.full_name || '';
        
        // FIX: Convert ISO date to yyyy-MM-dd
        document.getElementById('edit-dob').value = formatDateForInput(student.date_of_birth);
        
        document.getElementById('edit-gender').value = student.gender || '';
        document.getElementById('edit-father-name').value = student.father_name || '';
        document.getElementById('edit-mother-name').value = student.mother_name || '';
        document.getElementById('edit-aadhaar').value = student.aadhaar_number || '';
        document.getElementById('edit-caste').value = student.caste_category || '';
        document.getElementById('edit-student-mobile').value = student.student_mobile || '';
        document.getElementById('edit-parent-mobile').value = student.parent_mobile || '';
        document.getElementById('edit-email').value = student.email || '';
        
        // Set dropdowns
        document.getElementById('edit-programme').value = student.programme_id || '';
        document.getElementById('edit-batch').value = student.batch_id || '';
        document.getElementById('edit-semester').value = student.semester_id || '';
        document.getElementById('edit-section').value = student.section_id || '';
        document.getElementById('edit-student-status').value = student.student_status || 'In Roll';
        
        // FIX: Load branches for selected programme
        if (student.programme_id) {
            await loadBranchesForEdit(student.programme_id);
            document.getElementById('edit-branch').value = student.branch_id || '';
        }
        
        // Show modal
        document.getElementById('student-edit-modal').style.display = 'block';
        
    } catch (error) {
        console.error('Error opening student edit modal:', error);
        showAlert('Failed to open student details', 'error');
    }
}

async function loadBranchesForEdit(programmeId) {
    try {
        const response = await fetch(`/api/branches?programme_id=${programmeId}`);
        const data = await response.json();
        const branches = data.data || data;
        
        const branchSelect = document.getElementById('edit-branch');
        branchSelect.innerHTML = '<option value="">Select Branch</option>';
        branches.forEach(b => {
            branchSelect.innerHTML += `<option value="${b.branch_id}">${b.branch_name} (${b.branch_code})</option>`;
        });
    } catch (error) {
        console.error('Error loading branches for edit:', error);
    }
}

function closeStudentEditModal() {
    document.getElementById('student-edit-modal').style.display = 'none';
    currentEditingStudent = null;
}

async function saveStudentChanges() {
    if (!currentEditingStudent) return;
    
    const studentId = currentEditingStudent.student_id;
    
    // FIX: Collect ALL required data
    const updatedData = {
        admission_number: document.getElementById('edit-admission-number').value,  // FIX: Added admission_number
        ht_number: document.getElementById('edit-ht-number').value,
        roll_number: document.getElementById('edit-roll-number').value,
        full_name: document.getElementById('edit-full-name').value,
        date_of_birth: document.getElementById('edit-dob').value,  // Already in yyyy-MM-dd format
        gender: document.getElementById('edit-gender').value,
        father_name: document.getElementById('edit-father-name').value,
        mother_name: document.getElementById('edit-mother-name').value,
        aadhaar_number: document.getElementById('edit-aadhaar').value,
        caste_category: document.getElementById('edit-caste').value,
        student_mobile: document.getElementById('edit-student-mobile').value,
        parent_mobile: document.getElementById('edit-parent-mobile').value,
        email: document.getElementById('edit-email').value,
        programme_id: document.getElementById('edit-programme').value,
        branch_id: document.getElementById('edit-branch').value,
        batch_id: document.getElementById('edit-batch').value,
        semester_id: document.getElementById('edit-semester').value,
        section_id: document.getElementById('edit-section').value,
        student_status: document.getElementById('edit-student-status').value
    };
    
    try {
        // Update student
        const response = await fetch(`/api/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update student');
        }
        
        showAlert('Student updated successfully!', 'success');
        closeStudentEditModal();
        applyFilters();
        
    } catch (error) {
        console.error('Error saving student changes:', error);
        showAlert('Failed to save changes: ' + error.message, 'error');
    }
}

// ========================================
// TAB 4: MAPPING (BRANCH FILTER FIXED)
// ========================================

async function loadMappingStudents() {
    const programmeId = document.getElementById('mapping-programme').value;
    const batchId = document.getElementById('mapping-batch').value;
    const branchId = document.getElementById('mapping-branch')?.value;
    const semesterId = document.getElementById('mapping-semester').value;
    const status = document.getElementById('mapping-status').value;

    if (!programmeId || !batchId || !semesterId) {
        return;
    }

    const params = new URLSearchParams();
    params.append('programme_id', programmeId);
    params.append('batch_id', batchId);
    if (branchId) params.append('branch_id', branchId);  // FIX: Include branch
    params.append('semester_id', semesterId);
    if (status) params.append('student_status', status);

    const gridDiv = document.getElementById('student-selection-grid');
    gridDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const response = await fetch(`/api/student-management/mapping/students?${params}`);
        const result = await response.json();

        if (response.ok) {
            displayMappingStudents(result.data.students);
            loadSemesterView();
        } else {
            gridDiv.innerHTML = `<p style="color: red;">${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error loading mapping students:', error);
        gridDiv.innerHTML = '<p style="color: red;">Failed to load students</p>';
    }
}

function displayMappingStudents(students) {
    const gridDiv = document.getElementById('student-selection-grid');
    
    if (students.length === 0) {
        gridDiv.innerHTML = '<p>No students found for selected filters</p>';
        return;
    }

    let html = '';
    students.forEach(s => {
        html += `
            <div class="student-checkbox">
                <input type="checkbox" id="student-${s.student_id}" value="${s.student_id}">
                <label for="student-${s.student_id}" title="${s.full_name || ''}">${s.roll_number}</label>
            </div>
        `;
    });

    gridDiv.innerHTML = html;
}

function toggleSelectAll() {
    const selectAll = document.getElementById('select-all-students').checked;
    document.querySelectorAll('#student-selection-grid input[type="checkbox"]').forEach(cb => {
        cb.checked = selectAll;
    });
}

async function applyMapping() {
    const selectedStudents = Array.from(
        document.querySelectorAll('#student-selection-grid input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    if (selectedStudents.length === 0) {
        showAlert('Please select at least one student', 'error');
        return;
    }

    const batchId = document.getElementById('update-batch').value;
    const regulationId = document.getElementById('update-regulation').value;
    const semesterNumber = document.getElementById('mapping-semester').value;

    if (!batchId && !regulationId) {
        showAlert('Please select either Batch or Regulation to update', 'error');
        return;
    }

    const resultDiv = document.getElementById('mapping-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    resultDiv.classList.remove('hidden');

    try {
        const response = await fetch('/api/student-management/mapping/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_ids: selectedStudents,
                batch_id: batchId || null,
                regulation_id: regulationId || null,
                semester_id: semesterNumber
            })
        });

        const result = await response.json();

        if (response.ok) {
            resultDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            setTimeout(() => {
                loadMappingStudents();
                resultDiv.classList.add('hidden');
            }, 2000);
        } else {
            resultDiv.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error applying mapping:', error);
        resultDiv.innerHTML = `<div class="alert alert-error">Failed to update mapping</div>`;
    }
}

async function loadSemesterView() {
    const programmeId = document.getElementById('mapping-programme').value;
    const batchId = document.getElementById('mapping-batch').value;
    const branchId = document.getElementById('mapping-branch')?.value;

    if (!programmeId || !batchId) return;

    const params = new URLSearchParams();
    params.append('programme_id', programmeId);
    params.append('batch_id', batchId);
    if (branchId) params.append('branch_id', branchId);  // FIX: Include branch

    try {
        const response = await fetch(`/api/student-management/mapping/semester-view?${params}`);
        const result = await response.json();

        if (response.ok) {
            displaySemesterView(result.data.mappings);
        }
    } catch (error) {
        console.error('Error loading semester view:', error);
    }
}

function displaySemesterView(mappings) {
    const tableDiv = document.getElementById('semester-view-table');
    
    if (Object.keys(mappings).length === 0) {
        tableDiv.innerHTML = '<p>No data available</p>';
        return;
    }

    let html = `
        <div style="max-height: 400px; overflow: auto;">
        <table class="semester-table" style="font-size: 11px;">
            <thead>
                <tr style="position: sticky; top: 0; z-index: 10;">
                    <th style="min-width: 100px;">Roll No</th>
                    <th>I</th>
                    <th>II</th>
                    <th>III</th>
                    <th>IV</th>
                    <th>V</th>
                    <th>VI</th>
                    <th>VII</th>
                    <th>VIII</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.keys(mappings).forEach(rollNo => {
        html += `<tr><td><strong>${rollNo}</strong></td>`;
        for (let i = 1; i <= 8; i++) {
            const value = mappings[rollNo][`sem_${i}`] || '-';
            html += `<td style="font-size: 10px;">${value}</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// ========================================
// TAB 5: PROMOTIONS (ERROR FIX)
// ========================================

async function loadPromotionStats() {
    const programmeId = document.getElementById('promote-from-programme').value;
    const batchId = document.getElementById('promote-from-batch').value;
    const branchId = document.getElementById('promote-from-branch').value;
    const semesterNumber = document.getElementById('promote-from-semester').value;

    if (!programmeId || !batchId || !branchId || !semesterNumber) {
        return;
    }

    const params = new URLSearchParams();
    params.append('programme_id', programmeId);
    params.append('batch_id', batchId);
    params.append('branch_id', branchId);
    params.append('semester_number', semesterNumber);

    try {
        const response = await fetch(`/api/student-management/promotions/stats?${params}`);
        const result = await response.json();

        if (response.ok) {
            const stats = result.data;
            document.getElementById('promo-total').textContent = stats.total || 0;
            document.getElementById('promo-on-roll').textContent = stats.on_roll || 0;
            document.getElementById('promo-detained').textContent = stats.detained || 0;
            document.getElementById('promo-left').textContent = stats.left_out || 0;
            document.getElementById('promotion-stats').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading promotion stats:', error);
    }
}

async function performPromotion() {
    const fromProgrammeId = document.getElementById('promote-from-programme').value;
    const fromBatchId = document.getElementById('promote-from-batch').value;
    const fromBranchId = document.getElementById('promote-from-branch').value;
    const fromSemester = document.getElementById('promote-from-semester').value;
    const toYear = document.getElementById('promote-to-year').value;
    const toSemester = document.getElementById('promote-to-semester').value;
    const toBatchId = document.getElementById('promote-to-batch').value;
    const toRegulationId = document.getElementById('promote-to-regulation').value;

    if (!fromProgrammeId || !fromBatchId || !fromBranchId || !fromSemester || !toYear || !toSemester) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    const resultDiv = document.getElementById('promotion-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading promotion summary...</p></div>';
    resultDiv.classList.remove('hidden');

    try {
        // First, get the students that will be promoted
        console.log('=== PROMOTION SUMMARY REQUEST ===');
        console.log('Sending data:', {
            programme_id: fromProgrammeId,
            batch_id: fromBatchId,
            branch_id: fromBranchId,
            semester_id: fromSemester
        });
        
        const summaryResponse = await fetch('/api/student-management/promotions/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                programme_id: fromProgrammeId,
                batch_id: fromBatchId,
                branch_id: fromBranchId,
                semester_id: fromSemester
            })
        });

        console.log('Response status:', summaryResponse.status);
        console.log('Response ok:', summaryResponse.ok);

        if (summaryResponse.ok) {
            const summary = await summaryResponse.json();
            
            // Display pre-promotion summary
            resultDiv.innerHTML = `
                <div class="alert alert-info" style="background: #e3f2fd; border: 1px solid #007bff; color: #004085;">
                    <h3>📋 Promotion Summary - Ready to Promote</h3>
                    <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                        <h4>Students to be Promoted:</h4>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;">
                            <div><strong>Total Students:</strong> ${summary.total_students}</div>
                            <div><strong>In Roll:</strong> <span style="color: #28a745;">${summary.in_roll}</span></div>
                            <div><strong>Detained:</strong> <span style="color: #ffc107;">${summary.detained}</span></div>
                            <div><strong>Left:</strong> <span style="color: #dc3545;">${summary.left}</span></div>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                            <strong>From:</strong> Semester ${fromSemester} → <strong>To:</strong> Semester ${toSemester}
                        </div>
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-success" onclick="confirmPromotion()" style="font-size: 16px; padding: 12px 24px;">
                            🚀 Confirm Promotion
                        </button>
                        <button class="btn" style="background: #6c757d; color: white; margin-left: 10px;" onclick="cancelPromotion()">
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            `;
            
            // Store promotion data for confirmation
            window.pendingPromotion = {
                fromProgrammeId, fromBatchId, fromBranchId, fromSemester,
                toYear, toSemester, toBatchId, toRegulationId
            };
        } else {
            throw new Error('Failed to load promotion summary');
        }
    } catch (error) {
        console.error('Error loading promotion summary:', error);
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <h3>❌ Error</h3>
                <p>Failed to load promotion summary: ${error.message}</p>
            </div>
        `;
    }
}

async function confirmPromotion() {
    if (!window.pendingPromotion) return;
    
    const resultDiv = document.getElementById('promotion-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Promoting students...</p></div>';

    try {
        const promotionData = {
            from_programme_id: window.pendingPromotion.fromProgrammeId,
            from_batch_id: window.pendingPromotion.fromBatchId,
            from_branch_id: window.pendingPromotion.fromBranchId,
            from_semester_id: window.pendingPromotion.fromSemester,
            to_programme_id: window.pendingPromotion.fromProgrammeId,
            to_batch_id: window.pendingPromotion.toBatchId || window.pendingPromotion.fromBatchId,
            to_branch_id: window.pendingPromotion.fromBranchId,
            to_semester_id: window.pendingPromotion.toSemester,
            to_regulation_id: window.pendingPromotion.toRegulationId,
            academic_year: window.pendingPromotion.toYear
        };
        
        console.log('Sending promotion data:', promotionData);
        
        const response = await fetch('/api/student-management/promotions/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promotionData)
        });

        const result = await response.json();

        if (response.ok) {
            const data = result.data;
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h3>✅ Promotion Completed Successfully</h3>
                    <p><strong>${result.message}</strong></p>
                    <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <h4>📊 Final Promotion Summary:</h4>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;">
                            <div><strong>Total Students:</strong> ${data.total_students}</div>
                            <div><strong>Promoted:</strong> <span style="color: #28a745;">${data.promoted}</span></div>
                            <div><strong>Skipped:</strong> <span style="color: #ffc107;">${data.skipped}</span></div>
                            <div><strong>To Semester:</strong> ${window.pendingPromotion.toSemester}</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Clear pending promotion data
            delete window.pendingPromotion;
            
            setTimeout(() => {
                loadPromotionStats();
            }, 2000);
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-error">
                    <h3>❌ Promotion Failed</h3>
                    <p>${result.message}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error performing promotion:', error);
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <h3>❌ Promotion Failed</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function cancelPromotion() {
    const resultDiv = document.getElementById('promotion-result');
    resultDiv.innerHTML = '<p style="color: #666;">Promotion cancelled. Please modify settings and try again.</p>';
    delete window.pendingPromotion;
}

// ========================================
// TAB 6: ELECTIVE MAPPING (NEW!)
// ========================================

function clearElectiveBoxes() {
    document.getElementById('available-students-box').innerHTML = '<p>Select filters and elective subject</p>';
    document.getElementById('mapped-students-box').innerHTML = '<p>Select elective subject</p>';
    document.getElementById('available-count').textContent = '0';
    document.getElementById('available-selected-count').textContent = '0';
    document.getElementById('mapped-count').textContent = '0';
    document.getElementById('mapped-selected-count').textContent = '0';
    availableStudents = [];
    mappedStudents = [];
}

async function loadElectiveSubjects() {
    const programmeId = document.getElementById('elective-programme').value;
    const branchId = document.getElementById('elective-branch').value;
    const semesterNumber = document.getElementById('elective-semester').value;
    const regulationId = document.getElementById('elective-regulation').value;
    
    console.log('Loading elective subjects with filters:', {
        programme_id: programmeId,
        branch_id: branchId,
        semester_id: semesterNumber,
        regulation_id: regulationId
    });
    
    try {
        // Load group-wise electives with all filters
        const response = await fetch(`/api/elective-mapping/group-wise-subjects?programme_id=${programmeId || ''}&branch_id=${branchId || ''}&semester_id=${semesterNumber || ''}&regulation_id=${regulationId || ''}`);
        const result = await response.json();
        
        if (response.ok) {
            displayGroupWiseElectives(result.data.groups);
            console.log('Loaded elective subjects with filters:', {
                programme_id: programmeId,
                branch_id: branchId,
                semester_id: semesterNumber,
                regulation_id: regulationId,
                total_subjects: result.total_subjects
            });
        } else {
            console.error('Failed to load elective subjects:', result);
        }
    } catch (error) {
        console.error('Error loading elective subjects:', error);
    }
}

// Display electives grouped by category
function displayGroupWiseElectives(groups) {
    const subjectSelect = document.getElementById('elective-subject');
    subjectSelect.innerHTML = '<option value="">Select Elective Subject</option>';
    
    // Display groups in organized manner
    Object.keys(groups).sort((a, b) => {
        return groups[a].order - groups[b].order;
    }).forEach(groupName => {
        const group = groups[groupName];
        
        // Add group label
        const groupOption = document.createElement('option');
        groupOption.value = '';
        groupOption.disabled = true;
        groupOption.textContent = `--- ${groupName} ---`;
        groupOption.style.fontWeight = 'bold';
        groupOption.style.color = '#667eea';
        subjectSelect.appendChild(groupOption);
        
        // Add subjects under this group
        group.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.subject_id;
            option.textContent = `  ${subject.syllabus_code} - ${subject.subject_name}`;
            subjectSelect.appendChild(option);
        });
    });
}

async function showElectiveStudents() {
    const programmeId = document.getElementById('elective-programme').value;
    const batchId = document.getElementById('elective-batch').value;
    const branchId = document.getElementById('elective-branch').value;
    const semesterNumber = document.getElementById('elective-semester').value;
    const subjectId = document.getElementById('elective-subject').value;
    
    if (!programmeId || !batchId || !branchId || !semesterNumber || !subjectId) {
        showAlert('Please select all fields including elective subject', 'error');
        return;
    }
    
    // Show group context
    showGroupContext(subjectId);
    
    // Load both boxes
    await loadAvailableStudents();
    await loadMappedStudents();
}

// Show which group the selected elective belongs to
function showGroupContext(subjectId) {
    const subjectSelect = document.getElementById('elective-subject');
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const subjectText = selectedOption.textContent;
    
    // Extract group from subject text
    let groupName = '';
    if (subjectText.includes('Open Elective-1') || subjectText.includes('Professional Elective-1')) {
        groupName = 'Group 2';
    } else if (subjectText.includes('Open Elective-2') || subjectText.includes('Professional Elective-2')) {
        groupName = 'Group 3';
    } else if (subjectText.includes('Open Elective-3') || subjectText.includes('Professional Elective-3')) {
        groupName = 'Group 4';
    } else if (subjectText.includes('Open Elective-4') || subjectText.includes('Professional Elective-4')) {
        groupName = 'Group 5';
    } else if (subjectText.includes('Open Elective') || subjectText.includes('Professional Elective')) {
        groupName = 'Group 1';
    }
    
    // Display group context
    const contextDiv = document.getElementById('elective-group-context');
    if (contextDiv) {
        contextDiv.innerHTML = `<strong>📚 Current Group: ${groupName}</strong>`;
        contextDiv.style.display = 'block';
    }
}

async function loadAvailableStudents() {
    const programmeId = document.getElementById('elective-programme').value;
    const batchId = document.getElementById('elective-batch').value;
    const branchId = document.getElementById('elective-branch').value;
    const semesterNumber = document.getElementById('elective-semester').value;
    const regulationId = document.getElementById('elective-regulation').value;
    const subjectId = document.getElementById('elective-subject').value;
    const academicYear = document.getElementById('elective-academic-year').value || '2025-2026';
    
    // Get group category from selected subject
    const subjectSelect = document.getElementById('elective-subject');
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const electiveName = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || '';
    
    // Determine group category based on elective name
    let groupCategory = 'Other Groups';
    if (electiveName === 'Open Elective') groupCategory = 'Group 1';
    else if (electiveName === 'Open Elective-1') groupCategory = 'Group 2';
    else if (electiveName === 'Open Elective-2') groupCategory = 'Group 3';
    else if (electiveName === 'Open Elective-3') groupCategory = 'Group 4';
    else if (electiveName === 'Open Elective-4') groupCategory = 'Group 5';
    else if (electiveName === 'Professional Elective') groupCategory = 'Group 6';
    else if (electiveName === 'Professional Elective-1') groupCategory = 'Group 7';
    else if (electiveName === 'Professional Elective-2') groupCategory = 'Group 8';
    else if (electiveName === 'Professional Elective-3') groupCategory = 'Group 9';
    else if (electiveName === 'Professional Elective-4') groupCategory = 'Group 10';
    
    console.log('Loading available students for group:', groupCategory, 'Elective:', electiveName);
    
    const params = new URLSearchParams({
        programme_id: programmeId,
        batch_id: batchId,
        branch_id: branchId,
        semester_id: semesterNumber,
        regulation_id: regulationId,
        academic_year: academicYear,
        group_category: groupCategory,
        subject_id: subjectId
    });
    
    try {
        // Clear existing data
        availableStudents = [];
        document.getElementById('available-students-box').innerHTML = '';
        
        // Use existing API endpoints
        const response = await fetch(`/api/elective-mapping/available-students?${params}`);
        const result = await response.json();
        
        if (response.ok) {
            availableStudents = result.data.students;
            displayAvailableStudents(result.data.students);
            document.getElementById('available-count').textContent = result.data.total;
            
            // Show group context
            showGroupContext(groupCategory);
            
            console.log(`Loaded ${result.data.total} available students for ${groupCategory} (${electiveName})`);
        } else {
            throw new Error(result.message || 'Failed to load available students');
        }
    } catch (error) {
        console.error('Error loading available students:', error);
        showAlert('Failed to load available students: ' + error.message, 'error');
    }
}

async function loadMappedStudents() {
    const programmeId = document.getElementById('elective-programme').value;
    const batchId = document.getElementById('elective-batch').value;
    const branchId = document.getElementById('elective-branch').value;
    const semesterNumber = document.getElementById('elective-semester').value;
    const regulationId = document.getElementById('elective-regulation').value;
    const subjectId = document.getElementById('elective-subject').value;
    const academicYear = document.getElementById('elective-academic-year').value || '2025-2026';
    
    // Get group category from selected subject
    const subjectSelect = document.getElementById('elective-subject');
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const electiveName = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || '';
    
    // Determine group category based on elective name
    let groupCategory = 'Other Groups';
    if (electiveName === 'Open Elective') groupCategory = 'Group 1';
    else if (electiveName === 'Open Elective-1') groupCategory = 'Group 2';
    else if (electiveName === 'Open Elective-2') groupCategory = 'Group 3';
    else if (electiveName === 'Open Elective-3') groupCategory = 'Group 4';
    else if (electiveName === 'Open Elective-4') groupCategory = 'Group 5';
    else if (electiveName === 'Professional Elective') groupCategory = 'Group 6';
    else if (electiveName === 'Professional Elective-1') groupCategory = 'Group 7';
    else if (electiveName === 'Professional Elective-2') groupCategory = 'Group 8';
    else if (electiveName === 'Professional Elective-3') groupCategory = 'Group 9';
    else if (electiveName === 'Professional Elective-4') groupCategory = 'Group 10';
    
    console.log('Loading mapped students for group:', groupCategory, 'Elective:', electiveName);
    
    const params = new URLSearchParams({
        programme_id: programmeId,
        batch_id: batchId,
        branch_id: branchId,
        semester_id: semesterNumber,
        regulation_id: regulationId,
        academic_year: academicYear,
        group_category: groupCategory,
        subject_id: subjectId
    });
    
    try {
        // Clear existing data
        mappedStudents = [];
        document.getElementById('mapped-students-box').innerHTML = '';
        
        // Use existing API endpoints
        const response = await fetch(`/api/elective-mapping/mapped-students?${params}`);
        const result = await response.json();
        
        if (response.ok) {
            mappedStudents = result.data.students;
            displayMappedStudents(result.data.students);
            document.getElementById('mapped-count').textContent = result.data.total;
            
            console.log(`Loaded ${result.data.total} mapped students for ${groupCategory} (${electiveName})`);
        } else {
            throw new Error(result.message || 'Failed to load mapped students');
        }
    } catch (error) {
        console.error('Error loading mapped students:', error);
        showAlert('Failed to load mapped students: ' + error.message, 'error');
    }
}

function displayAvailableStudents(students) {
    const box = document.getElementById('available-students-box');
    
    if (students.length === 0) {
        box.innerHTML = '<p>No students available (all already mapped)</p>';
        return;
    }
    
    let html = '';
    students.forEach((s, index) => {
        html += `
            <div class="elective-student-item">
                <span class="student-number">${index + 1}.</span>
                <input type="checkbox" id="avail-${s.student_id}" value="${s.student_id}" onchange="updateAvailableSelectedCount()">
                <label for="avail-${s.student_id}">${s.roll_number} - ${s.full_name}</label>
            </div>
        `;
    });
    
    box.innerHTML = html;
}

function displayMappedStudents(students) {
    const box = document.getElementById('mapped-students-box');
    
    if (students.length === 0) {
        box.innerHTML = '<p>No students mapped yet</p>';
        return;
    }
    
    let html = '';
    students.forEach((s, index) => {
        const electiveBadge = s.elective_name ? `<span class="elective-badge">${s.elective_name}</span>` : '';
        html += `
            <div class="elective-student-item">
                <span class="student-number">${index + 1}.</span>
                <input type="checkbox" id="mapped-${s.student_id}" value="${s.student_id}" onchange="updateMappedSelectedCount()">
                <label for="mapped-${s.student_id}">${s.roll_number} - ${s.full_name} ${electiveBadge}</label>
            </div>
        `;
    });
    
    box.innerHTML = html;
}

function toggleSelectAllAvailable() {
    const selectAll = document.getElementById('select-all-available').checked;
    document.querySelectorAll('#available-students-box input[type="checkbox"]').forEach(cb => {
        cb.checked = selectAll;
    });
    updateAvailableSelectedCount();
}

function toggleSelectAllMapped() {
    const selectAll = document.getElementById('select-all-mapped').checked;
    document.querySelectorAll('#mapped-students-box input[type="checkbox"]').forEach(cb => {
        cb.checked = selectAll;
    });
    updateMappedSelectedCount();
}

function updateAvailableSelectedCount() {
    const count = document.querySelectorAll('#available-students-box input[type="checkbox"]:checked').length;
    document.getElementById('available-selected-count').textContent = count;
}

function updateMappedSelectedCount() {
    const count = document.querySelectorAll('#mapped-students-box input[type="checkbox"]:checked').length;
    document.getElementById('mapped-selected-count').textContent = count;
}

async function addStudentsToElective() {
    console.log('🔹 ADD button clicked');
    
    const selectedIds = Array.from(
        document.querySelectorAll('#available-students-box input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    console.log('Selected IDs for ADD:', selectedIds);
    
    if (selectedIds.length === 0) {
        showAlert('Please select students to add', 'error');
        return;
    }
    
    // Add to pending additions
    selectedIds.forEach(id => {
        pendingAdditions.add(id);
        pendingRemovals.delete(id); // Remove from pending removals if it was there
    });
    
    console.log('Pending additions:', Array.from(pendingAdditions));
    
    // Move students visually between boxes IMMEDIATELY
    await moveStudentsBetweenBoxes(selectedIds, 'available', 'mapped');
    
    // Show small non-blocking notification
    console.log(`✅ Added ${selectedIds.length} students to mapping (not yet saved)`);
    
    // Create visual notification
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #28a745;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
    `;
    statusDiv.textContent = `Added ${selectedIds.length} students`;
    document.body.appendChild(statusDiv);
    
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.parentNode.removeChild(statusDiv);
        }
    }, 2000);
}

async function removeStudentsFromElective() {
    console.log('🔸 REMOVE button clicked');
    
    const selectedIds = Array.from(
        document.querySelectorAll('#mapped-students-box input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    console.log('Selected IDs for REMOVE:', selectedIds);
    
    if (selectedIds.length === 0) {
        showAlert('Please select students to remove', 'error');
        return;
    }
    
    // Add to pending removals
    selectedIds.forEach(id => {
        pendingRemovals.add(id);
        pendingAdditions.delete(id); // Remove from pending additions if it was there
    });
    
    console.log('Pending removals:', Array.from(pendingRemovals));
    
    // Move students visually between boxes IMMEDIATELY
    await moveStudentsBetweenBoxes(selectedIds, 'mapped', 'available');
    
    // Show small non-blocking notification
    console.log(`✅ Removed ${selectedIds.length} students from mapping (not yet saved)`);
    
    // Create visual notification
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #dc3545;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
    `;
    statusDiv.textContent = `Removed ${selectedIds.length} students`;
    document.body.appendChild(statusDiv);
    
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.parentNode.removeChild(statusDiv);
        }
    }, 2000);
}

// Move students visually between boxes
async function moveStudentsBetweenBoxes(studentIds, fromBox, toBox) {
    console.log(`🔄 Moving ${studentIds.length} students from ${fromBox} to ${toBox}`);
    
    const fromElement = document.getElementById(`${fromBox}-students-box`);
    const toElement = document.getElementById(`${toBox}-students-box`);
    
    if (!fromElement || !toElement) {
        console.error('❌ Box elements not found:', { fromElement, toElement });
        return;
    }
    
    let movedCount = 0;
    studentIds.forEach(id => {
        // Try both possible checkbox IDs (avail- and mapped-)
        const studentElement = fromElement.querySelector(`input[value="${id}"]`)?.closest('.elective-student-item');
        if (studentElement) {
            toElement.appendChild(studentElement);
            // Uncheck the checkbox after moving
            const checkbox = studentElement.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
            movedCount++;
        } else {
            console.warn(`⚠️ Student element not found for ID: ${id}`);
        }
    });
    
    console.log(`✅ Successfully moved ${movedCount}/${studentIds.length} students`);
    
    // Update counts
    updateStudentCounts();
}

// Update student counts in both boxes
function updateStudentCounts() {
    const availableCount = document.querySelectorAll('#available-students-box .student-checkbox-item').length;
    const mappedCount = document.querySelectorAll('#mapped-students-box .student-checkbox-item').length;
    
    document.getElementById('available-count').textContent = availableCount;
    document.getElementById('mapped-count').textContent = mappedCount;
}

// Save elective mapping changes to database
async function saveElectiveMapping() {
    if (pendingAdditions.size === 0 && pendingRemovals.size === 0) {
        showAlert('No changes to save', 'info');
        return;
    }
    
    const programmeId = document.getElementById('elective-programme').value;
    const batchId = document.getElementById('elective-batch').value;
    const branchId = document.getElementById('elective-branch').value;
    const semesterNumber = document.getElementById('elective-semester').value;
    const regulationId = document.getElementById('elective-regulation').value;
    const subjectId = document.getElementById('elective-subject').value;
    const academicYear = document.getElementById('elective-academic-year').value;
    
    // Get group category from selected subject
    const subjectSelect = document.getElementById('elective-subject');
    const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
    const electiveName = selectedOption.textContent.match(/\(([^)]+)\)/)?.[1] || '';
    
    // Determine group category based on elective name
    let groupCategory = 'Other Groups';
    let groupOrder = 11;
    if (electiveName === 'Open Elective') { groupCategory = 'Group 1'; groupOrder = 1; }
    else if (electiveName === 'Open Elective-1') { groupCategory = 'Group 2'; groupOrder = 2; }
    else if (electiveName === 'Open Elective-2') { groupCategory = 'Group 3'; groupOrder = 3; }
    else if (electiveName === 'Open Elective-3') { groupCategory = 'Group 4'; groupOrder = 4; }
    else if (electiveName === 'Open Elective-4') { groupCategory = 'Group 5'; groupOrder = 5; }
    else if (electiveName === 'Professional Elective') { groupCategory = 'Group 6'; groupOrder = 6; }
    else if (electiveName === 'Professional Elective-1') { groupCategory = 'Group 7'; groupOrder = 7; }
    else if (electiveName === 'Professional Elective-2') { groupCategory = 'Group 8'; groupOrder = 8; }
    else if (electiveName === 'Professional Elective-3') { groupCategory = 'Group 9'; groupOrder = 9; }
    else if (electiveName === 'Professional Elective-4') { groupCategory = 'Group 10'; groupOrder = 10; }
    
    try {
        let totalAdded = 0;
        let totalRemoved = 0;
        
        // Process additions first
        if (pendingAdditions.size > 0) {
            console.log(`Processing ${pendingAdditions.size} additions`);
            const addResponse = await fetch('/api/elective-mapping/add-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_ids: Array.from(pendingAdditions),
                    programme_id: programmeId,
                    batch_id: batchId,
                    branch_id: branchId,
                    semester_id: semesterNumber,
                    subject_id: subjectId,
                    academic_year: academicYear
                })
            });
            
            const addResult = await addResponse.json();
            if (addResponse.ok) {
                totalAdded = addResult.data.added;
                console.log(`Added ${totalAdded} students to ${electiveName}`);
            } else {
                throw new Error(addResult.message || 'Failed to add students');
            }
        }
        
        // Process removals
        if (pendingRemovals.size > 0) {
            console.log(`Processing ${pendingRemovals.size} removals`);
            const removeResponse = await fetch('/api/elective-mapping/remove-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_ids: Array.from(pendingRemovals),
                    programme_id: programmeId,
                    batch_id: batchId,
                    branch_id: branchId,
                    semester_id: semesterNumber,
                    subject_id: subjectId,
                    academic_year: academicYear
                })
            });
            
            const removeResult = await removeResponse.json();
            if (removeResponse.ok) {
                totalRemoved = removeResult.data.removed;
                console.log(`Removed ${totalRemoved} students from ${electiveName}`);
            } else {
                throw new Error(removeResult.message || 'Failed to remove students');
            }
        }
        
        if (totalAdded > 0 || totalRemoved > 0) {
            showAlert(`Successfully saved changes: +${totalAdded} students added, -${totalRemoved} students removed`, 'success');
            pendingAdditions.clear();
            pendingRemovals.clear();
            
            // Reload both available and mapped students
            await loadAvailableStudents();
            await loadMappedStudents();
        } else {
            showAlert('No changes were saved', 'warning');
        }
        
    } catch (error) {
        console.error('Error saving elective mapping:', error);
        showAlert('Failed to save changes: ' + error.message, 'error');
    }
}

// ========================================
// GLOBAL VARIABLES
// ========================================
let currentAvailableStudents = [];
let currentMappedStudents = [];
let pendingAdditions = new Set();
let pendingRemovals = new Set();
let selectedStudentIndex = -1; // For keyboard navigation
let currentFocusBox = 'available'; // 'available' or 'mapped'

// ========================================
// KEYBOARD NAVIGATION
// ========================================

// Initialize keyboard navigation
document.addEventListener('keydown', function(event) {
    // Only handle keyboard navigation when not typing in input fields, textareas, or selects
    const target = event.target;
    if (target.tagName === 'INPUT' && target.type !== 'checkbox' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT') {
        return;
    }
    
    // Only handle keyboard navigation when elective mapping is visible
    const availableBox = document.getElementById('available-students-box');
    const mappedBox = document.getElementById('mapped-students-box');
    
    if (!availableBox || !mappedBox || 
        availableBox.style.display === 'none' || 
        mappedBox.style.display === 'none') {
        return;
    }
    
    const currentBox = currentFocusBox === 'available' ? 'available-students-box' : 'mapped-students-box';
    const studentItems = document.querySelectorAll(`#${currentBox} .elective-student-item`);
    
    if (studentItems.length === 0) {
        console.log('No students found in current box for keyboard navigation');
        return;
    }
    
    console.log('Key pressed:', event.key, 'Shift:', event.shiftKey, 'Current box:', currentFocusBox);
    
    switch(event.key) {
        case 'ArrowDown':
            event.preventDefault();
            selectNextStudent(studentItems, 1);
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            selectNextStudent(studentItems, -1);
            break;
            
        case 'ArrowRight':
            event.preventDefault();
            // Switch focus between boxes
            currentFocusBox = currentFocusBox === 'available' ? 'mapped' : 'available';
            selectedStudentIndex = -1;
            highlightCurrentBox();
            break;
            
        case 'ArrowLeft':
            event.preventDefault();
            // Switch focus between boxes
            currentFocusBox = currentFocusBox === 'available' ? 'mapped' : 'available';
            selectedStudentIndex = -1;
            highlightCurrentBox();
            break;
            
        case ' ':
        case 'Enter':
            event.preventDefault();
            toggleCurrentStudentSelection(studentItems);
            break;
            
        case 'a':
        case 'A':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                selectAllInCurrentBox();
            }
            break;
    }
    
    // Handle Shift + Arrow keys for range selection
    if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        console.log('Shift + Arrow detected - selecting range');
        selectRange(studentItems, event.key === 'ArrowDown' ? 1 : -1);
    }
});

function selectNextStudent(studentItems, direction) {
    const newIndex = selectedStudentIndex + direction;
    
    if (newIndex >= 0 && newIndex < studentItems.length) {
        // Clear previous selection
        clearAllSelections(studentItems);
        
        selectedStudentIndex = newIndex;
        const currentItem = studentItems[newIndex];
        
        // Highlight current item AND check the checkbox
        currentItem.style.backgroundColor = '#e3f2fd';
        const checkbox = currentItem.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = true;
        }
        
        currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Update selected count
        updateSelectedCount();
        
        console.log(`✅ Selected student ${newIndex}:`, currentItem.textContent.trim());
    }
}

function selectRange(studentItems, direction) {
    const newIndex = selectedStudentIndex + direction;
    
    if (newIndex >= 0 && newIndex < studentItems.length) {
        selectedStudentIndex = newIndex;
        const currentItem = studentItems[newIndex];
        const checkbox = currentItem.querySelector('input[type="checkbox"]');
        
        if (checkbox) {
            checkbox.checked = true;
            currentItem.style.backgroundColor = '#e3f2fd';
        }
        
        // Update selected count
        updateSelectedCount();
        
        console.log(`📋 Range selected student ${newIndex}:`, currentItem.textContent.trim());
    }
}

function toggleCurrentStudentSelection(studentItems) {
    if (selectedStudentIndex >= 0 && selectedStudentIndex < studentItems.length) {
        const currentItem = studentItems[selectedStudentIndex];
        const checkbox = currentItem.querySelector('input[type="checkbox"]');
        
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            currentItem.style.backgroundColor = checkbox.checked ? '#e3f2fd' : '';
            
            // Update selected count
            updateSelectedCount();
            
            console.log(`🔄 Toggled student ${selectedStudentIndex}:`, checkbox.checked ? 'SELECTED' : 'DESELECTED');
        }
    }
}

function selectAllInCurrentBox() {
    const currentBox = currentFocusBox === 'available' ? 'available-students-box' : 'mapped-students-box';
    const checkboxes = document.querySelectorAll(`#${currentBox} input[type="checkbox"]`);
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const item = checkbox.closest('.elective-student-item');
        if (item) item.style.backgroundColor = '#e3f2fd';
    });
    
    // Update selected count
    updateSelectedCount();
}

function updateSelectedCount() {
    if (currentFocusBox === 'available') {
        updateAvailableSelectedCount();
    } else {
        updateMappedSelectedCount();
    }
}

function clearAllSelections(studentItems) {
    studentItems.forEach(item => {
        item.style.backgroundColor = '';
    });
}

function highlightCurrentBox() {
    // Remove highlight from both boxes
    document.getElementById('available-students-box').style.border = '';
    document.getElementById('mapped-students-box').style.border = '';
    
    // Highlight current box
    const currentBox = currentFocusBox === 'available' ? 'available-students-box' : 'mapped-students-box';
    document.getElementById(currentBox).style.border = '2px solid #007bff';
}

// ========================================
// INITIALIZATION
// ========================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('Professional Student Management System loaded - ALL BUGS FIXED!');
    loadMasterData('initial');
});
