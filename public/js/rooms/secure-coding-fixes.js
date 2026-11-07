(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["fix", "the", "cause", "not", "the", "symptom"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Secure coding: fixing injection flaws", ROOM_SLUG = "secure-coding-fixes", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. Across four snippets you chose the fix that removes the flaw rather than the one that only disguises it. That instinct is the single most useful thing to take from this whole path.";
  var HINTS = ["Hint 1: for Task 1, think about which fix removes the quote mark’s power entirely, rather than trying to catch every character that might cause trouble.", "Hint 2: for Task 2, the issue is output, not input. Which fix changes how the data is written into the page, rather than guessing which words to block?", "Hint 3: for Task 4, re-read the comment in the snippet carefully: it says the check \"already\" happened, but where? Two separate problems need two separate fixes."];
  var QUIZZES = [["q1-btn", "q1-fb", "Spot the symptom fix", "a", "Correct. Stripping ../ once doesn’t stop a crafted input designed so that removing the inner copy leaves a working ../ behind.", "Not quite. Think about what happens if an attacker predicts that the filter will strip ../ exactly once, and builds their input around that."], ["q2-btn", "q2-fb", "Where must validation happen?", "a", "Correct. A client-side check is only a convenience. The server is the only part of the system an attacker can’t edit, so it must enforce the rule itself.", "Not quite. A disabled button or a JavaScript check runs in the browser, which anyone can inspect and bypass, as you did in an earlier room."]];

  var checks = {
    1:function(){ var v=document.querySelector('input[name=t1]:checked'), ok = v && v.value==='b'; taskMeta[1]={answer:v?v.value:'(none)',correct:ok}; fb('fb1',ok, ok?'Correct. A parameterised query keeps user and pass as data, whatever characters they contain. Escaping quotes is a symptom fix, and a length limit stops nothing structural.':'Think about which option stops the database ever treating user input as part of the query\u2019s structure, not just one dangerous character.'); return ok; },
    2:function(){ var v=document.querySelector('input[name=t2]:checked'), ok = v && v.value==='b'; taskMeta[2]={answer:v?v.value:'(none)',correct:ok}; fb('fb2',ok, ok?'Correct. Encoding the output means the browser always treats displayName as text, regardless of what it contains. Blocking a word or a length is easy to route around.':'This is about output, the same idea from the XSS room. Which fix changes how the value is written into the page, rather than guessing which input to reject?'); return ok; },
    3:function(){ var v=document.querySelector('input[name=t3]:checked'), ok = v && v.value==='b'; taskMeta[3]={answer:v?v.value:'(none)',correct:ok}; fb('fb3',ok, ok?'Correct. Checking where the path actually resolves to catches every way of constructing a traversal, not only the literal string ../.':'Stripping ../ once can be bypassed, as you saw in the mini quiz. Which option checks the real destination of the path instead?'); return ok; },
    4:function(){
      var a=$('t4a').checked, b=$('t4b').checked, c=$('t4c').checked;
      var ok = a && c && !b;
      taskMeta[4]={answer:(a?'shell ':'')+(b?'clientonly ':'')+(c?'server':'')||'(none)',correct:ok};
      fb('fb4',ok, ok?'Correct. The snippet needed both fixes: never build a shell string from user input, and re-check quantity on the server since the client-side check proves nothing by itself.':'This snippet has two separate problems. One is the shell command built from filename. The other is trusting a check that only ran in the browser. Which two boxes fix both, without relying on the client-side check alone?');
      return ok;
    }
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
