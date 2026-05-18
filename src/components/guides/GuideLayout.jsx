import { useEffect, useState } from "react"
import { ShieldLogo } from "../ui"
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
  // Bake the Article (+ optional FAQPage) JSON-LD into the page on mount.
  // Prerender builds the same schema into the static HTML for first crawl;
  // this useEffect is a defence-in-depth for any client-side navigation.
  useEffect(() => {
    if (!schema) return
    const tag = document.createElement("script")
    tag.type = "application/ld+json"
    tag.id = `guide-schema-${canonicalPath}`
    tag.text = JSON.stringify(schema)
    document.head.appendChild(tag)
    return () => document.getElementById(`guide-schema-${canonicalPath}`)?.remove()
  }, [schema, canonicalPath])

  const [openFaq, setOpenFaq] = useState(null)

  return (
    <main className={s.page}>
      <nav className={s.nav}>
        <div className={s.navLogo} onClick={onBack}>
          <ShieldLogo size={28} />
          <span className={s.navLogoText}>Hielda</span>
        </div>
        <button onClick={onGetStarted} className={s.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      <article className={s.article}>
        <nav className={s.breadcrumbs} aria-label="Breadcrumb">
          <a onClick={onBack} style={{ cursor: "pointer" }}>Home</a>
          {" · "}
          <a onClick={() => (window.location.href = "/guides")} style={{ cursor: "pointer" }}>Guides</a>
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

        <div className={s.cta}>
          <div className={s.ctaTitle}>Let Hielda handle this for you</div>
          <p className={s.ctaText}>
            Stop writing chase emails and calculating interest by hand. Hielda
            does it all on your behalf — automatically, professionally, and
            legally backed.
          </p>
          <button onClick={onGetStarted} className={s.ctaBtn}>
            Start your free 6-week trial
          </button>
          <p className={s.ctaSmall}>No credit card required</p>
        </div>
      </article>
    </main>
  )
}
