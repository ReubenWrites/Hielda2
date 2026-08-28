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
    const finesEnabled = !invoice.no_fines
    // Partial payments: credit what's been received and accrue interest on
    // the outstanding balance only — the PDF must agree with the app and
    // the chase emails or the client has grounds to dispute the lot.
    const amountPaid = Number(invoice.amount_paid) || 0
    const netOutstanding = Math.max(0, netAmount - amountPaid)
    // Fixed fee tiers on the debt that went overdue — pre-due payments
    // (paid_before_due) reduce it.
    const debtAtDue = Math.max(0, netAmount - (Number(invoice.paid_before_due) || 0))
    // Interest requires fines enabled for B2B; consumer invoices keep their
    // contractual interest (they always have no_fines set at creation).
    const interest = isOverdue && (finesEnabled || isConsumer) ? netOutstanding * DAILY_RATE * daysOverdue : 0
    const pen = isOverdue && !isConsumer && finesEnabled && netOutstanding > 0 && debtAtDue > 0 ? penalty(debtAtDue) : 0
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

    // Dates column. Values render in a narrow column from x=160 to x=190,
    // so long values (especially user-entered Client Ref strings) need
    // wrapping — without the cap, a long ref would run off the page edge.
    const DETAILS_VALUE_WIDTH = 30
    const details: string[][] = [
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
      doc.text(valueLines, 160, detailsY)
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
      rawPayLines.push(`Bank: ${profile.bank_name || "—"}    Sort Code: ${profile.sort_code || "—"}    Acct: ${profile.account_number || "—"}`)
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

    // Footer
    const footerY = 280
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#94a3b8")
    doc.text("Generated by Hielda — automatic invoice chasing & statutory late fees for UK businesses · hielda.com", 105, footerY, { align: "center" })

    if (isConsumer) {
      doc.setFontSize(7)
      doc.text(`Swift payment is always appreciated. If still outstanding after ${invoice.payment_term_days || 30} days, statutory interest at ${RATE}% per annum will start to accrue until settled in full.`, 105, footerY + 5, { align: "center" })
    } else if (isOverdue) {
      doc.setFontSize(7)
      doc.text("Late payment charges applied under the Late Payment of Commercial Debts (Interest) Act 1998.", 105, footerY + 5, { align: "center" })
    }

    // Output
    const pdfOutput = doc.output("arraybuffer")

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
