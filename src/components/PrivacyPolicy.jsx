import { colors as c, FONT } from "../constants"
import { ShieldLogo } from "./ui"

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: c.ac, margin: "0 0 10px", borderBottom: `1px solid ${c.bd}`, paddingBottom: 6 }}>
        {title}
      </h2>
      <div style={{ fontSize: 13, color: c.tm, lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{ fontFamily: FONT, background: c.bg, minHeight: "100vh" }}>
      {/* Nav */}
      <div style={{ background: c.ac, padding: "14px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <ShieldLogo size={28} white />
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Hielda</span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 64px" }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontFamily: FONT, fontSize: 13, padding: 0, marginBottom: 24 }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: c.tx, margin: "0 0 6px" }}>Privacy Policy</h1>
        <p style={{ color: c.td, fontSize: 12, margin: "0 0 32px" }}>Last updated: March 2026</p>

        <Section title="Who We Are">
          <p>Hielda is an invoice chasing and late payment enforcement service for freelancers and small businesses in the UK. We operate as Hielda (trading name).</p>
          <p style={{ marginTop: 8 }}>For any privacy-related queries, contact us at: <a href="mailto:support@hielda.com" style={{ color: c.ac }}>support@hielda.com</a></p>
        </Section>

        <Section title="What Data We Collect">
          <p style={{ fontWeight: 600, color: c.tx, marginBottom: 4 }}>Account and profile data</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
            <li>Your name and business name</li>
            <li>Email address</li>
            <li>Phone number and postal address</li>
            <li>Bank account details (account name, sort code, account number) — used to populate payment details on invoices</li>
            <li>VAT number and UTR number (if provided)</li>
          </ul>
          <p style={{ fontWeight: 600, color: c.tx, marginBottom: 4 }}>Invoice and client data</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
            <li>Client names, email addresses, and postal addresses</li>
            <li>Invoice amounts, reference numbers, descriptions, and dates</li>
            <li>Payment status and chase history</li>
          </ul>
          <p style={{ fontWeight: 600, color: c.tx, marginBottom: 4 }}>Usage and technical data</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
            <li>Authentication logs (login times, session tokens) managed by Supabase</li>
            <li>Basic usage data necessary to operate the service</li>
          </ul>
          <p style={{ fontWeight: 600, color: c.tx, marginBottom: 4 }}>Payment data</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 0" }}>
            <li>Subscription billing is handled entirely by Stripe. Hielda does not store your card details. See Stripe's privacy policy at stripe.com/privacy.</li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <p style={{ marginBottom: 8 }}>We use the data we collect to:</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Provide the Hielda service — creating invoices, sending chase emails, and calculating statutory interest and penalties on your behalf</li>
            <li>Send chase emails to your clients' email addresses as instructed by you</li>
            <li>Send you check-in notifications before each chase step</li>
            <li>Process your subscription payments via Stripe</li>
            <li>Provide customer support</li>
            <li>Comply with our legal obligations</li>
          </ul>
        </Section>

        <Section title="Legal Basis for Processing">
          <p style={{ marginBottom: 8 }}>Under UK GDPR, we process your personal data on the following bases:</p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong style={{ color: c.tx }}>Contract performance</strong> — processing is necessary to deliver the service you've signed up for</li>
            <li><strong style={{ color: c.tx }}>Legitimate interests</strong> — operating and improving the service, and sending chase communications on your behalf</li>
            <li><strong style={{ color: c.tx }}>Legal obligation</strong> — retaining financial records as required by UK law</li>
          </ul>
        </Section>

        <Section title="Third-Party Processors">
          <p style={{ marginBottom: 8 }}>We share data with the following sub-processors to operate Hielda:</p>
          <div style={{ background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 8, overflow: "hidden" }}>
            {[
              { name: "Supabase", role: "Database, authentication, and serverless functions", location: "EU (West)" },
              { name: "Stripe", role: "Subscription billing and payment processing", location: "EU / US" },
              { name: "Resend", role: "Transactional email delivery (chase emails, notifications)", location: "EU / US" },
              { name: "Vercel", role: "Web hosting and serverless API functions", location: "EU" },
            ].map((p, i) => (
              <div key={p.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px", gap: 12, padding: "10px 14px", borderBottom: i < 3 ? `1px solid ${c.bdl}` : "none", fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: c.tx }}>{p.name}</span>
                <span style={{ color: c.tm }}>{p.role}</span>
                <span style={{ color: c.td, textAlign: "right" }}>{p.location}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 10 }}>We do not sell your data or share it with any third party for marketing purposes.</p>
        </Section>

        <Section title="Your Clients' Data">
          <p>When you add client details to Hielda and instruct us to send chase emails, you act as the data controller for your clients' personal data. Hielda acts as a data processor on your behalf.</p>
          <p style={{ marginTop: 8 }}>You are responsible for ensuring you have a lawful basis to provide client data to Hielda. Typically this is the performance of a contract (the invoice you're chasing). We process client data solely to send the chase communications you instruct us to send.</p>
        </Section>

        <Section title="Data Retention">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Your account and invoice data is retained while your account is active</li>
            <li>Financial records (invoices) are retained for 7 years from the invoice date, in line with UK HMRC requirements</li>
            <li>If you close your account, your personal profile data will be deleted within 30 days. Invoice records may be retained for the statutory 7-year period</li>
            <li>Chase logs are retained for 12 months</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <p style={{ marginBottom: 8 }}>Under UK GDPR, you have the right to:</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 10px" }}>
            <li><strong style={{ color: c.tx }}>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong style={{ color: c.tx }}>Rectification</strong> — correct inaccurate data (you can do this directly in Your Details)</li>
            <li><strong style={{ color: c.tx }}>Erasure</strong> — request deletion of your data, subject to legal retention requirements</li>
            <li><strong style={{ color: c.tx }}>Restriction</strong> — ask us to limit how we process your data in certain circumstances</li>
            <li><strong style={{ color: c.tx }}>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong style={{ color: c.tx }}>Object</strong> — object to processing based on legitimate interests</li>
          </ul>
          <p>To exercise any of these rights, email us at <a href="mailto:support@hielda.com" style={{ color: c.ac }}>support@hielda.com</a>. We will respond within 30 days.</p>
          <p style={{ marginTop: 8 }}>If you believe we have not handled your data correctly, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: c.ac }}>ico.org.uk</a>.</p>
        </Section>

        <Section title="Security">
          <p>We take data security seriously. Your data is encrypted in transit using TLS and at rest using AES-256 encryption. Access to your data is restricted by row-level security policies — each user can only access their own invoices and profile. Authentication is managed by Supabase, which is SOC 2 Type II certified.</p>
          <p style={{ marginTop: 8 }}>Bank details you provide are stored securely and used solely to populate the payment details section of invoices. We strongly recommend keeping your Hielda login credentials secure and not sharing your account.</p>
        </Section>

        <Section title="Cookies">
          <p>Hielda uses only essential cookies — specifically a session cookie managed by Supabase to keep you logged in. We do not use advertising or tracking cookies. No third-party analytics tools are used.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p>If we make material changes to this policy, we will notify you by email or via a notice within the app. Continued use of Hielda after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <div style={{ padding: "20px 24px", background: c.acd, border: `1px solid ${c.ac}20`, borderRadius: 10, fontSize: 12, color: c.tm }}>
          Questions? Email <a href="mailto:support@hielda.com" style={{ color: c.ac, fontWeight: 600 }}>support@hielda.com</a> — we'll get back to you within 2 business days.
        </div>
      </div>
    </div>
  )
}
