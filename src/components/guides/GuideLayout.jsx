import { useState } from "react"
import { ShieldLogo } from "../ui"
import { trackEvent } from "../../posthog"
import s from "./guides.module.css"

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
  children,
}) {
  const [openFaq, setOpenFaq] = useState(null)

  // Real hrefs on every navigation element. The prerender renders this
  // component to static HTML for crawlers, and an <a> without an href is
  // not a link to a crawler; the onClick keeps in-app navigation snappy.
  const go = (fn) => (e) => { e.preventDefault(); fn() }

  return (
    <main className={s.page}>
      {/* Article (+ optional FAQPage) JSON-LD, rendered inline so it's in
          the prerendered HTML on first crawl, not added by an effect after
          JS runs. Google accepts JSON-LD anywhere in the document. */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      )}
      <nav className={s.nav}>
        <a href="/" className={s.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </a>
        <button onClick={() => { trackEvent("guide_cta_clicked", { guide: canonicalPath, placement: "nav" }); onGetStarted() }} className={s.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a href="/" onClick={go(onBack)}>Home</a>
          {" · "}
          <a href="/guides">Guides</a>
          {" · "}
          <span>{title}</span>
        </nav>

        <h1 className={s.title}>{title}</h1>
        {lede && <p className={s.lede}>{lede}</p>}

        <div className={s.body}>{children}</div>

        {faqs?.length > 0 && (
          <section>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "36px 0 14px" }}>
              Frequently asked questions
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

        {related?.length > 0 && (
          <section className={s.related}>
            <div className={s.relatedTitle}>Related</div>
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
          <div className={s.relatedTitle}>Free tools</div>
          <div className={s.relatedList}>
            <a href="/calculator" className={s.relatedCard}>
              <h3 className={s.relatedCardTitle}>Late payment interest calculator</h3>
              <p className={s.relatedCardDesc}>Exactly what you can add to an overdue invoice today: statutory interest at the current rate plus the fixed recovery cost.</p>
            </a>
            <a href="/late-payment-letter-template" className={s.relatedCard}>
              <h3 className={s.relatedCardTitle}>Late payment letter generator</h3>
              <p className={s.relatedCardDesc}>A ready-to-send demand letter citing the Act, with your figures filled in.</p>
            </a>
          </div>
        </section>

        <div className={s.cta}>
          <div className={s.ctaTitle}>Let Hielda handle this for you</div>
          <p className={s.ctaText}>
            Stop writing chase emails and calculating interest by hand. Hielda
            does it all on your behalf — automatically, professionally, and
            legally backed.
          </p>
          <button onClick={() => { trackEvent("guide_cta_clicked", { guide: canonicalPath, placement: "bottom" }); onGetStarted() }} className={s.ctaBtn}>
            Start your free 6-week trial
          </button>
          <p className={s.ctaSmall}>No credit card required</p>
        </div>
      </article>
    </main>
  )
}
