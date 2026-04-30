# FESt - Faculty Engagement System
FESt is a high-performance, real-time event tracking and engagement platform built for the MariaDB Hackathon MY 2026. It transforms campus participation into a competitive faculty-wide experience by rewarding student engagement through a secure, role-based ecosystem.

## **🚀 Key Features**
- **Role-Based Access Control (RBAC):** Secure, dedicated dashboards for Students, Organizers (Lecturers), and SuperAdmins, managed via custom middleware.
  
- **Anti-Farming Attendance:** A robust scanning system that prevents duplicate point claiming using database-level constraints and time-gated event windows.  

- **Dynamic Leaderboard:** Real-time faculty rankings calculated via MariaDB Views and optimized with server-side caching.  

- **Engagement Bonuses:** Automated incentive logic that awards bonus points to a student’s faculty upon submitting event feedback.

## **💎 What Makes It Special?**
FESt isn't just a simple CRUD app. We implemented specific technical solutions to handle high-traffic environments and ensure data integrity.

**1. High-Traffic Performance Caching**
- To prevent database bottlenecks during peak scan times, the leaderboard utilizes a 30-second server-side cache.
```JavaScript
// From backend/routes/leaderboardRoutes.js
const CACHE_DURATION_MS = 30 * 1000; // 30 seconds
let cachedLeaderboard = null;
let lastFetchTime = 0;

router.get('/v_kpi_leaderboard', async (req, res) => {
    const now = Date.now();
    // Serve from memory if cache is still valid
    if (cachedLeaderboard && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return res.json({ source: 'cache', data: cachedLeaderboard });
    }
    // Otherwise, fetch from MariaDB
});
```

**2. Recursive Unique Code Generation**
- Every event generates a unique 6-digit verification code. Our logic ensures these codes never collide within active events.
```JavaScript
// From backend/routes/eventRoutes.js
let code;
let isUnique = false;
while (!isUnique) {
    code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit code
    const [existing] = await db.query('SELECT id FROM events WHERE random_code = ?', [code]);
    if (existing.length === 0) isUnique = true; // Ensure code is truly unique
}
```

**3. Database-Level Duplicate Protection**
- We offload integrity checks to MariaDB, catching specific error codes to provide instant, helpful feedback to the user.
```JavaScript
// From backend/routes/attendanceRoutes.js
try {
    await db.query('INSERT INTO attendance ...');
} catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: "You already claimed points for this event! 🛑" }); //
    }
}
```
## **🛠️ Tech Stack**
-**Runtime:** Node.js & Express

-**Database:** MariaDB (Connection Pooling via mysql2/promise)

-**Frontend:** Single Page Application (SPA) - Vanilla JS, HTML5, CSS3

-**Security:** Role-based Middleware & Password Hashing

## **📦 Quick Start Guide**
1. **Installation**
```Bash
git clone https://github.com/MariaDB-Hackathon-MY-2026/fest-system.git
npm install
```

2. **Environment Setup**

Create a .env file in the root based on .env.example

```plaintext
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=fest_db
PORT=3000
```

3. **Database Seeding**

Initialize your local MariaDB instance with our test data (Faculties, Users, Events)

```Bash
node backend/seed.js
node backend/seedEvents.js
```

## **📂 Project Structure**

```Plaintext
├── backend/
│   ├── middleware/      # Auth & Role verification logic
│   ├── routes/          # Modular API endpoints
│   ├── db.js            # MariaDB Promise-based pool
│   └── server.js        # Main entry point
├── frontend/
│   ├── app.js           # Client-side SPA logic
│   ├── index.html       # Main UI
│   └── style.css        # Custom branding and styling
└── package.json         # Project metadata & dependencies
```

## **🔮 Future Roadmap**

- **True Camera QR Scanner:** Integrated in-browser scanning via html5-qrcode.

- **Dark Mode Toggle:** Built-in UI theme switcher for night events.

- **Multi-Language Support:** English and Bahasa Melayu toggles for accessibility.

- **Faculty Branding:** Dynamic UI color-shifting based on the user's logged-in faculty.

- ****
