/*
 * Custom RR release auto-updater.
 * Fetches the latest GitHub release + repo stars once (cached in localStorage)
 * and fills any element marked with a data hook. If the API is unreachable,
 * the hardcoded HTML values are left untouched as a fallback.
 *
 * Hooks:
 *   data-cr="version"      -> text set to the latest tag (e.g. v0.2.3)
 *   data-cr="date"         -> text set to the release month/year (e.g. Jun 2026)
 *   data-cr="stars"        -> text set to the repo star count
 *   data-cr-href="release" -> href set to the latest release tag page
 *   data-cr-asset="SUFFIX" -> href set to the release asset whose name ends with SUFFIX
 */
(function () {
  'use strict';

  var REPO = 'monsiu/Custom-RR';
  var API = 'https://api.github.com/repos/' + REPO;
  var CACHE_KEY = 'cr_release_v1';
  var TTL = 6 * 60 * 60 * 1000; // 6 hours
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function each(selector, fn) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function apply(data) {
    if (!data || !data.tag) return;
    var tag = data.tag;
    var relUrl = 'https://github.com/' + REPO + '/releases/tag/' + tag;

    each('[data-cr="version"]', function (el) { el.textContent = tag; });
    if (data.date) each('[data-cr="date"]', function (el) { el.textContent = data.date; });
    if (data.stars != null) each('[data-cr="stars"]', function (el) { el.textContent = data.stars; });
    each('[data-cr-href="release"]', function (el) { el.setAttribute('href', relUrl); });

    each('[data-cr-asset]', function (el) {
      var suffix = el.getAttribute('data-cr-asset');
      var url = null;
      if (data.assets) {
        for (var i = 0; i < data.assets.length; i++) {
          var name = data.assets[i].name || '';
          if (name.slice(-suffix.length) === suffix) { url = data.assets[i].url; break; }
        }
      }
      if (!url) {
        url = 'https://github.com/' + REPO + '/releases/download/' + tag + '/custom_rr-' + tag + '-' + suffix;
      }
      el.setAttribute('href', url);
    });
  }

  function fromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || (Date.now() - o.t) > TTL) return null;
      return o.d;
    } catch (e) { return null; }
  }

  function toCache(d) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  }

  function getJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  var cached = fromCache();
  if (cached) { apply(cached); return; }

  Promise.all([getJSON(API + '/releases/latest'), getJSON(API)]).then(function (res) {
    var rel = res[0], repo = res[1];
    if (!rel || !rel.tag_name) return; // keep static fallback
    var data = {
      tag: rel.tag_name,
      date: fmtDate(rel.published_at),
      stars: repo && typeof repo.stargazers_count === 'number' ? repo.stargazers_count : null,
      assets: (rel.assets || []).map(function (a) { return { name: a.name, url: a.browser_download_url }; })
    };
    toCache(data);
    apply(data);
  });
})();
