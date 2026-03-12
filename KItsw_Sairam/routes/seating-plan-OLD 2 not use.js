/**
 * Seating Plan Master - Frontend JavaScript
 * Handles blocks, rooms, and seating arrangements
 * UPDATED: Room blocking feature integrated
 */

const API_BASE = '/api/seating-plans';
let currentEditId = null;
let currentEditType = null;
let allBlocks = [];
let allRooms = [];
let allArrangements = [];
let benchSelections = []; // Store bench selection state

// =====================================================
// ROOM BLOCKING STATE
// =====================================================
let currentViewRoomId = null;
let currentViewRoomNumber = '';

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadAllData();
    setupFormHandlers();
});

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'blocks') loadBlocks();
    if (tabName === 'rooms') loadRooms();
    if (tabName === 'arrangements') loadArrangements();
}

async function loadAllData() {
    await loadBlocks();
    await loadRooms();
    await loadArrangements();
}

function setupFormHandlers() {
    document.getElementById('blockForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBlock();
    });
    document.getElementById('roomForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRoom();
    });
}

// =====================================================
// BLOCK MANAGEMENT
// =====================================================

async function loadBlocks() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/blocks`);
        const result = await response.json();
        if (result.status === 'success') {
            allBlocks = result.data;
            displayBlocks(result.data);
            populateBlockDropdown(result.data);
        } else {
            showAlert('Failed to load blocks', 'danger');
        }
    } catch (error) {
        showAlert('Error loading blocks: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function displayBlocks(blocks) {
    const tbody = document.getElementById('blocksTableBody');
    if (blocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No blocks found. Add one to get started!</td></tr>';
        return;
    }
    tbody.innerHTML = blocks.map(block => `
        <tr>
            <td><strong>${escapeHtml(block.block_code)}</strong></td>
            <td>${escapeHtml(block.block_name)}</td>
            <td>${block.total_floors}</td>
            <td>${escapeHtml(block.description || '-')}</td>
            <td>
                <span class="badge ${block.is_active ? 'badge-success' : 'badge-danger'}">
                    ${block.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="editBlock(${block.block_id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBlock(${block.block_id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function showBlockForm() {
    currentEditId = null;
    currentEditType = 'block';
    document.getElementById('blockForm').reset();
    document.getElementById('blockId').value = '';
    document.getElementById('blockFormContainer').style.display = 'block';
    document.getElementById('blockFormContainer').scrollIntoView({ behavior: 'smooth' });
}

function cancelBlockForm() {
    document.getElementById('blockFormContainer').style.display = 'none';
    document.getElementById('blockForm').reset();
    currentEditId = null;
}

function editBlock(blockId) {
    const block = allBlocks.find(b => b.block_id === blockId);
    if (!block) return;
    currentEditId = blockId;
    currentEditType = 'block';
    document.getElementById('blockId').value = block.block_id;
    document.getElementById('blockCode').value = block.block_code;
    document.getElementById('blockName').value = block.block_name;
    document.getElementById('totalFloors').value = block.total_floors;
    document.getElementById('blockDescription').value = block.description || '';
    document.getElementById('blockFormContainer').style.display = 'block';
    document.getElementById('blockFormContainer').scrollIntoView({ behavior: 'smooth' });
}

async function saveBlock() {
    try {
        showLoading();
        const formData = new FormData(document.getElementById('blockForm'));
        const data = Object.fromEntries(formData.entries());
        const url = currentEditId ? `${API_BASE}/blocks/${currentEditId}` : `${API_BASE}/blocks`;
        const method = currentEditId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showAlert(`Block ${currentEditId ? 'updated' : 'created'} successfully!`, 'success');
            cancelBlockForm();
            await loadBlocks();
        } else {
            showAlert(result.message || 'Failed to save block', 'danger');
        }
    } catch (error) {
        showAlert('Error saving block: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteBlock(blockId) {
    if (!confirm('Are you sure you want to delete this block? This will also delete all associated rooms.')) return;
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/blocks/${blockId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.status === 'success') {
            showAlert('Block deleted successfully!', 'success');
            await loadBlocks();
            await loadRooms();
        } else {
            showAlert(result.message || 'Failed to delete block', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting block: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function populateBlockDropdown(blocks) {
    const select = document.getElementById('roomBlock');
    select.innerHTML = '<option value="">Select Block</option>' +
        blocks.filter(b => b.is_active).map(block =>
            `<option value="${block.block_id}">${escapeHtml(block.block_code)} - ${escapeHtml(block.block_name)}</option>`
        ).join('');
}

// =====================================================
// ROOM MANAGEMENT
// =====================================================

async function loadRooms() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/rooms`);
        const result = await response.json();
        if (result.status === 'success') {
            allRooms = result.data;
            displayRooms(result.data);
        } else {
            showAlert('Failed to load rooms', 'danger');
        }
    } catch (error) {
        showAlert('Error loading rooms: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Display rooms in table
 * UPDATED: ⛔ Block Dates + 📅 Blocked buttons added in Actions column
 */
function displayRooms(rooms) {
    const tbody = document.getElementById('roomsTableBody');
    if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No rooms found. Add one to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = rooms.map(room => {
        let actualCapacity = room.total_capacity;
        let benchCount = room.total_rows * room.total_columns;

        if (room.layout_data) {
            try {
                const layoutData = typeof room.layout_data === 'string'
                    ? JSON.parse(room.layout_data)
                    : room.layout_data;
                if (layoutData && layoutData.benches) {
                    const availableBenches = layoutData.benches.filter(b => b.available).length;
                    actualCapacity = availableBenches * room.students_per_bench;
                    benchCount = availableBenches;
                }
            } catch (e) {
                console.error('Error parsing layout_data for room:', room.room_id, e);
            }
        }

        return `
            <tr>
                <td><strong>${escapeHtml(room.room_code)}</strong></td>
                <td>${escapeHtml(room.room_name)}</td>
                <td>${escapeHtml(room.block_code || '-')}</td>
                <td><span class="badge badge-info">${room.room_type}</span></td>
                <td>${room.floor_number}</td>
                <td>${room.total_rows} × ${room.total_columns} × ${room.students_per_bench}<br>
                    <small style="color:#666;">(${benchCount} benches)</small></td>
                <td><strong>${actualCapacity}</strong></td>
                <td>
                    <span class="badge ${room.is_active ? 'badge-success' : 'badge-danger'}">
                        ${room.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editRoom(${room.room_id})">Edit</button>
                    <button class="btn btn-primary btn-sm" onclick="viewRoomLayout(${room.room_id})">View</button>
                    <button class="btn-block-dates" onclick="openBlockModal(${room.room_id}, '${escapeHtml(room.room_code)}')">⛔ Block Dates</button>
                    <button onclick="viewBlockedSlots(${room.room_id}, '${escapeHtml(room.room_code)}')"
                        style="font-size:11px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:3px 8px; cursor:pointer; margin-left:2px;">
                        📅 Blocked
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRoom(${room.room_id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function showRoomForm() {
    currentEditId = null;
    currentEditType = 'room';
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    benchSelections = [];
    document.getElementById('roomFormContainer').style.display = 'block';
    document.getElementById('layoutPreviewContainer').style.display = 'none';
    generateBenchSelector();
    document.getElementById('roomFormContainer').scrollIntoView({ behavior: 'smooth' });
}

function cancelRoomForm() {
    document.getElementById('roomFormContainer').style.display = 'none';
    document.getElementById('layoutPreviewContainer').style.display = 'none';
    document.getElementById('roomForm').reset();
    currentEditId = null;
}

function editRoom(roomId) {
    const room = allRooms.find(r => r.room_id === roomId);
    if (!room) return;
    currentEditId = roomId;
    currentEditType = 'room';

    document.getElementById('roomId').value = room.room_id;
    document.getElementById('roomBlock').value = room.block_id;
    document.getElementById('roomCode').value = room.room_code;
    document.getElementById('roomName').value = room.room_name;
    document.getElementById('roomType').value = room.room_type;
    document.getElementById('floorNumber').value = room.floor_number;
    document.getElementById('totalRows').value = room.total_rows;
    document.getElementById('totalColumns').value = room.total_columns;
    document.getElementById('studentsPerBench').value = room.students_per_bench;
    document.getElementById('hasProjector').checked = room.has_projector;
    document.getElementById('hasAC').checked = room.has_ac;
    document.getElementById('roomDescription').value = room.description || '';

    benchSelections = [];
    if (room.layout_data) {
        try {
            const layoutData = typeof room.layout_data === 'string'
                ? JSON.parse(room.layout_data)
                : room.layout_data;
            if (layoutData && layoutData.benches) benchSelections = layoutData.benches;
        } catch (e) {
            console.error('Error parsing layout_data:', e);
        }
    }

    if (benchSelections.length === 0) {
        generateBenchSelector();
    } else {
        const grid = document.getElementById('benchSelectorGrid');
        grid.style.gridTemplateColumns = `repeat(${room.total_columns}, 60px)`;
        grid.style.gridTemplateRows = `repeat(${room.total_rows}, 60px)`;
        grid.innerHTML = '';
        benchSelections.forEach((bench, index) => {
            const cell = document.createElement('div');
            cell.className = `bench-cell ${bench.available || bench.selected ? 'selected' : ''}`;
            cell.textContent = bench.label;
            cell.dataset.index = index;
            cell.onclick = () => toggleBench(index);
            cell.title = `Click to ${(bench.available || bench.selected) ? 'deselect' : 'select'} bench ${bench.label}`;
            grid.appendChild(cell);
            bench.selected = bench.available !== undefined ? bench.available : bench.selected;
        });
        updateBenchStats();
    }

    document.getElementById('roomFormContainer').style.display = 'block';
    document.getElementById('roomFormContainer').scrollIntoView({ behavior: 'smooth' });
}

async function saveRoom() {
    try {
        showLoading();
        const formData = new FormData(document.getElementById('roomForm'));
        const data = Object.fromEntries(formData.entries());
        data.has_projector = document.getElementById('hasProjector').checked;
        data.has_ac = document.getElementById('hasAC').checked;
        data.is_active = true;
        data.layout_data = {
            benches: benchSelections.map(bench => ({
                row: bench.row,
                col: bench.col,
                available: bench.selected,
                label: bench.label
            }))
        };

        const url = currentEditId ? `${API_BASE}/rooms/${currentEditId}` : `${API_BASE}/rooms`;
        const method = currentEditId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showAlert(`Room ${currentEditId ? 'updated' : 'created'} successfully!`, 'success');
            cancelRoomForm();
            await loadRooms();
        } else {
            showAlert(result.message || 'Failed to save room', 'danger');
        }
    } catch (error) {
        showAlert('Error saving room: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteRoom(roomId) {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.status === 'success') {
            showAlert('Room deleted successfully!', 'success');
            await loadRooms();
        } else {
            showAlert(result.message || 'Failed to delete room', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting room: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function updateCapacityPreview() {
    const rows = parseInt(document.getElementById('totalRows').value) || 0;
    const cols = parseInt(document.getElementById('totalColumns').value) || 0;
    const currentRows = benchSelections.length > 0 ? Math.max(...benchSelections.map(b => b.row)) : 0;
    const currentCols = benchSelections.length > 0 ? Math.max(...benchSelections.map(b => b.col)) : 0;
    if (rows !== currentRows || cols !== currentCols) {
        generateBenchSelector();
    } else {
        updateBenchStats();
    }
}

function generateBenchSelector() {
    const rows = parseInt(document.getElementById('totalRows').value) || 0;
    const cols = parseInt(document.getElementById('totalColumns').value) || 0;
    if (rows === 0 || cols === 0) {
        document.getElementById('benchSelectorGrid').innerHTML =
            '<p style="color: #999; padding: 20px;">Enter rows and columns above to see the bench grid</p>';
        updateBenchStats();
        return;
    }
    const grid = document.getElementById('benchSelectorGrid');
    grid.style.gridTemplateColumns = `repeat(${cols}, 60px)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 60px)`;
    grid.innerHTML = '';
    benchSelections = [];
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            benchSelections.push({
                row: r + 1,
                col: c + 1,
                label: `${rowLabels[r] || r + 1}${c + 1}`,
                selected: true
            });
        }
    }
    benchSelections.forEach((bench, index) => {
        const cell = document.createElement('div');
        cell.className = `bench-cell ${bench.selected ? 'selected' : ''}`;
        cell.textContent = bench.label;
        cell.dataset.index = index;
        cell.onclick = () => toggleBench(index);
        cell.title = `Click to ${bench.selected ? 'deselect' : 'select'} bench ${bench.label}`;
        grid.appendChild(cell);
    });
    updateBenchStats();
}

function toggleBench(index) {
    benchSelections[index].selected = !benchSelections[index].selected;
    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.classList.toggle('selected');
        cell.title = `Click to ${benchSelections[index].selected ? 'deselect' : 'select'} bench ${benchSelections[index].label}`;
    }
    updateBenchStats();
}

function updateBenchStats() {
    const perBench = parseInt(document.getElementById('studentsPerBench').value) || 1;
    const selectedCount = benchSelections.filter(b => b.selected).length;
    const capacity = selectedCount * perBench;
    document.getElementById('selectedBenchCount').textContent = selectedCount;
    document.getElementById('calculatedCapacity').textContent = capacity;
    document.getElementById('capacityPreview').value = capacity;
}

function selectAllBenches() {
    benchSelections.forEach(bench => bench.selected = true);
    document.querySelectorAll('.bench-cell').forEach(cell => {
        cell.classList.add('selected');
        const index = parseInt(cell.dataset.index);
        cell.title = `Click to deselect bench ${benchSelections[index].label}`;
    });
    updateBenchStats();
}

function clearAllBenches() {
    benchSelections.forEach(bench => bench.selected = false);
    document.querySelectorAll('.bench-cell').forEach(cell => {
        cell.classList.remove('selected');
        const index = parseInt(cell.dataset.index);
        cell.title = `Click to select bench ${benchSelections[index].label}`;
    });
    updateBenchStats();
}

function previewLayout() {
    const rows = parseInt(document.getElementById('totalRows').value);
    const cols = parseInt(document.getElementById('totalColumns').value);
    if (!rows || !cols) { showAlert('Please enter rows and columns', 'danger'); return; }

    const container = document.getElementById('layoutPreview');
    const layoutGrid = document.createElement('div');
    layoutGrid.className = 'layout-grid';
    layoutGrid.style.gridTemplateColumns = `repeat(${cols}, 50px)`;
    layoutGrid.style.gridTemplateRows = `repeat(${rows}, 50px)`;
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.textContent = `${rowLabels[r] || r + 1}${c + 1}`;
            layoutGrid.appendChild(seat);
        }
    }
    container.innerHTML = '';
    container.appendChild(layoutGrid);
    document.getElementById('layoutPreviewContainer').style.display = 'block';
    document.getElementById('layoutPreviewContainer').scrollIntoView({ behavior: 'smooth' });
}

async function viewRoomLayout(roomId) {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/rooms/${roomId}`);
        const result = await response.json();
        if (result.status === 'success') {
            const room = result.data;
            let availableBenches = [];
            let actualCapacity = room.total_capacity;
            if (room.layout_data) {
                try {
                    const layoutData = typeof room.layout_data === 'string'
                        ? JSON.parse(room.layout_data)
                        : room.layout_data;
                    if (layoutData && layoutData.benches) {
                        availableBenches = layoutData.benches;
                        actualCapacity = availableBenches.filter(b => b.available).length * room.students_per_bench;
                    }
                } catch (e) {}
            }
            const container = document.getElementById('layoutPreview');
            const layoutGrid = document.createElement('div');
            layoutGrid.className = 'layout-grid';
            layoutGrid.style.gridTemplateColumns = `repeat(${room.total_columns}, 50px)`;
            layoutGrid.style.gridTemplateRows = `repeat(${room.total_rows}, 50px)`;
            const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (let r = 0; r < room.total_rows; r++) {
                for (let c = 0; c < room.total_columns; c++) {
                    const seat = document.createElement('div');
                    const label = `${rowLabels[r] || r + 1}${c + 1}`;
                    const benchData = availableBenches.find(b => b.row === r + 1 && b.col === c + 1);
                    const isAvailable = benchData ? benchData.available : true;
                    seat.className = isAvailable ? 'seat' : 'seat unavailable';
                    seat.textContent = label;
                    layoutGrid.appendChild(seat);
                }
            }
            container.innerHTML = `
                <div style="text-align:center; margin-bottom:15px;">
                    <h3>${escapeHtml(room.room_name)}</h3>
                    <p><strong>Block:</strong> ${escapeHtml(room.block_name)} | 
                       <strong>Actual Capacity:</strong> ${actualCapacity} students | 
                       <strong>Layout:</strong> ${room.total_rows} rows × ${room.total_columns} columns × ${room.students_per_bench} per bench</p>
                </div>`;
            container.appendChild(layoutGrid);
            document.getElementById('layoutPreviewContainer').style.display = 'block';
            document.getElementById('layoutPreviewContainer').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        showAlert('Error viewing room layout: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// =====================================================
// SEATING ARRANGEMENT MANAGEMENT
// =====================================================

async function loadArrangements() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/arrangements`);
        const result = await response.json();
        if (result.status === 'success') {
            allArrangements = result.data;
            displayArrangements(result.data);
            updateArrangementStats(result.data);
        } else {
            showAlert('Failed to load arrangements', 'danger');
        }
    } catch (error) {
        showAlert('Error loading arrangements: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

function displayArrangements(arrangements) {
    const tbody = document.getElementById('arrangementsTableBody');
    if (arrangements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No seating arrangements found. Create one to get started!</td></tr>';
        return;
    }
    tbody.innerHTML = arrangements.map(arr => {
        const statusClass = {
            'Draft': 'badge-secondary', 'Confirmed': 'badge-warning',
            'Published': 'badge-success', 'Completed': 'badge-info'
        }[arr.status] || 'badge-secondary';
        return `
            <tr>
                <td><strong>${escapeHtml(arr.arrangement_name)}</strong></td>
                <td>${escapeHtml(arr.session_name || '-')}</td>
                <td>${formatDate(arr.exam_date)}</td>
                <td><span class="badge badge-info">${arr.session_type}</span></td>
                <td>${escapeHtml(arr.room_code)} - ${escapeHtml(arr.room_name)}</td>
                <td>${arr.total_students_allocated} / ${arr.total_capacity || 0}</td>
                <td><span class="badge ${statusClass}">${arr.status}</span></td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewArrangement(${arr.arrangement_id})">View</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteArrangement(${arr.arrangement_id})">Delete</button>
                </td>
            </tr>`;
    }).join('');
}

function updateArrangementStats(arrangements) {
    document.getElementById('totalArrangements').textContent = arrangements.length;
    document.getElementById('publishedArrangements').textContent = arrangements.filter(a => a.status === 'Published').length;
    document.getElementById('draftArrangements').textContent = arrangements.filter(a => a.status === 'Draft').length;
    document.getElementById('totalStudents').textContent = arrangements.reduce((sum, a) => sum + (a.total_students_allocated || 0), 0);
}

function showArrangementForm() {
    showAlert('Seating arrangement creation form will be available soon. This feature allows automatic student allocation based on room layouts!', 'info');
}

async function viewArrangement(arrangementId) {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/arrangements/${arrangementId}`);
        const result = await response.json();
        if (result.status === 'success') {
            const arr = result.data;
            showAlert(`
                <strong>${escapeHtml(arr.arrangement_name)}</strong><br>
                Room: ${escapeHtml(arr.room_name)}<br>
                Capacity: ${arr.total_students_allocated} / ${arr.total_capacity}<br>
                Status: ${arr.status}<br>
                Date: ${formatDate(arr.exam_date)} (${arr.session_type})
            `, 'info');
        }
    } catch (error) {
        showAlert('Error viewing arrangement: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteArrangement(arrangementId) {
    if (!confirm('Are you sure you want to delete this seating arrangement?')) return;
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/arrangements/${arrangementId}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.status === 'success') {
            showAlert('Seating arrangement deleted successfully!', 'success');
            await loadArrangements();
        } else {
            showAlert(result.message || 'Failed to delete arrangement', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting arrangement: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    container.innerHTML = '';
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =====================================================
// ROOM BLOCKING FUNCTIONS
// =====================================================

/**
 * Open Block Room Modal
 * Triggered by: ⛔ Block Dates button in rooms table
 */
function openBlockModal(roomId, roomNumber) {
    currentViewRoomId     = roomId;
    currentViewRoomNumber = roomNumber;

    document.getElementById('blockRoomId').value = roomId;
    document.getElementById('blockModalRoomLabel').textContent = 'Room: ' + roomNumber;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('blockFromDate').value = today;
    document.getElementById('blockToDate').value   = today;
    document.getElementById('blockFN').checked     = true;
    document.getElementById('blockAN').checked     = true;
    document.getElementById('blockReason').value   = 'Regular Lecture';
    document.getElementById('blockNote').value     = '';
    document.getElementById('blockBy').value       = '';
    document.getElementById('blockSlotPreview').style.display = 'none';

    document.getElementById('blockRoomModal').style.display = 'block';
    updateBlockPreview();

    // Attach live preview listeners — remove first to avoid duplicates
    ['blockFromDate', 'blockToDate', 'blockFN', 'blockAN'].forEach(id => {
        const el = document.getElementById(id);
        el.removeEventListener('change', updateBlockPreview);
        el.addEventListener('change', updateBlockPreview);
    });
}

/**
 * Live preview of which slots will be blocked
 */
function updateBlockPreview() {
    const fromDate = document.getElementById('blockFromDate').value;
    const toDate   = document.getElementById('blockToDate').value || fromDate;
    const fn       = document.getElementById('blockFN').checked;
    const an       = document.getElementById('blockAN').checked;

    if (!fromDate || (!fn && !an)) {
        document.getElementById('blockSlotPreview').style.display = 'none';
        return;
    }

    const start = new Date(fromDate + 'T00:00:00');
    const end   = new Date(toDate   + 'T00:00:00');
    const slots = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const label = d.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', weekday: 'short'
        });
        if (fn) slots.push(`${label} — <span style="background:#1e3c72;color:white;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">FN</span>`);
        if (an) slots.push(`${label} — <span style="background:#4caf50;color:white;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">AN</span>`);
    }

    document.getElementById('blockPreviewList').innerHTML =
        slots.slice(0, 10).map(s =>
            `<div style="padding:3px 0; border-bottom:1px solid #f0f0f0; font-size:12px;">${s}</div>`
        ).join('') +
        (slots.length > 10 ? `<div style="color:#999; margin-top:4px; font-size:11px;">...and ${slots.length - 10} more slots</div>` : '');

    document.getElementById('blockSlotPreview').style.display = 'block';
}

/**
 * Submit block room — calls /api/seating/block-room
 */
async function submitBlockRoom() {
    const roomId    = document.getElementById('blockRoomId').value;
    const fromDate  = document.getElementById('blockFromDate').value;
    const toDate    = document.getElementById('blockToDate').value || fromDate;
    const fn        = document.getElementById('blockFN').checked;
    const an        = document.getElementById('blockAN').checked;
    const reason    = document.getElementById('blockReason').value;
    const note      = document.getElementById('blockNote').value;
    const blockedBy = document.getElementById('blockBy').value;

    if (!fromDate)     { showAlert('Please select a from date.', 'danger'); return; }
    if (!fn && !an)    { showAlert('Please select at least one session.', 'danger'); return; }

    const sessions = [];
    if (fn) sessions.push(1);
    if (an) sessions.push(2);

    showLoading();
    try {
        const res = await fetch('/api/seating/block-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id:     roomId,
                from_date:   fromDate,
                to_date:     toDate,
                sessions,
                reason,
                reason_note: note      || null,
                blocked_by:  blockedBy || null
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Block failed');

        document.getElementById('blockRoomModal').style.display = 'none';
        showAlert(data.message || 'Room blocked successfully!', 'success');
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Open View Blocked Slots Modal
 * Triggered by: 📅 Blocked button in rooms table
 */
async function viewBlockedSlots(roomId, roomNumber) {
    currentViewRoomId     = roomId;
    currentViewRoomNumber = roomNumber;

    document.getElementById('viewBlockedRoomLabel').textContent = roomNumber;
    document.getElementById('viewBlockedContent').innerHTML =
        '<div style="text-align:center; padding:30px; color:#999;">Loading...</div>';
    document.getElementById('viewBlockedModal').style.display = 'block';

    // Wire up Add More Blocks button
    document.getElementById('addMoreBlockBtn').onclick = function() {
        document.getElementById('viewBlockedModal').style.display = 'none';
        openBlockModal(roomId, roomNumber);
    };

    try {
        const res   = await fetch(`/api/seating/blocked-slots/${roomId}`);
        const data  = await res.json();
        const slots = data.blocked_slots || [];

        if (slots.length === 0) {
            document.getElementById('viewBlockedContent').innerHTML = `
                <div style="text-align:center; padding:40px; color:#999;">
                    <div style="font-size:40px; margin-bottom:10px;">✅</div>
                    No upcoming blocked dates for this room.
                </div>`;
            return;
        }

        document.getElementById('viewBlockedContent').innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f8f9fa;">
                        <th style="padding:10px 8px; text-align:left; border-bottom:2px solid #ddd; font-size:12px; color:#555; text-transform:uppercase;">Date</th>
                        <th style="padding:10px 8px; text-align:left; border-bottom:2px solid #ddd; font-size:12px; color:#555; text-transform:uppercase;">Session</th>
                        <th style="padding:10px 8px; text-align:left; border-bottom:2px solid #ddd; font-size:12px; color:#555; text-transform:uppercase;">Reason</th>
                        <th style="padding:10px 8px; text-align:left; border-bottom:2px solid #ddd; font-size:12px; color:#555; text-transform:uppercase;">Blocked By</th>
                        <th style="padding:10px 8px; text-align:left; border-bottom:2px solid #ddd; font-size:12px; color:#555; text-transform:uppercase;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${slots.map(s => `
                    <tr style="border-bottom:1px solid #f0f0f0;">
                        <td style="padding:9px 8px;">${s.block_date_display || s.block_date}</td>
                        <td style="padding:9px 8px;">
                            <span style="background:${s.session_order === 1 ? '#1e3c72' : '#4caf50'};
                                color:white; padding:2px 10px; border-radius:4px;
                                font-size:11px; font-weight:600;">
                                ${s.session_order === 1 ? 'FN' : 'AN'}
                            </span>
                        </td>
                        <td style="padding:9px 8px;">
                            ${s.reason}
                            ${s.reason_note ? `<br><small style="color:#999;">${s.reason_note}</small>` : ''}
                        </td>
                        <td style="padding:9px 8px; color:#666;">${s.blocked_by || '—'}</td>
                        <td style="padding:9px 8px;">
                            <button class="btn btn-danger btn-sm"
                                onclick="unblockSlot(${s.block_id}, ${roomId}, '${roomNumber}')">
                                Unblock
                            </button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    } catch (err) {
        document.getElementById('viewBlockedContent').innerHTML =
            `<div style="color:#721c24; padding:20px;">Error: ${err.message}</div>`;
    }
}

/**
 * Unblock a single slot — calls /api/seating/unblock-room/:blockId
 */
async function unblockSlot(blockId, roomId, roomNumber) {
    if (!confirm('Unblock this slot? Room will be available for exam scheduling again.')) return;
    showLoading();
    try {
        const res  = await fetch(`/api/seating/unblock-room/${blockId}`, { method: 'PUT' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showAlert('Room unblocked successfully!', 'success');
        viewBlockedSlots(roomId, roomNumber); // Refresh list inside modal
    } catch (err) {
        showAlert('Error: ' + err.message, 'danger');
    } finally {
        hideLoading();
    }
}
