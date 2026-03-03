// Month/Year Master JavaScript
let currentMonthYears = [];

// Month mapping for month number
const monthNumbers = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadMonthYears();
    
    // Form submission
    document.getElementById('monthYearForm').addEventListener('submit', handleFormSubmit);
    
    // Auto-generate display name when month and year change
    document.getElementById('monthName').addEventListener('change', updateDisplayName);
    document.getElementById('yearValue').addEventListener('input', updateDisplayName);
});

// Load all month/year records
async function loadMonthYears() {
    try {
        const response = await fetch('/api/month-year-master');
        const result = await response.json();
        
        if (result.status === 'success') {
            currentMonthYears = result.data;
            populateMonthYearTable();
        } else {
            showAlert('Failed to load month/year data', 'error');
        }
    } catch (error) {
        console.error('Error loading month/year data:', error);
        showAlert('Error loading month/year data', 'error');
    }
}

// Populate month/year table
function populateMonthYearTable() {
    const tbody = document.getElementById('monthYearTableBody');
    tbody.innerHTML = '';
    
    // Sort by year and month number
    const sortedData = [...currentMonthYears].sort((a, b) => {
        if (a.year_value !== b.year_value) {
            return a.year_value - b.year_value;
        }
        return a.month_number - b.month_number;
    });
    
    sortedData.forEach(monthYear => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${monthYear.month_name}</td>
            <td>${monthYear.year_value}</td>
            <td>${monthYear.display_name}</td>
            <td>${monthYear.month_number}</td>
            <td>
                <span class="badge ${monthYear.is_active ? 'bg-success' : 'bg-danger'}">
                    ${monthYear.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning me-1" onclick="editMonthYear(${monthYear.month_year_id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMonthYear(${monthYear.month_year_id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update display name automatically
function updateDisplayName() {
    const monthName = document.getElementById('monthName').value;
    const yearValue = document.getElementById('yearValue').value;
    
    if (monthName && yearValue) {
        document.getElementById('displayName').value = `${monthName} ${yearValue}`;
    } else {
        document.getElementById('displayName').value = '';
    }
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const monthYearId = document.getElementById('monthYearId').value;
    const monthName = document.getElementById('monthName').value;
    const yearValue = document.getElementById('yearValue').value;
    const displayName = document.getElementById('displayName').value;
    
    const formData = {
        month_name: monthName,
        year_value: parseInt(yearValue),
        month_number: monthNumbers[monthName],
        display_name: displayName,
        is_active: document.getElementById('isActive').checked
    };
    
    try {
        const url = monthYearId ? `/api/month-year-master/${monthYearId}` : '/api/month-year-master';
        const method = monthYearId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert(monthYearId ? 'Month/Year updated successfully' : 'Month/Year added successfully', 'success');
            resetForm();
            loadMonthYears();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error saving month/year:', error);
        showAlert('Error saving month/year', 'error');
    }
}

// Edit month/year
function editMonthYear(monthYearId) {
    const monthYear = currentMonthYears.find(my => my.month_year_id === monthYearId);
    if (!monthYear) return;
    
    document.getElementById('monthYearId').value = monthYear.month_year_id;
    document.getElementById('monthName').value = monthYear.month_name;
    document.getElementById('yearValue').value = monthYear.year_value;
    document.getElementById('displayName').value = monthYear.display_name;
    document.getElementById('isActive').checked = monthYear.is_active;
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Delete month/year
async function deleteMonthYear(monthYearId) {
    if (!confirm('Are you sure you want to delete this month/year record?')) return;
    
    try {
        const response = await fetch(`/api/month-year-master/${monthYearId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert('Month/Year deleted successfully', 'success');
            loadMonthYears();
        } else {
            showAlert(result.message || 'Delete failed', 'error');
        }
    } catch (error) {
        console.error('Error deleting month/year:', error);
        showAlert('Error deleting month/year', 'error');
    }
}

// Reset form
function resetForm() {
    document.getElementById('monthYearForm').reset();
    document.getElementById('monthYearId').value = '';
    document.getElementById('displayName').value = '';
}

// Show alert
function showAlert(message, type) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}
