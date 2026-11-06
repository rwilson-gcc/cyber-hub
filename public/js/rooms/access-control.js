(function(){
  var FLAG = 'FLAG{' + ['check','every','time','not','just','once'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $=function(id){return document.getElementById(id);};
  var done={};
  var ROOM_TITLE = "Access Control: who's allowed to see what", ROOM_SLUG = 'access-control', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var loggedIn = false;

  var pages = {
    '/account/2048': function(){ return {status:'200 OK', body:"Your loan history (member 2048)\n- The Hobbit (returned)\n- Data Structures in Plain English (due 14 Nov)"}; },
    '/account/2047': function(){ return {status:'200 OK', body:"Loan history (member 2047)\n- Advanced Gaelic Grammar (returned)\n- Private note: library card suspended pending fine payment"}; },
    '/catalogue': function(){ return {status:'200 OK', body:'Lochview Library — search the catalogue, renew loans, reserve titles.'}; },
    '/admin/dashboard': function(){ return {status:'200 OK', body:'Admin dashboard\nTotal members: 4,812\nOverdue items: 206\nSystem note (Base64): ' + B64}; }
  };

  function render(path){
    var s=$('screen'); s.textContent='';
    if(!loggedIn && path !== '/catalogue'){
      var warn=document.createElement('pre'); warn.textContent='401 Unauthorised\nPlease log in first.'; s.appendChild(warn); return;
    }
    var p = pages[path];
    if(!p){ var pre=document.createElement('pre'); pre.textContent='404 Not Found\nNo page exists at ' + path; s.appendChild(pre); return; }
    var r = p();
    var st=document.createElement('p'); st.className='status-line'; st.textContent='GET '+path+'  →  '+r.status; s.appendChild(st);
    var body=document.createElement('pre'); body.textContent=r.body; s.appendChild(body);
  }
  $('login-btn').addEventListener('click', function(){ loggedIn = true; $('login-state').textContent='Logged in as member 2048'; render($('path').value.trim() || '/account/2048'); });
  $('nav-form').addEventListener('submit', function(e){ e.preventDefault(); var v=$('path').value.trim(); if(v.charAt(0)!=='/')v='/'+v; $('path').value=v; render(v); });
  render('/account/2048');

  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className='fb '+(ok?'ok':'no'); el.textContent=(ok?'Correct. ':'Not quite. ')+msg; }
  function mark(n){ done[n]=true; var c=Object.keys(done).length; $('prog-text').textContent='Progress: '+c+' of 4 tasks complete'; $('bar').style.width=(c*25)+'%'; document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',c); }

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok= v.replace(/[^0-9]/g,'')==='2047'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'Account 2047 belongs to someone else, and the site shows it with no ownership check.':'Make sure you’re logged in, then try visiting /account/2047 in the address bar.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok= norm(v)==='idor' || norm(v).indexOf('horizontal')>-1; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'That’s exactly it — an insecure direct object reference, resulting in horizontal privilege escalation.':'Look back at Idea 2 in the theory section for the name of this flaw.'); return ok; },
    3:function(){ var el=document.querySelector('input[name=t3]:checked'); var v= el? el.value:''; var ok= v==='a'; taskMeta[3]={answer: v? ('option '+v):'(none selected)', correct:ok}; fb('fb3',ok, ok?'The page loads with no role check at all — a missing function-level access control.':'Try visiting /admin/dashboard yourself while logged in as the member, and see what actually happens.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok= norm(v).indexOf('admin')>-1; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now decode that value and submit the result as your flag.':'The note only appears on one page — the one you reached through forced browsing.'); return ok; }
  };
  document.querySelectorAll('button[data-task]').forEach(function(b){ b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); }); });

  $('q1-btn').addEventListener('click', function(){
    var v=document.querySelector('input[name=q1]:checked'), el=$('q1-fb');
    if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
    var ok=v.value==='a'; el.className='fb '+(ok?'ok':'no');
    el.textContent= ok ? 'Correct. Both accounts are at the same level, so reaching the other one is horizontal escalation.' : 'Not quite — think about whether the attacker gained a higher level of access, or just reached sideways into someone else’s account.';
    quizMeta['Horizontal or vertical scenario'] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent='That doesn’t look like valid Base64. Copy the full system note value.'; }
  });

  var hints=[
    'Hint 1: log in first, then try small changes to the number at the end of /account/2048 — you don’t need to guess far.',
    'Hint 2: for Task 3, just type /admin/dashboard into the address bar while still logged in as the member. No special trick needed.',
    'Hint 3: copy the value after "System note (Base64):" on the admin dashboard into the decoder. The result is your flag.'
  ], hi=0;
  $('hint-btn').addEventListener('click', function(){
    if(hi<hints.length){ var d=document.createElement('div'); d.className='hint'; d.textContent=hints[hi++]; $('hint-list').appendChild(d); }
    if(hi>=hints.length){ this.disabled=true; this.textContent='No more hints'; } else this.textContent='Show next hint';
  });

  $('flag-btn').addEventListener('click', function(){
    var v=$('flag-in').value.trim(), el=$('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v===FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You found an IDOR, named it correctly, forced your way into an admin page, and decoded the result. That’s a complete access control review.'; }
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
