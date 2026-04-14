'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
const TT = {
    filterData: null,
    allottedCourses: [],
    periods: [],
    currentHeaderId: null,
    clashCache: {},
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COURSE_TYPES = ['Theory', 'Practical', 'Tutorial', 'CEA', 'MYC', 'Free'];
const TYPE_COLORS = {
    Theory:    { bg: '#e8f4fd', border: '#2196F3', badge: '#1565C0' },
    Practical: { bg: '#e8f5e9', border: '#4CAF50', badge: '#2E7D32' },
    Tutorial:  { bg: '#fff8e1', border: '#FFC107', badge: '#F57F17' },
    CEA:       { bg: '#fce4ec', border: '#E91E63', badge: '#880E4F' },
    MYC:       { bg: '#ede7f6', border: '#9C27B0', badge: '#4A148C' },
    Free:      { bg: '#f5f5f5', border: '#9E9E9E', badge: '#616161' },
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadFilterData();
    bindFilterEvents();
    renderEmptyGrid();
});

// ─── Load dropdown data ───────────────────────────────────────────────────────
async function loadFilterData() {
    try {
        const res = await fetch('/api/classwork-timetable/filter-data');
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        TT.filterData = json.data;

        populateSelect('prog-select', json.data.programmes, 'programme_id', p => `${p.programme_code} — ${p.programme_name}`);
        populateSelect('reg-select', json.data.regulations, 'regulation_id', r => r.regulation_name);
        populateSelect('sem-select', json.data.semesters, 'semester_id', s => `Semester ${s.semester_number} (${s.semester_name})`);
        populateSelect('teacher-select', json.data.staff, 'staff_id', s => `${s.employee_id} — ${s.full_name}`, true);

        populateSelect('rs-prog', json.data.programmes, 'programme_id', p => `${p.programme_code} — ${p.programme_name}`);
        populateSelect('rs-sem',  json.data.semesters,  'semester_id',  s => `Semester ${s.semester_number} (${s.semester_name})`);

        const periRes = await fetch('/api/classwork-timetable/periods');
        const periJson = await periRes.json();
        TT.periods = periJson.data;

    } catch (err) {
        showAlert('Failed to load filter data: ' + err.message, 'error');
    }
}

function populateSelect(id, items, valueKey, labelFn, addBlank = false) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select —</option>';
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item[valueKey];
        opt.textContent = labelFn(item);
        sel.appendChild(opt);
    });
}

function bindFilterEvents() {
    document.getElementById('prog-select')?.addEventListener('change', onProgrammeChange);
    document.getElementById('branch-select')?.addEventListener('change', onBranchChange);
    document.getElementById('sem-select')?.addEventListener('change', () => { loadAllottedCourses(); autoLoadMainRoom(); });
    document.getElementById('sec-select')?.addEventListener('change', () => { loadAllottedCourses(); autoLoadMainRoom(); });
    document.getElementById('reg-select')?.addEventListener('change', loadAllottedCourses);
    document.getElementById('acad-year')?.addEventListener('change', autoLoadMainRoom);
    document.getElementById('sem-type')?.addEventListener('change', autoLoadMainRoom);
    document.getElementById('load-btn')?.addEventListener('click', loadExistingTimetable);
    document.getElementById('save-btn')?.addEventListener('click', saveTimetable);

    document.getElementById('rs-prog')?.addEventListener('change', () => {
        const progId = document.getElementById('rs-prog').value;
        const branches = (TT.filterData?.branches || []).filter(b => String(b.programme_id) === String(progId));
        populateSelect('rs-branch', branches, 'branch_id', b => b.branch_code + ' — ' + b.branch_name);
        document.getElementById('rs-section').innerHTML = '<option value="">— Select —</option>';
    });
    document.getElementById('rs-branch')?.addEventListener('change', () => {
        populateSelect('rs-section', TT.filterData?.sections || [], 'section_id', s => s.section_name);
    });
}

function onProgrammeChange() {
    const progId = document.getElementById('prog-select').value;
    const branches = (TT.filterData?.branches || []).filter(b => String(b.programme_id) === String(progId));
    populateSelect('branch-select', branches, 'branch_id', b => `${b.branch_code} — ${b.branch_name}`);
    document.getElementById('sec-select').innerHTML = '<option value="">— Select —</option>';
    TT.allottedCourses = [];
    renderCoursePanel([]);
}

function onBranchChange() {
    populateSelect('sec-select', TT.filterData?.sections || [], 'section_id', s => s.section_name);
    loadAllottedCourses();
}

// ─── Load allotted courses ────────────────────────────────────────────────────
async function loadAllottedCourses() {
    const p = getFilters();
    if (!p.programme_id || !p.branch_id || !p.semester_id || !p.section_id) return;

    try {
        const qs = new URLSearchParams(p).toString();
        const res = await fetch(`/api/classwork-timetable/allotted-courses?${qs}`);
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        TT.allottedCourses = json.data;
        renderCoursePanel(json.data);
        renderEmptyGrid();
        showAlert(`${json.data.length} courses loaded from Subject Allotment`, 'success');
    } catch (err) {
        showAlert('Failed to load courses: ' + err.message, 'error');
    }
}

// ─── Course Panel ─────────────────────────────────────────────────────────────
function renderCoursePanel(courses) {
    const container = document.getElementById('course-chips');
    if (!container) return;
    container.innerHTML = '';
    if (courses.length === 0) {
        container.innerHTML = '<p class="empty-msg">Select filters above to load courses</p>';
        return;
    }
    courses.forEach(c => {
        const type = c.subject_type === 'Practical' ? 'Practical' : 'Theory';
        const col = TYPE_COLORS[type];
        const chip = document.createElement('div');
        chip.className = 'course-chip';
        chip.style.cssText = `background:${col.bg};border-left:4px solid ${col.border};`;
        chip.innerHTML = `
            <span class="chip-short" style="color:${col.badge}">${c.subject_short || c.syllabus_code}</span>
            <span class="chip-name">${c.subject_name}</span>
            <span class="chip-faculty">${c.faculty_name} (${c.employee_id})</span>
            <span class="chip-code">${c.syllabus_code}</span>`;
        container.appendChild(chip);
    });
}

// ─── Grid Rendering ───────────────────────────────────────────────────────────
function renderEmptyGrid() {
    const container = document.getElementById('timetable-grid');
    if (!container) return;
    container.innerHTML = buildGridHTML(null);
    bindGridEvents();
}

function buildGridHTML(existingSlots) {
    const slotMap = {};
    if (existingSlots) {
        existingSlots.forEach(s => { slotMap[`${s.day_name}_${s.period_no}`] = s; });
    }

    const periodHeaders = TT.periods.map(p =>
        `<th class="period-th">${p.label}</th>`
    ).join('');

    const dayRows = DAYS.map(day => {
        const cells = TT.periods.map(p => {
            const key = `${day}_${p.period_no}`;
            const slot = slotMap[key];
            return buildCellHTML(day, p.period_no, slot);
        }).join('');
        return `<tr>
            <td class="day-cell">${day.substring(0,3).toUpperCase()}</td>
            ${cells}
        </tr>`;
    }).join('');

    return `
    <div class="grid-scroll">
    <table class="tt-table" id="tt-main-table">
        <thead>
            <tr>
                <th class="day-th">DAY / TIME</th>
                ${periodHeaders}
            </tr>
        </thead>
        <tbody>${dayRows}</tbody>
    </table>
    </div>`;
}

function buildCellHTML(day, periodNo, slot) {
    const type = slot?.course_type || 'Free';
    const col = TYPE_COLORS[type] || TYPE_COLORS.Free;
    const isEmpty = !slot || type === 'Free';

    let inner = '';
    if (!isEmpty) {
        if (type === 'Practical' || type === 'Tutorial') {
            // ✅ FIX 4: B1/B2 stacked vertically
            inner = `
            <div class="split-cell-vertical">
                <div class="split-row b1" style="border-color:${col.border}">
                    <span class="split-label">B1</span>
                    <span class="split-short">${slot.subject_short_b1 || slot.syllabus_code_b1 || '—'}</span>
                    <span class="split-staff">${slot.staff_emp_id_b1 || ''}</span>
                    <span class="split-room">${slot.room_no_b1 || ''}</span>
                </div>
                <div class="split-divider"></div>
                <div class="split-row b2" style="border-color:${col.border}">
                    <span class="split-label">B2</span>
                    <span class="split-short">${slot.subject_short_b2 || slot.syllabus_code_b2 || '—'}</span>
                    <span class="split-staff">${slot.staff_emp_id_b2 || ''}</span>
                    <span class="split-room">${slot.room_no_b2 || ''}</span>
                </div>
            </div>`;
        } else {
            inner = `
            <div class="cell-content">
                <div class="cell-short" style="color:${col.badge}">${slot.subject_short || slot.syllabus_code || type}</div>
                <div class="cell-staff">${slot.staff_emp_id || ''}</div>
                <div class="cell-room">${slot.room_no || ''}</div>
            </div>`;
        }
    }

    return `<td class="slot-cell ${isEmpty ? 'empty' : 'filled'}"
                style="background:${col.bg};border-top:3px solid ${isEmpty ? '#e0e0e0' : col.border}"
                data-day="${day}" data-period="${periodNo}"
                onclick="openSlotModal('${day}', ${periodNo})">
        <div class="cell-type-badge" style="background:${col.badge}">${type}</div>
        ${inner}
        <div class="cell-edit-hint">✏ Click to edit</div>
    </td>`;
}

function bindGridEvents() {
    // Grid cells bound via onclick in HTML
}

// ─── Slot Modal ───────────────────────────────────────────────────────────────
let currentEditSlot = {};

async function openSlotModal(day, periodNo) {
    currentEditSlot = { day, periodNo };
    const period = TT.periods.find(p => p.period_no === periodNo);

    document.getElementById('modal-title').textContent = `${day} — ${period?.label || 'Period ' + periodNo}`;
    document.getElementById('modal-day').value = day;
    document.getElementById('modal-period').value = periodNo;

    // ✅ FIX 1 & 2: Unique subjects + only allotted faculty
    populateModalSubjects();
    populateModalFacultyMulti();

    // Reset type
    document.getElementById('modal-type').value = 'Theory';
    toggleModalSplit();

    // ✅ FIX 5: Show/hide "Copy Previous" button
    updateCopyPreviousButton(day, periodNo);

    await fetchAndPopulateModalRooms();

    // Restore existing slot
    const existing = window._pendingSlots?.[`${day}_${periodNo}`];
    if (existing) {
        document.getElementById('modal-type').value = existing.course_type || 'Theory';
        toggleModalSplit();
        if (existing.course_type === 'Practical' || existing.course_type === 'Tutorial') {
            if (existing.subject_id_b1) document.getElementById('modal-subject-b1').value = existing.subject_id_b1;
            if (existing.staff_id_b1)   setMultiSelectValues('modal-staff-b1-multi', [existing.staff_id_b1]);
            if (existing.room_no_b1)    document.getElementById('modal-room-b1').value = existing.room_no_b1;
            if (existing.subject_id_b2) document.getElementById('modal-subject-b2').value = existing.subject_id_b2;
            if (existing.staff_id_b2)   setMultiSelectValues('modal-staff-b2-multi', [existing.staff_id_b2]);
            if (existing.room_no_b2)    document.getElementById('modal-room-b2').value = existing.room_no_b2;
        } else {
            if (existing.subject_id) document.getElementById('modal-subject').value = existing.subject_id;
            if (existing.staff_ids)  setMultiSelectValues('modal-staff-multi', existing.staff_ids);
            else if (existing.staff_id) setMultiSelectValues('modal-staff-multi', [existing.staff_id]);
            if (existing.room_no)    document.getElementById('modal-room').value = existing.room_no;
        }
    }

    document.getElementById('slot-modal').classList.add('open');
    document.getElementById('modal-overlay').classList.add('open');
}

// ✅ FIX 1: Unique subjects only (group by subject_id)
function populateModalSubjects() {
    const seen = new Set();
    const unique = TT.allottedCourses.filter(c => {
        if (seen.has(c.subject_id)) return false;
        seen.add(c.subject_id);
        return true;
    });

    ['modal-subject', 'modal-subject-b1', 'modal-subject-b2'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">— None —</option>';
        unique.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.subject_id;
            opt.dataset.short = s.subject_short || s.syllabus_code;
            opt.dataset.staffId = s.staff_id;
            opt.dataset.staffEmpId = s.employee_id;
            opt.textContent = `${s.subject_short || s.syllabus_code} — ${s.subject_name}`;
            sel.appendChild(opt);
        });
    });
}

// ✅ FIX 2: Multi-select faculty — only allotted faculty
function populateModalFacultyMulti() {
    // Build unique faculty from allotted courses only
    const seen = new Set();
    const faculty = TT.allottedCourses.filter(c => {
        if (seen.has(c.staff_id)) return false;
        seen.add(c.staff_id);
        return true;
    });

    ['modal-staff-multi', 'modal-staff-b1-multi', 'modal-staff-b2-multi'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '';
        faculty.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.staff_id;
            opt.textContent = `${s.employee_id} — ${s.faculty_name}`;
            sel.appendChild(opt);
        });
    });
}

function setMultiSelectValues(selectId, values) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
        opt.selected = values.map(String).includes(String(opt.value));
    });
}

function getMultiSelectValues(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map(o => o.value);
}

function getMultiSelectEmpIds(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return '';
    return Array.from(sel.selectedOptions).map(o => {
        const txt = o.textContent;
        return txt.split('—')[0].trim();
    }).join(', ');
}

// ✅ FIX 5: Copy Previous Period button
function updateCopyPreviousButton(day, periodNo) {
    const btn = document.getElementById('copy-prev-btn');
    if (!btn) return;

    // Find previous period index
    const currentIdx = TT.periods.findIndex(p => p.period_no === periodNo);
    if (currentIdx <= 0) {
        btn.style.display = 'none';
        return;
    }

    const prevPeriod = TT.periods[currentIdx - 1];
    const prevKey = `${day}_${prevPeriod.period_no}`;
    const prevSlot = window._pendingSlots?.[prevKey];

    if (prevSlot && prevSlot.course_type !== 'Free') {
        btn.style.display = 'inline-flex';
        btn.title = `Copy from ${prevPeriod.label}`;
        btn.onclick = () => copyFromPreviousPeriod(day, prevPeriod.period_no);
    } else {
        btn.style.display = 'none';
    }
}

function copyFromPreviousPeriod(day, prevPeriodNo) {
    const prevSlot = window._pendingSlots?.[`${day}_${prevPeriodNo}`];
    if (!prevSlot) return;

    document.getElementById('modal-type').value = prevSlot.course_type || 'Theory';
    toggleModalSplit();

    if (prevSlot.course_type === 'Practical' || prevSlot.course_type === 'Tutorial') {
        if (prevSlot.subject_id_b1) document.getElementById('modal-subject-b1').value = prevSlot.subject_id_b1;
        if (prevSlot.staff_ids_b1)  setMultiSelectValues('modal-staff-b1-multi', prevSlot.staff_ids_b1);
        else if (prevSlot.staff_id_b1) setMultiSelectValues('modal-staff-b1-multi', [prevSlot.staff_id_b1]);
        if (prevSlot.room_no_b1)    document.getElementById('modal-room-b1').value = prevSlot.room_no_b1;
        if (prevSlot.subject_id_b2) document.getElementById('modal-subject-b2').value = prevSlot.subject_id_b2;
        if (prevSlot.staff_ids_b2)  setMultiSelectValues('modal-staff-b2-multi', prevSlot.staff_ids_b2);
        else if (prevSlot.staff_id_b2) setMultiSelectValues('modal-staff-b2-multi', [prevSlot.staff_id_b2]);
        if (prevSlot.room_no_b2)    document.getElementById('modal-room-b2').value = prevSlot.room_no_b2;
    } else {
        if (prevSlot.subject_id) document.getElementById('modal-subject').value = prevSlot.subject_id;
        if (prevSlot.staff_ids)  setMultiSelectValues('modal-staff-multi', prevSlot.staff_ids);
        else if (prevSlot.staff_id) setMultiSelectValues('modal-staff-multi', [prevSlot.staff_id]);
        if (prevSlot.room_no)    document.getElementById('modal-room').value = prevSlot.room_no;
    }

    showAlert(`✅ Copied from previous period`, 'success');
}

function closeSlotModal() {
    document.getElementById('slot-modal').classList.remove('open');
    document.getElementById('modal-overlay').classList.remove('open');
}

function toggleModalSplit() {
    const type = document.getElementById('modal-type').value;
    const isSplit = type === 'Practical' || type === 'Tutorial';
    document.getElementById('single-fields').style.display = isSplit ? 'none' : 'block';
    document.getElementById('split-fields').style.display = isSplit ? 'block' : 'none';
}

// Auto-fill staff when subject selected
document.addEventListener('change', e => {
    if (e.target.id === 'modal-subject') {
        const opt = e.target.options[e.target.selectedIndex];
        if (opt.dataset.staffId) setMultiSelectValues('modal-staff-multi', [opt.dataset.staffId]);
    }
    if (e.target.id === 'modal-subject-b1') {
        const opt = e.target.options[e.target.selectedIndex];
        if (opt.dataset.staffId) setMultiSelectValues('modal-staff-b1-multi', [opt.dataset.staffId]);
    }
    if (e.target.id === 'modal-subject-b2') {
        const opt = e.target.options[e.target.selectedIndex];
        if (opt.dataset.staffId) setMultiSelectValues('modal-staff-b2-multi', [opt.dataset.staffId]);
    }
    if (e.target.id === 'modal-type') toggleModalSplit();
});

function applySlot() {
    const day      = document.getElementById('modal-day').value;
    const periodNo = parseInt(document.getElementById('modal-period').value);
    const type     = document.getElementById('modal-type').value;
    const isSplit  = type === 'Practical' || type === 'Tutorial';

    let slotData = { day_name: day, period_no: periodNo, course_type: type };

    if (isSplit) {
        const staffIdsB1 = getMultiSelectValues('modal-staff-b1-multi');
        const staffIdsB2 = getMultiSelectValues('modal-staff-b2-multi');

        slotData.subject_id_b1  = document.getElementById('modal-subject-b1').value || null;
        slotData.staff_id_b1    = staffIdsB1[0] || null;  // primary for DB
        slotData.staff_ids_b1   = staffIdsB1;             // all selected
        slotData.room_no_b1     = document.getElementById('modal-room-b1').value || null;
        slotData.subject_id_b2  = document.getElementById('modal-subject-b2').value || null;
        slotData.staff_id_b2    = staffIdsB2[0] || null;
        slotData.staff_ids_b2   = staffIdsB2;
        slotData.room_no_b2     = document.getElementById('modal-room-b2').value || null;

        const getShort = (selId) => {
            const sel = document.getElementById(selId);
            return sel?.options[sel.selectedIndex]?.dataset?.short || '';
        };

        slotData.subject_short_b1 = getShort('modal-subject-b1');
        slotData.staff_emp_id_b1  = getMultiSelectEmpIds('modal-staff-b1-multi');
        slotData.subject_short_b2 = getShort('modal-subject-b2');
        slotData.staff_emp_id_b2  = getMultiSelectEmpIds('modal-staff-b2-multi');
    } else {
        const staffIds = getMultiSelectValues('modal-staff-multi');

        slotData.subject_id   = document.getElementById('modal-subject').value || null;
        slotData.staff_id     = staffIds[0] || null;  // primary for DB
        slotData.staff_ids    = staffIds;             // all selected
        slotData.room_no      = document.getElementById('modal-room').value || null;

        const sel = document.getElementById('modal-subject');
        slotData.subject_short = sel?.options[sel.selectedIndex]?.dataset?.short || '';
        slotData.staff_emp_id  = getMultiSelectEmpIds('modal-staff-multi');
    }

    updateGridCell(day, periodNo, slotData);
    closeSlotModal();

    if (!window._pendingSlots) window._pendingSlots = {};
    window._pendingSlots[`${day}_${periodNo}`] = slotData;
}

function clearSlot() {
    const day      = document.getElementById('modal-day').value;
    const periodNo = parseInt(document.getElementById('modal-period').value);
    updateGridCell(day, periodNo, null);
    if (window._pendingSlots) delete window._pendingSlots[`${day}_${periodNo}`];
    closeSlotModal();
}

function updateGridCell(day, periodNo, slotData) {
    const cell = document.querySelector(`[data-day="${day}"][data-period="${periodNo}"]`);
    if (!cell) return;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = buildCellHTML(day, periodNo, slotData);
    const newTd = tempDiv.querySelector('td');
    if (newTd) cell.replaceWith(newTd);
}

// ─── Load existing timetable ──────────────────────────────────────────────────
async function loadExistingTimetable() {
    const f = getFilters();
    if (!f.programme_id || !f.branch_id || !f.semester_id || !f.section_id) {
        showAlert('Please select all filters first', 'warning'); return;
    }
    try {
        showLoading(true);
        const qs = new URLSearchParams(f).toString();
        const res = await fetch(`/api/classwork-timetable/view?${qs}`);
        const json = await res.json();
        showLoading(false);

        if (!json.data) {
            showAlert('No timetable found for this selection', 'info'); return;
        }

        const { slots } = json.data;
        TT.currentHeaderId = json.data.header.header_id;

        const container = document.getElementById('timetable-grid');
        container.innerHTML = buildGridHTML(slots);

        window._pendingSlots = {};
        slots.forEach(s => { window._pendingSlots[`${s.day_name}_${s.period_no}`] = s; });

        showAlert(`Timetable loaded successfully (${slots.length} slots)`, 'success');
        switchTab('view');
        renderViewTimetable(json.data);
    } catch (err) {
        showLoading(false);
        showAlert('Failed to load timetable: ' + err.message, 'error');
    }
}

// ─── Save timetable ───────────────────────────────────────────────────────────
async function saveTimetable() {
    const f = getFilters();
    if (!f.programme_id || !f.branch_id || !f.semester_id || !f.section_id || !f.regulation_id) {
        showAlert('Please fill all required filters', 'warning'); return;
    }
    if (!f.academic_year) { showAlert('Please enter Academic Year', 'warning'); return; }
    if (!f.semester_type) { showAlert('Please select Semester Type', 'warning'); return; }

    const slots = Object.values(window._pendingSlots || {}).filter(s => s.course_type !== 'Free');
    if (slots.length === 0) { showAlert('No slots assigned yet', 'warning'); return; }

    const courseSet = new Map();
    slots.forEach(s => {
        if (s.subject_id && s.staff_id)
            courseSet.set(`${s.subject_id}_${s.staff_id}`, { subject_id: s.subject_id, staff_id: s.staff_id });
        if (s.subject_id_b1 && s.staff_id_b1)
            courseSet.set(`${s.subject_id_b1}_${s.staff_id_b1}`, { subject_id: s.subject_id_b1, staff_id: s.staff_id_b1 });
        if (s.subject_id_b2 && s.staff_id_b2)
            courseSet.set(`${s.subject_id_b2}_${s.staff_id_b2}`, { subject_id: s.subject_id_b2, staff_id: s.staff_id_b2 });
    });

    const payload = {
        programme_id:     f.programme_id,
        branch_id:        f.branch_id,
        semester_id:      f.semester_id,
        section_id:       f.section_id,
        regulation_id:    f.regulation_id,
        academic_year:    f.academic_year,
        semester_type:    f.semester_type,
        effective_from:   document.getElementById('effective-from')?.value || null,
        class_teacher_id: document.getElementById('teacher-select')?.value || null,
        room_no:          document.getElementById('room-no')?.value || null,
        slots,
        courses: [...courseSet.values()]
    };

    try {
        showLoading(true);
        const res = await fetch('/api/classwork-timetable/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        showLoading(false);
        if (json.status !== 'success') throw new Error(json.message);
        TT.currentHeaderId = json.header_id;
        showAlert(`✅ Timetable saved! ${slots.length} slots saved.`, 'success');
    } catch (err) {
        showLoading(false);
        showAlert('Save failed: ' + err.message, 'error');
    }
}

// ─── View Timetable ───────────────────────────────────────────────────────────
function renderViewTimetable(data) {
    const { header, slots, courses, periods } = data;
    const container = document.getElementById('view-container');
    if (!container) return;

    // Build slot map
    const slotMap = {};
    slots.forEach(s => { slotMap[`${s.day_name}_${s.period_no}`] = s; });

    // ✅ FIX 3: Merge consecutive same-assignment period headers
    // Build merged header spans
    const mergedHeaders = buildMergedHeaders(periods, slotMap);

    const rows = DAYS.map(day => {
        const cells = buildMergedDayRow(day, periods, slotMap);
        return `<tr><td class="view-day">${day.substring(0,3).toUpperCase()}</td>${cells}</tr>`;
    }).join('');

    // ✅ FIX 6: Course legend — one row per subject, all faculty comma-separated
    const subjectMap = new Map();
    courses.forEach(c => {
        if (!subjectMap.has(c.subject_id)) {
            subjectMap.set(c.subject_id, {
                subject_short: c.subject_short,
                syllabus_code: c.syllabus_code,
                subject_name:  c.subject_name,
                faculty: []
            });
        }
        subjectMap.get(c.subject_id).faculty.push(`${c.faculty_name} (${c.employee_id})`);
    });

    const legendRows = [...subjectMap.values()].map(c => `
        <tr>
            <td><b>${c.subject_short || ''}</b></td>
            <td>${c.syllabus_code}: ${c.subject_name}</td>
            <td>${c.faculty.join(', ')}</td>
        </tr>`).join('');

    container.innerHTML = `
    <div class="view-header">
        <div class="view-college">ACADEMIC YEAR ${header.academic_year} — ${header.semester_number % 2 === 0 ? 'EVEN' : 'ODD'} SEMESTER</div>
        <div class="view-sub">Scheme: ${header.regulation_name} — Semester ${header.semester_number} (${header.semester_name})</div>
        <div class="view-dept">${header.programme_name} — ${header.branch_name}</div>
        <div class="view-meta">
            <span><b>Section:</b> ${header.section_name}</span>
            <span><b>Room:</b> ${header.room_no || '—'}</span>
            ${header.class_teacher_name ? `<span><b>Class Teacher:</b> ${header.class_teacher_name}</span>` : ''}
            ${header.effective_from ? `<span><b>w.e.f.</b> ${new Date(header.effective_from).toLocaleDateString('en-IN')}</span>` : ''}
        </div>
    </div>
    <div class="view-grid-wrap">
    <table class="view-table">
        <thead><tr><th>DAY / TIME</th>${mergedHeaders}</tr></thead>
        <tbody>${rows}</tbody>
    </table>
    </div>
    <br>
    <table class="legend-table">
        <thead><tr><th>Course Title</th><th>Course Code &amp; Name</th><th>Course Faculty</th></tr></thead>
        <tbody>${legendRows}</tbody>
    </table>`;
}

// ✅ FIX 3: Build merged period headers
function buildMergedHeaders(periods, slotMap) {
    // We need to check across ALL days — if any day has a merge, the header merges
    // Strategy: merge consecutive periods that have same content on EVERY day
    // Simpler approach: merge header only when ALL days have identical slot keys for those periods
    let html = '';
    let i = 0;
    while (i < periods.length) {
        const p = periods[i];
        let span = 1;

        // Check if next period(s) are same across all days
        while (i + span < periods.length) {
            const nextP = periods[i + span];
            let allSame = true;
            for (const day of DAYS) {
                const curr = slotMap[`${day}_${p.period_no}`];
                const next = slotMap[`${day}_${nextP.period_no}`];
                if (!isSameSlotKey(curr, next)) { allSame = false; break; }
            }
            if (allSame) span++;
            else break;
        }

        if (span > 1) {
            const endLabel = periods[i + span - 1].label.split('–')[1] || periods[i + span - 1].label;
            const startLabel = p.label.split('–')[0] || p.label;
            html += `<th class="period-th" colspan="${span}">${startLabel}–${endLabel}</th>`;
        } else {
            html += `<th class="period-th">${p.label}</th>`;
        }
        i += span;
    }
    return html;
}

// ✅ FIX 3: Build merged day row cells
function buildMergedDayRow(day, periods, slotMap) {
    let html = '';
    let i = 0;
    while (i < periods.length) {
        const p = periods[i];
        const slot = slotMap[`${day}_${p.period_no}`];
        let span = 1;

        // Check if next period is same slot key
        while (i + span < periods.length) {
            const nextP = periods[i + span];
            const nextSlot = slotMap[`${day}_${nextP.period_no}`];
            if (isSameSlotKey(slot, nextSlot)) span++;
            else break;
        }

        html += buildViewCell(slot, span);
        i += span;
    }
    return html;
}

function isSameSlotKey(a, b) {
    // ✅ NEVER merge empty or Free slots — always show as separate columns
    if (!a || !b) return false;
    if (!a.course_type || a.course_type === 'Free') return false;
    if (!b.course_type || b.course_type === 'Free') return false;
    if (a.course_type !== b.course_type) return false;

    // Only merge Practical/Tutorial with identical subject+staff on both batches
    if (a.course_type === 'Practical' || a.course_type === 'Tutorial') {
        return a.subject_id_b1 === b.subject_id_b1 &&
               a.subject_id_b2 === b.subject_id_b2 &&
               a.staff_id_b1   === b.staff_id_b1   &&
               a.staff_id_b2   === b.staff_id_b2;
    }
    // Only merge Theory with identical subject+staff
    return a.subject_id === b.subject_id && a.staff_id === b.staff_id;
}

// ✅ Professional view cell — no staff emp id, clean centered layout
function buildViewCell(slot, colspan = 1) {
    const spanAttr = colspan > 1 ? ` colspan="${colspan}"` : '';
    if (!slot || slot.course_type === 'Free' || !slot.course_type) {
        return `<td class="view-empty"${spanAttr}>—</td>`;
    }

    const type = slot.course_type;
    const col  = TYPE_COLORS[type] || TYPE_COLORS.Free;

    if (type === 'Practical' || type === 'Tutorial') {
        return `<td class="view-cell-split"${spanAttr} style="background:${col.bg};border-top:3px solid ${col.border}">
            <div class="view-batch-row">
                <span class="view-batch-label" style="background:${col.badge}">B1</span>
                <span class="view-batch-subject" style="color:${col.badge}">${slot.subject_short_b1 || '—'}</span>
                <span class="view-batch-room">${slot.room_no_b1 || ''}</span>
            </div>
            <div class="view-batch-divider" style="border-color:${col.border}"></div>
            <div class="view-batch-row">
                <span class="view-batch-label" style="background:${col.badge}">B2</span>
                <span class="view-batch-subject" style="color:${col.badge}">${slot.subject_short_b2 || '—'}</span>
                <span class="view-batch-room">${slot.room_no_b2 || ''}</span>
            </div>
        </td>`;
    }

    return `<td class="view-cell-single"${spanAttr} style="background:${col.bg};border-top:3px solid ${col.border}">
        <div class="view-single-subject" style="color:${col.badge}">${slot.subject_short || slot.syllabus_code || type}</div>
        ${slot.room_no ? `<div class="view-single-room">${slot.room_no}</div>` : ''}
    </td>`;
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tt-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-'+tab)?.classList.add('active');
    document.getElementById('panel-'+tab)?.classList.add('active');

    if (tab === 'view') {
        const f = getFilters();
        if (f.programme_id && f.branch_id && f.semester_id && f.section_id) loadViewTimetable();
    }
    if (tab === 'roomsetup') {
        const f = getFilters();
        if (f.programme_id) {
            document.getElementById('rs-prog').value = f.programme_id;
            document.getElementById('rs-prog').dispatchEvent(new Event('change'));
            setTimeout(() => {
                if (f.branch_id) { document.getElementById('rs-branch').value = f.branch_id; document.getElementById('rs-branch').dispatchEvent(new Event('change')); }
                if (f.semester_id) document.getElementById('rs-sem').value = f.semester_id;
                setTimeout(() => { if (f.section_id) document.getElementById('rs-section').value = f.section_id; }, 60);
                const ay = document.getElementById('acad-year')?.value;
                const st = document.getElementById('sem-type')?.value;
                if (ay) document.getElementById('rs-acad-year').value = ay;
                if (st) document.getElementById('rs-sem-type').value = st;
            }, 60);
        }
        loadRoomSetupList();
        loadRoomPicker();
    }
}

async function loadViewTimetable() {
    const f = getFilters();
    try {
        const qs = new URLSearchParams(f).toString();
        const res = await fetch(`/api/classwork-timetable/view?${qs}`);
        const json = await res.json();
        if (json.data) renderViewTimetable(json.data);
        else document.getElementById('view-container').innerHTML = '<p class="empty-msg">No timetable saved yet for this selection.</p>';
    } catch (err) {
        document.getElementById('view-container').innerHTML = `<p class="empty-msg">Error: ${err.message}</p>`;
    }
}

function printTimetable() { window.print(); }

function getFilters() {
    return {
        programme_id:  document.getElementById('prog-select')?.value || '',
        branch_id:     document.getElementById('branch-select')?.value || '',
        semester_id:   document.getElementById('sem-select')?.value || '',
        section_id:    document.getElementById('sec-select')?.value || '',
        regulation_id: document.getElementById('reg-select')?.value || '',
        academic_year: document.getElementById('acad-year')?.value || '',
        semester_type: document.getElementById('sem-type')?.value || '',
    };
}

async function autoLoadMainRoom() {
    const f = getFilters();
    if (!f.programme_id || !f.branch_id || !f.semester_id || !f.section_id) return;
    try {
        const qs = new URLSearchParams(f).toString();
        const res = await fetch(`/api/classwork-timetable/room-setup/auto-rooms?${qs}`);
        const json = await res.json();
        if (json.status === 'success') {
            window._setupRooms = json.data;
            const roomInput = document.getElementById('room-no');
            if (roomInput) {
                roomInput.value = json.data.main_rooms.length > 0 ? json.data.main_rooms.join(', ') : '';
            }
        }
    } catch (err) {
        console.warn('auto-load room failed:', err.message);
    }
}

async function fetchAndPopulateModalRooms() {
    if (window._setupRooms &&
        (window._setupRooms.main_rooms?.length > 0 || window._setupRooms.sub_rooms?.length > 0)) {
        populateModalRooms(); return;
    }
    ['modal-room','modal-room-b1','modal-room-b2'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = '<option>Loading rooms...</option>';
    });
    try {
        const f = getFilters();
        const qs = new URLSearchParams(f).toString();
        const res = await fetch(`/api/classwork-timetable/room-setup/auto-rooms?${qs}`);
        const json = await res.json();
        if (json.status === 'success' && (json.data.main_rooms?.length > 0 || json.data.sub_rooms?.length > 0)) {
            window._setupRooms = json.data;
        }
    } catch (err) { console.warn('fetchAndPopulateModalRooms error:', err.message); }
    populateModalRooms();
}

function populateModalRooms() {
    const rooms     = window._setupRooms;
    const mainRooms = rooms?.main_rooms || [];
    const subRooms  = rooms?.sub_rooms  || [];
    const allRooms  = [...mainRooms, ...subRooms];

    const buildOptions = (selectId, defaultVal = null) => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = '<option value="">— Select Room —</option>';
        if (allRooms.length === 0) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.textContent = '⚠ No rooms saved — go to Room Setup tab first';
            sel.appendChild(opt);
            return;
        }
        if (mainRooms.length > 0) {
            const grp = document.createElement('optgroup');
            grp.label = '🏛 Main Rooms (Theory)';
            mainRooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r; opt.textContent = r;
                if (r === defaultVal) opt.selected = true;
                grp.appendChild(opt);
            });
            sel.appendChild(grp);
        }
        if (subRooms.length > 0) {
            const grp = document.createElement('optgroup');
            grp.label = '🔬 Sub Rooms (Lab / Tutorial)';
            subRooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r; opt.textContent = r;
                if (r === defaultVal) opt.selected = true;
                grp.appendChild(opt);
            });
            sel.appendChild(grp);
        }
    };

    buildOptions('modal-room',    mainRooms[0] || null);
    buildOptions('modal-room-b1', subRooms[0]  || mainRooms[0] || null);
    buildOptions('modal-room-b2', subRooms[1]  || subRooms[0] || mainRooms[0] || null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM SETUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
const RS = { mode: 'main', main: [], sub: [], allRooms: [] };

function getRsFilters() {
    return {
        programme_id:  document.getElementById('rs-prog')?.value || '',
        branch_id:     document.getElementById('rs-branch')?.value || '',
        semester_id:   document.getElementById('rs-sem')?.value || '',
        section_id:    document.getElementById('rs-section')?.value || '',
        academic_year: document.getElementById('rs-acad-year')?.value || '',
        semester_type: document.getElementById('rs-sem-type')?.value || '',
    };
}

function setSelectMode(mode) {
    RS.mode = mode;
    document.getElementById('mode-main-btn').classList.toggle('active', mode === 'main');
    document.getElementById('mode-sub-btn').classList.toggle('active', mode === 'sub');
}

function toggleRoomCard(roomCode) {
    const mainIdx = RS.main.indexOf(roomCode);
    const subIdx  = RS.sub.indexOf(roomCode);
    if (mainIdx !== -1) { RS.main.splice(mainIdx, 1); refreshRoomPicker(); return; }
    if (subIdx  !== -1) { RS.sub.splice(subIdx, 1);   refreshRoomPicker(); return; }
    if (RS.mode === 'main') {
        if (RS.main.length >= 2) { showAlert('Maximum 2 Main rooms allowed', 'warning'); return; }
        RS.main.push(roomCode);
    } else {
        RS.sub.push(roomCode);
    }
    refreshRoomPicker();
}

function deselectRoom(roomCode, role) {
    if (role === 'main') RS.main = RS.main.filter(r => r !== roomCode);
    else                 RS.sub  = RS.sub.filter(r => r !== roomCode);
    refreshRoomPicker();
}

function clearRoomSelection() { RS.main = []; RS.sub = []; refreshRoomPicker(); }

function refreshRoomPicker() {
    document.querySelectorAll('.room-card').forEach(card => {
        const code = card.dataset.code;
        card.classList.remove('selected-main', 'selected-sub');
        const badge = card.querySelector('.room-card-badge');
        if (badge) badge.remove();
        if (RS.main.includes(code)) {
            card.classList.add('selected-main');
            card.insertAdjacentHTML('beforeend', '<span class="room-card-badge badge-M">M</span>');
        } else if (RS.sub.includes(code)) {
            card.classList.add('selected-sub');
            card.insertAdjacentHTML('beforeend', '<span class="room-card-badge badge-S">S</span>');
        }
    });
    document.getElementById('main-count').textContent = RS.main.length + ' / 2';
    document.getElementById('sub-count').textContent  = RS.sub.length;

    const mainChips = document.getElementById('main-chips');
    const subChips  = document.getElementById('sub-chips');
    mainChips.innerHTML = RS.main.length === 0
        ? '<span class="rs-sel-empty">None selected</span>'
        : RS.main.map(r => `<span class="rs-chip main-chip" onclick="deselectRoom('${r}','main')">${r} <span class="rs-chip-x">×</span></span>`).join('');
    subChips.innerHTML = RS.sub.length === 0
        ? '<span class="rs-sel-empty">None selected</span>'
        : RS.sub.map(r => `<span class="rs-chip sub-chip" onclick="deselectRoom('${r}','sub')">${r} <span class="rs-chip-x">×</span></span>`).join('');
}

async function loadRoomPicker() {
    const container = document.getElementById('room-picker-container');
    if (!container) return;
    try {
        const res = await fetch('/api/classwork-timetable/rooms-by-block');
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);
        RS.allRooms = json.data;
        renderRoomPicker(json.data);
    } catch (err) {
        container.innerHTML = `<p class="empty-msg" style="color:red">Failed to load rooms: ${err.message}</p>`;
    }
}

function renderRoomPicker(blocks) {
    const container = document.getElementById('room-picker-container');
    if (!container) return;
    if (!blocks || blocks.length === 0) {
        container.innerHTML = '<p class="empty-msg" style="padding:30px;text-align:center">No rooms found in master</p>';
        return;
    }
    const typeIcon  = { Classroom:'🏫', Lab:'🔬', Hall:'🏛', Auditorium:'🎭' };
    const typeClass = { Classroom:'type-Classroom', Lab:'type-Lab', Hall:'type-Hall', Auditorium:'type-Auditorium' };
    let html = '';
    blocks.forEach((block, idx) => {
        const isOpen = idx < 4;
        html += `<div class="block-section">
            <div class="block-header" onclick="toggleBlock(this)">
                <span class="block-toggle ${isOpen ? 'open' : ''}">▶</span>
                <span class="block-code">${block.block_code}</span>
                <span class="block-name">— ${block.block_name}</span>
                <span class="block-room-count">${block.rooms.length} rooms</span>
            </div>
            <div class="block-rooms ${isOpen ? '' : 'collapsed'}">`;
        block.rooms.forEach(room => {
            const icon = typeIcon[room.room_type] || '🏫';
            const cls  = typeClass[room.room_type] || 'type-Classroom';
            html += `<div class="room-card ${cls}" data-code="${room.room_code}" onclick="toggleRoomCard('${room.room_code}')">
                <div class="room-card-code">${room.room_code}</div>
                <div class="room-card-type">${icon} ${room.room_type}</div>
                ${room.total_capacity > 0 ? `<div class="room-card-cap">👥 ${room.total_capacity}</div>` : ''}
                ${room.has_projector ? '<div class="room-card-cap">📽</div>' : ''}
            </div>`;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
    refreshRoomPicker();
}

function toggleBlock(header) {
    const toggle = header.querySelector('.block-toggle');
    const rooms  = header.nextElementSibling;
    const isOpen = !rooms.classList.contains('collapsed');
    rooms.classList.toggle('collapsed', isOpen);
    toggle.classList.toggle('open', !isOpen);
}

async function loadRoomSetup() {
    const f = getRsFilters();
    if (!f.programme_id || !f.branch_id || !f.semester_id || !f.section_id || !f.academic_year || !f.semester_type) {
        showAlert('Please fill all Room Setup filters', 'warning'); return;
    }
    try {
        showLoading(true);
        const qs = new URLSearchParams(f).toString();
        const res = await fetch(`/api/classwork-timetable/room-setup?${qs}`);
        const json = await res.json();
        showLoading(false);
        if (json.status !== 'success') throw new Error(json.message);
        RS.main = json.data.main.map(r => r.room_no);
        RS.sub  = json.data.sub.map(r => r.room_no);
        refreshRoomPicker();
        loadRoomSetupList();
        showAlert(`Room setup loaded — ${RS.main.length} main, ${RS.sub.length} sub rooms`, 'success');
    } catch (err) {
        showLoading(false);
        showAlert('Failed to load room setup: ' + err.message, 'error');
    }
}

async function saveRoomSetup() {
    const f = getRsFilters();
    if (!f.programme_id || !f.branch_id || !f.semester_id || !f.section_id || !f.academic_year || !f.semester_type) {
        showAlert('Please fill all Room Setup filters', 'warning'); return;
    }
    if (RS.main.length === 0) { showAlert('Select at least 1 Main room', 'warning'); return; }
    try {
        showLoading(true);
        const res = await fetch('/api/classwork-timetable/room-setup/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...f, main_rooms: RS.main, sub_rooms: RS.sub })
        });
        const json = await res.json();
        showLoading(false);
        if (json.status !== 'success') throw new Error(json.message);
        showAlert(`✅ Saved! Main: [${RS.main.join(', ')}] | Sub: [${RS.sub.join(', ') || 'None'}]`, 'success');
        loadRoomSetupList();
    } catch (err) {
        showLoading(false);
        showAlert('Save failed: ' + err.message, 'error');
    }
}

async function loadRoomSetupList() {
    try {
        const res = await fetch('/api/classwork-timetable/room-setup/list');
        const json = await res.json();
        if (json.status !== 'success') return;
        const container = document.getElementById('room-setup-list-container');
        if (json.data.length === 0) { container.innerHTML = '<p class="empty-msg">No room setups saved yet</p>'; return; }

        const grouped = {};
        json.data.forEach(r => {
            const key = `${r.programme_id}_${r.branch_id}_${r.semester_id}_${r.section_id}_${r.academic_year}_${r.semester_type}`;
            if (!grouped[key]) grouped[key] = { info: r, main: [], sub: [] };
            if (r.room_role === 'Main') grouped[key].main.push(r.room_no);
            else grouped[key].sub.push(r.room_no);
        });

        let html = `<table class="setup-list-table">
            <thead><tr>
                <th>Programme</th><th>Branch</th><th>Semester</th><th>Section</th>
                <th>Ac. Year</th><th>Type</th><th>Main Rooms</th><th>Sub Rooms</th>
                <th style="text-align:center">Actions</th>
            </tr></thead><tbody>`;

        Object.values(grouped).forEach((g, idx) => {
            const keyData = JSON.stringify({
                programme_id: g.info.programme_id, branch_id: g.info.branch_id,
                semester_id: g.info.semester_id, section_id: g.info.section_id,
                academic_year: g.info.academic_year, semester_type: g.info.semester_type,
                main_rooms: g.main, sub_rooms: g.sub,
                programme_code: g.info.programme_code, branch_code: g.info.branch_code,
                semester_number: g.info.semester_number, section_name: g.info.section_name
            }).replace(/'/g, '&apos;');

            html += `<tr>
                <td>${g.info.programme_code}</td><td>${g.info.branch_name}</td>
                <td>Sem ${g.info.semester_number}</td><td>${g.info.section_name}</td>
                <td>${g.info.academic_year}</td>
                <td><span class="room-badge ${g.info.semester_type==='Even'?'badge-main':'badge-sub'}">${g.info.semester_type}</span></td>
                <td>${g.main.map(r=>`<b>${r}</b>`).join(', ')}</td>
                <td style="color:#555">${g.sub.join(', ')||'—'}</td>
                <td style="text-align:center;white-space:nowrap">
                    <button class="btn btn-outline btn-xs" onclick='editRoomSetup(${keyData})'>✏ Edit</button>
                    <button class="btn btn-danger btn-xs"  onclick='deleteRoomSetup(${keyData})'>🗑</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) { console.warn('loadRoomSetupList error:', err.message); }
}

function editRoomSetup(data) {
    document.getElementById('rs-prog').value = data.programme_id;
    document.getElementById('rs-prog').dispatchEvent(new Event('change'));
    setTimeout(() => {
        document.getElementById('rs-branch').value = data.branch_id;
        document.getElementById('rs-branch').dispatchEvent(new Event('change'));
        setTimeout(() => {
            document.getElementById('rs-sem').value     = data.semester_id;
            document.getElementById('rs-section').value = data.section_id;
        }, 60);
    }, 60);
    document.getElementById('rs-acad-year').value = data.academic_year;
    document.getElementById('rs-sem-type').value  = data.semester_type;
    RS.main = data.main_rooms || [];
    RS.sub  = data.sub_rooms  || [];
    refreshRoomPicker();
    document.getElementById('panel-roomsetup').scrollIntoView({ behavior: 'smooth' });
    showAlert(`✏ Editing room setup — modify rooms and click Save`, 'info');
}

async function deleteRoomSetup(data) {
    if (!confirm(`Delete room setup for ${data.branch_code} Sem ${data.semester_number} ${data.section_name}?`)) return;
    try {
        showLoading(true);
        const res = await fetch('/api/classwork-timetable/room-setup/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ programme_id: data.programme_id, branch_id: data.branch_id,
                semester_id: data.semester_id, section_id: data.section_id,
                academic_year: data.academic_year, semester_type: data.semester_type })
        });
        const json = await res.json();
        showLoading(false);
        if (json.status !== 'success') throw new Error(json.message);
        showAlert('✅ Room setup deleted', 'success');
        loadRoomSetupList();
        RS.main = []; RS.sub = []; refreshRoomPicker();
    } catch (err) {
        showLoading(false);
        showAlert('Delete failed: ' + err.message, 'error');
    }
}

function showAlert(msg, type = 'info') {
    const el = document.getElementById('alert-box');
    if (!el) return;
    el.className = `tt-alert tt-alert-${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showLoading(show) {
    const el = document.getElementById('loading-bar');
    if (el) el.style.display = show ? 'block' : 'none';
}
