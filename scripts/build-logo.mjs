// Renders the Hielda logo lockups (shield + wordmark) to PNG, for the
// Google OAuth consent screen, directories, and the Organization schema.
//   node scripts/build-logo.mjs
// Writes public/logo-square-512.png, public/logo-square-120.png and
// public/logo-wide-1024.png. Same shield path as ShieldLogo in ui.jsx.

import fs from "node:fs"
import { Resvg } from "@resvg/resvg-js"

const BLUE = "#1e5fa0"
const INK = "#0f172a"
const FONT = "Arial, Helvetica, sans-serif"

const shield = (x, y, scale, fill = BLUE) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M40 4 L72 16 L72 52 Q72 78 40 92 Q8 78 8 52 L8 16 Z" fill="${fill}"/>
    <rect x="24" y="26" width="8" height="40" rx="2" fill="#fff"/>
    <rect x="48" y="26" width="8" height="40" rx="2" fill="#fff"/>
    <rect x="30" y="42" width="20" height="8" rx="2" fill="#fff"/>
  </g>`

// Square: shield above the wordmark, white background, rounded corners.
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#fff"/>
  ${shield(136, 64, 2.3)}
  <text x="256" y="430" text-anchor="middle" font-family="${FONT}" font-size="118" font-weight="700" letter-spacing="-3" fill="${INK}">Hielda</text>
</svg>`

// Wide: shield left of the wordmark, as in the site header.
const wide = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="320" viewBox="0 0 1024 320">
  <rect width="1024" height="320" fill="#fff"/>
  ${shield(96, 40, 2.5)}
  <text x="330" y="222" font-family="${FONT}" font-size="176" font-weight="700" letter-spacing="-5" fill="${INK}">Hielda</text>
</svg>`

function render(svg, width, out) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true } }).render().asPng()
  fs.writeFileSync(out, png)
  console.log(`wrote ${out} (${png.length} bytes)`)
}

render(square, 512, "public/logo-square-512.png")
render(square, 120, "public/logo-square-120.png")
render(wide, 1024, "public/logo-wide-1024.png")
