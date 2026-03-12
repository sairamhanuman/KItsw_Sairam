// Export functionality for timetable
console.log('🔧 Loading export functions...');

// ─────────────────────────────────────────────────────────────────────────────
// CORE FIX: Read timetable state directly from the DOM
// This is the ONLY source of truth after drag-drop changes.
// timeTableDataGlobal is stale after user edits — never use it for save/export.
// ─────────────────────────────────────────────────────────────────────────────
function readTimetableFromDOM() {
    const rows = document.querySelectorAll('#combinedTimetable tbody tr[data-status="assigned"]');
    if (rows.length === 0) return null;

    const entries = [];
    rows.forEach(row => {
        const date       = row.dataset.date;
        const branchId   = row.dataset.branchId;
        const subjectId  = row.dataset.subjectId;
        const syllabus   = row.dataset.syllabus   || row.querySelector('.syllabus-code')?.textContent?.replace('⋮⋮','').trim() || '';
        const subjectName = row.dataset.subjectName || row.querySelector('.subject-name')?.textContent?.replace('⋮⋮','').trim() || '';

        if (!date || !branchId || !subjectId) return; // skip empty/unassigned rows

        // Get branch info from timeTableDataGlobal (just for code/name lookup)
        let branchCode = branchId;
        let branchName = branchId;
        if (timeTableDataGlobal?.branchesMap?.[branchId]) {
            branchCode = timeTableDataGlobal.branchesMap[branchId].code;
            branchName = timeTableDataGlobal.branchesMap[branchId].name;
        } else {
            // fallback: read branch code from the branch cell in the row
            const branchCell = row.querySelector('td:nth-child(3)');
            if (branchCell) branchCode = branchCell.textContent.trim();
        }

        entries.push({
            exam_date:    date,
            branch_id:    parseInt(branchId),
            branch_code:  branchCode,
            branch_name:  branchName,
            subject_id:   parseInt(subjectId),
            syllabus_code: syllabus,
            subject_name:  subjectName,
            subject_type:  'Theory',
            status:        'scheduled',
            session_order: 1
        });
    });

    console.log(`📋 Read ${entries.length} ASSIGNED entries from DOM`);
    return entries.length > 0 ? entries : null;
}

// ─── Export timetable ────────────────────────────────────────────────────────
window.exportTimetable = async function() {
    try {
        console.log('📤 Exporting timetable...');

        // ✅ Always read from DOM first (reflects all drag-drop changes)
        let exportData = readTimetableFromDOM();
        let dataSource = 'screen';

        if (!exportData) {
            // Fallback: fetch from DB if DOM has nothing
            const urlParams      = new URLSearchParams(window.location.search);
            const notificationId = urlParams.get('notificationId');
            console.log('⚠️ DOM empty — fetching from database...');
            try {
                const response = await fetch(`/api/exam-timetable/${notificationId}/entries`);
                const result   = await response.json();
                if (result.status === 'success' && result.data.length > 0) {
                    exportData = result.data;
                    dataSource = 'database';
                }
            } catch (e) { console.error('DB fetch failed:', e); }
        }

        if (!exportData || exportData.length === 0) {
            Swal.fire('Error', 'No timetable data to export.', 'error');
            return;
        }

        console.log(`📊 Exporting ${exportData.length} entries from ${dataSource}`);

        const exportChoice = await Swal.fire({
            title: 'Export Timetable',
            html: `Exporting <strong>${exportData.length}</strong> entries (current screen view).<br>
                   <small class="text-warning">⚠️ Save first if you want DB and PDF to match.</small>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '📑 Export as PDF',
            cancelButtonText: '📊 Export as CSV',
            showDenyButton: true,
            denyButtonText: '❌ Cancel',
            reverseButtons: true,
        });

        if (exportChoice.isConfirmed)                                        exportToPDF(exportData);
        else if (exportChoice.isDismissed && exportChoice.dismiss === 'cancel') exportToCSV(exportData);

    } catch (error) {
        console.error('Error exporting:', error);
        Swal.fire('Error', 'Failed to export: ' + error.message, 'error');
    }
}

// ─── Export to PDF ───────────────────────────────────────────────────────────
window.exportToPDF = async function(data) {
    console.log('📑 Exporting to PDF');

    try {
        const urlParams      = new URLSearchParams(window.location.search);
        const notificationId = urlParams.get('notificationId');
        let nd = window.notificationDetails;

        if (!nd) {
            const res = await fetch(`/api/exam-notifications/${notificationId}`);
            const r   = await res.json();
            if (r.status === 'success' && r.data) {
                nd = window.notificationDetails = r.data;
            } else {
                Swal.fire('Error', 'Could not load notification details.', 'error');
                return;
            }
        }

        const { jsPDF } = window.jspdf;
        const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW  = 297;
        const margin = 10;

        // Logo
        let logoDataUrl = null;
        try {
            const blob = await (await fetch('https://i.imgur.com/e2PlQlo.png')).blob();
            logoDataUrl = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload  = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(blob);
            });
        } catch(e) { console.warn('Logo failed:', e); }

        let y = margin;
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', (pageW-55)/2, y, 55, 14);
            y += 16;
        } else {
            doc.setFont('helvetica','bold'); doc.setFontSize(11);
            doc.text('KAKATIYA INSTITUTE OF TECHNOLOGY & SCIENCE', pageW/2, y+5, {align:'center'});
            y += 20;
        }

        doc.setLineWidth(0.5); doc.line(margin, y, pageW-margin, y); y++;
        doc.setLineWidth(0.2); doc.line(margin, y, pageW-margin, y); y += 4;

        // Reference line
        const examName  = nd.exam_name || nd.notification_title || 'MSE-I';
        const programme = nd.programme_name || 'B.Tech';
        const semList   = nd.semesters   ? (Array.isArray(nd.semesters)   ? nd.semesters   : JSON.parse(nd.semesters))   : [];
        const regList   = nd.regulations ? (Array.isArray(nd.regulations) ? nd.regulations : JSON.parse(nd.regulations)) : [];
        const monthYear = nd.month_year_display || (nd.month_name + ' ' + nd.year) || 'MARCH 2026';
        const yearNum   = (monthYear.split(' ')[1] || '2026');
        const createdDate = nd.created_at
            ? new Date(nd.created_at).toLocaleDateString('en-GB').replace(/\//g,'-')
            : new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
        const session   = nd.session_name || 'FN';

        let sessionTime = '10:00 am to 12:00 pm';
        if (nd.start_time && nd.end_time) {
            const fmt = t => { const [h,m]=t.substring(0,5).split(':'); const hr=parseInt(h); return `${hr>12?hr-12:(hr===0?12:hr)}:${m} ${hr>=12?'pm':'am'}`; };
            sessionTime = `${fmt(nd.start_time)} to ${fmt(nd.end_time)}`;
        }

        const semStr = semList.length > 0 ? semList.join(', ')+'-Sem' : 'II-Sem';
        const regStr = regList.length > 0 ? regList.join(', ') : 'R22';

        doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
        const refText = `No. ${examName} Schedule / ${programme}. ${semStr} (${regStr})/${yearNum}/`;
        const startX  = (pageW - doc.getTextWidth(refText) - doc.getTextWidth(`Date: ${createdDate}`) - 10) / 2;
        doc.text(refText, startX, y);
        doc.text(`Date: ${createdDate}`, startX + doc.getTextWidth(refText) + 10, y);
        y += 6;

        doc.setFont('helvetica','bold'); doc.setFontSize(11);
        doc.text('TIME TABLE', pageW/2, y, {align:'center'});

        const timingText = `Examination Timings : ${session} ${sessionTime}`;
        const boxX = pageW - margin - 75, boxY = y - 5;
        doc.setLineWidth(0.4); doc.rect(boxX, boxY, 75, 6);
        doc.setFontSize(8); doc.text(timingText, boxX+37.5, boxY+4, {align:'center'});
        y += 5;

        // ─── Build grouped data from the passed-in array ─────────────────
        const groupedData = {};
        const allBranches = new Set();

        data.forEach(entry => {
            // ✅ Correct local-time date parsing — no UTC shift
            const raw = entry.exam_date;
            let dateKey, dayName;
            if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                const [yr, mo, dy] = raw.split('-').map(Number);
                dateKey = `${String(dy).padStart(2,'0')}.${String(mo).padStart(2,'0')}.${yr}`;
                dayName = new Date(yr, mo-1, dy).toLocaleDateString('en-US', {weekday:'long'});
            } else {
                const d = new Date(raw);
                dateKey = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
                dayName = d.toLocaleDateString('en-US', {weekday:'long'});
            }
            const fullKey = `${dateKey}|${dayName}`;
            if (!groupedData[fullKey]) groupedData[fullKey] = {};
            const br = entry.branch_code || entry.branch_name || 'UNK';
            if (!groupedData[fullKey][br]) groupedData[fullKey][br] = [];
            groupedData[fullKey][br].push(entry);
            allBranches.add(br);
        });

        const branchArray = Array.from(allBranches).sort();
        const dateKeys    = Object.keys(groupedData).sort((a,b) => {
            const da = a.split('|')[0].split('.').reverse().join('');
            const db = b.split('|')[0].split('.').reverse().join('');
            return da.localeCompare(db);
        });

        const tableStartY = y + 2;
        const dateColW    = 22;
        const branchColW  = (pageW - margin*2 - dateColW) / branchArray.length;
        const headerH     = 10;

        function calcCellH(entries) {
            let h = 0;
            doc.setFontSize(6);
            entries.forEach((e,i) => {
                if (i>0) h += 3;
                h += 3.5;
                let line='', lines=0;
                (e.subject_name||'').split(' ').forEach(w => {
                    const t = line ? line+' '+w : w;
                    if (doc.getTextWidth(t) > branchColW-2) { lines++; line=w; } else line=t;
                });
                h += (lines+1)*3.5;
            });
            return h;
        }

        function calcRowH(fullKey) {
            let max = 0;
            branchArray.forEach(br => { const h = calcCellH(groupedData[fullKey][br]||[]); if(h>max) max=h; });
            return Math.max(14, max+6);
        }

        // Table header
        doc.setFillColor(220,220,220);
        doc.rect(margin, tableStartY, dateColW, headerH, 'FD');
        doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
        doc.text('Date & Day of', margin+dateColW/2, tableStartY+4, {align:'center'});
        doc.text('Examination',   margin+dateColW/2, tableStartY+8, {align:'center'});

        branchArray.forEach((br,i) => {
            const x = margin+dateColW+i*branchColW;
            doc.setFillColor(220,220,220); doc.rect(x, tableStartY, branchColW, headerH, 'FD');
            doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
            doc.text(br, x+branchColW/2, tableStartY+6, {align:'center'});
        });

        // Table rows
        let rowY = tableStartY + headerH;
        dateKeys.forEach((fullKey, rowIdx) => {
            const [dateStr, dayName] = fullKey.split('|');
            const rowH = calcRowH(fullKey);

            doc.setFillColor(rowIdx%2===0?255:248, rowIdx%2===0?255:248, rowIdx%2===0?255:248);
            doc.rect(margin, rowY, pageW-margin*2, rowH, 'FD');

            // Date cell
            doc.setDrawColor(150,150,150); doc.rect(margin, rowY, dateColW, rowH);
            const dY = rowY + (rowH - 9) / 2 + 4.5;
            doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
            doc.text(dateStr, margin+dateColW/2, dY,     {align:'center'});
            doc.setFont('helvetica','normal'); doc.setFontSize(7);
            doc.text(dayName,  margin+dateColW/2, dY+4.5, {align:'center'});

            // Branch cells
            branchArray.forEach((br,i) => {
                const x       = margin+dateColW+i*branchColW;
                const entries = groupedData[fullKey][br] || [];
                doc.setDrawColor(150,150,150); doc.rect(x, rowY, branchColW, rowH);

                if (entries.length === 0) return; // ✅ blank cell

                const contentH = calcCellH(entries);
                let cellY      = rowY + (rowH - contentH) / 2;

                entries.forEach((entry, eIdx) => {
                    if (eIdx > 0) {
                        doc.setLineWidth(0.2); doc.setDrawColor(180,180,180);
                        let dx = x+2;
                        while(dx < x+branchColW-2) { doc.line(dx, cellY, Math.min(dx+1.5, x+branchColW-2), cellY); dx+=3; }
                        doc.setDrawColor(150,150,150);
                        cellY += 3;
                    }
                    doc.setFont('helvetica','bold'); doc.setFontSize(6);
                    doc.text(entry.syllabus_code||'', x+branchColW/2, cellY, {align:'center'});
                    cellY += 3.5;
                    doc.setFont('helvetica','normal'); doc.setFontSize(6);
                    let line='';
                    (entry.subject_name||'').split(' ').forEach(w => {
                        const t = line ? line+' '+w : w;
                        if (doc.getTextWidth(t)>branchColW-2 && line) {
                            doc.text(line, x+branchColW/2, cellY, {align:'center'}); cellY+=3.5; line=w;
                        } else line=t;
                    });
                    if(line) { doc.text(line, x+branchColW/2, cellY, {align:'center'}); cellY+=3.5; }
                });
            });

            rowY += rowH;
        });

        // Note box
        const noteY = rowY + 4;
        doc.setLineWidth(0.4); doc.rect(margin+30, noteY, pageW-margin*2-60, 7);
        const pre  = 'Candidate should occupy his/her seat at least ';
        const und  = '10 minutes before';
        const suf  = ' the commencement of the examination.';
        const full = pre+und+suf;
        const nX   = pageW/2 - doc.getTextWidth(full)/2;
        doc.setFont('helvetica','normal'); doc.setFontSize(8);
        doc.text(full, pageW/2, noteY+4.5, {align:'center'});
        doc.setLineWidth(0.3);
        doc.line(nX+doc.getTextWidth(pre), noteY+5.5, nX+doc.getTextWidth(pre)+doc.getTextWidth(und), noteY+5.5);

        // Footer
        const fY = noteY + 12;
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
        doc.text('To: Exam Branch Notice Boards', margin, fY);
        doc.text('Copy to:  1. Principal for favour of information   2. Dean, Academic Affairs', margin, fY+5);
        doc.text("3. HOD's - with a request to display in the Dept Notice Boards & share in the Faculty & Class WhatsApp groups", margin, fY+9);
        doc.text('4. Training & Placement Officer   5. Web Team - with a request to display on the website', margin, fY+13);
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        doc.text('Controller of Examinations', pageW-margin, fY+18, {align:'right'});

        doc.save(`timetable_${nd.notification_id||notificationId}_${Date.now()}.pdf`);
        Swal.fire('Success', 'PDF exported successfully!', 'success');

    } catch (error) {
        console.error('PDF error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    }
}

// ─── Export to CSV ───────────────────────────────────────────────────────────
window.exportToCSV = function(data) {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += `Exam Timetable\nGenerated: ${new Date().toLocaleString()}\nTotal Entries: ${data.length}\n\n`;
    csv += 'Date,Branch,Subject Code,Subject Name,Subject Type,Status\n';
    data.forEach(e => {
        const date = typeof e.exam_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.exam_date)
            ? e.exam_date
            : new Date(e.exam_date).toLocaleDateString();
        csv += `"${date}","${e.branch_code||e.branch_name||''}","${e.syllabus_code||''}","${e.subject_name||''}","${e.subject_type||'Theory'}","${e.status||'scheduled'}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `timetable_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    Swal.fire('Success', 'CSV exported!', 'success');
}

// ─── Save timetable — reads from DOM, not timeTableDataGlobal ─────────────
window.saveTimetable = async function() {
    const urlParams      = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    // ✅ Read from DOM — the only true current state after drag-drop
    const domEntries = readTimetableFromDOM();

    if (!domEntries || domEntries.length === 0) {
        Swal.fire('Error', 'No assigned subjects found on screen. Generate first.', 'error');
        return;
    }

    try {
        Swal.fire({ title: 'Saving...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Fetch batch info
        let batch_id = null, batch_name = null;
        try {
            const r = await (await fetch(`/api/exam-notifications/${notificationId}`)).json();
            if (r.status === 'success') {
                window.notificationDetails = r.data;
                batch_id   = r.data.batch_id   || null;
                batch_name = r.data.batch_name || null;
            }
        } catch(e) { console.warn('batch fetch failed:', e); }

        // Build final entries array with all required fields
        const entries = domEntries.map(e => ({
            notification_id: notificationId,
            exam_date:       e.exam_date,
            branch_id:       e.branch_id,
            branch_code:     e.branch_code,
            subject_id:      e.subject_id,
            syllabus_code:   e.syllabus_code,
            subject_name:    e.subject_name,
            subject_type:    e.subject_type || 'Theory',
            status:          'scheduled',
            session_order:   1,
            batch_id:        batch_id,
            batch_name:      batch_name
        }));

        const response = await fetch(`/api/exam-timetable/${notificationId}/entries`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ entries })
        });

        const result = await response.json();
        Swal.close();

        if (result.status === 'success') {
            Swal.fire('Saved!', `${entries.length} entries saved.`, 'success');
            if (typeof showStudentDataButtons === 'function') showStudentDataButtons();
        } else {
            Swal.fire('Error', result.message || 'Failed to save', 'error');
        }
    } catch (error) {
        Swal.close();
        Swal.fire('Error', 'Save failed: ' + error.message, 'error');
    }
}

// ─── Clear timetable ─────────────────────────────────────────────────────────
window.clearTimetable = async function() {
    const urlParams      = new URLSearchParams(window.location.search);
    const notificationId = urlParams.get('notificationId');

    const confirm = await Swal.fire({
        title: 'Clear Timetable?',
        text: 'This will delete all saved entries from the database.',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Yes, Clear it', confirmButtonColor: '#dc3545'
    });
    if (!confirm.isConfirmed) return;

    try {
        await fetch(`/api/exam-timetable/${notificationId}/entries`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: [] })
        });
        document.getElementById('timeTableDisplay').style.display  = 'none';
        document.getElementById('timetableActions').style.display  = 'none';
        if (typeof timeTableDataGlobal !== 'undefined') timeTableDataGlobal = null;
        Swal.fire('Cleared!', 'Now regenerate and save.', 'success');
    } catch (error) {
        Swal.fire('Error', 'Failed to clear: ' + error.message, 'error');
    }
}

console.log('✅ Export functions loaded successfully!');
