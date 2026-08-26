import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Trash2, Download, Plus, Inbox, MoreHorizontal, CreditCard, PartyPopper, FileText, X } from "lucide-react"
import { colors as c, CHASE_STAGES } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, round2, outstanding, chargeableExtras } from "../utils"
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
    // brought in. The strongest number in the product — show it off.
    const totExtraWon = round2(invs.reduce((s, i) => {
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

  // When each client last received a consolidated statement — shown on the
  // client row so a second send is a decision, not an accident.
  const [statementLog, setStatementLog] = useState({})
  useEffect(() => {
    if (!profile?.id || clientGroups.length === 0) return
    ;(async () => {
      const { data } = await supabase
        .from("chase_log")
        .select("email_to, sent_at")
        .eq("user_id", profile.id)
        .eq("status", "statement_sent")
        .order("sent_at", { ascending: false })
        .limit(100)
      const byEmail = {}
      for (const row of data || []) {
        const key = (row.email_to || "").toLowerCase()
        if (key && !byEmail[key]) byEmail[key] = row.sent_at
      }
      setStatementLog(byEmail)
    })()
  }, [profile?.id, invs, clientGroups.length])

  const daysAgo = (ts) => {
    const d = Math.floor((Date.now() - new Date(ts).getTime()) / 864e5)
    return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`
  }

  const sendStatement = async (group) => {
    const lines = group.invoices
      .map((i) => `${i.ref} — ${fmt(round2(outstanding(i) + chargeableExtras(i)))}${i.status === "overdue" ? ` (${daysLate(i.due_date)}d late)` : ""}`)
      .join("\n")
    if (!(await confirm({
      title: `Send a consolidated statement to ${group.name}?`,
      message: `One email to ${group.email} itemising every outstanding invoice:\n\n${lines}\n\nTotal owed: ${fmt(group.total)}\n\nYou'll be BCC'd a copy.`,
      confirmLabel: "Send statement",
      cancelLabel: "Cancel",
    }))) return
    setSendingStatement(group.email)
    try {
      const session = await supabase.auth.getSession()
      const res = await fetch("/api/send-chase-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_ids: group.invoices.map((i) => i.id),
          user_token: session.data.session?.access_token,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      trackEvent("statement_sent", { invoice_count: data.invoice_count, total: data.total })
      toast.success(`Statement sent to ${data.email_to} — ${fmt(data.total)} across ${data.invoice_count} invoices`)
      onUpdate()
    } catch (e) {
      toast.error("Failed to send statement: " + e.message)
    }
    setSendingStatement("")
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

  const bulkMarkPaid = async () => {
    if (!(await confirm({
      title: `Mark ${selected.size} ${selected.size === 1 ? "invoice" : "invoices"} as paid?`,
      message: "Each one will be marked paid with today's date. Any active chasing stops immediately.",
      confirmLabel: "Mark as paid",
      cancelLabel: "Cancel",
    }))) return
    setBulkLoading(true)
    try {
      const ids = Array.from(selected)
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0], chase_stage: null })
        .in("id", ids)
      if (error) throw error
      setSelected(new Set())
      onUpdate()
    } catch (e) {
      alert("Failed to update: " + e.message)
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
        {/* Three cards, not four: "Extra by Hielda" is a slice of the other
            two numbers (claimed extras live inside Being chased, collected
            extras inside Paid), so it reads as a sub-line on each rather
            than a card double-counting them. "Being chased" keeps the warm
            accent — it's the actionable one. */}
        <StatCard
          label="Being chased"
          value={fmt(totOwed)}
          sub={`${overdue.length} invoice${overdue.length !== 1 ? "s" : ""}${totExtra > 0 ? ` · incl. +${fmt(totExtra)} by Hielda` : ""}`}
          color="var(--or)"
          borderColor="var(--or)"
        />
        {/* outstanding() so a part-paid pending invoice isn't double
            counted — its paid slice lives in the Paid card. */}
        <StatCard label="Pending" value={fmt(round2(pending.reduce((s, i) => s + outstanding(i), 0)))} sub={`${pending.length} not yet due`} color="var(--acl)" borderColor="var(--acl)" />
        <StatCard
          label="Paid (90 days)"
          value={fmt(totPaid)}
          sub={`${paid.length} invoice${paid.length !== 1 ? "s" : ""}${partPaidCount > 0 ? ` + ${partPaidCount} part-paid` : ""}${totExtraWon > 0 ? ` · incl. +${fmt(totExtraWon)} won by Hielda` : ""}`}
          color="var(--ac)"
          borderColor="var(--ac)"
        />
      </div>

      {overdue.length > 0 && (
        <div className={s.chasingSection}>
          <div className={s.chasingHeader}>
            <div className={s.pulseWrapper}>
              <div className={s.pulseDot} />
              <div className="pulse-ring" />
            </div>
            <span className={s.chasingLabel}>Hielda is chasing these</span>
            <span className={s.chasingTotal}>{fmt(totOwed)}</span>
          </div>
          {/* One compact card, one line per invoice, most overdue first.
              Descriptions, avatars and per-invoice cards made this section
              a wall — the detail page holds the story, this holds the
              status. */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {[...overdue].sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).map((i, idx) => {
              const ex = chargeableExtras(i)
              const owed = outstanding(i)
              const stg = CHASE_STAGES.find((s) => s.id === i.chase_stage)
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  className={`${s.chaseCompactRow} table-row-hover`}
                  style={idx > 0 ? { borderTop: "1px solid var(--bdl)" } : undefined}
                  onClick={() => navigate(`/invoice/${i.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/invoice/${i.id}`) }}
                >
                  <span className={s.chaseCompactRef}>{i.ref}</span>
                  <span className={s.chaseCompactClient}>{i.client_name || "Client"}</span>
                  {!isMobile && stg && <Badge color={stg.col}>{stg.label}</Badge>}
                  <span className={s.chaseCompactLate}>{daysLate(i.due_date)}d late</span>
                  <span className={s.chaseCompactAmt}>
                    {fmt(owed + ex)}
                    {ex > 0 && <span className={s.chaseCompactExtra}>+{fmt(ex)}</span>}
                  </span>
                  <span className={s.arrowIcon} aria-hidden="true">→</span>
                </div>
              )
            })}
          </Card>
        </div>
      )}

      {clientGroups.length > 0 && (
        <div className={s.clientSection}>
          <div className={s.clientSectionHeader}>
            <h2 className={s.invoicesTitle}>Owed by client</h2>
            <span className={s.clientSectionSub}>Clients with several open invoices — send one email that itemises them all</span>
          </div>
          <div className={s.clientList}>
            {clientGroups.map((g) => {
              const lastStatement = g.email ? statementLog[g.email.toLowerCase()] : null
              return (
              <Card key={g.email || g.name} style={{ padding: isMobile ? "12px 14px" : "14px 18px" }}>
                <div className={s.clientRow}>
                  {/* Clicking the client filters the invoice table below to
                      them — the breakdown lives where invoices already live
                      instead of being repeated here. */}
                  <div
                    className={s.clientInfo}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setStatusFilter("all"); setSearch(g.name) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setStatusFilter("all"); setSearch(g.name) } }}
                    title="Show this client's invoices below"
                  >
                    <div className={s.clientName}>{g.name}</div>
                    <div className={s.clientMeta}>
                      {g.invoices.length} open invoice{g.invoices.length !== 1 ? "s" : ""}
                      {g.overdueCount > 0 && <span className={s.clientOverdue}> · oldest {g.oldestLate}d overdue</span>}
                      {lastStatement && <span className={s.clientStatementSent}> · statement sent {daysAgo(lastStatement)}</span>}
                    </div>
                  </div>
                  <div className={s.clientAmounts}>
                    <div className={s.clientTotal}>{fmt(g.total)}</div>
                    {g.extras > 0 && <div className={s.clientExtras}>incl. +{fmt(g.extras)} by Hielda</div>}
                  </div>
                  {g.email ? (
                    <Btn sz="sm" v={lastStatement ? "ghost" : "primary"} onClick={() => sendStatement(g)} dis={sendingStatement === g.email}>
                      {sendingStatement === g.email ? "Sending…" : lastStatement ? "Send again" : "Send statement"}
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
            { id: "overdue", label: "Chasing", count: overdue.length, color: c.or },
            { id: "pending", label: "Pending", count: pending.length, color: c.am },
            { id: "paid", label: "Paid", count: paid.length, color: c.gn },
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
                  const owed = i.status === "paid" ? Number(i.amount) : outstanding(i)
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
                              {i.status === "overdue" ? "chasing" : i.status}
                            </Badge>
                          </div>
                          <div className={s.mobileRef}>{i.ref}</div>
                          <div className={s.mobileCardBottom}>
                            <div>
                              <span className={s.mobileAmount}>{fmt(owed + ex)}</span>
                              {ex > 0 && <span className={s.mobileExtra}>+{fmt(ex)}</span>}
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
                      const owed = i.status === "paid" ? Number(i.amount) : outstanding(i)
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
                          </td>
                          <td className={s.tdMonoBold} style={{ color: ex > 0 ? c.go : c.td }}>
                            {/* "waived" beats a silent dash: an overdue invoice
                                with fines switched off looked like a broken
                                Extra column rather than a choice. */}
                            {ex > 0 ? `+${fmt(ex)}` : i.status === "overdue" && (i.no_fines || i.client_type === "consumer") ? <span className={s.waivedTag}>waived</span> : "—"}
                          </td>
                          <td className={s.tdMonoBold}>{fmt(owed + ex)}</td>
                          <td className={s.tdDue}>{formatDate(i.due_date)}</td>
                          <td className={s.td}>
                            <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : i.status === "disputed" ? "#7c3aed" : c.am}>
                              {i.status === "overdue" ? "being chased" : i.status}
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
