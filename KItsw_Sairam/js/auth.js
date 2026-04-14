// Authentication Management System

class AuthManager {
    constructor() {
        this.sessionKey = 'adminSession';
        this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    }

    // Check if user is authenticated
    isAuthenticated() {
        try {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) return false;

            const sessionData = JSON.parse(session);
            const loginTime = new Date(sessionData.loginTime);
            const now = new Date();
            
            // Check if session has expired
            if (now - loginTime > this.sessionTimeout) {
                this.logout();
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Session validation error:', error);
            this.logout();
            return false;
        }
    }

    // Get current user info
    getCurrentUser() {
        try {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) return null;

            const sessionData = JSON.parse(session);
            const loginTime = new Date(sessionData.loginTime);
            const now = new Date();
            
            // Check if session has expired
            if (now - loginTime > this.sessionTimeout) {
                this.logout();
                return null;
            }
            
            return sessionData;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // Login method
    async login(username, password) {
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const sessionData = {
                    username: data.username,
                    loginTime: new Date().toISOString()
                };
                
                localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
                return { success: true, message: 'Login successful' };
            } else {
                return { success: false, message: data.message || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    // Logout method
    async logout() {
        try {
            // Call logout endpoint to clear server session if needed
            await fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            // Always clear local session
            localStorage.removeItem(this.sessionKey);
        }
    }

    // Redirect to login if not authenticated
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    // Check session validity with server
 async checkSession() {
    try {
        const username = localStorage.getItem('username');
        const response = await fetch('/api/admin/check-session', {
            headers: { 'x-username': username || '' }
        });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            this.logout();
            return false;
        }

        // ✅ Keep localStorage in sync
        if (data.userId)   localStorage.setItem('userId',   data.userId);
        if (data.userRole) localStorage.setItem('userRole', data.userRole);
        if (data.username) localStorage.setItem('username', data.username);
        
        return true;
    } catch (error) {
        console.error('Session check error:', error);
        return false;
    }
}

    // Format session duration
    getSessionDuration() {
        try {
            const session = localStorage.getItem(this.sessionKey);
            if (!session) return 'Not logged in';

            const sessionData = JSON.parse(session);
            const loginTime = new Date(sessionData.loginTime);
            const now = new Date();
            const duration = now - loginTime;
            
            const hours = Math.floor(duration / (1000 * 60 * 60));
            const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } catch (error) {
            return 'Unknown';
        }
    }
}

// Create global auth instance
const auth = new AuthManager();

// Auto-logout on page visibility change (when user switches tabs)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, check session when it becomes visible again
        setTimeout(() => {
            if (!document.hidden && auth.isAuthenticated()) {
                auth.checkSession().then(isValid => {
                    if (!isValid) {
                        window.location.href = '/login.html';
                    }
                });
            }
        }, 1000);
    }
});

// Auto-logout on browser close/tab close
window.addEventListener('beforeunload', function(e) {
    const session = localStorage.getItem(auth.sessionKey);
    if (session) {
        // Note: Modern browsers may not show the confirmation dialog
        // but this helps ensure session cleanup
        const confirmationMessage = 'Are you sure you want to leave? Your session will be terminated.';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

// Periodic session validation (every 5 minutes)
setInterval(() => {
    if (auth.isAuthenticated()) {
        auth.checkSession().then(isValid => {
            if (!isValid) {
                window.location.href = '/login.html';
            }
        });
    }
}, 5 * 60 * 1000); // 5 minutes
