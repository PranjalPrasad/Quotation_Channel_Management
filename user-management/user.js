// ============================================================
// Sidebar collapse / expand (same behaviour as dashboard.js,
// including the mobile/tablet overlay drawer + backdrop)
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

  // Below the lg breakpoint the sidebar becomes an overlay drawer,
  // so show/hide the tap-outside-to-close backdrop with it.
  if (window.innerWidth <= 1023 && sidebarBackdrop) {
    sidebarBackdrop.classList.toggle("visible", expanded);
    sidebarBackdrop.classList.toggle("hidden", !expanded);
  }
}

sidebarToggle?.addEventListener("click", () => setSidebarExpanded(!expanded));
sidebarBackdrop?.addEventListener("click", () => setSidebarExpanded(false));

// Collapse the drawer automatically if the viewport grows past the
// mobile/tablet breakpoint while it's open (e.g. device rotation).
window.addEventListener("resize", () => {
  if (window.innerWidth > 1023 && sidebarBackdrop) {
    sidebarBackdrop.classList.remove("visible");
    sidebarBackdrop.classList.add("hidden");
  }
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

function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

// ============================================================
// Dummy user data — no backend
// ============================================================
let users = [
  { id: 'USR-1001', name: 'Barly Vallendito', email: 'barly@sqms.com', phone: '98200 11234', username: 'barly.v', role: 'Admin', department: 'Management', status: 'Active', createdDate: '2025-11-02', photo: null },
  { id: 'USR-1002', name: 'Rahul Mehta', email: 'rahul.mehta@sqms.com', phone: '98765 43210', username: 'rahul.mehta', role: 'Manager', department: 'Sales', status: 'Active', createdDate: '2025-12-14', photo: null },
  { id: 'USR-1003', name: 'Sneha Kulkarni', email: 'sneha.k@sqms.com', phone: '99887 65432', username: 'sneha.k', role: 'Sales Executive', department: 'Sales', status: 'Active', createdDate: '2026-01-08', photo: null },
  { id: 'USR-1004', name: 'Owais Sheikh', email: 'owais.sheikh@sqms.com', phone: '96543 21098', username: 'owais.sheikh', role: 'Sales Executive', department: 'Sales', status: 'Inactive', createdDate: '2026-01-20', photo: null },
  { id: 'USR-1005', name: 'Priya Nair', email: 'priya.nair@sqms.com', phone: '97654 32109', username: 'priya.nair', role: 'Manager', department: 'Operations', status: 'Active', createdDate: '2026-02-03', photo: null },
  { id: 'USR-1006', name: 'Amit Sharma', email: 'amit.sharma@sqms.com', phone: '98123 45670', username: 'amit.sharma', role: 'Sales Executive', department: 'Sales', status: 'Active', createdDate: '2026-02-19', photo: null },
  { id: 'USR-1007', name: 'Farha Sheikh', email: 'farha.sheikh@sqms.com', phone: '95432 10987', username: 'farha.sheikh', role: 'Sales Executive', department: 'Support', status: 'Inactive', createdDate: '2026-03-05', photo: null },
  { id: 'USR-1008', name: 'Vikram Rao', email: 'vikram.rao@sqms.com', phone: '99001 12233', username: 'vikram.rao', role: 'Admin', department: 'Management', status: 'Active', createdDate: '2026-03-22', photo: null },
  { id: 'USR-1009', name: 'Meena Iyer', email: 'meena.iyer@sqms.com', phone: '90807 06050', username: 'meena.iyer', role: 'Manager', department: 'Finance', status: 'Active', createdDate: '2026-04-11', photo: null },
  { id: 'USR-1010', name: 'Deepak Joshi', email: 'deepak.joshi@sqms.com', phone: '91234 56789', username: 'deepak.joshi', role: 'Sales Executive', department: 'Sales', status: 'Active', createdDate: '2026-04-27', photo: null },
  { id: 'USR-1011', name: 'Anita Deshmukh', email: 'anita.d@sqms.com', phone: '93456 78901', username: 'anita.d', role: 'Sales Executive', department: 'Support', status: 'Inactive', createdDate: '2026-05-09', photo: null },
  { id: 'USR-1012', name: 'Suresh Patel', email: 'suresh.patel@sqms.com', phone: '94567 89012', username: 'suresh.patel', role: 'Manager', department: 'Operations', status: 'Active', createdDate: '2026-05-30', photo: null },
  { id: 'USR-1013', name: 'Kavita Rao', email: 'kavita.rao@sqms.com', phone: '95678 90123', username: 'kavita.rao', role: 'Sales Executive', department: 'Sales', status: 'Active', createdDate: '2026-06-14', photo: null },
  { id: 'USR-1014', name: 'Nikhil Joshi', email: 'nikhil.joshi@sqms.com', phone: '96789 01234', username: 'nikhil.joshi', role: 'Admin', department: 'Management', status: 'Active', createdDate: '2026-06-28', photo: null },
  { id: 'USR-1015', name: 'Rajesh Traders', email: 'rajesh.t@sqms.com', phone: '97890 12345', username: 'rajesh.t', role: 'Sales Executive', department: 'Sales', status: 'Inactive', createdDate: '2026-07-05', photo: null },
  { id: 'USR-1016', name: 'Farha Textiles', email: 'farha.textiles@sqms.com', phone: '98901 23456', username: 'farha.textiles', role: 'Sales Executive', department: 'Support', status: 'Active', createdDate: '2026-07-18', photo: null },
];

const PERMISSIONS_BY_ROLE = {
  'Admin':           { Dashboard: true,  Customers: true,  Projects: true,  Reports: true,  Settings: true  },
  'Manager':         { Dashboard: true,  Customers: true,  Projects: true,  Reports: true,  Settings: false },
  'Sales Executive': { Dashboard: true,  Customers: true,  Projects: false, Reports: true,  Settings: false },
};

const ROLE_PILL_CLASS = { 'Admin': 'role-pill-admin', 'Manager': 'role-pill-manager', 'Sales Executive': 'role-pill-sales' };
const STATUS_PILL_CLASS = { 'Active': 'pill-active', 'Inactive': 'pill-inactive' };

const ICONS = {
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
};

// ============================================================
// State
// ============================================================
let sortKey = 'createdDate';
let sortDir = 'desc';
let currentPage = 1;
let rowsPerPage = 8;
let searchTerm = '';
let roleFilter = '';
let statusFilter = '';
let pendingPhotoDataUrl = null;

let formMode = 'add'; // 'add' | 'edit'
let editingUserId = null;
let deleteTargetId = null;
let resetTargetId = null;

// ============================================================
// KPIs
// ============================================================
function renderKpis() {
  document.getElementById('kpiTotalUsers').textContent = users.length;
  document.getElementById('kpiActiveUsers').textContent = users.filter(u => u.status === 'Active').length;
  document.getElementById('kpiInactiveUsers').textContent = users.filter(u => u.status === 'Inactive').length;
  document.getElementById('kpiAdminUsers').textContent = users.filter(u => u.role === 'Admin').length;
}

// ============================================================
// Filtering + sorting
// ============================================================
function filteredUsers() {
  const term = searchTerm.trim().toLowerCase();
  return users.filter((u) => {
    const matchesTerm = !term ||
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.phone.toLowerCase().includes(term);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesTerm && matchesRole && matchesStatus;
  });
}

function sortedUsers() {
  const list = filteredUsers();
  list.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'createdDate') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
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
const usersTbody = document.getElementById('usersTbody');
const paginationControls = document.getElementById('paginationControls');
const rowsRangeLabel = document.getElementById('rowsRangeLabel');
const rowsPerPageSelect = document.getElementById('rowsPerPage');
const emptyState = document.getElementById('emptyState');

function photoCellHtml(u) {
  if (u.photo) return `<img src="${u.photo}" class="table-avatar" alt="${u.name}">`;
  return `<div class="table-avatar-initials">${initials(u.name)}</div>`;
}

function actionIconsHtml(id) {
  return `
    <div class="row-actions">
      <button class="action-icon-btn icon-view" data-action="view" data-id="${id}" title="View">${ICONS.view}</button>
      <button class="action-icon-btn icon-edit" data-action="edit" data-id="${id}" title="Edit">${ICONS.edit}</button>
      <button class="action-icon-btn icon-reset" data-action="reset" data-id="${id}" title="Reset Password">${ICONS.reset}</button>
      <button class="action-icon-btn icon-delete" data-action="delete" data-id="${id}" title="Delete">${ICONS.delete}</button>
    </div>`;
}

function renderTable() {
  const data = sortedUsers();
  const totalRows = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = data.slice(start, start + rowsPerPage);

  emptyState.classList.toggle('hidden', totalRows !== 0);
  usersTbody.parentElement.style.display = totalRows === 0 ? 'none' : '';

  usersTbody.innerHTML = pageRows.map((u) => `
    <tr data-id="${u.id}">
      <td data-label="User ID" class="font-medium">${u.id}</td>
      <td data-label="Photo">${photoCellHtml(u)}</td>
      <td data-label="Name">${u.name}</td>
      <td data-label="Email">${u.email}</td>
      <td data-label="Phone">${u.phone}</td>
      <td data-label="Role"><span class="role-pill ${ROLE_PILL_CLASS[u.role]}">${u.role}</span></td>
      <td data-label="Department">${u.department}</td>
      <td data-label="Status"><span class="pill ${STATUS_PILL_CLASS[u.status]}">${u.status}</span></td>
      <td data-label="Created Date">${formatDate(u.createdDate)}</td>
      <td data-label="Actions">${actionIconsHtml(u.id)}</td>
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
  document.querySelectorAll('#usersTable thead th[data-key]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    const key = th.getAttribute('data-key');
    th.classList.toggle('sorted', key === sortKey);
    icon.textContent = key === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '⇅';
  });
}

document.querySelectorAll('#usersTable thead th[data-key]').forEach(th => {
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
const searchInput = document.getElementById('searchInput');
const filterRole = document.getElementById('filterRole');
const filterStatus = document.getElementById('filterStatus');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

searchInput?.addEventListener('input', () => { searchTerm = searchInput.value; currentPage = 1; renderTable(); });
filterRole?.addEventListener('change', () => { roleFilter = filterRole.value; currentPage = 1; renderTable(); });
filterStatus?.addEventListener('change', () => { statusFilter = filterStatus.value; currentPage = 1; renderTable(); });
resetFiltersBtn?.addEventListener('click', () => {
  searchTerm = ''; roleFilter = ''; statusFilter = '';
  searchInput.value = ''; filterRole.value = ''; filterStatus.value = '';
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
// Add / Edit User form
// ============================================================
const userFormModal = document.getElementById('userFormModal');
const userFormTitle = document.getElementById('userFormTitle');
const userFormSubtitle = document.getElementById('userFormSubtitle');
const userForm = document.getElementById('userForm');
const userFormError = document.getElementById('userFormError');
const userFormSaveBtn = document.getElementById('userFormSaveBtn');
const passwordGroup = document.getElementById('passwordGroup');
const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
const avatarPreview = document.getElementById('avatarPreview');
const fldPhotoInput = document.getElementById('fldPhotoInput');

const fld = {
  fullName: document.getElementById('fldFullName'),
  email: document.getElementById('fldEmail'),
  phone: document.getElementById('fldPhone'),
  username: document.getElementById('fldUsername'),
  password: document.getElementById('fldPassword'),
  confirmPassword: document.getElementById('fldConfirmPassword'),
  role: document.getElementById('fldRole'),
  department: document.getElementById('fldDepartment'),
  status: document.getElementById('fldStatus'),
};

function resetUserForm() {
  userForm.reset();
  userFormError.classList.add('hidden');
  avatarPreview.innerHTML = 'U';
  pendingPhotoDataUrl = null;
  fldPhotoInput.value = '';
}

function openAddUserModal() {
  formMode = 'add';
  editingUserId = null;
  resetUserForm();
  userFormTitle.textContent = 'Add User';
  userFormSubtitle.textContent = 'Create a new system user';
  passwordGroup.style.display = '';
  confirmPasswordGroup.style.display = '';
  userFormSaveBtn.textContent = 'Save';
  openModal('userFormModal');
}

function openEditUserModal(id) {
  const u = users.find(x => x.id === id);
  if (!u) return;
  formMode = 'edit';
  editingUserId = id;
  resetUserForm();
  userFormTitle.textContent = 'Edit User';
  userFormSubtitle.textContent = `${u.id} · Update user details`;
  passwordGroup.style.display = 'none';
  confirmPasswordGroup.style.display = 'none';
  userFormSaveBtn.textContent = 'Update';

  fld.fullName.value = u.name;
  fld.email.value = u.email;
  fld.phone.value = u.phone;
  fld.username.value = u.username;
  fld.role.value = u.role;
  fld.department.value = u.department;
  fld.status.value = u.status;

  if (u.photo) { avatarPreview.innerHTML = `<img src="${u.photo}" alt="${u.name}">`; pendingPhotoDataUrl = u.photo; }
  else { avatarPreview.textContent = initials(u.name); pendingPhotoDataUrl = null; }

  openModal('userFormModal');
}

document.getElementById('addUserBtn')?.addEventListener('click', openAddUserModal);

fldPhotoInput?.addEventListener('change', () => {
  const file = fldPhotoInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingPhotoDataUrl = reader.result;
    avatarPreview.innerHTML = `<img src="${pendingPhotoDataUrl}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});

function nextUserId() {
  const maxNum = users.reduce((max, u) => {
    const n = parseInt(u.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 1000);
  return `USR-${maxNum + 1}`;
}

function showFormError(msg) {
  userFormError.textContent = msg;
  userFormError.classList.remove('hidden');
}

userFormSaveBtn?.addEventListener('click', () => {
  userFormError.classList.add('hidden');

  const name = fld.fullName.value.trim();
  const email = fld.email.value.trim();
  const phone = fld.phone.value.trim();
  const username = fld.username.value.trim();
  const role = fld.role.value;
  const department = fld.department.value.trim() || '—';
  const status = fld.status.value;

  if (!name || !email || !phone || !username) {
    showFormError('Please fill in all required fields.');
    return;
  }

  if (formMode === 'add') {
    const password = fld.password.value;
    const confirmPassword = fld.confirmPassword.value;
    if (!password || password.length < 6) {
      showFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showFormError('Passwords do not match.');
      return;
    }
    const newUser = {
      id: nextUserId(),
      name, email, phone, username, role, department, status,
      createdDate: new Date().toISOString().slice(0, 10),
      photo: pendingPhotoDataUrl,
    };
    users.unshift(newUser);
    showToast(`User ${newUser.name} added`);
  } else {
    const u = users.find(x => x.id === editingUserId);
    if (!u) return;
    u.name = name; u.email = email; u.phone = phone; u.username = username;
    u.role = role; u.department = department; u.status = status;
    if (pendingPhotoDataUrl !== null) u.photo = pendingPhotoDataUrl;
    showToast(`User ${u.name} updated`);
  }

  closeModal('userFormModal');
  sortKey = 'createdDate'; sortDir = 'desc'; currentPage = 1;
  renderKpis();
  renderTable();
  renderPermissionCards();
});

// ============================================================
// View User modal
// ============================================================
function openViewUserModal(id) {
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('viewUserSubtitle').textContent = `${u.id} · Read-only`;
  document.getElementById('viewId').textContent = u.id;
  document.getElementById('viewName').textContent = u.name;
  document.getElementById('viewEmail').textContent = u.email;
  document.getElementById('viewPhone').textContent = u.phone;
  document.getElementById('viewUsername').textContent = u.username;
  document.getElementById('viewRole').textContent = u.role;
  document.getElementById('viewDepartment').textContent = u.department;
  document.getElementById('viewStatus').textContent = u.status;
  document.getElementById('viewCreatedDate').textContent = formatDate(u.createdDate);

  const viewAvatar = document.getElementById('viewAvatarPreview');
  if (u.photo) viewAvatar.innerHTML = `<img src="${u.photo}" alt="${u.name}">`;
  else viewAvatar.textContent = initials(u.name);

  openModal('viewUserModal');
}

// ============================================================
// Delete User modal
// ============================================================
function openDeleteModal(id) {
  const u = users.find(x => x.id === id);
  if (!u) return;
  deleteTargetId = id;
  document.getElementById('deleteUserName').textContent = u.name;
  openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
  const u = users.find(x => x.id === deleteTargetId);
  if (!u) return;
  users = users.filter(x => x.id !== deleteTargetId);
  closeModal('deleteModal');
  showToast(`User ${u.name} deleted`);
  currentPage = 1;
  renderKpis();
  renderTable();
  renderPermissionCards();
});

// ============================================================
// Reset Password modal
// ============================================================
const resetPasswordError = document.getElementById('resetPasswordError');

function openResetPasswordModal(id) {
  const u = users.find(x => x.id === id);
  if (!u) return;
  resetTargetId = id;
  document.getElementById('resetPasswordSubtitle').textContent = `${u.id} · ${u.name}`;
  document.getElementById('fldNewPassword').value = '';
  document.getElementById('fldConfirmNewPassword').value = '';
  resetPasswordError.classList.add('hidden');
  openModal('resetPasswordModal');
}

document.getElementById('confirmResetBtn')?.addEventListener('click', () => {
  const u = users.find(x => x.id === resetTargetId);
  if (!u) return;
  const pw = document.getElementById('fldNewPassword').value;
  const cpw = document.getElementById('fldConfirmNewPassword').value;
  if (!pw || pw.length < 6) {
    resetPasswordError.textContent = 'Password must be at least 6 characters.';
    resetPasswordError.classList.remove('hidden');
    return;
  }
  if (pw !== cpw) {
    resetPasswordError.textContent = 'Passwords do not match.';
    resetPasswordError.classList.remove('hidden');
    return;
  }
  closeModal('resetPasswordModal');
  showToast(`Password reset for ${u.name}`);
});

// ============================================================
// Row action wiring
// ============================================================
usersTbody?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  e.stopPropagation();
  const id = actionBtn.getAttribute('data-id');
  const action = actionBtn.getAttribute('data-action');
  if (action === 'view') openViewUserModal(id);
  else if (action === 'edit') openEditUserModal(id);
  else if (action === 'reset') openResetPasswordModal(id);
  else if (action === 'delete') openDeleteModal(id);
});

// ============================================================
// Roles & Permissions cards
// ============================================================
function renderPermissionCards() {
  const container = document.getElementById('permissionCards');
  if (!container) return;
  container.innerHTML = Object.entries(PERMISSIONS_BY_ROLE).map(([role, perms]) => {
    const count = users.filter(u => u.role === role).length;
    const rows = Object.entries(perms).map(([label, allowed]) => `
      <div class="permission-row">
        <span>${label}</span>
        <span class="${allowed ? 'permission-check' : 'permission-cross'}">${allowed ? ICONS.check : ICONS.cross}</span>
      </div>`).join('');
    return `
      <div class="permission-card">
        <div class="permission-card-header">
          <span class="permission-card-title">${role}</span>
          <span class="permission-card-count">${count} user${count === 1 ? '' : 's'}</span>
        </div>
        <div class="permission-list">${rows}</div>
      </div>`;
  }).join('');
}

// ============================================================
// Init
// ============================================================
renderKpis();
renderTable();
renderPermissionCards();