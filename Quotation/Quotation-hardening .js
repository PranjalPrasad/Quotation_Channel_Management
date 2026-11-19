// ============================================================
// Quotation — tenant / logging / export hardening. Loaded AFTER quotation.js (see quotation.html):
//   <script src="/Quotation/quotation.js"></script>
//   <script src="/Quotation/quotation-hardening.js"></script>
//
//   1. view-partner READ-ONLY mode (Super Admin looking at one partner with ?viewPartnerId=)
//   2. Super Admin has no "channel partner" picker any more: every user creates under their OWN tenant
//   3. AppLog entries (with requestId) for calculation, save and export errors
//   4. CSV / Excel / PDF list export: formula-injection safe, capped, errors logged
//   5. a visible notice when the list is capped (the old loop silently stopped after 50 pages)
//
// This file only uses what quotation.js already defines (function declarations are replaced, objects are patched), so
// quotation.js itself is not edited. ASSUMPTIONS (session.js / AppLog are not part of the files I was given):
//   - Session.api(url, {method, body}) is a writable property, throws an Error with .status on failure, and puts the
//     server's requestId on the error as .requestId (the API sends it in the body and in the X-Request-Id header);
//   - window.AppLog.error(message, context) / .warn(...) exists (Module 0). If it does not, console is used.
//   - a view of another partner is requested with ?viewPartnerId=<id> in the page URL (or Session.getViewPartnerId()).
// ============================================================
(function () {
    'use strict';

    /* ------------------------------------------------------------------ AppLog */
    const EXPORT_CAP = 5000;      // rows in one client-side export
    const LIST_MAX_PAGES = 50;    // same limit quotation.js had: 50 pages x 100 rows
    let listTruncated = false;

    function localRequestId() {
        return 'c-' + Math.random().toString(36).slice(2, 10);
    }
    function requestIdOf(err) {
        if (!err) return localRequestId();
        const fromHeaders = err.headers && typeof err.headers.get === 'function' ? err.headers.get('X-Request-Id') : null;
        return err.requestId || err.requestID || (err.data && err.data.requestId) || (err.body && err.body.requestId)
            || (err.response && err.response.requestId) || fromHeaders || localRequestId();
    }
    /** Context values must be ids, counts and numbers only: never names, mobiles, e-mails, addresses, terms or bank data. */
    function appLog(level, event, ctx) {
        const entry = Object.assign({ event: event }, ctx || {});
        try {
            if (window.AppLog && typeof window.AppLog[level] === 'function') {
                window.AppLog[level]('[QUOTATION] ' + event, entry);
            } else {
                (console[level] || console.error).call(console, '[QUOTATION] ' + event, entry);
            }
        } catch (_) { /* logging must never break the page */ }
    }
    function appLogError(event, err, ctx) {
        appLog('error', event, Object.assign({
            requestId: requestIdOf(err),
            status: err && err.status,
            code: err && err.code,
            reason: err && err.message ? String(err.message).slice(0, 200) : undefined
        }, ctx || {}));
    }
    /** Numbers only: what the calculation was working with when it failed. */
    function calcContext() {
        const ctx = { step: typeof currentStep === 'number' ? currentStep : undefined };
        try { ctx.sizeKw = getSelectedSizeKw(); } catch (_) { /* ignore */ }
        try { ctx.itemCount = wizardItems.length; ctx.itemsSubtotal = itemsSubtotal(wizardItems); } catch (_) { /* ignore */ }
        try {
            ctx.gstPercent = parseFloat(document.getElementById('f-gstPercent').value);
            ctx.discountType = document.getElementById('f-discountType').value;
            ctx.discountValue = parseFloat(document.getElementById('f-discountValue').value);
        } catch (_) { /* ignore */ }
        return ctx;
    }

    /* ------------------------------------------------------------------ who / which partner */
    function realSuperAdmin() {
        return String(window.currentUserRole || '').toUpperCase() === 'SUPER_ADMIN';
    }
    function getViewPartnerId() {
        try {
            if (window.Session && typeof Session.getViewPartnerId === 'function') {
                const v = Session.getViewPartnerId();
                if (v) return String(v);
            }
            const q = new URLSearchParams(window.location.search).get('viewPartnerId');
            return q && /^\d+$/.test(q) ? q : null;
        } catch (_) { return null; }
    }
    /** Read-only mode: a view is requested AND the user is Super Admin (the server ignores the view for anybody else). */
    function viewMode() {
        return !!getViewPartnerId() && realSuperAdmin();
    }

    /* ------------------------------------------------------------------ 2. no partner picker: everybody owns their own tenant */
    // Every "is this the Super Admin" branch in quotation.js was there for the partner picker (customer + catalog of a
    // chosen partner). The server now ignores a client partnerId, so those branches must not run.
    window.isSuperAdminUser = function () { return false; };
    const pf = document.getElementById('partner-field');
    if (pf) pf.remove();

    /* ------------------------------------------------------------------ Session.api: view param on GETs, write guard, save-error log */
    function pathOf(url) { return String(url).split('?')[0]; }

    function withoutPartnerParam(url) {
        const i = url.indexOf('?');
        if (i < 0) return url;
        const qs = new URLSearchParams(url.slice(i + 1));
        if (!qs.has('partnerId')) return url;
        qs.delete('partnerId');
        const rest = qs.toString();
        return url.slice(0, i) + (rest ? '?' + rest : '');
    }

    function installApiWrapper() {
        try {
            if (!window.Session || typeof Session.api !== 'function' || Session.api.__qwrapped) return;
            const original = Session.api.bind(Session);
            const wrapped = async function (url, opts) {
                const method = String((opts && opts.method) || 'GET').toUpperCase();
                let u = String(url);
                if (method === 'GET') {
                    u = withoutPartnerParam(u);
                    const v = getViewPartnerId();
                    if (v && !/[?&]viewPartnerId=/.test(u)) u += (u.includes('?') ? '&' : '?') + 'viewPartnerId=' + encodeURIComponent(v);
                } else if (viewMode()) {
                    const blocked = new Error('This is a read-only view of another partner. Changes are not allowed.');
                    blocked.status = 403;
                    appLog('warn', 'write_blocked_view_mode', { method: method, path: pathOf(u), requestId: localRequestId() });
                    throw blocked;
                }
                try {
                    return await original(u, opts);
                } catch (err) {
                    if (method !== 'GET') {            // the query string is never logged: it can hold a mobile number
                        appLogError('save_failed', err, { method: method, path: pathOf(u), step: typeof currentStep === 'number' ? currentStep : undefined });
                    }
                    throw err;
                }
            };
            wrapped.__qwrapped = true;
            Session.api = wrapped;
        } catch (e) {
            appLog('warn', 'api_wrapper_not_installed', { reason: String(e && e.message).slice(0, 120), requestId: localRequestId() });
        }
    }
    installApiWrapper();

    // The user sees a reference they can quote to support
    const originalApiErrorMessage = window.apiErrorMessage;
    window.apiErrorMessage = function (err) {
        const base = originalApiErrorMessage ? originalApiErrorMessage(err) : (err && err.message) || 'Request failed';
        const rid = err && (err.requestId || (err.data && err.data.requestId));
        return rid ? base + ' (ref ' + String(rid).slice(0, 8) + ')' : base;
    };

    /* ------------------------------------------------------------------ 1. read-only mode */
    function applyViewMode() {
        if (!viewMode()) return;
        document.body.classList.add('view-readonly');

        const style = document.createElement('style');
        style.textContent =
            'body.view-readonly #btn-new-quotation,' +
            'body.view-readonly [data-action="edit"],' +
            'body.view-readonly [data-action="delete"],' +
            'body.view-readonly [data-action="convert"]{display:none !important;}';
        document.head.appendChild(style);

        const main = document.querySelector('main.app-main');
        if (main) {
            const banner = document.createElement('div');
            banner.id = 'view-mode-banner';
            banner.className = 'hint-box';
            banner.style.cssText = 'margin-bottom:10px;';
            banner.innerHTML = '<i class="fas fa-eye"></i> <span id="view-mode-text"></span>';
            main.insertBefore(banner, main.children[1] || null);
            document.getElementById('view-mode-text').textContent =
                'Read-only view of channel partner #' + getViewPartnerId() + '. You can look and export, but not create, edit, delete or convert.';
            // best effort: show the partner's name instead of the number
            Session.api('/api/channel-partners/options').then(function (res) {
                const list = Array.isArray(res.data) ? res.data : (res.data && res.data.content) || [];
                const hit = list.find(function (o) { return String(o.id) === getViewPartnerId(); });
                if (hit) {
                    document.getElementById('view-mode-text').textContent =
                        'Read-only view of ' + (hit.name || hit.code) + '. You can look and export, but not create, edit, delete or convert.';
                }
            }).catch(function () { /* the number is enough */ });
        }

        // The write buttons are hidden, and these capture-phase guards stop any click that still reaches one
        // (handlers registered by quotation.js never run).
        const WRITE_SELECTOR = '#btn-new-quotation, [data-action="edit"], [data-action="delete"], [data-action="convert"], ' +
            '#btn-save-edit, #btn-confirm-delete, #btn-confirm-convert, #btn-generate';
        document.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest(WRITE_SELECTOR)) {
                e.stopImmediatePropagation();
                e.preventDefault();
                showToast('Read-only view: changes are not allowed.', 'error');
            }
        }, true);

        // allowed() decides which buttons renderTable draws; create / edit / delete are never allowed in a view
        const originalAllowed = window.allowed;
        window.allowed = function (code) {
            if (/:(CREATE|EDIT|DELETE|APPROVE|REJECT|CONVERT)$/.test(String(code))) return false;
            return originalAllowed ? originalAllowed(code) : true;
        };
        document.getElementById('btn-new-quotation')?.classList.add('hidden');
        if (typeof renderTable === 'function') renderTable();
    }

    /* the write entry points refuse too (defence in depth, in case another script calls them) */
    ['create', 'update', 'setStatus', 'remove'].forEach(function (name) {
        const original = QuotationApi[name];
        QuotationApi[name] = function () {
            if (viewMode()) {
                const e = new Error('This is a read-only view of another partner. Changes are not allowed.');
                e.status = 403;
                return Promise.reject(e);
            }
            return original.apply(QuotationApi, arguments);
        };
    });

    /* ------------------------------------------------------------------ 5. list cap notice */
    QuotationApi.listAll = async function () {
        const out = [];
        let page = 0, totalPages = 1;
        do {
            const res = await Session.api(QUOTATION_API + '?page=' + page + '&size=100&sort=quoteDate,desc');
            const data = res.data;
            if (Array.isArray(data)) { out.push.apply(out, data); totalPages = 1; }
            else { out.push.apply(out, (data && data.content) || []); totalPages = (data && data.totalPages) || 1; }
            page++;
        } while (page < totalPages && page < LIST_MAX_PAGES);
        const truncated = page < totalPages;
        if (truncated && !listTruncated) {
            showToast('Only the newest ' + out.length.toLocaleString('en-IN') + ' quotations are loaded. Use filters to find older ones.', 'error');
            appLog('warn', 'list_truncated', { loaded: out.length, totalPages: totalPages, requestId: localRequestId() });
        }
        listTruncated = truncated;
        return out;
    };

    /* ------------------------------------------------------------------ 3. calculation errors */
    // Calculation functions are called by name in many places, and some are registered as input listeners, so two nets:
    // (a) wrap the by-name callers (the user gets a message and the page keeps working),
    // (b) log anything that still escapes from a listener, when its stack shows it came from a calculation function.
    const CALC_NAMES = ['computeGstSummary', 'computeSavings', 'computeCosts', 'renderWizardPreview', 'updateEditSummary',
        'computeTotals', 'attachSubsidyAndSavings', 'computeMultiYearSavings'];
    const ZERO_TOTALS = { subtotal: 0, discountAmount: 0, sgst: 0, cgst: 0, total: 0, gstPercent: 0, costs: {}, itemsTotal: 0, referralAmount: 0 };
    let lastCalcToast = 0;

    ['computeGstSummary', 'computeSavings', 'computeCosts', 'renderWizardPreview', 'updateEditSummary'].forEach(function (name) {
        const original = window[name];
        if (typeof original !== 'function') return;
        window[name] = function () {
            try {
                return original.apply(this, arguments);
            } catch (err) {
                appLogError('calculation_failed', err, Object.assign({ fn: name }, calcContext()));
                if (Date.now() - lastCalcToast > 3000) {
                    lastCalcToast = Date.now();
                    showToast('Could not calculate the totals. Please check the amounts you entered.', 'error');
                }
                return name === 'computeGstSummary' ? ZERO_TOTALS : undefined;
            }
        };
    });

    function fromCalculation(err) {
        const stack = String((err && err.stack) || '');
        return CALC_NAMES.some(function (n) { return stack.indexOf(n) >= 0; });
    }
    window.addEventListener('error', function (e) {
        if (fromCalculation(e.error)) appLogError('calculation_failed', e.error, Object.assign({ fn: 'listener' }, calcContext()));
    });

    /* ------------------------------------------------------------------ 4. export (formula-safe, capped, logged) */
    /** A text cell that starts with = + - @ TAB or CR is read as a formula by Excel / LibreOffice / Sheets. */
    function safeText(value) {
        const s = String(value == null ? '' : value);
        return /^[=+\-@\t\r\n]/.test(s) ? "'" + s : s;
    }
    window.csvCell = function (value) {
        // numbers are numbers (a negative amount must stay one); everything else is text
        const text = typeof value === 'number' ? String(value) : safeText(value);
        return '"' + text.replace(/"/g, '""') + '"';
    };

    function exportRowsSafe() {
        const headers = ['Quotation No.', 'Customer', 'Company', 'Mobile', 'Email', 'System Size', 'Amount', 'Status', 'Referral', 'Date'];
        const filtered = getFiltered();
        const rows = filtered.slice(0, EXPORT_CAP).map(function (q) {
            return [q.quoteNo, q.customer.name || '', q.customer.company || '', q.customer.mobile || '', q.customer.email || '',
                q.systemSizeLabel || '', q.amount || 0, q.status || '', q.referral && q.referral.isReferred ? 'Referred' : 'Direct', q.date || ''];
        });
        return { csv: [headers].concat(rows).map(function (r) { return r.map(window.csvCell).join(','); }).join('\r\n'), count: rows.length, total: filtered.length };
    }

    function guardedExport(kind, run) {
        const started = performance.now();
        try {
            const info = run();
            if (info && (info.total > EXPORT_CAP || listTruncated)) {
                showToast('This export is not complete: it holds at most ' + EXPORT_CAP.toLocaleString('en-IN') +
                    ' rows' + (listTruncated ? ' and only the newest quotations are loaded' : '') + '. Narrow the filters.', 'error');
            }
            appLog('info', 'export_done', { kind: kind, rows: info && info.count, durationMs: Math.round(performance.now() - started), requestId: localRequestId() });
        } catch (err) {
            appLogError('export_failed', err, { kind: kind, durationMs: Math.round(performance.now() - started) });
            showToast('Export failed. Please try again.', 'error');
        }
    }

    function download(blob, name) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    }

    function exportCsvSafe() {
        guardedExport('csv', function () {
            const r = exportRowsSafe();
            download(new Blob([r.csv], { type: 'text/csv;charset=utf-8;' }), 'quotations_' + new Date().toISOString().slice(0, 10) + '.csv');
            showToast('CSV exported successfully', 'success');
            return r;
        });
    }
    function exportExcelSafe() {
        guardedExport('excel', function () {
            const r = exportRowsSafe();
            download(new Blob(['\uFEFF' + r.csv], { type: 'text/csv;charset=utf-8;' }), 'quotations_' + new Date().toISOString().slice(0, 10) + '.xls');
            showToast('Excel exported successfully', 'success');
            return r;
        });
    }
    function exportPdfSafe() {
        const started = performance.now();
        const table = document.querySelector('.data-table');
        if (!table || typeof html2pdf === 'undefined') {
            appLogError('export_failed', new Error('PDF library missing'), { kind: 'list_pdf', requestId: localRequestId() });
            showToast('PDF library failed to load.', 'error');
            return;
        }
        const clone = table.cloneNode(true);
        clone.querySelectorAll('.actions-th, .action-icons').forEach(function (el) { (el.closest('td') || el).remove(); });
        const area = document.createElement('div');
        area.style.cssText = 'padding:20px;background:#fff;';
        area.innerHTML = '<h2 style="font-family:Poppins,sans-serif;margin-bottom:20px;">Quotation List</h2>' +
            '<p style="font-family:Poppins,sans-serif;color:#666;margin-bottom:15px;">Generated: ' + new Date().toLocaleString() + '</p>';
        area.appendChild(clone);
        document.body.appendChild(area);
        const cleanup = function () { if (area.parentNode) area.parentNode.removeChild(area); };
        html2pdf().set({
            margin: 10, filename: 'quotations_' + new Date().toISOString().slice(0, 10) + '.pdf',
            image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(area).save().then(function () {
            cleanup();
            showToast('PDF exported successfully', 'success');
            appLog('info', 'export_done', { kind: 'list_pdf', durationMs: Math.round(performance.now() - started), requestId: localRequestId() });
        }).catch(function (err) {
            cleanup();
            appLogError('export_failed', err, { kind: 'list_pdf', durationMs: Math.round(performance.now() - started), requestId: localRequestId() });
            showToast('PDF export failed', 'error');
        });
    }

    // quotation.js registered its own handlers with function references, so the buttons are replaced by clones
    // (that drops the old listeners) and wired to the safe versions.
    [['btn-export-excel', exportExcelSafe], ['btn-export-csv', exportCsvSafe], ['btn-export-pdf', exportPdfSafe]].forEach(function (pair) {
        const old = document.getElementById(pair[0]);
        if (!old) return;
        const fresh = old.cloneNode(true);
        old.parentNode.replaceChild(fresh, old);
        fresh.addEventListener('click', pair[1]);
    });

    // the invoice PDF (view modal, wizard): same download, with the failure logged
    const originalInvoicePdf = window.downloadInvoicePDF;
    window.downloadInvoicePDF = function (elementId, filename) {
        const started = performance.now();
        let result;
        try {
            result = originalInvoicePdf(elementId, filename);
        } catch (err) {
            appLogError('export_failed', err, { kind: 'invoice_pdf', file: String(filename).slice(0, 60), requestId: localRequestId() });
            throw err;
        }
        return Promise.resolve(result).then(function (v) {
            appLog('info', 'export_done', { kind: 'invoice_pdf', durationMs: Math.round(performance.now() - started), requestId: localRequestId() });
            return v;
        }, function (err) {
            appLogError('export_failed', err, { kind: 'invoice_pdf', file: String(filename).slice(0, 60), requestId: localRequestId() });
            throw err;
        });
    };

    applyViewMode();
})();