// Generates the Open Graph share image (public/og-image.png) used by
// Facebook/LinkedIn/Twitter/iMessage when a Hielda link is shared.
//
// Why a build step rather than a static asset:
// - The SVG source lives in this file (versioned with the brand), so the
//   image stays in sync with brand updates.
// - resvg-js is pure-JS-via-WASM so it runs in any Node environment
//   (Vercel's build runtime included) with no native dependency.
//
// Dimensions: 1200x630 — the Facebook / LinkedIn / Twitter Card spec for
// a "large image" preview. Anything smaller renders as a tiny square
// thumbnail at best (the icon-512.png misuse), or not at all.

import fs from "node:fs"
import path from "node:path"
import { Resvg } from "@resvg/resvg-js"

const W = 1200
const H = 630

// SVG source. Hand-written to keep the bundle small. Uses Helvetica
// (universally available) as the fallback face, so we don't need to
// embed a font binary — keeps the build hermetic.
const svg = `<?xml version="1.0" encoding="UTF-8"?>
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

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Shield logo, scaled up -->
  <g transform="translate(80, 175)">
    <path d="M70 8 L130 30 L130 100 Q130 145 70 175 Q10 145 10 100 L10 30 Z"
      fill="#1e5fa0" stroke="#3b82c4" stroke-width="2"/>
    <rect x="42" y="48" width="14" height="78" rx="3" fill="#ffffff"/>
    <rect x="84" y="48" width="14" height="78" rx="3" fill="#ffffff"/>
    <rect x="52" y="78" width="36" height="14" rx="3" fill="#ffffff"/>
  </g>

  <!-- Brand name -->
  <text x="240" y="245"
    font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700"
    fill="#ffffff" letter-spacing="-2">Hielda</text>

  <!-- Tagline (line 1) -->
  <text x="240" y="335"
    font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600"
    fill="#ffffff">Late payment chasing</text>
  <text x="240" y="385"
    font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600"
    fill="#3b82c4">for UK freelancers</text>

  <!-- Statutory feature pill -->
  <rect x="80" y="490" width="540" height="56" rx="28" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.15"/>
  <text x="350" y="526" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="500"
    fill="#cbd5e1">Late Payment of Commercial Debts Act 1998</text>

  <!-- URL bottom-right -->
  <text x="${W - 80}" y="${H - 50}" text-anchor="end"
    font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="500"
    fill="#94a3b8">hielda.com</text>
</svg>`

const distOgPath = path.join("dist", "og-image.png")
const publicOgPath = path.join("public", "og-image.png")

// Render at 2x for retina-clarity, then we still serve as 1200x630.
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  background: "transparent",
})
const png = resvg.render().asPng()

// Write to dist/ for the live build, and public/ so it's reachable in
// dev too. public/ is the canonical source; dist/ is the deploy artifact.
fs.mkdirSync("public", { recursive: true })
fs.mkdirSync("dist", { recursive: true })
fs.writeFileSync(publicOgPath, png)
fs.writeFileSync(distOgPath, png)
console.log(`og-image: wrote ${publicOgPath} and ${distOgPath} (${png.length} bytes, ${W}x${H})`)
