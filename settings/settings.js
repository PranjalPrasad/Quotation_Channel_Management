// ============================================================
// Settings — Super Admin only. All data is mock / localStorage-backed
// for now; "Save Settings" persists to localStorage and shows a toast.
// TODO: replace with real endpoints once backend is ready:
//   GET/PUT /api/settings/branding
//   GET/PUT /api/settings/bank-details
//   GET/PUT /api/settings/quotation-defaults
//   GET/POST/PUT/DELETE /api/settings/subsidy-rules
//   GET/POST/PUT/DELETE /api/settings/gst-rules
// ============================================================

const STORAGE_KEY = "sqms_settings_mock";

// ============================================================
// Safe storage wrapper — localStorage isn't always available
// (blocked cookies/storage, sandboxed preview iframes, private
// browsing on some browsers, file:// origins, etc). Previously a
// failed write was silently swallowed and the UI still showed
// "Settings saved" — that's what made saves look like they were
// failing. Now: real success/failure is reported, and if
// localStorage genuinely isn't available we still keep the data
// in memory so the page behaves correctly for the rest of the
// session instead of silently discarding what was typed.
// ============================================================
let inMemoryFallback = null;

function isLocalStorageAvailable() {
  try {
    const testKey = "__sqms_ls_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
const localStorageAvailable = isLocalStorageAvailable();

function safeSaveSettings(data) {
  const json = JSON.stringify(data);
  if (!localStorageAvailable) {
    inMemoryFallback = json;
    return { ok: true, persisted: false };
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true, persisted: true };
  } catch (e) {
    // Most common real-world cause: the logo image (base64) pushed the
    // payload past the ~5MB localStorage quota.
    console.error("Settings save failed:", e);
    inMemoryFallback = json; // still keep it for this session
    return { ok: false, persisted: false, error: e };
  }
}

function safeLoadSettings() {
  if (!localStorageAvailable) return inMemoryFallback;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error("Settings load failed:", e);
    return inMemoryFallback;
  }
}

// ============================================================
// Role guard — Settings is Super Admin only. The sidebar item is
// hidden for other roles via data-role, but we also hard-guard the
// page body in case someone opens the URL directly.
// ============================================================
window.currentUserRole = window.currentUserRole || "SUPER_ADMIN"; // fallback for local testing

function applyRoleBasedVisibility() {
  const userRole = window.currentUserRole || "SUPER_ADMIN";
  document.querySelectorAll("[data-role]").forEach((el) => {
    const roles = el.getAttribute("data-role").split(",").map((r) => r.trim());
    el.style.display = roles.includes(userRole) ? "" : "none";
  });
}
applyRoleBasedVisibility();
window.addEventListener("DOMContentLoaded", applyRoleBasedVisibility);

function enforcePageAccess() {
  const isSuperAdmin = (window.currentUserRole || "SUPER_ADMIN") === "SUPER_ADMIN";
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
// Mock default settings (used the first time, before anything is saved)
// ============================================================
const defaultSettings = {
  branding: {
    logoDataUrl: "",
    name: "Solar Quotation Management Pvt. Ltd.",
    address: "4th Floor, Highland Park, Pune, Maharashtra 411001",
    phone: "+91 98765 43210",
    email: "info@sqms.example",
    website: "www.sqms.example",
  },
  bank: {
    accountName: "Solar Quotation Management Pvt. Ltd.",
    bankName: "HDFC Bank",
    accountNumber: "50100234567890",
    ifsc: "HDFC0001234",
    branch: "Highland Park, Pune",
  },
  defaults: {
    terms: "1. Prices are inclusive of installation & commissioning.\n2. 50% advance required to confirm the order.\n3. Subsidy amount subject to government approval & disbursal timelines.\n4. Warranty as per manufacturer terms.",
    validityDays: 15,
    prefix: "SQ",
  },
  subsidyRules: [
    { id: "SUB-001", type: "Central Financial Assistance", category: "Residential", valueType: "percentage", value: 40, capMin: 0, capMax: 3 },
    { id: "SUB-002", type: "Central Financial Assistance", category: "Residential", valueType: "percentage", value: 20, capMin: 3, capMax: 10 },
    { id: "SUB-003", type: "State Solar Incentive", category: "Commercial", valueType: "amount", value: 50000, capMin: 10, capMax: 50 },
  ],
  gstRules: [
    { id: "GST-001", category: "Solar Panels", gstPercent: 12, applicableOn: "Product" },
    { id: "GST-002", category: "Inverters", gstPercent: 12, applicableOn: "Product" },
    { id: "GST-003", category: "Installation & Commissioning", gstPercent: 18, applicableOn: "Service" },
  ],
};

function loadSettings() {
  const raw = safeLoadSettings();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Saved settings were corrupted, falling back to defaults:", e);
    }
  }
  return JSON.parse(JSON.stringify(defaultSettings));
}

let settings = loadSettings();

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
  // UI-only preview — nothing is uploaded anywhere yet, wiring is pending backend.
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
    <tr data-id="${r.id}">
      <td data-label="Subsidy Type" class="font-medium">${r.type}</td>
      <td data-label="Category"><span class="pill ${r.category === "Residential" ? "pill-residential" : "pill-commercial"}">${r.category}</span></td>
      <td data-label="Percentage / Amount">${formatSubsidyValue(r)}</td>
      <td data-label="Applicable Capacity Range">${r.capMin} – ${r.capMax} kW</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="action-icon-btn icon-edit" data-action="editSubsidy" data-id="${r.id}" title="Edit">${ICON_EDIT}</button>
          <button class="action-icon-btn icon-delete" data-action="deleteSubsidy" data-id="${r.id}" title="Delete">${ICON_DELETE}</button>
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
    settings.subsidyRules = settings.subsidyRules.filter((r) => r.id !== id);
    renderSubsidyTable();
    showToast("Subsidy rule removed — click Save Settings to keep this change");
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
  const r = id ? settings.subsidyRules.find((x) => x.id === id) : null;
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

document.getElementById("subsidySaveBtn").addEventListener("click", () => {
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
  if (editingSubsidyId) {
    Object.assign(settings.subsidyRules.find((r) => r.id === editingSubsidyId), payload);
  } else {
    const newId = `SUB-${String(settings.subsidyRules.length + 1).padStart(3, "0")}`;
    settings.subsidyRules.push({ id: newId, ...payload });
  }
  renderSubsidyTable();
  closeModalById("subsidyModal");
  showToast("Subsidy rule saved — click Save Settings to keep this change");
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
    <tr data-id="${r.id}">
      <td data-label="Category" class="font-medium">${r.category}</td>
      <td data-label="GST %">${r.gstPercent}%</td>
      <td data-label="Applicable On"><span class="pill ${r.applicableOn === "Product" ? "pill-product" : "pill-service"}">${r.applicableOn}</span></td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="action-icon-btn icon-edit" data-action="editGst" data-id="${r.id}" title="Edit">${ICON_EDIT}</button>
          <button class="action-icon-btn icon-delete" data-action="deleteGst" data-id="${r.id}" title="Delete">${ICON_DELETE}</button>
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
    settings.gstRules = settings.gstRules.filter((r) => r.id !== id);
    renderGstTable();
    showToast("GST rule removed — click Save Settings to keep this change");
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
  const r = id ? settings.gstRules.find((x) => x.id === id) : null;
  gstModalTitle.textContent = r ? "Edit GST Rule" : "Add GST Rule";
  gfCategory.value = r ? r.category : "";
  gfPercent.value = r ? r.gstPercent : "";
  gfApplicableOn.value = r ? r.applicableOn : "Product";
  gstModal.classList.remove("hidden");
}

document.getElementById("addGstBtn").addEventListener("click", () => openGstModal(null));

document.getElementById("gstSaveBtn").addEventListener("click", () => {
  if (!gfCategory.value.trim() || gfPercent.value === "") {
    showToast("Category and GST % are required");
    return;
  }
  const payload = {
    category: gfCategory.value.trim(),
    gstPercent: parseFloat(gfPercent.value) || 0,
    applicableOn: gfApplicableOn.value,
  };
  if (editingGstId) {
    Object.assign(settings.gstRules.find((r) => r.id === editingGstId), payload);
  } else {
    const newId = `GST-${String(settings.gstRules.length + 1).padStart(3, "0")}`;
    settings.gstRules.push({ id: newId, ...payload });
  }
  renderGstTable();
  closeModalById("gstModal");
  showToast("GST rule saved — click Save Settings to keep this change");
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
// Save Settings (mock) — collects every tab's current field values
// into `settings` and writes to localStorage.
// ============================================================
document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  settings.branding.name = fldCompanyName.value.trim();
  settings.branding.address = fldCompanyAddress.value.trim();
  settings.branding.phone = fldCompanyPhone.value.trim();
  settings.branding.email = fldCompanyEmail.value.trim();
  settings.branding.website = fldCompanyWebsite.value.trim();

  settings.bank.accountName = fldAccountName.value.trim();
  settings.bank.bankName = fldBankName.value.trim();
  settings.bank.accountNumber = fldAccountNumber.value.trim();
  settings.bank.ifsc = fldIfsc.value.trim().toUpperCase();
  settings.bank.branch = fldBranch.value.trim();

  settings.defaults.terms = fldTerms.value;
  settings.defaults.validityDays = parseInt(fldValidityDays.value, 10) || 0;
  settings.defaults.prefix = (fldPrefix.value.trim() || "SQ").toUpperCase();

  const result = safeSaveSettings(settings);

  if (result.ok && result.persisted) {
    showToast("Settings saved (mock)");
  } else if (result.ok && !result.persisted) {
    // Saved for this session only — browser storage isn't available here
    // (e.g. a sandboxed preview or file:// origin). Values will hold
    // until the page is closed, but won't survive a reload.
    showToast("Settings saved for this session (browser storage isn't available here)");
  } else {
    // Real failure — most likely the logo image pushed the payload over
    // the ~5MB localStorage limit.
    const reason = settings.branding.logoDataUrl
      ? "Save failed — the logo image is too large for local storage. Try a smaller logo file."
      : "Save failed — check the browser console for details.";
    showToast(reason);
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

profileLogoutBtn?.addEventListener("click", () => {
  showToast("Logged out");
  window.location.href = "../index.html";
});

// ============================================================
// Init
// ============================================================
if (enforcePageAccess()) {
  fillBrandingForm();
  fillBankForm();
  fillDefaultsForm();
  renderSubsidyTable();
  renderGstTable();
}