-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(255) NOT NULL,
    holiday_type ENUM('national', 'religious', 'college', 'optional') NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate holidays for same date and academic year
    UNIQUE KEY unique_holiday_date (holiday_date, academic_year)
);

-- Add index for better performance
CREATE INDEX idx_holidays_date ON holidays(holiday_date);
CREATE INDEX idx_holidays_academic_year ON holidays(academic_year);
CREATE INDEX idx_holidays_type ON holidays(holiday_type);

-- Insert sample holidays for 2025-2026 academic year
INSERT INTO holidays (holiday_date, holiday_name, holiday_type, academic_year, description, is_recurring) VALUES
('2025-01-26', 'Republic Day', 'national', '2025-2026', 'Republic Day of India', TRUE),
('2025-01-14', 'Pongal', 'religious', '2025-2026', 'Tamil Harvest Festival', TRUE),
('2025-08-15', 'Independence Day', 'national', '2025-2026', 'Indian Independence Day', TRUE),
('2025-10-02', 'Gandhi Jayanti', 'national', '2025-2026', 'Mahatma Gandhi Birthday', TRUE),
('2025-10-24', 'Diwali', 'religious', '2025-2026', 'Festival of Lights', TRUE),
('2025-12-25', 'Christmas', 'religious', '2025-2026', 'Christmas Day', TRUE),
('2026-01-01', 'New Year', 'national', '2025-2026', 'New Year Day', TRUE),
('2026-01-14', 'Pongal', 'religious', '2025-2026', 'Tamil Harvest Festival', TRUE),
('2026-01-26', 'Republic Day', 'national', '2025-2026', 'Republic Day of India', TRUE),
('2026-03-15', 'College Day', 'college', '2025-2026', 'Annual College Day Celebration', FALSE),
('2026-05-01', 'Labor Day', 'national', '2025-2026', 'International Workers Day', TRUE);

-- Display success message
SELECT 'Holidays table created and sample data inserted successfully!' as message;
