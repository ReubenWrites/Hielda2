// Mobile layout regression check.
//
// Renders the harness pages (harness/main.jsx) in headless Chromium at
// phone widths and fails if anything overflows the viewport horizontally.
// This is the class of bug that "looks fine on my laptop" and only shows
// up on a real handset — a desktop flex row with no phone rules.
//
//   npm run test:mobile                 # check all pages at 360px
//   npm run test:mobile -- --shots DIR  # also save full-page screenshots
//   HIELDA_CHROMIUM=/path/to/chrome     # override the browser binary
//
// Skips (exit 0, with a message) when no Chromium is available, so it
// never blocks a build machine that lacks a browser.

import fs from "node:fs"
import path from "node:path"
import { createServer } from "vite"

const PAGES = ["dashboard", "detail", "create"]
const WIDTHS = [360]
const args = process.argv.slice(2)
const shotsDir = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null

function findChromium() {
  if (process.env.HIELDA_CHROMIUM && fs.existsSync(process.env.HIELDA_CHROMIUM)) return process.env.HIELDA_CHROMIUM
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME || "", ".cache", "ms-playwright")
  if (!fs.existsSync(root)) return null
  // Prefer the headless shell: it's the standalone headless build, and the
  // full Chromium binary rejects playwright-core's --headless=old flag.
  const dirs = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell")).sort().reverse()
  for (const d of dirs) {
    const p = path.join(root, d, "chrome-linux", "headless_shell")
    if (fs.existsSync(p)) return p
  }
  return null
}

const exe = findChromium()
if (!exe) {
  console.log("mobile-check: no Chromium found (set HIELDA_CHROMIUM or PLAYWRIGHT_BROWSERS_PATH) — skipping")
  process.exit(0)
}

let chromium
try {
  ({ chromium } = await import("playwright-core"))
} catch {
  console.log("mobile-check: playwright-core not installed — skipping")
  process.exit(0)
}

// The harness imports src/supabase.js, which throws without env vars.
// Any URL works — nothing is fetched successfully and nothing needs to be.
process.env.VITE_SUPABASE_URL ||= "http://127.0.0.1:1"
process.env.VITE_SUPABASE_KEY ||= "mobile-check"

const server = await createServer({ configFile: "vite.config.js", server: { port: 0, strictPort: false }, logLevel: "silent" })
await server.listen()
const port = server.config.server.port || server.httpServer.address().port
const base = `http://localhost:${port}/harness/`

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] })
let failures = 0
try {
  for (const width of WIDTHS) {
    for (const page of PAGES) {
      const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
      const p = await ctx.newPage()
      const pageErrors = []
      p.on("pageerror", (e) => pageErrors.push(e.message))
      await p.goto(`${base}?page=${page}`, { waitUntil: "networkidle", timeout: 30000 })
      await p.waitForTimeout(500)

      // Compare against the CONFIGURED width, never window.innerWidth:
      // mobile emulation widens the layout viewport to fit overflowing
      // content (exactly what a phone does when it zooms out), which would
      // make an overflow check against innerWidth pass by definition.
      const result = await p.evaluate((limit) => {
        // An element may legitimately extend past the viewport when it
        // lives inside a horizontally scrollable container (a swipeable
        // chip row). Everything else overflowing is a layout bug.
        const scrolls = (el) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX
            if (ox === "auto" || ox === "scroll") return true
          }
          return false
        }
        const bad = []
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.right <= limit + 1) continue
          if (scrolls(el)) continue
          bad.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> right=${Math.round(r.right)}`)
        }
        return { docWidth: document.documentElement.scrollWidth, viewport: limit, bad }
      }, width)

      if (shotsDir) {
        fs.mkdirSync(shotsDir, { recursive: true })
        await p.screenshot({ path: path.join(shotsDir, `${page}-${width}.png`), fullPage: true })
      }

      const ok = result.docWidth <= result.viewport && result.bad.length === 0 && pageErrors.length === 0
      console.log(`${ok ? "PASS" : "FAIL"}  ${page.padEnd(9)} @${width}px  docWidth=${result.docWidth}`)
      if (!ok) {
        failures++
        for (const b of result.bad.slice(0, 8)) console.log("      overflow:", b)
        for (const e of pageErrors.slice(0, 3)) console.log("      page error:", e)
      }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
  await server.close()
}
if (failures) {
  console.log(`\nmobile-check: ${failures} page(s) overflow the phone viewport`)
  process.exit(1)
}
console.log("\nmobile-check: all pages fit the phone viewport")
