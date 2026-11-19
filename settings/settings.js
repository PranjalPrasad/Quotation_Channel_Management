// ============================================================
// Settings — Super Admin only. Backed by the REST API (no localStorage,
// no mock data). All calls go through Session.api() from session.js, which
// adds the Bearer token and logs the user out on 401.
//
//   GET/PUT            /api/settings/branding
//   POST               /api/files/upload (purpose LOGO; see files.js - the logo is NOT a public URL, it is fetched with the token)
//   GET/PUT            /api/settings/bank-details
//   GET/PUT            /api/settings/quotation-defaults
//   GET/POST           /api/settings/subsidy-rules
//   PUT/DELETE         /api/settings/subsidy-rules/:id
//   GET/POST           /api/settings/gst-rules
//   PUT/DELETE         /api/settings/gst-rules/:id
//
// Settings are PER TENANT: every call acts on the logged-in user's own partner (the backend never takes a partner id
// from the page). The Super Admin's settings apply to the platform's own records only, never to partners.
// Failures are reported with AppLog (Module 0): action, group, HTTP status and error code only - never field values
// (bank account numbers etc.).
//
// Responses may be the bare JSON or wrapped as { data: ... }.
// Branding: { name, address, phone, email, website, logoPath }   (logoPath comes from POST /api/files/upload)
// Bank:     { accountName, bankName, accountNumber, ifsc, branch }
// Defaults: { terms, validityDays, prefix }
// Subsidy:  { id, type, category, valueType, value, capMin, capMax }
// GST:      { id, category, gstPercent, applicableOn }
// ============================================================

const SETTINGS_API = "/api/settings";

function unwrap(body) {
  return body && typeof body === "object" && !Array.isArray(body) && "data" in body ? body.data : body;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Failure reporting through the shared AppLog (Module 0). Never throws, never logs values. Falls back to the console. */
function logFailure(action, err, extra) {
  const ctx = Object.assign({ module: "SETTINGS", action, status: err && err.status, code: err && err.errorCode }, extra || {});
  const msg = `[SETTINGS] ${action} failed: ${(err && err.message) || "unknown error"}`;
  try {
    const L = window.AppLog;
    if (L && typeof L.error === "function") { L.error("SETTINGS", `${action} failed: ${(err && err.message) || "unknown error"}`, ctx); return; }
  } catch (_) { /* logging must never break the screen */ }
  console.error(msg, ctx);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ============================================================
// Greeting + avatar (same logic as the dashboard)
// ============================================================
function decodeJwtPayload(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (_) { return null; }
}

function getLoggedInUserName() {
  const sources = [];
  try {
    if (window.Session) {
      if (typeof Session.getUser === "function") sources.push(Session.getUser());
      if (typeof Session.getSession === "function") sources.push(Session.getSession());
      if (Session.user) sources.push(Session.user);
    }
  } catch (_) {}
  try {
    const raw = sessionStorage.getItem("sqms_session");
    if (raw) sources.push(JSON.parse(raw));
  } catch (_) {}

  for (const s of sources.filter(Boolean)) {
    const u = s.user || s.data?.user || s.data || s;
    const name = u.fullName || u.name || u.userName || u.username ||
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      (u.email ? u.email.split("@")[0] : "");
    if (name) return String(name).trim();
    const token = s.token || s.accessToken || u.token;
    const claims = token ? decodeJwtPayload(token) : null;
    const fromJwt = claims && (claims.name || claims.fullName || claims.username || claims.sub);
    if (fromJwt) return String(fromJwt).trim();
  }
  return "User";
}

(function renderUserName() {
  const name = getLoggedInUserName();
  setText("greetingName", name);
  setText("profileInitial", name.charAt(0).toUpperCase());
})();

// ============================================================
// Role guard — Settings is Super Admin only. The sidebar item is
// hidden for other roles, and we also hard-guard the page body in
// case someone opens the URL directly.
// window.currentUserRole is a read-only global from session.js.
// ============================================================
function applyRoleBasedVisibility() {
  const userRole = window.currentUserRole;
  document.querySelectorAll("[data-role]").forEach((el) => {
    const roles = el.getAttribute("data-role").split(",").map((r) => r.trim());
    el.style.display = roles.includes(userRole) ? "" : "none";
  });
}
applyRoleBasedVisibility();
window.addEventListener("DOMContentLoaded", applyRoleBasedVisibility);

function enforcePageAccess() {
  const isSuperAdmin = window.currentUserRole === "SUPER_ADMIN";
  document.getElementById("accessRestricted").classList.toggle("hidden", isSuperAdmin);
  document.getElementById("settingsContent").classList.toggle("hidden", !isSuperAdmin);
  document.getElementById("saveSettingsBtn").style.display = isSuperAdmin ? "" : "none";
  return isSuperAdmin;
}

// ============================================================
// Sidebar collapse / expand (identical to the dashboard)
// ============================================================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleIcon = document.getElementById("toggleIcon");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

const drawerMQ = window.matchMedia("(max-width: 1023px)");
const isDrawerViewport = () => drawerMQ.matches;

// On phone/tablet: open the sidebar drawer on page load? (true = open with backdrop, false = icon rail only)
const OPEN_BY_DEFAULT_ON_DRAWER = true;
const defaultSidebarState = () => (isDrawerViewport() ? OPEN_BY_DEFAULT_ON_DRAWER : true);
let sidebarExpanded = defaultSidebarState();

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
drawerMQ.addEventListener("change", () => setSidebarExpanded(defaultSidebarState()));

// nav items are generated by session.js AFTER load -> event delegation
document.getElementById("sidebarNav")?.addEventListener("click", (e) => {
  if (e.target.closest(".nav-item") && isDrawerViewport()) setSidebarExpanded(false);
});

// ============================================================
// Settings state — filled from the API by loadSettings() (see Init).
// ============================================================
let settings = {
  branding: { logoPath: "", name: "", address: "", phone: "", email: "", website: "" },
  bank: { accountName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" },
  defaults: { terms: "", validityDays: "", prefix: "" },
  subsidyRules: [],
  gstRules: [],
};

async function loadSettings() {
  const [branding, bank, defaults, subsidyRules, gstRules] = await Promise.all([
    Session.api(`${SETTINGS_API}/branding`),
    Session.api(`${SETTINGS_API}/bank-details`),
    Session.api(`${SETTINGS_API}/quotation-defaults`),
    Session.api(`${SETTINGS_API}/subsidy-rules`),
    Session.api(`${SETTINGS_API}/gst-rules`),
  ]);
  settings = {
    branding: Object.assign({}, settings.branding, unwrap(branding) || {}),
    bank: Object.assign({}, settings.bank, unwrap(bank) || {}),
    defaults: Object.assign({}, settings.defaults, unwrap(defaults) || {}),
    subsidyRules: unwrap(subsidyRules) || [],
    gstRules: unwrap(gstRules) || [],
  };
}

// ============================================================
// Tabs
// ============================================================
document.querySelectorAll(".settings-tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".settings-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".settings-panel").forEach((p) => p.classList.add("hidden"));
    tabBtn.classList.add("active");
    document.querySelector(`.settings-panel[data-panel="${tabBtn.dataset.tab}"]`).classList.remove("hidden");
  });
});

// ============================================================
// Company Branding
// ============================================================
const fldLogoUpload = document.getElementById("fldLogoUpload");
const logoPreview = document.getElementById("logoPreview");
const logoPreviewEmpty = document.getElementById("logoPreviewEmpty");
const fldCompanyName = document.getElementById("fldCompanyName");
const fldCompanyAddress = document.getElementById("fldCompanyAddress");
const fldCompanyPhone = document.getElementById("fldCompanyPhone");
const fldCompanyEmail = document.getElementById("fldCompanyEmail");
const fldCompanyWebsite = document.getElementById("fldCompanyWebsite");

function setLogoPreview(dataUrl) {
  if (dataUrl) {
    logoPreview.src = dataUrl;
    logoPreview.style.display = "block";
    logoPreviewEmpty.style.display = "none";
  } else {
    logoPreview.removeAttribute("src");
    logoPreview.style.display = "none";
    logoPreviewEmpty.style.display = "block";
  }
}

let localLogoUrl = "";   // blob: URL of a logo uploaded in this visit, revoked when replaced

fldLogoUpload.addEventListener("change", async () => {
  const file = fldLogoUpload.files && fldLogoUpload.files[0];
  if (!file) return;
  if (!window.FileApi) {
    logFailure("upload logo", { message: "files.js is not loaded" });
    showToast("Logo upload is not available on this page");
    fldLogoUpload.value = "";
    return;
  }
  try {
    // Uploaded right away; the record only points at it after Save Settings. FileApi logs any failure ([FILE], AppLog).
    const saved = await FileApi.upload(file, "LOGO");
    settings.branding.logoPath = saved.path;
    if (localLogoUrl) URL.revokeObjectURL(localLogoUrl);
    localLogoUrl = URL.createObjectURL(file);
    setLogoPreview(localLogoUrl);
    showToast("Logo uploaded — click Save Settings to keep it");
  } catch (err) {
    showToast(err.message || "Could not upload the logo");
  } finally {
    fldLogoUpload.value = "";   // the same file can be chosen again
  }
});

function fillBrandingForm() {
  const b = settings.branding;
  fldCompanyName.value = b.name || "";
  fldCompanyAddress.value = b.address || "";
  fldCompanyPhone.value = b.phone || "";
  fldCompanyEmail.value = b.email || "";
  fldCompanyWebsite.value = b.website || "";
  showStoredLogo(b.logoPath || "");
}

/** The stored logo is not a public URL: FileApi fetches it with the token and returns a blob: URL. */
async function showStoredLogo(path) {
  setLogoPreview("");
  if (!path || !window.FileApi) return;
  const url = await FileApi.objectUrl(path);
  if (url && settings.branding.logoPath === path) setLogoPreview(url);
}

// ============================================================
// Bank Details
// ============================================================
const fldAccountName = document.getElementById("fldAccountName");
const fldBankName = document.getElementById("fldBankName");
const fldAccountNumber = document.getElementById("fldAccountNumber");
const fldIfsc = document.getElementById("fldIfsc");
const fldBranch = document.getElementById("fldBranch");

function fillBankForm() {
  const b = settings.bank;
  fldAccountName.value = b.accountName || "";
  fldBankName.value = b.bankName || "";
  fldAccountNumber.value = b.accountNumber || "";
  fldIfsc.value = b.ifsc || "";
  fldBranch.value = b.branch || "";
}

// ============================================================
// Quotation Defaults
// ============================================================
const fldTerms = document.getElementById("fldTerms");
const fldValidityDays = document.getElementById("fldValidityDays");
const fldPrefix = document.getElementById("fldPrefix");

function fillDefaultsForm() {
  const d = settings.defaults;
  fldTerms.value = d.terms || "";
  fldValidityDays.value = d.validityDays ?? "";
  fldPrefix.value = d.prefix || "";
}

// ============================================================
// Subsidy Master table
// ============================================================
const subsidyTbody = document.getElementById("subsidyTbody");
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';

function formatSubsidyValue(rule) {
  return rule.valueType === "percentage" ? `${rule.value}%` : `₹${Number(rule.value).toLocaleString("en-IN")}`;
}

function renderSubsidyTable() {
  if (!settings.subsidyRules.length) {
    subsidyTbody.innerHTML = `<tr><td colspan="5" class="empty-row-msg">No subsidy rules yet — click "Add Subsidy Rule" to create one.</td></tr>`;
    return;
  }
  subsidyTbody.innerHTML = settings.subsidyRules.map((r) => `
    <tr data-id="${esc(r.id)}">
      <td data-label="Subsidy Type" class="font-medium">${esc(r.type)}</td>
      <td data-label="Category"><span class="pill ${r.category === "Residential" ? "pill-residential" : "pill-commercial"}">${esc(r.category)}</span></td>
      <td data-label="Percentage / Amount">${formatSubsidyValue(r)}</td>
      <td data-label="Applicable Capacity Range">${esc(r.capMin)} – ${esc(r.capMax)} kW</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="action-icon-btn icon-edit" data-action="editSubsidy" data-id="${esc(r.id)}" title="Edit">${ICON_EDIT}</button>
          <button class="action-icon-btn icon-delete" data-action="deleteSubsidy" data-id="${esc(r.id)}" title="Delete">${ICON_DELETE}</button>
        </div>
      </td>
    </tr>`).join("");
}

subsidyTbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (btn.dataset.action === "editSubsidy") openSubsidyModal(id);
  else if (btn.dataset.action === "deleteSubsidy") {
    if (!confirm("Delete this subsidy rule?")) return;
    Session.api(`${SETTINGS_API}/subsidy-rules/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => {
        settings.subsidyRules = settings.subsidyRules.filter((r) => String(r.id) !== String(id));
        renderSubsidyTable();
        showToast("Subsidy rule deleted");
      })
      .catch((err) => { logFailure("delete subsidy rule", err, { ruleId: id }); showToast(err.message || "Could not delete subsidy rule"); });
  }
});

// ---- Subsidy modal ----
const subsidyModal = document.getElementById("subsidyModal");
const subsidyModalTitle = document.getElementById("subsidyModalTitle");
const sfType = document.getElementById("sfType");
const sfCategory = document.getElementById("sfCategory");
const sfValueType = document.getElementById("sfValueType");
const sfValue = document.getElementById("sfValue");
const sfCapMin = document.getElementById("sfCapMin");
const sfCapMax = document.getElementById("sfCapMax");
let editingSubsidyId = null;

function openSubsidyModal(id) {
  editingSubsidyId = id || null;
  const r = id ? settings.subsidyRules.find((x) => String(x.id) === String(id)) : null;
  subsidyModalTitle.textContent = r ? "Edit Subsidy Rule" : "Add Subsidy Rule";
  sfType.value = r ? r.type : "";
  sfCategory.value = r ? r.category : "Residential";
  sfValueType.value = r ? r.valueType : "percentage";
  sfValue.value = r ? r.value : "";
  sfCapMin.value = r ? r.capMin : "";
  sfCapMax.value = r ? r.capMax : "";
  subsidyModal.classList.remove("hidden");
}

document.getElementById("addSubsidyBtn").addEventListener("click", () => openSubsidyModal(null));

document.getElementById("subsidySaveBtn").addEventListener("click", async () => {
  if (!sfType.value.trim() || sfValue.value === "") {
    showToast("Subsidy type and value are required");
    return;
  }
  const payload = {
    type: sfType.value.trim(),
    category: sfCategory.value,
    valueType: sfValueType.value,
    value: parseFloat(sfValue.value) || 0,
    capMin: parseFloat(sfCapMin.value) || 0,
    capMax: parseFloat(sfCapMax.value) || 0,
  };
  try {
    if (editingSubsidyId) {
      const saved = unwrap(await Session.api(`${SETTINGS_API}/subsidy-rules/${encodeURIComponent(editingSubsidyId)}`, { method: "PUT", body: payload }));
      const idx = settings.subsidyRules.findIndex((r) => String(r.id) === String(editingSubsidyId));
      if (idx >= 0) settings.subsidyRules[idx] = Object.assign({}, settings.subsidyRules[idx], payload, saved || {});
    } else {
      const saved = unwrap(await Session.api(`${SETTINGS_API}/subsidy-rules`, { method: "POST", body: payload }));
      settings.subsidyRules.push(Object.assign({}, payload, saved || {}));
    }
    renderSubsidyTable();
    closeModalById("subsidyModal");
    showToast("Subsidy rule saved");
  } catch (err) {
    logFailure(editingSubsidyId ? "update subsidy rule" : "create subsidy rule", err, { ruleId: editingSubsidyId });
    showToast(err.message || "Could not save subsidy rule");
  }
});

// ============================================================
// GST Rules table
// ============================================================
const gstTbody = document.getElementById("gstTbody");

function renderGstTable() {
  if (!settings.gstRules.length) {
    gstTbody.innerHTML = `<tr><td colspan="4" class="empty-row-msg">No GST rules yet — click "Add GST Rule" to create one.</td></tr>`;
    return;
  }
  gstTbody.innerHTML = settings.gstRules.map((r) => `
    <tr data-id="${esc(r.id)}">
      <td data-label="Category" class="font-medium">${esc(r.category)}</td>
      <td data-label="GST %">${esc(r.gstPercent)}%</td>
      <td data-label="Applicable On"><span class="pill ${r.applicableOn === "Product" ? "pill-product" : "pill-service"}">${esc(r.applicableOn)}</span></td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="action-icon-btn icon-edit" data-action="editGst" data-id="${esc(r.id)}" title="Edit">${ICON_EDIT}</button>
          <button class="action-icon-btn icon-delete" data-action="deleteGst" data-id="${esc(r.id)}" title="Delete">${ICON_DELETE}</button>
        </div>
      </td>
    </tr>`).join("");
}

gstTbody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  if (btn.dataset.action === "editGst") openGstModal(id);
  else if (btn.dataset.action === "deleteGst") {
    if (!confirm("Delete this GST rule?")) return;
    Session.api(`${SETTINGS_API}/gst-rules/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => {
        settings.gstRules = settings.gstRules.filter((r) => String(r.id) !== String(id));
        renderGstTable();
        showToast("GST rule deleted");
      })
      .catch((err) => { logFailure("delete GST rule", err, { ruleId: id }); showToast(err.message || "Could not delete GST rule"); });
  }
});

// ---- GST modal ----
const gstModal = document.getElementById("gstModal");
const gstModalTitle = document.getElementById("gstModalTitle");
const gfCategory = document.getElementById("gfCategory");
const gfPercent = document.getElementById("gfPercent");
const gfApplicableOn = document.getElementById("gfApplicableOn");
let editingGstId = null;

function openGstModal(id) {
  editingGstId = id || null;
  const r = id ? settings.gstRules.find((x) => String(x.id) === String(id)) : null;
  gstModalTitle.textContent = r ? "Edit GST Rule" : "Add GST Rule";
  gfCategory.value = r ? r.category : "";
  gfPercent.value = r ? r.gstPercent : "";
  gfApplicableOn.value = r ? r.applicableOn : "Product";
  gstModal.classList.remove("hidden");
}

document.getElementById("addGstBtn").addEventListener("click", () => openGstModal(null));

document.getElementById("gstSaveBtn").addEventListener("click", async () => {
  if (!gfCategory.value.trim() || gfPercent.value === "") {
    showToast("Category and GST % are required");
    return;
  }
  const payload = {
    category: gfCategory.value.trim(),
    gstPercent: parseFloat(gfPercent.value) || 0,
    applicableOn: gfApplicableOn.value,
  };
  try {
    if (editingGstId) {
      const saved = unwrap(await Session.api(`${SETTINGS_API}/gst-rules/${encodeURIComponent(editingGstId)}`, { method: "PUT", body: payload }));
      const idx = settings.gstRules.findIndex((r) => String(r.id) === String(editingGstId));
      if (idx >= 0) settings.gstRules[idx] = Object.assign({}, settings.gstRules[idx], payload, saved || {});
    } else {
      const saved = unwrap(await Session.api(`${SETTINGS_API}/gst-rules`, { method: "POST", body: payload }));
      settings.gstRules.push(Object.assign({}, payload, saved || {}));
    }
    renderGstTable();
    closeModalById("gstModal");
    showToast("GST rule saved");
  } catch (err) {
    logFailure(editingGstId ? "update GST rule" : "create GST rule", err, { ruleId: editingGstId });
    showToast(err.message || "Could not save GST rule");
  }
});

// ============================================================
// Shared modal close handling (both subsidy & GST modals)
// ============================================================
function closeModalById(id) {
  document.getElementById(id).classList.add("hidden");
  editingSubsidyId = null;
  editingGstId = null;
}
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModalById(btn.getAttribute("data-close")));
});
[subsidyModal, gstModal].forEach((modal) => {
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModalById(modal.id); });
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!subsidyModal.classList.contains("hidden")) closeModalById("subsidyModal");
  if (!gstModal.classList.contains("hidden")) closeModalById("gstModal");
});

// Safety net: if a <form> ever ends up inside a modal again, Enter must not reload the page.
document.querySelectorAll(".modal-panel form").forEach((form) => {
  form.addEventListener("submit", (e) => e.preventDefault());
});

// ============================================================
// Save Settings — collects Branding, Bank Details and Quotation Defaults
// and PUTs them to the API. (Subsidy / GST rules are saved immediately
// from their own modals.)
// ============================================================
document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const saveBtn = document.getElementById("saveSettingsBtn");

  // Fields the form does not show (payment terms, referral percent) are sent back exactly as loaded,
  // otherwise saving would blank them on the server. logoPath is the reference returned by the upload.
  const branding = Object.assign({}, settings.branding, {
    name: fldCompanyName.value.trim(),
    address: fldCompanyAddress.value.trim(),
    phone: fldCompanyPhone.value.trim(),
    email: fldCompanyEmail.value.trim(),
    website: fldCompanyWebsite.value.trim(),
    logoPath: settings.branding.logoPath || "",
  });
  const bank = Object.assign({}, settings.bank, {
    accountName: fldAccountName.value.trim(),
    bankName: fldBankName.value.trim(),
    accountNumber: fldAccountNumber.value.trim(),
    ifsc: fldIfsc.value.trim().toUpperCase(),
    branch: fldBranch.value.trim(),
  });
  const defaults = Object.assign({}, settings.defaults, {
    terms: fldTerms.value,
    validityDays: parseInt(fldValidityDays.value, 10) || 0,
    prefix: (fldPrefix.value.trim() || "SQ").toUpperCase(),
  });

  const groups = [
    { key: "branding", label: "Company branding", path: "branding", body: branding },
    { key: "bank", label: "Bank details", path: "bank-details", body: bank },
    { key: "defaults", label: "Quotation defaults", path: "quotation-defaults", body: defaults },
  ];

  saveBtn.disabled = true;
  try {
    // Three independent saves: report each one, never claim "nothing changed" when another group did save.
    const results = await Promise.allSettled(
      groups.map((g) => Session.api(`${SETTINGS_API}/${g.path}`, { method: "PUT", body: g.body })));
    const failed = [];
    results.forEach((r, i) => {
      const g = groups[i];
      if (r.status === "fulfilled") settings[g.key] = g.body;
      else {
        failed.push(g.label);
        logFailure(`save ${g.label.toLowerCase()}`, r.reason, { group: g.key });
      }
    });
    if (!failed.length) showToast("Settings saved");
    else {
      const first = results.find((r) => r.status === "rejected").reason;
      showToast(`Not saved: ${failed.join(", ")}${first && first.message ? " — " + first.message : ""}`);
    }
  } finally {
    saveBtn.disabled = false;
  }
});

// ============================================================
// Toast helper
// ============================================================
function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ============================================================
// Topbar: notification + profile dropdowns (open / close only)
// ============================================================
const notifBtn = document.getElementById("notifBtn");
const notifDropdown = document.getElementById("notifDropdown");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

function closeAllTopbarDropdowns() {
  [notifDropdown, profileDropdown].forEach((dd) => dd && dd.classList.add("hidden"));
  notifBtn?.setAttribute("aria-expanded", "false");
}
notifBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = notifDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  notifDropdown.classList.toggle("hidden", !willOpen);
  notifBtn.setAttribute("aria-expanded", String(willOpen));
});
profileBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = profileDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  profileDropdown.classList.toggle("hidden", !willOpen);
});
notifDropdown?.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => closeAllTopbarDropdowns());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !notifDropdown.classList.contains("hidden")) {
    closeAllTopbarDropdowns();
    notifBtn.focus();
  }
});

profileLogoutBtn?.addEventListener("click", () => Session.logout());

// ============================================================
// Init
// ============================================================
(async function initSettings() {
  if (!enforcePageAccess()) return;
  try {
    await loadSettings();
  } catch (err) {
    logFailure("load settings", err);
    showToast(err.message || "Could not load settings from the server");
    // Forms stay empty: we never show made-up values as if they were saved settings.
  }
  fillBrandingForm();
  fillBankForm();
  fillDefaultsForm();
  renderSubsidyTable();
  renderGstTable();
})();