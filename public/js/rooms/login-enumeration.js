(function(){
  var FLAG = 'FLAG{' + ['weak','password','strong','lesson'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $=function(id){return document.getElementById(id);};
  var done={};
  var ROOM_TITLE = 'Login Enumeration: when error messages talk too much', ROOM_SLUG = 'login-enumeration', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var VALID_USER = 'manager', VALID_PASS = 'summer2026!';
  var loggedIn = false, lastMsg = '';

  $('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var u = $('user').value.trim(), p = $('pass').value;
    var res = $('login-result'), uNorm = u.toLowerCase();
    if(uNorm !== VALID_USER){
      lastMsg = 'Account not found.';
      res.innerHTML = '<span class="msg bad">' + lastMsg + '</span>';
    } else if(p.toLowerCase() !== VALID_PASS){
      lastMsg = 'Incorrect password.';
      res.innerHTML = '<span class="msg warn">' + lastMsg + '</span>';
    } else {
      lastMsg = 'Login successful.';
      res.innerHTML = '<span class="msg good">' + lastMsg + '</span>';
      loggedIn = true;
      $('dashboard').innerHTML = '<div class="card" style="margin-top:1rem"><h3 style="margin-top:0">Staff dashboard</h3><p>Welcome back, manager.</p><p>System note (Base64): <code style="word-break:break-all">' + B64 + '</code></p></div>';
    }
  });

  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className='fb '+(ok?'ok':'no'); el.textContent=(ok?'Correct. ':'Not quite. ')+msg; }
  function mark(n){ done[n]=true; var c=Object.keys(done).length; $('prog-text').textContent='Progress: '+c+' of 4 tasks complete'; $('bar').style.width=(c*25)+'%'; document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',c); }

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok= norm(v).indexOf('accountnotfound')>-1; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'That message confirms root isn’t a real account on this portal.':'Submit the login form with username root and any password, then copy the message shown.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok= norm(v)==='manager'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'Manager returns “Incorrect password” instead of “Account not found” — that’s the giveaway.':'Try each username on the list and compare the exact wording of each message.'); return ok; },
    3:function(){ var v=$('a3').value.trim(); var ok= norm(v)==='summer2026'; taskMeta[3]={answer:v,correct:ok}; fb('fb3',ok, ok?'That weak, guessable password gets you straight into the dashboard.':'Try each password on the list against the username from Task 2.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok= norm(v).indexOf('dashboard')>-1; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now decode the note and submit the result as your flag.':'Log in successfully first — the note only appears on the staff dashboard.'); return ok; }
  };
  document.querySelectorAll('button[data-task]').forEach(function(b){ b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); }); });

  $('q1-btn').addEventListener('click', function(){
    var v=document.querySelector('input[name=q1]:checked'), el=$('q1-fb');
    if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
    var ok=v.value==='b'; el.className='fb '+(ok?'ok':'no');
    el.textContent= ok ? 'Correct. Different wording for “no such account” versus “wrong password” is a classic username enumeration leak.' : 'Not quite — compare what each message actually reveals about the account.';
    quizMeta['Spot the username enumeration leak'] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent='That doesn’t look like valid Base64. Copy the full system note value.'; }
  });

  var hints=[
    'Hint 1: try every username on the list with any password first, and read each message carefully — one of them is different.',
    'Hint 2: once you know the valid username, work through the password list in order against that one username.',
    'Hint 3: after a successful login, copy the Base64 value shown under “System note” into the decoder. The result is your flag.'
  ], hi=0;
  $('hint-btn').addEventListener('click', function(){
    if(hi<hints.length){ var d=document.createElement('div'); d.className='hint'; d.textContent=hints[hi++]; $('hint-list').appendChild(d); }
    if(hi>=hints.length){ this.disabled=true; this.textContent='No more hints'; } else this.textContent='Show next hint';
  });

  $('flag-btn').addEventListener('click', function(){
    var v=$('flag-in').value.trim(), el=$('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v===FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You enumerated a valid username, guessed a weak password, and decoded the reward. That’s the whole attack path, start to finish.'; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='Right format, wrong value. Make sure you decoded the full system note exactly.'; }
    else { el.className='fb no'; el.textContent='That doesn’t look like a flag. Flags use the format FLAG{some_text}.'; }
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
    for(var i=1;i<=5;i++){
      var el = $('r'+i);
      if(el) lines.push('  ' + i + '. ' + (el.value.trim() || '(left blank)'));
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
