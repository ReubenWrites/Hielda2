// Shared FAQ data — used by both the visible accordion on the landing page
// and the build-time prerender (which bakes the FAQPage JSON-LD into the
// static HTML so Google indexes it on first crawl, no JS needed).

export const LANDING_FAQS = [
  {
    q: "How does Hielda work?",
    a: "When an invoice goes unpaid, Hielda sends your client escalating chase emails on your behalf — starting with friendly reminders before the due date, then formal notices that add the statutory interest and fixed debt recovery cost you're legally entitled to under UK law. You're CC'd on every email but never have to be the one asking for the money.",
  },
  {
    q: "I didn't know I was allowed to charge fees on late payments — is that real?",
    a: "Yes. Under the UK Late Payment of Commercial Debts (Interest) Act 1998, every overdue B2B invoice automatically accrues statutory interest at 8% above the Bank of England base rate, plus a fixed sum for the cost of recovering the debt: £40 (invoices under £1,000), £70 (£1,000–£9,999.99), or £100 (£10,000+). You don't need it in your contract — the right is automatic. Most freelancers never claim it because they don't know they can.",
  },
  {
    q: "Won't my client be annoyed with me?",
    a: "The chase doesn't come from you. Hielda acts as your outsourced accounts team — your client receives formal notices from a third party, not from you personally. This is exactly how every large company handles late payment: the person who commissioned the work and the accounts team are separate. You stay the good guy.",
  },
  {
    q: "Is this all actually legal?",
    a: "Yes. The Late Payment of Commercial Debts (Interest) Act 1998 is a UK statute giving every B2B supplier the right to charge interest and a fixed sum for debt recovery costs on overdue invoices. Hielda doesn't go beyond what the law already permits — it just makes claiming what you're owed automatic instead of awkward.",
  },
  {
    q: "How much does Hielda cost?",
    a: "£3.99 a month or £34.99 a year (saves about 27%). 6-week free trial, no credit card required. One late payment fee recovered through Hielda typically covers more than a year of subscription.",
  },
  {
    q: "My client hasn't paid my invoice — what can I do?",
    a: "Under the Late Payment of Commercial Debts Act 1998, you have the legal right to charge statutory interest at 8% above the Bank of England base rate, plus a fixed debt recovery cost of £40–£100 on every overdue B2B invoice. You can send formal chase emails, add these charges automatically, and escalate to a legal notice if needed. Hielda automates this entire process so you never have to ask awkwardly for your own money.",
  },
  {
    q: "How long can a client legally take to pay an invoice in the UK?",
    a: "By default, payment is due within 30 days for business-to-business transactions. If no payment terms are agreed, the 30-day statutory period applies automatically. Once that period expires, the invoice is legally overdue and statutory interest begins to accrue daily.",
  },
  {
    q: "Can I charge interest on an overdue invoice in the UK?",
    a: "Yes. Under the Late Payment of Commercial Debts Act 1998, you are legally entitled to charge interest at 8% above the Bank of England base rate on any overdue B2B invoice. This right applies automatically — you don't need to have stated it on your original invoice or in your contract.",
  },
  {
    q: "What fixed debt recovery cost can I claim?",
    a: "The Act entitles you to a fixed sum for the cost of recovering the debt on top of interest: £40 for invoices under £1,000, £70 for invoices between £1,000 and £9,999.99, and £100 for invoices of £10,000 or more. These apply per invoice, in addition to the daily interest that accrues.",
  },
  {
    q: "How do I chase a late invoice without damaging the client relationship?",
    a: "The key is separating the personal relationship from the commercial process. Your client receives formal notices from a third party acting on your behalf — it's not personal, it's just business. This is exactly how large companies operate: the person who commissioned your work and the accounts department are completely separate teams. You stay the good guy; Hielda handles the uncomfortable part.",
  },
  {
    q: "Does the Late Payment Act apply to my invoices?",
    a: "The Act applies to business-to-business (B2B) transactions — both parties must be acting in the course of a business. It does not cover invoices to consumers. It applies throughout the UK and covers most commercial contracts, including freelance and contractor work.",
  },
  {
    q: "Why is Hielda better than just chasing clients myself?",
    a: "When you chase a client yourself, you're asking a favour from someone whose goodwill you depend on. Every email you send puts you in an awkward position — too soft and they ignore it, too firm and you risk the relationship. Hielda removes you from the equation entirely. Your client hears from a third party acting on your behalf, which carries far more weight and creates no personal friction. You stay professional, they feel the pressure, and you never have to have an uncomfortable conversation.",
  },
  {
    q: "How does Hielda protect me from blowback from my client?",
    a: "Hielda acts as your outsourced accounts team — a third party that handles all the chasing and applies charges on your behalf. Your client receives formal notices from that third party, not from you personally. This gives them a face-saving way to pay without either of you having to acknowledge an awkward dynamic. If a client pushes back, you can truthfully say 'my outsourced accounting team applies those charges automatically to anyone who pays late — it's nothing personal.' That's a very different conversation from having to ask for your money yourself.",
  },
  {
    q: "I invoice both businesses and homeowners — can Hielda help with both?",
    a: "Yes. Hielda supports both B2B and consumer invoicing. For business clients, the full Late Payment Act applies automatically — statutory interest and the fixed debt recovery cost. For consumer clients (individuals, homeowners), you can toggle 'Consumer' when creating an invoice and Hielda will add contractual payment terms to the invoice, including interest at the same rate. The chase sequence runs identically — your client still receives the full escalation sequence. This is particularly useful for tradespeople, contractors, and anyone who works for both companies and individuals.",
  },
  {
    q: "Is it true that companies really delay payment on purpose?",
    a: "Yes — and it's well documented. Large companies routinely use extended payment terms (60, 90, even 120 days) as a cash flow management strategy, effectively using suppliers as interest-free lenders. A 2023 report by the Federation of Small Businesses found that 52% of UK small businesses were paid late, with the average overdue amount exceeding £8,500. For large businesses, delaying payment to freelancers and SMEs is a deliberate financial decision made by accounts departments — the person who hired you often has no idea it's happening.",
  },
]
