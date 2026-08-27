// Supabase Edge Function: Generate a consolidated statement-of-account PDF
// Mirrors the statement email exactly: one block per outstanding invoice
// (issued/due dates, dated payments, late-charge breakdown, amount due),
// a recently-settled section with any goodwill write-offs, and a single
// TOTAL NOW OWED. Called by the Vercel statement sender so the PDF that
// rides with the email always matches the email body.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import { jsPDF } from "npm:jspdf@2.5.1"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const DEFAULT_RATE = 11.75

function penalty(amount: number): number {
  if (amount < 1000) return 40
  if (amount < 10000) return 70
  return 100
}

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function daysLate(due: string): number {
  const d = Math.floor((Date.now() - new Date(due).getTime()) / 864e5)
  return d > 0 ? d : 0
}

function daysUntil(due: string): number {
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 864e5)
  return d > 0 ? d : 0
}

function daysBetween(from: string, to: string): number {
  const d = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 864e5)
  return d > 0 ? d : 0
}

function safe(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

const PAGE_BOTTOM_LIMIT = 265

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

// One label/value row inside a block
type Row = { label: string; value: string; color?: string; bold?: boolean; rule?: boolean }

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { invoice_ids, include_payments, include_settled, rate: requestedRate } = await req.json()
    const RATE = (typeof requestedRate === "number" && requestedRate > 0) ? requestedRate : DEFAULT_RATE
    const DAILY_RATE = RATE / 365 / 100

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0 || invoice_ids.length > 50) {
      return jsonError("invoice_ids (1-50) required", 400)
    }

    const { data: invoices, error: invErr } = await supabase
      .from("invoices").select("*").in("id", invoice_ids)
    if (invErr || !invoices || invoices.length === 0) return jsonError("Invoices not found", 404)

    const userId = invoices[0].user_id
    const clientEmail = (invoices[0].client_email || "").toLowerCase()
    if (invoices.some((i: any) => i.user_id !== userId)) return jsonError("Mixed ownership", 400)
    if (invoices.some((i: any) => (i.client_email || "").toLowerCase() !== clientEmail)) {
      return jsonError("All invoices must share one client", 400)
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles").select("*").eq("id", userId).single()
    if (profErr || !profile) return jsonError("Profile not found", 404)

    const open = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "disputed")
      .sort((a: any, b: any) => (a.due_date < b.due_date ? -1 : 1))
    if (open.length === 0) return jsonError("No open invoices", 400)

    // Dated payment ledger for the open invoices
    let paymentsByInvoice: Record<string, any[]> = {}
    if (include_payments) {
      const { data: payRows } = await supabase
        .from("invoice_payments").select("invoice_id, amount, paid_on")
        .in("invoice_id", open.map((i: any) => i.id))
        .order("paid_on", { ascending: true })
      for (const p of payRows || []) {
        if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = []
        paymentsByInvoice[p.invoice_id].push(p)
      }
    }

    // Recently settled invoices for the same client (last 60 days)
    let settled: any[] = []
    let settledPayments: Record<string, any[]> = {}
    if (include_settled) {
      const cutoff = new Date(Date.now() - 60 * 864e5).toISOString().split("T")[0]
      const { data: settledRows } = await supabase
        .from("invoices").select("*")
        .eq("user_id", userId).eq("status", "paid")
        .ilike("client_email", invoices[0].client_email)
        .gte("paid_date", cutoff)
        .order("paid_date", { ascending: false })
        .limit(10)
      settled = settledRows || []
      if (settled.length > 0) {
        const { data: payRows } = await supabase
          .from("invoice_payments").select("invoice_id, amount, paid_on")
          .in("invoice_id", settled.map((i: any) => i.id))
          .order("paid_on", { ascending: true })
        for (const p of payRows || []) {
          if (!settledPayments[p.invoice_id]) settledPayments[p.invoice_id] = []
          settledPayments[p.invoice_id].push(p)
        }
      }
    }

    // ── Figures (same maths as the statement email) ──
    const figures = (invoice: any) => {
      const dl = daysLate(invoice.due_date)
      const finesEnabled = !invoice.no_fines && invoice.client_type !== "consumer"
      const amountPaid = Number(invoice.amount_paid) || 0
      const outstanding = Math.max(0, round2(Number(invoice.amount) - amountPaid))
      const debtAtDue = Math.max(0, round2(Number(invoice.amount) - (Number(invoice.paid_before_due) || 0)))
      const interest = dl > 0 && finesEnabled ? round2(outstanding * DAILY_RATE * dl) : 0
      const pen = dl > 0 && finesEnabled && outstanding > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
      return { dl, amountPaid, outstanding, interest, pen, total: round2(outstanding + interest + pen) }
    }

    // ── Build PDF ──
    // Whisper palette: near-neutral inks with just enough hue to carry
    // meaning — slate-blue accents, grey-green for money in, grey-bronze
    // for charges, clay for overdue.
    const doc = new jsPDF()
    const blue = "#46688b"
    const gray = "#5f6c7c"
    const dark = "#18222f"
    const green = "#55796a"
    const gold = "#7d7154"
    const red = "#97664a"
    let y = 20

    const pageBreak = (needed: number) => {
      if (y + needed > PAGE_BOTTOM_LIMIT) {
        doc.addPage()
        y = 20
      }
    }

    // Header: STATEMENT left, business right
    doc.setFontSize(10)
    doc.setTextColor(blue)
    doc.setFont("helvetica", "bold")
    doc.text("STATEMENT OF ACCOUNT", 20, y)
    doc.setFontSize(18)
    doc.setTextColor(dark)
    doc.text(formatDate(new Date().toISOString()), 20, y + 9)

    const bizName = profile.business_name || profile.full_name || ""
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(bizName, 70), 190, y, { align: "right" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    if (profile.email) doc.text(safe(profile.email), 190, y + 6, { align: "right" })

    y = 38
    doc.setDrawColor(blue)
    doc.setLineWidth(0.5)
    doc.line(20, y, 190, y)

    // Prepared-for + summary
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(gray)
    doc.setFont("helvetica", "normal")
    doc.text("PREPARED FOR", 20, y)
    doc.text("SUMMARY", 120, y)
    y += 6
    doc.setFontSize(11)
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    doc.text(safe(open[0].client_name, "Client"), 20, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    if (open[0].client_email) doc.text(safe(open[0].client_email), 20, y + 5)

    const grandTotal = round2(open.reduce((s: number, i: any) => s + figures(i).total, 0))
    doc.text("Invoices outstanding", 120, y)
    doc.setTextColor(dark)
    doc.text(String(open.length), 190, y, { align: "right" })
    doc.setTextColor(gray)
    doc.text("Total now owed", 120, y + 5)
    doc.setTextColor(blue)
    doc.setFont("helvetica", "bold")
    doc.text(fmt(grandTotal), 190, y + 5, { align: "right" })

    y += 14

    // ── Block renderer ──
    const drawBlock = (
      title: string, subtitle: string, chip: string, chipColor: string,
      rows: Row[], totalRow: Row, fill: string | null, stroke: string,
    ) => {
      doc.setFontSize(9)
      const subLines = subtitle ? doc.splitTextToSize(subtitle, 130) : []
      const headerH = 9 + subLines.length * 3.8
      const blockH = headerH + 3 + rows.length * 5.5 + 12
      pageBreak(blockH + 5)

      if (fill) {
        doc.setFillColor(fill)
        doc.setDrawColor(stroke)
        doc.setLineWidth(0.3)
        doc.roundedRect(20, y, 170, blockH, 2, 2, "FD")
      } else {
        doc.setDrawColor(stroke)
        doc.setLineWidth(0.3)
        doc.roundedRect(20, y, 170, blockH, 2, 2, "S")
      }

      let by = y + 7.5
      doc.setFontSize(10.5)
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      doc.text(title, 26, by)
      doc.setFontSize(7.5)
      doc.setTextColor(chipColor)
      doc.text(chip, 184, by, { align: "right" })
      if (subLines.length) {
        doc.setFontSize(7.5)
        doc.setTextColor(gray)
        doc.setFont("helvetica", "normal")
        doc.text(subLines, 26, by + 4.2)
      }

      // A hairline between the block's identity and its figures keeps the
      // ledger rows reading as a table rather than floating text.
      const dividerY = y + headerH + 1.5
      doc.setDrawColor("#e8ecf1")
      doc.setLineWidth(0.2)
      doc.line(26, dividerY, 184, dividerY)

      by = dividerY + 1
      doc.setFontSize(9)
      for (const r of rows) {
        by += 5.5
        doc.setFont("helvetica", "normal")
        doc.setTextColor(gray)
        doc.text(r.label, 26, by)
        doc.setTextColor(r.color || dark)
        doc.text(r.value, 184, by, { align: "right" })
      }

      by += 9
      doc.setDrawColor(stroke)
      doc.setLineWidth(0.4)
      doc.line(26, by - 5.5, 184, by - 5.5)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(totalRow.color || blue)
      doc.text(totalRow.label, 26, by)
      doc.text(totalRow.value, 184, by, { align: "right" })

      y += blockH + 5
    }

    // Outstanding invoice blocks
    for (const inv of open) {
      const f = figures(inv)
      const rows: Row[] = []
      if (inv.issue_date) rows.push({ label: "Issued", value: formatDate(inv.issue_date) })
      rows.push({ label: "Due", value: `${formatDate(inv.due_date)}${f.dl > 0 ? ` (${f.dl} days ago)` : ""}` })
      rows.push({ label: "Invoice amount", value: fmt(Number(inv.amount)) })
      const pays = paymentsByInvoice[inv.id]
      if (pays && pays.length > 0) {
        for (const p of pays) rows.push({ label: `Payment received ${formatDate(p.paid_on)}`, value: `-${fmt(Number(p.amount))}`, color: green })
      } else if (f.amountPaid > 0) {
        rows.push({ label: "Payments received — thank you", value: `-${fmt(f.amountPaid)}`, color: green })
      }
      if (f.pen > 0) rows.push({ label: "Fixed debt recovery cost", value: `+${fmt(f.pen)}`, color: gold })
      if (f.interest > 0) rows.push({ label: `Interest (${f.dl} days at ${RATE}% p.a. on the balance)`, value: `+${fmt(f.interest)}`, color: gold })

      const chip = f.dl > 0 ? `${f.dl} DAYS OVERDUE` : `DUE IN ${daysUntil(inv.due_date)} DAYS`
      drawBlock(
        safe(inv.ref), safe(inv.description, ""), chip, f.dl > 0 ? red : gray,
        rows, { label: "Amount due", value: fmt(f.total) }, null, "#d8dee6",
      )
    }

    // Total band — a quiet panel with a single accent bar, not a blue box
    pageBreak(20)
    doc.setFillColor("#f3f6fa")
    doc.roundedRect(20, y, 170, 16, 2, 2, "F")
    doc.setFillColor(blue)
    doc.rect(20, y, 1.6, 16, "F")
    doc.setFontSize(9)
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    doc.text("TOTAL NOW OWED", 27, y + 10)
    doc.setFontSize(14)
    doc.setTextColor(blue)
    doc.text(fmt(grandTotal), 184, y + 10.5, { align: "right" })
    y += 23

    // Settled section — same frozen-at-settlement maths as the email
    if (settled.length > 0) {
      pageBreak(14)
      doc.setFontSize(8)
      doc.setTextColor(green)
      doc.setFont("helvetica", "bold")
      doc.text("RECENTLY SETTLED — THANK YOU", 20, y)
      y += 5

      for (const inv of settled) {
        const face = Number(inv.amount)
        const cash = Number(inv.amount_paid) || 0
        const settledOn = inv.paid_date
        const dlSettle = settledOn ? daysBetween(inv.due_date, settledOn) : 0
        const finesEnabled = !inv.no_fines && inv.client_type !== "consumer"
        const pays = settledPayments[inv.id] || []
        const paidBefore = pays.filter((p: any) => settledOn && p.paid_on < settledOn)
          .reduce((s: number, p: any) => s + Number(p.amount), 0)
        const outstandingAtSettle = Math.max(0, round2(face - paidBefore))
        const debtAtDue = Math.max(0, round2(face - (Number(inv.paid_before_due) || 0)))
        const interest = dlSettle > 0 && finesEnabled ? round2(outstandingAtSettle * DAILY_RATE * dlSettle) : 0
        const pen = dlSettle > 0 && finesEnabled && debtAtDue > 0 ? penalty(debtAtDue) : 0
        const chargesCollected = Math.max(0, round2(cash - face))
        const writtenOff = Math.max(0, round2(face + interest + pen - cash))

        const rows: Row[] = []
        if (inv.issue_date) rows.push({ label: "Issued", value: formatDate(inv.issue_date) })
        rows.push({ label: "Due", value: formatDate(inv.due_date) })
        rows.push({ label: "Invoice amount", value: fmt(face) })
        if (pays.length > 0) {
          for (const p of pays) rows.push({ label: `Payment received ${formatDate(p.paid_on)}`, value: `-${fmt(Number(p.amount))}`, color: green })
        } else if (cash > 0) {
          rows.push({ label: "Payments received", value: `-${fmt(cash)}`, color: green })
        }
        if (chargesCollected > 0) rows.push({ label: "Of which late charges — thank you", value: fmt(chargesCollected), color: green })
        if (writtenOff > 0) rows.push({ label: "Written off as a gesture of goodwill", value: fmt(writtenOff), color: gray })

        drawBlock(
          safe(inv.ref), safe(inv.description, ""),
          `SETTLED ${settledOn ? formatDate(settledOn).toUpperCase() : ""}`, green,
          rows, { label: "Nothing further due — account settled", value: fmt(0), color: green },
          "#f6faf7", "#d3e6da",
        )
      }
    }

    // Payment details box
    const rawPayLines: string[] = []
    if (profile.account_name) rawPayLines.push(`Account Name: ${profile.account_name}`)
    if (profile.bank_name || profile.sort_code || profile.account_number) {
      rawPayLines.push(`Bank: ${profile.bank_name || "—"}    Sort Code: ${profile.sort_code || "—"}    Acct: ${profile.account_number || "—"}`)
    }
    rawPayLines.push("Reference: please quote the invoice number(s) you are paying")
    doc.setFontSize(9)
    const payLines: string[] = []
    for (const raw of rawPayLines) {
      doc.splitTextToSize(raw, 154).forEach((l: string) => payLines.push(l))
    }
    const boxH = 14 + payLines.length * 5.5
    pageBreak(boxH + 4)
    doc.setFillColor("#f1f3f6")
    doc.roundedRect(20, y, 170, boxH, 3, 3, "F")
    y += 8
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    doc.text("Payment Details", 28, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    for (const line of payLines) {
      y += 5.5
      doc.text(line, 28, y)
    }

    // Footer
    const footerY = 280
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#94a3b8")
    doc.text("Generated by Hielda — Protecting your pay.", 105, footerY, { align: "center" })
    if (open.some((i: any) => daysLate(i.due_date) > 0)) {
      doc.setFontSize(7)
      doc.text("Late payment charges applied under the Late Payment of Commercial Debts (Interest) Act 1998 and continue to accrue daily until payment is received.", 105, footerY + 5, { align: "center" })
    }

    const pdfOutput = doc.output("arraybuffer")
    return new Response(pdfOutput, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement.pdf"`,
      },
    })
  } catch (e) {
    return jsonError((e as Error).message, 500)
  }
})
