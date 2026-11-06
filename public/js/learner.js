/*
 * Learner identity + progress API client, shared by the hub and every room.
 *
 * - On first visit the server issues a random learner ID (GCC-XXXX-XXXX-XXXX, 60 bits of entropy).
 * - The ID is kept in this browser's localStorage and sent to the API in an X-Learner-Id header
 *   (never in the URL, so it stays out of access logs).
 * - Entering the same ID on another device carries progress across.
 * - If the server cannot be reached, everything keeps working from a local copy and syncs later.
 *
 * Exposes window.GCCLearner.
 */
(function () {
  'use strict';

  var CFG = window.GCC_CONFIG || {};
  var API = CFG.apiBase === undefined ? '/api' : CFG.apiBase;   // null = local-only mode
  var ID_KEY = 'gcc-hub-learner';
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';            // Crockford base32: no I, L, O, U
  var ID_RE = /^GCC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

  var listeners = [];
  var state = { id: null, status: API ? 'saved' : 'offline', serverOk: false };

  /* ---------- storage helpers (storage can be blocked, so never assume it works) ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- ID helpers ---------- */
  function generateId() {
    var bytes = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var out = '';
    for (var i = 0; i < 12; i++) out += ALPHABET.charAt(bytes[i] & 31);   // 256 % 32 === 0, so unbiased
    return 'GCC-' + out.slice(0, 4) + '-' + out.slice(4, 8) + '-' + out.slice(8, 12);
  }
  // Accepts "gcc 7k3m 9qxp 2wd4", "GCC7K3M9QXP2WD4", etc. Returns canonical form or null.
  function normaliseId(raw) {
    var s = String(raw || '').toUpperCase().replace(/[\s-]+/g, '');
    if (s.indexOf('GCC') === 0) s = s.slice(3);
    s = s.replace(/[IL]/g, '1').replace(/O/g, '0');                       // Crockford look-alikes
    if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(s)) return null;
    return 'GCC-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  }

  /* ---------- status ---------- */
  function setStatus(s) {
    if (state.status === s) return;
    state.status = s;
    listeners.forEach(function (fn) { try { fn(s); } catch (e) { /* ignore */ } });
  }

  /* ---------- API ---------- */
  function request(method, path, body, opts) {
    opts = opts || {};
    if (!API) return Promise.reject(Object.assign(new Error('API disabled'), { offline: true }));
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : null;
    var headers = { 'Accept': 'application/json' };
    var id = opts.id || state.id;
    if (id) headers['X-Learner-Id'] = id;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: !!opts.keepalive,
      credentials: 'same-origin',
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) { var err = new Error('HTTP ' + res.status); err.status = res.status; throw err; }
      state.serverOk = true;
      return res.status === 204 ? null : res.json();
    }, function (e) {
      if (timer) clearTimeout(timer);
      state.serverOk = false;
      e.offline = true;
      throw e;
    });
  }

  /* ---------- public object ---------- */
  var api = {
    id: state.id,
    ready: null,
    request: request,
    normaliseId: normaliseId,
    cacheGet: cacheGet,
    cacheSet: cacheSet,
    localGet: lsGet, localSet: lsSet, localDel: lsDel,
    hasApi: function () { return !!API; },
    isOnline: function () { return state.serverOk; },
    getStatus: function () { return state.status; },
    setStatus: setStatus,
    onStatus: function (fn) { listeners.push(fn); },
    claim: function () { return createOnServer(state.id); },   // (re)register this ID, e.g. after a server reset
    getSummary: function () { return request('GET', '/me'); },
    getRoom: function (slug) { return request('GET', '/me/rooms/' + encodeURIComponent(slug)); },
    saveRoom: function (slug, st, opts) { return request('PUT', '/me/rooms/' + encodeURIComponent(slug), { state: st }, opts); },
    saveHub: function (ticks, savedAt, opts) { return request('PUT', '/me/hub', { ticks: ticks, savedAt: savedAt || Date.now() }, opts); }
  };
  window.GCCLearner = api;

  /* ---------- identity bootstrap ---------- */
  function createOnServer(proposed) {
    return request('POST', '/learners', proposed ? { id: proposed } : {}).then(function (r) { return r.id; });
  }

  var ready = (function () {
    var stored = normaliseId(lsGet(ID_KEY));
    if (stored) {
      state.id = stored;
      api.id = stored;
      // Make sure the server knows this ID (e.g. it was created offline, or the database was reset).
      return request('GET', '/me').then(function () { return stored; }, function (e) {
        if (e.status === 404) return createOnServer(stored).then(function () { return stored; }, function () { return stored; });
        setStatus('offline');
        return stored;
      });
    }
    return createOnServer().then(function (id) { return id; }, function () {
      setStatus('offline');
      return generateId();                         // offline: claim it with the server later
    }).then(function (id) {
      state.id = id; api.id = id; lsSet(ID_KEY, id);
      return id;
    });
  })();

  api.ready = ready;

  /* ---------- per-room local cache (used when offline, and to pick the freshest copy) ---------- */
  function cacheKey(slug) { return 'gcc-hub:' + state.id + ':' + slug; }
  function cacheGet(slug) {
    var raw = lsGet(cacheKey(slug));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function cacheSet(slug, st, savedAt) { lsSet(cacheKey(slug), JSON.stringify({ savedAt: savedAt || Date.now(), state: st })); }

  /* ---------- badge UI ---------- */
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }
  var STATUS_TEXT = {
    saved: 'Progress is saved to your learner ID.',
    saving: 'Saving your progress…',
    offline: API ? 'The server can’t be reached, so progress is saved on this device only. It will sync when the connection returns.'
                 : 'Progress is saved on this device only.'
  };
  var STATUS_SHORT = { saved: 'Saved', saving: 'Saving…', offline: 'Offline' };

  function buildBadge(slot) {
    var btn = el('button', { type: 'button', 'class': 'learner-btn', 'aria-expanded': 'false', 'aria-controls': 'learner-panel' });
    var dot = el('span', { 'class': 'learner-dot', 'aria-hidden': 'true' });
    var label = el('span', null, 'Learner ID');
    var tail = el('span', { 'class': 'learner-tail' }, '…');
    var live = el('span', { 'class': 'learner-short', style: 'position:absolute;left:-999px' }, '');
    btn.appendChild(dot); btn.appendChild(label); btn.appendChild(tail); btn.appendChild(live);

    var panel = el('div', { 'class': 'learner-panel', id: 'learner-panel', role: 'region', 'aria-label': 'Your learner ID' });
    panel.hidden = true;
    panel.appendChild(el('h2', null, 'Your learner ID'));
    panel.appendChild(el('p', null, 'This ID saves your progress automatically in the background. Keep a note of it: type it in on any device to carry on where you left off.'));
    var idBox = el('code', { 'class': 'learner-id' }, 'Getting your ID…');
    panel.appendChild(idBox);
    var row1 = el('div', { 'class': 'lrow' });
    var copy = el('button', { type: 'button', 'class': 'alt' }, 'Copy ID');
    row1.appendChild(copy);
    panel.appendChild(row1);
    var statusP = el('p', null, STATUS_TEXT.saved);
    panel.appendChild(statusP);
    panel.appendChild(el('hr'));
    panel.appendChild(el('h2', null, 'Carry on from another device'));
    var row2 = el('div', { 'class': 'lrow' });
    var input = el('input', { type: 'text', id: 'learner-switch', placeholder: 'GCC-XXXX-XXXX-XXXX', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Learner ID to switch to' });
    var sw = el('button', { type: 'button' }, 'Switch');
    row2.appendChild(input); row2.appendChild(sw);
    panel.appendChild(row2);
    panel.appendChild(el('hr'));
    var fresh = el('button', { type: 'button' }, 'Start again with a new ID');
    panel.appendChild(fresh);
    panel.appendChild(el('p', null, 'Your old ID keeps working if you’ve noted it down. Name and student ID typed into an export form stay on this device and are never sent to the server.'));
    var msg = el('p', { 'class': 'learner-msg', role: 'status', 'aria-live': 'polite' });
    panel.appendChild(msg);

    slot.appendChild(btn); slot.appendChild(panel);

    function paintStatus() {
      var s = api.getStatus();
      dot.className = 'learner-dot' + (s === 'saving' ? ' saving' : s === 'offline' ? ' offline' : '');
      statusP.textContent = STATUS_TEXT[s];
      live.textContent = STATUS_SHORT[s];
    }
    api.onStatus(paintStatus);
    paintStatus();

    ready.then(function (id) { idBox.textContent = id; tail.textContent = id.slice(-4); paintStatus(); });

    function toggle(open) {
      panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open) idBox.scrollIntoView({ block: 'nearest' });
    }
    btn.addEventListener('click', function () { toggle(panel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { toggle(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!panel.hidden && !slot.contains(e.target)) toggle(false); });

    copy.addEventListener('click', function () {
      var id = api.id; if (!id) return;
      function ok() { msg.textContent = 'Copied. Keep it somewhere safe.'; }
      function fallback() {
        var r = document.createRange(); r.selectNodeContents(idBox);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        msg.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected ID.';
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(ok, fallback); else fallback();
    });

    function doSwitch() {
      var wanted = normaliseId(input.value);
      if (!wanted) { msg.textContent = 'That doesn’t look like a learner ID. It should look like GCC-7K3M-9QXP-2WD4.'; return; }
      if (wanted === api.id) { msg.textContent = 'You’re already using that ID.'; return; }
      msg.textContent = 'Checking…';
      request('GET', '/me', undefined, { id: wanted }).then(function () {
        lsSet(ID_KEY, wanted); msg.textContent = 'Found it. Loading your progress…'; location.reload();
      }, function (e) {
        if (e.status === 404) msg.textContent = 'No learner found with that ID. Check it and try again.';
        else if (e.status === 429) msg.textContent = 'Too many attempts. Wait a minute and try again.';
        else msg.textContent = 'The server can’t be reached, so that ID can’t be checked right now.';
      });
    }
    sw.addEventListener('click', doSwitch);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSwitch(); });

    fresh.addEventListener('click', function () {
      if (!window.confirm('Start again with a brand new learner ID? Your current progress stays under the old ID, so note it down first if you want to come back to it.')) return;
      lsDel(ID_KEY); location.reload();
    });
  }

  function init() {
    var slots = document.querySelectorAll('.learner-slot');
    for (var i = 0; i < slots.length; i++) buildBadge(slots[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
