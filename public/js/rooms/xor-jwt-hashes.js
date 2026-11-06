(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["xor", "is", "not", "encryption"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "XOR, JWTs and hashes", ROOM_SLUG = "xor-jwt-hashes", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You read a token, recognised hash types, and recovered a message hidden with XOR by trying every key. You can now tell which of these tools actually protect data, and when.";
  var HINTS = ["Hint 1: paste the whole token, including both dots, into the token decoder. The payload is the middle part and is readable JSON.", "Hint 2: for Task 3, the recogniser reports the length. SHA-256 is 64 hex characters, SHA-1 is 40 and MD5 is 32.", "Hint 3: for Task 4, press Try all 256 keys. Only one line will be readable English with a FLAG{...} in it. The key is the number at the start of that line."];
  var QUIZZES = [["q1-btn", "q1-fb", "Single-byte XOR", "a", "Correct. A single byte can only take 256 values, so every key can be tried in an instant.", "Not quite. Think about how many different values one byte can have, and how long it takes to try that many."], ["q2-btn", "q2-fb", "JWT contents", "a", "Correct. The payload is only encoded. The signature protects against tampering, not against reading.", "Not quite. Does the signature hide anything, or does it only prove the token wasn’t changed?"]];

  function toHex(s, sep){ return s.split('').map(function(c){ return ('0'+c.charCodeAt(0).toString(16)).slice(-2); }).join(sep); }
  function b64url(s){ return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function b64urlDec(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; return atob(s); }
  var HASHES = { a: "b7a875fc1ea228b9061041b7cec4bd3c52ab3ce3", b: "1c8bfe8f801d79745c4631d09fff36c82aa37fc4cce4fc946683d7b336b63032", c: "0d107d09f5bbe40cade3de5c71e9e9b7" };
  var KEY = 42;
  var xorText = 'Note: ' + FLAG;
  var xorHex = xorText.split('').map(function(ch){ return ('0'+(ch.charCodeAt(0) ^ KEY).toString(16)).slice(-2); }).join(' ');
  var JWT = b64url(JSON.stringify({alg:'HS256',typ:'JWT'})) + '.' + b64url(JSON.stringify({sub:'jmacleod',role:'student',iss:'harbourview-portal.example'})) + '.q3J5v0mZ1xk8bLw2Nf7dR4tUeHs9GpYc6AaXoVi1KjE';
  $('item-jwt').textContent = JWT;
  $('item-ha').textContent = HASHES.a; $('item-hb').textContent = HASHES.b; $('item-hc').textContent = HASHES.c;
  $('item-xor').textContent = xorHex;

  $('jwt-go').addEventListener('click', function(){
    var out = $('jwt-out'), parts = $('jwt-in').value.trim().split('.');
    if(parts.length !== 3 || !parts[0] || !parts[1]){ out.textContent = 'A token has three parts separated by dots: header.payload.signature.'; return; }
    try{
      var h = JSON.stringify(JSON.parse(b64urlDec(parts[0])), null, 2), p = JSON.stringify(JSON.parse(b64urlDec(parts[1])), null, 2);
      out.textContent = 'Header:\n' + h + '\n\nPayload:\n' + p + '\n\nSignature: ' + parts[2].length + ' characters of Base64URL. It cannot be read as text. It only proves the token wasn\u2019t changed.';
    }catch(e){ out.textContent = 'Couldn\u2019t decode that. Paste the whole token, including both dots.'; }
  });

  $('hash-go').addEventListener('click', function(){
    var out = $('hash-out'), h = $('hash-in').value.trim().replace(/\s+/g,'');
    if(!h){ out.textContent = 'Paste a hash first.'; return; }
    if(/[^0-9a-f]/i.test(h)){ out.textContent = 'That isn\u2019t hex. Hashes shown in hex use only 0-9 and a-f.'; return; }
    var types = { 32:'MD5 (or NTLM)', 40:'SHA-1', 56:'SHA-224', 64:'SHA-256', 128:'SHA-512' };
    out.textContent = 'Length: ' + h.length + ' hex characters\nLikely type: ' + (types[h.length] || 'not a common hash length');
  });

  function parseHex(s){ s = s.replace(/0x|[\s:,-]/gi,''); if(!s || s.length % 2 || /[^0-9a-f]/i.test(s)) return null; var b = []; for(var i=0;i<s.length;i+=2) b.push(parseInt(s.substr(i,2),16)); return b; }
  function show(bytes, key){ return bytes.map(function(x){ x ^= key; return (x>=32 && x<=126) ? String.fromCharCode(x) : '.'; }).join(''); }
  $('xor-run').addEventListener('click', function(){
    var out = $('xor-out'), bytes = parseHex($('xor-in').value), raw = $('xor-key').value.trim();
    var key = /^0x/i.test(raw) ? parseInt(raw,16) : parseInt(raw,10);
    if(!bytes){ out.textContent = 'Enter the data as hex, in pairs of characters.'; return; }
    if(isNaN(key) || key < 0 || key > 255){ out.textContent = 'Enter a key from 0 to 255.'; return; }
    out.textContent = show(bytes, key);
  });
  $('xor-all').addEventListener('click', function(){
    var out = $('xor-out'), bytes = parseHex($('xor-in').value);
    if(!bytes){ out.textContent = 'Enter the data as hex, in pairs of characters.'; return; }
    var lines = [];
    for(var k=0;k<256;k++){
      var printable = bytes.every(function(x){ var y = x ^ k; return y>=32 && y<=126; });
      if(printable) lines.push('key ' + (k<100?(k<10?'  ':' '):'') + k + ':  ' + show(bytes, k));
    }
    out.textContent = lines.length ? lines.join('\n') : 'No key produces fully printable text. Check the hex you pasted.';
  });

  var checks = {
    1:function(){ var v=$('a1').value.trim(); var ok = norm(v)==='student'; taskMeta[1]={answer:v,correct:ok}; fb('fb1',ok, ok?'The payload is only Base64URL encoded JSON, so anyone holding the token reads the role without a secret.':'Paste the whole token into Tool 1 and read the role field in the payload.'); return ok; },
    2:function(){ var v=$('a2').value.trim(); var ok = norm(v).indexOf('signature') >= 0; taskMeta[2]={answer:v,correct:ok}; fb('fb2',ok, ok?'The signature is calculated over the header and payload using a secret. Change the payload and the signature no longer matches.':'Which part of the token is calculated with the server\u2019s secret so that changes can be detected?'); return ok; },
    3:function(){ var n=norm($('a3').value.trim()); var ok = n==='b' || n==='hashb'; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Hash B has 64 hex characters, the length of SHA-256. A is SHA-1 (40) and C is MD5 (32).':'Run each hash through Tool 2 and compare the lengths. SHA-256 is 64 hex characters long.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = /^\D*42\D*$/.test(v) || /^(0x)?2a$/i.test(v); taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Key 42. Only 256 keys exist, so trying every one and spotting readable text breaks it at once. Submit the flag below if you haven\u2019t.':'Use Try all 256 keys on the hex. One line is readable English, and the number at the start is the key.'); return ok; }
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
