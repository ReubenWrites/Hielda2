import { useState, useMemo, useEffect } from "react"
import { colors as c, FONT, MONO, CHASE_STAGES } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate } from "../utils"
import { Card, Badge, Btn, StatCard } from "./ui"
import { supabase } from "../supabase"

export default function Dashboard({ invs, nav, isMobile, onUpdate, profile }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortDir, setSortDir] = useState("desc")
  const [selected, setSelected] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  const needsPaymentDetails = !profile?.sort_code || !profile?.account_number

  const { overdue, pending, paid, totExtra, totOwed } = useMemo(() => {
    const overdue = invs.filter((i) => i.status === "overdue")
    const pending = invs.filter((i) => i.status === "pending")
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
    const paid = invs.filter((i) => i.status === "paid" && (!i.paid_date || new Date(i.paid_date) >= cutoff))

    const totExtra = overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0)

    const totOwed = overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + Number(i.amount) + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0)

    return { overdue, pending, paid, totExtra, totOwed }
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
    <span style={{ fontSize: 9, marginLeft: 3, color: sortBy === col ? c.ac : c.td }}>
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
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.tx, margin: 0 }}>Dashboard</h1>
        <p style={{ color: c.tm, margin: "5px 0 0", fontSize: 13 }}>
          Your payment overview for {formatDate(new Date())}
        </p>
      </div>

      {needsPaymentDetails && !dismissedBanner && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: isMobile ? "12px 14px" : "12px 18px",
          background: "#fffbeb", border: "1px solid #f59e0b40", borderRadius: 10,
          marginBottom: isMobile ? 14 : 18, gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💳</span>
            <span style={{ fontSize: 13, color: c.tx }}>
              Add your payment details so clients know where to pay.
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Btn sz="sm" onClick={() => nav("settings")}>Add now</Btn>
            <button
              onClick={() => setDismissedBanner(true)}
              style={{ background: "none", border: "none", color: c.td, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4,1fr)", gap: isMobile ? 8 : 10, marginBottom: isMobile ? 18 : 24 }}>
        <StatCard label="Extra by Hielda" value={`+${fmt(totExtra)}`} sub="penalties + interest" color={c.go} borderColor="#d4a017" />
        <StatCard label="Being chased" value={fmt(totOwed)} sub={`${overdue.length} invoice${overdue.length !== 1 ? "s" : ""}`} color={c.or} borderColor="#d97706" />
        <StatCard label="Pending" value={fmt(pending.reduce((s, i) => s + Number(i.amount), 0))} sub={`${pending.length} not yet due`} color={c.am} borderColor="#b45309" />
        <StatCard label="Paid (90 days)" value={fmt(paid.reduce((s, i) => s + Number(i.amount), 0))} sub={`${paid.length} invoice${paid.length !== 1 ? "s" : ""}`} color={c.gn} borderColor="#1e5fa0" />
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom: isMobile ? 18 : 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", width: 8, height: 8 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: c.ac }} />
              <div className="pulse-ring" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: c.ac }}>Hielda is chasing these</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.map((i) => {
              const dl = daysLate(i.due_date)
              const ex = calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
              const stg = CHASE_STAGES.find((s) => s.id === i.chase_stage)
              return (
                <Card key={i.id} onClick={() => nav("detail", i.id)} style={{ padding: isMobile ? "12px 14px" : "13px 18px" }}>
                  {isMobile ? (
                    /* Mobile: stacked layout */
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }} aria-hidden="true">
                          🛡️
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: c.tx, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.client_name || "Client"}</div>
                          <div style={{ fontSize: 10, color: c.tm, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.ref} · {i.description}</div>
                        </div>
                        <span style={{ color: c.td, fontSize: 15 }} aria-hidden="true">→</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ fontWeight: 600, color: c.tx, fontFamily: MONO, fontSize: 14 }}>{fmt(Number(i.amount) + ex)}</span>
                          <span style={{ fontSize: 10, color: c.go, fontWeight: 600, marginLeft: 6 }}>+{fmt(ex)}</span>
                        </div>
                        {stg && <Badge color={stg.col}>{stg.label}</Badge>}
                      </div>
                    </div>
                  ) : (
                    /* Desktop: horizontal layout */
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }} aria-hidden="true">
                          🛡️
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: c.tx, fontSize: 13 }}>{i.client_name || "Client"}</div>
                          <div style={{ fontSize: 11, color: c.tm, marginTop: 1 }}>{i.ref} · {i.description}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 600, color: c.tx, fontFamily: MONO, fontSize: 14 }}>{fmt(Number(i.amount) + ex)}</div>
                          <div style={{ fontSize: 10, color: c.go, fontWeight: 600, marginTop: 1 }}>+{fmt(ex)} extra</div>
                        </div>
                        {stg && <Badge color={stg.col}>{stg.label}</Badge>}
                        <span style={{ color: c.td, fontSize: 15 }} aria-hidden="true">→</span>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, marginBottom: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: c.tx, margin: 0, flexShrink: 0 }}>All invoices</h2>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : "auto", order: isMobile ? 3 : 0 }}>
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search invoices"
              style={{
                width: "100%",
                maxWidth: isMobile ? "100%" : 280,
                padding: "7px 12px",
                background: c.bg,
                border: `1px solid ${c.bd}`,
                borderRadius: 8,
                fontFamily: FONT,
                fontSize: 12,
                color: c.tx,
                outline: "none",
              }}
            />
          </div>
          <Btn sz="sm" onClick={() => nav("create")}>+ New</Btn>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All", count: invs.length },
            { id: "overdue", label: "Chasing", count: overdue.length, color: c.or },
            { id: "pending", label: "Pending", count: pending.length, color: c.am },
            { id: "paid", label: "Paid", count: paid.length, color: c.gn },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                border: `1px solid ${statusFilter === f.id ? (f.color || c.ac) : c.bd}`,
                background: statusFilter === f.id ? (f.color || c.ac) + "12" : c.sf,
                color: statusFilter === f.id ? (f.color || c.ac) : c.tm,
                cursor: "pointer", fontFamily: FONT,
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {invs.length === 0 ? (
          <Card style={{ textAlign: "center", padding: isMobile ? "30px 20px" : "40px 24px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 4 }}>No invoices yet</div>
            <div style={{ fontSize: 13, color: c.tm, marginBottom: 16 }}>Create your first invoice and Hielda will handle the rest.</div>
            <Btn onClick={() => nav("create")}>+ Create Invoice</Btn>
          </Card>
        ) : (
          <>
          {selected.size > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: isMobile ? "8px 12px" : "10px 16px",
              background: c.acd, border: `1px solid rgba(30,95,160,0.15)`,
              borderRadius: 10, marginBottom: 10,
              flexWrap: isMobile ? "wrap" : "nowrap", gap: 8,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.ac }}>
                {selected.size} selected
              </span>
              <div style={{ display: "flex", gap: 6 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "24px 16px" }}>
                  <span style={{ color: c.tm, fontSize: 13 }}>No invoices match your search.</span>
                </Card>
              ) : (
                filtered.map((i) => {
                  const dl = daysLate(i.due_date)
                  const ex = i.status === "overdue" ? calcInterest(Number(i.amount), dl) + penalty(Number(i.amount)) : 0
                  return (
                    <Card
                      key={i.id}
                      onClick={() => nav("detail", i.id)}
                      style={{
                        padding: "12px 14px",
                        borderLeft: `3px solid ${i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : c.am}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={selected.has(i.id)}
                          onChange={() => toggleOne(i.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ cursor: "pointer", marginTop: 3, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: c.tx, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.client_name || "—"}</span>
                            <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : c.am}>
                              {i.status === "overdue" ? "chasing" : i.status}
                            </Badge>
                          </div>
                          <div style={{ fontSize: 11, color: c.td, fontFamily: MONO, marginBottom: 6 }}>{i.ref}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 14, color: c.tx }}>{fmt(Number(i.amount) + ex)}</span>
                              {ex > 0 && <span style={{ fontSize: 10, color: c.go, fontWeight: 600, marginLeft: 6 }}>+{fmt(ex)}</span>}
                            </div>
                            <span style={{ fontSize: 11, color: c.tm }}>Due {formatDate(i.due_date)}</span>
                          </div>
                        </div>
                        <span style={{ color: c.td, fontSize: 14, flexShrink: 0, marginTop: 2 }} aria-hidden="true">→</span>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          ) : (
            /* Desktop: table view */
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.bd}`, background: "#f8f9fb" }}>
                    <th style={{ padding: "10px 8px", width: 36 }}>
                      <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} style={{ cursor: "pointer" }} />
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
                        style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: c.tm, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", cursor: h.col ? "pointer" : "default", userSelect: "none" }}
                      >
                        {h.label}{h.col && <SortIcon col={h.col} />}
                      </th>
                    ))}
                    <th style={{ width: 30 }}><span className="sr-only">View</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "24px 12px", textAlign: "center", color: c.tm, fontSize: 13 }}>
                        No invoices match your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((i) => {
                      const dl = daysLate(i.due_date)
                      const ex = i.status === "overdue" ? calcInterest(Number(i.amount), dl) + penalty(Number(i.amount)) : 0
                      return (
                        <tr
                          key={i.id}
                          style={{ borderBottom: `1px solid ${c.bdl}`, cursor: "pointer" }}
                          onClick={() => nav("detail", i.id)}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") nav("detail", i.id) }}
                          className="table-row-hover"
                        >
                          <td style={{ padding: "10px 8px" }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} style={{ cursor: "pointer" }} />
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: c.td }}>{i.ref}</td>
                          <td style={{ padding: "10px 12px", color: c.tx, fontWeight: 500 }}>{i.client_name || "—"}</td>
                          <td style={{ padding: "10px 12px", fontFamily: MONO }}>{fmt(i.amount)}</td>
                          <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: ex > 0 ? c.go : c.td }}>
                            {ex > 0 ? `+${fmt(ex)}` : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600 }}>{fmt(Number(i.amount) + ex)}</td>
                          <td style={{ padding: "10px 12px", color: c.tm }}>{formatDate(i.due_date)}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : c.am}>
                              {i.status === "overdue" ? "being chased" : i.status}
                            </Badge>
                          </td>
                          <td style={{ padding: "10px 12px", color: c.td }} aria-hidden="true">→</td>
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
