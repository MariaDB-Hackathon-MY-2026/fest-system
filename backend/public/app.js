// Example frontend login function
async function login(id, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
    });

    const data = await response.json();

    if (data.success) {
        // Save to localStorage
        localStorage.setItem('fest_user', JSON.stringify(data.user));
        // Redirect to the dashboard
        window.location.href = '/dashboard.html';
    } else {
        alert(data.message);
    }
}