// ============================================================
// js/page-guard.js
// Universal Page Access Guard
// Include this in EVERY protected HTML page:
//   <script src="js/page-guard.js"></script>
// It auto-detects the current page URL and checks access
// ============================================================

(function () {
    'use strict';

    // ── Read session ──────────────────────────────────────────────────────────
    const userId   = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');

    // ── Not logged in → redirect to login ────────────────────────────────────
    if (!userId || !username) {
        window.location.replace('/login.html');
        return;
    }

    // ── Admin always has full access — skip check ─────────────────────────────
    if (userRole === 'Admin') return;

    // ── Get current page filename ─────────────────────────────────────────────
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // ── Dashboard always accessible if logged in ──────────────────────────────
    if (currentPage === 'index.html' || currentPage === '') return;

    // ── Check access via API ──────────────────────────────────────────────────
    fetch(`/api/page-access/check?user_id=${userId}&page_url=${encodeURIComponent(currentPage)}`)
        .then(r => r.json())
        .then(data => {
            if (!data.allowed) {
                // Show access denied briefly then redirect
                document.body.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;
                        min-height:100vh;background:#f0f2f5;font-family:'Segoe UI',sans-serif;">
                        <div style="text-align:center;background:#fff;padding:40px 60px;
                            border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);">
                            <div style="font-size:64px;margin-bottom:16px;">🚫</div>
                            <h2 style="color:#b71c1c;font-size:22px;margin-bottom:8px;">Access Denied</h2>
                            <p style="color:#666;font-size:14px;margin-bottom:24px;">
                                You don't have permission to access this page.<br>
                                Please contact your Administrator.
                            </p>
                            <button onclick="window.location.href='/index.html'"
                                style="background:#3949ab;color:#fff;border:none;padding:10px 24px;
                                border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">
                                ← Back to Dashboard
                            </button>
                        </div>
                    </div>`;
            }
        })
        .catch(() => {
            // Network error — don't block, let user in
            console.warn('Page guard: Could not verify access, allowing through');
        });
}());
