# Setup Exam Timetable System
# Run this PowerShell script to initialize the database

Write-Host "Setting up Exam Timetable System..." -ForegroundColor Green

# Check if MySQL is available
try {
    $mysqlVersion = mysql --version
    Write-Host "MySQL found: $mysqlVersion" -ForegroundColor Green
} catch {
    Write-Host "MySQL not found. Please install MySQL and ensure it's in your PATH." -ForegroundColor Red
    exit 1
}

# Database connection details
$dbHost = "localhost"
$dbUser = "root"
$dbName = "engineering_college"

Write-Host "Please enter your MySQL password for user '$dbUser':" -ForegroundColor Yellow
$securePassword = Read-Host -AsSecureString
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

# Create database if it doesn't exist
Write-Host "Creating database if not exists..." -ForegroundColor Blue
$createDbCmd = "CREATE DATABASE IF NOT EXISTS $dbName;"
mysql -h $dbHost -u $dbUser -p$password -e $createDbCmd

# Initialize tables
Write-Host "Initializing exam timetable tables..." -ForegroundColor Blue
Get-Content "db\create_exam_timetable_tables.sql" | mysql -h $dbHost -u $dbUser -p$password $dbName

# Run initialization script
Write-Host "Running initialization script..." -ForegroundColor Blue
Get-Content "init-exam-timetable.sql" | mysql -h $dbHost -u $dbUser -p$password $dbName

Write-Host "✅ Exam Timetable System setup completed!" -ForegroundColor Green
Write-Host "You can now start the application with: npm start" -ForegroundColor Cyan
