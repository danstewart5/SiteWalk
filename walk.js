const TABS = ['home', 'walk', 'punch', 'changes', 'rfis', 'submittals', 'safety', 'clock', 'dailylog', 'jobcost', 'drawingrefs', 'drawings', 'dashboard', 'contacts', 'setup', 'report'];
function showTab(name) {
  if (TABS.indexOf(name) === -1) name = 'home';
  TABS.forEach(function (t) {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  document.querySelectorAll('.top-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  if (name === 'report' && typeof window.generateReport === 'function') window.generateReport();
}
document.querySelectorAll('.top-tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
});

document.querySelectorAll('.home-block-header').forEach(function (btn) {
  btn.addEventListener('click', function () {
    btn.closest('.home-block').classList.toggle('expanded');
  });
});
document.querySelectorAll('.home-chapter-btn[data-tab], .home-admin-btn[data-tab]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const tab = btn.getAttribute('data-tab');
    if (tab) showTab(tab);
  });
});
function openHomeDrilldown(block) {
  document.getElementById('tab-home').classList.add('showing-drilldown');
  document.querySelectorAll('.home-block').forEach(function (el) {
    el.classList.toggle('expanded', block ? el.getAttribute('data-block') === block : false);
  });
}
document.querySelectorAll('.home-pillar').forEach(function (btn) {
  btn.addEventListener('click', function () { openHomeDrilldown(btn.getAttribute('data-block')); });
});
document.getElementById('homeMoreLink').addEventListener('click', function () { openHomeDrilldown(null); });
document.getElementById('homeDrilldownBack').addEventListener('click', function () {
  document.getElementById('tab-home').classList.remove('showing-drilldown');
});
document.getElementById('homeStartWalkBtn').addEventListener('click', function () {
  // Fade the wood-panel scene (background, pillars, framed photo, Generate
  // Report button all live inside .home-scene) out before handing off to the
  // Walk tab, instead of the scene just vanishing under an instant tab swap.
  const scene = document.querySelector('#tab-home .home-scene');
  if (scene) scene.classList.add('home-fade-out');
  setTimeout(function () {
    showTab('walk');
    if (!walkActive) window.startWalk();
    if (scene) scene.classList.remove('home-fade-out');
  }, 320);
});
document.getElementById('homeGenerateReportBtn').addEventListener('click', function () {
  showTab('report');
  window.generateReport();
});

const TRADES = ['General', 'Plumbing', 'Electrical', 'Framing', 'Drywall', 'Roofing', 'Concrete', 'Landscaping', 'Other'];
const LS = { photos: 'swPhotos', punch: 'swPunch', changes: 'swChanges', rfis: 'swRfis', contacts: 'swTradeContacts', aiEndpoint: 'swAiEndpoint', aiKey: 'swAiKey', submittals: 'swSubmittals', clockEvents: 'swClockEvents', dailyLogs: 'swDailyLogs', safety: 'swSafety', notes: 'swWalkNotes', siteName: 'swJobSiteName', siteAddress: 'swJobSiteAddress', wages: 'swWageRates', materials: 'swMaterials', budget: 'swBudget', drawings: 'swDrawings', saveVideo: 'swSaveVideoEnabled', walks: 'swWalks' };
let photos = [], punch = [], changes = [], rfis = [], contacts = {}, submittals = [], clockEvents = [], dailyLogs = [], safetyLogs = [], notesLog = [], wages = {}, materials = [], budget = { labor: 0, materials: 0 }, drawings = [], walks = [], currentWalk = null, selectedWalkId = null;
const TRADE_CLASS = { General: 'tag-general', Plumbing: 'tag-plumbing', Electrical: 'tag-electrical', Framing: 'tag-framing', Drywall: 'tag-drywall', Roofing: 'tag-roofing', Concrete: 'tag-concrete', Landscaping: 'tag-landscaping', Other: 'tag-other' };
const TRADE_DOT = { General: 'dot-general', Plumbing: 'dot-plumbing', Electrical: 'dot-electrical', Framing: 'dot-framing', Drywall: 'dot-drywall', Roofing: 'dot-roofing', Concrete: 'dot-concrete', Landscaping: 'dot-landscaping', Other: 'dot-other' };
const tradeSelect = document.getElementById('tradeSelect');
let walkActive = false, walkStream = null, walkGpsWatch = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, listening = false;

// Continuous video-save is fully optional and independent of the always-on
// camera-preview/mic/listening/snap engine above — it just also records the
// live feed to a file when the crew opts in via the checkbox.
let videoRecorder = null, videoChunks = [], videoAudioStream = null, videoRecordingActive = false;
const SNAP_TRIGGER_RE = /\b(take (?:a |another )?(?:photo|picture|pic|shot)(?:s)?|snap (?:a |another )?(?:photo|picture|pic)|get a (?:photo|picture|shot) of (?:this|that)|photo (?:this|that))\b/i;

// Push-to-talk fallback for phones without SpeechRecognition (notably iOS Safari).
let mediaRecorder = null, mediaChunks = [], mediaStream = null, recordingNote = false;

function loadJson(key, fallback) { try { const raw = localStorage.getItem(key); if (!raw) return fallback; const p = JSON.parse(raw); return p == null ? fallback : p; } catch (e) { return fallback; } }
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { setWalkStatus('err', 'Storage full'); return false; } }
// The report view is cheap to rebuild from the in-memory arrays, so rather
// than track staleness we just regenerate it whenever data that the report
// reads (photos, punch/change/rfi lists) changes while the tab is on screen.
function reportTabActive() { const panel = document.getElementById('tab-report'); return !!panel && panel.classList.contains('active'); }
function refreshReportIfActive() { if (reportTabActive() && typeof window.generateReport === 'function') window.generateReport(); }
function persistLists() { saveJson(LS.punch, punch); saveJson(LS.changes, changes); saveJson(LS.rfis, rfis); refreshReportIfActive(); }
function persistPhotos() { saveJson(LS.photos, photos); refreshReportIfActive(); }
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
function persistWalks() { saveJson(LS.walks, walks); }
// One Date read shared by time/ts/iso so a single captured moment never
// disagrees with itself across the three representations different parts
// of the app already expect (display string, epoch for sorting, ISO for
// the walk log) — each is derived from this one Date, not computed later.
function nowStamp() { const d = new Date(); return { time: d.toLocaleString(), ts: d.getTime(), iso: d.toISOString() }; }
function makeWalkId() { return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
// Mirrors a captured entry into the walk it happened during, so the walk log
// never mixes entries across walks — a no-op if no walk is active (or none
// has ever been started), leaving the caller's own (pre-existing) storage
// untouched either way.
function pushToCurrentWalk(kind, entry) {
  if (!currentWalk) return;
  currentWalk[kind].push(entry);
  persistWalks();
}
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
  card.innerHTML = '<span class="w-note-trade ' + (TRADE_CLASS[entry.trade] || 'tag-general') + '">' + entry.trade + '</span>' + escapeHtml(entry.text) + '<span class="w-note-time">' + entry.time + '</span>' + (entry.iso ? '<span class="w-note-iso">' + escapeHtml(entry.iso) + '</span>' : '');
  wrap.appendChild(card);
}
function renderAllNotes() {
  const wrap = document.getElementById('notesList');
  wrap.innerHTML = '';
  if (!notesLog.length) { wrap.innerHTML = '<div class="w-empty"><span class="big">📝</span>Notes you speak during the walk will show up here.</div>'; return; }
  notesLog.forEach(renderNote);
}
function logNote(text, trade) {
  const stamp = nowStamp();
  const entry = { text: text, trade: trade, time: stamp.time, ts: stamp.ts, iso: stamp.iso };
  notesLog.push(entry); persistNotes();
  pushToCurrentWalk('transcript', entry);
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
  const stamp = nowStamp();
  const entry = { text: data.text, trade: data.trade || tradeSelect.value, time: stamp.time, ts: stamp.ts, iso: stamp.iso, verified: data.verified !== false };
  if (data.photo) entry.photo = data.photo;
  const drawingRef = extractDrawingRef(entry.text);
  if (drawingRef) entry.drawingRef = drawingRef;
  let type = data.type;
  if (type === 'change') { entry.costEstimate = typeof data.costEstimate === 'number' ? data.costEstimate : null; entry.location = data.location || ''; entry.approval = data.approval || 'Pending'; changes.push(entry); }
  else if (type === 'rfi') { entry.status = 'Open'; rfis.push(entry); }
  else { type = 'punch'; entry.resolved = false; entry.costEstimate = typeof data.costEstimate === 'number' ? data.costEstimate : null; entry.location = data.location || ''; punch.push(entry); }
  if (type === 'punch') pushToCurrentWalk('punches', entry);
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
  const stamp = nowStamp();
  const entry = { type: 'Hazard Observed', desc: text, person: '', action: '', photo: null, time: stamp.time, ts: stamp.ts, iso: stamp.iso };
  tryLinkItemToRecentPhoto(entry);
  safetyLogs.push(entry);
  persistSafety();
  pushToCurrentWalk('safety', entry);
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
  if (!endpoint) { const e = fileEntry(localClassify(text, voiceApproval)); const cleaned = summarizeNote(e.text); if (cleaned) logNote(cleaned, e.trade); return; }
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
      const cleaned = summarizeNote(e.text);
      if (cleaned) logNote(cleaned, e.trade);
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      const e = fileEntry(localClassify(text, voiceApproval));
      const cleaned = summarizeNote(e.text);
      if (cleaned) logNote(cleaned, e.trade);
    });
}

function snapFromVideo(video) { if (!video || !video.videoWidth) return null; const max = 1280; const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight)); const c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale); const ctx = c.getContext('2d'); if (!ctx) return null; ctx.drawImage(video, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }
// meta carries structured, timestamped provenance (how the shot was taken and
// the transcript that triggered it, if any) so a still can be matched back
// to both the spoken record and whatever punch/change/RFI item it links to.
function saveWalkPhoto(src, meta) { const item = Object.assign({ src: src, trade: tradeSelect.value, time: new Date().toLocaleString(), ts: Date.now(), source: 'manual' }, meta || {}); photos.push(item); tryLinkPhotoToRecentItem(item); persistPhotos(); renderPhotosTab(); setWalkStatus('ok', 'Photo tagged as ' + item.trade + ' (' + photos.length + ' total)'); return item; }

// Voice-triggered snap runs entirely off the live <video> element and never
// touches `recognition` (no stop/start) — a "take a photo" trigger must not
// interrupt or restart continuous listening.
let lastSnapTriggerAt = 0;
const SNAP_TRIGGER_COOLDOWN_MS = 1500;
function voiceTriggeredSnap(transcriptText) {
  const now = Date.now();
  if (now - lastSnapTriggerAt < SNAP_TRIGGER_COOLDOWN_MS) { console.log('[SiteWalk] snap trigger ignored (cooldown)'); return; }
  lastSnapTriggerAt = now;
  console.log('[SiteWalk] snap trigger matched:', transcriptText);
  if (!walkStream) { console.warn('[SiteWalk] snap trigger fired but camera stream is not live'); setWalkStatus('info', 'Heard "take a photo" but the camera isn\'t live — tap Snap instead.'); return; }
  const video = document.getElementById('walkVideo');
  const src = snapFromVideo(video);
  // A failed grab (video not yet reporting real dimensions) must never look
  // like a successful one — silently returning here previously meant a
  // flashing/pulsing button was the only feedback either way.
  if (!src) { console.warn('[SiteWalk] snap trigger fired but frame grab failed, videoWidth=', video.videoWidth); setWalkStatus('err', 'Heard the photo command, but the camera frame wasn\'t ready — try again.'); return; }
  const item = saveWalkPhoto(src, { source: 'voice', transcriptText: transcriptText });
  console.log('[SiteWalk] voice-triggered photo saved:', item);
  setWalkStatus('ok', 'Photo captured — heard "' + transcriptText + '"');
}
// Strips the trigger phrase out of a finalized utterance. Returns null when
// no trigger is present; otherwise returns whatever text remains (may be
// empty, e.g. the utterance was only "take a photo").
function extractSnapTriggerRemainder(text) {
  const m = text.match(SNAP_TRIGGER_RE);
  if (!m) return null;
  return (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
}

// --- Voice: continuous SpeechRecognition where available ---
function voiceRecognitionSupported() { return !!SpeechRecognition; }
// Web Speech sometimes finalizes a stray breath/mic-noise as its own tiny
// result ("a", "uh", "the"...). This only filters what gets logged/shown as
// heard speech — it never touches the transcript handed to trigger
// detection or item filing below, which must keep seeing the raw text.
const TRANSCRIPT_NOISE_RE = /^(a|an|the|uh|um|er|ah|oh|hm+|mm+|mhm|huh)$/i;
function isNoiseTranscript(text) { return TRANSCRIPT_NOISE_RE.test(text.trim()); }
// Console logging here is deliberate and permanent, not left-over debug
// noise: the live transcript UI is force-hidden (#walkLiveTranscript has a
// display:none !important rule from the tab redesign), so devtools console
// is the only way to confirm recognition actually started and is hearing
// anything — a fully silent transcript looks identical whether recognition
// never started or the mic just heard nothing.
// Android Chrome plays its own start/stop chime on every recognition
// restart. A short silence gap between onend and the next start() suppresses
// it on most devices; restartPending guards against onend firing again
// (or startListening racing in) while that gap is still pending, so two
// restarts never queue on top of each other.
const RECOGNITION_RESTART_DELAY_MS = 250;
function setupRecognition() {
  if (!SpeechRecognition) return null;
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  let restartPending = false;
  rec.onstart = function () { console.log('[SiteWalk] speech recognition started'); };
  rec.onresult = function (event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal) {
        if (transcript) {
          if (!isNoiseTranscript(transcript)) console.log('[SiteWalk] heard:', transcript);
          const remainder = extractSnapTriggerRemainder(transcript);
          if (remainder !== null) { voiceTriggeredSnap(transcript); if (remainder) fileVoiceUtterance(remainder); }
          else fileVoiceUtterance(transcript);
          processVoiceValue(transcript);
        }
      }
      else if (!isNoiseTranscript(transcript)) interim += transcript;
    }
    const walkLive = document.getElementById('walkLiveTranscript');
    if (walkLive) walkLive.textContent = interim ? ('AI hearing: "' + interim + '"') : 'AI listening.';
  };
  rec.onerror = function (err) { console.error('[SiteWalk] speech recognition error:', err.error); setWalkStatus('err', 'Voice error: ' + (err.error || 'unknown')); };
  rec.onend = function () {
    console.log('[SiteWalk] speech recognition ended' + (listening ? ' — restarting' : ''));
    if (!listening || restartPending) return;
    restartPending = true;
    setTimeout(function () {
      restartPending = false;
      if (!listening) return;
      try { rec.start(); } catch (e) { console.error('[SiteWalk] recognition restart failed:', e); }
    }, RECOGNITION_RESTART_DELAY_MS);
  };
  return rec;
}
function startListening() {
  if (!SpeechRecognition) { setWalkStatus('info', 'This browser has no continuous voice recognition — use the mic button instead.'); return; }
  if (listening) return;
  recognition = setupRecognition();
  listening = true;
  try { recognition.start(); }
  catch (e) { console.error('[SiteWalk] recognition.start() failed:', e); listening = false; setWalkStatus('err', 'Voice recognition failed to start: ' + (e && e.message ? e.message : 'unknown')); }
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
        processVoiceValue(text);
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
// --- Optional continuous video-save (independent of camera preview / voice / snap) ---
function videoRecordingRequested() { const el = document.getElementById('saveVideoToggle'); return !!(el && el.checked); }
function pickVideoMimeType() {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  return candidates.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
}
function setVideoStatus(text) { const el = document.getElementById('videoStatusLabel'); if (el) el.textContent = text || ''; }
// Grabs its own mic track rather than reusing SpeechRecognition's (which the
// Web Speech API manages internally and never exposes as a MediaStream), so
// recording audio can start/stop/fail independently of continuous listening.
function startVideoRecording(camStream) {
  console.log('[SiteWalk] video-save requested, camStream tracks:', camStream && camStream.getVideoTracks().length);
  if (!camStream || !window.MediaRecorder) { console.warn('[SiteWalk] video-save unsupported: MediaRecorder=', !!window.MediaRecorder); setVideoStatus('Video save unsupported on this browser.'); return; }
  const mimeType = pickVideoMimeType();
  console.log('[SiteWalk] video-save mimeType picked:', mimeType || '(browser default)');
  navigator.mediaDevices.getUserMedia({ audio: true })
    .catch(function (e) { console.warn('[SiteWalk] video-save: separate mic getUserMedia failed, recording video-only:', e && e.name); return null; })
    .then(function (audioStream) {
      if (!walkActive || !videoRecordingRequested()) { console.log('[SiteWalk] video-save aborted before start (walk ended or box unchecked)'); if (audioStream) audioStream.getTracks().forEach(function (t) { t.stop(); }); return; }
      videoAudioStream = audioStream;
      const tracks = camStream.getVideoTracks().concat(audioStream ? audioStream.getAudioTracks() : []);
      const combined = new MediaStream(tracks);
      try { videoRecorder = mimeType ? new MediaRecorder(combined, { mimeType: mimeType }) : new MediaRecorder(combined); }
      catch (e) { console.error('[SiteWalk] video-save: MediaRecorder constructor failed:', e); setVideoStatus('Video save failed to start: ' + (e && e.message ? e.message : 'unknown')); return; }
      videoChunks = [];
      videoRecorder.onerror = function (e) { console.error('[SiteWalk] video-save: MediaRecorder error:', e && e.error); };
      videoRecorder.ondataavailable = function (e) { console.log('[SiteWalk] video-save chunk:', e.data && e.data.size, 'bytes'); if (e.data && e.data.size > 0) videoChunks.push(e.data); };
      videoRecorder.onstop = function () {
        console.log('[SiteWalk] video-save recorder stopped, chunks:', videoChunks.length);
        if (videoAudioStream) { videoAudioStream.getTracks().forEach(function (t) { t.stop(); }); videoAudioStream = null; }
        const blob = new Blob(videoChunks, { type: videoRecorder.mimeType || mimeType || 'video/webm' });
        console.log('[SiteWalk] video-save blob size:', blob.size, 'type:', blob.type);
        videoChunks = [];
        videoRecordingActive = false;
        // A zero-byte blob (no ondataavailable data ever arrived) previously
        // cleared the status silently, which looked identical to "nothing
        // was recorded because the box was off" — now it says so explicitly.
        if (blob.size > 0) saveVideoFile(blob); else { console.warn('[SiteWalk] video-save produced an empty blob'); setVideoStatus('Video recording produced no data — try a longer walk.'); }
      };
      videoRecorder.start(1000);
      videoRecordingActive = true;
      console.log('[SiteWalk] video-save recorder started');
      setVideoStatus('🔴 Saving video…');
    });
}
function stopVideoRecording() {
  if (videoRecordingActive && videoRecorder) { console.log('[SiteWalk] video-save: stopping recorder, state=', videoRecorder.state); try { videoRecorder.stop(); } catch (e) { console.error('[SiteWalk] video-save: recorder.stop() failed:', e); } }
  videoRecorder = null;
}
// Browsers give no direct "write to disk" API from a Blob; a real save is
// the OS share sheet (works well on iOS/Android) falling back to a download
// link (desktop browsers write straight to Downloads). Both `navigator.share`
// and a synthetic anchor click need "user activation" in some browsers —
// this fires from MediaRecorder's onstop, asynchronously after the Stop
// button's click, so a browser that's strict about that can silently drop
// it. Logging here is so that failure mode is visible instead of invisible.
function saveVideoFile(blob) {
  const ext = (blob.type.indexOf('mp4') !== -1) ? 'mp4' : 'webm';
  const filename = 'sitewalk-video-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
  const file = (typeof File !== 'undefined') ? new File([blob], filename, { type: blob.type }) : null;
  const canShareFiles = !!(file && navigator.canShare && navigator.share && (function () { try { return navigator.canShare({ files: [file] }); } catch (e) { console.warn('[SiteWalk] video-save: canShare threw:', e); return false; } })());
  console.log('[SiteWalk] video-save: attempting', canShareFiles ? 'navigator.share' : 'download link', 'for', filename);
  if (canShareFiles) {
    navigator.share({ files: [file], title: filename })
      .then(function () { console.log('[SiteWalk] video-save: share succeeded'); setVideoStatus('Video saved.'); })
      .catch(function (e) { console.warn('[SiteWalk] video-save: share failed, falling back to download:', e && e.name, e && e.message); downloadVideoBlob(blob, filename); });
    return;
  }
  downloadVideoBlob(blob, filename);
}
function downloadVideoBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    console.log('[SiteWalk] video-save: download link clicked for', filename);
    setVideoStatus('Video saved to Downloads.');
  } catch (e) {
    console.error('[SiteWalk] video-save: download fallback failed:', e);
    setVideoStatus('Video save failed — check the browser console.');
  }
}
function openWalkCamera() { const video = document.getElementById('walkVideo'); video.classList.remove('hidden-cam'); if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { video.classList.add('hidden-cam'); setWalkStatus('info', 'Live camera needs HTTPS. Tap Snap.'); return Promise.resolve(false); } return getWalkStream().then(function (stream) { walkStream = stream; video.setAttribute('playsinline', 'true'); video.setAttribute('webkit-playsinline', 'true'); video.muted = true; video.playsInline = true; video.srcObject = stream; return video.play().then(function () { return true; }).catch(function () { return true; }); }).catch(function () { video.classList.add('hidden-cam'); setWalkStatus('info', 'Live camera unavailable. Tap Snap to take a photo.'); return false; }); }
window.startWalk = function () {
  if (walkActive) return;
  walkActive = true;
  currentWalk = { id: makeWalkId(), startedAt: new Date().toISOString(), endedAt: null, transcript: [], punches: [], costs: [], safety: [] };
  walks.push(currentWalk);
  persistWalks();
  const btn = document.getElementById('walkBtn');
  btn.classList.add('recording');
  btn.innerHTML = '📷<br>Take Photo';
  document.getElementById('stopWalkBtn').classList.add('visible');
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
    if (live && videoRecordingRequested()) startVideoRecording(walkStream);
    if (live) setWalkStatus('ok', 'Walk live — camera + AI listening. Snap photos, or say "take a photo."');
    else if (walkActive) setWalkStatus('ok', 'Walk live. Tap Snap for photos.');
  });
};
window.endWalk = function () {
  walkActive = false;
  if (currentWalk && !currentWalk.endedAt) { currentWalk.endedAt = new Date().toISOString(); persistWalks(); }
  selectedWalkId = null;
  stopVideoRecording();
  stopWalkCamera();
  stopWalkVoice();
  const btn = document.getElementById('walkBtn');
  btn.classList.remove('recording');
  btn.innerHTML = 'Start<br>Walk-Around';
  document.getElementById('stopWalkBtn').classList.remove('visible');
  document.getElementById('walkHero').style.display = '';
  document.getElementById('walkStage').classList.remove('active');
  setWalkStatus('info', 'Walk ended. Generating report…');
  showTab('report');
  window.generateReport();
};
document.getElementById('walkBtn').addEventListener('click', function () { walkActive ? takePhoto() : window.startWalk(); });
document.getElementById('stopWalkBtn').addEventListener('click', function () { window.endWalk(); });
function takePhoto() { const fromLive = walkStream ? snapFromVideo(document.getElementById('walkVideo')) : null; if (fromLive) { saveWalkPhoto(fromLive); return; } document.getElementById('photoInput').click(); }
document.getElementById('shutterBtn').addEventListener('click', takePhoto);
document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedPhotos);
document.getElementById('generateSummaryBtn').addEventListener('click', function () { renderSummary(); showWalkTab('summary'); });
document.getElementById('walkRecordBtn').addEventListener('click', toggleRecordingNote);
document.getElementById('photoInput').addEventListener('change', function (e) { const files = e.target.files; if (!files || !files.length) return; for (let f of files) { const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, saveWalkPhoto); }; r.readAsDataURL(f); } e.target.value = ''; });
document.getElementById('saveVideoToggle').addEventListener('change', function (e) { saveJson(LS.saveVideo, !!e.target.checked); });
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
// A live continuous-speech transcript finalizes the same utterance more than
// once as it revises ("So" → "So snap" → "So, snap a photo of the header") —
// this groups those revisions back into one observation per utterance
// instead of printing every intermediate fragment as its own report line.
const OBSERVATION_GROUP_GAP_MS = 1500;
const OBSERVATION_FILLER_WORD_RE = /^(okay|ok|so|yeah|um|snap|photo|photos)$/i;
function isFillerOnlyLine(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.length > 3) return false;
  return words.every(function (w) { return OBSERVATION_FILLER_WORD_RE.test(w.replace(/^[.,!?]+|[.,!?]+$/g, '')); });
}
// Collapses a walk's raw finalized-speech entries into one distilled
// "observation" per utterance: entries within ~1.5s of each other, or where
// one is a growing prefix of the next, are the same utterance being revised
// — keep the LAST (most complete/most recent) wording, not the longest.
function distillObservations(entries) {
  if (!entries || !entries.length) return [];
  const sorted = entries.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  const groups = [];
  sorted.forEach(function (e) {
    const group = groups[groups.length - 1];
    const prev = group && group[group.length - 1];
    const gap = prev ? (e.ts || 0) - (prev.ts || 0) : Infinity;
    const a = (prev && prev.text || '').toLowerCase(), b = (e.text || '').toLowerCase();
    const growingPrefix = prev && a && b && (b.indexOf(a) === 0 || a.indexOf(b) === 0);
    if (group && (gap <= OBSERVATION_GROUP_GAP_MS || growingPrefix)) group.push(e);
    else groups.push([e]);
  });
  const out = [];
  groups.forEach(function (g) {
    const rep = g[g.length - 1];
    const cleaned = typeof summarizeNote === 'function' ? summarizeNote(rep.text) : rep.text;
    if (!cleaned || isFillerOnlyLine(cleaned)) return;
    out.push({ text: cleaned, ts: rep.ts });
  });
  return out;
}
// Pairs each observation with its nearest photo (within the same 60s window
// used for punch-item/photo linking), nearest-distance-first so a photo
// never gets claimed by two observations and an observation never shows up
// twice under two different photos.
function matchObservationsToPhotos(observations, photoPool) {
  const pairs = [];
  observations.forEach(function (obs, oi) {
    photoPool.forEach(function (p, pi) {
      const dt = Math.abs((obs.ts || 0) - photoTs(p));
      if (dt <= PHOTO_LINK_WINDOW_MS) pairs.push({ oi: oi, pi: pi, dt: dt });
    });
  });
  pairs.sort(function (a, b) { return a.dt - b.dt; });
  const usedObs = {}, usedPhoto = {}, photoByObservation = {};
  pairs.forEach(function (pair) {
    if (usedObs[pair.oi] || usedPhoto[pair.pi]) return;
    usedObs[pair.oi] = true; usedPhoto[pair.pi] = true;
    photoByObservation[pair.oi] = photoPool[pair.pi];
  });
  return photoByObservation;
}
// All distilled observations across every walk (photos aren't walk-scoped,
// so the report's photo gallery needs a caption pool that isn't either).
function allDistilledObservations() {
  const entries = [];
  walks.forEach(function (w) { entries.push.apply(entries, w.transcript || []); });
  return distillObservations(entries.length ? entries : notesLog);
}
function nearestObservationText(observations, ts) {
  let best = null, bestDt = Infinity;
  observations.forEach(function (o) {
    const dt = Math.abs((o.ts || 0) - ts);
    if (dt <= PHOTO_LINK_WINDOW_MS && dt < bestDt) { bestDt = dt; best = o; }
  });
  return best ? best.text : '';
}
// Walk-scoped log section. Defaults to the active walk, or the most
// recently ended one if none is active; the select lets the crew look back
// at an older walk without that becoming the default view. Renders
// distilled "Observations" (one line per utterance, photo-matched where
// possible) instead of the raw per-fragment transcript — the raw log still
// lives in the Notes tab.
function renderWalkLogSection() {
  if (!walks.length) return '';
  const walkToShow = (selectedWalkId && walks.find(function (w) { return w.id === selectedWalkId; })) || currentWalk || walks[walks.length - 1];
  if (!walkToShow) return '';
  let html = '<div class="report-section"><h3>Observations</h3>';
  if (walks.length > 1) {
    html += '<select id="walkLogSelect" class="walk-log-select">';
    walks.slice().reverse().forEach(function (w) {
      const label = new Date(w.startedAt).toLocaleString() + (w.endedAt ? '' : ' (active)');
      html += '<option value="' + w.id + '"' + (w.id === walkToShow.id ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    });
    html += '</select>';
  }
  html += '<div class="punch-item"><strong>Started</strong> ' + escapeHtml(new Date(walkToShow.startedAt).toLocaleString())
    + (walkToShow.endedAt ? (' · <strong>Ended</strong> ' + escapeHtml(new Date(walkToShow.endedAt).toLocaleString())) : ' · <em>in progress</em>') + '</div>';

  const observations = distillObservations(walkToShow.transcript);
  if (observations.length) {
    const photoByObservation = matchObservationsToPhotos(observations, photos);
    observations.forEach(function (obs, i) {
      const photo = photoByObservation[i];
      html += '<div class="observation-card">'
        + (photo ? '<img class="observation-photo" src="' + photo.src + '">' : '')
        + '<div class="observation-text">' + escapeHtml(obs.text) + '</div></div>';
    });
  }

  if (walkToShow.costs.length) {
    const total = walkToShow.costs.reduce(function (s, c) { return s + c.amount; }, 0);
    html += '<div class="punch-item"><strong>Cost Tallies (this walk)</strong> — Total: $' + total.toLocaleString() + '</div>';
    walkToShow.costs.forEach(function (c) { html += '<div class="punch-item">$' + c.amount.toLocaleString() + ' — ' + escapeHtml(c.text) + '</div>'; });
  }
  if (walkToShow.safety.length) {
    html += '<div class="punch-item"><strong>Safety Flags (this walk)</strong></div>';
    walkToShow.safety.forEach(function (s) { html += '<div class="punch-item">' + escapeHtml(s.text) + '</div>'; });
  }
  return html + '</div>';
}
window.generateReport = function () {
  const trades = {};
  photos.forEach(function (p) { if (!trades[p.trade]) trades[p.trade] = []; trades[p.trade].push(p); });
  let html = '<div style="text-align:center"><strong>SiteWalk Report</strong><br>' + new Date().toLocaleString() + '</div>';
  html += renderWalkLogSection();
  const galleryObservations = allDistilledObservations();
  Object.keys(trades).forEach(function (t) {
    html += '<div class="report-section"><h3>' + t + '</h3>';
    trades[t].forEach(function (p) {
      const caption = p.linkedItemText || nearestObservationText(galleryObservations, photoTs(p));
      html += '<img src="' + p.src + '">';
      html += '<div class="punch-item"><span class="trade-tag">' + escapeHtml(p.trade) + '</span> ' + escapeHtml(caption || '(no description)') + '</div>';
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
  const walkSel = document.getElementById('walkLogSelect');
  if (walkSel) walkSel.addEventListener('change', function () { selectedWalkId = walkSel.value; window.generateReport(); });
};
if (document.getElementById('genBtn')) document.getElementById('genBtn').addEventListener('click', window.generateReport);
document.getElementById('printBtn').addEventListener('click', function () { window.generateReport(); setTimeout(function () { window.print(); }, 300); });
function clearAllData() {
  if (!confirm('Clear ALL SiteWalk data on this phone?\n\nThis permanently deletes every photo, note, punch item, change order, RFI, submittal, safety log, clock/daily log entry, trade contact, wage rate, material expense, job budget, uploaded drawing, and your AI Worker setup. This can\'t be undone.')) return;
  photos = []; punch = []; changes = []; rfis = []; contacts = {}; submittals = []; clockEvents = []; dailyLogs = []; safetyLogs = []; notesLog = []; wages = {}; materials = []; budget = { labor: 0, materials: 0 }; drawings = []; walks = []; currentWalk = null; selectedWalkId = null;
  selectedPhotos.clear();
  Object.keys(LS).forEach(function (k) { try { localStorage.removeItem(LS[k]); } catch (e) { } });
  document.getElementById('siteName').textContent = 'Job Site';
  document.getElementById('siteAddress').textContent = 'Tap to add address';
  document.getElementById('saveVideoToggle').checked = false;
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
  wages = loadJson(LS.wages, {}); materials = loadJson(LS.materials, []); budget = loadJson(LS.budget, { labor: 0, materials: 0 }); drawings = loadJson(LS.drawings, []); walks = loadJson(LS.walks, []);
  if (!Array.isArray(photos)) photos = []; if (!Array.isArray(punch)) punch = []; if (!Array.isArray(changes)) changes = []; if (!Array.isArray(rfis)) rfis = [];
  if (!Array.isArray(submittals)) submittals = []; if (!Array.isArray(clockEvents)) clockEvents = []; if (!Array.isArray(dailyLogs)) dailyLogs = []; if (!Array.isArray(safetyLogs)) safetyLogs = []; if (!Array.isArray(notesLog)) notesLog = [];
  if (!wages || typeof wages !== 'object') wages = {}; if (!Array.isArray(materials)) materials = []; if (!budget || typeof budget !== 'object') budget = { labor: 0, materials: 0 }; if (!Array.isArray(drawings)) drawings = [];
  if (!Array.isArray(walks)) walks = [];
  walks.forEach(function (w) { ['transcript', 'punches', 'costs', 'safety'].forEach(function (k) { if (!Array.isArray(w[k])) w[k] = []; }); });
  currentWalk = walks.length ? walks[walks.length - 1] : null;
  const savedSiteName = loadJson(LS.siteName, null);
  const savedSiteAddress = loadJson(LS.siteAddress, null);
  if (savedSiteName) document.getElementById('siteName').textContent = savedSiteName;
  if (savedSiteAddress) document.getElementById('siteAddress').textContent = savedSiteAddress;
  document.getElementById('saveVideoToggle').checked = !!loadJson(LS.saveVideo, false);
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
  showTab('home');
});
