const TABS = ['walk', 'items', 'time', 'dashboard', 'setup'];
function showTab(name) {
  if (TABS.indexOf(name) === -1) name = 'walk';
  TABS.forEach(function (t) {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  try { localStorage.setItem('swActiveTab', name); } catch (e) { }
}
document.querySelectorAll('.nav-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
});

const TRADES = ['General', 'Plumbing', 'Electrical', 'Framing', 'Drywall', 'Roofing', 'Concrete', 'Landscaping', 'Other'];
const LS = { photos: 'swPhotos', punch: 'swPunch', changes: 'swChanges', rfis: 'swRfis', contacts: 'swTradeContacts', aiEndpoint: 'swAiEndpoint', aiKey: 'swAiKey', submittals: 'swSubmittals', clockEvents: 'swClockEvents', dailyLogs: 'swDailyLogs', safety: 'swSafety' };
let photos = [], punch = [], changes = [], rfis = [], contacts = {}, submittals = [], clockEvents = [], dailyLogs = [], safetyLogs = [];
const tradeSelect = document.getElementById('tradeSelect');
let walkActive = false, walkStream = null, walkGpsWatch = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, listening = false;

// Push-to-talk fallback for phones without SpeechRecognition (notably iOS Safari).
let mediaRecorder = null, mediaChunks = [], mediaStream = null, recordingNote = false;

function loadJson(key, fallback) { try { const raw = localStorage.getItem(key); if (!raw) return fallback; const p = JSON.parse(raw); return p == null ? fallback : p; } catch (e) { return fallback; } }
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { setWalkStatus('err', 'Storage full'); return false; } }
function persistLists() { saveJson(LS.punch, punch); saveJson(LS.changes, changes); saveJson(LS.rfis, rfis); }
function persistPhotos() { saveJson(LS.photos, photos); }
function persistContacts() { saveJson(LS.contacts, contacts); }
function persistSubmittals() { saveJson(LS.submittals, submittals); }
function persistClock() { saveJson(LS.clockEvents, clockEvents); }
function persistDailyLogs() { saveJson(LS.dailyLogs, dailyLogs); }
function persistSafety() { saveJson(LS.safety, safetyLogs); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }
function setWalkStatus(kind, text) { const s = document.getElementById('walkStatus'); s.className = 'status ' + kind; s.textContent = text; }
function compressImage(dataUrl, cb) { const img = new Image(); img.onload = function () { let w = img.width, h = img.height, max = 1280; if (w > max) { h = Math.round(h * max / w); w = max; } if (h > max) { w = Math.round(w * max / h); h = max; } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); cb(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = function () { cb(dataUrl); }; img.src = dataUrl; }
function renderPhoto(item) { const card = document.createElement('div'); card.className = 'photo-card'; card.innerHTML = '<img src="' + item.src + '"><span class="trade-tag">' + item.trade + '</span>'; document.getElementById('photos').appendChild(card); }
function smsHref(phone, body) { const clean = String(phone || '').replace(/[^\d+]/g, ''); const enc = encodeURIComponent(body); const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent); return 'sms:' + clean + (ios ? '&body=' : '?body=') + enc; }
function sendEmail(item, typeLabel) { const c = contacts[item.trade] || {}; if (!c.email) { alert('Save an email for ' + item.trade + ' first.'); return; } location.href = 'mailto:' + c.email + '?subject=' + encodeURIComponent('SiteWalk ' + typeLabel) + '&body=' + encodeURIComponent(item.text); }
function sendText(item, typeLabel) { const c = contacts[item.trade] || {}; if (!c.phone) { alert('Save a phone for ' + item.trade + ' first.'); return; } location.href = smsHref(c.phone, typeLabel + ': ' + item.text); }

function renderItemCard(entry, type) {
  const tagClass = type === 'rfi' ? 'rfi' : type === 'change' ? 'change' : 'punch';
  const tagLabel = type === 'rfi' ? 'RFI' : type === 'change' ? 'Change Order' : 'Punch Item';
  const listEl = document.getElementById(type === 'rfi' ? 'rfiList' : type === 'change' ? 'changeList' : 'punchList');
  const card = document.createElement('div');
  card.className = 'item-card';
  card.appendChild(document.createTextNode('• ' + entry.text));
  if (entry.photo) {
    const img = document.createElement('img');
    img.src = entry.photo;
    img.style.cssText = 'max-width:140px;display:block;margin-top:6px;border-radius:6px';
    card.appendChild(img);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  let metaHtml = '<span class="trade-tag">' + entry.trade + '</span><span class="type-tag ' + tagClass + '">' + tagLabel + '</span>';
  if (entry.verified === false) metaHtml += '<span class="type-tag unverified">Unverified</span>';
  if (type === 'punch' && entry.resolved) metaHtml += '<span class="type-tag change">Resolved</span>';
  metaHtml += ' ' + entry.time;
  if (type === 'change') metaHtml += '<br>Cost impact: ' + (entry.costImpact != null ? ('$' + entry.costImpact) : '—') + ' · Client approval: ' + (entry.approval || 'Pending');
  if (type === 'rfi') metaHtml += '<br>Status: ' + (entry.status || 'Open');
  meta.innerHTML = metaHtml;
  card.appendChild(meta);

  const emailBtn = document.createElement('button');
  emailBtn.className = 'small'; emailBtn.type = 'button'; emailBtn.textContent = 'Email Trade';
  emailBtn.onclick = function () { sendEmail(entry, tagLabel); };
  const textBtn = document.createElement('button');
  textBtn.className = 'small gray'; textBtn.type = 'button'; textBtn.textContent = 'Text Trade';
  textBtn.onclick = function () { sendText(entry, tagLabel); };
  card.appendChild(emailBtn);
  card.appendChild(textBtn);

  if (!entry.photo && photos.length) {
    const attachBtn = document.createElement('button');
    attachBtn.className = 'small gray'; attachBtn.type = 'button'; attachBtn.textContent = 'Attach Last Photo';
    attachBtn.onclick = function () { entry.photo = photos[photos.length - 1].src; persistLists(); renderAllItems(); };
    card.appendChild(attachBtn);
  }
  if (type === 'change') {
    const approveBtn = document.createElement('button');
    approveBtn.className = 'small green'; approveBtn.type = 'button'; approveBtn.textContent = 'Client Approved';
    approveBtn.onclick = function () { entry.approval = 'Approved'; persistLists(); renderAllItems(); renderDashboard(); };
    const declineBtn = document.createElement('button');
    declineBtn.className = 'small red'; declineBtn.type = 'button'; declineBtn.textContent = 'Client Declined';
    declineBtn.onclick = function () { entry.approval = 'Declined'; persistLists(); renderAllItems(); renderDashboard(); };
    card.appendChild(approveBtn);
    card.appendChild(declineBtn);
  }
  if (type === 'rfi') {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'small gray'; toggleBtn.type = 'button';
    toggleBtn.textContent = entry.status === 'Answered' ? 'Reopen RFI' : 'Mark Answered';
    toggleBtn.onclick = function () { entry.status = entry.status === 'Answered' ? 'Open' : 'Answered'; persistLists(); renderAllItems(); renderDashboard(); };
    card.appendChild(toggleBtn);
  }
  if (type === 'punch') {
    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'small gray'; resolveBtn.type = 'button';
    resolveBtn.textContent = entry.resolved ? 'Reopen' : 'Mark Resolved';
    resolveBtn.onclick = function () { entry.resolved = !entry.resolved; persistLists(); renderAllItems(); renderDashboard(); };
    card.appendChild(resolveBtn);
  }
  listEl.appendChild(card);
}

function renderAllItems() {
  document.getElementById('punchList').innerHTML = '';
  document.getElementById('changeList').innerHTML = '';
  document.getElementById('rfiList').innerHTML = '';
  punch.forEach(function (e) { renderItemCard(e, 'punch'); });
  changes.forEach(function (e) { renderItemCard(e, 'change'); });
  rfis.forEach(function (e) { renderItemCard(e, 'rfi'); });
}

function renderContacts() {
  const wrap = document.getElementById('contactFields');
  wrap.innerHTML = '';
  TRADES.forEach(function (trade) {
    const row = document.createElement('div');
    row.className = 'contact-row';
    const c = contacts[trade] || { email: '', phone: '' };
    row.innerHTML = '<strong>' + trade + '</strong><input type="email" data-trade="' + trade + '" data-field="email" placeholder="email" value="' + (c.email || '') + '"><input type="tel" data-trade="' + trade + '" data-field="phone" placeholder="phone" value="' + (c.phone || '') + '">';
    wrap.appendChild(row);
  });
}

function renderSubmittals() {
  const wrap = document.getElementById('subList');
  wrap.innerHTML = '';
  submittals.slice().reverse().forEach(function (s) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<strong>' + escapeHtml(s.trade || 'General') + '</strong> — ' + escapeHtml(s.item) +
      '<div class="meta"><span class="type-tag ' + (s.status === 'Approved' ? 'change' : 'rfi') + '">' + s.status + '</span> ' + s.time + '</div>';
    if (s.status === 'Pending') {
      const btn = document.createElement('button');
      btn.className = 'small green'; btn.type = 'button'; btn.textContent = 'Mark Approved';
      btn.onclick = function () { s.status = 'Approved'; s.approvedAt = new Date().toLocaleString(); persistSubmittals(); renderSubmittals(); renderDashboard(); };
      card.appendChild(btn);
    }
    wrap.appendChild(card);
  });
}

function checkMissedClockOuts() {
  const MAX_MS = 16 * 60 * 60 * 1000;
  const byEmployee = {};
  clockEvents.forEach(function (e) { (byEmployee[e.employee] = byEmployee[e.employee] || []).push(e); });
  Object.keys(byEmployee).forEach(function (name) {
    const events = byEmployee[name].slice().sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
    events.forEach(function (e, i) {
      if (e.type !== 'in') return;
      const hasOut = events.slice(i + 1).some(function (o) { return o.type === 'out'; });
      e.flagged = !hasOut && (Date.now() - new Date(e.time).getTime()) > MAX_MS;
    });
  });
  persistClock();
}
function renderClockFlagged() {
  const wrap = document.getElementById('clockFlagged');
  const flagged = clockEvents.filter(function (e) { return e.flagged; });
  wrap.innerHTML = '';
  flagged.forEach(function (e) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<span class="type-tag unverified">Missed Clock-Out</span> ' + escapeHtml(e.employee) + ' — ' + escapeHtml(e.site) + '<div class="meta">Clocked in ' + e.time + '</div>';
    const btn = document.createElement('button');
    btn.className = 'small gray'; btn.type = 'button'; btn.textContent = 'Resolve';
    btn.onclick = function () {
      const correction = prompt('Correct clock-out time for ' + e.employee + '? (leave blank to use now)');
      clockEvents.push({ employee: e.employee, site: e.site, type: 'out', time: correction || new Date().toLocaleString(), flagged: false });
      e.flagged = false;
      persistClock(); checkMissedClockOuts(); renderClockFlagged(); renderClockLog(); renderDashboard();
    };
    card.appendChild(btn);
    wrap.appendChild(card);
  });
}
function renderClockLog() {
  const wrap = document.getElementById('clockLog');
  wrap.innerHTML = '';
  clockEvents.slice().reverse().slice(0, 30).forEach(function (e) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<span class="type-tag ' + (e.type === 'in' ? 'change' : 'punch') + '">' + e.type.toUpperCase() + '</span> ' + escapeHtml(e.employee) + ' — ' + escapeHtml(e.site) + '<div class="meta">' + e.time + '</div>';
    wrap.appendChild(card);
  });
}

function renderDailyLogs() {
  const wrap = document.getElementById('logList');
  wrap.innerHTML = '';
  dailyLogs.slice().reverse().forEach(function (l) {
    const card = document.createElement('div');
    card.className = 'item-card';
    let html = '<strong>' + escapeHtml(l.date) + '</strong> — ' + escapeHtml(l.weather) + ' — Crew: ' + escapeHtml(String(l.crewCount || 'N/A'));
    if (l.trades) html += '<div class="meta">Trades: ' + escapeHtml(l.trades) + '</div>';
    if (l.delays) html += '<div>Delays: ' + escapeHtml(l.delays) + '</div>';
    if (l.notes) html += '<div class="meta">' + escapeHtml(l.notes) + '</div>';
    card.innerHTML = html;
    wrap.appendChild(card);
  });
}

function renderSafetyLogs() {
  const wrap = document.getElementById('safetyList');
  wrap.innerHTML = '';
  safetyLogs.slice().reverse().forEach(function (s) {
    const card = document.createElement('div');
    card.className = 'item-card';
    let html = '<strong>' + escapeHtml(s.type) + '</strong><div>' + escapeHtml(s.desc) + '</div>';
    if (s.person) html += '<div class="meta">Involved: ' + escapeHtml(s.person) + '</div>';
    if (s.action) html += '<div class="meta">Action taken: ' + escapeHtml(s.action) + '</div>';
    html += '<div class="meta">' + s.time + '</div>';
    card.innerHTML = html;
    if (s.photo) {
      const img = document.createElement('img');
      img.src = s.photo;
      img.style.cssText = 'max-width:140px;display:block;margin-top:6px;border-radius:6px';
      card.appendChild(img);
    }
    wrap.appendChild(card);
  });
}

function renderDashboard() {
  const wrap = document.getElementById('dashboard');
  if (!wrap) return;
  const rows = [
    ['Open Punch Items', punch.filter(function (p) { return !p.resolved; }).length],
    ['Open Change Orders', changes.filter(function (c) { return c.approval === 'Pending'; }).length],
    ['Open RFIs', rfis.filter(function (r) { return r.status !== 'Answered'; }).length],
    ['Answered RFIs', rfis.filter(function (r) { return r.status === 'Answered'; }).length],
    ['Pending Submittals', submittals.filter(function (s) { return s.status === 'Pending'; }).length],
    ['Approved Submittals', submittals.filter(function (s) { return s.status === 'Approved'; }).length],
    ['Missed Clock-Outs', clockEvents.filter(function (e) { return e.flagged; }).length]
  ];
  wrap.innerHTML = '<table style="width:100%;border-collapse:collapse">' + rows.map(function (r) {
    return '<tr><td style="padding:6px">' + r[0] + '</td><td style="padding:6px;text-align:right;font-weight:bold">' + r[1] + '</td></tr>';
  }).join('') + '</table>';
}

// type: 'punch' | 'change' | 'rfi'
function fileEntry(data) {
  const entry = { text: data.text, trade: data.trade || tradeSelect.value, time: new Date().toLocaleString(), verified: data.verified !== false };
  if (data.photo) entry.photo = data.photo;
  let type = data.type;
  if (type === 'change') { entry.costImpact = typeof data.costImpact === 'number' ? data.costImpact : null; entry.approval = 'Pending'; changes.push(entry); }
  else if (type === 'rfi') { entry.status = 'Open'; rfis.push(entry); }
  else { type = 'punch'; entry.resolved = false; punch.push(entry); }
  persistLists();
  renderItemCard(entry, type);
  renderDashboard();
  return entry;
}

function classifyText(text) {
  const t = text.toLowerCase();
  if (/rfi|need clarification|waiting on|need to confirm|need info|unclear/.test(t)) return 'rfi';
  if (/change order|additional cost|extra charge|client wants|owner requested|upcharge|out of scope|billable/.test(t)) return 'change';
  return 'punch';
}

// Local (offline) keyword guess at trade, used when the AI Worker isn't set up
// or a request fails. Updates the on-screen trade select so Snap photos and
// filed items pick it up without the crew touching the dropdown.
function classifyTrade(text) {
  const t = text.toLowerCase();
  if (/plumb|pipe|water heater|drain|faucet|toilet|sink|leak/.test(t)) return 'Plumbing';
  if (/electric|outlet|breaker|wiring|panel|switch|circuit/.test(t)) return 'Electrical';
  if (/frame|framing|\bstud\b|joist|truss|header\b/.test(t)) return 'Framing';
  if (/drywall|sheetrock|\bmud\b|\btape\b/.test(t)) return 'Drywall';
  if (/\broof\b|shingle|flashing|gutter/.test(t)) return 'Roofing';
  if (/concrete|\bslab\b|foundation|rebar/.test(t)) return 'Concrete';
  if (/landscap|\bsod\b|irrigation|grading/.test(t)) return 'Landscaping';
  return null;
}

function localClassify(text) {
  const guessedTrade = classifyTrade(text);
  if (guessedTrade) tradeSelect.value = guessedTrade;
  return { text: text, type: classifyText(text), trade: tradeSelect.value, costImpact: null, verified: false };
}

// Sends one finalized spoken sentence through the Worker's /classify route
// (type + trade + cost impact from an LLM). Falls back to the local keyword
// heuristic + manually-selected trade if there's no endpoint, the request
// fails, or it times out — so voice capture never silently drops an item.
function fileVoiceUtterance(text) {
  text = text.trim();
  if (!text) return;
  const endpoint = currentAiEndpoint();
  if (!endpoint) { fileEntry(localClassify(text)); return; }
  const headers = { 'Content-Type': 'application/json' };
  const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  fetch(endpoint + '/classify', { method: 'POST', headers: headers, body: JSON.stringify({ text: text }), signal: controller ? controller.signal : undefined })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (timer) clearTimeout(timer);
      if (!data || data.error || !data.type) throw new Error((data && data.error) || 'bad response');
      const type = data.type === 'change_order' ? 'change' : (data.type === 'rfi' ? 'rfi' : 'punch');
      if (data.trade && TRADES.indexOf(data.trade) !== -1) tradeSelect.value = data.trade;
      fileEntry({ text: data.text || text, type: type, trade: data.trade || tradeSelect.value, costImpact: data.costImpact, verified: true });
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      fileEntry(localClassify(text));
    });
}

function snapFromVideo(video) { if (!video || !video.videoWidth) return null; const max = 1280; const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight)); const c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale); const ctx = c.getContext('2d'); if (!ctx) return null; ctx.drawImage(video, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }
function saveWalkPhoto(src) { const item = { src: src, trade: tradeSelect.value, time: new Date().toLocaleString() }; photos.push(item); persistPhotos(); renderPhoto(item); setWalkStatus('ok', 'Photo tagged as ' + item.trade + ' (' + photos.length + ' total)'); }

// --- Voice: continuous SpeechRecognition where available ---
function voiceRecognitionSupported() { return !!SpeechRecognition; }
function setupRecognition() {
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  rec.onresult = function (event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) { if (transcript) fileVoiceUtterance(transcript); }
      else interim += transcript;
    }
    const walkLive = document.getElementById('walkLiveTranscript');
    if (walkLive) walkLive.textContent = interim ? ('AI hearing: "' + interim + '"') : 'AI listening.';
  };
  rec.onerror = function (err) { setWalkStatus('err', 'Voice error: ' + (err.error || 'unknown')); };
  rec.onend = function () { if (listening) { try { rec.start(); } catch (e) { } } };
  return rec;
}
function startListening() {
  if (!SpeechRecognition || listening) return;
  recognition = setupRecognition();
  listening = true;
  try { recognition.start(); } catch (e) { }
}
function stopListening() {
  listening = false;
  if (recognition) { try { recognition.stop(); } catch (e) { } }
}

// --- Voice: push-to-talk fallback (iOS Safari and anything without SpeechRecognition) ---
function recordingSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
function blobToBase64(blob, cb) { const r = new FileReader(); r.onload = function () { const res = r.result; const comma = res.indexOf(','); cb(comma >= 0 ? res.slice(comma + 1) : res); }; r.readAsDataURL(blob); }
function transcribeAndFile(blob) {
  const endpoint = currentAiEndpoint();
  if (!endpoint) { setWalkStatus('err', 'Set the AI Worker URL below to use voice notes on this phone.'); return; }
  setWalkStatus('info', 'Transcribing voice note…');
  blobToBase64(blob, function (b64) {
    const headers = { 'Content-Type': 'application/json' };
    const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key;
    fetch(endpoint + '/transcribe', { method: 'POST', headers: headers, body: JSON.stringify({ audio: b64 }) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.error) throw new Error((data && data.error) || 'transcribe failed');
        const text = (data.text || '').trim();
        if (!text) { setWalkStatus('info', 'Heard nothing usable. Try again closer to the mic.'); return; }
        setWalkStatus('ok', 'Heard: "' + text + '"');
        fileVoiceUtterance(text);
      })
      .catch(function (err) { setWalkStatus('err', 'Transcribe failed: ' + (err && err.message ? err.message : 'unknown')); });
  });
}
function setRecordButtonsUi(active) {
  ['walkRecordBtn'].forEach(function (id) {
    const btn = document.getElementById(id);
    if (!btn || btn.style.display === 'none') return;
    btn.classList.toggle('red', active);
    btn.textContent = active ? '⏹ Stop & File Note' : '🎤 Tap to Record a Note';
  });
}
function startRecordingNote() {
  if (recordingNote) return;
  if (!recordingSupported()) { setWalkStatus('err', 'Voice notes need mic access (HTTPS + a supported browser).'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    mediaStream = stream;
    mediaChunks = [];
    const mimeType = (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('audio/mp4')) ? 'audio/mp4'
      : (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : '';
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) mediaChunks.push(e.data); };
    mediaRecorder.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      mediaChunks = [];
      transcribeAndFile(blob);
    };
    mediaRecorder.start();
    recordingNote = true;
    setRecordButtonsUi(true);
    setWalkStatus('ok', 'Recording… tap again when you’re done with this note.');
  }).catch(function () { setWalkStatus('err', 'Mic permission denied or unavailable.'); });
}
function stopRecordingNote() {
  if (!recordingNote) return;
  recordingNote = false;
  setRecordButtonsUi(false);
  try { mediaRecorder.stop(); } catch (e) { }
}
function toggleRecordingNote() { if (recordingNote) stopRecordingNote(); else startRecordingNote(); }

// --- Voice during a walk: use whichever capture method the browser supports ---
function startWalkVoice() {
  if (voiceRecognitionSupported()) {
    startListening();
    const walkLive = document.getElementById('walkLiveTranscript');
    walkLive.style.display = 'block';
    walkLive.textContent = 'AI listening — notes file as you talk.';
  } else {
    setWalkStatus('ok', 'Walk live. Tap the mic button to record each note (this browser can’t listen continuously).');
  }
}
function stopWalkVoice() {
  if (voiceRecognitionSupported()) stopListening();
  else if (recordingNote) stopRecordingNote();
  document.getElementById('walkLiveTranscript').style.display = 'none';
}
function stopWalkCamera() { if (walkStream) { walkStream.getTracks().forEach(function (t) { t.stop(); }); walkStream = null; } const video = document.getElementById('walkVideo'); video.srcObject = null; video.classList.add('hidden-cam'); if (walkGpsWatch != null && navigator.geolocation) { navigator.geolocation.clearWatch(walkGpsWatch); walkGpsWatch = null; } }
// facingMode 'ideal' is only a hint — browsers are free to ignore it and
// hand back the front/selfie camera. Try 'exact' (rear camera or fail)
// first, then a soft preference, then any camera at all as a last resort
// (e.g. a laptop with only one webcam, which has no "environment" camera).
function getWalkStream() {
  const dims = { width: { ideal: 1280 }, height: { ideal: 720 } };
  return navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { exact: 'environment' } }, dims), audio: false })
    .catch(function () { return navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: 'environment' }, dims), audio: false }); })
    .catch(function () { return navigator.mediaDevices.getUserMedia({ video: true, audio: false }); });
}
function openWalkCamera() { const video = document.getElementById('walkVideo'); video.classList.remove('hidden-cam'); if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { video.classList.add('hidden-cam'); setWalkStatus('info', 'Live camera needs HTTPS. Tap Snap.'); return Promise.resolve(false); } return getWalkStream().then(function (stream) { walkStream = stream; video.setAttribute('playsinline', 'true'); video.setAttribute('webkit-playsinline', 'true'); video.muted = true; video.playsInline = true; video.srcObject = stream; return video.play().then(function () { return true; }).catch(function () { return true; }); }).catch(function () { video.classList.add('hidden-cam'); setWalkStatus('info', 'Live camera unavailable. Tap Snap to take a photo.'); return false; }); }
window.startWalk = function () {
  if (walkActive) return;
  walkActive = true;
  document.getElementById('walkBtn').style.display = 'none';
  document.getElementById('endWalkBtn').style.display = 'block';
  document.getElementById('walkStage').classList.add('active');
  setWalkStatus('ok', 'Asking for camera and mic…');
  document.getElementById('gpsLabel').textContent = navigator.geolocation ? 'Waiting for GPS…' : 'GPS off';
  if (navigator.geolocation) {
    walkGpsWatch = navigator.geolocation.watchPosition(function (pos) {
      document.getElementById('gpsLabel').textContent = pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5);
    }, function (err) { document.getElementById('gpsLabel').textContent = err.message || 'GPS unavailable'; }, { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 });
  }
  openWalkCamera().then(function (live) {
    startWalkVoice();
    if (live) setWalkStatus('ok', 'Walk live — camera + AI listening. Snap photos as you go.');
    else if (walkActive) setWalkStatus('ok', 'Walk live. Tap Snap for photos.');
  });
};
window.endWalk = function () {
  walkActive = false;
  stopWalkCamera();
  stopWalkVoice();
  document.getElementById('walkBtn').style.display = 'block';
  document.getElementById('endWalkBtn').style.display = 'none';
  document.getElementById('walkStage').classList.remove('active');
  setWalkStatus('info', 'Walk ended. Photos and notes stayed on this phone.');
  if (confirm('Walk ended. Generate the report now?')) {
    window.generateReport();
    showTab('setup');
  }
};
document.getElementById('walkBtn').addEventListener('click', window.startWalk);
document.getElementById('endWalkBtn').addEventListener('click', window.endWalk);
document.getElementById('shutterBtn').addEventListener('click', function () { const fromLive = walkStream ? snapFromVideo(document.getElementById('walkVideo')) : null; if (fromLive) { saveWalkPhoto(fromLive); return; } document.getElementById('photoInput').click(); });
document.getElementById('walkRecordBtn').addEventListener('click', toggleRecordingNote);
document.getElementById('photoInput').addEventListener('change', function (e) { const files = e.target.files; if (!files || !files.length) return; const trade = tradeSelect.value; for (let f of files) { const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, function (src) { const item = { src: src, trade: trade, time: new Date().toLocaleString() }; photos.push(item); persistPhotos(); renderPhoto(item); setWalkStatus('ok', 'Photo tagged as ' + trade + ' (' + photos.length + ' total)'); }); }; r.readAsDataURL(f); } e.target.value = ''; });
document.getElementById('addPunchBtn').addEventListener('click', function () { const val = document.getElementById('punchInput').value.trim(); if (!val) return; fileEntry({ text: val, type: 'punch', trade: tradeSelect.value, verified: true, costImpact: null }); document.getElementById('punchInput').value = ''; });
document.getElementById('saveContactsBtn').addEventListener('click', function () { document.querySelectorAll('#contactFields input').forEach(function (inp) { const trade = inp.getAttribute('data-trade'); const field = inp.getAttribute('data-field'); if (!contacts[trade]) contacts[trade] = { email: '', phone: '' }; contacts[trade][field] = inp.value.trim(); }); persistContacts(); const el = document.getElementById('contactStatus'); el.style.display = 'block'; el.className = 'status ok'; el.textContent = 'Trade contacts saved.'; });
document.getElementById('addSubBtn').addEventListener('click', function () {
  const item = document.getElementById('subItem').value.trim();
  const trade = document.getElementById('subTrade').value.trim() || 'General';
  if (!item) return;
  submittals.push({ item: item, trade: trade, status: 'Pending', time: new Date().toLocaleString() });
  persistSubmittals(); renderSubmittals(); renderDashboard();
  document.getElementById('subItem').value = ''; document.getElementById('subTrade').value = '';
});
function logClockEvent(type) {
  const employee = document.getElementById('clockEmployee').value.trim();
  const site = document.getElementById('clockSite').value.trim();
  if (!employee || !site) { alert('Enter your name and job site first.'); return; }
  clockEvents.push({ employee: employee, site: site, type: type, time: new Date().toLocaleString(), flagged: false });
  persistClock(); checkMissedClockOuts(); renderClockLog(); renderClockFlagged(); renderDashboard();
}
document.getElementById('clockInBtn').addEventListener('click', function () { logClockEvent('in'); });
document.getElementById('clockOutBtn').addEventListener('click', function () { logClockEvent('out'); });
document.getElementById('addLogBtn').addEventListener('click', function () {
  const date = document.getElementById('logDate').value || new Date().toISOString().split('T')[0];
  const weather = document.getElementById('logWeather').value;
  const crewCount = document.getElementById('logCrewCount').value;
  const trades = document.getElementById('logTrades').value.trim();
  const delays = document.getElementById('logDelays').value.trim();
  const notes = document.getElementById('logNotes').value.trim();
  dailyLogs.push({ date: date, weather: weather, crewCount: crewCount, trades: trades, delays: delays, notes: notes });
  persistDailyLogs(); renderDailyLogs();
  document.getElementById('logCrewCount').value = '';
  document.getElementById('logTrades').value = '';
  document.getElementById('logDelays').value = '';
  document.getElementById('logNotes').value = '';
});
document.getElementById('addSafetyBtn').addEventListener('click', function () {
  const type = document.getElementById('safetyType').value;
  const desc = document.getElementById('safetyDesc').value.trim();
  const person = document.getElementById('safetyPerson').value.trim();
  const action = document.getElementById('safetyAction').value.trim();
  const photoInput = document.getElementById('safetyPhotoInput');
  if (!desc) { alert('Enter a description first.'); return; }
  function finish(photoSrc) {
    safetyLogs.push({ type: type, desc: desc, person: person, action: action, photo: photoSrc || null, time: new Date().toLocaleString() });
    persistSafety(); renderSafetyLogs();
    document.getElementById('safetyDesc').value = '';
    document.getElementById('safetyPerson').value = '';
    document.getElementById('safetyAction').value = '';
    photoInput.value = '';
  }
  const file = photoInput.files && photoInput.files[0];
  if (file) {
    const r = new FileReader();
    r.onload = function (ev) { compressImage(ev.target.result, finish); };
    r.readAsDataURL(file);
  } else finish(null);
});
function currentAiEndpoint() { return (localStorage.getItem(LS.aiEndpoint) || '').trim().replace(/\/$/, ''); }
function currentAiKey() { return (localStorage.getItem(LS.aiKey) || '').trim(); }
function setAiStatus(kind, text) { const el = document.getElementById('aiStatus'); el.className = 'status ' + kind; el.textContent = text; }
function refreshAiStatus() { const url = currentAiEndpoint(); const key = currentAiKey(); document.getElementById('aiEndpointInput').value = url; document.getElementById('aiKeyInput').value = key; if (url && key) setAiStatus('ok', 'Worker URL and key saved.'); else if (url) setAiStatus('ok', 'Worker URL saved.'); else setAiStatus('info', 'Worker URL not set.'); }
document.getElementById('saveEndpointBtn').addEventListener('click', function () { const url = document.getElementById('aiEndpointInput').value.trim().replace(/\/$/, ''); const key = document.getElementById('aiKeyInput').value.trim(); if (url) localStorage.setItem(LS.aiEndpoint, url); else localStorage.removeItem(LS.aiEndpoint); if (key) localStorage.setItem(LS.aiKey, key); else localStorage.removeItem(LS.aiKey); refreshAiStatus(); });
document.getElementById('aiPhotoBtn').addEventListener('click', function () { if (!currentAiEndpoint()) { setAiStatus('err', 'No worker URL yet.'); return; } document.getElementById('aiPhotoInput').click(); });
document.getElementById('aiPhotoInput').addEventListener('change', function (e) { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return; const endpoint = currentAiEndpoint(); if (!endpoint) return; setAiStatus('info', 'Checking photo…'); const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, function (src) { const headers = { 'Content-Type': 'application/json' }; const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key; fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify({ image: src, trade: tradeSelect.value }) }).then(function (res) { return res.text().then(function (t) { let data; try { data = JSON.parse(t); } catch (err) { data = { error: t || res.statusText }; } if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status)); return data; }); }).then(function (data) { const text = (data.result || data.text || JSON.stringify(data)).trim(); document.getElementById('aiResult').style.display = 'block'; document.getElementById('aiResult').textContent = text; setAiStatus('ok', 'Check complete.'); if (text) fileEntry({ text: 'AI code-check: ' + text, type: 'punch', trade: tradeSelect.value, verified: true, costImpact: null, photo: src }); }).catch(function (err) { setAiStatus('err', 'AI check failed: ' + (err && err.message ? err.message : 'unknown')); }); }); }; r.readAsDataURL(file); });
window.generateReport = function () {
  const trades = {};
  photos.forEach(function (p) { if (!trades[p.trade]) trades[p.trade] = []; trades[p.trade].push(p); });
  let html = '<div style="text-align:center"><strong>SiteWalk Report</strong><br>' + new Date().toLocaleString() + '</div>';
  Object.keys(trades).forEach(function (t) { html += '<div class="report-section"><h3>' + t + '</h3>'; trades[t].forEach(function (p) { html += '<img src="' + p.src + '">'; }); html += '</div>'; });
  function sect(title, arr, extra) {
    if (!arr.length) return '';
    let h = '<div class="report-section"><h3>' + title + '</h3>';
    arr.forEach(function (item) { h += '<div class="punch-item">[' + item.trade + '] ' + item.text + (extra ? extra(item) : '') + '</div>'; });
    return h + '</div>';
  }
  html += sect('Punch List', punch, function (i) { return i.resolved ? ' — Resolved' : ''; });
  html += sect('Change Orders', changes, function (i) { return ' — $' + (i.costImpact != null ? i.costImpact : '?') + ' (' + (i.approval || 'Pending') + ')'; });
  html += sect('RFIs', rfis, function (i) { return ' — ' + (i.status || 'Open'); });
  if (submittals.length) { html += '<div class="report-section"><h3>Submittals</h3>'; submittals.forEach(function (s) { html += '<div class="punch-item">[' + (s.trade || 'General') + '] ' + s.item + ' — ' + s.status + '</div>'; }); html += '</div>'; }
  if (dailyLogs.length) { html += '<div class="report-section"><h3>Daily Logs</h3>'; dailyLogs.forEach(function (l) { html += '<div class="punch-item">' + l.date + ' — ' + l.weather + ' — Crew: ' + (l.crewCount || 'N/A') + (l.trades ? ' — ' + l.trades : '') + (l.delays ? ' — Delays: ' + l.delays : '') + '</div>'; }); html += '</div>'; }
  if (safetyLogs.length) { html += '<div class="report-section"><h3>Safety Log</h3>'; safetyLogs.forEach(function (s) { html += '<div class="punch-item">[' + s.type + '] ' + s.desc + (s.action ? ' — Action: ' + s.action : '') + '</div>'; }); html += '</div>'; }
  const missedClockOuts = clockEvents.filter(function (e) { return e.flagged; });
  if (missedClockOuts.length) { html += '<div class="report-section"><h3>Missed Clock-Outs</h3>'; missedClockOuts.forEach(function (e) { html += '<div class="punch-item">' + e.employee + ' — ' + e.site + ' (in ' + e.time + ')</div>'; }); html += '</div>'; }
  document.getElementById('report').innerHTML = html;
};
document.getElementById('genBtn').addEventListener('click', window.generateReport);
document.getElementById('printBtn').addEventListener('click', function () { window.generateReport(); setTimeout(function () { window.print(); }, 300); });
window.addEventListener('load', function () {
  photos = loadJson(LS.photos, []); punch = loadJson(LS.punch, []); changes = loadJson(LS.changes, []); rfis = loadJson(LS.rfis, []); contacts = loadJson(LS.contacts, {});
  submittals = loadJson(LS.submittals, []); clockEvents = loadJson(LS.clockEvents, []); dailyLogs = loadJson(LS.dailyLogs, []); safetyLogs = loadJson(LS.safety, []);
  if (!Array.isArray(photos)) photos = []; if (!Array.isArray(punch)) punch = []; if (!Array.isArray(changes)) changes = []; if (!Array.isArray(rfis)) rfis = [];
  if (!Array.isArray(submittals)) submittals = []; if (!Array.isArray(clockEvents)) clockEvents = []; if (!Array.isArray(dailyLogs)) dailyLogs = []; if (!Array.isArray(safetyLogs)) safetyLogs = [];
  document.getElementById('photos').innerHTML = '';
  photos.forEach(renderPhoto);
  renderAllItems();
  renderContacts();
  renderSubmittals();
  checkMissedClockOuts();
  renderClockFlagged();
  renderClockLog();
  renderDailyLogs();
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  renderSafetyLogs();
  renderDashboard();
  refreshAiStatus();
  if (!voiceRecognitionSupported()) {
    document.getElementById('walkRecordBtn').style.display = 'block';
  }
  document.getElementById('walkStatus').textContent = 'Ready. Tap Start Walk-Around to open the camera and AI listening.';
  let savedTab = 'walk';
  try { savedTab = localStorage.getItem('swActiveTab') || 'walk'; } catch (e) { }
  showTab(savedTab);
});
