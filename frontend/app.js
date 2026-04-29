const API_BASE = '/api';

// Initialize Socket.io
const socket = io();

socket.on('connect', () => {
    console.log('🔌 Connected to real-time server!');
});

// Listen for the leaderboard update trigger from the backend
socket.on('leaderboardUpdated', (data) => {
    console.log("Live update:", data.message);
    
    // 1. Refresh Leaderboard Tab
    if (document.getElementById('leaderboard-tab').classList.contains('active')) {
        loadLeaderboard();
    }
    
    // 2. Append to Admin Audit Log
    const auditContainer = document.getElementById('audit-log-content');
    if (auditContainer) {
        if (auditContainer.innerText === "Waiting for system events...") auditContainer.innerHTML = "";
        const log = document.createElement('div');
        log.style.padding = "8px"; log.style.borderBottom = "1px solid #334155";
        log.innerHTML = `<span style="color: #10b981;">[${new Date().toLocaleTimeString()}]</span> ${data.message}`;
        auditContainer.prepend(log);
    }
});

// ==========================================
// UI UTILITIES (Toasts & Settings)
// ==========================================
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    // Animate out and remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.openSettingsModal = function() { document.getElementById('settings-modal-overlay').classList.add('active'); }
window.closeSettingsModal = function() { document.getElementById('settings-modal-overlay').classList.remove('active'); }

// ==========================================
// THEME & LANGUAGE LOGIC
// ==========================================

window.toggleDarkMode = function() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('fest_dark_mode', isDark);
}

// Initialize Preferences on Load
window.addEventListener('DOMContentLoaded', () => {
    // Load Theme
    const savedDark = localStorage.getItem('fest_dark_mode') === 'true';
    if (savedDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('dark-mode-toggle').checked = true;
    }
});


// ==========================================
// INITIALIZATION (Check Session on Load)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('fest_token');
    if (token) {
        try {
            // Decode the JWT payload to check expiration
            const payload = JSON.parse(atob(token.split('.')[1]));
            const isExpired = (payload.exp * 1000) < Date.now();
            
            if (isExpired) {
                console.log("Session expired. Logging out automatically.");
                logout();
                return;
            }
            
            // Token is valid, route user based on role
            const userStr = localStorage.getItem('fest_user');
            if (userStr) {
                routeWorkspace(JSON.parse(userStr));
            } else {
                logout(); // Missing user data
            }
        } catch (err) {
            // Fallback if token is malformed
            logout();
        }
    } else {
        switchView('login');
    }
    
    // Load faculties for the Create Event dropdown
    populateFacultyDropdown();
});

// Helper function to animate the bottom nav indicator
function updateNavIndicator() {
    const activeBtn = document.querySelector('.bottom-nav .nav-btn.active');
    const indicator = document.getElementById('nav-indicator');
    if (activeBtn && indicator) {
        indicator.style.width = `${activeBtn.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
}

// Ensure the indicator repositions correctly if the phone is rotated or window resized
window.addEventListener('resize', updateNavIndicator);

// ==========================================
// SPA ROUTING (Tab Switching)
// ==========================================
function switchTab(tabName) {
    // If the user navigates to a different tab, turn off the camera to save battery
    if (window.stopCameraScanner) window.stopCameraScanner();

    // Hide all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    
    // Show the selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) selectedTab.classList.add('active');

    // Update Active Nav Button & Animated Indicator
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`switchTab('${tabName}')`)) {
            document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Use setTimeout to ensure DOM is fully rendered before calculating widths
            setTimeout(updateNavIndicator, 10);
        }
    });

    // Trigger data loading based on the tab selected
    if (tabName === 'leaderboard') {
        loadLeaderboard();
    } else if (tabName === 'profile') {
        loadProfile('profile-content');
    } else if (tabName === 'org-profile') {
        loadProfile('org-profile-content');
    } else if (tabName === 'admin-profile') {
        loadProfile('admin-profile-content');
    } else if (tabName === 'scanner') {
        loadActiveEvents('student-active-events', 'student');
    } else if (tabName === 'org-scanner') {
        loadActiveEvents('org-active-events-list', 'student');
    } else if (tabName === 'org-manage') {
        loadActiveEvents('org-events-list', 'organizer');
    } else if (tabName === 'admin-controls') {
        loadActiveEvents('admin-events-list', 'admin');
    } else if (tabName === 'org-leaderboard' || tabName === 'admin-leaderboard') {
        const containerId = tabName === 'org-leaderboard' ? 'org-leaderboard-content' : 'admin-leaderboard-content';
        loadDetailedLeaderboard(containerId);
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
}

// ==========================================
// WORKSPACE ROUTER
// ==========================================
function routeWorkspace(user) {
    if (user.role === 'admin') {
        switchView('admin-workspace');
        switchTab('admin-controls');
    } else if (user.role === 'lecturer' || user.role === 'organizer') {
        switchView('organizer-workspace');
        switchTab('org-create');
    } else {
        // Default to student layout
        switchView('student-workspace');
        switchTab('leaderboard');
    }
}

// ==========================================
// AUTHENTICATION LOGIC
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('student-id').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.innerText = "Logging in...";

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        
        const data = await res.json();

        if (data.success) {
            // 1. Store the token
            localStorage.setItem('fest_token', data.token);
            localStorage.setItem('fest_user', JSON.stringify(data.user));
            
            // 2. Route to the appropriate workspace based on user role
            routeWorkspace(data.user);
        } else {
            errorMsg.innerText = data.message;
        }
    } catch (err) {
        errorMsg.innerText = "Server error. Try again later.";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Login";
    }
});

function logout() {
    localStorage.removeItem('fest_token');
    localStorage.removeItem('fest_user');
    switchView('login');
}

// ==========================================
// SCANNER LOGIC
// ==========================================
async function handleScanSubmit(e, codeInputId, messageId) {
    e.preventDefault();
    
    const eventCode = document.getElementById(codeInputId).value;
    const scanMessage = document.getElementById(messageId);
    const token = localStorage.getItem('fest_token'); // Get secure token
    const submitBtn = e.target.querySelector('button[type="submit"]');

    scanMessage.innerText = "Submitting code...";
    scanMessage.style.color = "#333";
    
    submitBtn.disabled = true;
    submitBtn.innerText = "Scanning...";

    try {
        const res = await fetch(`${API_BASE}/attendance/scan`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // MUST include token to verify identity
            },
            body: JSON.stringify({ eventCode })
        });
        
        const data = await res.json();

        if (data.success) {
            scanMessage.innerText = data.message;
            scanMessage.style.color = "green";
            document.getElementById(codeInputId).value = ''; // Clear input on success
            showToast(data.message, 'success');
        } else {
            scanMessage.innerText = data.message;
            scanMessage.style.color = "red";
        }
    } catch (err) {
        console.error("Scan Error:", err);
        scanMessage.innerText = "Server error. Try again later.";
        scanMessage.style.color = "red";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Code";
    }
}

document.getElementById('scan-form')?.addEventListener('submit', (e) => handleScanSubmit(e, 'event-code', 'scan-message'));
document.getElementById('org-scan-form')?.addEventListener('submit', (e) => handleScanSubmit(e, 'org-event-code', 'org-scan-message'));

// ==========================================
// DATA FETCHING (Placeholders for now)
// ==========================================
async function loadLeaderboard() {
    const contentDiv = document.getElementById('leaderboard-content');
    contentDiv.innerHTML = "<p>Fetching fresh leaderboard data...</p>";
    
    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        const data = await res.json();
        
        if (data.success) {
            const faculties = data.data;
            
            if (faculties.length === 0) {
                contentDiv.innerHTML = "<p>No leaderboard data available yet.</p>";
                return;
            }
            
            // Build a dynamic HTML table
            let html = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ccc; text-align: left;">
                            <th style="padding: 10px 5px;">#</th>
                            <th style="padding: 10px 5px;">Faculty</th>
                            <th style="padding: 10px 5px;">Pts</th>
                            <th style="padding: 10px 5px;">Part. %</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            faculties.forEach((faculty, index) => {
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 5px; font-weight: bold; color: ${faculty.brand_color};">${index + 1}</td>
                        <td style="padding: 10px 5px; font-weight: bold; color: ${faculty.brand_color};">${faculty.short_name}</td>
                        <td style="padding: 10px 5px;">${faculty.total_points}</td>
                        <td style="padding: 10px 5px;">${Number(faculty.participation_rate).toFixed(1)}%</td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = `<p class="error-msg">Failed to load: ${data.message}</p>`;
        }
    } catch (err) {
        console.error("Leaderboard fetch error:", err);
        contentDiv.innerHTML = `<p class="error-msg">Server error. Try again later.</p>`;
    }
}

// ==========================================
// TRUE CAMERA QR SCANNER LOGIC
// ==========================================
let html5QrCode = null;

window.startCameraScanner = function(readerId, inputId, stopBtnId) {
    const readerDiv = document.getElementById(readerId);
    const startBtnId = readerId === 'qr-reader' ? 'start-camera-btn' : 'org-start-camera-btn';
    
    // Swap the buttons and show the video container
    document.getElementById(startBtnId).style.display = 'none';
    document.getElementById(stopBtnId).style.display = 'block';
    readerDiv.style.display = 'block';

    html5QrCode = new Html5Qrcode(readerId);
    
    html5QrCode.start(
        { facingMode: "environment" }, // Prefer the rear camera on smartphones
        { fps: 10, qrbox: { width: 250, height: 250 } }, // Scan 10 times a second
        (decodedText) => {
            // 1. Success! Turn off the camera immediately
            stopCameraScanner();
            showToast("QR Code Detected!", "success");
            
            // 2. Fill the text box with the extracted 6-digit code
            document.getElementById(inputId).value = decodedText;
            
            // 3. Programmatically simulate hitting the "Submit Code" button
            const formId = inputId === 'event-code' ? 'scan-form' : 'org-scan-form';
            const messageId = inputId === 'event-code' ? 'scan-message' : 'org-scan-message';
            const fakeEvent = { preventDefault: () => {}, target: document.getElementById(formId) };
            
            handleScanSubmit(fakeEvent, inputId, messageId);
        },
        (errorMessage) => {
            // Ignore background noise parsing errors
        }
    ).catch((err) => {
        console.error(err);
        showToast("Camera permission denied or unavailable.", "error");
        stopCameraScanner();
    });
};

window.stopCameraScanner = function() {
    // 1. Reset UI FIRST so the red button always goes away, even if the camera throws an error
    if (document.getElementById('qr-reader')) document.getElementById('qr-reader').style.display = 'none';
    if (document.getElementById('start-camera-btn')) document.getElementById('start-camera-btn').style.display = 'block';
    if (document.getElementById('stop-camera-btn')) document.getElementById('stop-camera-btn').style.display = 'none';

    // 2. Reset Organizer UI
    if (document.getElementById('org-qr-reader')) document.getElementById('org-qr-reader').style.display = 'none';
    if (document.getElementById('org-start-camera-btn')) document.getElementById('org-start-camera-btn').style.display = 'block';
    if (document.getElementById('org-stop-camera-btn')) document.getElementById('org-stop-camera-btn').style.display = 'none';

    // 3. Then safely try to stop the video feed
    if (html5QrCode) {
        try {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                html5QrCode = null;
            }).catch(err => {
                html5QrCode.clear();
                html5QrCode = null;
            });
        } catch (err) {
            // If it throws a synchronous error (because it never successfully started)
            try { html5QrCode.clear(); } catch(e) {}
            html5QrCode = null;
        }
    }
};

// ==========================================
// ORGANIZER & ADMIN LOGIC
// ==========================================
async function handleCreateEventSubmit(e, prefix) {
    e.preventDefault();
    const token = localStorage.getItem('fest_token');
    const msgDiv = document.getElementById(`${prefix}create-event-msg`);
    
    const payload = {
        eventName: document.getElementById(`${prefix}event-name`).value,
        description: document.getElementById(`${prefix}event-desc`).value,
        kpiPoints: document.getElementById(`${prefix}event-kpi`).value,
        maxCapacity: document.getElementById(`${prefix}event-cap`).value ? parseInt(document.getElementById(`${prefix}event-cap`).value) : null,
        startTime: document.getElementById(`${prefix}event-start`).value,
        endTime: document.getElementById(`${prefix}event-end`).value,
        organizedByFaculty: document.getElementById(`${prefix}event-faculty`).value || null
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Creating...";

    msgDiv.innerText = "Creating event..."; msgDiv.style.color = "#333";

    try {
        const res = await fetch(`${API_BASE}/events/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data.data.eventCode}`;
            msgDiv.innerHTML = `Success! Code: <span style="font-size: 2.5rem; display: block; color: #2563eb; letter-spacing: 10px; margin-top: 10px;">${data.data.eventCode}</span><br><img src="${qrUrl}" alt="Event QR Code" style="margin-top: 10px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 4px solid white;">`;
            msgDiv.style.color = "green";
            e.target.reset();
        } else {
            msgDiv.innerText = data.message; msgDiv.style.color = "red";
        }
    } catch (err) {
        msgDiv.innerText = "Server error."; msgDiv.style.color = "red";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Create & Generate Code";
    }
}

document.getElementById('create-event-form')?.addEventListener('submit', (e) => handleCreateEventSubmit(e, ''));
document.getElementById('admin-create-event-form')?.addEventListener('submit', (e) => handleCreateEventSubmit(e, 'admin-'));

async function loadActiveEvents(containerId, role) {
    const container = document.getElementById(containerId);
    container.innerHTML = "<p>Loading active events...</p>";
    
    try {
        const token = localStorage.getItem('fest_token');
        // Students use public active route, Admins/Organizers use secure manage route to get codes
        const url = role === 'student' ? `${API_BASE}/events/active` : `${API_BASE}/events/manage`;
        const headers = role === 'student' ? {} : { 'Authorization': `Bearer ${token}` };
        
        const res = await fetch(url, { headers });
        
        // Detect if the server crashed and returned HTML instead of JSON
        if (!res.ok) {
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Server returned non-JSON error: HTTP ${res.status}`);
            }
        }

        const data = await res.json();
        
        if (data.success) {
          // Store locally to quickly populate the edit form later
          window.currentEventsList = data.data;
          if (data.data.length > 0) {
            let html = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: left;">
                <thead style="background: #0f172a; color: white;">
                    <tr><th style="padding: 12px;">Event Name</th><th style="padding: 12px;">Points</th>${role !== 'student' ? '<th style="padding: 12px; width: 340px;">Actions</th>' : ''}</tr>
                </thead><tbody>`;
            
            data.data.forEach(ev => {
                // Null-safety: Prevent crashes if database has empty event names
                const eventName = ev.event_name || 'Unnamed Event';
                const escapedName = eventName.replace(/'/g, "\\'");
                
                html += `<tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px;"><strong>${eventName}</strong><br><span style="font-size: 0.85em; color: #64748b;">${ev.description || ''}</span></td>
                    <td style="padding: 12px; font-weight: bold; color: #2563eb;">${ev.kpi_points || 0}</td>
                    ${role !== 'student' ? `<td style="padding: 12px; display: flex; gap: 8px;">
                        <button onclick="showQRModal('${escapedName}', '${ev.random_code}')" style="flex:1; padding: 8px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">📱 QR</button>
                        <button onclick="exportAttendance(${ev.id})" style="flex:1; padding: 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">⬇️ CSV</button>
                        <button onclick="openEditModal(${ev.id})" style="flex:1; padding: 8px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">✏️ Edit</button>
                        <button onclick="deleteEvent(${ev.id}, '${escapedName}')" style="flex:1; padding: 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🗑️ Del</button>
                    </td>` : ''}
                </tr>`;
            });
            container.innerHTML = html + `</tbody></table>`;
          } else {
              container.innerHTML = "<p>No active events at the moment.</p>";
          }
        } else {
            // The backend returned a proper JSON error message (e.g. Forbidden)
            container.innerHTML = `<p class="error-msg">Error: ${data.message}</p>`;
        }
    } catch (err) {
        console.error("loadActiveEvents Error:", err);
        container.innerHTML = `<p class="error-msg">Server error loading events. Please try again later.</p>`;
    }
}

async function loadDetailedLeaderboard(containerId) {
    const contentDiv = document.getElementById(containerId);
    contentDiv.innerHTML = "<p>Fetching detailed leaderboard data...</p>";
    
    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        const data = await res.json();
        
        if (data.success) {
            const faculties = data.data;
            
            if (faculties.length === 0) {
                contentDiv.innerHTML = "<p>No leaderboard data available yet.</p>";
                return;
            }
            
            // Build a more detailed HTML table
            let html = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem;">
                    <thead style="background: #f1f5f9; color: #475569;">
                        <tr style="text-align: left;">
                            <th style="padding: 12px;">#</th>
                            <th style="padding: 12px;">Faculty</th>
                            <th style="padding: 12px;">Total Points</th>
                            <th style="padding: 12px;">Total Scans</th>
                            <th style="padding: 12px;">Participation Rate</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            faculties.forEach((faculty, index) => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: bold; color: ${faculty.brand_color};">${index + 1}</td>
                        <td style="padding: 12px;">
                            <strong style="color: ${faculty.brand_color};">${faculty.faculty_name}</strong>
                            <br><span style="font-size: 0.8em; color: #64748b;">(${faculty.short_name})</span>
                        </td>
                        <td style="padding: 12px; font-weight: 700; font-size: 1.1em;">${faculty.total_points.toLocaleString()}</td>
                        <td style="padding: 12px;">${faculty.total_scans.toLocaleString()}</td>
                        <td style="padding: 12px;">${Number(faculty.participation_rate).toFixed(2)}%</td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = `<p class="error-msg">Failed to load: ${data.message}</p>`;
        }
    } catch (err) {
        console.error("Detailed Leaderboard fetch error:", err);
        contentDiv.innerHTML = `<p class="error-msg">Server error. Try again later.</p>`;
    }
}

// Pop-up QR Modal Controls
window.showQRModal = function(eventName, code) {
    document.getElementById('modal-event-name').innerText = eventName;
    document.getElementById('modal-event-code').innerText = code;
    
    // Request a high-res 500x500 QR code so it stays crisp when enlarged
    document.getElementById('modal-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${code}`;
    document.getElementById('qr-modal-overlay').classList.add('active');
}

window.closeQRModal = function() {
    document.getElementById('qr-modal-overlay').classList.remove('active');
    
    // Reset enlargement if closed
    document.querySelector('#qr-modal-overlay .modal-content').classList.remove('expanded');
    document.getElementById('enlarge-btn').innerText = "🔍 Enlarge";
    try { document.exitFullscreen(); } catch (e) {} // Exit fullscreen if active
}

window.toggleEnlargeQR = function() {
    const modalContent = document.querySelector('#qr-modal-overlay .modal-content');
    const btn = document.getElementById('enlarge-btn');
    
    modalContent.classList.toggle('expanded');
    
    if (modalContent.classList.contains('expanded')) {
        btn.innerText = "🔽 Shrink";
        try { document.documentElement.requestFullscreen(); } catch (e) {} // Request native browser fullscreen
    } else {
        btn.innerText = "🔍 Enlarge";
        try { document.exitFullscreen(); } catch (e) {}
    }
}

// Pop-up Edit Modal Controls
window.openEditModal = function(eventId) {
    const ev = window.currentEventsList.find(e => e.id === eventId);
    if (!ev) return;

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('edit-event-name').value = ev.event_name || '';
    document.getElementById('edit-event-desc').value = ev.description || '';
    document.getElementById('edit-event-kpi').value = ev.kpi_points || '';
    document.getElementById('edit-event-cap').value = ev.max_capacity || '';
    document.getElementById('edit-event-faculty').value = ev.organized_by_faculty || '';

    // Convert DB ISO string to browser local datetime format
    const formatForInput = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    document.getElementById('edit-event-start').value = formatForInput(ev.start_time);
    document.getElementById('edit-event-end').value = formatForInput(ev.end_time);

    document.getElementById('edit-modal-overlay').classList.add('active');
}

window.closeEditModal = function() {
    document.getElementById('edit-modal-overlay').classList.remove('active');
}

// Handle Edit Form Submission
document.getElementById('edit-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventId = document.getElementById('edit-event-id').value;
    const token = localStorage.getItem('fest_token');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const payload = {
        eventName: document.getElementById('edit-event-name').value,
        description: document.getElementById('edit-event-desc').value,
        kpiPoints: document.getElementById('edit-event-kpi').value,
        maxCapacity: document.getElementById('edit-event-cap').value ? parseInt(document.getElementById('edit-event-cap').value) : null,
        startTime: document.getElementById('edit-event-start').value,
        endTime: document.getElementById('edit-event-end').value,
        organizedByFaculty: document.getElementById('edit-event-faculty').value || null
    };

    submitBtn.disabled = true;
    submitBtn.innerText = "Saving...";

    try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            closeEditModal();
            // Auto-refresh the list
            if (document.getElementById('org-manage-tab').classList.contains('active')) {
                loadActiveEvents('org-events-list', 'organizer');
            } else if (document.getElementById('admin-controls-tab').classList.contains('active')) {
                loadActiveEvents('admin-events-list', 'admin');
            }
        } else { showToast(data.message, 'error'); }
    } catch (err) {
        showToast("Server error during update.", 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Save Changes";
    }
});

window.deleteEvent = async function(eventId, eventName) {
    // Safety confirmation to prevent accidental clicks
    if (!confirm(`Are you sure you want to permanently delete the event "${eventName}"?\n\nThis will also delete ALL attendance records for this event. This action cannot be undone.`)) {
        return;
    }

    const token = localStorage.getItem('fest_token');

    try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Detect if the server crashed or returned text/HTML instead of JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const textError = await res.text();
            console.error("Non-JSON Response from Server:", textError);
            throw new Error(`The server did not return JSON. It returned HTTP ${res.status}. Check Console (F12).`);
        }

        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            // Refresh the list of events
            if (document.getElementById('org-manage-tab').classList.contains('active')) {
                loadActiveEvents('org-events-list', 'organizer');
            } else if (document.getElementById('admin-controls-tab').classList.contains('active')) {
                loadActiveEvents('admin-events-list', 'admin');
            }
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        console.error("Delete Event Error Details:", err);
        showToast(`Error: ${err.message}`, 'error');
    }
}

function exportAttendance(eventId) {
    const token = localStorage.getItem('fest_token');
    fetch(`${API_BASE}/events/export/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => { if (!res.ok) throw new Error("Export failed"); return res.blob(); })
    .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `event_${eventId}_attendance.csv`;
        a.click();
    })
    .catch(() => showToast("Failed to export. No records found.", "error"));
}

async function forceRefreshLeaderboard() {
    const token = localStorage.getItem('fest_token');
    try {
        const res = await fetch(`${API_BASE}/leaderboard/force-refresh`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        showToast(data.message, 'success');
    } catch (err) { showToast("Error clearing cache.", 'error'); }
}

// Helper to populate the Organized By dropdown dynamically
async function populateFacultyDropdown() {
    const orgDropdown = document.getElementById('event-faculty');
    const adminDropdown = document.getElementById('admin-event-faculty');
    const editDropdown = document.getElementById('edit-event-faculty');
    if (!orgDropdown && !adminDropdown && !editDropdown) return;
    
    try {
        const res = await fetch(`${API_BASE}/leaderboard`);
        const data = await res.json();
        if (data.success && data.data) {
            data.data.forEach(fac => {
                const html = `<option value="${fac.faculty_id}">${fac.faculty_name} (${fac.short_name})</option>`;
                if (orgDropdown) {
                    orgDropdown.insertAdjacentHTML('beforeend', html);
                }
                if (adminDropdown) {
                    adminDropdown.insertAdjacentHTML('beforeend', html);
                }
                if (editDropdown) {
                    editDropdown.insertAdjacentHTML('beforeend', html);
                }
            });
        }
    } catch (err) { console.error("Could not load faculties for dropdown", err); }
}

async function loadProfile(containerId = 'profile-content') {
    const contentDiv = document.getElementById(containerId);
    const userStr = localStorage.getItem('fest_user');
    const token = localStorage.getItem('fest_token');

    if (!userStr || !token) {
        contentDiv.innerHTML = "<p class='error-msg'>User not found. Please log in again.</p>";
        return;
    }

    const user = JSON.parse(userStr);
    contentDiv.innerHTML = `<p>Fetching history for ${user.name}...</p>`;

    try {
        const res = await fetch(`${API_BASE}/attendance/history/${user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await res.json();
        
        if (data.success) {
            const history = data.data;
            
            let html = `<div style="margin-bottom: 20px;">
                            <h3 style="font-size: 1.5rem; margin-bottom: 5px;">Welcome, ${user.name}!</h3>
                            <p style="color: #64748b; text-transform: capitalize; margin-bottom: 5px;">Role: <strong>${user.role}</strong></p>`;
            
            // Only show faculty if the user actually belongs to one (Admins might be NULL)
            if (user.facultyName) {
                html += `<p>Faculty: <strong style="color: ${user.brandColor || '#2563eb'};">${user.facultyName}</strong></p>`;
            }
            html += `</div>`;
            
            if (history.length === 0) {
                html += `<p style="padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">You haven't attended any events yet.</p>`;
                contentDiv.innerHTML = html;
                return;
            }
            
            html += `<h4>Attendance History</h4>
                     <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem;">
                        <thead><tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                            <th style="padding: 10px 5px;">Event</th>
                            <th style="padding: 10px 5px;">Pts</th>
                            <th style="padding: 10px 5px;">Date</th>
                        </tr></thead><tbody>`;
            
            history.forEach(record => {
                const date = new Date(record.scanned_at).toLocaleDateString();
                html += `<tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 5px; font-weight: 500;">${record.event_name}</td>
                            <td style="padding: 10px 5px; color: #10b981; font-weight: bold;">+${record.kpi_points}</td>
                            <td style="padding: 10px 5px; color: #64748b;">${date}</td>
                         </tr>`;
            });
            html += `</tbody></table>`;
            contentDiv.innerHTML = html;
        } else {
            contentDiv.innerHTML = `<p class="error-msg">Failed to load history: ${data.message}</p>`;
        }
    } catch (err) {
        console.error("Profile fetch error:", err);
        contentDiv.innerHTML = `<p class="error-msg">Server error. Try again later.</p>`;
    }
}
