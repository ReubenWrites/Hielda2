import { ShieldLogo } from "./ui"
import s from "./PrivacyPolicy.module.css"

function Section({ title, children }) {
  return (
    <div className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      <div className={s.sectionBody}>{children}</div>
    </div>
  )
}

export default function Terms({ onBack }) {
  return (
    <div className={s.page}>
      <div className={s.nav}>
        <ShieldLogo size={28} white />
        <span className={s.navTitle}>Hielda</span>
      </div>

      <div className={s.container}>
        <button onClick={onBack} className={s.backBtn}>
          ← Back
        </button>

        <h1 className={s.pageTitle}>Terms of Service</h1>
        <p className={s.lastUpdated}>Last updated: October 2026</p>

        <Section title="1. Who We Are and What These Terms Cover">
          <p>Hielda ("Hielda", "we", "us") provides an online service at hielda.com that creates invoices, monitors their due dates, sends payment reminders and chase emails to your clients on your behalf, and calculates the statutory interest and fixed recovery costs available under the Late Payment of Commercial Debts (Interest) Act 1998 (the "Service").</p>
          <p className={s.marginTop}>These terms are a contract between you and Hielda. By creating an account or using the Service you agree to them. If you are using the Service for a business, you confirm you have authority to bind that business. Our <a href="/privacy" className={s.link}>Privacy Policy</a> explains how we handle data and forms part of these terms.</p>
          <p className={s.marginTop}>Questions about these terms: <a href="mailto:support@hielda.com" className={s.link}>support@hielda.com</a></p>
        </Section>

        <Section title="2. Who Can Use the Service">
          <p>The Service is for businesses, sole traders and freelancers. You must be at least 18 and using the Service for business purposes. It is designed for invoices between businesses in the United Kingdom; the statutory charges it calculates do not apply to invoices to consumers or to contracts governed by other countries' laws, and you are responsible for only applying them where they are lawful.</p>
        </Section>

        <Section title="3. Your Account">
          <ul className={s.list}>
            <li>Keep your login details confidential. You are responsible for everything done through your account.</li>
            <li>Tell us promptly at support@hielda.com if you believe your account has been accessed without permission.</li>
            <li>Give us accurate details, including your business name and payment details, and keep them up to date. They appear on documents sent to your clients.</li>
          </ul>
        </Section>

        <Section title="4. What Hielda Does on Your Behalf">
          <p>When you add an invoice and enable chasing, you instruct and authorise Hielda to send emails to the client contact you have provided, in your name, on the schedule shown in the Service. These include reminders before the due date, chase emails after it, and, if you choose, a Letter Before Action. You can review the schedule, pause or stop chasing, disable charges, or mark an invoice as paid or disputed at any time.</p>
          <p className={s.marginTop}>You remain the creditor. Hielda is not a party to your contract with your client, does not collect money, and does not take an assignment of your debt. Payments are made by your client directly to the payment details you provide.</p>
          <p className={s.marginTop}>Hielda calculates statutory interest and the fixed recovery cost according to the Act and the Bank of England base rate as published. We take care to keep these calculations accurate, but you are responsible for checking any figure before relying on it in a formal demand or court claim.</p>
        </Section>

        <Section title="5. Your Responsibilities">
          <ul className={s.list}>
            <li>Only add invoices that are genuine, for work or goods actually supplied, and owed to you.</li>
            <li>Make sure the client email address you give us is the right one and that you are entitled to contact that person about the invoice.</li>
            <li>Keep the status of each invoice accurate, in particular marking invoices as paid promptly so that chasing stops.</li>
            <li>Do not use the Service to harass anyone, to pursue a debt you know to be disputed in bad faith, or in breach of any law.</li>
            <li>Do not attempt to access other users' data, interfere with the Service, or use automated means to extract its content.</li>
          </ul>
          <p className={s.marginTop}>If a client complains to us that an email was sent in error or that they are not the correct contact, we may pause chasing on that invoice and ask you to confirm the details.</p>
        </Section>

        <Section title="6. Not Legal Advice">
          <p>The Service, the guides, the calculator and the letter templates provide general information about UK late payment law and tools to apply it. They are not legal advice and do not create a solicitor–client relationship. Whether to charge interest, send a Letter Before Action, instruct a debt recovery agent or start a court claim is your decision. For a disputed or high-value debt, consider taking independent legal advice.</p>
        </Section>

        <Section title="7. Free Trial, Subscription and Payment">
          <ul className={s.list}>
            <li>New accounts get a free trial of the length shown when you sign up. No payment details are needed for the trial.</li>
            <li>After the trial, continued use requires a paid subscription at the price shown in the Service at the time you subscribe. Subscriptions are billed in advance, monthly or annually, through our payment processor, Stripe.</li>
            <li>Subscriptions renew automatically until cancelled. You can cancel at any time from the Billing page; your access continues to the end of the period you have paid for. We do not refund partial periods unless the law requires it.</li>
            <li>If we change prices, we will give you at least 30 days' notice by email before the new price applies to your next renewal.</li>
            <li>Prices shown exclude VAT unless stated otherwise.</li>
          </ul>
        </Section>

        <Section title="8. Your Content and Your Clients' Data">
          <p>You own the invoices, client details and other content you put into the Service. You give us permission to store, process and send it as needed to provide the Service. You are responsible for having the right to share your clients' details with us; our <a href="/privacy" className={s.link}>Privacy Policy</a> explains how we handle them.</p>
        </Section>

        <Section title="9. Availability and Changes">
          <p>We aim to keep the Service available at all times but cannot guarantee it. We may change or improve features, and may suspend the Service for maintenance or for security reasons. Scheduled emails that fall during an outage are sent when the Service resumes. We may withdraw features that are little used, with reasonable notice where they affect paid subscribers.</p>
        </Section>

        <Section title="10. Ending the Agreement">
          <p>You can close your account at any time from Settings or by emailing support@hielda.com. We can suspend or close your account if you breach these terms, if we are required to by law, or if we stop providing the Service, in which case we will refund any prepaid period you have not used. On closure, scheduled chasing stops and your data is handled as described in the Privacy Policy.</p>
        </Section>

        <Section title="11. Liability">
          <p>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.</p>
          <p className={s.marginTop}>Otherwise, we are not liable for: a client's failure to pay you; any loss arising from inaccurate information you provide; loss of profit, business or goodwill; or indirect or consequential loss. Our total liability to you for all claims in any 12-month period is limited to the amount you have paid us for the Service in that period, or £100 if you have paid nothing.</p>
        </Section>

        <Section title="12. General">
          <ul className={s.list}>
            <li>These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.</li>
            <li>If any part of these terms is found unenforceable, the rest continues to apply.</li>
            <li>We may update these terms. For material changes we will email you or show a notice in the Service at least 14 days before they take effect. Continuing to use the Service after that date means you accept the updated terms.</li>
            <li>These terms, with the Privacy Policy, are the whole agreement between you and Hielda about the Service.</li>
          </ul>
        </Section>

        <div className={s.contactBox}>
          <p>Questions? <a href="mailto:support@hielda.com" className={s.contactLink}>support@hielda.com</a></p>
        </div>
      </div>
    </div>
  )
}
