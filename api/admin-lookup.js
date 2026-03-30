// Vercel Serverless Function: Admin user lookup
// Only accessible to the admin email set in ADMIN_EMAIL env var

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ADMIN_EMAIL) {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { user_token, lookup_email } = req.body

  if (!user_token || !lookup_email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the requester's token
  const { data: { user }, error: authErr } = await supabase.auth.getUser(user_token)
  if (authErr || !user) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  // Check the requester is the admin
  if (user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Find the user being looked up by email (filtered server-side)
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  })

  // Supabase admin API doesn't support email filter directly, so search all users
  // but use a targeted approach for small user bases
  let targetUser = null
  let page = 1
  const perPage = 100
  while (!targetUser) {
    const { data: { users: batch }, error: batchErr } = await supabase.auth.admin.listUsers({ page, perPage })
    if (batchErr) return res.status(500).json({ error: batchErr.message })
    if (!batch || batch.length === 0) break
    targetUser = batch.find(u => u.email?.toLowerCase() === lookup_email.toLowerCase())
    if (batch.length < perPage) break
    page++
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'No user found with that email address' })
  }

  // Fetch all data for that user in parallel
  const [
    { data: profile },
    { data: subscription },
    { data: invoices },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', targetUser.id).single(),
    supabase.from('subscriptions').select('*').eq('user_id', targetUser.id).single(),
    supabase.from('invoices').select('*').eq('user_id', targetUser.id).order('created_at', { ascending: false }),
  ])

  // Fetch chase logs for all invoices
  let chaseLogs = []
  if (invoices?.length) {
    const invoiceIds = invoices.map(i => i.id)
    const { data: logs } = await supabase
      .from('chase_log')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('sent_at', { ascending: false })
    chaseLogs = logs || []
  }

  return res.status(200).json({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      created_at: targetUser.created_at,
      last_sign_in_at: targetUser.last_sign_in_at,
    },
    profile: profile || null,
    subscription: subscription || null,
    invoices: invoices || [],
    chase_logs: chaseLogs,
  })
}
