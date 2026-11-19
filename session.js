/* ============================================================================
 * session.js  -  Solar CRM frontend <-> Spring Boot backend (port 8091)
 *
 * Load it with a plain <script src="/session.js"></script> at the END of <body> on every page,
 * AFTER <script src="/shared/logger.js"></script>.
 * On a protected page it redirects to /index.html (login) when there is no session.
 * On the login page use:  <script src="/session.js" data-public="true"></script>
 *
 * What it does for every protected page
 *   1. Draws the sidebar into <nav id="sidebarNav" data-active="<moduleKey>"> from the modules
 *      the backend returned at login (and refreshes them from /api/me/access).
 *   2. Defines window.currentUserRole / window.currentUserPartnerName (read-only globals).
 *   3. Runs applyRoleBasedVisibility() ([data-role] elements) and applyProfileRoleLabel().
 *   4. Wires #profileLogoutBtn to a logout that really clears the session first.
 *   5. SUPER ADMIN ONLY: partner view mode (see below).
 *   6. Session end: every 401 that cannot be refreshed, a revoked token, or a deactivated account/partner/role
 *      goes through endSession(): the session AND the stored partner selection are cleared, a one-shot notice is
 *      left for the login page, and the user is sent to login.
 *   7. Forced password change: while the account has mustChangePassword every page redirects to
 *      /change-password.html (the server refuses everything else with 403 PASSWORD_CHANGE_REQUIRED).
 *   8. Platform-only pages (channel partners, audit log): anyone except SUPER_ADMIN is sent to the dashboard.
 *
 * Partner view mode (Super Admin)
 *   Super Admin owns data under the PLATFORM partner. To LOOK at one partner, pick it in
 *   <select id="partnerViewSelect"> (created next to #notifBtn when the page has none). While a partner is
 *   selected: every GET gets ?viewPartnerId=<id> (never POST/PUT/PATCH/DELETE), a read-only banner is shown,
 *   elements marked data-write are hidden, and any write call is refused in the browser.
 *   The choice lives in sessionStorage and is cleared on logout and on every session end.
 *
 * Public API
 *   API_BASE, Session.save/get/clear/token/has/can/logout/endSession
 *   Session.api(path, {method, body})  -> parsed JSON envelope { success, message, data }, throws on error
 *   Session.authFetch(path, options)   -> raw fetch Response (Bearer token + automatic refresh)
 *   Session.getRole() / getUser() / getSession() / Session.user
 *   Session.isSuperAdmin() / isViewMode() / getViewPartner() / viewAs(id, name) / exitView()
 *   apiFetch(path, options), api.get/post/put/patch/delete (return body.data)
 * ========================================================================== */
(function () {
    'use strict';

    var BACKEND_PORT = 8091;
    var LOGIN_PAGE = '/index.html';
    var CHANGE_PW_PAGE = '/change-password.html';
    var HOME_PAGE = '/dashboard/dashboard.html';
    var KEY = 'sqms_session';
    var VIEW_KEY = 'sqms_view_partner';
    var NOTICE_KEY = 'sqms_login_notice';          // one-shot message shown on the login page
    // Endpoint that returns the partners for the selector: [{id, code, name}] or {content:[...]}.
    // CONFIRM this path against your ChannelPartner controller (the one that uses findOptions).
    var PARTNER_OPTIONS_URL = window.PARTNER_OPTIONS_URL || '/api/channel-partners/options';
    // Calls that are about the signed-in user, not about partner data: never get ?viewPartnerId, never blocked.
    var VIEW_EXEMPT = /^\/api\/(auth|notifications|me)(\/|\?|$)/;
    // Pages of platform-only modules (CHANNEL_PARTNER, AUDIT). The backend refuses their data to everyone but
    // SUPER_ADMIN anyway; this only keeps a partner user from landing on a broken page by typing the URL.
    var PLATFORM_ONLY_PREFIXES = ['/channel-partner/', '/audit/'];

    // errorCodes that mean "this session is over" (401 from the filter, 403 when the account got deactivated)
    var DEAD_SESSION_CODES = ['UNAUTHORIZED', 'TOKEN_REVOKED', 'INVALID_REFRESH_TOKEN', 'ACCOUNT_INACTIVE',
                              'PARTNER_INACTIVE', 'ROLE_INACTIVE', 'SCOPE_NOT_ALLOWED'];
    var SESSION_MESSAGES = {
        SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
        TOKEN_REVOKED: 'You were signed out because your password or access changed. Please sign in again.',
        INVALID_REFRESH_TOKEN: 'Your session is no longer valid. Please sign in again.',
        UNAUTHORIZED: 'Please sign in again.',
        ACCOUNT_INACTIVE: 'Your account has been deactivated. Please contact your administrator.',
        PARTNER_INACTIVE: 'Your company account is inactive. Please contact your administrator.',
        ROLE_INACTIVE: 'Your role is no longer active. Please contact your administrator.',
        SCOPE_NOT_ALLOWED: 'Your account is not set up correctly. Please contact your administrator.'
    };

    var host = (location.protocol === 'file:' || !location.hostname) ? 'localhost' : location.hostname;
    var proto = location.protocol === 'https:' ? 'https:' : 'http:';
    window.API_BASE = window.API_BASE || (proto + '//' + host + ':' + BACKEND_PORT);

    // logging (logger.js is optional: pages still work without it). Never log tokens or passwords.
    function xfetch() { return (window.AppLog ? window.AppLog.fetch : window.fetch).apply(window, arguments); }
    function L(level, msg, data) { if (window.AppLog) window.AppLog[level]('SESSION', msg, data); }

    function read(store) {
        try { var r = store.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
    }
    function write(store, obj) {
        try { store.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* storage full / blocked */ }
    }
    function get() { return read(sessionStorage) || read(localStorage); }
    function store() { return read(sessionStorage) ? sessionStorage : (read(localStorage) ? localStorage : sessionStorage); }

    function normModules(list) {
        return (list || []).map(function (m) {
            if (typeof m === 'string') return { key: m, label: m, path: null, platformOnly: false, actions: [] };
            var code = m.code ? String(m.code).toLowerCase() : null;
            return {
                key: m.key || (code === 'user' ? 'user_management' : code),
                label: m.label || m.name || m.key,
                path: m.path || m.route || null,
                platformOnly: !!m.platformOnly,
                actions: m.actions || []
            };
        }).filter(function (m) { return m.key; });
    }

    function save(d, remember) {
        d = d || {};
        var user = d.user || {};
        var session = {
            token: d.token || d.accessToken,
            refreshToken: d.refreshToken || null,
            expiresAt: d.expiresIn ? Date.now() + d.expiresIn * 1000 : null,
            role: d.role || (user.role && user.role.code) || null,
            roleName: (user.role && user.role.name) || d.roleName || null,
            userId: d.userId || user.id || null,
            name: d.name || user.name || '',
            email: d.email || user.email || '',
            photoUrl: user.photoUrl || null,
            mustChangePassword: !!user.mustChangePassword,
            partnerId: d.partnerId != null ? d.partnerId : (user.partner ? user.partner.id : null),
            partnerName: d.partnerName || (user.partner ? user.partner.name : null),
            modules: normModules(d.modules),
            permissions: d.permissions || []
        };
        var useLocal = remember === true;
        clear();
        write(useLocal ? localStorage : sessionStorage, session);
        return session;
    }

    // Used by logout, by every session end, and by save(): the view-partner choice goes with it.
    function clear() {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        try { localStorage.removeItem(KEY); } catch (e) {}
        try { sessionStorage.removeItem(VIEW_KEY); } catch (e) {}
    }

    function has(moduleKey) {
        var s = get();
        return !!s && (s.modules || []).some(function (m) { return m.key === moduleKey; });
    }
    function can(permission) {
        var s = get();
        return !!s && (s.permissions || []).indexOf(permission) !== -1;
    }
    function goLogin() { window.location.replace(LOGIN_PAGE); }
    function goHome() { window.location.replace(HOME_PAGE); }
    function goChangePassword() {
        if (location.pathname !== CHANGE_PW_PAGE) window.location.replace(CHANGE_PW_PAGE);
    }
    function isPlatformOnlyPath(p) {
        p = String(p || '').toLowerCase();
        return PLATFORM_ONLY_PREFIXES.some(function (x) { return p.indexOf(x) === 0; });
    }

    /* Single exit for every "session is over" case: log it (no tokens), wipe the session AND the stored
       partner-view choice (clear() removes both), leave a one-shot notice for the login page, go to login. */
    function endSession(reason) {
        L('warn', 'session ended', { reason: reason });
        clear();
        try {
            sessionStorage.setItem(NOTICE_KEY, JSON.stringify({
                kind: 'error', reason: reason,
                message: SESSION_MESSAGES[reason] || 'Please sign in again.'
            }));
        } catch (e) { /* storage blocked: the redirect still happens */ }
        goLogin();
    }

    /* ------------------------------------------------------- Super Admin partner view */
    function isSuperAdmin() { var s = get(); return !!s && s.role === 'SUPER_ADMIN'; }

    /** {id, name} of the partner being viewed, or null (also null when it is the Super Admin's own platform). */
    function getViewPartner() {
        if (!isSuperAdmin()) return null;
        try {
            var raw = sessionStorage.getItem(VIEW_KEY);
            var v = raw ? JSON.parse(raw) : null;
            if (!v || v.id == null) return null;
            var own = get().partnerId;
            if (own != null && String(own) === String(v.id)) return null;
            return { id: Number(v.id), name: v.name || '' };
        } catch (e) { return null; }
    }
    function isViewMode() { return !!getViewPartner(); }

    function viewAs(id, name) {
        if (!isSuperAdmin()) return;
        try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ id: Number(id), name: name || '' })); } catch (e) {}
        L('info', 'switched to partner view', { partnerId: id });
        window.location.reload();
    }
    function exitView() {
        try { sessionStorage.removeItem(VIEW_KEY); } catch (e) {}
        L('info', 'left partner view');
        window.location.reload();
    }

    function relPath(path) { return String(path).replace(/^https?:\/\/[^\/]+/i, ''); }

    /** Adds ?viewPartnerId= to a GET/HEAD of OUR backend while in view mode. Never to a write. */
    function withView(path, method) {
        if (method !== 'GET' && method !== 'HEAD') return path;
        var v = getViewPartner();
        if (!v) return path;
        if (/^https?:/i.test(path) && path.indexOf(window.API_BASE) !== 0) return path;   // someone else's server
        var rel = relPath(path);
        if (VIEW_EXEMPT.test(rel) || /[?&]viewPartnerId=/.test(rel)) return path;
        return path + (path.indexOf('?') === -1 ? '?' : '&') + 'viewPartnerId=' + encodeURIComponent(v.id);
    }

    /* ---------------------------------------------------------------- refresh */
    var refreshing = null;
    function refreshTokens() {
        if (refreshing) return refreshing;
        var s = get();
        if (!s || !s.refreshToken) return Promise.reject(new Error('No refresh token'));
        refreshing = xfetch(window.API_BASE + '/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ refreshToken: s.refreshToken })
        }).then(function (res) {
            if (!res.ok) throw new Error('Refresh failed (' + res.status + ')');
            return res.json();
        }).then(function (body) {
            var t = (body && body.data) || body;
            var cur = get();
            cur.token = t.accessToken;
            cur.refreshToken = t.refreshToken;
            cur.expiresAt = t.expiresIn ? Date.now() + t.expiresIn * 1000 : null;
            write(store(), cur);
            return cur.token;
        }).finally(function () { refreshing = null; });
        return refreshing;
    }

    /* ---------------------------------------------------------------- apiFetch */
    function apiFetch(path, options) {
        options = options || {};
        var method = String(options.method || 'GET').toUpperCase();
        var isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

        // View mode is read-only: refuse writes here, before they leave the browser (the server refuses them too).
        if (isViewMode() && method !== 'GET' && method !== 'HEAD' && !VIEW_EXEMPT.test(relPath(path))) {
            L('warn', 'write blocked in partner view mode', { method: method, path: relPath(path).split('?')[0] });
            var blocked = new Error('Read-only view. Go back to your own workspace to make changes.');
            blocked.status = 0; blocked.errorCode = 'VIEW_MODE_READ_ONLY';
            return Promise.reject(blocked);
        }

        var url = options.noView ? path : withView(path, method);
        var init = Object.assign({}, options);
        delete init.noView;

        function send(token) {
            var headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
            if (!isForm && options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (token) headers['Authorization'] = 'Bearer ' + token;
            return xfetch(/^https?:/i.test(url) ? url : window.API_BASE + url,
                Object.assign({}, init, { headers: headers }));
        }

        var s = get();
        return send(s && s.token).then(function (res) {
            if (res.status !== 401 && res.status !== 403) return res;
            return res.clone().json().catch(function () { return {}; }).then(function (body) {
                var code = body && body.errorCode;
                if (res.status === 403) {
                    if (code === 'PASSWORD_CHANGE_REQUIRED') { goChangePassword(); return res; }
                    if (DEAD_SESSION_CODES.indexOf(code) !== -1) endSession(code);   // deactivated while logged in
                    return res;                                                      // plain FORBIDDEN: caller handles it
                }
                if (code && code !== 'TOKEN_EXPIRED') { endSession(code); return res; }
                return refreshTokens().then(send, function () { endSession('SESSION_EXPIRED'); return res; });
            });
        });
    }

    function toError(res, json) {
        var first = json && json.errors && json.errors[0] && json.errors[0].message;
        var err = new Error((json && json.message) || first || ('Request failed (' + res.status + ')'));
        err.status = res.status; err.errorCode = json && json.errorCode; err.errors = json && json.errors;
        err.requestId = (res.headers && res.headers.get('X-Request-Id')) || (json && json.requestId) || null;
        return err;
    }

    function jsonCall(method) {
        return function (path, body) {
            var opts = { method: method };
            if (body !== undefined) opts.body = JSON.stringify(body);
            return apiFetch(path, opts).then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (json) {
                    if (!res.ok || json.success === false) throw toError(res, json);
                    return json.data !== undefined ? json.data : json;
                });
            });
        };
    }
    var api = { get: jsonCall('GET'), post: jsonCall('POST'), put: jsonCall('PUT'),
                patch: jsonCall('PATCH'), delete: jsonCall('DELETE') };

    /* Session.api(path, { method, body }): body may be an object (sent as JSON) or FormData.
       Resolves with the whole JSON envelope ({ success, message, data }) - callers read res.data. */
    function sessionApi(path, options) {
        options = Object.assign({}, options || {});
        var b = options.body;
        var isForm = typeof FormData !== 'undefined' && b instanceof FormData;
        var isBlob = typeof Blob !== 'undefined' && b instanceof Blob;
        if (b != null && typeof b === 'object' && !isForm && !isBlob) options.body = JSON.stringify(b);
        return apiFetch(path, options).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (json) {
                if (!res.ok || json.success === false) throw toError(res, json);
                return json;
            });
        });
    }

    /* Clears the session FIRST (so the login page cannot bounce back to the dashboard),
       then tells the server to revoke the refresh token in the background. */
    function logout() {
        var s = get();
        var rt = s && s.refreshToken, tok = s && s.token;
        L('info', 'logout');
        clear();
        if (rt) {
            try {
                xfetch(window.API_BASE + '/api/auth/logout', {
                    method: 'POST', keepalive: true,
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
                               'Authorization': 'Bearer ' + tok },
                    body: JSON.stringify({ refreshToken: rt })
                }).catch(function () {});
            } catch (e) { /* ignore */ }
        }
        goLogin();
    }

    function getUser() {
        var s = get();
        if (!s) return null;
        return { id: s.userId, name: s.name, email: s.email, role: s.role, roleName: s.roleName,
                 photoUrl: s.photoUrl, partnerId: s.partnerId, partnerName: s.partnerName };
    }

    var Session = {
        save: save, get: get, clear: clear,
        token: function () { var s = get(); return s && s.token; },
        has: has, can: can, logout: logout, endSession: endSession,
        api: sessionApi, authFetch: apiFetch,
        getSession: get, getUser: getUser,
        getRole: function () { var s = get(); return s ? s.role : null; },
        isSuperAdmin: isSuperAdmin, isViewMode: isViewMode, getViewPartner: getViewPartner,
        viewAs: viewAs, exitView: exitView
    };
    Object.defineProperty(Session, 'user', { get: getUser, enumerable: true });

    window.Session = Session;
    window.apiFetch = apiFetch;
    window.api = api;

    // Read-only globals every page script relies on.
    Object.defineProperty(window, 'currentUserRole', {
        get: function () { var s = get(); return s ? s.role : null; }, configurable: true });
    Object.defineProperty(window, 'currentUserPartnerName', {
        get: function () { var s = get(); return (s && s.partnerName) || ''; }, configurable: true });

    var me = document.currentScript;
    var isPublic = me && me.getAttribute('data-public') === 'true';
    if (isPublic) return;                                          // login page: nothing else to do

    // Guard: protected pages need a session.
    if (!(get() && get().token)) { goLogin(); return; }

    // First login / admin reset: nothing else works until the password is changed (the server enforces it too).
    if (get().mustChangePassword && location.pathname !== CHANGE_PW_PAGE) {
        window.location.replace(CHANGE_PW_PAGE);
        return;
    }

    // Platform-only pages (channel partners, audit log) are for Super Admin only.
    if (get().role !== 'SUPER_ADMIN' && isPlatformOnlyPath(location.pathname)) {
        goHome();
        return;
    }

    /* ======================================================================== UI */
    var NS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    var ICONS = {
        dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect>',
        quotation: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
        product: '<circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line><line x1="2" y1="12" x2="4.5" y2="12"></line><line x1="19.5" y1="12" x2="22" y2="12"></line><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"></line><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"></line><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"></line><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"></line>',
        customer: '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><circle cx="9" cy="11" r="3"></circle><path d="M3 18.5c1.5-2.5 4-4 7-4s5.5 1.5 7 4"></path><path d="M16 9l2 2 4-4"></path>',
        reports: '<line x1="5" y1="21" x2="5" y2="11"></line><line x1="12" y1="21" x2="12" y2="6"></line><line x1="19" y1="21" x2="19" y2="14"></line><line x1="3" y1="21" x2="21" y2="21"></line>',
        project: '<path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
        user_management: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
        channel_partner: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
        calculator: '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="8.01" y2="10"></line><line x1="12" y1="10" x2="12.01" y2="10"></line><line x1="16" y1="10" x2="16.01" y2="10"></line><line x1="8" y1="14" x2="8.01" y2="14"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="16" y1="14" x2="16.01" y2="14"></line><line x1="8" y1="18" x2="16" y2="18"></line>',
        approval: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
        audit: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="9" y1="10" x2="15" y2="10"></line><line x1="9" y1="14" x2="15" y2="14"></line>',
        settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
        _default: '<circle cx="12" cy="12" r="9"></circle>'
    };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function safePath(p) { return typeof p === 'string' && /^\/(?!\/)/.test(p) ? p : null; }
    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
    }

    function buildSidebar() {
        var nav = document.getElementById('sidebarNav');
        var s = get();
        if (!nav || !s) return;
        var active = nav.getAttribute('data-active') || '';
        var here = location.pathname.toLowerCase();
        var html = (s.modules || []).filter(function (m) { return safePath(m.path); }).map(function (m) {
            var p = safePath(m.path);
            var isActive = m.key === active || (!active && here === p.toLowerCase());
            return '<a class="nav-item' + (isActive ? ' active' : '') + '" href="' + esc(p) + '" id="menu-' + esc(m.key) +
                '" data-module="' + esc(m.key) + '" data-label="' + esc(m.label) + '" aria-label="' + esc(m.label) +
                '"' + (isActive ? ' aria-current="page"' : '') + ' style="text-decoration:none;">' +
                '<svg ' + NS + '>' + (ICONS[m.key] || ICONS._default) + '</svg><span>' + esc(m.label) + '</span></a>';
        }).join('');
        nav.innerHTML = html;
    }

    function prettyRole(code) {
        return String(code || '').toLowerCase().split('_').map(function (w) {
            return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
        }).join(' ');
    }

    function applyRoleBasedVisibility() {
        var role = window.currentUserRole;
        var els = document.querySelectorAll('[data-role]');
        for (var i = 0; i < els.length; i++) {
            var roles = els[i].getAttribute('data-role').split(',').map(function (r) { return r.trim(); });
            els[i].style.display = roles.indexOf(role) !== -1 ? '' : 'none';
        }
    }

    function applyProfileRoleLabel() {
        var s = get();
        if (!s) return;
        var roleEl = document.getElementById('profileRoleLabel');
        if (roleEl) roleEl.textContent = 'Logged in as: ' + (s.roleName || prettyRole(s.role));
        var pEl = document.getElementById('profilePartnerLabel');
        if (pEl) {
            var show = s.role !== 'SUPER_ADMIN' && !!s.partnerName;
            pEl.textContent = show ? s.partnerName : '';
            pEl.classList.toggle('hidden', !show);
        }
        var name = s.name || (s.email ? s.email.split('@')[0] : '');
        var g = document.getElementById('greetingName'); if (g && name) g.textContent = name;
        var i = document.getElementById('profileInitial'); if (i && name) i.textContent = name.charAt(0).toUpperCase();
    }

    function wireLogout() {
        var btn = document.getElementById('profileLogoutBtn');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopImmediatePropagation();
            logout();
        }, true);
    }

    /* ---------------------------------------------- partner view: banner, hidden write buttons, selector */
    function ensureViewStyles() {
        if (document.getElementById('viewModeStyles')) return;
        var st = document.createElement('style');
        st.id = 'viewModeStyles';
        st.textContent =
            'html.view-mode [data-write]{display:none!important}' +
            '#viewModeBanner{position:sticky;top:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
            'gap:12px;flex-wrap:wrap;padding:8px 14px;background:#541A1A;color:#fff;font:600 13px/1.3 Poppins,Arial,sans-serif}' +
            '#viewModeBanner button{background:#F7ECE1;color:#541A1A;border:none;border-radius:999px;padding:4px 12px;' +
            'font-weight:700;font-size:12px;cursor:pointer}' +
            '#partnerViewSelect{max-width:200px;font-size:12px;padding:5px 8px;border-radius:8px;border:1px solid #DCC3AA;' +
            'background:#fff;color:#1F2937;margin-right:8px}';
        (document.head || document.documentElement).appendChild(st);
    }

    function applyViewMode() {
        ensureViewStyles();
        var v = getViewPartner();
        document.documentElement.classList.toggle('view-mode', !!v);
        var bar = document.getElementById('viewModeBanner');
        if (!v) { if (bar) bar.remove(); return; }
        if (bar || !document.body) return;
        bar = document.createElement('div');
        bar.id = 'viewModeBanner';
        bar.setAttribute('role', 'status');
        var text = document.createElement('span');
        text.textContent = 'Viewing partner: ' + (v.name || ('#' + v.id)) + ' \u2014 read-only';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Back to my workspace';
        btn.addEventListener('click', exitView);
        bar.appendChild(text); bar.appendChild(btn);
        document.body.insertBefore(bar, document.body.firstChild);
    }

    function buildPartnerSelector() {
        if (!isSuperAdmin()) return;
        var sel = document.getElementById('partnerViewSelect');
        if (!sel) {
            var anchor = document.getElementById('notifBtn');
            if (!anchor || !anchor.parentNode) return;
            sel = document.createElement('select');
            sel.id = 'partnerViewSelect';
            anchor.parentNode.insertBefore(sel, anchor);
        }
        if (sel.getAttribute('data-ready')) return;
        sel.setAttribute('data-ready', '1');
        sel.setAttribute('aria-label', 'View a partner workspace (read-only)');

        var v = getViewPartner();
        function opt(value, label) {
            var o = document.createElement('option'); o.value = value; o.textContent = label; return o;
        }
        sel.appendChild(opt('', 'My workspace (Platform)'));
        if (v) sel.appendChild(opt(String(v.id), v.name || ('Partner #' + v.id)));
        sel.value = v ? String(v.id) : '';

        sessionApi(PARTNER_OPTIONS_URL, { noView: true }).then(function (res) {
            var list = res && res.data;
            list = Array.isArray(list) ? list : ((list && list.content) || []);
            list.forEach(function (p) {
                if (!p || p.id == null || (v && String(p.id) === String(v.id))) return;
                sel.appendChild(opt(String(p.id), (p.name || ('Partner #' + p.id)) + (p.code ? ' (' + p.code + ')' : '')));
            });
            sel.value = v ? String(v.id) : '';
        }).catch(function (e) {
            L('warn', 'could not load partner list', { status: e && e.status, requestId: e && e.requestId });
        });

        sel.addEventListener('change', function () {
            if (!sel.value) exitView();
            else viewAs(sel.value, sel.options[sel.selectedIndex].textContent.replace(/\s*\([^)]*\)\s*$/, ''));
        });
    }

    // Keep the stored role/modules/permissions in step with the server (role changes show without a new login).
    // The sidebar is built from GET /api/me/access, which only returns what the user's role allows.
    // A deactivated account / partner / role or a revoked token ends the session inside apiFetch (endSession).
    function refreshFromServer() {
        api.get('/api/me/access').then(function (acc) {
            var cur = get();
            if (!cur || !acc || !acc.modules) return;
            var fresh = normModules(acc.modules);
            var changed = JSON.stringify(fresh) !== JSON.stringify(cur.modules) ||
                          (!!acc.roleCode && acc.roleCode !== cur.role);
            if (!changed) return;
            cur.modules = fresh;
            if (acc.permissions) cur.permissions = acc.permissions;
            if (acc.roleCode) cur.role = acc.roleCode;
            write(store(), cur);
            buildSidebar();
            // the role no longer allows this page: leave it
            if (cur.role !== 'SUPER_ADMIN' && isPlatformOnlyPath(location.pathname)) goHome();
        }).catch(function () { /* offline / expired: keep what we have */ });
    }

    window.applyRoleBasedMenu = buildSidebar;
    window.applyProfileRoleLabel = applyProfileRoleLabel;
    window.applyRoleBasedVisibility = applyRoleBasedVisibility;

    function paint() {
        buildSidebar();
        applyRoleBasedVisibility();
        applyProfileRoleLabel();
        applyViewMode();
        buildPartnerSelector();
    }

    // session.js sits at the end of <body>, so the markup above it already exists: paint NOW, before the
    // page's own script runs (it attaches click handlers to the nav items). Repeat once the DOM is complete
    // in case the script was placed in <head>.
    paint();
    wireLogout();
    document.addEventListener('DOMContentLoaded', function () { paint(); refreshFromServer(); });
    if (document.readyState !== 'loading') refreshFromServer();
})();