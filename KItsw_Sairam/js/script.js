// API base URL
const API_BASE_URL = window.location.origin;

// Backend connection status
let backendConnected = false;

// Content templates for each menu item
const contentTemplates = {
    'programme': {
        title: 'Programme Management',
        content: 'Manage engineering programmes such as B.Tech, M.Tech, Ph.D., etc. Add, edit, or remove programme details.',
        apiEndpoint: '/api/programmes'
    },
    'branch': {
        title: 'Branch Management',
        content: 'Manage different branches like Computer Science, Electrical, Mechanical, Civil, etc. Configure branch-specific settings.',
        apiEndpoint: '/api/branches'
    },
    'batch': {
        title: 'Batch Management',
        content: 'Create and manage student batches by year of admission. Track batch progress and configure batch-specific rules.',
        apiEndpoint: '/api/batches'
    },
    'semesters': {
        title: 'Semester Configuration',
        content: 'Configure semester details including duration, start dates, end dates, and examination schedules for each semester.',
        apiEndpoint: '/api/semesters'
    },
    'regulation': {
        title: 'Regulation Management',
        content: 'Manage academic regulations including syllabus versions, credit requirements, and grading policies for different batches.',
        apiEndpoint: '/api/regulations'
    },
    'section': {
        title: 'Section Management',
        content: 'Create and manage sections within each batch. Assign students to sections and configure section capacities.',
        apiEndpoint: '/api/sections'
    },
    'exam-sessions': {
        title: 'Exam Sessions',
        content: 'Configure examination sessions including regular exams, supplementary exams, and their respective schedules.',
        apiEndpoint: '/api/exam-sessions'
    },
    'student-management': {
        title: 'Student Management',
        content: 'Add, edit, and manage student records. Import student data, assign to programmes, branches, batches, and sections.',
        apiEndpoint: '/api/students'
    },
    'staff-master': {
        title: 'Staff Master',
        content: 'Manage faculty and staff information including personal details, qualifications, department assignments, and roles.',
        apiEndpoint: '/api/staff'
    },
    'course-import': {
        title: 'Course Import/Entry Verification',
        content: 'Import course data from external sources or enter manually. Verify and validate course information before finalizing.',
        apiEndpoint: '/api/courses'
    },
    'course-mapping': {
        title: 'Course Mapping vs Faculty',
        content: 'Map courses to faculty members. Assign instructors to courses for each semester and track teaching assignments.',
        apiEndpoint: '/api/course-mappings'
    },
    'exam-setup': {
        title: 'Exam Setup',
        content: 'Configure examination parameters including exam types, duration, marks distribution, and evaluation criteria.',
        apiEndpoint: '/api/exam-setup'
    }
};

// Check backend connectivity
async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        backendConnected = data.status === 'ok';
        updateConnectionStatus(true, data);
        return true;
    } catch (error) {
        backendConnected = false;
        updateConnectionStatus(false, error);
        console.error('Backend connection failed:', error);
        return false;
    }
}

// Update connection status indicator
function updateConnectionStatus(connected, info) {
    // Add status indicator to header if not exists
    let statusIndicator = document.querySelector('.connection-status');
    if (!statusIndicator) {
        const header = document.querySelector('.header');
        statusIndicator = document.createElement('div');
        statusIndicator.className = 'connection-status';
        header.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.innerHTML = `
            <span class="status-dot connected"></span>
            <span class="status-text">Backend Connected</span>
        `;
        statusIndicator.className = 'connection-status connected';
    } else {
        statusIndicator.innerHTML = `
            <span class="status-dot disconnected"></span>
            <span class="status-text">Backend Disconnected</span>
        `;
        statusIndicator.className = 'connection-status disconnected';
    }
}

// Fetch data from API
async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        return { success: false, error: error.message };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Check backend connection first
    await checkBackendConnection();
    
    initializeNavigation();
    initializeContentSwitching();
});

// Initialize navigation expand/collapse functionality
function initializeNavigation() {
    // Handle main section headers (PRE-EXAMINATIONS, POST-EXAMINATIONS)
    const menuHeaders = document.querySelectorAll('.menu-header');
    menuHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            const submenu = document.getElementById(sectionId);
            
            // Toggle active class on header
            this.classList.toggle('active');
            
            // Toggle active class on submenu
            submenu.classList.toggle('active');
        });
    });

    // Handle submenu headers (Masters, Course Master)
    const submenuHeaders = document.querySelectorAll('.submenu-header');
    submenuHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const submenuId = this.getAttribute('data-submenu');
            const submenuItems = document.getElementById(submenuId);
            
            // Toggle active class on header
            this.classList.toggle('active');
            
            // Toggle active class on submenu items
            submenuItems.classList.toggle('active');
        });
    });
}

// Initialize content switching functionality
function initializeContentSwitching() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', async function(e) {
            const href = this.getAttribute('href');
            
            // If it's a real link (not # or empty), let it work naturally
            if (href && href !== '#' && href.trim() !== '') {
                // Don't prevent default - allow natural navigation
                return;
            }
            
            // Only prevent default and show content for items without real hrefs
            e.preventDefault();
            
            // Remove active class from all menu items
            menuItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get content key and display content
            const contentKey = this.getAttribute('data-content');
            await displayContent(contentKey);
        });
    });
}

// Display content based on menu selection
async function displayContent(contentKey) {
    const contentDisplay = document.getElementById('content-display');
    const template = contentTemplates[contentKey];
    
    if (!template) {
        contentDisplay.innerHTML = `
            <div class="content-page">
                <h2>Content Not Available</h2>
                <p>The selected feature is under development.</p>
            </div>
        `;
        return;
    }
    
    // Show loading state
    contentDisplay.innerHTML = `
        <div class="content-page">
            <h2>${template.title}</h2>
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading data from backend...</p>
            </div>
        </div>
    `;
    
    // Fetch data from API if endpoint exists
    let apiData = null;
    if (template.apiEndpoint && backendConnected) {
        const result = await fetchFromAPI(template.apiEndpoint);
        if (result.success) {
            apiData = result.data;
        }
    }
    
    // Display content with API response
    contentDisplay.innerHTML = `
        <div class="content-page">
            <h2>${template.title}</h2>
            <p>${template.content}</p>
            
            ${backendConnected ? `
                <div class="api-response-box">
                    <h3>Backend API Response:</h3>
                    <div class="api-data">
                        <pre>${JSON.stringify(apiData, null, 2)}</pre>
                    </div>
                    <p class="api-endpoint"><strong>Endpoint:</strong> ${template.apiEndpoint}</p>
                </div>
            ` : `
                <div class="warning-box">
                    <p>⚠️ Backend is not connected. Please ensure the server is running.</p>
                </div>
            `}
            
            <div class="info-box" style="margin-top: 30px;">
                <h3>Features Coming Soon:</h3>
                <ul>
                    <li>Data entry forms</li>
                    <li>List and table views</li>
                    <li>Search and filter options</li>
                    <li>Import/Export functionality</li>
                    <li>Reports and analytics</li>
                </ul>
            </div>
        </div>
    `;
}

// Optional: Auto-expand first section on load
window.addEventListener('load', function() {
    const firstMenuHeader = document.querySelector('.menu-header');
    if (firstMenuHeader) {
        firstMenuHeader.click();
    }
    
    // Also auto-expand the Masters submenu to show Student Management items
    const mastersSubmenu = document.querySelector('[data-submenu="masters"]');
    if (mastersSubmenu) {
        setTimeout(() => {
            mastersSubmenu.click();
        }, 100); // Small delay to ensure the main section is expanded first
    }
});
