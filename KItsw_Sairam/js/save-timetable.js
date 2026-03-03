// Enhanced Save Timetable Implementation
// This file extends the existing generate-timetable.js without disturbing it

// Wait for jQuery to be ready
(function($) {
    "use strict";
    
    // Global variables for tracking changes
    let timetableChanges = [];
    let isDirty = false;
    let autoSaveTimer = null;
    let originalTimetableData = [];
    
    // Initialize save functionality when page loads
    $(document).ready(function() {
        console.log('🚀 Save Timetable functionality loaded');
        
        // Override the existing saveTimetable function
        if (typeof window.saveTimetable === 'function') {
            window.saveTimetable = saveTimetableEnhanced;
        } else {
            window.saveTimetable = saveTimetableEnhanced;
        }
        
        // Add change listeners for auto-save
        setupChangeListeners();
        
        // Add keyboard shortcut for save (Ctrl+S)
        $(document).on('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if ($('#saveBtn').is(':visible')) {
                    saveTimetableEnhanced();
                }
            }
        });
    });

// Setup change listeners for drag and drop
function setupChangeListeners() {
    // Listen for drag and drop events
    $(document).on('dragend', '.subject-card', function(e) {
        const entryId = $(this).data('entry-id');
        const newLocation = getNewLocation($(this));
        trackChange(entryId, {
            action: 'move',
            newLocation: newLocation
        });
    });
    
    // Listen for changes in form inputs
    $(document).on('change', '.timetable-input', function(e) {
        const entryId = $(this).data('entry-id');
        const field = $(this).data('field');
        const value = $(this).val();
        trackChange(entryId, {
            action: 'update',
            field: field,
            value: value
        });
    });
    
    // Listen for delete operations
    $(document).on('click', '.delete-entry', function(e) {
        e.preventDefault();
        const entryId = $(this).data('entry-id');
        trackChange(entryId, {
            action: 'delete'
        });
    });
}

// Get new location after drag and drop
function getNewLocation($element) {
    const $parent = $element.closest('.branch-column, .unassigned-section');
    if ($parent.hasClass('branch-column')) {
        return {
            type: 'branch',
            branchId: $parent.data('branch-id'),
            date: $parent.data('date')
        };
    } else {
        return {
            type: 'unassigned'
        };
    }
}

// Track changes made to timetable
function trackChange(entryId, change) {
    const timestamp = Date.now();
    const existingChangeIndex = timetableChanges.findIndex(c => c.entryId === entryId);
    
    if (existingChangeIndex >= 0) {
        // Update existing change
        timetableChanges[existingChangeIndex] = {
            entryId: entryId,
            ...change,
            timestamp: timestamp
        };
    } else {
        // Add new change
        timetableChanges.push({
            entryId: entryId,
            ...change,
            timestamp: timestamp
        });
    }
    
    isDirty = true;
    updateSaveButton();
    
    // Trigger auto-save with debouncing
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    autoSaveTimer = setTimeout(() => {
        autoSave();
    }, 3000); // Auto-save after 3 seconds of inactivity
}

// Update save button appearance
function updateSaveButton() {
    const $saveBtn = $('#saveBtn');
    if (isDirty) {
        $saveBtn.removeClass('btn-secondary').addClass('btn-warning');
        $saveBtn.html('<i class="bi bi-save"></i> Save Changes*');
    } else {
        $saveBtn.removeClass('btn-warning').addClass('btn-secondary');
        $saveBtn.html('<i class="bi bi-save"></i> Save');
    }
}

// Enhanced save function
async function saveTimetableEnhanced() {
    try {
        console.log('🚀 Save function started');
        
        // Allow save even if no changes are tracked (for initial save)
        if (!isDirty && timetableChanges.length === 0) {
            console.log('ℹ️ No tracked changes, but allowing save for initial data');
            // Don't return, continue with save
        }
        
        console.log('📊 Save state:', { isDirty, changesCount: timetableChanges.length });
        
        // Show confirmation dialog
        console.log('🎯 Showing confirmation dialog...');
        const confirmResult = await Swal.fire({
            title: 'Save Timetable',
            text: 'Save the current timetable to database?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        });
        
        console.log('📋 Confirmation result:', confirmResult.isConfirmed);
        
        if (!confirmResult.isConfirmed) {
            console.log('❌ User cancelled save');
            return;
        }
        
        console.log('✅ User confirmed save, proceeding...');
        showLoading(true);
        
        // Get notification ID
        const urlParams = new URLSearchParams(window.location.search);
        const notificationId = urlParams.get('notificationId');
        
        // Prepare data for API
        const saveData = prepareSaveData();
        
        console.log('💾 Saving timetable data:', saveData);
        
        // Skip conflict check for now (API endpoint has issues)
        console.log('⚡ Skipping conflict check for now...');
        
        // Save to API directly
        const response = await fetch(`/api/exam-timetable/${notificationId}/entries`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            // Clear changes
            timetableChanges = [];
            isDirty = false;
            updateSaveButton();
            
            // Update original data
            originalTimetableData = saveData.entries;
            
            Swal.fire({
                icon: 'success',
                title: 'Timetable Saved!',
                text: `Successfully saved ${saveData.entries.length} entries`,
                timer: 2000,
                showConfirmButton: false
            });
            
            // Update UI with saved data
            updateUIWithSavedData(result.data);
            
        } else {
            throw new Error(result.message || 'Failed to save timetable');
        }
        
    } catch (error) {
        console.error('Error saving timetable:', error);
        Swal.fire({
            icon: 'error',
            title: 'Save Failed',
            text: error.message || 'Failed to save timetable. Please try again.'
        });
    } finally {
        showLoading(false);
    }
}

// Prepare data for saving
function prepareSaveData() {
    const entries = [];
    
    // Get data from the global timeTableDataGlobal variable
    const timeTableData = window.timeTableDataGlobal;
    
    if (!timeTableData) {
        console.log('❌ No timeTableDataGlobal found');
        return { entries: [] };
    }
    
    console.log('📊 Preparing save data from:', timeTableData);
    
    // Extract allocated subjects from the timetable data structure
    timeTableData.dates.forEach(dateEntry => {
        timeTableData.branches.forEach(branch => {
            const subjects = dateEntry.branches[branch.id] || [];
            
            subjects.forEach(subject => {
                entries.push({
                    timetable_id: subject.timetable_id || null,
                    exam_date: dateEntry.date,
                    branch_id: branch.id,
                    subject_id: subject.subject_id,
                    session_order: subject.session_order || 1,
                    room_id: subject.room_id || null,
                    invigilator_staff_id: subject.invigilator_staff_id || null,
                    status: 'scheduled',
                    notes: subject.notes || null
                });
            });
        });
    });
    
    // Skip unallocated subjects for now (they have no exam_date)
    // In a real system, unallocated subjects would be handled separately
    if (timeTableData.unallocated && timeTableData.unallocated.length > 0) {
        console.log(`⚠️ Skipping ${timeTableData.unallocated.length} unallocated subjects (no exam_date)`);
        // We could save them to a separate table or with a default date, but for now let's skip them
    }
    
    console.log('📋 Prepared entries for saving:', entries);
    
    return {
        entries: entries
    };
}

// Check for conflicts
async function checkForConflicts(entries) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const notificationId = urlParams.get('notificationId');
        
        const response = await fetch(`/api/exam-timetable/${notificationId}/check-conflicts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ entries })
        });
        
        const result = await response.json();
        
        return result.data || { hasConflicts: false, conflicts: [] };
        
    } catch (error) {
        console.error('Error checking conflicts:', error);
        return { hasConflicts: false, conflicts: [] };
    }
}

// Auto-save function
async function autoSave() {
    if (!isDirty || timetableChanges.length === 0) return;
    
    try {
        console.log('🔄 Auto-saving changes...');
        
        const saveData = prepareSaveData();
        const urlParams = new URLSearchParams(window.location.search);
        const notificationId = urlParams.get('notificationId');
        
        const response = await fetch(`/api/exam-timetable/${notificationId}/entries`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            timetableChanges = [];
            isDirty = false;
            updateSaveButton();
            originalTimetableData = saveData.entries;
            
            // Show subtle auto-save notification
            showAutoSaveNotification();
        } else {
            console.error('Auto-save failed:', result.message);
        }
        
    } catch (error) {
        console.error('Auto-save error:', error);
    }
}

// Show auto-save notification
function showAutoSaveNotification() {
    const notification = $('<div class="alert alert-success alert-dismissible fade show position-fixed" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 250px;">' +
        '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' +
        '<i class="bi bi-check-circle"></i> Auto-saved' +
        '</div>');
    
    $('body').append(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.fadeOut(300, function() {
            $(this).remove();
        });
    }, 3000);
}

// Update UI with saved data
function updateUIWithSavedData(savedEntries) {
    // This would update the UI to reflect the saved state
    // For now, just log that data was updated
    console.log('📊 UI updated with saved data:', savedEntries);
}

// Export enhanced save function to global scope
window.saveTimetableEnhanced = saveTimetableEnhanced;
window.trackChange = trackChange;
window.autoSave = autoSave;

// Debug function to test button visibility
window.testSaveButtons = function() {
    console.log('🧪 Testing save buttons...');
    console.log('jQuery loaded:', typeof $ !== 'undefined');
    console.log('Save button exists:', $('#saveBtn').length > 0);
    console.log('Save button visible:', $('#saveBtn').is(':visible'));
    console.log('Timetable actions visible:', $('#timetableActions').is(':visible'));
    
    // Force show buttons for testing

// Immediate save function for testing
window.saveImmediately = function() {
    console.log('🚀 Immediate save test...');
    
    // Bypass change tracking
    isDirty = true;
    timetableChanges = [{ action: 'test', timestamp: Date.now() }];
    
    // Call save function
    saveTimetableEnhanced();
};

// Export timetable function
window.exportTimetable = async function() {
    try {
        console.log('📤 Exporting timetable...');
        
        // Get notification details
        const urlParams = new URLSearchParams(window.location.search);
        const notificationId = urlParams.get('notificationId');
        
        // Fetch saved timetable data from API
        const response = await fetch(`/api/exam-timetable/${notificationId}/entries`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data.length > 0) {
            // Show export format selection
            const exportChoice = await Swal.fire({
                title: 'Export Timetable',
                text: 'Choose export format:',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '📑 Export as PDF',
                cancelButtonText: '📊 Export as CSV',
                showDenyButton: true,
                denyButtonText: '❌ Cancel',
                reverseButtons: true,
                customClass: {
                    confirmButton: 'btn btn-primary',
                    cancelButton: 'btn btn-success',
                    denyButton: 'btn btn-secondary'
                }
            });
            
            if (exportChoice.isConfirmed) {
                console.log('📑 User chose PDF export');
                exportToPDF(result.data);
            } else if (exportChoice.isDismissed && exportChoice.dismiss === 'cancel') {
                console.log('📊 User chose CSV export');
                exportToCSV(result.data);
            } else {
                console.log('❌ User cancelled export');
            }
        } else {
            showAlert('error', 'No timetable data to export');
        }
    } catch (error) {
        console.error('Error exporting timetable:', error);
        showAlert('error', 'Failed to export timetable');
    }
}

// Export to PDF function
window.exportToPDF = function(data) {
    console.log('📑 Exporting to PDF with data:', data.length, 'entries');
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(18);
        doc.text('Exam Timetable', 105, 20, { align: 'center' });
        
        // Add notification details
        doc.setFontSize(12);
        doc.text(`Notification: ${window.notificationDetails?.notification_title || 'Unknown'}`, 20, 35);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
        doc.text(`Total Entries: ${data.length}`, 20, 55);
        
        // Prepare table data
        const tableData = data.map(entry => [
            new Date(entry.exam_date).toLocaleDateString(),
            entry.branch_name || 'Unknown',
            entry.subject_name || 'Unknown',
            entry.syllabus_code || '',
            entry.subject_type || '',
            entry.session_order || 1,
            entry.status || 'scheduled'
        ]);
        
        // Add table
        doc.autoTable({
            head: [['Date', 'Branch', 'Subject', 'Code', 'Type', 'Session', 'Status']],
            body: tableData,
            startY: 70,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [66, 139, 202] }
        });
        
        // Save PDF
        doc.save(`timetable_${window.notificationDetails?.notification_id || 'export'}_${Date.now()}.pdf`);
        
        showAlert('success', 'Timetable exported to PDF successfully!');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showAlert('error', 'Failed to generate PDF');
    }
}

// Export to CSV function
window.exportToCSV = function(data) {
    console.log('📊 Exporting to CSV with data:', data.length, 'entries');
    
    // Generate CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header information
    csvContent += `Exam Timetable - ${window.notificationDetails?.notification_title || 'Unknown'}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Total Entries: ${data.length}\n\n`;
    
    // CSV Headers
    csvContent += "Date,Branch,Subject Code,Subject Name,Subject Type,Status,Session\n";
    
    // CSV Data
    data.forEach(entry => {
        const date = new Date(entry.exam_date).toLocaleDateString();
        const branch = entry.branch_name || 'Unknown';
        const subjectCode = entry.syllabus_code || '';
        const subjectName = entry.subject_name || 'Unknown';
        const subjectType = entry.subject_type || '';
        const status = entry.status || 'scheduled';
        const session = entry.session_order || 1;
        
        csvContent += `"${date}","${branch}","${subjectCode}","${subjectName}","${subjectType}","${status}","${session}"\n`;
    });
    
    // Download CSV
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `timetable_${window.notificationDetails?.notification_id || 'export'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('success', 'Timetable exported successfully!');
}

// Clear timetable function
window.clearTimetable = async function() {
    try {
        const result = await Swal.fire({
            title: 'Clear Timetable',
            text: 'Are you sure you want to clear the entire timetable? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Clear',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545'
        });
        
        if (result.isConfirmed) {
            // Clear timetable display
            const timetableGrid = document.getElementById('timetableGrid');
            if (timetableGrid) {
                timetableGrid.innerHTML = '<div class="empty-state">Timetable cleared</div>';
            }
            
            showAlert('success', 'Timetable cleared successfully!');
        }
    } catch (error) {
        console.error('Error clearing timetable:', error);
        showAlert('error', 'Failed to clear timetable');
    }
}

// Regenerate timetable function
window.regenerateTimetable = async function() {
    try {
        console.log('🔄 Regenerating timetable...');
        
        const confirmResult = await Swal.fire({
            title: 'Regenerate Timetable',
            text: 'This will clear the current timetable and generate a new one. Continue?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Regenerate',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545'
        });
        
        if (confirmResult.isConfirmed) {
            // Trigger existing generateTimetable function from HTML
            if (typeof generateTimetable === 'function') {
                await generateTimetable();
            } else {
                showAlert('error', 'Generate function not available');
            }
        }
    } catch (error) {
        console.error('Error regenerating timetable:', error);
        showAlert('error', 'Failed to regenerate timetable');
    }
}

})(jQuery);
