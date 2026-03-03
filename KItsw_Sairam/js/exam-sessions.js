// Exam Session Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadExamSessions();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('examSessionForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveExamSession();
    });
}

// Load all exam sessions
async function loadExamSessions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/exam-sessions`);
        const result = await response.json();
        
        if (response.ok) {
            displayExamSessions(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load exam sessions', 'danger');
            displayExamSessions([]);
        }
    } catch (error) {
        console.error('Error loading exam sessions:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayExamSessions([]);
    }
}

// Display exam sessions in table
function displayExamSessions(sessions) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (sessions.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No exam sessions found. Add your first exam session using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Session Name</th>
                    <th>Exam Date</th>
                    <th>Session Type</th>
                    <th>Timings</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sessions.forEach(session => {
        const statusClass = session.is_active ? 'status-active' : 'status-inactive';
        const statusText = session.is_active ? 'Active' : 'Inactive';
        const examDate = session.exam_date ? new Date(session.exam_date).toLocaleDateString() : 'N/A';
        
        // Format timings display from start_time and end_time
        let timingsDisplay = '';
        if (session.start_time && session.end_time) {
            timingsDisplay = `${session.start_time} - ${session.end_time}`;
        } else if (session.start_time) {
            timingsDisplay = session.start_time;
        } else if (session.end_time) {
            timingsDisplay = session.end_time;
        } else {
            timingsDisplay = 'N/A';
        }
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(session.session_name)}</strong></td>
                <td>${examDate}</td>
                <td>${escapeHtml(session.session_type || 'N/A')}</td>
                <td>${escapeHtml(timingsDisplay)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editExamSession(${session.session_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExamSession(${session.session_id}, '${escapeHtml(session.session_name)}')">
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

// Save exam session (Create or Update)
async function saveExamSession() {
    const formData = {
        session_name: document.getElementById('sessionName').value,
        exam_date: document.getElementById('examDate').value,
        session_type: document.getElementById('sessionType').value,
        start_time: document.getElementById('startTime').value || null,
        end_time: document.getElementById('endTime').value || null,
        is_active: true
    };
    
    console.log('Sending exam session data:', formData);
    
    // Validation
    if (!formData.session_name || !formData.exam_date || !formData.session_type) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing exam session
            response = await fetch(`${API_BASE_URL}/api/exam-sessions/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new exam session
            response = await fetch(`${API_BASE_URL}/api/exam-sessions`, {
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
            showAlert(result.message || 'Exam session saved successfully', 'success');
            resetForm();
            loadExamSessions();
        } else {
            // Show detailed error message
            const errorMsg = result.sqlMessage || result.error || result.message || 'Failed to save exam session';
            showAlert(errorMsg, 'danger');
            console.error('Server error details:', result);
        }
    } catch (error) {
        console.error('Network error:', error);
        showAlert('Network error: ' + error.message, 'danger');
    }
}

// Edit exam session
async function editExamSession(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/exam-sessions/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const session = result.data;
            
            // Populate form
            document.getElementById('sessionId').value = session.session_id;
            document.getElementById('sessionName').value = session.session_name;
            document.getElementById('sessionType').value = session.session_type || '';
            const examDate = session.exam_date ? session.exam_date.split('T')[0] : '';
            document.getElementById('examDate').value = examDate;
            document.getElementById('startTime').value = session.start_time || '';
            document.getElementById('endTime').value = session.end_time || '';
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Exam Session';
            document.getElementById('submitBtnText').textContent = 'Update Exam Session';
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load exam session details', 'danger');
        }
    } catch (error) {
        console.error('Error loading exam session:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete exam session
async function deleteExamSession(id, name) {
    if (!confirm(`Are you sure you want to delete exam session "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/exam-sessions/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Exam session deleted successfully', 'success');
            loadExamSessions();
        } else {
            showAlert(result.message || 'Failed to delete exam session', 'danger');
        }
    } catch (error) {
        console.error('Error deleting exam session:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('examSessionForm').reset();
    document.getElementById('sessionId').value = '';
    document.getElementById('formTitle').textContent = 'Add New Exam Session';
    document.getElementById('submitBtnText').textContent = 'Add Exam Session';
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
