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

window.exportToPDF = async function(data) {
    console.log('📑 Exporting to PDF - Official Format');

    try {
        let notificationDetails = window.notificationDetails;
        let attempts = 0;
        while (!notificationDetails && attempts < 10) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
            notificationDetails = window.notificationDetails;
        }
        if (!notificationDetails) {
            Swal.fire('Error', 'Notification details not available', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = 297;
        const pageH = 210;
        const margin = 10;

        // ─── LOAD LOGO ───────────────────────────────────────────────
        const logoUrl = 'https://i.imgur.com/e2PlQlo.png';
        let logoDataUrl = null;
        try {
            const imgResponse = await fetch(logoUrl);
            const blob = await imgResponse.blob();
            logoDataUrl = await new Promise((res, rej) => {
                const reader = new FileReader();
                reader.onload  = () => res(reader.result);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('Could not load logo:', e);
        }

        // ─── HEADER ──────────────────────────────────────────────────
        let y = margin;

        // Logo (left of center)
  // Logo only - centered, large, no text (image already contains all college details)
if (logoDataUrl) {
  const logoW = 55;
const logoH = 14;
doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, y, logoW, logoH);
y += logoH + 2;
} else {
    // Fallback only if logo fails to load
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('KAKATIYA INSTITUTE OF TECHNOLOGY & SCIENCE', pageW/2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    y += 20;
    doc.text('Office of the Controller of Examinations', pageW/2, y, { align: 'center' });
}
        // Horizontal line
        y += 3;
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 1;
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y);
        y += 4;

        // ─── REFERENCE LINE ──────────────────────────────────────────
        const examName     = notificationDetails.exam_name         || notificationDetails.notification_title || 'MSE-I';
        const programme    = notificationDetails.programme_name    || 'B.Tech';
        const semesterList = notificationDetails.semesters
            ? (Array.isArray(notificationDetails.semesters) ? notificationDetails.semesters : JSON.parse(notificationDetails.semesters))
            : [];
        const regulationList = notificationDetails.regulations
            ? (Array.isArray(notificationDetails.regulations) ? notificationDetails.regulations : JSON.parse(notificationDetails.regulations))
            : [];
        const monthYear    = notificationDetails.month_year_display || notificationDetails.month_name + ' ' + notificationDetails.year || 'FEBRUARY 2026';
        const notifId      = notificationDetails.notification_id   || '';
        const createdDate  = notificationDetails.created_at
            ? new Date(notificationDetails.created_at).toLocaleDateString('en-GB').replace(/\//g, '-')
            : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
       const session = notificationDetails.session_name || 'FN';

// Build session time from start_time and end_time fields
let sessionTime = '10:00 am to 12:00 pm'; // fallback only
if (notificationDetails.start_time && notificationDetails.end_time) {
    const fmt = t => {
        const [h, m] = t.substring(0, 5).split(':');
        const hr = parseInt(h);
        const ampm = hr >= 12 ? 'pm' : 'am';
        const hr12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
        return `${hr12}:${m} ${ampm}`;
    };
    sessionTime = `${fmt(notificationDetails.start_time)} to ${fmt(notificationDetails.end_time)}`;
} else if (notificationDetails.session_time) {
    sessionTime = notificationDetails.session_time;
}

        const semStr = semesterList.length > 0 ? semesterList.join(', ') + '-Sem' : 'VIII-Sem';
        const regStr = regulationList.length > 0 ? regulationList.join(', ') : 'URR-18R22';
        const yearNum = monthYear.split(' ')[1] || '2026';

doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
const refText = `No. ${examName} Schedule / ${programme}. ${semStr} (${regStr})/${yearNum}/`;
const refTextW = doc.getTextWidth(refText);
const dateTextW = doc.getTextWidth(`Date: ${createdDate}`);
const totalW = refTextW + dateTextW + 10;
const startX = (pageW - totalW) / 2;
doc.text(refText, startX, y);
doc.text(`Date: ${createdDate}`, startX + refTextW + 10, y);
y += 6;

        // ─── MAIN TITLE ──────────────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
       // Title from notification details - no hardcoding

        // TIME TABLE label + Examination Timings
        doc.setFontSize(11);
        doc.text('TIME TABLE', pageW / 2, y, { align: 'center' });

        // Box for Examination Timings
        const timingText = `Examination Timings : ${session} ${sessionTime}`;
        const boxW = 75, boxH = 6, boxX = pageW - margin - boxW, boxY = y - 5;
        doc.setLineWidth(0.4);
        doc.rect(boxX, boxY, boxW, boxH);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(timingText, boxX + boxW / 2, boxY + 4, { align: 'center' });
        y += 5;

        // ─── BUILD TABLE DATA ────────────────────────────────────────
        // Group by date → branch
        const groupedData  = {};
        const allBranches  = new Set();
data.forEach(entry => {
    // ✅ FIX: DB stores UTC (e.g. 2026-02-26T18:30:00.000Z = 2026-02-27 IST)
    // Must use local getDate/getMonth/getFullYear to get correct local date
    const d = new Date(entry.exam_date);
    const dy  = d.getDate();
    const mo  = d.getMonth() + 1;
    const yr  = d.getFullYear();
    const dateKey = `${String(dy).padStart(2,'0')}.${String(mo).padStart(2,'0')}.${yr}`;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const fullKey = `${dateKey}|${dayName}`;

            if (!groupedData[fullKey]) groupedData[fullKey] = {};
            const branch = entry.branch_code || entry.branch_name || 'UNK';
            if (!groupedData[fullKey][branch]) groupedData[fullKey][branch] = [];
            groupedData[fullKey][branch].push(entry);
            allBranches.add(branch);
        });

        const branchArray = Array.from(allBranches).sort();
        const dateKeys    = Object.keys(groupedData).sort((a, b) => {
            const da = a.split('|')[0].split('.').reverse().join('');
            const db = b.split('|')[0].split('.').reverse().join('');
            return da.localeCompare(db);
        });

        // ─── TABLE ───────────────────────────────────────────────────
        const tableStartY    = y + 2;
        const dateColW       = 22;
        const availableW     = pageW - margin * 2 - dateColW;
        const branchColW     = availableW / branchArray.length;
        const headerH        = 10;

      // ✅ Shared content height calculator - used for BOTH row height AND vertical centering
        function calcCellContentHeight(entries) {
            let totalH = 0;
            doc.setFontSize(6);
            entries.forEach((entry, idx) => {
                if (idx > 0) totalH += 3; // dotted divider gap
                totalH += 3.5; // syllabus code line
                const words = (entry.subject_name || '').split(' ');
                let line = '', nameLines = 0;
                words.forEach(word => {
                    const test = line ? line + ' ' + word : word;
                    if (doc.getTextWidth(test) > (branchColW - 2)) { nameLines++; line = word; }
                    else line = test;
                });
                nameLines++;
                totalH += nameLines * 3.5;
            });
            return totalH;
        }

        function calcRowHeight(fullKey) {
            let maxContentH = 0;
            branchArray.forEach(branch => {
                const h = calcCellContentHeight(groupedData[fullKey][branch] || []);
                if (h > maxContentH) maxContentH = h;
            });
            return Math.max(14, maxContentH + 6); // 6mm = equal top+bottom padding
        }

        // Pre-calculate all row heights
        const rowHeights = {};
        dateKeys.forEach(key => {
            rowHeights[key] = calcRowHeight(key);
        });

        // Table Header
        doc.setFillColor(220, 220, 220);
        doc.rect(margin, tableStartY, dateColW, headerH, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('Date & Day of', margin + dateColW / 2, tableStartY + 4, { align: 'center' });
        doc.text('Examination',   margin + dateColW / 2, tableStartY + 8, { align: 'center' });

        branchArray.forEach((branch, i) => {
            const x = margin + dateColW + i * branchColW;
            doc.setFillColor(220, 220, 220);
            doc.rect(x, tableStartY, branchColW, headerH, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(branch, x + branchColW / 2, tableStartY + 6, { align: 'center' });
        });

        // Table Rows
        let rowY = tableStartY + headerH;

        dateKeys.forEach((fullKey, rowIdx) => {
            const [dateStr, dayName] = fullKey.split('|');
            const rowH = rowHeights[fullKey]; // ✅ use per-row calculated height

            // Alternate row shading
            if (rowIdx % 2 === 0) {
                doc.setFillColor(255, 255, 255);
            } else {
                doc.setFillColor(248, 248, 248);
            }
            doc.rect(margin, rowY, pageW - margin * 2, rowH, 'FD');

            // Date cell
          // Date cell - fully auto vertical centering
            doc.setDrawColor(150, 150, 150);
            doc.rect(margin, rowY, dateColW, rowH);
            const dateLineH  = 4.5;
            const dateStartY = rowY + (rowH - dateLineH * 2) / 2 + dateLineH;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(dateStr, margin + dateColW / 2, dateStartY,             { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(dayName, margin + dateColW / 2, dateStartY + dateLineH, { align: 'center' });
            // Branch cells
            branchArray.forEach((branch, i) => {
                const x       = margin + dateColW + i * branchColW;
                const entries = groupedData[fullKey][branch] || [];

                doc.setDrawColor(150, 150, 150);
                doc.rect(x, rowY, branchColW, rowH);

                // ✅ Auto vertical center using same shared function
                const contentH = calcCellContentHeight(entries);
                let cellY = rowY + (rowH - contentH) / 2;
                    entries.forEach((entry, entryIdx) => {
                    const subjectCode = entry.syllabus_code || '';
                    const subjectName = entry.subject_name  || '';

                    // ─── Dotted divider between subjects ───
                    if (entryIdx > 0) {
                        doc.setLineWidth(0.2);
                        doc.setDrawColor(180, 180, 180);
                        const dashW = 1.5, gapW = 1.5;
                        let dashX = x + 2;
                        while (dashX < x + branchColW - 2) {
                            doc.line(dashX, cellY, Math.min(dashX + dashW, x + branchColW - 2), cellY);
                            dashX += dashW + gapW;
                        }
                        doc.setDrawColor(150, 150, 150); // reset
                        cellY += 3;
                    }

                    // ─── Syllabus code ───
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6);
                    doc.text(subjectCode, x + branchColW / 2, cellY, { align: 'center' });
                    cellY += 3.5;

                    // ─── Subject name (word wrap, no "Theory" label) ───
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                    const words    = subjectName.split(' ');
                    let   line     = '';
                    const maxWidth = branchColW - 2;

                    words.forEach(word => {
                        const testLine = line ? line + ' ' + word : word;
                        const testW    = doc.getTextWidth(testLine);
                        if (testW > maxWidth && line) {
                            doc.text(line, x + branchColW / 2, cellY, { align: 'center' });
                            cellY += 3.5;
                            line = word;
                        } else {
                            line = testLine;
                        }
                    });
                    if (line) {
                        doc.text(line, x + branchColW / 2, cellY, { align: 'center' });
                        cellY += 3.5;
                    }
                });
            });

            rowY += rowH;

            // Add new page if needed
          
        });

        // ─── NOTE BOX ────────────────────────────────────────────────
        // ─── NOTE BOX ────────────────────────────────────────────────
        const noteY = rowY + 4;
        doc.setLineWidth(0.4);
        doc.rect(margin + 30, noteY, pageW - margin * 2 - 60, 7);

        const notePrefix     = 'Candidate should occupy his/her seat at least ';
        const underlinedText = '10 minutes before';
        const suffix         = ' the commencement of the examination.';
        const fullNote       = notePrefix + underlinedText + suffix;
        const prefixW        = doc.getTextWidth(notePrefix);
        const underW         = doc.getTextWidth(underlinedText);
        const noteStartX     = pageW / 2 - doc.getTextWidth(fullNote) / 2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(fullNote, pageW / 2, noteY + 4.5, { align: 'center' });
        doc.setLineWidth(0.3);
        doc.line(noteStartX + prefixW, noteY + 5.5, noteStartX + prefixW + underW, noteY + 5.5);

        // ─── FOOTER ──────────────────────────────────────────────────
        const footerY = noteY + 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('To: Exam Branch Notice Boards', margin, footerY);
        doc.text('Copy to:  1. Principal for favour of information   2. Dean, Academic Affairs', margin, footerY + 5);
        doc.text('3. HOD\'s - with a request to display in the Dept Notice Boards & share in the Faculty & Class WhatsApp groups', margin, footerY + 9);
        doc.text('4. Training & Placement Officer   5. Web Team - with a request to display on the website', margin, footerY + 13);

        // Signature block (right side)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Controller of Examinations', pageW - margin, footerY + 18, { align: 'right' });

        // ─── SAVE ────────────────────────────────────────────────────
        doc.save(`timetable_${notifId}_${Date.now()}.pdf`);
        Swal.fire('Success', 'Official timetable PDF exported successfully!', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
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
window.clearTimetable = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    const confirm = await Swal.fire({
        title: 'Clear Timetable?',
        text: 'This will delete all saved entries from the database.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Clear it',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545'
    });

    if (!confirm.isConfirmed) return;

    try {
     // Clear by sending empty entries array via PUT (no DELETE endpoint needed)
const response = await fetch(`/api/exam-timetable/${notificationId}/entries`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: [] })
});
const result = await response.json();

// Whether API succeeds or not, clear the screen
document.getElementById('timeTableDisplay').style.display = 'none';
document.getElementById('timetableActions').style.display = 'none';

// Reset global data
if (typeof timeTableDataGlobal !== 'undefined') {
    timeTableDataGlobal = null;
}

Swal.fire('Cleared!', 'Timetable cleared. Now click Generate Initial Time Table, then Save.', 'success');
    } catch (error) {
        Swal.fire('Error', 'Failed to clear: ' + error.message, 'error');
    }
}

window.saveTimetable = async function() {
    const urlParams      = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    if (!timeTableDataGlobal) {
        Swal.fire('Error', 'No timetable data to save. Generate first.', 'error');
        return;
    }

    try {
        Swal.fire({ title: 'Saving...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // ✅ Always fetch fresh notification details to get batch_id and batch_name
        let batch_id   = window.notificationDetails?.batch_id   || null;
        let batch_name = window.notificationDetails?.batch_name || null;

        // If not in memory, fetch from API
        if (!batch_id) {
            try {
                const notifRes    = await fetch(`/api/exam-notifications/${notificationId}`);
                const notifResult = await notifRes.json();
                if (notifResult.status === 'success') {
                    batch_id   = notifResult.data.batch_id   || null;
                    batch_name = notifResult.data.batch_name || null;
                    console.log('✅ Fetched batch from API:', batch_id, batch_name);
                }
            } catch (e) {
                console.warn('Could not fetch batch details:', e);
            }
        }

        const entries = [];

        timeTableDataGlobal.dates.forEach(dateEntry => {
            timeTableDataGlobal.branches.forEach(branch => {
                const subjects = dateEntry.branches[branch.id] || [];
                subjects.forEach(subject => {
                    entries.push({
                        notification_id: notificationId,
                        exam_date:       dateEntry.date,
                        branch_id:       branch.id,
                        branch_code:     branch.code,
                        subject_id:      subject.subject_id,
                        syllabus_code:   subject.syllabus_code,
                        subject_name:    subject.subject_name,
                        subject_type:    subject.subject_type || 'Theory',
                        status:          'scheduled',
                        session_order:   1,
                        batch_id:        batch_id,
                        batch_name:      batch_name
                    });
                });
            });
        });

        const response = await fetch(`/api/exam-timetable/${notificationId}/entries`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries })
        });

        const result = await response.json();
        Swal.close();

        if (result.status === 'success') {
            Swal.fire('Saved!', `${entries.length} timetable entries saved successfully.`, 'success');
            if (typeof showStudentDataButtons === 'function') showStudentDataButtons();
        } else {
            Swal.fire('Error', result.message || 'Failed to save', 'error');
        }
    } catch (error) {
        Swal.close();
        Swal.fire('Error', 'Failed to save: ' + error.message, 'error');
    }
}

// ↓ this line was already there - don't touch it
console.log('✅ Export functions loaded successfully!');
