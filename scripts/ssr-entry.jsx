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
import InterestRatePage from "../src/components/InterestRatePage"
import InvoiceTemplate from "../src/components/InvoiceTemplate"
import LatePaymentActExplained from "../src/components/guides/LatePaymentActExplained"
import HowToChaseLateInvoices from "../src/components/guides/HowToChaseLateInvoices"
import ClientNotPayingInvoice from "../src/components/guides/ClientNotPayingInvoice"
import LetterBeforeAction from "../src/components/guides/LetterBeforeAction"
import SmallClaimsCourtUnpaidInvoice from "../src/components/guides/SmallClaimsCourtUnpaidInvoice"
import HowMuchInterestLateInvoice from "../src/components/guides/HowMuchInterestLateInvoice"
import InvoicePaymentTermsUk from "../src/components/guides/InvoicePaymentTermsUk"
import FreelancerRightsLatePayment from "../src/components/guides/FreelancerRightsLatePayment"
import DebtCollectionAgencyVsDiy from "../src/components/guides/DebtCollectionAgencyVsDiy"
import HieldaVsChaser from "../src/components/guides/HieldaVsChaser"
import HieldaVsDebtCollectionAgency from "../src/components/guides/HieldaVsDebtCollectionAgency"
import HieldaVsDoingItYourself from "../src/components/guides/HieldaVsDoingItYourself"
import HieldaVsXeroReminders from "../src/components/guides/HieldaVsXeroReminders"

const noop = () => {}
const nav = { onBack: noop, onGetStarted: noop }

const PAGES = {
  "index.html": () => <LandingPage onGetStarted={noop} onPrivacy={noop} onCalculator={noop} isMobile={false} />,
  "how.html": () => <HowItWorks isMobile={false} />,
  "calculator.html": () => <Calculator {...nav} isMobile={false} />,
  "late-payment-letter-template.html": () => <LetterTemplate {...nav} />,
  "guides.html": () => <GuidesIndex {...nav} />,
  "late-payment-interest-rate.html": () => <InterestRatePage {...nav} />,
  "free-invoice-template-uk.html": () => <InvoiceTemplate {...nav} />,
  "guides-late-payment-act-1998-explained.html": () => <LatePaymentActExplained {...nav} />,
  "guides-how-to-chase-late-invoices.html": () => <HowToChaseLateInvoices {...nav} />,
  "guides-client-not-paying-invoice.html": () => <ClientNotPayingInvoice {...nav} />,
  "guides-letter-before-action.html": () => <LetterBeforeAction {...nav} />,
  "guides-small-claims-court-unpaid-invoice.html": () => <SmallClaimsCourtUnpaidInvoice {...nav} />,
  "guides-how-much-interest-late-invoice.html": () => <HowMuchInterestLateInvoice {...nav} />,
  "guides-invoice-payment-terms-uk.html": () => <InvoicePaymentTermsUk {...nav} />,
  "guides-freelancer-rights-late-payment.html": () => <FreelancerRightsLatePayment {...nav} />,
  "guides-debt-collection-agency-vs-diy.html": () => <DebtCollectionAgencyVsDiy {...nav} />,
  "guides-hielda-vs-chaser.html": () => <HieldaVsChaser {...nav} />,
  "guides-hielda-vs-debt-collection-agency.html": () => <HieldaVsDebtCollectionAgency {...nav} />,
  "guides-hielda-vs-doing-it-yourself.html": () => <HieldaVsDoingItYourself {...nav} />,
  "guides-hielda-vs-xero-invoice-reminders.html": () => <HieldaVsXeroReminders {...nav} />,
}

/** Markup for a route's #root, or null when the route has no page here. */
export function render(file) {
  const page = PAGES[file]
  return page ? renderToString(page()) : null
}
