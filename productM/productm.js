/* =========================================================
   Solar Quotation System — Product Management
   Integrated with the Spring Boot backend (port 8091).

   session.js (loaded before this file) provides:
     - window.API_BASE   (must be http://localhost:8091)
     - Session.api(path, { method, body })  -> { success, message, data }

   Endpoints (ProductController):
     GET    /api/products                     list (PageResponse { content, totalPages })
     POST   /api/products                     create   (Super Admin must send partnerId)
     PUT    /api/products/{id}                update
     DELETE /api/products/{id}                delete
     GET    /api/products/{id}/stock-history  stock ledger
     POST   /api/products/{id}/stock-history  { type: IN|OUT, quantity, reason }
     GET    /api/channel-partners/options     partner dropdown (Super Admin)
   ========================================================= */

(function () {
    'use strict';

    // ---------------------------------------------------
    // 0. API layer
    // ---------------------------------------------------
    const ENDPOINTS = {
        list: '/api/products',
        partnerOptions: '/api/channel-partners/options',
        one: (id) => `/api/products/${encodeURIComponent(id)}`,
        stockHistory: (id) => `/api/products/${encodeURIComponent(id)}/stock-history`
    };

    const STOCK_TYPE_TO_API = { in: 'IN', out: 'OUT' };

    const CATEGORY_TO_API = {
        'Solar Panel': 'SOLAR_PANEL',
        'Inverter': 'INVERTER',
        'Battery': 'BATTERY',
        'Mounting Structure': 'MOUNTING_STRUCTURE',
        'Cable & Wiring': 'CABLE_WIRING',
        'Accessory': 'ACCESSORY'
    };
    const catKey = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const CATEGORY_FROM_API = {};
    Object.keys(CATEGORY_TO_API).forEach(label => {
        CATEGORY_FROM_API[catKey(label)] = label;
        CATEGORY_FROM_API[catKey(CATEGORY_TO_API[label])] = label;
    });
    CATEGORY_FROM_API['CABLEWIRING'] = 'Cable & Wiring';
    CATEGORY_FROM_API['CABLEANDWIRING'] = 'Cable & Wiring';
    const categoryFromApi = (v) => CATEGORY_FROM_API[catKey(v)] || v || '';

    // Backend caps page size at 100 (PageFilterRequestDto.MAX_SIZE); all pages are loaded.
    const FETCH_PAGE_SIZE = 100;

    async function call(path, method, body) {
        if (!window.Session || typeof Session.api !== 'function') {
            throw new Error('Session is not available (is session.js loaded?)');
        }
        const opts = { method: method || 'GET' };
        if (body !== undefined) opts.body = body;
        const res = await Session.api(path, opts);
        return res && res.data !== undefined ? res.data : res;
    }

    const toArray = (data) => Array.isArray(data) ? data
        : Array.isArray(data && data.content) ? data.content
        : Array.isArray(data && data.items) ? data.items
        : [];

    const num = (v, fallback) => {
        const n = Number(v);
        return v === null || v === undefined || v === '' || isNaN(n) ? fallback : n;
    };

    function normalizeProduct(r) {
        const status = String(r.status || 'Active');
        const price = num(r.price ?? r.sellingPrice, 0);
        return {
            id: r.id,
            partnerId: r.partnerId ?? (r.partner && r.partner.id) ?? null,
            name: r.name || '',
            category: categoryFromApi(r.category),
            brand: r.brand || '',
            sku: r.sku || '',
            spec: r.spec ?? r.specification ?? '',
            unit: r.unit || 'Nos',
            mrp: num(r.mrp, price),
            price: price,
            discount: num(r.discountPercent ?? r.discount, 0),
            qtyPerKw: num(r.qtyPerKw ?? r.defaultQtyPerKw, 0),
            stock: num(r.stock ?? r.stockQuantity, 0),
            threshold: num(r.lowStockThreshold ?? r.threshold, 10),
            status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
            description: r.description || '',
            hsn: r.hsn ?? r.hsnCode ?? '',
            gst: num(r.gstPercent ?? r.gst ?? r.gstRate, 18),
            warranty: num(r.warrantyYears ?? r.warranty, 0)
        };
    }

    async function fetchAllProducts() {
        let all = [];
        let page = 0;
        for (;;) {
            const data = await call(`${ENDPOINTS.list}?page=${page}&size=${FETCH_PAGE_SIZE}`);
            if (Array.isArray(data)) { all = data; break; }
            const rows = toArray(data);
            all = all.concat(rows);
            const totalPages = num(data && data.totalPages, 1);
            page++;
            if (!rows.length || page >= totalPages) break;
        }
        return all.map(normalizeProduct);
    }

    function normalizeLedgerEntry(e) {
        const t = String(e.type || e.movementType || '').toLowerCase();
        let date = e.createdAt || e.date || e.movementDate || '';
        // backend stores UTC (LocalDateTime.now(UTC)) and sends it without 'Z' -> add it so the browser shows local time correctly
        if (typeof date === 'string' && date.length > 10 && !/[zZ]|[+-]\d\d:?\d\d$/.test(date)) date += 'Z';
        return {
            id: e.id,
            type: t.includes('out') ? 'out' : 'in',
            qty: num(e.quantity ?? e.qty, 0),
            reason: e.reason || e.remarks || '',
            date
        };
    }

    // ---------------------------------------------------
    // 1. Sidebar
    // ---------------------------------------------------
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    const drawerMQ = window.matchMedia('(max-width: 1023px)');
    const isDrawerViewport = () => drawerMQ.matches;

    const OPEN_BY_DEFAULT_ON_DRAWER = true;
    const defaultSidebarState = () => (isDrawerViewport() ? OPEN_BY_DEFAULT_ON_DRAWER : true);

    let sidebarExpanded = defaultSidebarState();

    function setSidebarExpanded(next) {
        sidebarExpanded = next;
        sidebar?.classList.toggle('expanded', next);
        sidebar?.classList.toggle('collapsed', !next);
        if (toggleIcon) toggleIcon.style.transform = next ? 'rotate(180deg)' : 'rotate(0deg)';
        const showBackdrop = next && isDrawerViewport();
        sidebarBackdrop?.classList.toggle('visible', showBackdrop);
        sidebarBackdrop?.classList.toggle('hidden', !showBackdrop);
    }

    setSidebarExpanded(sidebarExpanded);
    sidebarToggle?.addEventListener('click', () => setSidebarExpanded(!sidebarExpanded));
    sidebarBackdrop?.addEventListener('click', () => setSidebarExpanded(false));
    drawerMQ.addEventListener('change', () => setSidebarExpanded(defaultSidebarState()));

    document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
        if (e.target.closest('.nav-item') && isDrawerViewport()) setSidebarExpanded(false);
    });

    // ---------------------------------------------------
    // 2. Topbar dropdowns
    // ---------------------------------------------------
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
        if (!profileBtn?.contains(e.target) && !profileDropdown?.contains(e.target)) profileDropdown?.classList.add('hidden');
        if (!notifBtn?.contains(e.target) && !notifDropdown?.contains(e.target)) notifDropdown?.classList.add('hidden');
    });

    (function showUserName() {
        try {
            const u = window.Session && Session.getUser ? Session.getUser() : null;
            const name = (u && (u.name || (u.email ? u.email.split('@')[0] : ''))) || 'User';
            const label = document.getElementById('profileNameLabel');
            const initial = document.getElementById('profileInitial');
            if (label) label.textContent = name;
            if (initial) initial.textContent = name.charAt(0).toUpperCase();
        } catch (_) { /* keep defaults */ }
    })();

    // ---------------------------------------------------
    // 3. Modals
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
    // 4. Toast
    // ---------------------------------------------------
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
        const color = type === 'success' ? 'text-emerald-600' : 'text-rose-500';
        const toast = document.createElement('div');
        toast.className = 'toast-animate bg-cream border border-peach-300 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 shadow-lg flex items-center gap-2';
        const i = document.createElement('i');
        i.className = `fas ${icon} ${color}`;
        const span = document.createElement('span');
        span.textContent = message;
        toast.append(i, span);
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity .25s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    function errorMessage(err, fallback) {
        if (err && err.status === 403) return 'You do not have permission to do that.';
        return (err && err.message) || fallback;
    }

    async function withBusy(btn, fn) {
        if (!btn || btn.disabled) return;
        const html = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="margin-right:6px"></span>Please wait…';
        try { return await fn(); }
        finally { btn.disabled = false; btn.innerHTML = html; }
    }

    // ---------------------------------------------------
    // 5. Data + state
    // ---------------------------------------------------
    const CATEGORY_META = {
        'Solar Panel': { icon: 'fa-solar-panel', cls: 'bg-panel' },
        'Inverter': { icon: 'fa-plug-circle-bolt', cls: 'bg-inverter' },
        'Battery': { icon: 'fa-car-battery', cls: 'bg-battery' },
        'Mounting Structure': { icon: 'fa-tower-observation', cls: 'bg-structure' },
        'Cable & Wiring': { icon: 'fa-plug', cls: 'bg-cable' },
        'Accessory': { icon: 'fa-toolbox', cls: 'bg-accessory' }
    };

    let products = [];
    let isLoading = true;
    let loadError = '';

    let state = {
        search: '', category: '', status: '', gst: '',
        sortKey: 'name', sortDir: 'asc', page: 1, pageSize: 10
    };

    const sameId = (a, b) => String(a) === String(b);

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
            const matchesGst = !state.gst || String(p.gst) === state.gst;
            return matchesSearch && matchesCategory && matchesStatus && matchesGst;
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
                case 'hsn': av = a.hsn || ''; bv = b.hsn || ''; break;
                case 'gst': av = a.gst || 0; bv = b.gst || 0; break;
                default: av = a.name; bv = b.name;
            }
            if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
            if (av < bv) return state.sortDir === 'asc' ? -1 : 1;
            if (av > bv) return state.sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return list;
    }

    // ---------------------------------------------------
    // 6. Load from backend
    // ---------------------------------------------------
    async function loadProducts() {
        isLoading = true;
        loadError = '';
        render();
        try {
            products = await fetchAllProducts();
        } catch (err) {
            console.error('Failed to load products:', err);
            products = [];
            loadError = errorMessage(err, 'Could not load products.');
        } finally {
            isLoading = false;
        }
        render();
    }

    async function refreshProducts() {
        try {
            products = await fetchAllProducts();
            loadError = '';
            render();
            return true;
        } catch (err) {
            showToast(errorMessage(err, 'Saved, but the list could not be refreshed.'), 'error');
            return false;
        }
    }

    // ---------------------------------------------------
    // 7. Render
    // ---------------------------------------------------
    const tbody = document.getElementById('product-tbody');
    const emptyState = document.getElementById('empty-state');
    const loadErrorEl = document.getElementById('load-error');
    const paginationEl = document.getElementById('pagination');

    function formatINR(n) {
        if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
        if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
        return '₹' + n.toLocaleString('en-IN');
    }

    function renderStats() {
        document.getElementById('stat-total').textContent = products.length.toLocaleString('en-IN');
        document.getElementById('stat-active').textContent = products.filter(p => computeStatusLabel(p) === 'Active').length.toLocaleString('en-IN');
        document.getElementById('stat-low').textContent = products.filter(p => ['Low Stock', 'Out of Stock'].includes(computeStatusLabel(p))).length.toLocaleString('en-IN');
        const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
        document.getElementById('stat-value').textContent = formatINR(totalValue);
    }

    function renderNotifications() {
        const list = document.getElementById('notifList');
        const dot = document.getElementById('notifDot');
        if (!list) return;
        const alerts = products
            .filter(p => ['Out of Stock', 'Low Stock'].includes(computeStatusLabel(p)))
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 6);

        dot?.classList.toggle('hidden', alerts.length === 0);
        if (!alerts.length) {
            list.innerHTML = '<div class="topbar-notif-item"><p class="notif-empty">All products are well stocked</p></div>';
            return;
        }
        list.innerHTML = alerts.map(p => {
            const out = computeStatusLabel(p) === 'Out of Stock';
            return `<div class="topbar-notif-item">
                <p>${out ? 'Out of stock' : 'Low stock'}: ${escapeHtml(p.name)}</p>
                <span>${out ? 'No units left' : p.stock + ' ' + escapeHtml(p.unit) + ' left (min ' + p.threshold + ')'}</span>
            </div>`;
        }).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    function formatQtyPerKw(p) {
        const val = (p.qtyPerKw ?? 0);
        const formatted = Number.isInteger(val) ? val : val.toFixed(2).replace(/\.?0+$/, '');
        return `<span class="qtykw-value">${formatted}</span><span class="qtykw-unit">${escapeHtml(p.unit)}/kW</span>`;
    }

    function stateRow(html) {
        return `<tr class="table-state-row"><td class="table-state-cell" colspan="11">${html}</td></tr>`;
    }

    function discountLabel(p) {
        return p.discount || Math.round((p.mrp - p.price) / p.mrp * 100);
    }

    function render() {
        const filtered = getFiltered();
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > totalPages) state.page = totalPages;
        const start = (state.page - 1) * state.pageSize;
        const pageItems = filtered.slice(start, start + state.pageSize);

        tbody.innerHTML = '';
        loadErrorEl.classList.toggle('hidden', !loadError);
        document.getElementById('load-error-msg').textContent = loadError || '';

        if (isLoading) {
            tbody.innerHTML = stateRow('<span class="spinner"></span>Loading products…');
            emptyState.classList.add('hidden');
            paginationEl.innerHTML = '';
            renderStats();
            renderNotifications();
            return;
        }

        emptyState.classList.toggle('hidden', pageItems.length > 0 || !!loadError);

        pageItems.forEach(p => {
            const label = computeStatusLabel(p);
            const meta = CATEGORY_META[p.category] || { icon: 'fa-box', cls: 'bg-slate' };
            const hasDiscount = p.mrp && p.mrp > p.price;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Product">
                    <div class="product-cell">
                        <div class="row-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
                        <div class="min-w-0">
                            <div class="product-name">${escapeHtml(p.name)}</div>
                            <div class="product-sub">${escapeHtml(p.brand)} · ${escapeHtml(p.sku || '—')}</div>
                        </div>
                    </div>
                </td>
                <td data-label="Category">${escapeHtml(p.category)}</td>
                <td data-label="Brand">${escapeHtml(p.brand)}</td>
                <td data-label="Specification">${escapeHtml(p.spec || '—')}</td>
                <td data-label="Qty / kW">${formatQtyPerKw(p)}</td>
                <td data-label="HSN Code">${escapeHtml(p.hsn || '—')}</td>
                <td data-label="GST %">${p.gst}%</td>
                <td data-label="Selling Price">
                    <div class="price-cell">
                        ${hasDiscount ? `<span class="price-mrp">₹${p.mrp.toLocaleString('en-IN')}</span>` : ''}
                        <span class="price-selling">₹${p.price.toLocaleString('en-IN')}${hasDiscount ? `<span class="discount-badge">${discountLabel(p)}% OFF</span>` : ''}</span>
                    </div>
                </td>
                <td data-label="Stock">${p.stock} ${escapeHtml(p.unit)}</td>
                <td data-label="Status"><span class="badge ${badgeClass(label)}">${label}</span></td>
                <td data-label="Actions">
                    <div class="row-actions">
                        <button class="action-icon-btn icon-view" data-action="view" data-id="${escapeHtml(p.id)}" title="View"><i class="fas fa-eye"></i></button>
                        <button class="action-icon-btn icon-edit" data-action="edit" data-id="${escapeHtml(p.id)}" title="Edit"><i class="fas fa-pen"></i></button>
                        <button class="action-icon-btn icon-stock" data-action="stock" data-id="${escapeHtml(p.id)}" title="Stock History"><i class="fas fa-clock-rotate-left"></i></button>
                        <button class="action-icon-btn danger" data-action="delete" data-id="${escapeHtml(p.id)}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        renderPagination(totalPages);
        renderStats();
        renderNotifications();
    }

    function renderPagination(totalPages) {
        paginationEl.innerHTML = '';

        const prev = document.createElement('button');
        prev.className = 'pagination-btn' + (state.page === 1 ? ' disabled' : '');
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
            btn.className = 'pagination-btn' + (i === state.page ? ' active' : '');
            btn.textContent = i;
            btn.addEventListener('click', () => { state.page = i; render(); });
            paginationEl.appendChild(btn);
        }

        const next = document.createElement('button');
        next.className = 'pagination-btn' + (state.page === totalPages ? ' disabled' : '');
        next.innerHTML = '<i class="fas fa-chevron-right" style="font-size:9px"></i>';
        next.disabled = state.page === totalPages;
        next.addEventListener('click', () => { state.page++; render(); });
        paginationEl.appendChild(next);
    }

    // ---------------------------------------------------
    // 8. Filters / search / sort / pagination
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
        state.category = e.target.value; state.page = 1; render();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
        state.status = e.target.value; state.page = 1; render();
    });
    document.getElementById('filter-gst').addEventListener('change', (e) => {
        state.gst = e.target.value; state.page = 1; render();
    });
    document.getElementById('rows-per-page').addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10); state.page = 1; render();
    });
    document.getElementById('btn-retry-load').addEventListener('click', loadProducts);

    document.querySelectorAll('.data-table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = key;
                state.sortDir = 'asc';
            }
            document.querySelectorAll('.data-table thead th').forEach(h => h.classList.remove('sorted'));
            th.classList.add('sorted');
            render();
        });
    });

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const product = products.find(p => sameId(p.id, btn.dataset.id));
        if (!product) return;

        if (action === 'view') openViewModal(product);
        if (action === 'edit') openProductModal(product);
        if (action === 'stock') openStockHistoryModal(product);
        if (action === 'delete') openDeleteModal(product);
    });

    // ---------------------------------------------------
    // 9. Add / Edit modal + validation + save
    // ---------------------------------------------------
    const form = {
        id: document.getElementById('pf-id'),
        name: document.getElementById('pf-name'),
        partner: document.getElementById('pf-partner'),
        category: document.getElementById('pf-category'),
        brand: document.getElementById('pf-brand'),
        sku: document.getElementById('pf-sku'),
        spec: document.getElementById('pf-spec'),
        unit: document.getElementById('pf-unit'),
        hsn: document.getElementById('pf-hsn'),
        gst: document.getElementById('pf-gst'),
        warranty: document.getElementById('pf-warranty'),
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
        if (priceManuallyEdited && form.price.value !== '') recalcDiscountFromPrice();
        else recalcPriceFromDiscount();
    });
    form.discount.addEventListener('input', recalcPriceFromDiscount);
    form.price.addEventListener('input', () => {
        priceManuallyEdited = true;
        recalcDiscountFromPrice();
    });

    // ---- Channel partner ----
    // Backend rule (TenantResolver.requirePartnerIdForCreate): on CREATE, a Super Admin (data scope ALL)
    // MUST send the partnerId of a real channel partner. Partner users never send it (the backend uses
    // their own partner). On EDIT nobody sends it.
    const isSuperAdmin = () => {
        try {
            const role = window.Session && Session.getRole ? Session.getRole() : null;
            return String(role || '').toUpperCase().replace(/[^A-Z]/g, '') === 'SUPERADMIN';
        } catch (_) { return false; }
    };
    // If the backend ever answers "partnerId is required", this flips on as a safety net.
    let partnerForced = false;
    const needsPartnerPick = () => !form.id.value && (partnerForced || isSuperAdmin());
    let partnerOptions = null;

    async function fillPartnerSelect(selectedId) {
        const wrap = document.getElementById('pf-partner-wrap');
        wrap.classList.toggle('hidden', !needsPartnerPick());
        if (!needsPartnerPick()) return;
        if (!partnerOptions) {
            try {
                partnerOptions = toArray(await call(ENDPOINTS.partnerOptions));
            } catch (err) {
                showToast(errorMessage(err, 'Could not load channel partners'), 'error');
                return;
            }
        }
        // the options endpoint already returns only active PARTNER records (platform is excluded)
        form.partner.innerHTML = '<option value="">Select channel partner</option>' +
            partnerOptions.map(o => {
                const label = o.name || o.label || o.companyName || o.partnerName || '';
                const text = label && o.code ? `${label} (${o.code})` : (label || o.code || ('Partner #' + o.id));
                return `<option value="${escapeHtml(o.id)}">${escapeHtml(text)}</option>`;
            }).join('');
        form.partner.value = selectedId != null ? String(selectedId) : '';
    }

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
            form.hsn.value = product.hsn || '';
            form.gst.value = product.gst;
            form.warranty.value = product.warranty || '';
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
            form.gst.value = 18;
            form.warranty.value = '';
        }
        openModal('modal-product');
        fillPartnerSelect(product ? product.partnerId : null);
    }

    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal(null));

    function clearErrors() {
        document.querySelectorAll('#modal-product .field-input').forEach(f => f.classList.remove('invalid'));
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

        if (needsPartnerPick() && !form.partner.value) { setFieldError(form.partner, 'err-pf-partner', 'Please select a channel partner'); valid = false; }
        if (!form.name.value.trim()) { setFieldError(form.name, 'err-pf-name', 'Product name is required'); valid = false; }
        if (!form.category.value) { setFieldError(form.category, 'err-pf-category', 'Please select a category'); valid = false; }
        if (!form.brand.value.trim()) { setFieldError(form.brand, 'err-pf-brand', 'Brand is required'); valid = false; }
        if (form.mrp.value === '' || Number(form.mrp.value) < 0) { setFieldError(form.mrp, 'err-pf-mrp', 'Enter a valid MRP'); valid = false; }
        if (form.discount.value !== '' && (Number(form.discount.value) < 0 || Number(form.discount.value) > 100)) {
            setFieldError(form.discount, 'err-pf-discount', 'Discount must be between 0–100%'); valid = false;
        }
        if (form.price.value === '' || Number(form.price.value) < 0) { setFieldError(form.price, 'err-pf-price', 'Enter a valid selling price'); valid = false; }
        if (form.mrp.value !== '' && form.price.value !== '' && Number(form.price.value) > Number(form.mrp.value)) {
            setFieldError(form.price, 'err-pf-price', 'Selling price cannot exceed MRP'); valid = false;
        }
        if (form.stock.value === '' || Number(form.stock.value) < 0) { setFieldError(form.stock, 'err-pf-stock', 'Enter a valid stock quantity'); valid = false; }
        if (form.qtyPerKw.value === '' || Number(form.qtyPerKw.value) < 0) {
            setFieldError(form.qtyPerKw, 'err-pf-qtyperkw', 'Enter a valid quantity per kW (0 if not applicable)'); valid = false;
        }
        return valid;
    }

    // Field names here match ProductRequestDto exactly.
    //
    // IMPORTANT (backend rule, ProductServiceImpl.computePrice): when BOTH mrp and discountPercent are sent,
    // the backend recomputes price = mrp x (1 - discount/100) and IGNORES the price we send. The form rounds
    // the discount to 2 decimals, so a price typed by hand (e.g. MRP 13800, price 12500) would be silently
    // changed by a few paise. So we only send discountPercent when it reproduces the entered price exactly
    // (to the paisa); otherwise discountPercent is sent as null and the backend stores the typed price.
    function buildPayload() {
        const mrp = Number(form.mrp.value);
        const price = Number(form.price.value);
        const typedDiscount = form.discount.value !== '' ? Number(form.discount.value) : null;

        let discountPercent = null;
        if (mrp > 0) {
            const d = typedDiscount !== null ? typedDiscount : ((mrp - price) / mrp) * 100;
            const backendPrice = Math.round(mrp * (1 - d / 100) * 100) / 100;
            if (Math.abs(backendPrice - price) < 0.005) {
                discountPercent = Math.round(d * 100) / 100;
            }
        } else {
            discountPercent = 0;
        }

        return {
            ...(needsPartnerPick() ? { partnerId: Number(form.partner.value) } : {}),
            name: form.name.value.trim(),
            category: CATEGORY_TO_API[form.category.value] || form.category.value,
            brand: form.brand.value.trim(),
            sku: form.sku.value.trim() || null,
            spec: form.spec.value.trim() || null,
            unit: form.unit.value,
            hsn: form.hsn.value.trim() || null,
            gstPercent: Number(form.gst.value) || 0,
            warrantyYears: form.warranty.value !== '' ? Number(form.warranty.value) : 0,
            mrp: mrp,
            discountPercent: discountPercent,
            price: price,
            stock: Number(form.stock.value),
            lowStockThreshold: Number(form.threshold.value || 10),
            qtyPerKw: Number(form.qtyPerKw.value),
            status: String(form.status.value).toUpperCase(),   // ACTIVE | INACTIVE
            description: form.description.value.trim() || null
        };
    }

    document.getElementById('btn-save-product').addEventListener('click', (e) => {
        if (!validateProductForm()) {
            showToast('Please fill all required fields correctly', 'error');
            return;
        }
        const isEdit = !!form.id.value;
        const payload = buildPayload();

        withBusy(e.currentTarget, async () => {
            try {
                if (isEdit) await call(ENDPOINTS.one(form.id.value), 'PUT', payload);
                else await call(ENDPOINTS.list, 'POST', payload);
            } catch (err) {
                console.error('Save product failed:\n' + JSON.stringify({ status: err && err.status, code: err && err.errorCode, message: err && err.message, errors: err && err.errors, sentPayload: payload }, null, 2));
                const detail = err && Array.isArray(err.errors) && err.errors.length
                    ? err.errors.map(x => ((x.field || x.fieldName || x.path) ? (x.field || x.fieldName || x.path) + ': ' : '') + (x.message || x.defaultMessage || '')).join(' • ')
                    : '';
                // Safety net: backend wants a partner but the dropdown was not shown
                if (!isEdit && !partnerForced && /partnerid is required|channel partner/i.test((err && err.message) || '')) {
                    partnerForced = true;
                    await fillPartnerSelect(null);
                    showToast('Please select a channel partner and save again.', 'error');
                    return;
                }
                showToast(detail || errorMessage(err, 'Could not save the product'), 'error');
                return;
            }
            closeModal('modal-product');
            showToast(isEdit ? 'Product updated successfully' : 'Product added successfully', 'success');
            await refreshProducts();
        });
    });

    // ---------------------------------------------------
    // 10. View modal
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
                <div class="view-item"><div class="view-label">HSN Code</div><div class="view-value">${escapeHtml(p.hsn || '—')}</div></div>
                <div class="view-item"><div class="view-label">GST Rate</div><div class="view-value">${p.gst}%</div></div>
                <div class="view-item"><div class="view-label">Warranty</div><div class="view-value">${p.warranty > 0 ? p.warranty + ' Years' : '—'}</div></div>
                <div class="view-item"><div class="view-label">MRP</div><div class="view-value">₹${(p.mrp ?? p.price).toLocaleString('en-IN')}</div></div>
                <div class="view-item"><div class="view-label">Selling Price</div><div class="view-value">₹${p.price.toLocaleString('en-IN')} / ${escapeHtml(p.unit)}${hasDiscount ? ` <span class="discount-badge">${discountLabel(p)}% OFF</span>` : ''}</div></div>
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
    // 10b. Stock History modal
    // ---------------------------------------------------
    let stockHistoryProduct = null;
    const stockLedgerBody = document.getElementById('stock-ledger-body');
    const stockHistoryProductName = document.getElementById('stock-history-product-name');
    const stockHistoryCurrentStock = document.getElementById('stock-history-current-stock');
    const slType = document.getElementById('sl-type');
    const slQty = document.getElementById('sl-qty');
    const slReason = document.getElementById('sl-reason');

    function formatLedgerDate(raw) {
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d)) return escapeHtml(String(raw).slice(0, 10));
        const hasTime = String(raw).length > 10;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
            (hasTime ? ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
    }

    async function renderStockLedger(productId) {
        stockLedgerBody.innerHTML = '<div class="ledger-empty"><span class="spinner"></span>Loading…</div>';
        let entries;
        try {
            entries = toArray(await call(ENDPOINTS.stockHistory(productId))).map(normalizeLedgerEntry);
        } catch (err) {
            if (!stockHistoryProduct || !sameId(stockHistoryProduct.id, productId)) return;
            stockLedgerBody.innerHTML = `<div class="ledger-empty">${escapeHtml(errorMessage(err, 'Could not load stock history.'))}</div>`;
            return;
        }
        if (!stockHistoryProduct || !sameId(stockHistoryProduct.id, productId)) return;

        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (entries.length === 0) {
            stockLedgerBody.innerHTML = '<div class="ledger-empty">No stock movements recorded yet.</div>';
            return;
        }

        stockLedgerBody.innerHTML = entries.map(e => `
            <div class="ledger-item">
                <div class="ledger-icon ${e.type === 'in' ? 'ledger-in' : 'ledger-out'}">
                    <i class="fas ${e.type === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                </div>
                <div class="ledger-info">
                    <div class="ledger-reason">${escapeHtml(e.reason || (e.type === 'in' ? 'Stock added' : 'Stock removed'))}</div>
                    <div class="ledger-date">${formatLedgerDate(e.date)}</div>
                </div>
                <div class="ledger-qty ${e.type === 'in' ? 'ledger-in' : 'ledger-out'}">${e.type === 'in' ? '+' : '-'}${e.qty}</div>
            </div>
        `).join('');
    }

    function updateStockHeader() {
        if (!stockHistoryProduct) return;
        stockHistoryCurrentStock.textContent = `${stockHistoryProduct.stock} ${stockHistoryProduct.unit} in stock`;
    }

    function openStockHistoryModal(product) {
        stockHistoryProduct = product;
        stockHistoryProductName.textContent = product.name;
        updateStockHeader();
        slType.value = 'in';
        slQty.value = '';
        slReason.value = '';
        renderStockLedger(product.id);
        openModal('modal-stock-history');
    }

    document.getElementById('btn-add-stock-entry')?.addEventListener('click', (e) => {
        if (!stockHistoryProduct) return;
        const qty = parseInt(slQty.value, 10);
        if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
        const type = slType.value;
        if (type === 'out' && qty > stockHistoryProduct.stock) {
            showToast('Cannot remove more than current stock', 'error');
            return;
        }

        const productId = stockHistoryProduct.id;
        withBusy(e.currentTarget, async () => {
            try {
                await call(ENDPOINTS.stockHistory(productId), 'POST', {
                    type: STOCK_TYPE_TO_API[type],
                    quantity: qty,
                    reason: slReason.value.trim()
                });
            } catch (err) {
                showToast(errorMessage(err, 'Could not update stock'), 'error');
                return;
            }
            slQty.value = '';
            slReason.value = '';
            showToast(type === 'in' ? 'Stock added' : 'Stock removed', 'success');

            await refreshProducts();
            const fresh = products.find(p => sameId(p.id, productId));
            if (fresh) { stockHistoryProduct = fresh; updateStockHeader(); }
            renderStockLedger(productId);
        });
    });

    // ---------------------------------------------------
    // 11. Delete modal
    // ---------------------------------------------------
    let productToDelete = null;

    function openDeleteModal(p) {
        productToDelete = p;
        document.getElementById('delete-product-name').textContent = p.name;
        openModal('modal-delete-product');
    }

    document.getElementById('btn-confirm-delete-product').addEventListener('click', (e) => {
        const target = productToDelete;
        if (!target) return;
        withBusy(e.currentTarget, async () => {
            try {
                await call(ENDPOINTS.one(target.id), 'DELETE');
            } catch (err) {
                showToast(errorMessage(err, 'Could not delete the product'), 'error');
                return;
            }
            productToDelete = null;
            closeModal('modal-delete-product');
            showToast('Product deleted', 'success');
            await refreshProducts();
        });
    });

    // ---------------------------------------------------
    // 12. Initial load
    // ---------------------------------------------------
    loadProducts();

    window.SolarProducts = {
        getAll: () => products,
        getById: (id) => products.find(p => sameId(p.id, id)),
        getByCategory: (category) => products.filter(p => p.category === category),
        reload: loadProducts
    };

})();