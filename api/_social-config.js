/**
 * Social media content strategy config for Hielda's X/Twitter account.
 * Underscore prefix = Vercel won't deploy this as a serverless function.
 */

export const VOICE = {
  tone: 'straight-talking, dry/deadpan humour, personality-driven',
  perspective: 'first person plural ("we")',
  brand: 'Hielda — late payment enforcement for UK freelancers',
  url: 'https://hielda.com',
  calculatorUrl: 'https://hielda.com/calculator',
  humour: 'dry, deadpan, slightly sardonic — never mean-spirited',
  never: [
    'Be preachy or corporate',
    'Punch down at small businesses struggling',
    'Give actual legal advice — always frame as "your statutory right"',
    'Use more than 2 hashtags per post',
    'Use emojis excessively — one or two max, or none',
    'Sound like a generic marketing bot',
    'Repeat the same post within 30 days',
  ],
}

// Content pillars with approximate weights (out of 10 posts)
export const PILLARS = [
  { id: 'relatable', weight: 3, desc: 'Relatable freelancer pain — late payment frustrations, "that client" moments, invoice chasing woes. Funny, dry, no product link.' },
  { id: 'law_fact', weight: 2, desc: 'UK late payment law facts most freelancers don\'t know. Cite the Late Payment of Commercial Debts Act 1998. Educational, not preachy.' },
  { id: 'quick_tip', weight: 2, desc: 'Quick actionable tips — how to word payment terms, when to chase, red flags in client contracts. Practical value.' },
  { id: 'stat', weight: 1, desc: 'Late payment stats & data that hit home. UK-specific if possible. Frame as the problem Hielda solves.' },
  { id: 'promo', weight: 2, desc: 'Product promo — link to hielda.com or the calculator. Can be dry/funny. Always include the URL.' },
]

// Example posts for each pillar (used as style reference, not posted verbatim)
export const EXAMPLES = {
  relatable: [
    '"Just checking in on that invoice" is the freelancer national anthem.',
    'My client said they\'d pay "end of month". They didn\'t specify which month, apparently.',
    'Nothing like sending your 4th "friendly reminder" while quietly seething.',
    'The email said "payment is being processed". That was 3 weeks ago. Must be a very long process.',
  ],
  law_fact: [
    'If a business pays you late, you can legally charge 8% + Bank of England base rate in interest. That\'s currently 11.75% per year. It\'s not a threat — it\'s the law.',
    'The Late Payment Act 1998 also gives you a fixed penalty on top of interest: £40, £70 or £100 depending on invoice size. Most freelancers don\'t claim it.',
    'You don\'t need a contract clause to charge late payment interest in the UK. The Act gives you the right automatically on B2B transactions.',
  ],
  quick_tip: [
    'Put your payment terms on every invoice. "Due within 14 days" is clear. "Payment on receipt" is not.',
    'Chase on Day 1, not Day 30. The longer you leave it, the less likely you\'ll get paid.',
    'If a client says they "didn\'t get the invoice" — resend it immediately and note the date. Paper trail matters.',
  ],
  stat: [
    '1 in 3 UK freelancers wait over 30 days past the due date to get paid. That\'s not a cash flow issue — it\'s someone else spending your money.',
    'Late payments cost UK small businesses £22,000 a year on average. That\'s not a rounding error.',
  ],
  promo: [
    'We built Hielda because chasing invoices shouldn\'t be a second job. Automatic escalation, statutory interest, legal weight — and you don\'t have to be the bad guy.\n\nhielda.com',
    'Curious how much a late payer actually owes you? Our free calculator works it out in seconds — interest, penalties, the lot.\n\nhielda.com/calculator',
    'Hielda sends the chase emails you\'re too polite to write. Escalating, citing the law, with real financial teeth.\n\nhielda.com',
  ],
}

// Hashtags to use sparingly (pick 0-2 per post, only when relevant)
export const HASHTAGS = [
  '#freelancer', '#freelanceruk', '#latepayment', '#smallbusiness',
  '#ukbusiness', '#invoicing', '#selfemployed', '#getpaid',
]
