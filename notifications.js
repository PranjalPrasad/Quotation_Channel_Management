/* ============================================================================
 * notifications.js  -  the topbar bell for EVERY page, fed ONLY by the backend (port 8091, via session.js)
 *
 *   GET    /api/notifications/list?page=&size=&unreadOnly=   PageResponse<NotificationResponseDto>
 *   GET    /api/notifications/unread-count                   { unread }
 *   PATCH  /api/notifications/{id}/markRead/read             { unread }
 *   PATCH  /api/notifications/markAllRead/read-all           { unread }
 *   DELETE /api/notifications/delete/{id}                    { unread }
 *
 * Usage: put  <script src="/notifications.js"></script>  right after  /session.js  on a page that has
 *        <button id="notifBtn"> and <div id="notifDropdown" class="topbar-dropdown notif-dropdown hidden"></div>
 * Everything else (list, tabs, badge, styles) is created here, so no page needs its own notification CSS/JS.
 * Pages that still contain an old click handler on #notifBtn are overridden (capture phase), so the
 * dropdown can never be toggled twice.
 * ========================================================================== */
(function () {
  'use strict';

  var btn = document.getElementById('notifBtn');
  var dd = document.getElementById('notifDropdown');
  if (!btn || !dd || !window.Session || window.__notificationsReady) return;
  window.__notificationsReady = true;

  /* ------------------------------------------------------------------ styles (injected once) */
  if (!document.getElementById('notifStyles')) {
    var st = document.createElement('style');
    st.id = 'notifStyles';
    st.textContent = [
      '#notifBtn{position:relative}',
      '#notifBadge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#810B38;color:#fff;font-size:9px;font-weight:700;line-height:13px;text-align:center;border:1.5px solid #F7ECE1;pointer-events:none}',
      '#notifBadge.hidden,.notif-more.hidden{display:none!important}',
      '#notifDropdown.hidden{display:none}',
      '.notif-dropdown{width:350px;padding:0!important;overflow:hidden}',
      '.notif-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px 6px}',
      '.notif-head .topbar-dropdown-title{padding:0;margin:0}',
      '.notif-link-btn{font-size:11px;font-weight:600;color:#810B38;background:transparent;border:none;padding:3px 7px;border-radius:7px;cursor:pointer}',
      '.notif-link-btn:hover{background:#EFE1D2}',
      '.notif-link-btn:disabled{opacity:.4;cursor:not-allowed;background:transparent}',
      '.notif-tabs{display:flex;gap:6px;padding:0 11px 8px;border-bottom:1px solid #E8D5C0}',
      '.notif-tab{font-size:11px;font-weight:600;color:#6B7280;background:transparent;border:none;padding:4px 11px;border-radius:999px;cursor:pointer}',
      '.notif-tab:hover{background:#EFE1D2}',
      '.notif-tab.active{background:#541A1A;color:#fff}',
      '.notif-list{max-height:360px;overflow-y:auto;overscroll-behavior:contain;padding:5px}',
      '.notif-list::-webkit-scrollbar{width:5px}',
      '.notif-list::-webkit-scrollbar-thumb{background:#DCC3AA;border-radius:10px}',
      '.notif-item{display:flex;align-items:flex-start;gap:9px;padding:8px;border-radius:9px;cursor:pointer;transition:background-color .15s ease}',
      '.notif-item:hover{background:#EFE1D2}',
      '.notif-item.unread{background:rgba(129,11,56,.06)}',
      '.notif-item.unread:hover{background:rgba(129,11,56,.12)}',
      '.notif-dot{flex-shrink:0;width:8px;height:8px;margin-top:5px;border-radius:50%;background:#D1D5DB}',
      '.notif-item.unread .notif-dot.sev-info{background:#3B82F6}',
      '.notif-item.unread .notif-dot.sev-success{background:#10B981}',
      '.notif-item.unread .notif-dot.sev-warning{background:#F59E0B}',
      '.notif-item.unread .notif-dot.sev-error,.notif-item.unread .notif-dot.sev-danger{background:#EF4444}',
      '.notif-body{flex:1 1 auto;min-width:0}',
      '.notif-title{font-size:12px;font-weight:500;color:#374151;line-height:1.35;overflow-wrap:anywhere}',
      '.notif-item.unread .notif-title{font-weight:600;color:#1F2937}',
      '.notif-msg{font-size:11px;color:#6B7280;line-height:1.35;margin-top:2px;overflow-wrap:anywhere}',
      '.notif-time{display:block;font-size:10px;color:#9CA3AF;margin-top:3px}',
      '.notif-del{flex-shrink:0;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:#9CA3AF;border-radius:6px;cursor:pointer;opacity:0;transition:opacity .15s ease}',
      '.notif-del svg{width:12px;height:12px}',
      '.notif-item:hover .notif-del,.notif-del:focus-visible{opacity:1}',
      '.notif-del:hover{background:#FEF2F2;color:#EF4444}',
      '@media (hover:none){.notif-del{opacity:1}}',
      '.notif-state{padding:22px 12px;text-align:center;font-size:11.5px;color:#9CA3AF}',
      '.notif-state button{margin-top:8px;font-size:11px;font-weight:600;color:#810B38;background:transparent;border:none;cursor:pointer;text-decoration:underline}',
      '.notif-more{display:block;width:100%;font-size:11px;font-weight:600;color:#810B38;background:transparent;border:none;border-top:1px solid #E8D5C0;padding:9px;cursor:pointer}',
      '.notif-more:hover{background:#EFE1D2}',
      '.notif-more:disabled{opacity:.5;cursor:wait}',
      '@media (max-width:520px){.notif-dropdown{position:fixed!important;top:56px;left:12px;right:12px;width:auto;max-width:none}.notif-list{max-height:60vh}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ markup (replaces any demo content) */
  dd.classList.add('topbar-dropdown', 'notif-dropdown');
  dd.innerHTML =
    '<div class="notif-head"><p class="topbar-dropdown-title">Notifications</p>' +
    '<button id="notifMarkAllBtn" type="button" class="notif-link-btn" disabled>Mark all as read</button></div>' +
    '<div class="notif-tabs" role="tablist">' +
    '<button type="button" class="notif-tab active" data-filter="all" role="tab">All</button>' +
    '<button type="button" class="notif-tab" data-filter="unread" role="tab">Unread</button></div>' +
    '<div id="notifList" class="notif-list" role="list"></div>' +
    '<button id="notifLoadMoreBtn" type="button" class="notif-more hidden">Load more</button>';

  btn.querySelectorAll('span').forEach(function (s) { s.remove(); });   // old static red dot / badge
  var badgeEl = document.createElement('span');
  badgeEl.id = 'notifBadge';
  badgeEl.className = 'hidden';
  badgeEl.setAttribute('aria-live', 'polite');
  badgeEl.textContent = '0';
  btn.appendChild(badgeEl);
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');

  var listEl = document.getElementById('notifList');
  var markAllEl = document.getElementById('notifMarkAllBtn');
  var moreEl = document.getElementById('notifLoadMoreBtn');
  var tabEls = dd.querySelectorAll('.notif-tab');

  var BASE = '/api/notifications';
  var PAGE_SIZE = 10;
  var POLL_MS = 30000;
  var state = { items: [], page: 0, hasMore: false, unread: 0, unreadOnly: false, loading: false, error: false };

  var ENTITY_LINKS = { QUOTATION: '/Quotation/quotation.html', CUSTOMER: '/customer/customer.html', PROJECT: '/project/project.html' };
  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var str = String(iso);
    var t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : str + 'Z').getTime();   // server sends UTC without a zone
    if (isNaN(t)) return '';
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 45) return 'Just now';
    var m = Math.floor(s / 60);
    if (m < 60) return Math.max(m, 1) + ' min ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' hr ago';
    var d = Math.floor(h / 24);
    if (d < 7) return d + ' day' + (d > 1 ? 's' : '') + ' ago';
    return new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* Session.authFetch adds the Bearer token to http://<host>:8091 and refreshes it on 401. */
  function call(path, options) {
    return Session.authFetch(BASE + path, options).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok || !body || body.success === false) {
          var err = new Error((body && body.message) || 'Request failed (' + res.status + ')');
          err.status = res.status;
          throw err;
        }
        return body.data;
      });
    });
  }

  function renderBadge() {
    var n = state.unread;
    badgeEl.textContent = n > 99 ? '99+' : String(n);
    badgeEl.classList.toggle('hidden', n <= 0);
    btn.setAttribute('aria-label', n > 0 ? 'Notifications, ' + n + ' unread' : 'Notifications');
    markAllEl.disabled = n <= 0;
  }

  function itemHtml(n) {
    var sev = String(n.severity || 'INFO').toLowerCase();
    return '<div class="notif-item ' + (n.read ? '' : 'unread') + '" role="listitem" data-id="' + n.id + '">' +
      '<span class="notif-dot sev-' + esc(sev) + '"></span>' +
      '<div class="notif-body"><div class="notif-title">' + esc(n.title) + '</div>' +
      (n.message ? '<div class="notif-msg">' + esc(n.message) + '</div>' : '') +
      '<span class="notif-time">' + esc(timeAgo(n.createdAt)) + '</span></div>' +
      '<button type="button" class="notif-del" data-del="' + n.id + '" title="Remove" aria-label="Remove notification">' + CLOSE_SVG + '</button></div>';
  }

  function renderList() {
    if (state.loading && !state.items.length) listEl.innerHTML = '<div class="notif-state">Loading…</div>';
    else if (state.error && !state.items.length) listEl.innerHTML = '<div class="notif-state">Couldn’t load notifications.<br><button type="button" data-retry>Try again</button></div>';
    else if (!state.items.length) listEl.innerHTML = '<div class="notif-state">' + (state.unreadOnly ? 'You’re all caught up 🎉' : 'No notifications yet') + '</div>';
    else listEl.innerHTML = state.items.map(itemHtml).join('');
    moreEl.classList.toggle('hidden', !state.hasMore);
    moreEl.disabled = state.loading;
    moreEl.textContent = state.loading ? 'Loading…' : 'Load more';
  }

  function isOpen() { return !dd.classList.contains('hidden'); }

  function fetchUnreadCount() {
    return call('/unread-count').then(function (data) {
      var prev = state.unread;
      state.unread = (data && data.unread) || 0;
      renderBadge();
      if (state.unread > prev && isOpen()) load(true);       // a new one arrived while the list is open
    }).catch(function (e) { console.warn('Notifications: unread-count failed:', e.message); });
  }

  var reqSeq = 0;
  function load(reset) {
    if (state.loading && !reset) return Promise.resolve();
    var mySeq = ++reqSeq;
    state.loading = true; state.error = false;
    if (reset) state.page = 0;
    renderList();
    var nextPage = reset ? 0 : state.page + 1;
    var qs = 'page=' + nextPage + '&size=' + PAGE_SIZE + '&unreadOnly=' + state.unreadOnly;
    return call('/list?' + qs).then(function (data) {
      if (mySeq !== reqSeq) return;
      var incoming = (data && data.content) || [];
      if (reset) state.items = incoming;
      else {
        var seen = {}; state.items.forEach(function (i) { seen[i.id] = true; });
        state.items = state.items.concat(incoming.filter(function (i) { return !seen[i.id]; }));
      }
      state.page = (data && data.page != null) ? data.page : nextPage;
      state.hasMore = state.page + 1 < ((data && data.totalPages) || 0);
    }).catch(function (e) {
      if (mySeq !== reqSeq) return;
      console.warn('Notifications: list failed:', e.message);
      state.error = true;
    }).then(function () {
      if (mySeq === reqSeq) { state.loading = false; renderList(); }
    });
  }

  function markRead(id) {
    var item = state.items.filter(function (i) { return i.id === id; })[0];
    if (!item || item.read) return;
    item.read = true; state.unread = Math.max(0, state.unread - 1); renderBadge(); renderList();
    call('/' + id + '/markRead/read', { method: 'PATCH' }).then(function (d) {
      state.unread = (d && d.unread != null) ? d.unread : state.unread; renderBadge();
    }).catch(function () { item.read = false; fetchUnreadCount(); renderList(); });
  }

  function markAllRead() {
    if (state.unread <= 0) return;
    markAllEl.disabled = true;
    call('/markAllRead/read-all', { method: 'PATCH' }).then(function (d) {
      state.items.forEach(function (i) { i.read = true; });
      state.unread = (d && d.unread) || 0;
      renderBadge();
      if (state.unreadOnly) load(true); else renderList();
    }).catch(function () { markAllEl.disabled = false; });
  }

  function remove(id) {
    call('/delete/' + id, { method: 'DELETE' }).then(function (d) {
      state.items = state.items.filter(function (i) { return i.id !== id; });
      state.unread = (d && d.unread != null) ? d.unread : state.unread;
      renderBadge(); renderList();
    }).catch(function () { /* keep the item if the server refused */ });
  }

  /* ------------------------------------------------------------------ open / close */
  function closeDropdown() { dd.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); }

  // Capture phase + stopImmediatePropagation: any older click handler a page still has on #notifBtn never runs.
  btn.addEventListener('click', function (e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    var willOpen = dd.classList.contains('hidden');
    document.querySelectorAll('.topbar-dropdown').forEach(function (x) { if (x !== dd) x.classList.add('hidden'); });
    dd.classList.toggle('hidden', !willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) { load(true); fetchUnreadCount(); }
  }, true);

  dd.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', closeDropdown);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { closeDropdown(); btn.focus(); } });

  tabEls.forEach(function (t) {
    t.addEventListener('click', function () {
      var unreadOnly = t.getAttribute('data-filter') === 'unread';
      if (unreadOnly === state.unreadOnly) return;
      tabEls.forEach(function (x) { x.classList.toggle('active', x === t); });
      state.unreadOnly = unreadOnly;
      state.items = [];
      load(true);
    });
  });
  markAllEl.addEventListener('click', markAllRead);
  moreEl.addEventListener('click', function () { load(false); });

  listEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-retry]')) return void load(true);
    var del = e.target.closest('[data-del]');
    if (del) return void remove(Number(del.getAttribute('data-del')));
    var row = e.target.closest('.notif-item');
    if (!row) return;
    var id = Number(row.getAttribute('data-id'));
    var n = state.items.filter(function (i) { return i.id === id; })[0];
    if (!n) return;
    markRead(id);
    var link = n.entityType && ENTITY_LINKS[String(n.entityType).toUpperCase()];
    if (link && window.location.pathname.toLowerCase() !== link.toLowerCase()) window.location.href = link;
    else closeDropdown();
  });

  /* ------------------------------------------------------------------ start + polling */
  renderBadge();
  renderList();
  fetchUnreadCount();
  setInterval(function () { if (!document.hidden) fetchUnreadCount(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) fetchUnreadCount(); });

  // Pages can call Notifications.refresh() after an action that creates a notification on the server.
  window.Notifications = { refresh: function () { fetchUnreadCount(); if (isOpen()) load(true); } };
})();