// The one list of public marketing routes and their <head> metadata.
//
// Used twice, and it matters that it's the same list:
//  - scripts/prerender.mjs bakes each entry into its static HTML file at
//    build time, which is what a crawler's first fetch sees;
//  - App.jsx applies the same title/description on client-side navigation.
//
// Before this file existed App.jsx kept its own three-route copy with a
// fallback to the home page's title, so once JS ran every guide, /how and
// the letter generator were retitled as the home page — and Google renders
// JS. Keep both readers pointed here.

// Extension required: scripts/prerender.mjs imports this under plain Node.
import { LANDING_FAQS } from "./faqs.js"

const SITE = "https://hielda.com"

export const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
}

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Hielda",
  url: SITE,
  inLanguage: "en-GB",
  publisher: { "@type": "Organization", name: "Hielda", url: SITE },
}

export const HOWTO_SCHEMA = {
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
    { "@type": "HowToStep", position: 5, name: "Escalating chases continue until paid", text: "If the invoice still isn't paid, Hielda escalates from chase to final notice over the first 30 days, then sends monthly formal reminders and drafts a Letter Before Action when you choose. You're BCC'd on every email." },
  ],
}

// Titles stay under 60 characters so results pages don't truncate them.
export const SEO_ROUTES = [
  {
    path: "/",
    file: "index.html",
    // WebSite + FAQ on the home page; Organization/SoftwareApplication live in index.html.

    title: "Late Payment Chasing for UK Freelancers — Hielda",
    description:
      "Hielda chases late invoices for UK freelancers and SMEs and adds the statutory interest and fixed recovery fee the Late Payment Act allows. Free 6-week trial.",
    extraSchemas: [WEBSITE_SCHEMA, FAQ_SCHEMA],
  },
  {
    path: "/calculator",
    file: "calculator.html",
    title: "Late Payment of Commercial Debts Act 1998 Calculator (UK) — Hielda",
    description:
      "Free UK late payment interest calculator under the Late Payment of Commercial Debts (Interest) Act 1998: 8% above base rate plus the £40–£100 fixed fee.",
    ogImage: `${SITE}/og/calculator.png`,
  },
  {
    path: "/late-payment-letter-template",
    file: "late-payment-letter-template.html",
    title: "Free Late Payment Letter Generator (UK) — Hielda",
    description:
      "Free late payment letter generator for UK freelancers: enter your invoice and get a formal demand citing the Late Payment Act 1998 with interest worked out.",
    ogImage: `${SITE}/og/late-payment-letter-template.png`,
  },
  {
    path: "/how",
    file: "how.html",
    title: "How Hielda Works — Automatic Late Payment Chasing",
    description:
      "How Hielda chases late invoices automatically: escalating, legally backed reminders, statutory charges applied, and a Letter Before Action at 30 days.",
    extraSchemas: [HOWTO_SCHEMA],
  },
  {
    path: "/privacy",
    file: "privacy.html",
    title: "Privacy Policy — Hielda",
    description:
      "Hielda privacy policy: how we collect, use, and protect data for UK freelancers and SMEs using the platform.",
  },
  {
    path: "/auth",
    // No static file: /auth is app, not marketing, and stays out of the sitemap.
    title: "Start Free Trial — Hielda",
    description:
      "6-week free trial, no credit card required. Automatic invoice chasing and late payment enforcement for UK freelancers.",
  },
  {
    path: "/guides",
    file: "guides.html",
    title: "Guides for UK freelancers and SMEs — Hielda",
    description:
      "Plain-English explainers, free tools, and templates for getting paid on time and enforcing what you're owed under UK late payment law.",
    ogImage: `${SITE}/og/guides.png`,
  },
  {
    path: "/guides/late-payment-act-1998-explained",
    datePublished: "2026-05-18",
    file: "guides-late-payment-act-1998-explained.html",
    title: "Late Payment Act 1998 explained for freelancers — Hielda",
    description:
      "Plain-English guide to the UK statute that gives every business the right to charge statutory interest and a fixed debt recovery cost on overdue B2B invoices.",
    ogImage: `${SITE}/og/guide-late-payment-act.png`,
  },
  {
    path: "/guides/how-to-chase-late-invoices",
    datePublished: "2026-05-18",
    file: "guides-how-to-chase-late-invoices.html",
    title: "How to chase late invoices: a UK playbook — Hielda",
    description:
      "Day-by-day timeline professional accounts teams use to chase late invoices, adapted for freelancers. Covers reminders, formal letters, and when to escalate.",
    ogImage: `${SITE}/og/guide-how-to-chase.png`,
  },
  {
    path: "/guides/client-not-paying-invoice",
    datePublished: "2026-06-11",
    file: "guides-client-not-paying-invoice.html",
    title: "Client not paying your invoice? What to do — Hielda",
    description:
      "Step-by-step for UK freelancers when a client won't pay: polite chases, statutory charges, a Letter Before Action, court — and the mistakes to avoid.",
    ogImage: `${SITE}/og/guide-client-not-paying.png`,
  },
  {
    path: "/guides/letter-before-action",
    datePublished: "2026-06-11",
    file: "guides-letter-before-action.html",
    title: "Letter Before Action for an unpaid invoice (UK) — Hielda",
    description:
      "How to write and send a Letter Before Action for an unpaid invoice in the UK: what it must say, the 14- or 30-day deadline, and why it usually gets paid.",
    ogImage: `${SITE}/og/guide-letter-before-action.png`,
  },
  {
    path: "/guides/small-claims-court-unpaid-invoice",
    datePublished: "2026-06-11",
    file: "guides-small-claims-court-unpaid-invoice.html",
    title: "Small claims court for an unpaid invoice — Hielda",
    description:
      "Money Claim Online for an unpaid invoice: when court is worth it, current fees, what to write, what happens after filing, and enforcement if they don't pay.",
    ogImage: `${SITE}/og/guide-small-claims.png`,
  },
  {
    path: "/guides/how-much-interest-late-invoice",
    datePublished: "2026-06-11",
    file: "guides-how-much-interest-late-invoice.html",
    title: "How much interest on a late invoice in the UK? — Hielda",
    description:
      "The UK statutory rate is 8% above base rate, accruing daily, plus a £40–£100 fixed recovery cost. The formula, worked examples, and how to claim it.",
    ogImage: `${SITE}/og/guide-how-much-interest.png`,
  },
  {
    path: "/guides/invoice-payment-terms-uk",
    datePublished: "2026-06-11",
    file: "guides-invoice-payment-terms-uk.html",
    title: "Invoice payment terms for UK freelancers — Hielda",
    description:
      "What payment terms UK freelancers should use, the 30-day legal default, the 60-day cap on B2B terms, and how to state terms so they actually stick.",
    ogImage: `${SITE}/og/guide-payment-terms.png`,
  },
  {
    path: "/guides/debt-collection-agency-vs-diy",
    datePublished: "2026-06-11",
    file: "guides-debt-collection-agency-vs-diy.html",
    title: "Debt collection agency vs DIY for unpaid invoices — Hielda",
    description:
      "Chasing an unpaid invoice yourself, a debt collection agency, a solicitor, or automation: fees, speed and trade-offs compared for UK freelancers.",
    ogImage: `${SITE}/og/guide-debt-collection-agency.png`,
  },
  {
    path: "/guides/freelancer-rights-late-payment",
    datePublished: "2026-06-11",
    file: "guides-freelancer-rights-late-payment.html",
    title: "Your legal rights when a client pays late (UK) — Hielda",
    description:
      "UK freelancers' late-payment rights: statutory interest, fixed recovery costs, six years to claim, and court access without a solicitor. How to use them.",
    ogImage: `${SITE}/og/guide-freelancer-rights.png`,
  },
]

export const seoForPath = (pathname) => SEO_ROUTES.find((r) => r.path === pathname) || null

/** BreadcrumbList for a route: Home › (Guides ›) Page. The guides render
 *  their own inside GuideLayout; prerender adds this for everything else. */
export const breadcrumbSchema = (route) => {
  const items = [{ name: "Home", item: SITE + "/" }]
  if (route.path.startsWith("/guides/")) items.push({ name: "Guides", item: SITE + "/guides" })
  items.push({ name: route.title.replace(/\s+[—-]\s+Hielda$/, ""), item: SITE + route.path })
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.item })),
  }
}
