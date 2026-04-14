// Sessions Master JavaScript
let currentSessions = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadSessions();
    document.getElementById('sessionForm').addEventListener('submit', handleFormSubmit);
});

// Load all sessions
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions-master');
        const result = await response.json();
        
        if (result.status === 'success') {
            currentSessions = result.data;
            populateSessionsTable();
        } else {
            showAlert('Failed to load sessions', 'error');
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        showAlert('Error loading sessions', 'error');
    }
}

// Populate sessions table
function populateSessionsTable() {
    const tbody = document.getElementById('sessionsTableBody');
    tbody.innerHTML = '';
    
    currentSessions.forEach(session => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${session.session_name}</td>
            <td>${formatTime(session.start_time)}</td>
            <td>${formatTime(session.end_time)}</td>
            <td><span class="badge bg-info">${session.session_type}</span></td>
            <td><span class="badge bg-secondary">${session.session_group || ''}</span></td>
            <td>
                <span class="badge ${session.is_active ? 'bg-success' : 'bg-danger'}">
                    ${session.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="editSession(${session.session_id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSession(${session.session_id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const sessionId = document.getElementById('sessionId').value;
    const formData = {
        session_name:  document.getElementById('sessionName').value,
        session_type:  document.getElementById('sessionType').value,
        session_group: document.getElementById('sessionGroup').value,
        start_time:    document.getElementById('startTime').value,
        end_time:      document.getElementById('endTime').value,
        is_active:     document.getElementById('isActive').checked
    };
    
    try {
        const url    = sessionId ? `/api/sessions-master/${sessionId}` : '/api/sessions-master';
        const method = sessionId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert(sessionId ? 'Session updated successfully' : 'Session added successfully', 'success');
            resetForm();
            loadSessions();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving session:', error);
        showAlert('Error saving session', 'error');
    }
}

// Edit session
function editSession(sessionId) {
    const session = currentSessions.find(s => s.session_id === sessionId);
    if (!session) return;
    
    document.getElementById('sessionId').value    = session.session_id;
    document.getElementById('sessionName').value  = session.session_name;
    document.getElementById('sessionType').value  = session.session_type;
    document.getElementById('sessionGroup').value = session.session_group || '';
    document.getElementById('startTime').value    = session.start_time ? session.start_time.substring(0, 5) : '';
    document.getElementById('endTime').value      = session.end_time   ? session.end_time.substring(0, 5)   : '';
    document.getElementById('isActive').checked   = !!session.is_active;
    
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete session
async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
        const response = await fetch(`/api/sessions-master/${sessionId}`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert('Session deleted successfully', 'success');
            loadSessions();
        } else {
            showAlert(result.message || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showAlert('Error deleting session', 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('sessionForm').reset();
    document.getElementById('sessionId').value = '';
}

// Format time HH:MM:SS -> 12h AM/PM
function formatTime(timeStr) {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

// Show alert toast
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
    alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;min-width:250px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 3000);
}
