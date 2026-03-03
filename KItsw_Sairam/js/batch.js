// Batch Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadBatches();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('batchForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveBatch();
    });
}

// Load all batches
async function loadBatches() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/batches`);
        const result = await response.json();
        
        if (response.ok) {
            displayBatches(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load batches', 'danger');
            displayBatches([]);
        }
    } catch (error) {
        console.error('Error loading batches:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayBatches([]);
    }
}

// Display batches in table
function displayBatches(batches) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (batches.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No batches found. Add your first batch using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Batch Name</th>
                    <th>Start Year</th>
                    <th>End Year</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    batches.forEach(batch => {
        const statusClass = batch.is_active ? 'status-active' : 'status-inactive';
        const statusText = batch.is_active ? 'Active' : 'Inactive';
        const startYear = batch.start_year || 'N/A';
        const endYear = batch.end_year || 'N/A';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(batch.batch_name)}</strong></td>
                <td>${startYear}</td>
                <td>${endYear}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editBatch(${batch.batch_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBatch(${batch.batch_id}, '${escapeHtml(batch.batch_name)}')">
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

// Save batch (Create or Update)
async function saveBatch() {
    const startYear = parseInt(document.getElementById('startYear').value);
    const endYear = parseInt(document.getElementById('endYear').value);
    const batchName = document.getElementById('batchName').value.trim();
    
    const formData = {
        batch_name: batchName,
        start_year: startYear,
        end_year: endYear,
        is_active: true
    };
    
    // Validation
    if (!startYear || !endYear || !batchName) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing batch
            response = await fetch(`${API_BASE_URL}/api/batches/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new batch
            response = await fetch(`${API_BASE_URL}/api/batches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Batch saved successfully', 'success');
            resetForm();
            loadBatches();
        } else {
            showAlert(result.message || 'Failed to save batch', 'danger');
        }
    } catch (error) {
        console.error('Error saving batch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit batch
async function editBatch(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/batches/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const batch = result.data;
            
            // Populate form
            document.getElementById('batchId').value = batch.batch_id;
            document.getElementById('batchName').value = batch.batch_name || '';
            document.getElementById('startYear').value = batch.start_year || '';
            document.getElementById('endYear').value = batch.end_year || '';
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Batch';
            document.getElementById('submitBtnText').textContent = 'Update Batch';
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load batch details', 'danger');
        }
    } catch (error) {
        console.error('Error loading batch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete batch
async function deleteBatch(id, name) {
    if (!confirm(`Are you sure you want to delete batch "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/batches/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Batch deleted successfully', 'success');
            loadBatches();
        } else {
            showAlert(result.message || 'Failed to delete batch', 'danger');
        }
    } catch (error) {
        console.error('Error deleting batch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('batchForm').reset();
    document.getElementById('batchId').value = '';
    document.getElementById('startYear').disabled = false;
    document.getElementById('endYear').disabled = false;
    document.getElementById('formTitle').textContent = 'Add New Batch';
    document.getElementById('submitBtnText').textContent = 'Add Batch';
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
