const TABS = ['home', 'jobs', 'invoices', 'walk', 'punch', 'changes', 'rfis', 'submittals', 'safety', 'clock', 'dailylog', 'jobcost', 'drawingrefs', 'drawings', 'dashboard', 'contacts', 'units', 'tenants', 'leases', 'rentroll', 'arrears', 'leasewalk', 'commercial', 'setup', 'report'];
function showTab(name) {
  if (TABS.indexOf(name) === -1) name = 'home';
  document.body.classList.remove('printing-invoice');
  TABS.forEach(function (t) {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === name);
  });
  document.querySelectorAll('.top-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  if (name === 'home' && typeof renderRoleView === 'function') renderRoleView();
  if (name === 'jobs' && typeof renderJobsOverview === 'function') renderJobsOverview();
  if (name === 'invoices' && typeof renderInvoices === 'function') renderInvoices();
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

// Pillar dial: drag anywhere on the ring to turn it (with momentum), or use
// the ◀ ▶ buttons to step one pillar at a time; it always settles with a
// pillar under the top pointer. The held pillar magnifies. A plain tap still
// falls through to the pillar's click → drilldown; a drag swallows that
// click. No pointer capture — it would retarget the click off the pillar.
(function () {
  const ring = document.querySelector('.home-pillars');
  if (!ring) return;
  const STEP = 360 / 7;
  let spin = 0, drag = null, velocity = 0, raf = 0, suppressClick = false;
  function setSpin(deg) { spin = deg; ring.style.setProperty('--spin', spin + 'deg'); }
  function stopAnim() { cancelAnimationFrame(raf); raf = 0; }
  function angleAt(e) {
    const r = ring.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }
  function animateTo(target) {
    stopAnim();
    const from = spin, start = performance.now(), dur = 320;
    (function tick(now) {
      const t = Math.min(1, (now - start) / dur), ease = 1 - Math.pow(1 - t, 3);
      setSpin(from + (target - from) * ease);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { raf = 0; setSpin(((target % 360) + 360) % 360); }
    })(start);
  }
  function snap() { animateTo(Math.round(spin / STEP) * STEP); }
  function coast() {
    velocity *= 0.93;
    if (Math.abs(velocity) < 0.4) { snap(); return; }
    setSpin(spin + velocity);
    raf = requestAnimationFrame(coast);
  }
  function step(dir) { animateTo((Math.round(spin / STEP) + dir) * STEP); }
  document.getElementById('homeDialLeft').addEventListener('click', function () { step(-1); });
  document.getElementById('homeDialRight').addEventListener('click', function () { step(1); });

  ring.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    stopAnim(); velocity = 0; suppressClick = false;
    const pillar = e.target.closest('.home-pillar');
    if (pillar) pillar.classList.add('pressed');
    drag = { pillar: pillar, lastAngle: angleAt(e), lastTime: e.timeStamp, x: e.clientX, y: e.clientY, moved: false };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
      drag.moved = true;
      ring.classList.add('spinning');
    }
    if (!drag.moved) return;
    const a = angleAt(e);
    let d = a - drag.lastAngle;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    const dt = Math.max(1, e.timeStamp - drag.lastTime);
    velocity = d / dt * 16; // degrees per ~frame
    drag.lastAngle = a; drag.lastTime = e.timeStamp;
    setSpin(spin + d);
  }
  function onUp(e) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (!drag) return;
    if (drag.pillar) drag.pillar.classList.remove('pressed');
    ring.classList.remove('spinning');
    if (drag.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 400);
      if (e.timeStamp - drag.lastTime > 80) velocity = 0; // finger stopped before lifting
      velocity = Math.max(-12, Math.min(12, velocity));
      if (Math.abs(velocity) >= 0.4) raf = requestAnimationFrame(coast); else snap();
    }
    drag = null;
  }
  ring.addEventListener('click', function (e) {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);
})();
document.getElementById('homeDrilldownBack').addEventListener('click', function () {
  document.getElementById('tab-home').classList.remove('showing-drilldown');
});
document.getElementById('homeStartWalkBtn').addEventListener('click', function () {
  const dial = currentDial();
  if (dial) { runHomeAction(dial.center); return; }
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
  runHomeAction(currentDial() ? currentDial().report : DEFAULT_REPORT);
});

// Build / Hold mode toggle — organizes which seven chapters the pillars and
// drilldown blocks expose (CSS keys off data-home-mode); the flag bar and
// the two quick-action buttons above are deliberately outside this switch.
function setHomeMode(mode) {
  if (mode !== 'hold') mode = 'build';
  document.getElementById('tab-home').setAttribute('data-home-mode', mode);
  document.querySelectorAll('.home-mode-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-mode') === mode); });
  saveJson(LS.homeMode, mode);
  document.getElementById('tab-home').classList.remove('showing-drilldown');
  if (typeof renderRoleDial === 'function') renderRoleDial();
}
document.querySelectorAll('.home-mode-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { setHomeMode(btn.getAttribute('data-mode')); });
});

const TRADES = ['General', 'Plumbing', 'Electrical', 'Framing', 'Drywall', 'Roofing', 'Concrete', 'Landscaping', 'Other'];
const LS = { photos: 'swPhotos', punch: 'swPunch', changes: 'swChanges', rfis: 'swRfis', contacts: 'swTradeContacts', aiEndpoint: 'swAiEndpoint', aiKey: 'swAiKey', submittals: 'swSubmittals', clockEvents: 'swClockEvents', dailyLogs: 'swDailyLogs', safety: 'swSafety', notes: 'swWalkNotes', siteName: 'swJobSiteName', siteAddress: 'swJobSiteAddress', wages: 'swWageRates', materials: 'swMaterials', budget: 'swBudget', drawings: 'swDrawings', saveVideo: 'swSaveVideoEnabled', walks: 'swWalks', homeMode: 'swHomeMode', role: 'swRole', properties: 'swProperties', units: 'swUnits', tenants: 'swTenants', leases: 'swLeases', payments: 'swPayments', subContracts: 'swSubContracts', geoSites: 'swGeoSites', autoClock: 'swAutoClock', invoices: 'swInvoices', business: 'swBusiness', invoiceSeq: 'swInvoiceSeq', review: 'swReview', photoTag: 'swPhotoTagEnabled', photoTagStats: 'swPhotoTagStats' };
// Jobs. Each job keeps its own copy of the job-scoped keys, stored as
// key + '@' + jobId. The original job ('default') keeps the plain keys, so
// upgrading copies nothing (photos can be most of the storage quota). The LS
// entries are rewritten here, before anything loads, so every existing
// persist/load call reads and writes the current job without knowing jobs
// exist. Switching jobs saves the choice and reloads the page. Trade
// contacts, wage rates, AI setup, role/mode, auto-clock and all LeaseFlow
// data stay shared across jobs.
const JOB_SCOPED = ['photos', 'punch', 'changes', 'rfis', 'submittals', 'clockEvents', 'dailyLogs', 'safety', 'notes', 'siteName', 'siteAddress', 'materials', 'budget', 'drawings', 'walks', 'subContracts', 'geoSites', 'invoices', 'review'];
const LS_BASE = Object.assign({}, LS);
LS.jobs = 'swJobs'; LS.currentJob = 'swCurrentJob';
function jobKey(base, jobId) { return jobId === 'default' ? base : base + '@' + jobId; }
let jobs = loadJson(LS.jobs, null);
if (!Array.isArray(jobs) || !jobs.length) {
  jobs = [{ id: 'default', name: loadJson(LS.siteName, null) || 'Job 1', address: loadJson(LS.siteAddress, null) || '', created: new Date().toISOString() }];
  saveJson(LS.jobs, jobs);
}
let currentJobId = loadJson(LS.currentJob, jobs[0].id);
if (!jobs.some(function (j) { return j.id === currentJobId; })) currentJobId = jobs[0].id;
JOB_SCOPED.forEach(function (k) { LS[k] = jobKey(LS_BASE[k], currentJobId); });
function currentJob() { return jobs.find(function (j) { return j.id === currentJobId; }); }
function persistJobs() { saveJson(LS.jobs, jobs); }
// True for any localStorage key this app owns, including other jobs' copies.
function isAppKey(key) {
  return Object.keys(LS_BASE).some(function (k) { return key === LS_BASE[k]; }) || key === LS.jobs || key === LS.currentJob
    || JOB_SCOPED.some(function (k) { return key.indexOf(LS_BASE[k] + '@') === 0; });
}
let photos = [], punch = [], changes = [], rfis = [], contacts = {}, submittals = [], clockEvents = [], dailyLogs = [], safetyLogs = [], notesLog = [], wages = {}, materials = [], budget = { labor: 0, materials: 0 }, drawings = [], walks = [], currentWalk = null, selectedWalkId = null;
// Borderline spoken sentences the classifier wasn't sure about. They stay
// out of the punch/CO/RFI lists until someone files or dismisses them.
let reviewItems = [];
// Flat-contract subs (labor cost) and GPS job-site geofences (auto clock).
let subContracts = [], geoSites = [], autoClock = { enabled: false, employee: '' };
// LeaseFlow (Hold mode) data — Property is root, Unit belongs to a Property,
// Tenant is its own record linked to a Unit only through a Lease, Payment is
// a ledger line against a Lease. leaseWalkContext (below, near startWalk) is
// the only thing that ties a lease walk-through back into the shared
// punch/change-order schema.
let properties = [], units = [], tenants = [], leases = [], payments = [];
let leaseWalkContext = null;
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
function persistLists() { saveJson(LS.punch, punch); saveJson(LS.changes, changes); saveJson(LS.rfis, rfis); }
function persistPhotos() { saveJson(LS.photos, photos); }
function persistContacts() { saveJson(LS.contacts, contacts); }
function persistSubmittals() { saveJson(LS.submittals, submittals); }
function persistClock() { saveJson(LS.clockEvents, clockEvents); }
function persistDailyLogs() { saveJson(LS.dailyLogs, dailyLogs); }
function persistSafety() { saveJson(LS.safety, safetyLogs); }
function persistNotes() { saveJson(LS.notes, notesLog); }
function persistReview() { saveJson(LS.review, reviewItems); }
function persistWages() { saveJson(LS.wages, wages); }
function persistMaterials() { saveJson(LS.materials, materials); }
function persistBudget() { saveJson(LS.budget, budget); }
function persistDrawings() { saveJson(LS.drawings, drawings); }
function persistWalks() { saveJson(LS.walks, walks); }
function persistProperties() { saveJson(LS.properties, properties); }
function persistUnits() { saveJson(LS.units, units); }
function persistTenants() { saveJson(LS.tenants, tenants); }
function persistLeases() { saveJson(LS.leases, leases); }
function persistPayments() { saveJson(LS.payments, payments); }
function persistSubContracts() { saveJson(LS.subContracts, subContracts); }
function persistGeoSites() { saveJson(LS.geoSites, geoSites); }
function persistAutoClock() { saveJson(LS.autoClock, autoClock); }
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
// An item can hold several photos. `photos` is the list; `photo` stays as
// the first one so older code and older saved data keep working.
function itemPhotos(e) { return (e && e.photos && e.photos.length) ? e.photos : (e && e.photo ? [e.photo] : []); }
function addPhotoToItem(e, src) {
  if (!src) return;
  const list = itemPhotos(e).slice();
  if (list.indexOf(src) === -1) list.push(src);
  e.photos = list; e.photo = list[0];
}
function itemDesc(e) { return e.text || e.desc || ''; }
// Safety & quality entries take photos too.
function linkableItems() { return punch.concat(changes, rfis, reviewItems, safetyLogs.filter(function (s) { return s.ts; })); }
function persistLinkable() { persistLists(); persistSafety(); persistReview(); }
// A photo goes to the most recent item filed in the last minute, even one
// that already has photos, so several shots of one issue stay together.
function tryLinkPhotoToRecentItem(photo) {
  const candidates = linkableItems().filter(function (e) {
    const dt = photo.ts - (e.ts || 0);
    return dt >= 0 && dt <= PHOTO_LINK_WINDOW_MS;
  }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  if (!candidates.length) return false;
  addPhotoToItem(candidates[0], photo.src);
  photo.linkedItemText = itemDesc(candidates[0]);
  photo.linkedItemTs = candidates[0].ts;
  if (photo.tag) applyPhotoTagToItem(photo, candidates[0]);
  gatePhotoTag(photo);
  persistLinkable(); persistPhotos(); renderAllItems(); renderSafetyLogs(); renderReview();
  return true;
}
// Photos snapped just before an item is spoken, and not yet linked, all go
// to that item.
function tryLinkItemToRecentPhoto(entry) {
  const candidates = photos.filter(function (p) {
    const dt = entry.ts - (p.ts || 0);
    return !p.linkedItemText && dt >= 0 && dt <= PHOTO_LINK_WINDOW_MS && (!p.holdForId || p.holdForId === entry.transcriptId);
  }).sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  if (!candidates.length) return false;
  candidates.forEach(function (p) { addPhotoToItem(entry, p.src); p.linkedItemText = itemDesc(entry); p.linkedItemTs = entry.ts; if (p.tag) applyPhotoTagToItem(p, entry); gatePhotoTag(p); });
  persistPhotos();
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
  renderPhotoTagQueue();
  renderAllItems();
  renderSummary();
  updateSelectionBar();
}

function buildPhotoThumb(item) {
  const thumb = document.createElement('div');
  thumb.className = 'w-photo-thumb';
  thumb.innerHTML = '<img src="' + item.src + '"><span class="w-thumb-trade">' + item.trade + '</span>'
    + (item.linkedItemText ? '<span class="w-thumb-linked" title="Linked to a punch list item">🔗</span>' : '')
    + (item.suggestion && item.suggestion.status === 'suggested' ? '<span class="w-thumb-tag" title="Photo tag suggestion waiting">🤖?</span>' : (item.tag && item.tag.kind !== 'trade' ? '<span class="w-thumb-tag" title="' + PHOTO_KIND_LABEL[item.tag.kind] + '">⚠️</span>' : ''))
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
// One photo shows at card size; several show as a row of small thumbs.
function photoRowEl(list) {
  if (!list || !list.length) return null;
  const row = document.createElement('div');
  row.className = 'item-photo-row' + (list.length > 1 ? ' multi' : '');
  list.forEach(function (src) {
    const img = document.createElement('img');
    img.src = src; img.alt = 'Item photo';
    img.addEventListener('click', function () { openLightbox(src); });
    row.appendChild(img);
  });
  return row;
}
function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('open'); }

/* ---------- Notes tab (spoken transcript log) ---------- */
function renderNote(entry) {
  const wrap = document.getElementById('notesList');
  const card = document.createElement('div');
  card.className = 'w-note-entry';
  card.innerHTML = '<span class="w-note-trade ' + (TRADE_CLASS[entry.trade] || 'tag-general') + '">' + escapeHtml(entry.trade) + '</span>'
    + (entry.outcome ? '<span class="w-note-outcome outcome-' + entry.outcome + '">' + (OUTCOME_LABEL[entry.outcome] || entry.outcome) + '</span>' : '') + escapeHtml(entry.text) + '<span class="w-note-time">' + entry.time + '</span>' + (entry.iso ? '<span class="w-note-iso">' + escapeHtml(entry.iso) + '</span>' : '');
  wrap.appendChild(card);
}
function renderAllNotes() {
  const wrap = document.getElementById('notesList');
  wrap.innerHTML = '';
  if (!notesLog.length) { wrap.innerHTML = '<div class="w-empty"><span class="big">📝</span>Everything said during the walk is kept here word for word, tagged with what became of it.</div>'; return; }
  notesLog.forEach(renderNote);
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
    items.slice().sort(byUrgency).forEach(function (e) {
      const typeLabel = e.status !== undefined ? 'RFI' : (e.approval !== undefined ? 'Change Order' : 'Punch Item');
      let extra;
      if (e.status !== undefined) extra = e.status;
      else if (e.approval !== undefined) extra = (e.costEstimate != null ? ('$' + e.costEstimate + ' — ') : '') + e.approval;
      else extra = e.resolved ? 'Resolved' : 'Open';
      html += '<div class="w-summary-item">' + severityTagHtml(itemSeverity(e)) + ' ' + escapeHtml(e.text) + '<div class="meta">' + typeLabel + ' · ' + extra + '</div></div>';
    });
    html += '</div>';
  });
  content.innerHTML = html;
}

/* ---------- Inner Walk-tab sub-navigation (Main / Summary / Notes / Photos) ---------- */
const WALK_TABS = ['main', 'summary', 'review', 'notes', 'photos'];
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
  if (name === 'review') renderReview();
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
  const photoRow = photoRowEl(itemPhotos(entry));
  if (photoRow) card.appendChild(photoRow);
  const meta = document.createElement('div');
  meta.className = 'meta';
  let metaHtml = severityTagHtml(itemSeverity(entry)) + '<span class="trade-tag">' + entry.trade + '</span><span class="type-tag ' + tagClass + '">' + tagLabel + '</span>';
  if (entry.photoFlag) metaHtml += '<span class="type-tag unverified">📷 ' + (entry.photoFlag === 'quality' ? 'Quality' : 'Safety') + '</span>';
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
  card.appendChild(severityButton(entry, function () { persistLists(); renderAllItems(); renderSummary(); }));

  if (photos.length && itemPhotos(entry).indexOf(photos[photos.length - 1].src) === -1) {
    const attachBtn = document.createElement('button');
    attachBtn.className = 'small gray'; attachBtn.type = 'button'; attachBtn.textContent = 'Attach Last Photo';
    attachBtn.onclick = function () { const p = photos[photos.length - 1]; addPhotoToItem(entry, p.src); p.linkedItemText = entry.text; p.linkedItemTs = entry.ts; persistLists(); persistPhotos(); renderAllItems(); };
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

// Clock events carry a display string (time) and, since GPS clock-in, an
// epoch (ts). Older events only have the string, so fall back to parsing it.
function clockMs(e) { return e.ts || new Date(e.time).getTime(); }
function checkMissedClockOuts() {
  const MAX_MS = 16 * 60 * 60 * 1000;
  const byEmployee = {};
  clockEvents.forEach(function (e) { (byEmployee[e.employee] = byEmployee[e.employee] || []).push(e); });
  Object.keys(byEmployee).forEach(function (name) {
    const events = byEmployee[name].slice().sort(function (a, b) { return clockMs(a) - clockMs(b); });
    events.forEach(function (e, i) {
      if (e.type !== 'in') return;
      const hasOut = events.slice(i + 1).some(function (o) { return o.type === 'out'; });
      e.flagged = !hasOut && (Date.now() - clockMs(e)) > MAX_MS;
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
    let where = '';
    if (e.gps && e.gps.distM != null) where = e.gps.onSite ? ' · 📍 on site' : ' · 📍 ' + e.gps.distM + ' m from ' + escapeHtml(e.gps.site);
    card.innerHTML = '<span class="type-tag ' + (e.type === 'in' ? 'change' : 'punch') + '">' + e.type.toUpperCase() + '</span> ' + escapeHtml(e.employee) + ' — ' + escapeHtml(e.site)
      + (e.method === 'gps' ? ' <span class="type-tag rfi">GPS auto</span>' : '')
      + '<div class="meta">' + e.time + where + (e.review ? ' · ⚠️ app was closed ' + e.gapMin + ' min — check this time' : '') + '</div>';
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
    let html = severityTagHtml(itemSeverity(s)) + ' <strong>' + escapeHtml(s.type) + '</strong><div>' + escapeHtml(itemDesc(s)) + '</div>';
    if (s.trade || s.location || s.drawingRef) html += '<div class="meta">' + [s.trade, s.location ? 'Location: ' + s.location : '', s.drawingRef ? 'Sheet ' + s.drawingRef : ''].filter(Boolean).map(escapeHtml).join(' · ') + '</div>';
    if (s.person) html += '<div class="meta">Involved: ' + escapeHtml(s.person) + '</div>';
    if (s.action) html += '<div class="meta">Action taken: ' + escapeHtml(s.action) + '</div>';
    html += '<div class="meta">' + s.time + '</div>';
    card.innerHTML = html;
    const row = photoRowEl(itemPhotos(s));
    if (row) card.appendChild(row);
    card.appendChild(severityButton(s, function () { persistSafety(); renderSafetyLogs(); }));
    wrap.appendChild(card);
  });
}

/* ---------- LeaseFlow (Hold mode): Units & Properties, Tenants, Leases, Rent & Payments, Arrears ---------- */
function makeId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

function renderProperties() {
  const jobLabel = document.getElementById('propJobSiteLabel');
  if (jobLabel) jobLabel.textContent = document.getElementById('siteName').textContent.trim() || 'Job Site';
  const select = document.getElementById('unitPropertySelect');
  if (select) {
    const prev = select.value;
    select.innerHTML = properties.length ? properties.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>'; }).join('') : '<option value="">Add a property first</option>';
    if (properties.some(function (p) { return p.id === prev; })) select.value = prev;
  }
  const wrap = document.getElementById('propertyList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!properties.length) { wrap.innerHTML = '<p class="hint">No properties yet.</p>'; return; }
  properties.slice().reverse().forEach(function (p) {
    const unitCount = units.filter(function (u) { return u.propertyId === p.id; }).length;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<strong>' + escapeHtml(p.name) + '</strong>' + (p.address ? '<div class="meta">' + escapeHtml(p.address) + '</div>' : '')
      + (p.jobLinked ? '<span class="type-tag change">From job: ' + escapeHtml(p.jobSiteName || 'Job Site') + '</span>' : '<span class="type-tag rfi">Acquired</span>')
      + '<div class="meta">' + unitCount + ' unit' + (unitCount === 1 ? '' : 's') + '</div>';
    const delBtn = document.createElement('button');
    delBtn.className = 'small gray'; delBtn.type = 'button'; delBtn.textContent = 'Remove';
    delBtn.onclick = function () {
      if (!confirm('Remove ' + p.name + ' and its units? Leases/payments on those units are kept but orphaned.')) return;
      properties = properties.filter(function (x) { return x.id !== p.id; });
      units = units.filter(function (u) { return u.propertyId !== p.id; });
      persistProperties(); persistUnits(); renderProperties(); renderUnits(); renderLeases(); renderRentRoll(); renderArrears(); renderFlagBar();
    };
    card.appendChild(delBtn);
    wrap.appendChild(card);
  });
}

function populateUnitSelects() {
  const opts = units.length ? units.map(function (u) {
    const property = properties.find(function (p) { return p.id === u.propertyId; });
    return '<option value="' + u.id + '">' + escapeHtml((property ? property.name + ' — ' : '') + u.label) + '</option>';
  }).join('') : '<option value="">Add a unit first</option>';
  ['leaseUnitSelect', 'leaseWalkUnitSelect'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = opts;
    if (units.some(function (u) { return u.id === prev; })) el.value = prev;
  });
}
function renderUnits() {
  populateUnitSelects();
  const wrap = document.getElementById('unitList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!units.length) { wrap.innerHTML = '<p class="hint">No units yet.</p>'; return; }
  units.slice().reverse().forEach(function (u) {
    const property = properties.find(function (p) { return p.id === u.propertyId; });
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<strong>' + escapeHtml(u.label) + '</strong><div class="meta">' + escapeHtml(property ? property.name : 'Unknown property') + (u.notes ? ' · ' + escapeHtml(u.notes) : '') + '</div>';
    const delBtn = document.createElement('button');
    delBtn.className = 'small gray'; delBtn.type = 'button'; delBtn.textContent = 'Remove';
    delBtn.onclick = function () {
      if (!confirm('Remove unit ' + u.label + '? Leases on it are kept but orphaned.')) return;
      units = units.filter(function (x) { return x.id !== u.id; });
      persistUnits(); renderUnits(); renderProperties(); renderLeases(); renderRentRoll(); renderArrears(); renderFlagBar();
    };
    card.appendChild(delBtn);
    wrap.appendChild(card);
  });
}

function renderTenants() {
  const select = document.getElementById('leaseTenantSelect');
  if (select) {
    const prev = select.value;
    select.innerHTML = tenants.length ? tenants.map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>'; }).join('') : '<option value="">Add a tenant first</option>';
    if (tenants.some(function (t) { return t.id === prev; })) select.value = prev;
  }
  const wrap = document.getElementById('tenantList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!tenants.length) { wrap.innerHTML = '<p class="hint">No tenants yet.</p>'; return; }
  tenants.slice().reverse().forEach(function (t) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<strong>' + escapeHtml(t.name) + '</strong><div class="meta">' + (t.email ? escapeHtml(t.email) : '') + (t.email && t.phone ? ' · ' : '') + (t.phone ? escapeHtml(t.phone) : '') + '</div>';
    const delBtn = document.createElement('button');
    delBtn.className = 'small gray'; delBtn.type = 'button'; delBtn.textContent = 'Remove';
    delBtn.onclick = function () {
      if (!confirm('Remove tenant ' + t.name + '? Leases referencing them are kept but orphaned.')) return;
      tenants = tenants.filter(function (x) { return x.id !== t.id; });
      persistTenants(); renderTenants(); renderLeases(); renderRentRoll(); renderArrears(); renderFlagBar();
    };
    card.appendChild(delBtn);
    wrap.appendChild(card);
  });
}

function leaseLabel(l) {
  const unit = units.find(function (u) { return u.id === l.unitId; });
  const property = unit ? properties.find(function (p) { return p.id === unit.propertyId; }) : null;
  const tenant = tenants.find(function (t) { return t.id === l.tenantId; });
  return (tenant ? tenant.name : 'Unknown tenant') + ' — ' + (property ? property.name + ' ' : '') + (unit ? unit.label : 'Unknown unit');
}
function renderLeases() {
  const select = document.getElementById('paymentLeaseSelect');
  if (select) {
    const prev = select.value;
    select.innerHTML = leases.length ? leases.map(function (l) { return '<option value="' + l.id + '">' + escapeHtml(leaseLabel(l)) + '</option>'; }).join('') : '<option value="">Add a lease first</option>';
    if (leases.some(function (l) { return l.id === prev; })) select.value = prev;
  }
  const wrap = document.getElementById('leaseList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!leases.length) { wrap.innerHTML = '<p class="hint">No leases yet.</p>'; return; }
  leases.slice().reverse().forEach(function (l) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<strong>' + escapeHtml(leaseLabel(l)) + '</strong>'
      + '<span class="type-tag ' + (l.leaseType === 'Commercial' ? 'change' : 'punch') + '">' + escapeHtml(l.leaseType || 'Residential') + '</span>'
      + '<div class="meta">$' + (l.rentAmount || 0).toFixed(2) + '/mo · ' + escapeHtml(l.startDate || '?') + ' – ' + escapeHtml(l.endDate || '?') + (l.renewalDate ? ' · Renews ' + escapeHtml(l.renewalDate) : '') + '</div>';
    const delBtn = document.createElement('button');
    delBtn.className = 'small gray'; delBtn.type = 'button'; delBtn.textContent = 'Remove';
    delBtn.onclick = function () {
      if (!confirm('Remove this lease? Its payment history is kept but orphaned.')) return;
      leases = leases.filter(function (x) { return x.id !== l.id; });
      persistLeases(); renderLeases(); renderRentRoll(); renderArrears(); renderFlagBar();
    };
    card.appendChild(delBtn);
    wrap.appendChild(card);
  });
}

// Rent roll model: each lease owes one month's rent per elapsed month since
// its start date (the day-of-month of startDate is the recurring due day);
// balance is what's due to date minus what's been logged in Payments. This
// is deliberately a simple accrual, not a real amortization/proration engine
// — good enough for the flag bar and a bookkeeper's rent roll, not a
// full accounting product (see Commercial Extras, not built this pass).
function monthsElapsed(startDateStr, now) {
  const start = new Date(startDateStr);
  if (isNaN(start.getTime()) || start > now) return 0;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months + 1);
}
function computeRentRoll() {
  return leases.map(function (l) {
    const unit = units.find(function (u) { return u.id === l.unitId; });
    const property = unit ? properties.find(function (p) { return p.id === unit.propertyId; }) : null;
    const tenant = tenants.find(function (t) { return t.id === l.tenantId; });
    const leasePayments = payments.filter(function (p) { return p.leaseId === l.id; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    const totalPaid = leasePayments.reduce(function (s, p) { return s + (p.amount || 0); }, 0);
    const totalDue = monthsElapsed(l.startDate, new Date()) * (l.rentAmount || 0);
    return { lease: l, unit: unit, property: property, tenant: tenant, totalDue: totalDue, totalPaid: totalPaid, balance: totalDue - totalPaid, lastPayment: leasePayments.length ? leasePayments[leasePayments.length - 1] : null };
  });
}
function renderRentRoll() {
  const wrap = document.getElementById('rentRollList');
  if (!wrap) return;
  const rows = computeRentRoll();
  if (!rows.length) { wrap.innerHTML = '<p class="hint">Add a lease to see it on the rent roll.</p>'; return; }
  let html = '';
  rows.forEach(function (r) {
    const statusClass = r.balance > 0.005 ? 'over' : 'under';
    const statusText = r.balance > 0.005 ? ('$' + r.balance.toFixed(2) + ' past due') : (r.balance < -0.005 ? ('$' + Math.abs(r.balance).toFixed(2) + ' credit') : 'Paid up');
    html += '<div class="item-card"><strong>' + escapeHtml(leaseLabel(r.lease)) + '</strong>'
      + '<div class="meta">Rent: $' + (r.lease.rentAmount || 0).toFixed(2) + '/mo · Due to date: $' + r.totalDue.toFixed(2) + ' · Paid: $' + r.totalPaid.toFixed(2) + '</div>'
      + (r.lastPayment ? '<div class="meta">Last payment: ' + escapeHtml(r.lastPayment.date) + ' — $' + r.lastPayment.amount.toFixed(2) + '</div>' : '')
      + '<div class="status ' + statusClass + '" style="margin-top:6px">' + statusText + '</div></div>';
  });
  wrap.innerHTML = html;
}
function csvField(val) { const s = val == null ? '' : String(val); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportRentRollCsv() {
  const rows = computeRentRoll();
  if (!rows.length) { alert('No leases to export yet.'); return; }
  const header = ['Property', 'Unit', 'Tenant', 'Lease Type', 'Rent Amount', 'Total Due', 'Total Paid', 'Balance', 'Last Payment Date', 'Renewal Date'];
  const lines = [header.map(csvField).join(',')];
  rows.forEach(function (r) {
    lines.push([
      r.property ? r.property.name : '', r.unit ? r.unit.label : '', r.tenant ? r.tenant.name : '', r.lease.leaseType || 'Residential',
      (r.lease.rentAmount || 0).toFixed(2), r.totalDue.toFixed(2), r.totalPaid.toFixed(2), r.balance.toFixed(2),
      r.lastPayment ? r.lastPayment.date : '', r.lease.renewalDate || ''
    ].map(csvField).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sitewalk-rent-roll-' + new Date().toISOString().slice(0, 10) + '.csv'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

// Arrears is a computed, read-only view — no collections workflow, no
// notice-period/RTB handling. Also the source for the shared flag bar's red
// "in arrears" count, alongside a yellow "renewal due soon" count.
function computeLeaseFlags() {
  const rentRoll = computeRentRoll();
  const arrears = rentRoll.filter(function (r) { return r.balance > 0.005; });
  const now = new Date();
  const renewalsSoon = leases.filter(function (l) {
    if (!l.renewalDate) return false;
    const days = (new Date(l.renewalDate) - now) / 86400000;
    return days >= 0 && days <= 60;
  });
  return { arrears: arrears, renewalsSoon: renewalsSoon };
}
function renderArrears() {
  const wrap = document.getElementById('arrearsList');
  if (!wrap) return;
  const rows = computeLeaseFlags().arrears.sort(function (a, b) { return b.balance - a.balance; });
  if (!rows.length) { wrap.innerHTML = '<p class="hint">No units in arrears.</p>'; return; }
  let html = '';
  rows.forEach(function (r) {
    html += '<div class="item-card"><span class="type-tag unverified">$' + r.balance.toFixed(2) + ' past due</span> <strong>' + escapeHtml(leaseLabel(r.lease)) + '</strong>'
      + '<div class="meta">Rent: $' + (r.lease.rentAmount || 0).toFixed(2) + '/mo · Paid to date: $' + r.totalPaid.toFixed(2) + ' of $' + r.totalDue.toFixed(2) + '</div></div>';
  });
  wrap.innerHTML = html;
}

// Shared flag bar — spans both Build and Hold mode (never scoped to
// whichever mode is currently active); a punch flag from Build mode and a
// rent/renewal flag from Hold mode sit in the same bar.
function renderFlagBar() {
  const wrap = document.getElementById('homeFlagBar');
  if (!wrap) return;
  const openPunch = punch.filter(function (p) { return !p.resolved; }).length;
  const missedClockOuts = clockEvents.filter(function (e) { return e.flagged; }).length;
  const flags = computeLeaseFlags();
  const pills = [];
  if (openPunch) pills.push({ cls: 'red', text: openPunch + ' Open Punch Item' + (openPunch === 1 ? '' : 's') });
  if (missedClockOuts) pills.push({ cls: 'red', text: missedClockOuts + ' Missed Clock-Out' + (missedClockOuts === 1 ? '' : 's') });
  const overdueInv = invoiceOutstanding(invoices).overdue;
  if (overdueInv) pills.push({ cls: 'red', text: overdueInv + ' Overdue Invoice' + (overdueInv === 1 ? '' : 's') });
  if (flags.arrears.length) pills.push({ cls: 'red', text: flags.arrears.length + ' Unit' + (flags.arrears.length === 1 ? '' : 's') + ' in Arrears' });
  if (flags.renewalsSoon.length) pills.push({ cls: 'yellow', text: flags.renewalsSoon.length + ' Lease Renewal' + (flags.renewalsSoon.length === 1 ? '' : 's') + ' Due Soon' });
  wrap.innerHTML = pills.length ? pills.map(function (f) { return '<span class="home-flag-pill ' + f.cls + '">' + f.text + '</span>'; }).join('') : '<span class="home-flag-pill ok">All clear</span>';
  renderRoleView();
}

// Role views — "View as" on Home. Every role gets the same wood dial scene
// (background, window, Hartwig logo, Build/Hold). Admin and Manager use the
// standard seven pillars. Bookkeeper and Developer get their own seven per
// mode from ROLE_DIALS, plus their own centre button. A non-Admin role's live
// numbers (roleKpis) show below the drilldown blocks. This is a lens, not
// access control: there's no login, and data is still per-device
// localStorage until cross-device sync exists.
const ROLES = {
  manager: { title: 'Manager', intro: 'Run the site: what\'s open, who\'s on the clock, what needs chasing today.' },
  bookkeeper: { title: 'Bookkeeper', intro: 'Money in and out: job cost vs budget, change-order dollars, hours for payroll, rent collected and owed.' },
  developer: { title: 'Developer', intro: 'The big picture: is the build on budget, what\'s the change-order exposure, and how is the rental portfolio performing.' }
};
// Each pillar: id, icon, label, tabs ([tab, label, scrollToId?]), soon
// (placeholder labels), badge() → [text, warn] or null. center: the middle
// button's label + action for that role/mode; report: the gold button's.
function activeLeaseList() {
  const today = new Date().toISOString().slice(0, 10);
  return leases.filter(function (l) { return l.startDate <= today && (!l.endDate || l.endDate >= today); });
}
function occupiedUnitCount() {
  const active = activeLeaseList();
  return units.filter(function (u) { return active.some(function (l) { return l.unitId === u.id; }); }).length;
}
function budgetPctBadge() {
  const total = (budget.labor || 0) + (budget.materials || 0);
  if (!total) return null;
  const spent = totalLaborCost() + totalMaterialsCost();
  return [Math.round(spent / total * 100) + '%', spent > total];
}
function countBadge(n, warn) { return n ? [String(n), !!warn] : null; }
const REPORT_PILLAR = { id: 'reports', icon: '📋', label: 'Reports', tabs: [['report', 'Report'], ['dashboard', 'Open Items Dashboard']] };
const ROLE_DIALS = {
  bookkeeper: {
    build: {
      center: { label: 'Log Sub<br>Payment', tab: 'jobcost', scroll: 'subContractList' },
      report: { label: 'Generate Report', tab: 'report', run: 'report' },
      pillars: [
        { id: 'jobcost', icon: '💰', label: 'Job Cost', tabs: [['jobcost', 'Job Cost Dashboard'], ['jobcost', 'Budget vs Actual', 'budgetSummary']], badge: budgetPctBadge },
        { id: 'payroll', icon: '⏱', label: 'Payroll Hours', tabs: [['clock', 'Clock In/Out'], ['jobcost', 'Hourly Labor Cost', 'laborCostList']], badge: function () { return countBadge(clockEvents.filter(function (e) { return e.flagged; }).length, true); } },
        { id: 'subs', icon: '🤝', label: 'Flat-Contract Subs', tabs: [['jobcost', 'Flat-Contract Subs', 'subContractList']], badge: function () { const o = totalContractOwed(); return o > 0.005 ? [money(o), true] : null; } },
        { id: 'materials', icon: '🧱', label: 'Materials', tabs: [['jobcost', 'Supplies & Materials', 'materialsList']], badge: function () { return countBadge(materials.length); } },
        { id: 'cobill', icon: '📝', label: 'Change Orders to Bill', tabs: [['changes', 'Change Orders'], ['invoices', 'Bill them on an invoice']], badge: function () { return countBadge(unbilledChangeOrders().length); } },
        { id: 'invoicing', icon: '🧾', label: 'Invoicing', tabs: [['invoices', 'Ch. 5 · Invoices']], badge: function () { const o = invoiceOutstanding(invoices); return o.balance > 0.005 ? [money(o.balance), o.overdue > 0] : null; } },
        REPORT_PILLAR
      ]
    },
    hold: {
      center: { label: 'Log Rent<br>Payment', tab: 'rentroll', scroll: 'paymentLeaseSelect' },
      report: { label: 'Export Rent Roll (CSV)', run: 'csv' },
      pillars: [
        { id: 'rent', icon: '💳', label: 'Rent & Payments', tabs: [['rentroll', 'Rent & Payments']] },
        { id: 'arrears', icon: '🚩', label: 'Arrears', tabs: [['arrears', 'Arrears & Collections']], badge: function () { return countBadge(computeLeaseFlags().arrears.length, true); } },
        { id: 'leases', icon: '📃', label: 'Leases', tabs: [['leases', 'Leases']], badge: function () { return countBadge(computeLeaseFlags().renewalsSoon.length); } },
        { id: 'tenants', icon: '🧑‍🤝‍🧑', label: 'Tenants', tabs: [['tenants', 'Tenants']], badge: function () { return countBadge(tenants.length); } },
        { id: 'csv', icon: '📤', label: 'CSV Export', tabs: [['rentroll', 'Rent Roll & CSV Export', 'exportRentRollBtn']] },
        { id: 'deposits', icon: '🏦', label: 'Deposits', tabs: [], soon: ['Security Deposits'] },
        REPORT_PILLAR
      ]
    }
  },
  developer: {
    build: {
      center: { label: 'Generate<br>Report', tab: 'report', run: 'report' },
      report: { label: 'Open Items Dashboard', tab: 'dashboard' },
      pillars: [
        { id: 'overview', icon: '🏙️', label: 'All Jobs Overview', tabs: [['jobs', 'All Jobs Overview'], ['dashboard', 'Open Items Dashboard (this job)']], badge: function () { return jobs.length > 1 ? [String(jobs.length) + ' jobs', false] : null; } },
        { id: 'budget', icon: '💰', label: 'Budget vs Actual', tabs: [['jobcost', 'Budget vs Actual', 'budgetSummary'], ['jobcost', 'Job Cost Dashboard']], badge: budgetPctBadge },
        { id: 'coexposure', icon: '📝', label: 'Change-Order Exposure', tabs: [['changes', 'Change Orders']], badge: function () { const t = changes.filter(function (c) { return c.approval === 'Pending'; }).reduce(function (s, c) { return s + (c.costEstimate || 0); }, 0); return t ? [money(t), true] : null; } },
        { id: 'progress', icon: '📈', label: 'Progress', tabs: [['dailylog', 'Daily Log'], ['punch', 'Punch List'], ['rfis', 'RFIs']], badge: function () { return countBadge(punch.filter(function (p) { return !p.resolved; }).length + rfis.filter(function (r) { return r.status !== 'Answered'; }).length); } },
        { id: 'land', icon: '🗺️', label: 'Land Pipeline', tabs: [], soon: ['Ch. 6 · Land-to-Contract Pipeline (Victoria Land)'] },
        { id: 'price', icon: '🏷️', label: 'Price-the-House', tabs: [], soon: ['Ch. 9 · Price-the-House'] },
        REPORT_PILLAR
      ]
    },
    hold: {
      center: { label: 'Generate<br>Report', tab: 'report', run: 'report' },
      report: { label: 'Rent Roll', tab: 'rentroll' },
      pillars: [
        { id: 'properties', icon: '🏢', label: 'Properties & Units', tabs: [['units', 'Units & Properties']], badge: function () { return countBadge(units.length); } },
        { id: 'occupancy', icon: '🔑', label: 'Occupancy', tabs: [['units', 'Units'], ['leases', 'Leases']], badge: function () { return units.length ? [Math.round(occupiedUnitCount() / units.length * 100) + '%', false] : null; } },
        { id: 'rentroll', icon: '💳', label: 'Rent Roll', tabs: [['rentroll', 'Rent & Payments']], badge: function () { const t = activeLeaseList().reduce(function (s, l) { return s + (l.rentAmount || 0); }, 0); return t ? [money(t) + '/mo', false] : null; } },
        { id: 'arrears', icon: '🚩', label: 'Arrears', tabs: [['arrears', 'Arrears & Collections']], badge: function () { return countBadge(computeLeaseFlags().arrears.length, true); } },
        { id: 'renewals', icon: '📅', label: 'Renewals', tabs: [['leases', 'Leases']], badge: function () { return countBadge(computeLeaseFlags().renewalsSoon.length); } },
        { id: 'maintenance', icon: '🧰', label: 'Maintenance Walks', tabs: [['leasewalk', 'Maintenance & Walk-throughs']] },
        { id: 'commercial', icon: '🏬', label: 'Commercial', tabs: [], soon: ['Commercial Extras'] }
      ]
    }
  }
};
const DEFAULT_CENTER = { label: 'Start<br>Walk-Around', walk: true };
const DEFAULT_REPORT = { label: 'Generate Report', tab: 'report', run: 'report' };
function currentDial() {
  const home = document.getElementById('tab-home');
  const cfg = ROLE_DIALS[home.getAttribute('data-role')];
  return cfg ? cfg[home.getAttribute('data-home-mode') === 'hold' ? 'hold' : 'build'] : null;
}
function goToTab(tab, scrollId) {
  showTab(tab);
  if (!scrollId) return;
  const el = document.getElementById(scrollId);
  if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
}
function runHomeAction(a) {
  if (a.run === 'csv') { exportRentRollCsv(); return; }
  goToTab(a.tab, a.scroll);
  if (a.run === 'report') window.generateReport();
}
// Rebuilt on role or mode change only. Badge values refresh in place via
// updateRoleBadges(), so a data change never swaps out a pillar mid-drag.
function renderRoleDial() {
  const home = document.getElementById('tab-home');
  const ring = document.querySelector('.home-pillars');
  const blocks = document.querySelector('.home-blocks');
  home.querySelectorAll('.home-pillar-role, .home-block-role').forEach(function (el) { el.remove(); });
  const dial = currentDial();
  if (dial) home.setAttribute('data-custom-dial', ''); else home.removeAttribute('data-custom-dial');
  const center = dial ? dial.center : DEFAULT_CENTER, report = dial ? dial.report : DEFAULT_REPORT;
  document.getElementById('homeStartWalkBtn').innerHTML = center.label;
  document.getElementById('homeGenerateReportBtn').textContent = report.label;
  document.getElementById('homeMoreLink').textContent = home.getAttribute('data-role') === 'all' ? '⋯ More (Dashboard, Report, Setup)' : '⋯ Your numbers & all tools';
  if (!dial) return;
  dial.pillars.forEach(function (p, i) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'home-pillar home-pillar-role';
    btn.setAttribute('data-block', 'role-' + p.id); btn.setAttribute('aria-label', p.label);
    btn.style.setProperty('--angle', (-90 + i * 360 / 7).toFixed(2) + 'deg');
    btn.innerHTML = '<span class="pillar-visual"><span class="pillar-badge" data-badge="' + p.id + '"></span><span class="pillar-column"></span><span class="pillar-label">' + escapeHtml(p.label) + '</span></span>';
    btn.addEventListener('click', function () { openHomeDrilldown('role-' + p.id); });
    ring.appendChild(btn);

    const block = document.createElement('div');
    block.className = 'home-block home-block-role' + (home.getAttribute('data-home-mode') === 'hold' ? ' home-block-role-hold' : '');
    block.setAttribute('data-block', 'role-' + p.id);
    block.innerHTML = '<button class="home-block-header" type="button"><span class="home-block-icon">' + p.icon + '</span><span class="home-block-title">' + escapeHtml(p.label) + '</span><span class="home-block-chevron">›</span></button>'
      + '<div class="home-block-chapters">'
      + p.tabs.map(function (t) { return '<button class="home-chapter-btn" type="button" data-go="' + t[0] + '"' + (t[2] ? ' data-scroll="' + t[2] + '"' : '') + '>' + escapeHtml(t[1]) + '</button>'; }).join('')
      + (p.soon || []).map(function (t) { return '<button class="home-chapter-btn" disabled>' + escapeHtml(t) + ' <em>Coming soon</em></button>'; }).join('')
      + '</div>';
    block.querySelector('.home-block-header').addEventListener('click', function () { block.classList.toggle('expanded'); });
    block.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { goToTab(b.getAttribute('data-go'), b.getAttribute('data-scroll')); }); });
    blocks.appendChild(block);
  });
  updateRoleBadges();
}
function updateRoleBadges() {
  const dial = currentDial();
  if (!dial) return;
  dial.pillars.forEach(function (p) {
    const el = document.querySelector('.pillar-badge[data-badge="' + p.id + '"]');
    if (!el) return;
    const b = p.badge ? p.badge() : null;
    el.textContent = b ? b[0] : '';
    el.classList.toggle('warn', !!(b && b[1]));
  });
}
function money(n) { return '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function roleKpis(role) {
  const openPunch = punch.filter(function (p) { return !p.resolved; }).length;
  const pendingCo = changes.filter(function (c) { return c.approval === 'Pending'; });
  const openRfis = rfis.filter(function (r) { return r.status !== 'Answered'; }).length;
  const coSum = function (list) { return list.reduce(function (s, c) { return s + (c.costEstimate || 0); }, 0); };
  const labor = totalLaborCost(), mats = totalMaterialsCost(), spent = labor + mats;
  const budgetTotal = (budget.labor || 0) + (budget.materials || 0);
  const flags = computeLeaseFlags();
  const pastDue = flags.arrears.reduce(function (s, r) { return s + r.balance; }, 0);
  const today = new Date().toISOString().slice(0, 10);
  const activeLeases = leases.filter(function (l) { return l.startDate <= today && (!l.endDate || l.endDate >= today); });
  const occupied = units.filter(function (u) { return activeLeases.some(function (l) { return l.unitId === u.id; }); }).length;
  const budgetKpi = budgetTotal > 0
    ? [Math.round(spent / budgetTotal * 100) + '%', 'of job budget spent (' + money(spent) + ' / ' + money(budgetTotal) + ')', spent > budgetTotal]
    : [money(spent), 'job spend (no budget set)', false];
  if (role === 'manager') {
    const onClock = laborCostByEmployee().filter(function (r) { return r.active; }).length;
    const missed = clockEvents.filter(function (e) { return e.flagged; }).length;
    const lastLog = dailyLogs.length ? dailyLogs[dailyLogs.length - 1].date : 'None yet';
    return [
      [openPunch, 'open punch items', openPunch > 0], [openRfis, 'open RFIs', openRfis > 0],
      [submittals.filter(function (x) { return x.status === 'Pending'; }).length, 'pending submittals', false], [pendingCo.length, 'change orders awaiting client', pendingCo.length > 0],
      [onClock, 'on the clock now', false], [missed, 'missed clock-outs', missed > 0],
      [safetyLogs.length, 'safety log entries', false], [lastLog, 'last daily log', false]
    ];
  }
  if (role === 'bookkeeper') {
    const approved = unbilledChangeOrders();
    const inv = invoiceOutstanding(invoices);
    const collected = payments.reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    return [
      budgetKpi, [money(labor), 'labor to date (hourly ' + money(totalHourlyLaborCost()) + ' + contracts ' + money(totalContractLaborCost()) + ')', false],
      [money(totalContractOwed()), 'owed to flat-contract subs for work done', totalContractOwed() > 0.005], [money(totalContractCommitted()), subContracts.length + ' flat contract' + (subContracts.length === 1 ? '' : 's') + ' committed', false],
      [money(mats), 'materials to date', false], [money(coSum(approved)), approved.length + ' approved change order' + (approved.length === 1 ? '' : 's') + ' not invoiced yet', approved.length > 0],
      [money(inv.balance), 'outstanding on invoices' + (inv.overdue ? ' (' + inv.overdue + ' overdue)' : ''), inv.overdue > 0], [money(inv.paid), 'collected on invoices', false],
      [money(coSum(pendingCo)), pendingCo.length + ' change order' + (pendingCo.length === 1 ? '' : 's') + ' pending', false], [money(collected), 'rent collected (all time)', false],
      [money(pastDue), 'rent past due', pastDue > 0.005], [flags.arrears.length, 'units in arrears', flags.arrears.length > 0]
    ];
  }
  return [
    budgetKpi, [money(coSum(pendingCo)), 'pending change-order exposure', coSum(pendingCo) > 0],
    [openPunch + pendingCo.length + openRfis, 'open items (punch + CO + RFI)', false], [properties.length + ' / ' + units.length, 'properties / units', false],
    [units.length ? Math.round(occupied / units.length * 100) + '%' : '—', 'occupancy (' + occupied + ' of ' + units.length + ' units leased)', false],
    [money(activeLeases.reduce(function (s, l) { return s + (l.rentAmount || 0); }, 0)), 'monthly rent roll', false],
    [money(pastDue), 'rent past due', pastDue > 0.005], [flags.renewalsSoon.length, 'lease renewals in 60 days', flags.renewalsSoon.length > 0]
  ];
}
function renderRoleView() {
  const home = document.getElementById('tab-home'), wrap = document.getElementById('homeRoleView');
  if (!home || !wrap) return;
  updateRoleBadges();
  const cfg = ROLES[home.getAttribute('data-role')];
  if (!cfg) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<p class="role-intro"><strong>' + cfg.title + ' view</strong>' + cfg.intro + '</p>'
    + '<div class="role-kpis">' + roleKpis(home.getAttribute('data-role')).map(function (k) {
      return '<div class="role-kpi' + (k[2] ? ' warn' : '') + '"><b>' + escapeHtml(k[0]) + '</b><small>' + escapeHtml(k[1]) + '</small></div>';
    }).join('') + '</div>';
}
function setRole(role) {
  if (!ROLES[role]) role = 'all';
  const home = document.getElementById('tab-home');
  home.setAttribute('data-role', role);
  home.classList.remove('showing-drilldown');
  document.querySelectorAll('.home-role-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-role') === role); });
  saveJson(LS.role, role);
  renderRoleDial();
  renderRoleView();
}
document.querySelectorAll('.home-role-btn').forEach(function (btn) {
  btn.addEventListener('click', function () { setRole(btn.getAttribute('data-role')); });
});

document.getElementById('addPropertyBtn').addEventListener('click', function () {
  const name = document.getElementById('propName').value.trim();
  if (!name) { alert('Enter a property name first.'); return; }
  const address = document.getElementById('propAddress').value.trim();
  const linkJob = document.getElementById('propLinkJob').checked;
  properties.push({
    id: makeId('prop'), name: name, address: address, jobLinked: linkJob,
    jobSiteName: linkJob ? document.getElementById('siteName').textContent.trim() : '',
    jobSiteAddress: linkJob ? document.getElementById('siteAddress').textContent.trim() : '',
    createdAt: new Date().toISOString()
  });
  persistProperties(); renderProperties();
  document.getElementById('propName').value = ''; document.getElementById('propAddress').value = ''; document.getElementById('propLinkJob').checked = false;
});
document.getElementById('addUnitBtn').addEventListener('click', function () {
  const propertyId = document.getElementById('unitPropertySelect').value;
  if (!propertyId) { alert('Add a property first.'); return; }
  const label = document.getElementById('unitLabel').value.trim();
  if (!label) { alert('Enter a unit label first.'); return; }
  units.push({ id: makeId('unit'), propertyId: propertyId, label: label, notes: document.getElementById('unitNotes').value.trim() });
  persistUnits(); renderUnits(); renderProperties();
  document.getElementById('unitLabel').value = ''; document.getElementById('unitNotes').value = '';
});
document.getElementById('addTenantBtn').addEventListener('click', function () {
  const name = document.getElementById('tenantName').value.trim();
  if (!name) { alert('Enter a tenant name first.'); return; }
  tenants.push({ id: makeId('tenant'), name: name, email: document.getElementById('tenantEmail').value.trim(), phone: document.getElementById('tenantPhone').value.trim() });
  persistTenants(); renderTenants();
  document.getElementById('tenantName').value = ''; document.getElementById('tenantEmail').value = ''; document.getElementById('tenantPhone').value = '';
});
document.getElementById('addLeaseBtn').addEventListener('click', function () {
  const unitId = document.getElementById('leaseUnitSelect').value;
  if (!unitId) { alert('Add a unit first.'); return; }
  const tenantId = document.getElementById('leaseTenantSelect').value;
  if (!tenantId) { alert('Add a tenant first.'); return; }
  const rentAmount = parseFloat(document.getElementById('leaseRent').value);
  if (isNaN(rentAmount) || rentAmount <= 0) { alert('Enter a rent amount first.'); return; }
  const startDate = document.getElementById('leaseStart').value;
  if (!startDate) { alert('Enter a start date first.'); return; }
  leases.push({
    id: makeId('lease'), unitId: unitId, tenantId: tenantId, leaseType: document.getElementById('leaseType').value,
    startDate: startDate, endDate: document.getElementById('leaseEnd').value, renewalDate: document.getElementById('leaseRenewal').value, rentAmount: rentAmount
  });
  persistLeases(); renderLeases(); renderRentRoll(); renderArrears(); renderFlagBar();
  document.getElementById('leaseRent').value = ''; document.getElementById('leaseStart').value = ''; document.getElementById('leaseEnd').value = ''; document.getElementById('leaseRenewal').value = '';
});
document.getElementById('addPaymentBtn').addEventListener('click', function () {
  const leaseId = document.getElementById('paymentLeaseSelect').value;
  if (!leaseId) { alert('Add a lease first.'); return; }
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  if (isNaN(amount) || amount <= 0) { alert('Enter a payment amount first.'); return; }
  const date = document.getElementById('paymentDate').value || new Date().toISOString().split('T')[0];
  payments.push({ id: makeId('pay'), leaseId: leaseId, date: date, amount: amount, method: document.getElementById('paymentMethod').value, note: document.getElementById('paymentNote').value.trim() });
  persistPayments(); renderRentRoll(); renderArrears(); renderFlagBar();
  document.getElementById('paymentAmount').value = ''; document.getElementById('paymentNote').value = '';
});
document.getElementById('exportRentRollBtn').addEventListener('click', exportRentRollCsv);
document.getElementById('startLeaseWalkBtn').addEventListener('click', function () {
  const unitId = document.getElementById('leaseWalkUnitSelect').value;
  if (!unitId) { alert('Add a unit first.'); return; }
  startLeaseWalk(unitId);
});

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
  renderFlagBar();
}

/* ---------- Job Cost Dashboard: labor, materials, budget vs actual ---------- */
// Pairs each employee's in/out clock events chronologically into worked
// hours; an unmatched trailing "in" counts as hours worked so far (the
// "real-time" part of the running cost), not just completed shifts.
// Each person is either hourly (hours × rate) or covered by a flat contract
// (hours still tracked, $0 here — the contract carries the cost). wages[name]
// used to be a bare hourly rate; that still reads as hourly.
function wageFor(name) {
  const w = wages[name];
  if (typeof w === 'number') return { type: 'hourly', rate: w };
  if (w && typeof w === 'object') return { type: w.type === 'contract' ? 'contract' : 'hourly', rate: w.rate || 0 };
  return { type: 'hourly', rate: 0 };
}
function laborCostByEmployee(events) {
  const byEmployee = {};
  (events || clockEvents).forEach(function (e) { (byEmployee[e.employee] = byEmployee[e.employee] || []).push(e); });
  return Object.keys(byEmployee).sort().map(function (name) {
    const events = byEmployee[name].slice().sort(function (a, b) { return clockMs(a) - clockMs(b); });
    let hours = 0, active = false, lastIn = null;
    events.forEach(function (e) {
      if (e.type === 'in') { lastIn = clockMs(e); }
      else if (e.type === 'out' && lastIn != null) { hours += (clockMs(e) - lastIn) / 3600000; lastIn = null; }
    });
    if (lastIn != null) { active = true; hours += (Date.now() - lastIn) / 3600000; }
    const w = wageFor(name);
    return { name: name, hours: hours, active: active, payType: w.type, rate: w.rate, cost: w.type === 'hourly' ? hours * w.rate : 0 };
  });
}
function totalHourlyLaborCost(events) { return laborCostByEmployee(events).reduce(function (sum, r) { return sum + r.cost; }, 0); }

// Flat contract: cost to date is the larger of earned (% complete × amount)
// and paid — a deposit is money out the door even before work starts.
// Owed = earned − paid, when positive.
function contractPaid(c) { return (c.payments || []).reduce(function (s, p) { return s + (p.amount || 0); }, 0); }
function contractEarned(c) { return (c.amount || 0) * Math.min(100, Math.max(0, c.pctComplete || 0)) / 100; }
function contractCostToDate(c) { return Math.max(contractEarned(c), contractPaid(c)); }
function contractOwed(c) { return Math.max(0, contractEarned(c) - contractPaid(c)); }
function totalContractLaborCost() { return subContracts.reduce(function (s, c) { return s + contractCostToDate(c); }, 0); }
function totalContractOwed() { return subContracts.reduce(function (s, c) { return s + contractOwed(c); }, 0); }
function totalContractCommitted() { return subContracts.reduce(function (s, c) { return s + (c.amount || 0); }, 0); }
function totalLaborCost() { return totalHourlyLaborCost() + totalContractLaborCost(); }
function totalMaterialsCost() { return materials.reduce(function (sum, m) { return sum + (m.cost || 0); }, 0); }

function renderLaborCost() {
  const wrap = document.getElementById('laborCostList');
  if (!wrap) return;
  const rows = laborCostByEmployee();
  if (!rows.length) wrap.innerHTML = '<p class="hint">Clock-in data will populate labor cost per employee here.</p>';
  else {
    let html = '';
    rows.forEach(function (r) {
      const n = escapeHtml(r.name);
      html += '<div class="item-card"><strong>' + n + '</strong>' + (r.active ? ' <span class="type-tag change">On the clock</span>' : '')
        + '<div class="meta">' + r.hours.toFixed(2) + ' hrs · <select class="pay-type-select" data-employee="' + n + '"><option value="hourly"' + (r.payType === 'hourly' ? ' selected' : '') + '>Hourly</option><option value="contract"' + (r.payType === 'contract' ? ' selected' : '') + '>Flat contract</option></select>'
        + (r.payType === 'hourly'
          ? '$<input type="number" step="0.01" min="0" class="wage-rate-input" data-employee="' + n + '" value="' + r.rate + '">/hr = $' + r.cost.toFixed(2)
          : 'covered by contract') + '</div></div>';
    });
    html += '<div class="item-card"><strong>Hourly Labor: $' + totalHourlyLaborCost().toFixed(2) + '</strong></div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('.wage-rate-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        const name = inp.getAttribute('data-employee');
        wages[name] = { type: 'hourly', rate: parseFloat(inp.value) || 0 };
        persistWages(); renderLaborCost(); renderBudgetSummary();
      });
    });
    wrap.querySelectorAll('.pay-type-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        const name = sel.getAttribute('data-employee');
        wages[name] = { type: sel.value, rate: wageFor(name).rate };
        persistWages(); renderLaborCost(); renderBudgetSummary();
      });
    });
  }
  renderSubContracts();
}

function renderSubContracts() {
  const wrap = document.getElementById('subContractList');
  if (!wrap) return;
  if (!subContracts.length) wrap.innerHTML = '<p class="hint">Flat-contract subs you add will show up here.</p>';
  else {
    let html = '';
    subContracts.forEach(function (c) {
      const paid = contractPaid(c), owed = contractOwed(c);
      html += '<div class="item-card" data-contract-id="' + c.id + '"><strong>' + escapeHtml(c.name) + '</strong>' + (c.trade ? ' <span class="type-tag change">' + escapeHtml(c.trade) + '</span>' : '')
        + '<div class="meta">Contract $' + (c.amount || 0).toFixed(2) + ' · <input type="number" min="0" max="100" step="1" class="wage-rate-input contract-pct-input" value="' + (c.pctComplete || 0) + '">% complete</div>'
        + '<div class="meta">Earned $' + contractEarned(c).toFixed(2) + ' · Paid $' + paid.toFixed(2) + ' · Cost to date $' + contractCostToDate(c).toFixed(2)
        + (owed > 0.005 ? ' · <strong>Owed $' + owed.toFixed(2) + '</strong>' : '') + '</div>'
        + ((c.payments || []).length ? '<div class="meta">Payments: ' + c.payments.map(function (p) { return '$' + p.amount.toFixed(2) + ' (' + escapeHtml(p.date) + ')'; }).join(', ') + '</div>' : '')
        + '<button type="button" class="small green contract-pay-btn">Log Payment</button> <button type="button" class="small gray contract-remove-btn">Remove</button></div>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-contract-id]').forEach(function (card) {
      const c = subContracts.find(function (x) { return x.id === card.getAttribute('data-contract-id'); });
      card.querySelector('.contract-pct-input').addEventListener('change', function (ev) {
        c.pctComplete = Math.min(100, Math.max(0, parseFloat(ev.target.value) || 0));
        persistSubContracts(); renderLaborCost(); renderBudgetSummary();
      });
      card.querySelector('.contract-pay-btn').addEventListener('click', function () {
        const amt = parseFloat(prompt('Payment amount to ' + c.name + ' ($)?') || '');
        if (isNaN(amt) || amt <= 0) return;
        (c.payments = c.payments || []).push({ amount: amt, date: new Date().toISOString().slice(0, 10) });
        persistSubContracts(); renderLaborCost(); renderBudgetSummary();
      });
      card.querySelector('.contract-remove-btn').addEventListener('click', function () {
        if (!confirm('Remove the flat contract for ' + c.name + '?')) return;
        subContracts = subContracts.filter(function (x) { return x !== c; });
        persistSubContracts(); renderLaborCost(); renderBudgetSummary();
      });
    });
  }
  const total = document.getElementById('laborTotal');
  if (total) total.innerHTML = '<div class="item-card"><strong>Total Labor Cost: $' + totalLaborCost().toFixed(2) + '</strong>'
    + '<div class="meta">Hourly $' + totalHourlyLaborCost().toFixed(2) + ' · Flat contracts $' + totalContractLaborCost().toFixed(2)
    + (subContracts.length ? ' (of $' + totalContractCommitted().toFixed(2) + ' committed, $' + totalContractOwed().toFixed(2) + ' owed)' : '') + '</div></div>';
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
// data shape so later chapters (trade routing, estimating, invoicing) can
// reuse a captured item without anyone re-entering it:
//   trade, location, costEstimate (rough, $ or null), drawingRef,
//   itemType ('punch' | 'change_order' | 'rfi') + isChangeOrder,
//   photos[] (photo = first one), via ('voice' | 'manual' | 'review' | 'ai-photo'),
//   transcriptId (the transcript line it came from, for voice items).
// Location and cost are pulled from the spoken text when the AI Worker
// doesn't supply them.
function fileEntry(data) {
  const stamp = data.stamp || nowStamp();
  const entry = { text: data.text, trade: data.trade || tradeSelect.value, time: stamp.time, ts: stamp.ts, iso: stamp.iso, verified: data.verified !== false };
  // Shared schema extension for LeaseFlow: every punch/change/RFI item now
  // carries where it came from, so a lease-walk condition item and a
  // job-site item live in the same table/array, distinguished only by these
  // fields — not by a second schema or a forked engine.
  entry.source = leaseWalkContext ? 'lease-walk' : 'job-site';
  entry.property_id = leaseWalkContext ? leaseWalkContext.propertyId : null;
  entry.unit_id = leaseWalkContext ? leaseWalkContext.unitId : null;
  entry.via = data.via || 'manual';
  if (data.transcriptId) entry.transcriptId = data.transcriptId;
  (data.photos || []).forEach(function (src) { addPhotoToItem(entry, src); });
  if (data.photo) addPhotoToItem(entry, data.photo);
  const drawingRef = data.drawingRef || extractDrawingRef(entry.text);
  if (drawingRef) entry.drawingRef = drawingRef;
  entry.location = data.location || extractLocation(entry.text) || '';
  let type = data.type;
  if (type !== 'change' && type !== 'rfi') type = 'punch';
  entry.itemType = type === 'change' ? 'change_order' : type;
  entry.isChangeOrder = type === 'change';
  entry.severity = maxSeverity(data.severity, scoreSeverity(entry.text, type)) || 'medium';
  if (type !== 'rfi') entry.costEstimate = typeof data.costEstimate === 'number' && isFinite(data.costEstimate) ? data.costEstimate : parseSpokenCost(entry.text);
  if (type === 'change') { entry.approval = data.approval || 'Pending'; changes.push(entry); }
  else if (type === 'rfi') { entry.status = 'Open'; rfis.push(entry); }
  else { entry.resolved = false; punch.push(entry); }
  if (type === 'punch') pushToCurrentWalk('punches', entry);
  if (entry.costEstimate != null && walkActive) pushToCurrentWalk('costs', { text: entry.text, amount: entry.costEstimate, trade: entry.trade, ts: entry.ts, time: entry.time, iso: entry.iso });
  if (!itemPhotos(entry).length) tryLinkItemToRecentPhoto(entry);
  persistLists();
  renderItemCard(entry, type);
  renderDashboard();
  renderDrawingRefs();
  return entry;
}

function classifyText(text) {
  const t = text.toLowerCase();
  if (/^(?:so |and |okay |ok )?(?:do|does|should|can|could|would|will|are|is) (?:we|they|you|i|it|this|that|these|those|the)\b|^(?:so |and )?(?:which|where|what|how) (?:way|side|one|do|does|should|is|are|about)\b/.test(t)) return 'rfi';
  if (/\brfi\b|need clarification|clarify|waiting on|need to confirm|confirm with|need info|unclear|ask the (architect|engineer|owner|designer|client)|which (way|side|one)|are we supposed|is (it|this|that) supposed|do we (want|need|go)|should (we|it|this|that) be\b/.test(t)) return 'rfi';
  if (/change order|additional cost|extra charge|extra work|client wants|client asked|owner wants|owner requested|upcharge|upgrade|out of scope|billable|not in (the )?contract/.test(t)) return 'change';
  return 'punch';
}

// Same keyword-tagging approach as classifyTrade()/classifyText() below,
// applied to two more streams: safety hazards and quality problems go to
// the Safety & Quality log instead of trade punch routing, and a mentioned
// sheet or drawing number gets tagged as a drawing reference.
function classifySafetyText(text) {
  return /\bhazard|unsafe|safety violation|no hard hat|not wearing (a )?(hard hat|ppe|harness|goggles)|missing (guard|rail|railing)|exposed wir|live wire|fall risk|fall hazard|trip hazard|\bosha\b|ppe violation|no ppe|no harness|blocked (exit|fire exit)|gas leak|no eye protection|unguarded|open trench|unshored/i.test(text);
}
function classifyQualityText(text) {
  return /not (up )?to code|code violation|fails? code|won'?t pass( inspection)?|failed inspection|not to spec|out of spec|doesn'?t meet (the )?spec|poor workmanship|sloppy|shoddy|quality (issue|problem|concern)|inspector (flagged|called out|failed|wrote up)/i.test(text);
}
function extractDrawingRef(text) {
  const m = text.match(/\b(?:sheet|drawing|dwg|plan sheet|detail)\s*#?\s*([a-z]{0,3}-?\d+(?:\.\d+)?[a-z]?)\b/i);
  return m ? m[1].toUpperCase() : null;
}
// Rough location from what was said: "unit 3", "second floor", "master
// bath", "east wall". Up to two pieces, e.g. "Unit 3, Kitchen".
const LOCATION_RES = [
  /\b(?:unit|suite|apt\.?|apartment|room|lot|building|bldg|level|floor)\s*#?\s*[a-z]?\d+[a-z]?\b/gi,
  /\b(?:first|second|third|fourth|fifth|ground|main|top|upper|lower|1st|2nd|3rd|4th|5th)\s+floor\b/gi,
  /\b(?:(?:master|main|guest|upstairs|downstairs|front|back|rear|north|south|east|west)\s+)?(?:kitchen|bath(?:room)?|ensuite|powder room|bedroom|living room|family room|dining room|great room|hallway|stairwell|staircase|stairs|basement|garage|attic|laundry(?: room)?|mechanical room|utility room|entry(?:way)?|foyer|closet|deck|porch|patio|driveway|lobby|office|crawl ?space|mudroom|den)\b/gi,
  /\b(?:north|south|east|west|front|back|rear|left|right)\s+(?:wall|side|elevation|corner|exterior)\b/gi
];
function extractLocation(text) {
  const found = [];
  LOCATION_RES.forEach(function (re) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const v = m[0].replace(/\s+/g, ' ').trim();
      if (!found.some(function (f) { return f.toLowerCase() === v.toLowerCase(); })) found.push(v);
    }
  });
  return found.slice(0, 2).map(function (v) { return v.charAt(0).toUpperCase() + v.slice(1); }).join(', ');
}
// Rough cost from what was said ("$300", "1,500 dollars", "2k", "3 grand").
// Several amounts in one sentence are added up. Null when none was said.
function parseSpokenCost(text) {
  const re = /(\$\s?)?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|grand)?\s*(dollars|bucks)?/gi;
  let total = 0, found = false, m;
  while ((m = re.exec(text)) !== null) {
    if (!m[1] && !m[4] && !(m[3] && /k|grand/i.test(m[3]))) continue;
    let n = parseFloat(m[2].replace(/,/g, ''));
    if (isNaN(n)) continue;
    if (m[3]) n *= 1000;
    total += n; found = true;
  }
  return found ? total : null;
}
function detectVoiceApproval(text) {
  return /client (approved|okay'?d|ok'?d|said yes|signed off)|approved (it )?on site|client (says|gives) (the )?go[- ]ahead/i.test(text);
}
function detectVoiceDecline(text) {
  return /client (declined|said no|rejected)|not approved by (the )?client/i.test(text);
}

// Transcript filter. Decides whether a spoken sentence is an item at all:
//   'high' → file it (punch / change order / RFI / safety / quality)
//   'low'  → borderline: goes to the Review bucket, not the punch list
//   'none' → chatter or narration: kept in the transcript only
// The full transcript is logged either way (logTranscript).
const DEFECT_RE = /\b(crack(?:ed|s|ing)?|leak(?:s|ing|y)?|broke|broken|damaged?|missing|loose|fix|repair|replace|patch|touch[- ]?up|re-?do|reinstall|re-?install|not (?:installed|done|working|finished|level|plumb|square|sealed|caulked|secured|connected|flush|straight|painted|closed|finished)|wrong|uneven|gaps?|stain(?:ed|s)?|chipped|scratch(?:ed|es)?|dent(?:ed|s)?|scuff(?:ed|s)?|nail pops?|bubbl(?:e|es|ing)|peeling|sagging|rot(?:ted|ten)?|mold|water damage|out of (?:level|plumb|square)|backwards|upside down|crooked|incomplete|unfinished|punch (?:list|item)|add (?:this |that |it )?to (?:the )?punch)\b/i;
const WEAK_ITEM_RE = /\b(needs?|need to|has to|have to|gotta|got to|should (?:be|get|have)|check (?:on|out)?|look at|looks? (?:off|weird|funny|bad|rough|low|high)|doesn'?t|isn'?t|aren'?t|won'?t|not (?:sure|right)|install|move|add|missing)\b/i;
const OK_RE = /\b(looks? (?:good|great|fine|nice|clean|solid)|all good|good to go|that'?s (?:fine|good|done|it)|nice (?:work|job)|perfect|passed|signed off|is done|are done|all done|complete[d]?)\b/i;
function scoreUtterance(text) {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (classifySafetyText(t)) return { level: 'high', route: 'safety', reason: 'safety keyword' };
  if (classifyQualityText(t)) return { level: 'high', route: 'quality', reason: 'quality keyword' };
  const type = classifyText(t);
  const strong = DEFECT_RE.test(t) || type !== 'punch';
  if (strong) return { level: 'high', route: type, reason: 'item keyword' };
  if (OK_RE.test(t)) return { level: 'none', route: 'punch', reason: 'sounds like a sign-off' };
  const weak = WEAK_ITEM_RE.test(t) || !!classifyTrade(t) || !!extractDrawingRef(t) || parseSpokenCost(t) != null || !!extractLocation(t);
  if (weak && words >= 3) return { level: 'low', route: 'punch', reason: 'mentions work or a place, but no clear problem' };
  return { level: 'none', route: 'punch', reason: 'no item wording' };
}

/* ---------- Urgency ---------- */
// Every item carries a severity: critical / high / medium / low. It's set at
// capture from the words (and the AI Worker, and a confirmed photo tag,
// whichever is higher), can be changed by hand on any card, and orders the
// report so the worst things come first. Older items without one are scored
// on the fly from their text.
const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];
const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const CRITICAL_RE = /\b(live wires?|exposed (?:live )?wir(?:e|es|ing)|gas (?:leak|smell)|smells? (?:like )?gas|fire hazard|on fire|sparking|arcing|collaps(?:e|ed|ing)|structural failure|about to fall|could fall|fall hazard|fall risk|no (?:harness|fall protection)|not wearing (?:a )?harness|unguarded (?:opening|edge|stairs?|floor)|open (?:hole|shaft|edge)|unshored|open trench|carbon monoxide|electrocut\w*|flooding)\b/i;
const HIGH_RE = /\b(hazard|unsafe|leak(?:s|ing|y)?|water damage|water (?:coming|pouring|dripping)|mold|rot(?:ted|ten)?|structural|sagging|cracked (?:foundation|slab|beam|joist|header|footing)|not (?:up )?to code|code violation|fails? code|failed inspection|won'?t pass|blocked (?:exit|fire exit)|trip hazard|no hard hat|no ppe|urgent|asap|right away|immediately|today|before (?:inspection|drywall|close[- ]?in|the pour|pour)|stop work|no power|no water|not working)\b/i;
const LOW_RE = /\b(cosmetic|touch[- ]?up|scuff(?:ed|s)?|scratch(?:ed|es)?|nail pops?|paint|caulk(?:ing)?|minor|stain(?:ed|s)?|smudge|dust|clean ?up|chipped|when (?:you|we) get a chance|eventually|no rush|low priority)\b/i;
function validSeverity(s) { return SEVERITY_LEVELS.indexOf(s) !== -1 ? s : null; }
function scoreSeverity(text, kind) {
  const t = text || '';
  if (CRITICAL_RE.test(t)) return 'critical';
  if (HIGH_RE.test(t) || kind === 'safety') return 'high';
  if (LOW_RE.test(t)) return 'low';
  return 'medium';
}
function maxSeverity(a, b) {
  a = validSeverity(a); b = validSeverity(b);
  if (!a) return b; if (!b) return a;
  return SEVERITY_LEVELS.indexOf(a) >= SEVERITY_LEVELS.indexOf(b) ? a : b;
}
function severityRank(s) { return SEVERITY_LEVELS.indexOf(validSeverity(s) || 'medium'); }
// Safety-log entries use their incident type; the rest use itemType.
function itemKind(e) {
  if (e.itemType) return e.itemType;
  if (e.suggestedType) return e.suggestedType;
  if (e.type === 'Quality Issue') return 'quality';
  if (e.type) return 'safety';
  return 'punch';
}
function itemSeverity(e) { return validSeverity(e.severity) || scoreSeverity(itemDesc(e), itemKind(e)); }
function severityTagHtml(s) { return '<span class="sev-tag sev-' + s + '">' + SEVERITY_LABEL[s] + '</span>'; }
// Tap to step through Low → Medium → High → Critical → Low.
function severityButton(e, onChange) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'small gray sev-btn';
  btn.textContent = 'Urgency: ' + SEVERITY_LABEL[itemSeverity(e)];
  btn.onclick = function () {
    e.severity = SEVERITY_LEVELS[(severityRank(itemSeverity(e)) + 1) % SEVERITY_LEVELS.length];
    e.severityBy = 'user';
    onChange();
  };
  return btn;
}
// Open before closed, then most urgent first, then capture order.
function isItemClosed(e) { return !!e.resolved || e.status === 'Answered' || e.approval === 'Declined'; }
function byUrgency(a, b) {
  return (isItemClosed(a) - isItemClosed(b)) || (severityRank(itemSeverity(b)) - severityRank(itemSeverity(a))) || ((a.ts || 0) - (b.ts || 0));
}

/* ---------- Full transcript record ---------- */
// Every finalized sentence is kept as said, with what the filter did with it.
const OUTCOME_LABEL = { punch: 'Punch item', change: 'Change order', rfi: 'RFI', safety: 'Safety', quality: 'Quality', review: 'Needs review', transcript: 'Transcript only', dismissed: 'Dismissed', photo: 'Photo command', pending: 'Sorting…' };
function logTranscript(raw) {
  const stamp = nowStamp();
  const entry = { id: makeId('t'), text: raw, trade: tradeSelect.value, time: stamp.time, ts: stamp.ts, iso: stamp.iso, outcome: 'pending' };
  notesLog.push(entry); persistNotes();
  pushToCurrentWalk('transcript', entry);
  const wrap = document.getElementById('notesList');
  if (wrap.querySelector('.w-empty')) wrap.innerHTML = '';
  renderNote(entry);
  return entry;
}
// Sets the outcome on the transcript line with this id, in the notes log and
// in whichever walk holds it (after a reload those are separate copies).
function setTranscriptOutcome(id, outcome, trade) {
  if (!id) return;
  const lists = [notesLog].concat(walks.map(function (w) { return w.transcript; }));
  lists.forEach(function (list) { list.forEach(function (e) { if (e.id === id) { e.outcome = outcome; if (trade) e.trade = trade; } }); });
  persistNotes(); persistWalks(); renderAllNotes();
}

/* ---------- Review bucket (low-confidence calls) ---------- */
function addReviewItem(d) {
  const stamp = nowStamp();
  const item = Object.assign({ id: makeId('rv'), time: stamp.time, ts: stamp.ts, iso: stamp.iso }, d);
  tryLinkItemToRecentPhoto(item);
  reviewItems.push(item);
  persistReview();
  renderReview();
  if (item.photoFlag) resolveReviewItem(item.id, item.photoFlag);
  return item;
}
function renderReview() {
  updateReviewBadge();
  const wrap = document.getElementById('reviewList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!reviewItems.length) { wrap.innerHTML = '<div class="w-empty"><span class="big">✅</span>Nothing to review. Sentences the AI isn\'t sure about land here instead of the punch list.</div>'; return; }
  reviewItems.slice().reverse().forEach(function (r) {
    const card = document.createElement('div');
    card.className = 'item-card review-card';
    const typeLabel = { punch: 'Punch item', change: 'Change order', rfi: 'RFI', safety: 'Safety', quality: 'Quality' }[r.suggestedType] || 'Punch item';
    card.innerHTML = '<div>' + severityTagHtml(itemSeverity(r)) + ' ' + escapeHtml(r.text) + '</div><div class="meta">Best guess: ' + typeLabel + ' · ' + escapeHtml(r.trade || 'General')
      + (r.location ? ' · ' + escapeHtml(r.location) : '') + (r.costEstimate != null ? ' · ~$' + r.costEstimate : '') + (r.drawingRef ? ' · Sheet ' + escapeHtml(r.drawingRef) : '')
      + '<br>' + escapeHtml(r.time) + (r.reason ? ' · ' + escapeHtml(r.reason) : '') + '</div>';
    const row = photoRowEl(itemPhotos(r));
    if (row) card.appendChild(row);
    [['punch', 'Punch', 'small'], ['change', 'Change Order', 'small'], ['rfi', 'RFI', 'small'], ['safety', 'Safety', 'small red'], ['quality', 'Quality', 'small gray'], ['dismiss', 'Not an item', 'small gray']].forEach(function (b) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = b[2]; btn.textContent = b[1];
      btn.onclick = function () { resolveReviewItem(r.id, b[0]); };
      card.appendChild(btn);
    });
    card.appendChild(severityButton(r, function () { persistReview(); renderReview(); }));
    wrap.appendChild(card);
  });
}
function resolveReviewItem(id, action) {
  const r = reviewItems.find(function (x) { return x.id === id; });
  if (!r) return;
  reviewItems = reviewItems.filter(function (x) { return x !== r; });
  persistReview();
  const stamp = { time: r.time, ts: r.ts, iso: r.iso };
  if (action === 'dismiss') {
    // Photos it held go back to being unlinked.
    photos.forEach(function (p) { if (p.linkedItemTs === r.ts) { delete p.linkedItemText; delete p.linkedItemTs; } });
    persistPhotos();
    setTranscriptOutcome(r.transcriptId, 'dismissed');
  } else if (action === 'safety' || action === 'quality') {
    logSafetyQuality(r.text, action, { trade: r.trade, location: r.location, drawingRef: r.drawingRef, photos: itemPhotos(r), stamp: stamp, via: 'review', transcriptId: r.transcriptId, severity: r.severity });
    setTranscriptOutcome(r.transcriptId, action);
  } else {
    fileEntry({ text: r.text, type: action, trade: r.trade, location: r.location, costEstimate: r.costEstimate, drawingRef: r.drawingRef, photos: itemPhotos(r), stamp: stamp, via: 'review', verified: true, transcriptId: r.transcriptId, approval: r.approval, severity: r.severity });
    setTranscriptOutcome(r.transcriptId, action, r.trade);
  }
  renderReview();
}

// Hazards and quality problems go to the Safety & Quality log, not trade
// punch routing — they need their own follow-up.
function logSafetyQuality(text, kind, meta) {
  meta = meta || {};
  const stamp = meta.stamp || nowStamp();
  const entry = { type: kind === 'quality' ? 'Quality Issue' : 'Hazard Observed', desc: text, person: '', action: '', photo: null, photos: [], trade: meta.trade || tradeSelect.value, location: meta.location || extractLocation(text) || '', time: stamp.time, ts: stamp.ts, iso: stamp.iso, via: meta.via || 'voice' };
  const ref = meta.drawingRef || extractDrawingRef(text);
  if (ref) entry.drawingRef = ref;
  if (meta.transcriptId) entry.transcriptId = meta.transcriptId;
  entry.severity = maxSeverity(meta.severity, scoreSeverity(text, kind));
  (meta.photos || []).forEach(function (src) { addPhotoToItem(entry, src); });
  if (!itemPhotos(entry).length) tryLinkItemToRecentPhoto(entry);
  safetyLogs.push(entry);
  persistSafety();
  pushToCurrentWalk('safety', Object.assign({ text: text }, entry));
  renderSafetyLogs();
  renderDashboard();
  setWalkStatus('ok', (kind === 'quality' ? 'Quality issue' : 'Safety issue') + ' logged in the Safety & Quality log.');
  return entry;
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

// Offline path: keyword filter + trade guess. Also the fallback when the AI
// Worker isn't set up, fails, or times out, so voice capture never drops a
// sentence.
function localClassify(text) {
  const guessedTrade = classifyTrade(text);
  if (guessedTrade) tradeSelect.value = guessedTrade;
  const score = scoreUtterance(text);
  const clean = cleanSpeech(text) || text;
  return { level: score.level, type: score.route, reason: score.reason, text: clean.charAt(0).toUpperCase() + clean.slice(1), trade: tradeSelect.value, costEstimate: null, location: '', verified: false, severity: scoreSeverity(text, score.route) };
}

// One finalized sentence from the walk (continuous recognition or the
// push-to-talk fallback). Logs it to the transcript, handles "take a photo",
// then sends the rest through the item filter.
function handleFinalUtterance(raw) {
  raw = (raw || '').trim();
  if (!raw || isNoiseTranscript(raw)) return;
  const t = logTranscript(raw);
  const remainder = extractSnapTriggerRemainder(raw);
  if (remainder === null) { fileVoiceUtterance(raw, t.id); return; }
  // If the sentence also describes an issue, the photo waits unlinked so the
  // item filed from this same sentence claims it (not the previous item).
  voiceTriggeredSnap(raw, { holdForItem: !!remainder, transcriptId: t.id });
  if (remainder) fileVoiceUtterance(remainder, t.id);
  else setTranscriptOutcome(t.id, 'photo');
}

// Sends one sentence through the Worker's /classify route (is-it-an-item +
// confidence, type, trade, location, rough cost from an LLM), falling back
// to the local filter. A hazard/quality problem is pulled out before any of
// that, and a spoken client approval/decline is applied at capture so a
// change order approved on site doesn't need a second tap after the walk.
function fileVoiceUtterance(text, transcriptId) {
  text = text.trim();
  if (!text) return;
  const local = localClassify(text);
  const voiceApproval = detectVoiceApproval(text) ? 'Approved' : (detectVoiceDecline(text) ? 'Declined' : null);
  if (local.type === 'safety' || local.type === 'quality') { routeClassified(local, text, transcriptId, voiceApproval); return; }
  const endpoint = currentAiEndpoint();
  if (!endpoint) { routeClassified(local, text, transcriptId, voiceApproval); return; }
  const headers = { 'Content-Type': 'application/json' };
  const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  fetch(endpoint + '/classify', { method: 'POST', headers: headers, body: JSON.stringify({ text: text }), signal: controller ? controller.signal : undefined })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (timer) clearTimeout(timer);
      if (!data || data.error || !data.type) throw new Error((data && data.error) || 'bad response');
      routeClassified(mergeAiClassification(data, local), text, transcriptId, voiceApproval);
    })
    .catch(function () {
      if (timer) clearTimeout(timer);
      routeClassified(local, text, transcriptId, voiceApproval);
    });
}
// Combines the Worker's answer with the local filter. A Worker that returns
// isItem/confidence decides; if it disagrees with a strong local keyword hit
// the sentence goes to Review. An older Worker without those fields only
// supplies type/trade/text/cost and the local filter decides.
const AI_CONFIDENT = 0.6;
function mergeAiClassification(data, local) {
  const typeMap = { change_order: 'change', rfi: 'rfi', safety: 'safety', quality: 'quality', punch: 'punch' };
  const trade = data.trade && TRADES.indexOf(data.trade) !== -1 ? data.trade : local.trade;
  if (trade) tradeSelect.value = trade;
  const out = { type: typeMap[data.type] || 'punch', text: data.text || local.text, trade: trade, costEstimate: typeof data.costImpact === 'number' ? data.costImpact : null, location: typeof data.location === 'string' ? data.location : '', verified: true, reason: data.reason || '', severity: maxSeverity(data.severity, local.severity) };
  if (typeof data.isItem !== 'boolean') { out.level = local.level; out.reason = out.reason || local.reason; return out; }
  const conf = typeof data.confidence === 'number' ? data.confidence : 0.8;
  if (data.isItem && conf >= AI_CONFIDENT) out.level = 'high';
  else if (!data.isItem && conf >= AI_CONFIDENT) {
    out.level = local.level === 'high' ? 'low' : 'none';
    if (out.level === 'low') { out.text = local.text; out.type = local.type; out.reason = 'AI says not an item, but it sounds like one'; }
  }
  else out.level = local.level === 'none' && !data.isItem ? 'none' : 'low';
  if (out.level === 'low' && !out.reason) out.reason = 'AI wasn\'t sure (' + Math.round(conf * 100) + '%)';
  return out;
}
function routeClassified(c, rawText, transcriptId, voiceApproval) {
  c.severity = maxSeverity(c.severity, scoreSeverity(rawText, c.type));
  if (c.level === 'none') {
    setTranscriptOutcome(transcriptId, 'transcript', c.trade);
    setWalkStatus('info', 'Noted in the transcript (not an item).');
  } else if (c.level === 'low') {
    const rv = addReviewItem({ text: c.text, raw: rawText, suggestedType: c.type, trade: c.trade, location: c.location || extractLocation(rawText), costEstimate: c.costEstimate != null ? c.costEstimate : parseSpokenCost(rawText), drawingRef: extractDrawingRef(rawText), reason: c.reason, transcriptId: transcriptId, approval: c.type === 'change' ? (voiceApproval || undefined) : undefined, severity: c.severity });
    // Already filed if a confirmed photo tag flagged it as safety/quality.
    if (reviewItems.indexOf(rv) !== -1) {
      setTranscriptOutcome(transcriptId, 'review', c.trade);
      setWalkStatus('info', 'Not sure that\'s an item — added to Review.');
    }
  } else if (c.type === 'safety' || c.type === 'quality') {
    logSafetyQuality(c.text, c.type, { trade: c.trade, location: c.location, via: 'voice', transcriptId: transcriptId, severity: c.severity });
    setTranscriptOutcome(transcriptId, c.type, c.trade);
  } else {
    const e = fileEntry({ text: c.text, type: c.type, trade: c.trade, costEstimate: c.costEstimate, location: c.location, verified: c.verified, via: 'voice', transcriptId: transcriptId, approval: c.type === 'change' ? (voiceApproval || 'Pending') : undefined, severity: c.severity });
    // Cost/location said in the raw sentence but dropped by AI cleanup.
    if (e.costEstimate == null && e.itemType !== 'rfi') { const cost = parseSpokenCost(rawText); if (cost != null) { e.costEstimate = cost; persistLists(); renderAllItems(); } }
    if (!e.location) { const loc = extractLocation(rawText); if (loc) { e.location = loc; persistLists(); renderAllItems(); } }
    setTranscriptOutcome(transcriptId, c.type, e.trade);
    setWalkStatus('ok', ({ punch: 'Punch item', change: 'Change order', rfi: 'RFI' })[c.type] + ' filed: ' + e.text);
  }
  // A photo held for this sentence is released (linked above, or left
  // unlinked if the sentence wasn't an item).
  if (transcriptId && photos.some(function (p) { return p.holdForId === transcriptId; })) {
    photos.forEach(function (p) {
      if (p.holdForId !== transcriptId) return;
      delete p.holdForId;
      // Neutral sentence: this photo is never sent for a tag.
      if (c.level === 'none' && !p.linkedItemText) skipPhotoTag(p, 'neutral sentence');
    });
    persistPhotos();
  }
}

function snapFromVideo(video) { if (!video || !video.videoWidth) return null; const max = 1280; const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight)); const c = document.createElement('canvas'); c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale); const ctx = c.getContext('2d'); if (!ctx) return null; ctx.drawImage(video, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }
// meta carries structured, timestamped provenance (how the shot was taken and
// the transcript that triggered it, if any) so a still can be matched back
// to both the spoken record and whatever punch/change/RFI item it links to.
function saveWalkPhoto(src, meta) { const item = Object.assign({ src: src, trade: tradeSelect.value, time: new Date().toLocaleString(), ts: Date.now(), source: 'manual' }, meta || {}); photos.push(item); if (!item.holdForId) tryLinkPhotoToRecentItem(item); persistPhotos(); renderPhotosTab(); setWalkStatus('ok', 'Photo tagged as ' + item.trade + ' (' + photos.length + ' total)'); if (!item.holdForId && !item.linkedItemText) waitForPhotoIssue(item); return item; }

/* ---------- Photo tag suggestions ---------- */
// Each walk photo goes to the Worker's /tag-photo route, which looks at the
// image itself and suggests a trade, whether it shows a safety or quality
// problem, and how urgent it looks. Nothing changes until someone confirms
// or overrides the suggestion on its card (Walk screen or Review tab). A
// suggestion that matches what's already tagged is recorded but not asked
// about. Plain fetch only: it never touches the camera, mic or recognition.
// Without a Worker URL (or with the Setup toggle off) photos keep the voice
// trade as before.
const PHOTO_KIND_LABEL = { trade: 'Trade only', safety: 'Safety hazard', quality: 'Quality issue' };
function photoTagEnabled() { return !!currentAiEndpoint() && loadJson(LS.photoTag, true) !== false; }
// Cost gate, under the Setup switch: a photo is sent only once it's tied to
// an issue — linked to an item the sentence filter filed (punch / change
// order / RFI / safety / quality) or put in Review. That happens when:
//   - "take a photo" is said inside an issue sentence (the held photo links
//     when that sentence is filed; a neutral sentence skips it for good), or
//   - the photo links to an item filed in the 60 s before or after it (the
//     existing link window), e.g. a Snap button shot or a bare "take a photo".
// A photo nothing links to within that window is skipped. The decision is
// made before any resize or upload. photo.tagGate: 'waiting' | 'sent' | 'skipped'.
function photoTagStats() { const s = loadJson(LS.photoTagStats, null); return s && typeof s === 'object' ? s : { sent: 0, skipped: 0 }; }
function countPhotoTag(kind) {
  const s = photoTagStats(); s[kind] = (s[kind] || 0) + 1; saveJson(LS.photoTagStats, s);
  if (currentWalk) { currentWalk.photoTags = currentWalk.photoTags || { sent: 0, skipped: 0 }; currentWalk.photoTags[kind]++; persistWalks(); }
  renderPhotoTagStats();
}
function renderPhotoTagStats() {
  const el = document.getElementById('photoTagStats');
  if (!el) return;
  const s = photoTagStats();
  el.textContent = 'Photo tag calls on this phone: ' + s.sent + ' sent, ' + s.skipped + ' skipped (no issue with the photo).' + (currentWalk && currentWalk.photoTags ? ' This walk: ' + currentWalk.photoTags.sent + ' sent, ' + currentWalk.photoTags.skipped + ' skipped.' : '');
}
function gatePhotoTag(photo) {
  if (!photoTagEnabled() || photo.tagGate === 'sent' || photo.tagGate === 'skipped' || photo.suggestion) return;
  photo.tagGate = 'sent';
  countPhotoTag('sent');
  console.log('[SiteWalk] photo tag: sending (linked to an issue)');
  requestPhotoTag(photo);
}
function skipPhotoTag(photo, reason) {
  if (!photoTagEnabled() || photo.tagGate === 'sent' || photo.tagGate === 'skipped') return;
  photo.tagGate = 'skipped';
  countPhotoTag('skipped');
  console.log('[SiteWalk] photo tag: skipped (' + reason + ')');
}
function waitForPhotoIssue(photo) {
  if (!photoTagEnabled()) return;
  photo.tagGate = 'waiting';
  setTimeout(function () { expirePhotoTagWait(photo); }, PHOTO_LINK_WINDOW_MS);
}
function expirePhotoTagWait(photo) {
  if (photo.tagGate !== 'waiting' || photos.indexOf(photo) === -1) return;
  delete photo.tagGate;
  skipPhotoTag(photo, 'no issue linked within 60 s');
  persistPhotos();
}
function shrinkForTagging(src, cb) {
  const img = new Image();
  img.onload = function () { const scale = Math.min(1, 768 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.6)); };
  img.onerror = function () { cb(src); };
  img.src = src;
}
function findItemForPhoto(photo) { return linkableItems().find(function (e) { return itemPhotos(e).indexOf(photo.src) !== -1; }) || null; }
function requestPhotoTag(photo) {
  if (!photoTagEnabled()) return;
  const endpoint = currentAiEndpoint();
  const headers = { 'Content-Type': 'application/json' };
  const key = currentAiKey(); if (key) headers['X-SiteWalk-Key'] = key;
  photo.suggestion = { status: 'pending' };
  shrinkForTagging(photo.src, function (small) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    fetch(endpoint + '/tag-photo', { method: 'POST', headers: headers, body: JSON.stringify({ image: small, trade: photo.trade, context: photo.transcriptText || photo.linkedItemText || '' }), signal: controller ? controller.signal : undefined })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (!data || data.error || !data.trade) throw new Error((data && data.error) || 'bad response');
        receivePhotoTag(photo, data);
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        console.warn('[SiteWalk] photo tag failed:', err && err.message);
        if (photos.indexOf(photo) !== -1) { delete photo.suggestion; persistPhotos(); }
      });
  });
}
function receivePhotoTag(photo, data) {
  if (photos.indexOf(photo) === -1) return; // deleted while waiting
  const kind = data.kind === 'safety' || data.kind === 'quality' ? data.kind : 'trade';
  const sug = {
    kind: kind,
    trade: TRADES.indexOf(data.trade) !== -1 ? data.trade : photo.trade,
    severity: validSeverity(data.severity) || (kind === 'safety' ? 'high' : 'medium'),
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
    observation: typeof data.observation === 'string' ? data.observation.trim() : ''
  };
  // Only ask when confirming would change something.
  const item = findItemForPhoto(photo);
  const current = item ? itemSeverity(item) : 'medium';
  const wouldChange = kind !== 'trade' || sug.trade !== photo.trade || (item && item.trade !== sug.trade) || severityRank(sug.severity) > severityRank(current);
  sug.status = wouldChange ? 'suggested' : 'agrees';
  photo.suggestion = sug;
  persistPhotos();
  renderPhotoTagQueue();
  renderPhotosTab();
  if (wouldChange) setWalkStatus('info', '📷 Photo looks like ' + (kind === 'trade' ? sug.trade : PHOTO_KIND_LABEL[kind].toLowerCase() + ' (' + sug.trade + ')') + ' — check it in Review.');
}
function pendingPhotoTags() { return photos.filter(function (p) { return p.suggestion && p.suggestion.status === 'suggested'; }); }
// Applies a confirmed tag to the photo and to the item it's linked to (if
// any). An unlinked safety/quality photo becomes its own Safety & Quality
// entry. A photo still waiting on its sentence (holdForId) keeps the tag and
// hands it over when it links (applyPhotoTagToItem from the link helpers).
function confirmPhotoTag(photo, choice) {
  const sug = photo.suggestion || {};
  photo.tag = { kind: choice.kind, trade: choice.trade, severity: choice.severity, by: (choice.kind === sug.kind && choice.trade === sug.trade && choice.severity === sug.severity) ? 'ai' : 'user', at: Date.now() };
  sug.status = photo.tag.by === 'ai' ? 'confirmed' : 'overridden';
  photo.suggestion = sug;
  photo.trade = choice.trade;
  const item = findItemForPhoto(photo);
  if (item) applyPhotoTagToItem(photo, item);
  else if (!photo.holdForId && choice.kind !== 'trade') {
    const e = logSafetyQuality(sug.observation || ('Photo flagged as ' + PHOTO_KIND_LABEL[choice.kind].toLowerCase()), choice.kind, { trade: choice.trade, photos: [photo.src], severity: choice.severity, via: 'photo' });
    photo.linkedItemText = itemDesc(e); photo.linkedItemTs = e.ts;
  }
  persistPhotos(); persistLinkable();
  renderPhotoTagQueue(); renderPhotosTab(); renderAllItems(); renderSafetyLogs(); renderReview(); renderSummary(); renderDashboard();
}
function applyPhotoTagToItem(photo, item) {
  const tag = photo.tag;
  if (!tag) return;
  item.trade = tag.trade; item.tradeBy = 'photo';
  item.severity = maxSeverity(itemSeverity(item), tag.severity);
  if (tag.kind === 'trade') return;
  item.photoFlag = tag.kind;
  // A borderline sentence plus a photo confirmed as a hazard is an item.
  // (A review item still being built is resolved by addReviewItem.)
  if (reviewItems.indexOf(item) !== -1) resolveReviewItem(item.id, tag.kind);
}
function dismissPhotoTag(photo) {
  if (photo.suggestion) photo.suggestion.status = 'dismissed';
  persistPhotos(); renderPhotoTagQueue(); renderPhotosTab();
}
function photoTagCard(photo) {
  const sug = photo.suggestion;
  const card = document.createElement('div');
  card.className = 'item-card photo-tag-card';
  const item = findItemForPhoto(photo);
  const conf = sug.confidence != null ? ' (' + Math.round(sug.confidence * 100) + '% sure)' : '';
  card.innerHTML = '<div class="photo-tag-head"><img src="' + photo.src + '" alt="Walk photo"><div><div><strong>📷 Photo suggests:</strong> ' + escapeHtml(sug.kind === 'trade' ? sug.trade : PHOTO_KIND_LABEL[sug.kind] + ' · ' + sug.trade) + ' ' + severityTagHtml(sug.severity) + '</div>'
    + (sug.observation ? '<div class="meta">' + escapeHtml(sug.observation) + conf + '</div>' : (conf ? '<div class="meta">' + conf + '</div>' : ''))
    + '<div class="meta">Tagged by voice: ' + escapeHtml(photo.trade) + (item ? ' · Linked to: ' + escapeHtml(itemDesc(item)) : ' · Not linked to an item') + '</div></div></div>';
  const row = document.createElement('div');
  row.className = 'photo-tag-controls';
  const mkSelect = function (opts, val, label) {
    const sel = document.createElement('select'); sel.setAttribute('aria-label', label);
    opts.forEach(function (o) { const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; sel.appendChild(op); });
    row.appendChild(sel); return sel;
  };
  const tradeSel = mkSelect(TRADES.map(function (t) { return [t, t]; }), sug.trade, 'Trade');
  const kindSel = mkSelect(Object.keys(PHOTO_KIND_LABEL).map(function (k) { return [k, PHOTO_KIND_LABEL[k]]; }), sug.kind, 'Tag');
  const sevSel = mkSelect(SEVERITY_LEVELS.slice().reverse().map(function (l) { return [l, 'Urgency: ' + SEVERITY_LABEL[l]]; }), sug.severity, 'Urgency');
  card.appendChild(row);
  const ok = document.createElement('button');
  ok.type = 'button'; ok.className = 'small green'; ok.textContent = 'Confirm';
  ok.onclick = function () { confirmPhotoTag(photo, { trade: tradeSel.value, kind: kindSel.value, severity: sevSel.value }); };
  const no = document.createElement('button');
  no.type = 'button'; no.className = 'small gray'; no.textContent = 'Keep as tagged';
  no.onclick = function () { dismissPhotoTag(photo); };
  card.appendChild(ok); card.appendChild(no);
  return card;
}
// The Walk screen only gets a one-line badge (no dropdowns over the live
// camera mid-walk); the cards themselves live in Walk → Review.
function renderPhotoTagQueue() {
  const pending = pendingPhotoTags().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  const walkWrap = document.getElementById('photoTagQueue');
  if (walkWrap) {
    walkWrap.innerHTML = '';
    if (pending.length) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'photo-tag-badge';
      btn.textContent = '📷 ' + pending.length + ' photo' + (pending.length > 1 ? 's need' : ' needs') + ' a look →';
      btn.onclick = function () { showWalkTab('review'); };
      walkWrap.appendChild(btn);
    }
  }
  const reviewWrap = document.getElementById('photoTagReviewList');
  if (reviewWrap) {
    reviewWrap.innerHTML = pending.length ? '<h3 class="photo-tag-title">Photo tag suggestions (' + pending.length + ')</h3>' : '';
    pending.forEach(function (p) { reviewWrap.appendChild(photoTagCard(p)); });
  }
  updateReviewBadge();
}
function updateReviewBadge() {
  const badge = document.getElementById('reviewCount');
  const n = reviewItems.length + pendingPhotoTags().length;
  if (badge) { badge.textContent = n ? String(n) : ''; badge.style.display = n ? '' : 'none'; }
}

// Voice-triggered snap runs entirely off the live <video> element and never
// touches `recognition` (no stop/start) — a "take a photo" trigger must not
// interrupt or restart continuous listening.
let lastSnapTriggerAt = 0;
const SNAP_TRIGGER_COOLDOWN_MS = 1500;
function voiceTriggeredSnap(transcriptText, opts) {
  opts = opts || {};
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
  const meta = { source: 'voice', transcriptText: transcriptText };
  if (opts.transcriptId) meta.transcriptId = opts.transcriptId;
  if (opts.holdForItem) meta.holdForId = opts.transcriptId;
  const item = saveWalkPhoto(src, meta);
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
          handleFinalUtterance(transcript);
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
        handleFinalUtterance(text);
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
  leaseWalkContext = null;
  stopVideoRecording();
  stopWalkCamera();
  stopWalkVoice();
  const btn = document.getElementById('walkBtn');
  btn.classList.remove('recording');
  btn.innerHTML = 'Start<br>Walk-Around';
  document.getElementById('stopWalkBtn').classList.remove('visible');
  document.getElementById('walkHero').style.display = '';
  document.getElementById('walkStage').classList.remove('active');
  // The report is manual only: tap Generate Report when ready.
  setWalkStatus('info', 'Walk ended.' + (reviewItems.length ? ' ' + reviewItems.length + ' item(s) waiting in Review.' : '') + ' Tap Generate Report when you\'re ready.');
};
document.getElementById('walkBtn').addEventListener('click', function () { walkActive ? takePhoto() : window.startWalk(); });
document.getElementById('stopWalkBtn').addEventListener('click', function () { window.endWalk(); });
// "Start Lease Walk" — opens the same Chapter 1 walk-around engine with
// context already set to the selected unit, no new capture tooling. Setting
// leaseWalkContext before calling window.startWalk() is the only hook into
// the shared engine; camera/mic/listening code above is untouched.
function startLeaseWalk(unitId) {
  const unit = units.find(function (u) { return u.id === unitId; });
  if (!unit) { alert('Select a unit first.'); return; }
  const property = properties.find(function (p) { return p.id === unit.propertyId; });
  leaseWalkContext = { unitId: unit.id, propertyId: unit.propertyId };
  showTab('walk');
  if (!walkActive) window.startWalk();
  setWalkStatus('ok', 'Lease walk — ' + (property ? property.name + ' · ' : '') + unit.label + '. Camera + AI listening.');
}
function takePhoto() { const fromLive = walkStream ? snapFromVideo(document.getElementById('walkVideo')) : null; if (fromLive) { saveWalkPhoto(fromLive); return; } document.getElementById('photoInput').click(); }
document.getElementById('shutterBtn').addEventListener('click', takePhoto);
document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedPhotos);
document.getElementById('generateSummaryBtn').addEventListener('click', function () { renderSummary(); showWalkTab('summary'); });
document.getElementById('walkGenerateReportBtn').addEventListener('click', function () { showTab('report'); window.generateReport(); });
document.getElementById('walkRecordBtn').addEventListener('click', toggleRecordingNote);
document.getElementById('photoInput').addEventListener('change', function (e) { const files = e.target.files; if (!files || !files.length) return; for (let f of files) { const r = new FileReader(); r.onload = function (ev) { compressImage(ev.target.result, saveWalkPhoto); }; r.readAsDataURL(f); } e.target.value = ''; });
document.getElementById('saveVideoToggle').addEventListener('change', function (e) { saveJson(LS.saveVideo, !!e.target.checked); });
document.getElementById('lightboxClose').addEventListener('click', function () { document.getElementById('lightbox').classList.remove('open'); });
document.getElementById('lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') document.getElementById('lightbox').classList.remove('open'); });
function persistSiteInfo() {
  const name = document.getElementById('siteName').textContent.trim(), address = document.getElementById('siteAddress').textContent.trim();
  saveJson(LS.siteName, name); saveJson(LS.siteAddress, address);
  const job = currentJob();
  if (job) { if (name && name !== 'Job Site') job.name = name; job.address = address === 'Tap to add address' ? '' : address; persistJobs(); renderJobTabs(); }
}
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
// Every clock event gets ts, a method (manual/gps), and the latest GPS fix
// if it's under 2 minutes old, with distance to the nearest set site.
// A manual punch from the truck shows up as "412 m from site" instead of
// passing as on-site.
function clockGpsStamp() {
  if (!lastGeoFix || Date.now() - lastGeoFix.ts > 120000) return null;
  const near = nearestGeoSite(lastGeoFix);
  return { lat: lastGeoFix.lat, lng: lastGeoFix.lng, acc: Math.round(lastGeoFix.acc), site: near ? near.site.name : null, distM: near ? Math.round(near.dist) : null, onSite: near ? near.dist <= near.site.radius : null };
}
function pushClockEvent(employee, site, type, extra) {
  const d = extra && extra.ts ? new Date(extra.ts) : new Date();
  const ev = { employee: employee, site: site, type: type, time: d.toLocaleString(), ts: d.getTime(), flagged: false, method: 'manual', gps: clockGpsStamp() };
  Object.keys(extra || {}).forEach(function (k) { ev[k] = extra[k]; });
  clockEvents.push(ev);
  persistClock(); checkMissedClockOuts(); renderClockLog(); renderClockFlagged(); renderDashboard();
  renderLaborCost(); renderBudgetSummary();
}
function logClockEvent(type) {
  const employee = document.getElementById('clockEmployee').value.trim();
  const site = document.getElementById('clockSite').value.trim();
  if (!employee || !site) { alert('Enter your name and job site first.'); return; }
  pushClockEvent(employee, site, type);
}
// The site this employee is currently clocked in at, or null.
function openClockSite(employee) {
  const mine = clockEvents.filter(function (e) { return e.employee === employee; }).sort(function (a, b) { return clockMs(a) - clockMs(b); });
  const last = mine[mine.length - 1];
  return last && last.type === 'in' ? last.site : null;
}

/* ---------- GPS auto clock-in (foreground only) ---------- */
// No geocoding key: a site's location is captured by standing on it and
// tapping "Set location". While the app is open and auto clock is on, a
// watchPosition fix inside a site's radius clocks the named employee in;
// being outside it for GEO_BUFFER_MS clocks them out. Browsers suspend GPS
// in background tabs, so a gap in fixes is recorded (gapMin) and anything
// over 10 min is marked for review. A native wrapper (Capacitor) is what
// fixes that, parked for later.
const GEO_RADIUS_M = 100, GEO_BUFFER_MS = 5 * 60 * 1000, GEO_MAX_ACC_M = 150;
let autoClockWatch = null, autoClockTick = null, lastGeoFix = null;
const geoState = {}; // siteId -> { inside, leftAt }
function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function nearestGeoSite(fix) {
  let best = null;
  geoSites.forEach(function (site) { const d = distanceM(fix, site); if (!best || d < best.dist) best = { site: site, dist: d }; });
  return best;
}
function setGeoStatus(cls, msg) {
  const el = document.getElementById('geoStatus');
  if (!el) return;
  el.style.display = msg ? 'block' : 'none'; el.className = 'status ' + cls; el.textContent = msg || '';
}
function getGeoFix(timeoutMs) {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) { reject(new Error('This browser has no GPS access.')); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, ts: Date.now() });
    }, function (err) { reject(new Error(err.code === 1 ? 'Location permission denied — allow it in browser settings.' : 'Could not get a GPS fix — try again outside.')); },
    { enableHighAccuracy: true, timeout: timeoutMs || 15000, maximumAge: 0 });
  });
}
function renderGeoSites() {
  const wrap = document.getElementById('geoSiteList');
  if (!wrap) return;
  const toggle = document.getElementById('autoClockToggle');
  if (toggle) toggle.checked = !!autoClock.enabled;
  if (!geoSites.length) { wrap.innerHTML = '<p class="hint">No site locations set yet.</p>'; return; }
  wrap.innerHTML = geoSites.map(function (g) {
    return '<div class="item-card" data-geo-id="' + g.id + '"><strong>' + escapeHtml(g.name) + '</strong><div class="meta">' + g.lat.toFixed(5) + ', ' + g.lng.toFixed(5) + ' · ' + g.radius + ' m radius · set ±' + Math.round(g.acc || 0) + ' m</div>'
      + '<button type="button" class="small gray geo-remove-btn">Remove</button></div>';
  }).join('');
  wrap.querySelectorAll('.geo-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.closest('[data-geo-id]').getAttribute('data-geo-id');
      geoSites = geoSites.filter(function (g) { return g.id !== id; }); delete geoState[id];
      persistGeoSites(); renderGeoSites();
    });
  });
}
document.getElementById('geoSetSiteBtn').addEventListener('click', function () {
  const name = document.getElementById('clockSite').value.trim();
  if (!name) { alert('Type the job site name in the box above first.'); return; }
  setGeoStatus('info', 'Getting a GPS fix…');
  getGeoFix(20000).then(function (fix) {
    if (fix.acc > GEO_MAX_ACC_M) { setGeoStatus('err', 'GPS is only accurate to ±' + Math.round(fix.acc) + ' m right now — step outside and try again.'); return; }
    const existing = geoSites.find(function (g) { return g.name.toLowerCase() === name.toLowerCase(); });
    const site = existing || { id: 'g_' + Date.now().toString(36), name: name, radius: GEO_RADIUS_M };
    site.lat = fix.lat; site.lng = fix.lng; site.acc = fix.acc; site.setAt = new Date().toISOString();
    if (!existing) geoSites.push(site);
    lastGeoFix = fix;
    persistGeoSites(); renderGeoSites();
    setGeoStatus('ok', 'Location set for ' + name + ' (±' + Math.round(fix.acc) + ' m).');
  }).catch(function (e) { setGeoStatus('err', e.message); });
});
// fromTick: re-checking the last real fix on the 30s timer. That must not
// count as a new fix, or the background-gap detection is lost.
function evaluateGeo(fix, fromTick) {
  const employee = autoClock.employee;
  if (!autoClock.enabled || !employee) return;
  const now = Date.now();
  // A long gap between fixes means the app was backgrounded/closed.
  const gapMin = !fromTick && lastGeoFix ? Math.round((fix.ts - lastGeoFix.ts) / 60000) : 0;
  if (!fromTick) lastGeoFix = fix;
  if (fix.acc > GEO_MAX_ACC_M) { setGeoStatus('info', 'Auto clock on for ' + employee + ' — waiting for a better GPS fix (±' + Math.round(fix.acc) + ' m).'); return; }
  let msg = '';
  geoSites.forEach(function (site) {
    const st = geoState[site.id] || (geoState[site.id] = { inside: openClockSite(employee) === site.name, leftAt: null });
    const inside = distanceM(fix, site) <= site.radius;
    const open = openClockSite(employee);
    if (inside) {
      st.inside = true; st.leftAt = null;
      if (!open) { pushClockEvent(employee, site.name, 'in', { method: 'gps', gapMin: gapMin }); msg = 'Auto clocked in at ' + site.name + '.'; }
      else if (open === site.name) msg = msg || 'On site at ' + site.name + ' — clocked in.';
      else msg = msg || 'At ' + site.name + ' but still clocked in at ' + open + ' — clock out there first.';
    } else if (st.inside) {
      st.inside = false; st.leftAt = now;
    }
    if (!inside && st.leftAt && open === site.name) {
      if (now - st.leftAt >= GEO_BUFFER_MS) {
        pushClockEvent(employee, site.name, 'out', { method: 'gps', gapMin: gapMin, review: gapMin > 10 });
        st.leftAt = null; msg = 'Auto clocked out of ' + site.name + '.';
      } else msg = msg || 'Left ' + site.name + ' — clocking out in ' + Math.ceil((GEO_BUFFER_MS - (now - st.leftAt)) / 60000) + ' min unless you return.';
    }
  });
  setGeoStatus('ok', msg || ('Auto clock on for ' + employee + ' — not at a set site.'));
}
function startAutoClock() {
  if (!navigator.geolocation) { setGeoStatus('err', 'This browser has no GPS access.'); return; }
  stopAutoClock();
  autoClockWatch = navigator.geolocation.watchPosition(function (pos) {
    evaluateGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, ts: Date.now() });
  }, function (err) { setGeoStatus('err', err.code === 1 ? 'Location permission denied — auto clock can\'t run.' : 'GPS signal lost — retrying.'); },
  { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  // watchPosition only fires on movement; the tick lets the 5-min
  // leave buffer expire while someone sits still off-site.
  autoClockTick = setInterval(function () { if (lastGeoFix) evaluateGeo(lastGeoFix, true); }, 30000);
  setGeoStatus('info', 'Auto clock on for ' + autoClock.employee + ' — getting GPS…');
}
function stopAutoClock() {
  if (autoClockWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(autoClockWatch);
  autoClockWatch = null; clearInterval(autoClockTick); autoClockTick = null;
}
document.getElementById('autoClockToggle').addEventListener('change', function (ev) {
  if (ev.target.checked) {
    const employee = document.getElementById('clockEmployee').value.trim() || autoClock.employee;
    if (!employee) { alert('Enter your name above first.'); ev.target.checked = false; return; }
    if (!geoSites.length) { alert('Set at least one job site location first.'); ev.target.checked = false; return; }
    autoClock = { enabled: true, employee: employee };
    startAutoClock();
  } else {
    autoClock.enabled = false; stopAutoClock(); setGeoStatus('info', 'Auto clock off.');
  }
  persistAutoClock();
});
// Coming back to the foreground: grab a fresh fix right away instead of
// waiting for the (possibly suspended) watcher.
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible' || !autoClock.enabled) return;
  if (autoClockWatch == null) startAutoClock();
  getGeoFix(15000).then(function (fix) { evaluateGeo(fix); }).catch(function () { });
});

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
document.getElementById('addSubContractBtn').addEventListener('click', function () {
  const name = document.getElementById('subContractName').value.trim();
  const trade = document.getElementById('subContractTrade').value.trim();
  const amount = parseFloat(document.getElementById('subContractAmount').value);
  if (!name || isNaN(amount) || amount <= 0) { alert('Enter the sub and a contract amount first.'); return; }
  subContracts.push({ id: 'sc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), name: name, trade: trade, amount: amount, pctComplete: 0, payments: [], created: new Date().toISOString() });
  persistSubContracts(); renderLaborCost(); renderBudgetSummary();
  ['subContractName', 'subContractTrade', 'subContractAmount'].forEach(function (id) { document.getElementById(id).value = ''; });
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
    const stamp = nowStamp();
    safetyLogs.push({ type: type, desc: desc, person: person, action: action, photo: photoSrc || null, photos: photoSrc ? [photoSrc] : [], time: stamp.time, ts: stamp.ts, iso: stamp.iso, source: 'manual', severity: scoreSeverity(desc + ' ' + type, type === 'Quality Issue' ? 'quality' : 'safety') });
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
// Walk-scoped log (transcript/punches/costs/safety captured during one
// walk, never mixed with another walk's). Defaults to the active walk, or
// the most recently ended one if none is active; the select lets the crew
// look back at an older walk without that becoming the default view.
function renderWalkLogSection() {
  if (!walks.length) return '';
  const walkToShow = (selectedWalkId && walks.find(function (w) { return w.id === selectedWalkId; })) || currentWalk || walks[walks.length - 1];
  if (!walkToShow) return '';
  let html = '<div class="report-section"><h3>Walk Transcript (full record)</h3>';
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
  if (walkToShow.transcript.length) {
    html += '<div class="punch-item"><strong>Transcript</strong></div>';
    walkToShow.transcript.forEach(function (t) { html += '<div class="punch-item">[' + escapeHtml(new Date(t.iso).toLocaleTimeString()) + '] ' + escapeHtml(t.text) + (t.outcome && OUTCOME_LABEL[t.outcome] ? ' <em class="rpt-outcome">— ' + OUTCOME_LABEL[t.outcome] + '</em>' : '') + '</div>'; });
  }
  if (walkToShow.punches.length) {
    html += '<div class="punch-item"><strong>Punch Items (this walk)</strong></div>';
    walkToShow.punches.forEach(function (p) { html += '<div class="punch-item">[' + escapeHtml(p.iso) + '] ' + escapeHtml(p.text) + '</div>'; });
  }
  if (walkToShow.costs.length) {
    const total = walkToShow.costs.reduce(function (s, c) { return s + c.amount; }, 0);
    html += '<div class="punch-item"><strong>Cost Tallies (this walk)</strong> — Total: $' + total.toLocaleString() + '</div>';
    walkToShow.costs.forEach(function (c) { html += '<div class="punch-item">[' + escapeHtml(c.iso) + '] $' + c.amount.toLocaleString() + ' — ' + escapeHtml(c.text) + '</div>'; });
  }
  if (walkToShow.safety.length) {
    html += '<div class="punch-item"><strong>Safety Flags (this walk)</strong></div>';
    walkToShow.safety.forEach(function (s) { html += '<div class="punch-item">[' + escapeHtml(s.iso) + '] ' + escapeHtml(s.text) + '</div>'; });
  }
  return html + '</div>';
}
// One report row: the item, its details, and its photos inline. A single
// photo sits beside the text; several show as a row of small photos.
function reportItemRow(text, metaParts, photoList, severity) {
  const meta = metaParts.filter(Boolean).map(escapeHtml).join(' · ');
  let h = '<div class="rpt-item"><div class="rpt-item-body"><div class="rpt-item-text">' + (severity ? severityTagHtml(severity) + ' ' : '') + escapeHtml(text) + '</div>' + (meta ? '<div class="rpt-item-meta">' + meta + '</div>' : '') + '</div>';
  if (photoList.length === 1) h += '<img class="rpt-photo-single" src="' + photoList[0] + '" alt="Item photo">';
  else if (photoList.length > 1) h += '<div class="rpt-photo-row">' + photoList.map(function (src) { return '<img src="' + src + '" alt="Item photo">'; }).join('') + '</div>';
  return h + '</div>';
}
// Items already shown in "Most Urgent First" (pinned) are not repeated;
// the heading says how many of this list are up there.
function reportItemSection(title, arr, metaFn, pinned) {
  if (!arr.length) return '';
  const rest = arr.filter(function (e) { return !pinned || pinned.indexOf(e) === -1; });
  const above = arr.length - rest.length;
  // Most urgent first (open before closed), capture order breaks ties.
  const sorted = rest.sort(byUrgency);
  let h = '<div class="report-section"><h3>' + title + ' (' + arr.length + ')' + (above ? ' <span class="rpt-above">' + above + ' listed above</span>' : '') + '</h3>';
  sorted.forEach(function (e) { h += reportItemRow(itemDesc(e), metaFn(e).concat(photoTagMeta(e)), itemPhotos(e), itemSeverity(e)); });
  if (!sorted.length) h += '<div class="rpt-item-meta">All listed above.</div>';
  return h + '</div>';
}
function money0(n) { return n != null ? '$' + Number(n).toLocaleString() : ''; }
function itemLocMeta(e) { return [e.location ? 'Location: ' + e.location : '', e.drawingRef ? 'Sheet ' + e.drawingRef : '']; }
function photoTagMeta(e) { return [e.photoFlag ? 'Photo flagged: ' + (e.photoFlag === 'quality' ? 'Quality' : 'Safety') : '', e.tradeBy === 'photo' ? 'Trade from photo' : '']; }
// Top of the report: every open Critical/High item across all lists, worst
// first, with full details and photos. Each is listed here only, not again
// in its own section. lists = [[label, items, metaFn], ...]
function reportUrgentSection(lists) {
  const rows = [];
  lists.forEach(function (l) { l[1].forEach(function (e) { if (!isItemClosed(e) && severityRank(itemSeverity(e)) >= severityRank('high')) rows.push({ e: e, label: l[0], meta: l[2] }); }); });
  rows.sort(function (a, b) { return byUrgency(a.e, b.e); });
  let h = '<div class="report-section rpt-urgent"><h3>Most Urgent First (' + rows.length + ')</h3>';
  if (!rows.length) return { html: h + '<div class="rpt-item-meta">Nothing open is flagged Critical or High.</div></div>', pinned: [] };
  rows.forEach(function (r) { h += reportItemRow(itemDesc(r.e), [r.label].concat(r.meta(r.e), photoTagMeta(r.e)), itemPhotos(r.e), itemSeverity(r.e)); });
  return { html: h + '</div>', pinned: rows.map(function (r) { return r.e; }) };
}
// Manual only: runs when someone taps Generate Report (Walk screen, Report
// tab, or the Home gold button), never on its own when a walk ends.
window.generateReport = function () {
  const siteName = document.getElementById('siteName').textContent.trim();
  const siteAddress = document.getElementById('siteAddress').textContent.trim();
  let html = '<div style="text-align:center"><strong>SiteWalk Report</strong><br>' + escapeHtml(siteName) + (siteAddress && siteAddress !== 'Tap to add address' ? '<br>' + escapeHtml(siteAddress) : '') + '<br>' + new Date().toLocaleString() + '</div>';
  const punchMeta = function (i) { return [i.trade].concat(itemLocMeta(i), [i.costEstimate != null ? 'Est. ' + money0(i.costEstimate) : '', i.resolved ? 'Resolved' : 'Open']); };
  const coMeta = function (i) { return [i.trade].concat(itemLocMeta(i), ['Est. ' + (i.costEstimate != null ? money0(i.costEstimate) : '?'), 'Client: ' + (i.approval || 'Pending')]); };
  const rfiMeta = function (i) { return [i.trade].concat(itemLocMeta(i), [i.status || 'Open']); };
  const safetyMeta = function (s) { return [s.type, s.trade].concat(itemLocMeta(s), [s.person ? 'Involved: ' + s.person : '', s.action ? 'Action: ' + s.action : '', s.time]); };
  const reviewMeta = function (r) { return [r.trade].concat(itemLocMeta(r), [r.costEstimate != null ? 'Est. ' + money0(r.costEstimate) : '', r.time]); };
  const urgent = reportUrgentSection([['Punch', punch, punchMeta], ['Change order', changes, coMeta], ['RFI', rfis, rfiMeta], ['Safety & Quality', safetyLogs, safetyMeta], ['Needs review', reviewItems, reviewMeta]]);
  html += urgent.html;
  html += reportItemSection('Punch List', punch, punchMeta, urgent.pinned);
  html += reportItemSection('Change Orders', changes, coMeta, urgent.pinned);
  html += reportItemSection('RFIs', rfis, rfiMeta, urgent.pinned);
  html += reportItemSection('Safety &amp; Quality', safetyLogs, safetyMeta, urgent.pinned);
  html += reportItemSection('Needs Review (not on the punch list yet)', reviewItems, reviewMeta, urgent.pinned);
  // Photos not attached to any item, with what was being said when taken.
  const used = {};
  linkableItems().forEach(function (e) { itemPhotos(e).forEach(function (src) { used[src] = true; }); });
  const tagRank = function (p) { return p.tag ? severityRank(p.tag.severity) : -1; };
  const loose = photos.filter(function (p) { return !used[p.src]; }).sort(function (a, b) { return (tagRank(b) - tagRank(a)) || (photoTs(a) - photoTs(b)); });
  if (loose.length) {
    html += '<div class="report-section"><h3>Other Photos (' + loose.length + ')</h3><div class="rpt-loose-grid">';
    loose.forEach(function (p) {
      const caption = (p.transcriptText ? '“' + p.transcriptText + '” · ' : '') + (p.trade || '') + (p.tag && p.tag.kind !== 'trade' ? ' · ' + (p.tag.kind === 'quality' ? 'Quality' : 'Safety') : '') + (p.tag && p.tag.severity ? ' · Urgency ' + SEVERITY_LABEL[p.tag.severity] : '') + ' · ' + (p.time || '');
      html += '<figure class="rpt-loose"><img src="' + p.src + '" alt="Walk photo"><figcaption>' + escapeHtml(caption) + '</figcaption></figure>';
    });
    html += '</div></div>';
  }
  if (submittals.length) { html += '<div class="report-section"><h3>Submittals</h3>'; submittals.forEach(function (s) { html += '<div class="punch-item">[' + (s.trade || 'General') + '] ' + s.item + ' — ' + s.status + '</div>'; }); html += '</div>'; }
  if (dailyLogs.length) { html += '<div class="report-section"><h3>Daily Logs</h3>'; dailyLogs.forEach(function (l) { html += '<div class="punch-item">' + l.date + ' — ' + l.weather + ' — Crew: ' + (l.crewCount || 'N/A') + (l.trades ? ' — ' + l.trades : '') + (l.delays ? ' — Delays: ' + l.delays : '') + '</div>'; }); html += '</div>'; }
  if (invoices.length) {
    html += '<div class="report-section"><h3>Invoices</h3>';
    invoices.forEach(function (inv) { const t = invoiceTotals(inv); html += '<div class="punch-item">' + escapeHtml(inv.number) + ' — ' + escapeHtml(inv.client.name || 'No client') + ' — ' + money2(t.due) + ' due, ' + money2(t.paid) + ' paid (' + invoiceStatus(inv).label + ')</div>'; });
    const o = invoiceOutstanding(invoices);
    html += '<div class="punch-item">Invoiced ' + money2(o.invoiced) + ' · Collected ' + money2(o.paid) + ' · Outstanding ' + money2(o.balance) + '</div></div>';
  }
  const missedClockOuts = clockEvents.filter(function (e) { return e.flagged; });
  if (missedClockOuts.length) { html += '<div class="report-section"><h3>Missed Clock-Outs</h3>'; missedClockOuts.forEach(function (e) { html += '<div class="punch-item">' + e.employee + ' — ' + e.site + ' (in ' + e.time + ')</div>'; }); html += '</div>'; }
  const laborRows = laborCostByEmployee();
  if (laborRows.length || subContracts.length || materials.length) {
    html += '<div class="report-section"><h3>Job Cost Summary</h3>';
    if (laborRows.length) {
      html += '<div class="punch-item"><strong>Labor</strong></div>';
      laborRows.forEach(function (r) { html += '<div class="punch-item">' + escapeHtml(r.name) + ' — ' + r.hours.toFixed(2) + ' hrs' + (r.payType === 'hourly' ? ' @ $' + r.rate.toFixed(2) + '/hr = $' + r.cost.toFixed(2) : ' (flat contract)') + '</div>'; });
    }
    if (subContracts.length) {
      html += '<div class="punch-item"><strong>Flat-Contract Subs</strong></div>';
      subContracts.forEach(function (c) { html += '<div class="punch-item">' + escapeHtml(c.name) + (c.trade ? ' [' + escapeHtml(c.trade) + ']' : '') + ' — $' + (c.amount || 0).toFixed(2) + ' contract, ' + (c.pctComplete || 0) + '% complete, paid $' + contractPaid(c).toFixed(2) + ', cost to date $' + contractCostToDate(c).toFixed(2) + (contractOwed(c) > 0.005 ? ', owed $' + contractOwed(c).toFixed(2) : '') + '</div>'; });
    }
    if (laborRows.length || subContracts.length) html += '<div class="punch-item">Labor Total: $' + totalLaborCost().toFixed(2) + ' (hourly $' + totalHourlyLaborCost().toFixed(2) + ' + contracts $' + totalContractLaborCost().toFixed(2) + ')</div>';
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
  // The full transcript stays on the report as the record of the walk.
  html += renderWalkLogSection();
  document.getElementById('report').innerHTML = html;
  const walkSel = document.getElementById('walkLogSelect');
  if (walkSel) walkSel.addEventListener('change', function () { selectedWalkId = walkSel.value; window.generateReport(); });
};
document.getElementById('genBtn').addEventListener('click', window.generateReport);
document.getElementById('printBtn').addEventListener('click', function () { document.body.classList.remove('printing-invoice'); window.generateReport(); setTimeout(function () { window.print(); }, 300); });
function clearAllData() {
  if (!confirm('Clear ALL SiteWalk data on this phone?\n\nThis permanently deletes every job and every photo, note, punch item, change order, RFI, submittal, safety log, clock/daily log entry, trade contact, wage rate, flat sub contract, GPS site location, material expense, job budget, uploaded drawing, and your AI Worker setup. This can\'t be undone.')) return;
  // Every job's keys go, then a reload rebuilds a fresh default job; no
  // in-memory reset needed.
  stopAutoClock();
  const doomed = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isAppKey(k)) doomed.push(k); }
  doomed.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
  alert('All SiteWalk data cleared, including every job.');
  location.reload();
}
document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

/* ---------- Ch. 5 Invoicing ---------- */
// Invoices belong to the current job (swInvoices is job-scoped). Business
// details and the invoice number sequence are shared, so numbers never
// repeat across jobs. Money math: subtotal = Σ qty × rate; tax = subtotal ×
// tax%; total = subtotal + tax; holdback (e.g. a lien holdback) = subtotal ×
// holdback%, kept back by the client until later; due now = total − holdback.
// An approved change order pulled onto an invoice is marked with invoiceId
// (linked back by its ts) so it isn't billed twice. Deleting the line or the
// invoice frees it again.
let invoices = [], business = {}, editingInvoiceId = null;
function persistInvoices() { saveJson(LS.invoices, invoices); }
function money2(n) { return '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoPlusDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function unbilledChangeOrders() { return changes.filter(function (c) { return c.approval === 'Approved' && !c.invoiceId; }); }
function invoiceTotals(inv) {
  const subtotal = (inv.lines || []).reduce(function (t, l) { return t + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0); }, 0);
  const tax = subtotal * (parseFloat(inv.taxPct) || 0) / 100;
  const holdback = subtotal * (parseFloat(inv.holdbackPct) || 0) / 100;
  const total = subtotal + tax, due = total - holdback;
  const paid = (inv.payments || []).reduce(function (t, p) { return t + (p.amount || 0); }, 0);
  return { subtotal: subtotal, tax: tax, holdback: holdback, total: total, due: due, paid: paid, balance: Math.max(0, due - paid) };
}
function invoiceStatus(inv) {
  const t = invoiceTotals(inv);
  if (!inv.sentAt) return { key: 'draft', label: 'Draft' };
  if (t.due > 0 && t.balance <= 0.005) return { key: 'paid', label: 'Paid' };
  if (inv.dueDate && inv.dueDate < isoToday()) return { key: 'overdue', label: 'Overdue' };
  if (t.paid > 0) return { key: 'partial', label: 'Part paid' };
  return { key: 'sent', label: 'Sent' };
}
// Drafts don't count as money owed yet.
function invoiceOutstanding(list) {
  const out = { invoiced: 0, paid: 0, balance: 0, overdue: 0 };
  (list || []).forEach(function (inv) {
    if (!inv.sentAt) return;
    const t = invoiceTotals(inv);
    out.invoiced += t.due; out.paid += t.paid; out.balance += t.balance;
    if (invoiceStatus(inv).key === 'overdue') out.overdue++;
  });
  return out;
}
function fillBusinessForm() {
  [['bizName', 'name'], ['bizAddress', 'address'], ['bizContact', 'contact'], ['bizTaxNo', 'taxNo'], ['bizTerms', 'terms']].forEach(function (f) {
    const el = document.getElementById(f[0]); if (el) el.value = business[f[1]] || '';
  });
}
document.getElementById('saveBizBtn').addEventListener('click', function () {
  business = { name: document.getElementById('bizName').value.trim(), address: document.getElementById('bizAddress').value.trim(), contact: document.getElementById('bizContact').value.trim(), taxNo: document.getElementById('bizTaxNo').value.trim(), terms: document.getElementById('bizTerms').value.trim() };
  saveJson(LS.business, business);
  document.querySelector('.invoice-business').open = false;
});
function editingInvoice() { return invoices.find(function (i) { return i.id === editingInvoiceId; }) || null; }
document.getElementById('newInvoiceBtn').addEventListener('click', function () {
  const seq = (loadJson(LS.invoiceSeq, 0) || 0) + 1;
  saveJson(LS.invoiceSeq, seq);
  const last = invoices[invoices.length - 1];
  const today = isoToday();
  const inv = {
    id: 'inv_' + Date.now().toString(36), number: 'INV-' + String(seq).padStart(4, '0'), date: today, dueDate: isoPlusDays(today, 30),
    client: last ? Object.assign({}, last.client) : { name: '', email: '', address: '' },
    lines: [], taxPct: last ? last.taxPct : 5, holdbackPct: last ? last.holdbackPct : 0, notes: '', payments: [], sentAt: null, created: new Date().toISOString()
  };
  invoices.push(inv); persistInvoices();
  editingInvoiceId = inv.id;
  renderInvoices();
  document.getElementById('invoiceEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
function renderInvoiceEditor() {
  const wrap = document.getElementById('invoiceEditor');
  const inv = editingInvoice();
  if (!inv) { wrap.innerHTML = ''; return; }
  const esc = function (v) { return escapeHtml(v == null ? '' : v); };
  const unbilled = unbilledChangeOrders();
  let html = '<div class="inv-editor"><h3>' + esc(inv.number) + ' <span class="type-tag inv-' + invoiceStatus(inv).key + '">' + invoiceStatus(inv).label + '</span></h3>'
    + '<input type="text" data-f="client.name" placeholder="Client name" value="' + esc(inv.client.name) + '">'
    + '<input type="email" data-f="client.email" placeholder="Client email" value="' + esc(inv.client.email) + '">'
    + '<textarea data-f="client.address" placeholder="Client address">' + esc(inv.client.address) + '</textarea>'
    + '<div class="inv-row"><label class="hint">Invoice date<input type="date" data-f="date" value="' + esc(inv.date) + '"></label><label class="hint">Due date<input type="date" data-f="dueDate" value="' + esc(inv.dueDate) + '"></label></div>'
    + '<h3>Lines</h3>';
  inv.lines.forEach(function (l, i) {
    html += '<div class="inv-line"><input type="text" class="inv-line-desc" data-line="' + i + '" data-lf="desc" placeholder="Description" value="' + esc(l.desc) + '">'
      + '<div class="inv-row"><input type="number" step="any" min="0" data-line="' + i + '" data-lf="qty" placeholder="Qty" value="' + esc(l.qty) + '">'
      + '<input type="number" step="0.01" data-line="' + i + '" data-lf="rate" placeholder="Rate $" value="' + esc(l.rate) + '">'
      + '<button type="button" class="small gray inv-line-del" data-act="del-line" data-i="' + i + '" aria-label="Remove line">✕</button></div>'
      + '<div class="inv-line-amt" data-amt="' + i + '">' + money2((parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)) + '</div></div>';
  });
  if (!inv.lines.length) html += '<p class="hint">No lines yet.</p>';
  html += '<div class="inv-actions"><button type="button" class="gray" data-act="add-line">+ Add Line</button>'
    + '<button type="button" class="gray" data-act="add-cos"' + (unbilled.length ? '' : ' disabled') + '>+ Approved COs (' + unbilled.length + ')</button></div>'
    + '<div class="inv-row"><label class="hint">Tax % (GST/HST)<input type="number" step="0.01" min="0" data-f="taxPct" value="' + esc(inv.taxPct) + '"></label>'
    + '<label class="hint">Holdback %<input type="number" step="0.01" min="0" data-f="holdbackPct" value="' + esc(inv.holdbackPct) + '"></label></div>'
    + '<textarea data-f="notes" placeholder="Notes printed on the invoice (optional)">' + esc(inv.notes) + '</textarea>'
    + '<div class="inv-totals" id="invTotals"></div>'
    + '<div class="inv-actions">'
    + (inv.sentAt ? '' : '<button type="button" class="green" data-act="sent">Mark as Sent</button>')
    + '<button type="button" class="orange" data-act="print">Print / Save PDF</button>'
    + '<button type="button" class="gray" data-act="email">Email Summary</button>'
    + '<button type="button" class="gray" data-act="close">Done</button>'
    + '<button type="button" class="red" data-act="delete">Delete Invoice</button></div></div>';
  wrap.innerHTML = html;
  renderInvoiceTotals();
}
function renderInvoiceTotals() {
  const el = document.getElementById('invTotals'), inv = editingInvoice();
  if (!el || !inv) return;
  const t = invoiceTotals(inv);
  el.innerHTML = '<div><span>Subtotal</span><span>' + money2(t.subtotal) + '</span></div>'
    + '<div><span>Tax (' + (parseFloat(inv.taxPct) || 0) + '%)</span><span>' + money2(t.tax) + '</span></div>'
    + '<div><span>Total</span><span>' + money2(t.total) + '</span></div>'
    + (t.holdback ? '<div><span>Less holdback (' + (parseFloat(inv.holdbackPct) || 0) + '%, released later)</span><span>−' + money2(t.holdback) + '</span></div>' : '')
    + '<div class="grand"><span>Amount due</span><span>' + money2(t.due) + '</span></div>'
    + (t.paid ? '<div><span>Paid</span><span>' + money2(t.paid) + '</span></div><div class="grand"><span>Balance</span><span>' + money2(t.balance) + '</span></div>' : '');
}
// Typing updates the invoice and the totals in place. No re-render, so the
// field being typed in keeps focus.
document.getElementById('invoiceEditor').addEventListener('input', function (e) {
  const inv = editingInvoice(), el = e.target;
  if (!inv) return;
  const f = el.getAttribute('data-f');
  if (f) {
    const parts = f.split('.');
    if (parts.length === 2) inv[parts[0]][parts[1]] = el.value; else inv[f] = el.value;
  } else if (el.hasAttribute('data-line')) {
    const i = +el.getAttribute('data-line'), l = inv.lines[i];
    l[el.getAttribute('data-lf')] = el.value;
    const amt = document.querySelector('[data-amt="' + i + '"]');
    if (amt) amt.textContent = money2((parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0));
  } else return;
  persistInvoices(); renderInvoiceTotals();
});
// When a field is committed, refresh the list below (and the flag bar) so it
// matches what's in the editor.
document.getElementById('invoiceEditor').addEventListener('change', function () { if (editingInvoice()) { renderInvoiceList(); renderFlagBar(); } });
function releaseChangeOrder(inv, line) {
  if (!line.coTs) return;
  const c = changes.find(function (x) { return x.ts === line.coTs && x.invoiceId === inv.id; });
  if (c) { delete c.invoiceId; persistLists(); }
}
document.getElementById('invoiceEditor').addEventListener('click', function (e) {
  const btn = e.target.closest('[data-act]'), inv = editingInvoice();
  if (!btn || !inv || btn.disabled) return;
  const act = btn.getAttribute('data-act');
  if (act === 'add-line') { inv.lines.push({ desc: '', qty: 1, rate: '' }); }
  else if (act === 'del-line') { const i = +btn.getAttribute('data-i'); releaseChangeOrder(inv, inv.lines[i]); inv.lines.splice(i, 1); }
  else if (act === 'add-cos') {
    unbilledChangeOrders().forEach(function (c) {
      inv.lines.push({ desc: 'Change order: ' + c.text + (c.location ? ' (' + c.location + ')' : ''), qty: 1, rate: c.costEstimate || 0, coTs: c.ts });
      c.invoiceId = inv.id;
    });
    persistLists();
  }
  else if (act === 'sent') { inv.sentAt = new Date().toISOString(); }
  else if (act === 'print') { printInvoice(inv); return; }
  else if (act === 'email') { emailInvoice(inv); }
  else if (act === 'close') { editingInvoiceId = null; }
  else if (act === 'delete') {
    if (!confirm('Delete ' + inv.number + '? Any change orders on it become billable again.')) return;
    inv.lines.forEach(function (l) { releaseChangeOrder(inv, l); });
    invoices = invoices.filter(function (x) { return x !== inv; }); editingInvoiceId = null;
  }
  persistInvoices(); renderInvoices(); renderFlagBar();
});
function renderInvoices() {
  renderInvoiceEditor();
  renderInvoiceList();
}
function renderInvoiceList() {
  const wrap = document.getElementById('invoiceList');
  if (!wrap) return;
  if (!invoices.length) { wrap.innerHTML = '<p class="hint">No invoices for this job yet.</p>'; return; }
  const o = invoiceOutstanding(invoices);
  let html = '<div class="item-card"><strong>Invoiced ' + money2(o.invoiced) + '</strong><div class="meta">Collected ' + money2(o.paid) + ' · Outstanding ' + money2(o.balance) + (o.overdue ? ' · ' + o.overdue + ' overdue' : '') + ' (drafts not counted)</div></div>';
  invoices.slice().reverse().forEach(function (inv) {
    const t = invoiceTotals(inv), st = invoiceStatus(inv);
    html += '<div class="item-card" data-inv-id="' + inv.id + '"><strong>' + escapeHtml(inv.number) + '</strong> <span class="type-tag inv-' + st.key + '">' + st.label + '</span>'
      + '<div>' + escapeHtml(inv.client.name || 'No client yet') + '</div>'
      + '<div class="meta">' + escapeHtml(inv.date) + ' · due ' + escapeHtml(inv.dueDate || '—') + ' · ' + money2(t.due) + ' due · ' + money2(t.paid) + ' paid' + (t.balance > 0.005 && inv.sentAt ? ' · <strong>' + money2(t.balance) + ' owing</strong>' : '') + '</div>'
      + ((inv.payments || []).length ? '<div class="meta">Payments: ' + inv.payments.map(function (p) { return money2(p.amount) + ' (' + escapeHtml(p.date) + ')'; }).join(', ') + '</div>' : '')
      + '<button type="button" class="small gray inv-edit-btn">Open</button>'
      + (inv.sentAt && t.balance > 0.005 ? ' <button type="button" class="small green inv-pay-btn">Record Payment</button>' : '') + '</div>';
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-inv-id]').forEach(function (card) {
    const inv = invoices.find(function (x) { return x.id === card.getAttribute('data-inv-id'); });
    card.querySelector('.inv-edit-btn').addEventListener('click', function () { editingInvoiceId = inv.id; renderInvoices(); document.getElementById('invoiceEditor').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const pay = card.querySelector('.inv-pay-btn');
    if (pay) pay.addEventListener('click', function () {
      const bal = invoiceTotals(inv).balance;
      const amt = parseFloat(prompt('Payment received on ' + inv.number + ' ($)?', bal.toFixed(2)) || '');
      if (isNaN(amt) || amt <= 0) return;
      (inv.payments = inv.payments || []).push({ amount: amt, date: isoToday() });
      persistInvoices(); renderInvoices(); renderFlagBar();
    });
  });
}
function invoicePrintHtml(inv) {
  const t = invoiceTotals(inv), b = business, esc = function (v) { return escapeHtml(v || '').replace(/\n/g, '<br>'); };
  const job = currentJob();
  return '<div class="invp"><div class="invp-head"><div><h1>INVOICE</h1><strong>' + esc(inv.number) + '</strong><br><small>Date: ' + esc(inv.date) + '<br>Due: ' + esc(inv.dueDate) + '</small></div>'
    + '<div style="text-align:right"><strong>' + esc(b.name || 'Your business name') + '</strong><br><small>' + esc(b.address) + (b.contact ? '<br>' + esc(b.contact) : '') + (b.taxNo ? '<br>GST/HST #: ' + esc(b.taxNo) : '') + '</small></div></div>'
    + '<div class="invp-head"><div><small>BILL TO</small><br><strong>' + esc(inv.client.name) + '</strong><br><small>' + esc(inv.client.address) + (inv.client.email ? '<br>' + esc(inv.client.email) : '') + '</small></div>'
    + '<div style="text-align:right"><small>JOB</small><br><strong>' + esc(job ? job.name : '') + '</strong><br><small>' + esc(job ? job.address : '') + '</small></div></div>'
    + '<table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>'
    + inv.lines.map(function (l) { const q = parseFloat(l.qty) || 0, r = parseFloat(l.rate) || 0; return '<tr><td>' + esc(l.desc) + '</td><td class="num">' + q + '</td><td class="num">' + money2(r) + '</td><td class="num">' + money2(q * r) + '</td></tr>'; }).join('')
    + '</tbody></table><div class="invp-totals">'
    + '<div><span>Subtotal</span><span>' + money2(t.subtotal) + '</span></div><div><span>Tax (' + (parseFloat(inv.taxPct) || 0) + '%)</span><span>' + money2(t.tax) + '</span></div>'
    + '<div><span>Total</span><span>' + money2(t.total) + '</span></div>'
    + (t.holdback ? '<div><span>Less holdback (' + (parseFloat(inv.holdbackPct) || 0) + '%)</span><span>−' + money2(t.holdback) + '</span></div>' : '')
    + '<div class="grand"><span>Amount due</span><span>' + money2(t.due) + '</span></div>'
    + (t.paid ? '<div><span>Paid to date</span><span>' + money2(t.paid) + '</span></div><div class="grand"><span>Balance</span><span>' + money2(t.balance) + '</span></div>' : '')
    + '</div>' + (inv.notes ? '<p>' + esc(inv.notes) + '</p>' : '') + (b.terms ? '<p><small>' + esc(b.terms) + '</small></p>' : '') + '</div>';
}
function printInvoice(inv) {
  document.getElementById('invoicePrint').innerHTML = invoicePrintHtml(inv);
  document.body.classList.add('printing-invoice');
  window.print();
}
// No afterprint cleanup: iOS Safari's print() doesn't block and afterprint can
// fire before the page is captured, which would print the whole app. The class
// only matters under @media print, so it's cleared on the next showTab() or
// Report print instead.
// mailto can't attach a file, so this sends a plain-text summary; Print /
// Save PDF is the way to send the invoice itself. Emailing marks it sent.
function emailInvoice(inv) {
  const t = invoiceTotals(inv);
  const lines = inv.lines.map(function (l) { return '- ' + (l.desc || 'Item') + ': ' + money2((parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)); }).join('\n');
  const body = 'Hi ' + (inv.client.name || '') + ',\n\nInvoice ' + inv.number + (currentJob() ? ' for ' + currentJob().name : '') + ', dated ' + inv.date + ', due ' + inv.dueDate + '.\n\n' + lines
    + '\n\nSubtotal: ' + money2(t.subtotal) + '\nTax: ' + money2(t.tax) + (t.holdback ? '\nHoldback retained: ' + money2(t.holdback) : '') + '\nAmount due: ' + money2(t.due)
    + (business.terms ? '\n\n' + business.terms : '') + '\n\nThanks,\n' + (business.name || '');
  window.location.href = 'mailto:' + encodeURIComponent(inv.client.email || '') + '?subject=' + encodeURIComponent('Invoice ' + inv.number + (business.name ? ' from ' + business.name : '')) + '&body=' + encodeURIComponent(body);
  if (!inv.sentAt) inv.sentAt = new Date().toISOString();
}

/* ---------- Jobs: tabs on Home + All Jobs overview ---------- */
function renderJobTabs() {
  const wrap = document.getElementById('homeJobTabs');
  if (!wrap) return;
  wrap.innerHTML = '<button type="button" class="home-job-tab all" data-job="__all">📊 All Jobs</button>'
    + jobs.map(function (j) { return '<button type="button" class="home-job-tab' + (j.id === currentJobId ? ' active' : '') + '" data-job="' + escapeHtml(j.id) + '">' + escapeHtml(j.name) + '</button>'; }).join('')
    + '<button type="button" class="home-job-tab new" data-job="__new">+ New Job</button>';
}
function switchJob(id) {
  if (id === currentJobId) return;
  if (walkActive) { alert('End the walk before switching jobs.'); return; }
  saveJson(LS.currentJob, id);
  location.reload();
}
function newJob() {
  if (walkActive) { alert('End the walk before starting a new job.'); return; }
  const name = (prompt('New job name, e.g. 45 Oak Ridge Rd') || '').trim();
  if (!name) return;
  const address = (prompt('Address for ' + name + ' (optional)') || '').trim();
  const id = 'j_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  jobs.push({ id: id, name: name, address: address, created: new Date().toISOString() });
  persistJobs();
  saveJson(jobKey(LS_BASE.siteName, id), name);
  if (address) saveJson(jobKey(LS_BASE.siteAddress, id), address);
  switchJob(id);
}
function deleteJob(id) {
  const job = jobs.find(function (j) { return j.id === id; });
  if (!job || id === currentJobId) return;
  if (!confirm('Delete the job "' + job.name + '" and ALL of its photos, items, clock entries and costs from this phone? This can\'t be undone.')) return;
  JOB_SCOPED.forEach(function (k) { try { localStorage.removeItem(jobKey(LS_BASE[k], id)); } catch (e) { } });
  jobs = jobs.filter(function (j) { return j.id !== id; });
  persistJobs(); renderJobTabs(); renderJobsOverview();
}
document.getElementById('homeJobTabs').addEventListener('click', function (e) {
  const btn = e.target.closest('[data-job]');
  if (!btn) return;
  const id = btn.getAttribute('data-job');
  if (id === '__all') showTab('jobs');
  else if (id === '__new') newJob();
  else switchJob(id);
});
// Reads a job's numbers straight from its stored keys (photos skipped:
// they're the heavy part and nothing here needs them).
function jobSummary(job) {
  const get = function (k, fb) { const v = loadJson(jobKey(LS_BASE[k], job.id), fb); return Array.isArray(fb) && !Array.isArray(v) ? fb : v; };
  const jp = get('punch', []), jr = get('rfis', []), jc = get('changes', []), jm = get('materials', []), js = get('subContracts', []), je = get('clockEvents', []), jl = get('dailyLogs', []);
  const jb = get('budget', {}) || {};
  const inv = invoiceOutstanding(get('invoices', []));
  const labor = totalHourlyLaborCost(je) + js.reduce(function (t, c) { return t + contractCostToDate(c); }, 0);
  const mats = jm.reduce(function (t, m) { return t + (m.cost || 0); }, 0);
  const pending = jc.filter(function (c) { return c.approval === 'Pending'; });
  return {
    job: job, budget: (jb.labor || 0) + (jb.materials || 0), spent: labor + mats,
    openPunch: jp.filter(function (x) { return !x.resolved; }).length, openRfis: jr.filter(function (x) { return x.status !== 'Answered'; }).length,
    pendingCo: pending.reduce(function (t, c) { return t + (c.costEstimate || 0); }, 0), pendingCoCount: pending.length,
    onClock: laborCostByEmployee(je).filter(function (r) { return r.active; }).length,
    owed: js.reduce(function (t, c) { return t + contractOwed(c); }, 0),
    lastLog: jl.length ? jl[jl.length - 1].date : null,
    invoiced: inv.invoiced, outstanding: inv.balance, overdue: inv.overdue
  };
}
function renderJobsOverview() {
  const wrap = document.getElementById('jobsOverview');
  if (!wrap) return;
  const rows = jobs.map(jobSummary);
  const sum = function (f) { return rows.reduce(function (t, r) { return t + r[f]; }, 0); };
  const budgetAll = sum('budget'), spentAll = sum('spent');
  let html = '<div class="role-kpis">'
    + [[String(jobs.length), 'job' + (jobs.length === 1 ? '' : 's') + ' on this phone', false],
      [budgetAll ? Math.round(spentAll / budgetAll * 100) + '%' : money(spentAll), budgetAll ? 'of combined budget spent (' + money(spentAll) + ' / ' + money(budgetAll) + ')' : 'spent across all jobs (no budgets set)', budgetAll > 0 && spentAll > budgetAll],
      [String(sum('openPunch') + sum('openRfis')), 'open punch items + RFIs', false],
      [money(sum('pendingCo')), 'pending change-order exposure', sum('pendingCo') > 0],
      [money(sum('owed')), 'owed to flat-contract subs', sum('owed') > 0.005],
      [String(sum('onClock')), 'on the clock now', false],
      [money(sum('invoiced')), 'invoiced to date', false],
      [money(sum('outstanding')), 'outstanding on invoices' + (sum('overdue') ? ' (' + sum('overdue') + ' overdue)' : ''), sum('overdue') > 0]
    ].map(function (k) { return '<div class="role-kpi' + (k[2] ? ' warn' : '') + '"><b>' + escapeHtml(k[0]) + '</b><small>' + escapeHtml(k[1]) + '</small></div>'; }).join('') + '</div>';
  rows.forEach(function (r) {
    const pct = r.budget ? Math.round(r.spent / r.budget * 100) : null;
    const current = r.job.id === currentJobId;
    html += '<div class="item-card job-card" data-job-id="' + escapeHtml(r.job.id) + '"><strong>' + escapeHtml(r.job.name) + '</strong>' + (current ? ' <span class="type-tag change">Open now</span>' : '')
      + (r.job.address ? '<div class="meta">' + escapeHtml(r.job.address) + '</div>' : '')
      + '<div class="meta">' + (r.budget ? 'Spent ' + money(r.spent) + ' of ' + money(r.budget) + ' (' + pct + '%)' : 'Spent ' + money(r.spent) + ' · no budget set') + '</div>'
      + (r.budget ? '<div class="job-bar"><span class="' + (r.spent > r.budget ? 'over' : '') + '" style="width:' + Math.min(100, pct) + '%"></span></div>' : '')
      + '<div class="meta">' + r.openPunch + ' open punch · ' + r.openRfis + ' open RFIs · ' + r.pendingCoCount + ' CO pending (' + money(r.pendingCo) + ')'
      + (r.owed > 0.005 ? ' · ' + money(r.owed) + ' owed to subs' : '') + (r.onClock ? ' · ' + r.onClock + ' on the clock' : '') + (r.lastLog ? ' · last daily log ' + escapeHtml(r.lastLog) : '') + '</div>'
      + (r.invoiced ? '<div class="meta">Invoiced ' + money(r.invoiced) + ' · outstanding ' + money(r.outstanding) + (r.overdue ? ' · <strong>' + r.overdue + ' overdue</strong>' : '') + '</div>' : '')
      + (current ? '' : '<button type="button" class="small green job-open-btn">Open this job</button> <button type="button" class="small gray job-delete-btn">Delete</button>')
      + '</div>';
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('.job-open-btn').forEach(function (b) { b.addEventListener('click', function () { switchJob(b.closest('[data-job-id]').getAttribute('data-job-id')); }); });
  wrap.querySelectorAll('.job-delete-btn').forEach(function (b) { b.addEventListener('click', function () { deleteJob(b.closest('[data-job-id]').getAttribute('data-job-id')); }); });
}
document.getElementById('jobsNewBtn').addEventListener('click', newJob);

/* ---------- Backup & restore (no account needed) ---------- */
// One JSON file holding every LS key, so data can move to another phone
// without a backend. Leaves out the AI Worker shared key (a secret). Not
// sync: restoring replaces what's on the receiving phone.
const BACKUP_SKIP = [LS.aiKey];
function setBackupStatus(cls, msg) { const el = document.getElementById('backupStatus'); el.style.display = 'block'; el.className = 'status ' + cls; el.textContent = msg; }
function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isAppKey(key) || BACKUP_SKIP.indexOf(key) !== -1) continue;
    try { const raw = localStorage.getItem(key); if (raw != null) data[key] = JSON.parse(raw); } catch (e) { }
  }
  const json = JSON.stringify({ app: 'SiteWalk', format: 2, exportedAt: new Date().toISOString(), data: data });
  const filename = 'sitewalk-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  setBackupStatus('ok', 'Backup saved as ' + filename + ' (' + Math.round(json.length / 1024) + ' KB).');
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = function () {
    let parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) { setBackupStatus('err', 'That file isn\'t a SiteWalk backup.'); return; }
    if (!parsed || parsed.app !== 'SiteWalk' || !parsed.data || typeof parsed.data !== 'object') { setBackupStatus('err', 'That file isn\'t a SiteWalk backup.'); return; }
    if (!confirm('Replace ALL data on this phone with the backup from ' + (parsed.exportedAt || 'unknown date').slice(0, 10) + '?\n\nAnything on this phone that isn\'t in the backup will be lost.')) return;
    const existing = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isAppKey(k) && BACKUP_SKIP.indexOf(k) === -1) existing.push(k); }
    existing.forEach(function (key) { try { localStorage.removeItem(key); } catch (e) { } });
    let failed = false;
    Object.keys(parsed.data).forEach(function (key) { if (isAppKey(key) && BACKUP_SKIP.indexOf(key) === -1 && !saveJson(key, parsed.data[key])) failed = true; });
    if (failed) { setBackupStatus('err', 'Phone storage filled up partway through the restore — some data (likely photos) didn\'t fit.'); return; }
    location.reload();
  };
  reader.readAsText(file);
}
document.getElementById('exportBackupBtn').addEventListener('click', exportBackup);
document.getElementById('importBackupBtn').addEventListener('click', function () { document.getElementById('importBackupInput').click(); });
document.getElementById('importBackupInput').addEventListener('change', function (ev) { const f = ev.target.files[0]; ev.target.value = ''; if (f) importBackup(f); });
window.addEventListener('load', function () {
  photos = loadJson(LS.photos, []); punch = loadJson(LS.punch, []); changes = loadJson(LS.changes, []); rfis = loadJson(LS.rfis, []); contacts = loadJson(LS.contacts, {});
  submittals = loadJson(LS.submittals, []); clockEvents = loadJson(LS.clockEvents, []); dailyLogs = loadJson(LS.dailyLogs, []); safetyLogs = loadJson(LS.safety, []); notesLog = loadJson(LS.notes, []);
  wages = loadJson(LS.wages, {}); materials = loadJson(LS.materials, []); budget = loadJson(LS.budget, { labor: 0, materials: 0 }); drawings = loadJson(LS.drawings, []); walks = loadJson(LS.walks, []);
  properties = loadJson(LS.properties, []); units = loadJson(LS.units, []); tenants = loadJson(LS.tenants, []); leases = loadJson(LS.leases, []); payments = loadJson(LS.payments, []);
  if (!Array.isArray(photos)) photos = []; if (!Array.isArray(punch)) punch = []; if (!Array.isArray(changes)) changes = []; if (!Array.isArray(rfis)) rfis = [];
  if (!Array.isArray(submittals)) submittals = []; if (!Array.isArray(clockEvents)) clockEvents = []; if (!Array.isArray(dailyLogs)) dailyLogs = []; if (!Array.isArray(safetyLogs)) safetyLogs = []; if (!Array.isArray(notesLog)) notesLog = [];
  if (!wages || typeof wages !== 'object') wages = {}; if (!Array.isArray(materials)) materials = []; if (!budget || typeof budget !== 'object') budget = { labor: 0, materials: 0 }; if (!Array.isArray(drawings)) drawings = [];
  if (!Array.isArray(walks)) walks = [];
  reviewItems = loadJson(LS.review, []); if (!Array.isArray(reviewItems)) reviewItems = [];
  invoices = loadJson(LS.invoices, []); if (!Array.isArray(invoices)) invoices = [];
  business = loadJson(LS.business, {}); if (!business || typeof business !== 'object') business = {};
  fillBusinessForm();
  subContracts = loadJson(LS.subContracts, []); geoSites = loadJson(LS.geoSites, []); autoClock = loadJson(LS.autoClock, { enabled: false, employee: '' });
  if (!Array.isArray(subContracts)) subContracts = []; if (!Array.isArray(geoSites)) geoSites = []; if (!autoClock || typeof autoClock !== 'object') autoClock = { enabled: false, employee: '' };
  if (!Array.isArray(properties)) properties = []; if (!Array.isArray(units)) units = []; if (!Array.isArray(tenants)) tenants = []; if (!Array.isArray(leases)) leases = []; if (!Array.isArray(payments)) payments = [];
  walks.forEach(function (w) { ['transcript', 'punches', 'costs', 'safety'].forEach(function (k) { if (!Array.isArray(w[k])) w[k] = []; }); });
  currentWalk = walks.length ? walks[walks.length - 1] : null;
  const savedSiteName = loadJson(LS.siteName, null);
  const savedSiteAddress = loadJson(LS.siteAddress, null);
  if (savedSiteName) document.getElementById('siteName').textContent = savedSiteName;
  else if (currentJob()) document.getElementById('siteName').textContent = currentJob().name;
  if (!savedSiteAddress && currentJob() && currentJob().address) document.getElementById('siteAddress').textContent = currentJob().address;
  const clockSiteEl = document.getElementById('clockSite');
  if (clockSiteEl && !clockSiteEl.value && currentJob()) clockSiteEl.value = currentJob().name;
  renderJobTabs();
  if (savedSiteAddress) document.getElementById('siteAddress').textContent = savedSiteAddress;
  document.getElementById('saveVideoToggle').checked = !!loadJson(LS.saveVideo, false);
  renderPhotosTab();
  const photoSearchEl = document.getElementById('photoSearch');
  if (photoSearchEl) photoSearchEl.addEventListener('input', renderPhotosTab);
  renderAllNotes();
  renderReview();
  renderPhotoTagQueue();
  const photoTagToggle = document.getElementById('photoTagToggle');
  if (photoTagToggle) { photoTagToggle.checked = loadJson(LS.photoTag, true) !== false; photoTagToggle.addEventListener('change', function () { saveJson(LS.photoTag, !!photoTagToggle.checked); }); }
  renderPhotoTagStats();
  renderSummary();
  showWalkTab('main');
  renderAllItems();
  renderContacts();
  renderSubmittals();
  checkMissedClockOuts();
  renderClockFlagged();
  renderClockLog();
  renderGeoSites();
  if (autoClock.enabled) startAutoClock();
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
  setHomeMode(loadJson(LS.homeMode, 'build'));
  setRole(loadJson(LS.role, 'all'));
  renderProperties();
  renderUnits();
  renderTenants();
  renderLeases();
  renderRentRoll();
  renderArrears();
  renderFlagBar();
  showTab('home');
});
