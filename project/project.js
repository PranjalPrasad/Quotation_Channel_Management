/* ============================================================
   project.js — Project Management module (backend-integrated)
   Vanilla JS only. Backend: Spring Boot on port 8091.

   Endpoints used
   --------------
   GET    /api/projects?page&size&sort&search&status&type
   GET    /api/projects/summary
   GET    /api/projects/{id}
   POST   /api/projects
   PUT    /api/projects/{id}
   DELETE /api/projects/{id}
   GET    /api/customers?page&size&sort        (customer dropdown in the form)
   POST   /api/auth/refresh                    (silent token refresh)
   ============================================================ */

/* ---------- API config ---------- */
const API_BASE = (window.API_BASE || 'http://localhost:8091').replace(/\/+$/, '');
const SESSION_KEY = 'sqms_session';

/* ============================================================
   Sidebar collapse / expand (shared across all modules)
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

function setSidebarExpanded(next) {
  sidebarExpanded = next;
  sidebar.classList.toggle('expanded', next);
  sidebar.classList.toggle('collapsed', !next);
  toggleIcon.style.transform = next ? 'rotate(180deg)' : 'rotate(0deg)';
  const showBackdrop = next && isDrawerViewport();
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
   session.js owns the login session; these only READ it
   (and write back refreshed tokens). Tolerant of different shapes.
   ============================================================ */
function readSession() {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }
  catch (_) { return null; }
}
function writeSession(obj) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj)); } catch (_) {}
}
function sessionRoot(s) { return s && (s.data && (s.data.accessToken || s.data.token || s.data.user) ? s.data : s); }

function getAccessToken() {
  try { if (window.Session && typeof Session.getToken === 'function') { const t = Session.getToken(); if (t) return t; } } catch (_) {}
  const r = sessionRoot(readSession());
  return r ? (r.accessToken || r.token || null) : null;
}
function getRefreshToken() {
  const r = sessionRoot(readSession());
  return r ? (r.refreshToken || null) : null;
}
function getSessionUser() { const r = sessionRoot(readSession()) || {}; return r.user || null; }
function getRole() {
  if (window.currentUserRole) return window.currentUserRole;
  const r = sessionRoot(readSession()) || {};
  return r.role || (r.user && r.user.role && r.user.role.code) || null;
}
const isSuperAdmin = () => getRole() === 'SUPER_ADMIN';

// If the session has no permission list we don't hide anything (backend still enforces it).
function can(perm) {
  const list = (sessionRoot(readSession()) || {}).permissions;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(perm);
}

/* ---------- Logged-in user name ---------- */
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
    else sessionStorage.removeItem(SESSION_KEY);
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
      const d = (await res.json()).data;
      if (!d || !d.accessToken) return false;
      const s = readSession();
      const root = sessionRoot(s);
      if (s && root) {
        root.accessToken = d.accessToken;
        if ('token' in root) root.token = d.accessToken;
        if (d.refreshToken) root.refreshToken = d.refreshToken;   // refresh token is rotated
        writeSession(s);
      }
      return true;
    } catch (_) { return false; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

async function api(path, { method = 'GET', params, body } = {}, retried = false) {
  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (_) {
    throw new ApiError('Cannot reach the server. Is the backend running on port 8091?', 0);
  }

  if (res.status === 401 && !retried) {
    if (await refreshAccessToken()) return api(path, { method, params, body }, true);
    showToast('Session expired. Please log in again.');
    setTimeout(logoutUser, 800);
    throw new ApiError('Session expired', 401);
  }

  let json = null;
  try { json = await res.json(); } catch (_) {}
  if (!res.ok || (json && json.success === false)) {
    // Debug aid: shows the server's real reason (errorCode + message + field errors) in the console
    console.warn(`[api] ${method} ${url} -> ${res.status}`, json);
    const msg = (json && json.message) || (res.status === 403 ? 'You do not have permission to do this.' : `Request failed (${res.status})`);
    throw new ApiError(msg, res.status, json && json.errorCode, json && json.errors);
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

function closeAllTopbarDropdowns(except) {
  [notifDropdown, profileDropdown, exportMenu].forEach((dd) => {
    if (dd && dd !== except) dd.classList.add('hidden');
  });
}
[[notifBtn, notifDropdown], [profileBtn, profileDropdown], [exportBtn, exportMenu]].forEach(([btn, dd]) => {
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = dd.classList.contains('hidden');
    closeAllTopbarDropdowns();
    dd.classList.toggle('hidden', !willOpen);
  });
});
document.addEventListener('click', () => closeAllTopbarDropdowns());
profileLogoutBtn?.addEventListener('click', logoutUser);

/* ============================================================
   Utilities
   ============================================================ */
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Everything from the server goes through esc() before innerHTML (prevents XSS).
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatINR(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fmtNum = (v) => (num(v) === null ? '—' : num(v).toLocaleString('en-IN'));
const partnerLabel = (p) => (p ? (p.code ? `${p.code} · ${p.name}` : p.name) : '—');

// Backend enums  ⇄  display text
//   RESIDENTIAL ⇄ Residential      IN_PROGRESS ⇄ In Progress      ON_HOLD ⇄ On Hold
const toDisplay = (e) => (e ? e.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : '');
const toApiEnum = (d) => (d ? d.trim().toUpperCase().replace(/\s+/g, '_') : '');

const TYPE_PILL_CLASS = { RESIDENTIAL: 'type-pill-residential', COMMERCIAL: 'type-pill-commercial', INDUSTRIAL: 'type-pill-industrial' };
const STATUS_PILL_CLASS = { PLANNING: 'pill-planning', IN_PROGRESS: 'pill-inprogress', COMPLETED: 'pill-completed', ON_HOLD: 'pill-onhold' };

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
};

/* ---- Estimates for the "Project Details" card ----
   The backend has no cost / panel-count fields (real pricing lives in the
   Quotation module), so these stay as front-end ESTIMATES. */
const COST_RATE_PER_KW = { RESIDENTIAL: 55000, COMMERCIAL: 48000, INDUSTRIAL: 42000 };
const WATTS_PER_PANEL = 340;
const panelCount = (kw) => Math.ceil((kw * 1000) / WATTS_PER_PANEL);
const projectCost = (kw, type) => kw * (COST_RATE_PER_KW[type] || 50000);

/* ============================================================
   State
   ============================================================ */
let projects = [];            // current page from the server
let totalRows = 0;
let totalPages = 1;
let currentPage = 1;          // 1-based in the UI, 0-based on the API
let rowsPerPage = 8;
let sortKey = 'createdDate';
let sortDir = 'desc';
let searchTerm = '';
let statusFilter = '';        // display value ("In Progress") or ''
let loadSeq = 0;              // ignore out-of-order responses

let formMode = 'add';         // 'add' | 'edit'
let editingProjectId = null;  // numeric id
let deleteTargetId = null;    // numeric id
let saving = false;

/* The backend can only sort by these fields. Column key → API field. */
const SORT_FIELD = { id: 'code', name: 'name', capacity: 'capacityKw', status: 'status', createdDate: 'createdAt' };

/* ============================================================
   KPIs  → GET /api/projects/summary
   ============================================================ */
async function loadSummary() {
  try {
    const s = await api('/api/projects/summary');
    document.getElementById('kpiTotalProjects').textContent = s.total;
    document.getElementById('kpiResidential').textContent = s.residential;
    document.getElementById('kpiCommercial').textContent = s.commercial;
    document.getElementById('kpiIndustrial').textContent = s.industrial;
  } catch (err) { showToast(err.message); }
}

/* ============================================================
   Table  → GET /api/projects
   ============================================================ */
const projectsTbody = document.getElementById('projectsTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const emptyState = document.getElementById('emptyState');

function listParams(page, size) {
  return {
    page, size,
    sort: `${SORT_FIELD[sortKey] || 'createdAt'},${sortDir}`,
    search: searchTerm.trim(),
    status: toApiEnum(statusFilter),
  };
}

async function loadProjects() {
  const seq = ++loadSeq;
  rowsRangeLabel.textContent = 'Loading…';
  try {
    const page = await api('/api/projects', { params: listParams(currentPage - 1, rowsPerPage) });
    if (seq !== loadSeq) return;                 // a newer request is in flight

    projects = page.content || [];
    totalRows = page.totalElements || 0;
    totalPages = Math.max(1, page.totalPages || 1);

    // page vanished (e.g. last row on the last page was deleted) → jump to the new last page
    if (projects.length === 0 && currentPage > 1 && totalRows > 0) {
      currentPage = totalPages;
      return loadProjects();
    }
    renderTable();
  } catch (err) {
    if (seq !== loadSeq) return;
    projects = []; totalRows = 0; totalPages = 1;
    renderTable();
    showToast(err.message);
  }
}

function applyRoleBasedVisibility() {
  const role = getRole();
  document.querySelectorAll('[data-role]').forEach(el => {
    const roles = el.getAttribute('data-role').split(',').map(r => r.trim());
    el.style.display = roles.includes(role) ? '' : 'none';
  });
}

function actionIconsHtml(id) {
  const btns = [`<button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>`];
  if (can('PROJECT:EDIT')) btns.push(`<button class="action-icon-btn icon-edit" data-action="edit" data-id="${id}" title="Edit">${ICONS.edit}</button>`);
  if (can('PROJECT:DELETE')) btns.push(`<button class="action-icon-btn icon-delete" data-action="delete" data-id="${id}" title="Delete">${ICONS.delete}</button>`);
  return `<div class="row-actions">${btns.join('')}</div>`;
}

function renderTable() {
  emptyState.classList.toggle('hidden', totalRows !== 0);
  projectsTbody.closest('table').style.display = totalRows === 0 ? 'none' : '';

  const showChannelPartner = isSuperAdmin();

  projectsTbody.innerHTML = projects.map((p) => {
    const partnerCell = showChannelPartner ? `<td data-label="Channel Partner">${esc(partnerLabel(p.partner))}</td>` : '';
    return `
      <tr data-id="${p.id}">
        <td data-label="Project ID" class="font-medium">${esc(p.code)}</td>
        <td data-label="Project Name">${esc(p.name)}</td>
        <td data-label="Customer">${esc(p.customer && p.customer.name) || '—'}</td>
        ${partnerCell}
        <td data-label="Type"><span class="type-pill ${TYPE_PILL_CLASS[p.type] || ''}">${esc(toDisplay(p.type))}</span></td>
        <td data-label="Capacity (kW)">${fmtNum(p.capacityKw)} kW</td>
        <td data-label="Roof Type">${esc(p.roofType) || '—'}</td>
        <td data-label="Monthly Consumption">${num(p.monthlyConsumption) === null ? '—' : fmtNum(p.monthlyConsumption) + ' units'}</td>
        <td data-label="Location">${esc(p.location) || '—'}</td>
        <td data-label="Est. Generation">${num(p.estimatedGeneration) === null ? '—' : fmtNum(p.estimatedGeneration) + ' units'}</td>
        <td data-label="Status"><span class="pill ${STATUS_PILL_CLASS[p.status] || ''}">${esc(toDisplay(p.status))}</span></td>
        <td data-label="Created Date">${formatDate(p.audit && p.audit.createdAt)}</td>
        <td data-label="Actions">${actionIconsHtml(p.id)}</td>
      </tr>`;
  }).join('');

  document.querySelectorAll('#projectsTable thead th[data-role="SUPER_ADMIN"]').forEach(th => {
    th.style.display = showChannelPartner ? '' : 'none';
  });

  const start = (currentPage - 1) * rowsPerPage;
  rowsRangeLabel.textContent = totalRows === 0 ? 'No records' : `${start + 1}–${start + projects.length} of ${totalRows}`;

  renderPagination();
  updateSortIcons();
}

function renderPagination() {
  let html = `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
      if (p === 2 || p === totalPages - 1) html += `<span class="pagination-btn disabled">…</span>`;
      continue;
    }
    html += `<span class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</span>`;
  paginationControls.innerHTML = html;

  paginationControls.querySelectorAll('.pagination-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-page');
      if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      loadProjects();
    });
  });
}

/* ---------- Sorting (server-side; only columns the API supports) ---------- */
function updateSortIcons() {
  document.querySelectorAll('#projectsTable thead th[data-key]').forEach(th => {
    const key = th.getAttribute('data-key');
    const icon = th.querySelector('.sort-icon');
    if (!SORT_FIELD[key]) return;                       // not sortable → no icon
    th.classList.toggle('sorted', key === sortKey);
    if (icon) icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#projectsTable thead th[data-key]').forEach(th => {
  const key = th.getAttribute('data-key');
  if (!SORT_FIELD[key]) {                               // the backend can't sort this column
    th.querySelector('.sort-icon')?.remove();
    th.style.cursor = 'default';
    return;
  }
  th.addEventListener('click', () => {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    currentPage = 1;
    loadProjects();
  });
});

rowsPerPageSelect?.addEventListener('change', () => {
  rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
  currentPage = 1;
  loadProjects();
});

/* ============================================================
   Search & filter
   The API has ONE `search` parameter that matches project name, project
   code, location AND customer name. So the three separate boxes become
   a single search box (#searchProjectName).
   ============================================================ */
const searchProjectNameInput = document.getElementById('searchProjectName');
const filterStatus = document.getElementById('filterStatus');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Safety net if the old Customer / Location boxes are still in the HTML.
['searchCustomerName', 'searchLocation'].forEach(id => document.getElementById(id)?.closest('.filter-field')?.remove());
if (searchProjectNameInput) searchProjectNameInput.placeholder = 'Search project, customer, code or location…';

const debouncedSearch = debounce(() => { currentPage = 1; loadProjects(); }, 350);
searchProjectNameInput?.addEventListener('input', () => { searchTerm = searchProjectNameInput.value; debouncedSearch(); });
filterStatus?.addEventListener('change', () => { statusFilter = filterStatus.value; currentPage = 1; loadProjects(); });
resetFiltersBtn?.addEventListener('click', () => {
  searchTerm = ''; statusFilter = '';
  if (searchProjectNameInput) searchProjectNameInput.value = '';
  if (filterStatus) filterStatus.value = '';
  currentPage = 1;
  loadProjects();
});

/* ============================================================
   Modal helpers
   ============================================================ */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(o => o.classList.add('hidden'));
});

/* ============================================================
   Customer dropdown for the form  → GET /api/customers
   (API max page size is 100, so we page until everything is loaded)
   ============================================================ */
let customerOptions = [];    // full customer objects

async function loadCustomerOptions() {
  const all = [];
  let page = 0, pages = 1;
  while (page < pages) {
    const res = await api('/api/customers', { params: { page, size: 100, sort: 'name,asc' } });
    all.push(...(res.content || []));
    pages = res.totalPages || 1;
    page++;
  }
  customerOptions = all;
}

function fillCustomerSelect(selectedId, onlyPartnerId) {
  const sel = fld.customer;
  let list = customerOptions;
  if (onlyPartnerId) list = list.filter(c => c.partner && c.partner.id === onlyPartnerId);   // edit: same partner only

  sel.innerHTML = `<option value="">Select customer</option>` + list.map(c => {
    const partner = isSuperAdmin() && c.partner ? ` — ${c.partner.name}` : '';
    const inactive = c.status === 'INACTIVE' ? ' (inactive)' : '';
    return `<option value="${c.id}">${esc(c.name)} · ${esc(c.code)}${esc(partner)}${inactive}</option>`;
  }).join('');
  sel.value = selectedId ? String(selectedId) : '';
  syncPartnerFromCustomer();
}

// A project belongs to its customer's channel partner — show it, never edit it.
function syncPartnerFromCustomer() {
  const c = customerOptions.find(x => String(x.id) === fld.customer.value);
  if (fld.channelPartner) {
    fld.channelPartner.readOnly = true;
    fld.channelPartner.placeholder = 'Set automatically from the customer';
    fld.channelPartner.value = c ? partnerLabel(c.partner) : '';
  }
}

/* ============================================================
   Add / Edit Project form
   ============================================================ */
const projectFormTitle = document.getElementById('projectFormTitle');
const projectFormSubtitle = document.getElementById('projectFormSubtitle');
const projectForm = document.getElementById('projectForm');
const projectFormError = document.getElementById('projectFormError');
const projectFormSaveBtn = document.getElementById('projectFormSaveBtn');

// project.html must have <select id="fldCustomer">. If it still has the old text input,
// swap it for a select here so a name is never sent where the API needs a customerId.
(function ensureCustomerSelect() {
  const el = document.getElementById('fldCustomer');
  if (el && el.tagName !== 'SELECT') {
    const sel = document.createElement('select');
    sel.id = 'fldCustomer';
    sel.className = el.className;
    sel.required = true;
    sel.innerHTML = '<option value="">Select customer</option>';
    el.replaceWith(sel);
  }
})();

const fld = {
  name: document.getElementById('fldProjectName'),
  customer: document.getElementById('fldCustomer'),                 // now a <select>
  channelPartner: document.getElementById('fldChannelPartner'),
  type: document.getElementById('fldType'),
  capacity: document.getElementById('fldCapacity'),
  roofType: document.getElementById('fldRoofType'),
  monthlyConsumption: document.getElementById('fldMonthlyConsumption'),
  location: document.getElementById('fldLocation'),
  roofArea: document.getElementById('fldRoofArea'),
  estimatedGeneration: document.getElementById('fldEstimatedGeneration'),
  installationType: document.getElementById('fldInstallationType'), // optional new select
  status: document.getElementById('fldStatus'),
  remarks: document.getElementById('fldRemarks'),
};

fld.customer?.addEventListener('change', syncPartnerFromCustomer);

function showFormError(msg) {
  projectFormError.textContent = msg;
  projectFormError.classList.remove('hidden');
}

async function openAddProjectModal() {
  formMode = 'add';
  editingProjectId = null;
  projectForm.reset();
  projectFormError.classList.add('hidden');
  projectFormTitle.textContent = 'Add Project';
  projectFormSubtitle.textContent = 'Create a new solar project';
  projectFormSaveBtn.textContent = 'Save';

  try { await loadCustomerOptions(); } catch (err) { showToast(err.message); return; }
  if (customerOptions.length === 0) { showToast('Add a customer first, then create a project'); return; }
  fillCustomerSelect('', null);
  openModal('projectFormModal');
}

async function openEditProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  formMode = 'edit';
  editingProjectId = id;
  projectForm.reset();
  projectFormError.classList.add('hidden');
  projectFormTitle.textContent = 'Edit Project';
  projectFormSubtitle.textContent = `${p.code} · Update project details`;
  projectFormSaveBtn.textContent = 'Update';

  try { await loadCustomerOptions(); } catch (err) { showToast(err.message); return; }
  // the backend only allows moving a project to a customer of the SAME partner
  fillCustomerSelect(p.customer && p.customer.id, p.partner && p.partner.id);

  fld.name.value = p.name || '';
  fld.type.value = toDisplay(p.type);
  fld.capacity.value = num(p.capacityKw) ?? '';
  fld.roofType.value = p.roofType || fld.roofType.options[0].value;
  fld.monthlyConsumption.value = num(p.monthlyConsumption) ?? '';
  fld.location.value = p.location || '';
  fld.roofArea.value = num(p.roofArea) ?? '';
  fld.estimatedGeneration.value = num(p.estimatedGeneration) ?? '';
  if (fld.installationType) fld.installationType.value = p.installationType || 'Rooftop';
  fld.status.value = toDisplay(p.status);
  fld.remarks.value = p.remarks || '';
  fld.channelPartner.value = partnerLabel(p.partner);

  openModal('projectFormModal');
}

document.getElementById('addProjectBtn')?.addEventListener('click', openAddProjectModal);

projectFormSaveBtn?.addEventListener('click', async () => {
  if (saving) return;
  projectFormError.classList.add('hidden');

  const name = fld.name.value.trim();
  const customerId = fld.customer.value;
  const capacity = parseFloat(fld.capacity.value);
  const location = fld.location.value.trim();

  if (!name || !customerId || !Number.isFinite(Number(customerId)) || !location || !(capacity >= 0.1)) {
    showFormError('Please fill in project name, customer, location and a capacity of at least 0.1 kW.');
    return;
  }

  // Blank optional numbers are sent as null (NOT 0). A blank "Estimated Generation"
  // makes the backend calculate it from the capacity.
  const optNum = (el) => (el.value === '' ? null : Number(el.value));
  const existing = formMode === 'edit' ? projects.find(x => x.id === editingProjectId) : null;

  const payload = {
    name,
    customerId: Number(customerId),
    type: toApiEnum(fld.type.value),
    capacityKw: capacity,
    roofType: fld.roofType.value,
    monthlyConsumption: optNum(fld.monthlyConsumption),
    location,
    roofArea: optNum(fld.roofArea),
    estimatedGeneration: optNum(fld.estimatedGeneration),
    // PUT replaces every field, so keep the stored installation type if the form has no input for it
    installationType: fld.installationType ? fld.installationType.value : (existing && existing.installationType) || 'Rooftop',
    status: toApiEnum(fld.status.value),
    remarks: fld.remarks.value.trim(),
  };

  const originalText = projectFormSaveBtn.textContent;
  saving = true; projectFormSaveBtn.disabled = true; projectFormSaveBtn.textContent = 'Saving…';
  try {
    if (formMode === 'add') {
      const created = await api('/api/projects', { method: 'POST', body: payload });
      showToast(`Project ${created.code} added`);
      sortKey = 'createdDate'; sortDir = 'desc'; currentPage = 1;
    } else {
      const updated = await api(`/api/projects/${editingProjectId}`, { method: 'PUT', body: payload });
      showToast(`Project ${updated.code} updated`);
    }
    closeModal('projectFormModal');
    await refreshAll();
  } catch (err) {
    const fieldMsgs = (err.fieldErrors || []).map(f => `${f.field}: ${f.message}`);
    showFormError(fieldMsgs.length ? fieldMsgs.join(' · ') : err.message);
  } finally {
    saving = false; projectFormSaveBtn.disabled = false; projectFormSaveBtn.textContent = originalText;
  }
});

/* ============================================================
   View Project modal  (instant from the row, then refreshed by GET /{id})
   ============================================================ */
function renderViewProject(p) {
  const kw = num(p.capacityKw) || 0;
  const text = (id, v) => { document.getElementById(id).textContent = v; };

  text('viewProjectSubtitle', `${p.code} · Read-only`);
  text('viewId', p.code);
  text('viewName', p.name);
  text('viewCustomer', (p.customer && p.customer.name) || '—');
  text('viewChannelPartner', partnerLabel(p.partner));
  text('viewType', toDisplay(p.type));
  text('viewCapacity', `${fmtNum(p.capacityKw)} kW`);
  text('viewRoofType', p.roofType || '—');
  text('viewMonthlyConsumption', num(p.monthlyConsumption) === null ? '—' : `${fmtNum(p.monthlyConsumption)} units`);
  text('viewLocation', p.location || '—');
  text('viewRoofArea', num(p.roofArea) ? `${fmtNum(p.roofArea)} sq ft` : '—');
  text('viewEstimatedGeneration', num(p.estimatedGeneration) === null ? '—' : `${fmtNum(p.estimatedGeneration)} units/month`);
  text('viewStatus', toDisplay(p.status));
  text('viewCreatedDate', formatDate(p.audit && p.audit.createdAt));
  text('viewRemarks', p.remarks && p.remarks.trim() ? p.remarks : 'No remarks added.');

  // ---- Project Details card ----
  text('pdCapacity', `${fmtNum(p.capacityKw)} kW`);
  text('pdPanelCount', `${panelCount(kw)} panels`);
  text('pdEstimatedUnits', num(p.estimatedGeneration) === null ? '—' : `${(num(p.estimatedGeneration) * 12).toLocaleString('en-IN')} units/yr`);
  text('pdInstallationType', p.installationType || '—');
  text('pdProjectCost', `${formatINR(projectCost(kw, p.type))} (est.)`);
}

async function openViewProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  renderViewProject(p);
  openModal('viewProjectModal');
  try { renderViewProject(await api(`/api/projects/${id}`)); } catch (_) { /* keep the row data */ }
}

/* ============================================================
   Delete Project  → DELETE /api/projects/{id}
   ============================================================ */
function openDeleteModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  document.getElementById('deleteProjectName').textContent = p.name;
  openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  if (deleteTargetId === null) return;
  const p = projects.find(x => x.id === deleteTargetId);
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  try {
    await api(`/api/projects/${deleteTargetId}`, { method: 'DELETE' });
    showToast(`Project "${p ? p.name : ''}" deleted`);
    closeModal('deleteModal');
    deleteTargetId = null;
    await refreshAll();
  } catch (err) {
    showToast(err.message);
    closeModal('deleteModal');
  } finally { btn.disabled = false; }
});

/* ============================================================
   Row action wiring
   ============================================================ */
projectsTbody?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();
  const id = Number(btn.getAttribute('data-id'));
  const action = btn.getAttribute('data-action');
  if (action === 'view') openViewProjectModal(id);
  else if (action === 'edit') openEditProjectModal(id);
  else if (action === 'delete') openDeleteModal(id);
});

/* ============================================================
   Export / Print — exports ALL projects matching the current search,
   status filter and sort (fetched in pages of 100, the API maximum)
   ============================================================ */
async function fetchAllFilteredProjects() {
  const all = [];
  let page = 0, pages = 1;
  while (page < pages) {
    const res = await api('/api/projects', { params: listParams(page, 100) });
    all.push(...(res.content || []));
    pages = res.totalPages || 1;
    page++;
  }
  return all;
}

async function projectsToCsvRows() {
  const showPartner = isSuperAdmin();
  const header = ['Project ID', 'Project Name', 'Customer', 'Type', 'Capacity (kW)', 'Roof Type', 'Monthly Consumption', 'Location', 'Est. Generation', 'Status', 'Created Date', 'Remarks'];
  if (showPartner) header.push('Channel Partner');
  const rows = (await fetchAllFilteredProjects()).map(p => {
    const row = [p.code, p.name, p.customer && p.customer.name, toDisplay(p.type), num(p.capacityKw), p.roofType,
      num(p.monthlyConsumption), p.location, num(p.estimatedGeneration), toDisplay(p.status),
      ((p.audit && p.audit.createdAt) || '').slice(0, 10), p.remarks || ''];
    if (showPartner) row.push(partnerLabel(p.partner));
    return row;
  });
  return [header, ...rows];
}

async function downloadDelimited(filename, mime) {
  try {
    const rows = await projectsToCsvRows();
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

document.getElementById('exportCsvBtn')?.addEventListener('click', () => downloadDelimited('projects.csv', 'text/csv;charset=utf-8;'));
document.getElementById('exportExcelBtn')?.addEventListener('click', () => downloadDelimited('projects.xls', 'application/vnd.ms-excel'));
document.getElementById('exportPdfBtn')?.addEventListener('click', () => showToast('PDF export will be available soon'));   // TODO: backend PDF endpoint
document.getElementById('printBtn')?.addEventListener('click', () => window.print());

/* ============================================================
   Boot
   ============================================================ */
function applyPermissionVisibility() {
  if (!can('PROJECT:CREATE')) document.getElementById('addProjectBtn')?.classList.add('hidden');
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadProjects()]);
}

applyRoleBasedVisibility();
applyPermissionVisibility();

if (!getAccessToken()) {
  window.location.href = '../index.html';      // not logged in
} else {
  refreshAll();
}

// session.js may set the role slightly later → re-apply so the Channel Partner column shows/hides correctly.
window.addEventListener('DOMContentLoaded', () => {
  applyRoleBasedVisibility();
  if (projects.length) renderTable();
});