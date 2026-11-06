(function(){
  var FLAG = 'FLAG{' + ['your','cookie','your','trust'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $=function(id){return document.getElementById(id);};
  var done={};
  var ROOM_TITLE = 'Cookies & Sessions: the trust you carry in your pocket', ROOM_SLUG = 'cookies-sessions', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var loggedIn = false;

  function renderJar(){
    var s = $('screen');
    if(!loggedIn){ s.innerHTML = '<p>Not logged in yet. Click “Log in as guest” to see which cookies the site sets.</p>'; return; }
    s.innerHTML =
      '<table><tr><th>Cookie</th><th>Value</th><th>HttpOnly</th><th>Secure</th><th>SameSite</th></tr>' +
      '<tr><td>session</td><td>1007</td><td class="miss">missing</td><td class="miss">missing</td><td>None</td></tr>' +
      '<tr><td>prefs</td><td style="word-break:break-all">' + B64 + '</td><td class="miss">missing</td><td class="yes">set</td><td>Lax</td></tr>' +
      '</table>';
  }
  $('login-btn').addEventListener('click', function(){ loggedIn = true; renderJar(); });
  renderJar();

  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className='fb '+(ok?'ok':'no'); el.textContent=(ok?'Correct. ':'Not quite. ')+msg; }
  function mark(n){ done[n]=true; var c=Object.keys(done).length; $('prog-text').textContent='Progress: '+c+' of 4 tasks complete'; $('bar').style.width=(c*25)+'%'; document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',c); }

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok= norm(v)==='session'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'The session cookie is what keeps you signed in between requests.':'Log in first if you haven’t, then read the Cookie column of the table.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok= norm(v)==='httponly'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'Without HttpOnly, a script running on the page could read this cookie directly.':'Think about which attribute specifically blocks JavaScript from reading a cookie.'); return ok; },
    3:function(){ var el=document.querySelector('input[name=t3]:checked'); var v= el? el.value:''; var ok= v==='b'; taskMeta[3]={answer: v? ('option '+v):'(none selected)', correct:ok}; fb('fb3',ok, ok?'A predictable, incrementing session value is as good as a guessable password for the session.':'Picture trying nearby numbers if you already know one valid session value.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok= norm(v)==='prefs'; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now decode its value and submit the result as your flag.':'Check the cookie table again — which row holds the long Base64-looking value?'); return ok; }
  };
  document.querySelectorAll('button[data-task]').forEach(function(b){ b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); }); });

  $('q1-btn').addEventListener('click', function(){
    var v=document.querySelector('input[name=q1]:checked'), el=$('q1-fb');
    if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
    var ok=v.value==='b'; el.className='fb '+(ok?'ok':'no');
    el.textContent= ok ? 'Correct. HttpOnly stops JavaScript, including an attacker’s injected script, from reading the cookie.' : 'Not quite — think about which attribute controls whether JavaScript can read the cookie at all.';
    quizMeta['Which attribute stops a script reading the cookie'] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent='That doesn’t look like valid Base64. Copy the full cookie value.'; }
  });

  var hints=[
    'Hint 1: click “Log in as guest” first — the cookie table is empty until then.',
    'Hint 2: for Task 2 and Task 3, read across the session cookie’s row and compare it with the theory table of attributes.',
    'Hint 3: copy the full value from the prefs row into the decoder and click Decode Base64. The result is your flag.'
  ], hi=0;
  $('hint-btn').addEventListener('click', function(){
    if(hi<hints.length){ var d=document.createElement('div'); d.className='hint'; d.textContent=hints[hi++]; $('hint-list').appendChild(d); }
    if(hi>=hints.length){ this.disabled=true; this.textContent='No more hints'; } else this.textContent='Show next hint';
  });

  $('flag-btn').addEventListener('click', function(){
    var v=$('flag-in').value.trim(), el=$('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v===FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You named the session cookie, spotted a missing defence, explained a predictable pattern, and decoded a hidden value. That’s a full cookie review.'; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='Right format, wrong value. Make sure you decoded the prefs cookie exactly.'; }
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
