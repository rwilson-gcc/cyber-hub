(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["the", "image", "was", "never", "silent"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "LSB steganography: hiding data in plain sight", ROOM_SLUG = "lsb-steganography", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You extracted a real hidden message from real pixel data using nothing but a canvas and a few lines of JavaScript. The image never looked any different. That is the point, and the risk.";
  var HINTS = ["Hint 1: select Sample A from the dropdown and press Extract hidden data. Read the message that appears.", "Hint 2: select Sample B and extract. The result appears directly in the output box.", "Hint 3: for Task 3, think about what re-saving as JPEG does to an image’s exact pixel values (hint: JPEG compression is lossy, meaning pixel values change slightly)."];
  var QUIZZES = [["q1-btn", "q1-fb", "Why invisible?", "a", "Correct. A change of at most 1 in a value from 0 to 255 is far smaller than the eye can perceive.", "Not quite. Think numerically: how big a visual difference would changing a colour value by at most 1 out of 255 actually make?"], ["q2-btn", "q2-fb", "Spotting it", "a", "Correct. There is no visible difference at all; you have to actually extract and check using a tool like the one in this room.", "Not quite. LSB changes are specifically chosen to be visually undetectable. What would you actually need to do to find out?"]];

  var E = window.LsbStegoEngine;
  var IMG_MAP = { 'sample-a':'sample-a.png', 'sample-b':'sample-b.png', 'sample-c':'sample-c.png' };
  var lastResult = {};

  $('lsb-select').addEventListener('change', function(){
    $('lsb-preview').src = '../img/rooms/lsb-steganography/' + IMG_MAP[this.value];
    $('lsb-out').textContent = 'Press Extract hidden data for this image.';
  });

  $('lsb-extract').addEventListener('click', function(){
    var key = $('lsb-select').value, out = $('lsb-out');
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      var canvas = $('lsb-canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      var data;
      try{ data = ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch(e){ out.textContent = 'Could not read pixel data from this image.'; return; }
      var r = E.decode(data);
      lastResult[key] = r;
      out.textContent = r.found ? ('Hidden data found: ' + r.message) : 'No hidden data found in this image.';
    };
    img.onerror = function(){ out.textContent = 'Could not load the image file.'; };
    img.src = '../img/rooms/lsb-steganography/' + IMG_MAP[key] + '?x=' + Date.now();
  });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v.indexOf('not')>=0 || v==='none' || v==='nothing'; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. Sample A has no deliberately hidden message, so the extractor correctly reports nothing found.':'Select Sample A and press Extract hidden data, then read the exact wording of the result.'); return ok; },
    2:function(){ var v=norm($('a2').value.trim()); var ok = v==='lookcloser'; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. That short phrase was hidden in Sample B\u2019s red channel LSBs the whole time.':'Select Sample B from the dropdown and press Extract hidden data. Read the message shown.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v==='no'; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. Lossy JPEG compression changes exact pixel values, which destroys LSB-hidden data even though the image still looks fine.':'Think about what "lossy" compression means for exact pixel values, and where this technique stores its hidden bits.'); return ok; },
    4:function(){
      var v = $('a4').value.trim();
      var ok = v === FLAG;
      taskMeta[4]={answer:v,correct:ok};
      fb('fb4', ok, ok?'Correct. Submit that exact message as your flag below too.':'Select Sample C from the dropdown, press Extract hidden data, and copy the message shown after "Hidden data found:" exactly into the box above.');
      return ok;
    }
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
