/* ============================================================
   Reports & Analytics — report.js (backend-integrated)
   Endpoints used:
     GET /api/reports/summary
     GET /api/reports/quotations      ?from&to&status&salesUserId&viewPartnerId&page&size&sort
     GET /api/reports/referral-income (same filters)
     GET /api/reports/top-performers  (same filters)
     GET /api/reports/export?type=QUOTATIONS|REFERRAL_INCOME|GST&format=PDF|EXCEL&...
     GET /api/products?page&size
     GET /api/channel-partners/options
     GET /api/quotations/{id}/pdf
   All wrapped as ApiResponse { success, message, data }.

   Tenant rule: every report is the caller's OWN tenant. Only a Super Admin may look at ONE other
   partner, by sending ?viewPartnerId= (read-only GET). The server ignores it for everybody else.
   ============================================================ */

// ---------------- shared helpers ----------------
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// same dark toast as every other module; the icon is an optional extra
function showToast(message, icon = 'fa-circle-check', color = 'emerald') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate flex items-center gap-2 bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.innerHTML = `<i class="fas ${esc(icon)} text-${esc(color)}-400"></i> ${esc(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ---------------- logging (Module 0) ----------------
// Uses the shared window.AppLog when it is loaded, console otherwise. Context objects carry ONLY filters,
// endpoint names, HTTP status, counts and timings — never a customer / referrer name, e-mail or phone,
// and never a response body.
function applog(level, msg, ctx) {
  const line = '[REPORT] ' + msg;
  try {
    const L = window.AppLog;
    if (L && typeof L[level] === 'function') { L[level](line, ctx); return; }
  } catch (_) { /* logging must never break the page */ }
  (console[level] || console.log).call(console, line, ctx || '');
}
/** Filter snapshot for log lines (dates, status, ids). */
function filterLogCtx() {
  return { from: filters.from, to: filters.to, status: filters.status || null, viewPartnerId: filters.viewPartnerId };
}
function logLoadFailure(endpoint, err) {
  // 403 is a permission outcome, not a fault
  applog(err && err.status === 403 ? 'warn' : 'error', `load failed endpoint=${endpoint}`,
    { endpoint, status: err?.status ?? null, ...filterLogCtx() });
}

/** Unwraps ApiResponse { success, data }. Throws Error on failure. */
async function apiJson(path, options) {
  if (!window.Session || typeof Session.authFetch !== 'function') {
    throw new Error('Session.authFetch unavailable (session.js missing?)');
  }
  const res = await Session.authFetch(path, options);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok || !body || body.success === false) {
    const fieldMsg = body?.errors?.map(e => e.message).join(', ') || '';
    const err = new Error(body?.message || fieldMsg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body.data;
}

/** Download raw binary (export / PDF) through the authenticated fetch.
 *  On failure the server's own message is kept (e.g. "This export has 6000 rows; the limit is 5000…"). */
async function apiDownload(path, filename) {
  const res = await Session.authFetch(path);
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.clone().json())?.message || ''; } catch (_) {}
    const err = new Error(msg || `Download failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** yyyy-mm-dd in the user's LOCAL time (toISOString() is UTC and can shift the day). */
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => localISO(new Date());

// ---------------- sidebar ----------------
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
  sidebar?.classList.toggle('expanded', next);
  sidebar?.classList.toggle('collapsed', !next);
  if (toggleIcon) toggleIcon.style.transform = next ? 'rotate(180deg)' : 'rotate(0deg)';
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

// ---------------- user name / initial ----------------
function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch(_) { return null; }
}
function getLoggedInUserName() {
  const sources = [];
  try {
    if (window.Session) {
      if (typeof Session.getUser === 'function') sources.push(Session.getUser());
      if (typeof Session.getSession === 'function') sources.push(Session.getSession());
      if (Session.user) sources.push(Session.user);
    }
  } catch(_) {}
  try { const raw = sessionStorage.getItem('sqms_session'); if (raw) sources.push(JSON.parse(raw)); } catch(_) {}
  for (const s of sources.filter(Boolean)) {
    const u = s.user || s.data?.user || s.data || s;
    const name = u.fullName || u.name || u.userName || u.username ||
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

// ---------------- dropdowns ----------------
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const exportBtn = document.getElementById('exportBtn');
const exportMenu = document.getElementById('exportMenu');

function closeAllDropdowns(except) {
  [notifDropdown, profileDropdown, exportMenu].forEach(dd => {
    if (dd && dd !== except) dd.classList.add('hidden');
  });
  notifBtn?.setAttribute('aria-expanded', String(!!notifDropdown && !notifDropdown.classList.contains('hidden')));
}
function wireDropdown(btn, dd) {
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = dd.classList.contains('hidden');
    closeAllDropdowns();
    dd.classList.toggle('hidden', !willOpen);
    notifBtn?.setAttribute('aria-expanded', String(!notifDropdown.classList.contains('hidden')));
  });
}
wireDropdown(notifBtn, notifDropdown);
wireDropdown(profileBtn, profileDropdown);
wireDropdown(exportBtn, exportMenu);
// clicks inside the notification dropdown (tabs, mark all read, delete…) must not close it
notifDropdown?.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => closeAllDropdowns());
document.getElementById('profileLogoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  try {
    if (window.Session && typeof Session.logout === 'function') Session.logout();
    else sessionStorage.removeItem('sqms_session');
  } catch(_) {}
  window.location.href = '/index.html';
});

// ============================================================
// FILTER STATE — single source of truth for every request
// viewPartnerId: Super Admin only, read-only look at ONE other partner. null = own tenant.
// ============================================================
const filters = { from: null, to: null, status: '', salesUserId: null, viewPartnerId: null };

/** First load: 1 Jan of this year → today (the old hard-coded 2026-01-01…2026-06-30 hid newer data). */
function setDefaultDates() {
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl && !fromEl.value) fromEl.value = localISO(new Date(new Date().getFullYear(), 0, 1));
  if (toEl && !toEl.value) toEl.value = todayISO();
}

function readFilterInputs() {
  filters.from  = document.getElementById('fromDate')?.value || null;
  filters.to    = document.getElementById('toDate')?.value || null;
  const s       = document.getElementById('statusFilter')?.value || 'all';
  filters.status = s === 'all' ? '' : s.toUpperCase();
  const cp = document.getElementById('channelPartnerFilter');
  // only a Super Admin has this control (it is hidden for everybody else, and the server ignores the param anyway)
  filters.viewPartnerId = window.currentUserRole === 'SUPER_ADMIN' && cp && cp.value !== 'all' && cp.value !== '' ? cp.value : null;
}

/** true when From is after To — checked before any request so the user gets a clear message, not an empty report. */
function invalidRange() {
  if (filters.from && filters.to && filters.from > filters.to) {
    showToast('"From" date is after "To" date', 'fa-triangle-exclamation', 'amber');
    return true;
  }
  return false;
}

/** Builds a URLSearchParams including only non-empty filters. */
function filterQuery(extra = {}) {
  const qs = new URLSearchParams();
  if (filters.from) qs.set('from', filters.from);
  if (filters.to)   qs.set('to', filters.to);
  if (filters.status) qs.set('status', filters.status);
  if (filters.salesUserId != null) qs.set('salesUserId', String(filters.salesUserId));
  if (filters.viewPartnerId != null) qs.set('viewPartnerId', String(filters.viewPartnerId));
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs;
}

// ============================================================
// FORMAT HELPERS
// ============================================================
const STATUS_META = {
  ACCEPTED: { label: 'Accepted', icon: 'fa-circle-check', css: 'accepted' },
  PENDING:  { label: 'Pending',  icon: 'fa-hourglass-half', css: 'pending'  },
  REJECTED: { label: 'Rejected', icon: 'fa-circle-xmark',   css: 'rejected' },
};
const statusMeta = (s) => STATUS_META[String(s || '').toUpperCase()] || { label: s || '—', icon: 'fa-circle', css: '' };

// referral statuses (PENDING / APPROVED / PAID / REJECTED) -> pill look
const REF_STATUS = {
  PENDING:  { label: 'Pending',  css: 'pending'  },
  APPROVED: { label: 'Approved', css: 'approved' },
  PAID:     { label: 'Paid',     css: 'accepted' },
  REJECTED: { label: 'Rejected', css: 'rejected' },
};

function formatAmount(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function formatCompactINR(n) {
  if (n == null || isNaN(Number(n))) return '—';
  n = Number(n); const a = Math.abs(n);
  if (a >= 1e7) return '₹' + (n/1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return '₹' + (n/1e5).toFixed(1) + ' L';
  if (a >= 1e3) return '₹' + (n/1e3).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}
function formatSize(kw) {
  if (kw == null || isNaN(Number(kw))) return '—';
  return Number(kw) + ' kW';
}
function parseIsoDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
}
function formatDate(iso) {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
}

// ============================================================
// SUMMARY (KPI widgets + charts)
// ============================================================
async function loadSummary() {
  try {
    const data = await apiJson('/api/reports/summary?' + filterQuery().toString());
    renderSummary(data);
  } catch (err) {
    logLoadFailure('summary', err);
    showToast(err.status === 403
      ? 'You do not have permission to view reports'
      : `Couldn't load KPIs: ${err.message}`, 'fa-triangle-exclamation', 'rose');
  }
}

function renderSummary(d) {
  if (!d) return;

  const totalQuotes = Number(d.totalQuotations) || 0;
  const totalVal = Number(d.totalValue) || 0;
  const acceptedCount = Number(d.accepted) || 0;
  const pendingCount = Number(d.pending) || 0;

  // The summary endpoint has no accepted / pending VALUE, so these two are estimates
  // (count x average deal size) until the backend returns the real sums.
  const avgDeal = totalQuotes > 0 ? (totalVal / totalQuotes) : 0;
  const acceptedVal = acceptedCount * avgDeal;
  const pendingVal = pendingCount * avgDeal;
  const convRate = totalQuotes > 0 ? ((acceptedCount / totalQuotes) * 100) : 0;

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setTxt('kpiTotalQuotes', totalQuotes.toLocaleString('en-IN'));
  setTxt('kpiTotalValue', formatCompactINR(totalVal));
  setTxt('kpiAcceptedValue', formatCompactINR(acceptedVal));
  setTxt('kpiConversionRate', convRate.toFixed(1) + '%');
  setTxt('kpiAvgDeal', formatCompactINR(avgDeal));
  setTxt('kpiPendingValue', formatCompactINR(pendingVal));

  window.__chartData = {
    trend: [],                 // backend does not return a monthly trend yet
    statusDistribution: { accepted: acceptedCount, pending: pendingCount, rejected: Number(d.rejected) || 0 },
    revenueBySystemSize: [],   // backend does not return a size breakdown yet
  };

  if (window.__chartsReady) applyChartData();
}

// ============================================================
// TOP PERFORMERS
// ============================================================
async function loadTopPerformers() {
  const el = document.getElementById('topPerformers');
  if (!el) return;
  el.innerHTML = '<p class="text-[11px] text-gray-400">Loading…</p>';

  try {
    const page = await apiJson('/api/reports/top-performers?' + filterQuery({ page: 0, size: 5 }).toString());
    const rows = page.content || [];
    if (!rows.length) { el.innerHTML = '<p class="text-[11px] text-gray-400">No data for this period</p>'; return; }

    el.innerHTML = rows.map(p => `
      <div class="alert-row bg-peach-100/60">
        <span class="font-medium text-gray-800">${esc(p.name || '—')}</span>
        <span class="text-peach-600 font-semibold">${esc(p.accepted ?? 0)}/${esc(p.quotes ?? 0)} · ${esc(p.ratePercent ?? 0)}%</span>
      </div>`).join('');
  } catch (err) {
    logLoadFailure('top-performers', err);
    el.innerHTML = '<p class="text-[11px] text-rose-500">Couldn\'t load performers</p>';
  }
}

// ============================================================
// QUOTATION REPORT TABLE (server-paged)
// ============================================================
const tableState = {
  sortKey: 'date', sortDir: 'desc',
  page: 1, size: 10, totalPages: 1, totalElements: 0,
  rows: [], loading: false, error: '', seq: 0,
};
// NOTE: the server only sorts by createdAt, quoteDate, totalAmount, code, status, systemSizeKw.
// Any other field (customerName, salesPersonName) silently falls back to createdAt on the server.
const SORT_FIELD_QUOTATION = {
  quoteNo: 'code', customer: 'customerName', systemSize: 'systemSizeKw',
  amount: 'totalAmount', salesPerson: 'salesPersonName', status: 'status', date: 'quoteDate',
};

function mapQuotationRow(q) {
  return {
    id: q.id || '',
    quoteNo: q.quoteNo || '',
    customer: q.customer || '—',
    systemSize: q.systemSizeKw || 0,
    amount: q.amount || 0,
    salesPerson: q.salesPerson || '—',
    status: String(q.status || '').toUpperCase(),
    date: q.date,
  };
}

async function loadQuotations() {
  const mySeq = ++tableState.seq;
  tableState.loading = true;
  renderQuotationTable();

  const field = SORT_FIELD_QUOTATION[tableState.sortKey] || 'quoteDate';
  const sort = `${field},${tableState.sortDir}`;
  const qs = filterQuery({ page: tableState.page - 1, size: tableState.size, sort });

  try {
    const page = await apiJson('/api/reports/quotations?' + qs.toString());
    if (mySeq !== tableState.seq) return;
    tableState.rows = (page.content || []).map(mapQuotationRow);
    tableState.totalElements = page.totalElements ?? tableState.rows.length;
    tableState.totalPages = Math.max(1, page.totalPages ?? 1);
    tableState.error = '';
    if (tableState.page > tableState.totalPages) {
      tableState.page = tableState.totalPages;
      return loadQuotations();
    }
  } catch (err) {
    if (mySeq !== tableState.seq) return;
    logLoadFailure('quotations', err);
    tableState.rows = []; tableState.totalElements = 0;
    tableState.error = err.status === 403 ? 'You do not have permission to view reports.' : `Couldn't load reports: ${err.message}`;
  } finally {
    if (mySeq === tableState.seq) { tableState.loading = false; renderQuotationTable(); }
  }
}

function renderQuotationTable() {
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  if (tableState.loading && !tableState.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-4">Loading…</td></tr>';
  } else if (tableState.error && !tableState.rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-rose-500 py-4">${esc(tableState.error)}</td></tr>`;
  } else if (!tableState.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-4">No quotations in this period</td></tr>';
  } else {
    tbody.innerHTML = tableState.rows.map(row => {
      const meta = statusMeta(row.status);
      return `
      <tr class="cursor-pointer" data-quote="${esc(row.quoteNo)}" data-id="${esc(row.id)}">
        <td data-label="Quotation No." class="font-medium">${esc(row.quoteNo)}</td>
        <td data-label="Customer">${esc(row.customer)}</td>
        <td data-label="System Size">${formatSize(row.systemSize)}</td>
        <td data-label="Amount">${formatAmount(row.amount)}</td>
        <td data-label="Sales Person">${esc(row.salesPerson || '—')}</td>
        <td data-label="Status"><span class="status-pill ${meta.css}"><i class="fas ${meta.icon}"></i> ${esc(meta.label)}</span></td>
        <td data-label="Date">${formatDate(row.date)}</td>
        <td data-label="Actions">
          <div class="flex items-center gap-1 justify-end">
            <span class="row-action-btn" data-act="view" title="View"><i class="fas fa-eye"></i></span>
            <span class="row-action-btn" data-act="pdf" title="Download PDF"><i class="fas fa-file-arrow-down"></i></span>
            <span class="row-action-btn" data-act="print" title="Print"><i class="fas fa-print"></i></span>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const start = (tableState.page - 1) * tableState.size;
  const info = document.getElementById('pageInfo');
  if (info) info.textContent = tableState.totalElements === 0
    ? 'No results'
    : `Showing ${start + 1}–${Math.min(start + tableState.rows.length, tableState.totalElements)} of ${tableState.totalElements}`;

  renderPagination('pagination', tableState, () => { loadQuotations(); });
  updateSortIndicators('#reportTable thead', tableState.sortKey, tableState.sortDir);
}

// ============================================================
// PRODUCT REPORT
// ============================================================
async function loadProducts() {
  const tbody = document.getElementById('productTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-4">Loading…</td></tr>';

  try {
    const page = await apiJson('/api/products?page=0&size=100');
    const rows = page.content || [];

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400 py-4">No products found</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(p => `
      <tr>
        <td data-label="SKU/Code" class="font-medium">${esc(p.code || '—')}</td>
        <td data-label="Product Name">${esc(p.name || '—')}</td>
        <td data-label="Category">${esc(p.category || p.categoryName || '—')}</td>
        <td data-label="Stock">${esc(p.stockQuantity ?? p.stock ?? 0)}</td>
        <td data-label="Price">${formatAmount(p.sellingPrice || p.price || 0)}</td>
        <td data-label="Status"><span class="status-pill ${p.active !== false ? 'accepted' : 'rejected'}">${p.active !== false ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    logLoadFailure('products', err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-rose-500 py-4">Failed to load: ${esc(err.message)}</td></tr>`;
  }
}

// ============================================================
// REFERRAL INCOME
// ============================================================
const refState = {
  sortKey: 'referrerName', sortDir: 'asc',
  page: 1, size: 10, totalPages: 1, totalElements: 0, rows: [], loading: false, error: '', seq: 0,
};
// UI column key -> backend sort field (server whitelist: createdAt, quoteDate, totalAmount, code, status, systemSizeKw;
// referredBy / customerId / referralPercent / referralAmount are not on it yet and fall back to createdAt)
const SORT_FIELD_REF = {
  referrerName: 'referredBy',
  referredCustomer: 'customerId',
  quotationAmount: 'totalAmount',
  referralPercent: 'referralPercent',
  referralAmount: 'referralAmount',
  status: 'status',
};

function mapRefRow(r) {
  return {
    referrerName: r.referrerName || '—',
    referredCustomer: r.referredCustomer || '—',
    quotationAmount: r.quotationAmount || 0,
    referralPercent: r.referralPercent || 0,
    referralAmount: r.referralAmount || 0,
    status: String(r.status || '').toUpperCase(),
    partnerName: r.partnerName || '—',
  };
}

async function loadReferral() {
  const mySeq = ++refState.seq;
  refState.loading = true; renderReferralTable();
  const field = SORT_FIELD_REF[refState.sortKey] || 'referredBy';
  const qs = filterQuery({ page: refState.page - 1, size: refState.size, sort: `${field},${refState.sortDir}` });
  try {
    const page = await apiJson('/api/reports/referral-income?' + qs.toString());
    if (mySeq !== refState.seq) return;
    refState.rows = (page.content || []).map(mapRefRow);
    refState.totalElements = page.totalElements ?? refState.rows.length;
    refState.totalPages = Math.max(1, page.totalPages ?? 1);
    refState.error = '';
    if (refState.page > refState.totalPages) { refState.page = refState.totalPages; return loadReferral(); }
  } catch (err) {
    if (mySeq !== refState.seq) return;
    logLoadFailure('referral-income', err);
    refState.rows = []; refState.error = `Couldn't load referrals: ${err.message}`;
  } finally {
    if (mySeq === refState.seq) { refState.loading = false; renderReferralTable(); }
  }
}

function renderReferralTable() {
  const tbody = document.getElementById('referralTableBody');
  if (!tbody) return;
  const isAdmin = window.currentUserRole === 'SUPER_ADMIN';
  const cols = isAdmin ? 7 : 6;
  document.getElementById('thReferralPartner')?.classList.toggle('hidden', !isAdmin);

  if (refState.loading && !refState.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-gray-400 py-4">Loading…</td></tr>`;
  } else if (refState.error && !refState.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-rose-500 py-4">${esc(refState.error)}</td></tr>`;
  } else if (!refState.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-gray-400 py-4">No referral records</td></tr>`;
  } else {
    tbody.innerHTML = refState.rows.map(r => {
      const meta = REF_STATUS[r.status] || { label: r.status || '—', css: '' };
      return `
      <tr>
        <td data-label="Referrer Name" class="font-medium">${esc(r.referrerName)}</td>
        <td data-label="Referred Customer">${esc(r.referredCustomer)}</td>
        <td data-label="Quotation Amount">${formatAmount(r.quotationAmount)}</td>
        <td data-label="Referral %">${esc(r.referralPercent ?? 0)}%</td>
        <td data-label="Referral Amount">${formatAmount(r.referralAmount)}</td>
        <td data-label="Status"><span class="status-pill ${meta.css}">${esc(meta.label)}</span></td>
        ${isAdmin ? `<td data-label="Channel Partner">${esc(r.partnerName || '—')}</td>` : ''}
      </tr>`;
    }).join('');
  }
  const start = (refState.page - 1) * refState.size;
  const info = document.getElementById('referralPageInfo');
  if (info) info.textContent = refState.totalElements === 0
    ? 'No results'
    : `Showing ${start + 1}–${Math.min(start + refState.rows.length, refState.totalElements)} of ${refState.totalElements}`;
  renderPagination('referralPagination', refState, loadReferral);
  updateSortIndicators('#referralTable thead', refState.sortKey, refState.sortDir);
}

// ============================================================
// PAGINATION + SORT INDICATORS (shared)
// ============================================================
function renderPagination(elId, state, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';

  const mk = (label, disabled, active, handler) => {
    const b = document.createElement('span');
    b.className = `page-btn ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
    b.innerHTML = label;
    if (!disabled && !active) b.addEventListener('click', handler);
    return b;
  };

  el.appendChild(mk('<i class="fas fa-chevron-left"></i>', state.page === 1, false, () => { state.page--; onPage(); }));

  const tp = state.totalPages;
  const cur = state.page;
  const pages = [];
  if (tp <= 7) for (let i = 1; i <= tp; i++) pages.push(i);
  else {
    pages.push(1);
    if (cur > 3) pages.push('…');
    for (let i = Math.max(2, cur - 1); i <= Math.min(tp - 1, cur + 1); i++) pages.push(i);
    if (cur < tp - 2) pages.push('…');
    pages.push(tp);
  }
  pages.forEach(p => {
    if (p === '…') { el.appendChild(mk('…', true, false, null)); return; }
    el.appendChild(mk(String(p), false, p === cur, () => { state.page = p; onPage(); }));
  });

  el.appendChild(mk('<i class="fas fa-chevron-right"></i>', state.page === state.totalPages, false, () => { state.page++; onPage(); }));
}

function updateSortIndicators(theadSel, sortKey, sortDir) {
  document.querySelectorAll(`${theadSel} th[data-key]`).forEach(th => {
    const icon = th.querySelector('.sort-icon');
    th.classList.remove('sorted');
    if (icon) icon.className = 'fas fa-sort sort-icon';
    if (th.dataset.key === sortKey && icon) {
      th.classList.add('sorted');
      icon.className = `fas ${sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon`;
    }
  });
}

// ============================================================
// WIRE UP SORT HEADERS, FILTERS, PAGE-SIZE, TABS
// ============================================================
function wireSort(tableSel, state, reload) {
  document.querySelectorAll(`${tableSel} thead th[data-key]`).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = 'asc'; }
      state.page = 1;
      reload();
    });
  });
}
wireSort('#reportTable', tableState, loadQuotations);
wireSort('#referralTable', refState, loadReferral);

document.getElementById('pageSize')?.addEventListener('change', (e) => {
  tableState.size = parseInt(e.target.value, 10); tableState.page = 1; loadQuotations();
});
document.getElementById('referralPageSize')?.addEventListener('change', (e) => {
  refState.size = parseInt(e.target.value, 10); refState.page = 1; loadReferral();
});

function reloadAll() {
  tableState.page = refState.page = 1;
  loadSummary();
  loadTopPerformers();
  loadQuotations();
  loadReferral();
}

document.getElementById('applyFilters')?.addEventListener('click', () => {
  readFilterInputs();
  if (invalidRange()) return;
  reloadAll();
  showToast('Filters applied', 'fa-filter');
});

document.getElementById('resetFilters')?.addEventListener('click', () => {
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl) fromEl.value = localISO(new Date(new Date().getFullYear(), 0, 1));
  if (toEl)   toEl.value   = todayISO();
  const s = document.getElementById('statusFilter'); if (s) s.value = 'all';
  const cp = document.getElementById('channelPartnerFilter'); if (cp) cp.value = 'all';
  readFilterInputs();
  reloadAll();
  showToast('Filters reset', 'fa-rotate-left');
});

// Table row actions: view, pdf, print — and a click anywhere on the row opens the quotation
async function handleRowAction(action, tr) {
  const rowId = tr.dataset.id;
  const quoteNo = tr.dataset.quote || rowId;
  if (action === 'print') { window.print(); return; }
  if (!rowId) {                                   // the row came without an id: nothing to open or download
    showToast('This quotation cannot be opened from here', 'fa-triangle-exclamation', 'amber');
    applog('warn', 'row action without id', { action });
    return;
  }
  if (action === 'view') {
    window.location.href = `/Quotation/quotation.html?id=${encodeURIComponent(rowId)}`;
  } else if (action === 'pdf') {
    try {
      await apiDownload(`/api/quotations/${encodeURIComponent(rowId)}/pdf`, `${quoteNo}.pdf`);
      showToast(`Downloaded ${quoteNo}.pdf`, 'fa-file-pdf');
    } catch (err) {
      applog(err.status === 403 ? 'warn' : 'error', 'quotation pdf download failed', { status: err.status ?? null });
      showToast(err.status === 403 ? 'You do not have permission to download this PDF' : `PDF failed: ${err.message}`, 'fa-file-pdf', 'rose');
    }
  }
}
document.getElementById('reportTableBody')?.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const btn = e.target.closest('.row-action-btn');
  handleRowAction(btn ? btn.dataset.act : 'view', tr);
});

// Tab switching — loads data lazily per tab
document.querySelectorAll('.report-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tabId = tab.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(`tabContent${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (target) target.classList.remove('hidden');

    if (tabId === 'quotation') { loadQuotations(); loadSummary(); loadTopPerformers(); }
    if (tabId === 'referral')  { loadReferral(); }
    if (tabId === 'product')   { loadProducts(); }

    showToast(`${tab.textContent.trim()} loaded`, 'fa-table-list');
  });
});

// ============================================================
// EXPORT — server side only.
// The server enforces REPORT:EXPORT, the tenant scope, the row cap, formula escaping and the audit row.
// There is deliberately NO client-side CSV fallback: it would skip all of that (and an unescaped "=…" cell
// opens as a formula in Excel). When the server refuses, the user sees the server's reason.
// ============================================================
const EXPORT_TYPE_BY_TAB = { quotation: 'QUOTATIONS', referral: 'REFERRAL_INCOME' };
const activeTab = () => document.querySelector('.report-tab.active')?.dataset.tab || 'quotation';

let exportInFlight = false;
async function runExport(format) {
  if (exportInFlight) return;                                   // double-click guard: one export, one audit row
  const type = EXPORT_TYPE_BY_TAB[activeTab()];
  if (!type) {
    showToast('Export is not available for this report', 'fa-circle-info', 'amber');
    return;
  }
  readFilterInputs();
  if (invalidRange()) return;

  const ext = format === 'EXCEL' ? 'xlsx' : 'pdf';
  const label = format === 'EXCEL' ? 'Excel' : 'PDF';
  const icon = format === 'EXCEL' ? 'fa-file-excel' : 'fa-file-pdf';
  const started = performance.now();
  exportInFlight = true;
  applog('info', `export start type=${type} format=${format}`, { type, format, ...filterLogCtx() });
  try {
    const qs = filterQuery({ type, format });
    await apiDownload('/api/reports/export?' + qs.toString(), `${type.toLowerCase()}_report_${todayISO()}.${ext}`);
    applog('info', `export done type=${type} format=${format}`,
      { type, format, durationMs: Math.round(performance.now() - started), ...filterLogCtx() });
    showToast(`${label} exported`, icon);
  } catch (err) {
    applog(err.status === 403 ? 'warn' : 'error', `export failed type=${type} format=${format}`,
      { type, format, status: err.status ?? null, durationMs: Math.round(performance.now() - started), ...filterLogCtx() });
    // 403 = no permission; any other message (e.g. the row-limit text) is the server's own, safe to show
    showToast(err.status === 403 ? 'Export permission required' : `${label} export failed: ${err.message}`, icon, 'rose');
  } finally {
    exportInFlight = false;
  }
}

document.getElementById('exportCsvBtn')?.addEventListener('click', () => runExport('EXCEL'));   // button id kept; it exports Excel
document.getElementById('exportPdfBtn')?.addEventListener('click', () => runExport('PDF'));
document.getElementById('printBtn')?.addEventListener('click', () => window.print());

// ============================================================
// CHANNEL PARTNER FILTER (SUPER_ADMIN only) — sends viewPartnerId
// session.js can set the role slightly after this script runs, so it is tried on
// DOMContentLoaded and once more after a short delay — but the API is only called once.
// ============================================================
let partnerFilterReady = false;
async function initChannelPartnerFilter() {
  if (partnerFilterReady) return;
  const box = document.getElementById('channelPartnerFilterContainer');
  if (!box) return;

  const isAdmin = window.currentUserRole === 'SUPER_ADMIN';
  box.classList.toggle('hidden', !isAdmin);
  if (!isAdmin) return;

  partnerFilterReady = true;
  try {
    const partners = await apiJson('/api/channel-partners/options');
    const select = document.getElementById('channelPartnerFilter');
    if (select && Array.isArray(partners)) {
      // "all" is the server default: the caller's OWN data. A partner below = read-only view of that partner.
      select.innerHTML = '<option value="all">My own data</option>' +
        partners.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    }
  } catch (err) {
    partnerFilterReady = false;
    logLoadFailure('channel-partner-options', err);
  }
}
document.addEventListener('DOMContentLoaded', initChannelPartnerFilter);
setTimeout(initChannelPartnerFilter, 500);

// ============================================================
// CHARTS (isolated — Chart.js failure never breaks the tables)
// ============================================================
function showChartFallback(canvasEl) {
  if (!canvasEl) return;
  const wrap = canvasEl.closest('.pie-wrap') || canvasEl.parentElement;
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-center gap-1.5 px-4">
      <i class="fas fa-chart-simple text-lg text-peach-300"></i>
      <p class="text-[11px] font-medium text-gray-500">Chart couldn't load</p>
      <p class="text-[10px] text-gray-400">Chart.js failed to load from CDN.</p>
    </div>`;
}

let trendChart = null, statusChart = null, sizeChart = null;
function applyChartData() {
  const d = window.__chartData;
  if (!d) return;

  if (trendChart && Array.isArray(d.trend)) {
    trendChart.data.labels = d.trend.map(t => t.month);
    trendChart.data.datasets[0].data = d.trend.map(t => t.quotations);
    trendChart.update();
  }
  if (statusChart && d.statusDistribution) {
    const s = d.statusDistribution;
    statusChart.data.datasets[0].data = [s.accepted ?? 0, s.pending ?? 0, s.rejected ?? 0];
    statusChart.update();
  }
  if (sizeChart && Array.isArray(d.revenueBySystemSize)) {
    sizeChart.data.labels = d.revenueBySystemSize.map(r => r.band);
    sizeChart.data.datasets[0].data = d.revenueBySystemSize.map(r => r.value / 1e5); // Lakhs
    sizeChart.update();
  }
}
window.__chartsReady = false;

(function initCharts() {
  if (typeof Chart === 'undefined') {
    applog('warn', 'Chart.js did not load, charts skipped', {});
    ['chartTrend','chartStatus','chartSystemSize'].forEach(id => showChartFallback(document.getElementById(id)));
    return;
  }
  try {
    const peach = '#810B38';
    const peachLight = 'rgba(129, 11, 56, 0.18)';
    const gridColor = '#D3B999';
    const fontColor = '#6B7280';
    Chart.defaults.font.family = "'Poppins', sans-serif";
    Chart.defaults.font.size = 11;

    // same tooltip look as the dashboard charts
    const tooltipBase = {
      backgroundColor: '#fff', titleColor: '#1F2937', bodyColor: '#6B7280',
      borderColor: '#D3B999', borderWidth: 1, padding: 10, cornerRadius: 10,
      displayColors: true, boxWidth: 8, boxHeight: 8, boxPadding: 4,
    };

    const trendEl = document.getElementById('chartTrend');
    if (trendEl) {
      trendChart = new Chart(trendEl, {
        type: 'line',
        data: { labels: [], datasets: [{
          label: 'Quotations', data: [],
          borderColor: peach, backgroundColor: peachLight, fill: true, tension: 0.35,
          pointBackgroundColor: peach, pointBorderColor: '#F7ECE1', pointBorderWidth: 2, pointRadius: 4,
        }]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: ctx => `${ctx.parsed.y} quotations` } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: fontColor } },
            y: { grid: { color: gridColor }, ticks: { color: fontColor, precision: 0 }, beginAtZero: true },
          },
        },
      });
    }

    const statusEl = document.getElementById('chartStatus');
    if (statusEl) {
      statusChart = new Chart(statusEl, {
        type: 'doughnut',
        data: {
          labels: ['Accepted','Pending','Rejected'],
          datasets: [{ data: [0,0,0], backgroundColor: ['#059669','#d97706','#e11d48'], borderColor: '#F1E2D1', borderWidth: 3, hoverOffset: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#6B7280', boxWidth: 8, boxHeight: 8, padding: 8, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { ...tooltipBase, callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}` } },
          },
        },
      });
    }

    const sizeEl = document.getElementById('chartSystemSize');
    if (sizeEl) {
      sizeChart = new Chart(sizeEl, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Value (₹ in Lakhs)', data: [], backgroundColor: peach, borderRadius: 8, maxBarThickness: 46 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: ctx => `₹${ctx.parsed.y}L` } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: fontColor } },
            y: { grid: { color: gridColor }, ticks: { color: fontColor }, beginAtZero: true },
          },
        },
      });
    }

    window.__chartsReady = true;
    if (window.__chartData) applyChartData();
  } catch (err) {
    applog('error', 'chart rendering failed, rest of page unaffected', { name: err?.name || 'Error' });
    ['chartTrend','chartStatus','chartSystemSize'].forEach(id => showChartFallback(document.getElementById(id)));
  }
})();

// ============================================================
// BOOT
// ============================================================
(function boot() {
  setDefaultDates();        // 1 Jan of this year → today (inputs have no hard-coded dates any more)
  readFilterInputs();       // first call is already scoped
  loadSummary();
  loadTopPerformers();
  loadQuotations();
  loadReferral();           // so the Referral tab isn't empty if opened quickly
})();