@echo off
echo 🚀 Railway to Local Database Sync
echo ==================================

REM Update these variables with your Railway credentials
set RAILWAY_HOST=containers.railway.app
set RAILWAY_PORT=7916
set RAILWAY_USER=root
set RAILWAY_PASSWORD=your_railway_password
set RAILWAY_DATABASE=railway

set LOCAL_HOST=localhost
set LOCAL_PORT=3306
set LOCAL_USER=root
set LOCAL_PASSWORD=Iamgod@123456
set LOCAL_DATABASE=engineering_college

echo 📡 Exporting from Railway...
mysqldump -h %RAILWAY_HOST% -P %RAILWAY_PORT% -u %RAILWAY_USER% -p%RAILWAY_PASSWORD% %RAILWAY_DATABASE% > railway_dump.sql

if %ERRORLEVEL% EQU 0 (
    echo ✅ Export successful
    echo 🏠 Importing to local database...
    mysql -h %LOCAL_HOST% -P %LOCAL_PORT% -u %LOCAL_USER% -p%LOCAL_PASSWORD% %LOCAL_DATABASE% < railway_dump.sql
    
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Import successful
        echo 🧹 Cleaning up...
        del railway_dump.sql
        echo 🎉 Database sync completed!
    ) else (
        echo ❌ Import failed
    )
) else (
    echo ❌ Export failed
)

pause
