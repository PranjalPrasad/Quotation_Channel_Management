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
// 6) DETAILED REPORT TABLE — data, sort, filter, paginate
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
    currentPage = 1;
    renderTable();
    showToast('Filters reset', 'fa-rotate-left');
});

// Render the table immediately — this must always work, charts or no charts.
renderTable();

// ============================================================
// 7) CHARTS (isolated — a Chart.js load failure cannot break
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