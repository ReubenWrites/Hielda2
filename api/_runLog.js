// Wraps a cron handler so every run leaves a row in webhook_log
// (source "cron:<name>") with the status it returned and its JSON result.
//
// Vercel Hobby keeps no runtime logs, so without this a cron that stopped
// firing, or started returning 401/500, would be indistinguishable from
// one with nothing to do. The log write is best-effort and never alters
// the response.

import { createClient } from '@supabase/supabase-js'

export function withRunLog(name, fn) {
  return async (req, res) => {
    let body
    const origJson = res.json.bind(res)
    res.json = (b) => { body = b; return origJson(b) }
    try {
      return await fn(req, res)
    } catch (e) {
      body = body || { error: e?.message }
      throw e
    } finally {
      try {
        const url = process.env.VITE_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (url && key) {
          const status = res.statusCode || 0
          await createClient(url, key).from('webhook_log').insert({
            source: `cron:${name}`,
            event_type: typeof req.query?.mode === 'string' ? req.query.mode : null,
            outcome: status >= 400 ? 'error' : 'ok',
            detail: body ? JSON.stringify(body).slice(0, 500) : null,
            status,
          })
        }
      } catch {}
    }
  }
}
