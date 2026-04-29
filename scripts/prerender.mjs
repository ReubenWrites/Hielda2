// Post-build step: produce per-route HTML files in dist/ with route-specific
// title / description / canonical / og / twitter / JSON-LD baked in.
//
// Why: Hielda is an SPA, so on first crawl Google sees the same index.html
// for every route. The per-route document.title updates in App.jsx happen
// client-side after JS runs, which Google's crawler treats unreliably. With
// these per-route HTML files served via vercel.json rewrites, each marketing
// page (calculator, letter template, how, privacy) ships unique meta in the
// HTML response itself.

import fs from "node:fs"
import path from "node:path"

const DIST = "dist"
const SITE = "https://hielda.com"

// Import shared FAQ data so the JSON-LD on the home page exactly matches the
// visible accordion the user sees. Mismatched FAQ schema is a Search Console
// violation.
const { LANDING_FAQS } = await import("../src/data/faqs.js")

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
}

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to chase late invoices automatically and claim statutory interest",
  description:
    "How to use Hielda to chase late-paying clients and enforce statutory interest plus the fixed debt recovery cost under the UK Late Payment of Commercial Debts (Interest) Act 1998.",
  step: [
    { "@type": "HowToStep", position: 1, name: "Create the invoice in Hielda", text: "Add the client and the work you've done. Hielda generates a professional invoice with payment details, a due date, and the legal basis for late charges." },
    { "@type": "HowToStep", position: 2, name: "Hielda monitors the due date", text: "If the invoice is paid on time, nothing happens. If the due date passes without payment, Hielda begins chasing automatically." },
    { "@type": "HowToStep", position: 3, name: "Friendly reminders go out before due", text: "Five days and one day before the invoice is due, Hielda sends polite reminders to the client so the payment isn't forgotten." },
    { "@type": "HowToStep", position: 4, name: "Statutory charges are added once overdue", text: "From day one overdue, Hielda adds 8% above Bank of England base rate interest plus the fixed debt recovery cost (£40 / £70 / £100 depending on invoice value), as set out in the Late Payment of Commercial Debts (Interest) Act 1998." },
    { "@type": "HowToStep", position: 5, name: "Escalating chases continue until paid", text: "If the invoice still isn't paid, Hielda escalates from chase to formal notice to recovery referral over the following 45 days. You're CC'd on every email." },
  ],
}

const routes = [
  {
    file: "index.html",
    canonical: `${SITE}/`,
    title: "Late Payment Chasing for UK Freelancers — Hielda",
    description:
      "Hielda automatically chases late-paying clients for UK freelancers and SMEs and enforces statutory interest plus the fixed debt recovery cost under the Late Payment of Commercial Debts (Interest) Act 1998. 6-week free trial, no credit card.",
    extraSchemas: [FAQ_SCHEMA],
  },
  {
    file: "calculator.html",
    canonical: `${SITE}/calculator`,
    title: "Late Payment Interest Calculator — UK Freelancers — Hielda",
    description:
      "Free calculator for the statutory interest and fixed debt recovery cost owed on overdue UK invoices under the Late Payment of Commercial Debts (Interest) Act 1998. For freelancers and small businesses.",
  },
  {
    file: "late-payment-letter-template.html",
    canonical: `${SITE}/late-payment-letter-template`,
    title: "Late Payment Letter Template — Free for UK Freelancers — Hielda",
    description:
      "Free, professional late payment demand letter template for UK freelancers. Cites the Late Payment of Commercial Debts (Interest) Act 1998 and includes statutory interest and fixed debt recovery cost wording.",
  },
  {
    file: "how.html",
    canonical: `${SITE}/how`,
    title: "How Hielda Works — Automatic Late Payment Chasing",
    description:
      "Step by step: how Hielda chases late-paying clients automatically with escalating, legally-backed reminders so freelancers don't have to ask for their own money.",
    extraSchemas: [HOWTO_SCHEMA],
  },
  {
    file: "privacy.html",
    canonical: `${SITE}/privacy`,
    title: "Privacy Policy — Hielda",
    description:
      "Hielda privacy policy: how we collect, use, and protect data for UK freelancers and SMEs using the platform.",
  },
]

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function setMetaContent(html, selector, value) {
  const re = new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*(")`, "i")
  if (!re.test(html)) return html
  return html.replace(re, `$1${escapeAttr(value)}$2`)
}

function setTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeText(title)}</title>`)
}

function setCanonical(html, url) {
  return html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${escapeAttr(url)}$2`)
}

function injectSchemas(html, schemas) {
  if (!schemas?.length) return html
  const blocks = schemas
    .map(s => `    <script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n")
  return html.replace("</head>", `${blocks}\n  </head>`)
}

const baseHtmlPath = path.join(DIST, "index.html")
if (!fs.existsSync(baseHtmlPath)) {
  console.error(`prerender: ${baseHtmlPath} not found — has \`vite build\` run?`)
  process.exit(1)
}
const baseHtml = fs.readFileSync(baseHtmlPath, "utf-8")

let written = 0
for (const route of routes) {
  let html = baseHtml
  html = setTitle(html, route.title)
  html = setMetaContent(html, 'name="description"', route.description)
  html = setCanonical(html, route.canonical)
  html = setMetaContent(html, 'property="og:title"', route.title)
  html = setMetaContent(html, 'property="og:description"', route.description)
  html = setMetaContent(html, 'property="og:url"', route.canonical)
  html = setMetaContent(html, 'name="twitter:title"', route.title)
  html = setMetaContent(html, 'name="twitter:description"', route.description)
  html = injectSchemas(html, route.extraSchemas)

  fs.writeFileSync(path.join(DIST, route.file), html)
  written++
  console.log(`prerender: wrote ${route.file}`)
}
console.log(`prerender: ${written} files written to ${DIST}/`)
