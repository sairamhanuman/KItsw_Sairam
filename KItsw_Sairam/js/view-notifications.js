// View Notifications JavaScript
$(document).ready(function() {
    console.log('🚀 View Notifications page loaded');
    
    // Load notifications on page load
    loadNotifications();
    loadMasterData();
    
    // Setup event listeners
    $('#searchInput').on('input', filterNotifications);
    $('#statusFilter, #programmeFilter').on('change', filterNotifications);
});

let allNotifications = [];
let allProgrammes = [];

// Load all notifications
async function loadNotifications() {
    try {
        showLoading(true);
        
        const response = await fetch('/api/exam-notifications');
        const result = await response.json();
        
        if (result.status === 'success') {
            allNotifications = result.data;
            displayNotifications(allNotifications);
            updateStatistics(allNotifications);
        } else {
            showAlert('danger', result.message || 'Failed to load notifications');
        }
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        showAlert('danger', 'Failed to load notifications. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Load master data for filters
async function loadMasterData() {
    try {
        const programmesResponse = await fetch('/api/programmes');
        const programmesResult = await programmesResponse.json();
        
        if (programmesResult.status === 'success') {
            allProgrammes = programmesResult.data;
            populateProgrammeFilter();
        }
        
    } catch (error) {
        console.error('Error loading master data:', error);
    }
}

// Populate programme filter
function populateProgrammeFilter() {
    const $filter = $('#programmeFilter');
    $filter.empty();
    $filter.append('<option value="">All Programmes</option>');
    
    allProgrammes.forEach(programme => {
        $filter.append(`<option value="${programme.programme_id}">${programme.programme_name}</option>`);
    });
}

// Display notifications
function displayNotifications(notifications) {
    const $list = $('#notificationsList');
    const $emptyState = $('#emptyState');
    
    if (notifications.length === 0) {
        $list.empty();
        $emptyState.show();
        return;
    }
    
    $emptyState.hide();
    
    const notificationsHTML = notifications.map(notification => createNotificationCard(notification)).join('');
    $list.html(notificationsHTML);
}

// Create notification card HTML
function createNotificationCard(notification) {
    const statusClass = getStatusClass(notification.status);
    const workingDays = countWorkingDays(notification.start_date, notification.end_date);

    // Use notification_title (dynamic: "BTECH - MSE-1 - VI SEMESTER - April-2026")
    const displayTitle = notification.notification_title || notification.notification_code || 'N/A';
    
    return `
        <div class="notification-card">
            <div class="notification-header">
                <h5 class="mb-2">${displayTitle}</h5>
                <div class="notification-status ${statusClass}">${notification.status}</div>
            </div>
            <div class="notification-body">
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Programme</span>
                        <span class="info-value">${notification.programme_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Exam Name</span>
                        <span class="info-value">${notification.exam_name || notification.exam_name_id || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Exam Type</span>
                        <span class="info-value">${notification.exam_type}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Date Range</span>
                        <span class="info-value">${formatDate(notification.start_date)} - ${formatDate(notification.end_date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Working Days</span>
                        <span class="info-value">${workingDays} days</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Semesters</span>
                        <span class="info-value">${notification.semester_names || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Regulations</span>
                        <span class="info-value">${notification.regulation_names || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Session</span>
                        <span class="info-value">${notification.session_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Month & Year</span>
                        <span class="info-value">${notification.month_year_display || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-action btn-info" onclick="viewDetails('${notification.notification_id}')">
                        <i class="bi bi-eye"></i> View Details
                    </button>
                    <button class="btn-action btn-warning" onclick="editNotification('${notification.notification_id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn-action btn-success" onclick="generateTimetable('${notification.notification_id}')" 
                            ${notification.timetable_generated ? 'disabled' : ''}>
                        <i class="bi bi-calendar3"></i> 
                        ${notification.timetable_generated ? 'Timetable Generated' : 'Generate Timetable'}
                    </button>
                    <button class="btn-action btn-primary" onclick="viewTimetable('${notification.notification_id}')"
                            ${!notification.timetable_generated ? 'disabled' : ''}>
                        <i class="bi bi-calendar-week"></i> View Timetable
                    </button>
                    <button class="btn-action btn-danger" onclick="deleteNotification('${notification.notification_id}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Get status class for styling
function getStatusClass(status) {
    const statusClasses = {
        'draft': 'status-draft',
        'active': 'status-active',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-draft';
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusBadges = {
        'draft': '<span class="badge bg-warning">Draft</span>',
        'active': '<span class="badge bg-success">Active</span>',
        'completed': '<span class="badge bg-info">Completed</span>',
        'cancelled': '<span class="badge bg-danger">Cancelled</span>'
    };
    return statusBadges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

// Count working days between two dates
function countWorkingDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            workingDays++;
        }
    }
    
    return workingDays;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Update statistics
function updateStatistics(notifications) {
    const stats = {
        total: notifications.length,
        draft: notifications.filter(n => n.status === 'draft').length,
        active: notifications.filter(n => n.status === 'active').length,
        completed: notifications.filter(n => n.status === 'completed').length
    };
    
    $('#totalCount').text(stats.total);
    $('#draftCount').text(stats.draft);
    $('#activeCount').text(stats.active);
    $('#completedCount').text(stats.completed);
}

// Filter notifications
function filterNotifications() {
    const searchTerm = $('#searchInput').val().toLowerCase();
    const statusFilter = $('#statusFilter').val();
    const programmeFilter = $('#programmeFilter').val();
    
    let filtered = allNotifications;
    
    // Search filter — searches notification_title as well
    if (searchTerm) {
        filtered = filtered.filter(notification =>
            (notification.notification_title && notification.notification_title.toLowerCase().includes(searchTerm)) ||
            (notification.notification_code && notification.notification_code.toLowerCase().includes(searchTerm)) ||
            notification.exam_type.toLowerCase().includes(searchTerm) ||
            (notification.programme_name && notification.programme_name.toLowerCase().includes(searchTerm))
        );
    }
    
    if (statusFilter) {
        filtered = filtered.filter(notification => notification.status === statusFilter);
    }
    
    if (programmeFilter) {
        filtered = filtered.filter(notification => notification.programme_id == programmeFilter);
    }
    
    displayNotifications(filtered);
    updateStatistics(filtered);
}

// View notification details
async function viewDetails(notificationId) {
    try {
        const response = await fetch(`/api/exam-notifications/${notificationId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            showNotificationDetails(result.data);
        } else {
            showAlert('danger', result.message || 'Failed to load notification details');
        }
    } catch (error) {
        console.error('Error loading notification details:', error);
        showAlert('danger', 'Failed to load notification details');
    }
}

// Show notification details modal
function showNotificationDetails(notification) {
    const displayTitle = notification.notification_title || notification.notification_code || 'N/A';

    const modalHTML = `
        <div class="modal fade" id="detailsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Notification Details</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Basic Information</h6>
                                <table class="table table-sm">
                                    <tr>
                                        <td><strong>Exam Name:</strong></td>
                                        <td>${displayTitle}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Programme:</strong></td>
                                        <td>${notification.programme_name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Exam Type:</strong></td>
                                        <td>${notification.exam_type}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Status:</strong></td>
                                        <td>${getStatusBadge(notification.status)}</td>
                                    </tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>Schedule Information</h6>
                                <table class="table table-sm">
                                    <tr>
                                        <td><strong>Start Date:</strong></td>
                                        <td>${formatDate(notification.start_date)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>End Date:</strong></td>
                                        <td>${formatDate(notification.end_date)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Session:</strong></td>
                                        <td>${notification.session_name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Month & Year:</strong></td>
                                        <td>${notification.month_year_display || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Created By:</strong></td>
                                        <td>${notification.created_by || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Created Date:</strong></td>
                                        <td>${formatDate(notification.created_at)}</td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <h6>Academic Details</h6>
                                <p><strong>Semesters:</strong> ${notification.semester_names || 'N/A'}</p>
                                <p><strong>Regulations:</strong> ${notification.regulation_names || 'N/A'}</p>
                            </div>
                            <div class="col-md-6">
                                <h6>Timetable Status</h6>
                                <p><strong>Timetable Generated:</strong> ${notification.timetable_generated ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-warning" onclick="editNotification('${notification.notification_id}')">Edit</button>
                        <button type="button" class="btn btn-success" onclick="generateTimetable('${notification.notification_id}')"
                                ${notification.timetable_generated ? 'disabled' : ''}>Generate Timetable</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#detailsModal').remove();
    $('body').append(modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// Edit notification
function editNotification(notificationId) {
    window.location.href = `/edit-notification.html?id=${notificationId}`;
}

// Generate timetable
function generateTimetable(notificationId) {
    window.location.href = `/generate-timetable.html?notificationId=${notificationId}`;
}

// View timetable
function viewTimetable(notificationId) {
    window.location.href = `/view-timetable.html?notificationId=${notificationId}`;
}

// Delete notification
function deleteNotification(notificationId) {
    $('#deleteModal').modal('show');
    $('#deleteModal').data('notification-id', notificationId);
}

// Confirm delete
async function confirmDelete() {
    const notificationId = $('#deleteModal').data('notification-id');
    
    try {
        const response = await fetch(`/api/exam-notifications/${notificationId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert('success', 'Notification deleted successfully');
            $('#deleteModal').modal('hide');
            loadNotifications();
        } else {
            showAlert('danger', result.message || 'Failed to delete notification');
        }
        
    } catch (error) {
        console.error('Error deleting notification:', error);
        showAlert('danger', 'Failed to delete notification');
    }
}

// Refresh notifications
function refreshNotifications() {
    loadNotifications();
}

// Create new notification
function createNotification() {
    window.location.href = '/create-exam-notification.html';
}

// Show/hide loading
function showLoading(show) {
    if (show) {
        $('#loadingSpinner').show();
        $('#notificationsList').hide();
        $('#emptyState').hide();
    } else {
        $('#loadingSpinner').hide();
        $('#notificationsList').show();
    }
}

// Show alert
function showAlert(type, message) {
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <strong>${type === 'success' ? '✅' : type === 'danger' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('.content-section').prepend(alertHTML);
    
    setTimeout(() => {
        $('.alert').alert('close');
    }, 5000);
}

// Keyboard shortcuts
$(document).on('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshNotifications();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNotification();
    }
    if (e.key === 'Escape') {
        $('.modal').modal('hide');
    }
});
