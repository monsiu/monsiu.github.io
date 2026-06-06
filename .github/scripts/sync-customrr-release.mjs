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
  };

  console.log(`Latest: ${rel.tag_name} (${prettyDate(rel.published_at)}), ${rel.stars} stars`);

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
