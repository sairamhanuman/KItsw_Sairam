// Section Management JavaScript

const API_BASE_URL = window.location.origin;
let currentEditId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSections();
    setupFormSubmit();
});

// Setup form submit handler
function setupFormSubmit() {
    const form = document.getElementById('sectionForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveSection();
    });
}

// Load all sections
async function loadSections() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sections`);
        const result = await response.json();
        
        if (response.ok) {
            displaySections(result.data || []);
        } else {
            showAlert(result.message || 'Failed to load sections', 'danger');
            displaySections([]);
        }
    } catch (error) {
        console.error('Error loading sections:', error);
        showAlert('Error connecting to server: ' + error.message, 'danger');
        displaySections([]);
    }
}

// Display sections in table
function displaySections(sections) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (sections.length === 0) {
        tableContainer.innerHTML = `
            <div class="alert alert-info">
                No sections found. Add your first section using the form above.
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Section Name</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sections.forEach(section => {
        const statusClass = section.is_active ? 'status-active' : 'status-inactive';
        const statusText = section.is_active ? 'Active' : 'Inactive';
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(section.section_name)}</strong></td>
                <td>${section.capacity || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editSection(${section.section_id})">
                            Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSection(${section.section_id}, '${escapeHtml(section.section_name)}')">
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

// Save section (Create or Update)
async function saveSection() {
    const formData = {
        section_code: document.getElementById('sectionName').value.trim().replace(/\s+/g, '_').toUpperCase(),
        section_name: document.getElementById('sectionName').value.trim(),
        capacity: parseInt(document.getElementById('capacity').value) || 60,
        is_active: true
    };
    
    // Validation
    if (!formData.section_name) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    try {
        let response;
        if (currentEditId) {
            // Update existing section
            response = await fetch(`${API_BASE_URL}/api/sections/${currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new section
            response = await fetch(`${API_BASE_URL}/api/sections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Section saved successfully', 'success');
            resetForm();
            loadSections();
        } else {
            showAlert(result.message || 'Failed to save section', 'danger');
        }
    } catch (error) {
        console.error('Error saving section:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Edit section
async function editSection(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sections/${id}`);
        const result = await response.json();
        
        if (response.ok && result.data) {
            const section = result.data;
            
            // Populate form
            document.getElementById('sectionId').value = section.section_id;
            document.getElementById('sectionName').value = section.section_name;
            document.getElementById('capacity').value = section.capacity || 60;
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Section';
            document.getElementById('submitBtnText').textContent = 'Update Section';
            
            // Disable name field during edit
            document.getElementById('sectionName').disabled = true;
            
            currentEditId = id;
            
            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showAlert('Failed to load section details', 'danger');
        }
    } catch (error) {
        console.error('Error loading section:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Delete section
async function deleteSection(id, name) {
    if (!confirm(`Are you sure you want to delete section "${name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/sections/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(result.message || 'Section deleted successfully', 'success');
            loadSections();
        } else {
            showAlert(result.message || 'Failed to delete section', 'danger');
        }
    } catch (error) {
        console.error('Error deleting section:', error);
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('sectionForm').reset();
    document.getElementById('sectionId').value = '';
    document.getElementById('sectionName').disabled = false;
    document.getElementById('formTitle').textContent = 'Add New Section';
    document.getElementById('submitBtnText').textContent = 'Add Section';
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
