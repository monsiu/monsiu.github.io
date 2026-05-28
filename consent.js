(function () {
  var STORAGE_KEY = 'cookie_consent_v1';
  var stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  function updateConsent(granted) {
    if (typeof gtag !== 'function') return;
    var state = granted ? 'granted' : 'denied';
    gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state
    });
  }

  if (stored === 'granted') {
    updateConsent(true);
    return;
  }
  if (stored === 'denied') {
    return;
  }

  var style = document.createElement('style');
  style.textContent = [
    '.cc-banner{position:fixed;left:16px;right:16px;bottom:16px;max-width:520px;margin:0 auto;background:#141414;color:#F2F2F2;border:1px solid #222;border-radius:12px;padding:18px 20px;font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:14px;line-height:1.55;box-shadow:0 12px 40px rgba(0,0,0,0.45);z-index:9999;}',
    '.cc-banner p{margin:0 0 14px 0;color:#A8A8A8;}',
    '.cc-banner a{color:#4F8EF7;text-decoration:underline;text-underline-offset:0.2em;}',
    '.cc-actions{display:flex;gap:10px;flex-wrap:wrap;}',
    '.cc-btn{cursor:pointer;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:500;font-family:inherit;transition:background 0.15s,border-color 0.15s,color 0.15s;}',
    '.cc-accept{background:#4F8EF7;color:#fff;}',
    '.cc-accept:hover{background:#2F6FE0;}',
    '.cc-reject{background:transparent;color:#F2F2F2;border:1px solid #222;}',
    '.cc-reject:hover{border-color:#4F8EF7;color:#4F8EF7;}',
    '@media (prefers-color-scheme: light){.cc-banner{background:#FFFFFF;color:#111;border-color:#DEDEDE;box-shadow:0 12px 40px rgba(0,0,0,0.12);}.cc-banner p{color:#555;}.cc-reject{color:#111;border-color:#DEDEDE;}}'
  ].join('');
  document.head.appendChild(style);

  function buildBanner() {
    var banner = document.createElement('div');
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<p>I use Google Analytics cookies to understand how visitors find this site. No ads, no tracking sold to third parties. You can opt out anytime.</p>' +
      '<div class="cc-actions">' +
      '<button type="button" class="cc-btn cc-accept">Accept</button>' +
      '<button type="button" class="cc-btn cc-reject">Reject</button>' +
      '</div>';
    document.body.appendChild(banner);

    banner.querySelector('.cc-accept').addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (e) {}
      updateConsent(true);
      banner.remove();
    });
    banner.querySelector('.cc-reject').addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'denied'); } catch (e) {}
      updateConsent(false);
      banner.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBanner);
  } else {
    buildBanner();
  }
})();
