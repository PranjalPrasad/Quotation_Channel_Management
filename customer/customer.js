/* ============================================================
   customer.js — Customer Management module (backend-integrated)
   Vanilla JS only. Backend: Spring Boot on port 8091.

   Endpoints used
   --------------
   GET    /api/customers?page&size&sort&search&type&status[&viewPartnerId]
   GET    /api/customers/summary[?viewPartnerId]
   GET    /api/customers/{id}[?viewPartnerId]
   GET    /api/customers/{id}/history[?viewPartnerId]
   GET    /api/customers/followups?page&size&status&customerId[&viewPartnerId]
   POST   /api/customers
   PUT    /api/customers/{id}
   DELETE /api/customers/{id}
   POST   /api/customers/{id}/followups
   POST   /api/auth/refresh                    (silent token refresh)

   Tenant rules (same as Products)
   -------------------------------
   * The client NEVER sends a partnerId. Everything is created under the signed-in
     user's own partner (Super Admin: the PLATFORM partner).
   * Super Admin may look at ONE partner with ?viewPartnerId= — GET requests only.
     In that mode this page is READ-ONLY: write buttons are hidden and api() refuses
     any non-GET request before it leaves the browser (the backend refuses it too).
   ============================================================ */

/* ---------- API config ---------- */
const API_BASE = (window.API_BASE || 'http://localhost:8091').replace(/\/+$/, '');
const SESSION_KEY = 'sqms_session';
const VIEW_PARTNER_KEY = 'sqms_view_partner';   // sessionStorage: {"id":12,"name":"Acme Solar"}

/* ============================================================
   AppLog (Module 0). Uses window.AppLog when session.js provides it,
   otherwise falls back to the console so this file works on its own.
   Rule: log the module tag, method, PATH (never the query string),
   status and errorCode. Never log request bodies, names, mobiles,
   e-mails or tokens.
   ============================================================ */
const AppLog = (window.AppLog && typeof window.AppLog.error === 'function') ? window.AppLog : {
  error: (...a) => console.error(...a),
  warn:  (...a) => console.warn(...a),
  info:  (...a) => console.info(...a),
  debug: (...a) => console.debug(...a),
};
const LOG_TAG = '[CUSTOMER]';

/* ============================================================
   Safe form helpers — a missing input can no longer crash the page.
   A missing field is logged once (id only) so it is easy to spot.
   ============================================================ */
const _missingLogged = new Set();
function fieldEl(id) {
  const el = document.getElementById(id);
  if (!el && !_missingLogged.has(id)) {
    _missingLogged.add(id);
    AppLog.warn(`${LOG_TAG} form element not found in HTML`, { id });
  }
  return el;
}
function setVal(id, v) { const el = fieldEl(id); if (el) el.value = v; }
function getVal(id) { const el = fieldEl(id); return el ? String(el.value || '') : ''; }

/* ============================================================
   Sidebar collapse/expand (same behaviour as dashboard.js)
   ============================================================ */
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

const drawerMQ = window.matchMedia('(max-width: 1023px)');
const isDrawerViewport = () => drawerMQ.matches;
const OPEN_BY_DEFAULT_ON_DRAWER = true;
const defaultSidebarState = () => (isDrawerViewport() ? OPEN_BY_DEFAULT_ON_DRAWER : true);

let sidebarExpanded = defaultSidebarState();

function setSidebarExpanded(expanded) {
  sidebarExpanded = expanded;
  sidebar.classList.toggle('expanded', expanded);
  sidebar.classList.toggle('collapsed', !expanded);
  toggleIcon.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';

  const showBackdrop = expanded && isDrawerViewport();
  sidebarBackdrop?.classList.toggle('visible', showBackdrop);
  sidebarBackdrop?.classList.toggle('hidden', !showBackdrop);
}
setSidebarExpanded(sidebarExpanded);

sidebarToggle?.addEventListener('click', () => setSidebarExpanded(!sidebarExpanded));
sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));
drawerMQ.addEventListener('change', () => setSidebarExpanded(defaultSidebarState()));
document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item') && isDrawerViewport()) setSidebarExpanded(false);
});

/* ============================================================
   Session helpers (token, role, partner, permissions)
   session.js owns the login session; these helpers only READ it
   (and write back refreshed tokens), tolerant of different shapes.
   ============================================================ */
function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}
function writeSession(obj) {
  try { (sessionStorage.getItem(SESSION_KEY) ? sessionStorage : (localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage)).setItem(SESSION_KEY, JSON.stringify(obj)); } catch (_) {}
}
// login response may be stored flat, or wrapped in .data
function sessionRoot(s) { return s && (s.data && (s.data.accessToken || s.data.token || s.data.user) ? s.data : s); }

function getAccessToken() {
  try { if (window.Session && typeof Session.token === 'function') { const t = Session.token(); if (t) return t; } } catch (_) {}
  const r = sessionRoot(readSession());
  return r ? (r.accessToken || r.token || null) : null;
}
function getRefreshToken() {
  const r = sessionRoot(readSession());
  return r ? (r.refreshToken || null) : null;
}
function getSessionUser() {
  const r = sessionRoot(readSession()) || {};
  return r.user || null;
}
function getRole() {
  if (window.currentUserRole) return window.currentUserRole;
  const r = sessionRoot(readSession()) || {};
  return r.role || (r.user && r.user.role && r.user.role.code) || null;
}
function getPartnerName() {
  if (window.currentUserPartnerName) return window.currentUserPartnerName;
  const r = sessionRoot(readSession()) || {};
  return r.partnerName || (r.user && r.user.partner && r.user.partner.name) || '';
}
const isSuperAdmin = () => getRole() === 'SUPER_ADMIN';

// Hide buttons the user has no permission for. If the session has no
// permission list we don't hide anything (backend still enforces it).
function can(perm) {
  const r = sessionRoot(readSession()) || {};
  const list = r.permissions;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(perm);
}

/* ============================================================
   View-partner mode (Super Admin looking at ONE partner, read only)

   Source: ?viewPartnerId=12[&viewPartnerName=Acme] on this page's URL,
   remembered in sessionStorage so a reload keeps the view. Only honoured
   for SUPER_ADMIN. The backend decides again on every request.
   ============================================================ */
function loadViewPartner() {
  if (!isSuperAdmin()) return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const idFromUrl = q.get('viewPartnerId');
    if (idFromUrl && /^\d+$/.test(idFromUrl)) {
      const v = { id: Number(idFromUrl), name: q.get('viewPartnerName') || '' };
      sessionStorage.setItem(VIEW_PARTNER_KEY, JSON.stringify(v));
      return v;
    }
    if (q.has('viewPartnerId')) sessionStorage.removeItem(VIEW_PARTNER_KEY);   // empty/invalid param = leave the view
    else {
      const raw = sessionStorage.getItem(VIEW_PARTNER_KEY);
      const v = raw ? JSON.parse(raw) : null;
      if (v && Number.isInteger(v.id)) return v;
    }
  } catch (_) {}
  return null;
}
const viewPartner = loadViewPartner();
const isViewMode = () => !!viewPartner;

// Every write is blocked in view mode; permission checks for buttons go through this.
const canWrite = (perm) => !isViewMode() && can(perm);

function readOnlyGuard(what) {
  if (!isViewMode()) return false;
  AppLog.warn(`${LOG_TAG} blocked in read-only view: ${what}`);
  showToast('You are viewing a partner. This page is read only.');
  return true;
}

function exitViewMode() {
  try { sessionStorage.removeItem(VIEW_PARTNER_KEY); } catch (_) {}
  const url = new URL(window.location.href);
  url.searchParams.delete('viewPartnerId');
  url.searchParams.delete('viewPartnerName');
  window.location.href = url.toString();
}

function renderViewBanner() {
  if (!isViewMode()) return;
  const anchor = document.querySelector('.cm-header');
  if (!anchor || document.getElementById('viewModeBanner')) return;
  const label = viewPartner.name ? viewPartner.name : `partner #${viewPartner.id}`;
  const banner = document.createElement('div');
  banner.id = 'viewModeBanner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'
    + 'background:#FBF6EF;border:1px solid #DCC3AA;border-radius:12px;padding:8px 14px;margin-bottom:12px;'
    + 'font-size:12px;color:#541A1A;font-weight:500;';
  const text = document.createElement('span');
  text.textContent = `Viewing ${label} — read only. You cannot add, edit or delete anything here.`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Back to my data';
  btn.style.cssText = 'font-size:12px;font-weight:600;color:#810B38;background:none;border:0;cursor:pointer;text-decoration:underline;';
  btn.addEventListener('click', exitViewMode);
  banner.append(text, btn);
  anchor.parentNode.insertBefore(banner, anchor);
}

/* ---------- Logged-in user name (avatar + dropdown) ---------- */
function getLoggedInUserName() {
  const u = getSessionUser();
  const r = sessionRoot(readSession()) || {};
  const name = (u && (u.name || u.username)) || r.name || (u && u.email ? u.email.split('@')[0] : '');
  return name ? String(name).trim() : 'User';
}
(function renderUserName() {
  const name = getLoggedInUserName();
  const initial = document.getElementById('profileInitial');
  const label = document.getElementById('profileNameLabel');
  if (initial) initial.textContent = name.charAt(0).toUpperCase();
  if (label) label.textContent = name;
})();

function logoutUser() {
  try {
    if (window.Session && typeof Session.logout === 'function') Session.logout();
    else { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); }
    sessionStorage.removeItem(VIEW_PARTNER_KEY);
  } catch (_) {}
  window.location.href = '../index.html';
}

/* ============================================================
   API client — Bearer token, ApiResponse unwrap, 401 → refresh
   ============================================================ */
class ApiError extends Error {
  constructor(message, status, errorCode, fieldErrors) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors || [];
  }
}

let refreshPromise = null;
async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const rt = getRefreshToken();
  if (!rt) return false;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      const d = body && body.data;
      if (!d || !d.accessToken) return false;

      // write the new (rotated) tokens back into the stored session
      const s = readSession();
      const root = sessionRoot(s);
      if (s && root) {
        root.accessToken = d.accessToken;
        if ('token' in root) root.token = d.accessToken;
        if (d.refreshToken) root.refreshToken = d.refreshToken;
        writeSession(s);
      }
      return true;
    } catch (_) { return false; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

async function api(path, { method = 'GET', params, body } = {}, retried = false) {
  // Read-only view: a write never leaves the browser.
  if (method !== 'GET' && isViewMode()) {
    AppLog.warn(`${LOG_TAG} write blocked in read-only view`, { method, path });
    throw new ApiError('You are viewing a partner. This page is read only.', 0, 'READ_ONLY_VIEW');
  }

  const query = { ...(params || {}) };
  if (method === 'GET' && isViewMode()) query.viewPartnerId = viewPartner.id;   // GET only, never on writes

  let url = `${API_BASE}${path}`;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') qs.append(k, v);
  });
  const qsText = qs.toString();
  if (qsText) url += `?${qsText}`;

  const headers = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (_) {
    AppLog.error(`${LOG_TAG} server not reachable`, { method, path });
    throw new ApiError('Cannot reach the server. Is the backend running on port 8091?', 0);
  }

  if (res.status === 401 && !retried) {
    if (await refreshAccessToken()) return api(path, { method, params, body }, true);
    AppLog.warn(`${LOG_TAG} session expired`, { method, path });
    showToast('Session expired. Please log in again.');
    setTimeout(logoutUser, 800);
    throw new ApiError('Session expired', 401);
  }

  let json = null;
  try { json = await res.json(); } catch (_) {}

  if (!res.ok || (json && json.success === false)) {
    const errorCode = json && json.errorCode;
    // 5xx = our problem (error), 4xx = the request/permission (warn). Path only: no query string, no body.
    (res.status >= 500 ? AppLog.error : AppLog.warn)(`${LOG_TAG} API call failed`, { method, path, status: res.status, errorCode });
    const msg = (json && json.message) || (res.status === 403 ? 'You do not have permission to do this.' : `Request failed (${res.status})`);
    throw new ApiError(msg, res.status, errorCode, json && json.errors);
  }
  return json ? json.data : null;
}

/* ============================================================
   Topbar dropdowns
   ============================================================ */
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');
const exportBtn = document.getElementById('exportBtn');
const exportMenu = document.getElementById('exportMenu');

function closeAllDropdowns(except) {
  [notifDropdown, profileDropdown, exportMenu].forEach((dd) => {
    if (dd && dd !== except) dd.classList.add('hidden');
  });
}
[[notifBtn, notifDropdown], [profileBtn, profileDropdown], [exportBtn, exportMenu]].forEach(([btn, dd]) => {
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = dd.classList.contains('hidden');
    closeAllDropdowns();
    dd.classList.toggle('hidden', !willOpen);
  });
});
document.addEventListener('click', () => closeAllDropdowns());
profileLogoutBtn?.addEventListener('click', logoutUser);

window.addEventListener('scroll', () => {
  const active = document.activeElement;
  if (active && active.tagName === 'SELECT') active.blur();
}, true);

/* ============================================================
   Utilities
   ============================================================ */
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate';
  toast.style.cssText = 'background:#1F2937;color:#fff;font-size:12px;font-weight:500;padding:10px 16px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,0.18);';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Everything from the server goes through esc() before innerHTML (prevents XSS).
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');   // "ACTIVE" → "Active"
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function formatDateDisplay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTimeDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const partnerLabel = (p) => (p ? (p.code ? `${p.code} · ${p.name}` : p.name) : '—');

const typePillClass = { RESIDENTIAL: 'pill-residential', COMMERCIAL: 'pill-commercial', INDUSTRIAL: 'pill-industrial' };
const statusPillClass = { ACTIVE: 'pill-active', INACTIVE: 'pill-inactive' };
const followupPillClass = { PENDING: 'pill-pending', COMPLETED: 'pill-accepted', OVERDUE: 'pill-rejected' };

/* ============================================================
   State
   ============================================================ */
let customers = [];          // current page of customers (from server)
let followups = [];          // current page of follow-ups (from server)
let searchTerm = '';
let typeFilter = 'All';
let statusFilter = 'All';
let currentPage = 1;         // 1-based in the UI, 0-based on the API
let totalRows = 0;
let totalPages = 1;
const rowsPerPage = 6;
let tableLoadSeq = 0;        // ignore out-of-order responses

/* ============================================================
   Summary cards  → GET /api/customers/summary
   ============================================================ */
async function loadSummary() {
  try {
    const s = await api('/api/customers/summary');
    const total = s.total || 0;
    const pct = (n) => (total ? `${Math.round((n / total) * 100)}% of customers` : null);

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statResidential').textContent = s.residential;
    document.getElementById('statCommercial').textContent = s.commercial;
    document.getElementById('statIndustrial').textContent = s.industrial;

    document.getElementById('statTotalTrend').textContent = `${s.active} active`;
    document.getElementById('statResidentialTrend').textContent = pct(s.residential) || 'Homes & apartments';
    document.getElementById('statCommercialTrend').textContent = pct(s.commercial) || 'Offices & shops';
    document.getElementById('statIndustrialTrend').textContent = pct(s.industrial) || 'Plants & factories';
  } catch (err) {
    showToast(err.message);
  }
}

/* ============================================================
   Customer table  → GET /api/customers
   ============================================================ */
const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line><line x1="9" y1="11" x2="12" y2="11"></line></svg>',
};

// In view mode only "View" is shown: edit / quotation / delete are all writes.
function actionIconsHtml(id) {
  const btns = [`<button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>`];
  if (canWrite('CUSTOMER:EDIT')) btns.push(`<button class="action-icon-btn icon-edit" data-action="edit" data-id="${id}" title="Edit">${ICONS.edit}</button>`);
  if (!isViewMode()) btns.push(`<button class="action-icon-btn icon-quote" data-action="quote" data-id="${id}" title="Create Quotation">${ICONS.quote}</button>`);
  if (canWrite('CUSTOMER:DELETE')) btns.push(`<button class="action-icon-btn icon-delete" data-action="delete" data-id="${id}" title="Delete">${ICONS.delete}</button>`);
  return `<div class="row-actions">${btns.join('')}</div>`;
}

async function loadCustomers() {
  const seq = ++tableLoadSeq;
  const tbody = document.getElementById('customerTbody');
  document.getElementById('tableCountLabel').textContent = 'Loading…';
  try {
    const page = await api('/api/customers', {
      params: {
        page: currentPage - 1,
        size: rowsPerPage,
        search: searchTerm.trim(),
        type: typeFilter === 'All' ? '' : typeFilter.toUpperCase(),
        status: statusFilter === 'All' ? '' : statusFilter.toUpperCase(),
      },
    });
    if (seq !== tableLoadSeq) return;           // a newer request is in flight

    customers = page.content || [];
    totalRows = page.totalElements || 0;
    totalPages = Math.max(1, page.totalPages || 1);

    // page vanished (e.g. last row on the last page was deleted) → go back one page
    if (customers.length === 0 && currentPage > 1 && totalRows > 0) {
      currentPage = totalPages;
      return loadCustomers();
    }
    renderTable();
    renderHistory();
  } catch (err) {
    if (seq !== tableLoadSeq) return;
    customers = [];
    totalRows = 0;
    tbody.innerHTML = '';
    document.getElementById('tableCountLabel').textContent = '0 records';
    showToast(err.message);
  }
}

function renderTable() {
  const tbody = document.getElementById('customerTbody');
  const emptyState = document.getElementById('emptyState');
  const tableFooter = document.getElementById('tableFooter');
  const tableWrap = document.querySelector('.table-scroll');

  document.getElementById('tableCountLabel').textContent = `${totalRows} record${totalRows === 1 ? '' : 's'}`;

  if (totalRows === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    tableFooter.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  tableWrap.classList.remove('hidden');
  tableFooter.classList.remove('hidden');

  // Every row of a page belongs to ONE partner (own, or the viewed one), so there is no Channel Partner column.
  tbody.innerHTML = customers.map(c => `
      <tr data-id="${c.id}">
        <td data-label="Customer ID" class="font-medium">${esc(c.code)}</td>
        <td data-label="Customer Name">${esc(c.name)}</td>
        <td data-label="Mobile Number">${esc(c.mobile)}</td>
        <td data-label="Email">${esc(c.email) || '—'}</td>
        <td data-label="City">${esc(c.city) || '—'}</td>
        <td data-label="Customer Type"><span class="pill ${typePillClass[c.type] || ''}">${esc(cap(c.type))}</span></td>
        <td data-label="Tax Type">${taxTypeBadge(c.gstNo)}</td>
        <td data-label="Project Location">${esc(c.projectSummary) || '—'}</td>
        <td data-label="Status"><span class="pill ${statusPillClass[c.status] || ''}">${esc(cap(c.status))}</span></td>
        <td data-label="Created Date">${formatDateDisplay(c.audit && c.audit.createdAt)}</td>
        <td data-label="Actions">${actionIconsHtml(c.id)}</td>
      </tr>`).join('');

  // keep the header in step with the body even if the HTML still has the old column
  document.querySelectorAll('#customerTable thead th[data-role="SUPER_ADMIN"]').forEach(th => { th.style.display = 'none'; });

  const start = (currentPage - 1) * rowsPerPage;
  document.getElementById('rowsRangeLabel').textContent = `${start + 1}–${start + customers.length} of ${totalRows}`;
  renderPagination();
}

function renderPagination() {
  const el = document.getElementById('paginationControls');
  let html = `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<span class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</span>`;
  el.innerHTML = html;

  el.querySelectorAll('.pagination-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-page');
      if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      loadCustomers();
    });
  });
}

/* ---------- Search (debounced → server-side) ---------- */
const debouncedSearch = debounce(() => { currentPage = 1; loadCustomers(); }, 350);
document.getElementById('searchName')?.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  debouncedSearch();
});

/* ============================================================
   Custom dropdown (form selects)
   ============================================================ */
function setupCustomSelect(rootId, onSelect) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const trigger = root.querySelector('.custom-select-trigger');
  const label = root.querySelector('.cs-label');
  const panel = root.querySelector('.custom-select-panel');
  const options = root.querySelectorAll('.custom-select-option');

  function closePanel() {
    panel.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function openPanel() {
    document.querySelectorAll('.custom-select-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
  }
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('hidden') ? openPanel() : closePanel();
  });
  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      label.textContent = opt.textContent;
      closePanel();
      onSelect(opt.getAttribute('data-value'));
    });
  });
  return {
    close: closePanel,
    setValue(val) {
      options.forEach(o => o.classList.toggle('selected', o.getAttribute('data-value') === val));
      const match = [...options].find(o => o.getAttribute('data-value') === val);
      if (match) label.textContent = match.textContent;
    },
  };
}

// Filter dropdowns (Type / Status above the table)
const typeSelectCtrl = setupCustomSelect('filterTypeSelect', (val) => { typeFilter = val; currentPage = 1; loadCustomers(); });
const statusSelectCtrl = setupCustomSelect('filterStatusSelect', (val) => { statusFilter = val; currentPage = 1; loadCustomers(); });
// Form dropdowns (values are the DISPLAY values; converted to UPPERCASE when sent)
const fldTypeCtrl = setupCustomSelect('fldTypeSelect', (val) => setVal('fldType', val));
const fldStatusCtrl = setupCustomSelect('fldStatusSelect', (val) => setVal('fldStatus', val));
const fuStatusCtrl = setupCustomSelect('fuStatusSelect', (val) => setVal('fuStatus', val));

/* Generic builder for dropdowns whose options are loaded from the server. */
function buildDynamicSelect(rootId, hiddenId, items, selectedValue, placeholder) {
  const root = document.getElementById(rootId);
  if (!root) return;
  const trigger = root.querySelector('.custom-select-trigger');
  const label = root.querySelector('.cs-label');
  const panel = root.querySelector('.custom-select-panel');
  const hidden = document.getElementById(hiddenId);

  panel.innerHTML = items.map(it =>
    `<div class="custom-select-option${String(it.value) === String(selectedValue) ? ' selected' : ''}" data-value="${esc(it.value)}" role="option">${esc(it.label)}</div>`
  ).join('') || `<div class="custom-select-option" style="cursor:default;color:#9CA3AF;">No options</div>`;

  const chosen = items.find(it => String(it.value) === String(selectedValue));
  hidden.value = chosen ? chosen.value : '';
  label.textContent = chosen ? chosen.label : placeholder;

  panel.querySelectorAll('.custom-select-option[data-value]').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      label.textContent = opt.textContent;
      hidden.value = opt.getAttribute('data-value');
      panel.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  trigger.onclick = (e) => {
    e.stopPropagation();
    const willOpen = panel.classList.contains('hidden');
    document.querySelectorAll('.custom-select-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    panel.classList.toggle('hidden', !willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
  };
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('.custom-select').forEach(root => {
    if (!root.contains(e.target)) {
      root.querySelector('.custom-select-panel')?.classList.add('hidden');
      root.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.custom-select-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.custom-select-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
  }
});

document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
  searchTerm = ''; typeFilter = 'All'; statusFilter = 'All'; currentPage = 1;
  const search = document.getElementById('searchName');
  if (search) search.value = '';
  typeSelectCtrl?.setValue('All');
  statusSelectCtrl?.setValue('All');
  loadCustomers();
  showToast('Filters reset');
});

/* ============================================================
   Add / Edit Customer modal
   The owner is never chosen in the form: the backend always uses the
   signed-in user's own partner (Super Admin: the PLATFORM partner).
   ============================================================ */
const customerFormModal = document.getElementById('customerFormModal');
let formMode = 'add';
let saving = false;

const FORM_ERR = {            // backend field name → [input id, error span id]
  name: ['fldName', 'errName'],
  mobile: ['fldMobile', 'errMobile'],
  email: ['fldEmail', 'errEmail'],
  pincode: ['fldPincode', 'errPincode'],
  gstNo: ['fldGst', 'errGst'],
  state: ['fldState', 'errState'],
};

function clearFormErrors() {
  Object.values(FORM_ERR).forEach(([inp, err]) => {
    const e = document.getElementById(err); if (e) e.textContent = '';
    document.getElementById(inp)?.classList.remove('invalid');
  });
}
function setFieldError(field, message) {
  const pair = FORM_ERR[field];
  if (!pair) return false;
  const e = document.getElementById(pair[1]);
  if (e) e.textContent = message;
  document.getElementById(pair[0])?.classList.add('invalid');
  return true;
}

/* ---- GST: B2B / B2C badge (B2B = a valid GSTIN is on file) and the state list ---- */
function taxTypeBadge(gstin) {
  const t = GstCommon.customerTaxType(gstin);
  return `<span class="pill ${t === 'B2B' ? 'pill-b2b' : 'pill-b2c'}" title="${t === 'B2B' ? 'Registered business (GSTIN on file)' : 'Consumer / unregistered'}">${t}</span>`;
}
function refreshGstBadge() {
  const badge = document.getElementById('gstTypeBadge');
  if (!badge) return;
  const t = GstCommon.customerTaxType(getVal('fldGst'));
  badge.textContent = t;
  badge.className = 'pill ' + (t === 'B2B' ? 'pill-b2b' : 'pill-b2c');
}
(function wireGstFields() {
  const list = document.getElementById('gstStateList');
  if (list) list.innerHTML = GstCommon.STATES.map(s => `<option value="${esc(s.name)}"></option>`).join('');
  const gst = document.getElementById('fldGst');
  gst?.addEventListener('input', () => {
    const pos = gst.selectionStart;
    gst.value = GstCommon.normGstin(gst.value);
    try { gst.setSelectionRange(pos, pos); } catch (_) {}
    const state = document.getElementById('fldState');
    const prefix = GstCommon.stateNameByCode(GstCommon.stateCodeFromGstin(gst.value));
    if (state && !state.value.trim() && prefix && GstCommon.isValidGstin(gst.value)) state.value = prefix;   // convenience only
    refreshGstBadge();
  });
})();

function openCustomerForm(mode, customer) {
  if (readOnlyGuard(`customer ${mode}`)) return;
  formMode = mode;
  clearFormErrors();
  document.getElementById('customerFormTitle').textContent = mode === 'add' ? 'Add Customer' : 'Edit Customer';
  document.getElementById('customerFormSubtitle').textContent = mode === 'add' ? "Fill in the customer's details" : `Editing ${customer.code}`;
  document.getElementById('customerFormSaveBtn').textContent = mode === 'add' ? 'Save Customer' : 'Update Customer';

  setVal('fldCustomerId', customer ? customer.id : '');
  setVal('fldName', customer ? customer.name || '' : '');
  setVal('fldMobile', customer ? customer.mobile || '' : '');
  setVal('fldEmail', customer ? customer.email || '' : '');
  setVal('fldAddress', customer ? customer.address || '' : '');
  setVal('fldCity', customer ? customer.city || '' : '');
  setVal('fldState', customer ? customer.state || '' : '');
  setVal('fldPincode', customer ? customer.pincode || '' : '');
  setVal('fldGst', customer ? customer.gstNo || '' : '');
  refreshGstBadge();

  const typeVal = customer ? cap(customer.type) : 'Residential';
  setVal('fldType', typeVal);
  fldTypeCtrl?.setValue(typeVal);

  const statusVal = customer ? cap(customer.status) : 'Active';
  setVal('fldStatus', statusVal);
  fldStatusCtrl?.setValue(statusVal);

  // Channel partner: read-only text, for information only (the backend decides the owner).
  const textInput = document.getElementById('fldChannelPartner');
  if (textInput) {
    textInput.value = customer ? partnerLabel(customer.partner) : getPartnerName();
    textInput.readOnly = true;
  }

  customerFormModal.classList.remove('hidden');
  document.getElementById('fldName')?.focus();
}
function closeCustomerForm() { customerFormModal.classList.add('hidden'); }

document.getElementById('addCustomerBtn')?.addEventListener('click', () => openCustomerForm('add', null));
document.getElementById('addFirstCustomerBtn')?.addEventListener('click', () => openCustomerForm('add', null));
document.getElementById('customerFormCloseBtn')?.addEventListener('click', closeCustomerForm);
document.getElementById('customerFormCancelBtn')?.addEventListener('click', closeCustomerForm);
customerFormModal?.addEventListener('click', (e) => { if (e.target === customerFormModal) closeCustomerForm(); });

// Client-side checks mirror the backend rules; the backend remains the source of truth.
function validateCustomerForm() {
  clearFormErrors();
  let valid = true;
  const name = getVal('fldName').trim();
  const mobile = getVal('fldMobile').trim();
  const email = getVal('fldEmail').trim();
  const pincode = getVal('fldPincode').trim();
  const gst = getVal('fldGst').trim().toUpperCase();

  if (!name) { setFieldError('name', 'Customer name is required.'); valid = false; }
  if (!mobile) { setFieldError('mobile', 'Mobile number is required.'); valid = false; }
  else if (!/^\d{10}$/.test(mobile)) { setFieldError('mobile', 'Enter a valid 10-digit mobile number.'); valid = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('email', 'Enter a valid email address.'); valid = false; }
  if (pincode && !/^\d{6}$/.test(pincode)) { setFieldError('pincode', 'Pincode must be 6 digits.'); valid = false; }
  const gstMsg = GstCommon.gstinError(gst, false);
  if (gstMsg) { setFieldError('gstNo', gstMsg); valid = false; }
  const stateText = getVal('fldState').trim();
  const stateCode = GstCommon.stateCodeByName(stateText);
  if (stateText && !stateCode) { setFieldError('state', 'Pick a state from the list.'); valid = false; }
  else if (gst && !gstMsg) {
    if (!stateCode) { setFieldError('state', 'State is required for a customer with a GST number.'); valid = false; }
    else if (stateCode !== GstCommon.stateCodeFromGstin(gst)) {
      setFieldError('state', `State does not match the GST number (it starts with ${GstCommon.stateCodeFromGstin(gst)} = ${GstCommon.stateNameByCode(GstCommon.stateCodeFromGstin(gst))}).`);
      valid = false;
    }
  }
  if (!valid) {
    const bad = Object.keys(FORM_ERR).filter(k => document.getElementById(FORM_ERR[k][1])?.textContent);
    GstCommon.logger('CUSTOMER').validation('Customer form', bad);   // field names only, never values
  }
  return valid;
}

document.getElementById('customerFormSaveBtn')?.addEventListener('click', async () => {
  if (readOnlyGuard('customer save')) return;
  if (saving || !validateCustomerForm()) return;

  // No partnerId in the payload, ever.
  const payload = {
    name: getVal('fldName').trim(),
    mobile: getVal('fldMobile').trim(),
    email: getVal('fldEmail').trim(),
    address: getVal('fldAddress').trim(),
    city: getVal('fldCity').trim(),
    state: GstCommon.stateNameByCode(GstCommon.stateCodeByName(getVal('fldState'))) || getVal('fldState').trim(),   // canonical GST state name
    pincode: getVal('fldPincode').trim(),
    gstNo: getVal('fldGst').trim().toUpperCase(),
    type: getVal('fldType').toUpperCase(),
    status: getVal('fldStatus').toUpperCase(),
  };

  const btn = document.getElementById('customerFormSaveBtn');
  const originalText = btn.textContent;
  saving = true; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (formMode === 'add') {
      const created = await api('/api/customers', { method: 'POST', body: payload });
      showToast(`Customer ${created.code} added`);
      currentPage = 1;
    } else {
      const id = getVal('fldCustomerId');
      const updated = await api(`/api/customers/${id}`, { method: 'PUT', body: payload });
      showToast(`Customer ${updated.code} updated`);
    }
    closeCustomerForm();
    await refreshAll();
  } catch (err) {
    // Show backend validation errors under the matching field
    let shown = false;
    (err.fieldErrors || []).forEach(fe => { if (setFieldError(fe.field, fe.message)) shown = true; });
    if (err.status === 409) { setFieldError('mobile', err.message); shown = true; }   // duplicate mobile
    if (!shown) showToast(err.message);
  } finally {
    saving = false; btn.disabled = false; btn.textContent = originalText;
  }
});

/* ============================================================
   View Customer modal  (data already in the table row — GET by id for fresh copy)
   ============================================================ */
const viewCustomerModal = document.getElementById('viewCustomerModal');
function renderViewCustomer(c) {
  document.getElementById('viewCustomerSubtitle').textContent = c.code;
  document.getElementById('viewCustomerBody').innerHTML = `
    <div class="detail-item"><span class="d-label">Customer Name</span><span class="d-value">${esc(c.name)}</span></div>
    <div class="detail-item"><span class="d-label">Mobile Number</span><span class="d-value">${esc(c.mobile)}</span></div>
    <div class="detail-item"><span class="d-label">Email</span><span class="d-value">${esc(c.email) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">City</span><span class="d-value">${esc(c.city) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">State</span><span class="d-value">${esc(c.state) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Pincode</span><span class="d-value">${esc(c.pincode) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">GST Number</span><span class="d-value">${esc(c.gstNo) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Tax Type</span><span class="d-value">${taxTypeBadge(c.gstNo)}</span></div>
    <div class="detail-item"><span class="d-label">Customer Type</span><span class="d-value">${esc(cap(c.type))}</span></div>
    <div class="detail-item"><span class="d-label">Channel Partner</span><span class="d-value">${esc(partnerLabel(c.partner))}</span></div>
    <div class="detail-item"><span class="d-label">Status</span><span class="d-value">${esc(cap(c.status))}</span></div>
    <div class="detail-item"><span class="d-label">Projects</span><span class="d-value">${c.projectCount ?? 0}</span></div>
    <div class="detail-item full"><span class="d-label">Address</span><span class="d-value">${esc(c.address) || '—'}</span></div>
    <div class="detail-item full"><span class="d-label">Latest Project</span><span class="d-value">${esc(c.projectSummary) || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Created Date</span><span class="d-value">${formatDateDisplay(c.audit && c.audit.createdAt)}</span></div>
    <div class="detail-item"><span class="d-label">Created By</span><span class="d-value">${esc(c.audit && c.audit.createdBy) || '—'}</span></div>
  `;
  viewCustomerModal.classList.remove('hidden');
}
async function openViewCustomer(customer) {
  renderViewCustomer(customer);                       // instant, from the table row
  try { renderViewCustomer(await api(`/api/customers/${customer.id}`)); } catch (_) {}   // then refresh (failure already logged by api())
}
function closeViewCustomer() { viewCustomerModal.classList.add('hidden'); }
document.getElementById('viewCustomerCloseBtn')?.addEventListener('click', closeViewCustomer);
document.getElementById('viewCustomerCloseBtn2')?.addEventListener('click', closeViewCustomer);
viewCustomerModal?.addEventListener('click', (e) => { if (e.target === viewCustomerModal) closeViewCustomer(); });

/* ============================================================
   Delete Customer modal  → DELETE /api/customers/{id}
   ============================================================ */
const deleteModal = document.getElementById('deleteModal');
let pendingDeleteId = null;

function openDeleteModal(customer) {
  if (readOnlyGuard('customer delete')) return;
  pendingDeleteId = customer.id;
  document.getElementById('deleteCustomerName').textContent = `${customer.name} · ${customer.code}`;
  deleteModal.classList.remove('hidden');
}
function closeDeleteModal() { deleteModal.classList.add('hidden'); pendingDeleteId = null; }
document.getElementById('deleteModalCloseBtn')?.addEventListener('click', closeDeleteModal);
document.getElementById('deleteCancelBtn')?.addEventListener('click', closeDeleteModal);
deleteModal?.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

document.getElementById('deleteConfirmBtn')?.addEventListener('click', async () => {
  if (readOnlyGuard('customer delete confirm')) return;
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const btn = document.getElementById('deleteConfirmBtn');
  btn.disabled = true;
  try {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    showToast('Customer deleted');
    closeDeleteModal();
    await refreshAll();
  } catch (err) {
    // e.g. "This customer has projects. Delete or move them first"
    showToast(err.message);
    closeDeleteModal();
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   Table row actions
   ============================================================ */
document.getElementById('customerTbody')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();
  const id = Number(btn.getAttribute('data-id'));
  const customer = customers.find(c => c.id === id);
  if (!customer) return;
  const action = btn.getAttribute('data-action');
  if (action === 'view') openViewCustomer(customer);
  else if (action === 'edit') openCustomerForm('edit', customer);
  else if (action === 'delete') openDeleteModal(customer);
  else if (action === 'quote') { if (!readOnlyGuard('create quotation')) showToast(`Quotation flow started for ${customer.name}`); }
});

/* ============================================================
   Customer History accordion  → GET /api/customers/{id}/history
   History is fetched lazily the first time a card is opened.
   ============================================================ */
const historyCache = {};   // customerId → rendered entries

const HISTORY_LABEL = { CREATE: 'Customer Created', UPDATE: 'Customer Updated', STATUS_CHANGE: 'Status Changed', DELETE: 'Customer Deleted' };
function historyLabel(h) {
  const keys = Array.isArray(h.changes) ? h.changes.map(c => c.field || '') : [];
  if (h.action === 'UPDATE' && keys.length && keys.every(k => k.startsWith('followup'))) return 'Follow-up Logged';
  return HISTORY_LABEL[h.action] || cap((h.action || '').replace(/_/g, ' '));
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (customers.length === 0) {
    list.innerHTML = `<p style="font-size:12px;color:#9CA3AF;padding:8px 2px;">No history recorded yet.</p>`;
    return;
  }
  list.innerHTML = customers.map(c => `
    <div class="history-card" data-id="${c.id}">
      <div class="history-card-head" data-toggle="${c.id}">
        <div>
          <p class="history-card-name">${esc(c.name)}</p>
          <p class="history-card-sub">${esc(c.code)} · click to view activity</p>
        </div>
        <svg class="history-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="history-card-body"><ul class="history-timeline" id="hist-${c.id}"></ul></div>
    </div>`).join('');

  list.querySelectorAll('[data-toggle]').forEach(head => {
    head.addEventListener('click', async () => {
      const card = head.closest('.history-card');
      card.classList.toggle('open');
      if (card.classList.contains('open')) await loadHistory(Number(head.getAttribute('data-toggle')));
    });
  });
}

async function loadHistory(customerId) {
  const ul = document.getElementById(`hist-${customerId}`);
  if (!ul) return;
  if (historyCache[customerId]) { paintHistory(ul, historyCache[customerId]); return; }
  ul.innerHTML = `<li><span class="history-dot"></span><span>Loading…</span></li>`;
  try {
    const rows = (await api(`/api/customers/${customerId}/history`)) || [];
    historyCache[customerId] = rows;
    paintHistory(ul, rows);
    const c = customers.find(x => x.id === customerId);
    const sub = ul.closest('.history-card')?.querySelector('.history-card-sub');
    if (sub && c) sub.textContent = `${c.code} · ${rows.length} activit${rows.length === 1 ? 'y' : 'ies'}`;
  } catch (err) {
    ul.innerHTML = `<li><span class="history-dot"></span><span>${esc(err.message)}</span></li>`;
  }
}
function paintHistory(ul, rows) {
  if (!rows.length) { ul.innerHTML = `<li><span class="history-dot"></span><span>No activity yet.</span></li>`; return; }
  ul.innerHTML = rows.map(h => `
    <li><span class="history-dot"></span><span>${esc(historyLabel(h))}
      <span class="h-when">${esc(formatDateTimeDisplay(h.createdAt))}${h.actorName ? ' · ' + esc(h.actorName) : ''}</span></span></li>`).join('');
}

/* ============================================================
   Follow-ups  → GET /api/customers/followups, POST /api/customers/{id}/followups
   ============================================================ */
async function loadFollowups() {
  const tbody = document.getElementById('followupTbody');
  try {
    const page = await api('/api/customers/followups', { params: { page: 0, size: 50 } });
    followups = page.content || [];
    renderFollowups();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px 8px;">${esc(err.message)}</td></tr>`;
  }
}

function renderFollowups() {
  const tbody = document.getElementById('followupTbody');
  if (followups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px 8px;">No follow-up activities yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = followups.map(f => `
    <tr>
      <td data-label="Follow-up Date">${formatDateDisplay(f.followupDate)}</td>
      <td data-label="Customer">${esc(f.customerName || f.customerCode)}</td>
      <td data-label="Remarks">${esc(f.remark) || '—'}</td>
      <td data-label="Next Follow-up Date">${formatDateDisplay(f.nextDate)}</td>
      <td data-label="Status"><span class="pill ${followupPillClass[f.status] || ''}">${esc(cap(f.status))}</span></td>
    </tr>`).join('');
}

const followupModal = document.getElementById('followupModal');
let followupCustomers = [];   // customers shown in the follow-up dropdown

async function openFollowupModal() {
  if (readOnlyGuard('add follow-up')) return;
  // The dropdown needs ALL visible customers, not only the current table page.
  try {
    const page = await api('/api/customers', { params: { page: 0, size: 100, sort: 'name,asc' } });
    followupCustomers = page.content || [];
  } catch (err) { showToast(err.message); return; }
  if (followupCustomers.length === 0) { showToast('Add a customer first'); return; }

  buildDynamicSelect(
    'fuCustomerSelect', 'fuCustomer',
    followupCustomers.map(c => ({ value: c.id, label: `${c.name} · ${c.code}` })),
    followupCustomers[0].id, 'Select customer'
  );
  setVal('fuDate', new Date().toISOString().slice(0, 10));
  setVal('fuNextDate', '');
  setVal('fuRemark', '');
  setVal('fuStatus', 'Pending');
  fuStatusCtrl?.setValue('Pending');
  followupModal.classList.remove('hidden');
}
function closeFollowupModal() { followupModal.classList.add('hidden'); }

document.getElementById('addFollowupBtn')?.addEventListener('click', openFollowupModal);
document.getElementById('followupCloseBtn')?.addEventListener('click', closeFollowupModal);
document.getElementById('followupCancelBtn')?.addEventListener('click', closeFollowupModal);
followupModal?.addEventListener('click', (e) => { if (e.target === followupModal) closeFollowupModal(); });

document.getElementById('followupSaveBtn')?.addEventListener('click', async () => {
  if (readOnlyGuard('follow-up save')) return;
  const customerId = getVal('fuCustomer');
  const followupDate = getVal('fuDate');
  const nextDate = getVal('fuNextDate');
  const remark = getVal('fuRemark').trim();
  const status = getVal('fuStatus').toUpperCase();   // PENDING | COMPLETED

  if (!customerId || !followupDate) return showToast('Customer and date are required');
  if (!remark) return showToast('Remark is required');
  if (nextDate && nextDate < followupDate) return showToast('Next follow-up cannot be before the follow-up date');

  const btn = document.getElementById('followupSaveBtn');
  btn.disabled = true;
  try {
    await api(`/api/customers/${customerId}/followups`, {
      method: 'POST',
      body: { followupDate, remark, nextDate: nextDate || null, status },
    });
    delete historyCache[Number(customerId)];       // history now has a new entry
    closeFollowupModal();
    showToast('Follow-up added');
    await loadFollowups();
  } catch (err) {
    showToast(err.fieldErrors && err.fieldErrors.length ? err.fieldErrors.map(f => f.message).join(', ') : err.message);
  } finally {
    btn.disabled = false;
  }
});

/* ============================================================
   Export / Print — exports ALL customers matching the current filters
   (fetched in pages of 100, the backend maximum). Reads only, so it is
   allowed in view mode (api() adds viewPartnerId to these GETs).
   ============================================================ */
async function fetchAllFilteredCustomers() {
  const all = [];
  let page = 0, pages = 1;
  while (page < pages) {
    const res = await api('/api/customers', {
      params: {
        page, size: 100,
        search: searchTerm.trim(),
        type: typeFilter === 'All' ? '' : typeFilter.toUpperCase(),
        status: statusFilter === 'All' ? '' : statusFilter.toUpperCase(),
      },
    });
    all.push(...(res.content || []));
    pages = res.totalPages || 1;
    page++;
  }
  return all;
}

async function customersToCsvRows() {
  const header = ['Customer ID', 'Name', 'Mobile', 'Email', 'City', 'Type', 'Project Location', 'Status', 'Created Date'];
  const rows = (await fetchAllFilteredCustomers()).map(c =>
    [c.code, c.name, c.mobile, c.email, c.city, cap(c.type), c.projectSummary, cap(c.status), (c.audit && c.audit.createdAt || '').slice(0, 10)]);
  return [header, ...rows];
}

async function downloadDelimited(filename, mime) {
  try {
    const rows = await customersToCsvRows();
    const content = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filename}`);
  } catch (err) { showToast(err.message); }
}

function exportCustomersPDF() { showToast('PDF export will be available soon'); }   // TODO: backend PDF endpoint

document.getElementById('exportCsvBtn')?.addEventListener('click', () => downloadDelimited('customers.csv', 'text/csv;charset=utf-8;'));
document.getElementById('exportExcelBtn')?.addEventListener('click', () => downloadDelimited('customers.xls', 'application/vnd.ms-excel'));
document.getElementById('exportPdfBtn')?.addEventListener('click', exportCustomersPDF);
document.getElementById('printBtn')?.addEventListener('click', () => window.print());

/* ============================================================
   Boot
   ============================================================ */
function applyPermissionVisibility() {
  if (!canWrite('CUSTOMER:CREATE')) {
    document.getElementById('addCustomerBtn')?.classList.add('hidden');
    document.getElementById('addFirstCustomerBtn')?.classList.add('hidden');
  }
  if (!canWrite('CUSTOMER:EDIT')) document.getElementById('addFollowupBtn')?.classList.add('hidden');
}

async function refreshAll() {
  Object.keys(historyCache).forEach(k => delete historyCache[k]);
  await Promise.all([loadSummary(), loadCustomers(), loadFollowups()]);
}

renderViewBanner();
applyPermissionVisibility();

if (!getAccessToken()) {
  // not logged in → back to login
  window.location.href = '../index.html';
} else {
  refreshAll();
}

// session.js may set the role slightly later → re-render the table (no refetch)
// so the action buttons match the role.
window.addEventListener('DOMContentLoaded', () => { if (customers.length) renderTable(); });