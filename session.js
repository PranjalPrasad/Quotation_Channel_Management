/* ============================================================================
 * session.js  -  Solar CRM frontend <-> Spring Boot backend (port 8091)
 *
 * Load it with a plain <script src="/session.js"></script> at the END of <body> on every page.
 * On a protected page it redirects to /index.html (login) when there is no session.
 * On the login page use:  <script src="/session.js" data-public="true"></script>
 *
 * What it does for every protected page
 *   1. Draws the sidebar into <nav id="sidebarNav" data-active="<moduleKey>"> from the modules
 *      the backend returned at login (and refreshes them from /api/auth/me).
 *   2. Defines window.currentUserRole / window.currentUserPartnerName (read-only globals).
 *   3. Runs applyRoleBasedVisibility() ([data-role] elements) and applyProfileRoleLabel().
 *   4. Wires #profileLogoutBtn to a logout that really clears the session first.
 *
 * Public API
 *   API_BASE, Session.save/get/clear/token/has/can/logout
 *   Session.api(path, {method, body})  -> parsed JSON envelope { success, message, data }, throws on error
 *   Session.authFetch(path, options)   -> raw fetch Response (Bearer token + automatic refresh)
 *   Session.getRole() / getUser() / getSession() / Session.user
 *   apiFetch(path, options), api.get/post/put/patch/delete (return body.data)
 * ========================================================================== */
(function () {
    'use strict';

    var BACKEND_PORT = 8091;
    var LOGIN_PAGE = '/index.html';          // the login page of this frontend (was /login.html, which does not exist)
    var KEY = 'sqms_session';

    var host = (location.protocol === 'file:' || !location.hostname) ? 'localhost' : location.hostname;
    var proto = location.protocol === 'https:' ? 'https:' : 'http:';
    window.API_BASE = window.API_BASE || (proto + '//' + host + ':' + BACKEND_PORT);

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
            if (typeof m === 'string') return { key: m, label: m, path: null, actions: [] };
            var code = m.code ? String(m.code).toLowerCase() : null;
            return {
                key: m.key || (code === 'user' ? 'user_management' : code),
                label: m.label || m.name || m.key,
                path: m.path || m.route || null,
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

    function clear() {
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        try { localStorage.removeItem(KEY); } catch (e) {}
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

    /* ---------------------------------------------------------------- refresh */
    var refreshing = null;
    function refreshTokens() {
        if (refreshing) return refreshing;
        var s = get();
        if (!s || !s.refreshToken) return Promise.reject(new Error('No refresh token'));
        refreshing = fetch(window.API_BASE + '/api/auth/refresh', {
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
        var isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

        function send(token) {
            var headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
            if (!isForm && options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (token) headers['Authorization'] = 'Bearer ' + token;
            return fetch(/^https?:/i.test(path) ? path : window.API_BASE + path,
                Object.assign({}, options, { headers: headers }));
        }

        var s = get();
        return send(s && s.token).then(function (res) {
            if (res.status !== 401) return res;
            return res.clone().json().catch(function () { return {}; }).then(function (body) {
                if (body && body.errorCode && body.errorCode !== 'TOKEN_EXPIRED') {
                    clear(); goLogin(); return res;
                }
                return refreshTokens().then(send, function () { clear(); goLogin(); return res; });
            });
        });
    }

    function toError(res, json) {
        var first = json && json.errors && json.errors[0] && json.errors[0].message;
        var err = new Error((json && json.message) || first || ('Request failed (' + res.status + ')'));
        err.status = res.status; err.errorCode = json && json.errorCode; err.errors = json && json.errors;
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
        clear();
        if (rt) {
            try {
                fetch(window.API_BASE + '/api/auth/logout', {
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
        has: has, can: can, logout: logout,
        api: sessionApi, authFetch: apiFetch,
        getSession: get, getUser: getUser,
        getRole: function () { var s = get(); return s ? s.role : null; }
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

    // Keep the stored modules/permissions in step with the server (role changes show without a new login).
    function refreshFromServer() {
        api.get('/api/auth/me').then(function (me) {
            var cur = get();
            if (!cur || !me || !me.modules) return;
            var fresh = normModules(me.modules);
            if (JSON.stringify(fresh) !== JSON.stringify(cur.modules)) {
                cur.modules = fresh;
                if (me.permissions) cur.permissions = me.permissions;
                write(store(), cur);
                buildSidebar();
            }
        }).catch(function () { /* offline / expired: keep what we have */ });
    }

    window.applyRoleBasedMenu = buildSidebar;
    window.applyProfileRoleLabel = applyProfileRoleLabel;
    window.applyRoleBasedVisibility = applyRoleBasedVisibility;

    function paint() {
        buildSidebar();
        applyRoleBasedVisibility();
        applyProfileRoleLabel();
    }

    // session.js sits at the end of <body>, so the markup above it already exists: paint NOW, before the
    // page's own script runs (it attaches click handlers to the nav items). Repeat once the DOM is complete
    // in case the script was placed in <head>.
    paint();
    wireLogout();
    document.addEventListener('DOMContentLoaded', function () { paint(); refreshFromServer(); });
    if (document.readyState !== 'loading') refreshFromServer();
})();