// ============================================================
// Settings -> "GST Profile" tab.
// Loaded AFTER settings.js and /shared/gst-common.js. Uses Session.api (auth, refresh, 401 handling,
// ?viewPartnerId on GET only) and the global showToast() from settings.js.
//
// Backend contract (GstController):
//   GET /api/gst/profile   (GST_REPORTS:VIEW)   -> { id, legalName, tradeName, gstin, stateCode, stateName, registrationType,
//                                                    filingFrequency, aatoSlab, invoicePrefix, configured }
//                                                   (200 with defaults and configured=false when nothing is saved yet)
//   PUT /api/gst/profile   (GST_REPORTS:MANAGE) body { legalName, tradeName, gstin, stateCode, registrationType,
//                                                    filingFrequency, aatoSlab, invoicePrefix }
// The form field is still called "turnoverSlab" in the UI; it is sent / read as aatoSlab.
//
// Never sent: partnerId / viewPartnerId. Never logged: GSTIN, names, prefix (field NAMES only).
// ============================================================
(function () {
  "use strict";
  if (!document.getElementById("gstProfilePanel") || !window.GstCommon || !window.Session) return;

  const G = window.GstCommon;
  const log = G.logger("GST");
  const GST_PROFILE_API = "/api/gst/profile";

  // form control -> [payload field, error span id]
  const FIELD_MAP = {
    gstin: ["gpGstin", "errGpGstin"],
    stateCode: ["gpState", "errGpState"],
    legalName: ["gpLegalName", "errGpLegalName"],
    tradeName: ["gpTradeName", "errGpTradeName"],
    registrationType: ["gpRegType", "errGpRegType"],
    filingFrequency: ["gpFiling", "errGpFiling"],
    turnoverSlab: ["gpTurnover", "errGpTurnover"],
    invoicePrefix: ["gpPrefix", "errGpPrefix"],
  };
  // backend names we might receive for a field (e.g. "state" instead of "stateCode")
  const FIELD_ALIASES = { aatoSlab: "turnoverSlab", state: "stateCode", gstNo: "gstin", gstNumber: "gstin", prefix: "invoicePrefix", registration: "registrationType" };

  const $ = (id) => document.getElementById(id);
  const el = {
    tabBtn: $("gstProfileTabBtn"), status: $("gpStatus"), save: $("gpSaveBtn"), viewNote: $("gpViewNote"),
    loading: $("gpLoading"), loadError: $("gpLoadError"), loadErrorMsg: $("gpLoadErrorMsg"), retry: $("gpRetryBtn"),
    errorList: $("gpErrorList"), form: $("gpForm"), gstinHint: $("gpGstinHint"),
  };
  const input = (field) => $(FIELD_MAP[field][0]);

  const READ_ONLY = () => !!(Session.isViewMode && Session.isViewMode());
  let loaded = false;        // a successful load (or a 404 = not configured) happened
  let loading = false;
  let saving = false;
  let exists = false;        // a profile is stored on the server
  let baseline = "";         // serialised form right after load / save

  // ------------------------------------------------------------ populate selects
  function fillSelect(sel, pairs, placeholder) {
    sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
      pairs.map(([v, label]) => `<option value="${v}">${label}</option>`).join("");
  }
  fillSelect(input("stateCode"), G.STATES.map((s) => [s.code, `${s.name} (${s.code})`]), "Select state");
  fillSelect(input("registrationType"), G.REGISTRATION_TYPES);
  fillSelect(input("filingFrequency"), G.FILING_FREQUENCIES);
  fillSelect(input("turnoverSlab"), G.TURNOVER_SLABS);

  // ------------------------------------------------------------ read / write form
  function readForm() {
    return {
      gstin: G.normGstin(input("gstin").value),
      stateCode: input("stateCode").value,
      legalName: input("legalName").value.trim(),
      tradeName: input("tradeName").value.trim(),
      registrationType: input("registrationType").value,
      filingFrequency: input("filingFrequency").value,
      turnoverSlab: input("turnoverSlab").value,   // UI name; sent to the backend as aatoSlab (see toPayload)
      invoicePrefix: input("invoicePrefix").value.trim().toUpperCase(),
    };
  }
  /** Request body for PUT /api/gst/profile (backend field names). */
  function toPayload(p) {
    return {
      legalName: p.legalName, tradeName: p.tradeName, gstin: p.gstin || null, stateCode: p.stateCode,
      registrationType: p.registrationType, filingFrequency: p.filingFrequency,
      aatoSlab: p.turnoverSlab, invoicePrefix: p.invoicePrefix,
    };
  }
  function writeForm(p) {
    p = p || {};
    input("gstin").value = G.normGstin(p.gstin || p.gstNo || "");
    // tolerate a state NAME from the server as well as a code
    input("stateCode").value = G.stateCodeByName(p.stateCode != null ? p.stateCode : p.state) || "";
    input("legalName").value = p.legalName || "";
    input("tradeName").value = p.tradeName || "";
    input("registrationType").value = p.registrationType || G.REGISTRATION_TYPES[0][0];
    input("filingFrequency").value = p.filingFrequency || G.FILING_FREQUENCIES[0][0];
    input("turnoverSlab").value = p.aatoSlab || p.turnoverSlab || G.TURNOVER_SLABS[0][0];
    input("invoicePrefix").value = p.invoicePrefix || p.prefix || "";
  }
  const snapshot = () => JSON.stringify(readForm());
  const isDirty = () => loaded && snapshot() !== baseline;

  // ------------------------------------------------------------ status indicator
  function paintStatus() {
    let cls = "idle", text = "Not loaded";
    if (saving) { cls = "busy"; text = "Saving…"; }
    else if (loaded && isDirty()) { cls = "dirty"; text = "Unsaved changes"; }
    else if (loaded && exists) { cls = "saved"; text = "Saved"; }
    else if (loaded) { cls = "new"; text = "Not configured yet"; }
    el.status.className = `gp-status gp-status--${cls}`;
    el.status.textContent = text;
    el.save.disabled = READ_ONLY() || saving || !loaded || (exists && !isDirty());
  }

  // ------------------------------------------------------------ errors
  function clearErrors() {
    Object.keys(FIELD_MAP).forEach((f) => {
      const span = $(FIELD_MAP[f][1]); if (span) span.textContent = "";
      input(f).classList.remove("invalid");
    });
    el.errorList.classList.add("hidden");
    el.errorList.innerHTML = "";
  }
  function setFieldError(field, message) {
    const key = FIELD_MAP[field] ? field : FIELD_ALIASES[field];
    if (!key || !FIELD_MAP[key]) return false;
    const span = $(FIELD_MAP[key][1]); if (span) span.textContent = message;
    input(key).classList.add("invalid");
    return true;
  }
  function showErrorList(lines) {
    if (!lines.length) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    el.errorList.innerHTML = lines.length === 1 ? esc(lines[0]) : `Please fix the following:<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    el.errorList.classList.remove("hidden");
  }

  // ------------------------------------------------------------ validation (mirrors the usual backend rules)
  function validate(p) {
    clearErrors();
    const bad = [];
    const fail = (field, msg) => { setFieldError(field, msg); bad.push(field); };

    const gstinRequired = p.registrationType !== "UNREGISTERED";   // backend: GSTIN optional only for an unregistered business
    const gErr = G.gstinError(p.gstin, gstinRequired);
    if (gErr) fail("gstin", gErr);
    if (!p.stateCode) fail("stateCode", "Select the state.");
    else if (!gErr && p.gstin && G.stateCodeFromGstin(p.gstin) !== p.stateCode) {
      fail("stateCode", `State does not match the GSTIN (it starts with ${G.stateCodeFromGstin(p.gstin)} = ${G.stateNameByCode(G.stateCodeFromGstin(p.gstin))}).`);
    }
    if (!p.legalName) fail("legalName", "Legal name is required.");
    if (!p.registrationType) fail("registrationType", "Select a registration type.");
    if (!p.filingFrequency) fail("filingFrequency", "Select the return filing frequency.");
    if (!p.turnoverSlab) fail("turnoverSlab", "Select the turnover slab.");
    if (p.invoicePrefix && !/^[A-Z0-9]{1,4}$/.test(p.invoicePrefix)) fail("invoicePrefix", "Use 1 to 4 letters or digits.");

    if (bad.length) log.validation("GST profile", bad);
    return bad.length === 0;
  }

  // soft hints while typing (no blocking)
  function updateGstinHint() {
    const g = G.normGstin(input("gstin").value);
    const hint = el.gstinHint;
    hint.className = "field-note";
    if (!g) { hint.textContent = ""; return; }
    if (G.GSTIN_RE.test(g) && G.stateNameByCode(g.slice(0, 2))) {
      const bits = [`State: ${G.stateNameByCode(g.slice(0, 2))}`, `PAN: ${G.panFromGstin(g)}`];
      if (!G.gstinChecksumOk(g)) { bits.push("check digit does not match — please re-check the number"); hint.classList.add("gp-warn"); }
      hint.textContent = bits.join(" · ");
    } else hint.textContent = "";
  }

  // ------------------------------------------------------------ load
  function setView(which) {   // 'loading' | 'error' | 'form'
    el.loading.classList.toggle("hidden", which !== "loading");
    el.loadError.classList.toggle("hidden", which !== "error");
    el.form.classList.toggle("hidden", which !== "form");
  }

  async function load() {
    if (loading) return;
    loading = true; loaded = false; setView("loading"); paintStatus();
    try {
      const res = await Session.api(GST_PROFILE_API);
      const data = res && typeof res === "object" && "data" in res ? res.data : res;
      exists = !!(data && (data.configured === true || data.gstin || data.gstNo || data.legalName));
      writeForm(exists ? data : null);
    } catch (err) {
      if (err && err.status === 404) {            // not configured yet: empty form, not an error
        exists = false; writeForm(null);
      } else {
        log.apiFail("load GST profile", GST_PROFILE_API, err);
        el.loadErrorMsg.textContent = G.friendlyError(err, "the GST profile");
        setView("error"); loading = false; paintStatus();
        return;
      }
    }
    loaded = true; loading = false;
    baseline = snapshot();
    applyReadOnly();
    updateGstinHint();
    setView("form"); paintStatus();
  }

  function applyReadOnly() {
    const ro = READ_ONLY();
    el.viewNote.classList.toggle("hidden", !ro);
    Object.keys(FIELD_MAP).forEach((f) => { input(f).disabled = ro; });
    el.save.classList.toggle("hidden", ro);
  }

  // ------------------------------------------------------------ save
  async function save() {
    if (READ_ONLY() || saving) return;            // belt and braces: the button is also hidden
    const payload = readForm();                   // no partnerId / viewPartnerId, ever
    if (!validate(payload)) { showToast("Please fix the highlighted fields"); return; }

    saving = true; paintStatus();
    try {
      await Session.api(GST_PROFILE_API, { method: "PUT", body: toPayload(payload) });
      exists = true; baseline = snapshot();
      showToast("GST profile saved");
    } catch (err) {
      log.apiFail("save GST profile", GST_PROFILE_API, err);
      const fe = G.fieldErrors(err);
      const loose = [];
      fe.forEach((e) => { if (!setFieldError(e.field, e.message)) loose.push(e.message); });
      if (!fe.length) {                              // 401/403/404/409/5xx/network: one friendly sentence
        const msg = G.friendlyError(err, "the GST profile");
        showErrorList([msg]); showToast(msg);
      } else {                                       // 400/422: next to the field, leftovers in a list
        showErrorList(loose); showToast("Please fix the highlighted fields");
      }
    } finally {
      saving = false; paintStatus();
    }
  }

  // ------------------------------------------------------------ wiring
  function onEdit() {
    // typing clears the stale error of that one field
    paintStatus();
  }
  input("gstin").addEventListener("input", () => {
    const i = input("gstin"), pos = i.selectionStart;
    i.value = G.normGstin(i.value); try { i.setSelectionRange(pos, pos); } catch (_) {}
    const g = i.value;
    // convenience: an empty state follows the GSTIN prefix
    if (g.length >= 2 && !input("stateCode").value && G.stateNameByCode(g.slice(0, 2))) input("stateCode").value = g.slice(0, 2);
    updateGstinHint(); paintStatus();
  });
  input("invoicePrefix").addEventListener("input", () => { const i = input("invoicePrefix"); i.value = i.value.toUpperCase(); paintStatus(); });
  Object.keys(FIELD_MAP).forEach((f) => {
    ["input", "change"].forEach((evt) => input(f).addEventListener(evt, () => {
      input(f).classList.remove("invalid"); const s = $(FIELD_MAP[f][1]); if (s) s.textContent = "";
      onEdit();
    }));
  });
  el.save.addEventListener("click", save);
  el.retry.addEventListener("click", load);

  // The page header has a global "Save Settings" button for the other tabs; this tab has its own Save.
  const globalSave = $("saveSettingsBtn");
  document.querySelectorAll(".settings-tab").forEach((t) => t.addEventListener("click", () => {
    if (globalSave) globalSave.classList.toggle("gp-hide", t.dataset.tab === "gstprofile");
    if (t.dataset.tab === "gstprofile" && !loaded && !loading) load();
  }));
  const hideCss = document.createElement("style");
  hideCss.textContent = "#saveSettingsBtn.gp-hide{display:none !important}";
  document.head.appendChild(hideCss);

  // warn before leaving with unsaved GST changes
  window.addEventListener("beforeunload", (e) => { if (isDirty() && !READ_ONLY()) { e.preventDefault(); e.returnValue = ""; } });
  paintStatus();
})();