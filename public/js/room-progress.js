/*
 * Saves and restores a room's progress in the background.
 *
 * It works from the page itself rather than from the room scripts' internals, so every room
 * (including future ones) gets saving for free as long as it keeps the shared structure:
 *   - answers:      input[type=text] / textarea outside the simulated browser
 *   - choices:      radio groups (mini quizzes, multiple-choice tasks)
 *   - tasks:        button[data-task] with feedback in #fb<n>  (class "ok" = completed)
 *   - quizzes:      button[id$="-btn"] with feedback in the matching #...-fb
 *   - hints:        #hint-btn / #hint-list
 *   - flag:         #flag-in / #flag-btn / #flag-fb
 *
 * To restore, it refills the fields and then "replays" the Check buttons the learner had already
 * pressed, so the room's own code redraws the feedback, progress bar and evidence-file data.
 *
 * Name and student ID (#exp-name, #exp-id) are personal data: they are kept in this browser only
 * and are never sent to the server. Password fields are never saved anywhere.
 */
(function () {
  'use strict';
  var L = window.GCCLearner;
  var slug = document.body.getAttribute('data-room');
  if (!L || !slug) return;

  var CFG = window.GCC_CONFIG || {};
  var DELAY = CFG.saveDelay || 800;
  var LOCAL_ONLY_IDS = { 'exp-name': 1, 'exp-id': 1 };
  var NAME_KEY = 'gcc-hub-export-details';

  function $(id) { return document.getElementById(id); }
  function inSim(node) { return !!node.closest('.browser'); }

  function textFields() {
    var out = [];
    var nodes = document.querySelectorAll('main input[type=text], main textarea');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.id || inSim(n) || LOCAL_ONLY_IDS[n.id]) continue;
      out.push(n);
    }
    return out;
  }

  /* ---------- collect ---------- */
  function collect() {
    var s = { v: 1, fields: {}, radios: {}, tasks: [], quizzes: [], hints: 0, dec: false, flag: { submitted: false, achieved: false } };
    textFields().forEach(function (n) { if (n.value) s.fields[n.id] = n.value; });

    var radios = document.querySelectorAll('main input[type=radio]:checked');
    for (var i = 0; i < radios.length; i++) if (!inSim(radios[i])) s.radios[radios[i].name] = radios[i].value;

    document.querySelectorAll('button[data-task]').forEach(function (b) {
      var n = b.getAttribute('data-task'), fb = $('fb' + n);
      if (fb && fb.classList.contains('ok')) s.tasks.push(n);
    });

    document.querySelectorAll('main button[id$="-btn"]').forEach(function (b) {
      var base = b.id.slice(0, -4), fb = $(base + '-fb');
      if (!fb || b.id === 'flag-btn' || b.id === 'export-btn') return;
      if (fb.classList.contains('ok') || fb.classList.contains('no')) s.quizzes.push(b.id);
    });

    var hl = $('hint-list'); s.hints = hl ? hl.children.length : 0;

    var dec = $('dec-out'); s.dec = !!(dec && $('dec-in') && $('dec-in').value && dec.textContent.indexOf('Output appears') !== 0);

    var ffb = $('flag-fb');
    if (ffb) {
      s.flag.achieved = ffb.classList.contains('ok');
      s.flag.submitted = s.flag.achieved || ffb.classList.contains('no');
    }
    s.summary = { tasks: s.tasks.length, flag: s.flag.achieved };
    return s;
  }

  /* ---------- restore ---------- */
  function restore(s) {
    if (!s || typeof s !== 'object') return;
    var fields = s.fields || {};
    Object.keys(fields).forEach(function (id) {
      var n = $(id);
      if (n && typeof fields[id] === 'string') n.value = fields[id];
    });
    var radios = s.radios || {};
    Object.keys(radios).forEach(function (name) {
      var r = document.querySelector('main input[type=radio][name="' + name + '"][value="' + radios[name] + '"]');
      if (r) r.checked = true;
    });
    (s.quizzes || []).forEach(function (id) { var b = $(id); if (b) b.click(); });
    (s.tasks || []).forEach(function (n) {
      var b = document.querySelector('button[data-task="' + n + '"]'); if (b) b.click();
    });
    if (s.dec && $('dec-btn')) $('dec-btn').click();
    var hb = $('hint-btn');
    for (var i = 0; i < (s.hints || 0) && hb && !hb.disabled; i++) hb.click();
    if (s.flag && s.flag.submitted && $('flag-btn') && $('flag-in') && $('flag-in').value) $('flag-btn').click();
  }

  /* ---------- export-form details: this browser only ---------- */
  function loadExportDetails() {
    try {
      var d = JSON.parse(L.localGet(NAME_KEY) || '{}');
      if (d.name && $('exp-name') && !$('exp-name').value) $('exp-name').value = d.name;
      if (d.sid && $('exp-id') && !$('exp-id').value) $('exp-id').value = d.sid;
    } catch (e) { /* ignore */ }
  }
  function saveExportDetails() {
    var n = $('exp-name'), i = $('exp-id'); if (!n && !i) return;
    L.localSet(NAME_KEY, JSON.stringify({ name: n ? n.value : '', sid: i ? i.value : '' }));
  }

  /* ---------- saving ---------- */
  var timer = null, dirty = false, inflight = false, lastJson = '', restoring = true, retryMs = 0;

  function schedule() {
    if (restoring) return;
    dirty = true; L.setStatus('saving');
    clearTimeout(timer); timer = setTimeout(flush, DELAY);
  }

  function flush(opts) {
    clearTimeout(timer);
    if (!dirty || restoring) return Promise.resolve();
    var s = collect(), json = JSON.stringify(s);
    if (json === lastJson) { dirty = false; L.setStatus(L.isOnline() || !L.hasApi() ? 'saved' : 'offline'); return Promise.resolve(); }
    var stamp = Date.now();                                // client clock only, so "newest copy" is judged consistently
    s.savedAt = stamp;
    L.cacheSet(slug, s, stamp);                            // always keep a local copy first
    if (!L.hasApi()) { lastJson = json; dirty = false; L.setStatus('offline'); return Promise.resolve(); }
    if (inflight && !(opts && opts.keepalive)) { timer = setTimeout(flush, 300); return Promise.resolve(); }
    inflight = true;
    return L.ready.then(function () { return L.saveRoom(slug, s, opts); }).catch(function (e) {
      if (e.status === 404) return L.claim().then(function () { return L.saveRoom(slug, s, opts); });
      throw e;
    }).then(function () {
      lastJson = json; dirty = false; retryMs = 0; inflight = false; L.setStatus('saved');
    }, function () {
      inflight = false; L.setStatus('offline');
      retryMs = Math.min((retryMs || 2000) * 2, 60000);    // back off, keep the data, try again later
      timer = setTimeout(flush, retryMs);
    });
  }

  function onChange(e) {
    if (e.target && e.target.id && LOCAL_ONLY_IDS[e.target.id]) { saveExportDetails(); return; }
    if (e.target && e.target.closest && e.target.closest('.learner-slot')) return;
    // Clicks run the room's own handlers first; saving is deferred so we read the finished state.
    schedule();
  }
  document.addEventListener('input', onChange);
  document.addEventListener('change', onChange);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.learner-slot')) return;
    if (e.target && e.target.closest && e.target.closest('button')) schedule();
  });
  window.addEventListener('pagehide', function () { if (dirty) flush({ keepalive: true }); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && dirty) flush({ keepalive: true }); });
  window.addEventListener('online', function () { if (lastJson !== JSON.stringify(collect())) { dirty = true; flush(); } });

  /* ---------- start: load the freshest copy (server vs this device) ---------- */
  function start() {
    loadExportDetails();
    L.ready.then(function () {
      var local = L.cacheGet(slug);
      var remote = L.hasApi() ? L.getRoom(slug).catch(function () { return null; }) : Promise.resolve(null);
      return remote.then(function (r) {
        var pick = null;
        var rTime = r && r.state ? (r.state.savedAt || Date.parse(r.updated_at) || 0) : 0;
        if (r && r.state && (!local || rTime >= local.savedAt)) pick = r.state;
        else if (local) pick = local.state;
        if (pick) { restore(pick); lastJson = JSON.stringify(collect()); }
        // If this device held newer data than the server (e.g. it was offline), push it up.
        if (local && pick === local.state && L.hasApi() && r !== null) { lastJson = ''; dirty = true; }
      });
    }).then(function () {
      restoring = false;
      if (dirty) flush(); else L.setStatus(L.hasApi() && L.isOnline() ? 'saved' : L.getStatus());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
