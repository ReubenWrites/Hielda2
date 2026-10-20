import { useEffect, useMemo, useState } from "react"
import { Check, Plus, Trash2 } from "lucide-react"
import { ShieldLogo } from "./ui"
import { getRate } from "../constants"
import { trackEvent } from "../posthog"
import g from "./guides/guides.module.css"
import s from "./InvoiceTemplate.module.css"

// /free-invoice-template-uk
// A fill-in invoice with the Late Payment Act clause on it by default.
// The PDF is the browser's own print-to-PDF of the preview (no library,
// nothing uploaded); the form is kept in localStorage so a returning
// visitor doesn't retype their details.

const STORAGE_KEY = "hielda_invoice_template"
const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n) || 0)
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const longDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) }
const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  from_name: "", from_address: "", from_email: "", from_phone: "",
  to_name: "", to_address: "",
  number: "INV-0001", date: today(), terms: 30,
  items: [{ desc: "", qty: 1, price: "" }],
  vat: false, vat_number: "",
  account_name: "", sort_code: "", account_number: "",
  notes: "", late_clause: true,
}

export const TEMPLATE_FAQS = [
  { q: "What must a UK invoice include?", a: "Your business name and address, the client's name and address, a unique invoice number, the invoice date, a clear description of the goods or services, the amount due, and your payment details. VAT-registered businesses must also show their VAT number, the VAT rate and the VAT amount." },
  { q: "Do I need a late payment clause on my invoice?", a: "No. The right to statutory interest and the fixed recovery cost comes from the Late Payment of Commercial Debts (Interest) Act 1998 whether or not the invoice mentions it. Stating it on the invoice makes clients pay faster because they know what lateness will cost." },
  { q: "What payment terms should I use?", a: "Thirty days is the legal default when nothing is agreed. Fourteen or seven days is common for freelancers and perfectly enforceable if stated on the invoice and agreed up front. Shorter terms mean statutory interest starts sooner." },
  { q: "Is this invoice template really free?", a: "Yes. Fill it in, download the PDF and send it. Nothing is uploaded; the form stays in your browser. Hielda is a separate paid service that chases the invoice for you if it is not paid." },
]

export default function InvoiceTemplate({ onBack, onGetStarted }) {
  const [f, setF] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return saved ? { ...EMPTY, ...saved, date: today() } : EMPTY } catch { return EMPTY }
  })
  const [leadEmail, setLeadEmail] = useState("")
  const [leadState, setLeadState] = useState("idle")
  const [openFaq, setOpenFaq] = useState(null)

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)) } catch {} }, [f])

  const up = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const upItem = (i, k, v) => setF((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }))
  const addItem = () => setF((p) => ({ ...p, items: [...p.items, { desc: "", qty: 1, price: "" }] }))
  const rmItem = (i) => setF((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((_, j) => j !== i) : p.items }))

  const subtotal = useMemo(() => f.items.reduce((t, it) => t + (Number(it.qty) || 0) * (Number(it.price) || 0), 0), [f.items])
  const vatAmt = f.vat ? subtotal * 0.2 : 0
  const total = subtotal + vatAmt
  const due = addDays(f.date, Number(f.terms) || 30)
  const fixedCost = total >= 10000 ? 100 : total >= 1000 ? 70 : 40

  const download = () => {
    trackEvent("invoice_template_downloaded", { items: f.items.length, vat: f.vat, late_clause: f.late_clause, terms: f.terms })
    window.print()
  }

  const sendLead = async () => {
    const e = leadEmail.trim().toLowerCase()
    if (!e.includes("@") || !e.includes(".")) return
    setLeadState("sending")
    try {
      await fetch("/api/calculator-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, source: "invoice_template" }),
      })
      setLeadState("sent")
      trackEvent("invoice_template_lead_captured")
    } catch { setLeadState("idle") }
  }

  const go = (fn) => (e) => { e.preventDefault(); fn() }
  const or = (v, ph) => (v && String(v).trim() ? v : ph)

  return (
    <main className={g.page}>
      <nav className={`${g.nav} ${s.noPrint}`}>
        <a href="/" className={g.navLogo} onClick={go(onBack)} style={{ textDecoration: "none", color: "inherit" }}>
          <ShieldLogo size={28} />
          <span className={g.navLogoText}>Hielda</span>
        </a>
        <button onClick={() => { trackEvent("invoice_template_cta_clicked", { placement: "nav" }); onGetStarted() }} className={g.navTrialBtn}>
          Start Free Trial
        </button>
      </nav>

      <div className={s.wrap}>
        <header className={`${s.intro} ${s.noPrint}`}>
          <nav className={g.breadcrumbs} aria-label="Breadcrumb">
            <a href="/" onClick={go(onBack)}>Home</a>{" · "}<span>Free invoice template</span>
          </nav>
          <h1 className={g.title}>Free UK Invoice Template</h1>
          <p className={g.lede}>
            Fill in the form, download the PDF, send it. Includes everything a UK invoice legally needs, a VAT option, your bank details, and the late payment clause that gets freelancers paid on time. Nothing is uploaded.
          </p>
        </header>

        <div className={s.grid}>
          {/* ── Form ── */}
          <section className={`${s.form} ${s.noPrint}`} aria-label="Invoice details">
            <h2 className={s.h}>Your business</h2>
            <input className={s.in} placeholder="Business or trading name" value={f.from_name} onChange={(e) => up("from_name", e.target.value)} />
            <textarea className={s.in} rows={2} placeholder="Address" value={f.from_address} onChange={(e) => up("from_address", e.target.value)} />
            <div className={s.row}>
              <input className={s.in} placeholder="Email" value={f.from_email} onChange={(e) => up("from_email", e.target.value)} />
              <input className={s.in} placeholder="Phone (optional)" value={f.from_phone} onChange={(e) => up("from_phone", e.target.value)} />
            </div>

            <h2 className={s.h}>Bill to</h2>
            <input className={s.in} placeholder="Client business name" value={f.to_name} onChange={(e) => up("to_name", e.target.value)} />
            <textarea className={s.in} rows={2} placeholder="Client address" value={f.to_address} onChange={(e) => up("to_address", e.target.value)} />

            <h2 className={s.h}>Invoice</h2>
            <div className={s.row3}>
              <label className={s.lbl}>Number<input className={s.in} value={f.number} onChange={(e) => up("number", e.target.value)} /></label>
              <label className={s.lbl}>Date<input className={s.in} type="date" value={f.date} onChange={(e) => up("date", e.target.value)} /></label>
              <label className={s.lbl}>Payment terms
                <select className={s.in} value={f.terms} onChange={(e) => up("terms", Number(e.target.value))}>
                  <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option>
                </select>
              </label>
            </div>

            <h2 className={s.h}>Items</h2>
            {f.items.map((it, i) => (
              <div key={i} className={s.itemRow}>
                <input className={s.in} placeholder="Description of work" value={it.desc} onChange={(e) => upItem(i, "desc", e.target.value)} />
                <input className={s.in} type="number" min="0" step="1" placeholder="Qty" value={it.qty} onChange={(e) => upItem(i, "qty", e.target.value)} aria-label="Quantity" />
                <input className={s.in} type="number" min="0" step="0.01" placeholder="£ each" value={it.price} onChange={(e) => upItem(i, "price", e.target.value)} aria-label="Unit price" />
                <button type="button" className={s.iconBtn} onClick={() => rmItem(i)} aria-label="Remove line"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className={s.addBtn} onClick={addItem}><Plus size={14} /> Add line</button>

            <label className={s.check}><input type="checkbox" checked={f.vat} onChange={(e) => up("vat", e.target.checked)} /> I'm VAT registered (adds 20%)</label>
            {f.vat && <input className={s.in} placeholder="VAT number" value={f.vat_number} onChange={(e) => up("vat_number", e.target.value)} />}

            <h2 className={s.h}>Payment details</h2>
            <input className={s.in} placeholder="Account name" value={f.account_name} onChange={(e) => up("account_name", e.target.value)} />
            <div className={s.row}>
              <input className={s.in} placeholder="Sort code" value={f.sort_code} onChange={(e) => up("sort_code", e.target.value)} />
              <input className={s.in} placeholder="Account number" value={f.account_number} onChange={(e) => up("account_number", e.target.value)} />
            </div>
            <textarea className={s.in} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={(e) => up("notes", e.target.value)} />
            <label className={s.check}><input type="checkbox" checked={f.late_clause} onChange={(e) => up("late_clause", e.target.checked)} /> Include the statutory late payment clause (recommended)</label>

            <button type="button" className={s.dlBtn} onClick={download}>Download as PDF</button>
            <p className={s.hint}>Opens your browser's print dialog. Choose "Save as PDF" as the printer.</p>
          </section>

          {/* ── Preview (this is what prints) ── */}
          <section className={s.preview} aria-label="Invoice preview">
            <div className={s.sheet} id="invoice-sheet">
              <div className={s.sheetHead}>
                <div>
                  <div className={s.sheetFrom}>{or(f.from_name, "Your Business Name")}</div>
                  <div className={s.sheetMuted} style={{ whiteSpace: "pre-line" }}>{or(f.from_address, "Your address")}</div>
                  <div className={s.sheetMuted}>{[f.from_email, f.from_phone].filter(Boolean).join(" · ")}</div>
                </div>
                <div className={s.sheetTitle}>INVOICE</div>
              </div>

              <div className={s.sheetMeta}>
                <div>
                  <div className={s.sheetLabel}>Bill to</div>
                  <div className={s.sheetStrong}>{or(f.to_name, "Client name")}</div>
                  <div className={s.sheetMuted} style={{ whiteSpace: "pre-line" }}>{or(f.to_address, "Client address")}</div>
                </div>
                <div className={s.sheetMetaRight}>
                  <div><span className={s.sheetLabel}>Invoice no.</span> {f.number}</div>
                  <div><span className={s.sheetLabel}>Date</span> {longDate(f.date)}</div>
                  <div><span className={s.sheetLabel}>Due</span> <strong>{longDate(due)}</strong> ({f.terms} days)</div>
                  {f.vat && f.vat_number && <div><span className={s.sheetLabel}>VAT no.</span> {f.vat_number}</div>}
                </div>
              </div>

              <table className={s.sheetTable}>
                <thead><tr><th>Description</th><th className={s.r}>Qty</th><th className={s.r}>Unit</th><th className={s.r}>Amount</th></tr></thead>
                <tbody>
                  {f.items.map((it, i) => (
                    <tr key={i}>
                      <td>{or(it.desc, "Description of work")}</td>
                      <td className={s.r}>{it.qty || 0}</td>
                      <td className={s.r}>{fmt(it.price)}</td>
                      <td className={s.r}>{fmt((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {f.vat && <><tr><td colSpan={3} className={s.r}>Subtotal</td><td className={s.r}>{fmt(subtotal)}</td></tr><tr><td colSpan={3} className={s.r}>VAT 20%</td><td className={s.r}>{fmt(vatAmt)}</td></tr></>}
                  <tr className={s.totalRow}><td colSpan={3} className={s.r}>Total due</td><td className={s.r}>{fmt(total)}</td></tr>
                </tfoot>
              </table>

              <div className={s.sheetPay}>
                <div className={s.sheetLabel}>Payment by bank transfer</div>
                <div>{or(f.account_name, "Account name")} · Sort code {or(f.sort_code, "00-00-00")} · Account {or(f.account_number, "00000000")} · Ref {f.number}</div>
                <div className={s.sheetMuted}>Please pay by {longDate(due)}.</div>
              </div>

              {f.notes && <div className={s.sheetNotes}>{f.notes}</div>}

              {f.late_clause && (
                <div className={s.sheetClause}>
                  Late payment: under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest at 8% above the Bank of England base rate (currently {getRate()}% a year) is charged daily on any amount unpaid after the due date, together with the fixed debt recovery cost of {fmt(fixedCost)} and any further reasonable recovery costs.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Email capture ── */}
        <section className={`${s.lead} ${s.noPrint}`}>
          {leadState !== "sent" ? (
            <>
              <h2 className={s.leadTitle}>Get the late payment checklist</h2>
              <p className={s.leadDesc}>One email: what to put on every invoice, when to chase, what to charge, and the letter that gets stubborn clients to pay. Nothing else unless you want it.</p>
              <div className={s.leadRow}>
                <input type="email" className={s.in} placeholder="your@email.com" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendLead()} />
                <button className={s.leadBtn} onClick={sendLead} disabled={leadState === "sending" || !leadEmail.trim()}>{leadState === "sending" ? "..." : "Send it"}</button>
              </div>
              <p className={s.hint}>No spam. Unsubscribe any time.</p>
            </>
          ) : (
            <p className={s.leadDone}><Check size={14} strokeWidth={2.5} /> Sent. Check your inbox.</p>
          )}
        </section>

        <article className={`${g.body} ${s.noPrint}`} style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 24px" }}>
          <h2>What this UK invoice template includes</h2>
          <ul>
            <li><strong>Everything HMRC expects:</strong> your details, the client's, a unique number, the date, a description, the amount, and VAT fields when you need them.</li>
            <li><strong>Clear payment terms and a due date</strong> calculated for you. Thirty days is the legal default; 14 or 7 is fine if you state it.</li>
            <li><strong>Bank details on the invoice</strong>, so there is no excuse for "we didn't know where to pay".</li>
            <li><strong>The statutory late payment clause.</strong> You have this right whether or not the invoice says so, but clients who see it pay faster.</li>
          </ul>
          <h2>If the invoice isn't paid on time</h2>
          <p>From the day after the due date you can add interest at 8% over base rate and a fixed recovery cost of £40, £70 or £100. The <a href="/calculator">calculator</a> shows the exact figure, the <a href="/late-payment-letter-template">letter generator</a> writes the demand, and the guide on <a href="/guides/client-not-paying-invoice">what to do when a client doesn't pay</a> covers the steps in order.</p>

          <h2>Frequently asked questions</h2>
          <div className={g.faqList}>
            {TEMPLATE_FAQS.map(({ q, a }) => {
              const isOpen = openFaq === q
              return (
                <div key={q} className={g.faqItem}>
                  <button onClick={() => setOpenFaq(isOpen ? null : q)} className={g.faqBtn}>
                    <h3 className={g.faqQuestion}>{q}</h3>
                    <span className={g.faqToggle}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <div className={g.faqAnswer}>{a}</div>}
                </div>
              )
            })}
          </div>

          <div className={g.cta}>
            <div className={g.ctaTitle}>Rather not chase it yourself?</div>
            <p className={g.ctaText}>Hielda sends the invoice, watches the due date, and if it goes unpaid chases the client with the interest and fixed cost applied, until it's paid.</p>
            <button onClick={() => { trackEvent("invoice_template_cta_clicked", { placement: "bottom" }); onGetStarted() }} className={g.ctaBtn}>Start your free 6-week trial</button>
            <p className={g.ctaSmall}>No credit card required</p>
          </div>
        </article>
      </div>
    </main>
  )
}
