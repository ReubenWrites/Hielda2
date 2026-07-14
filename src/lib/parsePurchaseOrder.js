// Client-side purchase-order parsing.
//
// Why no AI: the PDF never leaves the browser (a genuine privacy line for
// commercial documents) and there's no per-use cost. Heuristics are tuned
// for the common "table of line items with a trailing amount column"
// layout that procurement systems generate. Everything lands in the
// editable create form, so imperfect extraction degrades to a head start
// rather than a wrong invoice.
//
// extractPdfLines() is the impure half (pdf.js, lazy-loaded);
// parsePurchaseOrder() is pure and unit-tested.

/** Lazy-load pdf.js and return the text of every page as an array of
 *  visual lines (grouped by y-coordinate, ordered left to right). */
export async function extractPdfLines(file) {
  const pdfjs = await import("pdfjs-dist")
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // Group items into visual lines by rounded y; sort each line by x.
    const rows = new Map()
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3 // 3pt tolerance
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y).push({ x: item.transform[4], str: item.str })
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]) // top → bottom
    for (const [, items] of sorted) {
      const line = items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim()
      if (line) lines.push(line)
    }
  }
  return lines
}

// ── Pure parsing helpers ─────────────────────────────────────────────────

const AMOUNT_RE = /(?:£|GBP\s?)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\s*$/
// Words that mean a trailing-amount line is a summary row, not a line item.
const SUMMARY_RE = /\b(sub\s?-?total|total|vat|tax|carriage|delivery|postage|shipping|discount|balance|amount\s+due|net|gross|grand)\b/i
const PO_RE = /\b(?:p\.?o\.?|purchase\s+order|order|our\s+ref(?:erence)?|ref(?:erence)?)\s*(?:no\.?|number|#)?\s*[:#.-]?\s*([A-Z0-9][A-Z0-9\/_-]{2,})/i
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const toNumber = (s) => parseFloat(s.replace(/,/g, ""))

/** Normalise UK-style dates to YYYY-MM-DD. Returns null if not a date. */
export function parseUkDate(str) {
  if (!str) return null
  const s = str.trim()
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = (Number(y) > 70 ? "19" : "20") + y
    const day = Number(d), month = Number(mo)
    if (day > 31 || month > 12) return null
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/)
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!month) return null
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`
  }
  return null
}

/** Strip trailing numeric columns (qty / unit price / totals) and any
 *  leading item-number column from a line-item description. */
function cleanDescription(line) {
  let desc = line
  // Remove ALL trailing amount/qty columns, one at a time.
  for (;;) {
    const next = desc.replace(/(?:£|GBP\s?)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*$/, "")
    if (next === desc) break
    desc = next.trimEnd()
  }
  // Leading row number ("1", "1.", "01") — but keep leading codes like "AB-12".
  desc = desc.replace(/^\d{1,3}\.?\s+/, "")
  return desc.replace(/\s{2,}/g, " ").trim()
}

/**
 * Parse visual lines from a purchase order into invoice-form fields.
 * Returns { poNumber, poDate, clientName, lineItems: [{description, amount}] }
 * — any field may be null/empty when not confidently found.
 */
export function parsePurchaseOrder(lines) {
  const result = { poNumber: null, poDate: null, clientName: null, lineItems: [] }
  if (!lines?.length) return result

  // ── PO / reference number ──
  for (const line of lines) {
    const m = line.match(PO_RE)
    if (m) {
      // Guard against matching a pure date or a pure amount as the ref.
      const candidate = m[1]
      if (!parseUkDate(candidate) && !/^\d+\.\d{2}$/.test(candidate)) {
        result.poNumber = candidate
        break
      }
    }
  }

  // ── Date: prefer a line that labels itself as the order date ──
  const dateFrom = (line) => {
    const m = line.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/) ||
      line.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4})/)
    return m ? parseUkDate(m[1]) : null
  }
  for (const line of lines) {
    if (/\b(order\s+date|date\s+of\s+order|po\s+date|issued?)\b/i.test(line)) {
      const d = dateFrom(line)
      if (d) { result.poDate = d; break }
    }
  }
  if (!result.poDate) {
    for (const line of lines) {
      const d = dateFrom(line)
      if (d) { result.poDate = d; break }
    }
  }

  // ── Buyer name: the letterhead — first plausible line of the document
  // that isn't a document-type heading. Low confidence by nature; the
  // form field is right there to correct. ──
  for (const line of lines.slice(0, 6)) {
    if (/^(purchase\s+order|order\s+confirmation|p\.?o\.?)$/i.test(line.trim())) continue
    if (/^page\s+\d/i.test(line)) continue
    if (dateFrom(line) && line.length < 24) continue
    if (line.length >= 3 && line.length <= 60 && /[A-Za-z]{3}/.test(line)) {
      result.clientName = line.trim()
      break
    }
  }

  // ── Line items: lines ending in an amount that aren't summary rows ──
  for (const line of lines) {
    const m = line.match(AMOUNT_RE)
    if (!m) continue
    if (SUMMARY_RE.test(line)) continue
    const amount = toNumber(m[1])
    if (!(amount > 0)) continue
    const description = cleanDescription(line)
    // A real line item has some words in it — a bare amount is a column
    // fragment or page furniture.
    if (description.length < 3 || !/[A-Za-z]{2}/.test(description)) continue
    result.lineItems.push({ description, amount: String(amount.toFixed(2)) })
  }

  return result
}
