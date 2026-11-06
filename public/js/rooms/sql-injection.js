(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ['input','is','data','not','code'].join('_') + '}';
  var B64 = btoa(FLAG);
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = 'SQL Injection: when input becomes instruction', ROOM_SLUG = 'sql-injection', TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var E = window.SqliEngine;

  // The fictional database. Plain arrays: nothing here is a real database.
  var DB = {
    products: { cols:['name','price','category'], rows:[
      ['Hybrid commuter','£449','Bikes'], ['Trail hardtail','£699','Bikes'],
      ['Kids balance bike','£89','Bikes'], ['Folding city bike','£529','Bikes'],
      ['Cable lock','£24','Accessories'], ['Front light set','£19','Accessories'],
      ['Pannier bag','£45','Accessories'], ['Puncture repair kit','£9','Accessories']
    ]},
    staff: { cols:['username','password'], rows:[ ['admin','x9$Kq2!vL7mPz'], ['jmacleod','Rt5#nW8@pZq4'] ] },
    staff_notes: { cols:['id','note'], rows:[
      [1,'Reorder bike locks before Friday.'],
      [2,'System note (Base64): ' + B64]
    ]}
  };

  /* ---------- the simulated site ---------- */
  function showQuery(template, vals){
    var pre = $('sql-out'); pre.textContent = '';
    template.split(/(\{[a-z]\})/).forEach(function(part){
      var m = /^\{([a-z])\}$/.exec(part);
      if(m){ var sp = document.createElement('span'); sp.className = 'inj'; sp.textContent = vals[m[1]]; pre.appendChild(sp); }
      else if(part){ pre.appendChild(document.createTextNode(part)); }
    });
  }
  function errorBlock(error, sql){
    var wrap = document.createElement('div');
    var st = document.createElement('p'); st.className = 'status-line'; st.textContent = '500 Internal Server Error'; wrap.appendChild(st);
    var pre = document.createElement('pre'); pre.textContent = 'Database error\n' + error + '\n\nDebug (developer mode left on):\n' + sql; wrap.appendChild(pre);
    return wrap;
  }
  function resultTable(r){
    if(!r.rows.length){ var p = document.createElement('p'); p.textContent = 'No products found.'; return p; }
    var t = document.createElement('table'), head = t.createTHead().insertRow();
    ['Product','Price','Category'].forEach(function(h){ var th = document.createElement('th'); th.textContent = h; head.appendChild(th); });
    var body = t.createTBody();
    r.rows.forEach(function(row){
      var tr = body.insertRow();
      row.forEach(function(v){ tr.insertCell().textContent = (v === null ? '' : String(v)); });
    });
    var wrap = document.createElement('div'); wrap.style.overflowX = 'auto'; wrap.appendChild(t); return wrap;
  }

  $('search-form').addEventListener('submit', function(e){
    e.preventDefault();
    var q = $('q').value, sql = E.buildSearch(q), out = $('search-out');
    out.textContent = '';
    showQuery(E.SEARCH_TEMPLATE, { q:q });
    var r = E.run(sql, DB);
    out.appendChild(r.ok ? resultTable(r) : errorBlock(r.error, sql));
  });

  $('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    var u = $('user').value, p = $('pass').value, sql = E.buildLogin(u, p), out = $('login-out');
    out.textContent = ''; $('dashboard').textContent = '';
    showQuery(E.LOGIN_TEMPLATE, { u:u, p:p });
    var r = E.run(sql, DB);
    if(!r.ok){ out.appendChild(errorBlock(r.error, sql)); return; }
    if(!r.rows.length){ var bad = document.createElement('span'); bad.className = 'msg bad'; bad.textContent = 'Invalid username or password.'; out.appendChild(bad); return; }
    var who = String(r.rows[0][0]);
    var good = document.createElement('span'); good.className = 'msg good'; good.textContent = 'Login successful.'; out.appendChild(good);
    $('site-state').textContent = 'Staff: logged in as ' + who;
    var d = $('dashboard'), h = document.createElement('h3'); h.textContent = 'Staff dashboard'; d.appendChild(h);
    var w = document.createElement('p'); w.textContent = 'Welcome back, ' + who + '.'; d.appendChild(w);
    var pre = document.createElement('pre');
    pre.textContent = 'Database tables (staff view)\n  products(name, price, category)\n  staff(username, password)\n  staff_notes(id, note)';
    d.appendChild(pre);
  });

  /* ---------- tasks, quizzes, hints, flag, export ---------- */
  function norm(v){ return v.toLowerCase().replace(/[\s\/"'`]/g,''); }
  function fb(id, ok, msg){ var el=$(id); el.className = 'fb ' + (ok?'ok':'no'); el.textContent = (ok?'Correct. ':'Not quite. ') + msg; }
  function mark(n){
    done[n] = true; var c = Object.keys(done).length;
    $('prog-text').textContent = 'Progress: ' + c + ' of 4 tasks complete';
    $('bar').style.width = (c*25) + '%';
    document.querySelector('[role=progressbar]').setAttribute('aria-valuenow', c);
  }
  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = norm(v)==='products'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'The debug output showed the whole query, including FROM products. Error pages like this hand attackers the layout of the database.':'Type a single quote into the product search, then read the debug line. The table name comes straight after FROM.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var n=norm(v); var ok = n==='admin' || n==='jmacleod'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'The quote closed the username early and the comment removed the password check, so the database matched an account without any password.':'Try admin\u2019-- as the username (any password), then read which account the page says you are logged in as.'); return ok; },
    3:function(){ var v=$('a3').value.trim(); var ok = /^\D*3\D*$/.test(v); taskMeta[3]={answer:v,correct:ok}; fb('fb3',ok, ok?'ORDER BY 3 works and ORDER BY 4 fails, so the query returns three columns. A UNION must match that count exactly.':'Search for \u2019 ORDER BY 1-- then 2, 3, 4. The last number that doesn\u2019t cause an error is the column count.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = norm(v)==='union'; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Now decode the note\u2019s value and submit the result as your flag.':'Look back at Idea 3. One keyword attaches the results of a second query to the first.'); return ok; }
  };
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
  quiz('q1-btn','q1-fb','Why the error?','a',
    'Correct. The quote closes the text early, so whatever follows is read as SQL, and the leftover characters make it invalid.',
    'Not quite. Think about what the extra quote does to the quote marks the developer wrote around your text.');
  quiz('q2-btn','q2-fb','The real fix','a',
    'Correct. Parameterised queries send the SQL and your text separately, so your text can only ever be data.',
    'Not quite. Hiding errors or blocking words makes attacks harder to see or slightly harder to write, but only one option removes the mixing of input and SQL.');

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a Base64 string first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent = 'That doesn\u2019t look like valid Base64. Copy only the value after \u201CSystem note (Base64):\u201D, including any = signs at the end.'; }
  });

  var hints = [
    'Hint 1: for Task 1, type just one single quote into the product search and press Search. The debug line shows the whole query, and the table name comes after FROM.',
    'Hint 2: for Task 2, try the username admin\u2019-- with any password. For Task 3, search for \u2019 ORDER BY 1-- and raise the number until you see an error.',
    'Hint 3: the staff dashboard lists a table called staff_notes with columns id and note. Search for \u2019 UNION SELECT note, 0, \u2019x\u2019 FROM staff_notes-- then decode the Base64 value in the results.'
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
    if(v === FLAG){ flagState.achieved = true; el.className='fb ok'; el.textContent='Flag captured. You broke a query with a quote, bypassed a login, counted columns and pulled a hidden table into the page. That is a complete injection walkthrough, and you now know the fix.'; }
    else if(/^FLAG\{.*\}$/i.test(v)){ el.className='fb no'; el.textContent='The format is right, but that isn\u2019t the flag. Check you decoded the whole note value exactly.'; }
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
