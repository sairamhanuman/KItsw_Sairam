// Export functionality for timetable
console.log('🔧 Loading export functions...');

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
            Swal.fire('Error', 'No timetable data to export', 'error');
        }
    } catch (error) {
        console.error('Error exporting timetable:', error);
        Swal.fire('Error', 'Failed to export timetable', 'error');
    }
}

// Export to PDF function
window.exportToPDF = function(data) {
    console.log('📑 Exporting to PDF with data:', data.length, 'entries');
    
    try {
        const { jsPDF } = window.jspdf;
        
        // Create landscape PDF
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        // Set font for better rendering
        doc.setFont('helvetica');
        
        // Header Section
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('EXAM TIMETABLE', 148, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('B.TECH. - I YEAR - I SEMESTER', 148, 30, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text('FEBRUARY 2026', 148, 40, { align: 'center' });
        
        // Institution Details
        doc.setFontSize(10);
        doc.text('VIDYA JYOTHI INSTITUTE OF ENGINEERING & TECHNOLOGY', 148, 50, { align: 'center' });
        doc.text('Autonomous, Affiliated to JNTUH, Approved by AICTE, New Delhi', 148, 57, { align: 'center' });
        doc.text('Vijayawada - 521009, Andhra Pradesh, India', 148, 64, { align: 'center' });
        
        // Line separator
        doc.setLineWidth(0.5);
        doc.line(15, 75, 285, 75);
        
        // Group data by date and extract unique branches
        const groupedData = {};
        const allBranches = new Set();
        
        data.forEach(entry => {
            const date = new Date(entry.exam_date).toLocaleDateString('en-GB');
            if (!groupedData[date]) {
                groupedData[date] = {};
            }
            
            const branch = entry.branch_name || 'Unknown';
            const session = entry.session_order || 1;
            const sessionKey = session === 1 ? 'FN' : 'AN';
            
            if (!groupedData[date][branch]) {
                groupedData[date][branch] = {};
            }
            
            groupedData[date][branch][sessionKey] = entry;
            allBranches.add(branch);
        });
        
        const branchArray = Array.from(allBranches).sort();
        const dates = Object.keys(groupedData).sort();
        
        // Layout dimensions
        const leftMargin = 15;
        const topMargin = 85;
        const dateColWidth = 25;
        const branchColWidth = (270 - dateColWidth) / branchArray.length;
        
        let currentY = topMargin;
        
        // Process each date
        dates.forEach((date, dateIndex) => {
            // Date row
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(date, leftMargin, currentY);
            
            currentY += 8;
            
            // Branch headers row
            let currentX = leftMargin + dateColWidth;
            branchArray.forEach(branch => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(branch, currentX, currentY);
                currentX += branchColWidth;
            });
            
            currentY += 6;
            
            // FN/AN session headers
            currentX = leftMargin + dateColWidth;
            branchArray.forEach(branch => {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text('FN', currentX, currentY);
                doc.text('AN', currentX + branchColWidth/2, currentY);
                currentX += branchColWidth;
            });
            
            currentY += 6;
            
            // Subject data for each branch and session
            branchArray.forEach(branch => {
                const dateData = groupedData[date][branch] || {};
                const fnEntry = dateData['FN'] || {};
                const anEntry = dateData['AN'] || {};
                
                currentX = leftMargin + dateColWidth;
                
                // FN session data
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                
                const fnSubject = fnEntry.subject_name || '';
                const fnCode = fnEntry.syllabus_code || '';
                const fnType = fnEntry.subject_type || '';
                
                if (fnSubject) {
                    // Truncate if needed
                    const maxSubjectLength = Math.floor(branchColWidth/2.5);
                    const truncatedSubject = fnSubject.length > maxSubjectLength ? 
                        fnSubject.substring(0, maxSubjectLength - 3) + '...' : fnSubject;
                    
                    doc.text(truncatedSubject, currentX, currentY);
                    currentY += 4;
                    doc.text(fnCode, currentX, currentY);
                    currentY += 4;
                    doc.text(fnType, currentX, currentY);
                } else {
                    doc.text('-', currentX, currentY);
                    currentY += 4;
                    doc.text('-', currentX, currentY);
                    currentY += 4;
                    doc.text('-', currentX, currentY);
                }
                
                // AN session data
                const anSubject = anEntry.subject_name || '';
                const anCode = anEntry.syllabus_code || '';
                const anType = anEntry.subject_type || '';
                
                currentX += branchColWidth/2;
                currentY -= 12; // Go back up for AN session
                
                if (anSubject) {
                    const maxSubjectLength = Math.floor(branchColWidth/2.5);
                    const truncatedSubject = anSubject.length > maxSubjectLength ? 
                        anSubject.substring(0, maxSubjectLength - 3) + '...' : anSubject;
                    
                    doc.text(truncatedSubject, currentX, currentY);
                    currentY += 4;
                    doc.text(anCode, currentX, currentY);
                    currentY += 4;
                    doc.text(anType, currentX, currentY);
                } else {
                    doc.text('-', currentX, currentY);
                    currentY += 4;
                    doc.text('-', currentX, currentY);
                    currentY += 4;
                    doc.text('-', currentX, currentY);
                }
                
                currentY += 4; // Space between branches
            });
            
            currentY += 10; // Space between dates
            
            // Add page break if needed
            if (currentY > 180) {
                doc.addPage();
                currentY = topMargin;
            }
        });
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Page ${i} of ${pageCount}`, 148, 200, { align: 'center' });
        }
        
        // Save PDF
        doc.save(`timetable_${window.notificationDetails?.notification_id || 'export'}_${Date.now()}.pdf`);
        
        Swal.fire('Success', 'Timetable exported to PDF successfully!', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        Swal.fire('Error', 'Failed to generate PDF', 'error');
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
    
    Swal.fire('Success', 'Timetable exported successfully!', 'success');
}

console.log('✅ Export functions loaded successfully!');
