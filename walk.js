(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/danstewart5/SiteWalk@da2b06625b6d943b72b1ed68b523e30805c433fe/walk.js';
  s.onload = function () {
    var origStart = window.startWalk;
    window.startWalk = function () {
      var b = document.getElementById('genAfterWalkBtn');
      if (b) b.style.display = 'none';
      return origStart.apply(this, arguments);
    };
    window.endWalk = function () {
      walkActive = false;
      stopWalkCamera();
      stopWalkVoice();
      document.getElementById('walkBtn').style.display = 'block';
      document.getElementById('endWalkBtn').style.display = 'none';
      document.getElementById('walkStage').classList.remove('active');
      var gen = document.getElementById('genAfterWalkBtn');
      if (gen) gen.style.display = 'block';
      setWalkStatus('info', 'Walk ended. Photos and notes stayed on this phone.');
    };
    var genBtn = document.getElementById('genAfterWalkBtn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        window.generateReport();
        genBtn.style.display = 'none';
        showTab('setup');
      });
    }
  };
  s.onerror = function () {
    setWalkStatus('err', 'Could not load walk engine. Pull to refresh.');
  };
  document.head.appendChild(s);
})();
