(function(){
  var FLAG = 'FLAG{' + ['headers','talk','if','you','listen'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $=function(id){return document.getElementById(id);};
  var done={};
  var ROOM_TITLE = "HTTP Headers: what your browser isn't telling you", ROOM_SLUG = 'http-headers', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };

  var pages = {
    '/': {status:'200 OK', headers:['Server: Apache/2.2.3','X-Powered-By: PHP/5.3.1','Content-Type: text/html'], body:'Riverside Books — new and secondhand titles, delivered across Glasgow.'},
    '/staff-area': {status:'403 Forbidden', headers:['Server: Apache/2.2.3','Content-Type: text/html'], body:'You do not have permission to view this page.'},
    '/basket': {status:'200 OK', headers:['Content-Type: text/html','Set-Cookie: session=9241'], body:'Your basket is empty.'},
    '/status': {status:'200 OK', headers:['Content-Type: text/plain','X-Debug-Token: ' + B64], body:'All systems normal.'}
  };

  function render(path){
    var s = $('screen'), p = pages[path];
    s.textContent = '';
    if(!p){ var pre=document.createElement('pre'); pre.textContent='404 Not Found\nNo page exists at ' + path; s.appendChild(pre); return; }
    var st = document.createElement('p'); st.className='status-line'; st.textContent = 'GET ' + path + '  →  ' + p.status; s.appendChild(st);
    var pre = document.createElement('pre'); pre.textContent = p.headers.join('\n') + '\n\n' + p.body; s.appendChild(pre);
  }
  $('nav-form').addEventListener('submit', function(e){ e.preventDefault(); var v=$('path').value.trim(); if(v.charAt(0)!=='/')v='/'+v; $('path').value=v; render(v); });
  render('/');

  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className='fb '+(ok?'ok':'no'); el.textContent=(ok?'Correct. ':'Not quite. ')+msg; }
  function mark(n){ done[n]=true; var c=Object.keys(done).length; $('prog-text').textContent='Progress: '+c+' of 4 tasks complete'; $('bar').style.width=(c*25)+'%'; document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',c); }

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = v.replace(/[^0-9]/g,'')==='403'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'403 means the page exists but refuses you, which is still useful information.':'Send a request to /staff-area and read the status line.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok = norm(v)==='php'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'PHP/5.3.1 is years out of date, a gift to anyone scanning for known weaknesses.':'Look at the response headers for / and find the X-Powered-By line.'); return ok; },
    3:function(){ var el=document.querySelector('input[name=t3]:checked'); var v= el? el.value:''; var ok= v==='b'; taskMeta[3]={answer: v? ('option '+v):'(none selected)', correct:ok}; fb('fb3',ok, ok?'X-Frame-Options (or a CSP frame-ancestors rule) stops the page being framed by another site.':'Think about which header specifically controls whether a page can be loaded in a frame.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = norm(v).indexOf('xdebugtoken')>-1; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now decode its value and submit the result as your flag.':'Check the response headers for /status — one of them isn’t a standard header.'); return ok; }
  };
  document.querySelectorAll('button[data-task]').forEach(function(b){ b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); }); });

  $('q1-btn').addEventListener('click', function(){
    var v=document.querySelector('input[name=q1]:checked'), el=$('q1-fb');
    if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
    var ok=v.value==='b'; el.className='fb '+(ok?'ok':'no');
    el.textContent= ok ? 'Correct. X-Frame-Options or a CSP frame-ancestors directive prevents clickjacking.' : 'Not quite — think about which header controls whether a page can be embedded in a frame.';
    quizMeta['Which header prevents clickjacking'] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent='That doesn’t look like valid Base64. Copy the full header value.'; }
  });

  var hints=[
    'Hint 1: send a request to every path shown in the tasks before answering — the inspector shows status, headers and body all at once.',
    'Hint 2: for Task 4, look for a header name that starts with X- but isn’t one of the standard security headers from the theory table.',
    'Hint 3: copy the value after "X-Debug-Token:" into the decoder and click Decode Base64. The output is your flag.'
  ], hi=0;
  $('hint-btn').addEventListener('click', function(){
    if(hi<hints.length){ var d=document.createElement('div'); d.className='hint'; d.textContent=hints[hi++]; $('hint-list').appendChild(d); }
    if(hi>=hints.length){ this.disabled=true; this.textContent='No more hints'; } else this.textContent='Show next hint';
  });

  $('flag-btn').addEventListener('click', function(){
    var v=$('flag-in').value.trim(), el=$('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v===FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You read a status code, spotted a version leak, named a missing defence, and decoded a hidden header. That is exactly what a header review looks like in practice.'; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='Right format, wrong value. Make sure you decoded the full header exactly.'; }
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
