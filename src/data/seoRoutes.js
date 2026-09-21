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
    title: "Late Payment Chasing for UK Freelancers — Hielda",
    description:
      "Hielda automatically chases late-paying clients for UK freelancers and SMEs and enforces statutory interest plus the fixed debt recovery cost under the Late Payment of Commercial Debts (Interest) Act 1998. 6-week free trial, no credit card.",
    extraSchemas: [FAQ_SCHEMA],
  },
  {
    path: "/calculator",
    file: "calculator.html",
    title: "Late Payment Interest Calculator (UK) — Hielda",
    description:
      "Free calculator for the statutory interest and fixed debt recovery cost owed on overdue UK invoices under the Late Payment of Commercial Debts (Interest) Act 1998. For freelancers and small businesses.",
    ogImage: `${SITE}/og/calculator.png`,
  },
  {
    path: "/late-payment-letter-template",
    file: "late-payment-letter-template.html",
    title: "Free Late Payment Letter Generator (UK) — Hielda",
    description:
      "Free late payment demand letter generator for UK freelancers. Fill in your invoice details and get a ready-to-send letter citing the Late Payment of Commercial Debts (Interest) Act 1998, with statutory interest calculated.",
    ogImage: `${SITE}/og/late-payment-letter-template.png`,
  },
  {
    path: "/how",
    file: "how.html",
    title: "How Hielda Works — Automatic Late Payment Chasing",
    description:
      "Step by step: how Hielda chases late-paying clients automatically with escalating, legally-backed reminders so freelancers don't have to ask for their own money.",
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
    file: "guides-late-payment-act-1998-explained.html",
    title: "Late Payment Act 1998 explained for freelancers — Hielda",
    description:
      "Plain-English guide to the UK statute that gives every business the right to charge statutory interest and a fixed debt recovery cost on overdue B2B invoices.",
    ogImage: `${SITE}/og/guide-late-payment-act.png`,
  },
  {
    path: "/guides/how-to-chase-late-invoices",
    file: "guides-how-to-chase-late-invoices.html",
    title: "How to chase late invoices: a UK playbook — Hielda",
    description:
      "Day-by-day timeline professional accounts teams use to chase late invoices, adapted for freelancers. Covers reminders, formal letters, and when to escalate.",
    ogImage: `${SITE}/og/guide-how-to-chase.png`,
  },
  {
    path: "/guides/client-not-paying-invoice",
    file: "guides-client-not-paying-invoice.html",
    title: "Client not paying your invoice? What to do — Hielda",
    description:
      "A practical, step-by-step escalation path for UK freelancers when a client won't pay: polite chases, statutory charges, Letter Before Action, and court — plus what not to do.",
    ogImage: `${SITE}/og/guide-client-not-paying.png`,
  },
  {
    path: "/guides/letter-before-action",
    file: "guides-letter-before-action.html",
    title: "Letter Before Action for an unpaid invoice (UK) — Hielda",
    description:
      "How to write and send a Letter Before Action for an unpaid invoice in the UK: what it must contain, response windows for companies vs sole traders, and why it usually gets you paid.",
    ogImage: `${SITE}/og/guide-letter-before-action.png`,
  },
  {
    path: "/guides/small-claims-court-unpaid-invoice",
    file: "guides-small-claims-court-unpaid-invoice.html",
    title: "Small claims court for an unpaid invoice — Hielda",
    description:
      "Honest guide to Money Claim Online for unpaid invoices: when court is worth it, current fees, what to write, what happens after filing, and enforcement if they still don't pay.",
    ogImage: `${SITE}/og/guide-small-claims.png`,
  },
  {
    path: "/guides/how-much-interest-late-invoice",
    file: "guides-how-much-interest-late-invoice.html",
    title: "How much interest on a late invoice in the UK? — Hielda",
    description:
      "The statutory rate is 8% above Bank of England base rate, accruing daily, plus a £40–£100 fixed recovery cost. The exact formula, worked examples, and how to claim it.",
    ogImage: `${SITE}/og/guide-how-much-interest.png`,
  },
  {
    path: "/guides/invoice-payment-terms-uk",
    file: "guides-invoice-payment-terms-uk.html",
    title: "Invoice payment terms for UK freelancers — Hielda",
    description:
      "What payment terms UK freelancers should use, the 30-day legal default, the 60-day cap on B2B terms, and how to state terms so they actually stick.",
    ogImage: `${SITE}/og/guide-payment-terms.png`,
  },
  {
    path: "/guides/debt-collection-agency-vs-diy",
    file: "guides-debt-collection-agency-vs-diy.html",
    title: "Debt collection agency vs DIY for unpaid invoices — Hielda",
    description:
      "Honest comparison of the ways to recover an unpaid invoice in the UK: chasing it yourself, debt collection agencies and their fees, solicitors and court, and automation — with a clear decision guide.",
    ogImage: `${SITE}/og/guide-debt-collection-agency.png`,
  },
  {
    path: "/guides/freelancer-rights-late-payment",
    file: "guides-freelancer-rights-late-payment.html",
    title: "Your legal rights when a client pays late (UK) — Hielda",
    description:
      "UK freelancers have unusually strong late-payment rights: statutory interest, fixed recovery costs, six years to claim, and court access without a solicitor. Here's how to use them.",
    ogImage: `${SITE}/og/guide-freelancer-rights.png`,
  },
]

export const seoForPath = (pathname) => SEO_ROUTES.find((r) => r.path === pathname) || null
