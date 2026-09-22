import { describe, it, expect } from 'vitest'
import { parseReceiptLines, findAmount, findDate, findVendor } from '../lib/parseReceipt'

// The in-browser receipt reader: text lines (from pdf.js or OCR) in,
// total / date / vendor / description out. These are shaped like real
// UK receipts; OCR noise is simulated with odd spacing and casing.

describe('receipt heuristics', () => {
  it('reads an Uber trip email saved as PDF', () => {
    const r = parseReceiptLines([
      'Uber', 'Thanks for riding, Reuben', 'Total £14.52', 'Trip fare £12.10', 'Booking fee £2.42',
      'Payments', 'Visa ****1234 12/06/2026 14:32', 'Visit the trip page for more information',
    ])
    expect(r).toEqual({ vendor: 'Uber', amount: 14.52, date: '2026-06-12', description: 'Uber, 12 Jun', currency: 'GBP' })
  })

  it('reads a Trainline ticket', () => {
    const r = parseReceiptLines([
      'Trainline', 'Your booking confirmation', 'London St Pancras to Brighton', 'Out: Tue 3 Jun 2026 09:14',
      'Ticket £18.00', 'Booking fee £1.00', 'Total paid £19.00',
    ])
    expect(r.vendor).toBe('Trainline')
    expect(r.amount).toBe(19)
    expect(r.date).toBe('2026-06-03')
    expect(r.description).toBe('Trainline, 3 Jun')
  })

  it('takes the largest amount when no total line exists', () => {
    expect(findAmount(['Widget 4.50', 'Gadget 12.00', 'Thing 3.25'])).toBe(12)
  })

  it('prefers the grand total over a subtotal', () => {
    expect(findAmount(['Subtotal £40.00', 'VAT £8.00', 'Grand Total £48.00'])).toBe(48)
  })

  it('understands several date formats', () => {
    expect(findDate(['2026-06-12'])).toBe('2026-06-12')
    expect(findDate(['12/06/2026'])).toBe('2026-06-12')
    expect(findDate(['12.06.26'])).toBe('2026-06-12')
    expect(findDate(['12th June 2026'])).toBe('2026-06-12')
    expect(findDate(['June 12, 2026'])).toBe('2026-06-12')
    expect(findDate(['no date here'])).toBeNull()
  })

  it('falls back to the first plausible line for an unknown vendor', () => {
    expect(findVendor(['RECEIPT', "Bob's Hardware", 'Item 1 3.99', 'Total 3.99'])).toBe("Bob's Hardware")
  })

  it('returns null for a page with nothing useful on it', () => {
    expect(parseReceiptLines(['', '   ', 'zzz'])).toBeNull()
  })

  it('never returns an absurd amount', () => {
    expect(findAmount(['Card number 4111111111111111.00', 'Total £5.00'])).toBe(5)
  })
})
