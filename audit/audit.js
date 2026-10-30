// ============================================================
// Audit Log — Super Admin only, integrated with the Spring Boot backend (port 8091)
//
// session.js (loaded first) provides Session.api(path, { method, body }) and Session.authFetch(path).
//
// Endpoints used:
//   GET /api/audit?page=&size=&sort=&search=&partnerId=&userId=&module=&action=&from=&to=
//   GET /api/audit/export?...same filters...            CSV download (newest 5000 rows)
//   GET /api/channel-partners/options                   partner dropdown
//   GET /api/users?partnerId=&page=0&size=100           user dropdown (after a partner is chosen)
// ============================================================

// ---------- access guard: Super Admin only ----------
if (window.currentUserRole !== 'SUPER_ADMIN') {
  window.location.replace('../dashboard/dashboard.html');
  throw new Error('Access denied: Super Admin only');
}

// ============================================================
// Helpers
// ============================================================
const ENDPOINTS = {
  list: '/api/audit',
  export: '/api/audit/export',
  partners: '/api/channel-partners/options',
  users: (partnerId) => `/api/users?partnerId=${encodeURIComponent(partnerId)}&page=0&size=100`,
};

const EXPORT_LIMIT = 5000; // backend caps the CSV at the newest 5000 rows

const MODULE_LABELS = {
  AUTH: 'Login / Logout', CUSTOMER: 'Customer', PRODUCT: 'Product', PROJECT: 'Project',
  QUOTATION: 'Quotation', CALCULATOR: 'Calculator', REFERRAL: 'Referral', USER: 'User',
  ROLE: 'Role', SETTINGS: 'Settings', CHANNEL_PARTNER: 'Channel Partner',
};

const ACTION_LABELS = {
  CREATE: 'Create', UPDATE: 'Update', DELETE: 'Delete', STATUS_CHANGE: 'Status change',
  APPROVE: 'Approve', REJECT: 'Reject', CONVERT: 'Convert', MARK_PAID: 'Mark paid',
  PERMISSION_CHANGE: 'Permission change', LOGIN: 'Login', LOGOUT: 'Logout', PASSWORD_RESET: 'Password reset',
};

const ACTION_PILL = {
  CREATE: 'pill-create', UPDATE: 'pill-update', DELETE: 'pill-delete', STATUS_CHANGE: 'pill-status',
  APPROVE: 'pill-approve', REJECT: 'pill-reject', CONVERT: 'pill-status', MARK_PAID: 'pill-money',
  PERMISSION_CHANGE: 'pill-update', LOGIN: 'pill-auth', LOGOUT: 'pill-auth', PASSWORD_RESET: 'pill-auth',
};

const titleCase = (s) => String(s || '').toLowerCase().split('_')
  .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
const moduleLabel = (m) => MODULE_LABELS[m] || titleCase(m);
const actionLabel = (a) => ACTION_LABELS[a] || titleCase(a);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML.replace(/"/g, '&quot;');
}

/** Backend sends UTC LocalDateTime without a zone ("2026-10-29T10:15:30"); read it as UTC, show local time. */
function parseUtc(ts) {
  if (!ts) return null;
  const s = String(ts);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d;
}
function formatTime(ts) {
  const d = parseUtc(ts);
  if (!d) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatTimeFull(ts) {
  const d = parseUtc(ts);
  if (!d) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    + '  (UTC ' + d.toISOString().replace('T', ' ').slice(0, 19) + ')';
}

/** Turns a raw User-Agent header into "Chrome 130 · Windows" (best effort; raw text stays in the detail popup). */
function describeAgent(ua) {
  if (!ua) return { label: '', browser: '', os: '' };
  const m = (re) => { const x = ua.match(re); return x ? x[1] : ''; };
  let browser = '';
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge ' + m(/Edg(?:e|A|iOS)?\/(\d+)/);
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera ' + m(/OPR\/(\d+)/);
  else if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet ' + m(/SamsungBrowser\/(\d+)/);
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox ' + m(/(?:Firefox|FxiOS)\/(\d+)/);
  else if (/Chrome\/|CriOS\//.test(ua)) browser = 'Chrome ' + m(/(?:Chrome|CriOS)\/(\d+)/);
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari ' + m(/Version\/(\d+)/);
  else if (/PostmanRuntime/.test(ua)) browser = 'Postman';
  else if (/curl\//.test(ua)) browser = 'curl';
  else if (/okhttp|Dalvik/.test(ua)) browser = 'Android app';
  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux|X11/.test(ua)) os = 'Linux';
  browser = browser.trim();
  return { browser, os, label: [browser, os].filter(Boolean).join(' · ') };
}

function errorMessage(err, fallback) {
  if (err && err.status === 403) return 'You do not have permission to view the audit log.';
  const detail = err && Array.isArray(err.errors) && err.errors.length
    ? err.errors.map((x) => (x.field ? x.field + ': ' : '') + (x.message || '')).join(' • ')
    : '';
  return detail || (err && err.message) || fallback;
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
}

async function call(path) {
  const res = await Session.api(path, { method: 'GET' });
  return res && res.data !== undefined ? res.data : res;
}

// ============================================================
// Sidebar collapse / expand (same behaviour as every module)
// ============================================================
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const drawerMQ = window.matchMedia('(max-width: 1023px)');
const isDrawerViewport = () => drawerMQ.matches;
let sidebarExpanded = true;

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
drawerMQ.addEventListener('change', () => setSidebarExpanded(true));
document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item') && isDrawerViewport()) setSidebarExpanded(false);
});

// ============================================================
// Topbar: profile dropdown
// ============================================================
(function renderUserName() {
  const u = window.Session && Session.getUser ? Session.getUser() : null;
  const name = (u && (u.name || (u.email ? u.email.split('@')[0] : ''))) || 'User';
  const initial = document.getElementById('profileInitial');
  const label = document.getElementById('profileNameLabel');
  if (initial) initial.textContent = name.charAt(0).toUpperCase();
  if (label) label.textContent = name;
})();

const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
profileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('hidden');
});
document.addEventListener('click', () => profileDropdown?.classList.add('hidden'));
// logout is wired by session.js (#profileLogoutBtn)

// ============================================================
// State
// ============================================================
const state = {
  page: 0,            // 0-based, as the backend expects
  size: 25,
  sortKey: 'createdAt',
  sortDir: 'desc',
  rows: [],
  totalElements: 0,
  totalPages: 0,
  loading: true,
  error: '',
};
let requestSeq = 0;   // ignore answers of older requests

const el = {
  tbody: document.getElementById('auditTbody'),
  summary: document.getElementById('auditSummary'),
  range: document.getElementById('rowsRangeLabel'),
  pager: document.getElementById('paginationControls'),
  rowsPerPage: document.getElementById('rowsPerPage'),
  search: document.getElementById('fSearch'),
  partner: document.getElementById('fPartner'),
  user: document.getElementById('fUser'),
  module: document.getElementById('fModule'),
  action: document.getElementById('fAction'),
  from: document.getElementById('fFrom'),
  to: document.getElementById('fTo'),
  reset: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
};

// ============================================================
// Filters -> query string
// ============================================================
function filterParams() {
  const p = new URLSearchParams();
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') p.set(k, String(v).trim()); };
  add('search', el.search.value);
  add('partnerId', el.partner.value);
  add('userId', el.user.value);
  add('module', el.module.value);
  add('action', el.action.value);
  add('from', el.from.value);
  add('to', el.to.value);
  return p;
}

function hasActiveFilters() {
  return [...filterParams().keys()].length > 0;
}

function dateRangeValid() {
  if (el.from.value && el.to.value && el.from.value > el.to.value) {
    showToast('"From" date must be on or before "To" date.');
    return false;
  }
  return true;
}

// ============================================================
// Load + render
// ============================================================
async function loadLogs() {
  if (!dateRangeValid()) return;
  const seq = ++requestSeq;
  state.loading = true;
  state.error = '';
  renderTable();

  const p = filterParams();
  p.set('page', String(state.page));
  p.set('size', String(state.size));
  p.set('sort', `${state.sortKey},${state.sortDir}`);

  try {
    const data = await call(`${ENDPOINTS.list}?${p.toString()}`);
    if (seq !== requestSeq) return;
    state.rows = Array.isArray(data && data.content) ? data.content : [];
    state.totalElements = Number(data && data.totalElements) || 0;
    state.totalPages = Number(data && data.totalPages) || 0;
    // the filter may have shrunk the result set under the page we were on
    if (state.page > 0 && state.page >= state.totalPages && state.totalPages > 0) {
      state.page = state.totalPages - 1;
      return loadLogs();
    }
  } catch (err) {
    if (seq !== requestSeq) return;
    console.error('Failed to load audit log:', err);
    state.rows = [];
    state.totalElements = 0;
    state.totalPages = 0;
    state.error = errorMessage(err, 'Could not load the audit log.');
  } finally {
    if (seq === requestSeq) state.loading = false;
  }
  if (seq === requestSeq) renderTable();
}

function stateRow(html) {
  return `<tr class="state-row"><td class="state-cell" colspan="7">${html}</td></tr>`;
}

function renderTable() {
  updateSortIcons();

  if (state.loading) {
    el.tbody.innerHTML = stateRow('<span class="spinner"></span>Loading audit log…');
    el.summary.textContent = 'Loading…';
    el.range.textContent = '';
    el.pager.innerHTML = '';
    return;
  }

  if (state.error) {
    el.tbody.innerHTML = stateRow(
      `${escapeHtml(state.error)}<br><button type="button" class="btn-primary" id="retryBtn" style="margin-top:10px">Try again</button>`);
    document.getElementById('retryBtn')?.addEventListener('click', loadLogs);
    el.summary.textContent = 'Could not load';
    el.range.textContent = '';
    el.pager.innerHTML = '';
    return;
  }

  if (!state.rows.length) {
    el.tbody.innerHTML = stateRow(hasActiveFilters()
      ? 'No log entries match these filters. Clear a filter or widen the date range.'
      : 'No activity has been recorded yet.');
    el.summary.textContent = hasActiveFilters() ? '0 matching entries' : 'No entries';
    el.range.textContent = '';
    el.pager.innerHTML = '';
    return;
  }

  el.tbody.innerHTML = state.rows.map((r, i) => {
    const partner = r.partner;
    const role = r.actorRole ? titleCase(r.actorRole) : '';
    const entity = [r.entityType, r.entityLabel].filter(Boolean);
    const pillClass = ACTION_PILL[r.action] || 'pill-other';
    const agent = describeAgent(r.userAgent);
    return `<tr data-index="${i}" tabindex="0" aria-label="View details">
      <td data-label="Time">${escapeHtml(formatTime(r.createdAt))}</td>
      <td data-label="Partner">
        <span class="cell-main" title="${escapeHtml(partner ? partner.name : '')}">${escapeHtml(partner ? partner.name : '—')}</span>
        ${partner && partner.code ? `<span class="cell-sub">${escapeHtml(partner.code)}</span>` : ''}
      </td>
      <td data-label="User">
        <span class="cell-main" title="${escapeHtml(r.actorName || '')}">${escapeHtml(r.actorName || '—')}</span>
        ${role ? `<span class="cell-sub">${escapeHtml(role)}</span>` : ''}
      </td>
      <td data-label="Module">${escapeHtml(moduleLabel(r.module))}</td>
      <td data-label="Action"><span class="pill ${pillClass}">${escapeHtml(actionLabel(r.action))}</span></td>
      <td data-label="Record">
        <span class="cell-main" title="${escapeHtml(entity.join(' · '))}">${escapeHtml(r.entityLabel || r.entityType || '—')}</span>
        ${r.entityLabel && r.entityType ? `<span class="cell-sub">${escapeHtml(r.entityType)}</span>` : ''}
      </td>
      <td data-label="IP / Browser">
        <span class="cell-main">${escapeHtml(r.ipAddress || '—')}</span>
        ${agent.label ? `<span class="cell-sub" title="${escapeHtml(r.userAgent || '')}">${escapeHtml(agent.label)}</span>` : ''}
      </td>
    </tr>`;
  }).join('');

  const first = state.page * state.size + 1;
  const last = first + state.rows.length - 1;
  el.range.textContent = `${first.toLocaleString('en-IN')}–${last.toLocaleString('en-IN')} of ${state.totalElements.toLocaleString('en-IN')}`;
  el.summary.textContent = `${state.totalElements.toLocaleString('en-IN')} ${hasActiveFilters() ? 'matching ' : ''}${state.totalElements === 1 ? 'entry' : 'entries'}, newest first`
    .replace('newest first', state.sortKey === 'createdAt' && state.sortDir === 'desc' ? 'newest first' : 'custom order');
  renderPagination();
}

function renderPagination() {
  const total = state.totalPages;
  const current = state.page + 1;
  if (total <= 1) { el.pager.innerHTML = ''; return; }
  let html = `<span class="pagination-btn ${current === 1 ? 'disabled' : ''}" data-page="prev" role="button" aria-label="Previous page">‹</span>`;
  for (let p = 1; p <= total; p++) {
    if (total > 7 && p !== 1 && p !== total && Math.abs(p - current) > 1) {
      if (p === 2 || p === total - 1) html += '<span class="pagination-btn disabled">…</span>';
      continue;
    }
    html += `<span class="pagination-btn ${p === current ? 'active' : ''}" data-page="${p}" role="button">${p}</span>`;
  }
  html += `<span class="pagination-btn ${current === total ? 'disabled' : ''}" data-page="next" role="button" aria-label="Next page">›</span>`;
  el.pager.innerHTML = html;
}

el.pager.addEventListener('click', (e) => {
  const btn = e.target.closest('.pagination-btn');
  if (!btn || btn.classList.contains('disabled')) return;
  const v = btn.getAttribute('data-page');
  let next = state.page;
  if (v === 'prev') next = Math.max(0, state.page - 1);
  else if (v === 'next') next = Math.min(state.totalPages - 1, state.page + 1);
  else next = parseInt(v, 10) - 1;
  if (next === state.page) return;
  state.page = next;
  loadLogs();
});

// ---------- sorting ----------
function updateSortIcons() {
  document.querySelectorAll('#auditTable thead th[data-key]').forEach((th) => {
    const key = th.getAttribute('data-key');
    const active = key === state.sortKey;
    th.classList.toggle('sorted', active);
    th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (state.sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#auditTable thead th[data-key]').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = key === 'createdAt' ? 'desc' : 'asc'; }
    state.page = 0;
    loadLogs();
  });
});

el.rowsPerPage.addEventListener('change', () => {
  state.size = parseInt(el.rowsPerPage.value, 10) || 25;
  state.page = 0;
  loadLogs();
});

// ============================================================
// Filter wiring
// ============================================================
function applyFilters() { state.page = 0; loadLogs(); }

let searchTimer = null;
el.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 350);
});
[el.module, el.action, el.from, el.to, el.user].forEach((c) => c.addEventListener('change', applyFilters));

el.partner.addEventListener('change', async () => {
  await loadUserOptions(el.partner.value);
  applyFilters();
});

el.reset.addEventListener('click', async () => {
  clearTimeout(searchTimer);
  el.search.value = '';
  el.partner.value = '';
  el.module.value = '';
  el.action.value = '';
  el.from.value = '';
  el.to.value = '';
  await loadUserOptions('');
  applyFilters();
});

async function loadPartnerOptions() {
  try {
    const list = await call(ENDPOINTS.partners);
    const rows = Array.isArray(list) ? list : [];
    rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    el.partner.innerHTML = '<option value="">All partners</option>' + rows.map((p) =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.code ? ' (' + escapeHtml(p.code) + ')' : ''}</option>`).join('');
  } catch (err) {
    console.error('Failed to load partners:', err);
    showToast(errorMessage(err, 'Could not load the partner list.'));
  }
}

async function loadUserOptions(partnerId) {
  if (!partnerId) {
    el.user.innerHTML = '<option value="">Choose a partner first</option>';
    el.user.disabled = true;
    return;
  }
  el.user.disabled = true;
  el.user.innerHTML = '<option value="">Loading users…</option>';
  try {
    const data = await call(ENDPOINTS.users(partnerId));
    const rows = Array.isArray(data && data.content) ? data.content : [];
    el.user.innerHTML = '<option value="">All users</option>' + rows.map((u) => {
      const role = u.role && (u.role.name || u.role.code);
      return `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}${role ? ' — ' + escapeHtml(role) : ''}</option>`;
    }).join('');
    el.user.disabled = false;
  } catch (err) {
    console.error('Failed to load users:', err);
    el.user.innerHTML = '<option value="">Could not load users</option>';
    showToast(errorMessage(err, 'Could not load users of this partner.'));
  }
}

// ============================================================
// Detail modal
// ============================================================
const modal = document.getElementById('auditModal');
const modalBody = document.getElementById('auditModalBody');
const modalTitle = document.getElementById('auditModalTitle');
const modalSub = document.getElementById('auditModalSub');
let lastFocusedRow = null;

function valueCell(v, cls) {
  if (v === null || v === undefined || v === '') return '<span class="val-empty">empty</span>';
  return `<span class="${cls}">${escapeHtml(v)}</span>`;
}

function renderChanges(changes) {
  if (!Array.isArray(changes) || !changes.length) {
    return '<div class="audit-no-changes">No field-level changes were recorded for this action.</div>';
  }
  const rows = changes.map((c) => `<tr>
      <td class="field">${escapeHtml(c.field)}</td>
      <td>${valueCell(c.old, 'val-old')}</td>
      <td>${valueCell(c.new, 'val-new')}</td>
    </tr>`).join('');
  return `<div class="audit-changes-wrap"><table class="audit-changes">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

function openDetail(index) {
  const r = state.rows[index];
  if (!r) return;
  const partner = r.partner;
  const record = [r.entityType, r.entityLabel].filter(Boolean).join(' · ') + (r.entityId != null ? `  (#${r.entityId})` : '');
  modalTitle.textContent = `${actionLabel(r.action)} · ${moduleLabel(r.module)}`;
  modalSub.textContent = r.entityLabel || r.entityType || '';
  modalBody.innerHTML = `
    <dl class="audit-meta">
      <div class="audit-meta--wide"><dt>Time</dt><dd>${escapeHtml(formatTimeFull(r.createdAt))}</dd></div>
      <div><dt>Partner</dt><dd>${escapeHtml(partner ? partner.name + (partner.code ? ' (' + partner.code + ')' : '') : '—')}</dd></div>
      <div><dt>User</dt><dd>${escapeHtml(r.actorName || '—')}${r.actorRole ? ' — ' + escapeHtml(titleCase(r.actorRole)) : ''}</dd></div>
      <div><dt>Record</dt><dd>${escapeHtml(record || '—')}</dd></div>
      <div><dt>IP address</dt><dd>${escapeHtml(r.ipAddress || '—')}</dd></div>
      <div class="audit-meta--wide"><dt>Browser</dt><dd>${r.userAgent
        ? escapeHtml(describeAgent(r.userAgent).label || 'Unknown browser') + `<div class="audit-ua">${escapeHtml(r.userAgent)}</div>`
        : 'Not recorded for this entry'}</dd></div>
    </dl>
    <h3 class="audit-changes-title">What changed</h3>
    ${renderChanges(r.changes)}`;
  modal.classList.remove('hidden');
  document.getElementById('auditModalClose').focus();
}

function closeDetail() {
  modal.classList.add('hidden');
  if (lastFocusedRow && document.body.contains(lastFocusedRow)) lastFocusedRow.focus();
  lastFocusedRow = null;
}

el.tbody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-index]');
  if (!tr) return;
  lastFocusedRow = tr;
  openDetail(parseInt(tr.getAttribute('data-index'), 10));
});
el.tbody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tr = e.target.closest('tr[data-index]');
  if (!tr) return;
  e.preventDefault();
  lastFocusedRow = tr;
  openDetail(parseInt(tr.getAttribute('data-index'), 10));
});
document.getElementById('auditModalClose').addEventListener('click', closeDetail);
document.getElementById('auditModalDone').addEventListener('click', closeDetail);
modal.addEventListener('click', (e) => { if (e.target === modal) closeDetail(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeDetail();
});

// ============================================================
// CSV export (same filters, ignores paging)
// ============================================================
el.exportBtn.addEventListener('click', async () => {
  if (el.exportBtn.disabled || !dateRangeValid()) return;
  const original = el.exportBtn.innerHTML;
  el.exportBtn.disabled = true;
  el.exportBtn.innerHTML = '<span class="spinner" style="margin-right:6px;border-color:rgba(255,255,255,.5);border-top-color:#fff"></span>Preparing…';
  try {
    const qs = filterParams().toString();
    const res = await Session.authFetch(ENDPOINTS.export + (qs ? '?' + qs : ''), { headers: { Accept: 'text/csv' } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || `Export failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(state.totalElements > EXPORT_LIMIT
      ? `Exported the newest ${EXPORT_LIMIT.toLocaleString('en-IN')} of ${state.totalElements.toLocaleString('en-IN')} entries. Narrow the date range to get the rest.`
      : 'Audit log exported.');
  } catch (err) {
    console.error('Export failed:', err);
    showToast(errorMessage(err, 'Could not export the audit log.'));
  } finally {
    el.exportBtn.disabled = false;
    el.exportBtn.innerHTML = original;
  }
});

// ============================================================
// Init
// ============================================================
(async function init() {
  await loadPartnerOptions();   // dropdown fills in parallel with the first page of logs
  // honour deep links such as /audit/audit.html?partnerId=3&module=CUSTOMER
  const q = new URLSearchParams(location.search);
  if (q.get('partnerId')) {
    el.partner.value = q.get('partnerId');
    if (el.partner.value) await loadUserOptions(el.partner.value);
  }
  if (q.get('module')) el.module.value = q.get('module').toUpperCase();
  if (q.get('action')) el.action.value = q.get('action').toUpperCase();
  loadLogs();
})();