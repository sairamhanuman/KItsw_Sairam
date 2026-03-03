# Course/Subject Management System - Visual Guide

## User Interface Components

### 1. Page Header
```
┌─────────────────────────────────────────────────────────────┐
│ 📚 Course/Subject Management                                │
│ Manage curriculum subjects by programme, branch, semester,  │
│ and regulation                                              │
└─────────────────────────────────────────────────────────────┘
```
- Gradient background (purple to violet)
- Clear title and description
- Professional appearance

### 2. Statistics Bar
```
┌─────────────────────────────────────────────────────────────┐
│ Total Subjects: 0    Locked: 0    Running: 0               │
└─────────────────────────────────────────────────────────────┘
```
- Real-time statistics
- Updates automatically when subjects are loaded
- Shows:
  - Total subjects count
  - Number of locked subjects
  - Number of running curriculum subjects

### 3. Filter Section
```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Filter Subjects                                          │
├─────────────────────────────────────────────────────────────┤
│ [Programme ▼]  [Branch ▼]  [Semester ▼]  [Regulation ▼]   │
│                                                              │
│ [Apply Filters] [Clear Filters] [📥 Export] [📄 Sample]   │
│ [📤 Import]                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Dropdown Contents**:
- **Programme**: BTECH - Bachelor of Technology, MTECH, etc.
- **Branch**: CSE - Computer Science, ECE - Electronics, etc.
- **Semester**: Semester 1, Semester 2, etc.
- **Regulation**: R2023, R2022, etc.

**Action Buttons**:
- **Apply Filters**: Load subjects matching selected filters
- **Clear Filters**: Reset all filters and clear table
- **Export to Excel**: Download filtered subjects as Excel
- **Download Sample**: Get Excel template with instructions
- **Import from Excel**: Upload bulk subject data

### 4. Subject Entry Form
```
┌─────────────────────────────────────────────────────────────┐
│ ➕ Add/Edit Subject                                         │
├─────────────────────────────────────────────────────────────┤
│ Subject Order*: [1        ]  Syllabus Code*: [CS101    ]   │
│ Ref Code:       [REF001   ]                                 │
│                                                              │
│ Internal Code:  [INT001   ]  External Code:  [EXT001   ]   │
│ Subject Type*:  [Theory ▼]                                  │
│                                                              │
│ Subject Name*:  [Introduction to Computer Science      ]   │
│                                                              │
│ Internal Marks: [40 ]  External Marks: [60 ]               │
│ TA Marks:       [0  ]  Credits:        [4.0]               │
│                                                              │
│ Replacement Group: [    ]                                   │
│ ☐ Is Elective          ☐ Is Under Group                    │
│ ☐ Exempt Exam Fee      ☑ Running Curriculum                │
│                                                              │
│ [Save Subject] [Clear Form]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Form Fields**:
- **Required** (marked with *): Order, Syllabus Code, Subject Name, Subject Type
- **Optional**: All other fields
- **Subject Type Options**: Theory, Practical, Drawing, Project, Others
- **Checkboxes**: Default states shown
- **Form Actions**: Save (submit) or Clear (reset)

### 5. Subjects Table
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📋 Subjects List                                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Order │ Syllabus │ Subject Name    │ Type      │ Credits │ Marks    │ Status│
├──────────────────────────────────────────────────────────────────────────────┤
│  1    │ CS101    │ Intro to CS     │ Theory    │ 4.0     │ 40/60/0  │ 🔓   │
│       │          │                 │           │         │          │ [Running]│
│       │          │                 │           │         │          │ [Edit]│
│       │          │                 │           │         │          │ [Lock]│
│       │          │                 │           │         │          │ [Stop]│
│       │          │                 │           │         │          │ [Delete]│
├──────────────────────────────────────────────────────────────────────────────┤
│  2    │ CS102    │ Programming Lab │ Practical │ 2.0     │ 30/70/0  │ 🔒   │
│       │          │                 │           │         │          │ [Running]│
│       │          │                 │           │         │          │ [Elective]│
│       │          │                 │           │         │          │ [Edit]│
│       │          │                 │           │         │          │ [Unlock]│
│       │          │                 │           │         │          │ [Stop]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Table Columns**:
- **Order**: Subject ordering number
- **Syllabus Code**: Unique identifier
- **Subject Name**: Full subject name
- **Type**: Theory/Practical/Drawing/Project/Others
- **Credits**: Credit value
- **Marks**: Internal/External/TA marks format
- **Status**: Lock icon, badges, and action buttons

**Status Indicators**:
- 🔓 Unlocked / 🔒 Locked
- Green badge: "Running" (running curriculum)
- Red badge: "Not Running"
- Blue badge: "Elective" (if applicable)

**Action Buttons** (per row):
- **Edit**: Load subject data into form
- **Lock/Unlock**: Toggle lock status
- **Run/Stop**: Toggle running curriculum
- **Delete**: Remove subject (disabled if locked)

### 6. Import Modal
```
┌─────────────────────────────────────────────────────────────┐
│ Import Subjects from Excel                          [×]     │
├─────────────────────────────────────────────────────────────┤
│ Upload an Excel file with subject data. Download the       │
│ sample template to see the required format.                │
│                                                              │
│ [Choose File] no file chosen                                │
│                                                              │
│ [Import] [Cancel]                                           │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- File input for Excel files (.xlsx, .xls)
- Instructions text
- Import and Cancel actions
- Closes after successful import

### 7. Alert Messages
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Subjects loaded successfully                             │
└─────────────────────────────────────────────────────────────┘
```
**Types**:
- **Success** (green): Confirmation messages
- **Error** (red): Error messages
- **Info** (blue): Information messages

**Auto-dismiss**: Disappears after 5 seconds

### 8. Loading Spinner
```
┌─────────────────────────────────────────────────────────────┐
│                          ⟳                                   │
│                  Loading subjects...                        │
└─────────────────────────────────────────────────────────────┘
```
Shows during data fetch operations

## User Workflows

### Workflow 1: View Subjects
1. Select Programme, Branch, Semester, Regulation
2. Click "Apply Filters"
3. View subjects in table
4. Statistics update automatically

### Workflow 2: Add New Subject
1. Apply filters first (required)
2. Fill in form fields
3. Click "Save Subject"
4. Subject added to table
5. Form clears automatically

### Workflow 3: Edit Subject
1. Click "Edit" button on subject row
2. Form populates with subject data
3. Modify fields as needed
4. Click "Save Subject"
5. Changes saved and table refreshes

### Workflow 4: Delete Subject
1. Click "Delete" button (only if unlocked)
2. Confirm deletion in dialog
3. Subject removed from table
4. Statistics update

### Workflow 5: Lock/Unlock Subject
1. Click "Lock" or "Unlock" button
2. Status changes immediately
3. Locked subjects cannot be edited or deleted
4. Lock icon updates in table

### Workflow 6: Toggle Running Curriculum
1. Click "Run" or "Stop" button
2. Running status changes
3. Badge updates in table
4. Statistics update

### Workflow 7: Export to Excel
1. Apply filters (optional)
2. Click "Export to Excel"
3. Excel file downloads automatically
4. Contains all filtered subjects

### Workflow 8: Import from Excel
1. Apply filters first (required)
2. Click "Import from Excel"
3. Modal opens
4. Select Excel file
5. Click "Import"
6. View import results
7. Table refreshes with new data

### Workflow 9: Download Sample Template
1. Click "Download Sample"
2. Excel file downloads
3. Contains:
   - Sample data rows
   - Instructions sheet
   - Field descriptions

## Excel File Formats

### Export Format
```
| Order | Syllabus | Ref    | Int Code | Ext Code | Name           | Type   | ...
|-------|----------|--------|----------|----------|----------------|--------|
| 1     | CS101    | REF001 | INT001   | EXT001   | Intro to CS    | Theory | ...
| 2     | CS102    | REF002 | INT002   | EXT002   | Programming    | Pract. | ...
```

### Import Format (Template)
```
| Programme ID* | Branch ID* | Semester ID* | Regulation ID* | ...
|---------------|------------|--------------|----------------|
| 1             | 1          | 1            | 1              | ...
```
*Required fields marked with asterisk

### Instructions Sheet
```
Subject Import Instructions

Required Fields (marked with *):
- Programme ID, Branch ID, Semester ID, Regulation ID
- Syllabus Code, Subject Name

Subject Type Options:
- Theory, Practical, Drawing, Project, Others

Boolean Fields (use 0 or 1):
- Is Elective, Is Under Group, Exempt Exam Fee
```

## Color Scheme

### Primary Colors:
- **Primary**: #667eea (purple-blue)
- **Secondary**: #764ba2 (violet)
- **Success**: #28a745 (green)
- **Warning**: #ffc107 (yellow)
- **Danger**: #dc3545 (red)
- **Info**: #17a2b8 (cyan)

### UI Elements:
- **Header**: Gradient (purple to violet)
- **Buttons**: Colored by action type
- **Badges**: Status-specific colors
- **Table Header**: Primary purple
- **Hover**: Light gray background

## Responsive Design

### Desktop (>1200px):
- Full layout with all columns visible
- Form fields in 3-4 column grid
- Wide table showing all data

### Tablet (768px-1200px):
- Adjusted column widths
- Form fields in 2-3 column grid
- Table scrollable horizontally

### Mobile (<768px):
- Single column layout
- Form fields stack vertically
- Table scrollable horizontally
- Buttons stack vertically

## Accessibility Features

1. **Semantic HTML**: Proper use of form elements, tables, headings
2. **Labels**: All inputs have associated labels
3. **ARIA attributes**: Where needed for screen readers
4. **Keyboard navigation**: All interactive elements accessible via keyboard
5. **Color contrast**: WCAG AA compliant
6. **Focus indicators**: Visible focus states on interactive elements

## Browser Compatibility

**Supported Browsers**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features Used**:
- CSS Grid and Flexbox
- Modern JavaScript (ES6+)
- Fetch API
- Promise-based operations
- File API for Excel import

## Performance Considerations

1. **Lazy Loading**: Subjects loaded only after filters applied
2. **Efficient Rendering**: Table re-renders only when data changes
3. **Debouncing**: Alert messages auto-dismiss
4. **Optimized Queries**: Database queries use indexes
5. **Client-side Processing**: Excel parsing done in browser
6. **CDN Resources**: XLSX library loaded from CDN with integrity check

## Future Enhancements (UI)

1. **Search within results**: Quick filter in table
2. **Sorting**: Click column headers to sort
3. **Pagination**: For large datasets
4. **Bulk operations**: Select multiple subjects for actions
5. **Drag-and-drop**: Reorder subjects
6. **Advanced filters**: Additional filter criteria
7. **Print view**: Formatted for printing
8. **Dark mode**: Theme toggle
