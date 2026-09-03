// Mobile layout harness. Renders a real page component with realistic
// mock data so it can be screenshotted / overflow-checked in headless
// Chromium without auth or a database. Not part of the production build
// (Vite only bundles index.html). Pick a page with ?page=dashboard|detail|create.
//
//   npm run dev                 then open http://localhost:5173/harness/?page=detail
//   npm run test:mobile         renders all three at 360px and fails on overflow
import React from "react"
import ReactDOM from "react-dom/client"
import { MemoryRouter } from "react-router-dom"
import "../src/global.css"
import Dashboard from "../src/components/Dashboard.jsx"
import Detail from "../src/components/Detail.jsx"
import Create from "../src/components/Create.jsx"
import { ConfirmProvider, ToastProvider } from "../src/components/ui.jsx"

const d = (offsetDays) => {
  const x = new Date(); x.setDate(x.getDate() + offsetDays)
  return x.toISOString().split("T")[0]
}
const inv = (o) => ({
  id: o.ref, description: o.description || "Consultancy", amount_paid: 0, paid_before_due: 0,
  vat_amount: 0, total_with_vat: o.amount,
  line_items: [{ description: o.description || "Consultancy", amount: o.amount, vatRate: "0" }],
  client_email: (o.client_name || "x").toLowerCase().replace(/\W+/g, "") + "@example.com",
  auto_chase: true, no_fines: false, client_type: "business", terms_agreed: true,
  issue_date: d(-60), payment_term_days: 30, send_method: "portal",
  created_at: new Date(Date.now() - 60 * 864e5).toISOString(), ...o,
})

export const invs = [
  inv({ ref: "INV-0013", client_name: "MovieSweep", amount: 1639.55, amount_paid: 1250, paid_before_due: 1250, status: "overdue", due_date: d(-42), chase_stage: "second_chase", description: "Editing & colour grade — May batch", cc_emails: "finance@moviesweep.example.com", client_address: "12 Studio Lane\nSoho\nLondon W1F 8QQ", notes: "PO 4471 — please quote on remittance" }),
  inv({ ref: "INV-0014", client_name: "MovieSweep", amount: 2450.00, status: "overdue", due_date: d(-32), chase_stage: "formal_notice", description: "Trailer cut + social versions" }),
  inv({ ref: "INV-0012", client_name: "Kestrel Architects LLP", amount: 780, status: "pending", due_date: d(12), description: "Site photography — Phase 2" }),
  inv({ ref: "INV-0011", client_name: "City St Georges, University Of London", amount: 200, status: "paid", due_date: d(-40), paid_date: d(-35), amount_paid: 200 }),
  inv({ ref: "INV-0009", client_name: "Bravo Consulting Ltd", amount: 1200, status: "paid", due_date: d(-50), paid_date: d(-44), amount_paid: 1200 }),
  inv({ ref: "INV-0008", client_name: "Acme Media Group", amount: 3180, status: "paid", due_date: d(-70), paid_date: d(-61), amount_paid: 3180 }),
  inv({ ref: "INV-0007", client_name: "Northwind Traders", amount: 850, status: "paid", due_date: d(-80), paid_date: d(-75), amount_paid: 850 }),
]

export const profile = {
  id: "u1", email: "r@example.com", full_name: "Reuben Taylor", business_name: "Taylor Design Studio",
  address: "4 Riverside Studios\nLeeds LS1 4AB", sort_code: "12-34-56", account_number: "12345678",
  account_name: "Taylor Design Studio", bank_name: "Monzo", referral_code: "HIELDA-ABC123",
  invoice_prefix: "INV", next_invoice_number: 15, default_payment_terms: 30, vat_registered: false,
}

const page = new URLSearchParams(window.location.search).get("page") || "dashboard"
const noop = () => {}
const isMobile = window.innerWidth <= 768

function Page() {
  if (page === "detail") return <Detail inv={invs[0]} profile={profile} onUpdate={noop} isMobile={isMobile} editChase={false} onEditChaseDone={noop} />
  if (page === "create") return <Create profile={profile} userId="u1" onCreated={noop} isMobile={isMobile} invs={invs} />
  return <Dashboard invs={invs} profile={profile} onUpdate={noop} isMobile={isMobile} />
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <MemoryRouter>
    <ConfirmProvider>
      <ToastProvider>
        {/* Mirrors App.jsx's .content padding on phones (20px 16px). */}
        <div id="harness-shell" style={{ padding: isMobile ? "20px 16px" : "28px 32px", background: "var(--bg)", minHeight: "100vh" }}>
          <Page />
        </div>
      </ToastProvider>
    </ConfirmProvider>
  </MemoryRouter>
)
