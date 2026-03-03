// Create Exam Notification JavaScript
$(document).ready(function() {
    console.log('🚀 Create Exam Notification page loaded');
    
    // Initialize Select2 for multi-select dropdowns
    $('#semester_ids, #regulation_ids').select2({
        theme: 'bootstrap-5',
        width: '100%',
        placeholder: 'Select options',
        allowClear: true
    });
    
    // Load all master data on page load
    loadMasterData();
    
    // Form submission
    $('#notificationForm').on('submit', function(e) {
        e.preventDefault();
        saveNotification();
    });
    
    // Date validation
    $('#start_date, #end_date').on('change', function() {
        validateDateRange();
    });
    
    // Auto-update preview when form changes
    $('#notificationForm input, #notificationForm select').on('change', function() {
        if ($('#previewSection').is(':visible')) {
            previewNotification();
        }
    });
});

// Load all master data
async function loadMasterData() {
    try {
        showLoading(true);
        
        // Load programmes
        const programmes = await fetchData('/api/programmes');
        populateSelect('programme_id', programmes, 'programme_id', 'programme_name');
        
        // Load semesters
        const semesters = await fetchData('/api/semesters');
        populateSelect('semester_ids', semesters, 'semester_id', 'semester_name', true);
        
        // Load regulations
        const regulations = await fetchData('/api/regulations');
        populateSelect('regulation_ids', regulations, 'regulation_id', 'regulation_name', true);
        
        // Load exam naming master
        const examNaming = await fetchData('/api/exam-naming-master');
        populateSelect('exam_type', examNaming, 'exam_naming_id', 'exam_type');
        populateSelect('exam_name', examNaming, 'exam_naming_id', 'exam_name');
        // Remove exam_code as it's not needed for the current table structure
        
        // Load sessions
        const sessions = await fetchData('/api/sessions-master');
        populateSelect('session_id', sessions, 'session_id', function(item) {
            return `${item.session_name} (${item.start_time} - ${item.end_time})`;
        });
        
        // Load month-year master
     // Load month-year master
        const monthYear = await fetchData('/api/month-year-master');
        populateSelect('month_year_id', monthYear, 'month_year_id', 'display_name');

        // Load batches
        const batches = await fetchData('/api/batches');
        populateSelect('batch_id', batches.filter(b => b.is_active && !b.deleted_at), 'batch_id', 'batch_name');
        
        // Set minimum date to today
        
        // Set minimum date to today
        const today = new Date().toISOString().split('T')[0];
        $('#start_date').attr('min', today);
        $('#end_date').attr('min', today);
        
        showLoading(false);
        showAlert('success', 'Master data loaded successfully!');
        
    } catch (error) {
        console.error('Error loading master data:', error);
        showLoading(false);
        showAlert('danger', 'Failed to load master data. Please try again.');
    }
}

// Fetch data from API
async function fetchData(endpoint) {
    const response = await fetch(endpoint);
    const result = await response.json();
    
    if (result.status === 'success') {
        return result.data;
    } else {
        throw new Error(result.message || 'Failed to fetch data');
    }
}

// Populate select dropdown
function populateSelect(selectId, data, valueField, textField, isMultiSelect = false) {
    const $select = $(`#${selectId}`);
    $select.empty();
    
    if (!isMultiSelect) {
        $select.append('<option value="">Select...</option>');
    }
    
    data.forEach(item => {
        const value = item[valueField];
        const text = typeof textField === 'function' ? textField(item) : item[textField];
        $select.append(`<option value="${value}">${text}</option>`);
    });
    
    if (isMultiSelect) {
        $select.trigger('change');
    }
}

// Validate date range
function validateDateRange() {
    const startDate = $('#start_date').val();
    const endDate = $('#end_date').val();
    
    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            showAlert('danger', 'Start date cannot be after end date!');
            $('#end_date').val('');
            return false;
        }
        
        // Calculate number of days
showDateSummary(startDate, endDate);
    }          // ← ADD THIS closing brace for if(startDate && endDate)
    return true;
}
// Show date summary breakdown
async function showDateSummary(startDate, endDate) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    let totalDays    = 0;
    let sundayCount  = 0;
    let holidayCount = 0;
    let workingDays  = 0;

    // Fetch holidays
    let holidayDates = [];
    let holidayNames = {};
    try {
        const response = await fetch('/api/holidays');
        const result   = await response.json();
        if (result.status === 'success') {
            result.data.forEach(h => {
                const dateStr = h.holiday_date.split('T')[0];
                holidayDates.push(dateStr);
                holidayNames[dateStr] = h.holiday_name;
            });
        }
    } catch (e) {
        console.error('Could not fetch holidays:', e);
    }

    // Count each day
    const holidaysInRange = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        totalDays++;
        const day     = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        if (day === 0) {
            sundayCount++;
        } else if (holidayDates.includes(dateStr)) {
            holidayCount++;
            holidaysInRange.push({ date: dateStr, name: holidayNames[dateStr] });
        } else {
            workingDays++;
        }
    }

    // Build holiday list HTML
    const holidayListHtml = holidaysInRange.length > 0
        ? `<ul class="mb-0 ps-3">
               ${holidaysInRange.map(h => `<li><strong>${h.date}</strong> — ${h.name}</li>`).join('')}
           </ul>`
        : `<span class="text-muted">No holidays in this range</span>`;

    // Build summary HTML
    const summaryHtml = `
        <div class="card mt-3 border-0 shadow-sm" id="dateSummaryCard">
            <div class="card-header fw-bold" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                📅 Date Range Summary
            </div>
            <div class="card-body p-0">
                <table class="table table-bordered mb-0">
                    <tbody>
                        <tr>
                            <td>📆 Total Selected Days</td>
                            <td><span class="badge bg-primary">${totalDays}</span></td>
                        </tr>
                        <tr class="table-danger">
                            <td>🚫 Sundays (excluded)</td>
                            <td><span class="badge bg-danger">${sundayCount}</span></td>
                        </tr>
                        <tr class="table-warning">
                            <td>🎉 Holidays (excluded)</td>
                            <td><span class="badge bg-warning text-dark">${holidayCount}</span></td>
                        </tr>
                        <tr class="table-success">
                            <td><strong>✅ Working Days (eligible for exam)</strong></td>
                            <td><span class="badge bg-success fs-6">${workingDays}</span></td>
                        </tr>
                    </tbody>
                </table>
                ${holidaysInRange.length > 0 ? `
                <div class="p-3 bg-light border-top">
                    <small class="text-muted fw-bold">📋 Holidays in this range:</small><br/>
                    <small>${holidayListHtml}</small>
                </div>` : ''}
            </div>
        </div>
    `;

    // Remove old summary if exists
    const existing = document.getElementById('dateSummaryCard');
    if (existing) existing.parentElement.remove();

    // Insert after end_date field
    const endDateField = document.getElementById('end_date');
    const wrapper      = document.createElement('div');
    wrapper.innerHTML  = summaryHtml;
    endDateField.closest('.col-md-6, .col-12, .mb-3, .form-group')
        ?.closest('.row')
        ?.insertAdjacentElement('afterend', wrapper)
        || endDateField.insertAdjacentElement('afterend', wrapper);

    if (workingDays < 1) {
        showAlert('warning', 'No working days in selected range!');
    }
}
// Count weekends between two dates
function countWeekends(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let weekends = 0;
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const day = date.getDay();
        if (day === 0 || day === 6) { // Sunday or Saturday
            weekends++;
        }
    }
    
    return weekends;
}

// Preview notification
function previewNotification() {
    const formData = getFormData();
    
    if (!validateForm(formData)) {
        return;
    }
    
    // Generate notification code
    const notificationCode = generateNotificationCode(formData);
    
    // Create preview HTML
    const previewHTML = `
        <div class="preview-item">
            <span class="preview-label">Notification Code:</span>
            <span class="preview-value">${notificationCode}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Programme:</span>
            <span class="preview-value">${formData.programme_name || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Semesters:</span>
            <span class="preview-value">${formData.semester_names || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Regulations:</span>
            <span class="preview-value">${formData.regulation_names || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Exam Type:</span>
            <span class="preview-value">${formData.exam_type || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Exam Name:</span>
            <span class="preview-value">${formData.exam_name_display || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Session:</span>
            <span class="preview-value">${formData.session_name || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Month & Year:</span>
            <span class="preview-value">${formData.month_year_display || 'N/A'}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Date Range:</span>
            <span class="preview-value">${formatDate(formData.start_date)} - ${formatDate(formData.end_date)}</span>
        </div>
        <div class="preview-item">
            <span class="preview-label">Working Days:</span>
            <span class="preview-value">${countWorkingDays(formData.start_date, formData.end_date)} days</span>
        </div>
    `;
    
    $('#previewContent').html(previewHTML);
    $('#previewSection').slideDown();
    
    showAlert('info', 'Notification preview generated successfully!');
}

// Get form data
function getFormData() {
    const formData = {
        programme_id: $('#programme_id').val(),
        semester_ids: $('#semester_ids').val(),
        regulation_ids: $('#regulation_ids').val(),
        exam_type: $('#exam_type').val(),
        exam_name: $('#exam_name').val(), // This will be exam_naming_id
        session_id: $('#session_id').val(),
        month_year_id: $('#month_year_id').val(),
        start_date: $('#start_date').val(),
        end_date: $('#end_date').val(),
        batch_id: $('#batch_id').val(),
        batch_name: $('#batch_id option:selected').text()
    };
    
    // Add display names for preview
    formData.programme_name = $('#programme_id option:selected').text();
    formData.semester_names = $('#semester_ids option:selected').map(function() { return $(this).text(); }).get().join(', ');
    formData.regulation_names = $('#regulation_ids option:selected').map(function() { return $(this).text(); }).get().join(', ');
    formData.exam_type = $('#exam_type option:selected').text();
    formData.exam_name_display = $('#exam_name option:selected').text(); // For display only
    formData.session_name = $('#session_id option:selected').text();
    formData.month_year_display = $('#month_year_id option:selected').text();
    
    return formData;
}

// Validate form
function validateForm(formData) {
    const requiredFields = ['programme_id', 'semester_ids', 'regulation_ids', 'exam_type', 'exam_name', 'session_id', 'month_year_id', 'start_date', 'end_date', 'batch_id'];
    for (const field of requiredFields) {
        if (!formData[field] || (Array.isArray(formData[field]) && formData[field].length === 0)) {
            showAlert('danger', `Please fill in all required fields!`);
            return false;
        }
    }
    
    if (!validateDateRange()) {
        return false;
    }
    
    return true;
}

// Generate notification code
function generateNotificationCode(formData) {
    const programmeCode = $('#programme_id option:selected').data('code') || 'PROG';
    const semesterId = Array.isArray(formData.semester_ids) ? formData.semester_ids[0] : formData.semester_ids;
    const semesterName = $('#semester_ids option[value="' + semesterId + '"]').text() || 'SEM';
    const examName = formData.exam_name || 'EXAM';
    const monthYear = formData.month_year_display || 'DATE';
    
    return `NOTIFICATION_${programmeCode}_${semesterName}_${examName}_${monthYear}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

// Count working days
async function countWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    // Fetch holidays from API
    let holidayDates = [];
    try {
        const response = await fetch('/api/holidays');
        const result = await response.json();
        if (result.status === 'success') {
            holidayDates = result.data.map(h => h.holiday_date.split('T')[0]);
        }
    } catch (e) {
        console.error('Could not fetch holidays:', e);
    }

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const day = date.getDay();
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        
        if (day === 0) continue;                      // Skip Sunday
        if (holidayDates.includes(dateStr)) continue; // Skip holidays
        workingDays++;
    }

    return workingDays;
}
// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Save notification
async function saveNotification() {
    try {
        console.log('🚀 Save notification called');
        showLoading(true);
        
        const formData = getFormData();
        console.log('📋 Form data:', formData);
        
        if (!validateForm(formData)) {
            console.log('❌ Form validation failed');
            showLoading(false);
            return;
        }
        
        console.log('✅ Form validation passed');
        
        // Convert arrays to comma-separated strings
        const payload = {
            ...formData,
            semester_ids: Array.isArray(formData.semester_ids) ? formData.semester_ids.join(',') : formData.semester_ids,
            regulation_ids: Array.isArray(formData.regulation_ids) ? formData.regulation_ids.join(',') : formData.regulation_ids
        };
        
        console.log('📦 Payload to send:', payload);
        
        console.log('🌐 Sending request to /api/exam-notifications');
        const response = await fetch('/api/exam-notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📡 Response status:', response.status);
        const result = await response.json();
        console.log('📋 Response result:', result);
        
        if (result.status === 'success') {
            showAlert('success', 'Notification created successfully! Notification ID: ' + result.data.notification_id);
            
            // Reset form after successful creation
            setTimeout(() => {
                if (confirm('Would you like to create another notification?')) {
                    resetForm();
                } else {
                    viewNotifications();
                }
            }, 2000);
        } else {
            showAlert('danger', result.message || 'Failed to create notification');
        }
        
    } catch (error) {
        console.error('Error saving notification:', error);
        showAlert('danger', 'Failed to save notification. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Reset form
function resetForm() {
    $('#notificationForm')[0].reset();
    $('#semester_ids, #regulation_ids').val(null).trigger('change');
    $('#previewSection').hide();
    $('.alert').alert('close');
}

// View all notifications
function viewNotifications() {
    window.location.href = '/view-notifications.html';
}

// Show/hide loading spinner
function showLoading(show) {
    if (show) {
        $('#loadingSpinner').show();
        $('button').prop('disabled', true);
    } else {
        $('#loadingSpinner').hide();
        $('button').prop('disabled', false);
    }
}

// Show alert message
function showAlert(type, message) {
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <strong>${type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('#alertSection').html(alertHTML);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        $('.alert').alert('close');
    }, 5000);
}

// Keyboard shortcuts
$(document).on('keydown', function(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        $('#notificationForm').submit();
    }
    
    // Ctrl/Cmd + P to preview
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        previewNotification();
    }
    
    // Escape to close alerts
    if (e.key === 'Escape') {
        $('.alert').alert('close');
    }
});
