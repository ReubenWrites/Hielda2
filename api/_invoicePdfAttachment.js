// Helper for the Vercel email functions to attach the invoice PDF to
// outgoing emails. Calls the Supabase Edge Function that already builds
// the PDF (single source of truth for layout/branding), base64-encodes
// the bytes, returns a Resend attachment object.
//
// Graceful degradation: if the PDF generation fails for any reason
// (Edge Function down, malformed invoice, etc) we return null and the
// caller sends the email without an attachment instead of failing the
// whole send. Better to deliver the email body than to fail loudly.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function getInvoicePdfAttachment(invoiceId, ref) {
  if (!invoiceId || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-invoice-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    if (!res.ok) {
      console.warn(`[pdf-attachment] PDF generation returned ${res.status} for invoice ${invoiceId}`)
      return null
    }
    const buf = await res.arrayBuffer()
    return {
      filename: `invoice-${ref || invoiceId}.pdf`,
      content: Buffer.from(buf).toString('base64'),
    }
  } catch (e) {
    console.warn(`[pdf-attachment] Failed to fetch PDF for invoice ${invoiceId}:`, e.message)
    return null
  }
}
