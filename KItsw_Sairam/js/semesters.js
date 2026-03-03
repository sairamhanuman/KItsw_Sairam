// Semester Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSemesters();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('semesterForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveSemester();
    });
}

// Load all semesters
async function loadSemesters() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/semesters`);
        const result = await response.json();
        
        if (response.ok) {
            displaySemesters(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load semesters', 'danger');
            displaySemesters([]);
        }
    } catch (error) {
        console.error('Error loading semesters:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displaySemesters([]);
    }
}

// Display semesters in table
function displaySemesters(semesters) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (semesters.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No semesters found. Add your first semester using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Semester Name</th>
                    <th>Semester Number</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    semesters.forEach(semester => {
        const statusClass = semester.is_active ? 'status-active' : 'status-inactive';
        const statusText = semester.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(semester.semester_name)}</strong></td>
                <td>${semester.semester_number}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editSemester(${semester.semester_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSemester(${semester.semester_id}, '${escapeHtml(semester.semester_name)}')">
                            Delete
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

// Save semester (Create or Update)
async function saveSemester() {
    const formData = {
        semester_number: parseInt(document.getElementById('semesterNumber').value),
        semester_name: document.getElementById('semesterName').value.trim(),
        is_active: true
    };
    
    console.log('Sending semester data:', formData);
    
    // Validation
    if (!formData.semester_number || !formData.semester_name) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing semester
            response = await fetch(`${API_BASE_URL}/api/semesters/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new semester
            response = await fetch(`${API_BASE_URL}/api/semesters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        console.log('Server response:', result);
        
        if (response.ok) {
            showAlert(result.message || 'Semester saved successfully', 'success');
            resetForm();
            loadSemesters();
        } else {
            // Show detailed error message
            const errorMsg = result.sqlMessage || result.error || result.message || 'Failed to save semester';
            showAlert(errorMsg, 'danger');
            console.error('Server error details:', result);
        }
    } catch (error) {
        console.error('Network error:', error);
        showAlert('Network error: ' + error.message, 'danger');
    }
}

// Edit semester
async function editSemester(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/semesters/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const semester = result.data;
            
            // Populate form
            document.getElementById('semesterId').value = semester.semester_id;
            document.getElementById('semesterNumber').value = semester.semester_number;
            document.getElementById('semesterName').value = semester.semester_name;
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Semester';
            document.getElementById('submitBtnText').textContent = 'Update Semester';
            
            // Disable number field during edit
            document.getElementById('semesterNumber').disabled = true;
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load semester details', 'danger');
        }
    } catch (error) {
        console.error('Error loading semester:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete semester
async function deleteSemester(id, name) {
    if (!confirm(`Are you sure you want to delete semester "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/semesters/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Semester deleted successfully', 'success');
            loadSemesters();
        } else {
            showAlert(result.message || 'Failed to delete semester', 'danger');
        }
    } catch (error) {
        console.error('Error deleting semester:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('semesterForm').reset();
    document.getElementById('semesterId').value = '';
    document.getElementById('semesterNumber').disabled = false;
    document.getElementById('formTitle').textContent = 'Add New Semester';
    document.getElementById('submitBtnText').textContent = 'Add Semester';
    currentEditId = null;
}

// Show alert message
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
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
