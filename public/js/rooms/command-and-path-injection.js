(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["input", "must", "never", "reach", "the", "shell"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Command and path injection: talking to the server\u2019s system", ROOM_SLUG = "command-and-path-injection", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You chained a second command onto a diagnostic tool and walked a file path out of the folder it was meant to stay in. Same root cause as every other injection room: trusted input where only data should be.";
  var HINTS = ["Hint 1: look at the three example characters in Task 1. Which one is used in real shells to separate two full commands written on one line?", "Hint 2: for Task 2, type the hostname field exactly as shown: 127.0.0.1; whoami, then press Ping and read the extra output line after the ping result.", "Hint 3: for Task 3, each ../ moves up one folder from docs/. You need to go up once to get back to the site root, then into config/. Try ../config/ followed by a filename, or look at what View shows for a nonexistent file to guess the real one."];
  var QUIZZES = [["q1-btn", "q1-fb", "Chaining commands", "a", "Correct. The semicolon ends the ping command and starts whoami as a brand new command in the same shell.", "Not quite. 8.8.8.8 and localhost are just hostnames with no special meaning to the shell. Which of the three options contains a character the shell treats as a separator?"], ["q2-btn", "q2-fb", "Path traversal", "a", "Correct. Each ../ moves one level up the folder tree before the rest of the path is applied.", "Not quite. ../ is a standard relative-path instruction on both Windows and Unix-like systems, and it doesn’t delete anything. What does it do to where you are in the folder tree?"]];

  // Fake command engine: no real shell, no real filesystem. Everything below is a lookup table.
  var PING_RESULTS = {
    '8.8.8.8': 'PING 8.8.8.8: 1 packets transmitted, 1 received, 0% packet loss',
    '127.0.0.1': 'PING 127.0.0.1: 1 packets transmitted, 1 received, 0% packet loss',
    'localhost': 'PING localhost: 1 packets transmitted, 1 received, 0% packet loss'
  };
  var SECOND_CMDS = { whoami: 'www-data', id: 'uid=33(www-data) gid=33(www-data) groups=33(www-data)', pwd: '/var/www/harbour-netops' };

  function runPing(raw){
    var m = /^([^;&|`$]*)(?:\s*(;|&&|\|)\s*(.*))?$/.exec(raw.trim());
    var host = (m ? m[1] : raw).trim();
    var sep = m && m[2], rest = m && m[3] ? m[3].trim() : '';
    var lines = [];
    lines.push('$ ping -c 1 ' + host);
    lines.push(PING_RESULTS[host] || ('ping: cannot resolve ' + host + ': Unknown host'));
    if(sep && rest){
      var key = rest.split(/\s+/)[0];
      lines.push('$ ' + rest);
      lines.push(SECOND_CMDS.hasOwnProperty(key) ? SECOND_CMDS[key] : (key + ': command not found'));
    }
    return lines.join('\n');
  }

  var FILES = {
    'docs/welcome.txt': 'Welcome to Harbour Net Ops. See the handbook for diagnostic tool usage.',
    'docs/handbook.txt': 'Diagnostics are for internal use only. Report issues to the ops channel.',
    'config/app.conf': 'System note (Base64): ' + btoa(FLAG)
  };
  function resolvePath(name){
    var parts = ('docs/' + name).split('/'), stack = [];
    parts.forEach(function(p){
      if(p === '' || p === '.') return;
      if(p === '..') stack.pop(); else stack.push(p);
    });
    return stack.join('/');
  }
  function runView(name){
    var resolved = resolvePath(name);
    var lines = ['$ open ' + resolved];
    if(FILES.hasOwnProperty(resolved)) lines.push(FILES[resolved]);
    else lines.push('Error: file not found: ' + resolved);
    return lines.join('\n');
  }

  $('pg-go').addEventListener('click', function(){ $('pg-out').textContent = runPing($('pg-host').value); });
  $('pg-fgo').addEventListener('click', function(){ $('pg-fout').textContent = runView($('pg-file').value); });
  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent = 'That doesn\u2019t look like valid Base64. Copy only the value after "System note (Base64):".'; }
  });

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = v===';'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'Correct. The semicolon separates two commands in most shells, regardless of whether the first one succeeded.':'A period and a hyphen are ordinary characters in a hostname. Which of the three is a shell command separator?'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()).replace(/-/g,''); var ok = v==='wwwdata'; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. whoami ran as a completely separate command, as the same account that runs the web server.':'Type 127.0.0.1; whoami exactly into the ping field and press Ping. Read the second line of output.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v==='appconf'||v==='app.conf'; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. ../config/app.conf walks back out of docs/ and into the neighbouring config/ folder.':'Try ../config/app.conf in the View document field. Each ../ moves one folder up before the rest of the path is applied.'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = v==='avoiding'; taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. Avoiding the shell (or checking the resolved path) removes the whole class of bypass; stripping specific characters or strings only blocks the attacks someone already thought of.':'Think about which fix blocks every variation of the attack, not just the exact pattern you tried. If you haven\u2019t yet, decode config/app.conf\u2019s value and submit the flag below.'); return ok; }
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
