// ============================================================
// Approval Management — integrated with Spring Boot backend (port 8091)
//
// The backend has no dedicated approval controller, so this screen runs on the Quotation APIs:
//   GET   /api/quotations?page=&size=     list  (QUOTATION:VIEW, tenant-scoped by backend)
//   GET   /api/quotations/{id}            full detail: items, pricing, terms, audit
//   PATCH /api/quotations/{id}/status     body { status: PENDING | ACCEPTED | REJECTED }  (QUOTATION:EDIT)
//   POST  /api/auth/refresh               silent token refresh on 401
//
// Status mapping (backend -> label on this screen) lives in STATUS_UI below.
// ============================================================

// Override before this script loads if needed:  window.SQMS_API_BASE = "https://api.example.com"
const API_BASE = (window.SQMS_API_BASE || "http://localhost:8091").replace(/\/+$/, "");
const SESSION_KEY = "sqms_session";

// ============================================================
// Sidebar collapse / expand (shared across all modules)
// ============================================================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleIcon = document.getElementById("toggleIcon");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

const drawerMQ = window.matchMedia("(max-width: 1023px)");
const isDrawerViewport = () => drawerMQ.matches;
let sidebarExpanded = !isDrawerViewport();

function setSidebarExpanded(next) {
  sidebarExpanded = next;
  sidebar.classList.toggle("expanded", next);
  sidebar.classList.toggle("collapsed", !next);
  toggleIcon.style.transform = next ? "rotate(180deg)" : "rotate(0deg)";
  const showBackdrop = next && isDrawerViewport();
  sidebarBackdrop?.classList.toggle("visible", showBackdrop);
  sidebarBackdrop?.classList.toggle("hidden", !showBackdrop);
}
setSidebarExpanded(sidebarExpanded);

sidebarToggle.addEventListener("click", () => setSidebarExpanded(!sidebarExpanded));
sidebarBackdrop?.addEventListener("click", () => setSidebarExpanded(false));
drawerMQ.addEventListener("change", () => setSidebarExpanded(!isDrawerViewport()));
document.getElementById("sidebarNav")?.addEventListener("click", (e) => {
  if (e.target.closest(".nav-item") && isDrawerViewport()) setSidebarExpanded(false);
});

// ============================================================
// Session / auth helpers
// ============================================================
function readStoredSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (raw) return { store, data: JSON.parse(raw) };
    } catch (_) {}
  }
  return null;
}

function getAccessToken() {
  try {
    if (window.Session) {
      if (typeof Session.getToken === "function") { const t = Session.getToken(); if (t) return t; }
      if (typeof Session.getAccessToken === "function") { const t = Session.getAccessToken(); if (t) return t; }
    }
  } catch (_) {}
  const s = readStoredSession();
  return s ? (s.data.token || s.data.accessToken || null) : null;
}

function getRefreshToken() {
  const s = readStoredSession();
  return s ? (s.data.refreshToken || null) : null;
}

function getStoredPermissions() {
  const s = readStoredSession();
  return s && Array.isArray(s.data.permissions) ? s.data.permissions : null;
}

function getUserRole() {
  return window.Session && typeof Session.getRole === "function" ? Session.getRole() : null;
}
function isSuperAdmin() { return getUserRole() === "SUPER_ADMIN"; }

/** UI-only permission check ("QUOTATION", "EDIT"). The backend enforces the real rules. */
function can(module, action) {
  if (isSuperAdmin()) return true;
  const perms = getStoredPermissions();
  if (!perms) return true;
  return perms.includes(`${module}:${action}`);
}

function logoutUser() {
  try {
    if (window.Session && typeof Session.logout === "function") Session.logout();
    else { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); }
  } catch (_) {}
  window.location.href = "../index.html";
}

let refreshInFlight = null;
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success || !json.data?.accessToken) return false;
        const s = readStoredSession();
        if (s) {
          s.data.token = json.data.accessToken;
          s.data.accessToken = json.data.accessToken;
          if (json.data.refreshToken) s.data.refreshToken = json.data.refreshToken;
          s.store.setItem(SESSION_KEY, JSON.stringify(s.data));
        }
        return true;
      } catch (_) { return false; }
      finally { setTimeout(() => { refreshInFlight = null; }, 0); }
    })();
  }
  return refreshInFlight;
}

class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors || [];
  }
}

/** Calls the backend and unwraps ApiResponse.data. Adds Bearer token, retries once after refresh on 401. */
async function api(path, { method = "GET", body, params } = {}, _retried = false) {
  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.append(k, v); });
    const q = qs.toString();
    if (q) url += `?${q}`;
  }

  const headers = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (_) {
    throw new ApiError(`Cannot reach server at ${API_BASE}. Is the backend running?`, 0);
  }

  if (res.status === 401 && !_retried) {
    if (await refreshAccessToken()) return api(path, { method, body, params }, true);
    logoutUser();
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    const fe = json?.errors || [];
    const detail = fe.length ? ` — ${fe.map((e) => `${e.field}: ${e.message}`).join("; ")}` : "";
    throw new ApiError((json?.message || `Request failed (${res.status})`) + detail, res.status, fe);
  }
  return json ? json.data : null;
}

// ============================================================
// Topbar: notification + profile dropdowns
// ============================================================
const notifBtn = document.getElementById("notifBtn");
const notifDropdown = document.getElementById("notifDropdown");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

function closeAllTopbarDropdowns(except) {
  [notifDropdown, profileDropdown].forEach((dd) => { if (dd && dd !== except) dd.classList.add("hidden"); });
}
notifBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = notifDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  notifDropdown.classList.toggle("hidden", !willOpen);
});
profileBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = profileDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  profileDropdown.classList.toggle("hidden", !willOpen);
});
document.addEventListener("click", () => closeAllTopbarDropdowns());
profileLogoutBtn?.addEventListener("click", logoutUser);

// ============================================================
// Helpers
// ============================================================
function formatINR(n) {
  const x = Number(n) || 0;
  return "₹" + x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Backend sends LocalDate ("2026-07-15") and UTC LocalDateTime without a zone ("2026-07-15T10:00:00"). */
function parseApiDate(v) {
  if (!v) return null;
  let s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += "T00:00:00";                 // date-only → local midnight
  else if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s)) s += "Z";           // zone-less timestamp is UTC
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function formatDate(v) {
  const d = parseApiDate(v);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
function setBusy(btn, busy, busyText) {
  if (!btn) return;
  if (busy) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.dataset.origDisabled = btn.disabled ? "1" : "";
    btn.disabled = true;
    btn.style.cursor = "wait";
    if (busyText) btn.textContent = busyText;
  } else {
    btn.disabled = btn.dataset.origDisabled === "1";
    btn.style.cursor = "";
    if (btn.dataset.origHtml) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
    delete btn.dataset.origDisabled;
  }
}

// ============================================================
// Status mapping — change here if your business wording differs
//   PENDING            -> Pending
//   ACCEPTED / APPROVED-> Approved   (ACCEPTED is what the approve action sets)
//   REJECTED           -> Rejected
//   PAID               -> Converted  (referral paid, quotation fully closed)
//   EXPIRED            -> Expired
// ============================================================
const STATUS_UI = {
  PENDING: "Pending",
  ACCEPTED: "Approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Converted",
  EXPIRED: "Expired",
};
const DECISION_TO_API = { Approved: "ACCEPTED", Rejected: "REJECTED" };
const REVIEWABLE_RAW = ["PENDING", "ACCEPTED", "REJECTED"]; // the only values the status endpoint accepts

const statusPillClass = {
  Pending: "pill-pending",
  Approved: "pill-approved",
  Rejected: "pill-rejected",
  Converted: "pill-converted",
  Expired: "pill-rejected",
};

// ============================================================
// Data — loaded from backend
// ============================================================
let approvals = [];
let loading = false;
let loadError = null;
const detailCache = new Map(); // dbId -> QuotationResponseDto

/** Maps QuotationListItemResponseDto OR QuotationResponseDto to the flat record the UI uses. */
function mapQuotation(d) {
  const raw = String(d.status || "").toUpperCase();
  const customerName = d.customer ? d.customer.name : "";
  const audit = d.audit || {};
  return {
    dbId: d.id,
    id: d.code,
    customer: customerName || "—",
    salesExec: audit.createdBy || "—",
    partner: d.partner ? d.partner.name : null,
    project: d.systemSizeKw != null ? `Solar System — ${Number(d.systemSizeKw)} kW` : "—",
    amount: Number(d.totalAmount) || 0,
    submittedDate: d.quoteDate || audit.createdAt || null,
    rawStatus: raw,
    status: STATUS_UI[raw] || raw,
    createdAt: audit.createdAt || null,
    updatedAt: audit.updatedAt || null,
    referred: !!d.referred,
  };
}

async function loadApprovals() {
  loading = true; loadError = null;
  renderTable();
  try {
    const all = [];
    let page = 0, totalPages = 1;
    while (page < totalPages && page < 20) {                  // safety cap: 20 × 100 rows
      const data = await api("/api/quotations", { params: { page, size: 100, sort: "createdAt,desc" } });
      (data?.content || []).forEach((d) => all.push(mapQuotation(d)));
      totalPages = data?.totalPages || 1;
      page++;
    }
    approvals = all;
  } catch (err) {
    loadError = err.message;
    showToast(err.message);
  } finally {
    loading = false;
    populatePartnerFilter();
    renderSummary();
    renderTable();
  }
}

// ============================================================
// Filters: partner dropdown, summary cards
// ============================================================
function populatePartnerFilter() {
  const sel = document.getElementById("searchPartner");
  if (!sel) return;
  const current = sel.value;
  const partners = [...new Set(approvals.map((a) => a.partner).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All partners</option>' +
    partners.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  if (partners.includes(current)) sel.value = current;
}

function renderSummary() {
  const n = (label) => approvals.filter((a) => a.status === label).length;
  document.getElementById("kpiPending").textContent = n("Pending");
  document.getElementById("kpiApproved").textContent = n("Approved");
  document.getElementById("kpiRejected").textContent = n("Rejected");
  document.getElementById("kpiConverted").textContent = n("Converted");
}

// The backend has no "Revision Required" state: remove it from the UI instead of showing a dead option.
function adaptStaticUi() {
  const statusSelect = document.getElementById("searchStatus");
  if (statusSelect) {
    statusSelect.innerHTML = `<option value="">All statuses</option>` +
      ["Pending", "Approved", "Rejected", "Converted", "Expired"].map((s) => `<option value="${s}">${s}</option>`).join("");
  }
  document.querySelector('.decision-pill[data-decision="Revision Required"]')?.remove();
  const approvedHint = document.querySelector('.decision-pill[data-decision="Approved"] p:last-child');
  if (approvedHint) approvedHint.textContent = "Accept this quotation";
  const rejectedHint = document.querySelector('.decision-pill[data-decision="Rejected"] p:last-child');
  if (rejectedHint) rejectedHint.textContent = "Close this quotation";
  // manager remarks are not stored by the backend status endpoint
  document.getElementById("managerRemarks")?.closest(".field-group")?.classList.add("hidden");
  // the "Remarks" block in the view modal now shows the quotation's terms
  const remarksTitle = document.getElementById("dRemarks")?.closest(".detail-section")?.querySelector(".detail-section-title");
  if (remarksTitle) remarksTitle.textContent = "Terms & Conditions";
}

// ============================================================
// Table state: filter tab, search fields, sort, pagination (client-side)
// ============================================================
let activeTab = "All";
let sortKey = "submittedDate";
let sortDir = "desc";
let currentPage = 1;
let rowsPerPage = 10;

const tbody = document.getElementById("approvalTbody");
const paginationControls = document.getElementById("paginationControls");
const rowsRangeLabel = document.getElementById("rowsRangeLabel");
const rowsPerPageSelect = document.getElementById("rowsPerPage");

const searchId = document.getElementById("searchId");
const searchCustomer = document.getElementById("searchCustomer");
const searchExec = document.getElementById("searchExec");
const searchPartner = document.getElementById("searchPartner");
const searchStatus = document.getElementById("searchStatus");

function filteredApprovals() {
  const idQ = searchId.value.trim().toLowerCase();
  const custQ = searchCustomer.value.trim().toLowerCase();
  const execQ = searchExec.value.trim().toLowerCase();
  const partnerQ = searchPartner ? searchPartner.value : "";
  const statusQ = searchStatus.value;

  return approvals.filter((a) => {
    if (activeTab !== "All" && a.status !== activeTab) return false;
    if (idQ && !a.id.toLowerCase().includes(idQ)) return false;
    if (custQ && !a.customer.toLowerCase().includes(custQ)) return false;
    if (execQ && !a.salesExec.toLowerCase().includes(execQ)) return false;
    if (partnerQ && a.partner !== partnerQ) return false;
    if (statusQ && a.status !== statusQ) return false;
    return true;
  });
}

function sortedApprovals() {
  const list = filteredApprovals();
  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === "amount") { /* numeric */ }
    else if (sortKey === "submittedDate") { av = parseApiDate(av)?.getTime() || 0; bv = parseApiDate(bv)?.getTime() || 0; }
    else { av = String(av ?? "").toLowerCase(); bv = String(bv ?? "").toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return list;
}

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>',
};

function canReview(a) {
  return REVIEWABLE_RAW.includes(a.rawStatus) && can("APPROVAL", "EDIT") && can("QUOTATION", "EDIT");
}

function actionIconsHtml(a) {
  const id = esc(a.id);
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>
      ${canReview(a) ? `<button class="action-icon-btn icon-review" data-action="review" data-id="${id}" title="Review">${ICONS.review}</button>` : ""}
    </div>`;
}

function renderTable() {
  if (!tbody) return;

  if (loading) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color:#9CA3AF;">Loading quotations…</td></tr>`;
    rowsRangeLabel.textContent = "";
    paginationControls.innerHTML = "";
    updateSortIcons();
    return;
  }
  if (loadError && !approvals.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color:#E11D48;">${esc(loadError)} <button type="button" id="retryLoadBtn" class="btn-secondary" style="margin-left:8px;">Retry</button></td></tr>`;
    document.getElementById("retryLoadBtn")?.addEventListener("click", loadApprovals);
    rowsRangeLabel.textContent = "";
    paginationControls.innerHTML = "";
    updateSortIcons();
    return;
  }

  const data = sortedApprovals();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  tbody.innerHTML = pageRows.length ? pageRows.map((a) => `
    <tr data-id="${esc(a.id)}">
      <td data-label="Quotation ID" class="font-medium">${esc(a.id)}</td>
      <td data-label="Customer">${esc(a.customer)}</td>
      <td data-label="Sales Executive">${esc(a.salesExec)}</td>
      <td data-label="Channel Partner">${esc(a.partner || "—")}</td>
      <td data-label="Project">${esc(a.project)}</td>
      <td data-label="Amount">${formatINR(a.amount)}</td>
      <td data-label="Submitted">${formatDate(a.submittedDate)}</td>
      <td data-label="Status"><span class="pill ${statusPillClass[a.status] || "pill-pending"}">${esc(a.status)}</span></td>
      <td data-label="Actions">${actionIconsHtml(a)}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" style="text-align:center; padding: 24px; color:#9CA3AF;">${approvals.length ? "No quotations match your search." : "No quotations found."}</td></tr>`;

  rowsRangeLabel.textContent = totalRows === 0
    ? "No records"
    : `${start + 1}–${Math.min(start + rowsPerPage, totalRows)} of ${totalRows}`;

  renderPagination(totalPages);
  updateSortIcons();
  applyPartnerVisibility();
}

function renderPagination(totalPages) {
  let html = "";
  html += `<span class="pagination-btn ${currentPage === 1 ? "disabled" : ""}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
      if (p === 2 || p === totalPages - 1) html += `<span class="pagination-btn disabled">…</span>`;
      continue;
    }
    html += `<span class="pagination-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? "disabled" : ""}" data-page="next">›</span>`;
  paginationControls.innerHTML = html;

  paginationControls.querySelectorAll(".pagination-btn:not(.disabled)").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-page");
      if (p === "prev") currentPage = Math.max(1, currentPage - 1);
      else if (p === "next") currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      renderTable();
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll("#approvalTable thead th[data-key]").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    const key = th.getAttribute("data-key");
    th.classList.toggle("sorted", key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === "asc" ? "↑" : "↓") : "⇅";
  });
}

document.querySelectorAll("#approvalTable thead th[data-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-key");
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortKey = key; sortDir = "asc"; }
    currentPage = 1;
    renderTable();
  });
});

rowsPerPageSelect?.addEventListener("change", () => {
  rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
  currentPage = 1;
  renderTable();
});

document.getElementById("filterTabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeTab = btn.getAttribute("data-status");
  currentPage = 1;
  renderTable();
});

[searchId, searchCustomer, searchExec].forEach((el) => {
  el?.addEventListener("input", () => { currentPage = 1; renderTable(); });
});
searchPartner?.addEventListener("change", () => { currentPage = 1; renderTable(); });
searchStatus?.addEventListener("change", () => { currentPage = 1; renderTable(); });

// Partner column + filter are for Super Admin only
function applyPartnerVisibility() {
  const show = isSuperAdmin();
  const ths = document.querySelectorAll("#approvalTable thead th");
  if (ths.length > 3) ths[3].style.display = show ? "" : "none";
  document.querySelectorAll("#approvalTable tbody tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length > 3) cells[3].style.display = show ? "" : "none";
  });
  const wrap = document.getElementById("partnerFilterWrap");
  if (wrap) wrap.style.display = show ? "" : "none";
}

// ============================================================
// View Modal — Quotation Details (GET /api/quotations/{id})
// ============================================================
const viewModal = document.getElementById("viewModal");
const viewModalCloseBtn = document.getElementById("viewModalCloseBtn");
const viewModalCloseBtn2 = document.getElementById("viewModalCloseBtn2");
const viewModalReviewBtn = document.getElementById("viewModalReviewBtn");

let viewingId = null;

function findApproval(id) { return approvals.find((a) => a.id === id); }

const TIMELINE_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "reviewed", label: "Reviewed" },
  { key: "approved", label: "Approved" },
  { key: "converted", label: "Converted" },
];
const TIMELINE_ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const TIMELINE_ICON_REJECTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

/** The backend keeps no per-step history, so the timeline is derived from status + audit timestamps. */
function buildTimeline(a) {
  const raw = a.rawStatus;
  const decided = raw !== "PENDING";
  return {
    submitted: a.createdAt || a.submittedDate,
    reviewed: decided ? a.updatedAt : null,
    approved: ["ACCEPTED", "APPROVED", "PAID"].includes(raw) ? a.updatedAt : null,
    converted: raw === "PAID" ? a.updatedAt : null,
  };
}

function renderTimeline(a) {
  const tl = buildTimeline(a);
  const isRejected = a.status === "Rejected";
  return TIMELINE_STEPS.map((step, idx) => {
    const value = tl[step.key];
    let stateClass = "";
    let icon = "";
    if (isRejected && step.key === "approved") { stateClass = "rejected"; icon = TIMELINE_ICON_REJECTED; }
    else if (value) { stateClass = "done"; icon = TIMELINE_ICON_DONE; }
    else {
      const prevDone = idx === 0 || tl[TIMELINE_STEPS[idx - 1].key];
      if (prevDone && !isRejected && a.status !== "Expired") stateClass = "current";
    }
    const rejectedDate = isRejected && step.key === "approved" ? tl.reviewed : value;
    return `
      <div class="timeline-step ${stateClass}">
        <div class="timeline-line"></div>
        <div class="timeline-dot">${icon}</div>
        <div class="timeline-label">${isRejected && step.key === "approved" ? "Rejected" : step.label}</div>
        <div class="timeline-date">${rejectedDate ? formatDate(rejectedDate) : "—"}</div>
      </div>`;
  }).join("");
}

function fillViewModal(a, d) {
  document.getElementById("viewModalSubtitle").textContent = `${a.id} · ${a.status}`;
  document.getElementById("dCustomer").textContent = a.customer;
  document.getElementById("dExec").textContent = a.salesExec;
  document.getElementById("dPartner").textContent = a.partner || "—";
  document.getElementById("dProject").textContent = a.project;
  document.getElementById("dDate").textContent = formatDate(a.submittedDate);

  const items = d.items || [];
  document.getElementById("dProducts").innerHTML = items.length ? items.map((p) => `
    <tr>
      <td>${esc(p.name)}</td>
      <td class="num">${Number(p.qty) || 0}${p.unit ? " " + esc(p.unit) : ""}</td>
      <td class="num">${formatINR(p.rate)}</td>
      <td class="num">${formatINR(p.amount)}</td>
    </tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:#9CA3AF;">No items</td></tr>`;

  // Pricing — mirrors the backend's own calculation (nothing is recomputed here)
  const gst = (Number(d.sgstAmount) || 0) + (Number(d.cgstAmount) || 0);
  const rows = [
    ["Items Total", d.itemsTotal],
    ["Installation", d.installationCost],
    ["Transportation", d.transportCost],
  ];
  if (Number(d.otherCost)) rows.push([d.otherLabel || "Other Charges", d.otherCost]);
  if (Number(d.discountAmount)) rows.push(["Discount", -Math.abs(Number(d.discountAmount))]);
  rows.push([`GST${d.gstPercent != null ? ` (${Number(d.gstPercent)}%)` : ""}`, gst]);
  if (Number(d.subsidyAmount)) rows.push(["Subsidy", -Math.abs(Number(d.subsidyAmount))]);
  document.querySelector("#viewModal .pricing-table").innerHTML =
    rows.map(([label, v]) => `<tr><td>${esc(label)}</td><td>${formatINR(v)}</td></tr>`).join("") +
    `<tr class="total-row"><td>Total Amount</td><td>${formatINR(d.totalAmount)}</td></tr>`;

  document.getElementById("dRemarks").textContent = (d.terms && String(d.terms).trim()) || "No terms added.";
  document.getElementById("dTimeline").innerHTML = renderTimeline(a);
  viewModalReviewBtn.classList.toggle("hidden", !canReview(a));
}

async function openViewModal(id) {
  const a = findApproval(id);
  if (!a) return;
  viewingId = id;
  try {
    let d = detailCache.get(a.dbId);
    if (!d) {
      d = await api(`/api/quotations/${a.dbId}`);
      detailCache.set(a.dbId, d);
    }
    if (viewingId !== id) return; // user clicked something else meanwhile
    fillViewModal(a, d);
    viewModal.classList.remove("hidden");
  } catch (err) {
    viewingId = null;
    showToast(err.message);
  }
}

function closeViewModal() {
  viewModal.classList.add("hidden");
  viewingId = null;
}

viewModalCloseBtn?.addEventListener("click", closeViewModal);
viewModalCloseBtn2?.addEventListener("click", closeViewModal);
viewModal?.addEventListener("click", (e) => { if (e.target === viewModal) closeViewModal(); });

viewModalReviewBtn?.addEventListener("click", () => {
  if (!viewingId) return;
  const id = viewingId;
  closeViewModal();
  openApprovalModal(id);
});

// ============================================================
// Approval Modal — Decision (PATCH /api/quotations/{id}/status)
// ============================================================
const approvalModal = document.getElementById("approvalModal");
const approvalModalCloseBtn = document.getElementById("approvalModalCloseBtn");
const approvalCancelBtn = document.getElementById("approvalCancelBtn");
const approvalSubmitBtn = document.getElementById("approvalSubmitBtn");
const decisionPillsWrap = document.getElementById("decisionPills");

let reviewingId = null;
let selectedDecision = null;

const DECISION_BUTTON_LABEL = {
  Approved: "Approve Quotation",
  Rejected: "Reject Quotation",
};

function openApprovalModal(id) {
  const a = findApproval(id);
  if (!a) return;
  if (!canReview(a)) { showToast("This quotation can't be reviewed in its current state"); return; }
  reviewingId = id;
  selectedDecision = null;

  document.getElementById("approvalModalSubtitle").textContent = `${a.id} · ${a.customer}`;
  decisionPillsWrap.querySelectorAll(".decision-pill").forEach((p) => p.classList.remove("selected"));
  approvalSubmitBtn.textContent = "Select a decision";
  approvalSubmitBtn.disabled = true;
  approvalSubmitBtn.className = "btn-primary";
  approvalModal.classList.remove("hidden");
}

function closeApprovalModal() {
  approvalModal.classList.add("hidden");
  reviewingId = null;
  selectedDecision = null;
}

approvalModalCloseBtn?.addEventListener("click", closeApprovalModal);
approvalCancelBtn?.addEventListener("click", closeApprovalModal);
approvalModal?.addEventListener("click", (e) => { if (e.target === approvalModal) closeApprovalModal(); });

decisionPillsWrap?.addEventListener("click", (e) => {
  const pill = e.target.closest(".decision-pill");
  if (!pill) return;
  decisionPillsWrap.querySelectorAll(".decision-pill").forEach((p) => p.classList.remove("selected"));
  pill.classList.add("selected");
  selectedDecision = pill.getAttribute("data-decision");

  approvalSubmitBtn.disabled = false;
  approvalSubmitBtn.textContent = DECISION_BUTTON_LABEL[selectedDecision];
  approvalSubmitBtn.className = selectedDecision === "Approved" ? "btn-success" : "btn-danger";
});

approvalSubmitBtn?.addEventListener("click", async () => {
  if (!reviewingId || !selectedDecision) return;
  const a = findApproval(reviewingId);
  if (!a) return;
  const apiStatus = DECISION_TO_API[selectedDecision];
  if (!apiStatus) return;

  setBusy(approvalSubmitBtn, true, "Saving…");
  try {
    const updated = await api(`/api/quotations/${a.dbId}/status`, { method: "PATCH", body: { status: apiStatus } });
    const idx = approvals.findIndex((x) => x.dbId === a.dbId);
    if (idx >= 0) approvals[idx] = mapQuotation(updated);
    detailCache.set(a.dbId, updated);
    closeApprovalModal();
    populatePartnerFilter();
    renderSummary();
    renderTable();
    showToast(`${a.id} marked as ${STATUS_UI[apiStatus]}`);
  } catch (err) {
    showToast(err.message);
  } finally {
    setBusy(approvalSubmitBtn, false);
  }
});

// ============================================================
// Row action wiring
// ============================================================
tbody?.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (actionBtn) {
    e.stopPropagation();
    const id = actionBtn.getAttribute("data-id");
    const action = actionBtn.getAttribute("data-action");
    if (action === "view") openViewModal(id);
    else if (action === "review") openApprovalModal(id);
    return;
  }
  const row = e.target.closest("tr[data-id]");
  if (row) openViewModal(row.getAttribute("data-id"));
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!approvalModal.classList.contains("hidden")) closeApprovalModal();
  else if (!viewModal.classList.contains("hidden")) closeViewModal();
});

// ============================================================
// Init
// ============================================================
adaptStaticUi();
renderSummary();
renderTable();

// session.js finishes setting the role after DOMContentLoaded; load data once it's ready so the
// partner column and review buttons use the real role.
function initAfterSession() {
  applyPartnerVisibility();
  loadApprovals();
}
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", initAfterSession);
else initAfterSession();