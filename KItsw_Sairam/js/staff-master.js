// Staff Master Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStaff();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('staffForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveStaff();
    });
}

// Load all staff
async function loadStaff() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/staff`);
        const result = await response.json();
        
        if (response.ok && result.status === 'success' && result.data) {
            // Extract staff array from result.data.staff
            const staffArray = result.data.staff || [];
            displayStaff(staffArray);
        } else {
            showAlert(result.message || 'Failed to load staff', 'danger');
            displayStaff([]);
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displayStaff([]);
    }
}

// Display staff in table
function displayStaff(staff) {
    const tableContainer = document.getElementById('tableContainer');
    
    // Validate staff is an array
    if (!Array.isArray(staff)) {
        console.error('displayStaff expects an array, got:', typeof staff);
        staff = [];
    }
    
    if (staff.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No staff found. Add your first staff member using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Staff Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    staff.forEach(member => {
        const statusClass = member.is_active ? 'status-active' : 'status-inactive';
        const statusText = member.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(member.staff_name)}</strong></td>
                <td>${escapeHtml(member.email || 'N/A')}</td>
                <td>${escapeHtml(member.phone || 'N/A')}</td>
                <td>${escapeHtml(member.department || 'N/A')}</td>
                <td>${escapeHtml(member.designation || 'N/A')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editStaff(${member.staff_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStaff(${member.staff_id}, '${escapeHtml(member.staff_name)}')">
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

// Save staff (Create or Update)
async function saveStaff() {
    const formData = {
        staff_name: document.getElementById('staffName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        department: document.getElementById('department').value.trim(),
        designation: document.getElementById('designation').value.trim(),
        is_active: true
    };
    
    // Validation
    if (!formData.staff_name || !formData.email || !formData.phone || 
        !formData.department || !formData.designation) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing staff
            response = await fetch(`${API_BASE_URL}/api/staff/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new staff
            response = await fetch(`${API_BASE_URL}/api/staff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Staff saved successfully', 'success');
            resetForm();
            loadStaff();
        } else {
            showAlert(result.message || 'Failed to save staff', 'danger');
        }
    } catch (error) {
        console.error('Error saving staff:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit staff
async function editStaff(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/staff/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const staff = result.data;
            
            // Populate form
            document.getElementById('staffId').value = staff.staff_id;
            document.getElementById('staffName').value = staff.staff_name;
            document.getElementById('email').value = staff.email || '';
            document.getElementById('phone').value = staff.phone || '';
            document.getElementById('department').value = staff.department || '';
            document.getElementById('designation').value = staff.designation || '';
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Staff';
            document.getElementById('submitBtnText').textContent = 'Update Staff';
            
            // Disable email field during edit
            document.getElementById('email').disabled = true;
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load staff details', 'danger');
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete staff
async function deleteStaff(id, name) {
    if (!confirm(`Are you sure you want to delete staff member "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/staff/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Staff deleted successfully', 'success');
            loadStaff();
        } else {
            showAlert(result.message || 'Failed to delete staff', 'danger');
        }
    } catch (error) {
        console.error('Error deleting staff:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('staffForm').reset();
    document.getElementById('staffId').value = '';
    document.getElementById('email').disabled = false;
    document.getElementById('formTitle').textContent = 'Add New Staff';
    document.getElementById('submitBtnText').textContent = 'Add Staff';
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
