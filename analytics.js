(function () {
  var OPT_OUT_KEY = 'monsiu_analytics_opt_out_v1';
  var token = window.MONSIU_WEB_ANALYTICS_TOKEN || '';
  var control = document.getElementById('analyticsOptOut');
  var status = document.getElementById('analyticsStatus');
  var memoryOptOut = false;

  function isOptedOut() {
    if (memoryOptOut) return true;
    try { return localStorage.getItem(OPT_OUT_KEY) === 'true'; } catch (e) { return true; }
  }

  function updateControl() {
    if (!control) return;
    var optedOut = isOptedOut();
    control.textContent = optedOut ? 'Turn analytics on' : 'Turn analytics off';
    if (status) {
      status.textContent = !token
        ? 'Analytics setup is not complete yet.'
        : (optedOut ? 'Your opt-out is saved for future page loads in this browser.' : 'Analytics are on. You can turn them off here at any time.');
    }
  }

  function loadAnalytics() {
    if (!token || isOptedOut() || document.getElementById('cloudflareWebAnalytics')) return;
    var script = document.createElement('script');
    script.id = 'cloudflareWebAnalytics';
    script.type = 'module';
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute('data-cf-beacon', JSON.stringify({ token: token, spa: false }));
    document.head.appendChild(script);
  }

  if (control) {
    control.addEventListener('click', function () {
      var optedOut = !isOptedOut();
      try {
        if (optedOut) localStorage.setItem(OPT_OUT_KEY, 'true');
        else localStorage.removeItem(OPT_OUT_KEY);
      } catch (e) { memoryOptOut = optedOut; }

      var script = document.getElementById('cloudflareWebAnalytics');
      if (optedOut && script) script.remove();
      else if (!optedOut) loadAnalytics();
      updateControl();
    });
  }

  updateControl();
  loadAnalytics();
})();
