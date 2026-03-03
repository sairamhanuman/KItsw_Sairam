// Exam Naming Master JavaScript
let currentExamNames = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadExamNames();
    
    // Form submission
    document.getElementById('examNamingForm').addEventListener('submit', handleFormSubmit);
    
    // Auto-calculate passing marks when max marks change
    document.getElementById('maxMarks').addEventListener('input', calculatePassingMarks);
});

// Load all exam names
async function loadExamNames() {
    try {
        const response = await fetch('/api/exam-naming-master');
        const result = await response.json();
        
        if (result.status === 'success') {
            currentExamNames = result.data;
            populateExamNamingTable();
        } else {
            showAlert('Failed to load exam names', 'error');
        }
    } catch (error) {
        console.error('Error loading exam names:', error);
        showAlert('Error loading exam names', 'error');
    }
}

// Populate exam names table
function populateExamNamingTable() {
    const tbody = document.getElementById('examNamingTableBody');
    tbody.innerHTML = '';
    
    currentExamNames.forEach(exam => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${exam.exam_name}</td>
            <td><span class="badge bg-primary">${exam.exam_code}</span></td>
            <td><span class="badge bg-info">${exam.exam_type}</span></td>
            <td>${exam.max_marks}</td>
            <td>${exam.duration_minutes} min</td>
            <td>${exam.passing_marks}</td>
            <td>
                <span class="badge ${exam.is_active ? 'bg-success' : 'bg-danger'}">
                    ${exam.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="editExamNaming(${exam.exam_naming_id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteExamNaming(${exam.exam_naming_id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Calculate passing marks (35% of max marks by default)
function calculatePassingMarks() {
    const maxMarks = parseFloat(document.getElementById('maxMarks').value) || 0;
    const passingMarks = Math.ceil(maxMarks * 0.35);
    document.getElementById('passingMarks').value = passingMarks;
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const examNamingId = document.getElementById('examNamingId').value;
    const formData = {
        exam_name: document.getElementById('examName').value,
        exam_code: document.getElementById('examCode').value,
        exam_type: document.getElementById('examType').value,
        max_marks: parseInt(document.getElementById('maxMarks').value),
        duration_minutes: parseInt(document.getElementById('duration').value),
        passing_marks: parseInt(document.getElementById('passingMarks').value),
        description: document.getElementById('description').value,
        is_active: document.getElementById('isActive').checked
    };
    
    try {
        const url = examNamingId ? `/api/exam-naming-master/${examNamingId}` : '/api/exam-naming-master';
        const method = examNamingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert(examNamingId ? 'Exam name updated successfully' : 'Exam name added successfully', 'success');
            resetForm();
            loadExamNames();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving exam name:', error);
        showAlert('Error saving exam name', 'error');
    }
}

// Edit exam name
function editExamNaming(examNamingId) {
    const exam = currentExamNames.find(e => e.exam_naming_id === examNamingId);
    if (!exam) return;
    
    document.getElementById('examNamingId').value = exam.exam_naming_id;
    document.getElementById('examName').value = exam.exam_name;
    document.getElementById('examCode').value = exam.exam_code;
    document.getElementById('examType').value = exam.exam_type;
    document.getElementById('maxMarks').value = exam.max_marks;
    document.getElementById('duration').value = exam.duration_minutes;
    document.getElementById('passingMarks').value = exam.passing_marks;
    document.getElementById('description').value = exam.description || '';
    document.getElementById('isActive').checked = exam.is_active;
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete exam name
async function deleteExamNaming(examNamingId) {
    if (!confirm('Are you sure you want to delete this exam name?')) return;
    
    try {
        const response = await fetch(`/api/exam-naming-master/${examNamingId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert('Exam name deleted successfully', 'success');
            loadExamNames();
        } else {
            showAlert(result.message || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error deleting exam name:', error);
        showAlert('Error deleting exam name', 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('examNamingForm').reset();
    document.getElementById('examNamingId').value = '';
    document.getElementById('passingMarks').value = '';
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
