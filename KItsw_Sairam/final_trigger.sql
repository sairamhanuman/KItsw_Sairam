USE engineering_college;

DELIMITER //

CREATE TRIGGER before_internal_exam_notification_insert 
BEFORE INSERT ON internal_exam_notifications
FOR EACH ROW
BEGIN
    DECLARE programme_code VARCHAR(50);
    DECLARE exam_name_clean VARCHAR(100);
    DECLARE month_name VARCHAR(20);
    
    -- Get programme code (don't check is_active for flexibility)
    SELECT programme_code INTO programme_code 
    FROM programme_master 
    WHERE programme_id = NEW.programme_id
    LIMIT 1;
    
    -- If programme not found, set default
    IF programme_code IS NULL THEN
        SET programme_code = 'UNKNOWN';
    END IF;
    
    -- Clean exam name (remove spaces and special characters)
    SET exam_name_clean = REPLACE(REPLACE(REPLACE(REPLACE(NEW.exam_name, ' ', '_'), '-', '_'), '.', '_'), '&', '_');
    
    -- Get month name (don't check is_active for flexibility)
    SELECT month_name INTO month_name 
    FROM month_year_master 
    WHERE month_year_id = NEW.month_year_id
    LIMIT 1;
    
    -- If month not found, set default
    IF month_name IS NULL THEN
        SET month_name = 'UNKNOWN';
    END IF;
    
    -- Generate notification code: NOTIFICATION_PROGRAMME_SEMESTER_EXAMNAME_MONTH
    SET NEW.notification_code = CONCAT(
        'NOTIFICATION_',
        UPPER(REPLACE(programme_code, '.', '_')),
        '_',
        UPPER(REPLACE(exam_name_clean, ' ', '_')),
        '_',
        UPPER(month_name)
    );
    
    -- Set notification title if not provided or empty
    IF NEW.notification_title IS NULL OR NEW.notification_title = '' THEN
        SET NEW.notification_title = CONCAT(
            'Internal Examination Notification - ',
            programme_code,
            ' - ',
            NEW.exam_name,
            ' - ',
            month_name
        );
    END IF;
    
    -- Set notification date to today if not provided
    IF NEW.notification_date IS NULL THEN
        SET NEW.notification_date = CURDATE();
    END IF;
END//

DELIMITER ;
