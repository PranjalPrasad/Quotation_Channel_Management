/* ============================================================================
 * shared/logger.js  -  window.AppLog   (load it BEFORE /session.js on every page)
 *
 *   AppLog.debug|info|warn|error(moduleName, message, data)   -> console: [PRODUCT][ERROR] message
 *   AppLog.for('PRODUCT')            -> { debug, info, warn, error } with the module already filled in
 *   AppLog.fetch(input, init)        -> fetch() that logs method, path, status, ms and X-Request-Id
 *   AppLog.http(info)                -> used by AppLog.fetch; call it yourself if you use XHR
 *   AppLog.recent()                  -> last 100 log entries (attach to a bug report)
 *
 * Level: info by default. localStorage.logLevel = 'debug' | 'info' | 'warn' | 'error'  (debug only when set).
 * Also captures window errors and unhandled promise rejections, and redacts tokens / passwords / emails / phones.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AppLog) return;

  var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
  var SLOW_MS = 1000;
  var MAX_STR = 500, MAX_KEYS = 30, MAX_ITEMS = 20, MAX_DEPTH = 4, BUFFER = 100;
  var buffer = [];
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  function minLevel() {
    try { return LEVELS[String(localStorage.getItem('logLevel') || '').toLowerCase()] || LEVELS.info; }
    catch (e) { return LEVELS.info; }
  }

  /* ---------------------------------------------------------------- redaction */
  var SECRET_KEY = /pass(word)?|pwd|secret|token|authorization|cookie|api[-_]?key|credential/i;
  var SHORT_SECRET_KEY = /^(otp|pin|cvv)$/i;
  var EMAIL_KEY = /e-?mail/i;
  var PHONE_KEY = /phone|mobile|whatsapp/i;
  var RE_JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
  var RE_BEARER = /Bearer\s+[\w.\-~+\/=]+/gi;
  var RE_EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

  function maskEmail(s) { return String(s).replace(RE_EMAIL, '$1***@$2'); }
  function maskPhone(s) { var d = String(s).replace(/\D/g, ''); return d.length < 5 ? '***' : '******' + d.slice(-4); }
  function cleanString(s) {
    s = String(s).replace(RE_JWT, '[JWT]').replace(RE_BEARER, 'Bearer [REDACTED]');
    s = maskEmail(s);
    return s.length > MAX_STR ? s.slice(0, MAX_STR) + '…(' + s.length + ' chars)' : s;
  }
  /** Path only: query strings can carry tokens or search text. */
  function cleanUrl(u) {
    var s = String(u || '').split('#')[0].split('?')[0];
    try { var x = new URL(s, location.href); return x.origin === location.origin ? x.pathname : x.origin + x.pathname; }
    catch (e) { return s; }
  }

  function sanitize(v, depth, seen) {
    if (v == null) return v;
    var t = typeof v;
    if (t === 'string') return cleanString(v);
    if (t === 'number' || t === 'boolean') return v;
    if (t === 'function') return '[function]';
    if (typeof FormData !== 'undefined' && v instanceof FormData) return '[FormData]';
    if (typeof Blob !== 'undefined' && v instanceof Blob) return '[Blob ' + (v.size || 0) + ' bytes]';
    if (v instanceof Error) return { name: v.name, message: cleanString(v.message), stack: cleanString(v.stack || '') };
    if (depth >= MAX_DEPTH) return '[depth limit]';
    if (seen.indexOf(v) !== -1) return '[circular]';
    seen.push(v);
    var out;
    if (Array.isArray(v)) {
      out = v.slice(0, MAX_ITEMS).map(function (x) { return sanitize(x, depth + 1, seen); });
      if (v.length > MAX_ITEMS) out.push('…+' + (v.length - MAX_ITEMS) + ' more');
    } else {
      out = {};
      Object.keys(v).slice(0, MAX_KEYS).forEach(function (k) {
        var val = v[k];
        if (SECRET_KEY.test(k) || SHORT_SECRET_KEY.test(k)) out[k] = '[REDACTED]';
        else if (EMAIL_KEY.test(k) && typeof val === 'string') out[k] = maskEmail(val.indexOf('@') > 0 ? val : val + '@x.xx').replace('@x.xx', '');
        else if (PHONE_KEY.test(k) && val != null && typeof val !== 'object') out[k] = maskPhone(val);
        else out[k] = sanitize(val, depth + 1, seen);
      });
    }
    seen.pop();
    return out;
  }

  /* ---------------------------------------------------------------- core */
  function emit(level, module, message, data) {
    var mod = String(module || 'APP').toUpperCase();
    var msg = cleanString(message == null ? '' : message);
    var clean = data === undefined ? undefined : sanitize(data, 0, []);
    buffer.push({ t: new Date().toISOString(), level: level, module: mod, message: msg, data: clean });
    if (buffer.length > BUFFER) buffer.shift();
    if (LEVELS[level] < minLevel()) return;
    var fn = console[level] || console.log;
    var line = '[' + mod + '][' + level.toUpperCase() + '] ' + msg;
    if (clean === undefined) fn.call(console, line); else fn.call(console, line, clean);
  }

  var AppLog = {
    debug: function (m, msg, d) { emit('debug', m, msg, d); },
    info: function (m, msg, d) { emit('info', m, msg, d); },
    warn: function (m, msg, d) { emit('warn', m, msg, d); },
    error: function (m, msg, d) { emit('error', m, msg, d); },
    for: function (m) {
      return {
        debug: function (msg, d) { emit('debug', m, msg, d); },
        info: function (msg, d) { emit('info', m, msg, d); },
        warn: function (msg, d) { emit('warn', m, msg, d); },
        error: function (msg, d) { emit('error', m, msg, d); }
      };
    },
    recent: function () { return buffer.slice(); },
    redact: function (v) { return sanitize(v, 0, []); }
  };

  /* ---------------------------------------------------------------- HTTP */
  var warnedExpose = false;
  /** info: { method, url, status (0 = network error), ms, requestId, errorCode, error } */
  AppLog.http = function (info) {
    var status = info.status || 0;
    var line = info.method + ' ' + cleanUrl(info.url) + ' -> ' + (status || 'NETWORK ERROR') + ' (' + info.ms + ' ms)';
    var data = {};
    if (info.requestId) data.requestId = info.requestId;
    if (info.errorCode) data.errorCode = info.errorCode;
    if (info.error) data.error = info.error;
    var d = Object.keys(data).length ? data : undefined;
    if (!status || status >= 500) emit('error', 'HTTP', line, d);
    else if (status === 401) emit('info', 'HTTP', line, d);          // expected: the client refreshes the token
    else if (status >= 400) emit('warn', 'HTTP', line, d);
    else if (info.ms > SLOW_MS) emit('warn', 'HTTP', line + ' SLOW', d);
    else emit('debug', 'HTTP', line, d);
  };

  AppLog.fetch = function (input, init) {
    if (!nativeFetch) return Promise.reject(new Error('fetch is not available'));
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var t0 = performance.now();
    function ms() { return Math.round(performance.now() - t0); }

    return nativeFetch(input, init).then(function (res) {
      var rid = res.headers.get('X-Request-Id');
      if (!rid && !warnedExpose && /^https?:/i.test(url) && new URL(url, location.href).origin !== location.origin) {
        warnedExpose = true;
        emit('warn', 'HTTP', 'X-Request-Id is not readable cross-origin: add it to the backend CORS exposed headers');
      }
      var base = { method: method, url: url, status: res.status, ms: ms(), requestId: rid };
      if (res.status >= 400) {
        // read errorCode / requestId from the JSON error body without consuming the caller's response
        res.clone().json().catch(function () { return null; }).then(function (b) {
          base.errorCode = b && b.errorCode;
          if (!base.requestId && b && b.requestId) base.requestId = b.requestId;
          AppLog.http(base);
        });
      } else {
        AppLog.http(base);
      }
      return res;
    }, function (err) {
      AppLog.http({ method: method, url: url, status: 0, ms: ms(), error: err && err.message });
      throw err;
    });
  };

  // Fallback so pages that load only logger.js still have a logged apiFetch. session.js replaces it
  // with the authenticated version, which itself calls AppLog.fetch.
  if (!window.apiFetch) window.apiFetch = AppLog.fetch;

  /* ---------------------------------------------------------------- global capture */
  window.addEventListener('error', function (ev) {
    var tgt = ev.target;
    if (tgt && tgt !== window && tgt.tagName) {                       // <img>/<script>/<link> failed to load
      emit('warn', 'RESOURCE', 'Failed to load <' + tgt.tagName.toLowerCase() + '> ' + cleanUrl(tgt.src || tgt.href));
      return;
    }
    emit('error', 'GLOBAL', ev.message || 'Uncaught error',
      { file: cleanUrl(ev.filename), line: ev.lineno, col: ev.colno, stack: ev.error && ev.error.stack });
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    emit('error', 'PROMISE', 'Unhandled promise rejection: ' + (r && r.message ? r.message : String(r)),
      r instanceof Error ? { stack: r.stack, requestId: r.requestId, errorCode: r.errorCode } : undefined);
  });

  window.AppLog = AppLog;
})();