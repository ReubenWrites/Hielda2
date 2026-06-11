// Generates the Open Graph share images used by Facebook/LinkedIn/
// Twitter/iMessage/Slack when Hielda links are shared.
//
// - public/og-image.png — the brand default (home page and fallback)
// - public/og/<slug>.png — per-page images for guides and free tools,
//   with the page title rendered large. When a guide link is pasted
//   into a community thread, the preview shows what the page answers
//   instead of a generic brand card — meaningfully better CTR.
//
// Why a build step rather than static assets: the SVG sources live here
// (versioned with the brand) and resvg-js is pure-JS-via-WASM so it runs
// in any Node environment (Vercel's build runtime included).
//
// Dimensions: 1200x630 — the "large image" card spec.

import fs from "node:fs"
import path from "node:path"
import { Resvg } from "@resvg/resvg-js"

const W = 1200
const H = 630

function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Shared chrome: dark gradient, dot grid, glow, small shield + wordmark.
function frame(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.2" r="0.6">
      <stop offset="0%" stop-color="#1e5fa0" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1e5fa0" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${inner}
</svg>`
}

const shieldSmall = (x, y, scale) => `
  <g transform="translate(${x}, ${y}) scale(${scale})">
    <path d="M70 8 L130 30 L130 100 Q130 145 70 175 Q10 145 10 100 L10 30 Z"
      fill="#1e5fa0" stroke="#3b82c4" stroke-width="2"/>
    <rect x="42" y="48" width="14" height="78" rx="3" fill="#ffffff"/>
    <rect x="84" y="48" width="14" height="78" rx="3" fill="#ffffff"/>
    <rect x="52" y="78" width="36" height="14" rx="3" fill="#ffffff"/>
  </g>`

// ── Brand default (unchanged design) ────────────────────────────────────
const defaultSvg = frame(`
  ${shieldSmall(80, 175, 1)}
  <text x="240" y="245"
    font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700"
    fill="#ffffff" letter-spacing="-2">Hielda</text>
  <text x="240" y="335"
    font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600"
    fill="#ffffff">Late payment chasing</text>
  <text x="240" y="385"
    font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600"
    fill="#3b82c4">for UK freelancers</text>
  <rect x="80" y="490" width="540" height="56" rx="28" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
  <text x="350" y="526" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="500"
    fill="#cbd5e1">Late Payment of Commercial Debts Act 1998</text>
  <text x="${W - 80}" y="${H - 50}" text-anchor="end"
    font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="500"
    fill="#94a3b8">hielda.com</text>
`)

// ── Per-page card ────────────────────────────────────────────────────────
// eyebrow (FREE GUIDE / FREE TOOL), title on up to 3 pre-split lines,
// brand chip top-left, URL bottom-right.
function pageSvg({ eyebrow, lines }) {
  const titleSize = lines.length >= 3 ? 56 : 64
  const lineHeight = titleSize * 1.18
  const firstBaseline = 285
  const titleText = lines
    .map((line, i) => `<text x="80" y="${firstBaseline + i * lineHeight}"
      font-family="Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="700"
      fill="#ffffff" letter-spacing="-1.5">${escapeText(line)}</text>`)
    .join("\n")

  return frame(`
  ${shieldSmall(80, 60, 0.42)}
  <text x="150" y="118"
    font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700"
    fill="#ffffff" letter-spacing="-1">Hielda</text>

  <text x="82" y="205"
    font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700"
    fill="#3b82c4" letter-spacing="3">${escapeText(eyebrow.toUpperCase())}</text>

  ${titleText}

  <rect x="80" y="${H - 110}" width="460" height="52" rx="26" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
  <text x="310" y="${H - 76}" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="500"
    fill="#cbd5e1">UK Late Payment Act 1998 · plain English</text>

  <text x="${W - 80}" y="${H - 74}" text-anchor="end"
    font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="500"
    fill="#94a3b8">hielda.com</text>
`)
}

// Per-page cards. Lines are pre-split by hand — SVG has no text wrapping,
// and hand-set breaks read better than algorithmic ones anyway.
const PAGES = [
  { slug: "calculator", eyebrow: "Free tool", lines: ["Late payment interest", "calculator"] },
  { slug: "late-payment-letter-template", eyebrow: "Free tool", lines: ["Late payment", "letter generator"] },
  { slug: "guides", eyebrow: "Guides", lines: ["Getting paid on time:", "guides for UK freelancers"] },
  { slug: "guide-late-payment-act", eyebrow: "Free guide", lines: ["The Late Payment Act,", "explained"] },
  { slug: "guide-how-to-chase", eyebrow: "Free guide", lines: ["How to chase", "late invoices"] },
  { slug: "guide-client-not-paying", eyebrow: "Free guide", lines: ["Client not paying?", "What to do,", "step by step"] },
  { slug: "guide-letter-before-action", eyebrow: "Free guide", lines: ["Letter Before Action:", "how to write one"] },
  { slug: "guide-small-claims", eyebrow: "Free guide", lines: ["Small claims court", "for unpaid invoices:", "is it worth it?"] },
  { slug: "guide-how-much-interest", eyebrow: "Free guide", lines: ["How much interest", "can you charge on", "a late invoice?"] },
  { slug: "guide-payment-terms", eyebrow: "Free guide", lines: ["Invoice payment terms:", "30 days, 14, or 7?"] },
  { slug: "guide-freelancer-rights", eyebrow: "Free guide", lines: ["Your rights when", "a client pays late"] },
  { slug: "guide-debt-collection-agency", eyebrow: "Free guide", lines: ["Debt collection agency,", "DIY, or automation?"] },
]

function renderPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    background: "transparent",
  })
  return resvg.render().asPng()
}

function writeBoth(rel, buf) {
  for (const root of ["public", "dist"]) {
    const p = path.join(root, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, buf)
  }
}

// Default brand image
const defaultPng = renderPng(defaultSvg)
writeBoth("og-image.png", defaultPng)
console.log(`og-image: wrote og-image.png (${defaultPng.length} bytes, ${W}x${H})`)

// Per-page images
for (const page of PAGES) {
  const png = renderPng(pageSvg(page))
  writeBoth(path.join("og", `${page.slug}.png`), png)
  console.log(`og-image: wrote og/${page.slug}.png (${png.length} bytes)`)
}
