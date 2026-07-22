/* ============================================================
   Reports & Analytics — reports.js
   ============================================================ */

// ---------- Sidebar toggle (ref: Pocket Dashboard behaviour) ----------
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarOverlay = document.getElementById('sidebar-overlay');

let expanded = false;

sidebarToggle?.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
        sidebar.classList.toggle('mobile-open');
        sidebarOverlay?.classList.toggle('hidden');
        return;
    }
    expanded = !expanded;
    sidebar.classList.toggle('expanded', expanded);
    sidebar.classList.toggle('collapsed', !expanded);
    toggleIcon.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
});

sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    sidebarOverlay.classList.add('hidden');
});

window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
        sidebar?.classList.remove('mobile-open');
        sidebarOverlay?.classList.add('hidden');
    }
});

// ---------- Notification / user dropdowns ----------
const userBtn = document.getElementById('user-menu-btn');
const userMenu = document.getElementById('user-menu');
userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('hidden');
    notifMenu?.classList.add('hidden');
});

const notifBtn = document.getElementById('notif-btn');
const notifMenu = document.getElementById('notif-menu');
notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifMenu.classList.toggle('hidden');
    userMenu?.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!userBtn?.contains(e.target) && !userMenu?.contains(e.target)) userMenu?.classList.add('hidden');
    if (!notifBtn?.contains(e.target) && !notifMenu?.contains(e.target)) notifMenu?.classList.add('hidden');
});

// ---------- Logout ----------
document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '../index.html';
});

// ---------- Toast helper ----------
function showToast(message, icon = 'fa-circle-check', color = 'emerald') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-animate flex items-center gap-2 bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-2.5 text-xs font-medium text-gray-800`;
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
// Chart theme (peach)
// ============================================================
const peach = '#FEB4A7';
const peachDark = '#F4917D';
const gridColor = 'rgba(75, 86, 148, 0.10)';
const fontColor = '#9CA3AF';

Chart.defaults.font.family = "'Poppins', sans-serif";
Chart.defaults.font.size = 11;

// Monthly Quotation Trend
const trendMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const trendCounts = [25, 31, 42, 38, 45, 52];

new Chart(document.getElementById('chartTrend'), {
    type: 'line',
    data: {
        labels: trendMonths,
        datasets: [{
            label: 'Quotations',
            data: trendCounts,
            borderColor: peachDark,
            backgroundColor: 'rgba(254, 180, 167, 0.25)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: peachDark,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4
        }]
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} quotations` } } },
        scales: {
            x: { grid: { display: false }, ticks: { color: fontColor } },
            y: { grid: { color: gridColor }, ticks: { color: fontColor }, beginAtZero: true }
        }
    }
});

// Status Distribution
new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
        labels: ['Accepted', 'Pending', 'Rejected'],
        datasets: [{
            data: [86, 62, 39],
            backgroundColor: ['#059669', '#d97706', '#e11d48'],
            borderColor: '#FFFFFF',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        cutout: '68%',
        plugins: {
            legend: { position: 'bottom', labels: { color: '#1F2937', boxWidth: 10, padding: 12 } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
        }
    }
});

// Revenue by System Size
new Chart(document.getElementById('chartSystemSize'), {
    type: 'bar',
    data: {
        labels: ['< 3 kW', '3–5 kW', '5–10 kW', '10 kW+'],
        datasets: [{
            label: 'Value (₹ in Lakhs)',
            data: [18.6, 34.2, 51.8, 37.4],
            backgroundColor: peach,
            borderRadius: 8,
            maxBarThickness: 44
        }]
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `₹${ctx.parsed.y}L` } } },
        scales: {
            x: { grid: { display: false }, ticks: { color: fontColor } },
            y: { grid: { color: gridColor }, ticks: { color: fontColor } }
        }
    }
});

// ---------- Top Sales Performers ----------
const performers = [
    { name: 'Arjun Mehta', quotes: 68, accepted: 34, rate: '50.0%' },
    { name: 'Priya Singh', quotes: 61, accepted: 27, rate: '44.3%' },
    { name: 'Kavya Rao', quotes: 58, accepted: 25, rate: '43.1%' },
];
const topPerformersEl = document.getElementById('topPerformers');
performers.forEach(p => {
    const row = document.createElement('div');
    row.className = 'alert-row bg-peach-50';
    row.innerHTML = `
        <span class="font-medium text-gray-800">${p.name}</span>
        <span class="text-peach-600 font-semibold">${p.accepted}/${p.quotes} · ${p.rate}</span>`;
    topPerformersEl.appendChild(row);
});

// ============================================================
// Report type tabs
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
// Detailed report table: data, sort, filter, paginate
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
    const status = document.getElementById('statusFilter').value;
    const salesPerson = document.getElementById('salesFilter').value;
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
    const data = getSortedData();
    const totalRows = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const pageRows = data.slice(start, start + pageSize);

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = pageRows.map(row => {
        const meta = statusMeta[row.status];
        return `
        <tr class="cursor-pointer" data-quote="${row.quoteNo}">
            <td class="font-medium">${row.quoteNo}</td>
            <td>${row.customer}</td>
            <td>${row.systemSize}</td>
            <td>${formatAmount(row.amount)}</td>
            <td>${row.salesPerson}</td>
            <td><span class="status-pill ${row.status}"><i class="fas ${meta.icon}"></i> ${meta.label}</span></td>
            <td>${formatDate(row.date)}</td>
            <td>
                <div class="flex items-center gap-1">
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

    document.getElementById('pageInfo').textContent =
        totalRows === 0 ? 'No results' : `Showing ${start + 1}–${Math.min(start + pageSize, totalRows)} of ${totalRows}`;

    renderPagination(totalPages);
    updateSortIndicators();
}

function renderPagination(totalPages) {
    const el = document.getElementById('pagination');
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
        icon.className = 'fas fa-sort sort-icon';
        if (th.dataset.key === sortKey) {
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

document.getElementById('pageSize').addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    renderTable();
});

document.getElementById('applyFilters').addEventListener('click', () => {
    currentPage = 1;
    renderTable();
    showToast('Filters applied', 'fa-filter');
});

document.getElementById('resetFilters').addEventListener('click', () => {
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('salesFilter').value = 'all';
    document.getElementById('vendorFilter').value = 'all';
    currentPage = 1;
    renderTable();
    showToast('Filters reset', 'fa-rotate-left');
});

// Initial render
renderTable();