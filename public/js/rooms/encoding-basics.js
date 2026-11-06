(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["layers", "are", "not", "locks"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Encoding: Base64, hex and friends", ROOM_SLUG = "encoding-basics", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You identified three encodings and peeled a two-layer message back to plain text, without a single key. That is exactly why encoding must never be mistaken for protection.";
  var HINTS = ["Hint 1: Item A ends with = and uses mixed-case letters and digits, which points to Base64. Paste it in and press Decode Base64.", "Hint 2: Item B is hex. Item C is URL encoding, where %20 stands for a space. Use the matching decode button for each.", "Hint 3: Decode Item D with Base64 first. The result uses only 0-9 and a-f, so decode that as hex. Stop when you can read it."];
  var QUIZZES = [["q1-btn", "q1-fb", "What is it?", "a", "Correct. Only 0-9 and a-f with an even length is the signature of hex.", "Not quite. Base64 also uses upper-case letters, + and /, and URL encoding shows % signs. Which format is limited to 0-9 and a-f?"], ["q2-btn", "q2-fb", "Is it secure?", "a", "Correct. Base64 has no key, so anyone can decode it. Passwords need proper salted hashing, not encoding.", "Not quite. Does Base64 involve a key anywhere? If not, who can reverse it?"]];

  function toHex(s, sep){ return s.split('').map(function(c){ return ('0'+c.charCodeAt(0).toString(16)).slice(-2); }).join(sep); }
  var items = {
    a: btoa('Staff portal opens at 0800'),
    b: toHex('Locker code: 7419', ' '),
    c: encodeURIComponent('meet at dock 3!'),
    d: btoa(toHex(FLAG, ''))
  };
  $('item-a').textContent = items.a; $('item-b').textContent = items.b;
  $('item-c').textContent = items.c; $('item-d').textContent = items.d;

  function out(t){ $('wb-out').textContent = t; }
  $('wb-b64d').addEventListener('click', function(){
    var s = $('wb-in').value.replace(/\s+/g,'');
    if(!s){ out('Paste something first.'); return; }
    try{ out(atob(s)); }catch(e){ out('That isn\u2019t valid Base64. Check you copied all of it, including any = signs.'); }
  });
  $('wb-hexd').addEventListener('click', function(){
    var s = $('wb-in').value.replace(/0x|[\s:,-]/gi,'');
    if(!s || s.length % 2 || /[^0-9a-f]/i.test(s)){ out('That isn\u2019t valid hex. Hex uses only 0-9 and a-f, in pairs.'); return; }
    var r = ''; for(var i=0;i<s.length;i+=2) r += String.fromCharCode(parseInt(s.substr(i,2),16));
    out(r);
  });
  $('wb-urld').addEventListener('click', function(){
    var s = $('wb-in').value;
    if(!s){ out('Paste something first.'); return; }
    try{ out(decodeURIComponent(s.replace(/\+/g,' '))); }catch(e){ out('That isn\u2019t valid URL encoding.'); }
  });
  $('wb-b64e').addEventListener('click', function(){
    var s = $('wb-in').value;
    if(!s){ out('Paste something first.'); return; }
    try{ out(btoa(s)); }catch(e){ out('Base64 encoding here only handles basic characters.'); }
  });

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = v.replace(/\D/g,'')==='0800'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'Item A was Base64. Anyone with a decoder reads it instantly, no key needed.':'Item A looks like Base64. Paste it into the workbench and press Decode Base64, then read the time.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok = v.replace(/\D/g,'')==='7419'; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'Item B was hex: each pair of characters is one byte of text.':'Item B only uses 0-9 and a-f in pairs, so it is hex. Use Decode hex.'); return ok; },
    3:function(){ var v=$('a3').value.trim(); var ok = /^\D*3\D*$/.test(v); taskMeta[3]={answer:v,correct:ok}; fb('fb3',ok, ok?'Item C was URL encoding. %20 is a space, which is why it appears in web addresses.':'Item C has % escapes, which is URL encoding. Use Decode URL and read the dock number.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var n=norm(v); var ok = n==='2' || n==='two' || /^\D*2\D*$/.test(v); taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Two layers: Base64 wrapped around hex. If you haven\u2019t yet, submit the decoded flag below.':'Decode Item D as Base64 first and look at the result. Then work out what that result is and decode it again. Count the steps.'); return ok; }
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
