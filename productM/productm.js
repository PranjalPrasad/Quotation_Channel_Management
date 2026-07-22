/* =========================================================
   Solar Quotation System — Product Management
   ========================================================= */

(function () {
    'use strict';

    // ---------------------------------------------------
    // 0. Auth guard (wire to your auth.js)
    // ---------------------------------------------------
    (async function initAuth() {
        try {
            if (typeof requireAuth === 'function') await requireAuth();
            if (typeof getAdminInfo === 'function') {
                const admin = getAdminInfo();
                const nameEl = document.querySelector('.user-name');
                if (nameEl && admin?.name) nameEl.textContent = admin.name;
            }
        } catch (e) { /* auth.js not wired yet in this preview */ }
    })();

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (typeof logout === 'function') await logout();
        else window.location.href = '../index.html';
    });

    // ---------------------------------------------------
    // 1. Sidebar / Topbar interactions (peach theme markup)
    // ---------------------------------------------------
    let isExpanded = false;
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('main-wrapper');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');

    function updateChevron() {
        if (!toggleIcon) return;
        toggleIcon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    function openMobileSidebar() {
        sidebar?.classList.add('sidebar-open');
        overlay?.classList.remove('hidden');
    }
    function closeMobileSidebar() {
        sidebar?.classList.remove('sidebar-open');
        overlay?.classList.add('hidden');
    }

    sidebarToggle?.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
            sidebar.classList.contains('sidebar-open') ? closeMobileSidebar() : openMobileSidebar();
        } else {
            isExpanded = !isExpanded;
            sidebar.classList.toggle('sidebar-expanded', isExpanded);
            sidebar.classList.toggle('sidebar-collapsed', !isExpanded);
            mainWrapper.classList.toggle('main-expanded', isExpanded);
        }
        updateChevron();
    });

    mobileToggle?.addEventListener('click', openMobileSidebar);
    overlay?.addEventListener('click', closeMobileSidebar);

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) closeMobileSidebar();
    });

    // Nav active state (in case future nav items are clicked without navigating away)
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 1024) closeMobileSidebar();
        });
    });

    // Notification / user dropdowns
    const notifBtn = document.getElementById('notif-btn');
    const notifMenu = document.getElementById('notif-menu');
    const userBtn = document.getElementById('user-menu-btn');
    const userMenu = document.getElementById('user-menu');

    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifMenu.classList.toggle('hidden');
        userMenu?.classList.add('hidden');
    });
    userBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('hidden');
        notifMenu?.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!userBtn?.contains(e.target) && !userMenu?.contains(e.target)) userMenu?.classList.add('hidden');
        if (!notifBtn?.contains(e.target) && !notifMenu?.contains(e.target)) notifMenu?.classList.add('hidden');
    });

    // ---------------------------------------------------
    // 2. Generic modal open/close
    // ---------------------------------------------------
    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov => {
        ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(ov.id); });
    });

    // ---------------------------------------------------
    // 3. Toast helper
    // ---------------------------------------------------
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity .25s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 250);
        }, 2600);
    }

    // ---------------------------------------------------
    // 4. Seed data (replace with API call to your backend)
    //    Pricing: mrp (₹), price = selling price (₹), discount (%)
    //    BOQ:     qtyPerKw = default quantity of this product required
    //             per 1 kW of system capacity (unit follows p.unit)
    // ---------------------------------------------------
    const CATEGORY_META = {
        'Solar Panel': { icon: 'fa-solar-panel', cls: 'bg-panel' },
        'Inverter': { icon: 'fa-plug-circle-bolt', cls: 'bg-inverter' },
        'Battery': { icon: 'fa-car-battery', cls: 'bg-battery' },
        'Mounting Structure': { icon: 'fa-tower-observation', cls: 'bg-structure' },
        'Cable & Wiring': { icon: 'fa-plug', cls: 'bg-cable' },
        'Accessory': { icon: 'fa-toolbox', cls: 'bg-accessory' }
    };

    let products = [
        { id: 'P-1001', name: '540W Mono PERC Solar Panel', category: 'Solar Panel', brand: 'Waaree', sku: 'WR-540-MP', spec: '540W, 24V', unit: 'Nos', mrp: 13800, price: 12500, discount: 9, qtyPerKw: 1.85, stock: 84, threshold: 20, status: 'Active', description: '25-year performance warranty, anti-reflective glass.' },
        { id: 'P-1002', name: '5kW Hybrid Solar Inverter', category: 'Inverter', brand: 'Luminous', sku: 'LM-HYB-5K', spec: '5kW, MPPT', unit: 'Nos', mrp: 75000, price: 68000, discount: 9, qtyPerKw: 0.2, stock: 6, threshold: 5, status: 'Active', description: 'Dual MPPT hybrid inverter with WiFi monitoring.' },
        { id: 'P-1003', name: 'Lithium Battery 10kWh', category: 'Battery', brand: 'Exide', sku: 'EX-LI-10K', spec: '10kWh, 51.2V', unit: 'Nos', mrp: 160000, price: 145000, discount: 9, qtyPerKw: 0.5, stock: 0, threshold: 3, status: 'Active', description: 'LiFePO4 battery, 6000+ cycle life.' },
        { id: 'P-1004', name: 'GI Mounting Structure (3kW)', category: 'Mounting Structure', brand: 'Tata Power', sku: 'TP-MS-3K', spec: 'For 6 panels', unit: 'Set', mrp: 9200, price: 8500, discount: 8, qtyPerKw: 0.33, stock: 22, threshold: 5, status: 'Active', description: 'Hot-dip galvanized rooftop structure.' },
        { id: 'P-1005', name: 'DC Solar Cable 4mm²', category: 'Cable & Wiring', brand: 'Polycab', sku: 'PC-DC-4MM', spec: '4mm², 1.5kV', unit: 'Meter', mrp: 36, price: 32, discount: 11, qtyPerKw: 5, stock: 1200, threshold: 200, status: 'Active', description: 'UV-resistant single-core DC cable.' },
        { id: 'P-1006', name: '440W Mono PERC Solar Panel', category: 'Solar Panel', brand: 'Adani Solar', sku: 'AD-440-MP', spec: '440W, 24V', unit: 'Nos', mrp: 11500, price: 10200, discount: 11, qtyPerKw: 2.27, stock: 15, threshold: 20, status: 'Active', description: '25-year linear performance warranty.' },
        { id: 'P-1007', name: '3kW On-Grid Inverter', category: 'Inverter', brand: 'Growatt', sku: 'GW-OG-3K', spec: '3kW, Single Phase', unit: 'Nos', mrp: 35000, price: 32000, discount: 9, qtyPerKw: 0.33, stock: 11, threshold: 5, status: 'Active', description: 'Compact on-grid string inverter.' },
        { id: 'P-1008', name: 'MC4 Connector Pair', category: 'Accessory', brand: 'Staubli', sku: 'ST-MC4-P', spec: 'IP68 rated', unit: 'Box', mrp: 520, price: 450, discount: 13, qtyPerKw: 0.1, stock: 3, threshold: 10, status: 'Active', description: 'Weatherproof solar connectors, box of 50 pairs.' },
        { id: 'P-1009', name: 'Tubular Battery 150Ah', category: 'Battery', brand: 'Exide', sku: 'EX-TB-150', spec: '150Ah, 12V', unit: 'Nos', mrp: 20000, price: 18500, discount: 8, qtyPerKw: 0.2, stock: 9, threshold: 5, status: 'Inactive', description: 'Discontinued — replaced by lithium range.' },
        { id: 'P-1010', name: 'AC Distribution Box', category: 'Accessory', brand: 'Havells', sku: 'HV-ACDB-1', spec: 'Single Phase', unit: 'Nos', mrp: 2500, price: 2200, discount: 12, qtyPerKw: 0.1, stock: 18, threshold: 5, status: 'Active', description: 'With SPD and MCB protection.' },
        { id: 'P-1011', name: 'Elevated Structure (10kW)', category: 'Mounting Structure', brand: 'Tata Power', sku: 'TP-MS-10K', spec: 'For 20 panels', unit: 'Set', mrp: 26500, price: 24000, discount: 9, qtyPerKw: 0.1, stock: 4, threshold: 5, status: 'Active', description: 'For ground-mount / elevated rooftop installs.' },
        { id: 'P-1012', name: 'AC Cable 6mm²', category: 'Cable & Wiring', brand: 'Polycab', sku: 'PC-AC-6MM', spec: '6mm², 3-core', unit: 'Meter', mrp: 65, price: 58, discount: 11, qtyPerKw: 3, stock: 0, threshold: 100, status: 'Active', description: 'Armoured AC output cable.' }
    ];

    // ---------------------------------------------------
    // 4b. Stock Ledger — logs manual stock in / stock out entries
    // ---------------------------------------------------
    let stockLedger = [
        { id: 'SL-1', productId: 'P-1001', type: 'in', qty: 100, reason: 'Initial stock', date: '2026-07-01' },
        { id: 'SL-2', productId: 'P-1001', type: 'out', qty: 16, reason: 'Used in quotation SQ-0998', date: '2026-07-13' },
        { id: 'SL-3', productId: 'P-1003', type: 'in', qty: 5, reason: 'Purchase order PO-221', date: '2026-07-05' }
    ];
    let ledgerCounter = stockLedger.length;

    // ---------------------------------------------------
    // 5. State
    // ---------------------------------------------------
    let state = {
        search: '',
        category: '',
        status: '',
        sortKey: 'name',
        sortDir: 'asc',
        page: 1,
        pageSize: 10
    };

    function computeStatusLabel(p) {
        if (p.status === 'Inactive') return 'Inactive';
        if (p.stock <= 0) return 'Out of Stock';
        if (p.stock <= p.threshold) return 'Low Stock';
        return 'Active';
    }

    function badgeClass(label) {
        switch (label) {
            case 'Active': return 'badge-active';
            case 'Inactive': return 'badge-inactive';
            case 'Low Stock': return 'badge-low';
            case 'Out of Stock': return 'badge-out';
            default: return 'badge-inactive';
        }
    }

    function getFiltered() {
        let list = products.filter(p => {
            const matchesSearch = !state.search ||
                p.name.toLowerCase().includes(state.search) ||
                p.brand.toLowerCase().includes(state.search) ||
                (p.sku || '').toLowerCase().includes(state.search);
            const matchesCategory = !state.category || p.category === state.category;
            const label = computeStatusLabel(p);
            const matchesStatus = !state.status || label === state.status;
            return matchesSearch && matchesCategory && matchesStatus;
        });

        list.sort((a, b) => {
            let av, bv;
            switch (state.sortKey) {
                case 'category': av = a.category; bv = b.category; break;
                case 'brand': av = a.brand; bv = b.brand; break;
                case 'spec': av = a.spec; bv = b.spec; break;
                case 'qtyPerKw': av = a.qtyPerKw; bv = b.qtyPerKw; break;
                case 'price': av = a.price; bv = b.price; break;
                case 'stock': av = a.stock; bv = b.stock; break;
                case 'status': av = computeStatusLabel(a); bv = computeStatusLabel(b); break;
                default: av = a.name; bv = b.name;
            }
            if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
            if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
            if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }

    // ---------------------------------------------------
    // 6. Render
    // ---------------------------------------------------
    const tbody = document.getElementById('product-tbody');
    const emptyState = document.getElementById('empty-state');
    const paginationEl = document.getElementById('pagination');

    function formatINR(num) {
        if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
        return '₹' + num.toLocaleString('en-IN');
    }

    function renderStats() {
        document.getElementById('stat-total').textContent = products.length.toLocaleString('en-IN');
        document.getElementById('stat-active').textContent = products.filter(p => computeStatusLabel(p) === 'Active').length.toLocaleString('en-IN');
        document.getElementById('stat-low').textContent = products.filter(p => ['Low Stock', 'Out of Stock'].includes(computeStatusLabel(p))).length.toLocaleString('en-IN');
        // Inventory value is based on selling price (price), not MRP
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        document.getElementById('stat-value').textContent = formatINR(totalValue);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    function formatQtyPerKw(p) {
        const val = (p.qtyPerKw ?? 0);
        const formatted = Number.isInteger(val) ? val : val.toFixed(2).replace(/\.?0+$/, '');
        return `<span class="qtykw-value">${formatted}</span><span class="qtykw-unit">${escapeHtml(p.unit)}/kW</span>`;
    }

    function render() {
        const filtered = getFiltered();
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > totalPages) state.page = totalPages;
        const start = (state.page - 1) * state.pageSize;
        const pageItems = filtered.slice(start, start + state.pageSize);

        tbody.innerHTML = '';
        emptyState.classList.toggle('hidden', pageItems.length > 0);

        pageItems.forEach(p => {
            const label = computeStatusLabel(p);
            const meta = CATEGORY_META[p.category] || { icon: 'fa-box', cls: 'bg-slate' };
            const hasDiscount = p.mrp && p.mrp > p.price;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="product-cell">
                        <div class="row-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
                        <div>
                            <div class="product-name">${escapeHtml(p.name)}</div>
                            <div class="product-sub">${escapeHtml(p.brand)} · ${escapeHtml(p.sku || '—')}</div>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(p.category)}</td>
                <td>${escapeHtml(p.brand)}</td>
                <td>${escapeHtml(p.spec || '—')}</td>
                <td>${formatQtyPerKw(p)}</td>
                <td>
                    <div class="price-cell">
                        ${hasDiscount ? `<span class="price-mrp">₹${p.mrp.toLocaleString('en-IN')}</span>` : ''}
                        <span class="price-selling">₹${p.price.toLocaleString('en-IN')}${hasDiscount ? `<span class="discount-badge">${p.discount || Math.round((p.mrp - p.price) / p.mrp * 100)}% OFF</span>` : ''}</span>
                    </div>
                </td>
                <td>${p.stock} ${escapeHtml(p.unit)}</td>
                <td><span class="badge ${badgeClass(label)}">${label}</span></td>
                <td>
                    <div class="action-icons">
                        <button class="icon-action-btn" data-action="view" data-id="${p.id}" title="View"><i class="fas fa-eye"></i></button>
                        <button class="icon-action-btn" data-action="edit" data-id="${p.id}" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="icon-action-btn" data-action="stock" data-id="${p.id}" title="Stock History"><i class="fas fa-clock-rotate-left"></i></button>
                        <button class="icon-action-btn danger" data-action="delete" data-id="${p.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        renderPagination(totalPages, total, start, pageItems.length);
        renderStats();
    }

    function renderPagination(totalPages, total, start, shown) {
        paginationEl.innerHTML = '';

        const prev = document.createElement('button');
        prev.innerHTML = '<i class="fas fa-chevron-left" style="font-size:9px"></i>';
        prev.disabled = state.page === 1;
        prev.addEventListener('click', () => { state.page--; render(); });
        paginationEl.appendChild(prev);

        const maxButtons = 5;
        let startPage = Math.max(1, state.page - 2);
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        startPage = Math.max(1, endPage - maxButtons + 1);

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            if (i === state.page) btn.classList.add('active');
            btn.addEventListener('click', () => { state.page = i; render(); });
            paginationEl.appendChild(btn);
        }

        const next = document.createElement('button');
        next.innerHTML = '<i class="fas fa-chevron-right" style="font-size:9px"></i>';
        next.disabled = state.page === totalPages;
        next.addEventListener('click', () => { state.page++; render(); });
        paginationEl.appendChild(next);
    }

    // ---------------------------------------------------
    // 7. Filters / search / sort / pagination wiring
    // ---------------------------------------------------
    let searchTimer;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.search = e.target.value.trim().toLowerCase();
            state.page = 1;
            render();
        }, 200);
    });

    document.getElementById('filter-category').addEventListener('change', (e) => {
        state.category = e.target.value;
        state.page = 1;
        render();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
        state.status = e.target.value;
        state.page = 1;
        render();
    });

    document.getElementById('rows-per-page').addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10);
        state.page = 1;
        render();
    });

    document.querySelectorAll('.data-table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = key;
                state.sortDir = 'asc';
            }
            document.querySelectorAll('.data-table thead th i').forEach(i => i.className = 'fas fa-sort');
            th.querySelector('i').className = `fas fa-sort-${state.sortDir === 'asc' ? 'up' : 'down'}`;
            render();
        });
    });

    // Row action buttons (View / Edit / Stock History / Delete) — inline, no dropdown
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const product = products.find(p => p.id === id);
        if (!product) return;

        if (action === 'view') openViewModal(product);
        if (action === 'edit') openProductModal(product);
        if (action === 'stock') openStockHistoryModal(product);
        if (action === 'delete') openDeleteModal(product);
    });

    // ---------------------------------------------------
    // 8. Add / Edit modal + validation
    // ---------------------------------------------------
    const form = {
        id: document.getElementById('pf-id'),
        name: document.getElementById('pf-name'),
        category: document.getElementById('pf-category'),
        brand: document.getElementById('pf-brand'),
        sku: document.getElementById('pf-sku'),
        spec: document.getElementById('pf-spec'),
        unit: document.getElementById('pf-unit'),
        mrp: document.getElementById('pf-mrp'),
        discount: document.getElementById('pf-discount'),
        price: document.getElementById('pf-price'),
        stock: document.getElementById('pf-stock'),
        threshold: document.getElementById('pf-threshold'),
        qtyPerKw: document.getElementById('pf-qtyperkw'),
        status: document.getElementById('pf-status'),
        description: document.getElementById('pf-description')
    };
    const modalTitle = document.getElementById('product-modal-title');

    // ---- Auto-calc: MRP + Discount% -> Selling Price (still manually overridable) ----
    let priceManuallyEdited = false;

    function recalcPriceFromDiscount() {
        const mrp = parseFloat(form.mrp.value);
        const discount = parseFloat(form.discount.value);
        if (!isNaN(mrp) && mrp > 0 && !isNaN(discount) && discount >= 0 && discount <= 100) {
            const calculated = mrp - (mrp * discount / 100);
            form.price.value = Math.round(calculated * 100) / 100;
            priceManuallyEdited = false;
        }
    }

    function recalcDiscountFromPrice() {
        const mrp = parseFloat(form.mrp.value);
        const price = parseFloat(form.price.value);
        if (!isNaN(mrp) && mrp > 0 && !isNaN(price) && price >= 0) {
            const calculated = ((mrp - price) / mrp) * 100;
            form.discount.value = Math.round(calculated * 100) / 100;
        }
    }

    form.mrp.addEventListener('input', () => {
        if (priceManuallyEdited && form.price.value !== '') {
            recalcDiscountFromPrice();
        } else {
            recalcPriceFromDiscount();
        }
    });
    form.discount.addEventListener('input', recalcPriceFromDiscount);
    form.price.addEventListener('input', () => {
        priceManuallyEdited = true;
        recalcDiscountFromPrice();
    });

    function openProductModal(product) {
        clearErrors();
        priceManuallyEdited = false;
        if (product) {
            modalTitle.innerHTML = '<i class="fas fa-pen"></i> Edit Product';
            form.id.value = product.id;
            form.name.value = product.name;
            form.category.value = product.category;
            form.brand.value = product.brand;
            form.sku.value = product.sku;
            form.spec.value = product.spec;
            form.unit.value = product.unit;
            form.mrp.value = product.mrp ?? '';
            form.discount.value = product.discount ?? '';
            form.price.value = product.price;
            form.stock.value = product.stock;
            form.threshold.value = product.threshold;
            form.qtyPerKw.value = product.qtyPerKw ?? '';
            form.status.value = product.status;
            form.description.value = product.description || '';
        } else {
            modalTitle.innerHTML = '<i class="fas fa-box"></i> Add Product';
            Object.values(form).forEach(f => { if (f.tagName !== 'SELECT') f.value = ''; });
            form.id.value = '';
            form.unit.value = 'Nos';
            form.status.value = 'Active';
            form.threshold.value = 10;
        }
        openModal('modal-product');
    }

    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal(null));

    function clearErrors() {
        document.querySelectorAll('#modal-product .form-field input, #modal-product .form-field select, #modal-product .form-field textarea')
            .forEach(f => f.classList.remove('invalid'));
        document.querySelectorAll('#modal-product .field-error').forEach(e => e.textContent = '');
    }

    function setFieldError(fieldEl, errorId, message) {
        fieldEl.classList.add('invalid');
        const err = document.getElementById(errorId);
        if (err) err.textContent = message;
    }

    function validateProductForm() {
        clearErrors();
        let valid = true;

        if (!form.name.value.trim()) {
            setFieldError(form.name, 'err-pf-name', 'Product name is required');
            valid = false;
        }
        if (!form.category.value) {
            setFieldError(form.category, 'err-pf-category', 'Please select a category');
            valid = false;
        }
        if (!form.brand.value.trim()) {
            setFieldError(form.brand, 'err-pf-brand', 'Brand is required');
            valid = false;
        }
        if (form.mrp.value === '' || Number(form.mrp.value) < 0) {
            setFieldError(form.mrp, 'err-pf-mrp', 'Enter a valid MRP');
            valid = false;
        }
        if (form.discount.value !== '' && (Number(form.discount.value) < 0 || Number(form.discount.value) > 100)) {
            setFieldError(form.discount, 'err-pf-discount', 'Discount must be between 0–100%');
            valid = false;
        }
        if (form.price.value === '' || Number(form.price.value) < 0) {
            setFieldError(form.price, 'err-pf-price', 'Enter a valid selling price');
            valid = false;
        }
        if (form.mrp.value !== '' && form.price.value !== '' && Number(form.price.value) > Number(form.mrp.value)) {
            setFieldError(form.price, 'err-pf-price', 'Selling price cannot exceed MRP');
            valid = false;
        }
        if (form.stock.value === '' || Number(form.stock.value) < 0) {
            setFieldError(form.stock, 'err-pf-stock', 'Enter a valid stock quantity');
            valid = false;
        }
        if (form.qtyPerKw.value === '' || Number(form.qtyPerKw.value) < 0) {
            setFieldError(form.qtyPerKw, 'err-pf-qtyperkw', 'Enter a valid quantity per kW (0 if not applicable)');
            valid = false;
        }
        return valid;
    }

    document.getElementById('btn-save-product').addEventListener('click', () => {
        if (!validateProductForm()) {
            showToast('Please fill all required fields correctly', 'error');
            return;
        }
        const isEdit = !!form.id.value;
        const payload = {
            id: form.id.value || 'P-' + (1000 + products.length + 1),
            name: form.name.value.trim(),
            category: form.category.value,
            brand: form.brand.value.trim(),
            sku: form.sku.value.trim(),
            spec: form.spec.value.trim(),
            unit: form.unit.value,
            mrp: Number(form.mrp.value),
            discount: form.discount.value !== '' ? Number(form.discount.value) : Math.round(((Number(form.mrp.value) - Number(form.price.value)) / Number(form.mrp.value)) * 100),
            price: Number(form.price.value),
            stock: Number(form.stock.value),
            threshold: Number(form.threshold.value || 10),
            qtyPerKw: Number(form.qtyPerKw.value),
            status: form.status.value,
            description: form.description.value.trim()
        };

        if (isEdit) {
            const idx = products.findIndex(p => p.id === payload.id);
            if (idx !== -1) products[idx] = payload;
            showToast('Product updated successfully', 'success');
        } else {
            products.unshift(payload);
            showToast('Product added successfully', 'success');
        }
        closeModal('modal-product');
        render();
    });

    // ---------------------------------------------------
    // 9. View modal
    // ---------------------------------------------------
    const viewBody = document.getElementById('view-product-body');

    function openViewModal(p) {
        const label = computeStatusLabel(p);
        const meta = CATEGORY_META[p.category] || { icon: 'fa-box', cls: 'bg-slate' };
        const hasDiscount = p.mrp && p.mrp > p.price;
        viewBody.innerHTML = `
            <div class="view-head">
                <div class="row-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
                <div>
                    <div class="product-name" style="font-size:13px">${escapeHtml(p.name)}</div>
                    <div class="product-sub">${escapeHtml(p.brand)} · SKU: ${escapeHtml(p.sku || '—')}</div>
                </div>
            </div>
            <div class="view-grid">
                <div class="view-item"><div class="view-label">Category</div><div class="view-value">${escapeHtml(p.category)}</div></div>
                <div class="view-item"><div class="view-label">Specification</div><div class="view-value">${escapeHtml(p.spec || '—')}</div></div>
                <div class="view-item"><div class="view-label">MRP</div><div class="view-value">₹${(p.mrp ?? p.price).toLocaleString('en-IN')}</div></div>
                <div class="view-item"><div class="view-label">Selling Price</div><div class="view-value">₹${p.price.toLocaleString('en-IN')} / ${escapeHtml(p.unit)}${hasDiscount ? ` <span class="discount-badge">${p.discount || Math.round((p.mrp - p.price) / p.mrp * 100)}% OFF</span>` : ''}</div></div>
                <div class="view-item"><div class="view-label">Stock</div><div class="view-value">${p.stock} ${escapeHtml(p.unit)}</div></div>
                <div class="view-item"><div class="view-label">Status</div><div class="view-value"><span class="badge ${badgeClass(label)}">${label}</span></div></div>
                <div class="view-item"><div class="view-label">Default Qty / kW (BOQ)</div><div class="view-value">${p.qtyPerKw ?? 0} ${escapeHtml(p.unit)}/kW</div></div>
                <div class="view-item"><div class="view-label">Low Stock Threshold</div><div class="view-value">${p.threshold}</div></div>
            </div>
            ${p.description ? `<div class="view-desc">${escapeHtml(p.description)}</div>` : ''}
        `;
        openModal('modal-view-product');
    }

    // ---------------------------------------------------
    // 9b. Stock History modal (ledger of stock in / out)
    // ---------------------------------------------------
    let stockHistoryProduct = null;
    const stockLedgerBody = document.getElementById('stock-ledger-body');
    const stockHistoryProductName = document.getElementById('stock-history-product-name');
    const stockHistoryCurrentStock = document.getElementById('stock-history-current-stock');
    const slType = document.getElementById('sl-type');
    const slQty = document.getElementById('sl-qty');
    const slReason = document.getElementById('sl-reason');

    function renderStockLedger(productId) {
        const entries = stockLedger
            .filter(e => e.productId === productId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (entries.length === 0) {
            stockLedgerBody.innerHTML = `<div class="ledger-empty">No stock movements recorded yet.</div>`;
            return;
        }

        stockLedgerBody.innerHTML = entries.map(e => `
            <div class="ledger-item">
                <div class="ledger-icon ${e.type === 'in' ? 'ledger-in' : 'ledger-out'}">
                    <i class="fas ${e.type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                </div>
                <div class="ledger-info">
                    <div class="ledger-reason">${escapeHtml(e.reason || (e.type === 'in' ? 'Stock added' : 'Stock removed'))}</div>
                    <div class="ledger-date">${e.date}</div>
                </div>
                <div class="ledger-qty ${e.type === 'in' ? 'ledger-in' : 'ledger-out'}">${e.type === 'in' ? '+' : '-'}${e.qty}</div>
            </div>
        `).join('');
    }

    function openStockHistoryModal(product) {
        stockHistoryProduct = product;
        stockHistoryProductName.textContent = product.name;
        stockHistoryCurrentStock.textContent = `${product.stock} ${product.unit} in stock`;
        slType.value = 'in';
        slQty.value = '';
        slReason.value = '';
        renderStockLedger(product.id);
        openModal('modal-stock-history');
    }

    document.getElementById('btn-add-stock-entry')?.addEventListener('click', () => {
        if (!stockHistoryProduct) return;
        const qty = parseInt(slQty.value, 10);
        if (!qty || qty <= 0) {
            showToast('Enter a valid quantity', 'error');
            return;
        }
        const type = slType.value;

        if (type === 'out' && qty > stockHistoryProduct.stock) {
            showToast('Cannot remove more than current stock', 'error');
            return;
        }

        ledgerCounter++;
        stockLedger.unshift({
            id: 'SL-' + ledgerCounter,
            productId: stockHistoryProduct.id,
            type,
            qty,
            reason: slReason.value.trim(),
            date: new Date().toISOString().slice(0, 10)
        });

        stockHistoryProduct.stock += (type === 'in' ? qty : -qty);

        slQty.value = '';
        slReason.value = '';
        renderStockLedger(stockHistoryProduct.id);
        stockHistoryCurrentStock.textContent = `${stockHistoryProduct.stock} ${stockHistoryProduct.unit} in stock`;
        render();
        showToast(type === 'in' ? 'Stock added' : 'Stock removed', 'success');
    });

    // ---------------------------------------------------
    // 10. Delete modal
    // ---------------------------------------------------
    let productToDelete = null;

    function openDeleteModal(p) {
        productToDelete = p;
        document.getElementById('delete-product-name').textContent = p.name;
        openModal('modal-delete-product');
    }

    document.getElementById('btn-confirm-delete-product').addEventListener('click', () => {
        if (productToDelete) {
            products = products.filter(p => p.id !== productToDelete.id);
            showToast('Product deleted', 'success');
        }
        productToDelete = null;
        closeModal('modal-delete-product');
        render();
    });

    // ---------------------------------------------------
    // 11. Initial render
    // ---------------------------------------------------
    render();

    // Expose product data for BOQ auto-generation logic elsewhere in the app
    // (e.g. quotation.js can read window.SolarProducts to pull qtyPerKw ratios)
    window.SolarProducts = {
        getAll: () => products,
        getById: (id) => products.find(p => p.id === id),
        getByCategory: (category) => products.filter(p => p.category === category)
    };

})();