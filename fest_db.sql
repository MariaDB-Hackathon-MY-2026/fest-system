CREATE VIEW v_event_participation_breakdown AS
SELECT 
    e.id AS event_id,
    e.event_name,
    f.short_name AS student_faculty,
    COUNT(a.id) AS participant_count
FROM events e
JOIN attendance a ON e.id = a.event_id
JOIN users u ON a.user_id = u.id
JOIN faculties f ON u.faculty_id = f.id
GROUP BY e.id, f.id;