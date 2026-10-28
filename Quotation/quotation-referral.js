/* =====================================================================
   QUOTATION WIZARD — REFERRAL SECTION (replaces the mock version)
   Backend: GET /api/referrals/referrer-options   (needs only QUOTATION:CREATE)
            -> [{ id, code, name }]  active partners except the caller's own
   The server now owns: referral code, default %, referral amount and the
   Pending/Approved/Paid status. The browser only sends who referred.

   HOW TO APPLY in quotation.js
   1. Delete: REFERRER_DATA, populateReferrerList, getReferrerDetails,
      generateReferralCode, handleReferrerSelection, toggleReferralSection.
      (keep calculateReferralAmount / updateReferralAmountInSummary: they are only
       the live "estimated" row; the saved amount always comes from the server.)
   2. Paste this whole file in their place (or load it with a <script> before quotation.js).
   3. Where the save payload is built (around lines 1276 and 1545) use:
          referral: getReferralPayload()
   4. Replace the two calls  populateReferrerList()  with  loadReferrerOptions().
   ===================================================================== */

let referrerPartners = [];          // [{ id, code, name }] from the backend

async function loadReferrerOptions() {
    const datalist = document.getElementById('referrerList');
    if (!datalist) return;
    try {
        const res = await Session.api('/api/referrals/referrer-options');
        referrerPartners = res.data || [];
    } catch (e) {
        referrerPartners = [];
    }
    datalist.innerHTML = referrerPartners.map(p => `<option value="${p.name}">${p.code}</option>`).join('');
}

function selectedReferrerPartner() {
    const name = document.getElementById('f-referredBy').value.trim().toLowerCase();
    return referrerPartners.find(p => p.name.toLowerCase() === name) || null;
}

// Referrer type values are now CUSTOMER | CHANNEL_PARTNER | OTHER (change the <option value>s in quotation.html)
function onReferrerTypeChange() {
    const type = document.getElementById('f-referrerType').value;
    const by = document.getElementById('f-referredBy');
    // the partner list is only offered for CHANNEL_PARTNER
    by.setAttribute('list', type === 'CHANNEL_PARTNER' ? 'referrerList' : '');
    by.value = '';
    document.getElementById('f-referralCode').value = '';
    document.getElementById('referralHintText').textContent = type === 'CHANNEL_PARTNER'
        ? 'Pick the referring channel partner. Code and default % are taken from that partner.'
        : 'Referral code is generated when the quotation is saved.';
}

function handleReferrerSelection() {
    const type = document.getElementById('f-referrerType').value;
    if (type !== 'CHANNEL_PARTNER') return;
    const p = selectedReferrerPartner();
    document.getElementById('f-referralCode').value = p ? p.code : '';
    document.getElementById('referralHintText').textContent = p
        ? `Referrer: ${p.name} (${p.code}). Leave Referral % empty to use this partner's default.`
        : 'Choose a partner from the list.';
}

function toggleReferralSection() {
    const isChecked = document.getElementById('f-isReferred').checked;
    ['referredByField', 'referrerTypeField', 'referralCodeField', 'referralPercentField', 'referralHint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isChecked ? '' : 'none';
    });
    if (!isChecked) {
        document.getElementById('f-referredBy').value = '';
        document.getElementById('f-referrerType').value = '';
        document.getElementById('f-referralCode').value = '';
        document.getElementById('f-referralPercent').value = '';
    }
}

/** Validation for the wizard step; returns an error message or ''. */
function validateReferral() {
    if (!document.getElementById('f-isReferred').checked) return '';
    const type = document.getElementById('f-referrerType').value;
    if (!type) return 'Select the referrer type';
    if (type === 'CHANNEL_PARTNER' && !selectedReferrerPartner()) return 'Select the referring channel partner from the list';
    if (type !== 'CHANNEL_PARTNER' && !document.getElementById('f-referredBy').value.trim()) return 'Enter who referred this customer';
    return '';
}

/** The `referral` object of POST /api/quotations and PUT /api/quotations/{id}. */
function getReferralPayload() {
    if (!document.getElementById('f-isReferred').checked) return { referred: false };
    const type = document.getElementById('f-referrerType').value;
    const partner = type === 'CHANNEL_PARTNER' ? selectedReferrerPartner() : null;
    const pct = document.getElementById('f-referralPercent').value;
    return {
        referred: true,
        referrerType: type,                                   // CUSTOMER | CHANNEL_PARTNER | OTHER
        referrerPartnerId: partner ? partner.id : null,       // server takes name/code/% from the partner
        referredBy: partner ? partner.name : document.getElementById('f-referredBy').value.trim(),
        referralPercent: pct === '' ? null : parseFloat(pct), // null = partner's default %
    };
}

/* Showing a saved quotation: response.referral =
   { referred, referrerType, referrerPartnerId, referredBy, referralCode,
     referralPercent, referralAmount, referralStatus: 'PENDING'|'APPROVED'|'PAID'|'REJECTED'|null }
   Status label for badges:  { PENDING:'Pending', APPROVED:'Approved', PAID:'Paid', REJECTED:'Rejected' }[referralStatus]
   Wire-up (keep your existing listeners):
       document.getElementById('f-referrerType').addEventListener('change', onReferrerTypeChange);
*/