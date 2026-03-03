// Regulation Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadRegulations();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('regulationForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveRegulation();
    });
}

// Load all regulations
async function loadRegulations() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/regulations`);
        const result = await response.json();
        
        if (response.ok) {
            displayRegulations(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load regulations', 'danger');
            displayRegulations([]);
        }
    } catch (error) {
        console.error('Error loading regulations:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayRegulations([]);
    }
}

// Display regulations in table
function displayRegulations(regulations) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (regulations.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No regulations found. Add your first regulation using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Regulation Name</th>
                    <th>Year</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    regulations.forEach(regulation => {
        const statusClass = regulation.is_active ? 'status-active' : 'status-inactive';
        const statusText = regulation.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(regulation.regulation_name)}</strong></td>
                <td>${regulation.regulation_year}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editRegulation(${regulation.regulation_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteRegulation(${regulation.regulation_id}, '${escapeHtml(regulation.regulation_name)}')">
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

// Save regulation (Create or Update)
async function saveRegulation() {
    const formData = {
        regulation_name: document.getElementById('regulationName').value.trim(),
        regulation_year: parseInt(document.getElementById('regulationYear').value),
        description: document.getElementById('description').value.trim(),
        is_active: true
    };
    
    // Validation
    if (!formData.regulation_name || !formData.regulation_year) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing regulation
            response = await fetch(`${API_BASE_URL}/api/regulations/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new regulation
            response = await fetch(`${API_BASE_URL}/api/regulations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Regulation saved successfully', 'success');
            resetForm();
            loadRegulations();
        } else {
            showAlert(result.message || 'Failed to save regulation', 'danger');
        }
    } catch (error) {
        console.error('Error saving regulation:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit regulation
async function editRegulation(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/regulations/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const regulation = result.data;
            
            // Populate form
            document.getElementById('regulationId').value = regulation.regulation_id;
            document.getElementById('regulationName').value = regulation.regulation_name;
            document.getElementById('regulationYear').value = regulation.regulation_year;
            document.getElementById('description').value = regulation.description || '';
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Regulation';
            document.getElementById('submitBtnText').textContent = 'Update Regulation';
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load regulation details', 'danger');
        }
    } catch (error) {
        console.error('Error loading regulation:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete regulation
async function deleteRegulation(id, name) {
    if (!confirm(`Are you sure you want to delete regulation "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/regulations/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Regulation deleted successfully', 'success');
            loadRegulations();
        } else {
            showAlert(result.message || 'Failed to delete regulation', 'danger');
        }
    } catch (error) {
        console.error('Error deleting regulation:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('regulationForm').reset();
    document.getElementById('regulationId').value = '';
    document.getElementById('formTitle').textContent = 'Add New Regulation';
    document.getElementById('submitBtnText').textContent = 'Add Regulation';
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
