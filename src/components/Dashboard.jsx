import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { colors as c, CHASE_STAGES } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, round2 } from "../utils"
import { Card, Badge, Btn, StatCard } from "./ui"
import { supabase } from "../supabase"
import EmailQueue from "./EmailQueue"
import s from "./Dashboard.module.css"

export default function Dashboard({ invs, isMobile, onUpdate, profile }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  const needsPaymentDetails = !profile?.sort_code || !profile?.account_number

  const { overdue, pending, paid, disputed, totExtra, totOwed } = useMemo(() => {
    const overdue = invs.filter((i) => i.status === "overdue")
    const pending = invs.filter((i) => i.status === "pending")
    const disputed = invs.filter((i) => i.status === "disputed")
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const paid = invs.filter((i) => i.status === "paid" && (!i.paid_date || new Date(i.paid_date) >= cutoff))

    const totExtra = round2(overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0))

    const totOwed = round2(overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + Number(i.amount) + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0))

    return { overdue, pending, paid, disputed, totExtra, totOwed }
  }, [invs])

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
    if (!window.confirm(`Mark ${selected.size} invoice(s) as paid?`)) return
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
    if (!window.confirm(`Permanently delete ${selected.size} invoice(s)? This cannot be undone.`)) return
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

      {needsPaymentDetails && !dismissedBanner && (
        <div className={s.banner}>
          <div className={s.bannerBody}>
            <span className={s.bannerIcon}>💳</span>
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
        <StatCard label="Extra by Hielda" value={`+${fmt(totExtra)}`} sub="penalties + interest" color={c.go} borderColor="#d4a017" />
        <StatCard label="Being chased" value={fmt(totOwed)} sub={`${overdue.length} invoice${overdue.length !== 1 ? "s" : ""}`} color={c.or} borderColor="#d97706" />
        <StatCard label="Pending" value={fmt(pending.reduce((s, i) => s + Number(i.amount), 0))} sub={`${pending.length} not yet due`} color={c.am} borderColor="#b45309" />
        <StatCard label="Paid (90 days)" value={fmt(paid.reduce((s, i) => s + Number(i.amount), 0))} sub={`${paid.length} invoice${paid.length !== 1 ? "s" : ""}`} color={c.gn} borderColor="#1e5fa0" />
      </div>

      {overdue.length > 0 && (
        <div className={s.chasingSection}>
          <div className={s.chasingHeader}>
            <div className={s.pulseWrapper}>
              <div className={s.pulseDot} />
              <div className="pulse-ring" />
            </div>
            <span className={s.chasingLabel}>Hielda is chasing these</span>
          </div>
          <div className={s.chasingList}>
            {overdue.map((i) => {
              const dl = daysLate(i.due_date)
              const ex = round2(calcInterest(Number(i.amount), dl) + penalty(Number(i.amount)))
              const stg = CHASE_STAGES.find((s) => s.id === i.chase_stage)
              return (
                <Card key={i.id} onClick={() => navigate(`/invoice/${i.id}`)} style={{ padding: isMobile ? "12px 14px" : "13px 18px" }}>
                  {isMobile ? (
                    /* Mobile: stacked layout */
                    <div>
                      <div className={s.chaseMobileTop}>
                        <div className={s.chaseMobileAvatar} aria-hidden="true">
                          🛡️
                        </div>
                        <div className={s.chaseMobileInfo}>
                          <div className={s.chaseMobileClient}>{i.client_name || "Client"}</div>
                          <div className={s.chaseMobileRef}>{i.ref} · {i.description}</div>
                        </div>
                        <span className={s.arrowIcon} aria-hidden="true">→</span>
                      </div>
                      <div className={s.chaseMobileBottom}>
                        <div>
                          <span className={s.chaseMobileTotal}>{fmt(Number(i.amount) + ex)}</span>
                          <span className={s.chaseMobileExtra}>+{fmt(ex)}</span>
                        </div>
                        {stg && <Badge color={stg.col}>{stg.label}</Badge>}
                      </div>
                    </div>
                  ) : (
                    /* Desktop: horizontal layout */
                    <div className={s.chaseRow}>
                      <div className={s.chaseLeft}>
                        <div className={s.chaseAvatar} aria-hidden="true">
                          🛡️
                        </div>
                        <div>
                          <div className={s.chaseClient}>{i.client_name || "Client"}</div>
                          <div className={s.chaseRef}>{i.ref} · {i.description}</div>
                        </div>
                      </div>
                      <div className={s.chaseRight}>
                        <div className={s.chaseAmounts}>
                          <div className={s.chaseTotal}>{fmt(Number(i.amount) + ex)}</div>
                          <div className={s.chaseExtra}>+{fmt(ex)} extra</div>
                        </div>
                        {stg && <Badge color={stg.col}>{stg.label}</Badge>}
                        <span className={s.arrowIcon} aria-hidden="true">→</span>
                      </div>
                    </div>
                  )}
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
          <Btn sz="sm" onClick={() => navigate("/create")}>+ New</Btn>
        </div>
        <div className={s.filterBar}>
          {[
            { id: "all", label: "All", count: invs.length },
            { id: "overdue", label: "Chasing", count: overdue.length, color: c.or },
            { id: "pending", label: "Pending", count: pending.length, color: c.am },
            { id: "disputed", label: "Disputed", count: disputed.length, color: "#7c3aed" },
            { id: "paid", label: "Paid", count: paid.length, color: c.gn },
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

        {invs.length === 0 ? (
          <Card style={{ textAlign: "center", padding: isMobile ? "30px 20px" : "40px 24px" }}>
            <div className={s.emptyIcon} aria-hidden="true">📋</div>
            <div className={s.emptyTitle}>No invoices yet</div>
            <div className={s.emptyText}>Create your first invoice and Hielda will handle the rest.</div>
            <Btn onClick={() => navigate("/create")}>+ Create Invoice</Btn>
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
                  ✓ Paid
                </Btn>
                <Btn sz="sm" v="danger" onClick={bulkDelete} dis={bulkLoading}>
                  🗑 Delete
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
                  const dl = daysLate(i.due_date)
                  const ex = i.status === "overdue" ? round2(calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))) : 0
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
                              <span className={s.mobileAmount}>{fmt(Number(i.amount) + ex)}</span>
                              {ex > 0 && <span className={s.mobileExtra}>+{fmt(ex)}</span>}
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
                      const dl = daysLate(i.due_date)
                      const ex = i.status === "overdue" ? round2(calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))) : 0
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
                          <td className={s.tdMono}>{fmt(i.amount)}</td>
                          <td className={s.tdMonoBold} style={{ color: ex > 0 ? c.go : c.td }}>
                            {ex > 0 ? `+${fmt(ex)}` : "—"}
                          </td>
                          <td className={s.tdMonoBold}>{fmt(Number(i.amount) + ex)}</td>
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
