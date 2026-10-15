// TODO: replace mock data array below with API call to /api/reports

/* ============================================================
   Reports & Analytics — reports.js
   IMPORTANT: core interactive UI (sidebar, dropdowns, tabs,
   filters, table sort/paginate) is initialised FIRST and does
   NOT depend on Chart.js. Chart rendering is isolated in its own
   try/catch block at the bottom so that if the Chart.js CDN
   fails to load (slow network, ad-blocker, offline), it can
   never break the sidebar, table, or any button on this page.
   ============================================================ */

// ============================================================
// 1) SIDEBAR TOGGLE (matches Dashboard reference behaviour)
// ============================================================
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

let expanded = false;

sidebarToggle?.addEventListener('click', () => {
    expanded = !expanded;
    sidebar.classList.toggle('expanded', expanded);
    sidebar.classList.toggle('collapsed', !expanded);
    toggleIcon.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';

    // On phone/tablet the expanded sidebar becomes an overlay drawer,
    // so show a tap-outside-to-close backdrop.
    if (window.innerWidth < 1024) {
        sidebarBackdrop?.classList.toggle('hidden', !expanded);
        sidebarBackdrop?.classList.toggle('visible', expanded);
    }
});

sidebarBackdrop?.addEventListener('click', () => {
    expanded = false;
    sidebar.classList.remove('expanded');
    sidebar.classList.add('collapsed');
    toggleIcon.style.transform = 'rotate(0deg)';
    sidebarBackdrop.classList.add('hidden');
    sidebarBackdrop.classList.remove('visible');
});

window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
        sidebarBackdrop?.classList.add('hidden');
        sidebarBackdrop?.classList.remove('visible');
    }
});

// ============================================================
// 2) NOTIFICATION / PROFILE DROPDOWNS
// ============================================================
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');

notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('hidden');
    profileDropdown?.classList.add('hidden');
});

profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle('hidden');
    notifDropdown?.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!notifBtn?.contains(e.target) && !notifDropdown?.contains(e.target)) notifDropdown?.classList.add('hidden');
    if (!profileBtn?.contains(e.target) && !profileDropdown?.contains(e.target)) profileDropdown?.classList.add('hidden');
});

document.getElementById('profileLogoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '../index.html';
});

// ============================================================
// 3) TOAST HELPER
// ============================================================
function showToast(message, icon = 'fa-circle-check', color = 'emerald') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-animate flex items-center gap-2 bg-cream border border-peach-300 shadow-lg rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800`;
    toast.innerHTML = `<i class="fas ${icon} text-${color}-600"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}

document.querySelectorAll('.export-btn').forEach(btn => {
    if (btn.id === 'applyFilters' || btn.id === 'resetFilters') return;
    btn.addEventListener('click', () => {
        const label = btn.textContent.trim();
        showToast(`${label} started`, 'fa-download');
    });
});

// ============================================================
// 4) REPORT TYPE TABS
// ============================================================
document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        showToast(`${tab.textContent.trim()} loaded`, 'fa-table-list');
        // In a full build, this would swap the KPI/chart/table data set per report type.
    });
});

// ============================================================
// 5) TOP SALES PERFORMERS
// ============================================================
const performers = [
    { name: 'Arjun Mehta', quotes: 68, accepted: 34, rate: '50.0%' },
    { name: 'Priya Singh', quotes: 61, accepted: 27, rate: '44.3%' },
    { name: 'Kavya Rao', quotes: 58, accepted: 25, rate: '43.1%' },
];
const topPerformersEl = document.getElementById('topPerformers');
if (topPerformersEl) {
    performers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'alert-row bg-peach-100/60';
        row.innerHTML = `
            <span class="font-medium text-gray-800">${p.name}</span>
            <span class="text-peach-600 font-semibold">${p.accepted}/${p.quotes} · ${p.rate}</span>`;
        topPerformersEl.appendChild(row);
    });
}

// ============================================================
// 6) GST REPORT DATA (mock data)
// ============================================================
const gstReportData = [
    { quoteNo: 'SQ-1001', customer: 'Amit Sharma', taxableAmount: 150000, gstPercent: 18, gstAmount: 27000, total: 177000, date: '2026-07-15' },
    { quoteNo: 'SQ-1002', customer: 'Neha Verma', taxableAmount: 250000, gstPercent: 18, gstAmount: 45000, total: 295000, date: '2026-07-15' },
    { quoteNo: 'SQ-1003', customer: 'Ramesh Traders', taxableAmount: 500000, gstPercent: 18, gstAmount: 90000, total: 590000, date: '2026-07-14' },
    { quoteNo: 'SQ-1004', customer: 'Sunil Kumar', taxableAmount: 100000, gstPercent: 18, gstAmount: 18000, total: 118000, date: '2026-07-14' },
    { quoteNo: 'SQ-1005', customer: 'Green Homes Pvt Ltd', taxableAmount: 1200000, gstPercent: 18, gstAmount: 216000, total: 1416000, date: '2026-07-13' },
    { quoteNo: 'SQ-1006', customer: 'Deepak Yadav', taxableAmount: 150000, gstPercent: 18, gstAmount: 27000, total: 177000, date: '2026-07-13' },
    { quoteNo: 'SQ-1007', customer: 'Suresh Enterprises', taxableAmount: 720000, gstPercent: 18, gstAmount: 129600, total: 849600, date: '2026-07-12' },
    { quoteNo: 'SQ-1008', customer: 'Anjali Gupta', taxableAmount: 190000, gstPercent: 18, gstAmount: 34200, total: 224200, date: '2026-07-11' },
    { quoteNo: 'SQ-1009', customer: 'Vikram Solar Homes', taxableAmount: 285000, gstPercent: 18, gstAmount: 51300, total: 336300, date: '2026-07-10' },
    { quoteNo: 'SQ-1010', customer: 'Meena Traders', taxableAmount: 380000, gstPercent: 18, gstAmount: 68400, total: 448400, date: '2026-07-09' },
    { quoteNo: 'SQ-1011', customer: 'Rajesh Constructions', taxableAmount: 980000, gstPercent: 18, gstAmount: 176400, total: 1156400, date: '2026-07-08' },
    { quoteNo: 'SQ-1012', customer: 'Sunita Housing Society', taxableAmount: 590000, gstPercent: 18, gstAmount: 106200, total: 696200, date: '2026-07-07' },
];

// ============================================================
// 7) REFERRAL INCOME REPORT DATA (mock placeholder data)
// ============================================================
const referralIncomeData = [
    { referrerName: 'Arjun Mehta', referredCustomer: 'Amit Sharma', quotationAmount: 177000, referralPercent: 5, referralAmount: 8850, status: 'Paid' },
    { referrerName: 'Priya Singh', referredCustomer: 'Neha Verma', quotationAmount: 295000, referralPercent: 5, referralAmount: 14750, status: 'Pending' },
    { referrerName: 'Kavya Rao', referredCustomer: 'Ramesh Traders', quotationAmount: 590000, referralPercent: 5, referralAmount: 29500, status: 'Paid' },
    { referrerName: 'Arjun Mehta', referredCustomer: 'Sunil Kumar', quotationAmount: 118000, referralPercent: 5, referralAmount: 5900, status: 'Pending' },
    { referrerName: 'Priya Singh', referredCustomer: 'Green Homes Pvt Ltd', quotationAmount: 1416000, referralPercent: 5, referralAmount: 70800, status: 'Paid' },
    { referrerName: 'Kavya Rao', referredCustomer: 'Deepak Yadav', quotationAmount: 177000, referralPercent: 5, referralAmount: 8850, status: 'Pending' },
    { referrerName: 'Arjun Mehta', referredCustomer: 'Suresh Enterprises', quotationAmount: 849600, referralPercent: 5, referralAmount: 42480, status: 'Paid' },
    { referrerName: 'Priya Singh', referredCustomer: 'Anjali Gupta', quotationAmount: 224200, referralPercent: 5, referralAmount: 11210, status: 'Rejected' },
    { referrerName: 'Kavya Rao', referredCustomer: 'Vikram Solar Homes', quotationAmount: 336300, referralPercent: 5, referralAmount: 16815, status: 'Paid' },
    { referrerName: 'Arjun Mehta', referredCustomer: 'Meena Traders', quotationAmount: 448400, referralPercent: 5, referralAmount: 22420, status: 'Pending' },
    { referrerName: 'Priya Singh', referredCustomer: 'Rajesh Constructions', quotationAmount: 1156400, referralPercent: 5, referralAmount: 57820, status: 'Paid' },
    { referrerName: 'Kavya Rao', referredCustomer: 'Sunita Housing Society', quotationAmount: 696200, referralPercent: 5, referralAmount: 34810, status: 'Pending' },
];

// ============================================================
// 8) DETAILED REPORT TABLE — data, sort, filter, paginate
// ============================================================
const reportData = [
    { quoteNo: 'SQ-1001', customer: 'Amit Sharma', systemSize: '3 kW', amount: 165000, salesPerson: 'Priya Singh', status: 'accepted', date: '2026-07-15' },
    { quoteNo: 'SQ-1002', customer: 'Neha Verma', systemSize: '5 kW', amount: 275000, salesPerson: 'Priya Singh', status: 'pending', date: '2026-07-15' },
    { quoteNo: 'SQ-1003', customer: 'Ramesh Traders', systemSize: '10 kW', amount: 540000, salesPerson: 'Arjun Mehta', status: 'accepted', date: '2026-07-14' },
    { quoteNo: 'SQ-1004', customer: 'Sunil Kumar', systemSize: '2 kW', amount: 110000, salesPerson: 'Priya Singh', status: 'rejected', date: '2026-07-14' },
    { quoteNo: 'SQ-1005', customer: 'Green Homes Pvt Ltd', systemSize: '25 kW', amount: 1320000, salesPerson: 'Arjun Mehta', status: 'accepted', date: '2026-07-13' },
    { quoteNo: 'SQ-1006', customer: 'Deepak Yadav', systemSize: '3 kW', amount: 168000, salesPerson: 'Kavya Rao', status: 'pending', date: '2026-07-13' },
    { quoteNo: 'SQ-1007', customer: 'Suresh Enterprises', systemSize: '15 kW', amount: 795000, salesPerson: 'Arjun Mehta', status: 'accepted', date: '2026-07-12' },
    { quoteNo: 'SQ-1008', customer: 'Anjali Gupta', systemSize: '4 kW', amount: 210000, salesPerson: 'Kavya Rao', status: 'rejected', date: '2026-07-11' },
    { quoteNo: 'SQ-1009', customer: 'Vikram Solar Homes', systemSize: '6 kW', amount: 315000, salesPerson: 'Priya Singh', status: 'accepted', date: '2026-07-10' },
    { quoteNo: 'SQ-1010', customer: 'Meena Traders', systemSize: '8 kW', amount: 420000, salesPerson: 'Kavya Rao', status: 'pending', date: '2026-07-09' },
    { quoteNo: 'SQ-1011', customer: 'Rajesh Constructions', systemSize: '20 kW', amount: 1080000, salesPerson: 'Arjun Mehta', status: 'accepted', date: '2026-07-08' },
    { quoteNo: 'SQ-1012', customer: 'Sunita Housing Society', systemSize: '12 kW', amount: 648000, salesPerson: 'Priya Singh', status: 'pending', date: '2026-07-07' },
];

let sortKey = 'date';
let sortDir = 'desc';
let currentPage = 1;
let pageSize = 10;

const statusMeta = {
    accepted: { label: 'Accepted', icon: 'fa-circle-check' },
    pending: { label: 'Pending', icon: 'fa-hourglass-half' },
    rejected: { label: 'Rejected', icon: 'fa-circle-xmark' }
};

function formatAmount(n) {
    return '₹' + n.toLocaleString('en-IN');
}

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getFilteredData() {
    const status = document.getElementById('statusFilter')?.value || 'all';
    const salesPerson = document.getElementById('salesFilter')?.value || 'all';
    return reportData.filter(row => {
        if (status !== 'all' && row.status !== status) return false;
        if (salesPerson !== 'all' && row.salesPerson !== salesPerson) return false;
        return true;
    });
}

function getSortedData() {
    const data = [...getFilteredData()];
    data.sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    return data;
}

function renderTable() {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;

    const data = getSortedData();
    const totalRows = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const pageRows = data.slice(start, start + pageSize);

    tbody.innerHTML = pageRows.map(row => {
        const meta = statusMeta[row.status];
        return `
        <tr class="cursor-pointer" data-quote="${row.quoteNo}">
            <td data-label="Quotation No." class="font-medium">${row.quoteNo}</td>
            <td data-label="Customer">${row.customer}</td>
            <td data-label="System Size">${row.systemSize}</td>
            <td data-label="Amount">${formatAmount(row.amount)}</td>
            <td data-label="Sales Person">${row.salesPerson}</td>
            <td data-label="Status"><span class="status-pill ${row.status}"><i class="fas ${meta.icon}"></i> ${meta.label}</span></td>
            <td data-label="Date">${formatDate(row.date)}</td>
            <td data-label="Actions">
                <div class="flex items-center gap-1 justify-end">
                    <span class="row-action-btn" title="View"><i class="fas fa-eye"></i></span>
                    <span class="row-action-btn" title="Download PDF"><i class="fas fa-file-arrow-down"></i></span>
                    <span class="row-action-btn" title="Print"><i class="fas fa-print"></i></span>
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn')) return;
            showToast(`Opening ${tr.dataset.quote}`, 'fa-eye');
        });
    });

    tbody.querySelectorAll('.row-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const title = btn.getAttribute('title');
            const quoteNo = btn.closest('tr').dataset.quote;
            showToast(`${title}: ${quoteNo}`, 'fa-check');
        });
    });

    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = totalRows === 0 ? 'No results' : `Showing ${start + 1}–${Math.min(start + pageSize, totalRows)} of ${totalRows}`;
    }

    renderPagination(totalPages);
    updateSortIndicators();
}

function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
    if (!el) return;
    el.innerHTML = '';

    const prev = document.createElement('span');
    prev.className = `page-btn ${currentPage === 1 ? 'disabled' : ''}`;
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    el.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('span');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => { currentPage = i; renderTable(); });
        el.appendChild(btn);
    }

    const next = document.createElement('span');
    next.className = `page-btn ${currentPage === totalPages ? 'disabled' : ''}`;
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTable(); } });
    el.appendChild(next);
}

function updateSortIndicators() {
    document.querySelectorAll('#reportTable thead th[data-key]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        th.classList.remove('sorted');
        if (icon) icon.className = 'fas fa-sort sort-icon';
        if (th.dataset.key === sortKey && icon) {
            th.classList.add('sorted');
            icon.className = `fas ${sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon`;
        }
    });
}

document.querySelectorAll('#reportTable thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (sortKey === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortKey = key;
            sortDir = 'asc';
        }
        currentPage = 1;
        renderTable();
    });
});

document.getElementById('pageSize')?.addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    renderTable();
});

document.getElementById('applyFilters')?.addEventListener('click', () => {
    currentPage = 1;
    renderTable();
    showToast('Filters applied', 'fa-filter');
});

document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('salesFilter').value = 'all';
    document.getElementById('vendorFilter').value = 'all';
    document.getElementById('channelPartnerFilter').value = 'all';
    currentPage = 1;
    renderTable();
    showToast('Filters reset', 'fa-rotate-left');
});

// ============================================================
// 9) GST REPORT TABLE RENDERING
// ============================================================
let gstSortKey = 'date';
let gstSortDir = 'desc';
let gstCurrentPage = 1;
let gstPageSize = 10;

function getGstFilteredData() {
    const status = document.getElementById('statusFilter')?.value || 'all';
    const salesPerson = document.getElementById('salesFilter')?.value || 'all';
    return gstReportData.filter(row => {
        // GST report doesn't have status/salesPerson filters, but we keep for consistency
        return true;
    });
}

function getGstSortedData() {
    const data = [...getGstFilteredData()];
    data.sort((a, b) => {
        let av = a[gstSortKey], bv = b[gstSortKey];
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return gstSortDir === 'asc' ? -1 : 1;
        if (av > bv) return gstSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    return data;
}

function renderGstTable() {
    const tbody = document.getElementById('gstTableBody');
    if (!tbody) return;

    const data = getGstSortedData();
    const totalRows = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / gstPageSize));
    gstCurrentPage = Math.min(gstCurrentPage, totalPages);

    const start = (gstCurrentPage - 1) * gstPageSize;
    const pageRows = data.slice(start, start + gstPageSize);

    tbody.innerHTML = pageRows.map(row => {
        return `
        <tr class="cursor-pointer" data-quote="${row.quoteNo}">
            <td data-label="Quotation No." class="font-medium">${row.quoteNo}</td>
            <td data-label="Customer">${row.customer}</td>
            <td data-label="Taxable Amount">${formatAmount(row.taxableAmount)}</td>
            <td data-label="GST %">${row.gstPercent}%</td>
            <td data-label="GST Amount">${formatAmount(row.gstAmount)}</td>
            <td data-label="Total">${formatAmount(row.total)}</td>
            <td data-label="Date">${formatDate(row.date)}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
            showToast(`Opening ${tr.dataset.quote}`, 'fa-eye');
        });
    });

    const pageInfo = document.getElementById('gstPageInfo');
    if (pageInfo) {
        pageInfo.textContent = totalRows === 0 ? 'No results' : `Showing ${start + 1}–${Math.min(start + gstPageSize, totalRows)} of ${totalRows}`;
    }

    renderGstPagination(totalPages);
    updateGstSortIndicators();
}

function renderGstPagination(totalPages) {
    const el = document.getElementById('gstPagination');
    if (!el) return;
    el.innerHTML = '';

    const prev = document.createElement('span');
    prev.className = `page-btn ${gstCurrentPage === 1 ? 'disabled' : ''}`;
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prev.addEventListener('click', () => { if (gstCurrentPage > 1) { gstCurrentPage--; renderGstTable(); } });
    el.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('span');
        btn.className = `page-btn ${i === gstCurrentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => { gstCurrentPage = i; renderGstTable(); });
        el.appendChild(btn);
    }

    const next = document.createElement('span');
    next.className = `page-btn ${gstCurrentPage === totalPages ? 'disabled' : ''}`;
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';
    next.addEventListener('click', () => { if (gstCurrentPage < totalPages) { gstCurrentPage++; renderGstTable(); } });
    el.appendChild(next);
}

function updateGstSortIndicators() {
    document.querySelectorAll('#gstTable thead th[data-key]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        th.classList.remove('sorted');
        if (icon) icon.className = 'fas fa-sort sort-icon';
        if (th.dataset.key === gstSortKey && icon) {
            th.classList.add('sorted');
            icon.className = `fas ${gstSortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon`;
        }
    });
}

document.querySelectorAll('#gstTable thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (gstSortKey === key) {
            gstSortDir = gstSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            gstSortKey = key;
            gstSortDir = 'asc';
        }
        gstCurrentPage = 1;
        renderGstTable();
    });
});

document.getElementById('gstPageSize')?.addEventListener('change', (e) => {
    gstPageSize = parseInt(e.target.value, 10);
    gstCurrentPage = 1;
    renderGstTable();
});

// ============================================================
// 10) REFERRAL INCOME TABLE RENDERING
// ============================================================
let referralSortKey = 'referrerName';
let referralSortDir = 'asc';
let referralCurrentPage = 1;
let referralPageSize = 10;

function getReferralFilteredData() {
    return referralIncomeData;
}

function getReferralSortedData() {
    const data = [...getReferralFilteredData()];
    data.sort((a, b) => {
        let av = a[referralSortKey], bv = b[referralSortKey];
        if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
        if (av < bv) return referralSortDir === 'asc' ? -1 : 1;
        if (av > bv) return referralSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    return data;
}

function renderReferralTable() {
    const tbody = document.getElementById('referralTableBody');
    if (!tbody) return;

    const data = getReferralSortedData();
    const totalRows = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / referralPageSize));
    referralCurrentPage = Math.min(referralCurrentPage, totalPages);

    const start = (referralCurrentPage - 1) * referralPageSize;
    const pageRows = data.slice(start, start + referralPageSize);

    const statusColors = {
        'Paid': 'bg-emerald-100 text-emerald-700',
        'Pending': 'bg-amber-100 text-amber-700',
        'Rejected': 'bg-rose-100 text-rose-600'
    };

    tbody.innerHTML = pageRows.map(row => {
        const statusClass = statusColors[row.status] || 'bg-gray-100 text-gray-600';
        return `
        <tr>
            <td data-label="Referrer Name" class="font-medium">${row.referrerName}</td>
            <td data-label="Referred Customer">${row.referredCustomer}</td>
            <td data-label="Quotation Amount">${formatAmount(row.quotationAmount)}</td>
            <td data-label="Referral %">${row.referralPercent}%</td>
            <td data-label="Referral Amount">${formatAmount(row.referralAmount)}</td>
            <td data-label="Status"><span class="status-pill ${statusClass}">${row.status}</span></td>
        </tr>`;
    }).join('');

    const pageInfo = document.getElementById('referralPageInfo');
    if (pageInfo) {
        pageInfo.textContent = totalRows === 0 ? 'No results' : `Showing ${start + 1}–${Math.min(start + referralPageSize, totalRows)} of ${totalRows}`;
    }

    renderReferralPagination(totalPages);
    updateReferralSortIndicators();
}

function renderReferralPagination(totalPages) {
    const el = document.getElementById('referralPagination');
    if (!el) return;
    el.innerHTML = '';

    const prev = document.createElement('span');
    prev.className = `page-btn ${referralCurrentPage === 1 ? 'disabled' : ''}`;
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prev.addEventListener('click', () => { if (referralCurrentPage > 1) { referralCurrentPage--; renderReferralTable(); } });
    el.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('span');
        btn.className = `page-btn ${i === referralCurrentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => { referralCurrentPage = i; renderReferralTable(); });
        el.appendChild(btn);
    }

    const next = document.createElement('span');
    next.className = `page-btn ${referralCurrentPage === totalPages ? 'disabled' : ''}`;
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';
    next.addEventListener('click', () => { if (referralCurrentPage < totalPages) { referralCurrentPage++; renderReferralTable(); } });
    el.appendChild(next);
}

function updateReferralSortIndicators() {
    document.querySelectorAll('#referralTable thead th[data-key]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        th.classList.remove('sorted');
        if (icon) icon.className = 'fas fa-sort sort-icon';
        if (th.dataset.key === referralSortKey && icon) {
            th.classList.add('sorted');
            icon.className = `fas ${referralSortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} sort-icon`;
        }
    });
}

document.querySelectorAll('#referralTable thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (referralSortKey === key) {
            referralSortDir = referralSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            referralSortKey = key;
            referralSortDir = 'asc';
        }
        referralCurrentPage = 1;
        renderReferralTable();
    });
});

document.getElementById('referralPageSize')?.addEventListener('change', (e) => {
    referralPageSize = parseInt(e.target.value, 10);
    referralCurrentPage = 1;
    renderReferralTable();
});

// ============================================================
// 11) TAB SWITCHING WITH CONTENT VISIBILITY
// ============================================================
document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        const targetContent = document.getElementById(`tabContent${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }
        showToast(`${tab.textContent.trim()} loaded`, 'fa-table-list');
    });
});

// ============================================================
// 12) CHANNEL PARTNER FILTER (Super Admin only)
// ============================================================
// Check user role from session and show/hide channel partner filter
function initChannelPartnerFilter() {
    const channelPartnerFilter = document.getElementById('channelPartnerFilterContainer');
    if (!channelPartnerFilter) return;
    
    // Role comes from the login session (session.js) — no default role.
    const userRole = window.currentUserRole;
    
    // Show only for SUPER_ADMIN
    if (userRole === 'SUPER_ADMIN') {
        channelPartnerFilter.classList.remove('hidden');
    } else {
        channelPartnerFilter.classList.add('hidden');
    }
}

// Call the function after session is loaded
document.addEventListener('DOMContentLoaded', () => {
    initChannelPartnerFilter();
});

// Also call after session.js loads
setTimeout(initChannelPartnerFilter, 500);

// ============================================================
// 13) Render tables on page load
// ============================================================
// Render the table immediately — this must always work, charts or no charts.
renderTable();
renderGstTable();
renderReferralTable();

// ============================================================
// 14) CHARTS (isolated — a Chart.js load failure cannot break
//    anything above this point)
// ============================================================

// Shows a friendly placeholder inside a chart's wrapper instead of
// leaving a blank box when Chart.js couldn't load or a chart errored.
function showChartFallback(canvasEl) {
    if (!canvasEl) return;
    const wrap = canvasEl.closest('.pie-wrap') || canvasEl.parentElement;
    if (!wrap) return;
    wrap.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center gap-1.5 px-4">
            <i class="fas fa-chart-simple text-lg text-peach-300"></i>
            <p class="text-[11px] font-medium text-gray-500">Chart couldn't load</p>
            <p class="text-[10px] text-gray-400">Chart.js failed to load from the CDN — check your network/firewall, or self-host chart.js.</p>
        </div>`;
}

(function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js did not load — skipping charts, rest of the page is unaffected.');
        ['chartTrend', 'chartStatus', 'chartSystemSize'].forEach(id => showChartFallback(document.getElementById(id)));
        return;
    }

    try {
        const peach = '#810B38';
        const peachLight = 'rgba(129, 11, 56, 0.18)';
        const gridColor = 'rgba(84, 26, 26, 0.08)';
        const fontColor = '#9CA3AF';

        Chart.defaults.font.family = "'Poppins', sans-serif";
        Chart.defaults.font.size = 10.5;

        const trendEl = document.getElementById('chartTrend');
        if (trendEl) {
            new Chart(trendEl, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Quotations',
                        data: [25, 31, 42, 38, 45, 52],
                        borderColor: peach,
                        backgroundColor: peachLight,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: peach,
                        pointBorderColor: '#F7ECE1',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} quotations` } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: fontColor } },
                        y: { grid: { color: gridColor }, ticks: { color: fontColor }, beginAtZero: true }
                    }
                }
            });
        }

        const statusEl = document.getElementById('chartStatus');
        if (statusEl) {
            new Chart(statusEl, {
                type: 'doughnut',
                data: {
                    labels: ['Accepted', 'Pending', 'Rejected'],
                    datasets: [{
                        data: [86, 62, 39],
                        backgroundColor: ['#059669', '#d97706', '#e11d48'],
                        borderColor: '#F7ECE1',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '68%',
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#1F2937', boxWidth: 9, padding: 10, font: { size: 10 } } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
                    }
                }
            });
        }

        const sizeEl = document.getElementById('chartSystemSize');
        if (sizeEl) {
            new Chart(sizeEl, {
                type: 'bar',
                data: {
                    labels: ['< 3 kW', '3–5 kW', '5–10 kW', '10 kW+'],
                    datasets: [{
                        label: 'Value (₹ in Lakhs)',
                        data: [18.6, 34.2, 51.8, 37.4],
                        backgroundColor: peach,
                        borderRadius: 8,
                        maxBarThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `₹${ctx.parsed.y}L` } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: fontColor } },
                        y: { grid: { color: gridColor }, ticks: { color: fontColor } }
                    }
                }
            });
        }
    } catch (err) {
        console.warn('Chart rendering failed, rest of the page is unaffected:', err);
        ['chartTrend', 'chartStatus', 'chartSystemSize'].forEach(id => showChartFallback(document.getElementById(id)));
    }
})();