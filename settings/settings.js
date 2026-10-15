// ============================================================
// Settings — Super Admin only. Backed by the REST API (no localStorage,
// no mock data). All calls go through Session.api() from session.js, which
// adds the Bearer token and logs the user out on 401.
//
//   GET/PUT            /api/settings/branding
//   GET/PUT            /api/settings/bank-details
//   GET/PUT            /api/settings/quotation-defaults
//   GET/POST           /api/settings/subsidy-rules
//   PUT/DELETE         /api/settings/subsidy-rules/:id
//   GET/POST           /api/settings/gst-rules
//   PUT/DELETE         /api/settings/gst-rules/:id
//
// Responses may be the bare JSON or wrapped as { data: ... }.
// Branding: { name, address, phone, email, website, logoDataUrl }
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

// ============================================================
// Role guard — Settings is Super Admin only. The sidebar item is
// hidden for other roles via data-role, but we also hard-guard the
// page body in case someone opens the URL directly.
// ============================================================
// window.currentUserRole is a read-only global from session.js (login session).
// There is no fallback role.

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
// Sidebar collapse / expand (same behaviour as the other modules)
// ============================================================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleIcon = document.getElementById("toggleIcon");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

let expanded = false;
function setSidebarExpanded(next) {
  expanded = next;
  sidebar.classList.toggle("expanded", expanded);
  sidebar.classList.toggle("collapsed", !expanded);
  toggleIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
  const isDrawerViewport = window.matchMedia("(max-width: 1023px)").matches;
  sidebarBackdrop.classList.toggle("visible", expanded && isDrawerViewport);
}
sidebarToggle.addEventListener("click", () => setSidebarExpanded(!expanded));
sidebarBackdrop.addEventListener("click", () => setSidebarExpanded(false));
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 1023px)").matches) sidebarBackdrop.classList.remove("visible");
});
document.querySelectorAll(".nav-list .nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 1023px)").matches) setSidebarExpanded(false);
  });
});

// ============================================================
// Settings state — filled from the API by loadSettings() (see Init).
// ============================================================
let settings = {
  branding: { logoDataUrl: "", name: "", address: "", phone: "", email: "", website: "" },
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

fldLogoUpload.addEventListener("change", () => {
  const file = fldLogoUpload.files && fldLogoUpload.files[0];
  if (!file) return;
  // Sent to the API as a data URL together with the branding payload on Save.
  const reader = new FileReader();
  reader.onload = () => {
    settings.branding.logoDataUrl = reader.result;
    setLogoPreview(reader.result);
    showToast("Logo preview updated — click Save Settings to keep it");
  };
  reader.readAsDataURL(file);
});

function fillBrandingForm() {
  const b = settings.branding;
  fldCompanyName.value = b.name || "";
  fldCompanyAddress.value = b.address || "";
  fldCompanyPhone.value = b.phone || "";
  fldCompanyEmail.value = b.email || "";
  fldCompanyWebsite.value = b.website || "";
  setLogoPreview(b.logoDataUrl || "");
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
      <td data-label="Applicable Capacity Range">${r.capMin} – ${r.capMax} kW</td>
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
      .catch((err) => showToast(err.message || "Could not delete subsidy rule"));
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
      <td data-label="GST %">${r.gstPercent}%</td>
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
      .catch((err) => showToast(err.message || "Could not delete GST rule"));
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

// FIX: the subsidy/GST rule fields used to sit inside a real <form> tag
// with no submit handler. Pressing Enter in any field there would let
// the browser submit the form and reload the page, silently wiping out
// every unsaved tab (branding, bank, defaults, etc). The .modal-body
// wrapper in settings.html is now a plain <div>, and this listener is a
// second line of defense: if a <form> ever ends up inside a modal again
// (e.g. future edit), Enter won't be able to trigger a page reload.
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

  const branding = {
    name: fldCompanyName.value.trim(),
    address: fldCompanyAddress.value.trim(),
    phone: fldCompanyPhone.value.trim(),
    email: fldCompanyEmail.value.trim(),
    website: fldCompanyWebsite.value.trim(),
    logoDataUrl: settings.branding.logoDataUrl || "",
  };
  const bank = {
    accountName: fldAccountName.value.trim(),
    bankName: fldBankName.value.trim(),
    accountNumber: fldAccountNumber.value.trim(),
    ifsc: fldIfsc.value.trim().toUpperCase(),
    branch: fldBranch.value.trim(),
  };
  const defaults = {
    terms: fldTerms.value,
    validityDays: parseInt(fldValidityDays.value, 10) || 0,
    prefix: (fldPrefix.value.trim() || "SQ").toUpperCase(),
  };

  saveBtn.disabled = true;
  try {
    await Promise.all([
      Session.api(`${SETTINGS_API}/branding`, { method: "PUT", body: branding }),
      Session.api(`${SETTINGS_API}/bank-details`, { method: "PUT", body: bank }),
      Session.api(`${SETTINGS_API}/quotation-defaults`, { method: "PUT", body: defaults }),
    ]);
    settings.branding = branding;
    settings.bank = bank;
    settings.defaults = defaults;
    showToast("Settings saved");
  } catch (err) {
    console.error("Settings save failed:", err);
    showToast(err.message || "Save failed — nothing was changed on the server");
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
  setTimeout(() => toast.remove(), 2500);
}

// ============================================================
// Topbar: notification + profile dropdowns
// ============================================================
const notifBtn = document.getElementById("notifBtn");
const notifDropdown = document.getElementById("notifDropdown");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

function closeAllTopbarDropdowns() {
  [notifDropdown, profileDropdown].forEach((dd) => dd && dd.classList.add("hidden"));
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

profileLogoutBtn?.addEventListener("click", () => Session.logout());

// ============================================================
// Init
// ============================================================
(async function initSettings() {
  if (!enforcePageAccess()) return;
  try {
    await loadSettings();
  } catch (err) {
    console.error("Settings load failed:", err);
    showToast(err.message || "Could not load settings from the server");
    // Forms stay empty: we never show made-up values as if they were saved settings.
  }
  fillBrandingForm();
  fillBankForm();
  fillDefaultsForm();
  renderSubsidyTable();
  renderGstTable();
})();