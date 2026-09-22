// Read a receipt in the browser - no API, nothing leaves the device.
//
// PDFs (Uber / Trainline / Amazon emails saved as PDF) have real text, read
// with pdf.js like the purchase-order import. Photos go through Tesseract
// (open-source OCR, loaded on first use). Either way we end up with lines
// of text and pick out the total, the date and a vendor with heuristics.
// Anything we can't find is null and the user types it; a receipt still
// attaches fine.

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec"
const MONTH_INDEX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }
const KNOWN_VENDORS = [
  "uber", "bolt", "addison lee", "free now", "tfl", "transport for london", "trainline", "lner", "gwr",
  "avanti", "southeastern", "southern", "thameslink", "northern", "national rail", "national express",
  "amazon", "argos", "screwfix", "b&q", "wickes", "currys", "apple", "tesco", "sainsbury", "asda",
  "premier inn", "travelodge", "airbnb", "easyjet", "ryanair", "british airways", "shell", "bp", "esso",
]

const pad = (n) => String(n).padStart(2, "0")

export function findAmount(lines) {
  const money = (s) => {
    const out = []
    const re = /(?:£|GBP\s?)?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/g
    let m
    while ((m = re.exec(s))) {
      const v = parseFloat(m[1].replace(/,/g, "") + "." + m[2])
      if (v > 0 && v < 100000) out.push(v)
    }
    return out
  }
  // A "total" line wins; among several, the last one (grand total comes last).
  const totalLines = lines.filter((l) => /\b(grand\s+total|total\s+(paid|charged|amount|fare|due)|amount\s+(paid|charged|due)|you\s+paid|total)\b/i.test(l) && !/sub\s*-?\s*total|total\s+savings|vat\s+total/i.test(l))
  for (const l of [...totalLines].reverse()) {
    const v = money(l)
    if (v.length) return v[v.length - 1]
  }
  // Otherwise the largest amount on the receipt - subtotals and VAT lines
  // are always smaller than what was paid.
  const all = lines.flatMap(money)
  return all.length ? Math.max(...all) : null
}

export function findDate(lines) {
  const text = lines.join("\n")
  let m
  if ((m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/))) return `${m[1]}-${m[2]}-${m[3]}`
  if ((m = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2}|\d{2})\b/))) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${pad(m[2])}-${pad(m[1])}`
  }
  const re1 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})[a-z]*\\.?,?\\s+(20\\d{2})\\b`, "i")
  if ((m = text.match(re1))) return `${m[3]}-${pad(MONTH_INDEX[m[2].toLowerCase()])}-${pad(m[1])}`
  const re2 = new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, "i")
  if ((m = text.match(re2))) return `${m[3]}-${pad(MONTH_INDEX[m[1].toLowerCase()])}-${pad(m[2])}`
  return null
}

export function findVendor(lines) {
  const joined = lines.join(" ").toLowerCase()
  for (const v of KNOWN_VENDORS) {
    if (joined.includes(v)) return v.replace(/\b\w/g, (c) => c.toUpperCase()).replace("Tfl", "TfL").replace("Lner", "LNER").replace("Gwr", "GWR").replace("Bp", "BP")
  }
  // First short line with letters and no money in it, skipping boilerplate.
  const cand = lines.find((l) => /[a-z]{3,}/i.test(l) && !/\d+\.\d{2}/.test(l) && !/receipt|invoice|thank|order|tax|vat|date|total|payment|paid|card|visa|mastercard/i.test(l) && l.trim().length <= 40)
  return cand ? cand.trim() : null
}

function niceDate(iso) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

export function parseReceiptLines(lines) {
  const clean = lines.map((l) => String(l).replace(/\s+/g, " ").trim()).filter(Boolean)
  const amount = findAmount(clean)
  const date = findDate(clean)
  const vendor = findVendor(clean)
  const d = niceDate(date)
  const description = vendor ? `${vendor}${d ? `, ${d}` : ""}` : d ? `Receipt, ${d}` : null
  // A vendor guess on its own is worthless (it's just the first line of
  // whatever this was); only report when there's a figure or a date.
  if (amount == null && !date) return null
  return { vendor, amount, date, description, currency: "GBP" }
}

/** Text lines from a PDF or an image. Both loaders are lazy: neither is
 *  in the main bundle, and OCR (a few MB) only downloads on first use. */
export async function receiptToLines(file, onProgress) {
  if (file.type === "application/pdf") {
    const { extractPdfLines } = await import("./parsePurchaseOrder")
    return extractPdfLines(file)
  }
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("eng", 1, {
    logger: (m) => { if (onProgress && m.status === "recognizing text") onProgress(m.progress) },
  })
  try {
    const { data } = await worker.recognize(file)
    return (data.text || "").split("\n")
  } finally {
    await worker.terminate()
  }
}

export async function parseReceiptFile(file, onProgress) {
  try {
    const lines = await receiptToLines(file, onProgress)
    return parseReceiptLines(lines)
  } catch {
    return null
  }
}
