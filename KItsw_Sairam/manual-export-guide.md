# Manual Railway Database Export Guide

## 1. Export from Railway
```bash
mysqldump -h your_railway_host -P your_railway_port -u your_username -pyour_password your_database > railway_export.sql
```

## 2. Import to Local
```bash
mysql -h localhost -P 3306 -u root -pIamgod@123456 engineering_college < railway_export.sql
```

## 3. Clean up
```bash
del railway_export.sql
```

## Example with real values:
```bash
# Export (replace with your actual Railway credentials)
mysqldump -h containers.railway.app -P 7916 -u root -pYourRailwayPassword railway > railway_export.sql

# Import
mysql -h localhost -P 3306 -u root -pIamgod@123456 engineering_college < railway_export.sql
```
