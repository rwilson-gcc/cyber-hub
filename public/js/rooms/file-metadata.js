(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["metadata", "can", "say", "more", "than", "the", "photo"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "File metadata: what a photo tells you besides the picture", ROOM_SLUG = "file-metadata", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You read metadata a photo never shows on screen, decoded a value hidden inside a comment field, and saw exactly what \"stripping metadata\" removes. Real cameras and phones embed far more than most people realise.";
  var HINTS = ["Hint 1: press Read metadata under Image A and look at the field labelled Software.", "Hint 2: look at the Location field under Image A. What could someone work out just from a precise set of coordinates attached to a shared photo?", "Hint 3: under Image B, find the field that looks like a jumble of letters and digits, not a normal word. Copy its value into the Decoder tool and press Decode Base64."];
  var QUIZZES = [["q1-btn", "q1-fb", "What’s in the metadata?", "a", "Correct. GPS tags are a standard part of EXIF metadata when location services are on, and they are not visible in the image itself.", "Not quite. Picture data isn’t the only thing a photo file can store. What might be added automatically by a device with location services turned on?"], ["q2-btn", "q2-fb", "The fix", "a", "Correct. Stripping metadata deletes the hidden fields, such as location and device details, while leaving the visible picture unchanged.", "Not quite. \"Stripping\" refers to removing something, specifically the invisible fields, not changing the picture’s quality or encrypting anything."]];

  var E = window.PngMetadataEngine;
  function loadAndRead(url){
    return fetch(url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){ return E.read(new Uint8Array(buf)); });
  }
  function renderMeta(out, result){
    if(!result.text.length){ out.textContent = 'No tEXt metadata fields found in this file.'; return; }
    out.textContent = result.text.map(function(t){ return t.key + ': ' + t.value; }).join('\n');
  }

  var aLoaded = null, bStripped = false;
  $('meta-a-go').addEventListener('click', function(){
    loadAndRead('../img/rooms/file-metadata/staff-badge.png').then(function(r){ aLoaded = r; renderMeta($('meta-a-out'), r); })
      .catch(function(e){ $('meta-a-out').textContent = 'Could not read file: ' + e.message; });
  });
  $('meta-b-go').addEventListener('click', function(){
    if(bStripped){ $('meta-b-out').textContent = 'No tEXt metadata fields found in this file.'; return; }
    loadAndRead('../img/rooms/file-metadata/banner.png').then(function(r){ renderMeta($('meta-b-out'), r); })
      .catch(function(e){ $('meta-b-out').textContent = 'Could not read file: ' + e.message; });
  });
  $('meta-b-strip').addEventListener('click', function(){
    bStripped = true;
    $('meta-b-out').textContent = 'Metadata stripped. The picture itself is unchanged; the text fields have been removed.';
  });

  $('dec-btn').addEventListener('click', function(){
    var out=$('dec-out'), raw=$('dec-in').value.trim();
    if(!raw){ out.textContent='Paste a value first.'; return; }
    try{ out.textContent = atob(raw); }catch(err){ out.textContent = 'That doesn\u2019t look like valid Base64.'; }
  });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v.indexOf('clydecapture')>=0; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. The Software field names the exact app that produced the file.':'Press Read metadata under Image A first if you haven\u2019t, then find the field labelled Software.'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v.indexOf('location')>=0 || v.indexOf('address')>=0 || v.indexOf('home')>=0 || v.indexOf('find')>=0 || v.indexOf('track')>=0 || v.indexOf('stalk')>=0; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. A precise location attached to a shared photo can reveal a home, workplace, or routine the person never meant to disclose.':'Think about what someone could do with exact coordinates attached to a photo they never meant to share their location in.'); return ok; },
    3:function(){ var raw=$('a3').value.trim(); var cleaned=raw.toLowerCase().replace(/[^a-z]/g,''); var ok = cleaned==='flagmetadatacansaymorethanthephoto' || cleaned==='metadatacansaymorethanthephoto'; taskMeta[3]={answer:raw,correct:ok}; fb('fb3',ok, ok?'Correct. That decoded value is also this room\u2019s flag.':'Read Image B\u2019s metadata, find the field that looks like random letters and digits (the Comment field), and decode it with the Decoder tool.'); return ok; },
    4:function(){ var v=$('a4').value.trim(); var ok = /^\D*0\D*$/.test(v) || norm(v)==='none' || norm(v)==='zero'; taskMeta[4]={answer:v,correct:ok}; fb('fb4',ok, ok?'Correct. Stripping removed every text field, leaving nothing for the reader to find.':'Press Strip metadata, then press Read metadata again under Image B, and count how many fields the tool now reports.'); return ok; }
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
