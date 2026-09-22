// Supabase Edge Function: Generate invoice PDF
// Uses jsPDF via ESM to build a professional invoice PDF

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

// jsPDF.text throws on null/undefined/non-string input. Coerce at every
// potentially-nullable call site so a missing field doesn't 500 the
// whole PDF generation — render a placeholder instead.
function safe(v: unknown, fallback = "—"): string {
  if (v === null || v === undefined) return fallback
  return String(v)
}

// Schema says line_items is jsonb (an array), but defend against rows
// where the value somehow ended up as a JSON string — for-of on a string
// silently iterates characters and produces a garbage PDF.
function coerceLineItems(v: unknown): Array<{ description?: string; amount?: number | string; vatRate?: string }> | null {
  if (Array.isArray(v)) return v
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function safeSplit(v: unknown): string[] {
  return typeof v === "string" ? v.split("\n") : []
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function dayDiff(a: string | number | Date, b: string | number | Date): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 864e5)
}

/**
 * Statutory interest accrued period by period. Mirrors accruedInterest()
 * in src/utils.js, api/_money.js and the statement PDF — every surface
 * that tells a client what they owe must agree to the penny.
 *
 * Interest is owed on whatever was actually outstanding on each day. The
 * old model multiplied the CURRENT balance by the WHOLE overdue period,
 * so a late part-payment retroactively erased interest that had already
 * accrued on a larger balance. No ledger falls back to that flat model,
 * which under-states rather than over-states.
 */
function accruedInterest(
  invoice: any, payments: any[] | null, dailyRate: number,
  asOf?: string | number | Date,
): number {
  const due = invoice.due_date
  const end = asOf ?? Date.now()
  if (dayDiff(due, end) <= 0) return 0

  const face = Number(invoice.amount) || 0

  if (!Array.isArray(payments)) {
    const owed = Math.max(0, face - (Number(invoice.amount_paid) || 0))
    return round2(owed * dailyRate * dayDiff(due, end))
  }

  // A row we can't date can't be placed on the timeline: a null date parses
  // as 1970 and silently halves the debt, an unparseable one poisons every
  // comparison with NaN. Treat both as landing on the due date.
  const rows = payments
    .map((p) => {
      const t = new Date(p.paid_on).getTime()
      return { on: Number.isFinite(t) ? p.paid_on : due, amount: Number(p.amount) || 0 }
    })
    .filter((r) => r.amount > 0)
  // amount_paid can exceed what the ledger accounts for (rows that predate
  // the ledger, an import that set the total without dated rows). Credit
  // the difference at the due date: it lowers the starting balance, so it
  // under-states rather than accruing on money already received.
  const ledgered = rows.reduce((s, r) => s + r.amount, 0)
  const unledgered = round2((Number(invoice.amount_paid) || 0) - ledgered)
  if (unledgered > 0) rows.push({ on: due, amount: unledgered })
  rows.sort((a, b) => new Date(a.on).getTime() - new Date(b.on).getTime())

  let balance = face
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) balance = Math.max(0, balance - r.amount)
  }

  let interest = 0
  let cursor: string | number | Date = due
  for (const r of rows) {
    if (dayDiff(r.on, due) >= 0) continue
    if (dayDiff(r.on, end) < 0) break
    const days = dayDiff(cursor, r.on)
    if (days > 0) interest += balance * dailyRate * days
    balance = Math.max(0, balance - r.amount)
    cursor = r.on
  }
  const tailDays = dayDiff(cursor, end)
  if (tailDays > 0) interest += balance * dailyRate * tailDays

  return round2(interest)
}

/**
 * Append receipt files to the invoice PDF with pdf-lib: PDF receipts have
 * their pages copied in; JPEG/PNG receipts each get an A4 page with the
 * image fitted inside a margin and a small caption naming the line item.
 * WebP can't be embedded by pdf-lib and is skipped.
 */
async function appendReceipts(
  invoicePdf: ArrayBuffer, receipts: any[], supabase: any, invoice: any,
): Promise<ArrayBuffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("npm:pdf-lib@1.17.1")
  const out = await PDFDocument.load(invoicePdf)
  const font = await out.embedFont(StandardFonts.Helvetica)
  const lineItems = coerceLineItems(invoice.line_items) || []
  const A4: [number, number] = [595.28, 841.89]
  const M = 40

  for (const r of receipts) {
    const { data: blob, error } = await supabase.storage.from("receipts").download(r.storage_path)
    if (error || !blob) continue
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const caption = `Receipt${r.line_index != null && lineItems[r.line_index] ? ` — ${lineItems[r.line_index].description}` : ""}  ·  ${r.file_name}`
    try {
      if (r.mime_type === "application/pdf") {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((p, i) => {
          out.addPage(p)
          if (i === 0) {
            const { width, height } = p.getSize()
            p.drawText(caption.slice(0, 110), { x: 24, y: height - 18, size: 8, font, color: rgb(0.45, 0.5, 0.55), maxWidth: width - 48 })
          }
        })
        continue
      }
      const img = r.mime_type === "image/png" ? await out.embedPng(bytes)
        : r.mime_type === "image/jpeg" ? await out.embedJpg(bytes)
        : null
      if (!img) continue
      const page = out.addPage(A4)
      page.drawText(caption.slice(0, 110), { x: M, y: A4[1] - M + 12, size: 9, font, color: rgb(0.45, 0.5, 0.55), maxWidth: A4[0] - 2 * M })
      const boxW = A4[0] - 2 * M
      const boxH = A4[1] - 2 * M - 16
      const scale = Math.min(boxW / img.width, boxH / img.height, 1)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, { x: M + (boxW - w) / 2, y: A4[1] - M - 16 - h, width: w, height: h })
    } catch (e) {
      console.error("generate-invoice-pdf: receipt skipped:", r.file_name, (e as Error).message)
    }
  }
  return await out.save()
}

// Page geometry. A4 portrait is 297mm tall; the footer sits at y=280
// (and footer subtext at y=285). PAGE_BOTTOM_LIMIT is the floor for
// content above the footer — anything that would render below it
// triggers a page break.
const PAGE_BOTTOM_LIMIT = 265

// Browsers preflight any POST with Content-Type: application/json. Without
// an OPTIONS handler + Allow headers the preflight fails and the browser
// blocks the real request, surfacing as "Failed to send a request to the
// Edge Function" client-side.
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

async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ""
    bytes.forEach(b => binary += String.fromCharCode(b))
    const b64 = btoa(binary)
    const ct = res.headers.get("content-type") || "image/png"
    const format = ct.includes("jpeg") || ct.includes("jpg") ? "JPEG"
      : ct.includes("png") ? "PNG"
      : ct.includes("gif") ? "GIF"
      : ct.includes("webp") ? "WEBP"
      : "PNG"
    return { data: b64, format }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { invoice_id, rate: requestedRate } = await req.json()
    const RATE = (typeof requestedRate === "number" && requestedRate > 0) ? requestedRate : DEFAULT_RATE
    const DAILY_RATE = RATE / 365 / 100
    if (!invoice_id) {
      return jsonError("invoice_id required", 400)
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single()

    if (invErr || !invoice) {
      return jsonError("Invoice not found", 404)
    }

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", invoice.user_id)
      .single()

    if (profErr || !profile) {
      return jsonError("Profile not found", 404)
    }

    // Payment ledger: interest accrues per balance period, so the invoice
    // PDF needs the dated payments, not just the amount_paid total. A
    // failed fetch degrades to the flat model, which under-states.
    let ledger: any[] | null = null
    {
      const { data: payRows, error: payErr } = await supabase
        .from("invoice_payments")
        .select("amount, paid_on")
        .eq("invoice_id", invoice.id)
        .order("paid_on", { ascending: true })
      if (!payErr) ledger = payRows || []
    }

    // Calculate overdue amounts
    const dueDate = new Date(invoice.due_date)
    const now = new Date()
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 864e5))
    const isOverdue = invoice.status === "overdue" || dueDate < now
    const isConsumer = invoice.client_type === "consumer"
    const netAmount = Number(invoice.amount)
    const vatAmount = Number(invoice.vat_amount) || 0
    const invoiceTotal = Number(invoice.total_with_vat) || netAmount
    const hasVat = vatAmount > 0
    // The 1998 Act is business-to-business only, and no_fines is the user's
    // waiver. Same rule as chargeableExtras() in the app, the API and the
    // statement PDF: no interest and no fixed fee for either. (This PDF used
    // to charge consumers "contractual" interest on the strength of a footer
    // line — the only surface that did, so the invoice, the emails and the
    // dashboard disagreed on what a consumer owed.)
    const finesEnabled = !invoice.no_fines && !isConsumer
    // Partial payments: credit what's been received and accrue interest on
    // the outstanding balance only — the PDF must agree with the app and
    // the chase emails or the client has grounds to dispute the lot.
    const amountPaid = Number(invoice.amount_paid) || 0
    const netOutstanding = Math.max(0, netAmount - amountPaid)
    // Fixed fee tiers on the debt that went overdue — pre-due payments
    // (paid_before_due) reduce it.
    const debtAtDue = Math.max(0, netAmount - (Number(invoice.paid_before_due) || 0))
    // Accrued per balance period off the ledger fetched above.
    const interest = isOverdue && finesEnabled
      ? accruedInterest(invoice, ledger, DAILY_RATE) : 0
    const pen = isOverdue && finesEnabled && netOutstanding > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
    const total = Math.max(0, invoiceTotal - amountPaid) + interest + pen

    const lineItems = coerceLineItems(invoice.line_items)

    // Build VAT breakdown from line items
    const vatBreakdown: Record<string, number> = {}
    if (hasVat && lineItems) {
      for (const li of lineItems) {
        const amt = parseFloat(String(li.amount ?? "")) || 0
        const rate = li.vatRate || "0"
        if (rate === "exempt" || rate === "0") continue
        const rateNum = parseFloat(rate) || 0
        vatBreakdown[rate] = (vatBreakdown[rate] || 0) + Math.round(amt * rateNum / 100 * 100) / 100
      }
    }

    // Fetch logo if available
    const logoImg = profile.logo_url ? await fetchImageAsBase64(profile.logo_url) : null

    // Build PDF
    // Whisper palette shared with the statement PDF — near-neutral inks
    // with just enough hue to carry meaning.
    const doc = new jsPDF()
    const blue = "#46688b"
    const gray = "#5f6c7c"
    const dark = "#18222f"
    let y = 20

    // Logo or business name in top-right. Cap at 70mm wide so a long
    // business name wraps cleanly instead of colliding with the INVOICE
    // label at x=20.
    const TOP_RIGHT_WIDTH = 70
    const bizName = profile.business_name || profile.full_name || ""
    if (logoImg) {
      try {
        // Add logo — proportional within 50mm wide x 20mm tall bounding box, right-aligned
        const imgData = `data:image/${logoImg.format.toLowerCase()};base64,${logoImg.data}`
        const imgProps = doc.getImageProperties(imgData)
        const maxW = 50, maxH = 20
        const scale = Math.min(maxW / imgProps.width, maxH / imgProps.height)
        const w = imgProps.width * scale
        const h = imgProps.height * scale
        doc.addImage(imgData, logoImg.format, 190 - w, y - 5, w, h, undefined, "FAST")
        y += 5
      } catch {
        // Fallback to text if image fails
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.setFont("helvetica", "bold")
        const nameLines = doc.splitTextToSize(bizName, TOP_RIGHT_WIDTH)
        doc.text(nameLines, 190, y, { align: "right" })
      }
    } else {
      doc.setFontSize(10)
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      const nameLines = doc.splitTextToSize(bizName, TOP_RIGHT_WIDTH)
      doc.text(nameLines, 190, y, { align: "right" })
    }

    // Invoice label + ref (top left). Invoice ref at fontSize 22 — at
    // ~5mm/char this can run a 20-char ref well past the page midline
    // and into the business name. Scale fontSize down if the ref would
    // be wider than 90mm.
    doc.setFontSize(10)
    doc.setTextColor(blue)
    doc.setFont("helvetica", "bold")
    doc.text("INVOICE", 20, y)

    const refText = safe(invoice.ref)
    const REF_MAX_WIDTH = 90
    let refFontSize = 22
    // Iteratively shrink the ref font until it fits, floor at 10pt.
    // 10pt is still comfortably readable; anything below that and the
    // ref would just truncate visually (rare — would need ~40+ chars).
    doc.setFontSize(refFontSize)
    while (doc.getTextWidth(refText) > REF_MAX_WIDTH && refFontSize > 10) {
      refFontSize -= 2
      doc.setFontSize(refFontSize)
    }
    doc.text(refText, 20, y + 10)

    // Business info (right side, below logo/name).
    // Width budget: business address can extend leftward from x=190, but
    // must not collide with the INVOICE label/ref at x=20-90. Cap at 90mm
    // and right-align each wrapped line.
    const BIZ_ADDR_WIDTH = 90
    const infoTop = logoImg ? y + 16 : y + 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    let bizY = infoTop
    safeSplit(profile.address).forEach((rawLine: string) => {
      const wrapped = doc.splitTextToSize(rawLine.trim(), BIZ_ADDR_WIDTH)
      wrapped.forEach((wl: string) => {
        doc.text(wl, 190, bizY, { align: "right" })
        bizY += 4
      })
    })
    if (profile.email) {
      bizY = Math.max(bizY, infoTop + 20)
      const emailLines = doc.splitTextToSize(profile.email, BIZ_ADDR_WIDTH)
      emailLines.forEach((el: string) => {
        doc.text(el, 190, bizY, { align: "right" })
        bizY += 4
      })
    }
    if (profile.website_url) {
      const urlLines = doc.splitTextToSize(profile.website_url.replace(/^https?:\/\//, ""), BIZ_ADDR_WIDTH)
      let urlY = Math.max(bizY, infoTop + 25)
      urlLines.forEach((ul: string) => {
        doc.text(ul, 190, urlY, { align: "right" })
        urlY += 4
      })
    }

    // Blue line
    y = 50
    doc.setDrawColor(blue)
    doc.setLineWidth(0.5)
    doc.line(20, y, 190, y)

    // Bill to + dates
    // Width budget: BILL TO column lives between x=20 and the DETAILS
    // column at x=120, so cap at 95mm. Without this cap, a long client
    // address typed on one line runs straight across the row and
    // overlaps the date labels — exactly what the bug report screenshot
    // showed.
    const BILL_TO_WIDTH = 95
    y = 58
    doc.setFontSize(8)
    doc.setTextColor(gray)
    doc.text("BILL TO", 20, y)
    doc.text("DETAILS", 120, y)

    y += 6
    doc.setFontSize(10)
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    const clientNameLines = doc.splitTextToSize(safe(invoice.client_name, "—"), BILL_TO_WIDTH)
    doc.text(clientNameLines, 20, y)
    // Track where the bill-to column ends so client_email lands below it
    // rather than at a fixed offset that might overlap wrapped address text.
    let billToY = y + (clientNameLines.length - 1) * 5 + 5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    safeSplit(invoice.client_address).forEach((rawLine: string) => {
      const wrapped = doc.splitTextToSize(rawLine.trim(), BILL_TO_WIDTH)
      wrapped.forEach((wl: string) => {
        doc.text(wl, 20, billToY)
        billToY += 4
      })
    })
    if (invoice.client_email) {
      doc.text(invoice.client_email, 20, billToY + 2)
    }

    // Dates column. Values render from x=148 to the 190 margin, so long
    // values (especially user-entered Client Ref strings) need wrapping —
    // without the cap, a long ref would run off the page edge. 42mm fits a
    // ~20-character token at 9pt; at the old 30mm a purchase-order ref
    // broke into three ragged lines.
    const DETAILS_VALUE_X = 148
    const DETAILS_VALUE_WIDTH = 42
    const details: string[][] = [
      ...(invoice.work_date ? [["Work Date", formatDate(invoice.work_date)]] : []),
      ["Issue Date", formatDate(invoice.issue_date)],
      ["Due Date", formatDate(invoice.due_date)],
      ["Terms", `${invoice.payment_term_days} days`],
    ]
    if (invoice.client_ref) details.push(["Client Ref", invoice.client_ref])
    if (invoice.paid_date) details.push(["Paid", formatDate(invoice.paid_date)])

    let detailsY = y
    details.forEach(([k, v]) => {
      doc.setTextColor(gray)
      doc.text(k, 120, detailsY)
      doc.setTextColor(dark)
      const valueLines = doc.splitTextToSize(safe(v), DETAILS_VALUE_WIDTH)
      doc.text(valueLines, DETAILS_VALUE_X, detailsY)
      // 6mm per row, plus extra for any wrapped lines
      detailsY += 6 + Math.max(0, valueLines.length - 1) * 4
    })

    // Line items start below whichever column extends further down —
    // BILL TO (with potentially-wrapped client name + address + email)
    // or DETAILS (with potentially-wrapped client ref). No fixed floor:
    // the old max(100, ...) left a ~30mm dead gap on invoices with short
    // addresses and pushed the payment box onto a near-empty second page.
    const billToBottom = billToY + (invoice.client_email ? 6 : 0)
    y = Math.max(billToBottom + 6, detailsY + 6)
    doc.setDrawColor("#dce1e8")
    doc.setLineWidth(0.3)
    doc.line(20, y, 190, y)

    y += 6
    doc.setFontSize(8)
    doc.setTextColor(gray)
    doc.text("DESCRIPTION", 20, y)
    if (hasVat) doc.text("VAT", 150, y, { align: "right" })
    doc.text("AMOUNT", 190, y, { align: "right" })

    y += 2
    doc.line(20, y, 190, y)

    // Width budget for the description column. With VAT we have to leave
    // room for the rate label at x=150 and the amount at x=190, so cap
    // descriptions at 100mm. Without VAT the only thing on the right is
    // the amount, so we get more room — 130mm. Anything longer wraps to
    // the next line via splitTextToSize, which is what was missing
    // before — long descriptions used to render straight across the row
    // and overlap with the amount at x=190.
    const descMaxWidth = hasVat ? 100 : 130
    const LINE_HEIGHT = 5 // mm at fontSize 10

    // Render individual line items if available
    if (lineItems?.length) {
      for (const li of lineItems) {
        y += 6.2
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.setFont("helvetica", "normal")
        const descLines = doc.splitTextToSize(safe(li.description, "—"), descMaxWidth)
        doc.text(descLines, 20, y)
        if (hasVat) {
          doc.setFontSize(9)
          doc.setTextColor(gray)
          const rateLabel = li.vatRate === "exempt" ? "Exempt" : `${li.vatRate || 0}%`
          doc.text(rateLabel, 150, y, { align: "right" })
        }
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.text(fmt(parseFloat(String(li.amount ?? "")) || 0), 190, y, { align: "right" })
        // Push y past any extra wrapped lines so the next line item or
        // the totals block doesn't collide with the wrapped description.
        if (descLines.length > 1) y += (descLines.length - 1) * LINE_HEIGHT
      }
    } else {
      y += 7
      doc.setFontSize(10)
      doc.setTextColor(dark)
      const descLines = doc.splitTextToSize(invoice.description || "Services rendered", descMaxWidth)
      doc.text(descLines, 20, y)
      doc.text(fmt(netAmount), 190, y, { align: "right" })
      if (descLines.length > 1) y += (descLines.length - 1) * LINE_HEIGHT
    }

    // Totals
    y += 8
    doc.setDrawColor("#dce1e8")
    doc.setLineWidth(0.3)
    doc.line(120, y, 190, y)

    if (hasVat) {
      y += 7
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(gray)
      doc.text("Subtotal (ex. VAT)", 120, y)
      doc.text(fmt(netAmount), 190, y, { align: "right" })

      for (const [rate, amount] of Object.entries(vatBreakdown)) {
        if (amount <= 0) continue
        y += 6
        doc.text(`VAT @ ${rate}%`, 120, y)
        doc.text(fmt(amount), 190, y, { align: "right" })
      }

      y += 6
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      doc.text("Total (inc. VAT)", 120, y)
      doc.text(fmt(invoiceTotal), 190, y, { align: "right" })
    }

    if (isOverdue && daysOverdue > 0) {
      y += 8
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setDrawColor("#dce1e8")
      doc.setLineWidth(0.3)
      doc.line(120, y, 190, y)

      y += 7
      doc.setTextColor(gray)
      doc.text(hasVat ? "Invoice total" : "Original amount", 120, y)
      doc.text(fmt(invoiceTotal), 190, y, { align: "right" })

      if (amountPaid > 0) {
        y += 6
        doc.setTextColor("#55796a")
        doc.text("Payments received — thank you", 120, y)
        doc.text(`-${fmt(amountPaid)}`, 190, y, { align: "right" })
      }

      if (pen > 0) {
        y += 6
        doc.setTextColor("#7d7154")
        doc.text("Fixed debt recovery cost", 120, y)
        doc.text(`+${fmt(pen)}`, 190, y, { align: "right" })
      }

      if (interest > 0) {
        y += 6
        doc.setTextColor("#7d7154")
        doc.text(`Interest — ${daysOverdue}d at ${RATE}%${amountPaid > 0 ? ", on balance" : ""}`, 120, y)
        doc.text(`+${fmt(interest)}`, 190, y, { align: "right" })
      }

      y += 8
      doc.setDrawColor(blue)
      doc.setLineWidth(0.5)
      doc.line(120, y, 190, y)

      y += 8
      doc.setFontSize(11)
      doc.setTextColor(blue)
      doc.setFont("helvetica", "bold")
      doc.text(amountPaid > 0 ? "BALANCE NOW OWED" : "TOTAL NOW OWED", 120, y)
      doc.text(fmt(total), 190, y, { align: "right" })
    } else if (amountPaid > 0) {
      // Not overdue (or paid same-day) but part-paid: credit the payment
      // and show the balance rather than restating the full amount.
      y += 7
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor("#55796a")
      doc.text("Payments received — thank you", 120, y)
      doc.text(`-${fmt(amountPaid)}`, 190, y, { align: "right" })

      y += 8
      doc.setFontSize(11)
      doc.setTextColor(blue)
      doc.setFont("helvetica", "bold")
      doc.text("BALANCE DUE", 120, y)
      doc.text(fmt(Math.max(0, invoiceTotal - amountPaid)), 190, y, { align: "right" })
    } else if (!hasVat) {
      y += 8
      doc.setFontSize(11)
      doc.setTextColor(blue)
      doc.setFont("helvetica", "bold")
      doc.text("TOTAL DUE", 120, y)
      doc.text(fmt(netAmount), 190, y, { align: "right" })
    }
    // If has VAT, not overdue, and nothing part-paid: total already shown above

    // Payment details box
    y += 10

    // Build payment lines. Each one is wrapped to the box's inner width
    // (170mm - 2*8mm padding = 154mm) — a long bank name or account
    // name would otherwise run past the right edge of the box.
    const PAY_LINE_WIDTH = 154
    const rawPayLines: string[] = []
    const hasBankDetails = profile.bank_name || profile.sort_code || profile.account_number
    const hasIntlDetails = profile.swift_bic || profile.iban

    if (profile.account_name) {
      rawPayLines.push(`Account Name: ${profile.account_name}`)
    }
    if (hasBankDetails) {
      // Only the fields the user filled in; a "Bank: —" placeholder on a
      // document a client pays from looks like something is missing.
      rawPayLines.push([
        profile.bank_name ? `Bank: ${profile.bank_name}` : null,
        profile.sort_code ? `Sort Code: ${profile.sort_code}` : null,
        profile.account_number ? `Acct: ${profile.account_number}` : null,
      ].filter(Boolean).join("    "))
    }
    if (hasIntlDetails) {
      const intlParts: string[] = []
      if (profile.swift_bic) intlParts.push(`SWIFT/BIC: ${profile.swift_bic}`)
      if (profile.iban) intlParts.push(`IBAN: ${profile.iban}`)
      rawPayLines.push(intlParts.join("    "))
    }
    rawPayLines.push(`Reference: ${invoice.ref}`)
    if (profile.vat_number) rawPayLines.push(`VAT Reg: ${profile.vat_number}`)

    // Pre-compute wrapped lines so we know the box height before
    // we draw the background fill.
    doc.setFontSize(9)
    const payLines: string[] = []
    for (const raw of rawPayLines) {
      const wrapped = doc.splitTextToSize(raw, PAY_LINE_WIDTH)
      wrapped.forEach((l: string) => payLines.push(l))
    }

    const boxH = 14 + payLines.length * 5.5

    // If the box would extend past the bottom limit, break to a new
    // page. Reserves footer space and prevents the rounded rect (and
    // the text inside it) from clipping into / past the footer text.
    if (y + boxH > PAGE_BOTTOM_LIMIT) {
      doc.addPage()
      y = 20
    }

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

    // Per-invoice notes (renders above the signoff). Page-break is
    // checked *before* the "Notes" header so the header doesn't get
    // orphaned on the previous page when the body would have spilled
    // off — that was the bug in the previous version.
    if (invoice.notes) {
      y += 10
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      const notesLines = doc.splitTextToSize(String(invoice.notes), 170)
      // Need room for: header (5mm) + spacing (5mm) + each body line (5mm)
      const notesBlockHeight = 10 + notesLines.length * 5
      if (y + notesBlockHeight > PAGE_BOTTOM_LIMIT) {
        doc.addPage()
        y = 20
      }
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      doc.text("Notes", 20, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setTextColor(gray)
      doc.text(notesLines, 20, y)
      y += notesLines.length * 5
    }

    // Custom signoff
    if (profile.invoice_signoff) {
      y += 12
      doc.setFontSize(9)
      doc.setTextColor(gray)
      doc.setFont("helvetica", "italic")
      const signoffLines = doc.splitTextToSize(profile.invoice_signoff, 160)
      if (y + signoffLines.length * 5 > PAGE_BOTTOM_LIMIT) {
        doc.addPage()
        y = 20
      }
      doc.text(signoffLines, 20, y)
      y += signoffLines.length * 5
    }

    // Payment terms block — on every B2B invoice with fines enabled,
    // from day one, not just once it's overdue. The Act applies whether
    // or not the invoice mentions it, but stating the terms up front is
    // what makes the charges expected rather than contested: due date,
    // the statutory rate expressed the way the Act does (8% above base),
    // the fixed-fee tiers, recovery costs, and a 30-day window for
    // queries so a late dispute can't be used to withhold payment.
    if (!isConsumer && finesEnabled) {
      const termsLines: string[] = [
        `Payment is due by ${formatDate(invoice.due_date)} (${invoice.payment_term_days || 30} days from the invoice date). Any query regarding this invoice should be raised in writing within 30 days of the invoice date.`,
        `Late payment: statutory interest accrues from the due date at 8% per annum above the Bank of England base rate (currently ${RATE}%) under the Late Payment of Commercial Debts (Interest) Act 1998, together with a fixed debt recovery cost of £40 (sums under £1,000), £70 (£1,000 to £9,999.99) or £100 (£10,000 and over), and reasonable costs of recovery.`,
      ]
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      const wrapped: string[] = []
      for (const t of termsLines) doc.splitTextToSize(t, 170).forEach((l: string) => wrapped.push(l))
      const TERMS_LINE_H = 3.4
      const termsH = 4 + wrapped.length * TERMS_LINE_H
      // Anchor just above the footer when there's room; otherwise flow.
      const anchoredTop = 275 - termsH
      let ty: number
      if (y + 8 <= anchoredTop) {
        ty = anchoredTop
      } else if (y + 8 + termsH <= PAGE_BOTTOM_LIMIT) {
        ty = y + 8
      } else {
        doc.addPage()
        ty = 20
      }
      doc.setDrawColor("#dce1e8")
      doc.setLineWidth(0.3)
      doc.line(20, ty, 190, ty)
      ty += 4
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      doc.text("PAYMENT TERMS", 20, ty)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(gray)
      for (const line of wrapped) {
        ty += TERMS_LINE_H
        doc.text(line, 20, ty)
      }
      y = Math.max(y, ty)
    }

    // Footer
    const footerY = 280
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#94a3b8")
    doc.text("Generated by Hielda — automatic invoice chasing & statutory late fees for UK businesses · hielda.com", 105, footerY, { align: "center" })

    if (isConsumer) {
      // The 1998 Act doesn't apply to consumers and Hielda charges them
      // nothing extra, so promise nothing.
      doc.setFontSize(7)
      doc.text("Swift payment is always appreciated — thank you.", 105, footerY + 5, { align: "center" })
    } else if (isOverdue && finesEnabled) {
      doc.setFontSize(7)
      doc.text("Late payment charges applied under the Late Payment of Commercial Debts (Interest) Act 1998.", 105, footerY + 5, { align: "center" })
    }

    // Output
    let pdfOutput: ArrayBuffer = doc.output("arraybuffer")

    // Receipts the user chose to include are appended as pages, so the
    // client gets one document: invoice first, receipts behind it. Any
    // failure here degrades to the invoice alone rather than no PDF.
    try {
      const { data: receipts } = await supabase
        .from("invoice_receipts")
        .select("storage_path, file_name, mime_type, line_index")
        .eq("invoice_id", invoice.id)
        .eq("include_in_invoice", true)
        .order("created_at", { ascending: true })
      if (receipts && receipts.length) {
        pdfOutput = await appendReceipts(pdfOutput, receipts, supabase, invoice)
      }
    } catch (e) {
      console.error("generate-invoice-pdf: receipts skipped:", (e as Error).message)
    }

    return new Response(pdfOutput, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe(invoice.ref, "invoice")}.pdf"`,
      },
    })
  } catch (e) {
    return jsonError(e.message, 500)
  }
})
