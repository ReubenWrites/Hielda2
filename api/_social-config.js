/**
 * Social media content strategy config for Hielda's X/Twitter account.
 * Underscore prefix = Vercel won't deploy this as a serverless function.
 */

export const VOICE = {
  tone: 'straight-talking, dry/deadpan humour, personality-driven',
  perspective: 'first person plural ("we")',
  brand: 'Hielda — late payment enforcement for UK freelancers & SMEs',
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
  { id: 'relatable', weight: 3, desc: 'Relatable freelancer/SME pain — late payment frustrations, "that client" moments, invoice chasing woes. Funny, dry, no product link.' },
  { id: 'law_fact', weight: 2, desc: 'UK late payment law facts most freelancers and SMEs don\'t know. Cite the Late Payment of Commercial Debts Act 1998. Educational, not preachy.' },
  { id: 'quick_tip', weight: 2, desc: 'Quick actionable tips for freelancers and small businesses — how to word payment terms, when to chase, red flags in client contracts. Practical value.' },
  { id: 'stat', weight: 1, desc: 'Late payment stats & data that hit home for freelancers and SMEs. UK-specific if possible. Frame as the problem Hielda solves.' },
  { id: 'promo', weight: 2, desc: 'Product promo — link to hielda.com or the calculator. For freelancers and SMEs. Can be dry/funny. Always include the URL.' },
]

// Example posts for each pillar — aim for 30+ per category so the pool lasts a month
export const EXAMPLES = {
  relatable: [
    '"Just checking in on that invoice" is the freelancer national anthem.',
    'My client said they\'d pay "end of month". They didn\'t specify which month, apparently.',
    'Nothing like sending your 4th "friendly reminder" while quietly seething.',
    'The email said "payment is being processed". That was 3 weeks ago. Must be a very long process.',
    'Freelancing is 50% doing the work and 50% wondering why you haven\'t been paid for it.',
    'Client: "Can you send the invoice again?" Me: "I sent it three times." Client: "Weird, must be my spam filter." Sure.',
    'If chasing invoices burned calories, every freelancer would be an athlete.',
    '"We\'ll pay on receipt of invoice" is the business equivalent of "I\'ll call you back."',
    'The audacity of a client who ghosts your payment reminders but replies to your quote in 4 minutes.',
    'Small business owners don\'t need a gym membership. The financial stress provides all the cardio.',
    'Love the clients who take 60 days to pay a 14-day invoice but need their project done by Friday.',
    'You haven\'t truly freelanced until you\'ve drafted an angry email, deleted it, and sent "Just a friendly reminder!" instead.',
    'POV: You\'re a freelancer refreshing your bank account like it\'s a football score.',
    '"We\'re just waiting for accounts to process it" — the corporate equivalent of "the dog ate my homework."',
    'Apparently some clients think "net 30" means "maybe in 30 days if we remember."',
    'Running a small business means spending Monday doing the work and Tuesday chasing the money for last month\'s work.',
    'There should be a support group for freelancers who\'ve heard "the cheque\'s in the post" more than three times.',
    'Nothing motivates a late payer quite like a formally worded email that mentions the word "statutory."',
  ],
  law_fact: [
    'If a business pays you late, you can legally charge 8% + Bank of England base rate in interest. That\'s currently 11.75% per year. It\'s not a threat — it\'s the law.',
    'The Late Payment Act 1998 also gives you a fixed penalty on top of interest: £40, £70 or £100 depending on invoice size. Most freelancers don\'t claim it.',
    'You don\'t need a contract clause to charge late payment interest in the UK. The Act gives you the right automatically on B2B transactions.',
    'A £5,000 invoice that\'s 30 days late? You\'re owed an extra £118 in interest and penalties. Legally. Most people don\'t bother claiming it.',
    'The Late Payment Act applies to all B2B transactions in England, Wales and Scotland. If a business owes you money, you have rights.',
    'Fun fact: your client\'s contract can\'t override the Late Payment Act. Even if they say "no interest on late payments" — that clause is void.',
    'Statutory interest starts accruing the day after the due date. Not when you notice. Not when you chase. The day after.',
    'If your invoice is under £1,000, the fixed penalty is £40. Between £1k-£10k it\'s £70. Over £10k it\'s £100. On top of interest.',
    'The Late Payment Act was designed to protect freelancers and SMEs. It\'s been law for over 25 years. Most people still don\'t use it.',
    'A County Court Judgement (CCJ) stays on a company\'s credit file for 6 years. That\'s usually all the motivation they need to pay up.',
    'You can claim late payment interest even if you didn\'t mention it on the original invoice. The law applies automatically.',
    'Statutory interest is simple interest, not compound. But at 11.75% per annum, it adds up fast.',
  ],
  quick_tip: [
    'Put your payment terms on every invoice. "Due within 14 days" is clear. "Payment on receipt" is not.',
    'Chase on Day 1, not Day 30. The longer you leave it, the less likely you\'ll get paid.',
    'If a client says they "didn\'t get the invoice" — resend it immediately and note the date. Paper trail matters.',
    'Always put "Late Payment of Commercial Debts Act 1998 applies" on your invoices. It costs nothing and changes the dynamic.',
    'Before you start any project, agree payment terms in writing. Email counts. A handshake doesn\'t.',
    'Tip for freelancers: invoice on the same day you deliver. The longer you wait, the less urgent it feels to the client.',
    'If a client keeps paying late, shorten their payment terms. 30 days becomes 14. They\'ll adjust or you\'ll find out fast.',
    'Keep every email, every message, every promise in writing. If it ever goes to court, your paper trail is your case.',
    'Don\'t feel guilty about chasing. You did the work. The deal was they\'d pay for it. That\'s not being difficult — that\'s business.',
    'Red flag: a client who negotiates hard on price but is vague about payment terms. Sort it before you start.',
    'Tip: send invoices as PDF attachments, not just numbers in the email body. It looks more official and gets taken more seriously.',
    'If you\'re owed money and the client goes quiet, a formal letter citing the Late Payment Act often gets a response within 48 hours.',
  ],
  stat: [
    '1 in 3 UK freelancers wait over 30 days past the due date to get paid. That\'s not a cash flow issue — it\'s someone else spending your money.',
    'Late payments cost UK small businesses £22,000 a year on average. That\'s not a rounding error.',
    '50,000 UK businesses close every year because of late payments. Not because they weren\'t profitable — because they weren\'t paid.',
    '87% of UK freelancers have experienced late payment. If you\'re in the other 13%, teach us your ways.',
    'The average UK SME is owed £8,500 in overdue invoices at any given time. That\'s someone else\'s float.',
    'UK businesses are owed £23.4 billion in late payments. That\'s not a typo. Billion with a B.',
    'Only 12% of UK freelancers charge the late payment interest they\'re legally entitled to. Free money, sitting on the table.',
    '62% of freelancers say late payment has affected their mental health. It\'s not just about money.',
  ],
  promo: [
    'We built Hielda because chasing invoices shouldn\'t be a second job. Automatic escalation, statutory interest, legal weight — and you don\'t have to be the bad guy.\n\nhielda.com',
    'Curious how much a late payer actually owes you? Our free calculator works it out in seconds — interest, penalties, the lot.\n\nhielda.com/calculator',
    'Hielda sends the chase emails you\'re too polite to write. Escalating, citing the law, with real financial teeth.\n\nhielda.com',
    'Stop spending your evenings writing "friendly reminders." Hielda chases for you — automatically, legally, and without damaging your client relationships.\n\nhielda.com',
    'A client owes you £3,000 and they\'re 30 days late? That\'s £3,069 with statutory interest and penalties. Want to know your number?\n\nhielda.com/calculator',
    'Hielda: automatic invoice chasing for freelancers and SMEs. We cite the law, calculate the interest, and send the emails. You get paid.\n\nhielda.com',
    'Most freelancers don\'t chase because they don\'t want to be confrontational. That\'s literally why we exist.\n\nhielda.com',
    'Late payment shouldn\'t be the cost of doing business. Hielda enforces your legal rights so you don\'t have to.\n\nhielda.com',
    'Free tool: find out exactly how much a late payer owes you under UK law. Takes 10 seconds.\n\nhielda.com/calculator',
  ],
}

// Hashtags to use sparingly (pick 0-2 per post, only when relevant)
export const HASHTAGS = [
  '#freelancer', '#freelanceruk', '#latepayment', '#smallbusiness',
  '#ukbusiness', '#invoicing', '#selfemployed', '#getpaid', '#SME',
]

// ── Engagement config ──────────────────────────────────────────────────────────

// Search queries to find UK conversations to engage with
// All queries include UK-specific terms or context to target UK freelancers/SMEs
export const SEARCH_QUERIES = [
  '"late payment" freelancer UK -is:retweet lang:en',
  '"not been paid" invoice UK -is:retweet lang:en',
  '"chasing invoices" UK -is:retweet lang:en',
  '"client won\'t pay" UK -is:retweet lang:en',
  '"overdue invoice" UK -is:retweet lang:en',
  '"late paying clients" UK -is:retweet lang:en',
  '"cash flow" freelancer UK invoice -is:retweet lang:en',
  '"small business" "late payment" UK -is:retweet lang:en',
  '"Late Payment Act" -is:retweet lang:en',
  '"statutory interest" invoice -is:retweet lang:en',
  '"payment terms" freelancer HMRC OR UK OR "limited company" -is:retweet lang:en',
  '"self employed" "not been paid" -is:retweet lang:en',
  '"SME" "late payment" UK -is:retweet lang:en',
  '"freelancer" invoice "30 days" UK -is:retweet lang:en',
  '"County Court" invoice -is:retweet lang:en',
  '"fuck you pay me" -is:retweet lang:en',
  '"pay your freelancers" -is:retweet lang:en',
  '"pay people on time" -is:retweet lang:en',
  '"exposure doesn\'t pay bills" -is:retweet lang:en',
  '#PayYourFreelancers -is:retweet lang:en',
  '#LatePayers -is:retweet lang:en',
]

// Reply templates — helpful, not salesy. {author} is replaced with @username
export const REPLY_TEMPLATES = {
  sympathy: [
    'Ugh, been there. Did you know you can legally charge interest on late B2B payments in the UK? The Late Payment Act 1998 — most people don\'t know about it.',
    'The worst part is the time you spend chasing instead of doing actual work. It shouldn\'t be like this.',
    'This is way too common. UK law actually gives you the right to charge 8% + BoE rate on late invoices — worth knowing.',
  ],
  advice: [
    'Quick tip: chase on day 1, not day 30. The longer you wait, the harder it gets to collect.',
    'If it helps — under the Late Payment Act 1998 you can charge a fixed penalty (£40-£100) plus interest. You don\'t even need it in your contract.',
    'One thing that helped us: put "Late Payment Act 1998 applies" on every invoice. It changes the dynamic.',
  ],
  calculator: [
    'If you want to know exactly how much you\'re owed including statutory interest and penalties, this might help: hielda.com/calculator',
  ],
}

// Engagement rules
export const ENGAGE_RULES = {
  maxRepliesPerRun: 3,        // Don't reply to more than 3 tweets per run
  maxLikesPerRun: 5,          // Like up to 5 relevant tweets per run
  replyToPromoRatio: 5,       // 1 in 5 replies can mention the calculator link
  minFollowers: 10,           // Don't engage with very new/empty accounts
  maxFollowers: 500000,       // Don't reply to huge accounts (looks spammy)
  avoidKeywords: ['ad', 'sponsored', 'promoted', '#ad'],  // Skip promotional tweets
}
