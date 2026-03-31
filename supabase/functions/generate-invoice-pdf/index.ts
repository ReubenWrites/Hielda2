// Supabase Edge Function: Generate invoice PDF
// Uses jsPDF via ESM to build a professional invoice PDF

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const RATE = 11.75
const DAILY_RATE = RATE / 365 / 100

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
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { invoice_id } = await req.json()
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), { status: 400 })
    }

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single()

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404 })
    }

    // Fetch profile
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", invoice.user_id)
      .single()

    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 })
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
    const interest = isOverdue ? netAmount * DAILY_RATE * daysOverdue : 0
    const pen = isOverdue && !isConsumer ? penalty(netAmount) : 0
    const total = invoiceTotal + interest + pen

    // Build VAT breakdown from line items
    const vatBreakdown: Record<string, number> = {}
    if (hasVat && invoice.line_items) {
      for (const li of invoice.line_items) {
        const amt = parseFloat(li.amount) || 0
        const rate = li.vatRate || "0"
        if (rate === "exempt" || rate === "0") continue
        const rateNum = parseFloat(rate) || 0
        vatBreakdown[rate] = (vatBreakdown[rate] || 0) + Math.round(amt * rateNum / 100 * 100) / 100
      }
    }

    // Fetch logo if available
    const logoImg = profile.logo_url ? await fetchImageAsBase64(profile.logo_url) : null

    // Build PDF
    const doc = new jsPDF()
    const blue = "#1e5fa0"
    const gray = "#64748b"
    const dark = "#0f172a"
    let y = 20

    // Logo or business name in top-right
    const bizName = profile.business_name || profile.full_name || ""
    if (logoImg) {
      try {
        // Add logo — max 50mm wide, 20mm tall, right-aligned
        doc.addImage(`data:image/${logoImg.format.toLowerCase()};base64,${logoImg.data}`, logoImg.format, 140, y - 5, 50, 20, undefined, "FAST")
        y += 5
      } catch {
        // Fallback to text if image fails
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.setFont("helvetica", "bold")
        doc.text(bizName, 190, y, { align: "right" })
      }
    } else {
      doc.setFontSize(10)
      doc.setTextColor(dark)
      doc.setFont("helvetica", "bold")
      doc.text(bizName, 190, y, { align: "right" })
    }

    // Invoice label + ref (top left)
    doc.setFontSize(10)
    doc.setTextColor(blue)
    doc.setFont("helvetica", "bold")
    doc.text("INVOICE", 20, y)

    doc.setFontSize(22)
    doc.text(invoice.ref, 20, y + 10)

    // Business info (right side, below logo/name)
    const infoTop = logoImg ? y + 16 : y + 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    if (profile.address) {
      const addrLines = profile.address.split("\n")
      addrLines.forEach((line: string, i: number) => {
        doc.text(line.trim(), 190, infoTop + i * 4, { align: "right" })
      })
    }
    if (profile.email) {
      doc.text(profile.email, 190, infoTop + 20, { align: "right" })
    }
    if (profile.website_url) {
      doc.text(profile.website_url.replace(/^https?:\/\//, ""), 190, infoTop + 25, { align: "right" })
    }

    // Blue line
    y = 50
    doc.setDrawColor(blue)
    doc.setLineWidth(0.5)
    doc.line(20, y, 190, y)

    // Bill to + dates
    y = 58
    doc.setFontSize(8)
    doc.setTextColor(gray)
    doc.text("BILL TO", 20, y)
    doc.text("DETAILS", 120, y)

    y += 6
    doc.setFontSize(10)
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    doc.text(invoice.client_name || "—", 20, y)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(gray)
    if (invoice.client_address) {
      const clientLines = invoice.client_address.split("\n")
      clientLines.forEach((line: string, i: number) => {
        doc.text(line.trim(), 20, y + 5 + i * 4)
      })
    }
    if (invoice.client_email) {
      doc.text(invoice.client_email, 20, y + 18)
    }

    // Dates column
    const details = [
      ["Issue Date", formatDate(invoice.issue_date)],
      ["Due Date", formatDate(invoice.due_date)],
      ["Terms", `${invoice.payment_term_days} days`],
    ]
    if (invoice.paid_date) details.push(["Paid", formatDate(invoice.paid_date)])

    details.forEach(([k, v], i) => {
      doc.setTextColor(gray)
      doc.text(k, 120, y + i * 6)
      doc.setTextColor(dark)
      doc.text(v, 160, y + i * 6)
    })

    // Line items
    y = 100
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

    // Render individual line items if available
    if (invoice.line_items?.length) {
      for (const li of invoice.line_items) {
        y += 7
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.setFont("helvetica", "normal")
        doc.text(li.description || "—", 20, y)
        if (hasVat) {
          doc.setFontSize(9)
          doc.setTextColor(gray)
          const rateLabel = li.vatRate === "exempt" ? "Exempt" : `${li.vatRate || 0}%`
          doc.text(rateLabel, 150, y, { align: "right" })
        }
        doc.setFontSize(10)
        doc.setTextColor(dark)
        doc.text(fmt(parseFloat(li.amount) || 0), 190, y, { align: "right" })
      }
    } else {
      y += 7
      doc.setFontSize(10)
      doc.setTextColor(dark)
      doc.text(invoice.description || "Services rendered", 20, y)
      doc.text(fmt(netAmount), 190, y, { align: "right" })
    }

    // Totals
    y += 10
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

      y += 6
      doc.setTextColor("#a16207")
      doc.text("Fixed penalty", 120, y)
      doc.text(`+${fmt(pen)}`, 190, y, { align: "right" })

      y += 6
      doc.text(`Interest (${daysOverdue}d at ${RATE}% p.a.)`, 120, y)
      doc.text(`+${fmt(interest)}`, 190, y, { align: "right" })

      y += 8
      doc.setDrawColor(blue)
      doc.setLineWidth(0.5)
      doc.line(120, y, 190, y)

      y += 8
      doc.setFontSize(11)
      doc.setTextColor(blue)
      doc.setFont("helvetica", "bold")
      doc.text("TOTAL NOW OWED", 120, y)
      doc.text(fmt(total), 190, y, { align: "right" })
    } else if (!hasVat) {
      y += 8
      doc.setFontSize(11)
      doc.setTextColor(blue)
      doc.setFont("helvetica", "bold")
      doc.text("TOTAL DUE", 120, y)
      doc.text(fmt(netAmount), 190, y, { align: "right" })
    }
    // If has VAT and not overdue, total already shown above

    // Payment details box
    y += 16

    // Build payment lines
    const payLines: string[] = []
    const hasBankDetails = profile.bank_name || profile.sort_code || profile.account_number
    const hasIntlDetails = profile.swift_bic || profile.iban

    if (hasBankDetails) {
      payLines.push(`Bank: ${profile.bank_name || "—"}    Sort Code: ${profile.sort_code || "—"}    Acct: ${profile.account_number || "—"}`)
    }
    if (hasIntlDetails) {
      const intlParts: string[] = []
      if (profile.swift_bic) intlParts.push(`SWIFT/BIC: ${profile.swift_bic}`)
      if (profile.iban) intlParts.push(`IBAN: ${profile.iban}`)
      payLines.push(intlParts.join("    "))
    }
    payLines.push(`Reference: ${invoice.ref}`)
    if (profile.vat_number) payLines.push(`VAT Reg: ${profile.vat_number}`)

    const boxH = 14 + payLines.length * 5.5
    doc.setFillColor("#f1f3f6")
    doc.roundedRect(20, y, 170, boxH, 3, 3, "F")

    y += 8
    doc.setFontSize(9)
    doc.setTextColor(dark)
    doc.setFont("helvetica", "bold")
    doc.text("Payment Details", 28, y)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    for (const line of payLines) {
      y += 5.5
      doc.text(line, 28, y)
    }

    // Custom signoff
    if (profile.invoice_signoff) {
      y += 12
      doc.setFontSize(9)
      doc.setTextColor(gray)
      doc.setFont("helvetica", "italic")
      const signoffLines = doc.splitTextToSize(profile.invoice_signoff, 160)
      doc.text(signoffLines, 20, y)
      y += signoffLines.length * 5
    }

    // Footer
    const footerY = 280
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor("#94a3b8")
    doc.text("Generated by Hielda — Protecting your pay.", 105, footerY, { align: "center" })

    if (isConsumer) {
      doc.setFontSize(7)
      doc.text(`Payment terms: Payment is due within ${invoice.payment_term_days || 30} days. Invoices unpaid after this date will accrue interest at ${RATE}% per annum until settled in full.`, 105, footerY + 5, { align: "center" })
    } else if (isOverdue) {
      doc.setFontSize(7)
      doc.text("Late payment charges applied under the Late Payment of Commercial Debts (Interest) Act 1998.", 105, footerY + 5, { align: "center" })
    }

    // Output
    const pdfOutput = doc.output("arraybuffer")

    return new Response(pdfOutput, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.ref}.pdf"`,
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
