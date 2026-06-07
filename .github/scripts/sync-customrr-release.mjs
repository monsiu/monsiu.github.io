#!/usr/bin/env node
/*
 * Sync the static Custom RR release info baked into the portfolio HTML so that
 * crawlers (which do not run release.js) see the current version, date, stars,
 * release links and download links.
 *
 * Fetches the latest release + repo stars from the GitHub API and rewrites:
 *   - data-cr="version" / "date" / "stars" fallback text
 *   - anchors carrying data-cr-href="release" (href)
 *   - anchors carrying data-cr-asset="SUFFIX" (href)
 *   - JSON-LD: softwareVersion, datePublished, releaseNotes, downloadUrl, ratingCount
 *   - og:description prose (version + star count) on the home page
 *
 * Every replacement is version-agnostic, so re-running is idempotent: it only
 * writes a file when the new content actually differs. The hand-written
 * "What's new" highlights are intentionally left untouched.
 *
 * Usage: node sync-customrr-release.mjs [file ...]
 * Defaults to index.html and custom-rr/index.html relative to repo root.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = 'monsiu/Custom-RR';
const API = `https://api.github.com/repos/${REPO}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const files = process.argv.slice(2);
if (files.length === 0) {
  files.push(resolve(repoRoot, 'index.html'), resolve(repoRoot, 'custom-rr', 'index.html'));
}

function ghHeaders() {
  const h = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'monsiu-site-sync' };
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

function prettyDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert a single line of inline Markdown to safe HTML. Text is HTML-escaped
// first, then only a fixed allow-list of constructs is reintroduced as tags:
// http(s) links, bold and inline code. Nothing else can emit markup, so a
// release body cannot inject arbitrary HTML.
function mdInlineToHtml(text) {
  let s = escapeHtml(text.trim());
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

// Pull the bullet lines out of the release body's "### Changes" section, stopping
// at the next "### " heading (so Android / Desktop / Donation / Install noise is
// skipped). Returns [] when the section is missing so existing copy is kept.
function extractChanges(body) {
  if (!body) return [];
  const norm = body.replace(/\r\n/g, '\n');
  const m = norm.match(/###\s+Changes[^\n]*\n([\s\S]*?)(?=\n###\s|$)/);
  if (!m) return [];
  const bullets = [];
  for (const line of m[1].split('\n')) {
    const bm = line.match(/^\s*[-*\u2022]\s+(.+?)\s*$/);
    if (bm) bullets.push(bm[1]);
  }
  return bullets;
}

// Pull the one-line summary paragraph that sits between the "## Custom RR vX.Y.Z"
// title and the first "### " heading. Returns '' when absent (or when the first
// block is a heading/list/quote rather than prose) so existing copy is kept.
function extractSummary(body) {
  if (!body) return '';
  const norm = body.replace(/\r\n/g, '\n').trim();
  const afterTitle = norm.replace(/^##\s+[^\n]*\n/, '');
  const m = afterTitle.match(/^([\s\S]*?)(?=\n###\s|$)/);
  if (!m) return '';
  const firstPara = (m[1].split(/\n\s*\n/).find((p) => p.trim()) || '').trim();
  if (!firstPara || /^[#>\-*\u2022]/.test(firstPara)) return '';
  return firstPara.replace(/\s*\n\s*/g, ' ');
}

function rewrite(html, rel) {
  const tag = rel.tag_name;                         // e.g. v0.2.3
  const version = tag.replace(/^v/, '');            // e.g. 0.2.3
  const dateISO = (rel.published_at || '').slice(0, 10);
  const datePretty = prettyDate(rel.published_at);
  const stars = String(rel.stars);
  const relUrl = `https://github.com/${REPO}/releases/tag/${tag}`;
  const findAsset = (suffix) => {
    const a = (rel.assets || []).find((x) => x.name.endsWith(suffix));
    return a ? a.url : `https://github.com/${REPO}/releases/download/${tag}/custom_rr-${tag}-${suffix}`;
  };

  let out = html;

  // Visible fallback text behind the data-cr hooks.
  out = out.replace(/(<span data-cr="version">)[^<]*(<\/span>)/g, `$1${tag}$2`);
  if (datePretty) out = out.replace(/(<span data-cr="date">)[^<]*(<\/span>)/g, `$1${datePretty}$2`);
  out = out.replace(/(<span data-cr="stars">)[^<]*(<\/span>)/g, `$1${stars}$2`);

  // Release-tag links (anchor carries data-cr-href="release" right after href).
  out = out.replace(/href="[^"]*"(\s+data-cr-href="release")/g, `href="${relUrl}"$1`);

  // Per-platform download links (anchor carries data-cr-asset="SUFFIX" right after href).
  out = out.replace(/href="[^"]*"(\s+data-cr-asset="([^"]+)")/g, (m, attr, suffix) => {
    return `href="${findAsset(suffix)}"${attr}`;
  });

  // JSON-LD structured data.
  out = out.replace(/("softwareVersion":\s*")[^"]*(")/g, `$1${version}$2`);
  if (dateISO) out = out.replace(/("datePublished":\s*")[^"]*(")/g, `$1${dateISO}$2`);
  const tagBase = escapeRe(`https://github.com/${REPO}/releases/tag/`);
  out = out.replace(new RegExp(`("releaseNotes":\\s*"${tagBase})[^"]*(")`, 'g'), `$1${tag}$2`);
  out = out.replace(new RegExp(`("downloadUrl":\\s*"${tagBase})[^"]*(")`, 'g'), `$1${tag}$2`);
  out = out.replace(/("ratingCount":\s*")[^"]*(")/g, `$1${stars}$2`);

  // og:description prose on the home page (version + star count).
  out = out.replace(/Custom RR v\d+\.\d+\.\d+ \(cross-platform/g, `Custom RR ${tag} (cross-platform`);
  out = out.replace(/ROM\/recovery hub, \d+\+ GitHub stars/g, `ROM/recovery hub, ${stars}+ GitHub stars`);

  // "What's new" heading + auto-generated changelog bullets (custom-rr page only).
  out = out.replace(/(<h2>What's new in )v[\d.]+(<\/h2>)/g, `$1${tag}$2`);
  if (rel.summary) {
    const block = `<!-- cr:summary:start (auto-generated from the latest release summary; edits here are overwritten) -->\n      <p>${mdInlineToHtml(rel.summary)}</p>\n      <!-- cr:summary:end -->`;
    out = out.replace(/<!-- cr:summary:start[\s\S]*?cr:summary:end -->/, () => block);
  }
  if (rel.changes && rel.changes.length) {
    const lis = rel.changes.map((b) => `        <li>${mdInlineToHtml(b)}</li>`).join('\n');
    const block = `<!-- cr:changelog:start (auto-generated from the latest release's "### Changes" section; edits here are overwritten) -->\n${lis}\n        <!-- cr:changelog:end -->`;
    out = out.replace(/<!-- cr:changelog:start[\s\S]*?cr:changelog:end -->/, () => block);
  }

  return out;
}

async function main() {
  const [release, repo] = await Promise.all([getJSON(`${API}/releases/latest`), getJSON(API)]);
  if (!release || !release.tag_name) throw new Error('No tag_name in latest release');

  const rel = {
    tag_name: release.tag_name,
    published_at: release.published_at,
    stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : '',
    assets: (release.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url })),
    changes: extractChanges(release.body),
    summary: extractSummary(release.body),
  };

  console.log(`Latest: ${rel.tag_name} (${prettyDate(rel.published_at)}), ${rel.stars} stars, ${rel.changes.length} change bullet(s)`);

  let changed = 0;
  for (const file of files) {
    const before = readFileSync(file, 'utf8');
    const after = rewrite(before, rel);
    if (after !== before) {
      writeFileSync(file, after);
      console.log(`updated ${file}`);
      changed++;
    } else {
      console.log(`unchanged ${file}`);
    }
  }
  console.log(changed ? `${changed} file(s) updated.` : 'Already up to date.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
