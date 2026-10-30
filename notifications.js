/* ============================================================================
 * notifications.js  -  the topbar bell, fed ONLY by the backend (port 8091, through session.js)
 *
 *   GET    /api/notifications/list?page=&size=&unreadOnly=   PageResponse<NotificationResponseDto>
 *   GET    /api/notifications/unread-count                   { unread }
 *   PATCH  /api/notifications/{id}/markRead/read             { unread }
 *   PATCH  /api/notifications/markAllRead/read-all           { unread }
 *   DELETE /api/notifications/delete/{id}                    { unread }
 *
 * Load it after /session.js on any page that has  #notifBtn  and  #notifDropdown.
 * If the page still contains hard-coded demo notifications, they are replaced by the real list.
 * Styles (.notif-*, #notifBadge) come from /dashboard/dashboard.css.
 * ========================================================================== */
(function () {
  'use strict';

  var btn = document.getElementById('notifBtn');
  var dd = document.getElementById('notifDropdown');
  if (!btn || !dd || !window.Session) return;

  // Replace any demo markup with the real structure.
  if (!document.getElementById('notifList')) {
    dd.classList.add('notif-dropdown');
    dd.innerHTML =
      '<div class="notif-head"><p class="topbar-dropdown-title">Notifications</p>' +
      '<button id="notifMarkAllBtn" type="button" class="notif-link-btn" disabled>Mark all as read</button></div>' +
      '<div class="notif-tabs" role="tablist">' +
      '<button type="button" class="notif-tab active" data-filter="all" role="tab">All</button>' +
      '<button type="button" class="notif-tab" data-filter="unread" role="tab">Unread</button></div>' +
      '<div id="notifList" class="notif-list" role="list"></div>' +
      '<button id="notifLoadMoreBtn" type="button" class="notif-more hidden">Load more</button>';
  }
  var badgeEl = document.getElementById('notifBadge');
  if (!badgeEl) {                                   // old markup had a static red dot instead of a counter
    btn.querySelectorAll('span').forEach(function (s) { s.remove(); });
    badgeEl = document.createElement('span');
    badgeEl.id = 'notifBadge';
    badgeEl.className = 'hidden';
    badgeEl.setAttribute('aria-live', 'polite');
    badgeEl.textContent = '0';
    btn.appendChild(badgeEl);
  }

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
    var t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : str + 'Z').getTime();
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

  function fetchUnreadCount() {
    return call('/unread-count').then(function (data) {
      var prev = state.unread;
      state.unread = (data && data.unread) || 0;
      renderBadge();
      if (state.unread > prev && !dd.classList.contains('hidden')) load(true);
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

  // ---- events
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var willOpen = dd.classList.contains('hidden');
    document.querySelectorAll('.topbar-dropdown').forEach(function (x) { if (x !== dd) x.classList.add('hidden'); });
    dd.classList.toggle('hidden', !willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) load(true);
  });
  dd.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { dd.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); });

  tabEls.forEach(function (t) {
    t.addEventListener('click', function () {
      tabEls.forEach(function (x) { x.classList.toggle('active', x === t); });
      state.unreadOnly = t.getAttribute('data-filter') === 'unread';
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
    if (link) window.location.href = link;
  });

  // ---- start
  fetchUnreadCount();
  setInterval(function () { if (!document.hidden) fetchUnreadCount(); }, POLL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) fetchUnreadCount(); });
})();