const TABS = ['walk', 'punch', 'changes', 'rfis', 'submittals', 'safety', 'clock', 'dailylog', 'jobcost', 'drawingrefs', 'drawings', 'dashboard', 'contacts', 'setup', 'report'];
function showTab(name) {
  if (TABS.indexOf(name) === -1) name = 'walk';
  TABS.forEach(function (t) {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  document.querySelectorAll('.top-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  try { localStorage.setItem('swActiveTab', name); } catch (e) { }
}
document.querySelectorAll('.top-tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
});

const TRADES = ['General', 'Plumbing', 'Electrical', 'Framing', 'Drywall', 'Roofing', 'Concrete', 'Landscaping', 'Other'];
const LS = { photos: 'swPhotos', punch: 'swPunch', changes: 'swChanges', rfis: 'swRfis', contacts: 'swTradeContacts', aiEndpoint: 'swAiEndpoint', aiKey: 'swAiKey', submittals: 'swSubmittals', clockEvents: 'swClockEvents', dailyLogs: 'swDailyLogs', safety: 'swSafety', notes: 'swWalkNotes', siteName: 'swJobSiteName', siteAddress: 'swJobSiteAddress', wages: 'swWageRates', materials: 'swMaterials', budget: 'swBudget', drawings: 'swDrawings' };
let photos = [], punch = [], changes = [], rfis = [], contacts = {}, submittals = [], clockEvents = [], dailyLogs = [], safetyLogs = [], notesLog = [], wages = {}, materials = [], budget = { labor: 0, materials: 0 }, drawings = [];
const TRADE_CLASS = { General: 'tag-general', Plumbing: 'tag-plumbing', Electrical: 'tag-electrical', Framing: 'tag-framing', Drywall: 'tag-drywall', Roofing: 'tag-roofing', Concrete: 'tag-concrete', Landscaping: 'tag-landscaping', Other: 'tag-other' };
const TRADE_DOT = { General: 'dot-general', Plumbing: 'dot-plumbing', Electrical: 'dot-electrical', Framing: 'dot-framing', Drywall: 'dot-drywall', Roofing: 'dot-roofing', Concrete: 'dot-concrete', Landscaping: 'dot-landscaping', Other: 'dot-other' };
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
function persistNotes() { saveJson(LS.notes, notesLog); }
function persistWages() { saveJson(LS.wages, wages); }
function persistMaterials() { saveJson(LS.materials, materials); }
function persistBudget() { saveJson(LS.budget, budget); }
function persistDrawings() { saveJson(LS.drawings, drawings); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }
function setWalkStatus(kind, text) { const s = document.getElementById('walkStatus'); s.className = 'w-walk-status ' + kind; s.textContent = text; }
function compressImage(dataUrl, cb) { const img = new Image(); img.onload = function () { let w = img.width, h = img.height, max = 1280; if (w > max) { h = Math.round(h * max / w); w = max; } if (h > max) { w = Math.round(w * max / h); h = max; } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); cb(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = function () { cb(dataUrl); }; img.src = dataUrl; }
const PHOTO_LINK_WINDOW_MS = 60000;
function photoTs(item) { return item.ts || Date.parse(item.time) || 0; }

// Auto-links a snapped photo to whatever trade issue was just filed by voice
// (or vice versa), within a short time window, so tapping a punch list item
// shows its related photo instead of keeping the two lists disconnected.
function tryLinkPhotoToRecentItem(photo) {
  const candidates = punch.concat(changes, rfis).filter(function (e) {
    const dt = photo.ts - (e.ts || 0);
    return !e.photo && dt >= 0 && dt <= PHOTO_LINK_WINDOW_MS;
  }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  if (!candidates.length) return false;
  candidates[0].photo = photo.src;
  photo.linkedItemText = candidates[0].text;
  persistLists(); persistPhotos(); renderAllItems();
  return true;
}
function tryLinkItemToRecentPhoto(entry) {
  const candidates = photos.filter(function (p) {
    const dt = entry.ts - (p.ts || 0);
    return !p.linkedItemText && dt >= 0 && dt <= PHOTO_LINK_WINDOW_MS;
  }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  if (!candidates.length) return false;
  entry.photo = candidates[0].src;
  candidates[0].linkedItemText = entry.text;
  persistLists(); persistPhotos();
  return true;
}

function dateHeaderLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - that) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

let selectedPhotos = new Set();
function updateSelectionBar() {
  const bar = document.getElementById('photoSelectionBar');
  const btn = document.getElementById('deleteSelectedBtn');
  if (!bar || !btn) return;
  const n = selectedPhotos.size;
  bar.style.display = n > 0 ? 'block' : 'none';
  btn.textContent = 'Delete Selected (' + n + ')';
}
function togglePhotoSelection(item, checked) {
  if (checked) selectedPhotos.add(item); else selectedPhotos.delete(item);
  updateSelectionBar();
}
function deleteSelectedPhotos() {
  const n = selectedPhotos.size;
  if (!n) return;
  if (!confirm('Delete ' + n + ' selected photo' + (n === 1 ? '' : 's') + '? This can\'t be undone.')) return;
  selectedPhotos.forEach(function (item) {
    const idx = photos.indexOf(item);
    if (idx !== -1) photos.splice(idx, 1);
    punch.concat(changes, rfis).forEach(function (e) { if (e.photo === item.src) delete e.photo; });
  });
  selectedPhotos.clear();
  persistPhotos();
  persistLists();
  renderPhotosTab();
  renderAllItems();
  renderSummary();
  updateSelectionBar();
}

function buildPhotoThumb(item) {
  const thumb = document.createElement('div');
  thumb.className = 'w-photo-thumb';
  thumb.innerHTML = '<img src="' + item.src + '"><span class="w-thumb-trade">' + item.trade + '</span>'
    + (item.linkedItemText ? '<span class="w-thumb-linked" title="Linked to a punch list item">🔗</span>' : '')
    + '<label class="w-thumb-check-wrap"><input type="checkbox" class="w-thumb-check"' + (selectedPhotos.has(item) ? ' checked' : '') + '></label>';
  thumb.addEventListener('click', function () { openLightbox(item.src); });
  const checkbox = thumb.querySelector('.w-thumb-check');
  checkbox.addEventListener('click', function (e) { e.stopPropagation(); });
  checkbox.addEventListener('change', function () { togglePhotoSelection(item, checkbox.checked); });
  return thumb;
}

let photoFilterTrade = 'All';
function renderPhotoTradeFilters() {
  const wrap = document.getElementById('photoTradeFilters');
  if (!wrap) return;
  const present = [];
  photos.forEach(function (p) { if (present.indexOf(p.trade) === -1) present.push(p.trade); });
  let html = '<button type="button" class="w-filter-pill' + (photoFilterTrade === 'All' ? ' active' : '') + '" data-trade="All">All</button>';
  present.forEach(function (t) {
    html += '<button type="button" class="w-filter-pill' + (photoFilterTrade === t ? ' active' : '') + '" data-trade="' + t + '">' + t + '</button>';
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.w-filter-pill').forEach(function (btn) {
    btn.addEventListener('click', function () { photoFilterTrade = btn.getAttribute('data-trade'); renderPhotosTab(); });
  });
}

// Full rebuild (not incremental append) so photos regroup into date sections
// and re-filter correctly whenever the search box, trade pill, or the photo
// list itself changes.
function renderPhotosTab() {
  renderPhotoTradeFilters();
  const grid = document.getElementById('photosGrid');
  const searchInput = document.getElementById('photoSearch');
  const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
  let list = photos.slice().sort(function (a, b) { return photoTs(a) - photoTs(b); });
  if (photoFilterTrade !== 'All') list = list.filter(function (p) { return p.trade === photoFilterTrade; });
  if (search) list = list.filter(function (p) {
    return p.trade.toLowerCase().indexOf(search) !== -1 || (p.linkedItemText && p.linkedItemText.toLowerCase().indexOf(search) !== -1);
  });

  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = '<div class="w-empty"><span class="big">🖼️</span>' + (photos.length ? 'No photos match.' : 'Photos you snap during the walk will show up here.') + '</div>';
    return;
  }

  const groups = [];
  list.slice().reverse().forEach(function (item) {
    const label = dateHeaderLabel(photoTs(item));
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { label: label, items: [] }; groups.push(g); }
    g.items.push(item);
  });
  groups.forEach(function (g) {
    const header = document.createElement('div');
    header.className = 'w-timeline-date';
    header.textContent = g.label;
    grid.appendChild(header);
    const row = document.createElement('div');
    row.className = 'w-photo-grid';
    g.items.slice().reverse().forEach(function (item) { row.appendChild(buildPhotoThumb(item)); });
    grid.appendChild(row);
  });
}
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('open'); }

/* ---------- Notes tab (spoken transcript log) ---------- */
function renderNote(entry) {
  const wrap = document.getElementById('notesList');
  const card = document.createElement('div');
  card.className = 'w-note-entry';
  card.innerHTML = '<span class="w-note-trade ' + (TRADE_CLASS[entry.trade] || 'tag-general') + '">' + entry.trade + '</span>' + escapeHtml(entry.text) + '<span class="w-note-time">' + entry.time + '</span>';
  wrap.appendChild(card);
}
function renderAllNotes() {
  const wrap = document.getElementById('notesList');
  wrap.innerHTML = '';
  if (!notesLog.length) { wrap.innerHTML = '<div class="w-empty"><span class="big">📝</span>Notes you speak during the walk will show up here.</div>'; return; }
  notesLog.forEach(renderNote);
}
function logNote(text, trade) {
  const entry = { text: text, trade: trade, time: new Date().toLocaleString() };
  notesLog.push(entry); persistNotes();
  const wrap = document.getElementById('notesList');
  if (wrap.querySelector('.w-empty')) wrap.innerHTML = '';
  renderNote(entry);
}

/* ---------- Summary tab (report grouped by trade) ---------- */
function renderSummary() {
  const content = document.getElementById('summaryContent');
  document.getElementById('statPhotos').textContent = photos.length;
  const allItems = punch.concat(changes, rfis);
  const openCount = punch.filter(function (p) { return !p.resolved; }).length
    + changes.filter(function (c) { return c.approval === 'Pending'; }).length
    + rfis.filter(function (r) { return r.status !== 'Answered'; }).length;
  document.getElementById('statOpen').textContent = openCount;

  const byTrade = {};
  allItems.forEach(function (e) { (byTrade[e.trade] = byTrade[e.trade] || []).push(e); });
  const tradesPresent = Object.keys(byTrade);
  document.getElementById('statTrades').textContent = tradesPresent.length;

  if (!allItems.length && !photos.length) {
    content.innerHTML = '<div class="w-empty"><span class="big">📋</span>Run a walk-around and this will fill in automatically, organized by trade.</div>';
    return;
  }

  let html = '';
  tradesPresent.forEach(function (trade) {
    const items = byTrade[trade];
    html += '<div class="w-summary-card"><h3><span class="w-trade-dot ' + (TRADE_DOT[trade] || 'dot-general') + '"></span>' + trade + '</h3>';
    items.forEach(function (e) {
      const typeLabel = e.status !== undefined ? 'RFI' : (e.approval !== undefined ? 'Change Order' : 'Punch Item');
      let extra;
      if (e.status !== undefined) extra = e.status;
      else if (e.approval !== undefined) extra = (e.costEstimate != null ? ('$' + e.costEstimate + ' — ') : '') + e.approval;
      else extra = e.resolved ? 'Resolved' : 'Open';
      html += '<div class="w-summary-item">' + escapeHtml(e.text) + '<div class="meta">' + typeLabel + ' · ' + extra + '</div></div>';
    });
    html += '</div>';
  });
  content.innerHTML = html;
}

/* ---------- Inner Walk-tab sub-navigation (Main / Summary / Notes / Photos) ---------- */
const WALK_TABS = ['main', 'summary', 'notes', 'photos'];
function showWalkTab(name) {
  if (WALK_TABS.indexOf(name) === -1) name = 'main';
  WALK_TABS.forEach(function (t) {
    const panel = document.getElementById('walkview-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  document.querySelectorAll('.walk-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-walktab') === name);
  });
  if (name === 'summary') renderSummary();
  if (name === 'photos') renderPhotosTab();
}
document.querySelectorAll('.walk-tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { showWalkTab(btn.getAttribute('data-walktab')); });
});
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
    img.style.cssText = 'max-width:140px;display:block;margin-top:6px;border-radius:6px;cursor:pointer';
    img.addEventListener('click', function () { openLightbox(entry.photo); });
    card.appendChild(img);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  let metaHtml = '<span class="trade-tag">' + entry.trade + '</span><span class="type-tag ' + tagClass + '">' + tagLabel + '</span>';
  if (entry.verified === false) metaHtml += '<span class="type-tag unverified">Unverified</span>';
  if (type === 'punch' && entry.resolved) metaHtml += '<span class="type-tag change">Resolved</span>';
  metaHtml += ' ' + entry.time;
  if (type === 'change') metaHtml += '<br>Est. cost: ' + (entry.costEstimate != null ? ('$' + entry.costEstimate) : '—') + ' · Client approval: ' + (entry.approval || 'Pending');
  if (type === 'punch') metaHtml += '<br>Est. cost: ' + (entry.costEstimate != null ? ('$' + entry.costEstimate) : '—');
  if (entry.location) metaHtml += ' · Location: ' + escapeHtml(entry.location);
  if (entry.drawingRef) metaHtml += ' · <span class="trade-tag">Sheet ' + escapeHtml(entry.drawingRef) + '</span>';
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
  if (type === 'punch' || type === 'change') {
    const tagBtn = document.createElement('button');
    tagBtn.className = 'small gray'; tagBtn.type = 'button'; tagBtn.textContent = 'Edit Location/Cost';
    tagBtn.onclick = function () {
      const location = prompt('Location (e.g. Master Bath)?', entry.location || '');
      if (location === null) return;
      const costRaw = prompt('Rough cost estimate ($, blank for none)?', entry.costEstimate != null ? String(entry.costEstimate) : '');
      if (costRaw === null) return;
      entry.location = location.trim();
      const cost = parseFloat(costRaw);
      entry.costEstimate = isNaN(cost) ? null : cost;
      persistLists(); renderAllItems();
    };
    card.appendChild(tagBtn);
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
      renderLaborCost(); renderBudgetSummary();
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
    ['Missed Clock-Outs', clockEvents.filter(function (e) { return e.flagged; }).length],
    ['Safety Log Entries', safetyLogs.length]
  ];
  wrap.innerHTML = '<table style="width:100%;border-collapse:collapse">' + rows.map(function (r) {
    return '<tr><td style="padding:6px">' + r[0] + '</td><td style="padding:6px;text-align:right;font-weight:bold">' + r[1] + '</td></tr>';
  }).join('') + '</table>';
}

/* ---------- Job Cost Dashboard: labor, materials, budget vs actual ---------- */
// Pairs each employee's in/out clock events chronologically into worked
// hours; an unmatched trailing "in" counts as hours worked so far (the
// "real-time" part of the running cost), not just completed shifts.
function laborCostByEmployee() {
  const byEmployee = {};
  clockEvents.forEach(function (e) { (byEmployee[e.employee] = byEmployee[e.employee] || []).push(e); });
  return Object.keys(byEmployee).sort().map(function (name) {
    const events = byEmployee[name].slice().sort(function (a, b) { return new Date(a.time) - new Date(b.time); });
    let hours = 0, active = false, lastIn = null;
    events.forEach(function (e) {
      if (e.type === 'in') { lastIn = new Date(e.time).getTime(); }
      else if (e.type === 'out' && lastIn != null) { hours += (new Date(e.time).getTime() - lastIn) / 3600000; lastIn = null; }
    });
    if (lastIn != null) { active = true; hours += (Date.now() - lastIn) / 3600000; }
    const rate = wages[name] || 0;
    return { name: name, hours: hours, active: active, rate: rate, cost: hours * rate };
  });
}
function totalLaborCost() { return laborCostByEmployee().reduce(function (sum, r) { return sum + r.cost; }, 0); }
function totalMaterialsCost() { return materials.reduce(function (sum, m) { return sum + (m.cost || 0); }, 0); }

function renderLaborCost() {
  const wrap = document.getElementById('laborCostList');
  if (!wrap) return;
  const rows = laborCostByEmployee();
  if (!rows.length) { wrap.innerHTML = '<p class="hint">Clock-in data will populate labor cost per employee here.</p>'; return; }
  let html = '';
  rows.forEach(function (r) {
    html += '<div class="item-card"><strong>' + escapeHtml(r.name) + '</strong>' + (r.active ? ' <span class="type-tag change">On the clock</span>' : '')
      + '<div class="meta">' + r.hours.toFixed(2) + ' hrs · $<input type="number" step="0.01" min="0" class="wage-rate-input" data-employee="' + escapeHtml(r.name) + '" value="' + r.rate + '">/hr = $' + r.cost.toFixed(2) + '</div></div>';
  });
  html += '<div class="item-card"><strong>Total Labor Cost: $' + totalLaborCost().toFixed(2) + '</strong></div>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('.wage-rate-input').forEach(function (inp) {
    inp.addEventListener('change', function () {
      wages[inp.getAttribute('data-employee')] = parseFloat(inp.value) || 0;
      persistWages(); renderLaborCost(); renderBudgetSummary();
    });
  });
}

function renderMaterials() {
  const wrap = document.getElementById('materialsList');
  if (!wrap) return;
  if (!materials.length) { wrap.innerHTML = '<p class="hint">Supplies and materials expenses you add will show up here.</p>'; return; }
  let html = '';
  materials.slice().reverse().forEach(function (m) {
    html += '<div class="item-card" data-material-id="' + m.id + '"><strong>' + escapeHtml(m.item) + '</strong> — $' + m.cost.toFixed(2)
      + '<div class="meta">' + (m.vendor ? escapeHtml(m.vendor) + ' · ' : '') + m.time + '</div>'
      + '<button type="button" class="small gray remove-material-btn">Remove</button></div>';
  });
  html += '<div class="item-card"><strong>Materials Total: $' + totalMaterialsCost().toFixed(2) + '</strong></div>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('.remove-material-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.closest('[data-material-id]').getAttribute('data-material-id');
      materials = materials.filter(function (m) { return String(m.id) !== id; });
      persistMaterials(); renderMaterials(); renderBudgetSummary();
    });
  });
}

function budgetRowHtml(label, budgetVal, actualVal) {
  const pct = budgetVal > 0 ? Math.round((actualVal / budgetVal) * 100) : null;
  let statusClass = 'info', statusText = 'No budget set';
  if (budgetVal > 0) {
    const diff = budgetVal - actualVal;
    statusClass = diff >= 0 ? 'under' : 'over';
    statusText = diff >= 0 ? ('$' + diff.toFixed(2) + ' under budget') : ('$' + Math.abs(diff).toFixed(2) + ' over budget');
  }
  return '<div class="item-card"><strong>' + label + '</strong><div class="meta">Budget: $' + budgetVal.toFixed(2) + ' · Actual: $' + actualVal.toFixed(2) + (pct != null ? ' (' + pct + '%)' : '') + '</div><div class="status ' + statusClass + '" style="margin-top:6px">' + statusText + '</div></div>';
}
function renderBudgetSummary() {
  const laborInput = document.getElementById('budgetLabor');
  const materialsInput = document.getElementById('budgetMaterials');
  if (laborInput) laborInput.value = budget.labor || '';
  if (materialsInput) materialsInput.value = budget.materials || '';
  const wrap = document.getElementById('budgetSummary');
  if (!wrap) return;
  const laborActual = totalLaborCost(), materialsActual = totalMaterialsCost();
  wrap.innerHTML = budgetRowHtml('Labor', budget.labor || 0, laborActual)
    + budgetRowHtml('Materials', budget.materials || 0, materialsActual)
    + budgetRowHtml('Combined', (budget.labor || 0) + (budget.materials || 0), laborActual + materialsActual);
}

// type: 'punch' | 'change' | 'rfi'. Every punch/change-order item shares one
// data shape (trade, location, rough cost estimate, plus the punch-vs-change
// flag implicit in which array it lands in) so later chapters — trade
// routing, estimating, invoicing — can reuse a captured item without asking
// the crew to re-enter it.
function fileEntry(data) {
  const entry = { text: data.text, trade: data.trade || tradeSelect.value, time: new Date().toLocaleString(), ts: Date.now(), verified: data.verified !== false };
  if (data.photo) entry.photo = data.photo;
  const drawingRef = extractDrawingRef(entry.text);
  if (drawingRef) entry.drawingRef = drawingRef;
  let type = data.type;
  if (type === 'change') { entry.costEstimate = typeof data.costEstimate === 'number' ? data.costEstimate : null; entry.location = data.location || ''; entry.approval = data.approval || 'Pending'; changes.push(entry); }
  else if (type === 'rfi') { entry.status = 'Open'; rfis.push(entry); }
  else { type = 'punch'; entry.resolved = false; entry.costEstimate = typeof data.costEstimate === 'number' ? data.costEstimate : null; entry.location = data.location || ''; punch.push(entry); }
  if (!entry.photo) tryLinkItemToRecentPhoto(entry);
  persistLists();
  renderItemCard(entry, type);
  renderDashboard();
  renderDrawingRefs();
  return entry;
}

function classifyText(text) {
  const t = text.toLowerCase();
  if (/rfi|need clarification|waiting on|need to confirm|need info|unclear/.test(t)) return 'rfi';
  if (/change order|additional cost|extra charge|client wants|owner requested|upcharge|out of scope|billable/.test(t)) return 'change';
  return 'punch';
}

// Same keyword-tagging approach as classifyTrade()/classifyText() below,
// applied to two more streams: safety hazards get pulled out of trade
// routing entirely (their own list, own follow-up), and a mentioned sheet
// or drawing number gets tagged as a drawing reference.
function classifySafetyText(text) {
  return /\bhazard|unsafe|safety violation|no hard hat|not wearing (a )?(hard hat|ppe|harness|goggles)|missing (guard|rail|railing)|exposed wire|fall risk|trip hazard|\bosha\b|ppe violation|blocked (exit|fire exit)|gas leak|no eye protection|unguarded/i.test(text);
}
function extractDrawingRef(text) {
  const m = text.match(/\b(?:sheet|drawing|dwg|plan sheet|detail)\s*#?\s*([a-z]{0,3}-?\d+(?:\.\d+)?[a-z]?)\b/i);
  return m ? m[1].toUpperCase() : null;
}
function detectVoiceApproval(text) {
  return /client (approved|okay'?d|ok'?d|said yes|signed off)|approved (it )?on site|client (says|gives) (the )?go[- ]ahead/i.test(text);
}
function detectVoiceDecline(text) {
  return /client (declined|said no|rejected)|not approved by (the )?client/i.test(text);
}
// Routes a spoken hazard/violation straight into the existing Safety Log
// instead of trade punch routing — it needs its own follow-up, not a trade.
function logSafetyFromVoice(text) {
  const entry = { type: 'Hazard Observed', desc: text, person: '', action: '', photo: null, time: new Date().toLocaleString(), ts: Date.now() };
  tryLinkItemToRecentPhoto(entry);
  safetyLogs.push(entry);
  persistSafety();
  renderSafetyLogs();
  renderDashboard();
  logNote(text, 'Safety');
  setWalkStatus('ok', 'Safety issue logged separately from the punch list.');
}

function renderDrawingRefs() {
  const wrap = document.getElementById('drawingRefList');
  if (!wrap) return;
  const items = punch.concat(changes, rfis).filter(function (e) { return e.drawingRef; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  if (!items.length) { wrap.innerHTML = '<p class="hint">No drawing references yet.</p>'; return; }
  let html = '';
  items.forEach(function (e) {
    const match = drawings.find(function (d) { return d.sheetNumber && d.sheetNumber.toUpperCase() === e.drawingRef; });
    html += '<div class="item-card"><span class="trade-tag">Sheet ' + escapeHtml(e.drawingRef) + '</span> ' + escapeHtml(e.text) + '<div class="meta">' + escapeHtml(e.trade) + ' · ' + e.time + '</div>';
    html += match ? '<button type="button" class="small gray view-drawing-btn" data-src="' + match.src + '">View Sheet ' + escapeHtml(match.sheetNumber) + '</button>' : '<div class="meta">Sheet not uploaded yet</div>';
    html += '</div>';
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.view-drawing-btn').forEach(function (btn) { btn.addEventListener('click', function () { openLightbox(btn.getAttribute('data-src')); }); });
}

function renderDrawings() {
  const wrap = document.getElementById('drawingsList');
  if (!wrap) return;
  if (!drawings.length) { wrap.innerHTML = '<p class="hint">No drawings uploaded yet.</p>'; return; }
  let html = '';
  drawings.slice().reverse().forEach(function (d) {
    html += '<div class="item-card" data-drawing-id="' + d.id + '"><strong>Sheet ' + escapeHtml(d.sheetNumber) + '</strong><div class="meta">' + d.time + '</div>'
      + '<img src="' + d.src + '" class="drawing-thumb" style="max-width:140px;display:block;margin-top:6px;border-radius:6px;cursor:pointer">'
      + '<button type="button" class="small gray remove-drawing-btn">Remove</button></div>';
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-drawing-id]').forEach(function (card) {
    const id = card.getAttribute('data-drawing-id');
    const d = drawings.find(function (d) { return String(d.id) === id; });
    card.querySelector('.drawing-thumb').addEventListener('click', function () { openLightbox(d.src); });
    card.querySelector('.remove-drawing-btn').addEventListener('click', function () {
      drawings = drawings.filter(function (x) { return String(x.id) !== id; });
      persistDrawings(); renderDrawings(); renderDrawingRefs();
    });
  });
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

function localClassify(text, approval) {
  const guessedTrade = classifyTrade(text);
  if (guessedTrade) tradeSelect.value = guessedTrade;
  const data = { text: text, type: classifyText(text), trade: tradeSelect.value, costEstimate: null, verified: false };
  if (approval) data.approval = approval;
  return data;
}

// Sends one finalized spoken sentence through the Worker's /classify route
// (type + trade + cost impact from an LLM). Falls back to the local keyword
// heuristic + manually-selected trade if there's no endpoint, the request
// fails, or it times out — so voice capture never silently drops an item.
// A hazard/violation is pulled out before any of that (its own list, not
// trade routing), and a spoken client approval/decline is applied at
// capture so a change order approved on site doesn't need a second tap
// after the walk.
function fileVoiceUtterance(text) {
  text = text.trim();
  if (!text) return;
  if (classifySafetyText(text)) { logSafetyFromVoice(text); return; }
  const voiceApproval = detectVoiceApproval(text) ? 'Approved' : (detectVoiceDecline(text) ? 'Declined' : null);
  const endpoint = currentAiEndpoint();
  if (!endpoint) { const e = fileEntry(localClassify(text, voiceApproval)); logNote(e.text, e.trade); return; }
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
      const e = fileEntry({ text: data.text || text, type: type, trade: data.trade || tradeSelect.value, costEstimate: data.costImpact, verified: true, approval: type === 'change' ? (voiceApproval || 'Pending') : undefined });
      logNote(e.text, e.trade);
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      const e = fileEntry(localClassify(text, voiceApproval));
      logNote(e.text, e.trade);
    });
}

function snapFromVideo(video) { if (!video || !video.videoWidth) return null; const max = 1280; const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight)); const c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale); const ctx = c.getContext('2d'); if (!ctx) return null; ctx.drawImage(video, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }
function saveWalkPhoto(src) { const item = { src: src, trade: tradeSelect.value, time: new Date().toLocaleString(), ts: Date.now() }; photos.push(item); tryLinkPhotoToRecentItem(item); persistPhotos(); renderPhotosTab(); setWalkStatus('ok', 'Photo tagged as ' + item.trade + ' (' + photos.length + ' total)'); }

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
  const btn = document.getElementById('walkBtn');
  btn.classList.add('recording');
  btn.innerHTML = 'Stop<br>Walk-Around';
  document.getElementById('walkHero').style.display = 'none';
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
  const btn = document.getElementById('walkBtn');
  btn.classList.remove('recording');
  btn.innerHTML = 'Start<br>Walk-Around';
  document.getElementById('walkHero').style.display = '';
  document.getElementById('walkStage').classList.remove('active');
  setWalkStatus('info', 'Walk ended. Check Summary for what was found.');
  showWalkTab('summary');
};
document.getElementById('walkBtn').addEventListener('click', function () { walkActive ? window.endWalk() : window.startWalk(); });
function takePhoto() { const fromLive = walkStream ? snapFromVideo(document.getElementById('walkVideo')) : null; if (fromLive) { saveWalkPhoto(fromLive); return; } document.getElementById('photoInput').click(); }
document.getElementById('shutterBtn').addEventListener('click', takePhoto);
document.getElementById('mainPhotoBtn').addEventListener('click', takePhoto);
document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedPhotos);
document.getElementById('generateSummaryBtn').addEventListener('click', function () { renderSummary(); showWalkTab('summary'); });
document.getElementById('walkRecordBtn').addEventListener('click', toggleRecordingNote);
document.getElementById('photoInput').addEventListener('change', function (e) { const files = e.target.files; if (!files || !files.length) return; for (let f of files) { const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, saveWalkPhoto); }; r.readAsDataURL(f); } e.target.value = ''; });
document.getElementById('lightboxClose').addEventListener('click', function () { document.getElementById('lightbox').classList.remove('open'); });
document.getElementById('lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') document.getElementById('lightbox').classList.remove('open'); });
function persistSiteInfo() { saveJson(LS.siteName, document.getElementById('siteName').textContent.trim()); saveJson(LS.siteAddress, document.getElementById('siteAddress').textContent.trim()); }
document.getElementById('siteName').addEventListener('blur', persistSiteInfo);
document.getElementById('siteAddress').addEventListener('blur', persistSiteInfo);
document.getElementById('addPunchBtn').addEventListener('click', function () {
  const val = document.getElementById('punchInput').value.trim();
  if (!val) return;
  const location = document.getElementById('punchLocation').value.trim();
  const costRaw = parseFloat(document.getElementById('punchCost').value);
  fileEntry({ text: val, type: 'punch', trade: tradeSelect.value, verified: true, costEstimate: isNaN(costRaw) ? null : costRaw, location: location });
  document.getElementById('punchInput').value = '';
  document.getElementById('punchLocation').value = '';
  document.getElementById('punchCost').value = '';
});
document.getElementById('uploadDrawingBtn').addEventListener('click', function () {
  const sheetNumber = document.getElementById('drawingSheetNumber').value.trim();
  const fileInput = document.getElementById('drawingFileInput');
  const file = fileInput.files && fileInput.files[0];
  if (!sheetNumber || !file) { alert('Enter a sheet number and choose an image first.'); return; }
  const r = new FileReader();
  r.onload = function (ev) {
    compressImage(ev.target.result, function (src) {
      drawings.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), sheetNumber: sheetNumber, src: src, time: new Date().toLocaleString() });
      persistDrawings(); renderDrawings(); renderDrawingRefs();
      document.getElementById('drawingSheetNumber').value = ''; fileInput.value = '';
    });
  };
  r.readAsDataURL(file);
});
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
  renderLaborCost(); renderBudgetSummary();
}
document.getElementById('clockInBtn').addEventListener('click', function () { logClockEvent('in'); });
document.getElementById('clockOutBtn').addEventListener('click', function () { logClockEvent('out'); });
document.getElementById('addMaterialBtn').addEventListener('click', function () {
  const item = document.getElementById('materialItem').value.trim();
  const cost = parseFloat(document.getElementById('materialCost').value);
  const vendor = document.getElementById('materialVendor').value.trim();
  if (!item || isNaN(cost)) { alert('Enter an item and a cost first.'); return; }
  materials.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), item: item, cost: cost, vendor: vendor, time: new Date().toLocaleString() });
  persistMaterials(); renderMaterials(); renderBudgetSummary();
  document.getElementById('materialItem').value = ''; document.getElementById('materialCost').value = ''; document.getElementById('materialVendor').value = '';
});
document.getElementById('saveBudgetBtn').addEventListener('click', function () {
  budget.labor = parseFloat(document.getElementById('budgetLabor').value) || 0;
  budget.materials = parseFloat(document.getElementById('budgetMaterials').value) || 0;
  persistBudget(); renderBudgetSummary();
});
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
document.getElementById('aiPhotoInput').addEventListener('change', function (e) { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return; const endpoint = currentAiEndpoint(); if (!endpoint) return; setAiStatus('info', 'Checking photo…'); const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, function (src) { const headers = { 'Content-Type': 'application/json' }; const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key; fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify({ image: src, trade: tradeSelect.value }) }).then(function (res) { return res.text().then(function (t) { let data; try { data = JSON.parse(t); } catch (err) { data = { error: t || res.statusText }; } if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status)); return data; }); }).then(function (data) { const text = (data.result || data.text || JSON.stringify(data)).trim(); document.getElementById('aiResult').style.display = 'block'; document.getElementById('aiResult').textContent = text; setAiStatus('ok', 'Check complete.'); if (text) fileEntry({ text: 'AI code-check: ' + text, type: 'punch', trade: tradeSelect.value, verified: true, costEstimate: null, photo: src });}).catch(function (err) { setAiStatus('err', 'AI check failed: ' + (err && err.message ? err.message : 'unknown')); }); }); }; r.readAsDataURL(file); });
window.generateReport = function () {
  const trades = {};
  photos.forEach(function (p) { if (!trades[p.trade]) trades[p.trade] = []; trades[p.trade].push(p); });
  let html = '<div style="text-align:center"><strong>SiteWalk Report</strong><br>' + new Date().toLocaleString() + '</div>';
  Object.keys(trades).forEach(function (t) {
    html += '<div class="report-section"><h3>' + t + '</h3>';
    trades[t].forEach(function (p) {
      html += '<img src="' + p.src + '">';
      html += '<div class="punch-item"><span class="trade-tag">' + escapeHtml(p.trade) + '</span> ' + escapeHtml(p.linkedItemText || '(no description)') + '</div>';
    });
    html += '</div>';
  });
  function sect(title, arr, extra) {
    if (!arr.length) return '';
    let h = '<div class="report-section"><h3>' + title + '</h3>';
    arr.forEach(function (item) { h += '<div class="punch-item">[' + item.trade + '] ' + item.text + (extra ? extra(item) : '') + '</div>'; });
    return h + '</div>';
  }
  html += sect('Punch List', punch, function (i) { return i.resolved ? ' — Resolved' : ''; });
  html += sect('Change Orders', changes, function (i) { return ' — $' + (i.costEstimate != null ? i.costEstimate : '?') + ' (' + (i.approval || 'Pending') + ')'; });
  html += sect('RFIs', rfis, function (i) { return ' — ' + (i.status || 'Open'); });
  if (submittals.length) { html += '<div class="report-section"><h3>Submittals</h3>'; submittals.forEach(function (s) { html += '<div class="punch-item">[' + (s.trade || 'General') + '] ' + s.item + ' — ' + s.status + '</div>'; }); html += '</div>'; }
  if (dailyLogs.length) { html += '<div class="report-section"><h3>Daily Logs</h3>'; dailyLogs.forEach(function (l) { html += '<div class="punch-item">' + l.date + ' — ' + l.weather + ' — Crew: ' + (l.crewCount || 'N/A') + (l.trades ? ' — ' + l.trades : '') + (l.delays ? ' — Delays: ' + l.delays : '') + '</div>'; }); html += '</div>'; }
  if (safetyLogs.length) { html += '<div class="report-section"><h3>Safety Log</h3>'; safetyLogs.forEach(function (s) { html += '<div class="punch-item">[' + s.type + '] ' + s.desc + (s.action ? ' — Action: ' + s.action : '') + '</div>'; }); html += '</div>'; }
  const missedClockOuts = clockEvents.filter(function (e) { return e.flagged; });
  if (missedClockOuts.length) { html += '<div class="report-section"><h3>Missed Clock-Outs</h3>'; missedClockOuts.forEach(function (e) { html += '<div class="punch-item">' + e.employee + ' — ' + e.site + ' (in ' + e.time + ')</div>'; }); html += '</div>'; }
  const laborRows = laborCostByEmployee();
  if (laborRows.length || materials.length) {
    html += '<div class="report-section"><h3>Job Cost Summary</h3>';
    if (laborRows.length) {
      html += '<div class="punch-item"><strong>Labor</strong></div>';
      laborRows.forEach(function (r) { html += '<div class="punch-item">' + escapeHtml(r.name) + ' — ' + r.hours.toFixed(2) + ' hrs @ $' + r.rate.toFixed(2) + '/hr = $' + r.cost.toFixed(2) + '</div>'; });
      html += '<div class="punch-item">Labor Total: $' + totalLaborCost().toFixed(2) + '</div>';
    }
    if (materials.length) {
      html += '<div class="punch-item"><strong>Supplies &amp; Materials</strong></div>';
      materials.forEach(function (m) { html += '<div class="punch-item">' + escapeHtml(m.item) + (m.vendor ? ' (' + escapeHtml(m.vendor) + ')' : '') + ' — $' + m.cost.toFixed(2) + '</div>'; });
      html += '<div class="punch-item">Materials Total: $' + totalMaterialsCost().toFixed(2) + '</div>';
    }
    const combinedBudget = (budget.labor || 0) + (budget.materials || 0), combinedActual = totalLaborCost() + totalMaterialsCost();
    if (combinedBudget > 0) {
      const diff = combinedBudget - combinedActual;
      html += '<div class="punch-item">Budget: $' + combinedBudget.toFixed(2) + ' · Actual: $' + combinedActual.toFixed(2) + ' · ' + (diff >= 0 ? ('$' + diff.toFixed(2) + ' under budget') : ('$' + Math.abs(diff).toFixed(2) + ' over budget')) + '</div>';
    }
    html += '</div>';
  }
  document.getElementById('report').innerHTML = html;
};
document.getElementById('genBtn').addEventListener('click', window.generateReport);
document.getElementById('printBtn').addEventListener('click', function () { window.generateReport(); setTimeout(function () { window.print(); }, 300); });
function clearAllData() {
  if (!confirm('Clear ALL SiteWalk data on this phone?\n\nThis permanently deletes every photo, note, punch item, change order, RFI, submittal, safety log, clock/daily log entry, trade contact, wage rate, material expense, job budget, uploaded drawing, and your AI Worker setup. This can\'t be undone.')) return;
  photos = []; punch = []; changes = []; rfis = []; contacts = {}; submittals = []; clockEvents = []; dailyLogs = []; safetyLogs = []; notesLog = []; wages = {}; materials = []; budget = { labor: 0, materials: 0 }; drawings = [];
  selectedPhotos.clear();
  Object.keys(LS).forEach(function (k) { try { localStorage.removeItem(LS[k]); } catch (e) { } });
  try { localStorage.removeItem('swActiveTab'); } catch (e) { }
  document.getElementById('siteName').textContent = 'Job Site';
  document.getElementById('siteAddress').textContent = 'Tap to add address';
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('report').innerHTML = '';
  renderPhotosTab();
  updateSelectionBar();
  renderAllNotes();
  renderAllItems();
  renderContacts();
  renderSubmittals();
  checkMissedClockOuts();
  renderClockFlagged();
  renderClockLog();
  renderDailyLogs();
  renderSafetyLogs();
  renderDashboard();
  renderLaborCost();
  renderMaterials();
  renderBudgetSummary();
  renderDrawings();
  renderDrawingRefs();
  refreshAiStatus();
  renderSummary();
  setWalkStatus('info', 'Ready. Tap to begin.');
  alert('All SiteWalk data cleared.');
}
document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
window.addEventListener('load', function () {
  photos = loadJson(LS.photos, []); punch = loadJson(LS.punch, []); changes = loadJson(LS.changes, []); rfis = loadJson(LS.rfis, []); contacts = loadJson(LS.contacts, {});
  submittals = loadJson(LS.submittals, []); clockEvents = loadJson(LS.clockEvents, []); dailyLogs = loadJson(LS.dailyLogs, []); safetyLogs = loadJson(LS.safety, []); notesLog = loadJson(LS.notes, []);
  wages = loadJson(LS.wages, {}); materials = loadJson(LS.materials, []); budget = loadJson(LS.budget, { labor: 0, materials: 0 }); drawings = loadJson(LS.drawings, []);
  if (!Array.isArray(photos)) photos = []; if (!Array.isArray(punch)) punch = []; if (!Array.isArray(changes)) changes = []; if (!Array.isArray(rfis)) rfis = [];
  if (!Array.isArray(submittals)) submittals = []; if (!Array.isArray(clockEvents)) clockEvents = []; if (!Array.isArray(dailyLogs)) dailyLogs = []; if (!Array.isArray(safetyLogs)) safetyLogs = []; if (!Array.isArray(notesLog)) notesLog = [];
  if (!wages || typeof wages !== 'object') wages = {}; if (!Array.isArray(materials)) materials = []; if (!budget || typeof budget !== 'object') budget = { labor: 0, materials: 0 }; if (!Array.isArray(drawings)) drawings = [];
  const savedSiteName = loadJson(LS.siteName, null);
  const savedSiteAddress = loadJson(LS.siteAddress, null);
  if (savedSiteName) document.getElementById('siteName').textContent = savedSiteName;
  if (savedSiteAddress) document.getElementById('siteAddress').textContent = savedSiteAddress;
  renderPhotosTab();
  const photoSearchEl = document.getElementById('photoSearch');
  if (photoSearchEl) photoSearchEl.addEventListener('input', renderPhotosTab);
  renderAllNotes();
  renderSummary();
  showWalkTab('main');
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
  renderLaborCost();
  renderMaterials();
  renderBudgetSummary();
  renderDrawings();
  renderDrawingRefs();
  setInterval(function () { renderLaborCost(); renderBudgetSummary(); }, 60000);
  refreshAiStatus();
  if (!voiceRecognitionSupported()) {
    document.getElementById('walkRecordBtn').style.display = 'block';
  }
  document.getElementById('walkStatus').textContent = 'Ready. Tap Start Walk-Around to open the camera and AI listening.';
  let savedTab = 'walk';
  try { savedTab = localStorage.getItem('swActiveTab') || 'walk'; } catch (e) { }
  showTab(savedTab);
});
