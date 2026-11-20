/* ============================================================================
 * shared/gst-common.js  -  window.GstCommon      (load AFTER /shared/logger.js and /session.js)
 *
 * Pure helpers shared by Settings, Customer, Product and (later) the GST pages:
 *   - GSTIN / HSN / pincode validation that mirrors the usual backend rules
 *   - GST state codes, UQC list, rate slabs, B2B / B2C classification
 *   - error mapping (400/422 field errors, 401/403/404/409) and AppLog helpers
 *
 * Nothing here talks to the backend, so it is safe to unit-test in plain Node
 * (module.exports at the bottom).
 *
 * LOGGING RULE: log lines carry the tag, endpoint, HTTP status and X-Request-Id only.
 * Never pass a GSTIN, an amount, a customer name or a token to the logger.
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------ state codes */
  // Official GST state / UT codes. 25 and 28 were retired (Daman & Diu merged into 26; old Andhra Pradesh code).
  var STATES = [
    ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
    ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
    ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'],
    ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
    ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
    ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
    ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
    ['35', 'Andaman & Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
    ['97', 'Other Territory']
  ].map(function (s) { return { code: s[0], name: s[1] }; });

  var STATE_ALIASES = { 'orissa': '21', 'pondicherry': '34', 'jammu and kashmir': '01', 'j&k': '01',
    'andaman and nicobar islands': '35', 'dadra and nagar haveli': '26', 'daman and diu': '26',
    'dadra & nagar haveli': '26', 'daman & diu': '26', 'new delhi': '07', 'uttaranchal': '05', 'chattisgarh': '22' };

  function normName(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }

  function stateNameByCode(code) {
    var c = String(code == null ? '' : code).trim();
    for (var i = 0; i < STATES.length; i++) if (STATES[i].code === c) return STATES[i].name;
    return '';
  }
  /** Accepts a state name (any case, common aliases) OR a 2-digit code. Returns the 2-digit code or ''. */
  function stateCodeByName(nameOrCode) {
    var n = normName(nameOrCode);
    if (!n) return '';
    if (/^\d{1,2}$/.test(n)) { var c = ('0' + n).slice(-2); return stateNameByCode(c) ? c : ''; }
    if (STATE_ALIASES[n]) return STATE_ALIASES[n];
    for (var i = 0; i < STATES.length; i++) if (normName(STATES[i].name) === n) return STATES[i].code;
    return '';
  }

  /* ------------------------------------------------------------------ GSTIN */
  // 2 digits state, 10 chars PAN, 1 entity number, 'Z', 1 checksum char.
  var GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  var PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  function normGstin(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }

  /** Format + known state code. This is what the backend validates; the checksum is a separate, soft check. */
  function isValidGstin(v) {
    var g = normGstin(v);
    return GSTIN_RE.test(g) && !!stateNameByCode(g.slice(0, 2));
  }
  function stateCodeFromGstin(v) { var g = normGstin(v); return g.length >= 2 ? g.slice(0, 2) : ''; }
  function panFromGstin(v) { var g = normGstin(v); return g.length >= 12 ? g.slice(2, 12) : ''; }

  /** Official mod-36 check digit. Used only as a WARNING: test GSTINs often fail it and the server may still accept them. */
  function gstinChecksumOk(v) {
    var g = normGstin(v);
    if (!GSTIN_RE.test(g)) return false;
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var sum = 0;
    for (var i = 0; i < 14; i++) {
      var val = chars.indexOf(g.charAt(i)) * (i % 2 === 0 ? 1 : 2);
      sum += Math.floor(val / 36) + (val % 36);
    }
    return chars.charAt((36 - (sum % 36)) % 36) === g.charAt(14);
  }

  /** Message for a bad GSTIN, or '' when OK / empty. required=true makes an empty value an error too. */
  function gstinError(v, required) {
    var g = normGstin(v);
    if (!g) return required ? 'GSTIN is required.' : '';
    if (g.length !== 15) return 'GSTIN must be 15 characters.';
    if (!GSTIN_RE.test(g)) return 'GSTIN format is not valid (e.g. 27ABCDE1234F1Z5).';
    if (!stateNameByCode(g.slice(0, 2))) return 'GSTIN starts with an unknown state code.';
    return '';
  }

  /** B2B when the customer has a valid GSTIN, otherwise B2C. Derived on the client; no extra backend field is assumed. */
  function customerTaxType(gstin) { return isValidGstin(gstin) ? 'B2B' : 'B2C'; }

  /* -------------------------------------------------------------- HSN / UQC */
  function isValidHsn(v) { return /^(\d{4}|\d{6}|\d{8})$/.test(String(v == null ? '' : v).trim()); }
  function hsnError(v, required) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return required ? 'HSN code is required.' : '';
    return isValidHsn(s) ? '' : 'HSN must be 4, 6 or 8 digits.';
  }

  // Unit Quantity Codes (subset used for solar / electrical goods).
  var UQC = [
    ['NOS', 'NOS - Numbers'], ['SET', 'SET - Sets'], ['MTR', 'MTR - Metres'], ['BOX', 'BOX - Box'],
    ['PCS', 'PCS - Pieces'], ['KGS', 'KGS - Kilograms'], ['LTR', 'LTR - Litres'], ['SQM', 'SQM - Square metres'],
    ['KWH', 'KWH - Kilowatt hour'], ['UNT', 'UNT - Units'], ['OTH', 'OTH - Others']
  ].map(function (u) { return { code: u[0], label: u[1] }; });
  var UNIT_TO_UQC = { nos: 'NOS', no: 'NOS', set: 'SET', meter: 'MTR', metre: 'MTR', box: 'BOX', pcs: 'PCS', piece: 'PCS', kg: 'KGS' };
  function uqcForUnit(unit) { return UNIT_TO_UQC[normName(unit)] || 'OTH'; }

  /* ------------------------------------------------------------------ rates */
  // Slabs in force since 22 Sep 2025 (GST 2.0). 12% and 28% were withdrawn but still exist on older records,
  // so rateOptions() keeps a legacy slab selectable only when the record being edited already has it.
  var RATES = [0, 5, 18, 40];
  var LEGACY_RATES = [12, 28];
  function rateOptions(current) {
    var list = RATES.slice();
    var c = Number(current);
    if (current !== '' && current != null && isFinite(c) && list.indexOf(c) === -1) list.push(c);
    return list.sort(function (a, b) { return a - b; });
  }
  function isLegacyRate(r) { return LEGACY_RATES.indexOf(Number(r)) !== -1; }
  function cessError(v) {
    if (v === '' || v == null) return '';
    var n = Number(v);
    if (!isFinite(n) || n < 0 || n > 400) return 'Cess must be between 0 and 400.';
    return '';
  }

  /* ------------------------------------------------------- GST profile enums */
  // Values must match the backend enums (RegistrationType, FilingFrequency, AatoSlab)
  var REGISTRATION_TYPES = [['REGULAR', 'Regular'], ['COMPOSITION', 'Composition'], ['UNREGISTERED', 'Unregistered']];
  var FILING_FREQUENCIES = [['MONTHLY', 'Monthly'], ['QRMP', 'Quarterly (QRMP)']];
  var TURNOVER_SLABS = [['UP_TO_5CR', 'Up to ₹5 crore'], ['ABOVE_5CR', 'Above ₹5 crore']];

  /* ------------------------------------------------------------------ money */
  /** Indian grouping (12,34,567.50). Never used to recompute taxes - display only. */
  function formatINR(n, decimals) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('en-IN', { minimumFractionDigits: decimals == null ? 2 : decimals,
      maximumFractionDigits: decimals == null ? 2 : decimals });
  }

  /* --------------------------------------------------------- errors + logging */
  /** Backend field errors come as err.errors = [{ field | fieldName | path, message | defaultMessage }]. */
  function fieldErrors(err) {
    var list = (err && Array.isArray(err.errors)) ? err.errors : (err && Array.isArray(err.fieldErrors) ? err.fieldErrors : []);
    return list.map(function (x) {
      return { field: x.field || x.fieldName || x.path || '', message: x.message || x.defaultMessage || '' };
    }).filter(function (x) { return x.message; });
  }

  /**
   * One friendly sentence per status. `what` is a short noun phrase ("the GST profile").
   * 409 names the period when the server sends one (err.period, or inside the message).
   */
  function friendlyError(err, what) {
    var s = err && err.status;
    var w = what || 'this record';
    if (s === 400 || s === 422) return (err.message || 'Please correct the highlighted fields.');
    if (s === 401) return 'Your session has expired. Please sign in again.';
    if (s === 403) return 'You do not have permission to access ' + w + '.';
    if (s === 404) return 'Could not find ' + w + '. It may have been deleted or never created.';
    if (s === 409) {
      var p = err.period || (err.details && err.details.period) || '';
      var locked = /lock/i.test(String((err.errorCode || '') + ' ' + (err.message || '')));
      if (locked) return 'This period' + (p ? ' (' + p + ')' : '') + ' is locked for GST filing, so it cannot be changed.';
      return err.message || 'This record was changed by someone else. Reload and try again.';
    }
    if (s === 0 || s == null) return 'Cannot reach the server. Check your connection and try again.';
    return (err && err.message) || 'Something went wrong. Please try again.';
  }

  /** AppLog wrapper with the right signature (module, message, data). Context is whitelisted. */
  function logger(tag) {
    var T = String(tag || 'GST').replace(/[\[\]]/g, '');
    function emit(level, msg, ctx) {
      try {
        var L = root.AppLog;
        if (L && typeof L[level] === 'function') { L[level](T, msg, ctx); return; }
      } catch (_) { /* logging must never break the page */ }
      var c = root.console; if (c) (c[level] || c.log).call(c, '[' + T + '] ' + msg, ctx || '');
    }
    return {
      debug: function (m, c) { emit('debug', m, c); },
      info: function (m, c) { emit('info', m, c); },
      warn: function (m, c) { emit('warn', m, c); },
      error: function (m, c) { emit('error', m, c); },
      /** Failed API call: endpoint, status, X-Request-Id. 4xx permission/validation outcomes are WARN. */
      apiFail: function (action, endpoint, err) {
        var s = err && err.status;
        emit(s && s < 500 && s !== 401 ? 'warn' : 'error', action + ' failed', {
          endpoint: String(endpoint || '').split('?')[0], status: s == null ? null : s,
          code: (err && err.errorCode) || null, requestId: (err && err.requestId) || null
        });
      },
      /** Client-side validation failure: field NAMES only, never values. */
      validation: function (form, fields) { emit('warn', form + ' validation failed', { fields: (fields || []).slice(0, 20) }); }
    };
  }

  var api = {
    STATES: STATES, stateNameByCode: stateNameByCode, stateCodeByName: stateCodeByName,
    GSTIN_RE: GSTIN_RE, PAN_RE: PAN_RE, normGstin: normGstin, isValidGstin: isValidGstin, gstinError: gstinError,
    gstinChecksumOk: gstinChecksumOk, stateCodeFromGstin: stateCodeFromGstin, panFromGstin: panFromGstin,
    customerTaxType: customerTaxType,
    isValidHsn: isValidHsn, hsnError: hsnError, UQC: UQC, uqcForUnit: uqcForUnit,
    RATES: RATES, rateOptions: rateOptions, isLegacyRate: isLegacyRate, cessError: cessError,
    REGISTRATION_TYPES: REGISTRATION_TYPES, FILING_FREQUENCIES: FILING_FREQUENCIES, TURNOVER_SLABS: TURNOVER_SLABS,
    formatINR: formatINR, fieldErrors: fieldErrors, friendlyError: friendlyError, logger: logger
  };

  root.GstCommon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);