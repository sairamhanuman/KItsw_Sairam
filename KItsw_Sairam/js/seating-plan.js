/**
 * Seating Plan Master - Frontend JavaScript
 * Handles blocks, rooms, and seating arrangements
 */

const API_BASE = '/api/seating-plans';
let currentEditId = null;
let currentEditType = null;
let allBlocks = [];
let allRooms = [];
let allArrangements = [];
let benchSelections = []; // Store bench selection state

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadAllData();
    setupFormHandlers();
});

/**
 * Initialize tab switching functionality
 */
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load data for active tab
    if (tabName === 'blocks') loadBlocks();
    if (tabName === 'rooms') loadRooms();
    if (tabName === 'arrangements') loadArrangements();
}

/**
 * Load all initial data
 */
async function loadAllData() {
    await loadBlocks();
    await loadRooms();
    await loadArrangements();
}

/**
 * Setup form submit handlers
 */
function setupFormHandlers() {
    // Block form
    document.getElementById('blockForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBlock();
    });

    // Room form
    document.getElementById('roomForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRoom();
    });
}

// =====================================================
// BLOCK MANAGEMENT
// =====================================================

/**
 * Load all blocks
 */
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
        console.error('Error loading blocks:', error);
        showAlert('Error loading blocks: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Display blocks in table
 */
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

/**
 * Show block form
 */
function showBlockForm() {
    currentEditId = null;
    currentEditType = 'block';
    document.getElementById('blockForm').reset();
    document.getElementById('blockId').value = '';
    document.getElementById('blockFormContainer').style.display = 'block';
    document.getElementById('blockFormContainer').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Cancel block form
 */
function cancelBlockForm() {
    document.getElementById('blockFormContainer').style.display = 'none';
    document.getElementById('blockForm').reset();
    currentEditId = null;
}

/**
 * Edit block
 */
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

/**
 * Save block (create or update)
 */
async function saveBlock() {
    try {
        showLoading();
        const formData = new FormData(document.getElementById('blockForm'));
        const data = Object.fromEntries(formData.entries());

        const url = currentEditId ? `${API_BASE}/blocks/${currentEditId}` : `${API_BASE}/blocks`;
        const method = currentEditId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
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
        console.error('Error saving block:', error);
        showAlert('Error saving block: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Delete block
 */
async function deleteBlock(blockId) {
    if (!confirm('Are you sure you want to delete this block? This will also delete all associated rooms.')) {
        return;
    }

    try {
        showLoading();
        const response = await fetch(`${API_BASE}/blocks/${blockId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.status === 'success') {
            showAlert('Block deleted successfully!', 'success');
            await loadBlocks();
            await loadRooms(); // Refresh rooms as they depend on blocks
        } else {
            showAlert(result.message || 'Failed to delete block', 'danger');
        }
    } catch (error) {
        console.error('Error deleting block:', error);
        showAlert('Error deleting block: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Populate block dropdown for room form
 */
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

/**
 * Load all rooms
 */
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
        console.error('Error loading rooms:', error);
        showAlert('Error loading rooms: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Display rooms in table
 */
function displayRooms(rooms) {
    const tbody = document.getElementById('roomsTableBody');
    
    if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No rooms found. Add one to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = rooms.map(room => {
        // Calculate actual capacity based on layout_data if available
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
                    <small style="color: #666;">(${benchCount} benches)</small></td>
                <td><strong>${actualCapacity}</strong></td>
                <td>
                    <span class="badge ${room.is_active ? 'badge-success' : 'badge-danger'}">
                        ${room.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editRoom(${room.room_id})">Edit</button>
                    <button class="btn btn-primary btn-sm" onclick="viewRoomLayout(${room.room_id})">View</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRoom(${room.room_id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Show room form
 */
function showRoomForm() {
    currentEditId = null;
    currentEditType = 'room';
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    benchSelections = [];  // Reset bench selections
    document.getElementById('roomFormContainer').style.display = 'block';
    document.getElementById('layoutPreviewContainer').style.display = 'none';
    generateBenchSelector();  // Initialize bench selector
    document.getElementById('roomFormContainer').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Cancel room form
 */
function cancelRoomForm() {
    document.getElementById('roomFormContainer').style.display = 'none';
    document.getElementById('layoutPreviewContainer').style.display = 'none';
    document.getElementById('roomForm').reset();
    currentEditId = null;
}

/**
 * Edit room
 */
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
    
    // Load existing bench selections from layout_data
    benchSelections = [];
    if (room.layout_data) {
        try {
            const layoutData = typeof room.layout_data === 'string' 
                ? JSON.parse(room.layout_data) 
                : room.layout_data;
            
            if (layoutData && layoutData.benches) {
                benchSelections = layoutData.benches;
            }
        } catch (e) {
            console.error('Error parsing layout_data:', e);
        }
    }
    
    // If no layout data, generate default (all selected)
    if (benchSelections.length === 0) {
        generateBenchSelector();
    } else {
        // Render existing bench selections
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
            
            // Normalize to 'selected' property
            bench.selected = bench.available !== undefined ? bench.available : bench.selected;
        });
        
        updateBenchStats();
    }
    
    document.getElementById('roomFormContainer').style.display = 'block';
    document.getElementById('roomFormContainer').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Save room (create or update)
 */
async function saveRoom() {
    try {
        showLoading();
        const formData = new FormData(document.getElementById('roomForm'));
        const data = Object.fromEntries(formData.entries());
        
        // Convert checkboxes
        data.has_projector = document.getElementById('hasProjector').checked;
        data.has_ac = document.getElementById('hasAC').checked;
        data.is_active = true;
        
        // Add bench selection data to layout_data
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
            method: method,
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
        console.error('Error saving room:', error);
        showAlert('Error saving room: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Delete room
 */
async function deleteRoom(roomId) {
    if (!confirm('Are you sure you want to delete this room?')) {
        return;
    }

    try {
        showLoading();
        const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.status === 'success') {
            showAlert('Room deleted successfully!', 'success');
            await loadRooms();
        } else {
            showAlert(result.message || 'Failed to delete room', 'danger');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
        showAlert('Error deleting room: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Update capacity preview
 */
function updateCapacityPreview() {
    const rows = parseInt(document.getElementById('totalRows').value) || 0;
    const cols = parseInt(document.getElementById('totalColumns').value) || 0;
    const perBench = parseInt(document.getElementById('studentsPerBench').value) || 0;
    
    // Check if dimensions changed - regenerate grid
    const currentRows = benchSelections.length > 0 ? Math.max(...benchSelections.map(b => b.row)) : 0;
    const currentCols = benchSelections.length > 0 ? Math.max(...benchSelections.map(b => b.col)) : 0;
    
    if (rows !== currentRows || cols !== currentCols) {
        generateBenchSelector();
    } else {
        updateBenchStats();
    }
}

/**
 * Generate bench selector grid when rows/columns change
 */
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
    
    // Initialize benchSelections array if empty or dimensions changed
    benchSelections = [];
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            benchSelections.push({
                row: r + 1,
                col: c + 1,
                label: `${rowLabels[r] || r + 1}${c + 1}`,
                selected: true  // Default: all selected
            });
        }
    }
    
    // Render bench cells
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

/**
 * Toggle bench selection
 */
function toggleBench(index) {
    benchSelections[index].selected = !benchSelections[index].selected;
    
    // Update visual
    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.classList.toggle('selected');
        cell.title = `Click to ${benchSelections[index].selected ? 'deselect' : 'select'} bench ${benchSelections[index].label}`;
    }
    
    updateBenchStats();
}

/**
 * Update bench statistics
 */
function updateBenchStats() {
    const perBench = parseInt(document.getElementById('studentsPerBench').value) || 1;
    const selectedCount = benchSelections.filter(b => b.selected).length;
    const capacity = selectedCount * perBench;
    
    document.getElementById('selectedBenchCount').textContent = selectedCount;
    document.getElementById('calculatedCapacity').textContent = capacity;
    document.getElementById('capacityPreview').value = capacity;
}

/**
 * Select all benches
 */
function selectAllBenches() {
    benchSelections.forEach(bench => bench.selected = true);
    document.querySelectorAll('.bench-cell').forEach(cell => {
        cell.classList.add('selected');
        const index = parseInt(cell.dataset.index);
        cell.title = `Click to deselect bench ${benchSelections[index].label}`;
    });
    updateBenchStats();
}

/**
 * Clear all benches
 */
function clearAllBenches() {
    benchSelections.forEach(bench => bench.selected = false);
    document.querySelectorAll('.bench-cell').forEach(cell => {
        cell.classList.remove('selected');
        const index = parseInt(cell.dataset.index);
        cell.title = `Click to select bench ${benchSelections[index].label}`;
    });
    updateBenchStats();
}

/**
 * Preview layout
 */
function previewLayout() {
    const rows = parseInt(document.getElementById('totalRows').value);
    const cols = parseInt(document.getElementById('totalColumns').value);
    
    if (!rows || !cols) {
        showAlert('Please enter rows and columns', 'danger');
        return;
    }

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

/**
 * View room layout
 */
async function viewRoomLayout(roomId) {
    try {
        showLoading();
        const response = await fetch(`${API_BASE}/rooms/${roomId}`);
        const result = await response.json();

        if (result.status === 'success') {
            const room = result.data;
            
            // Parse layout data to check available benches
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
                } catch (e) {
                    console.error('Error parsing layout_data:', e);
                }
            }
            
            // Display in modal or expand in place
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
                    
                    // Check if this bench is available
                    const benchData = availableBenches.find(b => b.row === r + 1 && b.col === c + 1);
                    const isAvailable = benchData ? benchData.available : true;
                    
                    seat.className = isAvailable ? 'seat' : 'seat unavailable';
                    seat.textContent = label;
                    layoutGrid.appendChild(seat);
                }
            }

            container.innerHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <h3>${escapeHtml(room.room_name)}</h3>
                    <p><strong>Block:</strong> ${escapeHtml(room.block_name)} | 
                       <strong>Actual Capacity:</strong> ${actualCapacity} students | 
                       <strong>Layout:</strong> ${room.total_rows} rows × ${room.total_columns} columns × ${room.students_per_bench} per bench</p>
                </div>
            `;
            container.appendChild(layoutGrid);
            
            document.getElementById('layoutPreviewContainer').style.display = 'block';
            document.getElementById('layoutPreviewContainer').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error viewing room layout:', error);
        showAlert('Error viewing room layout: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// =====================================================
// SEATING ARRANGEMENT MANAGEMENT
// =====================================================

/**
 * Load all seating arrangements
 */
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
        console.error('Error loading arrangements:', error);
        showAlert('Error loading arrangements: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Display arrangements in table
 */
function displayArrangements(arrangements) {
    const tbody = document.getElementById('arrangementsTableBody');
    
    if (arrangements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No seating arrangements found. Create one to get started!</td></tr>';
        return;
    }

    tbody.innerHTML = arrangements.map(arr => {
        const statusClass = {
            'Draft': 'badge-secondary',
            'Confirmed': 'badge-warning',
            'Published': 'badge-success',
            'Completed': 'badge-info'
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
            </tr>
        `;
    }).join('');
}

/**
 * Update arrangement statistics
 */
function updateArrangementStats(arrangements) {
    document.getElementById('totalArrangements').textContent = arrangements.length;
    document.getElementById('publishedArrangements').textContent = 
        arrangements.filter(a => a.status === 'Published').length;
    document.getElementById('draftArrangements').textContent = 
        arrangements.filter(a => a.status === 'Draft').length;
    document.getElementById('totalStudents').textContent = 
        arrangements.reduce((sum, a) => sum + (a.total_students_allocated || 0), 0);
}

/**
 * Show arrangement form
 */
function showArrangementForm() {
    showAlert('Seating arrangement creation form will be available soon. This feature allows automatic student allocation based on room layouts!', 'info');
}

/**
 * View arrangement details
 */
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
        console.error('Error viewing arrangement:', error);
        showAlert('Error viewing arrangement: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

/**
 * Delete arrangement
 */
async function deleteArrangement(arrangementId) {
    if (!confirm('Are you sure you want to delete this seating arrangement?')) {
        return;
    }

    try {
        showLoading();
        const response = await fetch(`${API_BASE}/arrangements/${arrangementId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.status === 'success') {
            showAlert('Seating arrangement deleted successfully!', 'success');
            await loadArrangements();
        } else {
            showAlert(result.message || 'Failed to delete arrangement', 'danger');
        }
    } catch (error) {
        console.error('Error deleting arrangement:', error);
        showAlert('Error deleting arrangement: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    
    container.innerHTML = '';
    container.appendChild(alert);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

/**
 * Show loading overlay
 */
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
}
