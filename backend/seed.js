const db = require("./db");
const bcrypt = require("bcrypt");

async function seedUsers() {
    try {
        // Securely hash the default password for everyone
        const defaultPassword = "hackathon123";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        // Array of users: [id, name, email, role, password, faculty_id]
        // Added the email field to match your database schema
        const users = [
            ["LECTURER001", "Dr. Ahmad Fadzil", "ahmad@uptm.edu.my", "lecturer", hashedPassword, 1],
            ["LECTURER002", "Madam Sarah", "sarah@uptm.edu.my", "lecturer", hashedPassword, 1],
            ["STU2024999", "John Doe", "john.doe@student.uptm.edu.my", "student", hashedPassword, 1],
            ["SUPERADMIN99", "System Administrator", "sysadmin@uptm.edu.my", "admin", hashedPassword, null] 
        ];

        // Updated the SQL string to include the 'email' column
        const sql = "INSERT INTO users (id, name, email, role, password, faculty_id) VALUES ?";
        
        // Execute the bulk insert
        await db.query(sql, [users]);

        console.log(`
        ✅ Users seeded successfully!
        -------------------------------------------
        Test Lecturer 1 : LECTURER001
        Test Lecturer 2 : LECTURER002
        Test Student    : STU2024999
        Test Admin      : SUPERADMIN99
        
        🔑 All Passwords: ${defaultPassword}
        -------------------------------------------
        `);
        process.exit();
        
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.log("⚠️ Users already exist in the database!");
        } else {
            console.error("❌ Seeding failed:", err);
        }
        process.exit(1);
    }
}

seedUsers();