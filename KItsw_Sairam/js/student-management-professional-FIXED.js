// ========================================
// PROFESSIONAL STUDENT MANAGEMENT - FIXED VERSION
// File: js/student-management-professional.js
// ========================================

// Global state
let currentTab = 'import-initial';
let allStudents = [];
let currentEditingStudent = null;

// ========================================
// UTILITY FUNCTIONS
// ========================================

function showAlert(message, type = 'info') {
    alert(message);
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

// ========================================
// TAB MANAGEMENT
// ========================================

function openTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Add active class to clicked button
    const clickedButton = Array.from(document.querySelectorAll('.tab-button')).find(btn => 
        btn.getAttribute('onclick')?.includes(tabName)
    );
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    currentTab = tabName;

    // Load data for specific tabs (but DON'T load students automatically)
    if (tabName === 'student-management') {
        loadMasterData('view');
        // Clear student list on tab switch
        document.getElementById('student-list').innerHTML = '<div class="alert alert-info">Please select filters and click a filter to load students</div>';
        document.getElementById('student-stats').classList.add('hidden');
    } else if (tabName === 'mapping') {
        loadMasterData('mapping');
    } else if (tabName === 'promotions') {
        loadMasterData('promote-from');
        loadMasterData('promote-to');
    } else if (tabName === 'import-initial') {
        loadMasterData('initial');
    }
}

// ========================================
// MASTER DATA LOADING
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
            'promote-to-batch'
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
            'promote-from-semester'
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
        
        const sectionSelect = document.getElementById(`${prefix}-section`);
        if (sectionSelect) {
            sectionSelect.innerHTML = '<option value="">Select Section</option>';
            sections.forEach(s => {
                sectionSelect.innerHTML += `<option value="${s.section_id}">${s.section_name}</option>`;
            });
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
            
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h3>✅ Import Successful</h3>
                    <p><strong>Imported:</strong> ${result.data.imported} students</p>
                    <p><strong>Skipped:</strong> ${result.data.skipped} students</p>
                    ${errorsHtml}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-error">
                    <h3>❌ Import Failed</h3>
                    <p>${result.message}</p>
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
// TAB 3: STUDENT MANAGEMENT (VIEW)
// ========================================

async function applyFilters() {
    const programmeId = document.getElementById('view-programme').value;
    const branchId = document.getElementById('view-branch').value;
    const batchId = document.getElementById('view-batch').value;
    const semesterId = document.getElementById('view-semester').value;
    const status = document.getElementById('view-status').value;

    // FIX: At least one filter must be selected
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
        
        // FIXED: Roll number is now clickable and opens edit modal
        html += `
            <tr>
                <td>${photoHtml}</td>
                <td><a href="javascript:void(0)" onclick="openStudentEditModal('${s.student_id}')" class="roll-link">${s.roll_number || '-'}</a></td>
                <td>${s.full_name}</td>
                <td>${s.programme_code || '-'}</td>
                <td>${s.branch_code || '-'}</td>
                <td>${s.batch_name || '-'}</td>
                <td>${s.semester_number || '-'}</td>
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
        case 'On Roll': return '#28a745';
        case 'Detained': return '#ffc107';
        case 'Left': return '#dc3545';
        default: return '#6c757d';
    }
}

// ========================================
// STUDENT EDIT MODAL (NEW!)
// ========================================

async function openStudentEditModal(studentId) {
    try {
        // Fetch full student details
        const response = await fetch(`/api/students/${studentId}`);
        const result = await response.json();
        
        if (!response.ok) {
            showAlert('Failed to load student details', 'error');
            return;
        }
        
        const student = result.data;
        currentEditingStudent = student;
        
        // Create and show modal
        const modal = document.getElementById('student-edit-modal');
        
        // Populate form fields
        document.getElementById('edit-admission-number').value = student.admission_number || '';
        document.getElementById('edit-ht-number').value = student.ht_number || '';
        document.getElementById('edit-roll-number').value = student.roll_number || '';
        document.getElementById('edit-full-name').value = student.full_name || '';
        document.getElementById('edit-dob').value = student.date_of_birth || '';
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
        document.getElementById('edit-branch').value = student.branch_id || '';
        document.getElementById('edit-batch').value = student.batch_id || '';
        document.getElementById('edit-semester').value = student.semester_number || '';
        document.getElementById('edit-section').value = student.section_id || '';
        document.getElementById('edit-student-status').value = student.student_status || 'On Roll';
        
        // Load branches for selected programme
        if (student.programme_id) {
            await loadBranchesForEdit(student.programme_id);
            document.getElementById('edit-branch').value = student.branch_id || '';
        }
        
        // Show modal
        modal.style.display = 'block';
        
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
    const semesterHistoryId = currentEditingStudent.semester_history_id;
    
    // Collect form data
    const updatedData = {
        // Basic info (updates student_master)
        ht_number: document.getElementById('edit-ht-number').value,
        roll_number: document.getElementById('edit-roll-number').value,
        full_name: document.getElementById('edit-full-name').value,
        date_of_birth: document.getElementById('edit-dob').value,
        gender: document.getElementById('edit-gender').value,
        father_name: document.getElementById('edit-father-name').value,
        mother_name: document.getElementById('edit-mother-name').value,
        aadhaar_number: document.getElementById('edit-aadhaar').value,
        caste_category: document.getElementById('edit-caste').value,
        student_mobile: document.getElementById('edit-student-mobile').value,
        parent_mobile: document.getElementById('edit-parent-mobile').value,
        email: document.getElementById('edit-email').value,
        
        // Semester info (updates student_semester_history)
        programme_id: document.getElementById('edit-programme').value,
        branch_id: document.getElementById('edit-branch').value,
        batch_id: document.getElementById('edit-batch').value,
        semester_number: document.getElementById('edit-semester').value,
        section_id: document.getElementById('edit-section').value,
        student_status: document.getElementById('edit-student-status').value
    };
    
    try {
        // Update student master
        const masterResponse = await fetch(`/api/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        if (!masterResponse.ok) {
            const error = await masterResponse.json();
            throw new Error(error.message || 'Failed to update student');
        }
        
        showAlert('Student updated successfully!', 'success');
        closeStudentEditModal();
        
        // Reload students
        applyFilters();
        
    } catch (error) {
        console.error('Error saving student changes:', error);
        showAlert('Failed to save changes: ' + error.message, 'error');
    }
}

// ========================================
// TAB 4: MAPPING (WITH BRANCH FILTER FIX)
// ========================================

async function loadMappingStudents() {
    const programmeId = document.getElementById('mapping-programme').value;
    const batchId = document.getElementById('mapping-batch').value;
    const branchId = document.getElementById('mapping-branch')?.value; // FIXED: Added branch filter
    const semesterId = document.getElementById('mapping-semester').value;
    const status = document.getElementById('mapping-status').value;

    if (!programmeId || !batchId || !semesterId) {
        return;
    }

    const params = new URLSearchParams();
    params.append('programme_id', programmeId);
    params.append('batch_id', batchId);
    if (branchId) params.append('branch_id', branchId); // FIXED: Include branch in filter
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

    // FIXED: Better display format with full roll number
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
                semester_number: semesterNumber
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
    const branchId = document.getElementById('mapping-branch')?.value; // FIXED: Added branch

    if (!programmeId || !batchId) return;

    const params = new URLSearchParams();
    params.append('programme_id', programmeId);
    params.append('batch_id', batchId);
    if (branchId) params.append('branch_id', branchId); // FIXED: Include branch

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

    // FIXED: Compact table design
    let html = `
        <div style="max-height: 400px; overflow: auto;">
        <table class="semester-table" style="font-size: 12px;">
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
            html += `<td style="font-size: 11px;">${value}</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// ========================================
// TAB 5: PROMOTIONS
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

    if (!confirm(`Are you sure you want to promote all On Roll students from Semester ${fromSemester} to Semester ${toSemester}?`)) {
        return;
    }

    const resultDiv = document.getElementById('promotion-result');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Promoting students...</p></div>';
    resultDiv.classList.remove('hidden');

    try {
        const response = await fetch('/api/student-management/promotions/promote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_programme_id: fromProgrammeId,
                from_batch_id: fromBatchId,
                from_branch_id: fromBranchId,
                from_semester_number: fromSemester,
                to_programme_id: fromProgrammeId,
                to_batch_id: toBatchId || fromBatchId,
                to_branch_id: fromBranchId,
                to_semester_number: toSemester,
                to_regulation_id: toRegulationId,
                academic_year: toYear
            })
        });

        const result = await response.json();

        if (response.ok) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h3>✅ Promotion Successful</h3>
                    <p>${result.message}</p>
                </div>
            `;
            
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

// ========================================
// INITIALIZATION
// ========================================

window.addEventListener('DOMContentLoaded', () => {
    console.log('Professional Student Management System loaded');
    
    // Load master data for the initial tab
    loadMasterData('initial');
    
    // FIXED: Don't auto-load students on page load
    // Students will only load when user clicks filter
});
