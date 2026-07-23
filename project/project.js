// ============================================================
// Sidebar collapse / expand (same behaviour as dashboard.js)
// ============================================================
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleIcon = document.getElementById("toggleIcon");
let expanded = false;

sidebarToggle?.addEventListener("click", () => {
  expanded = !expanded;
  sidebar.classList.toggle("expanded", expanded);
  sidebar.classList.toggle("collapsed", !expanded);
  toggleIcon.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
});

document.querySelectorAll(".nav-list .nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-list .nav-item").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
  });
});

// ============================================================
// Topbar dropdowns (same behaviour as dashboard.js)
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
profileLogoutBtn?.addEventListener("click", () => showToast("Logged out"));

/* ---------------- Toast helper (same as dashboard.js) ---------------- */
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-animate bg-gray-800 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatINR(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// ============================================================
// Dummy project data — no backend
// ============================================================
let projects = [
  { id: 'PRJ-1001', name: 'Sharma Residence Rooftop', customer: 'Amit Sharma', type: 'Residential', capacity: 5, roofType: 'RCC', monthlyConsumption: 450, location: 'Pune, Maharashtra', roofArea: 400, estimatedGeneration: 600, installationType: 'Rooftop', status: 'In Progress', createdDate: '2026-07-15', remarks: 'Customer prefers black panels.' },
  { id: 'PRJ-1000', name: 'Priya Enterprises Office', customer: 'Priya Enterprises', type: 'Commercial', capacity: 10, roofType: 'Metal Sheet', monthlyConsumption: 1200, location: 'Nashik, Maharashtra', roofArea: 900, estimatedGeneration: 1300, installationType: 'Rooftop', status: 'Completed', createdDate: '2026-07-14', remarks: 'Net metering already approved.' },
  { id: 'PRJ-0999', name: 'Ravi Constructions Site Office', customer: 'Ravi Constructions', type: 'Commercial', capacity: 5, roofType: 'Tin Shed', monthlyConsumption: 520, location: 'Nagpur, Maharashtra', roofArea: 420, estimatedGeneration: 610, installationType: 'Rooftop', status: 'On Hold', createdDate: '2026-07-14', remarks: 'Waiting on customer approval for financing.' },
  { id: 'PRJ-0998', name: 'Meena Textiles Unit 2', customer: 'Meena Textiles', type: 'Industrial', capacity: 25, roofType: 'Metal Sheet', monthlyConsumption: 3200, location: 'Aurangabad, Maharashtra', roofArea: 2100, estimatedGeneration: 3300, installationType: 'Rooftop', status: 'Completed', createdDate: '2026-07-13', remarks: '' },
  { id: 'PRJ-0997', name: 'Suresh Patel Bungalow', customer: 'Suresh Patel', type: 'Residential', capacity: 4, roofType: 'RCC', monthlyConsumption: 380, location: 'Pune, Maharashtra', roofArea: 320, estimatedGeneration: 480, installationType: 'Rooftop', status: 'Planning', createdDate: '2026-07-12', remarks: 'Site survey scheduled next week.' },
  { id: 'PRJ-0996', name: 'Global Foods Cold Storage', customer: 'Global Foods Pvt Ltd', type: 'Industrial', capacity: 50, roofType: 'Metal Sheet', monthlyConsumption: 6800, location: 'Kolhapur, Maharashtra', roofArea: 4200, estimatedGeneration: 6500, installationType: 'Ground Mounted', status: 'Completed', createdDate: '2026-07-12', remarks: 'Includes battery backup for cold room.' },
  { id: 'PRJ-0995', name: 'Anita Deshmukh Villa', customer: 'Anita Deshmukh', type: 'Residential', capacity: 3, roofType: 'Tile', monthlyConsumption: 310, location: 'Satara, Maharashtra', roofArea: 260, estimatedGeneration: 360, installationType: 'Rooftop', status: 'On Hold', createdDate: '2026-07-11', remarks: 'Roof reinforcement needed before install.' },
  { id: 'PRJ-0994', name: 'Rajesh Traders Warehouse', customer: 'Rajesh Traders', type: 'Commercial', capacity: 7, roofType: 'Metal Sheet', monthlyConsumption: 780, location: 'Pune, Maharashtra', roofArea: 560, estimatedGeneration: 860, installationType: 'Rooftop', status: 'In Progress', createdDate: '2026-07-11', remarks: '' },
  { id: 'PRJ-0993', name: 'Sunrise Apartments Common Area', customer: 'Sunrise Apartments', type: 'Commercial', capacity: 15, roofType: 'RCC', monthlyConsumption: 1900, location: 'Mumbai, Maharashtra', roofArea: 1200, estimatedGeneration: 1950, installationType: 'Rooftop', status: 'Completed', createdDate: '2026-07-10', remarks: 'Shared billing across 24 flats.' },
  { id: 'PRJ-0992', name: 'Vikram Industries Plant 2', customer: 'Vikram Industries', type: 'Industrial', capacity: 30, roofType: 'Metal Sheet', monthlyConsumption: 4100, location: 'Chakan, Maharashtra', roofArea: 2600, estimatedGeneration: 3900, installationType: 'Ground Mounted', status: 'On Hold', createdDate: '2026-07-09', remarks: 'Land clearance pending from local authority.' },
  { id: 'PRJ-0991', name: 'Kavita Rao Home', customer: 'Kavita Rao', type: 'Residential', capacity: 3, roofType: 'RCC', monthlyConsumption: 300, location: 'Pune, Maharashtra', roofArea: 250, estimatedGeneration: 355, installationType: 'Rooftop', status: 'Completed', createdDate: '2026-07-08', remarks: '' },
  { id: 'PRJ-0990', name: 'Deepak Motors Showroom', customer: 'Deepak Motors', type: 'Commercial', capacity: 20, roofType: 'Metal Sheet', monthlyConsumption: 2600, location: 'Pune, Maharashtra', roofArea: 1500, estimatedGeneration: 2550, installationType: 'Rooftop', status: 'In Progress', createdDate: '2026-07-08', remarks: 'Showroom lighting load included.' },
  { id: 'PRJ-0989', name: 'Farha Textiles Unit 1', customer: 'Farha Textiles', type: 'Industrial', capacity: 6, roofType: 'Tin Shed', monthlyConsumption: 640, location: 'Solapur, Maharashtra', roofArea: 500, estimatedGeneration: 720, installationType: 'Rooftop', status: 'Planning', createdDate: '2026-07-07', remarks: '' },
  { id: 'PRJ-0988', name: 'Nikhil Joshi Duplex', customer: 'Nikhil Joshi', type: 'Residential', capacity: 4, roofType: 'RCC', monthlyConsumption: 390, location: 'Thane, Maharashtra', roofArea: 330, estimatedGeneration: 470, installationType: 'Rooftop', status: 'Completed', createdDate: '2026-07-06', remarks: '' },
  { id: 'PRJ-0987', name: 'Star Cold Storage Facility', customer: 'Star Cold Storage', type: 'Industrial', capacity: 40, roofType: 'Metal Sheet', monthlyConsumption: 5400, location: 'Nashik, Maharashtra', roofArea: 3400, estimatedGeneration: 5200, installationType: 'Ground Mounted', status: 'In Progress', createdDate: '2026-07-05', remarks: 'Phase 1 of 2 — cold room block A.' },
];

const TYPE_PILL_CLASS = { 'Residential': 'type-pill-residential', 'Commercial': 'type-pill-commercial', 'Industrial': 'type-pill-industrial' };
const STATUS_PILL_CLASS = { 'Planning': 'pill-planning', 'In Progress': 'pill-inprogress', 'Completed': 'pill-completed', 'On Hold': 'pill-onhold' };

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
};

/* ---- Cost rate per kW by project type (dummy assumptions for the details card) ---- */
const COST_RATE_PER_KW = { 'Residential': 55000, 'Commercial': 48000, 'Industrial': 42000 };
const WATTS_PER_PANEL = 340;

function panelCount(capacityKw) { return Math.ceil((capacityKw * 1000) / WATTS_PER_PANEL); }
function projectCost(capacityKw, type) { return capacityKw * (COST_RATE_PER_KW[type] || 50000); }
function estimatedAnnualUnits(monthlyGeneration) { return monthlyGeneration * 12; }

// ============================================================
// State
// ============================================================
let sortKey = 'createdDate';
let sortDir = 'desc';
let currentPage = 1;
let rowsPerPage = 8;
let searchProjectName = '';
let searchCustomerName = '';
let searchLocation = '';
let statusFilter = '';

let formMode = 'add'; // 'add' | 'edit'
let editingProjectId = null;
let deleteTargetId = null;

// ============================================================
// KPIs
// ============================================================
function renderKpis() {
  document.getElementById('kpiTotalProjects').textContent = projects.length;
  document.getElementById('kpiResidential').textContent = projects.filter(p => p.type === 'Residential').length;
  document.getElementById('kpiCommercial').textContent = projects.filter(p => p.type === 'Commercial').length;
  document.getElementById('kpiIndustrial').textContent = projects.filter(p => p.type === 'Industrial').length;
}

// ============================================================
// Filtering + sorting
// ============================================================
function filteredProjects() {
  const nameTerm = searchProjectName.trim().toLowerCase();
  const custTerm = searchCustomerName.trim().toLowerCase();
  const locTerm = searchLocation.trim().toLowerCase();
  return projects.filter((p) => {
    const matchesName = !nameTerm || p.name.toLowerCase().includes(nameTerm);
    const matchesCustomer = !custTerm || p.customer.toLowerCase().includes(custTerm);
    const matchesLocation = !locTerm || p.location.toLowerCase().includes(locTerm);
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesName && matchesCustomer && matchesLocation && matchesStatus;
  });
}

function sortedProjects() {
  const list = filteredProjects();
  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'createdDate') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    else if (sortKey === 'capacity' || sortKey === 'monthlyConsumption' || sortKey === 'estimatedGeneration') { /* numeric already */ }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

// ============================================================
// Table render
// ============================================================
const projectsTbody = document.getElementById('projectsTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const emptyState = document.getElementById('emptyState');

function actionIconsHtml(id) {
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>
      <button class="action-icon-btn icon-edit" data-action="edit" data-id="${id}" title="Edit">${ICONS.edit}</button>
      <button class="action-icon-btn icon-delete" data-action="delete" data-id="${id}" title="Delete">${ICONS.delete}</button>
    </div>`;
}

function renderTable() {
  const data = sortedProjects();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  emptyState.classList.toggle('hidden', totalRows !== 0);
  projectsTbody.closest('table').style.display = totalRows === 0 ? 'none' : '';

  projectsTbody.innerHTML = pageRows.map((p) => `
    <tr data-id="${p.id}">
      <td data-label="Project ID" class="font-medium">${p.id}</td>
      <td data-label="Project Name">${p.name}</td>
      <td data-label="Customer">${p.customer}</td>
      <td data-label="Type"><span class="type-pill ${TYPE_PILL_CLASS[p.type]}">${p.type}</span></td>
      <td data-label="Capacity (kW)">${p.capacity} kW</td>
      <td data-label="Roof Type">${p.roofType}</td>
      <td data-label="Monthly Consumption">${p.monthlyConsumption} units</td>
      <td data-label="Location">${p.location}</td>
      <td data-label="Est. Generation">${p.estimatedGeneration} units</td>
      <td data-label="Status"><span class="pill ${STATUS_PILL_CLASS[p.status]}">${p.status}</span></td>
      <td data-label="Created Date">${formatDate(p.createdDate)}</td>
      <td data-label="Actions">${actionIconsHtml(p.id)}</td>
    </tr>
  `).join('');

  rowsRangeLabel.textContent = totalRows === 0
    ? 'No records'
    : `${start + 1}–${Math.min(start + rowsPerPage, totalRows)} of ${totalRows}`;

  renderPagination(totalPages);
  updateSortIcons();
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
  document.querySelectorAll('#projectsTable thead th[data-key]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    const key = th.getAttribute('data-key');
    th.classList.toggle('sorted', key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#projectsTable thead th[data-key]').forEach(th => {
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

// ============================================================
// Search & filter wiring
// ============================================================
const searchProjectNameInput = document.getElementById('searchProjectName');
const searchCustomerNameInput = document.getElementById('searchCustomerName');
const searchLocationInput = document.getElementById('searchLocation');
const filterStatus = document.getElementById('filterStatus');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

searchProjectNameInput?.addEventListener('input', () => { searchProjectName = searchProjectNameInput.value; currentPage = 1; renderTable(); });
searchCustomerNameInput?.addEventListener('input', () => { searchCustomerName = searchCustomerNameInput.value; currentPage = 1; renderTable(); });
searchLocationInput?.addEventListener('input', () => { searchLocation = searchLocationInput.value; currentPage = 1; renderTable(); });
filterStatus?.addEventListener('change', () => { statusFilter = filterStatus.value; currentPage = 1; renderTable(); });
resetFiltersBtn?.addEventListener('click', () => {
  searchProjectName = ''; searchCustomerName = ''; searchLocation = ''; statusFilter = '';
  searchProjectNameInput.value = ''; searchCustomerNameInput.value = ''; searchLocationInput.value = ''; filterStatus.value = '';
  currentPage = 1;
  renderTable();
});

// ============================================================
// Modal open/close helpers
// ============================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.classList.add('hidden'));
});

// ============================================================
// Add / Edit Project form
// ============================================================
const projectFormTitle = document.getElementById('projectFormTitle');
const projectFormSubtitle = document.getElementById('projectFormSubtitle');
const projectForm = document.getElementById('projectForm');
const projectFormError = document.getElementById('projectFormError');
const projectFormSaveBtn = document.getElementById('projectFormSaveBtn');

const fld = {
  name: document.getElementById('fldProjectName'),
  customer: document.getElementById('fldCustomer'),
  type: document.getElementById('fldType'),
  capacity: document.getElementById('fldCapacity'),
  roofType: document.getElementById('fldRoofType'),
  monthlyConsumption: document.getElementById('fldMonthlyConsumption'),
  location: document.getElementById('fldLocation'),
  roofArea: document.getElementById('fldRoofArea'),
  estimatedGeneration: document.getElementById('fldEstimatedGeneration'),
  status: document.getElementById('fldStatus'),
  remarks: document.getElementById('fldRemarks'),
};

function resetProjectForm() {
  projectForm.reset();
  projectFormError.classList.add('hidden');
}

function openAddProjectModal() {
  formMode = 'add';
  editingProjectId = null;
  resetProjectForm();
  projectFormTitle.textContent = 'Add Project';
  projectFormSubtitle.textContent = 'Create a new solar project';
  projectFormSaveBtn.textContent = 'Save';
  openModal('projectFormModal');
}

function openEditProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  formMode = 'edit';
  editingProjectId = id;
  resetProjectForm();
  projectFormTitle.textContent = 'Edit Project';
  projectFormSubtitle.textContent = `${p.id} · Update project details`;
  projectFormSaveBtn.textContent = 'Update';

  fld.name.value = p.name;
  fld.customer.value = p.customer;
  fld.type.value = p.type;
  fld.capacity.value = p.capacity;
  fld.roofType.value = p.roofType;
  fld.monthlyConsumption.value = p.monthlyConsumption;
  fld.location.value = p.location;
  fld.roofArea.value = p.roofArea;
  fld.estimatedGeneration.value = p.estimatedGeneration;
  fld.status.value = p.status;
  fld.remarks.value = p.remarks || '';

  openModal('projectFormModal');
}

document.getElementById('addProjectBtn')?.addEventListener('click', openAddProjectModal);

function nextProjectId() {
  const maxNum = projects.reduce((max, p) => {
    const n = parseInt(p.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 1000);
  return `PRJ-${maxNum + 1}`;
}

function showFormError(msg) {
  projectFormError.textContent = msg;
  projectFormError.classList.remove('hidden');
}

projectFormSaveBtn?.addEventListener('click', () => {
  projectFormError.classList.add('hidden');

  const name = fld.name.value.trim();
  const customer = fld.customer.value.trim();
  const type = fld.type.value;
  const capacity = parseFloat(fld.capacity.value);
  const roofType = fld.roofType.value;
  const monthlyConsumption = parseFloat(fld.monthlyConsumption.value) || 0;
  const location = fld.location.value.trim();
  const roofArea = parseFloat(fld.roofArea.value) || 0;
  const estimatedGeneration = parseFloat(fld.estimatedGeneration.value) || 0;
  const status = fld.status.value;
  const remarks = fld.remarks.value.trim();

  if (!name || !customer || !location || !capacity || capacity <= 0) {
    showFormError('Please fill in project name, customer, location and a valid capacity.');
    return;
  }

  if (formMode === 'add') {
    const newProject = {
      id: nextProjectId(),
      name, customer, type, capacity, roofType, monthlyConsumption, location,
      roofArea, estimatedGeneration, installationType: 'Rooftop', status, remarks,
      createdDate: new Date().toISOString().slice(0, 10),
    };
    projects.unshift(newProject);
    showToast(`Project "${newProject.name}" added`);
  } else {
    const p = projects.find(x => x.id === editingProjectId);
    if (!p) return;
    p.name = name; p.customer = customer; p.type = type; p.capacity = capacity;
    p.roofType = roofType; p.monthlyConsumption = monthlyConsumption; p.location = location;
    p.roofArea = roofArea; p.estimatedGeneration = estimatedGeneration; p.status = status; p.remarks = remarks;
    showToast(`Project "${p.name}" updated`);
  }

  closeModal('projectFormModal');
  sortKey = 'createdDate'; sortDir = 'desc'; currentPage = 1;
  renderKpis();
  renderTable();
});

// ============================================================
// View Project modal
// ============================================================
function openViewProjectModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;

  document.getElementById('viewProjectSubtitle').textContent = `${p.id} · Read-only`;
  document.getElementById('viewId').textContent = p.id;
  document.getElementById('viewName').textContent = p.name;
  document.getElementById('viewCustomer').textContent = p.customer;
  document.getElementById('viewType').textContent = p.type;
  document.getElementById('viewCapacity').textContent = `${p.capacity} kW`;
  document.getElementById('viewRoofType').textContent = p.roofType;
  document.getElementById('viewMonthlyConsumption').textContent = `${p.monthlyConsumption} units`;
  document.getElementById('viewLocation').textContent = p.location;
  document.getElementById('viewRoofArea').textContent = p.roofArea ? `${p.roofArea} sq ft` : '—';
  document.getElementById('viewEstimatedGeneration').textContent = `${p.estimatedGeneration} units/month`;
  document.getElementById('viewStatus').textContent = p.status;
  document.getElementById('viewCreatedDate').textContent = formatDate(p.createdDate);
  document.getElementById('viewRemarks').textContent = p.remarks && p.remarks.trim() ? p.remarks : 'No remarks added.';

  // ---- Project Details card ----
  document.getElementById('pdCapacity').textContent = `${p.capacity} kW`;
  document.getElementById('pdPanelCount').textContent = `${panelCount(p.capacity)} panels`;
  document.getElementById('pdEstimatedUnits').textContent = `${estimatedAnnualUnits(p.estimatedGeneration).toLocaleString('en-IN')} units/yr`;
  document.getElementById('pdInstallationType').textContent = p.installationType || 'Rooftop';
  document.getElementById('pdProjectCost').textContent = formatINR(projectCost(p.capacity, p.type));

  openModal('viewProjectModal');
}

// ============================================================
// Delete Project modal
// ============================================================
function openDeleteModal(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  document.getElementById('deleteProjectName').textContent = p.name;
  openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
  const p = projects.find(x => x.id === deleteTargetId);
  if (!p) return;
  projects = projects.filter(x => x.id !== deleteTargetId);
  closeModal('deleteModal');
  showToast(`Project "${p.name}" deleted`);
  currentPage = 1;
  renderKpis();
  renderTable();
});

// ============================================================
// Row action wiring
// ============================================================
projectsTbody?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  e.stopPropagation();
  const id = actionBtn.getAttribute('data-id');
  const action = actionBtn.getAttribute('data-action');
  if (action === 'view') openViewProjectModal(id);
  else if (action === 'edit') openEditProjectModal(id);
  else if (action === 'delete') openDeleteModal(id);
});

// ============================================================
// Init
// ============================================================
renderKpis();
renderTable();