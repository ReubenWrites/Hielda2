import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Trash2, Download, Plus, Inbox, MoreHorizontal, CreditCard, PartyPopper, FileText, X } from "lucide-react"
import { colors as c, CHASE_STAGES, getRate } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, round2, outstanding, chargeableExtras, todayStr } from "../utils"
import { Card, Badge, Btn, StatCard, useConfirm, useToast } from "./ui"
import { supabase } from "../supabase"
import { trackEvent } from "../posthog"
import EmailQueue from "./EmailQueue"
import s from "./Dashboard.module.css"

// CSV escaping per RFC 4180: any value containing comma, quote, or
// newline needs to be quoted and embedded quotes doubled.
function csvCell(v) {
  if (v == null) return ""
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function Dashboard({ invs, isMobile, onUpdate, profile }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)

  // One-shot celebration after marking an invoice paid (set by Detail).
  // The happiest moment in the product — and the natural moment to ask
  // for a referral. Read-and-clear so it never shows twice.
  const [celebration, setCelebration] = useState(() => {
    try {
      const raw = sessionStorage.getItem("hielda_paid_celebration")
      if (!raw) return null
      sessionStorage.removeItem("hielda_paid_celebration")
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (celebration) trackEvent("referral_nudge_shown", { extra: celebration.extra })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const needsPaymentDetails = !profile?.sort_code || !profile?.account_number

  // Server-backed invoice drafts (saved via "Save & finish later" on the
  // create form). Fetched here so unfinished invoices are visible and
  // resumable instead of living in an invisible localStorage slot.
  const [drafts, setDrafts] = useState([])
  useEffect(() => {
    if (!profile?.id) return
    ;(async () => {
      const { data } = await supabase
        .from("invoice_drafts")
        .select("id, client_name, amount, updated_at")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(10)
      setDrafts(data || [])
    })()
  }, [profile?.id, invs])

  const deleteDraft = async (id, e) => {
    e.stopPropagation()
    if (!(await confirm({
      title: "Delete this draft?",
      message: "The unfinished invoice will be discarded. This can't be undone.",
      confirmLabel: "Delete draft",
      cancelLabel: "Keep it",
      danger: true,
    }))) return
    await supabase.from("invoice_drafts").delete().eq("id", id)
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id)
      // Deleting the last draft removes the Drafts pill — fall back to All
      // rather than stranding the user on an empty, unreachable filter.
      if (next.length === 0) setStatusFilter("all")
      return next
    })
  }

  const draftAge = (dateStr) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (mins < 60) return `${Math.max(1, mins)}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const { overdue, pending, paid, disputed, totExtra, totExtraWon, totOwed, totPaid, partPaidCount } = useMemo(() => {
    const overdue = invs.filter((i) => i.status === "overdue")
    const pending = invs.filter((i) => i.status === "pending")
    const disputed = invs.filter((i) => i.status === "disputed")
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const paid = invs.filter((i) => i.status === "paid" && (!i.paid_date || new Date(i.paid_date) >= cutoff))

    // chargeableExtras is zero for no-fines and consumer invoices and
    // computes interest on the outstanding balance — so waived fines and
    // partial payments are reflected honestly here, not just on Detail.
    const totExtra = round2(overdue.reduce((s, i) => s + chargeableExtras(i), 0))

    const totOwed = round2(overdue.reduce((s, i) => s + outstanding(i) + chargeableExtras(i), 0))

    // Late charges actually COLLECTED, not just claimed: any cash received
    // above an invoice's face total is money Hielda's fines and interest
    // brought in. Windowed to the same 90 days as the Paid card it sits
    // under — the lifetime figure lives in the app header.
    const totExtraWon = round2(paid.reduce((s, i) => {
      const face = Number(i.total_with_vat) || Number(i.amount)
      return s + Math.max(0, (Number(i.amount_paid) || 0) - face)
    }, 0))

    // "Paid" counts money actually received: fully paid invoices in the
    // 90-day window PLUS part-payments sitting on still-open invoices.
    // Without the second term a £1,000 part-payment on a £3,000 invoice
    // appeared nowhere in the paid figures.
    const openWithPartPayment = invs.filter(
      (i) => i.status !== "paid" && (Number(i.amount_paid) || 0) > 0
    )
    const partPaidCount = openWithPartPayment.length
    // Real cash received, not face values: a paid invoice with a payment
    // ledger contributes what actually arrived (charges collected push it
    // above face; a settled-short invoice sits below). Invoices marked
    // paid without any recorded payment fall back to face value.
    const totPaid = round2(
      paid.reduce((s, i) => s + ((Number(i.amount_paid) || 0) > 0 ? Number(i.amount_paid) : Number(i.amount)), 0) +
      openWithPartPayment.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0)
    )

    return { overdue, pending, paid, disputed, totExtra, totExtraWon, totOwed, totPaid, partPaidCount }
  }, [invs])

  // One client, one debt. Groups open invoices by client email (falling
  // back to name) so a client with several outstanding invoices can be
  // seen — and chased — as a single consolidated position. Only shown for
  // clients with 2+ open invoices; a single invoice is chased normally.
  const clientGroups = useMemo(() => {
    const open = invs.filter((i) => i.status === "overdue" || i.status === "pending")
    const byClient = new Map()
    for (const i of open) {
      const key = (i.client_email || i.client_name || "").trim().toLowerCase()
      if (!key) continue
      if (!byClient.has(key)) byClient.set(key, [])
      byClient.get(key).push(i)
    }
    return Array.from(byClient.values())
      .filter((group) => group.length >= 2)
      .map((group) => {
        const total = round2(group.reduce((sum, i) => sum + outstanding(i) + chargeableExtras(i), 0))
        const extras = round2(group.reduce((sum, i) => sum + chargeableExtras(i), 0))
        const overdueCount = group.filter((i) => i.status === "overdue").length
        const oldestLate = Math.max(0, ...group.map((i) => (i.status === "overdue" ? daysLate(i.due_date) : 0)))
        return {
          name: group[0].client_name || group[0].client_email,
          email: group[0].client_email,
          invoices: group,
          total,
          extras,
          overdueCount,
          oldestLate,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [invs])

  const [sendingStatement, setSendingStatement] = useState("")

  // Chasing list: collapsed to the summary bar by default; the choice
  // sticks per browser. localStorage can throw (private windows, blocked
  // site data) so reads and writes are best-effort.
  const [chasingOpen, setChasingOpen] = useState(() => {
    try {
      return localStorage.getItem("hielda_chasing_open") === "1"
    } catch {
      return false
    }
  })
  const toggleChasingOpen = () => {
    setChasingOpen((v) => {
      const next = !v
      try { localStorage.setItem("hielda_chasing_open", next ? "1" : "0") } catch {}
      return next
    })
  }

  // When each client last received a consolidated statement — shown on the
  // client row so a second send is a decision, not an accident. Alongside
  // it, when each client's ledger last changed: a payment recorded after
  // the last statement means their copy of the books is stale, so the
  // button flips to a primary "Send updated statement".
  const [statementLog, setStatementLog] = useState({})
  const [paymentLog, setPaymentLog] = useState({})
  useEffect(() => {
    if (!profile?.id || clientGroups.length === 0) return
    ;(async () => {
      const [{ data: stmts }, { data: pays }] = await Promise.all([
        supabase
          .from("chase_log")
          .select("email_to, sent_at")
          .eq("user_id", profile.id)
          .eq("status", "statement_sent")
          .order("sent_at", { ascending: false })
          .limit(100),
        supabase
          .from("invoice_payments")
          .select("created_at, invoices(client_email)")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ])
      const byEmail = {}
      for (const row of stmts || []) {
        const key = (row.email_to || "").toLowerCase()
        if (key && !byEmail[key]) byEmail[key] = row.sent_at
      }
      setStatementLog(byEmail)
      const payByEmail = {}
      for (const row of pays || []) {
        const key = (row.invoices?.client_email || "").toLowerCase()
        if (key && !payByEmail[key]) payByEmail[key] = row.created_at
      }
      setPaymentLog(payByEmail)
    })()
  }, [profile?.id, invs, clientGroups.length])

  const daysAgo = (ts) => {
    const d = Math.floor((Date.now() - new Date(ts).getTime()) / 864e5)
    return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`
  }

  // Split-payment flow: one lump sum from a client, allocated across
  // their open invoices. Hielda suggests the fee-optimal split — fill
  // invoices that aren't yet due first (a pre-due settlement never
  // attracts charges), then oldest debt — and every line stays editable.
  const [splitModal, setSplitModal] = useState(null)

  const invoiceOwed = (i, paidOn) => {
    // What would fully close this invoice: face remaining, plus accrued
    // charges when it's already overdue relative to the payment date.
    const faceRem = Math.max(0, round2(Number(i.amount) - (Number(i.amount_paid) || 0)))
    return paidOn <= i.due_date ? faceRem : round2(outstanding(i) + chargeableExtras(i))
  }

  const suggestSplit = (group, total, paidOn) => {
    let left = round2(total)
    const alloc = {}
    const faceRemOf = (i) => Math.max(0, round2(Number(i.amount) - (Number(i.amount_paid) || 0)))
    // Pre-due invoices smallest-first: every one fully settled before its
    // due date kills its entire penalty, so the greedy that settles the
    // most invoices saves the most fees. (Ted's £1,000 proves it: by due
    // date it all lands on the big invoice; smallest-first settles
    // INV-0010 clean and still keeps INV-0008 in the £40 tier.)
    const preDue = group.invoices.filter((i) => paidOn <= i.due_date).sort((a, b) => faceRemOf(a) - faceRemOf(b))
    const overdue = group.invoices.filter((i) => paidOn > i.due_date).sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    for (const i of [...preDue, ...overdue]) {
      if (left <= 0) break
      const owedFull = invoiceOwed(i, paidOn)
      const faceRem = Math.max(0, round2(Number(i.amount) - (Number(i.amount_paid) || 0)))
      // Take the whole debt when the money stretches to it; otherwise cap
      // at the face remaining so a partial never strands an invoice in
      // the odd state of "face covered, charges dangling".
      const a = left >= owedFull ? owedFull : Math.min(left, faceRem)
      if (a > 0) {
        alloc[i.id] = String(a)
        left = round2(left - a)
      }
    }
    return alloc
  }

  const openSplit = (group) => {
    setSplitModal({ group, amount: "", date: todayStr(), alloc: {}, saving: false })
  }

  const updateSplitAmount = (field, value) => {
    setSplitModal((m) => {
      if (!m) return m
      const next = { ...m, [field]: value }
      const total = parseFloat(next.amount)
      // Re-suggest whenever the headline amount or date changes — manual
      // per-invoice edits persist until then.
      if (total > 0 && next.date) next.alloc = suggestSplit(next.group, total, next.date)
      return next
    })
  }

  const splitAllocated = (m) => round2(m.group.invoices.reduce((s, i) => s + (parseFloat(m.alloc[i.id]) || 0), 0))

  const commitSplit = async () => {
    const m = splitModal
    if (!m || m.saving) return
    const total = parseFloat(m.amount)
    if (!total || total <= 0) return
    if (m.date > todayStr()) {
      toast.error("The payment date can't be in the future.")
      return
    }
    const entries = m.group.invoices
      .map((i) => ({ i, a: round2(parseFloat(m.alloc[i.id]) || 0) }))
      .filter((e) => e.a > 0)
    const sum = round2(entries.reduce((s, e) => s + e.a, 0))
    if (Math.abs(sum - total) > 0.005) {
      toast.error(`The split (${fmt(sum)}) doesn't add up to the payment (${fmt(total)}) — ${fmt(round2(total - sum))} unallocated.`)
      return
    }
    for (const { i, a } of entries) {
      if (a > invoiceOwed(i, m.date) + 0.005) {
        toast.error(`${i.ref}: ${fmt(a)} is more than the ${fmt(invoiceOwed(i, m.date))} owed on it.`)
        return
      }
    }
    setSplitModal((p) => ({ ...p, saving: true }))
    try {
      for (const { i, a } of entries) {
        const { error: ledgerErr } = await supabase.from("invoice_payments").insert({
          invoice_id: i.id,
          user_id: profile.id,
          amount: a,
          paid_on: m.date,
        })
        if (ledgerErr) throw ledgerErr
        const newPaid = round2((Number(i.amount_paid) || 0) + a)
        const updates = { amount_paid: newPaid }
        if (m.date <= i.due_date) {
          updates.paid_before_due = round2((Number(i.paid_before_due) || 0) + a)
        }
        if (a >= invoiceOwed(i, m.date) - 0.005) {
          updates.status = "paid"
          updates.paid_date = m.date
          updates.chase_stage = null
        }
        const { error: invErr } = await supabase.from("invoices").update(updates).eq("id", i.id)
        if (invErr) throw invErr
      }
      trackEvent("payment_split_recorded", { invoices: entries.length, total })
      toast.success(`Recorded ${fmt(total)} across ${entries.length} invoice${entries.length !== 1 ? "s" : ""}`)
      setSplitModal(null)
      onUpdate()
    } catch (e) {
      // Writes are sequential, so a failure can land part-way — refresh
      // and say so plainly rather than pretending it's all-or-nothing.
      toast.error("Failed part-way through recording: " + e.message + ". Check the payment history before retrying.")
      setSplitModal(null)
      onUpdate()
    }
  }

  // Statement flow: preview first, send second. The server builds the
  // exact email (preview: true returns it without sending), the modal
  // shows it in an iframe, and only "Send now" commits.
  const [stmtPreview, setStmtPreview] = useState(null)

  const fetchStatement = async (group, opts, preview) => {
    const session = await supabase.auth.getSession()
    const res = await fetch("/api/send-chase-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_ids: group.invoices.map((i) => i.id),
        include_payments: opts.includePayments,
        include_settled: opts.includeSettled,
        preview,
        user_token: session.data.session?.access_token,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Request failed")
    return data
  }

  const openStatement = async (group) => {
    setSendingStatement(group.email)
    try {
      const opts = { includePayments: true, includeSettled: true }
      const data = await fetchStatement(group, opts, true)
      setStmtPreview({ group, ...opts, ...data })
    } catch (e) {
      toast.error("Failed to build statement: " + e.message)
    }
    setSendingStatement("")
  }

  // Flip one preview option and rebuild the preview from the server so
  // what's on screen is always exactly what would be sent.
  const toggleStatementOpt = async (key) => {
    if (!stmtPreview || stmtPreview.loading || stmtPreview.sending) return
    const opts = {
      includePayments: stmtPreview.includePayments,
      includeSettled: stmtPreview.includeSettled,
      [key]: !stmtPreview[key],
    }
    setStmtPreview((p) => ({ ...p, loading: true }))
    try {
      const data = await fetchStatement(stmtPreview.group, opts, true)
      setStmtPreview((p) => ({ ...p, ...data, ...opts, loading: false }))
    } catch (e) {
      toast.error("Failed to rebuild preview: " + e.message)
      setStmtPreview((p) => (p ? { ...p, loading: false } : p))
    }
  }

  // Download the statement as a PDF instead of emailing it — for users
  // who'd rather send it themselves, from their own address.
  const downloadStatementPdf = async () => {
    if (!stmtPreview || stmtPreview.sending || stmtPreview.loading) return
    setStmtPreview((p) => ({ ...p, loading: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-statement-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          invoice_ids: stmtPreview.group.invoices.map((i) => i.id),
          include_payments: stmtPreview.includePayments,
          include_settled: stmtPreview.includeSettled,
          rate: getRate(),
        }),
      })
      if (!res.ok) throw new Error(`PDF generation failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `statement-${stmtPreview.group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${todayStr()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      trackEvent("statement_pdf_downloaded", { invoices: stmtPreview.group.invoices.length })
    } catch (e) {
      toast.error("Couldn't generate the PDF: " + e.message)
    }
    setStmtPreview((p) => (p ? { ...p, loading: false } : p))
  }

  const confirmSendStatement = async () => {
    if (!stmtPreview || stmtPreview.sending) return
    setStmtPreview((p) => ({ ...p, sending: true }))
    try {
      const data = await fetchStatement(
        stmtPreview.group,
        { includePayments: stmtPreview.includePayments, includeSettled: stmtPreview.includeSettled },
        false
      )
      trackEvent("statement_sent", { invoice_count: data.invoice_count, total: data.total })
      toast.success(`Statement sent to ${data.email_to} — ${fmt(data.total)} across ${data.invoice_count} invoices`)
      setStmtPreview(null)
      onUpdate()
    } catch (e) {
      toast.error("Failed to send statement: " + e.message)
      setStmtPreview((p) => (p ? { ...p, sending: false } : p))
    }
  }

  const filtered = useMemo(() => {
    let result = invs

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(i => i.status === statusFilter)
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) =>
        [i.client_name, i.ref, i.description, String(i.amount), i.client_email].some(
          (s) => s && s.toLowerCase().includes(q)
        )
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let va, vb
      if (sortBy === "amount") { va = Number(a.amount); vb = Number(b.amount) }
      else if (sortBy === "due_date") { va = a.due_date; vb = b.due_date }
      else if (sortBy === "client_name") { va = (a.client_name || "").toLowerCase(); vb = (b.client_name || "").toLowerCase() }
      else { va = a.created_at; vb = b.created_at }
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [invs, search, statusFilter, sortBy, sortDir])

  const toggleSort = (col) => {
    if (sortBy === col) { setSortDir(d => d === "asc" ? "desc" : "asc") }
    else { setSortBy(col); setSortDir("asc") }
  }

  const SortIcon = ({ col }) => (
    <span className={sortBy === col ? s.sortActive : s.sortInactive}>
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
    </span>
  )

  useEffect(() => { setSelected(new Set()) }, [invs])

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(i => i.id)))
    }
  }

  // Bulk mark-paid records the money, not just the status: each invoice
  // gets a ledger payment for its full outstanding balance (including
  // accrued charges) dated today. Blind status-flips used to make cash
  // vanish from the books — an invoice with a prior part-payment would
  // show as "settled short" with money written off that was really paid.
  const bulkMarkPaid = async () => {
    if (!(await confirm({
      title: `Mark ${selected.size} ${selected.size === 1 ? "invoice" : "invoices"} as paid?`,
      message: "Each will be recorded as paid in full today — a payment is logged for the outstanding balance including any late charges. If a client actually paid a different amount, use Record payment on that invoice instead.",
      confirmLabel: "Mark as paid",
      cancelLabel: "Cancel",
    }))) return
    setBulkLoading(true)
    try {
      const today = todayStr()
      for (const id of Array.from(selected)) {
        const i = invs.find((x) => x.id === id)
        if (!i || i.status === "paid") continue
        const owed = round2(outstanding(i) + chargeableExtras(i))
        if (owed > 0) {
          const { error: ledgerErr } = await supabase.from("invoice_payments").insert({
            invoice_id: i.id,
            user_id: profile.id,
            amount: owed,
            paid_on: today,
          })
          if (ledgerErr) throw ledgerErr
        }
        const { error } = await supabase
          .from("invoices")
          .update({
            amount_paid: round2((Number(i.amount_paid) || 0) + owed),
            status: "paid",
            paid_date: today,
            chase_stage: null,
          })
          .eq("id", i.id)
        if (error) throw error
      }
      setSelected(new Set())
      onUpdate()
    } catch (e) {
      alert("Failed part-way through: " + e.message + " — check the invoices before retrying.")
      onUpdate()
    }
    setBulkLoading(false)
  }

  const bulkDelete = async () => {
    if (!(await confirm({
      title: `Delete ${selected.size} ${selected.size === 1 ? "invoice" : "invoices"}?`,
      message: "This cannot be undone. Any chase emails sent for these invoices will also be removed from your history.",
      confirmLabel: `Delete ${selected.size}`,
      cancelLabel: "Keep them",
      danger: true,
    }))) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selected)
      const { error } = await supabase
        .from("invoices")
        .delete()
        .in("id", ids)
      if (error) throw error
      setSelected(new Set())
      onUpdate()
    } catch (e) {
      alert("Failed to delete: " + e.message)
    }
    setBulkLoading(false)
  }

  return (
    <div>
      <div className={s.header}>
        <h1 className={s.title}>Dashboard</h1>
        <p className={s.subtitle}>
          Your payment overview for {formatDate(new Date())}
        </p>
      </div>

      {celebration && (
        <div className={s.banner} data-celebrate="true">
          <div className={s.bannerBody}>
            <span className={s.bannerIcon}><PartyPopper size={18} /></span>
            <span className={s.bannerText}>
              <strong>{celebration.client} paid — {fmt(celebration.amount + celebration.extra)}.</strong>
              {celebration.extra > 0 && <> That includes {fmt(celebration.extra)} in late charges Hielda chased for you.</>}
              {" "}Know another freelancer who waits to get paid? You both get £10 off.
            </span>
          </div>
          <div className={s.bannerActions}>
            <Btn sz="sm" onClick={() => { trackEvent("referral_nudge_clicked"); navigate("/referrals") }}>Share Hielda</Btn>
            <button
              onClick={() => setCelebration(null)}
              className={s.dismissBtn}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {needsPaymentDetails && !dismissedBanner && (
        <div className={s.banner}>
          <div className={s.bannerBody}>
            <span className={s.bannerIcon}><CreditCard size={18} /></span>
            <span className={s.bannerText}>
              Add your payment details so clients know where to pay.
            </span>
          </div>
          <div className={s.bannerActions}>
            <Btn sz="sm" onClick={() => navigate("/settings")}>Add now</Btn>
            <button
              onClick={() => setDismissedBanner(true)}
              className={s.dismissBtn}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className={s.statsGrid}>
        {/* Pending leads as the quiet card; the two money-in-motion cards
            sit together. Every card carries a nested footer mini-card so
            the row stays flush: Pending shows the next due date, the other
            two carry the "Extra by Hielda" split — charges being claimed
            under Being chased, charges actually collected under Paid. */}
        {(() => {
          const nextDue = pending.length > 0
            ? [...pending].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0]
            : null
          return (
            <>
              {/* outstanding() so a part-paid pending invoice isn't double
                  counted — its paid slice lives in the Paid card. */}
              <StatCard
                label="Pending"
                value={fmt(round2(pending.reduce((s, i) => s + outstanding(i), 0)))}
                sub={`${pending.length} not yet due`}
                color="var(--acl)"
                borderColor="var(--acl)"
                quiet
                footer={{
                  label: "Next due",
                  value: nextDue ? `${formatDate(nextDue.due_date)} · ${fmt(round2(outstanding(nextDue)))}` : "none scheduled",
                  color: "var(--acl)",
                  muted: !nextDue,
                }}
              />
              <StatCard
                label={overdue.some((i) => i.auto_chase !== false) ? "Being chased" : "Overdue"}
                value={fmt(totOwed)}
                sub={(() => {
                  const quiet = overdue.filter((i) => i.auto_chase === false).length
                  const base = `${overdue.length} invoice${overdue.length !== 1 ? "s" : ""}`
                  return quiet > 0 && quiet < overdue.length ? `${base} · ${quiet} not chased` : base
                })()}
                color="var(--or)"
                borderColor="var(--or)"
                footer={{
                  label: "Extra by Hielda",
                  sub: "penalties + interest",
                  value: totExtra > 0 ? `+${fmt(totExtra)}` : "none accruing",
                  color: "var(--go)",
                  muted: totExtra === 0,
                }}
              />
              <StatCard
                label="Paid (90 days)"
                value={fmt(totPaid)}
                sub={`${paid.length} invoice${paid.length !== 1 ? "s" : ""}${partPaidCount > 0 ? ` + ${partPaidCount} part-paid` : ""}`}
                color="var(--ac)"
                borderColor="var(--ac)"
                footer={{
                  label: "Extra claimed by Hielda",
                  sub: "late charges collected",
                  value: totExtraWon > 0 ? `+${fmt(totExtraWon)}` : "none yet",
                  color: "var(--gn)",
                  muted: totExtraWon === 0,
                }}
              />
            </>
          )
        })()}
      </div>

      {overdue.length > 0 && (() => {
        // Summary bar is the collapsed state: count, client(s), the range
        // of overdueness, and the total. The chevron expands the full
        // list — a strict column grid (everything centred, money
        // right-aligned so the pennies stack) — and the choice sticks
        // per browser.
        const sorted = [...overdue].sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
        const lates = sorted.map((i) => daysLate(i.due_date))
        const minLate = Math.min(...lates)
        const maxLate = Math.max(...lates)
        const names = [...new Set(sorted.map((i) => i.client_name || "Client"))]
        const clientLabel = names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`
        return (
        <div className={s.chasingSection}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div
              className={s.chaseSumBar}
              role="button"
              tabIndex={0}
              aria-expanded={chasingOpen}
              onClick={toggleChasingOpen}
              onKeyDown={(e) => { if (e.key === "Enter") toggleChasingOpen() }}
            >
              {(() => {
                const nChased = overdue.filter((i) => i.auto_chase !== false).length
                const nQuiet = overdue.length - nChased
                const label = nChased === 0
                  ? `${overdue.length} overdue invoice${overdue.length !== 1 ? "s" : ""} — chasing off`
                  : `Hielda is chasing ${nChased} invoice${nChased !== 1 ? "s" : ""}${nQuiet > 0 ? ` · ${nQuiet} not chased` : ""}`
                return (
                  <>
                    {nChased > 0 && (
                      <div className={s.pulseWrapper}>
                        <div className={s.pulseDot} />
                        <div className="pulse-ring" />
                      </div>
                    )}
                    <span className={s.chasingLabel}>{label}</span>
                  </>
                )
              })()}
              {!isMobile && (
                <span className={s.chaseSumStat}>
                  client{names.length > 1 ? "s" : ""}: <strong>{clientLabel}</strong>
                </span>
              )}
              <span className={s.chaseSumLate}>
                {minLate === maxLate ? `${maxLate}d overdue` : `${minLate}–${maxLate} days overdue`}
              </span>
              <span className={s.chasingTotal}>{fmt(totOwed)}</span>
              <span className={`${s.chaseChev}${chasingOpen ? " " + s.chaseChevOpen : ""}`} aria-hidden="true">▼</span>
            </div>
            {chasingOpen && sorted.map((i) => {
              const ex = chargeableExtras(i)
              const owed = outstanding(i)
              const stg = CHASE_STAGES.find((s) => s.id === i.chase_stage)
              // Only the serious end of the ladder gets colour — a row of
              // five bright badges reads as noise, one hot badge reads as
              // urgency.
              const hotStage = /final|escalation|recovery/.test(i.chase_stage || "")
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  className={`${s.chaseGridRow} table-row-hover`}
                  onClick={() => navigate(`/invoice/${i.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/invoice/${i.id}`) }}
                >
                  <span className={s.cgRef}>{i.ref}</span>
                  <span className={s.cgClient}>{i.client_name || "Client"}</span>
                  <span className={s.cgDue}>due <strong>{formatDate(i.due_date)}</strong></span>
                  <span className={s.cgStage}>
                    {stg && <span className={hotStage ? s.stagePillHot : s.stagePill}>{stg.label}</span>}
                  </span>
                  <span className={s.cgLate}>{daysLate(i.due_date)}d</span>
                  <span className={s.cgAmt}>
                    {fmt(owed + ex)}
                    {ex > 0 && <span className={s.chaseCompactExtra}>+{fmt(ex)}</span>}
                  </span>
                  <span className={s.arrowIcon} aria-hidden="true">→</span>
                </div>
              )
            })}
          </Card>
        </div>
        )
      })()}

      {clientGroups.length > 0 && (
        <div className={s.clientSection}>
          <div className={s.clientSectionHeader}>
            <h2 className={s.invoicesTitle}>Owed by client</h2>
            <span className={s.clientSectionSub}>Clients with several open invoices — send one email that itemises them all</span>
          </div>
          <div className={s.clientList}>
            {clientGroups.map((g) => {
              const lastStatement = g.email ? statementLog[g.email.toLowerCase()] : null
              // The books changed since their last statement (a payment was
              // recorded after it went out, or they've never had one while
              // payments exist) — their copy is stale.
              const lastPayment = g.email ? paymentLog[g.email.toLowerCase()] : null
              const stale = Boolean(lastPayment && (!lastStatement || new Date(lastPayment) > new Date(lastStatement)))
              return (
              <Card key={g.email || g.name} style={{ padding: isMobile ? "12px 14px" : "14px 18px" }}>
                <div className={s.clientRow}>
                  {/* Clicking the client filters the invoice table below to
                      them — the breakdown lives where invoices already live
                      instead of being repeated here. */}
                  {/* Name as the block headline; the stats sit centred in
                      the middle of the row rather than tucked under it. */}
                  <div
                    className={s.clientInfo}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter("all"); setSearch(g.name) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setStatusFilter("all"); setSearch(g.name) } }}
                    title="Show this client's invoices below"
                  >
                    <div className={s.clientName}>{g.name}</div>
                  </div>
                  <div className={s.clientMeta}>
                    {g.invoices.length} open invoice{g.invoices.length !== 1 ? "s" : ""}
                    {g.overdueCount > 0 && <span className={s.clientOverdue}> · oldest {g.oldestLate}d overdue</span>}
                    {lastStatement && <span className={s.clientStatementSent}> · statement sent {daysAgo(lastStatement)}</span>}
                    {stale && <span className={s.clientStale}> · payment recorded {daysAgo(lastPayment)}</span>}
                  </div>
                  <div
                    className={s.clientAmounts}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter("all"); setSearch(g.name) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setStatusFilter("all"); setSearch(g.name) } }}
                    title="Show this client's invoices below"
                  >
                    <div className={s.clientTotal}>{fmt(g.total)}</div>
                    {g.extras > 0 && <div className={s.clientExtras}>incl. +{fmt(g.extras)} by Hielda</div>}
                  </div>
                  <Btn sz="sm" v="ghost" onClick={() => openSplit(g)}>Record payment</Btn>
                  {g.email ? (
                    // The button opens the preview, where sending or
                    // downloading is decided — so its label describes the
                    // document, not the delivery. Primary when the client
                    // has never had a statement or theirs has gone stale.
                    <Btn sz="sm" v={lastStatement && !stale ? "ghost" : "primary"} onClick={() => openStatement(g)} dis={sendingStatement === g.email}>
                      {sendingStatement === g.email ? "Preparing…" : stale && lastStatement ? "Updated statement" : "Statement"}
                    </Btn>
                  ) : (
                    <span className={s.clientNoEmail}>No email on file</span>
                  )}
                </div>
              </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Split a lump payment across a client's open invoices */}
      {splitModal && (() => {
        const m = splitModal
        const total = parseFloat(m.amount) || 0
        const allocated = splitAllocated(m)
        const unallocated = round2(total - allocated)
        return (
        <div className={s.stmtOverlay} role="presentation" onClick={() => !m.saving && setSplitModal(null)}>
          <div className={s.stmtBox} role="dialog" aria-modal="true" aria-labelledby="split-title" onClick={(e) => e.stopPropagation()}>
            <div className={s.stmtHead}>
              <div className={s.stmtHeadText}>
                <div className={s.stmtTitle} id="split-title">Record a payment from {m.group.name}</div>
                <div className={s.stmtMeta}>Hielda suggests the split that costs them least — not-yet-due invoices first, then the oldest debt. Every line is editable.</div>
              </div>
              <button className={s.dismissBtn} onClick={() => setSplitModal(null)} aria-label="Close" disabled={m.saving}>✕</button>
            </div>
            <div className={s.splitBody}>
              <div className={s.splitInputs}>
                <label className={s.splitField}>
                  <span>Amount received</span>
                  <input type="number" step="0.01" value={m.amount} placeholder="0.00"
                    onChange={(e) => updateSplitAmount("amount", e.target.value)} className={s.splitAmount} />
                </label>
                <label className={s.splitField}>
                  <span>When was it paid?</span>
                  <input type="date" value={m.date} max={todayStr()}
                    onChange={(e) => updateSplitAmount("date", e.target.value)} className={s.splitDate} />
                </label>
              </div>
              <div className={s.splitRows}>
                {m.group.invoices.map((i) => {
                  const owedFull = invoiceOwed(i, m.date)
                  const preDue = m.date <= i.due_date
                  const val = parseFloat(m.alloc[i.id]) || 0
                  const closes = val >= owedFull - 0.005 && val > 0
                  return (
                    <div key={i.id} className={s.splitRow}>
                      <span className={s.splitRef}>{i.ref}</span>
                      <span className={s.splitDue}>
                        {preDue
                          ? <span className={s.splitPreDue}>due {formatDate(i.due_date)} — no charges if settled now</span>
                          : <>owes <strong>{fmt(owedFull)}</strong> incl. charges · {daysLate(i.due_date)}d late</>}
                      </span>
                      <span className={s.splitCloses}>{closes ? (preDue ? "✓ settles early" : "✓ closes it") : ""}</span>
                      <input
                        type="number" step="0.01" min="0" max={owedFull}
                        value={m.alloc[i.id] ?? ""}
                        placeholder="0.00"
                        onChange={(e) => setSplitModal((p) => ({ ...p, alloc: { ...p.alloc, [i.id]: e.target.value } }))}
                        className={s.splitAllocInput}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={s.stmtFoot}>
              <span className={s.splitRemainder} style={{ color: Math.abs(unallocated) > 0.005 ? "var(--or)" : "var(--gn)" }}>
                {total > 0
                  ? Math.abs(unallocated) > 0.005
                    ? `${fmt(Math.abs(unallocated))} ${unallocated > 0 ? "still to allocate" : "over-allocated"}`
                    : "Fully allocated ✓"
                  : "Enter the amount received"}
              </span>
              <div className={s.stmtFootBtns}>
                <Btn v="ghost" sz="sm" onClick={() => setSplitModal(null)} dis={m.saving}>Cancel</Btn>
                <Btn sz="sm" onClick={commitSplit} dis={m.saving || total <= 0 || Math.abs(unallocated) > 0.005}>
                  {m.saving ? "Recording…" : "Record payment"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Statement preview — the exact email, checked before it goes */}
      {stmtPreview && (
        <div className={s.stmtOverlay} role="presentation" onClick={() => !stmtPreview.sending && setStmtPreview(null)}>
          <div
            className={s.stmtBox}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stmt-preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.stmtHead}>
              <div className={s.stmtHeadText}>
                <div className={s.stmtTitle} id="stmt-preview-title">Statement to {stmtPreview.group.name}</div>
                <div className={s.stmtMeta}>To: {stmtPreview.email_to} (you're BCC'd) · {stmtPreview.subject}</div>
              </div>
              <button
                className={s.dismissBtn}
                onClick={() => setStmtPreview(null)}
                aria-label="Close preview"
                disabled={stmtPreview.sending}
              >
                ✕
              </button>
            </div>
            <iframe
              title="Statement preview"
              className={s.stmtFrame}
              sandbox=""
              srcDoc={stmtPreview.html}
              style={{ opacity: stmtPreview.loading ? 0.4 : 1 }}
            />
            <div className={s.stmtFoot}>
              <div className={s.stmtChecks}>
                <label className={s.stmtCheck}>
                  <input
                    type="checkbox"
                    checked={stmtPreview.includePayments}
                    onChange={() => toggleStatementOpt("includePayments")}
                    disabled={stmtPreview.loading || stmtPreview.sending}
                  />
                  <span>Include payments received (with dates)</span>
                </label>
                <label className={s.stmtCheck}>
                  <input
                    type="checkbox"
                    checked={stmtPreview.includeSettled}
                    onChange={() => toggleStatementOpt("includeSettled")}
                    disabled={stmtPreview.loading || stmtPreview.sending}
                  />
                  <span>Include recently settled invoices (last 60 days)</span>
                </label>
              </div>
              <div className={s.stmtFootBtns}>
                <Btn v="ghost" sz="sm" onClick={() => setStmtPreview(null)} dis={stmtPreview.sending}>Cancel</Btn>
                <Btn v="ghost" sz="sm" onClick={downloadStatementPdf} dis={stmtPreview.loading || stmtPreview.sending}>
                  Download PDF
                </Btn>
                <Btn sz="sm" onClick={confirmSendStatement} dis={stmtPreview.loading || stmtPreview.sending}>
                  {stmtPreview.sending ? "Sending…" : "Send now"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <EmailQueue invs={invs} profile={profile} onUpdate={onUpdate} />

      <div>
        <div className={s.invoicesHeader}>
          <h2 className={s.invoicesTitle}>All invoices</h2>
          <div className={s.searchWrap}>
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search invoices"
              className={s.searchInput}
            />
          </div>
          <Btn sz="sm" onClick={() => navigate("/create")}><Plus size={14} strokeWidth={2.5} /> New</Btn>
          {/* Overflow menu for low-frequency actions. CSV export sat in
              prime position before but most users never touch it — moving
              it here keeps the primary header clean while staying one
              tap away. */}
          <div className={s.overflowWrap}>
            <Btn sz="sm" v="ghost" onClick={() => setShowOverflow(v => !v)}>
              <MoreHorizontal size={14} />
            </Btn>
            {showOverflow && (
              <>
                <div onClick={() => setShowOverflow(false)} className={s.overflowBackdrop} />
                <div className={s.overflowMenu}>
                  <button
                    className={s.overflowItem}
                    disabled={filtered.length === 0}
                    onClick={() => {
                      setShowOverflow(false)
                      const headers = ["Ref","Client","Email","Issued","Due","Net","VAT","Total","Status","Days late","Paid date","Notes"]
                      const rows = filtered.map(i => [
                        i.ref,
                        i.client_name,
                        i.client_email || "",
                        i.issue_date || "",
                        i.due_date || "",
                        Number(i.amount).toFixed(2),
                        Number(i.vat_amount || 0).toFixed(2),
                        Number(i.total_with_vat || i.amount).toFixed(2),
                        i.status,
                        i.status === "overdue" ? daysLate(i.due_date) : "",
                        i.paid_date || "",
                        (i.notes || "").replace(/\n/g, " "),
                      ])
                      const csv = [headers, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n")
                      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = `hielda-invoices-${new Date().toISOString().split("T")[0]}.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                      trackEvent("invoices_exported_csv", { count: filtered.length })
                    }}
                  >
                    <Download size={14} />
                    <div>
                      <div className={s.overflowItemLabel}>Export CSV</div>
                      <div className={s.overflowItemSub}>Download the current view as a spreadsheet</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={s.filterBar}>
          {/* Disputed deliberately omitted: a disputed invoice is always
              visually distinct (purple border + badge on every row), and
              the state is rare enough that a top-level pill made the row
              feel cluttered. Disputed invoices remain visible under "All". */}
          {[
            { id: "all", label: "All", count: invs.length },
            { id: "overdue", label: overdue.some((i) => i.auto_chase !== false) ? "Chasing" : "Overdue", count: overdue.length, color: c.or },
            { id: "pending", label: "Pending", count: pending.length, color: c.am },
            // Count ALL paid invoices, not the stat card's 90-day window —
            // a pill that says 3 while clicking it shows 4 reads as rows
            // appearing and disappearing.
            { id: "paid", label: "Paid", count: invs.filter((i) => i.status === "paid").length, color: c.gn },
            ...(drafts.length > 0 ? [{ id: "drafts", label: "Drafts", count: drafts.length, color: c.td }] : []),
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={s.filterPill}
              style={{
                borderColor: statusFilter === f.id ? (f.color || c.ac) : undefined,
                background: statusFilter === f.id ? (f.color || c.ac) + "12" : undefined,
                color: statusFilter === f.id ? (f.color || c.ac) : undefined,
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {statusFilter === "drafts" ? (
          /* Drafts view — unfinished invoices, one tap back into the form. */
          <div className={s.draftsList}>
            {drafts.map((d) => (
              <button key={d.id} className={s.draftChip} onClick={() => navigate(`/create?draft=${d.id}`)}>
                <FileText size={14} className={s.draftChipIcon} />
                <span className={s.draftChipName}>{d.client_name || "Untitled invoice"}</span>
                {d.amount > 0 && <span className={s.draftChipAmount}>{fmt(d.amount)}</span>}
                <span className={s.draftChipAge}>edited {draftAge(d.updated_at)}</span>
                <span
                  role="button"
                  aria-label="Delete draft"
                  className={s.draftChipDelete}
                  onClick={(e) => deleteDraft(d.id, e)}
                >
                  <X size={13} />
                </span>
              </button>
            ))}
          </div>
        ) : invs.length === 0 ? (
          <Card style={{ textAlign: "center", padding: isMobile ? "40px 24px" : "56px 32px" }}>
            <div className={s.emptyIcon} aria-hidden="true" style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: "var(--td)" }}>
              <Inbox size={48} strokeWidth={1.5} />
            </div>
            <div className={s.emptyTitle} style={{ fontSize: 18 }}>Let's get your first invoice out</div>
            <div className={s.emptyText} style={{ maxWidth: 380, margin: "8px auto 20px", lineHeight: 1.6 }}>
              Add a client, list what you've done, and Hielda will handle the chasing, the interest, and the awkward bits — so you don't have to.
            </div>
            <Btn onClick={() => navigate("/create")} sz="lg"><Plus size={16} strokeWidth={2.5} /> Create your first invoice</Btn>
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--td)" }}>
              No client to invoice yet? Try the <a href="/calculator" style={{ color: "var(--ac)", textDecoration: "none", fontWeight: 600 }}>late payment calculator</a> to see what you're owed on past invoices.
            </div>
          </Card>
        ) : (
          <>
          {selected.size > 0 && (
            <div className={s.bulkBar}>
              <span className={s.bulkCount}>
                {selected.size} selected
              </span>
              <div className={s.bulkActions}>
                <Btn sz="sm" v="primary" onClick={bulkMarkPaid} dis={bulkLoading}>
                  <Check size={13} strokeWidth={2.5} /> Paid
                </Btn>
                <Btn sz="sm" v="danger" onClick={bulkDelete} dis={bulkLoading}>
                  <Trash2 size={13} /> Delete
                </Btn>
                <Btn sz="sm" v="ghost" onClick={() => setSelected(new Set())}>
                  ✕
                </Btn>
              </div>
            </div>
          )}

          {isMobile ? (
            /* Mobile: card-based invoice list */
            <div className={s.mobileList}>
              {filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "24px 16px" }}>
                  <span className={s.noMatch}>No invoices match your search.</span>
                </Card>
              ) : (
                filtered.map((i) => {
                  const ex = chargeableExtras(i)
                  // Paid rows show what actually arrived, not the face value —
                  // charges collected sit above it, settled-short sits below.
                  const cash = Number(i.amount_paid) || 0
                  const face = Number(i.total_with_vat) || Number(i.amount)
                  const owed = i.status === "paid" ? (cash > 0 ? cash : face) : outstanding(i)
                  const won = i.status === "paid" ? Math.max(0, round2(cash - face)) : 0
                  return (
                    <Card
                      key={i.id}
                      onClick={() => navigate(`/invoice/${i.id}`)}
                      style={{
                        padding: "12px 14px",
                        borderLeft: `3px solid ${i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : i.status === "disputed" ? "#7c3aed" : c.am}`,
                      }}
                    >
                      <div className={s.mobileCardInner}>
                        <input
                          type="checkbox"
                          checked={selected.has(i.id)}
                          onChange={() => toggleOne(i.id)}
                          onClick={(e) => e.stopPropagation()}
                          className={s.mobileCheckbox}
                        />
                        <div className={s.mobileCardBody}>
                          <div className={s.mobileCardTop}>
                            <span className={s.mobileClientName}>{i.client_name || "—"}</span>
                            <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : i.status === "disputed" ? "#7c3aed" : c.am}>
                              {i.status === "overdue" ? (i.auto_chase !== false ? "chasing" : "overdue") : i.status}
                            </Badge>
                          </div>
                          <div className={s.mobileRef}>{i.ref}</div>
                          <div className={s.mobileCardBottom}>
                            <div>
                              <span className={s.mobileAmount}>{fmt(owed + ex)}</span>
                              {ex > 0 && <span className={s.mobileExtra}>+{fmt(ex)}</span>}
                              {won > 0 && <span className={s.wonTag}>incl. +{fmt(won)} claimed</span>}
                              {i.status === "paid" && cash > 0 && cash < face - 0.005 && (
                                <span className={s.partPaidTag}>settled — {fmt(round2(face - cash))} off</span>
                              )}
                              {ex === 0 && i.status === "overdue" && (i.no_fines || i.client_type === "consumer") && (
                                <span className={s.waivedTag}>fines waived</span>
                              )}
                              {i.status !== "paid" && (Number(i.amount_paid) || 0) > 0 && (
                                <span className={s.partPaidTag}>{fmt(Number(i.amount_paid))} paid</span>
                              )}
                            </div>
                            <span className={s.mobileDue}>Due {formatDate(i.due_date)}</span>
                          </div>
                        </div>
                        <span className={s.mobileArrow} aria-hidden="true">→</span>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          ) : (
            /* Desktop: table view */
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <table className={s.table}>
                <thead className={s.tableHead}>
                  <tr>
                    <th className={s.thCheck}>
                      <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className={s.checkbox} />
                    </th>
                    {[
                      { label: "Ref", col: null },
                      { label: "Client", col: "client_name" },
                      { label: "Amount", col: "amount" },
                      { label: "Extra", col: null },
                      { label: "Total", col: null },
                      { label: "Due", col: "due_date" },
                      { label: "Status", col: null },
                    ].map((h) => (
                      <th
                        key={h.label}
                        onClick={h.col ? () => toggleSort(h.col) : undefined}
                        className={h.col ? s.thSortable : s.th}
                      >
                        {h.label}{h.col && <SortIcon col={h.col} />}
                      </th>
                    ))}
                    <th className={s.thView}><span className="sr-only">View</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={s.tdEmpty}>
                        No invoices match your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((i) => {
                      const ex = chargeableExtras(i)
                      // Paid rows show what actually arrived: collected late
                      // charges appear in Extra, and Total is real cash — so
                      // a settled invoice's row matches the Paid stat card.
                      const cash = Number(i.amount_paid) || 0
                      const face = Number(i.total_with_vat) || Number(i.amount)
                      const owed = i.status === "paid" ? (cash > 0 ? cash : face) : outstanding(i)
                      const won = i.status === "paid" ? Math.max(0, round2(cash - face)) : 0
                      const settledShort = i.status === "paid" && cash > 0 && cash < face - 0.005
                      const partPaid = i.status !== "paid" && (Number(i.amount_paid) || 0) > 0
                      return (
                        <tr
                          key={i.id}
                          className={`${s.tableRow} table-row-hover`}
                          onClick={() => navigate(`/invoice/${i.id}`)}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/invoice/${i.id}`) }}
                        >
                          <td className={s.tdCheck} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} className={s.checkbox} />
                          </td>
                          <td className={s.tdRef}>{i.ref}</td>
                          <td className={s.tdClient}>{i.client_name || "—"}</td>
                          <td className={s.tdMono}>
                            {fmt(i.amount)}
                            {partPaid && <span className={s.partPaidTag}>{fmt(Number(i.amount_paid))} paid</span>}
                            {settledShort && <span className={s.partPaidTag}>settled — {fmt(round2(face - cash))} off</span>}
                          </td>
                          <td className={s.tdMonoBold} style={{ color: won > 0 ? c.gn : ex > 0 ? c.go : c.td }}>
                            {/* "waived" beats a silent dash: an overdue invoice
                                with fines switched off looked like a broken
                                Extra column rather than a choice. Green on paid
                                rows = late charges actually collected. */}
                            {won > 0 ? <span title="Late charges collected">+{fmt(won)} claimed</span>
                              : ex > 0 ? `+${fmt(ex)}`
                              : i.status === "overdue" && (i.no_fines || i.client_type === "consumer") ? <span className={s.waivedTag}>waived</span>
                              : "—"}
                          </td>
                          <td className={s.tdMonoBold}>{fmt(owed + ex)}</td>
                          <td className={s.tdDue}>{formatDate(i.due_date)}</td>
                          <td className={s.td}>
                            <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : i.status === "disputed" ? "#7c3aed" : c.am}>
                              {i.status === "overdue" ? (i.auto_chase !== false ? "being chased" : "overdue") : i.status}
                            </Badge>
                          </td>
                          <td className={s.tdArrow} aria-hidden="true">→</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </Card>
          )}
          </>
        )}
      </div>
    </div>
  )
}
