// Programme Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadProgrammes();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('programmeForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveProgramme();
    });
}

// Load all programmes
async function loadProgrammes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/programmes`);
        const result = await response.json();
        
        if (response.ok) {
            displayProgrammes(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load programmes', 'danger');
            displayProgrammes([]);
        }
    } catch (error) {
        console.error('Error loading programmes:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayProgrammes([]);
    }
}

// Display programmes in table
function displayProgrammes(programmes) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (programmes.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No programmes found. Add your first programme using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Programme Name</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    programmes.forEach(programme => {
        const statusClass = programme.is_active ? 'status-active' : 'status-inactive';
        const statusText = programme.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(programme.programme_code)}</strong></td>
                <td>${escapeHtml(programme.programme_name)}</td>
                <td>${escapeHtml(programme.programme_type)}</td>
                <td>${programme.duration_years} years</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editProgramme(${programme.programme_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProgramme(${programme.programme_id}, '${escapeHtml(programme.programme_code)}')">
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

// Save programme (Create or Update)
async function saveProgramme() {
    const formData = {
        programme_code: document.getElementById('programmeCode').value.trim().toUpperCase(),
        programme_name: document.getElementById('programmeName').value.trim(),
        programme_type: document.getElementById('programmeType').value,
        duration_years: parseFloat(document.getElementById('durationYears').value),
        description: document.getElementById('description').value.trim(),
        is_active: document.getElementById('isActive').checked
    };
    
    // Validation
    if (!formData.programme_code || !formData.programme_name || !formData.programme_type || !formData.duration_years) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing programme
            response = await fetch(`${API_BASE_URL}/api/programmes/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new programme
            response = await fetch(`${API_BASE_URL}/api/programmes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Programme saved successfully', 'success');
            resetForm();
            loadProgrammes();
        } else {
            showAlert(result.message || 'Failed to save programme', 'danger');
        }
    } catch (error) {
        console.error('Error saving programme:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit programme
async function editProgramme(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/programmes/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const programme = result.data;
            
            // Populate form
            document.getElementById('programmeId').value = programme.programme_id;
            document.getElementById('programmeCode').value = programme.programme_code;
            document.getElementById('programmeName').value = programme.programme_name;
            document.getElementById('programmeType').value = programme.programme_type;
            document.getElementById('durationYears').value = programme.duration_years;
            document.getElementById('description').value = programme.description || '';
            document.getElementById('isActive').checked = programme.is_active;
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Programme';
            document.getElementById('submitBtnText').textContent = 'Update Programme';
            
            // Disable code field during edit and show note
            document.getElementById('programmeCode').disabled = true;
            document.getElementById('codeEditNote').style.display = 'block';
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load programme details', 'danger');
        }
    } catch (error) {
        console.error('Error loading programme:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete programme
async function deleteProgramme(id, code) {
    if (!confirm(`Are you sure you want to delete programme "${code}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/programmes/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Programme deleted successfully', 'success');
            loadProgrammes();
        } else {
            showAlert(result.message || 'Failed to delete programme', 'danger');
        }
    } catch (error) {
        console.error('Error deleting programme:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('programmeForm').reset();
    document.getElementById('programmeId').value = '';
    document.getElementById('programmeCode').disabled = false;
    document.getElementById('codeEditNote').style.display = 'none';
    document.getElementById('formTitle').textContent = 'Add New Programme';
    document.getElementById('submitBtnText').textContent = 'Add Programme';
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
