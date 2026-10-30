// ============================================================
// Channel Partner Management — integrated with the Spring Boot backend (port 8091)
//
// session.js (loaded first) provides Session.api(path, { method, body }) which adds the Bearer token,
// refreshes it on 401 and returns the JSON envelope { success, message, data }.
// referral.js (loaded before this file) provides window.Referral (referral API layer).
//
// Endpoints used:
//   GET   /api/channel-partners?page=&size=            list (all pages are loaded; search/filter/sort run in the browser)
//   POST  /api/channel-partners                        create (also creates the first admin user)
//   PUT   /api/channel-partners/{id}                   update
//   PATCH /api/channel-partners/{id}/status            { status: ACTIVE | INACTIVE }
//   GET   /api/channel-partners/{id}/stats             customers / projects / quotations / users
//   GET   /api/channel-partners/{id}/users             team of the partner
//   + /api/referrals/...  (see referral.js)
// ============================================================

// ============================================================
// Access guard — this module is Super Admin only.
// ============================================================
if (window.currentUserRole !== 'SUPER_ADMIN') {
  window.location.replace('../dashboard/dashboard.html');
  throw new Error('Access denied: Super Admin only');
}

// ============================================================
// API layer
// ============================================================
const ENDPOINTS = {
  list: '/api/channel-partners',
  one: (id) => `/api/channel-partners/${encodeURIComponent(id)}`,
  status: (id) => `/api/channel-partners/${encodeURIComponent(id)}/status`,
  stats: (id) => `/api/channel-partners/${encodeURIComponent(id)}/stats`,
  users: (id) => `/api/channel-partners/${encodeURIComponent(id)}/users?page=0&size=100`,
};

// Backend caps the page size at 100 (PageFilterRequestDto.MAX_SIZE)
const FETCH_PAGE_SIZE = 100;

/** Calls the backend through session.js and returns the unwrapped `data`. */
async function call(path, method, body) {
  if (!window.Session || typeof Session.api !== 'function') {
    throw new Error('Session is not available (is session.js loaded?)');
  }
  const opts = { method: method || 'GET' };
  if (body !== undefined) opts.body = body;
  const res = await Session.api(path, opts);
  return res && res.data !== undefined ? res.data : res;
}

const num = (v, fallback) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || isNaN(n) ? fallback : n;
};

const toArray = (data) => Array.isArray(data) ? data
  : Array.isArray(data && data.content) ? data.content
  : [];

const uiStatus = (s) => {
  const v = String(s || 'ACTIVE').toLowerCase();
  return v.charAt(0).toUpperCase() + v.slice(1);   // ACTIVE -> Active
};

/** Maps one backend ChannelPartnerResponseDto to the shape this screen uses. */
function normalizePartner(r) {
  const st = r.stats || {};
  return {
    id: r.id,
    code: r.code || '',
    name: r.name || '',
    contact: r.contactPerson || '',
    phone: r.phone || '',
    email: r.email || '',
    gst: r.gstNo || '',
    address: r.address || '',
    status: uiStatus(r.status),
    createdDate: String(r.createdAt || '').slice(0, 10),
    referralCode: r.referralCode || '',
    referralPercent: r.referralPercent != null ? Number(r.referralPercent) : 0,
    stats: {
      customers: num(st.customers, 0),
      projects: num(st.projects, 0),
      quotations: num(st.quotations, 0),
      users: num(st.users, 0),
    },
  };
}

/** Loads every partner (all pages). */
async function fetchAllPartners() {
  let all = [];
  let page = 0;
  for (;;) {
    const data = await call(`${ENDPOINTS.list}?page=${page}&size=${FETCH_PAGE_SIZE}&sort=createdAt,desc`);
    const rows = toArray(data);
    all = all.concat(rows);
    const totalPages = num(data && data.totalPages, 1);
    page++;
    if (!rows.length || page >= totalPages) break;
  }
  return all.map(normalizePartner);
}

/** Readable text for a thrown API error (includes field-level validation messages). */
function errorMessage(err, fallback) {
  if (err && err.status === 403) return 'You do not have permission to do that.';
  const detail = err && Array.isArray(err.errors) && err.errors.length
    ? err.errors.map((x) => {
        const f = x.field || x.fieldName || x.path;
        return (f ? f + ': ' : '') + (x.message || x.defaultMessage || '');
      }).join(' • ')
    : '';
  return detail || (err && err.message) || fallback;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML.replace(/"/g, '&quot;');
}

/** Disables a button + shows "Please wait…" while fn runs, always restores it. */
async function withBusy(btn, fn) {
  if (!btn || btn.disabled) return;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="margin-right:6px"></span>Please wait…';
  try { return await fn(); }
  finally { btn.disabled = false; btn.innerHTML = html; }
}

// ============================================================
// Sidebar collapse / expand (shared across all modules)
// ============================================================
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
sidebarToggle.addEventListener('click', () => setSidebarExpanded(!sidebarExpanded));
sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));
drawerMQ.addEventListener('change', () => setSidebarExpanded(defaultSidebarState()));

document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item') && isDrawerViewport()) setSidebarExpanded(false);
});

// ============================================================
// Logged-in user's name (avatar initial + profile dropdown)
// ============================================================
function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (_) { return null; }
}

function getLoggedInUserName() {
  const sources = [];
  try {
    if (window.Session) {
      if (typeof Session.getUser === 'function') sources.push(Session.getUser());
      if (typeof Session.getSession === 'function') sources.push(Session.getSession());
      if (Session.user) sources.push(Session.user);
    }
  } catch (_) {}
  try {
    const raw = sessionStorage.getItem('sqms_session');
    if (raw) sources.push(JSON.parse(raw));
  } catch (_) {}

  for (const s of sources.filter(Boolean)) {
    const u = s.user || s.data?.user || s.data || s;
    const name =
      u.fullName || u.name || u.userName || u.username ||
      [u.firstName, u.lastName].filter(Boolean).join(' ') ||
      (u.email ? u.email.split('@')[0] : '');
    if (name) return String(name).trim();

    const token = s.token || s.accessToken || u.token;
    const claims = token ? decodeJwtPayload(token) : null;
    const fromJwt = claims && (claims.name || claims.fullName || claims.username || claims.sub);
    if (fromJwt) return String(fromJwt).trim();
  }
  return 'User';
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
    else sessionStorage.removeItem('sqms_session');
  } catch (_) {}
  window.location.href = '../index.html';
}

// ============================================================
// Role-based visibility for [data-role] elements
// ============================================================
function applyRoleBasedVisibility() {
  const userRole = window.currentUserRole;
  document.querySelectorAll('[data-role]').forEach((el) => {
    const roles = el.getAttribute('data-role').split(',').map((r) => r.trim());
    el.style.display = roles.includes(userRole) ? '' : 'none';
  });
}
applyRoleBasedVisibility();
window.addEventListener('DOMContentLoaded', applyRoleBasedVisibility);

// ============================================================
// Toast
// ============================================================
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ============================================================
// Data + state
// ============================================================
let partners = [];
let isLoading = true;
let loadError = '';

const sameId = (a, b) => String(a) === String(b);
const findPartner = (id) => partners.find((p) => sameId(p.id, id));

async function loadPartners() {
  isLoading = true;
  loadError = '';
  renderTable();
  try {
    partners = await fetchAllPartners();
  } catch (err) {
    console.error('Failed to load channel partners:', err);
    partners = [];
    loadError = errorMessage(err, 'Could not load channel partners.');
  } finally {
    isLoading = false;
  }
  renderKpis();
  renderTable();
}

/** Reload quietly after a change (no loading flash). */
async function refreshPartners() {
  try {
    partners = await fetchAllPartners();
    loadError = '';
  } catch (err) {
    showToast(errorMessage(err, 'Saved, but the list could not be refreshed.'));
    return false;
  }
  renderKpis();
  renderTable();
  return true;
}

// ============================================================
// KPI calculations
// ============================================================
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatINR(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

// Per-partner referral totals of the rows currently on screen (partnerId -> totals)
const referralTotals = {};

async function loadReferralTotals(rows) {
  try {
    const ids = rows.map((p) => p.id).filter((x) => x != null);
    Object.assign(referralTotals, await Referral.partnerTotals(ids));
    for (const p of rows) {
      const cell = document.querySelector(`[data-ref-income="${p.id}"]`);
      if (cell) cell.textContent = formatINR(referralTotals[p.id]?.totalEarned ?? 0);
    }
  } catch (e) {
    document.querySelectorAll('[data-ref-income]').forEach((c) => { if (c.textContent === '…') c.textContent = '—'; });
    showToast(errorMessage(e, 'Could not load referral income'));
  }
}

async function loadReferralPayoutKpi() {
  const el = document.getElementById('kpiReferralPayoutsMonth');
  if (!el) return;
  try { el.textContent = formatINR((await Referral.summary()).paidThisMonth); }
  catch (e) { el.textContent = '—'; }
}

function renderKpis() {
  const monthKey = currentMonthKey();
  document.getElementById('kpiTotalPartners').textContent = partners.length;
  document.getElementById('kpiActivePartners').textContent = partners.filter((p) => p.status === 'Active').length;
  document.getElementById('kpiInactivePartners').textContent = partners.filter((p) => p.status === 'Inactive').length;
  document.getElementById('kpiNewThisMonth').textContent = partners.filter((p) => p.createdDate.startsWith(monthKey)).length;
  loadReferralPayoutKpi();
}

// ============================================================
// Table: search, filter, sort, paginate
// ============================================================
let sortKey = 'createdDate';
let sortDir = 'desc';
let currentPage = 1;
let rowsPerPage = 10;
let searchTerm = '';
let statusFilter = 'all';

const pTbody = document.getElementById('partnersTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const searchInput = document.getElementById('partnerSearchInput');
const statusFilterSelect = document.getElementById('partnerStatusFilter');

function filteredSortedPartners() {
  let list = [...partners];

  if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);
  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    list = list.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term));
  }

  list.sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === 'createdDate') {
      av = new Date(av).getTime() || 0;
      bv = new Date(bv).getTime() || 0;
    } else {
      av = String(av ?? '').toLowerCase();
      bv = String(bv ?? '').toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

const tableStatusPillClass = { Active: 'pill-accepted', Inactive: 'pill-rejected' };

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  deactivate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line></svg>',
  activate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
};

function actionIconsHtml(p) {
  const active = p.status === 'Active';
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${escapeHtml(p.id)}" title="View">${ICONS.view}</button>
      <button class="action-icon-btn icon-edit" data-action="edit" data-id="${escapeHtml(p.id)}" title="Edit">${ICONS.edit}</button>
      <button class="action-icon-btn icon-team" data-action="team" data-id="${escapeHtml(p.id)}" title="View Team">${ICONS.team}</button>
      <button class="action-icon-btn ${active ? 'icon-deactivate' : 'icon-activate'}" data-action="${active ? 'deactivate' : 'activate'}" data-id="${escapeHtml(p.id)}" title="${active ? 'Deactivate' : 'Activate'}">${active ? ICONS.deactivate : ICONS.activate}</button>
    </div>`;
}

function formatDateDisplay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return escapeHtml(String(iso));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stateRow(html) {
  return `<tr class="table-state-row"><td class="table-state-cell" colspan="10">${html}</td></tr>`;
}

function renderTable() {
  // loading / error states
  if (isLoading) {
    pTbody.innerHTML = stateRow('<span class="spinner"></span>Loading channel partners…');
    rowsRangeLabel.textContent = '';
    paginationControls.innerHTML = '';
    return;
  }
  if (loadError) {
    pTbody.innerHTML = stateRow(`${escapeHtml(loadError)}<br><button type="button" class="btn-primary" id="retryLoadBtn">Retry</button>`);
    document.getElementById('retryLoadBtn')?.addEventListener('click', loadPartners);
    rowsRangeLabel.textContent = '';
    paginationControls.innerHTML = '';
    return;
  }

  const data = filteredSortedPartners();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  if (pageRows.length === 0) {
    pTbody.innerHTML = stateRow(partners.length ? 'No channel partners match your search or filter.' : 'No channel partners yet. Click “Add Channel Partner” to onboard one.');
  } else {
    pTbody.innerHTML = pageRows.map((p) => `
      <tr data-id="${escapeHtml(p.id)}">
        <td data-label="Partner Code"><span class="partner-code-badge">${escapeHtml(p.code)}</span></td>
        <td data-label="Partner Name" class="font-medium">${escapeHtml(p.name)}</td>
        <td data-label="Contact Person">${escapeHtml(p.contact || '—')}</td>
        <td data-label="Phone">${escapeHtml(p.phone || '—')}</td>
        <td data-label="Email">${escapeHtml(p.email)}</td>
        <td data-label="GST Number">${escapeHtml(p.gst || '—')}</td>
        <td data-label="Status"><span class="pill ${tableStatusPillClass[p.status] || 'pill-rejected'}">${escapeHtml(p.status)}</span></td>
        <td data-label="Created Date">${formatDateDisplay(p.createdDate)}</td>
        <td data-label="Referral Income (Total)" data-ref-income="${escapeHtml(p.id)}">…</td>
        <td data-label="Actions">${actionIconsHtml(p)}</td>
      </tr>
    `).join('');
    loadReferralTotals(pageRows);
  }

  rowsRangeLabel.textContent = totalRows === 0
    ? 'No records'
    : `${start + 1}–${Math.min(start + rowsPerPage, totalRows)} of ${totalRows}`;

  renderPagination(totalPages);
  updateSortIcons();
}

function renderPagination(totalPages) {
  let html = '';
  html += `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
      if (p === 2 || p === totalPages - 1) html += `<span class="pagination-btn disabled">…</span>`;
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
      renderTable();
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll('#partnersTable thead th[data-key]').forEach((th) => {
    const icon = th.querySelector('.sort-icon');
    const key = th.getAttribute('data-key');
    th.classList.toggle('sorted', key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#partnersTable thead th[data-key]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    currentPage = 1;
    renderTable();
  });
});

rowsPerPageSelect?.addEventListener('change', () => {
  rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
  currentPage = 1;
  renderTable();
});

let searchDebounce;
searchInput?.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchTerm = e.target.value;
    currentPage = 1;
    renderTable();
  }, 200);
});

statusFilterSelect?.addEventListener('change', (e) => {
  statusFilter = e.target.value;
  currentPage = 1;
  renderTable();
});

// ============================================================
// Add / Edit Channel Partner modal  (POST / PUT)
// ============================================================
const partnerFormModal = document.getElementById('partnerFormModal');
const partnerFormTitle = document.getElementById('partnerFormTitle');
const partnerFormSubtitle = document.getElementById('partnerFormSubtitle');
const partnerFormCloseBtn = document.getElementById('partnerFormCloseBtn');
const partnerFormCancelBtn = document.getElementById('partnerFormCancelBtn');
const partnerFormSaveBtn = document.getElementById('partnerFormSaveBtn');

const fldPartnerName = document.getElementById('fldPartnerName');
const fldContactPerson = document.getElementById('fldContactPerson');
const fldPhone = document.getElementById('fldPhone');
const fldEmail = document.getElementById('fldEmail');
const fldGst = document.getElementById('fldGst');
const fldStatus = document.getElementById('fldStatus');
const fldAddress = document.getElementById('fldAddress');
const fldAdminGroup = document.getElementById('fldAdminGroup');
const fldAdminUsername = document.getElementById('fldAdminUsername');
const pfReferralCode = document.getElementById('pf-referralCode');
const pfReferralPercent = document.getElementById('pf-referralPercent');

let formMode = 'add'; // 'add' | 'edit'
let editingId = null;

function clearFormErrors() {
  document.querySelectorAll('#partnerForm .field-input').forEach((f) => f.classList.remove('invalid'));
  document.querySelectorAll('#partnerForm .field-error').forEach((e) => { e.textContent = ''; });
}

function setFieldError(fieldEl, message) {
  fieldEl.classList.add('invalid');
  const err = document.getElementById('err-' + fieldEl.id);
  if (err) err.textContent = message;
}

function resetForm() {
  [fldPartnerName, fldContactPerson, fldPhone, fldEmail, fldGst, fldAddress,
    fldAdminUsername, pfReferralCode, pfReferralPercent].forEach((f) => { f.value = ''; });
  fldStatus.value = 'Active';
  clearFormErrors();
}

function openAddModal() {
  formMode = 'add';
  editingId = null;
  resetForm();
  fldAdminGroup.classList.remove('hidden');
  partnerFormTitle.textContent = 'Add Channel Partner';
  partnerFormSubtitle.textContent = 'New partner';
  partnerFormSaveBtn.textContent = 'Save partner';
  partnerFormModal.classList.remove('hidden');
}

function openEditModal(id) {
  const p = findPartner(id);
  if (!p) return;
  formMode = 'edit';
  editingId = p.id;
  resetForm();
  fldPartnerName.value = p.name;
  fldContactPerson.value = p.contact;
  fldPhone.value = p.phone;
  fldEmail.value = p.email;
  fldGst.value = p.gst;
  fldStatus.value = p.status;
  fldAddress.value = p.address;
  pfReferralCode.value = p.referralCode || '';
  pfReferralPercent.value = p.referralPercent ?? '';
  fldAdminGroup.classList.add('hidden');             // admin user is only created together with the partner
  partnerFormTitle.textContent = 'Edit Channel Partner';
  partnerFormSubtitle.textContent = `${p.code} · ${p.name}`;
  partnerFormSaveBtn.textContent = 'Save changes';
  partnerFormModal.classList.remove('hidden');
}

function closePartnerFormModal() {
  partnerFormModal.classList.add('hidden');
}

document.getElementById('addPartnerBtn')?.addEventListener('click', openAddModal);
partnerFormCloseBtn?.addEventListener('click', closePartnerFormModal);
partnerFormCancelBtn?.addEventListener('click', closePartnerFormModal);
partnerFormModal?.addEventListener('click', (e) => { if (e.target === partnerFormModal) closePartnerFormModal(); });

// same rules as ChannelPartnerRequestDto
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,60}$/;

function validatePartnerForm() {
  clearFormErrors();
  let ok = true;

  if (!fldPartnerName.value.trim()) { setFieldError(fldPartnerName, 'Partner name is required'); ok = false; }
  const email = fldEmail.value.trim();
  if (!email) { setFieldError(fldEmail, 'Email is required'); ok = false; }
  else if (!EMAIL_RE.test(email)) { setFieldError(fldEmail, 'Email is not valid'); ok = false; }

  const gst = fldGst.value.trim().toUpperCase();
  if (gst && !GST_RE.test(gst)) { setFieldError(fldGst, 'GST number is not valid (e.g. 27ABCDE1234F1Z5)'); ok = false; }

  if (pfReferralPercent.value !== '') {
    const pct = Number(pfReferralPercent.value);
    if (isNaN(pct) || pct < 0 || pct > 100) { setFieldError(pfReferralPercent, 'Referral % must be between 0 and 100'); ok = false; }
  }

  if (formMode === 'add' && !USERNAME_RE.test(fldAdminUsername.value.trim())) {
    setFieldError(fldAdminUsername, 'Username: 3–60 characters, letters, digits, dot, underscore or hyphen');
    ok = false;
  }
  return ok;
}

function buildPayload() {
  const contact = fldContactPerson.value.trim();
  const payload = {
    name: fldPartnerName.value.trim(),
    contactPerson: contact || null,
    phone: fldPhone.value.trim() || null,
    email: fldEmail.value.trim(),
    gstNo: fldGst.value.trim().toUpperCase() || null,
    address: fldAddress.value.trim() || null,
    referralPercent: pfReferralPercent.value === '' ? 0 : Number(pfReferralPercent.value),
    status: String(fldStatus.value).toUpperCase(),          // ACTIVE | INACTIVE
  };
  if (formMode === 'add') {
    payload.adminUser = {
      name: contact || payload.name,
      email: payload.email,
      username: fldAdminUsername.value.trim(),
      phone: payload.phone,
    };
  }
  return payload;
}

partnerFormSaveBtn?.addEventListener('click', (e) => {
  if (!validatePartnerForm()) {
    showToast('Please correct the highlighted fields');
    return;
  }
  const isEdit = formMode === 'edit';
  const payload = buildPayload();

  withBusy(e.currentTarget, async () => {
    let saved;
    try {
      saved = isEdit
        ? await call(ENDPOINTS.one(editingId), 'PUT', payload)
        : await call(ENDPOINTS.list, 'POST', payload);
    } catch (err) {
      console.error('Save channel partner failed:', err);
      showToast(errorMessage(err, 'Could not save the channel partner'));
      return;
    }

    closePartnerFormModal();
    if (isEdit) {
      showToast(`Saved changes to ${saved?.code || 'channel partner'}`);
    } else {
      showToast(`Channel partner ${saved?.code || ''} added`);
      showCredentials(saved);
    }
    sortKey = 'createdDate'; sortDir = 'desc'; currentPage = 1;
    await refreshPartners();
  });
});

// ============================================================
// Credentials of the new admin user (shown once after create)
// ============================================================
const credModal = document.getElementById('credModal');
let credText = '';

function showCredentials(saved) {
  if (!saved) return;
  const admin = saved.adminUser || {};
  document.getElementById('credSubtitle').textContent = `${saved.code || ''} · ${saved.name || ''}`;
  document.getElementById('credUsername').textContent = admin.username || '—';
  document.getElementById('credReferral').textContent = saved.referralCode || '—';
  const pwRow = document.getElementById('credPasswordRow');
  if (admin.temporaryPassword) {
    document.getElementById('credPassword').textContent = admin.temporaryPassword;
    pwRow.style.display = '';
  } else {
    pwRow.style.display = 'none';
  }
  credText = `Username: ${admin.username || ''}` +
    (admin.temporaryPassword ? `\nTemporary password: ${admin.temporaryPassword}` : '') +
    `\nPartner code: ${saved.code || ''}`;
  credModal.classList.remove('hidden');
}

function closeCredModal() { credModal.classList.add('hidden'); credText = ''; document.getElementById('credPassword').textContent = '—'; }
document.getElementById('credCloseBtn')?.addEventListener('click', closeCredModal);
document.getElementById('credCloseBtn2')?.addEventListener('click', closeCredModal);
document.getElementById('credCopyBtn')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(credText); showToast('Login details copied'); }
  catch (_) { showToast('Could not copy — please select and copy manually'); }
});

// ============================================================
// View Channel Partner modal (stats + referral activity)
// ============================================================
const partnerViewModal = document.getElementById('partnerViewModal');
const partnerViewTitle = document.getElementById('partnerViewTitle');
const partnerViewSubtitle = document.getElementById('partnerViewSubtitle');

let viewingId = null;

async function openViewModal(id) {
  const p = findPartner(id);
  if (!p) return;
  viewingId = p.id;

  partnerViewTitle.textContent = p.name;
  partnerViewSubtitle.textContent = `${p.code} · ${p.status}`;
  document.getElementById('pvContact').textContent = p.contact || '—';
  document.getElementById('pvPhone').textContent = p.phone || '—';
  document.getElementById('pvEmail').textContent = p.email || '—';
  document.getElementById('pvGst').textContent = p.gst || '—';
  document.getElementById('pvAddress').textContent = p.address || '—';
  document.getElementById('pvReferralCode').textContent = p.referralCode || '—';
  document.getElementById('pvReferralPercent').textContent = `${p.referralPercent}%`;

  setStatCards(p.stats);                 // instant numbers from the list…
  partnerViewModal.classList.remove('hidden');
  renderReferralActivity(p);

  try {                                  // …then the fresh ones from the stats endpoint
    const s = await call(ENDPOINTS.stats(p.id));
    if (!sameId(viewingId, p.id)) return;
    setStatCards({
      customers: num(s.customers, 0), projects: num(s.projects, 0),
      quotations: num(s.quotations, 0), users: num(s.users, 0),
    });
  } catch (err) {
    showToast(errorMessage(err, 'Could not load partner statistics'));
  }
}

function setStatCards(s) {
  document.getElementById('pvStatCustomers').textContent = s.customers;
  document.getElementById('pvStatProjects').textContent = s.projects;
  document.getElementById('pvStatQuotations').textContent = s.quotations;
  document.getElementById('pvStatUsers').textContent = s.users;
}

// ---- Referral Activity: KPI mini-cards + table for the viewed partner (API via referral.js) ----
let viewedReferrals = [];

async function renderReferralActivity(p) {
  const tableWrap = document.querySelector('.referral-table-wrap');
  const tbody = document.getElementById('referralActivityTbody');
  const emptyState = document.getElementById('referralEmptyState');
  const isSuperAdmin = window.currentUserRole === 'SUPER_ADMIN';

  document.getElementById('pvRefTotalReferrals').textContent = '…';
  document.getElementById('pvRefTotalIncome').textContent = '…';
  document.getElementById('pvRefPendingPayout').textContent = '…';
  tbody.innerHTML = '';

  try {
    const [sum, page] = await Promise.all([Referral.summary(p.id), Referral.list(p.id)]);
    if (!sameId(viewingId, p.id)) return;                       // modal moved on to another partner
    viewedReferrals = page.content || [];

    document.getElementById('pvRefTotalReferrals').textContent = sum.totalReferrals;
    document.getElementById('pvRefTotalIncome').textContent = formatINR(sum.totalEarned);
    document.getElementById('pvRefPendingPayout').textContent = formatINR(sum.pendingPayout);

    if (viewedReferrals.length === 0) {
      tableWrap.classList.add('hidden');
      emptyState.textContent = 'No referrals recorded for this partner yet.';
      emptyState.classList.remove('hidden');
      return;
    }
    tableWrap.classList.remove('hidden');
    emptyState.classList.add('hidden');

    tbody.innerHTML = viewedReferrals.map((r) => {
      const actionCell = isSuperAdmin
        ? `<button type="button" class="btn-mark-paid" data-referral-id="${escapeHtml(r.id)}" ${r.status === 'APPROVED' ? '' : 'disabled'}>${r.status === 'PAID' ? 'Paid' : 'Mark as Paid'}</button>`
        : '';
      return `
      <tr>
        <td data-label="Quotation No" class="font-medium">${escapeHtml(r.quotation && r.quotation.code)}</td>
        <td data-label="Referred Customer">${escapeHtml(r.referredCustomer ? r.referredCustomer.name : '—')}</td>
        <td data-label="Quotation Amount">${formatINR(r.quotationAmount)}</td>
        <td data-label="Referral %">${escapeHtml(r.referralPercent)}%</td>
        <td data-label="Referral Amount">${formatINR(r.referralAmount)}</td>
        <td data-label="Status"><span class="pill ${Referral.STATUS_PILL[r.status] || ''}">${escapeHtml(Referral.STATUS_LABEL[r.status] || r.status)}</span></td>
        <td data-label="Date">${formatDateDisplay(r.paidOn || r.quoteDate)}</td>
        <td data-label="Action" data-role="SUPER_ADMIN">${actionCell}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tableWrap.classList.add('hidden');
    document.getElementById('pvRefTotalReferrals').textContent = '—';
    document.getElementById('pvRefTotalIncome').textContent = '—';
    document.getElementById('pvRefPendingPayout').textContent = '—';
    emptyState.textContent = errorMessage(e, 'Could not load referrals');
    emptyState.classList.remove('hidden');
  }
}

// ---- Mark as paid (Super Admin): PATCH /api/referrals/{id}/mark-paid ----
const markPaidModal = document.getElementById('markPaidModal');
let markPaidTarget = null;

document.getElementById('referralActivityTbody')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-mark-paid');
  if (!btn || btn.disabled) return;
  const r = viewedReferrals.find((x) => String(x.id) === btn.getAttribute('data-referral-id'));
  if (!r) return;
  markPaidTarget = r;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('mpTitle').textContent = `${r.quotation.code} · ${formatINR(r.referralAmount)} to ${r.referrer ? r.referrer.name : 'partner'}`;
  document.getElementById('mpPaidOn').value = today;
  document.getElementById('mpPaidOn').max = today;
  document.getElementById('mpMode').value = 'BANK_TRANSFER';
  document.getElementById('mpReference').value = '';
  document.getElementById('mpRemarks').value = '';
  document.getElementById('mpError').textContent = '';
  markPaidModal.classList.remove('hidden');
});

function closeMarkPaidModal() { markPaidModal.classList.add('hidden'); markPaidTarget = null; }
document.getElementById('mpCancelBtn')?.addEventListener('click', closeMarkPaidModal);
document.getElementById('mpCloseBtn')?.addEventListener('click', closeMarkPaidModal);
markPaidModal?.addEventListener('click', (e) => { if (e.target === markPaidModal) closeMarkPaidModal(); });

document.getElementById('mpConfirmBtn')?.addEventListener('click', async () => {
  if (!markPaidTarget) return;
  const mode = document.getElementById('mpMode').value;
  const reference = document.getElementById('mpReference').value.trim();
  const err = document.getElementById('mpError');
  if (!document.getElementById('mpPaidOn').value) { err.textContent = 'Paid date is required'; return; }
  if (mode !== 'CASH' && !reference) { err.textContent = 'Payment reference is required'; return; }
  const btn = document.getElementById('mpConfirmBtn');
  btn.disabled = true;
  try {
    await Referral.markPaid(markPaidTarget.id, {
      paidOn: document.getElementById('mpPaidOn').value,
      paymentMode: mode,
      paymentReference: reference || null,
      remarks: document.getElementById('mpRemarks').value.trim() || null,
    });
    const code = markPaidTarget.quotation.code;
    closeMarkPaidModal();
    const p = findPartner(viewingId);
    if (p) { renderReferralActivity(p); loadReferralTotals([p]); }
    loadReferralPayoutKpi();
    showToast(`${code} referral marked as paid`);
  } catch (e2) {
    err.textContent = errorMessage(e2, 'Could not mark as paid');
  } finally {
    btn.disabled = false;
  }
});

function closePartnerViewModal() {
  partnerViewModal.classList.add('hidden');
}

document.getElementById('partnerViewCloseBtn')?.addEventListener('click', closePartnerViewModal);
document.getElementById('partnerViewCloseBtn2')?.addEventListener('click', closePartnerViewModal);
partnerViewModal?.addEventListener('click', (e) => { if (e.target === partnerViewModal) closePartnerViewModal(); });

document.getElementById('pvViewTeamBtn')?.addEventListener('click', () => {
  if (viewingId != null) openTeamModal(viewingId);
});

// ============================================================
// View Team modal  (GET /api/channel-partners/{id}/users)
// ============================================================
const teamModal = document.getElementById('teamModal');
const teamModalTitle = document.getElementById('teamModalTitle');
const teamTbody = document.getElementById('teamTbody');
const teamEmptyState = document.getElementById('teamEmptyState');
const teamTable = document.getElementById('teamTable');

const teamStatusPillClass = { Active: 'pill-accepted', Inactive: 'pill-rejected' };
let teamRequestFor = null;

async function openTeamModal(id) {
  const p = findPartner(id);
  if (!p) return;
  teamRequestFor = p.id;

  teamModalTitle.textContent = `Team — ${p.code} · ${p.name}`;
  teamTable.classList.remove('hidden');
  teamEmptyState.classList.add('hidden');
  teamTbody.innerHTML = '<tr><td colspan="5" class="table-state-cell"><span class="spinner"></span>Loading team…</td></tr>';
  teamModal.classList.remove('hidden');

  let users;
  try {
    users = toArray(await call(ENDPOINTS.users(p.id)));
  } catch (err) {
    if (!sameId(teamRequestFor, p.id)) return;
    teamTable.classList.add('hidden');
    teamEmptyState.textContent = errorMessage(err, 'Could not load the team.');
    teamEmptyState.classList.remove('hidden');
    return;
  }
  if (!sameId(teamRequestFor, p.id)) return;

  if (users.length === 0) {
    teamTable.classList.add('hidden');
    teamEmptyState.textContent = 'No users found for this channel partner yet.';
    teamEmptyState.classList.remove('hidden');
    return;
  }
  teamTable.classList.remove('hidden');
  teamEmptyState.classList.add('hidden');
  teamTbody.innerHTML = users.map((u) => {
    const st = uiStatus(u.status);
    return `
      <tr>
        <td data-label="Name" class="font-medium">${escapeHtml(u.name)}</td>
        <td data-label="Role">${escapeHtml(u.role ? u.role.name : '—')}</td>
        <td data-label="Email">${escapeHtml(u.email || '—')}</td>
        <td data-label="Phone">${escapeHtml(u.phone || '—')}</td>
        <td data-label="Status"><span class="pill ${teamStatusPillClass[st] || 'pill-rejected'}">${escapeHtml(st)}</span></td>
      </tr>`;
  }).join('');
}

function closeTeamModal() {
  teamModal.classList.add('hidden');
  teamRequestFor = null;
}

document.getElementById('teamModalCloseBtn')?.addEventListener('click', closeTeamModal);
document.getElementById('teamModalCloseBtn2')?.addEventListener('click', closeTeamModal);
teamModal?.addEventListener('click', (e) => { if (e.target === teamModal) closeTeamModal(); });

// ============================================================
// Row actions: view / edit / team / activate-deactivate
// ============================================================
pTbody?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    const id = actionBtn.getAttribute('data-id');
    const action = actionBtn.getAttribute('data-action');
    if (action === 'view') openViewModal(id);
    else if (action === 'edit') openEditModal(id);
    else if (action === 'team') openTeamModal(id);
    else if (action === 'deactivate') setPartnerStatus(id, 'Inactive', actionBtn);
    else if (action === 'activate') setPartnerStatus(id, 'Active', actionBtn);
    return;
  }
  const row = e.target.closest('tr[data-id]');
  if (row) openViewModal(row.getAttribute('data-id'));
});

async function setPartnerStatus(id, status, btn) {
  const p = findPartner(id);
  if (!p || (btn && btn.disabled)) return;
  if (btn) btn.disabled = true;
  try {
    await call(ENDPOINTS.status(p.id), 'PATCH', { status: status.toUpperCase() });
    showToast(`${p.code} marked ${status}`);
    await refreshPartners();
  } catch (err) {
    showToast(errorMessage(err, 'Could not change the status'));
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// Escape key closes whichever modal is open (top-most first)
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!credModal.classList.contains('hidden')) closeCredModal();
  else if (!markPaidModal.classList.contains('hidden')) closeMarkPaidModal();
  else if (!teamModal.classList.contains('hidden')) closeTeamModal();
  else if (!partnerViewModal.classList.contains('hidden')) closePartnerViewModal();
  else if (!partnerFormModal.classList.contains('hidden')) closePartnerFormModal();
});

// ============================================================
// Topbar: notification + profile dropdowns
// ============================================================
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');

function closeAllTopbarDropdowns() {
  [notifDropdown, profileDropdown].forEach((dd) => dd && dd.classList.add('hidden'));
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
profileLogoutBtn?.addEventListener('click', logoutUser);

// ============================================================
// Init
// ============================================================
loadPartners();