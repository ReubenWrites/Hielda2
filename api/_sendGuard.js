// The one place that decides whether Hielda may email a CLIENT about an
// invoice. Every client-facing send path calls this before touching Resend.
//
// Why one place: an audit on 18 Sep 2026 found the same checks scattered
// and inconsistent — the manual chase endpoint checked nothing about the
// invoice's state at all, parking was honoured in two paths out of six,
// and switching auto-chase off wasn't rechecked when a days-old check-in
// link was finally clicked. The product's premise is that nothing reaches a
// client the user didn't ask for. That has to be enforced once, not six
// times slightly differently.
//
// Underscore-prefixed: a module, not a Vercel function.

/** Whole days from a to b, negative if b precedes a. */
function dayDiff(a, b) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 864e5)
}

/**
 * True while a Letter Before Action's response window is running. During
 * it the letter IS the communication; an automated "formal reminder" on
 * top of it is contradictory and, for a sole-trader debtor under the
 * Pre-Action Protocol, arguably prejudicial.
 */
export function inLbaWindow(invoice, now = Date.now()) {
  if (!invoice?.lba_sent_at || !invoice?.lba_deadline) return false
  // Compare dates, not instants: the deadline is a calendar day and the
  // client has all of it. A mid-afternoon "now" against a midnight deadline
  // would otherwise fall out of the window on the final day.
  const today = new Date(now).toISOString().split('T')[0]
  return dayDiff(today, invoice.lba_deadline) >= 0
}

/**
 * Returns null when the send may go ahead, otherwise { code, message }.
 *
 * purpose:
 *   'chase'      automated or manual chase / formal reminder to the client
 *   'statement'  consolidated statement of account
 *   'intro'      the invoice + introduction on creation
 *   'dispute'    dispute acknowledgement / resolution notice
 *
 * opts.manual — the user pressed a button just now, as opposed to approving
 * a link that was emailed days ago. Manual sends may proceed with auto-chase
 * off (that flag governs the cron, not the person), but never past a paid,
 * parked or disputed invoice, and never inside an LBA window.
 */
export function clientSendBlock(invoice, purpose, opts = {}) {
  if (!invoice) return { code: 'no_invoice', message: 'Invoice not found.' }
  if (!invoice.client_email) {
    return { code: 'no_client_email', message: 'This invoice has no client email address.' }
  }

  if (invoice.parked_at) {
    return { code: 'parked', message: `${invoice.ref} is parked. Resume it from the invoice page before emailing the client.` }
  }

  if (purpose === 'intro') {
    if (invoice.send_method === 'download') {
      return { code: 'send_method_download', message: 'This invoice is marked as sent by you, so Hielda will not email your client.' }
    }
    if (invoice.status === 'paid') {
      return { code: 'paid', message: `${invoice.ref} is already paid.` }
    }
    return null
  }

  if (purpose === 'dispute') {
    // A dispute notice is the one thing that should go to a disputed
    // invoice's client. Nothing else about state blocks it.
    return null
  }

  // chase / statement
  if (invoice.status === 'paid') {
    return { code: 'paid', message: `${invoice.ref} is already paid. Nothing was sent.` }
  }
  if (invoice.status === 'disputed') {
    return { code: 'disputed', message: `${invoice.ref} is under dispute. Resolve the dispute before chasing.` }
  }
  if (invoice.status !== 'pending' && invoice.status !== 'overdue') {
    return { code: 'status', message: `${invoice.ref} is ${invoice.status}; nothing was sent.` }
  }

  if (purpose === 'chase') {
    if (!opts.manual && invoice.auto_chase === false) {
      return { code: 'auto_chase_off', message: `Automatic chasing is switched off for ${invoice.ref}. Nothing was sent.` }
    }
    if (inLbaWindow(invoice)) {
      return {
        code: 'lba_window',
        message: `A Letter Before Action is out on ${invoice.ref} and the client has until ${invoice.lba_deadline} to respond. Hielda won't send a chase on top of it.`,
      }
    }
  }

  return null
}
