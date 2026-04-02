import { ShieldLogo } from "./ui"
import s from './PrivacyPolicy.module.css'

function Section({ title, children }) {
  return (
    <div className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      <div className={s.sectionBody}>{children}</div>
    </div>
  )
}

export default function PrivacyPolicy({ onBack }) {
  return (
    <div className={s.page}>
      {/* Nav */}
      <div className={s.nav}>
        <ShieldLogo size={28} white />
        <span className={s.navTitle}>Hielda</span>
      </div>

      <div className={s.container}>
        <button onClick={onBack} className={s.backBtn}>
          ← Back
        </button>

        <h1 className={s.pageTitle}>Privacy Policy</h1>
        <p className={s.lastUpdated}>Last updated: March 2026</p>

        <Section title="Who We Are">
          <p>Hielda is an invoice chasing and late payment enforcement service for freelancers and small businesses in the UK. We operate as Hielda (trading name).</p>
          <p className={s.marginTop}>For any privacy-related queries, contact us at: <a href="mailto:support@hielda.com" className={s.link}>support@hielda.com</a></p>
        </Section>

        <Section title="What Data We Collect">
          <p className={s.dataLabel}>Account and profile data</p>
          <ul className={s.list}>
            <li>Your name and business name</li>
            <li>Email address</li>
            <li>Phone number and postal address</li>
            <li>Bank account details (account name, sort code, account number) — used to populate payment details on invoices</li>
            <li>VAT number and UTR number (if provided)</li>
          </ul>
          <p className={s.dataLabel}>Invoice and client data</p>
          <ul className={s.list}>
            <li>Client names, email addresses, and postal addresses</li>
            <li>Invoice amounts, reference numbers, descriptions, and dates</li>
            <li>Payment status and chase history</li>
          </ul>
          <p className={s.dataLabel}>Usage and technical data</p>
          <ul className={s.list}>
            <li>Authentication logs (login times, session tokens) managed by Supabase</li>
            <li>Basic usage data necessary to operate the service</li>
          </ul>
          <p className={s.dataLabel}>Payment data</p>
          <ul className={s.listLast}>
            <li>Subscription billing is handled entirely by Stripe. Hielda does not store your card details. See Stripe's privacy policy at stripe.com/privacy.</li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <p className={s.marginBottom}>We use the data we collect to:</p>
          <ul className={s.listLast}>
            <li>Provide the Hielda service — creating invoices, sending chase emails, and calculating statutory interest and penalties on your behalf</li>
            <li>Send chase emails to your clients' email addresses as instructed by you</li>
            <li>Send you check-in notifications before each chase step</li>
            <li>Process your subscription payments via Stripe</li>
            <li>Provide customer support</li>
            <li>Comply with our legal obligations</li>
          </ul>
        </Section>

        <Section title="Legal Basis for Processing">
          <p className={s.marginBottom}>Under UK GDPR, we process your personal data on the following bases:</p>
          <ul className={s.listLast}>
            <li><strong className={s.strong}>Contract performance</strong> — processing is necessary to deliver the service you've signed up for</li>
            <li><strong className={s.strong}>Legitimate interests</strong> — operating and improving the service, and sending chase communications on your behalf</li>
            <li><strong className={s.strong}>Legal obligation</strong> — retaining financial records as required by UK law</li>
          </ul>
        </Section>

        <Section title="Third-Party Processors">
          <p className={s.marginBottom}>We share data with the following sub-processors to operate Hielda:</p>
          <div className={s.processorTable}>
            {[
              { name: "Supabase", role: "Database, authentication, and serverless functions", location: "EU (West)" },
              { name: "Stripe", role: "Subscription billing and payment processing", location: "EU / US" },
              { name: "Resend", role: "Transactional email delivery (chase emails, notifications)", location: "EU / US" },
              { name: "Vercel", role: "Web hosting and serverless API functions", location: "EU" },
              { name: "PostHog", role: "Product analytics and session recording (privacy-focused)", location: "EU" },
            ].map((p, i) => (
              <div key={p.name} className={`${s.processorRow} ${i < 4 ? s.processorRowBorder : ""}`}>
                <span className={s.processorName}>{p.name}</span>
                <span className={s.processorRole}>{p.role}</span>
                <span className={s.processorLocation}>{p.location}</span>
              </div>
            ))}
          </div>
          <p className={s.marginTop}>We do not sell your data or share it with any third party for marketing purposes.</p>
        </Section>

        <Section title="Your Clients' Data">
          <p>When you add client details to Hielda and instruct us to send chase emails, you act as the data controller for your clients' personal data. Hielda acts as a data processor on your behalf.</p>
          <p className={s.marginTop}>You are responsible for ensuring you have a lawful basis to provide client data to Hielda. Typically this is the performance of a contract (the invoice you're chasing). We process client data solely to send the chase communications you instruct us to send.</p>
        </Section>

        <Section title="Data Retention">
          <ul className={s.listLast}>
            <li>Your account and invoice data is retained while your account is active</li>
            <li>Financial records (invoices) are retained for 7 years from the invoice date, in line with UK HMRC requirements</li>
            <li>If you close your account, your personal profile data will be deleted within 30 days. Invoice records may be retained for the statutory 7-year period</li>
            <li>Chase logs are retained for 12 months</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <p className={s.marginBottom}>Under UK GDPR, you have the right to:</p>
          <ul className={s.list}>
            <li><strong className={s.strong}>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong className={s.strong}>Rectification</strong> — correct inaccurate data (you can do this directly in Your Details)</li>
            <li><strong className={s.strong}>Erasure</strong> — request deletion of your data, subject to legal retention requirements</li>
            <li><strong className={s.strong}>Restriction</strong> — ask us to limit how we process your data in certain circumstances</li>
            <li><strong className={s.strong}>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong className={s.strong}>Object</strong> — object to processing based on legitimate interests</li>
          </ul>
          <p>To exercise any of these rights, email us at <a href="mailto:support@hielda.com" className={s.link}>support@hielda.com</a>. We will respond within 30 days.</p>
          <p className={s.marginTop}>If you believe we have not handled your data correctly, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className={s.link}>ico.org.uk</a>.</p>
        </Section>

        <Section title="Security">
          <p>We take data security seriously. Your data is encrypted in transit using TLS and at rest using AES-256 encryption. Access to your data is restricted by row-level security policies — each user can only access their own invoices and profile. Authentication is managed by Supabase, which is SOC 2 Type II certified.</p>
          <p className={s.marginTop}>Bank details you provide are stored securely and used solely to populate the payment details section of invoices. We strongly recommend keeping your Hielda login credentials secure and not sharing your account.</p>
        </Section>

        <Section title="Cookies">
          <p>Hielda uses only essential cookies — specifically a session cookie managed by Supabase to keep you logged in. We do not use advertising or tracking cookies. We use PostHog (EU-hosted) for privacy-focused product analytics and session recording to improve the service. PostHog does not share data with third parties, and all analytics data is stored in the EU. No personal data is shared for marketing purposes.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p>If we make material changes to this policy, we will notify you by email or via a notice within the app. Continued use of Hielda after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <div className={s.contactBox}>
          Questions? Email <a href="mailto:support@hielda.com" className={s.contactLink}>support@hielda.com</a> — we'll get back to you within 2 business days.
        </div>
      </div>
    </div>
  )
}
