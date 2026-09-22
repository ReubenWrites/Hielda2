// Receipts attached to invoices: upload, read, list, include/exclude, delete.
//
// Files live in the private 'receipts' bucket at
//   <user_id>/<invoice_id>/<uuid>.<ext>
// and, while an invoice is still being created and has no id yet, at
//   <user_id>/pending/<uuid>.<ext>
// then move under the invoice once it exists (attachPendingReceipts).
// Rows in invoice_receipts say which line a file belongs to and whether it
// is appended to the invoice PDF; the PDF function reads those rows.

import { supabase } from "../supabase"

export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
const BUCKET = "receipts"

const extOf = (file) => {
  const byType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }
  return byType[file.type] || (file.name.split(".").pop() || "bin").toLowerCase()
}

export function validateReceiptFile(file) {
  if (!file) return "No file"
  if (!RECEIPT_ACCEPT.split(",").includes(file.type)) return "Use a JPG, PNG or PDF."
  if (file.size > MAX_RECEIPT_BYTES) return "That file is over 10 MB."
  return null
}

/**
 * Phone photos arrive at 4-5 MB and 4000px; a receipt is legible at 1600px
 * and ~300 KB, and the invoice PDF embeds the file as-is, so shrink before
 * upload. EXIF orientation is honoured by createImageBitmap. Anything that
 * can't be processed (old browser, odd file) uploads unchanged.
 */
export async function shrinkImage(file, maxPx = 1600, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" })
  } catch {
    return file
  }
}

/** Upload to storage. invoiceId may be "pending" during creation. */
export async function uploadReceipt(file, userId, invoiceId) {
  const upload = await shrinkImage(file)
  const path = `${userId}/${invoiceId}/${crypto.randomUUID()}.${extOf(upload)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, upload, { contentType: upload.type, upsert: false })
  if (error) throw error
  return { path, file: upload }
}

/** Read the receipt in the browser (pdf.js text, or Tesseract OCR for
 *  photos). Null when nothing useful can be found. */
export async function extractReceipt(file, onProgress) {
  const { parseReceiptFile } = await import("./parseReceipt")
  return parseReceiptFile(file, onProgress)
}

/** Move pending files under the new invoice and write their rows. */
export async function attachPendingReceipts(pending, userId, invoiceId) {
  const rows = []
  for (const r of pending) {
    const to = r.path.replace(`${userId}/pending/`, `${userId}/${invoiceId}/`)
    const { error: mvErr } = await supabase.storage.from(BUCKET).move(r.path, to)
    if (mvErr) throw mvErr
    rows.push({
      invoice_id: invoiceId,
      user_id: userId,
      line_index: r.lineIndex ?? null,
      storage_path: to,
      file_name: r.fileName,
      mime_type: r.mimeType,
      size_bytes: r.size ?? null,
      include_in_invoice: r.include !== false,
      extracted: r.extracted || null,
    })
  }
  if (rows.length) {
    const { error } = await supabase.from("invoice_receipts").insert(rows)
    if (error) throw error
  }
  return rows.length
}

/** Upload straight onto an existing invoice and record it. */
export async function addReceiptToInvoice(file, userId, invoiceId, lineIndex = null) {
  const [{ path, file: stored }, extracted] = await Promise.all([uploadReceipt(file, userId, invoiceId), extractReceipt(file)])
  const { data, error } = await supabase.from("invoice_receipts").insert({
    invoice_id: invoiceId,
    user_id: userId,
    line_index: lineIndex,
    storage_path: path,
    file_name: stored.name,
    mime_type: stored.type,
    size_bytes: stored.size,
    include_in_invoice: true,
    extracted,
  }).select().single()
  if (error) throw error
  return data
}

/** Rows for an invoice, each with a short-lived signed URL for display. */
export async function listReceipts(invoiceId) {
  const { data, error } = await supabase
    .from("invoice_receipts").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true })
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600)
  const byPath = Object.fromEntries((signed || []).map((s) => [s.path, s.signedUrl]))
  return rows.map((r) => ({ ...r, url: byPath[r.storage_path] || null }))
}

export async function setReceiptIncluded(id, include) {
  const { error } = await supabase.from("invoice_receipts").update({ include_in_invoice: include }).eq("id", id)
  if (error) throw error
}

export async function deleteReceipt(row) {
  const { error } = await supabase.from("invoice_receipts").delete().eq("id", row.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([row.storage_path])
}

/** Remove the files behind every receipt on these invoices. The rows
 *  cascade when the invoice is deleted; storage objects do not, so call
 *  this first. Best-effort: a failure leaves an orphaned file, not a
 *  half-deleted invoice. */
export async function removeInvoiceReceiptFiles(invoiceIds) {
  try {
    const { data } = await supabase.from("invoice_receipts").select("storage_path").in("invoice_id", invoiceIds)
    const paths = (data || []).map((r) => r.storage_path)
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  } catch (e) {
    console.error("receipt files not removed:", e?.message)
  }
}

/** Discard a pending (not yet attached) upload. */
export async function discardPendingReceipt(path) {
  await supabase.storage.from(BUCKET).remove([path])
}
