let editingId = null;
let allStaffData = [];
let selectedBranchPills = new Set();

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("programmeId").addEventListener("change", loadBranches);

    // Single branchId listener
    document.getElementById("branchId").addEventListener("change", async function () {
        await loadSemesters();
        const selectedOption = document.getElementById("branchId");
        const branchCode = selectedOption.options[selectedOption.selectedIndex].text;
        if (allStaffData.length > 0 && branchCode) {
            renderBranchPills(branchCode);
        }
    });

    document.getElementById("semesterId").addEventListener("change", loadRegulations);
    document.getElementById("regulationId").addEventListener("change", loadSubjects);
    document.getElementById("batchId").addEventListener("change", loadSections);

    // Auto-fill allotment_type when subject is selected
    document.getElementById("subjectId").addEventListener("change", function () {
        const selected = this.options[this.selectedIndex];
        const subjectType = selected.dataset.subjectType || "";
        const typeField = document.getElementById("allotmentType");
        if (subjectType) {
            typeField.value = subjectType;
        } else {
            typeField.value = "Theory";
        }
    });

    loadProgrammes();
    loadBatches();
    loadStaff();
    loadAllotments();
});

/* ================================
   LOAD DROPDOWNS
================================ */
async function loadProgrammes() {
    const res = await fetch("/api/programmes");
    const data = await res.json();
    const dropdown = document.getElementById("programmeId");
    dropdown.innerHTML = `<option value="">Select Programme</option>`;
    data.data.forEach(p => {
        dropdown.innerHTML += `<option value="${p.programme_id}">${p.programme_code}</option>`;
    });
}

async function loadBranches() {
    const programmeId = document.getElementById("programmeId").value;
    const res = await fetch(`/api/branches?programme_id=${programmeId}`);
    const data = await res.json();
    const dropdown = document.getElementById("branchId");
    dropdown.innerHTML = `<option value="">Select Branch</option>`;
    data.data.forEach(b => {
        dropdown.innerHTML += `<option value="${b.branch_id}">${b.branch_code}</option>`;
    });
}

async function loadSemesters() {
    const branchId = document.getElementById("branchId").value;
    const res = await fetch(`/api/semesters?branch_id=${branchId}`);
    const data = await res.json();
    const dropdown = document.getElementById("semesterId");
    dropdown.innerHTML = `<option value="">Select Semester</option>`;
    data.data.forEach(s => {
        dropdown.innerHTML += `<option value="${s.semester_id}">${s.semester_name}</option>`;
    });
}

async function loadRegulations() {
    const res = await fetch(`/api/regulations`);
    const data = await res.json();
    const dropdown = document.getElementById("regulationId");
    dropdown.innerHTML = `<option value="">Select Regulation</option>`;
    data.data.forEach(r => {
        dropdown.innerHTML += `<option value="${r.regulation_id}">${r.regulation_name}</option>`;
    });
}

async function loadSubjects() {
    const programmeId = document.getElementById("programmeId").value;
    const branchId = document.getElementById("branchId").value;
    const semesterId = document.getElementById("semesterId").value;
    const regulationId = document.getElementById("regulationId").value;

    const res = await fetch(
        `/api/subjects?programme_id=${programmeId}&branch_id=${branchId}&semester_id=${semesterId}&regulation_id=${regulationId}`
    );
    const data = await res.json();
    const dropdown = document.getElementById("subjectId");
    dropdown.innerHTML = `<option value="">Select Subject</option>`;
    data.data.forEach(s => {
        // ✅ Store subject_type in data attribute
        dropdown.innerHTML += `<option value="${s.subject_id}" data-subject-type="${s.subject_type || 'Theory'}">${s.syllabus_code} - ${s.subject_name}</option>`;
    });

    // Reset allotment type
    document.getElementById("allotmentType").value = "Theory";
}

async function loadBatches() {
    const res = await fetch("/api/batches");
    const data = await res.json();
    const dropdown = document.getElementById("batchId");
    dropdown.innerHTML = `<option value="">Select Batch</option>`;
    data.data.forEach(b => {
        dropdown.innerHTML += `<option value="${b.batch_id}">${b.batch_name}</option>`;
    });
}

async function loadSections() {
    const batchId = document.getElementById("batchId").value;
    const res = await fetch(`/api/sections?batch_id=${batchId}`);
    const data = await res.json();
    const dropdown = document.getElementById("sectionId");
    dropdown.innerHTML = `<option value="">Select Section</option>`;
    data.data.forEach(s => {
        dropdown.innerHTML += `<option value="${s.section_id}">${s.section_name}</option>`;
    });
}

/* ================================
   STAFF + PILLS
================================ */
async function loadStaff() {
    const res = await fetch("/api/staff");
    const result = await res.json();

    if (!result.data || !result.data.staff || result.data.staff.length === 0) {
        console.warn("No staff found");
        return;
    }

    allStaffData = result.data.staff;
    renderBranchPills(null);
}

function renderBranchPills(autoSelectBranchCode = null) {
    const branchMap = new Map();
    allStaffData.forEach(s => {
        if (!branchMap.has(s.branch_code)) {
            branchMap.set(s.branch_code, { code: s.branch_code });
        }
    });

    const branches = [...branchMap.values()];
    branches.sort((a, b) => a.code.localeCompare(b.code));

    if (autoSelectBranchCode) {
        selectedBranchPills.clear();
        selectedBranchPills.add(autoSelectBranchCode);
    }

    const container = document.getElementById("branchPillsContainer");
    container.innerHTML = "";

    branches.forEach(br => {
        const active = selectedBranchPills.has(br.code);
        const pill = document.createElement("span");
        pill.className = "branch-pill" + (active ? " active" : "");
        pill.textContent = br.code;
        pill.dataset.branchCode = br.code;
        pill.onclick = () => {
            if (selectedBranchPills.has(br.code)) {
                selectedBranchPills.delete(br.code);
                pill.classList.remove("active");
            } else {
                selectedBranchPills.add(br.code);
                pill.classList.add("active");
            }
            renderFacultyDropdown();
        };
        container.appendChild(pill);
    });

    renderFacultyDropdown();
}

function renderFacultyDropdown() {
    let filtered = allStaffData;

    if (selectedBranchPills.size > 0) {
        filtered = filtered.filter(s => selectedBranchPills.has(s.branch_code));
    }

    filtered.sort((a, b) => {
        if (a.branch_code !== b.branch_code) return a.branch_code.localeCompare(b.branch_code);
        if (a.employee_id !== b.employee_id) return a.employee_id.localeCompare(b.employee_id);
        return a.full_name.localeCompare(b.full_name);
    });

    const dropdown = document.getElementById("staffId");
    dropdown.innerHTML = `<option value="">Select Faculty</option>`;
    filtered.forEach(st => {
        dropdown.innerHTML += `<option value="${st.staff_id}">${st.branch_code} - ${st.employee_id} - ${st.full_name}</option>`;
    });
}

/* ================================
   SAVE
================================ */
async function saveAllotment() {
    if (!programmeId.value ||
        !branchId.value ||
        !semesterId.value ||
        !regulationId.value ||
        !subjectId.value ||
        !batchId.value ||
        !sectionId.value ||
        !staffId.value ||
        !allotmentType.value) {
        alert("Please select all fields");
        return;
    }

    const body = {
        programme_id:   parseInt(programmeId.value),
        branch_id:      parseInt(branchId.value),
        semester_id:    parseInt(semesterId.value),
        regulation_id:  parseInt(regulationId.value),
        subject_id:     parseInt(subjectId.value),
        allotment_type: allotmentType.value,
        batch_id:       parseInt(batchId.value),
        section_id:     parseInt(sectionId.value),
        staff_id:       parseInt(staffId.value)
    };

    const url    = editingId ? `/api/subject-allotments/${editingId}` : "/api/subject-allotments";
    const method = editingId ? "PUT" : "POST";

    const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
        alert("Allotment saved successfully!");
        editingId = null;
        loadAllotments();
    } else {
        alert("Error: " + data.message);
    }
}

/* ================================
   LOAD TABLE
================================ */
async function loadAllotments() {
    const res  = await fetch("/api/subject-allotments");
    const data = await res.json();

    let html = `
        <table class="simple-table">
            <tr>
                <th>Syllabus</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Batch</th>
                <th>Section</th>
                <th>Faculty</th>
                <th>Actions</th>
            </tr>
    `;
    data.data.forEach(row => {
        html += `
            <tr>
                <td>${row.syllabus_code}</td>
                <td>${row.subject_name}</td>
                <td><span class="type-badge type-${(row.allotment_type || 'Theory').toLowerCase()}">${row.allotment_type || 'Theory'}</span></td>
                <td>${row.batch_name}</td>
                <td>${row.section_name}</td>
                <td>${row.faculty_name}</td>
                <td>
                    <button onclick="editAllotment(${row.allotment_id})" class="btn btn-primary btn-sm">Edit</button>
                    <button onclick="deleteAllotment(${row.allotment_id})" class="btn btn-danger btn-sm">Delete</button>
                </td>
            </tr>
        `;
    });
    html += `</table>`;
    document.getElementById("tableContainer").innerHTML = html;
}

/* ================================
   EDIT
================================ */
async function editAllotment(id) {
    const res  = await fetch("/api/subject-allotments");
    const data = await res.json();

    const row = data.data.find(r => r.allotment_id == id);
    if (!row) return;

    editingId = id;

    programmeId.value = row.programme_id;
    await loadBranches();

    branchId.value = row.branch_id;
    await loadSemesters();

    // Update pills to match branch
    const branchSelect = document.getElementById("branchId");
    const branchCode   = branchSelect.options[branchSelect.selectedIndex].text;
    renderBranchPills(branchCode);

    semesterId.value = row.semester_id;
    await loadRegulations();

    regulationId.value = row.regulation_id;
    await loadSubjects();

    subjectId.value = row.subject_id;

    // ✅ Set allotment type from saved record
    document.getElementById("allotmentType").value = row.allotment_type || "Theory";

    batchId.value = row.batch_id;
    await loadSections();

    sectionId.value = row.section_id;
    staffId.value   = row.staff_id;

    alert("Edit mode enabled. Modify and click Save.");
}

/* ================================
   DELETE
================================ */
async function deleteAllotment(id) {
    if (!confirm("Are you sure?")) return;
    await fetch(`/api/subject-allotments/${id}`, { method: "DELETE" });
    loadAllotments();
}
