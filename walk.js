/* temporary loader — replaced next */
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/danstewart5/SiteWalk@7e9d633baa934b62f25b3ac095f2e7a94487c44c/walk.js';
  s.onload = function () {
    var prev = window.endWalk;
    window.endWalk = function () {
      var walkActiveBefore = typeof walkActive !== 'undefined' ? walkActive : true;
      if (typeof prev === 'function') {
        var _show = window.showTab;
        var _gen = window.generateReport;
        window.showTab = function (name) { if (name === 'report') return; if (_show) _show(name); };
        window.generateReport = function () {};
        try { prev(); } finally {
          window.showTab = _show;
          window.generateReport = _gen;
        }
      }
      var status = document.getElementById('walkStatus');
      if (status) {
        status.className = 'w-walk-status ok';
        status.textContent = 'Walk ended. Review notes here, then hit Generate Summary.';
      }
    };
  };
  document.head.appendChild(s);
})();
