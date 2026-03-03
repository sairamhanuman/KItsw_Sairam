// Generate Timetable JavaScript with Advanced Drag-and-Drop
$(document).ready(function() {
    console.log('🚀 Generate Timetable page loaded');
    
    // Get notification ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');
    
    if (!notificationId) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Notification ID not provided'
        }).then(() => {
            window.location.href = '/view-notifications.html';
        });
        return;
    }
    
    // Global variables
    let notificationDetails = null;
    let timetableData = [];
    let unassignedSubjects = [];
    let draggedSubject = null;
    let sortableInstances = [];
    
    // Initialize page
    loadNotificationDetails();
    
    // Wait for DOM to be ready, then initialize event listeners
    $(document).ready(function() {
        // Event listeners - only attach if elements exist
        if ($('#generateBtn').length) {
            $('#generateBtn').on('click', generateInitialTimetable);
        }
        
        // Use vanilla JavaScript for save buttons to match visibility approach
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveTimetable);
            console.log('✅ Save button event listener attached');
        }
        
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportTimetable);
            console.log('✅ Export button event listener attached');
        }
        
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearTimetable);
            console.log('✅ Clear button event listener attached');
        }
        
        const regenerateBtn = document.getElementById('regenerateBtn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', regenerateTimetable);
            console.log('✅ Regenerate button event listener attached');
        }
        
        // Manual button trigger for testing
        window.showSaveButtons = function() {
            console.log('🎯 Manually showing save buttons...');
            $('#generateBtn').hide();
            $('#timetableActions').show();
            $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').show();
            console.log('✅ Save buttons should now be visible');
        };
        
        // Test button functionality
        window.testButtons = function() {
            console.log('🧪 Testing button functionality...');
            
            ['saveBtn', 'exportBtn', 'clearBtn', 'regenerateBtn'].forEach(id => {
                const btn = document.getElementById(id);
                console.log(`📋 ${id}:`, {
                    exists: !!btn,
                    visible: btn ? btn.style.display !== 'none' : false,
                    hasListener: btn ? btn.hasAttribute('data-listener') : false
                });
            });
            
            console.log('🎯 Try clicking each button to test functionality');
        };
        
        console.log('🚀 Ready! Type testButtons() in console to verify button functionality');
        
        console.log('🚀 Ready! Type showSaveButtons() in console to manually show buttons');
    });
});

// Load notification details
async function loadNotificationDetails() {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/exam-notifications/${notificationId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            notificationDetails = result.data;
            displayNotificationInfo();
            
            // Load existing timetable if already generated
            if (notificationDetails.timetable_generated) {
                await loadExistingTimetable();
            } else {
                $('#generateBtn').show();
                $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').hide();
            }
            
        } else {
            Swal.fire('Error', result.message || 'Failed to load notification details', 'error');
        }
        
    } catch (error) {
        console.error('Error loading notification details:', error);
        Swal.fire('Error', 'Failed to load notification details', 'error');
    } finally {
        showLoading(false);
    }
}

// Display notification information
function displayNotificationInfo() {
    const workingDays = countWorkingDays(notificationDetails.start_date, notificationDetails.end_date);
    
    const infoHTML = `
        <div class="row">
            <div class="col-md-3">
                <strong>Notification Code:</strong><br>
                <span class="text-primary">${notificationDetails.notification_code}</span>
            </div>
            <div class="col-md-3">
                <strong>Programme:</strong><br>
                <span>${notificationDetails.programme_name || 'N/A'}</span>
            </div>
            <div class="col-md-3">
                <strong>Exam Name:</strong><br>
                <span>${notificationDetails.exam_name}</span>
            </div>
            <div class="col-md-3">
                <strong>Status:</strong><br>
                ${getStatusBadge(notificationDetails.status)}
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-3">
                <strong>Date Range:</strong><br>
                <span>${formatDate(notificationDetails.start_date)} - ${formatDate(notificationDetails.end_date)}</span>
            </div>
            <div class="col-md-3">
                <strong>Working Days:</strong><br>
                <span class="badge bg-info">${workingDays} days</span>
            </div>
            <div class="col-md-3">
                <strong>Semesters:</strong><br>
                <span>${notificationDetails.semester_names || 'N/A'}</span>
            </div>
            <div class="col-md-3">
                <strong>Regulations:</strong><br>
                <span>${notificationDetails.regulation_names || 'N/A'}</span>
            </div>
        </div>
    `;
    
    $('#notificationDetails').html(infoHTML);
}

// Generate initial timetable
async function generateInitialTimetable() {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/exam-timetable/generate/${notificationId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Timetable Generated!',
                html: `
                    <p>Initial timetable generated successfully!</p>
                    <p><strong>${result.data.scheduled_entries}</strong> subjects scheduled</p>
                    <p><strong>${result.data.unassigned_subjects}</strong> subjects unassigned</p>
                `
            });
            
            // Load the generated timetable
            await loadExistingTimetable();
            
            // Show action buttons
            $('#generateBtn').hide();
            $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').show();
            
        } else {
            Swal.fire('Error', result.message || 'Failed to generate timetable', 'error');
        }
        
    } catch (error) {
        console.error('Error generating timetable:', error);
        Swal.fire('Error', 'Failed to generate timetable', 'error');
    } finally {
        showLoading(false);
    }
}

// Load existing timetable
async function loadExistingTimetable() {
    try {
        showLoading(true);
        
        console.log('🔍 Loading existing timetable for notification:', notificationId);
        
        // Load timetable entries
        const timetableResponse = await fetch(`/api/exam-notifications/${notificationId}/timetable`);
        console.log('📋 Timetable response status:', timetableResponse.status);
        const timetableResult = await timetableResponse.json();
        console.log('📋 Timetable result:', timetableResult);
        
        // Load unassigned subjects
        const unassignedResponse = await fetch(`/api/exam-notifications/${notificationId}/unassigned`);
        console.log('📋 Unassigned response status:', unassignedResponse.status);
        const unassignedResult = await unassignedResponse.json();
        console.log('📋 Unassigned result:', unassignedResult);
        
        if (timetableResult.status === 'success' && unassignedResult.status === 'success') {
            console.log('✅ API calls successful');
            timetableData = timetableResult.data || [];
            unassignedSubjects = unassignedResult.data || [];
            
            console.log('📊 Timetable data length:', timetableData.length);
            console.log('📊 Unassigned subjects length:', unassignedSubjects.length);
            
        displayTimetable();
displayUnassignedSubjects();
updateStatistics();
initializeAllDragAndDrop();
            
            // ALWAYS show action buttons after loading
            console.log('🎯 Showing action buttons...');
            $('#generateBtn').hide();
            $('#timetableActions').show();
            $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').show();
            console.log('✅ Action buttons should now be visible');
            
        } else {
            console.error('❌ API calls failed:', { timetableResult, unassignedResult });
            Swal.fire('Error', 'Failed to load timetable data', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error loading existing timetable:', error);
        // Still show action buttons even on error
        console.log('🎯 Showing action buttons due to error...');
        $('#generateBtn').hide();
        $('#timetableActions').show();
        $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').show();
        console.log('✅ Action buttons shown despite error');
        Swal.fire('Error', 'Failed to load timetable', 'error');
    } finally {
        showLoading(false);
    }
}

// Display timetable
function displayTimetable() {
    if (timetableData.length === 0) {
        $('#timetableGrid').html('<div class="empty-state">No timetable entries found</div>');
        // Still show action buttons even when no timetable data
        $('#timetableActions').show();
        $('#saveBtn, #exportBtn, #clearBtn, #regenerateBtn').show();
        return;
    }
    
    // Group timetable entries by date and branch
    const groupedData = {};
    const dates = [...new Set(timetableData.map(entry => entry.exam_date))].sort();
    const branches = [...new Set(timetableData.map(entry => entry.branch_id))];
    
    dates.forEach(date => {
        groupedData[date] = {};
        branches.forEach(branch => {
            groupedData[date][branch] = timetableData.filter(
                entry => entry.exam_date === date && entry.branch_id == branch
            );
        });
    });
    
    // Create grid HTML
    let gridHTML = '<div class="timetable-grid">';
    
    // Header row
    gridHTML += '<div class="grid-cell header">Date/Branch</div>';
    branches.forEach(branchId => {
        const branch = timetableData.find(entry => entry.branch_id == branchId);
        gridHTML += `<div class="grid-cell branch-header">${branch ? branch.branch_name : `Branch ${branchId}`}</div>`;
    });
    
    // Data rows
    dates.forEach(date => {
        gridHTML += `<div class="grid-cell date-header">${formatDate(date)}</div>`;
        
        branches.forEach(branchId => {
            const subjects = groupedData[date][branchId];
            
            if (subjects.length > 0) {
                gridHTML += '<div class="grid-cell timetable-cell" data-date="' + date + '" data-branch="' + branchId + '">';
                subjects.forEach(subject => {
                    gridHTML += createSubjectCard(subject);
                });
                gridHTML += '</div>';
            } else {
                gridHTML += `
                    <div class="grid-cell timetable-cell drop-zone" data-date="${date}" data-branch="${branchId}">
                        <div class="empty-cell">Drop subjects here</div>
                    </div>
                `;
            }
        });
    });
    
    gridHTML += '</div>';
    $('#timetableGrid').html(gridHTML);
    
    // Initialize drag and drop
    initializeDragAndDrop();
}

// Create subject card HTML
function createSubjectCard(subject) {
    const typeClass = subject.is_elective ? 'elective' : (subject.subject_type === 'Practical' ? 'practical' : 'theory');
    const typeBadge = subject.is_elective ? 'Elective' : subject.subject_type;
    
    return `
        <div class="subject-card ${typeClass}" 
             draggable="true" 
             data-timetable-id="${subject.timetable_id}"
             data-subject-id="${subject.subject_id}"
             data-branch-id="${subject.branch_id}">
            <div class="subject-type type-${typeClass.toLowerCase()}">${typeBadge}</div>
            <div class="subject-code">${subject.syllabus_code}</div>
            <div class="subject-name">${subject.subject_name}</div>
            ${subject.elective_name ? `<div class="elective-name">${subject.elective_name}</div>` : ''}
        </div>
    `;
}

// Display unassigned subjects
function displayUnassignedSubjects() {
    if (unassignedSubjects.length === 0) {
        $('#unassignedSection').hide();
        return;
    }
    
    $('#unassignedSection').show();
    $('#unassignedCount').text(unassignedSubjects.length);
    
    // Group by branch
    const groupedByBranch = {};
    unassignedSubjects.forEach(subject => {
        if (!groupedByBranch[subject.branch_id]) {
            groupedByBranch[subject.branch_id] = {
                branch_name: subject.branch_name,
                subjects: []
            };
        }
        groupedByBranch[subject.branch_id].subjects.push(subject);
    });
    
    let gridHTML = '<div class="unassigned-grid">';
    
    Object.keys(groupedByBranch).forEach(branchId => {
        const branch = groupedByBranch[branchId];
        gridHTML += `
            <div class="unassigned-branch">
                <div class="unassigned-branch-title">${branch.branch_name} (${branch.subjects.length})</div>
                <div class="unassigned-subjects" data-branch="${branchId}">
        `;
        
        branch.subjects.forEach(subject => {
            gridHTML += createUnassignedSubjectCard(subject);
        });
        
        gridHTML += '</div></div>';
    });
    
    gridHTML += '</div>';
    $('#unassignedGrid').html(gridHTML);
    
    // Initialize drag and drop for unassigned subjects
    initializeUnassignedDragDrop();
}

// Create unassigned subject card HTML
function createUnassignedSubjectCard(subject) {
    const typeClass = subject.is_elective ? 'elective' : (subject.subject_type === 'Practical' ? 'practical' : 'theory');
    const typeBadge = subject.is_elective ? 'Elective' : subject.subject_type;
    
    return `
        <div class="subject-card ${typeClass}" 
             draggable="true" 
             data-unassigned-id="${subject.unassigned_id}"
             data-subject-id="${subject.subject_id}"
             data-branch-id="${subject.branch_id}">
            <div class="subject-type type-${typeClass.toLowerCase()}">${typeBadge}</div>
            <div class="subject-code">${subject.syllabus_code}</div>
            <div class="subject-name">${subject.subject_name}</div>
            ${subject.elective_name ? `<div class="elective-name">${subject.elective_name}</div>` : ''}
        </div>
    `;
}

// Initialize drag and drop
function initializeAllDragAndDrop() {
    // Destroy existing sortable instances
    sortableInstances.forEach(instance => instance.destroy());
    sortableInstances = [];
    
    // Initialize sortable for combined timetable
    document.querySelectorAll('#combinedTimetable tbody').forEach(tbody => {
        const sortable = new Sortable(tbody, {
            group: {
                name: 'timetable',
                pull: true,
                put: true
            },
            animation: 150,
            ghostClass: 'dragging',
            dragClass: 'dragging',
            onAdd: function(evt) {
                handleSubjectMove(evt);
            },
            onUpdate: function(evt) {
                handleSubjectReorder(evt);
            }
        });
        sortableInstances.push(sortable);
    });

    console.log("Single Table Drag and Drop Initialized");
}

// Handle moves to unassigned section
async function handleUnassignedMove(evt) {
    const item = evt.item;
    const fromId = evt.from.id;
    const toId = evt.to.id;
    
    // Check if moving from main timetable to unassigned
    if (fromId === 'mainTimetable' && toId === 'unallocatedTable') {
        const timetableId = item.dataset.timetableId;
        const branchId = item.dataset.branchId;
        
        try {
            // Call API to unassign subject
            const response = await fetch('/api/exam-timetable/unassign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    timetable_id: timetableId
                })
            });
            
            if (response.ok) {
                Swal.fire('Success', 'Subject moved to unassigned', 'success');
                await loadExistingTimetable();
            } else {
                Swal.fire('Error', 'Failed to unassign subject', 'error');
            }
        } catch (error) {
            console.error('Error unassigning subject:', error);
            Swal.fire('Error', 'Failed to unassign subject', 'error');
        }
    }
}

// Initialize unassigned subjects drag and drop
function initializeUnassignedDragDrop() {
    $('.unassigned-subjects').each(function() {
        const sortable = new Sortable(this, {
            group: {
                name: 'timetable',
                pull: 'clone',
                put: false
            },
            animation: 150,
            ghostClass: 'dragging',
            dragClass: 'dragging',
            sort: false
        });
        sortableInstances.push(sortable);
    });
}

// Handle subject move between cells
async function handleSubjectMove(evt) {
    const $cell = $(evt.to);
    const date = $cell.data('date');
    const branchId = $cell.data('branch');
    const $subject = $(evt.item);
    
    // Check if it's from unassigned subjects
    const unassignedId = $subject.data('unassigned-id');
    
    if (unassignedId) {
        // Move from unassigned to timetable
        await assignSubjectToTimetable(unassignedId, date, branchId);
    } else {
        // Move within timetable
        const timetableId = $subject.data('timetable-id');
        await updateTimetableEntry(timetableId, date, branchId);
    }
}

// Handle subject reorder within same cell
async function handleSubjectReorder(evt) {
    // For now, reordering within the same cell doesn't change anything
    // In the future, this could handle session ordering
    console.log('Subject reordered within cell');
}

// Assign subject to timetable
async function assignSubjectToTimetable(unassignedId, date, branchId) {
    try {
        const response = await fetch('/api/exam-timetable/assign-subject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unassigned_id: unassignedId,
                exam_date: date,
                branch_id: branchId
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Subject Assigned!',
                text: 'Subject has been moved to the timetable',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            
            // Reload timetable
            await loadExistingTimetable();
        } else {
            Swal.fire('Error', result.message || 'Failed to assign subject', 'error');
            // Reload to restore original state
            await loadExistingTimetable();
        }
        
    } catch (error) {
        console.error('Error assigning subject:', error);
        Swal.fire('Error', 'Failed to assign subject', 'error');
        await loadExistingTimetable();
    }
}

// Update timetable entry
async function updateTimetableEntry(timetableId, date, branchId) {
    try {
        const response = await fetch('/api/exam-timetable/update-entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timetable_id: timetableId,
                new_exam_date: date,
                new_branch_id: branchId
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Subject Moved!',
                text: 'Subject has been moved to the new position',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
        } else {
            Swal.fire('Error', result.message || 'Failed to move subject', 'error');
            await loadExistingTimetable();
        }
        
    } catch (error) {
        console.error('Error updating timetable entry:', error);
        Swal.fire('Error', 'Failed to move subject', 'error');
        await loadExistingTimetable();
    }
}

// Save timetable
async function saveTimetable() {
    try {
        const result = await Swal.fire({
            title: 'Save Timetable',
            text: 'Are you sure you want to save the current timetable?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Save',
            cancelButtonText: 'Cancel'
        });
        
        if (!result.isConfirmed) return;
        
        showLoading(true);
        
        // The timetable is already saved in real-time through the API calls
        // Just show success message
        Swal.fire({
            icon: 'success',
            title: 'Timetable Saved!',
            text: 'All changes have been saved successfully'
        });
        
    } catch (error) {
        console.error('Error saving timetable:', error);
        Swal.fire('Error', 'Failed to save timetable', 'error');
    } finally {
        showLoading(false);
    }
}

// Export timetable
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
            // Fallback to current data if API fails
            if (timetableData.length > 0) {
                exportToCSV(timetableData);
            } else {
                showAlert('error', 'No timetable data to export');
            }
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
        doc.text(`Notification: ${notificationDetails.notification_title}`, 20, 35);
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
        doc.save(`timetable_${notificationDetails.notification_id}_${Date.now()}.pdf`);
        
        showAlert('success', 'Timetable exported to PDF successfully!');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showAlert('error', 'Failed to generate PDF');
    }
}

// Export to CSV function
window.exportToCSV = function(data) {
    console.log('📊 Exporting to CSV with data:', data.length, 'entries');
    
    // Generate CSV or Excel export
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add header information
    csvContent += `Exam Timetable - ${notificationDetails.notification_title}\n`;
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
    link.setAttribute("download", `timetable_${notificationDetails.notification_id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('success', 'Timetable exported successfully!');
}

// Clear timetable
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
            // Clear the timetable display
            $('#timetableGrid').html('<div class="empty-state">Timetable cleared</div>');
            timetableData = [];
            
            showAlert('success', 'Timetable cleared successfully!');
        }
    } catch (error) {
        console.error('Error clearing timetable:', error);
        showAlert('error', 'Failed to clear timetable');
    }
}

// Regenerate timetable
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
            await generateInitialTimetable();
        }
    } catch (error) {
        console.error('Error regenerating timetable:', error);
        showAlert('error', 'Failed to regenerate timetable');
    }
}

// Update statistics
function updateStatistics() {
    const totalSubjects = timetableData.length + unassignedSubjects.length;
    const scheduledSubjects = timetableData.length;
    const unassignedCount = unassignedSubjects.length;
    const examDays = [...new Set(timetableData.map(entry => entry.exam_date))].length;
    
    $('#totalSubjects').text(totalSubjects);
    $('#scheduledSubjects').text(scheduledSubjects);
    $('#unassignedSubjects').text(unassignedCount);
    $('#examDays').text(examDays);
}

// Utility functions
function countWorkingDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday or Saturday
            workingDays++;
        }
    }
    
    return workingDays;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge bg-warning">Draft</span>',
        'active': '<span class="badge bg-success">Active</span>',
        'completed': '<span class="badge bg-info">Completed</span>',
        'cancelled': '<span class="badge bg-danger">Cancelled</span>'
    };
    return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

function showLoading(show) {
    if (show) {
        $('#loadingSpinner').show();
        $('#timetableGrid').hide();
        $('#unassignedSection').hide();
    } else {
        $('#loadingSpinner').hide();
        $('#timetableGrid').show();
    }
}

function viewNotifications() {
    window.location.href = '/view-notifications.html';
}

// Keyboard shortcuts
$(document).on('keydown', function(e) {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if ($('#saveBtn').is(':visible')) {
            saveTimetable();
        }
    }
    
    // Ctrl/Cmd + E to export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if ($('#exportBtn').is(':visible')) {
            exportTimetable();
        }
    }
    
    // Ctrl/Cmd + R to regenerate
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if ($('#regenerateBtn').is(':visible')) {
            regenerateTimetable();
        }
    }
    
    // Escape to go back
    if (e.key === 'Escape') {
        viewNotifications();
    }
});
