-- Insert sample tournaments for testing
INSERT INTO public.tournaments (name, course, format, start_date, end_date, max_players, registration_open, entry_fee, description) VALUES
('Spring Championship', 'Pine Valley Golf Club', 'matchplay', '2025-08-15', '2025-08-17', 32, true, 150, 'Annual spring championship tournament featuring match play format'),
('Summer Classic', 'Oakwood Country Club', 'strokeplay', '2025-09-10', '2025-09-12', 48, true, 200, 'Classic stroke play tournament with beautiful course views'),
('Fall Scramble', 'Riverside Golf Course', 'scramble', '2025-10-05', '2025-10-06', 64, true, 75, 'Fun scramble format perfect for players of all skill levels');