// ============================================================
// Sessions Master — Client-Side JavaScript
// Place this file at: js/masters/sessions-master.js
// ============================================================

const API_URL = '/api/sessions-master';

// ----------------------------------------------------------
// Initialise on page load
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    document.getElementById('sessionForm').addEventListener('submit', handleFormSubmit);
});

// ----------------------------------------------------------
// Load all sessions and render table
// ----------------------------------------------------------
async function loadSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>`;

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to load sessions');
        }

        const sessions = result.data;

        if (sessions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No sessions found. Add one above.</td></tr>`;
            return;
        }

        tbody.innerHTML = sessions.map(session => `
            <tr>
                <td><strong>${escapeHtml(session.session_name)}</strong></td>
                <td>${formatTime(session.start_time)}</td>
                <td>${formatTime(session.end_time)}</td>
                <td><span class="badge bg-secondary">${escapeHtml(session.session_type)}</span></td>
                <td><span class="badge bg-info text-dark">${escapeHtml(session.session_group || '')}</span></td>
                <td>
                    ${session.is_active
                        ? '<span class="badge bg-success">Active</span>'
                        : '<span class="badge bg-danger">Inactive</span>'}
                </td>
                <td>
                    <button class="btn btn-warning btn-sm me-1" onclick="editSession(${session.session_id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.session_id}, '${escapeHtml(session.session_name)}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading sessions:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading sessions: ${error.message}</td></tr>`;
    }
}

// ----------------------------------------------------------
// Handle form submit (create or update)
// ----------------------------------------------------------
async function handleFormSubmit(e) {
    e.preventDefault();

    const sessionId    = document.getElementById('sessionId').value;
    const sessionName  = document.getElementById('sessionName').value.trim();
    const sessionType  = document.getElementById('sessionType').value;
    const sessionGroup = document.getElementById('sessionGroup').value;
    const startTime    = document.getElementById('startTime').value;
    const endTime      = document.getElementById('endTime').value;
    const isActive     = document.getElementById('isActive').checked;

    // Basic client-side guard
    if (!sessionName || !sessionType || !sessionGroup || !startTime || !endTime) {
        alert('Please fill in all required fields including Session Group.');
        return;
    }

    const payload = {
        session_name:  sessionName,
        session_type:  sessionType,
        session_group: sessionGroup,
        start_time:    startTime,
        end_time:      endTime,
        is_active:     isActive
    };

    const isEdit = sessionId !== '';
    const url    = isEdit ? `${API_URL}/${sessionId}` : API_URL;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Guard against HTML error pages
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Server returned HTTP ${response.status}. Check server logs.`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || 'Operation failed');
        }

        alert(isEdit ? 'Session updated successfully!' : 'Session created successfully!');
        resetForm();
        loadSessions();

    } catch (error) {
        console.error('Error saving session:', error);
        alert(`Error: ${error.message}`);
    }
}

// ----------------------------------------------------------
// Populate form for editing
// ----------------------------------------------------------
async function editSession(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        const s = result.data;

        document.getElementById('sessionId').value    = s.session_id;
        document.getElementById('sessionName').value  = s.session_name;
        document.getElementById('sessionType').value  = s.session_type;
        document.getElementById('sessionGroup').value = s.session_group || '';
        document.getElementById('startTime').value    = s.start_time ? s.start_time.substring(0, 5) : '';
        document.getElementById('endTime').value      = s.end_time   ? s.end_time.substring(0, 5)   : '';
        document.getElementById('isActive').checked   = !!s.is_active;

        // Scroll to form
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error('Error fetching session:', error);
        alert(`Error loading session: ${error.message}`);
    }
}

// ----------------------------------------------------------
// Delete session (soft delete)
// ----------------------------------------------------------
async function deleteSession(id, name) {
    if (!confirm(`Are you sure you want to delete the session "${name}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        alert('Session deleted successfully!');
        loadSessions();

    } catch (error) {
        console.error('Error deleting session:', error);
        alert(`Error: ${error.message}`);
    }
}

// ----------------------------------------------------------
// Reset / clear form
// ----------------------------------------------------------
function resetForm() {
    document.getElementById('sessionId').value    = '';
    document.getElementById('sessionName').value  = '';
    document.getElementById('sessionType').value  = '';
    document.getElementById('sessionGroup').value = '';
    document.getElementById('startTime').value    = '';
    document.getElementById('endTime').value      = '';
    document.getElementById('isActive').checked   = true;
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function formatTime(timeStr) {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
