(function(){
  // Flag is built at runtime. Learners can read this, which is part of reflection question 4.
  var FLAG = 'FLAG{' + ['recon','is','just','connecting','dots'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = 'Recon 101: follow the breadcrumbs', ROOM_SLUG = 'recon-101', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };

  var HOME_SRC = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <title>Clydeside Cafe</title>\n</head>\n<body>\n  <h1>Clydeside Cafe</h1>\n  <p>Coffee, cake and good company.</p>\n  <!-- Dev note: lock down /staff-portal/ before launch! -->\n  <p>Open daily, 8am to 5pm.</p>\n</body>\n</html>';
  var pages = {
    '/': {html:'<div class="shop"><h2 style="font-size:2rem">Clydeside Cafe</h2><p>Coffee, cake and good company.</p><p>Open daily, 8am to 5pm.</p></div>', src:HOME_SRC},
    '/robots.txt': {text:'User-agent: *\nDisallow: /staff-portal/\nDisallow: /old-backups/'},
    '/staff-portal/': {text:'403 Forbidden\nYou need to sign in to view this page.\n(Simulation: nothing to find here.)'},
    '/old-backups/': {text:'Index of /old-backups/\n\n  menu-2023.pdf        12 KB\n  till-export.csv      48 KB\n  notes.txt             1 KB'},
    '/old-backups/notes.txt': {text:'Reminder to self: move the old files off the server.\nSpare token (Base64): ' + B64},
    '/old-backups/menu-2023.pdf': {text:'(Simulation: an old menu. Nothing useful here.)'},
    '/old-backups/till-export.csv': {text:'(Simulation: sample data removed for this exercise.)'}
  };
  var showSrc = false, current = '/';

  function render(){
    var s = $('screen'), p = pages[current];
    s.textContent = '';
    if(!p){ s.innerHTML = '<pre></pre>'; s.firstChild.textContent = '404 Not Found\nNo page exists at ' + current; return; }
    if(showSrc){
      var pre = document.createElement('pre');
      pre.textContent = p.src ? p.src : (p.text);
      s.appendChild(pre);
    } else if(p.html){ s.innerHTML = p.html; }
    else { var q = document.createElement('pre'); q.textContent = p.text; s.appendChild(q); }
  }
  function go(path){
    path = path.trim(); if(path.charAt(0) !== '/') path = '/' + path;
    if(path === '/index.html') path = '/';
    if(path !== '/' && path.indexOf('.') < 0 && path.slice(-1) !== '/') path += '/';
    current = path; $('path').value = path; showSrc = false;
    $('src-btn').setAttribute('aria-pressed','false'); render();
  }
  $('nav-form').addEventListener('submit', function(e){ e.preventDefault(); go($('path').value); });
  $('src-btn').addEventListener('click', function(){
    showSrc = !showSrc; this.setAttribute('aria-pressed', showSrc); render();
  });
  render();

  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className = 'fb ' + (ok?'ok':'no'); el.textContent = (ok?'Correct. ':'Not quite. ') + msg; }
  function mark(n){
    done[n] = true; var c = Object.keys(done).length;
    $('prog-text').textContent = 'Progress: ' + c + ' of 4 tasks complete';
    $('bar').style.width = (c*25) + '%';
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow', c);
  }
  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = norm(v)==='staff-portal'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'That note shows why comments in source code are risky.':'Open the home page, choose View source and look for a comment starting with “Dev note”.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok = norm(v)==='old-backups'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'The file listed a folder that wasn’t linked anywhere else.':'Visit /robots.txt and compare its two folders with the one from Task 1.'); return ok; },
    3:function(){ var el=document.querySelector('input[name=t3]:checked'); var v = el? el.value : ''; var ok = v==='b'; taskMeta[3]={answer: v? ('option '+v):'(none selected)', correct:ok}; fb('fb3',ok, ok?'Directory listings show every file in a folder when the server isn’t configured to hide them.':'Visit /old-backups/. What does the page show: a list of files, an input box or a script?'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = norm(v).replace('-','')==='base64'; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now paste the token into the decoder, then submit the result as your flag.':'Open /old-backups/notes.txt. The label next to the token names the encoding.'); return ok; }
  };
  document.querySelectorAll('button[data-task]').forEach(function(b){
    b.addEventListener('click', function(){ var n=b.getAttribute('data-task'); if(checks[n]()) mark(n); });
  });

  $('enc-btn').addEventListener('click', function(){
    var v=document.querySelector('input[name=enc]:checked'), el=$('enc-fb');
    if(!v){ el.className='fb info'; el.textContent='Pick an answer first.'; return; }
    var ok = v.value==='b'; el.className='fb '+(ok?'ok':'no');
    el.textContent = ok ? 'Correct. Base64 is encoding. No key is needed to reverse it.' : 'Not quite. Remember: encoding changes the format, but anyone can undo it without a key.';
    quizMeta['Encoding vs encryption'] = ok ? 'Correct' : 'Incorrect (selected option '+v.value+')';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent = 'That doesn’t look like valid Base64. Check you copied the whole token, including any = signs at the end.'; }
  });

  var hints = [
    'Hint 1: work through the tasks in order. Each answer gives you the path to the next one.',
    'Hint 2: the file at /old-backups/notes.txt holds a long string of letters and numbers. The text beside it names the encoding.',
    'Hint 3: copy the token from notes.txt, paste it into the decoder and choose Decode Base64. The result is your flag.'
  ], hi = 0;
  $('hint-btn').addEventListener('click', function(){
    if(hi < hints.length){
      var d = document.createElement('div'); d.className='hint'; d.textContent = hints[hi++];
      $('hint-list').appendChild(d);
    }
    if(hi >= hints.length){ this.disabled = true; this.textContent = 'No more hints'; }
    else this.textContent = 'Show next hint';
  });

  $('flag-btn').addEventListener('click', function(){
    var v = $('flag-in').value.trim(), el = $('flag-fb');
    if(!v){ el.className='fb info'; el.textContent='Enter a flag first. It starts with FLAG{.'; return; }
    flagState.value = v;
    if(v === FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You followed the trail from a hidden comment to a decoded secret, and you did it without breaking anything. Head to the reflection questions to lock in what you’ve learned.'; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='The format is right, but that isn’t the flag. Check you decoded the token exactly and copied all of it.'; }
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
