const db = require("./db");

async function seedEvents() {
    try {
        // 1. Create the event_types table if it doesn't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS event_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                points INT NOT NULL
            )
        `);
        
        // 2. Clear existing entries and insert the default types
        await db.query('TRUNCATE TABLE event_types');
        const types = [
            ["Exhibition / Showcase", 5], ["Talk / Seminar", 10], 
            ["Workshop", 15], ["Competition", 20], ["Community Service", 25]
        ];
        await db.query('INSERT INTO event_types (name, points) VALUES ?', [types]);

        // 3. Seed active test events
        // We'll set these to start an hour ago and end 24 hours from now
        // so they are definitely "Active" for your demo.
        const startTime = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ');
        const endTime = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');

        // Array of events: [event_name, description, kpi_points, random_code, start_time, end_time, created_by, max_capacity]
        const events = [
            ["CyberUnlocked Workshop", "Learn the basics of scam prevention and digital safety.", 15, "112233", startTime, endTime, "LECTURER001", 50],
            ["FCOM Gaming Tournament", "E-sports battle for the Faculty of Computing & Multimedia.", 20, "445566", startTime, endTime, "SUPERADMIN99", 100],
            ["Entrepreneurship Talk", "A session with local industry leaders on starting a business.", 10, "778899", startTime, endTime, "LECTURER002", 30],
            ["Digital Arts Showcase", "Exhibition of creative works from multimedia students.", 10, "123321", startTime, endTime, "LECTURER001", null]
        ];

        const sql = `
            INSERT INTO events 
            (event_name, description, kpi_points, random_code, start_time, end_time, created_by, max_capacity) 
            VALUES ?
        `;

        await db.query(sql, [events]);

        console.log(`
        ✅ Event Types seeded successfully!
        ✅ Events seeded successfully!
        -------------------------------------------
        1. CyberUnlocked Workshop (Code: 112233)
        2. FCOM Gaming Tournament (Code: 445566)
        3. Entrepreneurship Talk  (Code: 778899)
        4. Digital Arts Showcase  (Code: 123321)
        -------------------------------------------
        `);
        process.exit();

    } catch (err) {
        console.error("❌ Event seeding failed:", err);
        process.exit(1);
    }
}

seedEvents();