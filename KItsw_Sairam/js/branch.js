// Branch Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadProgrammes();
    loadBranches();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('branchForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveBranch();
    });
}

// Load programmes for dropdown
async function loadProgrammes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/programmes`);
        const result = await response.json();
        
        if (response.ok) {
            const select = document.getElementById('programmeId');
            select.innerHTML = '<option value="">Select Programme</option>';
            
            if (result.data && result.data.length > 0) {
                result.data.forEach(programme => {
                    if (programme.is_active) {
                        const option = document.createElement('option');
                        option.value = programme.programme_id;
                        option.textContent = programme.programme_code;
                        select.appendChild(option);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading programmes:', error);
    }
}

// Load all branches
async function loadBranches() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/branches`);
        const result = await response.json();
        
        if (response.ok) {
            displayBranches(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load branches', 'danger');
            displayBranches([]);
        }
    } catch (error) {
        console.error('Error loading branches:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayBranches([]);
    }
}

// Display branches in table
function displayBranches(branches) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (branches.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No branches found. Add your first branch using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Branch Name</th>
                    <th>Programme</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    branches.forEach(branch => {
        const statusClass = branch.is_active ? 'status-active' : 'status-inactive';
        const statusText = branch.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(branch.branch_code)}</strong></td>
                <td>${escapeHtml(branch.branch_name)}</td>
                <td>${escapeHtml(branch.programme_name || 'N/A')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editBranch(${branch.branch_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBranch(${branch.branch_id}, '${escapeHtml(branch.branch_code)}')">
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

// Save branch (Create or Update)
async function saveBranch() {
    const formData = {
        branch_code: document.getElementById('branchCode').value.trim().toUpperCase(),
        branch_name: document.getElementById('branchName').value.trim(),
        programme_id: parseInt(document.getElementById('programmeId').value),
        description: document.getElementById('description').value.trim(),
        is_active: true
    };
    
    // Validation
    if (!formData.branch_code || !formData.branch_name || !formData.programme_id) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing branch
            response = await fetch(`${API_BASE_URL}/api/branches/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new branch
            response = await fetch(`${API_BASE_URL}/api/branches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Branch saved successfully', 'success');
            resetForm();
            loadBranches();
        } else {
            showAlert(result.message || 'Failed to save branch', 'danger');
        }
    } catch (error) {
        console.error('Error saving branch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit branch
async function editBranch(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/branches/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const branch = result.data;
            
            // Populate form
            document.getElementById('branchId').value = branch.branch_id;
            document.getElementById('branchCode').value = branch.branch_code;
            document.getElementById('branchName').value = branch.branch_name;
            document.getElementById('programmeId').value = branch.programme_id;
            document.getElementById('description').value = branch.description || '';
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Branch';
            document.getElementById('submitBtnText').textContent = 'Update Branch';
            
            // Disable code field during edit
            document.getElementById('branchCode').disabled = true;
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load branch details', 'danger');
        }
    } catch (error) {
        console.error('Error loading branch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete branch
async function deleteBranch(id, code) {
    if (!confirm(`Are you sure you want to delete branch "${code}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/branches/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Branch deleted successfully', 'success');
            loadBranches();
        } else {
            showAlert(result.message || 'Failed to delete branch', 'danger');
        }
    } catch (error) {
        console.error('Error deleting branch:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('branchForm').reset();
    document.getElementById('branchId').value = '';
    document.getElementById('branchCode').disabled = false;
    document.getElementById('formTitle').textContent = 'Add New Branch';
    document.getElementById('submitBtnText').textContent = 'Add Branch';
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
