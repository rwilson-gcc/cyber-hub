/*
 * Hub page: the "Done" tick boxes and progress bar.
 *
 * Works exactly as before (tick a room to mark it complete), with three additions:
 *   - ticks are saved against the learner ID, so they follow the learner between devices;
 *   - a room ticks itself automatically the first time its flag is captured (unticking still works);
 *   - each card shows how far the learner got in that room.
 */
(function () {
  'use strict';
  var L = window.GCCLearner;
  var LEGACY_KEY = 'gcc-cyber-hub-progress';                 // the original, pre-learner-ID storage key

  var boxes = document.querySelectorAll('.done-check');
  var total = document.querySelectorAll('.room[data-room]').length;   // every room card, live or not

  var ticks = {};     // explicit choices the learner made: { slug: true|false }
  var rooms = {};     // what the server knows about each room: { slug: { tasks_done, flag } }
  var saveTimer = null;

  function isDone(slug) {
    if (Object.prototype.hasOwnProperty.call(ticks, slug)) return !!ticks[slug];
    return !!(rooms[slug] && rooms[slug].flag);              // auto-tick on first flag capture
  }

  function render() {
    var done = 0;
    boxes.forEach(function (box) {
      var slug = box.getAttribute('data-room'), article = box.closest('.room'), d = isDone(slug);
      box.checked = d; article.classList.toggle('done', d);
      if (d) done++;

      var info = rooms[slug], tags = article.querySelector('.tags'), tag = tags && tags.querySelector('.tag-progress');
      var text = '';
      if (info && info.flag) text = 'Flag captured';
      else if (info && info.tasks_done > 0) text = info.tasks_done + ' of 4 tasks';
      if (text && tags) {
        if (!tag) { tag = document.createElement('span'); tag.className = 'tag tag-progress'; tags.appendChild(tag); }
        tag.textContent = text;
      } else if (tag) { tag.remove(); }
    });
    document.getElementById('hub-prog-text').textContent = 'Progress: ' + done + ' of ' + total + ' rooms marked complete';
    document.getElementById('hub-bar').style.width = (total ? (done / total * 100) : 0) + '%';
    var pb = document.querySelector('#path1 [role=progressbar]');
    pb.setAttribute('aria-valuenow', done); pb.setAttribute('aria-valuemax', total);
  }

  function persist() {
    var stamp = Date.now();
    if (L.id) L.cacheSet('_hub', { ticks: ticks }, stamp);
    if (!L.hasApi()) { L.setStatus('offline'); return; }
    L.setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      L.ready.then(function () { return L.saveHub(ticks, stamp); }).catch(function (e) {
        if (e.status === 404) return L.claim().then(function () { return L.saveHub(ticks, stamp); });
        throw e;
      }).then(function () { L.setStatus('saved'); }, function () { L.setStatus('offline'); });
    }, 500);
  }

  boxes.forEach(function (box) {
    box.addEventListener('change', function () {
      ticks[box.getAttribute('data-room')] = box.checked;
      render(); persist();
    });
  });

  function loadLocal() {
    var cached = L.id ? L.cacheGet('_hub') : null;
    if (cached && cached.state && cached.state.ticks) ticks = cached.state.ticks;
    else {
      // First visit with a learner ID: carry over ticks from the pre-ID version of the hub, if any.
      try { var old = JSON.parse(L.localGet(LEGACY_KEY) || '{}'); Object.keys(old).forEach(function (k) { ticks[k] = !!old[k]; }); } catch (e) { /* ignore */ }
    }
  }

  function loadServer() {
    if (!L.hasApi()) return Promise.resolve();
    return L.ready.then(function () { return L.getSummary(); }).then(function (sum) {
      rooms = sum.rooms || {};
      var serverTicks = sum.hub && sum.hub.ticks;
      var serverTime = sum.hub && sum.hub.savedAt || 0;
      var cached = L.cacheGet('_hub');
      var localTime = cached ? cached.savedAt : 0;
      if (serverTicks && Object.keys(serverTicks).length && serverTime >= localTime) ticks = serverTicks;
      else if (Object.keys(ticks).length && localTime >= serverTime) persist();      // this device is newer
      L.setStatus('saved');
      render();
    }).catch(function () { L.setStatus('offline'); });
  }

  loadLocal(); render();
  loadServer();
  // Coming back with the browser's Back button: refresh what each room has recorded.
  window.addEventListener('pageshow', function (e) { if (e.persisted) loadServer(); });
})();
