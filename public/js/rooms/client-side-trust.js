(function(){
  // Flag is built at runtime, like the other rooms.
  var FLAG = 'FLAG{' + ["never", "trust", "the", "client"].join('_') + '}';
  var $ = function(id){ return document.getElementById(id); };
  var done = {};
  var ROOM_TITLE = "Client-side trust: storage and validation bypass", ROOM_SLUG = "client-side-trust", TASK_COUNT = 4;
  var taskMeta = {}, quizMeta = {}, flagState = { achieved:false, value:'' };
  var FLAG_OK = "Flag captured. You read a value out of client-side storage, overrode a hidden price, and bypassed a JavaScript-only limit. All three work for the same reason: nothing on the client is proof of anything.";
  var HINTS = ["Hint 1: press View storage and read the key that looks like a tier or discount level, not the item name.", "Hint 2: press View form fields to find a field with price or unit_price in its name. Then use the Key and New value boxes under the inspector to change it and press Set and resubmit.", "Hint 3: switch to View request, change quantity to a negative number, and press Set and resubmit. Watch what happens to the total when quantity multiplies a price."];
  var QUIZZES = [["q1-btn", "q1-fb", "Where does authority belong?", "a", "Correct. A cookie is just text the browser stores and sends back. Anyone can edit it before the next request.", "Not quite. Cookies are plain text by default and store whatever is put in them, numbers included. Who actually controls what’s inside a cookie?"], ["q2-btn", "q2-fb", "What proves a value is safe?", "a", "Correct. Disabling a button changes what the page shows, not what the server is willing to accept. The underlying request can still be sent directly.", "Not quite. A disabled button is a page element the browser is told not to let you click through the normal interface. Does that stop a different route to sending the request?"]];

  // Simulated inspector data. None of this reads or writes the real browser's storage.
  var storage = { tier: 'standard', session: 'sess_8f2c91' };
  var fields  = { product_id: 'scarf-tartan-01', unit_price: '24.99', currency: 'GBP' };
  var request = { product_id: 'scarf-tartan-01', unit_price: '24.99', quantity: '1' };

  function showTable(obj){
    var pre = $('insp-out'); pre.textContent = Object.keys(obj).map(function(k){ return k + ': ' + obj[k]; }).join('\n');
  }
  var activeTab = null;
  $('insp-storage').addEventListener('click', function(){ activeTab='storage'; showTable(storage); $('insp-edit-row').style.display='flex'; });
  $('insp-fields').addEventListener('click', function(){ activeTab='fields'; showTable(fields); $('insp-edit-row').style.display='flex'; });
  $('insp-request').addEventListener('click', function(){ activeTab='request'; request.quantity = $('qty').value || '1'; showTable(request); $('insp-edit-row').style.display='flex'; });

  $('insp-set').addEventListener('click', function(){
    var key = $('insp-key').value.trim(), val = $('insp-val').value;
    if(!key){ return; }
    var target = activeTab==='storage' ? storage : activeTab==='fields' ? fields : request;
    if(!target){ return; }
    target[key] = val;
    showTable(target);
    if(activeTab==='fields' || activeTab==='request') submitOrder();
  });

  var FLAG_SHOWN = false;
  function submitOrder(){
    var out = $('buy-out');
    var qty = parseFloat(request.quantity !== undefined ? request.quantity : $('qty').value);
    var price = parseFloat(fields.unit_price);
    if(isNaN(qty)) qty = 1;
    if(isNaN(price)) price = 24.99;
    var total = qty * price;
    out.textContent = '';
    var p = document.createElement('p');
    if(total <= 0){
      p.className = 'msg bad';
      p.textContent = 'Order accepted. Total charged: \u00a3' + total.toFixed(2) + ' \u2014 a quantity or price this low or negative should never have reached the till.';
    } else if(price < 1){
      p.className = 'msg bad';
      p.textContent = 'Order accepted. Total charged: \u00a3' + total.toFixed(2) + ' \u2014 nowhere near the real price of \u00a324.99.';
    } else {
      p.className = 'msg good';
      p.textContent = 'Order accepted. Total charged: \u00a3' + total.toFixed(2) + '.';
    }
    out.appendChild(p);
  }
  $('buy-btn').addEventListener('click', function(){ request.quantity = $('qty').value; fields.unit_price = fields.unit_price; submitOrder(); });

  var checks = {
    1:function(){ var v=norm($('a1').value.trim()); var ok = v==='standard'; taskMeta[1]={answer:$('a1').value.trim(),correct:ok}; fb('fb1',ok, ok?'Correct. The price tier was sitting in client-side storage, which means the browser, not the server, was the one saying who the customer is.':'Press View storage in the inspector and read the value next to the key that is not "session".'); return ok; },
    2:function(){ var v=$('a2').value.replace(/[^0-9.]/g,''); var ok = Math.abs(parseFloat(v) - 0.01) < 0.005; taskMeta[2]={answer:$('a2').value.trim(),correct:ok}; fb('fb2',ok, ok?'Correct. The server charged exactly whatever the hidden field said, because it trusted the client instead of looking the real price up itself.':'Open View form fields, set the Key box to unit_price and New value to 0.01, press Set and resubmit, then read the total shown under Buy now.'); return ok; },
    3:function(){ var v=norm($('a3').value.trim()); var ok = v.indexOf('negative')>=0 || v.indexOf('below0')>=0 || v.indexOf('zeroorbelow')>=0 || v.indexOf('negativetotal')>=0; taskMeta[3]={answer:$('a3').value.trim(),correct:ok}; fb('fb3',ok, ok?'Correct. A negative quantity produced a negative or near-zero total, something that should be mathematically impossible for a real order.':'Switch to View request, set quantity to -5, press Set and resubmit, and describe what happens to the total shown.'); return ok; },
    4:function(){ var v=norm($('a4').value.trim()); var ok = v==='lookup'; taskMeta[4]={answer:$('a4').value.trim(),correct:ok}; fb('fb4',ok, ok?'Correct. Looking the real price up server-side (and re-validating quantity there too) removes the need to trust anything the client sends. Hiding fields better only makes the same mistake harder to notice.':'Think about which option removes the need to trust the client\u2019s value at all, rather than just making that value harder to find or edit. Type lookup or hide.'); return ok; }
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
