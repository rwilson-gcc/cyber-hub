(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["validate", "on", "the", "server"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Upload and logic flaws: when the rules have gaps", ROOM_SLUG = "upload-and-logic-flaws", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You found an upload check that only looked at a filename, broke a basket total with a negative quantity, and walked straight past a step in a workflow. None of them needed a single quote mark or script tag.";
  var HINTS = ["Hint 1: the check in this simulation only looks at the very end of the filename. What part of design.php.jpg comes right before .jpg?", "Hint 2: enter -4 in the quantity box and look at how the basket total pre recalculates below it.", "Hint 3: for Task 4, press Go with 3 typed into the step box, having never actually completed step 1 or 2. Read the message that appears."];
  var QUIZZES = [["q1-btn", "q1-fb", "Which filename is risky?", "a", "Correct. The check only looks for \".jpg\" somewhere in the name, so a file deliberately named to end in .jpg while containing something else earlier in the name still passes.", "Not quite. Those two filenames are exactly what they claim to be. Which option is trying to look like one thing while actually being another?"], ["q2-btn", "q2-fb", "Spotting a logic flaw", "a", "Correct. Nothing about the request is malformed; the server simply never checked whether the coupon had already been used.", "Not quite. There’s no injected code or script here, only a rule the server never enforced. What kind of flaw is that?"]];

  $('up-go').addEventListener('click', function(){
    var name = $('up-name').value.trim(), out = $('up-out');
    out.textContent = '';
    if(!name){ out.textContent = 'Type a filename first.'; return; }
    var lower = name.toLowerCase();
    var endsOk = /\.(jpg|jpeg|png|pdf)$/.test(lower);
    var hiddenExt = /\.(php|asp|aspx|jsp|exe|sh)\./.test(lower) || /\.(php|asp|aspx|jsp|exe|sh)\.[a-z0-9]+$/.test(lower);
    var p = document.createElement('p'); p.className = 'msg ' + (endsOk && !hiddenExt ? 'good' : endsOk && hiddenExt ? 'bad' : 'bad');
    if(endsOk && hiddenExt){ p.textContent = '"Extension-only" check: ACCEPTED (the name ends in an allowed extension). This filename also contains a hidden earlier extension, which a misconfigured server could execute instead.'; }
    else if(endsOk){ p.textContent = '"Extension-only" check: ACCEPTED. This filename looks like a normal, safe upload.'; }
    else { p.textContent = '"Extension-only" check: REJECTED (does not end in an allowed extension).'; }
    out.appendChild(p);
  });

  var COUPON_USED = 0;
  function recalcBasket(){
    var qty = parseFloat($('bk-qty').value);
    if(isNaN(qty)) qty = 0;
    var total = qty * 8;
    var note = '';
    if(COUPON_USED > 0){ var discount = Math.min(COUPON_USED,3) * 0.10; total = total * (1 - discount); note = '  (WELCOME10 applied ' + COUPON_USED + ' time' + (COUPON_USED>1?'s':'') + ', ' + (discount*100).toFixed(0) + '% off)'; }
    $('bk-out').textContent = 'Basket total: \u00a3' + total.toFixed(2) + note;
    return total;
  }
  $('bk-qty').addEventListener('input', recalcBasket);
  $('bk-apply').addEventListener('click', function(){
    var code = $('bk-coupon').value.trim().toUpperCase();
    if(code !== 'WELCOME10'){ $('bk-out').textContent = 'Unknown coupon code.'; return; }
    COUPON_USED++;
    recalcBasket();
  });
  recalcBasket();

  var WF_MAX_REACHED = 1;
  $('wf-go').addEventListener('click', function(){
    var step = parseInt($('wf-step').value, 10), out = $('wf-out');
    if(isNaN(step) || step < 1 || step > 3){ out.textContent = 'Enter a step number from 1 to 3.'; return; }
    out.textContent = 'Requested step ' + step + ' of 3.\nResult: ACCEPTED. The simulated server only checks which page you asked for, not which steps you actually completed, so step ' + step + ' is shown with no address or payment ever having been entered.';
  });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v.indexOf('end')>=0 || v.indexOf('filename')>=0 || v.indexOf('extensiononly')>=0 || v.indexOf('name')>=0; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. The check only examines the filename\u2019s ending, so a name engineered to end the right way while hiding a different extension earlier still passes.':'Think about exactly what part of the string "design.php.jpg" the check in this simulation actually looks at.'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v.indexOf('negative')>=0; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. A negative quantity produced a negative total, something a real till should never be able to reach.':'Type -4 into the quantity field and read the Basket total line underneath it. What sign does the total become?'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v.indexOf('stack')>=0 || v.indexOf('again')>=0 || v.indexOf('reapply')>=0 || v.indexOf('more')>=0 || v.indexOf('discount')>=0; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. The same single-use coupon stacked a further discount each time it was reapplied, because nothing recorded that it had already been used.':'Apply WELCOME10 two or three times and compare the discount percentage noted after the first application with what you see after the second and third.'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = (v.indexOf('accept')>=0||v.indexOf('allow')>=0||v.indexOf('skip')>=0) && (v.indexOf('server')>=0||v.indexOf('track')>=0||v.indexOf('progress')>=0||v.indexOf('status')>=0); taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. The server accepted the jump straight to step 3; the fix is for the server to track real progress itself and check it before allowing a later step.':'Press Go with 3 in the step box, read the Result line, and then describe what the server needs to track server-side to stop this.'); return ok; }
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
