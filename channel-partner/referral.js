// ============================================================
// Referral module — API layer (everything referral related talks to the backend only here)
//   GET   /api/referrals?referrerPartnerId=&status=&page=&size=     list (Super Admin: all, Partner: own earned only)
//   GET   /api/referrals/summary?referrerPartnerId=                  KPI numbers
//   GET   /api/referrals/partner-totals?partnerIds=1,2,3             per-partner totals (Super Admin)
//   PATCH /api/referrals/{id}/mark-paid                              Super Admin
//   GET   /api/channel-partners/options                              code -> id (until the partner list itself comes from the API)
// Session.api() returns the JSON body, so the payload is always at res.data.
// ============================================================
window.Referral = (function () {
  const STATUS_LABEL = { PENDING: 'Pending', APPROVED: 'Approved', PAID: 'Paid', REJECTED: 'Rejected' };
  const STATUS_PILL = { PENDING: 'pill-pending', APPROVED: 'pill-approved', PAID: 'pill-accepted', REJECTED: 'pill-rejected' };
  const MODE_LABEL = { BANK_TRANSFER: 'Bank Transfer', UPI: 'UPI', CHEQUE: 'Cheque', CASH: 'Cash' };

  let codeToId = null;

  /** partner code (CP-0001) -> numeric id. Not needed once the partner list is loaded from /api/channel-partners. */
  async function partnerId(p) {
    if (p.id != null) return p.id;
    if (!codeToId) {
      const res = await Session.api('/api/channel-partners/options');
      codeToId = {};
      (res.data || []).forEach((o) => { codeToId[o.code] = o.id; });
    }
    return codeToId[p.code] ?? null;
  }

  async function summary(referrerPartnerId) {
    const q = referrerPartnerId != null ? `?referrerPartnerId=${referrerPartnerId}` : '';
    return (await Session.api('/api/referrals/summary' + q)).data;
  }

  async function list(referrerPartnerId, page = 0, size = 50) {
    const q = new URLSearchParams({ page, size, sort: 'quoteDate,desc' });
    if (referrerPartnerId != null) q.set('referrerPartnerId', referrerPartnerId);
    return (await Session.api('/api/referrals?' + q)).data;   // { content, page, size, totalElements, totalPages }
  }

  async function partnerTotals(ids) {
    const clean = ids.filter((x) => x != null);
    if (!clean.length) return {};
    const res = await Session.api('/api/referrals/partner-totals?partnerIds=' + clean.join(','));
    const map = {};
    (res.data || []).forEach((t) => { map[t.partnerId] = t; });
    return map;
  }

  async function markPaid(id, body) {
    return (await Session.api(`/api/referrals/${id}/mark-paid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })).data;
  }

  return { STATUS_LABEL, STATUS_PILL, MODE_LABEL, partnerId, summary, list, partnerTotals, markPaid };
})();