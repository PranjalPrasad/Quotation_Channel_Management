// ============================================================
// session.js  (project root, served as /session.js)
//
// SINGLE SOURCE OF TRUTH for auth/session on the whole frontend.
//
//   sessionStorage["sqms_session"] = {
//     token, role, userId, name, email, partnerId, partnerName,
//     modules: [ { key, label, path }, ... ],   // from the login response
//     loginAt
//   }
//
// The old, scattered keys are gone and are wiped on every page load:
//   sessionStorage.token, sessionStorage.session,
//   localStorage.session, localStorage.adminRole (+ isLoggedIn/adminName/
//   adminEmail/adminId).  Nothing else may read or write them.
//
// Include this file BEFORE each module's own JS:
//   <script src="/session.js"></script>
//   <script src="/dashboard/dashboard.js"></script>
// On the login page include it with data-public="true" so the
// "must be logged in" guard is skipped:
//   <script src="/session.js" data-public="true"></script>
//
// What this file does:
//   1. Session.save / get / clear / logout        (one session, one key)
//   2. Session.requireAuth()                      (no session -> login page;
//                                                  there is NO SUPER_ADMIN fallback)
//   3. Session.renderSidebar()                    (sidebar is generated from
//                                                  session.modules, not copy-pasted)
//   4. Session.api() / authFetch()                (fetch + Bearer token + 401 handling)
//   5. window.currentUserRole / currentUserPartnerName (read-only, from session)
//   6. applyRoleBasedMenu() / applyProfileRoleLabel() for in-page [data-role] bits
// ============================================================

(function (global) {
  "use strict";

  const SESSION_KEY = "sqms_session";
  const LOGIN_PAGE = "/index.html";

  const thisScript = document.currentScript;
  const IS_PUBLIC_PAGE = !!(thisScript && thisScript.dataset && thisScript.dataset.public === "true");

  // ------------------------------------------------------------
  // Legacy keys — removed so there is only one session left.
  // ------------------------------------------------------------
  function purgeLegacyKeys() {
    try {
      ["token", "session"].forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* storage blocked */ }
    try {
      ["session", "adminRole", "isLoggedIn", "adminName", "adminEmail", "adminId"].forEach((k) =>
        localStorage.removeItem(k)
      );
    } catch (e) { /* storage blocked */ }
  }
  purgeLegacyKeys();

  // ------------------------------------------------------------
  // Module catalog: default label / path / icon per module key.
  // The login response only has to send the keys it allows
  // (["dashboard","quotation",...]) or full objects
  // ({ key, label, path }); anything the backend sends wins.
  // ------------------------------------------------------------
  const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  const ICONS = {
    dashboard: SVG_OPEN + '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>',
    quotation: SVG_OPEN + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h1"></path><path d="M9.5 12.5c0-.83.67-1.5 1.5-1.5h.5a1.5 1.5 0 0 1 0 3H11a1.5 1.5 0 0 0 0 3h.5a1.5 1.5 0 0 0 1.5-1.5"></path><line x1="11" y1="10" x2="11" y2="10.7"></line><line x1="11" y1="17.3" x2="11" y2="18"></line></svg>',
    product: SVG_OPEN + '<circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line><line x1="2" y1="12" x2="4.5" y2="12"></line><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"></line><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"></line><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"></line><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"></line></svg>',
    customer: SVG_OPEN + '<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><circle cx="9" cy="11" r="3"></circle><path d="M3 18.5c1.5-2.5 4-4 7-4s5.5 1.5 7 4"></path><path d="M16 9l2 2 4-4"></path></svg>',
    reports: SVG_OPEN + '<line x1="5" y1="21" x2="5" y2="11"></line><line x1="12" y1="21" x2="12" y2="6"></line><line x1="19" y1="21" x2="19" y2="14"></line><line x1="3" y1="21" x2="21" y2="21"></line></svg>',
    project: SVG_OPEN + '<path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    channel_partner: SVG_OPEN + '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    user_management: SVG_OPEN + '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    calculator: SVG_OPEN + '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="8.01" y2="10"></line><line x1="12" y1="10" x2="12.01" y2="10"></line><line x1="16" y1="10" x2="16.01" y2="10"></line><line x1="8" y1="14" x2="8.01" y2="14"></line><line x1="12" y1="14" x2="12.01" y2="14"></line><line x1="16" y1="14" x2="16.01" y2="14"></line><line x1="8" y1="18" x2="8.01" y2="18"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="16" y1="18" x2="16.01" y2="18"></line></svg>',
    approval: SVG_OPEN + '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
    referral: SVG_OPEN + '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 8l-3.5 3.5L17 10"></path><path d="M16 4.5a4 4 0 0 1 1.5 7.7"></path></svg>',
    settings: SVG_OPEN + '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    _default: SVG_OPEN + '<circle cx="12" cy="12" r="9"></circle></svg>',
  };

  const MODULE_CATALOG = {
    dashboard:       { label: "Dashboard",             path: "/dashboard/dashboard.html" },
    quotation:       { label: "Quotation Management",  path: "/Quotation/quotation.html" },
    product:         { label: "Product Management",    path: "/productM/productm.html" },
    customer:        { label: "Customer Management",   path: "/customer/customer.html" },
    reports:         { label: "Reports Management",    path: "/reports/reports.html" },
    project:         { label: "Project Management",    path: "/project/project.html" },
    channel_partner: { label: "Channel Partners",      path: "/channel-partner/channel.html" },
    user_management: { label: "User Management",       path: "/user-management/user.html" },
    calculator:      { label: "Cost Calculator",       path: "/calc/calc.html" },
    approval:        { label: "Approval Management",   path: "/approval/approval.html" },
    settings:        { label: "Settings",              path: "/settings/settings.html" },
  };

  // Only same-origin absolute paths are allowed as sidebar links.
  function safePath(p) {
    return typeof p === "string" && /^\/(?!\/)[^\s]*$/.test(p) ? p : null;
  }

  // Accepts ["dashboard", ...] or [{ key, label, path }, ...]
  function normalizeModules(input) {
    if (!Array.isArray(input)) return [];
    const seen = new Set();
    const out = [];
    input.forEach((m) => {
      const raw = typeof m === "string" ? { key: m } : m;
      if (!raw || typeof raw.key !== "string") return;
      const key = raw.key.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      const def = MODULE_CATALOG[key] || {};
      const path = safePath(raw.path) || def.path;
      if (!path) return; // unknown module with no usable path -> skip
      seen.add(key);
      out.push({
        key,
        label: String(raw.label || def.label || key),
        path,
      });
    });
    return out;
  }

  // ------------------------------------------------------------
  // Session store (sessionStorage.sqms_session only)
  // ------------------------------------------------------------
  function readRaw() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error("session.js: failed to read session", err);
      return null;
    }
  }

  function jwtExpired(token) {
    try {
      const parts = String(token).split(".");
      if (parts.length !== 3) return false; // not a JWT -> let the server decide
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
    } catch (e) {
      return false;
    }
  }

  /** Returns the full session object, or null when not logged in / expired. */
  function getSession() {
    const s = readRaw();
    if (!s || !s.token || !s.role) return null;
    if (jwtExpired(s.token)) {
      clearSession();
      return null;
    }
    return s;
  }

  /**
   * Called once by the login page with the backend login response:
   *   { token, role, userId, name, email, partnerId, partnerName, modules }
   */
  function saveSession(resp) {
    if (!resp || !resp.token || !resp.role) {
      throw new Error("Login response must contain token and role");
    }
    const session = {
      token: resp.token,
      role: resp.role,
      userId: resp.userId || null,
      name: resp.name || null,
      email: resp.email || null,
      partnerId: resp.partnerId || null,
      partnerName: resp.partnerName || null,
      modules: normalizeModules(resp.modules),
      loginAt: Date.now(),
    };
    purgeLegacyKeys();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    purgeLegacyKeys();
  }

  function logout() {
    clearSession();
    global.location.href = LOGIN_PAGE;
  }

  /** { token, role, userId, name, email, partnerId, partnerName } or null */
  function getCurrentUser() {
    const s = getSession();
    if (!s) return null;
    return {
      token: s.token,
      role: s.role,
      userId: s.userId || null,
      name: s.name || null,
      email: s.email || null,
      partnerId: s.partnerId || null,
      partnerName: s.partnerName || null,
    };
  }
  function getToken() { const s = getSession(); return s ? s.token : null; }
  function getRole() { const s = getSession(); return s ? s.role : null; }
  function getModules() { const s = getSession(); return s ? s.modules || [] : []; }

  // ------------------------------------------------------------
  // Guard: no session -> login. NO default role is ever assumed.
  // ------------------------------------------------------------
  function requireAuth() {
    if (getSession()) return true;
    global.location.replace(LOGIN_PAGE);
    return false;
  }

  // ------------------------------------------------------------
  // API helper — Bearer token + 401 handling.
  // Set window.API_BASE = "http://localhost:8080" if the backend runs
  // on a different origin.
  // ------------------------------------------------------------
  function apiBase() { return global.API_BASE || ""; }

  async function authFetch(path, options) {
    const opts = Object.assign({}, options || {});
    const headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    if (opts.body !== undefined && opts.body !== null && typeof opts.body === "object" &&
        !(opts.body instanceof FormData) && !(opts.body instanceof Blob)) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    opts.headers = headers;
    const res = await fetch(/^https?:\/\//i.test(path) ? path : apiBase() + path, opts);
    if (res.status === 401) {
      logout();
      throw Object.assign(new Error("Session expired. Please log in again."), { status: 401 });
    }
    return res;
  }

  /** authFetch + JSON parse + throws Error(message) on non-2xx. */
  async function api(path, options) {
    const res = await authFetch(path, options);
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || ("Request failed (" + res.status + ")");
      throw Object.assign(new Error(msg), { status: res.status, data });
    }
    return data;
  }

  // ------------------------------------------------------------
  // Sidebar — generated from session.modules.
  // Pages only contain:  <nav id="sidebarNav" class="nav-list ..." data-active="quotation"></nav>
  // ------------------------------------------------------------
  function injectSidebarStyles() {
    if (document.getElementById("sqmsSidebarStyles")) return;
    const st = document.createElement("style");
    st.id = "sqmsSidebarStyles";
    st.textContent = ".nav-list a.nav-item{text-decoration:none;}";
    document.head.appendChild(st);
  }

  function renderSidebar() {
    const nav = document.getElementById("sidebarNav");
    if (!nav || nav.getAttribute("data-rendered") === "1") return; // already built; keep bound listeners
    const session = getSession();
    if (!session) return;
    const modules = session.modules || [];
    const activeKey = (nav.getAttribute("data-active") || "").toLowerCase();

    injectSidebarStyles();
    nav.textContent = "";
    modules.forEach((m) => {
      const a = document.createElement("a");
      a.className = "nav-item" + (m.key === activeKey ? " active" : "");
      a.href = m.path;
      a.id = "menu_" + m.key;
      a.setAttribute("data-label", m.label);
      a.setAttribute("aria-label", m.label);
      if (m.key === activeKey) a.setAttribute("aria-current", "page");
      a.innerHTML = ICONS[m.key] || ICONS._default;
      const span = document.createElement("span");
      span.textContent = m.label;
      a.appendChild(span);
      nav.appendChild(a);
    });
    nav.setAttribute("data-rendered", "1");
  }

  /**
   * If the page declares its module (nav data-active) and the user's
   * modules array does not contain it, send them to a page they may open.
   */
  function enforceModuleAccess() {
    const nav = document.getElementById("sidebarNav");
    if (!nav) return true;
    const key = (nav.getAttribute("data-active") || "").toLowerCase();
    if (!key) return true;
    const modules = getModules();
    if (modules.some((m) => m.key === key)) return true;
    const target = modules.length ? modules[0].path : LOGIN_PAGE;
    global.location.replace(target);
    return false;
  }

  // ------------------------------------------------------------
  // In-page [data-role] elements (non-sidebar). Fail-CLOSED:
  // requireAuth() has already sent anonymous users to the login page.
  // ------------------------------------------------------------
  function applyRoleBasedMenu(root) {
    const role = getRole();
    (root || document).querySelectorAll("[data-role]").forEach((el) => {
      const allowed = el.getAttribute("data-role").split(",").map((r) => r.trim()).filter(Boolean);
      el.style.display = role && allowed.includes(role) ? "" : "none";
    });
  }

  function applyProfileRoleLabel() {
    const user = getCurrentUser();
    if (!user) return;
    const roleLabelEl = document.getElementById("profileRoleLabel");
    const partnerLabelEl = document.getElementById("profilePartnerLabel");
    if (roleLabelEl) roleLabelEl.textContent = "Logged in as: " + (user.role || "-");
    if (partnerLabelEl) {
      if ((user.role || "").startsWith("CHANNEL_PARTNER") && user.partnerName) {
        partnerLabelEl.textContent = user.partnerName;
        partnerLabelEl.classList.remove("hidden");
      } else {
        partnerLabelEl.classList.add("hidden");
      }
    }
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  const Session = {
    KEY: SESSION_KEY,
    save: saveSession,
    get: getSession,
    clear: clearSession,
    logout,
    requireAuth,
    getUser: getCurrentUser,
    getToken,
    getRole,
    getModules,
    renderSidebar,
    api,
    authFetch,
  };
  global.Session = Session;
  global.getCurrentUser = getCurrentUser;
  global.applyRoleBasedMenu = applyRoleBasedMenu;
  global.applyProfileRoleLabel = applyProfileRoleLabel;
  global.authFetch = authFetch;
  global.logout = logout;

  if (IS_PUBLIC_PAGE) return; // login page: expose helpers only

  // Read-only globals for module scripts (replaces the old
  // `window.currentUserRole = window.currentUserRole || 'SUPER_ADMIN'` lines).
  Object.defineProperty(global, "currentUserRole", {
    configurable: false,
    get: function () { return getRole(); },
  });
  Object.defineProperty(global, "currentUserPartnerName", {
    configurable: false,
    get: function () { const u = getCurrentUser(); return u ? u.partnerName : null; },
  });
  Object.defineProperty(global, "currentUserPartnerId", {
    configurable: false,
    get: function () { const u = getCurrentUser(); return u ? u.partnerId : null; },
  });

  if (!requireAuth()) return;       // redirecting to login
  if (!enforceModuleAccess()) return; // redirecting to an allowed page

  // Scripts sit at the end of <body>, so the nav already exists and the
  // sidebar can be built right now — before the module JS binds its
  // click handlers to `.nav-list .nav-item`.
  renderSidebar();

  function initSessionUI() {
    renderSidebar(); // no-op if already built at boot
    applyRoleBasedMenu();
    applyProfileRoleLabel();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSessionUI);
  } else {
    initSessionUI();
  }

  // Every page's Logout button goes through Session.logout(); capture phase so
  // it runs before the module's own (toast-only / redirect-only) handlers.
  document.addEventListener("click", function (e) {
    const btn = e.target.closest && e.target.closest("#profileLogoutBtn");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    logout();
  }, true);
})(window);