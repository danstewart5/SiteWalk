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
