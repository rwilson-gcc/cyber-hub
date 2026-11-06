(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["shift", "is", "not", "secret"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Classical ciphers: ROT13 and Caesar", ROOM_SLUG = "classical-ciphers", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You decoded a shifted message by trying every possible key, which is exactly why a cipher with only 25 keys protects nothing.";
  var HINTS = ["Hint 1: for Message 1, paste it in and use Shift forward with 13. ROT13 twice returns the original, so forward and back give the same result.", "Hint 2: for Message 2, paste it in and press Try all 25 shifts. One line will be readable English. The number at the start of that line is the shift you want, so read the line number carefully.", "Hint 3: for Message 4, use Try all 25 shifts and look for the line that makes sense, which includes FLAG{...}. For Message 3, paste it in and press Count letters, then look for the highest count."];
  var QUIZZES = [["q1-btn", "q1-fb", "ROT13 twice", "a", "Correct. 13 + 13 = 26, a full lap of the alphabet, so you end up where you started.", "Not quite. The alphabet has 26 letters. What happens if you move 13 places and then 13 more?"], ["q2-btn", "q2-fb", "Why is it weak?", "a", "Correct. With only 25 keys, an attacker can try them all almost instantly.", "Not quite. Think about how many keys a Caesar cipher has and how long it takes to try that many."]];

  function shiftText(t, k){
    return t.replace(/[a-z]/gi, function(ch){
      var base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode((ch.charCodeAt(0) - base + k + 26) % 26 + base);
    });
  }
  var M3 = 'Every good cipher needs a secret key, but this one has none to find. Letters simply move along the alphabet, and the most common letter in English is still the most common letter after the move. Count the letters and the pattern gives the shift away.';
  var msgs = {
    1: shiftText('Meet at the boathouse at noon', 13),
    2: shiftText('Check the north gate at dusk', 7),
    3: shiftText(M3, 11),
    4: shiftText('Well done. The flag is ' + FLAG, 17)
  };
  for(var m=1;m<=4;m++) $('msg-'+m).textContent = msgs[m];
  function freqs(t){
    var c = {}; t.toLowerCase().replace(/[a-z]/g, function(ch){ c[ch] = (c[ch]||0) + 1; return ch; }); return c;
  }
  var topLetter = (function(){ var f = freqs(msgs[3]), best = '', n = 0; Object.keys(f).forEach(function(k){ if(f[k] > n){ n = f[k]; best = k; } }); return best; })();

  function out(t){ $('cw-out').textContent = t; }
  function readShift(){
    var k = parseInt($('cw-shift').value, 10);
    if(isNaN(k) || k < 0 || k > 25){ out('Enter a shift from 0 to 25.'); return null; }
    return k;
  }
  $('cw-fwd').addEventListener('click', function(){ var k = readShift(); if(k === null) return; out(shiftText($('cw-in').value, k)); });
  $('cw-back').addEventListener('click', function(){ var k = readShift(); if(k === null) return; out(shiftText($('cw-in').value, -k)); });
  $('cw-all').addEventListener('click', function(){
    var t = $('cw-in').value; if(!t.trim()){ out('Paste a message first.'); return; }
    var lines = []; for(var k=1;k<=25;k++) lines.push(('shift ' + (k<10?' ':'') + k + ':  ') + shiftText(t, -k));
    out(lines.join('\n'));
  });
  $('cw-freq').addEventListener('click', function(){
    var t = $('cw-in').value; if(!t.trim()){ out('Paste a message first.'); return; }
    var f = freqs(t), keys = Object.keys(f).sort(function(a,b){ return f[b]-f[a] || (a<b?-1:1); });
    out(keys.map(function(k){ return k.toUpperCase() + ': ' + f[k]; }).join('   '));
  });

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = norm(v).indexOf('boathouse') >= 0; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'ROT13 reversed it. Because 13 is half the alphabet, the same shift encodes and decodes.':'Paste Message 1 into the workbench with a shift of 13 and press Shift forward. Read where the club meets.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok = /^\D*7\D*$/.test(v); taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'The sender shifted forward by 7, so shifting back by 7 reads the message. Only one of the 25 attempts made sense.':'Press Try all 25 shifts on Message 2 and find the one readable line. The shift is the number printed at the start of that line.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v === topLetter; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Letter frequency survives the shift. The most common cipher letter stands in for the most common English letter, usually E.':'Paste Message 3 and press Count letters. The letter with the highest count is the answer.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = /^\D*25\D*$/.test(v); taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'There are only 25 useful shifts, so brute force is trivial. If you haven\u2019t yet, read Message 4 and submit the flag below.':'The alphabet has 26 letters. A shift of 0 changes nothing, and a shift of 26 is the same as 0. How many remain?'); return ok; }
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
