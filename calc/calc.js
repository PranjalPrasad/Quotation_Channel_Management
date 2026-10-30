// ============================================================
// Cost Calculator — integrated with Spring Boot backend (port 8091)
//
// Endpoints used (all under /api, Bearer JWT):
//   GET    /api/calculations?page=&size=      list (tenant-scoped by backend)
//   POST   /api/calculations                  create
//   PUT    /api/calculations/{id}             update
//   DELETE /api/calculations/{id}             soft delete
//   GET    /api/channel-partners/options      partner dropdown (Super Admin only)
//   POST   /api/auth/refresh                  silent token refresh on 401
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
// session.js owns the login session; we read the token defensively
// because its exact API surface isn't visible from this module.
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

/** Permission check for UI only — the backend enforces the real rules. */
function can(action) {
  if (isSuperAdmin()) return true;
  const perms = getStoredPermissions();
  if (!perms) return true; // unknown → show, backend will 403 if not allowed
  return perms.includes(`CALCULATOR:${action}`);
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

/**
 * Calls the backend and unwraps ApiResponse.data.
 * Adds the Bearer token, retries once after a silent refresh on 401,
 * and throws ApiError with the backend's message otherwise.
 */
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
// Topbar dropdowns
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
  const val = Math.round(Number(n) || 0);
  return "₹" + val.toLocaleString("en-IN");
}
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
function pulse(el) {
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}
function setBusy(btn, busy, busyText) {
  if (!btn) return;
  if (busy) {
    btn.dataset.origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = ".7";
    btn.style.cursor = "wait";
    if (busyText) btn.textContent = busyText;
  } else {
    btn.disabled = false;
    btn.style.opacity = "";
    btn.style.cursor = "";
    if (btn.dataset.origHtml) { btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
  }
}

// Backend enum <-> UI label
const toApiType = (label) => String(label || "").toUpperCase();
const toUiType = (enumVal) => {
  const s = String(enumVal || "").toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

const MARKET_RATE_PER_KW = 58000; // reference rate for "Estimated Saving" (backend returns 0 for this field)

// ============================================================
// Live Cost Calculator engine (instant, client-side preview)
// The server recomputes everything on save, so saved numbers are authoritative.
// ============================================================
const formIds = {
  material: "cMaterial", installation: "cInstallation", transportation: "cTransportation",
  civil: "cCivil", labour: "cLabour", electrical: "cElectrical", other: "cOther",
  discount: "cDiscount", gstPct: "cGstPct",
};

function readForm(ids) {
  const g = (id) => parseFloat(document.getElementById(id).value) || 0;
  return {
    material: g(ids.material), installation: g(ids.installation), transportation: g(ids.transportation),
    civil: g(ids.civil), labour: g(ids.labour), electrical: g(ids.electrical), other: g(ids.other),
    discount: g(ids.discount), gstPct: g(ids.gstPct),
  };
}

function computeCosts(v, capacity) {
  const rawSubtotal = v.material + v.installation + v.transportation + v.civil + v.labour + v.electrical + v.other;
  const subtotal = rawSubtotal - v.discount; // matches backend (no clamping)
  const gstAmount = subtotal * (v.gstPct / 100);
  const finalCost = subtotal + gstAmount;
  const costPerKw = capacity > 0 ? finalCost / capacity : 0;
  const estimatedSaving = Math.max(0, MARKET_RATE_PER_KW * capacity - finalCost);
  return { rawSubtotal, subtotal, gstAmount, finalCost, costPerKw, estimatedSaving };
}

function renderBreakdown(containerId, v, result) {
  const rows = [
    { op: "", label: "Material Cost", value: v.material },
    { op: "+", label: "Installation Cost", value: v.installation },
    { op: "+", label: "Transportation Cost", value: v.transportation },
    { op: "+", label: "Civil Work Cost", value: v.civil },
    { op: "+", label: "Labour Cost", value: v.labour },
    { op: "+", label: "Electrical Cost", value: v.electrical },
    { op: "+", label: "Other Charges", value: v.other },
  ];
  let html = rows.map((r) => `
    <div class="calc-row">
      <span class="calc-op">${r.op}</span>
      <span class="calc-label">${r.label}</span>
      <span class="calc-value">${formatINR(r.value)}</span>
    </div>`).join("");

  html += `
    <div class="calc-row calc-negative">
      <span class="calc-op">−</span>
      <span class="calc-label">Discount</span>
      <span class="calc-value">${formatINR(v.discount)}</span>
    </div>
    <div class="calc-row calc-subtotal">
      <span class="calc-op"></span>
      <span class="calc-label">Subtotal</span>
      <span class="calc-value">${formatINR(result.subtotal)}</span>
    </div>
    <div class="calc-row">
      <span class="calc-op">+</span>
      <span class="calc-label">GST (${esc(v.gstPct)}%)</span>
      <span class="calc-value">${formatINR(result.gstAmount)}</span>
    </div>
    <div class="calc-row calc-final">
      <span class="calc-op">=</span>
      <span class="calc-label">Final Cost</span>
      <span class="calc-value">${formatINR(result.finalCost)}</span>
    </div>`;

  document.getElementById(containerId).innerHTML = html;
}

function recalcLive() {
  const v = readForm(formIds);
  const capacity = parseFloat(document.getElementById("fCapacity").value) || 0;
  const result = computeCosts(v, capacity);

  const sumMaterial = document.getElementById("sumMaterial");
  const sumInstallation = document.getElementById("sumInstallation");
  const sumGst = document.getElementById("sumGst");
  const sumFinal = document.getElementById("sumFinal");
  sumMaterial.textContent = formatINR(v.material);
  sumInstallation.textContent = formatINR(v.installation);
  sumGst.textContent = formatINR(result.gstAmount);
  sumFinal.textContent = formatINR(result.finalCost);
  [sumMaterial, sumInstallation, sumGst, sumFinal].forEach(pulse);

  renderBreakdown("liveCalcBreakdown", v, result);

  document.getElementById("rSubtotal").textContent = formatINR(result.subtotal);
  document.getElementById("rGstAmount").textContent = formatINR(result.gstAmount);
  document.getElementById("rGrandTotal").textContent = formatINR(result.finalCost);
  document.getElementById("rCostPerKw").textContent = formatINR(result.costPerKw);
  document.getElementById("rSaving").textContent = formatINR(result.estimatedSaving);

  return { v, capacity, result };
}

document.querySelectorAll(".calc-input").forEach((el) => el.addEventListener("input", recalcLive));
document.getElementById("fCapacity")?.addEventListener("input", recalcLive);

// ============================================================
// Super Admin: partner selector (injected, so calc.html needs no change)
// Backend requires partnerId for Super Admin on create/update; partner
// roles are auto-scoped to their own partner server-side.
// ============================================================
let partnerOptions = [];

function injectPartnerField() {
  if (!isSuperAdmin() || document.getElementById("fPartner")) return;
  const grid = document.getElementById("fCustomer")?.closest(".grid");
  if (!grid) return;
  const wrap = document.createElement("div");
  wrap.className = "field-group sm:col-span-2";
  wrap.innerHTML = `
    <label class="field-label" for="fPartner">Channel Partner</label>
    <select id="fPartner" class="field-input"><option value="">Loading partners…</option></select>`;
  grid.prepend(wrap);
}

async function loadPartnerOptions() {
  if (!isSuperAdmin()) return;
  injectPartnerField();
  const sel = document.getElementById("fPartner");
  if (!sel) return;
  try {
    partnerOptions = (await api("/api/channel-partners/options")) || [];
    sel.innerHTML = `<option value="">Select channel partner</option>` +
      partnerOptions.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  } catch (err) {
    sel.innerHTML = `<option value="">Could not load partners</option>`;
    showToast(err.message);
  }
}

// ============================================================
// Calculation History — loaded from backend
// ============================================================
let history = [];
let historyLoading = false;
let historyError = null;

/** Maps backend CalculationResponseDto → the flat record the UI uses. */
function mapDto(d) {
  const c = d.costs || {};
  const r = d.result || {};
  return {
    dbId: d.id,                       // numeric id used in API URLs
    id: d.code,                       // "CALC-1001" shown in the UI
    customer: d.customerName || "",
    project: d.projectName || "",
    capacity: Number(d.capacityKw) || 0,
    projectType: toUiType(d.projectType),
    material: Number(c.material) || 0,
    installation: Number(c.installation) || 0,
    transportation: Number(c.transportation) || 0,
    civil: Number(c.civil) || 0,
    labour: Number(c.labour) || 0,
    electrical: Number(c.electrical) || 0,
    other: Number(c.other) || 0,
    discount: Number(c.discount) || 0,
    gstPct: Number(r.gstPercent) || 0,
    date: d.createdAt || null,
    partnerId: d.partner ? d.partner.id : null,
    channelPartner: d.partner ? d.partner.name : null,
    // authoritative server-side totals
    server: {
      subtotal: Number(r.subtotal) || 0,
      gstAmount: Number(r.gstAmount) || 0,
      finalCost: Number(r.grandTotal) || 0,
      costPerKw: Number(r.costPerKw) || 0,
    },
  };
}

function historyResult(rec) { return rec.server; }

async function loadHistory() {
  historyLoading = true; historyError = null;
  renderHistoryTable();
  try {
    const all = [];
    let page = 0, totalPages = 1;
    while (page < totalPages && page < 20) {           // safety cap: 20 × 100 rows
      const data = await api("/api/calculations", { params: { page, size: 100 } });
      (data?.content || []).forEach((d) => all.push(mapDto(d)));
      totalPages = data?.totalPages || 1;
      page++;
    }
    history = all;
  } catch (err) {
    historyError = err.message;
    showToast(err.message);
  } finally {
    historyLoading = false;
    renderHistoryTable();
  }
}

// ============================================================
// History table render / sort
// ============================================================
let sortKey = "date";
let sortDir = "desc";
const historyTbody = document.getElementById("historyTbody");
const channelPartnerHeader = document.getElementById("channelPartnerHeader");

function sortedHistory() {
  const list = [...history];
  list.sort((a, b) => {
    let av, bv;
    if (sortKey === "finalCost") { av = a.server.finalCost; bv = b.server.finalCost; }
    else if (sortKey === "capacity") { av = a.capacity; bv = b.capacity; }
    else if (sortKey === "date") { av = new Date(a.date).getTime() || 0; bv = new Date(b.date).getTime() || 0; }
    else if (sortKey === "channelPartner") {
      av = (a.channelPartner || "").toLowerCase();
      bv = (b.channelPartner || "").toLowerCase();
    }
    else { av = String(a[sortKey] ?? "").toLowerCase(); bv = String(b[sortKey] ?? "").toLowerCase(); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return list;
}

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
};

function actionIconsHtml(id) {
  const safe = esc(id);
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${safe}" title="View">${ICONS.view}</button>
      ${can("EDIT") ? `<button class="action-icon-btn icon-edit" data-action="edit" data-id="${safe}" title="Edit">${ICONS.edit}</button>` : ""}
      ${can("DELETE") ? `<button class="action-icon-btn icon-delete" data-action="delete" data-id="${safe}" title="Delete">${ICONS.delete}</button>` : ""}
    </div>`;
}

function renderHistoryTable() {
  if (!historyTbody) return;
  const isSuperAdminUser = isSuperAdmin();
  const colCount = isSuperAdminUser ? 8 : 7;

  if (channelPartnerHeader) channelPartnerHeader.classList.toggle("hidden", !isSuperAdminUser);

  if (historyLoading) {
    historyTbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding: 24px; color:#9CA3AF;">Loading calculations…</td></tr>`;
    updateSortIcons();
    return;
  }
  if (historyError && !history.length) {
    historyTbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding: 24px; color:#E11D48;">${esc(historyError)} <button type="button" id="retryHistoryBtn" class="btn-secondary" style="margin-left:8px;">Retry</button></td></tr>`;
    document.getElementById("retryHistoryBtn")?.addEventListener("click", loadHistory);
    updateSortIcons();
    return;
  }

  const list = sortedHistory();
  historyTbody.innerHTML = list.length ? list.map((rec) => {
    const result = historyResult(rec);
    const channelPartnerCell = isSuperAdminUser ? `<td data-label="Channel Partner">${esc(rec.channelPartner || "—")}</td>` : "";
    return `
    <tr data-id="${esc(rec.id)}" class="fade-in">
      <td data-label="Calculation ID" class="font-medium">${esc(rec.id)}</td>
      <td data-label="Customer">${esc(rec.customer)}</td>
      <td data-label="Project">${esc(rec.project)}</td>
      <td data-label="Capacity">${esc(rec.capacity)} kW</td>
      <td data-label="Final Cost">${formatINR(result.finalCost)}</td>
      <td data-label="Date">${formatDate(rec.date)}</td>
      ${channelPartnerCell}
      <td data-label="Actions">${actionIconsHtml(rec.id)}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="${colCount}" style="text-align:center; padding: 24px; color:#9CA3AF;">No calculations saved yet.</td></tr>`;
  updateSortIcons();
}

function updateSortIcons() {
  document.querySelectorAll("#historyTable thead th[data-key]").forEach((th) => {
    const icon = th.querySelector(".sort-icon");
    const key = th.getAttribute("data-key");
    th.classList.toggle("sorted", key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === "asc" ? "↑" : "↓") : "⇅";
  });
}

document.querySelectorAll("#historyTable thead th[data-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-key");
    if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortKey = key; sortDir = "asc"; }
    renderHistoryTable();
  });
});

function findRecord(id) { return history.find((r) => r.id === id); }

// ============================================================
// Save Calculation  →  POST /api/calculations
// ============================================================
function buildPayload({ customer, project, capacity, projectType, v, partnerId }) {
  const payload = {
    customerName: customer,
    projectName: project || null,
    capacityKw: capacity,
    projectType: toApiType(projectType),
    materialCost: v.material,
    installationCost: v.installation,
    transportationCost: v.transportation,
    civilCost: v.civil,
    labourCost: v.labour,
    electricalCost: v.electrical,
    otherCost: v.other,
    discount: v.discount,
    gstPercent: v.gstPct,
  };
  if (partnerId) payload.partnerId = partnerId;
  return payload;
}

document.getElementById("saveCalcBtn")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const v = readForm(formIds);
  const capacity = parseFloat(document.getElementById("fCapacity").value) || 0;
  const customer = document.getElementById("fCustomer").value.trim();
  const project = document.getElementById("fProject").value.trim();
  const projectType = document.getElementById("fProjectType").value;

  if (!customer) { showToast("Customer name is required"); document.getElementById("fCustomer").focus(); return; }
  if (!(capacity >= 0.01)) { showToast("System capacity must be at least 0.01 kW"); document.getElementById("fCapacity").focus(); return; }

  let partnerId = null;
  if (isSuperAdmin()) {
    partnerId = parseInt(document.getElementById("fPartner")?.value, 10) || null;
    if (!partnerId) { showToast("Please select a channel partner"); document.getElementById("fPartner")?.focus(); return; }
  }

  setBusy(btn, true, "Saving…");
  try {
    const saved = await api("/api/calculations", {
      method: "POST",
      body: buildPayload({ customer, project, capacity, projectType, v, partnerId }),
    });
    const rec = mapDto(saved);
    history.unshift(rec);
    sortKey = "date"; sortDir = "desc";
    renderHistoryTable();
    showToast(`Saved as ${rec.id}`);
  } catch (err) {
    showToast(err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ============================================================
// View Modal
// ============================================================
const viewModal = document.getElementById("viewModal");
document.getElementById("viewModalCloseBtn")?.addEventListener("click", () => viewModal.classList.add("hidden"));
document.getElementById("viewModalCloseBtn2")?.addEventListener("click", () => viewModal.classList.add("hidden"));
viewModal?.addEventListener("click", (e) => { if (e.target === viewModal) viewModal.classList.add("hidden"); });

function openViewModal(id) {
  const rec = findRecord(id);
  if (!rec) return;
  const result = historyResult(rec);

  document.getElementById("viewModalSubtitle").textContent = `${rec.id} · ${formatDate(rec.date)}`;
  document.getElementById("vCustomer").textContent = rec.customer;
  document.getElementById("vProject").textContent = rec.project || "—";
  document.getElementById("vCapacity").textContent = `${rec.capacity} kW`;
  document.getElementById("vProjectType").textContent = rec.projectType;

  renderBreakdown("viewCalcBreakdown", rec, result);
  viewModal.classList.remove("hidden");
}

// ============================================================
// Edit Modal  →  PUT /api/calculations/{id}
// ============================================================
const editModal = document.getElementById("editModal");
let editingId = null;

document.getElementById("editModalCloseBtn")?.addEventListener("click", () => editModal.classList.add("hidden"));
document.getElementById("editCancelBtn")?.addEventListener("click", () => editModal.classList.add("hidden"));
editModal?.addEventListener("click", (e) => { if (e.target === editModal) editModal.classList.add("hidden"); });

function openEditModal(id) {
  const rec = findRecord(id);
  if (!rec) return;
  editingId = id;

  document.getElementById("editModalSubtitle").textContent = rec.id;
  document.getElementById("eCustomer").value = rec.customer;
  document.getElementById("eProject").value = rec.project;
  document.getElementById("eCapacity").value = rec.capacity;
  document.getElementById("eProjectType").value = rec.projectType;
  document.getElementById("eMaterial").value = rec.material;
  document.getElementById("eInstallation").value = rec.installation;
  document.getElementById("eTransportation").value = rec.transportation;
  document.getElementById("eCivil").value = rec.civil;
  document.getElementById("eLabour").value = rec.labour;
  document.getElementById("eElectrical").value = rec.electrical;
  document.getElementById("eOther").value = rec.other;
  document.getElementById("eDiscount").value = rec.discount;
  document.getElementById("eGstPct").value = rec.gstPct;

  editModal.classList.remove("hidden");
}

document.getElementById("editSaveBtn")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const rec = findRecord(editingId);
  if (!rec) return;

  const num = (id) => parseFloat(document.getElementById(id).value) || 0;
  const customer = document.getElementById("eCustomer").value.trim();
  const capacity = num("eCapacity");
  if (!customer) { showToast("Customer name is required"); return; }
  if (!(capacity >= 0.01)) { showToast("Capacity must be at least 0.01 kW"); return; }

  const v = {
    material: num("eMaterial"), installation: num("eInstallation"), transportation: num("eTransportation"),
    civil: num("eCivil"), labour: num("eLabour"), electrical: num("eElectrical"), other: num("eOther"),
    discount: num("eDiscount"), gstPct: num("eGstPct"),
  };

  setBusy(btn, true, "Saving…");
  try {
    const updated = await api(`/api/calculations/${rec.dbId}`, {
      method: "PUT",
      // Super Admin must send the record's partner (backend rejects null); other roles are auto-scoped.
      body: buildPayload({
        customer,
        project: document.getElementById("eProject").value.trim(),
        capacity,
        projectType: document.getElementById("eProjectType").value,
        v,
        partnerId: isSuperAdmin() ? rec.partnerId : null,
      }),
    });
    const idx = history.findIndex((r) => r.dbId === rec.dbId);
    if (idx >= 0) history[idx] = mapDto(updated);
    editModal.classList.add("hidden");
    renderHistoryTable();
    showToast(`${rec.id} updated — costs recalculated`);
  } catch (err) {
    showToast(err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ============================================================
// Delete Modal  →  DELETE /api/calculations/{id}
// ============================================================
const deleteModal = document.getElementById("deleteModal");
let deletingId = null;

document.getElementById("deleteModalCloseBtn")?.addEventListener("click", () => deleteModal.classList.add("hidden"));
document.getElementById("deleteCancelBtn")?.addEventListener("click", () => deleteModal.classList.add("hidden"));
deleteModal?.addEventListener("click", (e) => { if (e.target === deleteModal) deleteModal.classList.add("hidden"); });

function openDeleteModal(id) {
  deletingId = id;
  document.getElementById("deleteCalcId").textContent = id;
  deleteModal.classList.remove("hidden");
}

document.getElementById("deleteConfirmBtn")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const rec = findRecord(deletingId);
  if (!rec) { deleteModal.classList.add("hidden"); return; }

  setBusy(btn, true, "Deleting…");
  try {
    await api(`/api/calculations/${rec.dbId}`, { method: "DELETE" });
    history = history.filter((r) => r.dbId !== rec.dbId);
    deleteModal.classList.add("hidden");
    renderHistoryTable();
    showToast(`${rec.id} deleted`);
    deletingId = null;
  } catch (err) {
    showToast(err.message);
  } finally {
    setBusy(btn, false);
  }
});

// ============================================================
// Row action wiring
// ============================================================
historyTbody?.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;
  const id = actionBtn.getAttribute("data-id");
  const action = actionBtn.getAttribute("data-action");
  if (action === "view") openViewModal(id);
  else if (action === "edit") openEditModal(id);
  else if (action === "delete") openDeleteModal(id);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  [viewModal, editModal, deleteModal].forEach((m) => m?.classList.add("hidden"));
});

// ============================================================
// Print / PDF / Excel — all three use the shared Exporter (/shared/exports.js)
// so branding, number format, date format and footer are identical everywhere.
// ============================================================
function exporterReady() {
  if (window.Exporter) return true;
  showToast("Export module not loaded — add /shared/exports.js before calc.js");
  return false;
}

// ---- Print slip: the live calculation currently on screen ----
document.getElementById("printCalcBtn")?.addEventListener("click", async () => {
  if (!exporterReady()) return;
  const { v, capacity, result } = recalcLive();
  const customer = document.getElementById("fCustomer").value.trim() || "—";
  const project = document.getElementById("fProject").value.trim() || "—";
  const projectType = document.getElementById("fProjectType").value;
  const partnerSel = document.getElementById("fPartner");
  const partnerName = partnerSel && partnerSel.value ? partnerSel.options[partnerSel.selectedIndex].text : null;

  const details = [
    { label: "Customer", value: customer },
    { label: "Project", value: project },
    { label: "System Capacity", value: `${capacity} kW` },
    { label: "Project Type", value: projectType },
  ];
  if (partnerName) details.push({ label: "Channel Partner", value: partnerName });

  await Exporter.print({
    title: "Cost Calculation Slip",
    docNo: "Draft (not saved)",
    sections: [
      { title: "Project Details", rows: details },
      { title: "Cost Breakdown", rows: [
        { op: "", label: "Material Cost", value: v.material },
        { op: "+", label: "Installation Cost", value: v.installation },
        { op: "+", label: "Transportation Cost", value: v.transportation },
        { op: "+", label: "Civil Work Cost", value: v.civil },
        { op: "+", label: "Labour Cost", value: v.labour },
        { op: "+", label: "Electrical Cost", value: v.electrical },
        { op: "+", label: "Other Charges", value: v.other },
        { op: "−", label: "Discount", value: v.discount, negative: true },
        { op: "", label: "Subtotal", value: result.subtotal, strong: true },
        { op: "+", label: `GST (${v.gstPct}%)`, value: result.gstAmount },
      ] },
      { title: "Summary", rows: [{ label: "Cost per kW", value: result.costPerKw }] },
    ],
    total: { label: "Final Cost", value: result.finalCost },
    note: "This is an estimate. Final amounts are confirmed when the calculation is saved.",
  });
});

// ---- History export: one column spec drives both PDF and Excel ----
function historyColumns() {
  const cols = [
    { header: "Calc ID", get: (r) => r.id, width: 14 },
    { header: "Customer", get: (r) => r.customer, width: 24 },
    { header: "Project", get: (r) => r.project || "—", width: 26 },
    { header: "Type", get: (r) => r.projectType, width: 14 },
    { header: "Capacity (kW)", get: (r) => r.capacity, type: "number", width: 14 },
    // cost heads: Excel only (too wide for the PDF page)
    { header: "Material", get: (r) => r.material, type: "money", total: true, pdf: false },
    { header: "Installation", get: (r) => r.installation, type: "money", total: true, pdf: false },
    { header: "Transportation", get: (r) => r.transportation, type: "money", total: true, pdf: false },
    { header: "Civil Work", get: (r) => r.civil, type: "money", total: true, pdf: false },
    { header: "Labour", get: (r) => r.labour, type: "money", total: true, pdf: false },
    { header: "Electrical", get: (r) => r.electrical, type: "money", total: true, pdf: false },
    { header: "Other", get: (r) => r.other, type: "money", total: true, pdf: false },
    { header: "Discount", get: (r) => r.discount, type: "money", total: true, pdf: false },
    { header: "GST %", get: (r) => r.gstPct, type: "number", pdf: false, width: 9 },
    { header: "Subtotal", get: (r) => r.server.subtotal, type: "money", total: true },
    { header: "GST Amount", get: (r) => r.server.gstAmount, type: "money", total: true },
    { header: "Final Cost", get: (r) => r.server.finalCost, type: "money", total: true },
    { header: "Cost / kW", get: (r) => r.server.costPerKw, type: "money", pdf: false },
    { header: "Date", get: (r) => r.date, type: "date" },
  ];
  if (isSuperAdmin()) cols.push({ header: "Channel Partner", get: (r) => r.channelPartner || "—", width: 24 });
  return cols;
}

function exportSubtitle(n) { return `${n} record${n === 1 ? "" : "s"}`; }

document.getElementById("exportPdfBtn")?.addEventListener("click", async (e) => {
  if (!exporterReady()) return;
  const btn = e.currentTarget;
  const rows = sortedHistory();
  if (!rows.length) { showToast("No calculations to export"); return; }
  setBusy(btn, true, "Preparing…");
  try {
    await Exporter.pdfTable({
      filename: "calculation-history.pdf",
      title: "Calculation History",
      subtitle: exportSubtitle(rows.length),
      columns: historyColumns(),
      rows,
    });
    showToast("Downloaded calculation-history.pdf");
  } catch (err) { showToast(err.message); }
  finally { setBusy(btn, false); }
});

document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
  if (!exporterReady()) return;
  const rows = sortedHistory();
  if (!rows.length) { showToast("No calculations to export"); return; }
  try {
    Exporter.excelTable({
      filename: "calculation-history.xlsx",
      sheetName: "Calculation History",
      title: "Calculation History",
      subtitle: exportSubtitle(rows.length),
      columns: historyColumns(),
      rows,
    });
    showToast("Downloaded calculation-history.xlsx");
  } catch (err) { showToast(err.message); }
});

// ============================================================
// Init
// ============================================================
function applyPermissionsToUi() {
  const saveBtn = document.getElementById("saveCalcBtn");
  if (saveBtn && !can("CREATE")) { saveBtn.disabled = true; saveBtn.style.opacity = ".5"; saveBtn.title = "You don't have permission to save calculations"; }
}

recalcLive();
applyPermissionsToUi();
renderHistoryTable();

// session.js finishes setting the role after DOMContentLoaded, so the role-dependent
// bits (partner dropdown, Channel Partner column, permissions) are wired once it's ready.
function initAfterSession() {
  applyPermissionsToUi();
  loadPartnerOptions();
  loadHistory();
}
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", initAfterSession);
else initAfterSession();