(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["encode", "output", "not", "just", "input"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Cross-site scripting: when the page runs your input", ROOM_SLUG = "xss-script-injection", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You reflected a payload, made it persist, and then saw which defence actually stops it rather than just slowing it down. That is the core idea of fixing XSS for good.";
  var HINTS = ["Hint 1: search for something with a &lt; or &gt; in it, then look at exactly how the result is displayed on the simulated page. Is the bracket shown as text or treated as a tag?", "Hint 2: for Task 2, the img tag’s src is deliberately broken, so the browser fires its error handler instead. That handler name is a standard HTML attribute.", "Hint 3: for Task 4, try the checkboxes one at a time, not all together, and watch the result message under the search box each time. Only one of the three actually prevents the script from running at all."];
  var QUIZZES = [["q1-btn", "q1-fb", "Which kind?", "a", "Correct. The payload is saved and served to everyone who later views the page, which is what makes stored XSS the most serious kind.", "Not quite. Reflected XSS only affects the one request. Think about who gets affected here, and for how long."], ["q2-btn", "q2-fb", "The real fix", "a", "Correct. Context-aware output encoding removes the ambiguity between data and code wherever the data ends up.", "Not quite. Attackers have many ways to spell \"script\" or avoid length limits. Only one option removes the actual cause."]];

  var defs = { encode:false, httponly:false, csp:false };
  ['encode','httponly','csp'].forEach(function(k){
    $('def-'+k).addEventListener('change', function(){ defs[k] = this.checked; });
  });

  // Pattern-matching only: this NEVER writes learner text into innerHTML, eval, or a script.
  // It inspects the text and returns a description of what a vulnerable page would have done.
  function encodeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function analyse(raw){
    var hasTagBreak = /[<>]/.test(raw);
    var hasEventAttr = /\bon[a-z]+\s*=/i.test(raw);
    var hasScriptTag = /<\s*script/i.test(raw);
    var displayed = defs.encode ? encodeHtml(raw) : raw;
    var wouldRun = hasTagBreak && !defs.encode && (hasEventAttr || hasScriptTag) && !defs.csp;
    return { displayed: displayed, wouldRun: wouldRun, hasEventAttr: hasEventAttr, hasScriptTag: hasScriptTag, hasTagBreak: hasTagBreak };
  }
  function render(container, raw, label){
    container.textContent = '';
    var p1 = document.createElement('p'); p1.textContent = label + ': ' + raw; container.appendChild(p1);
    var a = analyse(raw);
    var pre = document.createElement('pre');
    pre.textContent = 'Rendered output (as the browser would see the markup):\n' + a.displayed;
    container.appendChild(pre);
    var verdict = document.createElement('p'); verdict.className = 'msg ' + (a.wouldRun ? 'bad' : 'good');
    if(a.wouldRun) verdict.textContent = 'This payload would execute in a real, unprotected browser.';
    else if(defs.encode) verdict.textContent = 'Output encoding is on: the browser shows this as plain text, it does not execute.';
    else if(defs.csp && (a.hasEventAttr || a.hasScriptTag)) verdict.textContent = 'Content Security Policy is on: inline scripts and event handlers are blocked, so this does not execute.';
    else verdict.textContent = 'This input contains no script trigger, so nothing would execute either way.';
    container.appendChild(verdict);
    return a;
  }

  var lastSearch = null, board = [];
  $('xq-go').addEventListener('click', function(){ lastSearch = analyse($('xq').value); render($('xq-out'), $('xq').value, 'You searched for'); });
  $('xc-go').addEventListener('click', function(){
    var v = $('xc').value; if(!v.trim()) return;
    board.push(v); $('xc').value = '';
    var bd = $('xc-board'); bd.textContent = '';
    board.forEach(function(c){ var row = document.createElement('div'); render(row, c, 'Comment'); bd.appendChild(row); });
    render($('xc-out'), v, 'Posted');
  });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v==='notencoded'||v==='unencoded'||v==='not'; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. The angle brackets came straight back as real markup, not as text. That is the root cause of this room.':'Search for something with < or > in it and look at the Rendered output line. Is the bracket shown as the literal characters < and >, or has it become part of the markup?'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v==='onerror'; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. onerror is an event-handler attribute, and the browser runs whatever JavaScript it contains the moment the image fails to load.':'Look at the payload again: img src=x onerror=alert(1). The broken image forces one specific attribute to fire. What is it called?'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v==='stored'; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. A posted comment is saved and shown to every future visitor automatically, which makes stored XSS far more dangerous than a one-off reflected link.':'Which version keeps affecting new people after you\u2019ve gone: the one that only appears when someone clicks a crafted search link, or the one sitting permanently in the guestbook?'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = v==='outputencoding'||v==='encoding'||v==='contentsecuritypolicy'||v==='csp'; taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. Output encoding (and a correctly configured CSP) stop the script from running at all. HttpOnly only limits what a script can do once it has already run.':'Tick each defence on its own and resubmit your Task 2 payload after each one. Watch the verdict message change. One of the three actually stops execution; the others don\u2019t.'); if(ok){ var el=$('flag-in'); } return ok; }
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
