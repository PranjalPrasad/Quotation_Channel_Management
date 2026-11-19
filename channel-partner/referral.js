// ============================================================
// Referral module — API layer (everything referral related talks to the backend only here)
//   GET   /api/referrals?referrerPartnerId=&status=&page=&size=     list
//          Partner: referrals its partner OWNS or EARNED.  Super Admin: own tenant, or ONE partner via viewPartnerId.
//   GET   /api/referrals/summary?referrerPartnerId=                  KPI numbers (same tenant rule as the list)
//   GET   /api/referrals/partner-totals?partnerIds=1,2,3             per-partner totals (Super Admin, tenant-scoped)
//   PATCH /api/referrals/{id}/mark-paid                              REFERRAL:MARK_PAID, own tenant only
//   GET   /api/channel-partners/options                              code -> id (until the partner list itself comes from the API)
// Super Admin reads another partner's data with  ?viewPartnerId=  (GET only; the backend ignores it on writes).
// Session.api() returns the JSON body, so the payload is always at res.data.
// Failures go to AppLog with the [REFERRAL] tag (operation + status only, never payment references or remarks).
// ============================================================
window.Referral = (function () {
  const STATUS_LABEL = { PENDING: 'Pending', APPROVED: 'Approved', PAID: 'Paid', REJECTED: 'Rejected' };
  const STATUS_PILL = { PENDING: 'pill-pending', APPROVED: 'pill-approved', PAID: 'pill-accepted', REJECTED: 'pill-rejected' };
  const MODE_LABEL = { BANK_TRANSFER: 'Bank Transfer', UPI: 'UPI', CHEQUE: 'Cheque', CASH: 'Cash' };

  let codeToId = null;

  function logFailure(operation, err) {
    const status = err && (err.status ?? err.httpStatus);
    const msg = `[REFERRAL] ${operation} failed: status=${status ?? 'n/a'} ${(err && err.message) || ''}`;
    const level = status >= 500 || status === 0 ? 'error' : 'warn';
    try {
      const log = window.AppLog;
      if (log && typeof log[level] === 'function') log[level](msg);
      else if (log && typeof log.log === 'function') log.log(level, msg);
      else console[level](msg);
    } catch (_) { /* logging must never break the screen */ }
  }

  /** Runs one API call; a failure is logged once and rethrown so the screen can show its own message. */
  async function call(operation, fn) {
    try { return await fn(); }
    catch (err) { logFailure(operation, err); throw err; }
  }

  /** partner code (CP-0001) -> numeric id. Not needed once the partner list is loaded from /api/channel-partners. */
  async function partnerId(p) {
    if (p.id != null) return p.id;
    if (!codeToId) {
      const res = await call('load partner options', () => Session.api('/api/channel-partners/options'));
      codeToId = {};
      (res.data || []).forEach((o) => { codeToId[o.code] = o.id; });
    }
    return codeToId[p.code] ?? null;
  }

  /** opts.viewPartnerId: Super Admin only, reads that partner's tenant instead of his own. */
  async function summary(referrerPartnerId, opts = {}) {
    const q = new URLSearchParams();
    if (referrerPartnerId != null) q.set('referrerPartnerId', referrerPartnerId);
    if (opts.viewPartnerId != null) q.set('viewPartnerId', opts.viewPartnerId);
    const qs = q.toString();
    return call('summary', async () => (await Session.api('/api/referrals/summary' + (qs ? '?' + qs : ''))).data);
  }

  async function list(referrerPartnerId, page = 0, size = 50, opts = {}) {
    const q = new URLSearchParams({ page, size, sort: 'quoteDate,desc' });
    if (referrerPartnerId != null) q.set('referrerPartnerId', referrerPartnerId);
    if (opts.viewPartnerId != null) q.set('viewPartnerId', opts.viewPartnerId);
    return call('list', async () => (await Session.api('/api/referrals?' + q)).data);   // { content, page, size, totalElements, totalPages }
  }

  async function partnerTotals(ids, opts = {}) {
    const clean = ids.filter((x) => x != null);
    if (!clean.length) return {};
    const q = new URLSearchParams({ partnerIds: clean.join(',') });
    if (opts.viewPartnerId != null) q.set('viewPartnerId', opts.viewPartnerId);
    const res = await call('partner totals', () => Session.api('/api/referrals/partner-totals?' + q));
    const map = {};
    (res.data || []).forEach((t) => { map[t.partnerId] = t; });
    return map;
  }

  /** Only the partner that OWNS the quotation (the caller's own tenant) can mark its referral paid; others get 404. */
  async function markPaid(id, body) {
    return call('mark paid', async () => (await Session.api(`/api/referrals/${id}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })).data);
  }

  return { STATUS_LABEL, STATUS_PILL, MODE_LABEL, partnerId, summary, list, partnerTotals, markPaid };
})();