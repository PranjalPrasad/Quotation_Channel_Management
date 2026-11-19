/* =========================================================
   Solar Quotation System - File uploads (shared helper)
   Load AFTER session.js and BEFORE the page script:
       <script src="session.js"></script>
       <script src="files.js"></script>
       <script src="settings.js"></script>

   Why this exists: uploaded files are NOT public. They are served only by
       GET /api/files/{partnerId}/{folder}/{name}      (Bearer token, caller's own partner)
   and an <img src> cannot send a Bearer token, so images are fetched here with the token and shown as a blob URL.

   API
     FileApi.upload(file, "LOGO" | "USER_PHOTO") -> Promise<{ path, url, size, contentType }>
         Store `path` in the record (logoPath / photoPath). Rejects with an Error that has .status and .errorCode.
     FileApi.objectUrl(path)            -> Promise<string|null>   blob: URL for a stored path, null when unavailable
     FileApi.setImage(imgEl, path, onEmpty) -> shows the stored image in <img>, or calls onEmpty() when there is none
     FileApi.MAX_BYTES, FileApi.ALLOWED_TYPES   (client-side pre-check only; the server decides)

   Logging (AppLog, Module 0): every failure is logged as "[FILE] ..." with purpose, size, HTTP status, error code and
   the server requestId. NEVER the file name, the file contents or the stored path.
   ========================================================= */

(function () {
    'use strict';

    const LOG_TAG = '[FILE]';
    const MAX_BYTES = 2 * 1024 * 1024;                       // same as the server default (app.file.max-bytes)
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    const PURPOSES = ['LOGO', 'USER_PHOTO'];
    // only server-made references are ever fetched: /files/{partnerId}/{branding|users}/{uuid}.{png|jpg|webp}
    const STORED_PATH = /^\/files\/([1-9]\d{0,17})\/(branding|users)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp))$/;

    function applog(level, message, context) {
        try {
            const L = window.AppLog;
            if (L && typeof L[level] === 'function') { L[level](LOG_TAG + ' ' + message, context); return; }
        } catch (_) { /* logging must never break the screen */ }
        const c = console[level] || console.log;
        c.call(console, LOG_TAG, message, context === undefined ? '' : context);
    }

    function apiBase() {
        return String(window.API_BASE || '').replace(/\/+$/, '');
    }

    // ASSUMPTION: session.js keeps the access token where settings.js already looks for it (Session.getSession() or
    // sessionStorage "sqms_session"). If session.js exposes Session.getToken(), that wins.
    function accessToken() {
        try {
            const S = window.Session;
            if (S && typeof S.getToken === 'function') { const t = S.getToken(); if (t) return t; }
            const sources = [];
            if (S && typeof S.getSession === 'function') sources.push(S.getSession());
            const raw = sessionStorage.getItem('sqms_session');
            if (raw) sources.push(JSON.parse(raw));
            for (const s of sources.filter(Boolean)) {
                const t = s.token || s.accessToken || (s.data && (s.data.token || s.data.accessToken));
                if (t) return t;
            }
        } catch (_) { /* fall through */ }
        return '';
    }

    function fail(message, status, errorCode, requestId) {
        const err = new Error(message);
        err.status = status;
        err.errorCode = errorCode;
        err.requestId = requestId || '';
        return err;
    }

    /** fetch with the Bearer token; on 401 lets session.js refresh the token (one cheap call) and retries once. */
    async function authFetch(path, options, retried) {
        const headers = Object.assign({}, options && options.headers, { Authorization: 'Bearer ' + accessToken() });
        const res = await fetch(apiBase() + path, Object.assign({}, options, { headers }));
        if (res.status === 401 && !retried && window.Session && typeof Session.api === 'function') {
            try { await Session.api('/api/auth/me'); } catch (_) { /* session.js handles a dead session itself */ }
            return authFetch(path, options, true);
        }
        return res;
    }

    async function errorFromResponse(res) {
        let body = null;
        try { body = await res.json(); } catch (_) { /* not JSON */ }
        const msg = (body && body.message) || (res.status === 413 ? 'The image is too large' : 'Request failed (' + res.status + ')');
        return fail(msg, res.status, body && body.errorCode, body && body.requestId);
    }

    // ---------------------------------------------------
    // Upload
    // ---------------------------------------------------
    async function upload(file, purpose) {
        const p = String(purpose || '').toUpperCase();
        const size = file ? file.size : 0;
        const ctx = { purpose: PURPOSES.includes(p) ? p : '-', size };

        // Quick checks for a friendly message without a round trip. The server repeats every one of them.
        let early = null;
        if (!file) early = fail('Please choose a file', 0, 'VALIDATION_ERROR');
        else if (!PURPOSES.includes(p)) early = fail('Unknown upload purpose', 0, 'VALIDATION_ERROR');
        else if (size > MAX_BYTES) early = fail('The image is too large (maximum ' + (MAX_BYTES / 1024 / 1024) + ' MB)', 0, 'FILE_TOO_LARGE');
        else if (file.type && !ALLOWED_TYPES.includes(file.type)) early = fail('Only PNG, JPG and WEBP images are allowed', 0, 'VALIDATION_ERROR');
        if (early) {
            applog('warn', 'upload rejected in the browser', Object.assign({ code: early.errorCode }, ctx));
            throw early;
        }

        const form = new FormData();
        form.append('file', file);
        form.append('purpose', p);
        try {
            const res = await authFetch('/api/files/upload', { method: 'POST', body: form });   // no Content-Type: the browser adds the boundary
            if (!res.ok) throw await errorFromResponse(res);
            const body = await res.json();
            const data = body && body.data !== undefined ? body.data : body;
            if (!data || !data.path) throw fail('The server did not return a file reference', res.status, 'BAD_RESPONSE');
            applog('info', 'upload ok', ctx);
            return data;
        } catch (err) {
            if (err && err.status === undefined) err = fail('Could not reach the server. Check your connection and try again.', 0, 'NETWORK');
            applog('error', 'upload failed', Object.assign({ status: err.status, code: err.errorCode, requestId: err.requestId || null }, ctx));
            throw err;
        }
    }

    // ---------------------------------------------------
    // Show a stored image (blob URL, cached per path)
    // ---------------------------------------------------
    const cache = new Map();   // stored path -> Promise<string|null>

    function objectUrl(path) {
        const m = typeof path === 'string' ? STORED_PATH.exec(path.trim()) : null;
        if (!m) {
            // empty is normal (no file yet). An old-style or foreign value cannot be fetched and is never requested.
            if (path) applog('warn', 'stored reference is not in the current format; upload the file again', {});
            return Promise.resolve(null);
        }
        const key = m[0];
        if (!cache.has(key)) {
            cache.set(key, (async () => {
                const res = await authFetch('/api/files/' + m[1] + '/' + m[2] + '/' + m[3], { method: 'GET' });
                if (!res.ok) throw await errorFromResponse(res);
                return URL.createObjectURL(await res.blob());
            })().catch((err) => {
                cache.delete(key);                                    // allow a retry later
                applog('warn', 'load failed', { folder: m[2], status: err && err.status, code: err && err.errorCode, requestId: (err && err.requestId) || null });
                return null;
            }));
        }
        return cache.get(key);
    }

    async function setImage(img, path, onEmpty) {
        if (!img) return;
        img.dataset.filePath = path || '';
        const url = await objectUrl(path);
        if (img.dataset.filePath !== (path || '')) return;            // a newer path was requested meanwhile
        if (url) { img.src = url; img.style.display = ''; }
        else { img.removeAttribute('src'); if (typeof onEmpty === 'function') onEmpty(); }
    }

    window.FileApi = { upload, objectUrl, setImage, MAX_BYTES, ALLOWED_TYPES };
})();
