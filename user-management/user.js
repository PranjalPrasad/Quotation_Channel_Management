// ============================================================
// User Management — integrated with the Spring Boot backend
//
// Endpoints used
//   GET    /api/auth/me                       logged-in user, permissions
//   GET    /api/users                         paged list (page, size, sort, search, roleCode, status, partnerId)
//   GET    /api/users/summary                 KPI cards
//   GET    /api/users/role-options            roles the caller may assign
//   POST   /api/users                         create
//   PUT    /api/users/{id}                    update
//   PATCH  /api/users/{id}/status             activate / deactivate
//   POST   /api/users/{id}/reset-password     reset password
//   DELETE /api/users/{id}                    delete
//   GET    /api/channel-partners/options      partner dropdown (Super Admin only)
//   POST   /api/files/upload                  profile photo (purpose=USER_PHOTO)
//   GET    /api/roles + /api/roles/permission-matrix   Roles & Permissions cards (Super Admin only)
// ============================================================

// ---------------- Configuration (adjust to your project) ----------------
const API_BASE = window.API_BASE || 'http://localhost:8091';   // session.js also sets window.API_BASE   // backend server.port=8091
const LOGIN_URL = '/index.html';                         // where to go when the session is gone
// session.js is not part of the zip, so these are the localStorage/sessionStorage keys we look at.
// If your login page stores the token under another key, add it here.
const TOKEN_KEYS = ['accessToken', 'token', 'sqms_token', 'authToken'];
const REFRESH_KEYS = ['refreshToken', 'sqms_refresh_token'];

// ============================================================
// Sidebar collapse / expand
// ============================================================
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
let expanded = false;

function setSidebarExpanded(next) {
  expanded = next;
  sidebar.classList.toggle('expanded', expanded);
  sidebar.classList.toggle('collapsed', !expanded);
  toggleIcon.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
  if (window.innerWidth <= 1023 && sidebarBackdrop) {
    sidebarBackdrop.classList.toggle('visible', expanded);
    sidebarBackdrop.classList.toggle('hidden', !expanded);
  }
}
sidebarToggle?.addEventListener('click', () => setSidebarExpanded(!expanded));
sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));
window.addEventListener('resize', () => {
  if (window.innerWidth > 1023 && sidebarBackdrop) {
    sidebarBackdrop.classList.remove('visible');
    sidebarBackdrop.classList.add('hidden');
  }
});

// ============================================================
// Topbar dropdowns
// ============================================================
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');

function closeAllTopbarDropdowns(except) {
  [notifDropdown, profileDropdown].forEach((dd) => {
    if (dd && dd !== except) dd.classList.add('hidden');
  });
}
notifBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = notifDropdown.classList.contains('hidden');
  closeAllTopbarDropdowns();
  notifDropdown.classList.toggle('hidden', !willOpen);
});
profileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = profileDropdown.classList.contains('hidden');
  closeAllTopbarDropdowns();
  profileDropdown.classList.toggle('hidden', !willOpen);
});
document.addEventListener('click', () => closeAllTopbarDropdowns());

// ============================================================
// Helpers
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : 'bg-gray-800';
  toast.className = `toast-animate ${bg} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), type === 'error' ? 4500 : 2500);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?';
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function fileUrl(path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : API_BASE + path;
}

// ============================================================
// Auth storage + API client
// ============================================================
const JWT_RE = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const ACCESS_FIELDS = ['accessToken', 'access_token', 'token', 'jwt'];
const REFRESH_FIELDS = ['refreshToken', 'refresh_token'];

/** Looks for one of `names` inside a parsed JSON value (up to 3 levels deep). Returns { value, path } or null. */
function findField(obj, names, path = []) {
  if (!obj || typeof obj !== 'object' || path.length > 3) return null;
  for (const n of names) {
    if (typeof obj[n] === 'string' && obj[n]) return { value: obj[n], path: [...path, n] };
  }
  for (const [k, v] of Object.entries(obj)) {
    const hit = findField(v, names, [...path, k]);
    if (hit) return hit;
  }
  return null;
}

const Auth = {
  /** 1) the well-known keys, 2) any JWT / JSON session object found in local or session storage. */
  locate(kind) {
    const knownKeys = kind === 'access' ? TOKEN_KEYS : REFRESH_KEYS;
    const fields = kind === 'access' ? ACCESS_FIELDS : REFRESH_FIELDS;

    for (const store of [localStorage, sessionStorage]) {
      for (const key of knownKeys) {
        const raw = store.getItem(key);
        if (raw) return { store, key, value: raw.replace(/^"|"$/g, ''), path: null };
      }
    }
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        const raw = store.getItem(key);
        if (!raw) continue;
        const looksRefresh = key.toLowerCase().includes('refresh');
        if (raw.trim().startsWith('{')) {
          try {
            const hit = findField(JSON.parse(raw), fields);
            if (hit) return { store, key, value: hit.value, path: hit.path };
          } catch { /* not JSON */ }
          continue;
        }
        const plain = raw.replace(/^"|"$/g, '');
        if (kind === 'refresh' && looksRefresh) return { store, key, value: plain, path: null };
        if (kind === 'access' && !looksRefresh && JWT_RE.test(plain)) return { store, key, value: plain, path: null };
      }
    }
    return null;
  },
  /** Writes a new value back to exactly where it was found. */
  update(hit, newValue) {
    if (!hit.path) { hit.store.setItem(hit.key, newValue); return; }
    const obj = JSON.parse(hit.store.getItem(hit.key));
    let node = obj;
    hit.path.slice(0, -1).forEach((p) => { node = node[p]; });
    node[hit.path[hit.path.length - 1]] = newValue;
    hit.store.setItem(hit.key, JSON.stringify(obj));
  },
  token() {
    if (window.Session && typeof window.Session.token === 'function') {
      const t = window.Session.token();
      if (t) return t;
    }
    return this.locate('access')?.value || null;
  },
  clear() {
    [...TOKEN_KEYS, ...REFRESH_KEYS].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    ['access', 'refresh'].forEach((kind) => {
      const hit = this.locate(kind);
      if (hit && !hit.path) hit.store.removeItem(hit.key);
    });
  },
};

class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors || [];
  }
  /** Message plus the per-field validation messages the backend returns in `errors`. */
  get fullMessage() {
    const extra = this.fieldErrors.map((e) => e.message).filter(Boolean);
    return extra.length ? `${this.message}: ${extra.join(', ')}` : this.message;
  }
}

function redirectToLogin() {
  if (window.Session && typeof window.Session.clear === 'function') window.Session.clear();
  Auth.clear();
  window.location.href = LOGIN_URL;
}

async function tryRefresh() {
  const rt = Auth.locate('refresh');
  if (!rt) return false;
  try {
    const res = await fetch(API_BASE + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt.value }),
    });
    if (!res.ok) return false;
    const d = (await res.json()).data || {};
    const newAccess = d.accessToken || d.token;
    if (!newAccess) return false;
    const at = Auth.locate('access');
    if (at) Auth.update(at, newAccess);
    else localStorage.setItem(TOKEN_KEYS[0], newAccess);
    if (d.refreshToken) Auth.update(rt, d.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function api(path, { method = 'GET', query, body, form } = {}, canRetry = true) {
  const url = new URL(API_BASE + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v);
    });
  }
  const headers = {};
  const token = Auth.token();
  if (token) headers.Authorization = 'Bearer ' + token;
  else console.warn('[user.js] No access token found in localStorage/sessionStorage. Log in again, or add your key to TOKEN_KEYS.');

  let payload;
  if (form) {
    payload = form;                                   // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Please check that the backend is running.', 0);
  }

  if (res.status === 401) {
    if (canRetry && (await tryRefresh())) return api(path, { method, query, body, form }, false);
    redirectToLogin();
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json?.errors);
  }
  return json ? json.data : null;
}

// ============================================================
// Constants / mappings
// ============================================================
const ROLE_PILL_CLASS = {
  SUPER_ADMIN: 'role-pill-super-admin',
  CHANNEL_PARTNER_ADMIN: 'role-pill-partner-admin',
  CHANNEL_PARTNER_SALES: 'role-pill-partner-sales',
};
const STATUS_PILL_CLASS = { Active: 'pill-active', Inactive: 'pill-inactive' };

// UI column key -> field the backend can sort on (SORT_FIELDS in UserServiceImpl).
const SORT_FIELD_MAP = { name: 'name', status: 'status', createdDate: 'createdAt' };

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
const PASSWORD_RULE_TEXT = 'Password must be at least 8 characters and contain a letter and a digit.';

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
};

// ============================================================
// Bootstrap: small UI pieces that used to need HTML edits.
// Runs before the event listeners below are attached.
// ============================================================
function bootstrapUi() {
  // 1) only columns the server can sort stay clickable
  document.querySelectorAll('#usersTable thead th[data-key]').forEach((th) => {
    if (!SORT_FIELD_MAP[th.getAttribute('data-key')]) {
      th.removeAttribute('data-key');
      th.querySelector('.sort-icon')?.remove();
      th.style.cursor = 'default';
    }
  });

  // 2) role filter works with role CODES (the API filters by roleCode)
  const roleSel = document.getElementById('filterRole');
  if (roleSel) {
    roleSel.innerHTML = '<option value="">All Roles</option>' +
      '<option value="SUPER_ADMIN">Super Admin</option>' +
      '<option value="CHANNEL_PARTNER_ADMIN">Partner Admin</option>' +
      '<option value="CHANNEL_PARTNER_SALES">Partner Sales</option>';
  }

  // 3) optional-password hint
  const pwLabel = document.querySelector('label[for="fldPassword"]');
  if (pwLabel) pwLabel.textContent = 'Password (optional — auto-generated if blank)';
  const npLabel = document.querySelector('label[for="fldNewPassword"]');
  if (npLabel) npLabel.textContent = 'New Password (leave blank to auto-generate)';

  // 4) modals created from JS
  const closeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  if (!document.getElementById('tempPasswordModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="tempPasswordModal" class="modal-overlay hidden">
        <div class="modal-panel modal-panel-sm">
          <div class="modal-header">
            <div>
              <div class="modal-title">Temporary Password</div>
              <div class="modal-subtitle">Share with <span id="tempPasswordUser"></span>. Shown only once.</div>
            </div>
            <button class="modal-close-btn" data-close-modal="tempPasswordModal" title="Close">${closeSvg}</button>
          </div>
          <div class="modal-body modal-body-single">
            <p id="tempPasswordValue" class="read-value" style="font-family:monospace;text-align:center;user-select:all;font-size:15px;"></p>
          </div>
          <div class="modal-footer">
            <button type="button" id="copyTempPasswordBtn" class="btn-secondary">Copy</button>
            <button type="button" class="btn-primary" data-close-modal="tempPasswordModal">Done</button>
          </div>
        </div>
      </div>`);
  }

  if (!document.getElementById('roleModal')) {
    document.head.insertAdjacentHTML('beforeend', `<style>
      .rm-body{max-height:62vh;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:12px}
      .rm-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      @media(max-width:560px){.rm-row2{grid-template-columns:1fr}}
      .rm-hint{font-size:10.5px;color:#9CA3AF;margin-top:3px}
      .rm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .rm-link{font-size:11px;font-weight:600;color:#810B38;background:none;border:none;cursor:pointer;padding:0}
      .rm-link:hover{text-decoration:underline}
      .rm-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
      .rm-module{border:1px solid #DCC3AA;border-radius:10px;padding:8px 10px;background:#FBF6EF;transition:all .15s}
      .rm-module.rm-on{border-color:#810B38;background:#fff}
      .rm-module.rm-disabled{opacity:.55}
      .rm-module-head{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:#1F2937;cursor:pointer}
      .rm-actions{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0 0 24px}
      .rm-action{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#4B5563;cursor:pointer}
      .rm-badge{font-size:9.5px;background:#F1E2D1;color:#6B0930;padding:1px 6px;border-radius:999px;font-weight:600}
      .rm-module input[type=checkbox]{accent-color:#810B38;width:15px;height:15px;cursor:pointer}
      .rm-edit-btn{font-size:10.5px;font-weight:600;color:#810B38;background:none;border:1px solid #DCC3AA;border-radius:6px;padding:2px 8px;cursor:pointer}
      .rm-edit-btn:hover{background:#F1E2D1}
    </style>`);
    document.body.insertAdjacentHTML('beforeend', `
      <div id="roleModal" class="modal-overlay hidden">
        <div class="modal-panel modal-panel-wide">
          <div class="modal-header">
            <div>
              <div id="roleModalTitle" class="modal-title">Create Role</div>
              <div id="roleModalSubtitle" class="modal-subtitle">Choose which modules this role can use</div>
            </div>
            <button class="modal-close-btn" data-close-modal="roleModal" title="Close">${closeSvg}</button>
          </div>
          <div class="rm-body">
            <div class="rm-row2">
              <div class="field-group">
                <label class="field-label" for="rmName">Role Name</label>
                <input type="text" id="rmName" class="field-input" placeholder="e.g. Site Engineer" maxlength="100">
              </div>
              <div class="field-group">
                <label class="field-label" for="rmCode">Role Code</label>
                <input type="text" id="rmCode" class="field-input" placeholder="SITE_ENGINEER" maxlength="50">
                <div class="rm-hint">Auto-filled from the name. Cannot be changed later.</div>
              </div>
            </div>
            <div class="field-group">
              <label class="field-label" for="rmDesc">Description (optional)</label>
              <input type="text" id="rmDesc" class="field-input" placeholder="What is this role for?" maxlength="255">
            </div>
            <div class="field-group">
              <label class="field-label" for="rmScope">Data Access</label>
              <select id="rmScope" class="field-input">
                <option value="PARTNER">Whole channel partner — sees all records of its partner</option>
                <option value="OWN">Own records only — sees only records the user created</option>
              </select>
            </div>
            <div>
              <div class="rm-head">
                <div>
                  <div class="field-label" style="margin:0">Module Access</div>
                  <div class="rm-hint" id="rmCount"></div>
                </div>
                <div>
                  <button type="button" class="rm-link" id="rmSelectAll">Select all</button>
                  <span style="color:#DCC3AA"> | </span>
                  <button type="button" class="rm-link" id="rmClear">Clear</button>
                </div>
              </div>
              <div id="rmModules" class="rm-list"></div>
            </div>
          </div>
          <p id="roleModalError" class="form-error hidden"></p>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" data-close-modal="roleModal">Cancel</button>
            <button type="button" id="roleModalSaveBtn" class="btn-primary">Create Role</button>
          </div>
        </div>
      </div>`);
  }
}
bootstrapUi();

// ============================================================
// State
// ============================================================
let me = null;                 // { user, modules, permissions } from /api/auth/me
let users = [];                // normalized rows of the CURRENT page only
let roleOptions = [];          // from /api/users/role-options
let partnerOptions = [];       // from /api/channel-partners/options

let sortKey = 'createdDate';
let sortDir = 'desc';
let currentPage = 1;           // UI is 1-based, the API is 0-based
let rowsPerPage = 8;
let totalRows = 0;
let totalPagesCount = 1;
let searchTerm = '';
let roleFilter = '';           // role CODE
let statusFilter = '';         // 'Active' | 'Inactive' | ''
let channelPartnerFilter = ''; // partner ID
let loadSeq = 0;               // ignore out-of-order responses

let formMode = 'add';
let editingUser = null;
let deleteTargetId = null;
let resetTargetId = null;
let pendingPhotoFile = null;   // File chosen but not uploaded yet
let pendingPhotoPath = null;   // path to send as photoPath on save
let saving = false;

const can = (code) => !!me && me.permissions.includes(code);
const isPlatformUser = () => me?.user?.role?.dataScope === 'ALL';

// ============================================================
// Mapping server <-> UI
// ============================================================
function normalizeUser(d) {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    email: d.email,
    phone: d.phone || '',
    username: d.username,
    department: d.department || '',
    status: d.status === 'ACTIVE' ? 'Active' : 'Inactive',
    roleId: d.role?.id ?? null,
    roleCode: d.role?.code ?? '',
    role: d.role?.name ?? '—',
    dataScope: d.role?.dataScope ?? '',
    partnerId: d.partner?.id ?? null,
    channelPartner: d.partner?.name ?? null,
    createdDate: d.audit?.createdAt ?? null,
    photoPath: d.photoUrl || null,
    photo: fileUrl(d.photoUrl),
  };
}

// ============================================================
// Session (logged-in user, permissions, topbar)
// ============================================================
async function loadSession() {
  me = await api('/api/auth/me');
  const u = me.user;

  const hello = document.getElementById('helloName') || document.querySelector('main p.text-sm span.font-semibold');
  if (hello) hello.textContent = u.name;
  if (profileBtn) profileBtn.textContent = initials(u.name).charAt(0);
  const roleLabel = document.getElementById('profileRoleLabel');
  if (roleLabel) roleLabel.textContent = `Logged in as: ${u.role?.name || '-'}`;
  const partnerLabel = document.getElementById('profilePartnerLabel');
  if (partnerLabel && u.partner?.name && !isPlatformUser()) {
    partnerLabel.textContent = u.partner.name;
    partnerLabel.classList.remove('hidden');
  }

  // Hide what this role may not use (the backend enforces it as well).
  document.getElementById('addUserBtn')?.classList.toggle('hidden', !can('USER:CREATE'));
  if (!isPlatformUser()) {
    filterChannelPartner?.classList.add('hidden');            // a partner only ever sees its own users
    const label = document.getElementById('kpiAdminLabel') || document.getElementById('kpiAdminUsers')?.nextElementSibling;
    if (label) label.textContent = 'Admin Users';
  }
}

profileLogoutBtn?.addEventListener('click', async () => {
  if (window.Session && typeof window.Session.logout === 'function') {
    window.Session.logout();
    return;
  }
  const rt = Auth.locate('refresh');
  try {
    if (rt) await api('/api/auth/logout', { method: 'POST', body: { refreshToken: rt.value } }, false);
  } catch { /* leaving anyway */ }
  redirectToLogin();
});

// ============================================================
// KPIs  (GET /api/users/summary)
// ============================================================
async function renderKpis() {
  try {
    const s = await api('/api/users/summary');
    document.getElementById('kpiTotalUsers').textContent = s.total;
    document.getElementById('kpiActiveUsers').textContent = s.active;
    document.getElementById('kpiInactiveUsers').textContent = s.inactive;
    document.getElementById('kpiAdminUsers').textContent = isPlatformUser() ? s.superAdmins : s.admins;
  } catch (err) {
    showToast(err.fullMessage || err.message, 'error');
  }
}

// ============================================================
// Table (GET /api/users)
// ============================================================
const usersTbody = document.getElementById('usersTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const emptyState = document.getElementById('emptyState');

function photoCellHtml(u) {
  if (u.photo) return `<img src="${escapeHtml(u.photo)}" class="table-avatar" alt="${escapeHtml(u.name)}">`;
  return `<div class="table-avatar-initials">${escapeHtml(initials(u.name))}</div>`;
}

function actionIconsHtml(u) {
  const btn = (action, icon, title, cls) =>
    `<button class="action-icon-btn ${cls}" data-action="${action}" data-id="${u.id}" title="${title}">${icon}</button>`;
  const parts = [];
  if (can('USER:VIEW')) parts.push(btn('view', ICONS.view, 'View', 'icon-view'));
  if (can('USER:EDIT')) parts.push(btn('edit', ICONS.edit, 'Edit', 'icon-edit'));
  if (can('USER:RESET_PASSWORD')) parts.push(btn('reset', ICONS.reset, 'Reset Password', 'icon-reset'));
  if (can('USER:DELETE') && u.id !== me?.user?.id) parts.push(btn('delete', ICONS.delete, 'Delete', 'icon-delete'));
  return `<div class="row-actions">${parts.join('')}</div>`;
}

async function loadUsers() {
  const seq = ++loadSeq;
  usersTbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:#9CA3AF;">Loading…</td></tr>';
  try {
    const query = {
      page: currentPage - 1,
      size: rowsPerPage,
      sort: `${SORT_FIELD_MAP[sortKey] || 'createdAt'},${sortDir}`,
      search: searchTerm.trim(),
      roleCode: roleFilter,
      status: statusFilter.toUpperCase(),
      partnerId: isPlatformUser() ? channelPartnerFilter : '',
    };
    const data = await api('/api/users', { query });
    if (seq !== loadSeq) return;                         // a newer request already replaced this one

    // Deleted the last row of the last page: step back one page.
    if (data.content.length === 0 && data.totalElements > 0 && currentPage > 1) {
      currentPage = Math.max(1, data.totalPages);
      return loadUsers();
    }

    users = data.content.map(normalizeUser);
    totalRows = data.totalElements;
    totalPagesCount = Math.max(1, data.totalPages);
    renderTable();
  } catch (err) {
    if (seq !== loadSeq) return;
    users = [];
    totalRows = 0;
    totalPagesCount = 1;
    renderTable();
    showToast(err.fullMessage || err.message, 'error');
  }
}

function renderTable() {
  emptyState.classList.toggle('hidden', totalRows !== 0);
  usersTbody.parentElement.style.display = totalRows === 0 ? 'none' : '';

  usersTbody.innerHTML = users.map((u) => `
    <tr data-id="${u.id}">
      <td data-label="User ID" class="font-medium">${escapeHtml(u.code)}</td>
      <td data-label="Photo">${photoCellHtml(u)}</td>
      <td data-label="Name">${escapeHtml(u.name)}</td>
      <td data-label="Email">${escapeHtml(u.email)}</td>
      <td data-label="Phone">${escapeHtml(u.phone || '—')}</td>
      <td data-label="Role"><span class="role-pill ${ROLE_PILL_CLASS[u.roleCode] || 'role-pill-default'}">${escapeHtml(u.role)}</span></td>
      <td data-label="Channel Partner">${escapeHtml(u.channelPartner || '—')}</td>
      <td data-label="Department">${escapeHtml(u.department || '—')}</td>
      <td data-label="Status"><span class="pill ${STATUS_PILL_CLASS[u.status]}">${u.status}</span></td>
      <td data-label="Created Date">${formatDate(u.createdDate)}</td>
      <td data-label="Actions">${actionIconsHtml(u)}</td>
    </tr>
  `).join('');

  const start = (currentPage - 1) * rowsPerPage;
  rowsRangeLabel.textContent = totalRows === 0
    ? 'No records'
    : `${start + 1}–${Math.min(start + users.length, totalRows)} of ${totalRows}`;

  renderPagination(totalPagesCount);
  updateSortIcons();
}

function renderPagination(totalPages) {
  let html = '';
  html += `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
      if (p === 2 || p === totalPages - 1) html += '<span class="pagination-btn disabled">…</span>';
      continue;
    }
    html += `<span class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</span>`;
  paginationControls.innerHTML = html;

  paginationControls.querySelectorAll('.pagination-btn:not(.disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-page');
      if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      loadUsers();
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll('#usersTable thead th[data-key]').forEach((th) => {
    const icon = th.querySelector('.sort-icon');
    const key = th.getAttribute('data-key');
    th.classList.toggle('sorted', key === sortKey);
    if (icon) icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#usersTable thead th[data-key]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (!SORT_FIELD_MAP[key]) return;                    // column the server cannot sort on
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    currentPage = 1;
    loadUsers();
  });
});

rowsPerPageSelect?.addEventListener('change', () => {
  rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
  currentPage = 1;
  loadUsers();
});

// ============================================================
// Search & filters
// ============================================================
const searchInput = document.getElementById('searchInput');
const filterRole = document.getElementById('filterRole');
const filterStatus = document.getElementById('filterStatus');
const filterChannelPartner = document.getElementById('filterChannelPartner');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

const debouncedSearch = debounce(() => { currentPage = 1; loadUsers(); }, 300);
searchInput?.addEventListener('input', () => { searchTerm = searchInput.value; debouncedSearch(); });
filterRole?.addEventListener('change', () => { roleFilter = filterRole.value; currentPage = 1; loadUsers(); });
filterStatus?.addEventListener('change', () => { statusFilter = filterStatus.value; currentPage = 1; loadUsers(); });
filterChannelPartner?.addEventListener('change', () => { channelPartnerFilter = filterChannelPartner.value; currentPage = 1; loadUsers(); });
resetFiltersBtn?.addEventListener('click', () => {
  searchTerm = ''; roleFilter = ''; statusFilter = ''; channelPartnerFilter = '';
  searchInput.value = ''; filterRole.value = ''; filterStatus.value = ''; filterChannelPartner.value = '';
  currentPage = 1;
  loadUsers();
});

// ============================================================
// Dropdown data (roles, partners)
// ============================================================
async function loadRoleOptions() {
  if (!can('USER:CREATE')) return;                       // endpoint needs USER:CREATE
  try {
    roleOptions = await api('/api/users/role-options');
  } catch (err) {
    showToast(err.fullMessage || err.message, 'error');
  }
}

async function loadPartnerOptions() {
  if (!isPlatformUser() || !can('CHANNEL_PARTNER:VIEW')) return;
  try {
    partnerOptions = await api('/api/channel-partners/options');
  } catch (err) {
    showToast(err.fullMessage || err.message, 'error');
    return;
  }
  filterChannelPartner.innerHTML = '<option value="">All Partners</option>' +
    partnerOptions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

/** Role <select> for the form. In edit mode only roles of the same kind (platform vs partner) are offered. */
function populateRoleSelect(editUser) {
  let list = roleOptions;
  if (editUser) {
    const platformUser = editUser.dataScope === 'ALL';
    list = roleOptions.filter((r) => (r.dataScope === 'ALL') === platformUser);
    // Make sure the user's current role is always present.
    if (!list.some((r) => r.id === editUser.roleId)) {
      list = [...list, { id: editUser.roleId, code: editUser.roleCode, name: editUser.role, dataScope: editUser.dataScope }];
    }
  }
  fld.role.innerHTML = list
    .map((r) => `<option value="${r.id}" data-code="${r.code}" data-scope="${r.dataScope}">${escapeHtml(r.name)}</option>`)
    .join('');
}

function populatePartnerSelect(extra) {
  const list = [...partnerOptions];
  if (extra?.partnerId && !list.some((p) => p.id === extra.partnerId)) {
    list.push({ id: extra.partnerId, name: extra.channelPartner });   // e.g. an inactive partner
  }
  fld.channelPartner.innerHTML = '<option value="">Select Channel Partner</option>' +
    list.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

function selectedRoleScope() {
  return fld.role.selectedOptions[0]?.dataset.scope || '';
}

/** Partner picker only matters to a Super Admin creating a partner user. Partner users always create inside their own partner. */
function toggleChannelPartnerField() {
  const group = document.getElementById('fldChannelPartnerGroup');
  if (!group) return;
  const needsPartner = isPlatformUser() && selectedRoleScope() !== 'ALL';
  group.style.display = needsPartner ? '' : 'none';
  if (!needsPartner) fld.channelPartner.value = '';
}

// ============================================================
// Modal helpers
// ============================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
});
document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.classList.add('hidden'));
});

function setBusy(button, busy, busyText, idleText) {
  saving = busy;
  button.disabled = busy;
  button.style.opacity = busy ? '0.7' : '';
  button.textContent = busy ? busyText : idleText;
}

/** Shown after create / reset when the server generated the password. */
function showTemporaryPassword(userName, password) {
  document.getElementById('tempPasswordUser').textContent = userName;
  document.getElementById('tempPasswordValue').textContent = password;
  openModal('tempPasswordModal');
}
document.getElementById('copyTempPasswordBtn')?.addEventListener('click', async () => {
  const text = document.getElementById('tempPasswordValue').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Password copied');
  } catch {
    showToast('Copy failed — select and copy it manually', 'error');
  }
});

// ============================================================
// Add / Edit user form
// ============================================================
const userForm = document.getElementById('userForm');
const userFormTitle = document.getElementById('userFormTitle');
const userFormSubtitle = document.getElementById('userFormSubtitle');
const userFormError = document.getElementById('userFormError');
const userFormSaveBtn = document.getElementById('userFormSaveBtn');
const passwordGroup = document.getElementById('passwordGroup');
const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
const avatarPreview = document.getElementById('avatarPreview');
const fldPhotoInput = document.getElementById('fldPhotoInput');

const fld = {
  fullName: document.getElementById('fldFullName'),
  email: document.getElementById('fldEmail'),
  phone: document.getElementById('fldPhone'),
  username: document.getElementById('fldUsername'),
  password: document.getElementById('fldPassword'),
  confirmPassword: document.getElementById('fldConfirmPassword'),
  role: document.getElementById('fldRole'),
  department: document.getElementById('fldDepartment'),
  status: document.getElementById('fldStatus'),
  channelPartner: document.getElementById('fldChannelPartner'),
};

function showFormError(msg) {
  userFormError.textContent = msg;
  userFormError.classList.remove('hidden');
}

function resetUserForm() {
  userForm.reset();
  userFormError.classList.add('hidden');
  avatarPreview.innerHTML = 'U';
  pendingPhotoFile = null;
  pendingPhotoPath = null;
  fldPhotoInput.value = '';
  fld.username.disabled = false;
  fld.channelPartner.disabled = false;
}

function openAddUserModal() {
  formMode = 'add';
  editingUser = null;
  resetUserForm();
  userFormTitle.textContent = 'Add User';
  userFormSubtitle.textContent = 'Create a new system user';
  passwordGroup.style.display = '';
  confirmPasswordGroup.style.display = '';
  userFormSaveBtn.textContent = 'Save';
  populateRoleSelect(null);
  populatePartnerSelect(null);
  // Default to the most restricted role (last in the list = Partner Sales) when available.
  const sales = roleOptions.find((r) => r.code === 'CHANNEL_PARTNER_SALES');
  if (sales) fld.role.value = String(sales.id);
  toggleChannelPartnerField();
  openModal('userFormModal');
}

function openEditUserModal(id) {
  const u = users.find((x) => x.id === Number(id));
  if (!u) return;
  formMode = 'edit';
  editingUser = u;
  resetUserForm();
  userFormTitle.textContent = 'Edit User';
  userFormSubtitle.textContent = `${u.code} · Update user details`;
  passwordGroup.style.display = 'none';
  confirmPasswordGroup.style.display = 'none';
  userFormSaveBtn.textContent = 'Update';

  populateRoleSelect(u);
  populatePartnerSelect(u);

  fld.fullName.value = u.name;
  fld.email.value = u.email;
  fld.phone.value = u.phone;
  fld.username.value = u.username;
  fld.username.disabled = true;                          // the backend does not change usernames
  fld.role.value = String(u.roleId);
  fld.department.value = u.department;
  fld.status.value = u.status;
  fld.channelPartner.value = u.partnerId ? String(u.partnerId) : '';
  fld.channelPartner.disabled = true;                    // a user cannot be moved to another partner
  toggleChannelPartnerField();
  if (u.partnerId && isPlatformUser() && selectedRoleScope() !== 'ALL') fld.channelPartner.value = String(u.partnerId);

  // IMPORTANT: PUT overwrites photoPath with whatever we send, so start from the existing one.
  pendingPhotoPath = u.photoPath;
  if (u.photo) avatarPreview.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="${escapeHtml(u.name)}">`;
  else avatarPreview.textContent = initials(u.name);

  openModal('userFormModal');
}

document.getElementById('addUserBtn')?.addEventListener('click', openAddUserModal);
fld.role?.addEventListener('change', toggleChannelPartnerField);

fldPhotoInput?.addEventListener('change', () => {
  const file = fldPhotoInput.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    showFormError('Only PNG, JPG and WEBP images are allowed.');
    fldPhotoInput.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showFormError('The image is too large (maximum 2 MB).');
    fldPhotoInput.value = '';
    return;
  }
  userFormError.classList.add('hidden');
  pendingPhotoFile = file;
  const reader = new FileReader();
  reader.onload = () => { avatarPreview.innerHTML = `<img src="${reader.result}" alt="preview">`; };
  reader.readAsDataURL(file);
});

async function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', 'USER_PHOTO');
  const res = await api('/api/files/upload', { method: 'POST', form });
  return res.path;                                       // store the path, not the full URL
}

userFormSaveBtn?.addEventListener('click', async () => {
  if (saving) return;
  userFormError.classList.add('hidden');

  const name = fld.fullName.value.trim();
  const email = fld.email.value.trim();
  const phone = fld.phone.value.trim();
  const username = fld.username.value.trim();
  const roleId = Number(fld.role.value);
  const department = fld.department.value.trim();
  const status = fld.status.value;                       // 'Active' | 'Inactive'
  const idleText = formMode === 'add' ? 'Save' : 'Update';

  if (!name || !email || !phone || !username) return showFormError('Please fill in all required fields.');
  if (!roleId) return showFormError('Please select a role.');
  if (!/^[A-Za-z0-9._-]{3,60}$/.test(username)) {
    return showFormError('Username must be 3–60 characters: letters, digits, dot, underscore or hyphen.');
  }

  const scope = selectedRoleScope();
  let partnerId = null;
  let password = '';

  if (formMode === 'add') {
    if (isPlatformUser()) {
      if (scope === 'ALL') {
        partnerId = me.user.partner?.id ?? null;         // platform roles belong to the PLATFORM partner (the Super Admin's own)
      } else {
        partnerId = fld.channelPartner.value ? Number(fld.channelPartner.value) : null;
        if (!partnerId) return showFormError('Please select a Channel Partner for this role.');
      }
    }
    // Password is optional: when blank the server generates a temporary one.
    password = fld.password.value;
    if (password) {
      if (!PASSWORD_RULE.test(password)) return showFormError(PASSWORD_RULE_TEXT);
      if (password !== fld.confirmPassword.value) return showFormError('Passwords do not match.');
    }
  }

  setBusy(userFormSaveBtn, true, 'Saving…', idleText);
  try {
    if (pendingPhotoFile) pendingPhotoPath = await uploadPhoto(pendingPhotoFile);

    const body = {
      name, email, phone, username, roleId,
      department: department || null,
      photoPath: pendingPhotoPath || null,
    };

    if (formMode === 'add') {
      body.status = status.toUpperCase();
      if (password) body.password = password;
      if (partnerId) body.partnerId = partnerId;
      const created = await api('/api/users', { method: 'POST', body });
      showToast(`User ${created.name} added`);
      if (created.temporaryPassword) showTemporaryPassword(created.name, created.temporaryPassword);
      sortKey = 'createdDate'; sortDir = 'desc'; currentPage = 1;
    } else {
      await api(`/api/users/${editingUser.id}`, { method: 'PUT', body });
      // The PUT does not touch status; it has its own endpoint.
      if (status !== editingUser.status) {
        await api(`/api/users/${editingUser.id}/status`, { method: 'PATCH', body: { status: status.toUpperCase() } });
      }
      showToast(`User ${name} updated`);
    }

    closeModal('userFormModal');
    await Promise.all([renderKpis(), loadUsers(), renderPermissionCards()]);
  } catch (err) {
    showFormError(err.fullMessage || err.message);
  } finally {
    setBusy(userFormSaveBtn, false, '', idleText);
  }
});

// ============================================================
// View user modal  (fresh copy from GET /api/users/{id})
// ============================================================
async function openViewUserModal(id) {
  let u;
  try {
    u = normalizeUser(await api(`/api/users/${id}`));
  } catch (err) {
    return showToast(err.fullMessage || err.message, 'error');
  }
  document.getElementById('viewUserSubtitle').textContent = `${u.code} · Read-only`;
  document.getElementById('viewId').textContent = u.code;
  document.getElementById('viewName').textContent = u.name;
  document.getElementById('viewEmail').textContent = u.email;
  document.getElementById('viewPhone').textContent = u.phone || '—';
  document.getElementById('viewUsername').textContent = u.username;
  document.getElementById('viewRole').textContent = u.role;
  document.getElementById('viewChannelPartner').textContent = u.channelPartner || '—';
  document.getElementById('viewDepartment').textContent = u.department || '—';
  document.getElementById('viewStatus').textContent = u.status;
  document.getElementById('viewCreatedDate').textContent = formatDate(u.createdDate);

  const viewAvatar = document.getElementById('viewAvatarPreview');
  if (u.photo) viewAvatar.innerHTML = `<img src="${escapeHtml(u.photo)}" alt="${escapeHtml(u.name)}">`;
  else viewAvatar.textContent = initials(u.name);

  openModal('viewUserModal');
}

// ============================================================
// Delete user  (DELETE /api/users/{id})
// ============================================================
function openDeleteModal(id) {
  const u = users.find((x) => x.id === Number(id));
  if (!u) return;
  deleteTargetId = u.id;
  document.getElementById('deleteUserName').textContent = u.name;
  openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async (e) => {
  if (saving) return;
  const u = users.find((x) => x.id === deleteTargetId);
  if (!u) return;
  const btn = e.currentTarget;
  setBusy(btn, true, 'Deleting…', 'Delete User');
  try {
    await api(`/api/users/${u.id}`, { method: 'DELETE' });
    closeModal('deleteModal');
    showToast(`User ${u.name} deleted`);
    await Promise.all([renderKpis(), loadUsers(), renderPermissionCards()]);
  } catch (err) {
    closeModal('deleteModal');
    showToast(err.fullMessage || err.message, 'error');   // e.g. "You cannot delete your own account"
  } finally {
    setBusy(btn, false, '', 'Delete User');
  }
});

// ============================================================
// Reset password  (POST /api/users/{id}/reset-password)
// ============================================================
const resetPasswordError = document.getElementById('resetPasswordError');

function openResetPasswordModal(id) {
  const u = users.find((x) => x.id === Number(id));
  if (!u) return;
  resetTargetId = u.id;
  document.getElementById('resetPasswordSubtitle').textContent = `${u.code} · ${u.name}`;
  document.getElementById('fldNewPassword').value = '';
  document.getElementById('fldConfirmNewPassword').value = '';
  resetPasswordError.classList.add('hidden');
  openModal('resetPasswordModal');
}

document.getElementById('confirmResetBtn')?.addEventListener('click', async (e) => {
  if (saving) return;
  const u = users.find((x) => x.id === resetTargetId);
  if (!u) return;
  const pw = document.getElementById('fldNewPassword').value;
  const cpw = document.getElementById('fldConfirmNewPassword').value;
  const fail = (msg) => { resetPasswordError.textContent = msg; resetPasswordError.classList.remove('hidden'); };

  // Blank = let the server generate a temporary password.
  if (pw) {
    if (!PASSWORD_RULE.test(pw)) return fail(PASSWORD_RULE_TEXT);
    if (pw !== cpw) return fail('Passwords do not match.');
  }

  const btn = e.currentTarget;
  setBusy(btn, true, 'Resetting…', 'Reset Password');
  try {
    const res = await api(`/api/users/${u.id}/reset-password`, {
      method: 'POST',
      body: pw ? { newPassword: pw } : {},
    });
    closeModal('resetPasswordModal');
    showToast(`Password reset for ${u.name}`);
    if (res?.temporaryPassword) showTemporaryPassword(u.name, res.temporaryPassword);
  } catch (err) {
    fail(err.fullMessage || err.message);
  } finally {
    setBusy(btn, false, '', 'Reset Password');
  }
});

// ============================================================
// Row actions
// ============================================================
usersTbody?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  e.stopPropagation();
  const id = actionBtn.getAttribute('data-id');
  const action = actionBtn.getAttribute('data-action');
  if (action === 'view') openViewUserModal(id);
  else if (action === 'edit') openEditUserModal(id);
  else if (action === 'reset') openResetPasswordModal(id);
  else if (action === 'delete') openDeleteModal(id);
});

// ============================================================
// Roles & Permissions cards  (Super Admin only: ROLE:VIEW)
// ============================================================
let moduleCatalog = [];    // [{ code, name, actions[], platformOnly }]
let lastMatrix = null;     // GET /api/roles/permission-matrix
let lastRoles = [];        // GET /api/roles (has description, dataScope, userCount)

function ensureCreateRoleButton(section) {
  if (!section || document.getElementById('createRoleBtn') || !can('ROLE:EDIT')) return;
  const header = section.firstElementChild;
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;';
  header.insertAdjacentHTML('beforeend', `
    <button id="createRoleBtn" type="button" class="flex items-center gap-2 bg-peach-500 hover:bg-peach-600 transition-colors text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Create Role
    </button>`);
  document.getElementById('createRoleBtn').addEventListener('click', () => openRoleModal(null));
}

async function renderPermissionCards() {
  const container = document.getElementById('permissionCards');
  if (!container) return;
  const section = container.closest('.bg-cream');
  if (!can('ROLE:VIEW')) {
    section?.classList.add('hidden');
    return;
  }
  ensureCreateRoleButton(section);
  try {
    const [matrix, roles] = await Promise.all([
      api('/api/roles/permission-matrix'),
      api('/api/roles'),
    ]);
    lastMatrix = matrix;
    lastRoles = roles;
    moduleCatalog = matrix.modules;
    const countByRole = Object.fromEntries(roles.map((r) => [r.code, r.userCount]));

    container.innerHTML = matrix.roles.map((role) => {
      const count = countByRole[role.code] ?? 0;
      const rows = matrix.modules.map((m) => {
        const actions = role.granted?.[m.code] || [];
        const allowed = actions.length > 0;
        return `
          <div class="permission-row" title="${escapeHtml(actions.map(actionLabel).join(', ') || 'No access')}">
            <span>${escapeHtml(m.name)}</span>
            <span class="${allowed ? 'permission-check' : 'permission-cross'}">${allowed ? ICONS.check : ICONS.cross}</span>
          </div>`;
      }).join('');
      const editBtn = can('ROLE:EDIT') && role.code !== 'SUPER_ADMIN'
        ? `<button type="button" class="rm-edit-btn" data-edit-role="${role.id}">Edit access</button>` : '';
      return `
        <div class="permission-card">
          <div class="permission-card-header">
            <span class="permission-card-title">${escapeHtml(role.name)}</span>
            <span style="display:flex;align-items:center;gap:8px;">
              <span class="permission-card-count">${count} user${count === 1 ? '' : 's'}</span>
              ${editBtn}
            </span>
          </div>
          <div class="permission-list">${rows}</div>
        </div>`;
    }).join('');
  } catch (err) {
    showToast(err.fullMessage || err.message, 'error');
  }
}

document.getElementById('permissionCards')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-edit-role]');
  if (btn) openRoleModal(Number(btn.getAttribute('data-edit-role')));
});

// ============================================================
// Create / Edit Role  — module + action checkboxes
//   POST /api/roles                      create the role
//   PUT  /api/roles/{id}                 rename / description / data scope
//   PUT  /api/roles/{id}/permissions     { granted: { MODULE: [ACTIONS] } }
// ============================================================
const ACTION_LABELS = {
  VIEW: 'View', CREATE: 'Create', EDIT: 'Edit', DELETE: 'Delete',
  RESET_PASSWORD: 'Reset Password', EXPORT: 'Export', MARK_PAID: 'Mark Paid', APPROVE: 'Approve',
};
function actionLabel(a) {
  return ACTION_LABELS[a] || (a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, ' '));
}
// Giving a custom role the power to edit roles would let it grant itself anything.
const HIDDEN_ROLE_MODULES = ['ROLE'];

const roleModalState = { role: null, codeDirty: false, busy: false };
const rm = {
  title: document.getElementById('roleModalTitle'),
  subtitle: document.getElementById('roleModalSubtitle'),
  name: document.getElementById('rmName'),
  code: document.getElementById('rmCode'),
  desc: document.getElementById('rmDesc'),
  scope: document.getElementById('rmScope'),
  list: document.getElementById('rmModules'),
  count: document.getElementById('rmCount'),
  error: document.getElementById('roleModalError'),
  save: document.getElementById('roleModalSaveBtn'),
};

function roleCodeFromName(name) {
  let c = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (c && !/^[A-Z]/.test(c)) c = 'R_' + c;
  return c.slice(0, 50);
}

function updateRoleCount() {
  const rows = [...rm.list.querySelectorAll('.rm-module')];
  const on = rows.filter((r) => r.classList.contains('rm-on')).length;
  rm.count.textContent = `${on} of ${rows.filter((r) => !r.classList.contains('rm-disabled')).length} modules selected`;
}

function syncModuleRow(row) {
  const any = [...row.querySelectorAll('input[data-action]')].some((a) => a.checked);
  row.querySelector('.rm-mod').checked = any;
  row.classList.toggle('rm-on', any);
  updateRoleCount();
}

function renderRoleModules(granted) {
  const catalog = moduleCatalog.filter((m) => !HIDDEN_ROLE_MODULES.includes(m.code) && (m.actions || []).length);
  rm.list.innerHTML = catalog.map((m) => {
    const have = new Set(granted[m.code] || []);
    const disabled = m.platformOnly;
    const on = have.size > 0 && !disabled;
    return `
      <div class="rm-module ${on ? 'rm-on' : ''} ${disabled ? 'rm-disabled' : ''}" data-module="${escapeHtml(m.code)}">
        <label class="rm-module-head">
          <input type="checkbox" class="rm-mod" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <span>${escapeHtml(m.name)}</span>
          ${disabled ? '<span class="rm-badge">Platform only</span>' : ''}
        </label>
        <div class="rm-actions">
          ${m.actions.map((a) => `
            <label class="rm-action">
              <input type="checkbox" data-action="${escapeHtml(a)}" ${have.has(a) && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
              ${escapeHtml(actionLabel(a))}
            </label>`).join('')}
        </div>
      </div>`;
  }).join('');
  updateRoleCount();
}

rm.list?.addEventListener('change', (e) => {
  const box = e.target;
  const row = box.closest('.rm-module');
  if (!row) return;
  const acts = [...row.querySelectorAll('input[data-action]')];
  const view = acts.find((a) => a.dataset.action === 'VIEW');
  if (box.classList.contains('rm-mod')) {
    if (box.checked) (view || acts[0]).checked = true;       // module on = View by default, then tick more
    else acts.forEach((a) => { a.checked = false; });
  } else if (box.checked && box.dataset.action !== 'VIEW' && view) {
    view.checked = true;                                      // Create/Edit/Delete need View
  } else if (!box.checked && box.dataset.action === 'VIEW') {
    acts.forEach((a) => { a.checked = false; });              // no View = no access
  }
  syncModuleRow(row);
});

document.getElementById('rmSelectAll')?.addEventListener('click', () => {
  rm.list.querySelectorAll('.rm-module:not(.rm-disabled)').forEach((row) => {
    row.querySelectorAll('input[data-action]').forEach((a) => { a.checked = true; });
    syncModuleRow(row);
  });
});
document.getElementById('rmClear')?.addEventListener('click', () => {
  rm.list.querySelectorAll('.rm-module').forEach((row) => {
    row.querySelectorAll('input[data-action]').forEach((a) => { a.checked = false; });
    syncModuleRow(row);
  });
});

rm.name?.addEventListener('input', () => {
  if (!roleModalState.role && !roleModalState.codeDirty) rm.code.value = roleCodeFromName(rm.name.value);
});
rm.code?.addEventListener('input', () => {
  roleModalState.codeDirty = true;
  rm.code.value = rm.code.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
});

function collectGranted() {
  const granted = {};
  rm.list.querySelectorAll('.rm-module').forEach((row) => {
    const actions = [...row.querySelectorAll('input[data-action]:checked')].map((a) => a.dataset.action);
    if (actions.length) granted[row.dataset.module] = actions;
  });
  return granted;
}

function showRoleError(msg) {
  rm.error.textContent = msg;
  rm.error.classList.remove('hidden');
}

async function openRoleModal(roleId) {
  try {
    if (!moduleCatalog.length) moduleCatalog = await api('/api/modules');
  } catch (err) {
    return showToast(err.fullMessage || err.message, 'error');
  }

  let role = null;
  let granted = {};
  if (roleId) {
    const g = lastMatrix?.roles.find((r) => r.id === roleId);
    if (!g) return showToast('Role not found. Please refresh the page.', 'error');
    const info = lastRoles.find((r) => r.id === roleId) || {};
    role = { id: g.id, code: g.code, name: g.name, description: info.description || '', dataScope: info.dataScope || 'PARTNER' };
    granted = g.granted || {};
  }

  roleModalState.role = role;
  roleModalState.codeDirty = false;
  rm.error.classList.add('hidden');
  rm.title.textContent = role ? 'Edit Role Access' : 'Create Role';
  rm.subtitle.textContent = role ? `${role.name} · choose which modules this role can use` : 'Choose which modules this role can use';
  rm.save.textContent = role ? 'Save Changes' : 'Create Role';
  rm.name.value = role ? role.name : '';
  rm.code.value = role ? role.code : '';
  rm.code.disabled = !!role;
  rm.desc.value = role ? role.description : '';
  rm.scope.value = role && role.dataScope !== 'ALL' ? role.dataScope : 'PARTNER';
  renderRoleModules(granted);
  openModal('roleModal');
  rm.name.focus();
}

rm.save?.addEventListener('click', async () => {
  if (roleModalState.busy) return;
  rm.error.classList.add('hidden');

  const name = rm.name.value.trim();
  const code = rm.code.value.trim();
  const description = rm.desc.value.trim();
  const dataScope = rm.scope.value;
  const granted = collectGranted();
  const idle = roleModalState.role ? 'Save Changes' : 'Create Role';

  if (!name) return showRoleError('Please enter a role name.');
  if (!roleModalState.role && !/^[A-Z][A-Z0-9_]{2,49}$/.test(code)) {
    return showRoleError('Role code must be 3–50 characters: capital letters, digits and underscore, starting with a letter.');
  }
  if (!Object.keys(granted).length) return showRoleError('Select at least one module for this role.');

  roleModalState.busy = true;
  rm.save.disabled = true;
  rm.save.textContent = 'Saving…';
  let createdNow = false;
  try {
    if (!roleModalState.role) {
      const created = await api('/api/roles', { method: 'POST', body: { code, name, description: description || null, dataScope } });
      roleModalState.role = { id: created.id, code: created.code, name: created.name };
      rm.code.disabled = true;
      createdNow = true;
    } else {
      await api(`/api/roles/${roleModalState.role.id}`, {
        method: 'PUT', body: { name, description: description || null, dataScope },
      });
    }
    await api(`/api/roles/${roleModalState.role.id}/permissions`, { method: 'PUT', body: { granted } });

    closeModal('roleModal');
    showToast(createdNow ? `Role ${name} created` : `Role ${name} updated`);
    await Promise.all([renderPermissionCards(), loadRoleOptions()]);   // new role becomes available in Add User
  } catch (err) {
    const msg = err.fullMessage || err.message;
    // Role row exists but the module list failed: keep the modal open, a second Save only retries the permissions.
    showRoleError(createdNow ? `Role was created, but its modules could not be saved: ${msg}. Press Save again to retry.` : msg);
  } finally {
    roleModalState.busy = false;
    rm.save.disabled = false;
    rm.save.textContent = roleModalState.role ? 'Save Changes' : idle;
  }
});

// ============================================================
// Init
// ============================================================
(async function init() {
  try {
    await loadSession();
  } catch (err) {
    if (err.status !== 401) showToast(err.fullMessage || err.message, 'error');
    return;                                              // 401 already redirected to login
  }

  if (!can('USER:VIEW')) {
    showToast('You do not have access to User Management', 'error');
    usersTbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  await Promise.all([loadRoleOptions(), loadPartnerOptions()]);
  await Promise.all([renderKpis(), loadUsers(), renderPermissionCards()]);
})();