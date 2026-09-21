import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Two ways the app and the database drift apart, both found live:
//  - a component reads inv.<field> that the fetch in App.jsx never selects
//    (the Letter Before Action panel and parked state were invisible for
//    this reason, 21 Sep 2026);
//  - code writes a column that doesn't exist.
// The column list below is public.invoices as of migration 026. When a
// migration adds a column, add it here.

const INVOICE_COLUMNS = new Set(`amount amount_paid auto_chase bcc_emails cc_emails chase_stage
client_address client_email client_entity client_id client_name client_ref client_type created_at
description dispute_date dispute_notes dispute_reason due_date id issue_date lba_deadline lba_sent_at
line_items no_fines notes paid_before_due paid_date parked_at payment_term_days ref requested_term_days
resolution_date resolution_notes resolution_outcome send_method source status subtotal terms_agreed
total_with_vat updated_at user_id vat_amount work_date xero_invoice_id`.split(/\s+/))

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

describe('invoice columns: what the app reads is what it fetches', () => {
  it('App.jsx fetches every column (no drifting explicit list)', () => {
    const app = read('App.jsx')
    expect(app).toMatch(/from\("invoices"\)\.select\("\*"\)/)
  })

  for (const file of ['components/Detail.jsx', 'components/Dashboard.jsx', 'components/LetterBeforeAction.jsx', 'components/Create.jsx']) {
    it(`${file} only reads real invoice columns`, () => {
      const src = read(file)
      const reads = new Set([...src.matchAll(/\binv\.([a-z_]+)\b/g)].map((m) => m[1]))
      const unknown = [...reads].filter((f) => !INVOICE_COLUMNS.has(f))
      expect(unknown, `not columns of public.invoices: ${unknown.join(', ')}`).toEqual([])
    })
  }
})
