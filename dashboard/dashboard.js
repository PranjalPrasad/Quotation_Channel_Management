// TODO: replace mock data array below with API call to /api/dashboard

// ============================================================
// Sidebar collapse / expand
// Below 1024px (phone + tablet) the expanded sidebar becomes an
// overlay drawer with a backdrop, so it never squeezes the
// dashboard content — matching CSS lives in the
// "Mobile / tablet sidebar drawer" block in dashboard.css.
// ============================================================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleIcon = document.getElementById("toggleIcon");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

let expanded = false;

function setSidebarExpanded(next) {
  expanded = next;
  sidebar.classList.toggle("expanded", expanded);
  sidebar.classList.toggle("collapsed", !expanded);
  toggleIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";

  const isDrawerViewport = window.matchMedia("(max-width: 1023px)").matches;
  sidebarBackdrop.classList.toggle("visible", expanded && isDrawerViewport);
}

sidebarToggle.addEventListener("click", () => setSidebarExpanded(!expanded));
sidebarBackdrop.addEventListener("click", () => setSidebarExpanded(false));

// collapse the drawer automatically when resizing up to desktop
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 1023px)").matches) {
    sidebarBackdrop.classList.remove("visible");
  }
});

// tapping a nav item closes the mobile drawer (it either navigates
// away or is a no-op item, either way the drawer shouldn't linger)
document.querySelectorAll(".nav-list .nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 1023px)").matches) setSidebarExpanded(false);
  });
});

// ============================================================
// Nav item active state
// (Dashboard is marked active in the HTML since this is the
// dashboard module — clicking another item navigates away, so
// we don't need to move the active state around this page.)
// ============================================================

// ============================================================
// Quotation Status Distribution + System Size Distribution
// — Chart.js charts, recoloured to the Color Hunt
// palette (#810B38 / #F1E2D1 / #DCC3AA / #541A1A)
// ============================================================
Chart.defaults.font.family = "'Poppins', sans-serif";
Chart.defaults.font.size = 11;

const paletteBerry = "#810B38";
const paletteMaroon = "#541A1A";
const paletteTan = "#DCC3AA";
const paletteCream = "#F1E2D1";

const donutTooltipOpts = {
  backgroundColor: "#fff",
  titleColor: "#1F2937",
  bodyColor: "#6B7280",
  borderColor: "#F1F1F1",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 10,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 4,
};

// ---- Chart 1: Quotation Status Distribution (doughnut) ----
const statusCounts = { Pending: 58, Accepted: 156, Rejected: 34 };

window.statusPieChart = new Chart(document.getElementById("chartStatusDistribution"), {
  type: "doughnut",
  data: {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [paletteTan, paletteBerry, paletteMaroon],
      borderColor: "#F1E2D1",
      borderWidth: 3,
      hoverOffset: 6,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#6B7280", boxWidth: 8, boxHeight: 8, padding: 8, font: { size: 10 }, usePointStyle: true, pointStyle: "circle" }
      },
      tooltip: donutTooltipOpts,
    }
  }
});

// ---- Chart 2: Quotations by System Size Category — bar/histogram ----
function sizeCategory(sizeStr) {
  const kw = parseFloat(sizeStr);
  if (kw <= 5) return "Small (≤5 kW)";
  if (kw <= 20) return "Medium (6–20 kW)";
  return "Large (>20 kW)";
}

const sizeBuckets = {};
quotationsForSizeChart().forEach((q) => {
  const cat = sizeCategory(q.size);
  sizeBuckets[cat] = (sizeBuckets[cat] || 0) + 1;
});

function quotationsForSizeChart() {
  // Mirrors the same records used by the full quotations table below
  return [
    { size: '3 kW' }, { size: '10 kW' }, { size: '5 kW' }, { size: '25 kW' },
    { size: '4 kW' }, { size: '50 kW' }, { size: '3 kW' }, { size: '7 kW' },
    { size: '15 kW' }, { size: '30 kW' }, { size: '3 kW' }, { size: '20 kW' },
    { size: '6 kW' }, { size: '4 kW' }, { size: '40 kW' },
  ];
}

const sizeCategoryOrder = ["Small (≤5 kW)", "Medium (6–20 kW)", "Large (>20 kW)"];
const sizeLabels = sizeCategoryOrder.filter((c) => c in sizeBuckets);
const sizeValues = sizeLabels.map((c) => sizeBuckets[c]);

window.sizeBarChart = new Chart(document.getElementById("chartSizeDistribution"), {
  type: "bar",
  data: {
    labels: sizeLabels,
    datasets: [{
      label: "Quotations",
      data: sizeValues,
      backgroundColor: [paletteBerry, paletteTan, paletteMaroon],
      borderRadius: 8,
      maxBarThickness: 46,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: donutTooltipOpts,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#6B7280" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#6B7280", precision: 0 },
        grid: { color: "#F0E4D6" },
      },
    },
  }
});

// ============================================================
// Recent Quotations (right panel) — same records as the
// reference Recent Quotations table, most recent first
// ============================================================
const recentQuotations = [
  { no: "SQ-1001", customer: "Amit Sharma", size: "3 kW", status: "Pending", date: "2026-07-15" },
  { no: "SQ-1000", customer: "Priya Enterprises", size: "10 kW", status: "Accepted", date: "2026-07-14" },
  { no: "SQ-0999", customer: "Ravi Constructions", size: "5 kW", status: "Rejected", date: "2026-07-14" },
  { no: "SQ-0998", customer: "Meena Textiles", size: "25 kW", status: "Accepted", date: "2026-07-13" },
];

const statusInitial = { Pending: "P", Accepted: "A", Rejected: "R" };
const statusBadgeBg = { Pending: "bg-amber-100 text-amber-600", Accepted: "bg-emerald-100 text-emerald-600", Rejected: "bg-rose-100 text-rose-500" };
const statusPillClass = { Pending: "pending", Accepted: "accepted", Rejected: "rejected" };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function renderRecentQuotations() {
  const list = document.getElementById("recentQuotationsList");
  if (!list) return;
  list.innerHTML = recentQuotations
    .map(
      (q) => `
      <div class="quote-row">
        <div class="w-9 h-9 rounded-full ${statusBadgeBg[q.status]} flex items-center justify-center text-xs font-bold">${statusInitial[q.status]}</div>
        <div class="quote-info">
          <p>${q.no} · ${q.customer}</p>
          <p>${q.size} · ${formatDate(q.date)}</p>
        </div>
        <span class="quote-pill ${statusPillClass[q.status]}">${q.status}</span>
      </div>`
    )
    .join("");
}

renderRecentQuotations();

// ============================================================
// Recent Quotations — full table (sort, paginate, view/edit,
// print, PDF export, duplicate) — same behaviour as the
// reference dashboard, recoloured to the palette theme
// ============================================================
// ========== UPDATED: quotations now include 'channelPartner' field ==========
let quotations = [
  { no: 'SQ-1001', customer: 'Amit Sharma', size: '3 kW', amount: 165000, status: 'Pending', date: '2026-07-15', channelPartner: 'CP-0001' },
  { no: 'SQ-1000', customer: 'Priya Enterprises', size: '10 kW', amount: 540000, status: 'Accepted', date: '2026-07-14', channelPartner: 'CP-0002' },
  { no: 'SQ-0999', customer: 'Ravi Constructions', size: '5 kW', amount: 275000, status: 'Rejected', date: '2026-07-14', channelPartner: 'CP-0001' },
  { no: 'SQ-0998', customer: 'Meena Textiles', size: '25 kW', amount: 1320000, status: 'Accepted', date: '2026-07-13', channelPartner: 'CP-0003' },
  { no: 'SQ-0997', customer: 'Suresh Patel', size: '4 kW', amount: 210000, status: 'Pending', date: '2026-07-12', channelPartner: 'CP-0002' },
  { no: 'SQ-0996', customer: 'Global Foods Pvt Ltd', size: '50 kW', amount: 2650000, status: 'Accepted', date: '2026-07-12', channelPartner: 'CP-0001' },
  { no: 'SQ-0995', customer: 'Anita Deshmukh', size: '3 kW', amount: 158000, status: 'Rejected', date: '2026-07-11', channelPartner: 'CP-0003' },
  { no: 'SQ-0994', customer: 'Rajesh Traders', size: '7 kW', amount: 372000, status: 'Pending', date: '2026-07-11', channelPartner: 'CP-0002' },
  { no: 'SQ-0993', customer: 'Sunrise Apartments', size: '15 kW', amount: 795000, status: 'Accepted', date: '2026-07-10', channelPartner: 'CP-0001' },
  { no: 'SQ-0992', customer: 'Vikram Industries', size: '30 kW', amount: 1580000, status: 'Pending', date: '2026-07-09', channelPartner: 'CP-0002' },
  { no: 'SQ-0991', customer: 'Kavita Rao', size: '3 kW', amount: 162000, status: 'Accepted', date: '2026-07-08', channelPartner: 'CP-0003' },
  { no: 'SQ-0990', customer: 'Deepak Motors', size: '20 kW', amount: 1050000, status: 'Pending', date: '2026-07-08', channelPartner: 'CP-0001' },
  { no: 'SQ-0989', customer: 'Farha Textiles', size: '6 kW', amount: 318000, status: 'Rejected', date: '2026-07-07', channelPartner: 'CP-0002' },
  { no: 'SQ-0988', customer: 'Nikhil Joshi', size: '4 kW', amount: 205000, status: 'Accepted', date: '2026-07-06', channelPartner: 'CP-0001' },
  { no: 'SQ-0987', customer: 'Star Cold Storage', size: '40 kW', amount: 2120000, status: 'Pending', date: '2026-07-05', channelPartner: 'CP-0003' },
];

const tableStatusPillClass = { Pending: 'pill-pending', Accepted: 'pill-accepted', Rejected: 'pill-rejected' };

function formatINR(n) {
  return '₹' + n.toLocaleString('en-IN');
}

let sortKey = 'date';
let sortDir = 'desc';
let currentPage = 1;
let rowsPerPage = 10;

const qTbody = document.getElementById('quotationsTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');

// ========== NEW: Channel Partner Filter ==========
let activeChannelPartnerFilter = 'all'; // 'all' or specific CP code

// ========== UPDATED: sortedQuotations() with filter ==========
function sortedQuotations() {
  let list = [...quotations];

  // Apply Channel Partner filter (if not 'all')
  if (activeChannelPartnerFilter !== 'all') {
    list = list.filter(q => q.channelPartner === activeChannelPartnerFilter);
  }

  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'amount') { /* numeric already */ }
    else if (sortKey === 'date') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 12 15 15"></polyline></svg>',
  duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
};

function actionIconsHtml(no) {
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-no="${no}" title="View">${ICONS.view}</button>
      <button class="action-icon-btn icon-edit" data-action="edit" data-no="${no}" title="Edit">${ICONS.edit}</button>
      <button class="action-icon-btn icon-print" data-action="print" data-no="${no}" title="Print">${ICONS.print}</button>
      <button class="action-icon-btn icon-pdf" data-action="pdf" data-no="${no}" title="Download PDF">${ICONS.pdf}</button>
      <button class="action-icon-btn icon-duplicate" data-action="duplicate" data-no="${no}" title="Duplicate">${ICONS.duplicate}</button>
    </div>`;
}

// ========== UPDATED: renderTable() with Channel Partner column ==========
function renderTable() {
  const data = sortedQuotations();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  // Build table rows — include Channel Partner column for Super Admin
  const rows = pageRows.map((q) => {
    const channelPartnerCell = `<td data-label="Channel Partner">${q.channelPartner || '—'}</td>`;
    return `
      <tr data-no="${q.no}">
        <td data-label="Quotation No." class="font-medium">${q.no}</td>
        <td data-label="Customer">${q.customer}</td>
        ${window.currentUserRole === 'SUPER_ADMIN' ? channelPartnerCell : ''}
        <td data-label="System Size">${q.size}</td>
        <td data-label="Amount">${formatINR(q.amount)}</td>
        <td data-label="Status"><span class="pill ${tableStatusPillClass[q.status]}">${q.status}</span></td>
        <td data-label="Date">${formatDate(q.date)}</td>
        <td data-label="Actions">${actionIconsHtml(q.no)}</td>
      </tr>
    `;
  }).join('');

  qTbody.innerHTML = rows;

  rowsRangeLabel.textContent = totalRows === 0
    ? 'No records'
    : `${start + 1}–${Math.min(start + rowsPerPage, totalRows)} of ${totalRows}`;

  renderPagination(totalPages);
  updateSortIcons();

  // Hide Channel Partner column headers if not Super Admin
  const channelPartnerHeaders = document.querySelectorAll('#quotationsTable thead th[data-key="channelPartner"]');
  channelPartnerHeaders.forEach(th => {
    th.style.display = (window.currentUserRole === 'SUPER_ADMIN') ? '' : 'none';
  });
}

function renderPagination(totalPages) {
  let html = '';
  html += `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
      if (p === 2 || p === totalPages - 1) html += `<span class="pagination-btn disabled">…</span>`;
      continue;
    }
    html += `<span class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</span>`;
  paginationControls.innerHTML = html;

  paginationControls.querySelectorAll('.pagination-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-page');
      if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      renderTable();
    });
  });
}

function updateSortIcons() {
  document.querySelectorAll('#quotationsTable thead th[data-key]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    const key = th.getAttribute('data-key');
    th.classList.toggle('sorted', key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#quotationsTable thead th[data-key]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    currentPage = 1;
    renderTable();
  });
});

rowsPerPageSelect?.addEventListener('change', () => {
  rowsPerPage = parseInt(rowsPerPageSelect.value, 10);
  currentPage = 1;
  renderTable();
});

// ========== NEW: Channel Partner Filter Event ==========
const channelPartnerFilter = document.getElementById('channelPartnerFilter');
if (channelPartnerFilter) {
  channelPartnerFilter.addEventListener('change', (e) => {
    activeChannelPartnerFilter = e.target.value;
    currentPage = 1;
    renderTable();
  });
}

/* ===========================================================
   Row actions: View (read-only) / Edit (selective fields) /
   Print / Download PDF / Duplicate
   =========================================================== */
const quoteModal = document.getElementById('quoteModal');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const quoteForm = document.getElementById('quoteForm');

const fldNo = document.getElementById('fldNo');
const fldCustomer = document.getElementById('fldCustomer');
const fldSize = document.getElementById('fldSize');
const fldAmount = document.getElementById('fldAmount');
const fldStatus = document.getElementById('fldStatus');
const fldDate = document.getElementById('fldDate');

const EDITABLE_FIELD_IDS = ['fldCustomer', 'fldSize', 'fldAmount', 'fldStatus'];

let modalMode = 'view';
let modalQuoteNo = null;

function findQuote(no) {
  return quotations.find(q => q.no === no);
}

function fillForm(q) {
  fldNo.value = q.no;
  fldCustomer.value = q.customer;
  fldSize.value = q.size;
  fldAmount.value = q.amount;
  fldStatus.value = q.status;
  fldDate.value = q.date;
}

function openModal(no, mode) {
  const q = findQuote(no);
  if (!q) return;
  modalMode = mode;
  modalQuoteNo = no;
  fillForm(q);

  if (mode === 'view') {
    modalTitle.textContent = 'Quotation Details';
    modalSubtitle.textContent = `${q.no} · Read-only`;
    quoteForm.querySelectorAll('.field-input').forEach(el => el.disabled = true);
    modalSaveBtn.classList.add('hidden');
    modalCancelBtn.textContent = 'Close';
  } else {
    modalTitle.textContent = 'Edit Quotation';
    modalSubtitle.textContent = `${q.no} · Customer, size, amount & status only`;
    quoteForm.querySelectorAll('.field-input').forEach(el => {
      el.disabled = !EDITABLE_FIELD_IDS.includes(el.id);
    });
    modalSaveBtn.classList.remove('hidden');
    modalCancelBtn.textContent = 'Cancel';
  }

  quoteModal.classList.remove('hidden');
}

function closeModal() {
  quoteModal.classList.add('hidden');
  modalQuoteNo = null;
}

modalCloseBtn?.addEventListener('click', closeModal);
modalCancelBtn?.addEventListener('click', closeModal);
quoteModal?.addEventListener('click', (e) => { if (e.target === quoteModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !quoteModal.classList.contains('hidden')) closeModal(); });

modalSaveBtn?.addEventListener('click', () => {
  const q = findQuote(modalQuoteNo);
  if (!q) return;
  q.customer = fldCustomer.value.trim() || q.customer;
  q.size = fldSize.value.trim() || q.size;
  q.amount = parseFloat(fldAmount.value) || q.amount;
  q.status = fldStatus.value;
  renderTable();
  closeModal();
  showToast(`Saved changes to ${q.no}`);
});

/* ---- Print: fills the hidden print slip and opens the browser print dialog ---- */
function printQuotation(no) {
  const q = findQuote(no);
  if (!q) return;
  document.getElementById('pNo').textContent = q.no;
  document.getElementById('pCustomer').textContent = q.customer;
  document.getElementById('pSize').textContent = q.size;
  document.getElementById('pAmount').textContent = formatINR(q.amount);
  document.getElementById('pStatus').textContent = q.status;
  document.getElementById('pDate').textContent = formatDate(q.date);
  document.getElementById('pGenDate').textContent = new Date().toLocaleString('en-IN');
  window.print();
}

/* ---- Download PDF: generates a real .pdf file client-side with jsPDF ---- */
function downloadQuotationPdf(no) {
  const q = findQuote(no);
  if (!q) return;
  if (!window.jspdf) {
    showToast('PDF library failed to load — check your connection');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(129, 11, 56);
  doc.text('Solar Quotation Management', 40, 50);
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('Quotation Slip', 40, 68);
  doc.setDrawColor(129, 11, 56);
  doc.line(40, 78, 555, 78);

  const rows = [
    ['Quotation No.', q.no],
    ['Customer', q.customer],
    ['System Size', q.size],
    ['Amount', formatINR(q.amount)],
    ['Status', q.status],
    ['Date', formatDate(q.date)],
  ];

  let y = 110;
  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setTextColor(107, 114, 128);
    doc.text(label, 40, y);
    doc.setTextColor(31, 41, 55);
    doc.text(String(value), 220, y);
    y += 26;
  });

  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 40, y + 20);

  doc.save(`${q.no}.pdf`);
  showToast(`Downloaded ${q.no}.pdf`);
}

/* ---- Duplicate: clones the quotation with a fresh number and inserts it at the top ---- */
function duplicateQuotation(no) {
  const q = findQuote(no);
  if (!q) return;

  const maxNum = quotations.reduce((max, item) => {
    const n = parseInt(item.no.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const newNo = `SQ-${String(maxNum + 1).padStart(4, '0')}`;

  const copy = {
    ...q,
    no: newNo,
    status: 'Pending',
    date: new Date().toISOString().slice(0, 10),
  };
  quotations.unshift(copy);
  sortKey = 'date'; sortDir = 'desc'; currentPage = 1;
  renderTable();
  showToast(`Duplicated as ${newNo}`);
}

/* ---- Wire up the action icons + row click ---- */
qTbody?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    const no = actionBtn.getAttribute('data-no');
    const action = actionBtn.getAttribute('data-action');
    if (action === 'view') openModal(no, 'view');
    else if (action === 'edit') openModal(no, 'edit');
    else if (action === 'print') printQuotation(no);
    else if (action === 'pdf') downloadQuotationPdf(no);
    else if (action === 'duplicate') duplicateQuotation(no);
    return;
  }
  const row = e.target.closest('tr[data-no]');
  if (row) {
    openModal(row.getAttribute('data-no'), 'view');
  }
});

/* ---------------- Toast helper ---------------- */
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/* ---------------- Init table ---------------- */
// ========== UPDATED: Ensure currentUserRole is set for conditional rendering ==========
// This is set by session.js — we read it for our conditional logic
window.currentUserRole = window.currentUserRole || 'SUPER_ADMIN'; // fallback for local testing

// ========== Apply role-based visibility for all elements with data-role ==========
// This runs in session.js already, but we re-run it here to ensure Channel Partner elements are handled
function applyRoleBasedVisibility() {
  const userRole = window.currentUserRole || 'SUPER_ADMIN';
  document.querySelectorAll('[data-role]').forEach(el => {
    const roles = el.getAttribute('data-role').split(',').map(r => r.trim());
    const shouldShow = roles.includes(userRole);
    el.style.display = shouldShow ? '' : 'none';
  });
}
applyRoleBasedVisibility();

// Re-run visibility after session.js loads (in case it runs after this script)
if (window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    applyRoleBasedVisibility();
  });
}

// ========== Initial render ==========
renderTable();

// ============================================================
// New Quotation button — redirects to the Quotation Management module
// ============================================================
const newQuotationBtn = document.getElementById('newQuotationBtn');
newQuotationBtn?.addEventListener('click', () => {
  window.location.href = '../Quotation/quotation.html';
});

// ============================================================
// Topbar: notification + profile dropdowns
// ============================================================
const notifBtn = document.getElementById("notifBtn");
const notifDropdown = document.getElementById("notifDropdown");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

function closeAllTopbarDropdowns(except) {
  [notifDropdown, profileDropdown].forEach((dd) => {
    if (dd && dd !== except) dd.classList.add("hidden");
  });
}

notifBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = notifDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  notifDropdown.classList.toggle("hidden", !willOpen);
});

profileBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = profileDropdown.classList.contains("hidden");
  closeAllTopbarDropdowns();
  profileDropdown.classList.toggle("hidden", !willOpen);
});

document.addEventListener("click", () => closeAllTopbarDropdowns());

// ============================================================
// Logout — redirects to index.html
// ============================================================
profileLogoutBtn?.addEventListener("click", () => {
  showToast("Logged out");
  window.location.href = "../index.html";
});