/**
 * auth-guard.js
 * ─────────────────────────────────────────────────────────────
 * Drop this <script src="/auth-guard.js"></script> BEFORE any
 * other script in every protected HTML page.
 *
 * What it does:
 *  1. Checks localStorage for a valid login session.
 *  2. If not logged in → saves current URL as returnUrl → sends
 *     user to login.html.
 *  3. If logged in → calls /api/page-access/check to confirm this
 *     user has been granted access to this page.
 *  4. If access denied → redirects to index.html with a toast message.
 *
 * Roles that are ALWAYS allowed regardless of page-access table:
 *   Admin  (can see everything)
 *
 * Usage in any HTML page — replace the inline IIFE auth block with:
 *   <script src="/auth-guard.js"></script>
 *
 * You can also pass options via a global before including this file:
 *   <script>
 *     window.AUTH_GUARD_OPTIONS = {
 *       allowedRoles: ['Admin','HOD','Faculty','Exam_Cell'], // role-level guard (optional)
 *       skipPageAccessCheck: false                          // set true to skip DB check
 *     };
 *   </script>
 *   <script src="/auth-guard.js"></script>
 * ─────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    // ── 1. Read session from localStorage ────────────────────────────────────
    var username = localStorage.getItem('username');
    var userId   = localStorage.getItem('userId');
    var userRole = localStorage.getItem('userRole');

    // ── 2. Not logged in → save intended URL and go to login ─────────────────
    if (!username || !userId) {
        localStorage.setItem('returnUrl', window.location.href);
        window.location.replace('/login.html');
        return;                        // stop execution; page will unload
    }

    // ── 3. Optional role-level guard (fast, no network) ──────────────────────
    var opts         = window.AUTH_GUARD_OPTIONS || {};
    var allowedRoles = opts.allowedRoles || null;   // null = allow all logged-in users

    if (allowedRoles && allowedRoles.indexOf(userRole) === -1) {
        // Role is not permitted for this page at all
        _redirectNoAccess('Your role (' + userRole + ') cannot access this page.');
        return;
    }

    // ── 4. Admin bypasses per-user page-access check ─────────────────────────
    if (userRole === 'Admin') {
        return;   // Admins always have access; page continues loading normally
    }

    // ── 5. Per-user page-access DB check (async, non-blocking) ───────────────
    if (opts.skipPageAccessCheck) {
        return;   // Caller opted out of DB check
    }

    var pageUrl = window.location.pathname.replace(/^\//, ''); // e.g. "lab-panel-entry.html"

    fetch('/api/page-access/check?user_id=' + encodeURIComponent(userId) +
          '&page_url=' + encodeURIComponent(pageUrl))
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (!data.allowed) {
                _redirectNoAccess('You do not have permission to access this page.');
            }
            // else: allowed — page already rendered, nothing to do
        })
        .catch(function () {
            // Network / server error — fail open (page stays) to avoid locking
            // out users due to a transient backend issue. Change to fail-closed
            // by calling _redirectNoAccess() here if you prefer strict security.
            console.warn('[auth-guard] Could not verify page access — failing open.');
        });

    // ── Helper ────────────────────────────────────────────────────────────────
    function _redirectNoAccess(msg) {
        localStorage.setItem('accessDeniedMsg', msg);
        window.location.replace('/index.html');
    }

}());
