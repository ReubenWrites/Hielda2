// Article + Breadcrumb + FAQ JSON-LD for the "Hielda vs ..." pages.
// GuideLayout adds image/dates to the Article node at render time.
export function comparisonSchema({ title, lede, canonical, faqs }) {
  const url = `https://hielda.com${canonical}`
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: title,
        description: lede,
        url,
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "Hielda", url: "https://hielda.com" },
        publisher: { "@type": "Organization", name: "Hielda", url: "https://hielda.com" },
        inLanguage: "en-GB",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  }
}

// What Hielda does, stated once so the four pages can't drift apart.
export const HIELDA_PRICE = "£3.99 a month, or £34.99 a year"
export const HIELDA_TRIAL = "6-week free trial, no card"
