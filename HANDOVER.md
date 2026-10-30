# Handover: index.html session changes

Scope note: this file documents only the changes made in this session. The
working tree already had other uncommitted edits (a broader redesign, font
swap from Syne to Fraunces, new About/testimonials sections, etc.) before
this session started. Those are not covered here and were not authored by
this session.

## 1. Theme flash on load

**Problem:** dark/light preference was applied by a script near the end of
`<body>`, so a visitor with `light` saved in `localStorage` would see a
flash of dark theme before JS ran.

**Fix:** added a tiny blocking script in `<head>`, right after the viewport
meta tag, that sets `data-theme` from `localStorage` before first paint.
Simplified the later script (near the theme toggle button) to just sync the
button icon instead of re-setting the attribute.

## 2. Hero image not prioritized (LCP)

**Problem:** the hero profile photo, the largest above-the-fold element, had
`loading="lazy"`, which tells the browser to deprioritize it even though
it's likely the page's LCP candidate.

**Fix:** removed `loading="lazy"`, added `fetchpriority="high"`, and added
`<link rel="preload" as="image" href="/profile.png" fetchpriority="high">`
in `<head>` so the browser discovers and fetches it as early as possible.

## 3. Cloudflare Turnstile loaded on every page view

**Problem:** the Turnstile script (`challenges.cloudflare.com/turnstile/v0/api.js`)
was a static, render-blocking-adjacent `<script>` in `<head>`, loaded on
every single page visit even though it's only used by the contact form far
down the page.

**Fix:** removed the static script tag. Added an `IntersectionObserver` on
`#contact` (600px `rootMargin`) that injects the script dynamically only
once a visitor scrolls near the contact form. The `.cf-turnstile` div is
still static HTML, so Cloudflare's auto-render picks it up as soon as the
script loads. Verified the widget still renders and the submit handler
still works after this change.

Testing note: while verifying this, Chrome's back-forward cache made it
look like the script was loading eagerly on every navigation. That was a
test-harness artifact (bfcache preserves DOM state across `page.goto()` to
the same URL), not a real bug. A genuinely fresh navigation (via
`about:blank` in between) confirmed the lazy load works as intended.

## 4. Layout shift (CLS) on project banner images

**Problem:** the three project banner `<img>` tags (ClauseShift, Custom RR,
PesaShift) had no `width`/`height` attributes, so the browser couldn't
reserve space for them before they loaded, causing layout shift.

**Fix:** added explicit `width`/`height` matching each image's real
dimensions:
- `clauseshift-banner.png`: 1200x400
- `/custom-rr/banner-2x.png`: 1440x360
- PesaShift remote banner (`raw.githubusercontent.com/.../feature-graphic.png`): 1024x500

## 5. Aegis shield icon unreadable

**Problem:** the Aegis project banner used the 🛡 emoji. On this system the
emoji font rendered it as a flat, nearly invisible black glyph against the
dark navy circle background behind it, in both light and dark site themes.

**Fix:** replaced the emoji `<span>` with an inline SVG shield and
checkmark, stroked in light blue (`#7fb3ff`), so it's crisp and consistent
regardless of the visitor's OS/emoji font.

Also audited the page's other symbol usage (`★ ✓ ✕ ☀ ☾`) and confirmed
those are plain Unicode text glyphs colored via CSS, not color-emoji
codepoints, so they were not at risk of the same problem. No changes made
there.

## 6. Motion and polish pass

- `.reveal` (scroll-triggered fade/slide-in) now uses a `cubic-bezier(0.16,
  1, 0.3, 1)` ease instead of plain `ease`, for a smoother settle.
- Added a global `@media (prefers-reduced-motion: reduce)` block that turns
  off reveal transitions, the hero ring spin, the hero fade-in, and the
  project card/banner hover transforms. This didn't exist before.
- The hero photo's conic-gradient ring now slowly rotates
  (`animation: ringSpin 7s linear infinite`) instead of sitting static.
- Project cards now lift slightly on hover (`translateY(-3px)`) and their
  banner image does a subtle zoom (`scale(1.015)`) underneath.

## 7. Project metric line promoted

**Problem:** the `.project-metric` line (store availability, version,
GitHub stars, etc., the strongest "proof of scale" content on the page)
was rendered as tiny, fully muted mono text, smaller and less visible than
the surrounding body copy.

**Fix:** gave it a top border separator, bumped font size, and colored the
`<strong>` highlights in the accent blue instead of plain text color. Also
widened `.project-desc` from `max-width: 520px` to `600px` so the
description column lines up with the 720px-wide banner image above it
instead of looking narrower by accident.

## Not done, held off intentionally

- **Hero/visual upgrade** (animated gradient backdrop, particle effect, or
  custom illustrated banner instead of the circular avatar): this is a
  bigger design decision involving new assets and a possible style
  departure. Didn't want to guess at a direction without sign-off.
- **Case-study restructuring** (Problem / Approach / Result sections per
  project): the existing project descriptions and metric lines already
  contain accurate, specific facts. Restructuring them risked
  misrepresenting details, so only the visual presentation of the existing
  metric line was upgraded (see #7), not the content itself.
- **Google Fonts non-blocking load**: considered making the fonts
  stylesheet async, but it's used by the hero `<h1>` (the single biggest
  above-the-fold element), and an async swap risks trading render-blocking
  time for a layout shift if fallback-font metrics differ. Left as-is.

## Verification performed

All changes were checked locally with a Python `http.server` on the
working tree and Playwright (Chromium), in both light and dark theme,
including:
- No new console errors introduced.
- Hover and scroll-triggered interactions fire correctly.
- Turnstile widget still renders and the contact form's submit flow is
  unchanged.
- Tag balance sanity check (`<div>`/`</div>`, `<section>`/`</section>`
  counts match).

No automated test suite exists for this static site; verification was
manual/visual via the browser.
