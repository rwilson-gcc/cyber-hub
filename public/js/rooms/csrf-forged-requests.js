(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["tokens", "stop", "forged", "requests"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "CSRF: requests you never meant to send", ROOM_SLUG = "csrf-forged-requests", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You forged a request using nothing but a victim\u2019s existing session, then found the one defence that actually proves a request was intentional rather than merely authenticated.";
  var HINTS = ["Hint 1: of the four actions listed, only two change anything at all. Of those two, which is irreversible?", "Hint 2: the cookie proves who is logged in. Look at the request shown and compare it with a normal login form; what extra, hard-to-guess value does a real action usually need to include that this one doesn’t?", "Hint 3: for Task 4, tick one defence, press Send it, read the result, then untick it before trying the next. Only one of the three, used alone, fully blocks the request."];
  var QUIZZES = [["q1-btn", "q1-fb", "Which action is a CSRF target?", "a", "Correct. It changes something (the user’s email), which is exactly the kind of action worth forging.", "Not quite. CSRF is only useful against requests that change something. Which of the three options does that?"], ["q2-btn", "q2-fb", "What does a cookie prove?", "a", "Correct. The cookie only proves the browser sending the request is logged in. It says nothing about who or what triggered the request.", "Not quite. The cookie travels automatically with every request to that site, from any page. What does that mean it can and can’t prove?"]];

  var defs = { token:false, samesite:false, origin:false };
  ['token','samesite','origin'].forEach(function(k){ $('def-'+k).addEventListener('change', function(){ defs[k] = this.checked; }); });

  var ACTIONS = {
    email: { method:'POST', path:'/account/email', body:'new_email=attacker%40evil.example' },
    delete: { method:'POST', path:'/account/delete', body:'' }
  };

  function buildRequest(){
    var a = ACTIONS[$('csrf-action').value];
    var lines = [a.method + ' ' + a.path + ' HTTP/1.1', 'Host: glenfield-forum.example'];
    lines.push('Cookie: session=sess_amy_8f2c91' + (defs.samesite ? ' (SameSite=Lax: not sent on this cross-site request)' : ''));
    if(defs.origin) lines.push('Origin: https://attacker-page.example  (server will reject: not glenfield-forum.example)');
    if(a.body) lines.push('', a.body + (defs.token ? '' : ''));
    if(defs.token) lines.push((a.body?'':'') , (a.body?'&':'') + 'csrf_token=<attacker cannot read this value>');
    return lines.join('\n');
  }
  $('csrf-view').addEventListener('click', function(){ $('csrf-out').textContent = buildRequest(); });

  $('csrf-send').addEventListener('click', function(){
    var out = $('csrf-out'), a = $('csrf-action').value;
    var blocked = null;
    if(defs.samesite) blocked = 'SameSite cookies: the browser did not attach the session cookie to this cross-site request, so the server sees no logged-in user at all.';
    else if(defs.origin) blocked = 'Origin check: the server saw this request did not originate from glenfield-forum.example and rejected it.';
    else if(defs.token) blocked = 'Anti-CSRF token: the request had no valid token (the attacker page cannot read or guess it), so the server rejected it.';
    out.textContent = buildRequest() + '\n\n';
    if(blocked){
      out.textContent += 'Result: request REJECTED.\n' + blocked;
    } else if(a === 'delete'){
      out.textContent += 'Result: request ACCEPTED. The simulated account for amy has been deleted, triggered only by visiting the attacker page while logged in.';
    } else {
      out.textContent += 'Result: request ACCEPTED. The simulated account email for amy has been changed to attacker@evil.example.';
    }
  });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v.indexOf('delete')>=0; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. Deleting an account is irreversible, which makes it the highest-value and most damaging target to forge.':'Look again at the table: which action, if forged successfully, could never be undone?'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v.indexOf('token')>=0 || v.indexOf('proof')>=0 || v.indexOf('secret')>=0; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. There is no unpredictable, server-issued value (a token) proving the request came from a real page on the site, rather than anywhere else.':'Think about what a form on the real site could include that a hostile page on a completely different site couldn\u2019t read or guess.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v.indexOf('accept')>=0 || v.indexOf('delete')>=0; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. With no defences active, the server accepted the request purely because a valid session cookie was attached, and deleted the account.':'With all three defence checkboxes off, select Delete account and press Send it. Read the Result line.'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = v.indexOf('token')>=0 || v.indexOf('samesite')>=0 || v.indexOf('origin')>=0; taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. Any one of the three defences, used alone, is enough to reject this forged request. Good sites often layer more than one anyway.':'Tick exactly one defence at a time, resend the Delete account forgery, and read the Result line. Try each of the three in turn.'); return ok; }
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
