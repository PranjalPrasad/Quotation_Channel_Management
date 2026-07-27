// TODO: replace mock data array below with API call to /api/customer

/* ============================================================
   customer.js — Customer Management module
   Vanilla JS only. No frameworks, no jQuery.
   ============================================================ */

/* ---------- Sidebar collapse/expand (same behaviour as dashboard.js) ----------
   On tablet/phone (<1024px) the sidebar opens as an overlay drawer
   (see .sidebar.expanded position:fixed rule in dashboard.css), so a
   backdrop is shown/hidden alongside it and tapping the backdrop, a
   nav item, or resizing back to desktop closes the drawer again. */
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
let sidebarExpanded = false;

function isDrawerBreakpoint() {
  return window.innerWidth <= 1023;
}

function setSidebarExpanded(expanded) {
  sidebarExpanded = expanded;
  sidebar.classList.toggle('expanded', sidebarExpanded);
  sidebar.classList.toggle('collapsed', !sidebarExpanded);
  toggleIcon.style.transform = sidebarExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

  if (isDrawerBreakpoint()) {
    sidebarBackdrop?.classList.toggle('visible', sidebarExpanded);
    sidebarBackdrop?.classList.toggle('hidden', !sidebarExpanded);
  } else {
    sidebarBackdrop?.classList.remove('visible');
    sidebarBackdrop?.classList.add('hidden');
  }
}

sidebarToggle?.addEventListener('click', () => {
  setSidebarExpanded(!sidebarExpanded);
});

sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));

/* Tapping a nav item on a phone/tablet should close the drawer instead
   of leaving it open over the newly-loaded page. */
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    if (isDrawerBreakpoint()) setSidebarExpanded(false);
  });
});

/* If the viewport is resized past the drawer breakpoint while the
   drawer is open, drop the backdrop so it doesn't linger on desktop. */
window.addEventListener('resize', () => {
  if (!isDrawerBreakpoint()) {
    sidebarBackdrop?.classList.remove('visible');
    sidebarBackdrop?.classList.add('hidden');
  }
});

/* ---------- Topbar dropdowns (same behaviour as dashboard.js) ---------- */
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileLogoutBtn = document.getElementById('profileLogoutBtn');
const exportBtn = document.getElementById('exportBtn');
const exportMenu = document.getElementById('exportMenu');

function closeAllDropdowns(except) {
  [notifDropdown, profileDropdown, exportMenu].forEach((dd) => {
    if (dd && dd !== except) dd.classList.add('hidden');
  });
}
notifBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = notifDropdown.classList.contains('hidden');
  closeAllDropdowns();
  notifDropdown.classList.toggle('hidden', !willOpen);
});
profileBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = profileDropdown.classList.contains('hidden');
  closeAllDropdowns();
  profileDropdown.classList.toggle('hidden', !willOpen);
});
exportBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = exportMenu.classList.contains('hidden');
  closeAllDropdowns();
  exportMenu.classList.toggle('hidden', !willOpen);
});
document.addEventListener('click', () => closeAllDropdowns());
profileLogoutBtn?.addEventListener('click', () => showToast('Logged out'));

/* ---------- Close any open <select> dropdown on scroll ----------
   Native <select> option lists are rendered by the browser/OS, not
   by our CSS. If the page (or a scrollable container like the
   modal body) scrolls while one is open, it doesn't track with its
   input and visually "floats" across the page. Blurring it the
   moment a scroll happens forces it to close cleanly instead.
   `capture: true` on window also catches scroll events fired by
   inner scrollable elements (e.g. .modal-body, .table-scroll),
   since scroll events don't bubble but are still seen in the
   capture phase. ---------------------------------------------- */
window.addEventListener('scroll', () => {
  const active = document.activeElement;
  if (active && active.tagName === 'SELECT') {
    active.blur();
  }
}, true);

/* ---------- Toast helper ---------- */
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate';
  toast.style.cssText = 'background:#1F2937;color:#fff;font-size:12px;font-weight:500;padding:10px 16px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,0.18);';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/* ============================================================
   Dummy data
   ============================================================ */
let customers = [
  { id: 'CUST-1001', name: 'Amit Sharma', mobile: '9876543210', email: 'amit.sharma@example.com', address: '12 Lake View Road', city: 'Pune', state: 'Maharashtra', gst: '', type: 'Residential', project: 'Rooftop 3kW, Kothrud', status: 'Active', created: '2026-06-02', channelPartner: 'CP-0001' },
  { id: 'CUST-1002', name: 'Priya Enterprises', mobile: '9822011122', email: 'contact@priyaent.com', address: 'Plot 4, MIDC', city: 'Pune', state: 'Maharashtra', gst: '27ABCPE1234F1Z5', type: 'Commercial', project: '10kW Office Rooftop, Hinjewadi', status: 'Active', created: '2026-06-05', channelPartner: 'CP-0002' },
  { id: 'CUST-1003', name: 'Ravi Constructions', mobile: '9765432109', email: 'ravi.constructions@example.com', address: 'Site Office, Wagholi', city: 'Pune', state: 'Maharashtra', gst: '', type: 'Commercial', project: '5kW Site Office, Wagholi', status: 'Inactive', created: '2026-06-08', channelPartner: 'CP-0001' },
  { id: 'CUST-1004', name: 'Meena Textiles', mobile: '9911223344', email: 'info@meenatextiles.com', address: 'Textile Park, Ichalkaranji', city: 'Kolhapur', state: 'Maharashtra', gst: '27MEENA5678G1Z2', type: 'Industrial', project: '25kW Factory Roof, Ichalkaranji', status: 'Active', created: '2026-06-10', channelPartner: 'CP-0003' },
  { id: 'CUST-1005', name: 'Suresh Patel', mobile: '9898989898', email: 'suresh.patel@example.com', address: '45 Sardar Nagar', city: 'Ahmedabad', state: 'Gujarat', gst: '', type: 'Residential', project: '4kW Rooftop, Sardar Nagar', status: 'Active', created: '2026-06-11', channelPartner: 'CP-0002' },
  { id: 'CUST-1006', name: 'Global Foods Pvt Ltd', mobile: '9012345678', email: 'ops@globalfoods.com', address: 'Industrial Area Phase 2', city: 'Nashik', state: 'Maharashtra', gst: '27GLOBF9999H1Z8', type: 'Industrial', project: '50kW Cold Storage, Nashik', status: 'Active', created: '2026-06-12', channelPartner: 'CP-0001' },
  { id: 'CUST-1007', name: 'Anita Deshmukh', mobile: '9765011223', email: 'anita.deshmukh@example.com', address: '9 Rose Villa', city: 'Nagpur', state: 'Maharashtra', gst: '', type: 'Residential', project: '3kW Rooftop, Nagpur', status: 'Inactive', created: '2026-06-13', channelPartner: 'CP-0003' },
  { id: 'CUST-1008', name: 'Rajesh Traders', mobile: '9822334455', email: 'rajesh.traders@example.com', address: 'Market Yard', city: 'Solapur', state: 'Maharashtra', gst: '', type: 'Commercial', project: '7kW Shop Roof, Solapur', status: 'Active', created: '2026-06-14', channelPartner: 'CP-0002' },
  { id: 'CUST-1009', name: 'Sunrise Apartments', mobile: '9765098765', email: 'admin@sunriseapts.com', address: 'Baner Road', city: 'Pune', state: 'Maharashtra', gst: '27SUNRA4321J1Z6', type: 'Residential', project: '15kW Society Terrace, Baner', status: 'Active', created: '2026-06-16', channelPartner: 'CP-0001' },
  { id: 'CUST-1010', name: 'Vikram Industries', mobile: '9911001122', email: 'vikram.ind@example.com', address: 'MIDC Chakan', city: 'Pune', state: 'Maharashtra', gst: '27VIKRI8765K1Z1', type: 'Industrial', project: '30kW Plant Roof, Chakan', status: 'Active', created: '2026-06-18', channelPartner: 'CP-0002' },
];

let followups = [
  { customerId: 'CUST-1001', date: '2026-07-10', remark: 'Discussed pricing, sent brochure', next: '2026-07-20', status: 'Completed' },
  { customerId: 'CUST-1002', date: '2026-07-15', remark: 'Site visit scheduled', next: '2026-07-22', status: 'Pending' },
  { customerId: 'CUST-1004', date: '2026-07-05', remark: 'Awaiting management approval', next: '2026-07-18', status: 'Overdue' },
];

let historyData = {
  'CUST-1001': [
    { label: 'Project Created', when: '2 Jun 2026' },
    { label: 'Quotation Generated', when: '4 Jun 2026' },
    { label: 'Quotation Approved', when: '9 Jun 2026' },
    { label: 'Last Updated', when: '10 Jul 2026' },
  ],
  'CUST-1002': [
    { label: 'Project Created', when: '5 Jun 2026' },
    { label: 'Quotation Generated', when: '7 Jun 2026' },
    { label: 'Last Updated', when: '15 Jul 2026' },
  ],
  'CUST-1004': [
    { label: 'Project Created', when: '10 Jun 2026' },
    { label: 'Quotation Generated', when: '12 Jun 2026' },
    { label: 'Quotation Approved', when: '20 Jun 2026' },
    { label: 'Last Updated', when: '5 Jul 2026' },
  ],
};

/* ============================================================
   State
   ============================================================ */
let searchTerm = '';
let typeFilter = 'All';
let statusFilter = 'All';
let currentPage = 1;
const rowsPerPage = 6;

const typePillClass = { Residential: 'pill-residential', Commercial: 'pill-commercial', Industrial: 'pill-industrial' };
const statusPillClass = { Active: 'pill-active', Inactive: 'pill-inactive' };
const followupPillClass = { Pending: 'pill-pending', Completed: 'pill-accepted', Overdue: 'pill-rejected' };

function formatDateDisplay(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================
   Summary cards
   ============================================================ */
function renderSummary() {
  const total = customers.length;
  const residential = customers.filter(c => c.type === 'Residential').length;
  const commercial = customers.filter(c => c.type === 'Commercial').length;
  const industrial = customers.filter(c => c.type === 'Industrial').length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statResidential').textContent = residential;
  document.getElementById('statCommercial').textContent = commercial;
  document.getElementById('statIndustrial').textContent = industrial;

  document.getElementById('statTotalTrend').textContent = `${customers.filter(c => c.status === 'Active').length} active`;
  document.getElementById('statResidentialTrend').textContent = total ? `${Math.round((residential / total) * 100)}% of customers` : 'Homes & apartments';
  document.getElementById('statCommercialTrend').textContent = total ? `${Math.round((commercial / total) * 100)}% of customers` : 'Offices & shops';
  document.getElementById('statIndustrialTrend').textContent = total ? `${Math.round((industrial / total) * 100)}% of customers` : 'Plants & factories';
}

/* ============================================================
   Filtering + table render
   ============================================================ */
function filteredCustomers() {
  return customers.filter(c => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      c.name.toLowerCase().includes(term) ||
      c.mobile.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term);
    const matchesType = typeFilter === 'All' || c.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });
}

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line><line x1="9" y1="11" x2="12" y2="11"></line></svg>',
};

function actionIconsHtml(id) {
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>
      <button class="action-icon-btn icon-edit" data-action="edit" data-id="${id}" title="Edit">${ICONS.edit}</button>
      <button class="action-icon-btn icon-quote" data-action="quote" data-id="${id}" title="Create Quotation">${ICONS.quote}</button>
      <button class="action-icon-btn icon-delete" data-action="delete" data-id="${id}" title="Delete">${ICONS.delete}</button>
    </div>`;
}

function renderTable() {
  const data = filteredCustomers();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  const tbody = document.getElementById('customerTbody');
  const emptyState = document.getElementById('emptyState');
  const tableFooter = document.getElementById('tableFooter');
  const tableWrap = document.querySelector('.table-scroll');

  document.getElementById('tableCountLabel').textContent = `${totalRows} record${totalRows === 1 ? '' : 's'}`;

  if (totalRows === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    tableFooter.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  tableWrap.classList.remove('hidden');
  tableFooter.classList.remove('hidden');

  // Determine if we should show Channel Partner column
  const showChannelPartner = window.currentUserRole === 'SUPER_ADMIN';

  tbody.innerHTML = pageRows.map(c => {
    // Build row with conditional Channel Partner column
    const channelPartnerCell = showChannelPartner ? `<td data-label="Channel Partner">${c.channelPartner || '—'}</td>` : '';
    return `
      <tr data-id="${c.id}">
        <td data-label="Customer ID" class="font-medium">${c.id}</td>
        <td data-label="Customer Name">${c.name}</td>
        <td data-label="Mobile Number">${c.mobile}</td>
        <td data-label="Email">${c.email || '—'}</td>
        <td data-label="City">${c.city || '—'}</td>
        <td data-label="Customer Type"><span class="pill ${typePillClass[c.type]}">${c.type}</span></td>
        <td data-label="Project Location">${c.project || '—'}</td>
        ${channelPartnerCell}
        <td data-label="Status"><span class="pill ${statusPillClass[c.status]}">${c.status}</span></td>
        <td data-label="Created Date">${formatDateDisplay(c.created)}</td>
        <td data-label="Actions">${actionIconsHtml(c.id)}</td>
      </tr>
    `;
  }).join('');

  // Hide Channel Partner header if not Super Admin
  document.querySelectorAll('#customerTable thead th[data-role="SUPER_ADMIN"]').forEach(th => {
    th.style.display = showChannelPartner ? '' : 'none';
  });

  document.getElementById('rowsRangeLabel').textContent = `${start + 1}–${Math.min(start + rowsPerPage, totalRows)} of ${totalRows}`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = document.getElementById('paginationControls');
  let html = `<span class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">‹</span>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<span class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</span>`;
  }
  html += `<span class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">›</span>`;
  el.innerHTML = html;

  el.querySelectorAll('.pagination-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-page');
      if (p === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (p === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = parseInt(p, 10);
      renderTable();
    });
  });
}

/* ---------- Search & filters ---------- */
document.getElementById('searchName')?.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  currentPage = 1;
  renderTable();
});
/* ---------- Custom dropdown (Customer Type / Status filters) ----------
   Replaces native <select> for these two filters: a native select's
   option list is rendered by the browser at a fixed screen position,
   so if the page scrolls while it's open it visually detaches/floats.
   This custom version lives in normal document flow (relative wrapper
   + absolutely positioned panel), so it scrolls naturally with the
   page and never detaches. ---------------------------------------- */
function setupCustomSelect(rootId, onSelect) {
  const root = document.getElementById(rootId);
  if (!root) return null;
  const trigger = root.querySelector('.custom-select-trigger');
  const label = root.querySelector('.cs-label');
  const panel = root.querySelector('.custom-select-panel');
  const options = root.querySelectorAll('.custom-select-option');

  function closePanel() {
    panel.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function openPanel() {
    document.querySelectorAll('.custom-select-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('hidden') ? openPanel() : closePanel();
  });

  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      label.textContent = opt.textContent;
      closePanel();
      onSelect(opt.getAttribute('data-value'));
    });
  });

  return {
    close: closePanel,
    setValue(val) {
      options.forEach(o => o.classList.toggle('selected', o.getAttribute('data-value') === val));
      const match = [...options].find(o => o.getAttribute('data-value') === val);
      if (match) label.textContent = match.textContent;
    },
  };
}

const typeSelectCtrl = setupCustomSelect('filterTypeSelect', (val) => {
  typeFilter = val;
  currentPage = 1;
  renderTable();
});
const statusSelectCtrl = setupCustomSelect('filterStatusSelect', (val) => {
  statusFilter = val;
  currentPage = 1;
  renderTable();
});
const fldTypeCtrl = setupCustomSelect('fldTypeSelect', (val) => {
  document.getElementById('fldType').value = val;
});
const fldStatusCtrl = setupCustomSelect('fldStatusSelect', (val) => {
  document.getElementById('fldStatus').value = val;
});
const fuStatusCtrl = setupCustomSelect('fuStatusSelect', (val) => {
  document.getElementById('fuStatus').value = val;
});

/* fuCustomer's options are built dynamically (list of current customers)
   each time the follow-up modal opens, so it needs its own small setup
   rather than the static setupCustomSelect() above. */
function buildFuCustomerDropdown(selectedId) {
  const root = document.getElementById('fuCustomerSelect');
  const trigger = root.querySelector('.custom-select-trigger');
  const label = root.querySelector('.cs-label');
  const panel = root.querySelector('.custom-select-panel');

  panel.innerHTML = customers.map(c => `<div class="custom-select-option${c.id === selectedId ? ' selected' : ''}" data-value="${c.id}" role="option">${c.name} · ${c.id}</div>`).join('');

  const chosen = customers.find(c => c.id === selectedId) || customers[0];
  document.getElementById('fuCustomer').value = chosen ? chosen.id : '';
  label.textContent = chosen ? `${chosen.name} · ${chosen.id}` : 'Select customer';

  panel.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      label.textContent = opt.textContent;
      document.getElementById('fuCustomer').value = opt.getAttribute('data-value');
      panel.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });

  trigger.onclick = (e) => {
    e.stopPropagation();
    const willOpen = panel.classList.contains('hidden');
    document.querySelectorAll('.custom-select-panel').forEach(p => { if (p !== panel) p.classList.add('hidden'); });
    panel.classList.toggle('hidden', !willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
  };
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('.custom-select').forEach(root => {
    if (!root.contains(e.target)) root.querySelector('.custom-select-panel')?.classList.add('hidden');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.custom-select-panel').forEach(p => p.classList.add('hidden'));
});

document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
  searchTerm = ''; typeFilter = 'All'; statusFilter = 'All'; currentPage = 1;
  document.getElementById('searchName').value = '';
  typeSelectCtrl?.setValue('All');
  statusSelectCtrl?.setValue('All');
  renderTable();
  showToast('Filters reset');
});

/* ============================================================
   Add / Edit Customer modal
   ============================================================ */
const customerFormModal = document.getElementById('customerFormModal');
const customerForm = document.getElementById('customerForm');
let formMode = 'add';

const FORM_FIELDS = ['fldName', 'fldMobile', 'fldEmail', 'fldAddress', 'fldCity', 'fldState', 'fldGst', 'fldType', 'fldProject', 'fldStatus', 'fldChannelPartner'];

function openCustomerForm(mode, customer) {
  formMode = mode;
  clearFormErrors();
  document.getElementById('customerFormTitle').textContent = mode === 'add' ? 'Add Customer' : 'Edit Customer';
  document.getElementById('customerFormSubtitle').textContent = mode === 'add' ? "Fill in the customer's details" : `Editing ${customer.id}`;
  document.getElementById('customerFormSaveBtn').textContent = mode === 'add' ? 'Save Customer' : 'Update Customer';

  document.getElementById('fldCustomerId').value = customer ? customer.id : '';
  document.getElementById('fldName').value = customer ? customer.name : '';
  document.getElementById('fldMobile').value = customer ? customer.mobile : '';
  document.getElementById('fldEmail').value = customer ? customer.email : '';
  document.getElementById('fldAddress').value = customer ? customer.address : '';
  document.getElementById('fldCity').value = customer ? customer.city : '';
  document.getElementById('fldState').value = customer ? customer.state : '';
  document.getElementById('fldGst').value = customer ? customer.gst : '';
  document.getElementById('fldType').value = customer ? customer.type : 'Residential';
  fldTypeCtrl?.setValue(customer ? customer.type : 'Residential');
  document.getElementById('fldProject').value = customer ? customer.project : '';
  document.getElementById('fldStatus').value = customer ? customer.status : 'Active';
  fldStatusCtrl?.setValue(customer ? customer.status : 'Active');
  
  // NEW: Auto-fill Channel Partner from session
  const channelPartnerField = document.getElementById('fldChannelPartner');
  if (window.currentUserRole === 'SUPER_ADMIN') {
    // For Super Admin, field is editable (for now, read-only but can be made editable later)
    channelPartnerField.value = customer ? customer.channelPartner || '' : '';
    channelPartnerField.readOnly = false;
    channelPartnerField.placeholder = 'Select Channel Partner (dropdown coming soon)';
  } else {
    // For Channel Partner, field is read-only and auto-filled
    const partnerName = window.currentUserPartnerName || 'CP-0001'; // fallback
    channelPartnerField.value = partnerName;
    channelPartnerField.readOnly = true;
  }

  customerFormModal.classList.remove('hidden');
}
function closeCustomerForm() {
  customerFormModal.classList.add('hidden');
}
function clearFormErrors() {
  ['errName', 'errMobile', 'errEmail'].forEach(id => document.getElementById(id).textContent = '');
  ['fldName', 'fldMobile', 'fldEmail'].forEach(id => document.getElementById(id).classList.remove('invalid'));
}

document.getElementById('addCustomerBtn')?.addEventListener('click', () => openCustomerForm('add', null));
document.getElementById('addFirstCustomerBtn')?.addEventListener('click', () => openCustomerForm('add', null));
document.getElementById('customerFormCloseBtn')?.addEventListener('click', closeCustomerForm);
document.getElementById('customerFormCancelBtn')?.addEventListener('click', closeCustomerForm);
customerFormModal?.addEventListener('click', (e) => { if (e.target === customerFormModal) closeCustomerForm(); });

function validateCustomerForm() {
  clearFormErrors();
  let valid = true;
  const name = document.getElementById('fldName').value.trim();
  const mobile = document.getElementById('fldMobile').value.trim();
  const email = document.getElementById('fldEmail').value.trim();

  if (!name) {
    document.getElementById('errName').textContent = 'Customer name is required.';
    document.getElementById('fldName').classList.add('invalid');
    valid = false;
  }
  if (!mobile) {
    document.getElementById('errMobile').textContent = 'Mobile number is required.';
    document.getElementById('fldMobile').classList.add('invalid');
    valid = false;
  } else if (!/^\d{10}$/.test(mobile.replace(/\D/g, ''))) {
    document.getElementById('errMobile').textContent = 'Enter a valid 10-digit mobile number.';
    document.getElementById('fldMobile').classList.add('invalid');
    valid = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('errEmail').textContent = 'Enter a valid email address.';
    document.getElementById('fldEmail').classList.add('invalid');
    valid = false;
  }
  return valid;
}

document.getElementById('customerFormSaveBtn')?.addEventListener('click', () => {
  if (!validateCustomerForm()) return;

  const payload = {
    name: document.getElementById('fldName').value.trim(),
    mobile: document.getElementById('fldMobile').value.trim(),
    email: document.getElementById('fldEmail').value.trim(),
    address: document.getElementById('fldAddress').value.trim(),
    city: document.getElementById('fldCity').value.trim(),
    state: document.getElementById('fldState').value.trim(),
    gst: document.getElementById('fldGst').value.trim(),
    type: document.getElementById('fldType').value,
    project: document.getElementById('fldProject').value.trim(),
    status: document.getElementById('fldStatus').value,
    channelPartner: document.getElementById('fldChannelPartner').value.trim() || (window.currentUserPartnerName || 'CP-0001'),
  };

  if (formMode === 'add') {
    const maxNum = customers.reduce((max, c) => {
      const n = parseInt(c.id.replace(/\D/g, ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 1000);
    const newId = `CUST-${maxNum + 1}`;
    const newCustomer = { id: newId, created: new Date().toISOString().slice(0, 10), ...payload };
    customers.unshift(newCustomer);
    showToast(`Customer ${newId} added`);
  } else {
    const id = document.getElementById('fldCustomerId').value;
    const c = customers.find(x => x.id === id);
    if (c) Object.assign(c, payload);
    showToast(`Customer ${id} updated`);
  }

  closeCustomerForm();
  currentPage = 1;
  renderAll();
});

/* ============================================================
   View Customer modal
   ============================================================ */
const viewCustomerModal = document.getElementById('viewCustomerModal');
function openViewCustomer(customer) {
  document.getElementById('viewCustomerSubtitle').textContent = customer.id;
  document.getElementById('viewCustomerBody').innerHTML = `
    <div class="detail-item"><span class="d-label">Customer Name</span><span class="d-value">${customer.name}</span></div>
    <div class="detail-item"><span class="d-label">Mobile Number</span><span class="d-value">${customer.mobile}</span></div>
    <div class="detail-item"><span class="d-label">Email</span><span class="d-value">${customer.email || '—'}</span></div>
    <div class="detail-item"><span class="d-label">City</span><span class="d-value">${customer.city || '—'}</span></div>
    <div class="detail-item"><span class="d-label">State</span><span class="d-value">${customer.state || '—'}</span></div>
    <div class="detail-item"><span class="d-label">GST Number</span><span class="d-value">${customer.gst || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Customer Type</span><span class="d-value">${customer.type}</span></div>
    <div class="detail-item"><span class="d-label">Channel Partner</span><span class="d-value">${customer.channelPartner || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Status</span><span class="d-value">${customer.status}</span></div>
    <div class="detail-item full"><span class="d-label">Address</span><span class="d-value">${customer.address || '—'}</span></div>
    <div class="detail-item full"><span class="d-label">Project Location</span><span class="d-value">${customer.project || '—'}</span></div>
    <div class="detail-item"><span class="d-label">Created Date</span><span class="d-value">${formatDateDisplay(customer.created)}</span></div>
  `;
  viewCustomerModal.classList.remove('hidden');
}
function closeViewCustomer() { viewCustomerModal.classList.add('hidden'); }
document.getElementById('viewCustomerCloseBtn')?.addEventListener('click', closeViewCustomer);
document.getElementById('viewCustomerCloseBtn2')?.addEventListener('click', closeViewCustomer);
viewCustomerModal?.addEventListener('click', (e) => { if (e.target === viewCustomerModal) closeViewCustomer(); });

/* ============================================================
   Delete Customer modal
   ============================================================ */
const deleteModal = document.getElementById('deleteModal');
let pendingDeleteId = null;

function openDeleteModal(customer) {
  pendingDeleteId = customer.id;
  document.getElementById('deleteCustomerName').textContent = `${customer.name} · ${customer.id}`;
  deleteModal.classList.remove('hidden');
}
function closeDeleteModal() { deleteModal.classList.add('hidden'); pendingDeleteId = null; }
document.getElementById('deleteModalCloseBtn')?.addEventListener('click', closeDeleteModal);
document.getElementById('deleteCancelBtn')?.addEventListener('click', closeDeleteModal);
deleteModal?.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

document.getElementById('deleteConfirmBtn')?.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  customers = customers.filter(c => c.id !== pendingDeleteId);
  followups = followups.filter(f => f.customerId !== pendingDeleteId);
  delete historyData[pendingDeleteId];
  showToast('Customer deleted');
  closeDeleteModal();
  renderAll();
});

/* ============================================================
   Table row action wiring (view / edit / delete / quote)
   ============================================================ */
document.getElementById('customerTbody')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.stopPropagation();
  const id = btn.getAttribute('data-id');
  const customer = customers.find(c => c.id === id);
  if (!customer) return;
  const action = btn.getAttribute('data-action');
  if (action === 'view') openViewCustomer(customer);
  else if (action === 'edit') openCustomerForm('edit', customer);
  else if (action === 'delete') openDeleteModal(customer);
  else if (action === 'quote') showToast(`Quotation flow started for ${customer.name}`);
});

/* ============================================================
   Customer History accordion
   ============================================================ */
function renderHistory() {
  const list = document.getElementById('historyList');
  const entries = Object.keys(historyData).filter(id => customers.some(c => c.id === id));

  if (entries.length === 0) {
    list.innerHTML = `<p style="font-size:12.5px;color:#9CA3AF;padding:8px 2px;">No history recorded yet.</p>`;
    return;
  }

  list.innerHTML = entries.map(id => {
    const customer = customers.find(c => c.id === id);
    const items = historyData[id];
    return `
      <div class="history-card" data-id="${id}">
        <div class="history-card-head" data-toggle="${id}">
          <div>
            <p class="history-card-name">${customer ? customer.name : id}</p>
            <p class="history-card-sub">${id} · ${items.length} activities</p>
          </div>
          <svg class="history-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="history-card-body">
          <ul class="history-timeline">
            ${items.map(it => `<li><span class="history-dot"></span><span>${it.label}<span class="h-when">${it.when}</span></span></li>`).join('')}
          </ul>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-toggle]').forEach(head => {
    head.addEventListener('click', () => {
      head.closest('.history-card').classList.toggle('open');
    });
  });
}

/* ============================================================
   Follow-up section
   ============================================================ */
function renderFollowups() {
  const tbody = document.getElementById('followupTbody');
  if (followups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:24px 8px;">No follow-up activities yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = followups.map(f => {
    const customer = customers.find(c => c.id === f.customerId);
    return `
      <tr>
        <td data-label="Follow-up Date">${formatDateDisplay(f.date)}</td>
        <td data-label="Customer">${customer ? customer.name : f.customerId}</td>
        <td data-label="Remarks">${f.remark || '—'}</td>
        <td data-label="Next Follow-up Date">${formatDateDisplay(f.next)}</td>
        <td data-label="Status"><span class="pill ${followupPillClass[f.status]}">${f.status}</span></td>
      </tr>`;
  }).join('');
}

const followupModal = document.getElementById('followupModal');
function openFollowupModal() {
  buildFuCustomerDropdown(customers[0] ? customers[0].id : null);
  document.getElementById('fuDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('fuNextDate').value = '';
  document.getElementById('fuRemark').value = '';
  document.getElementById('fuStatus').value = 'Pending';
  fuStatusCtrl?.setValue('Pending');
  followupModal.classList.remove('hidden');
}
function closeFollowupModal() { followupModal.classList.add('hidden'); }

document.getElementById('addFollowupBtn')?.addEventListener('click', () => {
  if (customers.length === 0) {
    showToast('Add a customer first');
    return;
  }
  openFollowupModal();
});
document.getElementById('followupCloseBtn')?.addEventListener('click', closeFollowupModal);
document.getElementById('followupCancelBtn')?.addEventListener('click', closeFollowupModal);
followupModal?.addEventListener('click', (e) => { if (e.target === followupModal) closeFollowupModal(); });

document.getElementById('followupSaveBtn')?.addEventListener('click', () => {
  const customerId = document.getElementById('fuCustomer').value;
  const date = document.getElementById('fuDate').value;
  if (!customerId || !date) {
    showToast('Customer and date are required');
    return;
  }
  followups.unshift({
    customerId,
    date,
    remark: document.getElementById('fuRemark').value.trim(),
    next: document.getElementById('fuNextDate').value,
    status: document.getElementById('fuStatus').value,
  });
  closeFollowupModal();
  renderFollowups();
  showToast('Follow-up added');
});

/* ============================================================
   Export / Print
   ============================================================ */
function customersToCsvRows() {
  const showChannelPartner = window.currentUserRole === 'SUPER_ADMIN';
  const header = ['Customer ID', 'Name', 'Mobile', 'Email', 'City', 'Type', 'Project Location', 'Status', 'Created Date'];
  if (showChannelPartner) header.push('Channel Partner');
  const rows = filteredCustomers().map(c => {
    const row = [c.id, c.name, c.mobile, c.email, c.city, c.type, c.project, c.status, c.created];
    if (showChannelPartner) row.push(c.channelPartner || '');
    return row;
  });
  return [header, ...rows];
}
function downloadDelimited(filename, mime) {
  const rows = customersToCsvRows();
  const content = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// NEW: Export PDF placeholder function
function exportCustomersPDF() {
  // TODO: backend call for PDF generation
  showToast('PDF export will be available soon');
}

document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
  downloadDelimited('customers.csv', 'text/csv');
  showToast('Exported customers.csv');
});
document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
  downloadDelimited('customers.xls', 'application/vnd.ms-excel');
  showToast('Exported customers.xls');
});
document.getElementById('exportPdfBtn')?.addEventListener('click', exportCustomersPDF);
document.getElementById('printBtn')?.addEventListener('click', () => {
  window.print();
});

/* ============================================================
   Render all
   ============================================================ */
function renderAll() {
  // Set current user role from session
  window.currentUserRole = window.currentUserRole || 'SUPER_ADMIN';
  window.currentUserPartnerName = window.currentUserPartnerName || 'CP-0001';
  
  renderSummary();
  renderTable();
  renderHistory();
  renderFollowups();
}

renderAll();