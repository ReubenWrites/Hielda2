import { describe, it, expect } from 'vitest'
import { clientSendBlock, inLbaWindow } from '../../api/_sendGuard.js'

// The single gate every client-facing send passes through. These are the
// rules the product is built on, written down once.

const d = (offset) => {
  const x = new Date()
  x.setDate(x.getDate() + offset)
  return x.toISOString().split('T')[0]
}

const inv = (over = {}) => ({
  id: 'i1', ref: 'INV-1', client_email: 'c@example.com', status: 'overdue',
  auto_chase: true, parked_at: null, send_method: 'portal',
  lba_sent_at: null, lba_deadline: null, ...over,
})

describe('clientSendBlock — chase', () => {
  it('allows an ordinary overdue invoice', () => {
    expect(clientSendBlock(inv(), 'chase')).toBeNull()
  })
  it('never chases a paid invoice', () => {
    expect(clientSendBlock(inv({ status: 'paid' }), 'chase')?.code).toBe('paid')
  })
  it('never chases a disputed invoice', () => {
    expect(clientSendBlock(inv({ status: 'disputed' }), 'chase')?.code).toBe('disputed')
  })
  it('never chases a parked invoice, even manually', () => {
    expect(clientSendBlock(inv({ parked_at: '2026-09-01' }), 'chase')?.code).toBe('parked')
    expect(clientSendBlock(inv({ parked_at: '2026-09-01' }), 'chase', { manual: true })?.code).toBe('parked')
  })
  it('honours auto-chase being switched off for automated sends', () => {
    expect(clientSendBlock(inv({ auto_chase: false }), 'chase')?.code).toBe('auto_chase_off')
  })
  it('lets the user chase manually with auto-chase off — that flag governs the cron, not the person', () => {
    expect(clientSendBlock(inv({ auto_chase: false }), 'chase', { manual: true })).toBeNull()
  })
  it('sends nothing while a Letter Before Action window is running', () => {
    const during = inv({ lba_sent_at: d(-3), lba_deadline: d(11) })
    expect(clientSendBlock(during, 'chase')?.code).toBe('lba_window')
    expect(clientSendBlock(during, 'chase', { manual: true })?.code).toBe('lba_window')
  })
  it('resumes once the LBA deadline has passed', () => {
    expect(clientSendBlock(inv({ lba_sent_at: d(-20), lba_deadline: d(-6) }), 'chase')).toBeNull()
  })
  it('treats the deadline day itself as inside the window', () => {
    expect(inLbaWindow(inv({ lba_sent_at: d(-14), lba_deadline: d(0) }))).toBe(true)
    expect(inLbaWindow(inv({ lba_sent_at: d(-15), lba_deadline: d(-1) }))).toBe(false)
  })
  it('refuses when there is no client email', () => {
    expect(clientSendBlock(inv({ client_email: null }), 'chase')?.code).toBe('no_client_email')
  })
  it('refuses a missing invoice', () => {
    expect(clientSendBlock(null, 'chase')?.code).toBe('no_invoice')
  })
})

describe('clientSendBlock — statement', () => {
  it('blocks paid, disputed and parked; allows pending and overdue', () => {
    expect(clientSendBlock(inv({ status: 'pending' }), 'statement')).toBeNull()
    expect(clientSendBlock(inv(), 'statement')).toBeNull()
    expect(clientSendBlock(inv({ status: 'paid' }), 'statement')?.code).toBe('paid')
    expect(clientSendBlock(inv({ status: 'disputed' }), 'statement')?.code).toBe('disputed')
    expect(clientSendBlock(inv({ parked_at: '2026-09-01' }), 'statement')?.code).toBe('parked')
  })
  it('a statement of account may go out during an LBA window — it is not a demand', () => {
    expect(clientSendBlock(inv({ lba_sent_at: d(-3), lba_deadline: d(11) }), 'statement')).toBeNull()
  })
})

describe('clientSendBlock — intro', () => {
  it('the 18 Sep incident: "I\'ll send it myself" means no email', () => {
    expect(clientSendBlock(inv({ status: 'pending', send_method: 'download' }), 'intro')?.code).toBe('send_method_download')
  })
  it('does not introduce an invoice that is already paid', () => {
    expect(clientSendBlock(inv({ status: 'paid' }), 'intro')?.code).toBe('paid')
  })
  it('otherwise sends', () => {
    expect(clientSendBlock(inv({ status: 'pending' }), 'intro')).toBeNull()
  })
})

describe('clientSendBlock — dispute', () => {
  it('a dispute notice may go to a disputed invoice', () => {
    expect(clientSendBlock(inv({ status: 'disputed' }), 'dispute')).toBeNull()
  })
  it('but not to a parked one', () => {
    expect(clientSendBlock(inv({ status: 'disputed', parked_at: '2026-09-01' }), 'dispute')?.code).toBe('parked')
  })
})
