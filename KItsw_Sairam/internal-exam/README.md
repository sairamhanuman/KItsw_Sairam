# Internal Exam Notification System

A comprehensive internal exam notification and timetable management system built with Node.js, Express, and MySQL.

## Features

### 📝 Notification Management
- Create internal exam notifications with detailed information
- Multi-select academic criteria (Programmes, Batches, Semesters, Regulations)
- Exam details configuration (Type, Name, Session, Month/Year, Date Range)
- Draft status management with admin creation tracking

### 📋 View Notifications
- Card-based notification display with comprehensive details
- Search and filter functionality
- Status indicators (Draft, Published, Cancelled)
- Direct timetable generation from notifications

### 📅 Timetable Generation
- Automatic timetable generation based on notification criteria
- Branch-wise subject allocation
- Elective group handling with visual indicators
- Unassigned subjects management

### 🔄 Drag & Drop Functionality
- Swap subjects within timetable grid
- Drag unassigned subjects to empty slots
- Visual feedback during drag operations
- Real-time timetable updates

### 💾 Save & Management
- Save complete timetable to database
- Transaction-based data integrity
- Automatic notification status updates
- Reset functionality with confirmation

## Database Structure

### Core Tables
- `exam_notifications` - Main notification data
- `exam_timetable` - Generated timetable entries
- `subject_master` - Subject information with elective details
- Master tables for programmes, batches, semesters, regulations

### Key Features
- JSON storage for multi-select fields
- Foreign key relationships for data integrity
- Status tracking and audit trails
- Elective group support in subjects

## API Endpoints

### Masters Data
- `GET /api/masters/programmes` - Get all programmes
- `GET /api/masters/batches` - Get all batches
- `GET /api/masters/semesters` - Get all semesters
- `GET /api/masters/regulations` - Get all regulations
- `GET /api/masters/exam-types` - Get exam types
- `GET /api/masters/sessions` - Get exam sessions
- `GET /api/masters/month-year` - Get month/year options

### Notifications
- `POST /api/exam-notifications/create` - Create new notification
- `GET /api/exam-notifications` - Get all notifications
- `GET /api/exam-notifications/:id` - Get specific notification
- `PUT /api/exam-notifications/:id` - Update notification
- `DELETE /api/exam-notifications/:id` - Delete notification

### Timetable
- `POST /api/exam-timetable/generate` - Generate initial timetable
- `POST /api/exam-timetable/save` - Save complete timetable
- `GET /api/exam-timetable/:notification_id` - Get saved timetable
- `PUT /api/exam-timetable/entry/:id` - Update timetable entry

## Frontend Pages

### Create Notification (`create-notification.html`)
- Comprehensive form with all required fields
- Select2 for enhanced multi-select functionality
- Master data integration with fallback options
- Form validation and success messaging

### View Notifications (`view-notifications.html`)
- Card-based layout with notification details
- Search and filter capabilities
- Status badges and action buttons
- Responsive design with Bootstrap

### Timetable Generator (`timetable.html`)
- Dynamic timetable grid generation
- Drag-and-drop subject management
- Unassigned subjects section
- Save and reset functionality

## Technical Implementation

### Frontend Technologies
- Bootstrap 5 for responsive design
- jQuery for DOM manipulation and AJAX
- Select2 for enhanced dropdowns
- HTML5 Drag and Drop API
- CSS Grid and Flexbox for layouts

### Backend Technologies
- Node.js with Express.js
- MySQL database with promise-based queries
- Multer for file uploads
- CORS for cross-origin requests
- Transaction management for data integrity

### Key Features
- Professional UI with gradient headers
- Loading states and error handling
- Responsive design for all screen sizes
- Accessibility considerations
- Performance optimization

## Installation & Setup

1. Install dependencies:
```bash
npm install
```

2. Configure database connection in `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=engineering_college
```

3. Initialize database tables:
```bash
mysql -u root -p engineering_college < create-master-tables.sql
mysql -u root -p engineering_college < create-exam-notification-tables.sql
```

4. Start the server:
```bash
node server.js
```

5. Access the application:
```
http://localhost:3000/internal-exam/
```

## Usage

1. **Create Notification**: Fill in notification details with academic and exam information
2. **View Notifications**: Browse and manage existing notifications
3. **Generate Timetable**: Click "Generate Initial Timetable" to create automatic timetable
4. **Manage Timetable**: Use drag-and-drop to rearrange subjects
5. **Save Timetable**: Save the final timetable for the notification

## Security Features

- Input validation and sanitization
- SQL injection prevention with parameterized queries
- CORS configuration for API security
- File upload restrictions
- Error handling without exposing sensitive information

## Future Enhancements

- Hall ticket generation
- Room allocation system
- Invigilator assignment
- Student enrollment integration
- Email notifications
- Report generation
- Mobile app support

## Support

For technical support or issues, please check the browser console for error messages and verify the database connection and table structure.
