// ============================================================
// Audit Log: platform staff holding AUDIT:VIEW, integrated with the Spring Boot backend (port 8091)
//
// session.js (loaded first) provides Session.api(path, { method }) and Session.authFetch(path).
// Access is decided by the SERVER: partners and platform staff without AUDIT:VIEW get 403 and this page shows
// a "no access" state instead of data. There is no client-side role check to keep in sync.
//
// Endpoints:
//   GET /api/audit?page=&size=&sort=&search=&partner=PLATFORM|partnerId=&userId=&module=&action=&entityType=&entityId=&from=&to=
//   GET /api/audit/{id}            one entry incl. masked previousData / newData (details drawer)
//   GET /api/audit/filters         module + action dropdown values
//   GET /api/audit/export?...      CSV (newest 5000 rows of the same filters)
//   GET /api/channel-partners/options, GET /api/users?partnerId=...   (Super Admin only: the page degrades without them)
// ============================================================

const ENDPOINTS = {
  list: '/api/audit',
  detail: (id) => `/api/audit/${encodeURIComponent(id)}`,
  filters: '/api/audit/filters',
  export: '/api/audit/export',
  partners: '/api/channel-partners/options',
  users: (partnerId) => `/api/users?partnerId=${encodeURIComponent(partnerId)}&page=0&size=100`,
};

const EXPORT_LIMIT = 5000;

const MODULE_LABELS = {
  AUTH: 'Login / Logout', CUSTOMER: 'Customer', PRODUCT: 'Product', PROJECT: 'Project',
  QUOTATION: 'Quotation', CALCULATOR: 'Calculator', REFERRAL: 'Referral', USER: 'User',
  ROLE: 'Role', SETTINGS: 'Settings', CHANNEL_PARTNER: 'Channel Partner', REPORT: 'Report', AUDIT: 'Audit Log',
};

const ACTION_LABELS = {
  CREATE: 'Create', UPDATE: 'Update', DELETE: 'Delete', STATUS_CHANGE: 'Status change',
  APPROVE: 'Approve', REJECT: 'Reject', CONVERT: 'Convert', MARK_PAID: 'Mark paid',
  PERMISSION_CHANGE: 'Permission change', LOGIN: 'Login', LOGOUT: 'Logout', PASSWORD_RESET: 'Password reset',
  LOGIN_FAILED: 'Login failed', ACCOUNT_LOCKED: 'Account locked', TOKEN_REUSE_DETECTED: 'Token reuse detected', EXPORT: 'Export',
};

const ACTION_PILL = {
  CREATE: 'pill-create', UPDATE: 'pill-update', DELETE: 'pill-delete', STATUS_CHANGE: 'pill-status',
  APPROVE: 'pill-approve', REJECT: 'pill-reject', CONVERT: 'pill-status', MARK_PAID: 'pill-money',
  PERMISSION_CHANGE: 'pill-update', LOGIN: 'pill-auth', LOGOUT: 'pill-auth', PASSWORD_RESET: 'pill-auth',
  LOGIN_FAILED: 'pill-reject', ACCOUNT_LOCKED: 'pill-reject', TOKEN_REUSE_DETECTED: 'pill-reject', EXPORT: 'pill-other',
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

/** Raw User-Agent -> "Chrome 130 · Windows" (best effort; the raw text stays in the drawer). */
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

const isForbidden = (err) => !!err && err.status === 403;

function errorMessage(err, fallback) {
  if (isForbidden(err)) return 'You do not have permission to view the audit log.';
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
// Sidebar + profile (same behaviour as every module)
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
profileBtn?.addEventListener('click', (e) => { e.stopPropagation(); profileDropdown.classList.toggle('hidden'); });
document.addEventListener('click', () => profileDropdown?.classList.add('hidden'));

// ============================================================
// State
// ============================================================
const state = {
  page: 0, size: 25, sortKey: 'createdAt', sortDir: 'desc',
  rows: [], totalElements: 0, totalPages: 0,
  loading: true, error: '', denied: false,
};
let requestSeq = 0;
let platformPartnerId = null;      // id of the PLATFORM partner, when the partner list is available

const el = {
  panel: document.getElementById('auditPanel'),
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
  entityType: document.getElementById('fEntityType'),
  entityId: document.getElementById('fEntityId'),
  from: document.getElementById('fFrom'),
  to: document.getElementById('fTo'),
  reset: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
};
const COLS = 8;

/** The server said 403: hide everything, show the explanation once. */
function setDenied() {
  state.denied = true;
  state.loading = false;
  el.panel.classList.add('audit-panel--denied');
  el.summary.textContent = 'No access';
}

// ============================================================
// Filters -> query string
// ============================================================
function filterParams() {
  const p = new URLSearchParams();
  const add = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') p.set(k, String(v).trim()); };
  add('search', el.search.value);
  if (el.partner.value === 'PLATFORM') add('partner', 'PLATFORM');
  else add('partnerId', el.partner.value);
  add('userId', el.user.value);
  add('module', el.module.value);
  add('action', el.action.value);
  add('entityType', el.entityType.value);
  add('entityId', el.entityId.value);
  add('from', el.from.value);
  add('to', el.to.value);
  return p;
}
const hasActiveFilters = () => [...filterParams().keys()].length > 0;

function filtersValid() {
  if (el.from.value && el.to.value && el.from.value > el.to.value) {
    showToast('"From" date must be on or before "To" date.');
    return false;
  }
  if (el.entityId.value && !/^\d+$/.test(el.entityId.value.trim())) {
    showToast('Record ID must be a whole number.');
    return false;
  }
  return true;
}

// ============================================================
// Load + render the table
// ============================================================
async function loadLogs() {
  if (state.denied || !filtersValid()) return;
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
    if (state.page > 0 && state.totalPages > 0 && state.page >= state.totalPages) {
      state.page = state.totalPages - 1;
      return loadLogs();
    }
  } catch (err) {
    if (seq !== requestSeq) return;
    console.error('Failed to load audit log:', err);
    state.rows = []; state.totalElements = 0; state.totalPages = 0;
    if (isForbidden(err)) { setDenied(); return; }
    state.error = errorMessage(err, 'Could not load the audit log.');
  } finally {
    if (seq === requestSeq && !state.denied) state.loading = false;
  }
  if (seq === requestSeq) renderTable();
}

const stateRow = (html) => `<tr class="state-row"><td class="state-cell" colspan="${COLS}">${html}</td></tr>`;

function renderTable() {
  updateSortIcons();
  if (state.denied) { el.tbody.innerHTML = ''; el.range.textContent = ''; el.pager.innerHTML = ''; return; }

  if (state.loading) {
    el.tbody.innerHTML = stateRow('<span class="spinner"></span>Loading audit log…');
    el.summary.textContent = 'Loading…'; el.range.textContent = ''; el.pager.innerHTML = '';
    return;
  }
  if (state.error) {
    el.tbody.innerHTML = stateRow(
      `${escapeHtml(state.error)}<br><button type="button" class="btn-primary" id="retryBtn" style="margin-top:10px">Try again</button>`);
    document.getElementById('retryBtn')?.addEventListener('click', loadLogs);
    el.summary.textContent = 'Could not load'; el.range.textContent = ''; el.pager.innerHTML = '';
    return;
  }
  if (!state.rows.length) {
    el.tbody.innerHTML = stateRow(hasActiveFilters()
      ? 'No log entries match these filters. Clear a filter or widen the date range.'
      : 'No activity has been recorded yet.');
    el.summary.textContent = hasActiveFilters() ? '0 matching entries' : 'No entries';
    el.range.textContent = ''; el.pager.innerHTML = '';
    return;
  }

  el.tbody.innerHTML = state.rows.map((r, i) => {
    const partner = r.partner;
    const entityLine = r.entityLabel || r.entityType || '—';
    return `<tr data-index="${i}" tabindex="0" aria-label="View details">
      <td data-label="Time">${escapeHtml(formatTime(r.createdAt))}</td>
      <td data-label="Partner">
        <span class="cell-main" title="${escapeHtml(partner ? partner.name : '')}">${escapeHtml(partner ? partner.name : '—')}</span>
        ${partner && partner.code ? `<span class="cell-sub">${escapeHtml(partner.code)}</span>` : ''}
      </td>
      <td data-label="User"><span class="cell-main" title="${escapeHtml(r.actorName || '')}">${escapeHtml(r.actorName || '—')}</span></td>
      <td data-label="Role">${escapeHtml(r.actorRole ? titleCase(r.actorRole) : '—')}</td>
      <td data-label="Module">${escapeHtml(moduleLabel(r.module))}</td>
      <td data-label="Action"><span class="pill ${ACTION_PILL[r.action] || 'pill-other'}">${escapeHtml(actionLabel(r.action))}</span></td>
      <td data-label="Record">
        <span class="cell-main" title="${escapeHtml([r.entityType, r.entityLabel].filter(Boolean).join(' · '))}">${escapeHtml(entityLine)}</span>
        ${r.entityLabel && r.entityType ? `<span class="cell-sub">${escapeHtml(r.entityType)}</span>` : ''}
      </td>
      <td data-label="IP"><span class="cell-main">${escapeHtml(r.ipAddress || '—')}</span></td>
    </tr>`;
  }).join('');

  const first = state.page * state.size + 1;
  const last = first + state.rows.length - 1;
  const n = (x) => x.toLocaleString('en-IN');
  el.range.textContent = `${n(first)}–${n(last)} of ${n(state.totalElements)}`;
  el.summary.textContent = `${n(state.totalElements)} ${hasActiveFilters() ? 'matching ' : ''}${state.totalElements === 1 ? 'entry' : 'entries'}, `
    + (state.sortKey === 'createdAt' && state.sortDir === 'desc' ? 'newest first' : 'custom order');
  renderPagination();
}

function renderPagination() {
  const total = state.totalPages, current = state.page + 1;
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

function updateSortIcons() {
  document.querySelectorAll('#auditTable thead th[data-key]').forEach((th) => {
    const active = th.getAttribute('data-key') === state.sortKey;
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
el.rowsPerPage.addEventListener('change', () => { state.size = parseInt(el.rowsPerPage.value, 10) || 25; state.page = 0; loadLogs(); });

// ============================================================
// Filter wiring
// ============================================================
function applyFilters() { state.page = 0; loadLogs(); }

let searchTimer = null;
const debounced = () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyFilters, 350); };
el.search.addEventListener('input', debounced);
el.entityType.addEventListener('input', debounced);
el.entityId.addEventListener('input', debounced);
[el.module, el.action, el.from, el.to, el.user].forEach((c) => c.addEventListener('change', applyFilters));

el.partner.addEventListener('change', async () => {
  await loadUserOptions(el.partner.value);
  applyFilters();
});

el.reset.addEventListener('click', async () => {
  clearTimeout(searchTimer);
  [el.search, el.entityType, el.entityId, el.from, el.to].forEach((i) => { i.value = ''; });
  el.partner.value = ''; el.module.value = ''; el.action.value = '';
  await loadUserOptions('');
  applyFilters();
});

function setOptions(select, firstLabel, items) {
  const keep = select.value;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>`
    + items.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('');
  if ([...select.options].some((o) => o.value === keep)) select.value = keep;
}

/** Dropdown values come from the server (modules that really occur). Falls back to the static lists in the HTML. */
async function loadFilterOptions() {
  try {
    const data = await call(ENDPOINTS.filters);
    if (data && Array.isArray(data.modules) && data.modules.length) {
      setOptions(el.module, 'All modules', data.modules.map((m) => [m, moduleLabel(m)]));
    }
    if (data && Array.isArray(data.actions) && data.actions.length) {
      setOptions(el.action, 'All actions', data.actions.map((a) => [a, actionLabel(a)]));
    }
  } catch (err) {
    if (isForbidden(err)) setDenied();
    else console.warn('Filter options not loaded, using built-in lists:', err);
  }
}

/** Partners are Super Admin only. Platform staff without that right still get "All" and "Platform". */
async function loadPartnerOptions() {
  try {
    const list = await call(ENDPOINTS.partners);
    const rows = (Array.isArray(list) ? list : []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const platform = rows.find((p) => String(p.code || '').toUpperCase() === 'PLATFORM');
    platformPartnerId = platform ? platform.id : null;
    const items = rows.filter((p) => p !== platform).map((p) => [String(p.id), p.name + (p.code ? ' (' + p.code + ')' : '')]);
    el.partner.innerHTML = '<option value="">All partners</option><option value="PLATFORM">Platform (internal)</option>'
      + items.map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('');
  } catch (err) {
    console.warn('Partner list not available (Super Admin only); using All / Platform only:', err);
  }
}

async function loadUserOptions(partnerValue) {
  const partnerId = partnerValue === 'PLATFORM' ? platformPartnerId : partnerValue;
  if (!partnerId) {
    el.user.innerHTML = `<option value="">${partnerValue === 'PLATFORM' ? 'Users of Platform unavailable' : 'Choose a partner first'}</option>`;
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
  }
}

// ============================================================
// Details drawer: header facts + side-by-side previous / new
// ============================================================
const drawer = document.getElementById('auditDrawer');
const drawerBackdrop = document.getElementById('auditDrawerBackdrop');
const drawerBody = document.getElementById('auditDrawerBody');
const drawerTitle = document.getElementById('auditDrawerTitle');
const drawerSub = document.getElementById('auditDrawerSub');
let lastFocusedRow = null;
let detailSeq = 0;

const isEmptyVal = (v) => v === null || v === undefined || v === '';

function valueHtml(v) {
  if (isEmptyVal(v)) return '<span class="audit-diff-empty">empty</span>';
  if (typeof v === 'object') return `<span>${escapeHtml(JSON.stringify(v, null, 2))}</span>`;
  return `<span>${escapeHtml(v)}</span>`;
}

/** Rows for the diff, from the two snapshots. status: added | removed | changed | same. */
function buildDiff(prev, next) {
  const a = prev && typeof prev === 'object' ? prev : {};
  const b = next && typeof next === 'object' ? next : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.map((k) => {
    const hasOld = !isEmptyVal(a[k]), hasNew = !isEmptyVal(b[k]);
    const same = JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null);
    const status = same ? 'same' : (!hasOld && hasNew ? 'added' : (hasOld && !hasNew ? 'removed' : 'changed'));
    return { field: k, oldV: a[k], newV: b[k], status };
  });
}

function diffTable(rows, showSame) {
  const shown = rows.filter((r) => showSame || r.status !== 'same');
  if (!shown.length) return '<div class="audit-drawer-state">No field differences.</div>';
  return `<div class="audit-diff-scroll"><div class="audit-diff" role="table" aria-label="Previous and new values">
    <div class="audit-diff-row audit-diff-row--head" role="row"><div role="columnheader">Field</div><div role="columnheader">Previous</div><div role="columnheader">New</div></div>
    ${shown.map((r) => `<div class="audit-diff-row ${r.status === 'same' ? 'is-same' : 'is-changed'}" role="row">
      <div class="audit-diff-field" role="rowheader">${escapeHtml(r.field)}</div>
      <div class="audit-diff-old" role="cell">${valueHtml(r.oldV)}</div>
      <div class="audit-diff-new" role="cell">${valueHtml(r.newV)}</div></div>`).join('')}
  </div></div>`;
}

function renderChangeBlock(r) {
  const hasSnap = (r.previousData && typeof r.previousData === 'object') || (r.newData && typeof r.newData === 'object');
  if (hasSnap) {
    const rows = buildDiff(r.previousData, r.newData);
    const changed = rows.filter((x) => x.status !== 'same').length;
    return `<div class="audit-diff-head"><h3>What changed <span class="audit-tag-id">${changed} of ${rows.length} fields</span></h3>
        <label class="audit-diff-toggle"><input type="checkbox" id="showUnchanged" /> Show unchanged fields</label></div>
      <p class="audit-diff-note">Sensitive values are masked before they are stored.</p>
      <div id="diffHost">${diffTable(rows, false)}</div>`;
  }
  // entries written before snapshots existed (or events without a record): show the field list
  const changes = Array.isArray(r.changes) ? r.changes : [];
  if (!changes.length) {
    return '<div class="audit-diff-head"><h3>What changed</h3></div><div class="audit-drawer-state">No field-level changes were recorded for this action.</div>';
  }
  const rows = changes.map((c) => ({ field: c.field, oldV: c.old, newV: c.new, status: 'changed' }));
  return `<div class="audit-diff-head"><h3>What changed</h3></div>
    <p class="audit-diff-note">This older entry has no full snapshot; showing the recorded field changes.</p>${diffTable(rows, true)}`;
}

function renderDetail(r) {
  const partner = r.partner;
  const partnerText = partner ? partner.name + (partner.code ? ' (' + partner.code + ')' : '') : '—';
  const tenantId = r.tenantId != null ? `<span class="audit-tag-id">tenant #${escapeHtml(r.tenantId)}</span>` : '';
  const actorTenant = r.actorTenantId != null ? `<span class="audit-tag-id">tenant #${escapeHtml(r.actorTenantId)}</span>` : '';
  const record = [r.entityType, r.entityLabel].filter(Boolean).join(' · ') + (r.entityId != null ? `  (#${r.entityId})` : '');
  drawerTitle.textContent = `${actionLabel(r.action)} · ${moduleLabel(r.module)}`;
  drawerSub.textContent = r.entityLabel || r.entityType || '';
  drawerBody.innerHTML = `
    <dl class="audit-meta">
      <div class="audit-meta--wide"><dt>Time</dt><dd>${escapeHtml(formatTimeFull(r.createdAt))}</dd></div>
      <div><dt>Partner (tenant)</dt><dd>${escapeHtml(partnerText)}${tenantId}</dd></div>
      <div><dt>User</dt><dd>${escapeHtml(r.actorName || '—')}${r.actorRole ? ' — ' + escapeHtml(titleCase(r.actorRole)) : ''}${actorTenant}</dd></div>
      <div><dt>Record</dt><dd>${escapeHtml(record || '—')}</dd></div>
      <div><dt>IP address</dt><dd>${escapeHtml(r.ipAddress || '—')}</dd></div>
      <div class="audit-meta--wide"><dt>Browser</dt><dd>${r.userAgent
        ? escapeHtml(describeAgent(r.userAgent).label || 'Unknown browser') + `<div class="audit-ua">${escapeHtml(r.userAgent)}</div>`
        : 'Not recorded for this entry'}</dd></div>
    </dl>
    ${renderChangeBlock(r)}`;
  const toggle = document.getElementById('showUnchanged');
  if (toggle) {
    const rows = buildDiff(r.previousData, r.newData);
    toggle.addEventListener('change', () => {
      document.getElementById('diffHost').innerHTML = diffTable(rows, toggle.checked);
    });
  }
}

async function openDetail(index) {
  const row = state.rows[index];
  if (!row) return;
  const seq = ++detailSeq;
  drawerTitle.textContent = `${actionLabel(row.action)} · ${moduleLabel(row.module)}`;
  drawerSub.textContent = row.entityLabel || row.entityType || '';
  drawerBody.innerHTML = '<div class="audit-drawer-state"><span class="spinner"></span>Loading details…</div>';
  drawer.classList.remove('hidden');
  drawerBackdrop.classList.remove('hidden');
  document.getElementById('auditDrawerClose').focus();
  try {
    const full = await call(ENDPOINTS.detail(row.id));
    if (seq !== detailSeq) return;
    renderDetail(full);
  } catch (err) {
    if (seq !== detailSeq) return;
    console.error('Failed to load audit entry:', err);
    if (isForbidden(err)) { closeDetail(); setDenied(); renderTable(); return; }
    drawerBody.innerHTML = `<div class="audit-drawer-state">${escapeHtml(errorMessage(err, 'Could not load the details.'))}<br>
      <button type="button" class="btn-primary" id="detailRetry" style="margin-top:10px">Try again</button></div>`;
    document.getElementById('detailRetry')?.addEventListener('click', () => openDetail(index));
  }
}

function closeDetail() {
  detailSeq++;
  drawer.classList.add('hidden');
  drawerBackdrop.classList.add('hidden');
  if (lastFocusedRow && document.body.contains(lastFocusedRow)) lastFocusedRow.focus();
  lastFocusedRow = null;
}

function rowFromEvent(e) { return e.target.closest('tr[data-index]'); }
el.tbody.addEventListener('click', (e) => {
  const tr = rowFromEvent(e);
  if (!tr) return;
  lastFocusedRow = tr;
  openDetail(parseInt(tr.getAttribute('data-index'), 10));
});
el.tbody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const tr = rowFromEvent(e);
  if (!tr) return;
  e.preventDefault();
  lastFocusedRow = tr;
  openDetail(parseInt(tr.getAttribute('data-index'), 10));
});
document.getElementById('auditDrawerClose').addEventListener('click', closeDetail);
document.getElementById('auditDrawerDone').addEventListener('click', closeDetail);
drawerBackdrop.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeDetail();
  // keep Tab inside the open drawer
  if (e.key === 'Tab' && !drawer.classList.contains('hidden')) {
    const f = [...drawer.querySelectorAll('button, input, [href], select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ============================================================
// CSV export (same filters, ignores paging)
// ============================================================
el.exportBtn.addEventListener('click', async () => {
  if (el.exportBtn.disabled || !filtersValid()) return;
  const original = el.exportBtn.innerHTML;
  el.exportBtn.disabled = true;
  el.exportBtn.innerHTML = '<span class="spinner" style="margin-right:6px;border-color:rgba(255,255,255,.5);border-top-color:#fff"></span>Preparing…';
  try {
    const qs = filterParams().toString();
    const res = await Session.authFetch(ENDPOINTS.export + (qs ? '?' + qs : ''), { headers: { Accept: 'text/csv' } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(res.status === 403 ? 'You do not have permission to export the audit log.' : (body.message || `Export failed (${res.status})`));
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(state.totalElements > EXPORT_LIMIT
      ? `Exported the newest ${EXPORT_LIMIT.toLocaleString('en-IN')} of ${state.totalElements.toLocaleString('en-IN')} entries. Narrow the date range to get the rest.`
      : 'Audit log exported.');
  } catch (err) {
    console.error('Export failed:', err);
    showToast(isForbidden(err) ? 'You do not have permission to export the audit log.' : errorMessage(err, 'Could not export the audit log.'));
  } finally {
    el.exportBtn.disabled = false;
    el.exportBtn.innerHTML = original;
  }
});

// ============================================================
// Init
// ============================================================
(async function init() {
  await Promise.all([loadPartnerOptions(), loadFilterOptions()]);
  if (state.denied) { renderTable(); return; }
  // deep links such as /audit/audit.html?partnerId=3&module=CUSTOMER&entityType=Quotation&entityId=42
  const q = new URLSearchParams(location.search);
  if (q.get('partner') && q.get('partner').toUpperCase() === 'PLATFORM') el.partner.value = 'PLATFORM';
  else if (q.get('partnerId')) el.partner.value = q.get('partnerId');
  if (el.partner.value) await loadUserOptions(el.partner.value);
  if (q.get('module')) el.module.value = q.get('module').toUpperCase();
  if (q.get('action')) el.action.value = q.get('action').toUpperCase();
  if (q.get('entityType')) el.entityType.value = q.get('entityType');
  if (q.get('entityId') && /^\d+$/.test(q.get('entityId'))) el.entityId.value = q.get('entityId');
  loadLogs();
})();