(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["public", "by", "default"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "OSINT fundamentals: following the digital footprint", ROOM_SLUG = "osint-fundamentals", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You correlated a username across platforms, pulled a fact from an archived page nobody meant to still be visible, and combined three small clues into one finding. That is OSINT in miniature.";
  var HINTS = ["Hint 1: look at the very last sentence of the CraftForum bio in Source 1.", "Hint 2: in Source 2, the app shows both the username (matching Source 1) and a real name field together.", "Hint 3: for Task 4, think about what Source 3 reveals that Jamie is specifically responsible for right now, which a convincing phishing email could pretend to be about."];
  var QUIZZES = [["q1-btn", "q1-fb", "Why reuse matters", "a", "Correct. The second platform links the same handle to a real name, which the first platform alone never revealed.", "Not quite. If the same handle appears on a platform that does show a real name, what does that let someone do with the first, more private profile?"], ["q2-btn", "q2-fb", "Archived pages", "a", "Correct. Archiving services keep snapshots independent of what the live site currently shows, so removed content can persist elsewhere.", "Not quite. Removing a page from a live site does not reach into every archive or cache that already captured it. What could still hold a copy?"]];

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v==='woodburnjr'; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. WoodburnJR is the handle the bio itself points to on a second platform.':'Re-read the last sentence of the CraftForum bio in Source 1. It names the username directly.'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v.indexOf('jamie')>=0 && v.indexOf('ross')>=0; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. PixelTrail shows the same username, WoodburnJR, alongside a real full name.':'Look at Source 2\u2019s profile fields: one is the username you already found, the other is a full name field sitting right next to it.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v.indexOf('warehouse')>=0 && v.indexOf('system')>=0 && (v.indexOf('admin')>=0); taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. The archived staff directory lists this title, no longer on the live site.':'Source 3 is an old, archived version of a staff directory. Read the line next to "J. Ross".'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = v.indexOf('stock')>=0 || v.indexOf('warehouse')>=0 || v.indexOf('system')>=0 || v.indexOf('access')>=0 || v.indexOf('login')>=0; taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. Knowing Jamie specifically manages login access for a system going live soon gives a phisher a precisely relevant, urgent-sounding pretext, far more convincing than a generic message.':'Think about Source 3 again: what specific, current responsibility does it reveal, and how would that make a fake urgent email about that exact system more convincing?'); return ok; }
  };
  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className = 'fb ' + (ok?'ok':'no'); el.textContent = (ok?'Correct. ':'Not quite. ') + msg; }
  function mark(n){
    done[n] = true; var c = Object.keys(done).length;
    $('prog-text').textContent = 'Progress: ' + c + ' of 4 tasks complete';
    $('bar').style.width = (c*25) + '%';
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow', c);
  }
  document.querySelectorAll('button[data-task]').forEach(function(b){
    b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); });
  });
  function quiz(btnId, fbId, name, correct, okMsg, noMsg){
    $(btnId).addEventListener('click', function(){
      var group = btnId.replace('-btn',''), v=document.querySelector('input[name='+group+']:checked'), el=$(fbId);
      if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
      var ok = v.value===correct; el.className='fb '+(ok?'ok':'no');
      el.textContent = ok ? okMsg : noMsg;
      quizMeta[name] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
    });
  }
  QUIZZES.forEach(function(q){ quiz(q[0], q[1], q[2], q[3], q[4], q[5]); });
  var hi = 0;
  $('hint-btn').addEventListener('click', function(){
    if(hi < HINTS.length){
      var d = document.createElement('div'); d.className='hint'; d.textContent = HINTS[hi++];
      $('hint-list').appendChild(d);
    }
    if(hi >= HINTS.length){ this.disabled = true; this.textContent = 'No more hints'; }
    else this.textContent = 'Show next hint';
  });
  $('flag-btn').addEventListener('click', function(){
    var v = $('flag-in').value.trim(), el = $('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v === FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent=FLAG_OK; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='The format is right, but that isn\u2019t the flag. Check you decoded the whole message exactly.'; }
    else { el.className='fb no'; el.textContent='That doesn\u2019t look like a flag. Flags use the format FLAG{some_text}.'; }
  });
  $('flag-in').addEventListener('keydown', function(e){ if(e.key==='Enter') $('flag-btn').click(); });
  function pad(n){ return n<10 ? '0'+n : ''+n; }
  function nowStr(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
  function buildReport(){
    var name = $('exp-name').value.trim() || '(not entered)';
    var sid = $('exp-id').value.trim() || '(not entered)';
    var lines = [];
    lines.push('Glasgow Clyde College — Cyber Security Learning Room — Evidence of Completion');
    lines.push('Room: ' + ROOM_TITLE);
    lines.push('Name: ' + name);
    lines.push('Student ID: ' + sid);
    lines.push('Learner ID: ' + (window.GCCLearner && window.GCCLearner.id ? window.GCCLearner.id : '(not available)'));
    lines.push('Generated: ' + nowStr());
    lines.push('');
    lines.push('TASK PROGRESS (' + Object.keys(done).length + ' of ' + TASK_COUNT + ' marked complete)');
    for(var i=1;i<=TASK_COUNT;i++){
      var m = taskMeta[i];
      if(m) lines.push('  Task ' + i + ': ' + (m.correct?'Completed':'Attempted, not yet correct') + ' — answer given: "' + m.answer + '"');
      else lines.push('  Task ' + i + ': Not attempted');
    }
    lines.push('');
    var qk = Object.keys(quizMeta);
    if(qk.length){
      lines.push('MINI QUIZ');
      qk.forEach(function(k){ lines.push('  ' + k + ': ' + quizMeta[k]); });
      lines.push('');
    }
    lines.push('REFLECTION ANSWERS');
    for(var j=1;j<=5;j++){
      var el = $('r'+j);
      if(el) lines.push('  ' + j + '. ' + (el.value.trim() || '(left blank)'));
    }
    lines.push('');
    lines.push('FLAG');
    lines.push('  Status: ' + (flagState.achieved ? 'CAPTURED' : 'Not captured'));
    lines.push('  Last value submitted: ' + (flagState.value || '(none entered)'));
    lines.push('');
    lines.push('— End of evidence file —');
    return lines.join('\n');
  }
  $('export-btn').addEventListener('click', function(){
    var report = buildReport();
    var blob = new Blob([report], {type:'text/plain'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var safeName = ($('exp-name').value.trim() || 'student').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'student';
    a.href = url; a.download = safeName + '-' + ROOM_SLUG + '-evidence.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    var el = $('export-fb'); el.className='fb ok'; el.textContent='Evidence file downloaded. Upload it to the Canvas assignment.';
  });
})();
