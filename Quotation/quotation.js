// ============================================================
// Quotation Management — single-module client-side logic (demo data only)
// ============================================================

/* ---------------- Company info (used in sidebar + invoice header) ---------------- */
const COMPANY = {
    name: 'SolarTech Renewables Pvt. Ltd.',
    address: '14, Industrial Estate Road, Pune, Maharashtra',
    phone: '+91 98765 43210',
    email: 'sales@solartechrenewables.in',
    gstin: '27ABCDE1234F1Z5',
    state: 'Maharashtra',
    logo: '../img/logo.png'
};

/* =====================================================================
   PM SURYA GHAR SUBSIDY CALCULATOR
   Official CFA (Central Financial Assistance) slabs as per MNRE /
   pmsuryaghar.gov.in (verified 2026). Keep this config in one place so
   it's easy to update if the government revises the slabs.
   ===================================================================== */
const SUBSIDY_CONFIG = {
    residentialPerKwUpto2: 30000,  // ₹30,000 per kW for the first 2 kW
    residentialThirdKw: 18000,     // ₹18,000 for the 3rd kW
    residentialMaxCap: 78000,      // capped at ₹78,000 for 3 kW and above
    ghsPerKw: 18000,                // Group Housing Society / RWA — ₹18,000/kW for common facilities
    ghsMaxKw: 500                   // GHS/RWA subsidy capped at 500 kW system size
};

/* Consumer Category + System Capacity -> Government Subsidy (₹).
   Commercial/Institutional consumers are NOT eligible for the central
   CFA subsidy under PM Surya Ghar (they can separately avail accelerated
   depreciation + GST input benefits, which this tool does not compute). */
function computeSubsidy(category, sizeKw) {
    sizeKw = Number(sizeKw) || 0;
    if (category === 'Commercial') return 0;
    if (category === 'GHS') return Math.min(sizeKw, SUBSIDY_CONFIG.ghsMaxKw) * SUBSIDY_CONFIG.ghsPerKw;
    // Residential (default)
    if (sizeKw <= 0) return 0;
    if (sizeKw <= 2) return sizeKw * SUBSIDY_CONFIG.residentialPerKwUpto2;
    if (sizeKw < 3) return (2 * SUBSIDY_CONFIG.residentialPerKwUpto2) + (sizeKw - 2) * SUBSIDY_CONFIG.residentialThirdKw;
    return SUBSIDY_CONFIG.residentialMaxCap;
}

/* ---------------- Savings / ROI assumptions ----------------
   Adjust these constants if your business uses different standard
   figures (e.g. a different grid emission factor for your state). */
const SAVINGS_CONFIG = {
    unitsPerKwPerDay: 4,       // avg. generation assumption
    panelDegradationPct: 0.5,  // annual panel output degradation
    co2FactorKgPerKwh: 0.82,   // India grid emission factor (kg CO2 / kWh)
    projectionYears: 25
};

/* Projects year-on-year savings across the panel's life, factoring in
   both tariff escalation (electricity gets costlier) and panel output
   degradation (panels generate slightly less each year). Returns the
   cumulative 25-year savings total plus total units generated. */
function computeMultiYearSavings(annualUnitsYear1, tariff, escalationPct) {
    let totalSavings = 0, totalUnits = 0;
    let units = annualUnitsYear1, rate = tariff;
    for (let y = 1; y <= SAVINGS_CONFIG.projectionYears; y++) {
        totalUnits += units;
        totalSavings += units * rate;
        units *= (1 - SAVINGS_CONFIG.panelDegradationPct / 100);
        rate *= (1 + (escalationPct || 0) / 100);
    }
    return { totalSavings, totalUnits };
}

/* =====================================================================
   SIDEBAR / TOPBAR CHROME
   This block is written to match the Dashboard page 1:1 — same element
   ids (sidebar, sidebarToggle, toggleIcon, sidebarBackdrop, notifBtn,
   notifDropdown, profileBtn, profileDropdown) and the same CSS classes
   (.sidebar.expanded / .sidebar-backdrop.visible / .topbar-dropdown).
   Previously this file referenced ids that don't exist in this page's
   HTML (sidebar-toggle, sidebar-overlay, mobile-menu-btn, notif-btn,
   notif-menu, user-menu-btn, user-menu, .dropdown-menu) — which is why
   the sidebar toggle and dropdowns did nothing and the page didn't
   behave like the Dashboard on load. Fixed below.
   ===================================================================== */
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const toggleIcon = document.getElementById('toggleIcon');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

let sidebarExpanded = false;

function isDrawerBreakpoint() {
    return window.innerWidth < 1024; // matches the CSS's @media (max-width: 1023px) drawer rule
}

function setSidebarExpanded(expand) {
    sidebarExpanded = expand;
    sidebar?.classList.toggle('expanded', expand);
    sidebar?.classList.toggle('collapsed', !expand);
    toggleIcon?.classList.toggle('rotate-180', expand);
    // The backdrop only makes sense on phone/tablet, where the sidebar
    // opens as an overlay drawer instead of pushing the layout.
    if (isDrawerBreakpoint()) {
        sidebarBackdrop?.classList.toggle('visible', expand);
    } else {
        sidebarBackdrop?.classList.remove('visible');
    }
}

// Start collapsed (icon rail), same as the Dashboard's default state
setSidebarExpanded(false);

sidebarToggle?.addEventListener('click', () => setSidebarExpanded(!sidebarExpanded));
sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));

// Tapping a nav item on phone/tablet should close the drawer behind it
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (isDrawerBreakpoint() && sidebarExpanded) setSidebarExpanded(false);
    });
});

// If the viewport grows past the drawer breakpoint while the drawer is
// open, drop the backdrop/overlay behaviour so it doesn't get stuck.
window.addEventListener('resize', () => {
    if (!isDrawerBreakpoint()) sidebarBackdrop?.classList.remove('visible');
});

/* ---------------- Topbar dropdowns (notification / profile) ---------------- */
function setupDropdown(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.topbar-dropdown').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
        menu?.classList.toggle('hidden');
    });
}
setupDropdown('notifBtn', 'notifDropdown');
setupDropdown('profileBtn', 'profileDropdown');
document.addEventListener('click', () => {
    document.querySelectorAll('.topbar-dropdown').forEach(m => m.classList.add('hidden'));
});

/* ---------------- Generic modal open/close ---------------- */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
    // Reopening the wizard should always start with a fresh quotation number
    if (id === 'modal-wizard') draftQuoteNo = null;
}

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
        if (e.target === ov) closeModal(ov.id);
    });
});

/* ---------------- Toasts ---------------- */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function formatINR(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

/* =====================================================================
   PRODUCT CATALOG — the wizard's Step 2 "Products & Items" picker reads
   the live product list published by the Product Management module
   (see /product/product.js -> syncProductCatalogToStorage) via
   localStorage. This keeps the two modules in sync on the client without
   a shared backend: add/edit/delete a product there, and it shows up
   here immediately (next time the picker is refreshed).

   FALLBACK_PRODUCTS is only used if Product Management hasn't run yet in
   this browser (e.g. very first visit, storage cleared, etc.) so the
   picker never shows up empty.
   ===================================================================== */
const PRODUCT_CATALOG_STORAGE_KEY = 'solarProductCatalog';

const FALLBACK_PRODUCTS = [
    { id: 'fallback-panel', name: 'Solar Panels', category: 'Solar Panel', brand: 'Monocrystalline', spec: '', unit: 'W', price: 22, stock: null, status: 'Active' },
    { id: 'fallback-inverter', name: 'Inverter', category: 'Inverter', brand: 'String', spec: '', unit: 'kW', price: 6500, stock: null, status: 'Active' },
    { id: 'fallback-structure', name: 'Mounting Structure', category: 'Mounting Structure', brand: 'RCC Roof', spec: '', unit: 'Panel', price: 900, stock: null, status: 'Active' },
    { id: 'fallback-battery', name: 'Batteries', category: 'Battery', brand: 'Lead Acid', spec: '', unit: 'AH', price: 12, stock: null, status: 'Active' },
    { id: 'fallback-cable', name: 'DC/AC Cable', category: 'Cable & Wiring', brand: 'Miscellaneous', spec: '', unit: 'Mtr', price: 50, stock: null, status: 'Active' },
    { id: 'fallback-breaker', name: 'Circuit Breakers', category: 'Accessory', brand: 'Miscellaneous', spec: '', unit: 'Pcs', price: 250, stock: null, status: 'Active' },
    { id: 'fallback-earthing', name: 'Earthing Kit', category: 'Accessory', brand: 'Safety', spec: '', unit: 'Set', price: 1800, stock: null, status: 'Active' },
    { id: 'fallback-netmeter', name: 'Net Meter', category: 'Accessory', brand: 'Metering', spec: '', unit: 'Unit', price: 3500, stock: null, status: 'Active' },
];

let itemIdCounter = 1;
function newItemId() { return 'it' + (itemIdCounter++); }

/* Reads the latest product catalog from Product Management (localStorage),
   filtered to Active products only. Falls back to a small built-in list
   so the picker is never empty on a fresh browser. */
function getProductCatalog() {
    try {
        const raw = localStorage.getItem(PRODUCT_CATALOG_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                const active = parsed.filter(p => p.status !== 'Inactive');
                if (active.length) return active;
            }
        }
    } catch (e) { /* ignore parse errors and fall back below */ }
    return FALLBACK_PRODUCTS;
}

/* Populates the Step 2 product-selection dropdown from the live catalog,
   grouped by category. Call this whenever the wizard is (re)opened so it
   reflects any changes made in Product Management since it was last built. */
function populateProductPicker() {
    const select = document.getElementById('product-catalog-select');
    if (!select) return;

    const catalog = getProductCatalog();
    window.__quotationProductCatalog = catalog;

    if (!catalog.length) {
        select.innerHTML = `<option value="">No products found — add some in Product Management</option>`;
        return;
    }

    const byCategory = {};
    catalog.forEach(p => {
        const cat = p.category || 'Other';
        (byCategory[cat] = byCategory[cat] || []).push(p);
    });

    select.innerHTML = `<option value="">Select a product to add…</option>` +
        Object.keys(byCategory).sort().map(cat => `
            <optgroup label="${escapeAttr(cat)}">
                ${byCategory[cat].map(p => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.name)}${p.brand ? ' — ' + escapeAttr(p.brand) : ''} · ₹${Number(p.price || 0).toLocaleString('en-IN')}/${escapeAttr(p.unit || 'Nos')}</option>`).join('')}
            </optgroup>
        `).join('');
}

document.getElementById('btn-add-catalog-product')?.addEventListener('click', () => {
    const select = document.getElementById('product-catalog-select');
    const qtyInput = document.getElementById('product-picker-qty');
    if (!select || !select.value) { showToast('Select a product first.', 'error'); return; }

    const catalog = window.__quotationProductCatalog || [];
    const p = catalog.find(c => String(c.id) === select.value);
    if (!p) return;

    const qty = parseFloat(qtyInput.value) || 1;
    wizardItems.push({
        id: newItemId(),
        name: p.name,
        type: [p.brand, p.spec].filter(Boolean).join(' · ') || p.category || '',
        qty,
        unit: p.unit || 'Nos',
        rate: Number(p.price) || 0
    });
    renderItemsTable();

    // Reset the picker so the next product can be selected and added
    select.value = '';
    qtyInput.value = 1;
    showToast(`${p.name} added to quotation`, 'success');
});

document.getElementById('chip-custom')?.addEventListener('click', () => {
    wizardItems.push({ id: newItemId(), name: '', type: '', qty: 1, unit: 'Pcs', rate: 0 });
    renderItemsTable();
});

/* ---------------- Items table (Step 2) ---------------- */
let wizardItems = [];

function itemsSubtotal(items) {
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
}

function renderItemsTable() {
    const tbody = document.getElementById('items-tbody');
    if (!wizardItems.length) {
        tbody.innerHTML = `<tr class="items-empty-row"><td colspan="8">No products added yet — pick one from the dropdown above to start building this quotation.</td></tr>`;
    } else {
        tbody.innerHTML = wizardItems.map((it, i) => `
            <tr data-id="${it.id}">
                <td>${i + 1}</td>
                <td class="item-name-cell"><input type="text" class="item-name" value="${escapeAttr(it.name)}" placeholder="Item name"></td>
                <td><input type="text" class="item-type" value="${escapeAttr(it.type)}" placeholder="Type / model"></td>
                <td><input type="number" class="item-qty" value="${it.qty}" min="0" step="any"></td>
                <td><input type="text" class="item-unit" value="${escapeAttr(it.unit)}" placeholder="Unit"></td>
                <td><input type="number" class="item-rate" value="${it.rate}" min="0" step="any"></td>
                <td class="item-amount-cell" id="amt-${it.id}">${formatINR((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
                <td class="item-remove-cell"><button type="button" class="btn-icon-sm item-remove" title="Remove"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    }

    // Wire per-row events
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
        const id = row.dataset.id;
        const item = wizardItems.find(i => i.id === id);
        row.querySelector('.item-name')?.addEventListener('input', e => { item.name = e.target.value; });
        row.querySelector('.item-type')?.addEventListener('input', e => { item.type = e.target.value; });
        row.querySelector('.item-unit')?.addEventListener('input', e => { item.unit = e.target.value; });
        row.querySelector('.item-qty')?.addEventListener('input', e => { item.qty = e.target.value; updateItemAmount(item); });
        row.querySelector('.item-rate')?.addEventListener('input', e => { item.rate = e.target.value; updateItemAmount(item); });
        row.querySelector('.item-remove')?.addEventListener('click', () => {
            wizardItems = wizardItems.filter(i => i.id !== id);
            renderItemsTable();
        });
    });

    updateItemsSubtotalDisplay();
}

function updateItemAmount(item) {
    const amt = (Number(item.qty) || 0) * (Number(item.rate) || 0);
    const cell = document.getElementById('amt-' + item.id);
    if (cell) cell.textContent = formatINR(amt);
    updateItemsSubtotalDisplay();
}

function updateItemsSubtotalDisplay() {
    const total = itemsSubtotal(wizardItems);
    const el = document.getElementById('items-subtotal');
    if (el) el.textContent = formatINR(total);
    const costItems = document.getElementById('cost-items');
    if (costItems) costItems.textContent = formatINR(total);
}

function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
}

/* =====================================================================
   QUOTATION DATA MODEL
   ===================================================================== */
function computeTotals(itemsTotal, costs, gstPercent, discountType, discountValue) {
    const subtotal = itemsTotal + (costs.installation || 0) + (costs.transport || 0) + (costs.other || 0);
    const discountAmount = discountType === 'percent' ? subtotal * ((discountValue || 0) / 100) : (discountValue || 0);
    const taxable = Math.max(0, subtotal - discountAmount);
    const sgst = taxable * (gstPercent / 2 / 100);
    const cgst = taxable * (gstPercent / 2 / 100);
    const total = taxable + sgst + cgst;
    return { subtotal, discountAmount, sgst, cgst, total };
}

function numberToWordsIndian(num) {
    num = Math.round(num);
    if (num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function twoDigits(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
    function threeDigits(n) { return n < 100 ? twoDigits(n) : ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : ''); }
    let result = '';
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000); num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    const rest = num;
    if (crore) result += threeDigits(crore) + ' Crore ';
    if (lakh) result += threeDigits(lakh) + ' Lakh ';
    if (thousand) result += threeDigits(thousand) + ' Thousand ';
    if (rest) result += threeDigits(rest);
    return result.trim() + ' Rupees Only';
}

let quoteCounter = 1000;
function nextQuoteNo() { quoteCounter += 1; return `SQ-${quoteCounter}`; }

function makeQuotation(overrides = {}) {
    const base = {
        quoteNo: nextQuoteNo(),
        date: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        customer: {
            name: '', company: '', mobile: '', email: '', address: '', city: '', state: '',
            pincode: '', consumerNo: '', consumerCategory: 'Residential', commercial: false, gst: ''
        },
        systemSizeKw: 3,
        systemSizeLabel: '3 kW',
        mounting: 'RCC Roof',
        items: itemsForSize(3),
        costs: { installation: 8000, transport: 2500, otherLabel: 'Other Charges', other: 0 },
        gstPercent: 18,
        discountType: 'percent',
        discountValue: 0,
        tariff: 8,
        escalation: 3,
        advance: 0
    };
    const merged = { ...base, ...overrides };
    merged.customer = { ...base.customer, ...(overrides.customer || {}) };
    merged.costs = { ...base.costs, ...(overrides.costs || {}) };
    if (overrides.items) merged.items = overrides.items;

    const itTotal = itemsSubtotal(merged.items);
    const totals = computeTotals(itTotal, merged.costs, merged.gstPercent, merged.discountType, merged.discountValue);
    Object.assign(merged, totals);
    merged.itemsTotal = itTotal;
    merged.amount = Math.round(totals.total);
    merged.balance = Math.round(totals.total - merged.advance);
    return attachSubsidyAndSavings(merged);
}

/* =====================================================================
   AUTOMATIC BOQ (BILL OF QUANTITY) GENERATION
   Standard per-kW ratios used to auto-populate the Products & Items
   table the moment a System Capacity is chosen. Items with a fixed
   quantity (earthing, net meter, accessory set) don't scale with size;
   everything else scales per kW. User can still freely edit/remove any
   row afterwards — this only sets sensible defaults.
   ===================================================================== */
const BOQ_TEMPLATE = [
    { name: 'Solar Panels', type: 'Monocrystalline', unit: 'W', rate: 22, qtyPerKw: 1100, fixedQty: null },
    { name: 'Inverter', type: 'String', unit: 'kW', rate: 6500, qtyPerKw: 1, fixedQty: null },
    { name: 'Mounting Structure', type: 'RCC Roof', unit: 'Panel', rate: 900, qtyPerKw: 2, fixedQty: null },
    { name: 'DC/AC Cable', type: 'Miscellaneous', unit: 'Mtr', rate: 50, qtyPerKw: 8.5, fixedQty: null },
    { name: 'Earthing Kit', type: 'Safety', unit: 'Set', rate: 1800, qtyPerKw: null, fixedQty: 2 },
    { name: 'Circuit Breakers & Accessories', type: 'Accessory', unit: 'Set', rate: 2500, qtyPerKw: null, fixedQty: 1 },
    { name: 'Net Meter', type: 'Accessory / Metering', unit: 'Unit', rate: 3500, qtyPerKw: null, fixedQty: 1 },
];

/* Auto-generates the BOQ items table for a given System Capacity (kW).
   Called whenever the wizard opens (default 3 kW) and whenever the
   System Size dropdown is changed — this is the "Automatic BOQ
   Generation" step. Installation Material/labor is tracked separately
   as a cost line in Step 3 (Cost Calculation). */
function itemsForSize(sizeKw) {
    sizeKw = Number(sizeKw) || 3;
    return BOQ_TEMPLATE.map(t => {
        const qty = t.fixedQty != null ? t.fixedQty : Math.max(1, Math.round(t.qtyPerKw * sizeKw));
        return { id: newItemId(), name: t.name, type: t.type, qty, unit: t.unit, rate: t.rate };
    });
}

let quotations = [
    makeQuotation({ customer: { name: 'Amit Sharma', mobile: '9876543210', email: 'amit.sharma@example.com', address: 'Plot 12, Kothrud', city: 'Pune', state: 'Maharashtra', pincode: '411038' }, status: 'Pending', date: '2026-07-15' }),
    makeQuotation({ customer: { name: 'Ramesh Traders', company: 'Ramesh Traders', mobile: '9876500001', email: 'ramesh.traders@example.com', address: 'MG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', commercial: true, gst: '24ABCDE5678F1Z2' }, systemSizeKw: 5, systemSizeLabel: '5 kW', items: itemsForSize(5), status: 'Accepted', date: '2026-07-14' }),
    makeQuotation({ customer: { name: 'Priya Nair', mobile: '9876500002', email: 'priya.nair@example.com', address: 'Marine Drive', city: 'Kochi', state: 'Karnataka', pincode: '682001' }, systemSizeKw: 2, systemSizeLabel: '2 kW', items: itemsForSize(2), status: 'Rejected', date: '2026-07-13' }),
    makeQuotation({ customer: { name: 'Suresh Patel', mobile: '9876500003', email: 'suresh.patel@example.com', address: 'Ring Road', city: 'Rajkot', state: 'Gujarat', pincode: '360001' }, systemSizeKw: 10, systemSizeLabel: '10 kW', items: itemsForSize(10), status: 'Pending', date: '2026-07-12' }),
    makeQuotation({ customer: { name: 'Neha Gupta', mobile: '9876500004', email: 'neha.gupta@example.com', address: 'Civil Lines', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' }, systemSizeKw: 1, systemSizeLabel: '1 kW', items: itemsForSize(1), status: 'Accepted', date: '2026-07-11' }),
    makeQuotation({ customer: { name: 'Vikas Enterprises', company: 'Vikas Enterprises', mobile: '9876500005', email: 'vikas.ent@example.com', address: 'Industrial Area', city: 'Delhi', state: 'Delhi', pincode: '110001', commercial: true, gst: '07ABCDE1111F1Z9' }, systemSizeKw: 20, systemSizeLabel: '20 kW', items: itemsForSize(20), status: 'Pending', date: '2026-07-10' }),
    makeQuotation({ customer: { name: 'Anjali Deshmukh', mobile: '9876500006', email: 'anjali.d@example.com', address: 'FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411005' }, status: 'Accepted', date: '2026-07-09' }),
    makeQuotation({ customer: { name: 'Rohit Verma', mobile: '9876500007', email: 'rohit.verma@example.com', address: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' }, systemSizeKw: 5, systemSizeLabel: '5 kW', items: itemsForSize(5), status: 'Rejected', date: '2026-07-08' }),
    makeQuotation({ customer: { name: 'Sneha Kulkarni', mobile: '9876500008', email: 'sneha.k@example.com', address: 'Deccan Gymkhana', city: 'Pune', state: 'Maharashtra', pincode: '411004' }, systemSizeKw: 2, systemSizeLabel: '2 kW', items: itemsForSize(2), status: 'Pending', date: '2026-07-07' }),
    makeQuotation({ customer: { name: 'Manoj Yadav', mobile: '9876500009', email: 'manoj.y@example.com', address: 'Hazratganj', city: 'Lucknow', state: 'Delhi', pincode: '226001' }, systemSizeKw: 10, systemSizeLabel: '10 kW', items: itemsForSize(10), status: 'Accepted', date: '2026-07-06' }),
];

/* =====================================================================
   TABLE: search / filter / sort / pagination / stats
   ===================================================================== */
let sortKey = null, sortDir = 1, currentPage = 1, rowsPerPage = 10;

function refreshSizeFilterOptions() {
    const sel = document.getElementById('filter-size');
    const current = sel.value;
    const sizes = [...new Set(quotations.map(q => q.systemSizeLabel))];
    sel.innerHTML = `<option value="">All Sizes</option>` + sizes.map(s => `<option value="${s}">${s}</option>`).join('');
    sel.value = sizes.includes(current) ? current : '';
}

function badgeClass(status) {
    if (status === 'Accepted') return 'badge-accepted';
    if (status === 'Rejected') return 'badge-rejected';
    return 'badge-pending';
}

function getFiltered() {
    const q = document.getElementById('search-input').value.trim().toLowerCase();
    const status = document.getElementById('filter-status').value;
    const size = document.getElementById('filter-size').value;
    let list = quotations.filter(row => {
        const matchesSearch = !q || row.customer.name.toLowerCase().includes(q) || row.quoteNo.toLowerCase().includes(q);
        const matchesStatus = !status || row.status === status;
        const matchesSize = !size || row.systemSizeLabel === size;
        return matchesSearch && matchesStatus && matchesSize;
    });
    if (sortKey) {
        list = [...list].sort((a, b) => {
            const map = { quoteNo: a.quoteNo, customer: a.customer.name, size: a.systemSizeLabel, amount: a.amount, status: a.status, date: a.date };
            const mapB = { quoteNo: b.quoteNo, customer: b.customer.name, size: b.systemSizeLabel, amount: b.amount, status: b.status, date: b.date };
            let va = map[sortKey], vb = mapB[sortKey];
            if (sortKey === 'amount') { va = Number(va); vb = Number(vb); }
            if (va < vb) return -1 * sortDir;
            if (va > vb) return 1 * sortDir;
            return 0;
        });
    }
    return list;
}

function updateStats() {
    document.getElementById('stat-total').textContent = quotations.length;
    const todayStr = new Date().toISOString().slice(0, 10);
    document.getElementById('stat-today').textContent = quotations.filter(q => q.date === todayStr).length;
    document.getElementById('stat-value').textContent = formatINR(quotations.reduce((s, q) => s + q.amount, 0));
    document.getElementById('stat-accepted').textContent = quotations.filter(q => q.status === 'Accepted').length;
    document.getElementById('stat-rejected').textContent = quotations.filter(q => q.status === 'Rejected').length;
    document.getElementById('stat-pending').textContent = quotations.filter(q => q.status === 'Pending').length;
}

function buildPaginationButtons(totalPages) {
    // Show all pages up to 7; beyond that, collapse the middle with an ellipsis
    const pages = [];
    if (totalPages <= 7) {
        for (let p = 1; p <= totalPages; p++) pages.push(p);
    } else {
        pages.push(1);
        if (currentPage > 4) pages.push('...');
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let p = start; p <= end; p++) pages.push(p);
        if (currentPage < totalPages - 3) pages.push('...');
        pages.push(totalPages);
    }
    return pages;
}

function renderTable() {
    updateStats();
    refreshSizeFilterOptions();
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * rowsPerPage;
    const pageRows = filtered.slice(start, start + rowsPerPage);

    const tbody = document.getElementById('quotation-tbody');
    tbody.innerHTML = pageRows.map(row => `
        <tr>
            <td data-label="Quotation No."><b>${row.quoteNo}</b></td>
            <td data-label="Customer">${row.customer.name || '—'}</td>
            <td data-label="System Size">${row.systemSizeLabel}</td>
            <td data-label="Amount">${formatINR(row.amount)}</td>
            <td data-label="Status"><span class="badge ${badgeClass(row.status)}">${row.status}</span></td>
            <td data-label="Date">${new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
            <td data-label="Actions" class="text-right">
                <div class="action-icons">
                    <button class="icon-action-btn" title="View" data-action="view" data-quote="${row.quoteNo}"><i class="fas fa-eye"></i></button>
                    <button class="icon-action-btn" title="Edit" data-action="edit" data-quote="${row.quoteNo}"><i class="fas fa-pen"></i></button>
                    <button class="icon-action-btn danger" title="Delete" data-action="delete" data-quote="${row.quoteNo}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">No quotations match your filters.</td></tr>`;

    // Range text ("Showing 1-10 of 34")
    const rangeEl = document.getElementById('table-range');
    if (rangeEl) {
        rangeEl.textContent = filtered.length
            ? `· Showing ${start + 1}-${Math.min(start + rowsPerPage, filtered.length)} of ${filtered.length}`
            : '· No results';
    }

    const pagination = document.getElementById('pagination');
    const pageList = buildPaginationButtons(totalPages);
    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
    pageList.forEach(p => {
        if (p === '...') { html += `<span class="ellipsis">…</span>`; }
        else { html += `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`; }
    });
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
    pagination.innerHTML = html;
    pagination.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => { currentPage = Number(btn.dataset.page); renderTable(); });
    });

    tbody.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const quote = quotations.find(q => q.quoteNo === btn.dataset.quote);
            if (!quote) return;
            if (btn.dataset.action === 'view') openViewModal(quote);
            if (btn.dataset.action === 'edit') openEditModal(quote);
            if (btn.dataset.action === 'delete') openDeleteModal(quote);
        });
    });
}

['search-input', 'filter-status', 'filter-size'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { currentPage = 1; renderTable(); });
});
document.getElementById('rows-per-page').addEventListener('change', (e) => {
    rowsPerPage = Number(e.target.value);
    currentPage = 1;
    renderTable();
});
document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        sortDir = (sortKey === key) ? -sortDir : 1;
        sortKey = key;
        renderTable();
    });
});

/* =====================================================================
   INVOICE MARKUP (shared by wizard preview + view modal)
   ===================================================================== */
function buildInvoiceMarkup(q) {
    const items = (q.items || []).map(it => ({
        name: it.name || '—', type: it.type || '—', qty: it.qty, unit: it.unit || '—',
        rate: it.rate, amount: (Number(it.qty) || 0) * (Number(it.rate) || 0)
    }));
    if (q.costs.installation) items.push({ name: 'Installation', type: 'Labor Cost', qty: 1, unit: 'Job', rate: q.costs.installation, amount: q.costs.installation });
    if (q.costs.transport) items.push({ name: 'Transportation', type: 'Logistics', qty: 1, unit: 'Job', rate: q.costs.transport, amount: q.costs.transport });
    if (q.costs.other) items.push({ name: q.costs.otherLabel || 'Other Charges', type: 'Other', qty: 1, unit: '—', rate: q.costs.other, amount: q.costs.other });

    const rowsHtml = items.map((item, i) => `
        <tr>
            <td>${i + 1}</td><td>${item.name}</td><td>${item.type}</td>
            <td class="num">${item.qty}</td><td>${item.unit}</td>
            <td class="num">${formatINR(item.rate)}</td><td class="num">0</td>
            <td class="num">${q.gstPercent}%</td><td class="num">${formatINR(item.amount)}</td>
        </tr>
    `).join('');

    const badgeCls = badgeClass(q.status);

    return `
        <div class="inv-header">
            <div class="inv-company">
                <div class="inv-company-name">${COMPANY.name}</div>
                <div>Address: ${COMPANY.address}</div>
                <div>Phone No.: ${COMPANY.phone}</div>
                <div>Email ID: ${COMPANY.email}</div>
                <div>GSTIN: ${COMPANY.gstin}</div>
                <div>State: ${COMPANY.state}</div>
            </div>
            <img src="${COMPANY.logo}" alt="Company Logo" class="inv-logo" crossorigin="anonymous">
        </div>
        <div class="inv-title">Quotation</div>
        <div class="inv-parties">
            <div class="inv-bill-to">
                <div class="inv-label">Bill To:</div>
                <div>Name: ${q.customer.name || '—'}</div>
                <div>Address: ${q.customer.address || '—'}${q.customer.city ? ', ' + q.customer.city : ''}</div>
                <div>Contact No.: ${q.customer.mobile || '—'}</div>
                <div>GSTIN No.: ${q.customer.gst || '—'}</div>
                <div>State: ${q.customer.state || '—'}</div>
                <span class="badge ${badgeCls} inv-status">${q.status}</span>
            </div>
            <div class="inv-meta">
                <div><span>Quotation No.:</span> <b>${q.quoteNo}</b></div>
                <div><span>Quotation Date:</span> <b>${new Date(q.date).toLocaleDateString('en-GB')}</b></div>
                <div><span>System Size:</span> <b>${q.systemSizeLabel}</b></div>
            </div>
        </div>
        <table class="inv-items-table">
            <thead><tr><th>#</th><th>Item</th><th>Type</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Dis</th><th>GST</th><th>Amount</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="inv-totals">
            <div class="inv-words">
                <div class="inv-label">Amount in Words:</div>
                <div>${numberToWordsIndian(q.total)}</div>
                <div class="inv-terms">
                    <div class="inv-label">Terms & Conditions</div>
                    <div class="terms-text">1. Prices valid for 15 days. 2. 50% advance required to confirm order. 3. Delivery within 3–4 weeks of advance payment.</div>
                </div>
            </div>
            <table class="inv-totals-table">
                <tr><td>Sub Total</td><td>${formatINR(q.subtotal)}</td></tr>
                <tr><td>Discount</td><td>${formatINR(q.discountAmount)}</td></tr>
                <tr><td>SGST</td><td>${formatINR(q.sgst)}</td></tr>
                <tr><td>CGST</td><td>${formatINR(q.cgst)}</td></tr>
                <tr class="total-row"><td>Total</td><td>${formatINR(q.total)}</td></tr>
                <tr><td>Advance</td><td>${formatINR(q.advance)}</td></tr>
                <tr><td>Balance</td><td>${formatINR(q.total - q.advance)}</td></tr>
            </table>
        </div>
        <div class="inv-totals" style="margin-top:14px;">
            <div class="inv-words">
                <div class="inv-label">PM Surya Ghar Subsidy Calculator</div>
                <table class="inv-totals-table" style="min-width:100%;">
                    <tr><td>Consumer Category</td><td>${q.customer.consumerCategory === 'GHS' ? 'Group Housing Society / RWA' : (q.customer.consumerCategory || 'Residential')}</td></tr>
                    <tr><td>System Capacity</td><td>${q.systemSizeLabel}</td></tr>
                    <tr><td>Government Subsidy</td><td>${formatINR(q.subsidy || 0)}</td></tr>
                    <tr class="total-row"><td>Net Investment / Customer Payable</td><td>${formatINR(q.netInvestment != null ? q.netInvestment : Math.max(0, q.total - (q.subsidy || 0)))}</td></tr>
                </table>
            </div>
            <div class="inv-words">
                <div class="inv-label">Savings Calculator</div>
                <table class="inv-totals-table" style="min-width:100%;">
                    <tr><td>Annual Generation</td><td>${Math.round(q.annualUnits || 0).toLocaleString('en-IN')} kWh</td></tr>
                    <tr><td>Monthly Savings</td><td>${formatINR(q.monthlySavings || 0)}</td></tr>
                    <tr><td>Annual Savings</td><td>${formatINR(q.annualSavings || 0)}</td></tr>
                    <tr><td>25-Year Savings Estimate</td><td>${formatINR(q.savings25yr || 0)}</td></tr>
                    <tr><td>Carbon Reduction (25 yrs)</td><td>${(q.carbon25yrTonnes || 0).toFixed(1)} tCO₂</td></tr>
                    <tr><td>ROI (Annual)</td><td>${(q.roiPercent || 0).toFixed(1)}%</td></tr>
                    <tr class="total-row"><td>Payback Period</td><td>${(q.paybackYears || 0).toFixed(1)} years</td></tr>
                </table>
            </div>
        </div>
        <div class="inv-seal">Company Seal & Signature</div>
    `;
}

/* ---------------- PDF download (used by wizard "Generate" + view modal + share buttons) ---------------- */
function downloadInvoicePDF(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element || typeof html2pdf === 'undefined') {
        showToast('PDF library failed to load. Check your internet connection.', 'error');
        return Promise.resolve();
    }
    const opt = {
        margin: 8,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    return html2pdf().set(opt).from(element).save();
}

/* =====================================================================
   VIEW MODAL (read-only)
   ===================================================================== */
let viewingQuoteNo = null;

function openViewModal(q) {
    viewingQuoteNo = q.quoteNo;
    document.getElementById('view-invoice-preview').innerHTML = buildInvoiceMarkup(q);
    openModal('modal-view');
}

document.getElementById('btn-view-download-pdf').addEventListener('click', () => {
    if (!viewingQuoteNo) return;
    downloadInvoicePDF('view-invoice-preview', `${viewingQuoteNo}.pdf`);
});

/* =====================================================================
   EDIT MODAL (essential fields only)
   ===================================================================== */
let editingQuoteNo = null;

function openEditModal(q) {
    editingQuoteNo = q.quoteNo;
    document.getElementById('edit-quoteno').textContent = q.quoteNo;
    document.getElementById('edit-customerName').value = q.customer.name;
    document.getElementById('edit-mobile').value = q.customer.mobile;
    document.getElementById('edit-email').value = q.customer.email;
    document.getElementById('edit-installation').value = q.costs.installation;
    document.getElementById('edit-transport').value = q.costs.transport;
    document.getElementById('edit-discountValue').value = q.discountValue;
    document.getElementById('edit-status').value = q.status;
    ['err-edit-customerName', 'err-edit-mobile', 'err-edit-email'].forEach(id => document.getElementById(id).textContent = '');
    updateEditSummary();
    openModal('modal-edit');
}

function updateEditSummary() {
    const q = quotations.find(x => x.quoteNo === editingQuoteNo);
    if (!q) return;
    const installation = parseFloat(document.getElementById('edit-installation').value) || 0;
    const transport = parseFloat(document.getElementById('edit-transport').value) || 0;
    const discountValue = parseFloat(document.getElementById('edit-discountValue').value) || 0;
    const costs = { ...q.costs, installation, transport };
    const totals = computeTotals(q.itemsTotal, costs, q.gstPercent, q.discountType, discountValue);
    document.getElementById('edit-summary').innerHTML = `
        <div class="row"><span>Sub Total</span><b>${formatINR(totals.subtotal)}</b></div>
        <div class="row"><span>Discount</span><b>- ${formatINR(totals.discountAmount)}</b></div>
        <div class="row"><span>SGST + CGST</span><b>${formatINR(totals.sgst + totals.cgst)}</b></div>
        <div class="row total"><span>New Total</span><b>${formatINR(totals.total)}</b></div>
    `;
}
['edit-installation', 'edit-transport', 'edit-discountValue'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateEditSummary);
});

document.getElementById('btn-save-edit').addEventListener('click', () => {
    const q = quotations.find(x => x.quoteNo === editingQuoteNo);
    if (!q) return;

    const name = document.getElementById('edit-customerName').value.trim();
    const mobile = document.getElementById('edit-mobile').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    let valid = true;

    if (!name) { document.getElementById('err-edit-customerName').textContent = 'Required'; valid = false; }
    else document.getElementById('err-edit-customerName').textContent = '';

    if (!/^[6-9]\d{9}$/.test(mobile)) { document.getElementById('err-edit-mobile').textContent = 'Enter valid 10-digit mobile'; valid = false; }
    else document.getElementById('err-edit-mobile').textContent = '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-edit-email').textContent = 'Enter valid email'; valid = false; }
    else document.getElementById('err-edit-email').textContent = '';

    if (!valid) { showToast('Please fix the highlighted fields.', 'error'); return; }

    q.customer.name = name;
    q.customer.mobile = mobile;
    q.customer.email = email;
    q.costs.installation = parseFloat(document.getElementById('edit-installation').value) || 0;
    q.costs.transport = parseFloat(document.getElementById('edit-transport').value) || 0;
    q.discountValue = parseFloat(document.getElementById('edit-discountValue').value) || 0;
    q.status = document.getElementById('edit-status').value;

    const totals = computeTotals(q.itemsTotal, q.costs, q.gstPercent, q.discountType, q.discountValue);
    Object.assign(q, totals);
    q.amount = Math.round(totals.total);
    q.balance = Math.round(totals.total - q.advance);

    closeModal('modal-edit');
    renderTable();
    showToast(`${q.quoteNo} updated successfully`, 'success');
});

/* =====================================================================
   DELETE MODAL (confirmation)
   ===================================================================== */
let deletingQuoteNo = null;

function openDeleteModal(q) {
    deletingQuoteNo = q.quoteNo;
    document.getElementById('delete-quoteno').textContent = q.quoteNo;
    openModal('modal-delete');
}

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    quotations = quotations.filter(q => q.quoteNo !== deletingQuoteNo);
    closeModal('modal-delete');
    showToast(`${deletingQuoteNo} deleted`, 'success');
    renderTable();
});

/* =====================================================================
   NEW QUOTATION WIZARD (inside modal-wizard)
   ===================================================================== */
let currentStep = 1;
const totalWizardSteps = 6;

function resetWizardForm() {
    document.getElementById('f-customerName').value = '';
    document.getElementById('f-companyName').value = '';
    document.getElementById('f-mobile').value = '';
    document.getElementById('f-email').value = '';
    document.getElementById('f-address').value = '';
    document.getElementById('f-city').value = '';
    document.getElementById('f-state').value = '';
    document.getElementById('f-pincode').value = '';
    document.getElementById('f-consumerNo').value = '';
    document.getElementById('f-consumerCategory').value = 'Residential';
    document.getElementById('f-gst').value = '';
    document.getElementById('gst-field').classList.add('hidden');
    document.getElementById('f-systemSize').value = '3';
    document.getElementById('other-size-wrap').classList.add('hidden');

    // Reset mounting radio to default
    document.querySelectorAll('#mount-group .radio-card').forEach((card, i) => card.classList.toggle('active', i === 0));
    document.querySelectorAll('#mount-group input[type="radio"]').forEach((r, i) => r.checked = i === 0);

    // Reset products/items to the default preset for a 3 kW system
    wizardItems = itemsForSize(3);
    renderItemsTable();

    // Refresh the product picker from Product Management every time the
    // wizard opens, so newly added/edited products show up immediately.
    populateProductPicker();
    document.getElementById('product-picker-qty').value = 1;

    document.getElementById('cost-installation').value = 8000;
    document.getElementById('cost-transport').value = 2500;
    document.getElementById('cost-other').value = 0;
    document.getElementById('cost-other-label').value = 'Other Charges';
    document.getElementById('f-gstPercent').value = '18';
    document.getElementById('f-discountType').value = 'percent';
    document.getElementById('f-discountValue').value = 0;
    document.getElementById('f-tariff').value = 8;
    document.getElementById('f-escalation').value = 3;
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
    document.getElementById('share-grid').classList.add('hidden');
    document.getElementById('btn-generate').classList.remove('hidden');
    document.getElementById('btn-generate').disabled = false;
}

function openWizard() {
    draftQuoteNo = null;
    resetWizardForm();
    currentStep = 1;
    goToStep(1);
    openModal('modal-wizard');
}
document.getElementById('btn-new-quotation').addEventListener('click', openWizard);

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === step));
    document.querySelectorAll('.step').forEach(s => {
        const n = Number(s.dataset.step);
        s.classList.toggle('active', n === step);
        s.classList.toggle('done', n < step);
    });
    document.getElementById('btn-prev').disabled = step === 1;
    document.getElementById('btn-next').classList.toggle('hidden', step === totalWizardSteps);
    document.getElementById('btn-generate').classList.toggle('hidden', step !== totalWizardSteps);

    if (step === 2) populateProductPicker(); // pick up any catalog changes made mid-wizard too
    if (step === 3) computeCosts();
    if (step === 4) computeGstSummary();
    if (step === 5) computeSavings();
    if (step === 6) renderWizardPreview();
}

document.getElementById('btn-next').addEventListener('click', () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    goToStep(Math.min(currentStep + 1, totalWizardSteps));
});
document.getElementById('btn-prev').addEventListener('click', () => goToStep(Math.max(currentStep - 1, 1)));
document.querySelectorAll('#stepper .step').forEach(s => {
    s.addEventListener('click', () => {
        const n = Number(s.dataset.step);
        if (n < currentStep) goToStep(n);
    });
});

function markError(fieldId, errId, message) {
    const field = document.getElementById(fieldId);
    const err = document.getElementById(errId);
    if (message) { field.classList.add('invalid'); err.textContent = message; return false; }
    field.classList.remove('invalid'); err.textContent = ''; return true;
}

function validateStep1() {
    let ok = true;
    const name = document.getElementById('f-customerName').value.trim();
    ok = markError('f-customerName', 'err-customerName', name ? '' : 'Customer name is required') && ok;

    const mobile = document.getElementById('f-mobile').value.trim();
    ok = markError('f-mobile', 'err-mobile', /^[6-9]\d{9}$/.test(mobile) ? '' : 'Enter a valid 10-digit mobile number') && ok;

    const email = document.getElementById('f-email').value.trim();
    ok = markError('f-email', 'err-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address') && ok;

    const address = document.getElementById('f-address').value.trim();
    ok = markError('f-address', 'err-address', address ? '' : 'Installation address is required') && ok;

    const state = document.getElementById('f-state').value;
    ok = markError('f-state', 'err-state', state ? '' : 'Please select a state') && ok;

    const pincode = document.getElementById('f-pincode').value.trim();
    ok = markError('f-pincode', 'err-pincode', /^\d{6}$/.test(pincode) ? '' : 'Enter a valid 6-digit pincode') && ok;

    if (document.getElementById('f-consumerCategory').value === 'Commercial') {
        const gst = document.getElementById('f-gst').value.trim();
        ok = markError('f-gst', 'err-gst', /^[0-9A-Z]{15}$/i.test(gst) ? '' : 'Enter a valid 15-character GSTIN') && ok;
    }

    if (!ok) showToast('Please fix the highlighted fields.', 'error');
    return ok;
}

function validateStep2() {
    let ok = true;
    const errEl = document.getElementById('err-items');
    if (!wizardItems.length) {
        errEl.textContent = 'Add at least one product to this quotation.';
        ok = false;
    } else {
        const invalidRow = wizardItems.some(it => !it.name || !it.name.trim() || !(Number(it.qty) > 0));
        if (invalidRow) {
            errEl.textContent = 'Every product needs a name and a quantity/size greater than 0.';
            ok = false;
        } else {
            errEl.textContent = '';
        }
    }
    if (!ok) showToast('Please fix the highlighted fields.', 'error');
    return ok;
}

// Consumer Category -> reveal GST field for Commercial, and refresh the
// subsidy calculation (since eligibility/slab depends on category)
document.getElementById('f-consumerCategory').addEventListener('change', (e) => {
    document.getElementById('gst-field').classList.toggle('hidden', e.target.value !== 'Commercial');
    if (currentStep === 5) computeSavings();
});

/* ---------------- System Size dropdown with custom "Other" add ---------------- */
const sizeSelect = document.getElementById('f-systemSize');

/* Regenerates the BOQ for the newly selected capacity. If the user has
   already customised the items (added/removed/edited rows beyond the
   auto-generated defaults), ask for confirmation before overwriting —
   otherwise just regenerate silently (fresh wizard / first pick). */
function regenerateBoqForSelectedSize() {
    const kw = getSelectedSizeKw();
    const isDefaultSet = wizardItems.length === BOQ_TEMPLATE.length &&
        wizardItems.every((it, i) => it.name === BOQ_TEMPLATE[i].name);
    if (!isDefaultSet && wizardItems.length) {
        if (!confirm(`Regenerate the BOQ for ${getSelectedSizeLabel()}? This will replace your current product list with standard quantities for this capacity.`)) return;
    }
    wizardItems = itemsForSize(kw);
    renderItemsTable();
    showToast(`BOQ auto-generated for ${getSelectedSizeLabel()}`, 'success');
}

sizeSelect.addEventListener('change', () => {
    if (sizeSelect.value === '__other__') {
        document.getElementById('other-size-wrap').classList.remove('hidden');
        document.getElementById('f-otherSize').focus();
    } else {
        document.getElementById('other-size-wrap').classList.add('hidden');
        regenerateBoqForSelectedSize();
    }
});

document.getElementById('btn-add-size').addEventListener('click', () => {
    const input = document.getElementById('f-otherSize');
    const label = input.value.trim();
    if (!label) { showToast('Enter a system size to add.', 'error'); return; }
    const value = label.toLowerCase().replace(/\s+/g, '-');
    const otherOption = sizeSelect.querySelector('option[value="__other__"]');
    const newOption = document.createElement('option');
    newOption.value = value;
    newOption.dataset.custom = 'true';
    newOption.dataset.kw = parseFloat(label) || 3;
    newOption.textContent = label;
    sizeSelect.insertBefore(newOption, otherOption);
    sizeSelect.value = value;
    document.getElementById('other-size-wrap').classList.add('hidden');
    input.value = '';
    showToast(`Custom system size "${label}" added`, 'success');
    regenerateBoqForSelectedSize();
});

function getSelectedSizeLabel() {
    const opt = sizeSelect.options[sizeSelect.selectedIndex];
    return opt ? opt.textContent : '3 kW';
}
function getSelectedSizeKw() {
    const opt = sizeSelect.options[sizeSelect.selectedIndex];
    if (opt && opt.dataset.kw) return parseFloat(opt.dataset.kw);
    const val = sizeSelect.value;
    if (val === '__other__') return 3;
    const n = parseFloat(val);
    return isNaN(n) ? (parseFloat(getSelectedSizeLabel()) || 3) : n;
}

// Mounting structure highlight
document.querySelectorAll('#mount-group input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.querySelectorAll('.radio-card').forEach(card => card.classList.remove('active'));
        radio.closest('.radio-card').classList.add('active');
    });
});

/* ---------------- Cost Calculation (Step 3) ---------------- */
function computeCosts() {
    document.getElementById('cost-items').textContent = formatINR(itemsSubtotal(wizardItems));
}
['cost-installation', 'cost-transport', 'cost-other'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { if (currentStep === 4) computeGstSummary(); });
});

function getCostTotalsFromForm() {
    const installation = parseFloat(document.getElementById('cost-installation').value) || 0;
    const transport = parseFloat(document.getElementById('cost-transport').value) || 0;
    const otherLabel = document.getElementById('cost-other-label').value || 'Other Charges';
    const other = parseFloat(document.getElementById('cost-other').value) || 0;
    return { installation, transport, otherLabel, other };
}

/* ---------------- GST & Discount (Step 4) ---------------- */
function computeGstSummary() {
    const costs = getCostTotalsFromForm();
    const itTotal = itemsSubtotal(wizardItems);
    const gstPercent = parseFloat(document.getElementById('f-gstPercent').value) || 0;
    const discountType = document.getElementById('f-discountType').value;
    const discountValue = parseFloat(document.getElementById('f-discountValue').value) || 0;
    const totals = computeTotals(itTotal, costs, gstPercent, discountType, discountValue);

    document.getElementById('summary-gst').innerHTML = `
        <div class="row"><span>Items Subtotal</span><b>${formatINR(itTotal)}</b></div>
        <div class="row"><span>Additional Charges</span><b>${formatINR(costs.installation + costs.transport + costs.other)}</b></div>
        <div class="row"><span>Discount</span><b>- ${formatINR(totals.discountAmount)}</b></div>
        <div class="row"><span>SGST (${(gstPercent / 2).toFixed(1)}%)</span><b>${formatINR(totals.sgst)}</b></div>
        <div class="row"><span>CGST (${(gstPercent / 2).toFixed(1)}%)</span><b>${formatINR(totals.cgst)}</b></div>
        <div class="row total"><span>Total</span><b>${formatINR(totals.total)}</b></div>
    `;
    return { ...totals, gstPercent, costs, itemsTotal: itTotal };
}
['f-gstPercent', 'f-discountType', 'f-discountValue'].forEach(id => document.getElementById(id).addEventListener('input', computeGstSummary));

/* ---------------- PM Surya Ghar Subsidy + Savings Calculator (Step 5) ---------------- */
function computeSavings() {
    const category = document.getElementById('f-consumerCategory').value;
    const sizeKw = getSelectedSizeKw();
    const tariff = parseFloat(document.getElementById('f-tariff').value) || 0;
    const escalation = parseFloat(document.getElementById('f-escalation').value) || 0;
    const { total } = computeGstSummary();

    // ----- Subsidy Calculator -----
    const subsidy = computeSubsidy(category, sizeKw);
    const netInvestment = Math.max(0, total - subsidy);

    const categoryLabel = category === 'GHS' ? 'Group Housing Society / RWA' : category;
    const noteEl = document.getElementById('subsidy-category-note');
    if (noteEl) {
        noteEl.innerHTML = category === 'Commercial'
            ? '<i class="fas fa-circle-info"></i> Commercial / Institutional consumers are not eligible for the PM Surya Ghar central subsidy (CFA). They may separately avail accelerated depreciation and GST input benefits.'
            : `<i class="fas fa-circle-info"></i> Subsidy calculated per PM Surya Ghar official slabs for ${categoryLabel} consumers (MNRE, pmsuryaghar.gov.in).`;
    }

    document.getElementById('summary-subsidy').innerHTML = `
        <div class="row"><span>Consumer Category</span><b>${categoryLabel}</b></div>
        <div class="row"><span>System Capacity</span><b>${sizeKw} kW</b></div>
        <div class="row"><span>Total System Cost</span><b>${formatINR(total)}</b></div>
        <div class="row"><span>Government Subsidy</span><b>- ${formatINR(subsidy)}</b></div>
        <div class="row total"><span>Net Investment / Customer Payable Amount</span><b>${formatINR(netInvestment)}</b></div>
    `;

    // ----- Savings Calculator -----
    const annualUnits = sizeKw * SAVINGS_CONFIG.unitsPerKwPerDay * 365;
    const annualSavings = annualUnits * tariff;
    const monthlySavings = annualSavings / 12;

    const { totalSavings: savings25yr } = computeMultiYearSavings(annualUnits, tariff, escalation);
    const carbonPerYearKg = annualUnits * SAVINGS_CONFIG.co2FactorKgPerKwh;
    const carbon25yrTonnes = (carbonPerYearKg * SAVINGS_CONFIG.projectionYears) / 1000;

    const roiPercent = netInvestment > 0 ? (annualSavings / netInvestment) * 100 : 0;
    const paybackYears = annualSavings > 0 ? netInvestment / annualSavings : 0;

    document.getElementById('summary-savings').innerHTML = `
        <div class="row"><span>Estimated Annual Electricity Generation</span><b>${Math.round(annualUnits).toLocaleString('en-IN')} kWh</b></div>
        <div class="row"><span>Estimated Monthly Electricity Savings</span><b>${formatINR(monthlySavings)}</b></div>
        <div class="row"><span>Estimated Annual Savings (Year 1)</span><b>${formatINR(annualSavings)}</b></div>
        <div class="row"><span>25-Year Savings Estimate</span><b>${formatINR(savings25yr)}</b></div>
        <div class="row"><span>Carbon Emission Reduction (per year)</span><b>${(carbonPerYearKg / 1000).toFixed(2)} tCO₂</b></div>
        <div class="row"><span>Carbon Emission Reduction (25 years)</span><b>${carbon25yrTonnes.toFixed(1)} tCO₂</b></div>
        <div class="row"><span>Return on Investment (Annual)</span><b>${roiPercent.toFixed(1)}%</b></div>
        <div class="row total"><span>Payback Period</span><b>${paybackYears.toFixed(1)} years</b></div>
    `;

    return { subsidy, netInvestment, annualUnits, annualSavings, savings25yr, carbonPerYearKg, carbon25yrTonnes, roiPercent, paybackYears };
}
['f-tariff', 'f-escalation'].forEach(id => document.getElementById(id).addEventListener('input', computeSavings));

/* ---------------- Build draft record + render preview (Step 6) ---------------- */
function collectWizardRecord(quoteNo) {
    const costs = getCostTotalsFromForm();
    const itTotal = itemsSubtotal(wizardItems);
    const gstPercent = parseFloat(document.getElementById('f-gstPercent').value) || 0;
    const discountType = document.getElementById('f-discountType').value;
    const discountValue = parseFloat(document.getElementById('f-discountValue').value) || 0;
    const totals = computeTotals(itTotal, costs, gstPercent, discountType, discountValue);

    return {
        quoteNo,
        date: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        customer: {
            name: document.getElementById('f-customerName').value.trim(),
            company: document.getElementById('f-companyName').value.trim(),
            mobile: document.getElementById('f-mobile').value.trim(),
            email: document.getElementById('f-email').value.trim(),
            address: document.getElementById('f-address').value.trim(),
            city: document.getElementById('f-city').value.trim(),
            state: document.getElementById('f-state').value,
            pincode: document.getElementById('f-pincode').value.trim(),
            consumerNo: document.getElementById('f-consumerNo').value.trim(),
            consumerCategory: document.getElementById('f-consumerCategory').value,
            commercial: document.getElementById('f-consumerCategory').value === 'Commercial',
            gst: document.getElementById('f-gst').value.trim()
        },
        systemSizeKw: getSelectedSizeKw(),
        systemSizeLabel: getSelectedSizeLabel(),
        mounting: document.querySelector('#mount-group input:checked')?.closest('.radio-card')?.querySelector('span')?.textContent || 'RCC Roof',
        items: wizardItems.map(it => ({ ...it })),
        itemsTotal: itTotal,
        costs,
        gstPercent, discountType, discountValue,
        tariff: parseFloat(document.getElementById('f-tariff').value) || 0,
        escalation: parseFloat(document.getElementById('f-escalation').value) || 0,
        advance: 0,
        ...totals,
        amount: Math.round(totals.total),
        balance: Math.round(totals.total)
    };
}

/* Attaches the computed subsidy + savings figures (PM Surya Ghar
   Subsidy Calculator + Savings Calculator) onto a quotation record so
   they can be shown on the generated invoice/PDF. */
function attachSubsidyAndSavings(record) {
    const sizeKw = record.systemSizeKw;
    const subsidy = computeSubsidy(record.customer.consumerCategory, sizeKw);
    const netInvestment = Math.max(0, record.total - subsidy);
    const annualUnits = sizeKw * SAVINGS_CONFIG.unitsPerKwPerDay * 365;
    const annualSavings = annualUnits * record.tariff;
    const { totalSavings: savings25yr } = computeMultiYearSavings(annualUnits, record.tariff, record.escalation);
    const carbonPerYearKg = annualUnits * SAVINGS_CONFIG.co2FactorKgPerKwh;
    record.subsidy = subsidy;
    record.netInvestment = netInvestment;
    record.annualUnits = annualUnits;
    record.annualSavings = annualSavings;
    record.monthlySavings = annualSavings / 12;
    record.savings25yr = savings25yr;
    record.carbonPerYearKg = carbonPerYearKg;
    record.carbon25yrTonnes = (carbonPerYearKg * SAVINGS_CONFIG.projectionYears) / 1000;
    record.roiPercent = netInvestment > 0 ? (annualSavings / netInvestment) * 100 : 0;
    record.paybackYears = annualSavings > 0 ? netInvestment / annualSavings : 0;
    return record;
}

let draftQuoteNo = null;

function renderWizardPreview() {
    draftQuoteNo = draftQuoteNo || nextQuoteNo();
    const record = attachSubsidyAndSavings(collectWizardRecord(draftQuoteNo));
    document.getElementById('invoice-preview').innerHTML = buildInvoiceMarkup(record);
}

document.getElementById('btn-generate').addEventListener('click', () => {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    const record = attachSubsidyAndSavings(collectWizardRecord(draftQuoteNo || nextQuoteNo()));
    quotations.unshift(record);
    draftQuoteNo = null;

    document.getElementById('invoice-preview').innerHTML = buildInvoiceMarkup(record);
    document.getElementById('share-grid').classList.remove('hidden');
    btn.classList.add('hidden');

    renderTable();

    // Auto-download the invoice as a PDF as soon as it is generated
    downloadInvoicePDF('invoice-preview', `${record.quoteNo}.pdf`).then(() => {
        showToast(`Quotation ${record.quoteNo} generated & PDF downloaded`, 'success');
    }).catch(() => {
        showToast(`Quotation ${record.quoteNo} generated successfully`, 'success');
    });

    // Wire the share-grid Download PDF button to re-download the same invoice on demand
    document.getElementById('btn-download-pdf').onclick = () => downloadInvoicePDF('invoice-preview', `${record.quoteNo}.pdf`);
    document.getElementById('btn-share-email').onclick = () => {
        const subject = encodeURIComponent(`Solar Quotation ${record.quoteNo}`);
        const body = encodeURIComponent(`Hi ${record.customer.name || ''},\n\nPlease find your solar quotation ${record.quoteNo} (Total: ${formatINR(record.total)}). We have downloaded the PDF — please attach it to this email before sending.\n\nThanks,\n${COMPANY.name}`);
        window.location.href = `mailto:${record.customer.email || ''}?subject=${subject}&body=${body}`;
    };
    document.getElementById('btn-share-whatsapp').onclick = () => {
        const text = encodeURIComponent(`Hi ${record.customer.name || ''}, here is your solar quotation ${record.quoteNo} — Total: ${formatINR(record.total)}. (PDF downloaded separately)`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    setTimeout(() => {
        closeModal('modal-wizard');
    }, 1200);
});

/* ---------------- Init ---------------- */
populateProductPicker();
renderTable();