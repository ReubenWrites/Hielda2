import { useState } from "react"
import { Check } from "lucide-react"
import { ShieldLogo } from "../ui"
import { trackEvent } from "../../posthog"
import s from "./guides.module.css"
import { seoForPath, breadcrumbSchema } from "../../data/seoRoutes"

// Article rich results want an image and dates; the route table has the
// share image and the publish date, the build supplies dateModified. A
// BreadcrumbList (Home › Guides › this) goes into the same @graph so
// Search Console's Breadcrumbs report has something to validate.
function enrichGuideSchema(schema, canonicalPath, title) {
  const route = seoForPath(canonicalPath)
  const graph = Array.isArray(schema?.["@graph"]) ? schema["@graph"].map((node) => (
    node["@type"] === "Article"
      ? {
          ...node,
          ...(route?.ogImage ? { image: route.ogImage } : {}),
          ...(route?.datePublished ? { datePublished: route.datePublished } : {}),
          dateModified: typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : undefined,
        }
      : node
  )) : null
  if (!graph) return schema
  const crumbs = breadcrumbSchema(route || { path: canonicalPath, title })
  delete crumbs["@context"]
  return { ...schema, "@graph": [...graph, crumbs] }
}

// Page chrome in each language a guide is published in. English is the
// default; the French page (English letters explained for French speakers)
// passes locale="fr" so the furniture around the article matches it.
const STRINGS = {
  en: {
    home: "Home",
    guides: "Guides",
    trial: "Start Free Trial",
    faqTitle: "Frequently asked questions",
    related: "Related",
    toolsTitle: "Free tools",
    tools: [
      { href: "/calculator", title: "Late payment interest calculator", desc: "Exactly what you can add to an overdue invoice today: statutory interest at the current rate plus the fixed recovery cost." },
      { href: "/late-payment-letter-template", title: "Late payment letter generator", desc: "A ready-to-send demand letter citing the Act, with your figures filled in." },
      { href: "/free-invoice-template-uk", title: "Free UK invoice template", desc: "Fill in, download as PDF, with the late payment clause already on it." },
      { href: "/late-payment-interest-rate", title: "Current late payment interest rate", desc: "Today's statutory rate, how it is set, and what it adds per day." },
    ],
    ctaTitle: "Let Hielda handle this for you",
    ctaText: "Stop writing chase emails and calculating interest by hand. Hielda does it all on your behalf — automatically, professionally, and legally backed.",
    ctaBtn: "Start your free 6-week trial",
    ctaSmall: "No credit card required",
  },
  fr: {
    home: "Accueil",
    guides: "Guides (en anglais)",
    trial: "Essai gratuit",
    faqTitle: "Questions fréquentes",
    related: "À lire aussi (en anglais)",
    toolsTitle: "Outils gratuits (en anglais)",
    tools: [
      { href: "/calculator", title: "Calculateur d'intérêts de retard (droit anglais)", desc: "Le montant des intérêts légaux et de l'indemnité forfaitaire prévus par le Late Payment Act pour une facture en retard." },
      { href: "/late-payment-letter-template", title: "Générateur de lettre de relance en anglais", desc: "Saisissez votre facture : la mise en demeure est rédigée en anglais, avec les montants calculés." },
      { href: "/free-invoice-template-uk", title: "Modèle de facture britannique", desc: "Une facture en anglais, au format PDF, avec la clause de retard de paiement déjà rédigée." },
    ],
    ctaTitle: "Vous facturez depuis le Royaume-Uni ?",
    ctaText: "Hielda est un service britannique : il relance automatiquement vos factures impayées, en anglais, et ajoute les intérêts et l'indemnité forfaitaire prévus par le droit anglais. L'interface est en anglais.",
    ctaBtn: "Essayer gratuitement pendant 6 semaines",
    ctaSmall: "Sans carte bancaire",
  },
}

// Wraps a guide article with nav, breadcrumbs, body, CTA, and a Related
// section. Each concrete guide imports this and passes its content as
// children plus a list of related guides.
export default function GuideLayout({
  title,
  lede,
  canonicalPath,
  onBack,
  onGetStarted,
  faqs,
  related,
  schema,
  locale = "en",
  children,
}) {
  const t = STRINGS[locale] || STRINGS.en
  const [openFaq, setOpenFaq] = useState(null)
  const [leadEmail, setLeadEmail] = useState("")
  const [leadState, setLeadState] = useState("idle")

  const sendLead = async () => {
    const e = leadEmail.trim().toLowerCase()
    if (!e.includes("@") || !e.includes(".")) return
    setLeadState("sending")
    try {
      await fetch("/api/calculator-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, source: "guide" }),
      })
      setLeadState("sent")
      trackEvent("guide_lead_captured", { guide: canonicalPath })
    } catch { setLeadState("idle") }
  }

  // Real hrefs on every navigation element. The prerender renders this
  // component to static HTML for crawlers, and an <a> without an href is
  // not a link to a crawler; the onClick keeps in-app navigation snappy.
  const go = (fn) => (e) => { e.preventDefault(); fn() }

  return (
    <main className={s.page} lang={locale === "en" ? undefined : locale}>
      {/* Article (+ optional FAQPage) JSON-LD, rendered inline so it's in
          the prerendered HTML on first crawl, not added by an effect after
          JS runs. Google accepts JSON-LD anywhere in the document. */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(enrichGuideSchema(schema, canonicalPath, title)).replace(/</g, "\\u003c") }}
        />
      )}
      <nav className={s.nav}>
        <a href="/" className={s.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </a>
        <button onClick={() => { trackEvent("guide_cta_clicked", { guide: canonicalPath, placement: "nav" }); onGetStarted() }} className={s.navTrialBtn}>
          {t.trial}
        </button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a href="/" onClick={go(onBack)}>{t.home}</a>
          {" · "}
          <a href="/guides">{t.guides}</a>
          {" · "}
          <span>{title}</span>
        </nav>

        <h1 className={s.title}>{title}</h1>
        {lede && <p className={s.lede}>{lede}</p>}

        <div className={s.body}>{children}</div>

        {faqs?.length > 0 && (
          <section>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "36px 0 14px" }}>
              {t.faqTitle}
            </h2>
            <div className={s.faqList}>
              {faqs.map(({ q, a }) => {
                const isOpen = openFaq === q
                return (
                  <div key={q} className={s.faqItem}>
                    <button onClick={() => setOpenFaq(isOpen ? null : q)} className={s.faqBtn}>
                      <h3 className={s.faqQuestion}>{q}</h3>
                      <span className={s.faqToggle}>{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && <div className={s.faqAnswer}>{a}</div>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* The calculator and letter pages capture emails; the guides, which
            are most of the site's content, didn't. Same drip sequence,
            different first email (the checklist). English only: the drip
            emails are in English, so the French page leaves it out. */}
        {locale === "en" && <section className={s.lead} aria-label="Get the late payment checklist">
          {leadState !== "sent" ? (
            <>
              <div className={s.leadTitle}>Get the late payment checklist</div>
              <p className={s.leadDesc}>One email: what to put on every invoice, when to chase, what to charge, and the letter that gets stubborn clients to pay.</p>
              <div className={s.leadRow}>
                <input type="email" className={s.leadInput} placeholder="your@email.com" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendLead()} aria-label="Email address" />
                <button className={s.leadBtn} onClick={sendLead} disabled={leadState === "sending" || !leadEmail.trim()}>{leadState === "sending" ? "..." : "Send it"}</button>
              </div>
              <p className={s.leadHint}>No spam. Unsubscribe any time.</p>
            </>
          ) : (
            <p className={s.leadDone}><Check size={14} strokeWidth={2.5} /> Sent. Check your inbox.</p>
          )}
        </section>}

        {related?.length > 0 && (
          <section className={s.related}>
            <div className={s.relatedTitle}>{t.related}</div>
            <div className={s.relatedList}>
              {related.map(r => (
                <a key={r.href} href={r.href} className={s.relatedCard}>
                  <h3 className={s.relatedCardTitle}>{r.title}</h3>
                  <p className={s.relatedCardDesc}>{r.desc}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className={s.related}>
          <div className={s.relatedTitle}>{t.toolsTitle}</div>
          <div className={s.relatedList}>
            {t.tools.map((tool) => (
              <a key={tool.href} href={tool.href} className={s.relatedCard}>
                <h3 className={s.relatedCardTitle}>{tool.title}</h3>
                <p className={s.relatedCardDesc}>{tool.desc}</p>
              </a>
            ))}
          </div>
        </section>

        <div className={s.cta}>
          <div className={s.ctaTitle}>{t.ctaTitle}</div>
          <p className={s.ctaText}>{t.ctaText}</p>
          <button onClick={() => { trackEvent("guide_cta_clicked", { guide: canonicalPath, placement: "bottom" }); onGetStarted() }} className={s.ctaBtn}>
            {t.ctaBtn}
          </button>
          <p className={s.ctaSmall}>{t.ctaSmall}</p>
        </div>
      </article>
    </main>
  )
}
