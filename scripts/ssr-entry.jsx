// Server-side entry for the prerender step. Loaded through Vite's
// ssrLoadModule by scripts/prerender.mjs, so JSX, CSS modules and
// import.meta.env all resolve exactly as they do for the client build.
//
// Each marketing route is rendered to a string and dropped into #root of
// its per-route HTML file, so a crawler gets the article, not an empty
// div. The client then mounts over it as normal.
//
// Handlers are no-ops here: the real ones are wired up when the app mounts.
// Anything that should be crawlable is a real <a href> in the component.

import { renderToString } from "react-dom/server"
import LandingPage from "../src/components/LandingPage"
import HowItWorks from "../src/components/HowItWorks"
import Calculator from "../src/components/Calculator"
import LetterTemplate from "../src/components/LetterTemplate"
import GuidesIndex from "../src/components/guides/GuidesIndex"
import LatePaymentActExplained from "../src/components/guides/LatePaymentActExplained"
import HowToChaseLateInvoices from "../src/components/guides/HowToChaseLateInvoices"
import ClientNotPayingInvoice from "../src/components/guides/ClientNotPayingInvoice"
import LetterBeforeAction from "../src/components/guides/LetterBeforeAction"
import SmallClaimsCourtUnpaidInvoice from "../src/components/guides/SmallClaimsCourtUnpaidInvoice"
import HowMuchInterestLateInvoice from "../src/components/guides/HowMuchInterestLateInvoice"
import InvoicePaymentTermsUk from "../src/components/guides/InvoicePaymentTermsUk"
import FreelancerRightsLatePayment from "../src/components/guides/FreelancerRightsLatePayment"
import DebtCollectionAgencyVsDiy from "../src/components/guides/DebtCollectionAgencyVsDiy"

const noop = () => {}
const nav = { onBack: noop, onGetStarted: noop }

const PAGES = {
  "index.html": () => <LandingPage onGetStarted={noop} onPrivacy={noop} onCalculator={noop} isMobile={false} />,
  "how.html": () => <HowItWorks isMobile={false} />,
  "calculator.html": () => <Calculator {...nav} isMobile={false} />,
  "late-payment-letter-template.html": () => <LetterTemplate {...nav} />,
  "guides.html": () => <GuidesIndex {...nav} />,
  "guides-late-payment-act-1998-explained.html": () => <LatePaymentActExplained {...nav} />,
  "guides-how-to-chase-late-invoices.html": () => <HowToChaseLateInvoices {...nav} />,
  "guides-client-not-paying-invoice.html": () => <ClientNotPayingInvoice {...nav} />,
  "guides-letter-before-action.html": () => <LetterBeforeAction {...nav} />,
  "guides-small-claims-court-unpaid-invoice.html": () => <SmallClaimsCourtUnpaidInvoice {...nav} />,
  "guides-how-much-interest-late-invoice.html": () => <HowMuchInterestLateInvoice {...nav} />,
  "guides-invoice-payment-terms-uk.html": () => <InvoicePaymentTermsUk {...nav} />,
  "guides-freelancer-rights-late-payment.html": () => <FreelancerRightsLatePayment {...nav} />,
  "guides-debt-collection-agency-vs-diy.html": () => <DebtCollectionAgencyVsDiy {...nav} />,
}

/** Markup for a route's #root, or null when the route has no page here. */
export function render(file) {
  const page = PAGES[file]
  return page ? renderToString(page()) : null
}
