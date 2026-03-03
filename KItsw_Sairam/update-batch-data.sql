-- Add missing batch data for 2025-26 and 2026-27
USE engineering_college;

INSERT IGNORE INTO batch_master (batch_year, batch_name, start_date, end_date, description) VALUES
(2025, '2025-26', '2025-08-01', '2029-05-31', 'Batch admitted in 2025'),
(2026, '2026-27', '2026-08-01', '2030-05-31', 'Batch admitted in 2026');

-- Update existing batch names to match expected format
UPDATE batch_master SET batch_name = '2021-25' WHERE batch_year = 2021;
UPDATE batch_master SET batch_name = '2022-26' WHERE batch_year = 2022;
UPDATE batch_master SET batch_name = '2023-27' WHERE batch_year = 2023;
UPDATE batch_master SET batch_name = '2024-28' WHERE batch_year = 2024;
