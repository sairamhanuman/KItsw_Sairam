// Exam Types Master JavaScript
let currentExamTypes = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadExamTypes();
    
    // Form submission
    document.getElementById('examTypesForm').addEventListener('submit', handleFormSubmit);
    
    // Auto-calculate default values
    document.getElementById('examCategory').addEventListener('change', setDefaultValues);
});

// Load all exam types
async function loadExamTypes() {
    try {
        const response = await fetch('/api/exam-types-master');
        const result = await response.json();
        
        if (result.status === 'success') {
            currentExamTypes = result.data;
            populateExamTypesTable();
        } else {
            showAlert('Failed to load exam types', 'error');
        }
    } catch (error) {
        console.error('Error loading exam types:', error);
        showAlert('Error loading exam types', 'error');
    }
}

// Populate exam types table
function populateExamTypesTable() {
    const tbody = document.getElementById('examTypesTableBody');
    tbody.innerHTML = '';
    
    currentExamTypes.forEach(examType => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${examType.exam_type_name}</td>
            <td><span class="badge bg-primary">${examType.exam_type_code}</span></td>
            <td><span class="badge bg-info">${examType.exam_category}</span></td>
            <td>${examType.weightage ? examType.weightage + '%' : '-'}</td>
            <td>${examType.min_passing_percentage ? examType.min_passing_percentage + '%' : '-'}</td>
            <td>${examType.max_attempts || '-'}</td>
            <td>
                <span class="badge ${examType.is_active ? 'bg-success' : 'bg-danger'}">
                    ${examType.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="editExamType(${examType.exam_type_id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteExamType(${examType.exam_type_id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Set default values based on exam category
function setDefaultValues() {
    const category = document.getElementById('examCategory').value;
    const minPassingField = document.getElementById('minPassingPercentage');
    const weightageField = document.getElementById('weightage');
    const maxAttemptsField = document.getElementById('maxAttempts');
    
    // Set default values based on category
    switch(category) {
        case 'Internal':
            minPassingField.value = '35';
            weightageField.value = '30';
            maxAttemptsField.value = '3';
            break;
        case 'External':
            minPassingField.value = '35';
            weightageField.value = '70';
            maxAttemptsField.value = '5';
            break;
        case 'Practical':
            minPassingField.value = '40';
            weightageField.value = '25';
            maxAttemptsField.value = '3';
            break;
        case 'Viva':
            minPassingField.value = '40';
            weightageField.value = '15';
            maxAttemptsField.value = '2';
            break;
        case 'Project':
            minPassingField.value = '40';
            weightageField.value = '20';
            maxAttemptsField.value = '2';
            break;
        default:
            minPassingField.value = '';
            weightageField.value = '';
            maxAttemptsField.value = '';
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const examTypesId = document.getElementById('examTypesId').value;
    const formData = {
        exam_type_name: document.getElementById('examTypeName').value,
        exam_type_code: document.getElementById('examTypeCode').value,
        exam_category: document.getElementById('examCategory').value,
        weightage: parseFloat(document.getElementById('weightage').value) || null,
        min_passing_percentage: parseFloat(document.getElementById('minPassingPercentage').value) || null,
        max_attempts: parseInt(document.getElementById('maxAttempts').value) || null,
        description: document.getElementById('description').value,
        is_active: document.getElementById('isActive').checked
    };
    
    try {
        const url = examTypesId ? `/api/exam-types-master/${examTypesId}` : '/api/exam-types-master';
        const method = examTypesId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert(examTypesId ? 'Exam type updated successfully' : 'Exam type added successfully', 'success');
            resetForm();
            loadExamTypes();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving exam type:', error);
        showAlert('Error saving exam type', 'error');
    }
}

// Edit exam type
function editExamType(examTypesId) {
    const examType = currentExamTypes.find(et => et.exam_type_id === examTypesId);
    if (!examType) return;
    
    document.getElementById('examTypesId').value = examType.exam_type_id;
    document.getElementById('examTypeName').value = examType.exam_type_name;
    document.getElementById('examTypeCode').value = examType.exam_type_code;
    document.getElementById('examCategory').value = examType.exam_category;
    document.getElementById('weightage').value = examType.weightage || '';
    document.getElementById('minPassingPercentage').value = examType.min_passing_percentage || '';
    document.getElementById('maxAttempts').value = examType.max_attempts || '';
    document.getElementById('description').value = examType.description || '';
    document.getElementById('isActive').checked = examType.is_active;
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete exam type
async function deleteExamType(examTypesId) {
    if (!confirm('Are you sure you want to delete this exam type?')) return;
    
    try {
        const response = await fetch(`/api/exam-types-master/${examTypesId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert('Exam type deleted successfully', 'success');
            loadExamTypes();
        } else {
            showAlert(result.message || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error deleting exam type:', error);
        showAlert('Error deleting exam type', 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('examTypesForm').reset();
    document.getElementById('examTypesId').value = '';
}

// Show alert
function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}
