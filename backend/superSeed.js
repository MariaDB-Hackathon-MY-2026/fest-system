const db = require('./db');
const bcrypt = require('bcrypt');

async function runSuperSeed() {
    const saltRounds = 10;
    const defaultPass = await bcrypt.hash('password123', saltRounds);

    try {
        console.log("🧹 Clearing existing data for a fresh start...");
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE attendance');
        await db.query('TRUNCATE TABLE events');
        await db.query('TRUNCATE TABLE users');
        await db.query('TRUNCATE TABLE faculties');
        // We do not truncate v_kpi_leaderboard because it is a VIEW
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        // 1. Seed Faculties (Matches your exact HeidiSQL column: 'name')
        console.log("🏛️ Seeding Faculties...");
        const faculties = [
            ["Faculty of Business and Accountancy", "FABA", 150, "#1e3a8a"],
            ["Faculty of Computing & Multimedia", "FCOM", 120, "#06b6d4"],
            ["Faculty of Education, Social Sciences and Humanities", "FESSH", 100, "#8b5cf6"],
            ["Institute of Professional Studies", "IPS", 80, "#10b981"],
            ["Institute of Graduate Studies", "IGS", 60, "#64748b"],
            ["Centre of Islamic, General, and Language Studies", "CIGLS", 90, "#15803d"]
        ];
        // Column names fixed to match HeidiSQL: name, short_name, total_population, brand_color
        await db.query('INSERT INTO faculties (name, short_name, total_population, brand_color) VALUES ?', [faculties]);

        // 2. Seed Users
        console.log("👥 Seeding Users...");
        const users = [
            ["Super Admin", "ADMIN99", defaultPass, "admin", null],
            ["Dr. Alan Turing", "LECT001", defaultPass, "organizer", 2], // Lecturer for FCOM
            ["Dr. Ada Lovelace", "LECT002", defaultPass, "organizer", 1]  // Lecturer for FABA
        ];

        for (let i = 1; i <= 250; i++) {
            const facultyId = (i % 6) + 1; 
            const studentId = `AM26${String(i).padStart(4, '0')}`;
            users.push([`Student ${i}`, studentId, defaultPass, 'student', facultyId]);
        }
        // Fix: Use 'student_id' for the login string, NOT the auto-increment 'id'
        await db.query('INSERT INTO users (name, student_id, password, role, faculty_id) VALUES ?', [users]);

        // 3. Seed Events
        console.log("📅 Seeding Active Events...");
        const startTime = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' '); 
        const endTime = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');

        const eventsData = [
            ['MariaDB Hackathon Workshop', 'leaderboard test', 15, 'WORK11', startTime, endTime, 'LECT001', 2],
            ['AI Ethics Seminar', 'Ethics in AI', 10, 'TALK22', startTime, endTime, 'LECT001', 2],
            ['Campus eSports Tournament', 'Gaming', 20, 'COMP33', startTime, endTime, 'ADMIN99', 1]
        ];
        
        // Match columns: event_name, description, kpi_points, random_code, start_time, end_time, created_by, organized_by_faculty
        await db.query(`
            INSERT INTO events (event_name, description, kpi_points, random_code, start_time, end_time, created_by, organized_by_faculty) 
            VALUES ?
        `, [eventsData]);

        // 4. Attendance Logic
        console.log("⚡ Generating alive attendance...");
        const [eventList] = await db.query('SELECT id, kpi_points FROM events');
        const [allStudents] = await db.query('SELECT id, faculty_id FROM users WHERE role = "student"');
        
        const attendanceRecords = [];

        for (const student of allStudents) {
            if (Math.random() > 0.4) {
                const numEvents = Math.floor(Math.random() * 2) + 1;
                const attended = eventList.sort(() => 0.5 - Math.random()).slice(0, numEvents);

                for (const event of attended) {
                    // Logic: 50% chance to have added a review for +5 bonus
                    const isReviewed = Math.random() > 0.5 ? 1 : 0;
                    const points = isReviewed ? (event.kpi_points + 5) : event.kpi_points;
                    
                    attendanceRecords.push([student.id, event.id, points, isReviewed]);
                }
            }
        }

        if (attendanceRecords.length > 0) {
            // Fix: Insert directly into user_id, event_id, points_earned, and is_reviewed
            await db.query('INSERT INTO attendance (user_id, event_id, points_earned, is_reviewed) VALUES ?', [attendanceRecords]);
        }

        console.log("⭐ SUPER SEEDING COMPLETE. The Live View will handle the rest!");
        process.exit();
    } catch (err) { 
        console.error("❌ Seeding failed:", err); 
        process.exit(1); 
    }
}
runSuperSeed();